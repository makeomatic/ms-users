-- Script removes provided `token` from `tokenDbKey` set.
local tokenDbKey = KEYS[1]
local token = ARGV[1] -- token to cancel

local function isStringNotEmpty(val)
  return type(val) == 'string' and string.len(val) > 0
end

if isStringNotEmpty(token) == false then
  return redis.error_reply('invalid `token` argument')
end

redis.call("ZREM", tokenDbKey, token)
