local organizationDataKey = KEYS[1];
local organizationId = ARGV[1];
local fetchData = ARGV[2];

if redis.call("EXISTS", organizationDataKey) == 0 then
  return nil;
end

if fetchData == "0" then
  return { organizationId };
end

return {
  organizationId,
  redis.call("HGETALL", organizationDataKey)
};
