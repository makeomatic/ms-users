-- script replicates commands instead of own body
-- call of HMSET command is determined as 'non deterministic command'
-- and redis refuses to run it without this.
redis.replicate_commands()

local audienceKeyTemplate = KEYS[1]
local metaDataTemplate = KEYS[2]
local Id = ARGV[1]
local updateOptsJson = ARGV[2]

local function isValidString(val)
  if type(val) == 'string' and string.len(val) > 0 then
    return true
  end
  return false
end

assert(isValidString(Id), 'incorrect `id` argument')
assert(isValidString(updateOptsJson), 'incorrect `updateJson` argument')

local updateOpts = cjson.decode(updateOptsJson)

local function loadScript(code, environment)
  if setfenv and loadstring then
    local f = assert(loadstring(code))
    setfenv(f, environment)
    return f
  else
    return assert(load(code, nil, "t", environment))
  end
end

-- creates array with unique items from passed arrays
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

-- create key from passed template, id and audience
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

-- $set: { field: value, field2: value, field3: value }
-- { HMSETResponse }
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

-- $remove: [ 'field', 'field2' ]
-- { deletedFieldsCount } - if no fields deleted or there was no such fields counter not incrementing
local function opRemove(metaKey, args)
  local result = 0;
  for _, field in pairs(args) do
    result = result + redis.call("HDEL", metaKey, field)
  end
  return result
end

-- $incr: { field: incrValue, field2: incrValue }
-- { field: newValue }
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

-- get list of keys to update
-- generate them from passed audiences and metaData key template
local keysToProcess = {};
for index, audience in ipairs(updateOpts.audiences) do
  local key = makeKey(metaDataTemplate, Id, audience)
  table.insert(keysToProcess, index, key);
end

-- process meta update operations
if updateOpts.metaOps then
  -- iterate over metadata hash field
  for index, op in ipairs(updateOpts.metaOps) do
    local targetOpKey = keysToProcess[index]
    local metaProcessResult = {};

    -- iterate over commands and apply them
    for opName, opArg in pairs(op) do
      local processFn = metaOps[opName];

      if processFn == nil then
        return redis.error_reply("Unsupported command:" .. opName)
      end

      if type(opArg) ~= "table" then
        return redis.error_reply("Args for " .. opName .. " must be and array")
      end

      -- store command execution result
      metaProcessResult[opName] = processFn(targetOpKey, opArg)
    end

    -- store execution result of commands block
    table.insert(scriptResult, metaProcessResult)
  end

-- process passed scripts
elseif updateOpts.scripts then
  -- iterate over scripts and execute them in sandbox
  for _, script in pairs(updateOpts.scripts) do
    local env = {};

    -- allow read access to this script scope
    -- env recreated for each script to avoid scope mixing
    setmetatable(env, { __index=_G })

    -- override params to be sure that script works like it was executed like from `redis.eval` command
    env.ARGV = script.argv
    env.KEYS = keysToProcess

    -- evaluate script and bind to custom env
    local fn = loadScript(script.lua, env)
    -- run script and save result
    scriptResult[script.name] = fn()
  end

end

--
-- Audience tracking
--

local audienceKey = makeKey(audienceKeyTemplate, Id)
-- get saved audience list
local audiences = redis.call("SMEMBERS", audienceKey)

-- create list containing saved and possibly new audiences
local uniqueAudiences = tablesUniqueItems(audiences, updateOpts.audiences)

-- iterate over final audience list
for _, audience in pairs(uniqueAudiences) do
  -- get size of metaKey
  local metaKey = makeKey(metaDataTemplate, Id, audience)
  local keyLen = redis.call("HLEN", metaKey)

  -- if key has data add it to the audience set
  -- set members unique, so duplicates not appear

  -- if key empty or not exists (HLEN will return 0)
  -- delete audience from list
  if (keyLen > 0) then
    redis.call("SADD", audienceKey, audience)
  else
    redis.call("SREM", audienceKey, audience)
  end
end

-- respond with json encoded string
return cjson.encode(scriptResult)
