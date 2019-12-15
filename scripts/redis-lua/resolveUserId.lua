local usersDataKeyTemplate = KEYS[1];
local usernameKey = KEYS[2];
local aliasKey = KEYS[3];
local ssoKey = KEYS[4];
local id = ARGV[1];
local fetchData = ARGV[2];
local userIdPlaceholder = ARGV[3];

local function makeUsersDataKey (userId, template, placeholder)
  return template:gsub(placeholder, userId, 1);
end

local function getUserData (userId, usersDataKey, needFetchData)
  if needFetchData == "0" then
    return { userId };
  end

  return {
    userId,
    redis.call("HGETALL", usersDataKey)
  };
end


-- 1. Try user id
local userId = id;
local usersDataKey = makeUsersDataKey(userId, usersDataKeyTemplate, userIdPlaceholder);

if redis.call("EXISTS", usersDataKey) == 1 then
  return getUserData(id, usersDataKey, fetchData);
end


-- 2. Try username
userId = redis.call("HGET", usernameKey, id);

if userId ~= false then
  usersDataKey = makeUsersDataKey(userId, usersDataKeyTemplate, userIdPlaceholder);

  return getUserData(userId, usersDataKey, fetchData);
end


-- 3. Try user alias
userId = redis.call("HGET", aliasKey, id);

if userId ~= false then
  usersDataKey = makeUsersDataKey(userId, usersDataKeyTemplate, userIdPlaceholder);

  return getUserData(userId, usersDataKey, fetchData);
end


-- 4. Try sso
userId = redis.call("HGET", ssoKey, id);

if userId ~= false then
  usersDataKey = makeUsersDataKey(userId, usersDataKeyTemplate, userIdPlaceholder);

  return getUserData(userId, usersDataKey, fetchData);
end

return nil;
