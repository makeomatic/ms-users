local usersIndex = KEYS[2]
local usersIdsList = KEYS[3]
local usersMeta = KEYS[4]
local usersReferralIndex = KEYS[5]

local referralField = ARGV[1]
local uids = redis.call('lrange', usersIdsList, 0, -1)

for i, uid in ipairs(uids) do
  local metaKey = usersMeta:gsub('(uid)', uid, 1)
  local referral = redis.call('hget', metaKey, referralField)
  local referralIndex = usersReferralIndex:gsub('(uid)', referral, 1)

  redis.call('sadd', referralIndex, uid);
end
