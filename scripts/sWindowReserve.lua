local key = KEYS[1]

local currentTime = tonumber(ARGV[1]) -- microseconds
local interval = tonumber(ARGV[2]) -- milliseconds
local limit = tonumber(ARGV[3]) -- number
local check = ARGV[4]

local function isValidNumber(val)
  if (type(val) == 'number' and val >= 0) then
    return true
  end
  return false
end

assert(isValidNumber(currentTime), 'incorrect `currentTime` argument')
assert(isValidNumber(interval), 'incorrect `interval` argument')
assert(isValidNumber(limit), 'incorrect `limit` argument')

local microInterval = interval * 1000
local slidingWindowStart = currentTime - microInterval

local function getInfoWithValue(usage, additionalValue)
  local oldest = tonumber(redis.call("ZRANGEBYSCORE", key, slidingWindowStart, "+inf", "LIMIT", 1, 1)[1]) or 0

  if oldest > 0 then
    local reset = oldest + microInterval - currentTime
    if reset < 0 then
      reset = 0
    end
    return {usage, math.ceil(reset / 1e3), additionalValue}
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

redis.call("ZADD", key, "NX", currentTime, currentTime)
redis.call("PEXPIRE", key, interval)

-- return `now` as token and usage information
return getInfoWithValue(usage+1, currentTime)
