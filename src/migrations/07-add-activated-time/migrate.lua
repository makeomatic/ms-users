local usersIndex = KEYS[1]
local usersData = KEYS[2]
local usersMeta = KEYS[3]

local CREATED_FIELD = ARGV[1]
local ACTIVATED_FIELD = ARGV[2]
local USERS_ACTIVE_FLAG = ARGV[3]

local uids = redis.call('smembers', usersIndex)

for i, uid in ipairs(uids) do
  local dataKey = usersData:gsub('(uid)', uid, 1)
  local metaKey = usersMeta:gsub('(uid)', uid, 1)

  local isActive = redis.call('hget', dataKey, USERS_ACTIVE_FLAG)

  if isActive == 'true' then
    local values = redis.call('hmget', metaKey, CREATED_FIELD, ACTIVATED_FIELD)
    local created = values[1]
    local activated = values[2]

    if not activated then
      if created then
        redis.call('hset', metaKey, ACTIVATED_FIELD, created)
      end
    end
  end
end
