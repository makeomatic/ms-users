local tokenDbKey = KEYS[1]
local token = ARGV[1] -- token to cancel

local function isValidString(val)
  if (type(val) == 'string' and string.len(val) > 0) then
    return true
  end
  return false
end

assert(isValidString(token), 'incorrect `token` argument')

redis.call("ZREM", tokenDbKey, token)
