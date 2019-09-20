local audienceKeyTemplate = KEYS[1]
local metaDataTemplate = KEYS[2]
local Id = ARGV[1]
local updateOptsJson = ARGV[2]

redis.replicate_commands()

local updateOpts = cjson.decode(updateOptsJson)

local function loadScript(code, environment)
  if setfenv and loadstring then
    local f = assert(loadstring(code))
    setfenv(f,environment)
    return f
  else
    return assert(load(code, nil,"t",environment))
  end
end

local function tablesUniqueItems(...)
  local args = {...}
  local tableWithUniqueItems = {}
  for _, passedTable in pairs(args) do
    for __, keyName in pairs(passedTable) do
      tableWithUniqueItems[keyName] = keyName
    end
  end
  return tableWithUniqueItems
end

local function makeKey (template, id, audience)
  local str = template:gsub('{id}', id, 1)
  if audience ~= nil then
    str = str:gsub('{audience}', audience, 1)
  end
  return str
end

--
-- available ops definition
--
local function opSet(metaKey, args)
  local setArgs = {}
  local result = {}

  for field, value in pairs(args) do
    table.insert(setArgs, field)
    table.insert(setArgs, value)
  end

  local callResult = redis.call("HMSET", metaKey, unpack(setArgs))
  result[1] = callResult.ok
  return result
end

local function opRemove(metaKey, args)
  local result = 0;
  for i, field in pairs(args) do
    result = result + redis.call("HDEL", metaKey, field)
  end
  return result
end

local function opIncr(metaKey, args)
  local result = {}
  for field, incrVal in pairs(args) do
    result[field] = redis.call("HINCRBY", metaKey, field, incrVal)
  end
  return result
end

-- operations index
local metaOps = {
  ['$set'] = opSet,
  ['$remove'] = opRemove,
  ['$incr'] = opIncr
}

--
-- Script body
--
local scriptResult = {}

local keysToProcess = {};
for i, audience in ipairs(updateOpts.audiences) do
  local key = makeKey(metaDataTemplate, Id, audience)
  table.insert(keysToProcess, i, key);
end

if updateOpts.metaOps then
  for i, op in ipairs(updateOpts.metaOps) do
    local targetOpKey = keysToProcess[i]
    local metaProcessResult = {};

    for opName, opArg in pairs(op) do
      local processFn = metaOps[opName];

      if processFn == nil then
        return redis.error_reply("Unsupported command:" .. opName)
      end
      if type(opArg) ~= "table" then
        return redis.error_reply("Args for ".. opName .." must be and array")
      end

      metaProcessResult[opName] = processFn(targetOpKey, opArg)
    end
    table.insert(scriptResult, metaProcessResult)
  end

elseif updateOpts.scripts then
  local env = {};
  -- allow read access to this script scope
  setmetatable(env,{__index=_G})

  for i, script in pairs(updateOpts.scripts) do
    env.ARGV = script.argv
    env.KEYS = keysToProcess
    local fn = loadScript(script.lua, env)
    scriptResult[script.name] = fn()
  end

end

local audienceKey = makeKey(audienceKeyTemplate, Id)
local audiences = redis.call("SMEMBERS", audienceKey)
local processedAudiences = updateOpts.audiences
local uniqueAudiences = tablesUniqueItems(audiences, processedAudiences)

for _, audience in pairs(uniqueAudiences) do
  local metaKey = makeKey(metaDataTemplate, Id, audience)
  local dataLen = redis.call("HLEN", metaKey)

  if (dataLen > 0) then
    redis.call("SADD", audienceKey, audience)
  else
    redis.call("SREM", audienceKey, audience)
  end
end


return cjson.encode(scriptResult)
