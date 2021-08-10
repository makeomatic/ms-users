local index = KEYS[1]
local metaData = KEYS[2]
local audience = KEYS[3]

local patternTemplate = ARGV[1]

local ids = redis.call('smembers', index)
for _, id in ipairs(ids) do
  local metaDataKey = metaData:gsub('(id)', id, 1)
  local audienceKey = audience:gsub('(id)', id, 1)
  local pattern = patternTemplate:gsub('(id)', id, 1)
  local keys = redis.call('keys', '*' .. metaDataKey .. '*')
  for _, key in ipairs(keys) do
    local newAudience = key:gsub(pattern, '', 1)
    redis.call('sadd', audienceKey, newAudience)
  end
end
