local key = KEYS[1]
local token = ARGV[1] -- token to cancel

local function isValidString(val)
  if (type(val) == 'string' and string.len(val) > 0) then
    return true
  end
  return false
end

assert(isValidString(key), 'incorrect `key` key')
assert(isValidString(token), 'incorrect `token` argument')

local keyType = redis.call('TYPE', key).ok
assert(keyType == 'none' or keyType == 'zset', 'key `' .. key .. '` must be ZSET or none')

redis.call("ZREM", key, token)
