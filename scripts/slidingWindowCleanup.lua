local tokenDbKey = KEYS[1]
local extraKeys = {unpack(KEYS, 2, #KEYS)}

local dbRecords = redis.call('ZRANGEBYSCORE', tokenDbKey, '-inf', '+inf')

if #extraKeys > 0 then
  for _, key in pairs(extraKeys) do
    redis.call('ZREM', key, unpack(dbRecords))
  end
end

redis.call("DEL", tokenDbKey)

