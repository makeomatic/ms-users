-- 1. check if we have resulting filtered list cached, if so - return items from it with a given offset / limit
--    `xxx!audience!sorted:fieldName:asc/desc!filter:key:value:key:value`, where key - filter param, must be sorted among each other
-- 2. check if we have base sorted list cached, if not - produce it SORT xxx BY *!metadata!audience->fieldName ASC/DESC ALPHA
--    STORE xxx!audience!sorted:fieldName:asc/desc
-- 3. produce filtered list:
--    local vals = lrange xxx!audience!sorted:fieldName:asc/desc 0 -1
--    filters - json.decode = [{key: value}, { key: value }] <---- must come pre-sorted in nodejs

-- redis.sortedFilteredList('{ms-users}username-set', '{ms-users}*!metadata!*.localhost', 'firstName', 'ASC', '{"lastName":"ami"}', 0, 10)

local usernameSet = KEYS[1];
local metadataKey = KEYS[2];
local hashKey = ARGV[1];
local order = ARGV[2];
local filter = ARGV[3];
local jsonFilter = cjson.decode(filter);
local totalFilters = table.getn(jsonFilter);
local offset = ARGV[4];
local limit = ARGV[5];

local function isempty(s)
  return s == nil or s == ''
end

local function subrange(t, first, last)
  local sub = {};
  for i=first,last do
    local val = t[i];
    if t ~= nil then
      sub[#sub + 1] = t[i];
    else
      break;
    end
  end
  return sub
end

-- create filtered list name
local finalFilteredListKeys = { usernameSet };
local preSortedSetKeys = { usernameSet };

-- order always exists
table.insert(finalFilteredListKeys, order);
table.insert(preSortedSetKeys, order);

if isempty(metadataKey) ~= true then
  if isempty(hashKey) ~= true then
    table.insert(finalFilteredListKeys, metadataKey);
    table.insert(finalFilteredListKeys, hashKey);
    table.insert(preSortedSetKeys, metadataKey);
    table.insert(preSortedSetKeys, hashKey);
  end

  -- do we have filter?
  if totalFilters > 0 then
    table.insert(finalFilteredListKeys, filter);
  end
elseif totalFilters == 1 and type(jsonFilter["#"]) == "string" then
  table.insert(finalFilteredListKeys, filter);
end

-- get final filtered key set
local FFLKey = table.concat(finalFilteredListKeys, ":");
local PSSKey = table.concat(preSortedSetKeys, ":");

-- do we have existing filtered set?
if redis.call("exists", FFLKey) == 1 then
  redis.call("PEXPIRE", FFLKey, 30000);
  return redis.call("lrange", FFLKey, offset, limit);
end

-- do we have existing sorted set?
local valuesToSort;
if redis.call("exists", PSSKey) == 0 then
  valuesToSort = redis.call("SMEMBERS", usernameSet);

  -- if we sort the given set
  if isempty(metadataKey) then
    if order == "ASC" then
      table.sort(valuesToSort, function (a, b) return a < b end);
    else
      table.sort(valuesToSort, function (a, b) return a > b end);
    end
  elseif isempty(hashKey) == false then
    local arr = {};
    for i,v in ipairs(valuesToSort) do
      local metaKey = metadataKey:gsub("*", v, 1);
      arr[v] = redis.call("HGET", metaKey, hashKey);
    end
    if order == "ASC" then
      local function sortFunc(a, b)
        local sortA = arr[a];
        local sortB = arr[b];

        if sortA == nil and sortB == nil then
          return true;
        elseif sortA == nil then
          return false;
        elseif sortB == nil then
          return true;
        else
          return sortA < sortB;
        end
      end
      table.sort(valuesToSort, sortFunc);
    else
      local function sortFunc(a, b)
        local sortA = arr[a];
        local sortB = arr[b];

        if sortA == nil and sortB == nil then
          return false;
        elseif sortA == nil then
          return true;
        elseif sortB == nil then
          return false;
        else
          return sortA > sortB;
        end
      end
      table.sort(valuesToSort, sortFunc);
    end
  end

  redis.call("LPUSH", PSSKey, unpack(valuesToSort));
  redis.call("PEXPIRE", PSSKey, 30000);

  if FFLKey == PSSKey then
    -- early return if we have no filter
    return subrange(valuesToSort, offset, limit);
  end
else
  -- update expiration timer
  redis.call("PEXPIRE", PSSKey, 30000);

  if FFLKey == PSSKey then
    -- early return if we have no filter
    return redis.call("lrange", PSSKey, offset, limit);
  end

  -- populate in-memory data
  valuesToSort = redis.call("LRANGE", PSSKey, 0, -1);
end

-- filtered list holder
local output = { "LPUSH", FFLKey };

-- filter function
function filterString(a, b)
  if strfind(strlower(a), strlower(b)) ~= nil then
    table.insert(output, fieldValue);
  end
end

-- if no metadata key, but we are still here
if isempty(metadataKey) then
  -- only sort by value, which is id
  local filterValue = jsonFilter["#"];
  -- iterate over filtered set
  for i,fieldValue in valuesToSort do
    -- compare strings and insert if they match
    filterString(fieldValue, filterValue);
  end
-- we actually have metadata
else
  for i,v in valuesToSort do
    local metaKey = metadataKey:gsub("*", v, 1);

    for fieldName, filterValue in ipairs(jsonFilter) do
      local fieldValue;

      -- special case
      if fieldName == "#" then
        fieldValue = v;
      else
        fieldValue = redis.call("hget", metadataKey:gsub("*", v, 1), fieldName);
      end

      filterString(fieldValue, filterValue);
    end
  end
end

redis.call(unpack(output));
redis.call("PEXPIRE", FFLKey, 30000);
return redis.call("lrange", FFLKey, offset, limit);
