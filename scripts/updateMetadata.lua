-- Script performs User/Organization metadata update and tracks used audiences
-- KEYS[1] = Audience Key template in format `{id}someExtraText{audience}` - Key stores currently used audiences associated with metadata
-- KEYS[2] = Metadata Key template in format `{id}myAvesomeMEtaKey{audience}` - Key stores metadata
-- `{id}` and `{audience}` will be replaced with real values on script runtime

-- ARGV[1] = Id of the User/Organization which is going to be updated
-- ARGV[2] = JsonString with list of operations to execute on the metadata of the provided Id

-- script replicates commands instead of own body
-- call of HMSET command is determined as 'non deterministic command'
-- and redis refuses to run it without this.
redis.replicate_commands()

local audienceKeyTemplate = KEYS[1]
local metaDataTemplate = KEYS[2]
local Id = ARGV[1]
local updateOptsJson = ARGV[2]

local scriptResult = { err = nil, ok = {}}

--
-- Param Validation
--
local function isValidString(val)
  if type(val) == 'string' and string.len(val) > 0 then
    return true
  end
  return false
end

assert(isValidString(Id), 'incorrect `id` argument')
assert(isValidString(updateOptsJson), 'incorrect `updateJson` argument')

local updateOpts = cjson.decode(updateOptsJson)

--
-- Internal functions
--

-- evaluates provided script
local function evalLuaScript(code, environment)
  if setfenv and loadstring then
    local f = assert(loadstring(code))
    setfenv(f, environment)
    return f
  else
    return assert(load(code, nil, "t", environment))
  end
end

-- creates array with unique items from passed arrays
local function getUniqueItemsFromTables(...)
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
local function makeRedisKey (template, id, audience)
  local str = template:gsub('{id}', id, 1)
  if audience ~= nil then
    str = str:gsub('{audience}', audience, 1)
  end
  return str
end

local function getResultOrSaveError(result, command, args)
  if type(result) == 'table' and result['err'] ~= nil then
    if (scriptResult['err'] == nil) then
      scriptResult['err'] = {}
    end
    table.insert(scriptResult['err'], {
      err = result['err'],
      command = {
        name = command,
        args = args
      }
    })
    return nil
  end
  return result
end

--
-- available Meta Operations definition
--

-- $set: { field: value, field2: value, field3: value }
-- { HMSETResponse }
local function opSet(metaKey, args)
  local setArgs = {}

  for field, value in pairs(args) do
    table.insert(setArgs, field)
    table.insert(setArgs, value)
  end

  local cmdResult = redis.pcall("HMSET", metaKey, unpack(setArgs))
  cmdResult = getResultOrSaveError(cmdResult, "HMSET", setArgs)
  if cmdResult ~= nil then
    return cmdResult.ok
  end

  return cmdResult
end

-- $remove: [ 'field', 'field2' ]
-- { deletedFieldsCount } - if no fields deleted or there was no such fields counter not incrementing
local function opRemove(metaKey, args)
  local result = 0;
  for _, field in pairs(args) do
    local cmdResult = redis.pcall("HDEL", metaKey, field)
    result = result + getResultOrSaveError(cmdResult, "HDEL", { metaKey, field })
  end
  return result
end

-- $incr: { field: incrValue, field2: incrValue }
-- { field: newValue }
local function opIncr(metaKey, args)
  local result = {}
  for field, incrVal in pairs(args) do
    -- TODO fix err
    local cmdResult  = redis.pcall("HINCRBY", metaKey, field, incrVal)
    cmdResult = getResultOrSaveError(cmdResult, "HINCRBY", { metaKey, field, incrVal })
    result[field] = cmdResult
  end
--  if #result > 0 then
--    return result
--  end
--
--  return nil
  return result;
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

-- get list of keys to update
-- generate them from passed audiences and metaData key template
local keysToProcess = {};
for index, audience in ipairs(updateOpts.audiences) do
  local key = makeRedisKey(metaDataTemplate, Id, audience)
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

      if processFn ~= nil then
        -- store command execution result
        metaProcessResult[opName] = processFn(targetOpKey, opArg)
      end
    end

    -- store execution result of commands block
    table.insert(scriptResult['ok'], metaProcessResult)
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
    local fn = evalLuaScript(script.lua, env)

    -- run script and save result
    local status, result  = pcall(fn)
    if status == true then
      scriptResult['ok'][script.name] = result;
    else
      if (scriptResult['err'] == nil) then
        scriptResult['err'] = {}
      end
      table.insert(scriptResult['err'], {
        err = result,
        script = script.name,
        keys = keysToProcess,
        args = script.args,
      })
    end

  end

end

--
-- Audience tracking
--

local audienceKey = makeRedisKey(audienceKeyTemplate, Id)
-- get saved audience list
local audiences = redis.call("SMEMBERS", audienceKey)

-- create list containing saved and possibly new audiences
local uniqueAudiences = getUniqueItemsFromTables(audiences, updateOpts.audiences)

-- iterate over final audience list
for _, audience in pairs(uniqueAudiences) do
  -- get size of metaKey
  local metaKey = makeRedisKey(metaDataTemplate, Id, audience)
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
