local usersIndex = KEYS[1]
local usersIdsList = KEYS[2]
local usersMeta = KEYS[3]
local usersReferralIndex = KEYS[4]

local referralField = ARGV[1]
local uids = redis.call('lrange', usersIdsList, 0, -1)

for i, uid in ipairs(uids) do
  local metaKey = usersMeta:gsub('(uid)', uid, 1)
  local referral = redis.call('hget', metaKey, referralField)
  local referralIndex = usersReferralIndex:gsub('(uid)', cjson.decode(referral), 1)

  redis.call('sadd', referralIndex, uid);
end
