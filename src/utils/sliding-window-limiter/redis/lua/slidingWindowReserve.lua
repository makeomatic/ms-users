-- Script performing token reservation in the specific sliding windowInterval.
-- Also, the script allows getting windowInterval usage information.
-- Reservation possible when the reserved token count in the windowInterval between last token and `blockInterval`
-- is smaller than the windowLimit.
--
-- KEYS:
-- tokenDbKey - ZSET storing tokens.
--
-- ARGS:
-- {integer} currentTime - timestamp.
-- {integer} windowInterval - milliseconds. Lowest windowInterval boundary from last reserved token or currentTime.
-- {integer} windowLimit - maximum possible amount of tokens in sliding windowInterval.
-- {integer} blockInterval - milliseconds or 0 (if window interval is 0 (e.g. -inf) then block interval has no sense).
--                           Block windowInterval from last reserved token.
-- {integer} reserveToken - 1 to reserve token, 0 to return usage information.
-- {string} [token] - token to reserve, may be ommited when reserveToken == 0.
--
-- Returns:
-- Script returns response in format [reservedTokenCount, windowLimit, token, reset].
-- {integer} reservedTokenCount - count of tokens reserved.
-- {integer} windowLimit - maximum number of possible tokens.
-- {string} token - provided token or 0.
-- {integer} reset - milliseconds windowInterval for next available attempt. 0 - forever.
--
-- If token reserve is successful: [9, 10, 'passedToken', 0].
-- If token reserve is not successful: [10, 10, 0, 1200000].

-- Helper functions
local function isStringNotEmpty(val)
  return type(val) == 'string' and string.len(val) > 0
end

local function isPositiveNumber(val)
  return type(val) == 'number' and val > 0
end

local function isNonNegativeNumber(val)
  return type(val) == 'number' and val >= 0
end

local function isNumberPretendBool(val)
  return type(val) == 'number' and (val == 0 or val == 1)
end

-- Define default values for variables
local token = false
local millisToReset = false

-- Parse input
local tokenDbKey = KEYS[1]

local currentTime = tonumber(ARGV[1])
local windowInterval = tonumber(ARGV[2])
local windowLimit = tonumber(ARGV[3])
local blockInterval = tonumber(ARGV[4])
local reserveToken = tonumber(ARGV[5])

-- Validate input types
if isStringNotEmpty(tokenDbKey) == false then
 return redis.error_reply('invalid `tokenDbKey` argument')
end

if isPositiveNumber(currentTime) == false then
 return redis.error_reply('invalid `currentTime` argument')
end

if isNonNegativeNumber(windowInterval) == false then
  return redis.error_reply('invalid `windowInterval` argument')
end

if isPositiveNumber(windowLimit) == false then
  return redis.error_reply('invalid `windowLimit` argument')
end

if isNonNegativeNumber(blockInterval) == false then
  return redis.error_reply('invalid `blockInterval` argument')
end

if isNumberPretendBool(reserveToken) == false then
  return redis.error_reply('invalid `reserveToken` argument')
end

-- Validate input login and cast types
-- if window interval is 0 (e.g. -inf) then block interval has no sense
if windowInterval == 0 then
  windowInterval = false
end

if windowInterval == false then
  if blockInterval ~= 0 then
    return redis.error_reply('invalid `blockInterval` argument')
  end

  blockInterval = false
end

if reserveToken == 1 then
  reserveToken = true
  token = ARGV[6]

  if isStringNotEmpty(token) == false or token == 'undefined'  then
    return redis.error_reply('invalid `token` argument')
  end
else
  reserveToken = false
end

-- script starts here
local windowIntervalMaxScore = currentTime
local windowIntervalMinScore = '-inf'

-- check block interval if exists
if blockInterval ~= false then
  local blockIntervalMaxScore = currentTime
  local blockIntervalMinScore = currentTime - blockInterval
  local lastTokenReserve = redis
    .call('ZREVRANGEBYSCORE', tokenDbKey, blockIntervalMaxScore, blockIntervalMinScore, 'WITHSCORES','limit', 0, 1)

  if #lastTokenReserve > 0 then
    windowIntervalMaxScore = lastTokenReserve[2]
  end
end

if windowInterval ~= false then
  windowIntervalMinScore = windowIntervalMaxScore - windowInterval
end

local tokenCount = redis.call("ZCOUNT", tokenDbKey, windowIntervalMinScore, windowIntervalMaxScore)

-- Script returns response as array: [windowUseCount, windowUseLimit, token, reset]
-- Redis omits table value if `nil` passed so we will use 0.
if tokenCount >= windowLimit then
  if windowInterval == false then
    millisToReset = 0
  else
    millisToReset = windowIntervalMaxScore + blockInterval - currentTime
  end

  return { tokenCount, windowLimit, false, millisToReset }
end

if reserveToken == true then
  redis.call('ZADD', tokenDbKey, currentTime, token)

  -- pexpire deletes key if ttl is 0
  if (blockInterval ~= false) then
    redis.call('PEXPIRE', tokenDbKey, blockInterval)
  end

  tokenCount = tokenCount + 1

  if tokenCount >= windowLimit then
    if windowInterval == false then
      millisToReset = 0
    else
      millisToReset = currentTime + blockInterval
    end
  end

  return { tokenCount, windowLimit, token, millisToReset }
end

return { tokenCount, windowLimit, false, millisToReset }
