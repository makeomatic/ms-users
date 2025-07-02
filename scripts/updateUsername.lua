local userDataKey = KEYS[1];
local userMetadaKey = KEYS[2];
local usernameToIdKey = KEYS[3];

local userId = ARGV[1];
local newUsername = ARGV[2];
local usernameField = ARGV[3];
local newUsernameEncoded = ARGV[4];

if redis.call('hget', usernameToIdKey, newUsername) ~= false then
  return redis.error_reply('E_USERNAME_CONFLICT');
end

local currentUsername = redis.call('hget', userDataKey, usernameField)

if currentUsername == false then
  return redis.error_reply('E_USER_ID_NOT_FOUND');
end

redis.call('hdel', usernameToIdKey, currentUsername)
redis.call('hset', usernameToIdKey, newUsername, userId)
redis.call('hset', userDataKey, usernameField, newUsername)
redis.call('hset', userMetadaKey, usernameField, newUsernameEncoded)
