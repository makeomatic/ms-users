-- Script removes data stored in `tokenDbKey` SET from passed `extraKeys` and deletes `tokenDbKey`
local tokenDbKey = KEYS[1]
local extraKeys = {unpack(KEYS, 2, #KEYS)}

local keyType = redis.call('TYPE', tokenDbKey).ok
local dbRecords;

-- we support SETS and ZSETS
if keyType == 'set' then
  dbRecords = redis.call('SMEMBERS', tokenDbKey)
elseif keyType == 'zset' then
  dbRecords = redis.call('ZRANGE', tokenDbKey, 0, -1)
else
  return;
end

if #extraKeys > 0 and type(dbRecords) == 'table' then
  for _, key in pairs(extraKeys) do
    redis.call('ZREM', key, unpack(dbRecords))
  end
end

redis.call("DEL", tokenDbKey)
