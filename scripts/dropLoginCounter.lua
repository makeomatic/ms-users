local remote = KEYS[1]
local globalRemote = KEYS[2]

-- current attempts
local attempts = redis.call("GET", remote) or 0

-- delete remote
-- reduce amount of failed sign ins for that ip address
redis.call("DEL", remote)
redis.call("INCRBY", globalRemote, -attempts)
