-- Script performing token reservation in the specific sliding interval.
-- Also, the script allows getting interval usage information.
-- Reservation possible when the reserved token count in the interval between last token and `blockInterval`
-- is smaller than the limit.
--
-- KEYS:
-- tokenDbKey - ZSET storing tokens.
--
-- ARGS:
-- {integer} currentTime - timestamp.
-- {integer} interval - milliseconds. Lowest interval boundary from last reserved token or currentTime.
-- {integer} limit - maximum possible amount of tokens in sliding interval.
-- {integer} reserveToken - 1 to reserve token, 0 to return usage information.
-- {string} [token] - token to reserve, may be ommited when reserveToken == 0.
-- {integer} [blockInterval] - milliseconds. Block interval from last reserved token.
--
-- Returns:
-- Script returns response in format [reservedTokenCount, limit, token, reset].
-- {integer} reservedTokenCount - count of tokens reserved.
-- {integer} limit - maximum number of possible tokens.
-- {string} token - provided token or 0.
-- {integer} reset - milliseconds interval for next available attempt. 0 - forever.
--
-- If token reserve is successful: [9, 10, 'passedToken', 0].
-- If token reserve is not successful: [10, 10, 0, 1200000].
local tokenDbKey = KEYS[1]

local currentTime = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local reserveToken = tonumber(ARGV[4])
local token = ARGV[5]
local blockInterval = tonumber(ARGV[6])

local function isStringNotEmpty(val)
  return type(val) == 'string' and string.len(val) > 0
end

local function isPositiveNumber(val)
  return type(val) == 'number' and val > 0
end

local function isNonNegativeNumber(val)
  return type(val) == 'number' and val >= 0
end

if isPositiveNumber(currentTime) == false then
 return redis.error_reply('invalid `currentTime` argument')
end

if isNonNegativeNumber(interval) == false then
  return redis.error_reply('invalid `interval` argument')
end

if isPositiveNumber(limit) == false then
  return redis.error_reply('invalid `limit` argument')
end

if isNonNegativeNumber(reserveToken) == false then
  return redis.error_reply('invalid `reserveToken` argument')
end

-- this params will exist if token reserve requested
if reserveToken == 1 and (isStringNotEmpty(token) == false) then
  return redis.error_reply('invalid `token` argument')
end

-- if block interval incorrect or emtpy set it as interval
if isNonNegativeNumber(blockInterval) == false then
  blockInterval = interval
end

local intervalMinScore = currentTime - blockInterval
local intervalMaxScore = currentTime

local millisToReset = 0

local lastTokenReserve = redis.call('ZREVRANGEBYSCORE', tokenDbKey, intervalMaxScore, intervalMinScore, 'WITHSCORES','limit', 0, 1)

if #lastTokenReserve > 0 then
  intervalMaxScore = lastTokenReserve[2]
  intervalMinScore = intervalMaxScore - interval
end

-- lover bound is -inf if blocking forever
if interval == 0 then
  intervalMinScore = '-inf'
end

local tokenCount = redis.call("ZCOUNT", tokenDbKey, intervalMinScore, intervalMaxScore)

if blockInterval > 0 and tokenCount >= limit then
  millisToReset = (intervalMaxScore + blockInterval) - currentTime
end

-- Script returns response as array: [windowUseCount, windowUseLimit, token, reset]
-- Redis omits table value if `nil` passed so we will use 0.
if tokenCount >= limit then
  return { tokenCount, limit, 0, millisToReset }
end

if reserveToken == 1 then
  redis.call('ZADD', tokenDbKey, currentTime, token)

  -- pexpire deletes key if ttl is 0
  if (blockInterval > 0) then
    redis.call('PEXPIRE', tokenDbKey, blockInterval)
  end

  tokenCount = tokenCount + 1
  millisToReset = 0
end

return { tokenCount, limit, token, millisToReset }
