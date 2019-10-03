local globalBlockKeyPattern = KEYS[2]
local localBlockKeyPattern = KEYS[3]

-- MUST HAVE we use non deterministic commands
redis.replicate_commands()

local uidPattern = '%%d+';

--strange :(! but this is escaped IP address match pattern
--matches [0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}
local ipPattern = '%%d%%d?%%d?%%.%%d%%d?%%d?%%.%%d%%d?%%d?%%.%%d%%d?%%d?';

-- process template and escape pattern magic characters
local function getPattern(template, uid, ip, safe)
  local key = template;
  if safe then
    --weird esaping
    key = string.gsub(key, "([%(%)%.%%%+%-%*%?%[%]%^%$])", '%%%0')
  end

  key = string.gsub(key, "{uid}", uid)
  key = string.gsub(key, "{ip}", ip)

  return key
end

-- deletes keys, gets keys matching `pattern`, filters with `checkExpression`
local function deleteKeys(pattern, checkExpresion)
  local keys = redis.call("KEYS", pattern);

  for i, key in pairs(keys) do
    -- if key matches provided pattern
    if key:match(checkExpresion) ~= nil then
      redis.call("DEL", key)
    end
  end
end

-- we don't iterate all keys
-- this patterns for SCAN function
local scanGlobalPattern = getPattern(globalBlockKeyPattern, "*", "*")
local scanLocalPattern = getPattern(localBlockKeyPattern, "*", "*")

-- this allow detailed key name check
local checkGlobalPattern = '^' .. getPattern(globalBlockKeyPattern, uidPattern, ipPattern, true) .. '$'
local checkLocalPattern = '^' .. getPattern(localBlockKeyPattern, uidPattern, ipPattern, true) .. '$'

-- DESTRUCTING delete keys.
deleteKeys(scanGlobalPattern, checkGlobalPattern)
deleteKeys(scanLocalPattern, checkLocalPattern)
