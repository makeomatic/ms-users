local tokenDbKey = KEYS[1]

local microCurrentTime = tonumber(ARGV[1])
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

if isPositiveNumber(microCurrentTime) == false then
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

local intervalMinScore = microCurrentTime - interval * 1e3
local intervalMaxScore = microCurrentTime

local millisToReset = 0

local lastTokenReserve = redis.call('ZREVRANGEBYSCORE', tokenDbKey, intervalMaxScore, intervalMinScore, 'WITHSCORES','limit', 0, 1)

if #lastTokenReserve > 0 then
  for i, p in pairs(lastTokenReserve) do
    redis.call('SADD', '{ms-users}debugKey', i, p)
  end
  intervalMaxScore = lastTokenReserve[2]
  intervalMinScore = intervalMaxScore - interval * 1e3
end

-- lover bound is -inf if blocking forever
if interval == 0 then
  intervalMinScore = '-inf'
end

local tokenCount = redis.call("ZCOUNT", tokenDbKey, intervalMinScore, intervalMaxScore)

if blockInterval > 0 and tokenCount > 0 then
  millisToReset = (intervalMaxScore * 1e-3 + blockInterval) - microCurrentTime * 1e-3
end

-- Script returns response as array: [windowUseCount, windowUseLimit, token, reset]
-- Redis omits table value if `nil` passed so we will use 0.
if tokenCount >= limit then
  return { tokenCount, limit, 0, millisToReset }
end

if reserveToken == 1 then
  redis.call('ZADD', tokenDbKey, microCurrentTime, token)

  -- pexpire deletes key if ttl is 0
  if (blockInterval > 0) then
    redis.call('PEXPIRE', tokenDbKey, blockInterval)
  end

  tokenCount = tokenCount + 1
  millisToReset = 0
end

return { tokenCount, limit, token, millisToReset }



