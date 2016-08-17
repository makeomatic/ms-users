local aliasHash = KEYS[2];
local cursor = "0";
local lower = string.lower;

-- hscan and go around
repeat
  local scanned = redis.call('hscan', aliasHash, cursor, 'COUNT', '50');
  -- update cursor
  cursor = scanned[1];
  -- iterate over results
  local results = scanned[2];
  for i, hash in ipairs(results) do
    if lower(hash) ~= hash do
      local curValue = redis.call('hget', aliasHash, hash);
      redis.call('hset', aliasHash, lower(hash), curValue);
    end
  end
until(cursor ~= "0")
