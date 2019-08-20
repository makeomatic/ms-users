local key = KEYS[1]

local interval = tonumber(ARGV[1]) or 0 -- milliseconds
local limit = tonumber(ARGV[2]) or 0 -- number

local microInterval = interval * 1000

-- requires Redis >= 3.2
redis.replicate_commands()

local redisTime = redis.call("TIME")
local now = redisTime[1] * 1e6 + redisTime[2]

if interval > 0 then
  local startWindow = now - microInterval
  redis.call("ZREMRANGEBYSCORE", key, "-inf", startWindow)
end

local usage = tonumber(redis.call("ZCOUNT", key, "-inf", now)) or 0

if usage >= limit then
    local oldest = tonumber(redis.call("ZRANGEBYSCORE", key, "-inf", "+inf", "LIMIT", usage - limit, 1)[1]) or 0

    if oldest > 0 then
        local reset = oldest + microInterval - now
        if reset < 0 then
          reset = 0
        end
        return {usage, reset}
    end
end

return {usage, 0}
