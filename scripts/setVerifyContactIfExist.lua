local userContactsKey = KEYS[1];
local verifyKey = ARGV[1]
local verifyValue = ARGV[2];

if redis.call("EXISTS", userContactsKey) == 1 then
  redis.call("HSET", userContactsKey, verifyKey, verifyValue);
end
