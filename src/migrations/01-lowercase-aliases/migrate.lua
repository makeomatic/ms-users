local aliasHash = KEYS[2];
local lower = string.lower;
local hashKeys = redis.call('HKEYS', aliasHash);

for i, hash in ipairs(hashKeys) do
  if lower(hash) ~= hash then
    local curValue = redis.call('hget', aliasHash, hash);
    redis.call('hset', aliasHash, lower(hash), curValue);
  end
end
