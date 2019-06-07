local remote = KEYS[1]
local globalRemote = KEYS[2]

-- current attempts
local attempts = redis.call("GET", remote) or 0 

-- delete remote
-- reduce amount of failed sign ins for that ip address
redis.call("DEL", remote)

-- INCRBY with -0 will get "ERR value is not an integer or out of range"
if tonumber(attempts) > 0 then -- lua may throw error comparing number to string
  redis.call("INCRBY", globalRemote, -attempts)
end