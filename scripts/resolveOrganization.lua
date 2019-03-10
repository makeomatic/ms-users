local organizationDataKey = KEYS[1];
local organizationId = ARGV[1];
local fetchData = ARGV[2];

local function getOrganizationData ()
  if fetchData == "0" then
    return { organizationId };
  end

  return {
    organizationId,
    redis.call("HGETALL", organizationDataKey)
  };
end

if redis.call("EXISTS", organizationDataKey) == 1 then
  return getOrganizationData();
end

return nil;
