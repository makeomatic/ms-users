local tokenDbKey = KEYS[1]
local extraKeys = unpack(KEYS, 2, #KEYS)

local dbRecords = redis.call('ZRANGEBYSCORE', tokenDbKey, '-inf', '+inf')

if type(extraKeys) == 'table' then
  for _, token in pairs(dbRecords) do
    for _, key in pairs(extraKeys) do
      redis.call('ZREM', key, token)
    end
  end
end
redis.call("DEL", tokenDbKey)

