local tokenDbKey = KEYS[1]

local microCurrentTime = ARGV[1]
local interval = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local reserveToken = ARGV[4] == 'true'
local token = ARGV[5]
local blockInterval = tonumber(ARGV[6])

local function isStringNotEmpty(val)
  if (type(val) == 'string' and string.len(val) > 0) then
    return true
  end
  return false
end

if type(microCurrentTime) == 'number' and microCurrentTime <= 0 then
 return redis.error_reply('invalid `currentTime` argument')
end

if type(interval) == 'number' and interval <= 0 then
  return redis.error_reply('invalid `interval` argument')
end

if type(limit) == 'number' and limit < 0 then
  return redis.error_reply('invalid `interval` argument')
end

-- this params will exist if token reserve requested
if reserveToken == true then
  if isStringNotEmpty(token) == false then
    return redis.error_reply('invalid `token` argument')
  end
end

-- if block interval incorrect or emtpy set it as interval
if blockInterval <= 0 then
  blockInterval = interval
end

local intervalMinScore = microCurrentTime - interval * 1e3
-- if no tokens interval ends on current time
local intervalMaxScore = microCurrentTime

local lastTokenReserve = redis.call('ZREVRANGEBYSCORE', tokenDbKey, microCurrentTime, '-inf', 'WITHSCORES','limit', 0, 1)

for k,v in pairs(lastTokenReserve) do
  redis.log(redis.LOG_WARNING, 'key ' .. k .. ' v' .. v);
end

if #lastTokenReserve > 0 then
  redis.log(redis.LOG_WARNING, 'assign max score' .. type(lastTokenReserve))
  intervalMaxScore = lastTokenReserve[2]
end

-- lover bound is -inf if blocking forever
if interval == 0 then
  intervalMinScore = '-inf'
end

redis.log(redis.LOG_WARNING, 'count ' .. tokenDbKey .. ' ' .. intervalMinScore .. ' ' .. intervalMaxScore )

local tokenCount = redis.call("ZCOUNT", tokenDbKey, intervalMinScore, intervalMaxScore)
local millisToReset

if blockInterval > 0 then
  millisToReset = intervalMaxScore * 1e-3 - microCurrentTime * 1e-3 + blockInterval
  if millisToReset < 0 then
    millisToReset = 0
  end
end

if tokenCount >= limit then
  redis.log(redis.LOG_WARNING, 'limit reach' .. tokenCount)
  return { tokenCount, limit, 0, millisToReset }
end

if reserveToken == true then
  redis.log(redis.LOG_WARNING, 'reserve token')
  redis.call('ZADD', tokenDbKey, microCurrentTime, token)
  redis.call('PEXPIRE', tokenDbKey, blockInterval)
  tokenCount = tokenCount + 1
  millisToReset = 0
end

redis.log(redis.LOG_WARNING, 'return result ' .. tokenCount .. ':' .. limit .. ':' .. token )
return { tokenCount, limit, token, millisToReset }



