local tokenDbKey = KEYS[1]

local microCurrentTime = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local reserveToken = (ARGV[4] == 'true')
local token = ARGV[5]
local blockInterval = tonumber(ARGV[6])

local function isStringNotEmpty(val)
  if (type(val) == 'string' and string.len(val) > 0) then
    return true
  end
  return false
end

if type(microCurrentTime) ~= 'number' or microCurrentTime <= 0 then
 return redis.error_reply('invalid `currentTime` argument')
end

if type(interval) ~= 'number' or interval < 0 then
  return redis.error_reply('invalid `interval` argument')
end

if type(limit) ~= 'number' or limit <= 0 then
  return redis.error_reply('invalid `limit` argument')
end

-- this params will exist if token reserve requested
if reserveToken == true then
  if isStringNotEmpty(token) == false then
    return redis.error_reply('invalid `token` argument')
  end
end

-- if block interval incorrect or emtpy set it as interval
if type(blockInterval) ~= 'number' or blockInterval < 0 then
  blockInterval = interval
end

local intervalMinScore = microCurrentTime - interval * 1e3
-- if no tokens interval ends on current time
local intervalMaxScore = microCurrentTime

local lastTokenReserve = redis.call('ZREVRANGEBYSCORE', tokenDbKey, microCurrentTime, '-inf', 'WITHSCORES','limit', 0, 1)

if #lastTokenReserve > 0 then
  intervalMaxScore = lastTokenReserve[2]
end

-- lover bound is -inf if blocking forever
if interval == 0 then
  intervalMinScore = '-inf'
end

local tokenCount = redis.call("ZCOUNT", tokenDbKey, intervalMinScore, intervalMaxScore)
local millisToReset

if blockInterval > 0 then
  millisToReset = intervalMaxScore * 1e-3 - microCurrentTime * 1e-3 + blockInterval
  if millisToReset < 0 then
    millisToReset = 0
  end
end

if tokenCount >= limit then
  -- nil will break array structure
  return { tokenCount, limit, 0, millisToReset }
end

if reserveToken == true then
  redis.call('ZADD', tokenDbKey, microCurrentTime, token)
  redis.call('PEXPIRE', tokenDbKey, blockInterval)

  tokenCount = tokenCount + 1
  millisToReset = 0
end

return { tokenCount, limit, token, millisToReset }



