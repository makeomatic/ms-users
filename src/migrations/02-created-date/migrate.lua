local usersIndex = KEYS[1]
local usersData = KEYS[2]
local usersMeta = KEYS[3]

local CREATED_FIELD = ARGV[1]
local NEXT_CYCLE_FIELD = ARGV[2]
local TODAY = ARGV[3]

local function monthAgo (timestamp)
  return timestamp - 30 * 24 * 60 * 60 * 1000
end

local function setCreated (key, value)
  redis.call('hset', key, CREATED_FIELD, value)
end

local uids = redis.call('smembers', usersIndex)

for i, uid in ipairs(uids) do
  local dataKey = usersData:gsub('(uid)', uid, 1)
  local metaKey = usersMeta:gsub('(uid)', uid, 1)

  local values = redis.call('hmget', metaKey, CREATED_FIELD, NEXT_CYCLE_FIELD)
  local created = values[1]
  local nextCycle = values[2]

  if not created then
    created = nextCycle and monthAgo(nextCycle) or TODAY
    setCreated(metaKey, created)
    setCreated(dataKey, created)
  end
end
