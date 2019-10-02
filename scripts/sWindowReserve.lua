-- requires Redis >= 3.2
redis.replicate_commands()

local key = KEYS[1]

local interval = tonumber(ARGV[1]) -- milliseconds
local limit = tonumber(ARGV[2]) -- number
local check = ARGV[3]

assert(type(key) == 'string' and string.len(key) > 0, 'incorrect `key` argument')
assert(type(interval) == 'number' and interval >= 0, 'incorrect `interval` argument')
assert(type(limit) == 'number' and limit >= 0, 'incorrect `limit` argument')

local keyType = redis.call('TYPE', key).ok
assert(keyType == 'none' or keyType == 'zset', 'key ' .. key .. ' should be ZSET or none')

local redisTime = redis.call("TIME")

-- work with microtimestamp
local microInterval = interval * 1e3;
local now = redisTime[1] * 1e6 + redisTime[2]
local slidingWindowStart = now - microInterval

local function getInfoWithValue(usage, additionalValue)
  local oldest = tonumber(redis.call("ZRANGEBYSCORE", key, slidingWindowStart, "+inf", "LIMIT", limit - usage, 1)[1]) or 0

  if oldest > 0 then
    local reset = oldest + microInterval - now
    if reset < 0 then
      reset = 0
    end
    return {usage, math.ceil(reset/1e6), additionalValue}
  end

  return {usage, 0, additionalValue}
end

local usage = tonumber(redis.call("ZCOUNT", key, slidingWindowStart, "+inf")) or 0

-- Sliding window use info requested
if check ~= nil then
  return getInfoWithValue(usage, 0)
end

-- Check Sliding window and reserve token if possible
if usage >= limit then
  -- limit exceeded
  return getInfoWithValue(usage, 0)
end

redis.call("ZADD", key, "NX", now, now)
redis.call("PEXPIRE", key, interval)

-- return `now` as token and usage information
return getInfoWithValue(usage+1, now)
