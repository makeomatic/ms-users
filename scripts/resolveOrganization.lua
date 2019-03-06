local organizationDataKeyTemplate = KEYS[1];
local id = ARGV[1];
local fetchData = ARGV[2];
local organizationIdPlaceholder = ARGV[3];

local function makeOrganizationKey (organizationId, template, placeholder)
  return template:gsub(placeholder, organizationId, 1);
end

local function getOrganizationData (organizationId, organizationDataKey, fetchData)
  if fetchData == "0" then
    return { organizationId };
  end

  return {
    organizationId,
    redis.call("HGETALL", organizationDataKey)
  };
end

-- 1. Try organization id
local organizationId = id;
local organizationDataKey = makeOrganizationKey(organizationId, organizationDataKeyTemplate, organizationIdPlaceholder);

if redis.call("EXISTS", organizationDataKey) == 1 then
  return getOrganizationData(id, organizationDataKey, fetchData);
end

return nil;
