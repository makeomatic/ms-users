-- requires Redis >= 3.2
redis.replicate_commands()

local key = KEYS[1]
local token = tonumber(ARGV[1]) -- token to cancel

assert(type(key) == 'string', 'incorrect `key` argument')

local keyType = redis.call('TYPE', key).ok
assert(keyType == 'none' or keyType == 'zset', 'key `' .. key .. '` must be ZSET or none')

redis.call("ZREM", key, token)
