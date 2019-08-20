local key = KEYS[1]

local token = tonumber(ARGV[1]) or 0 -- token to cancel

-- requires Redis >= 3.2
redis.replicate_commands()

return tonumber(redis.call("ZREM", key, token)) or 0
