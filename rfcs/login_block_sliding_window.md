# Login Sliding Window Blocks

## Overview and motivation
Service monitors login attempts count by two factors: IP address and IP + Username.
If one of the counters exceeds specified config parameter value, all requests identified by this factor
are blocked until TTL is expired. For better user experience, introduce the new feature: sliding window rate limiters.

## Sliding window
In the "Sliding window" algorithm, to control the number of attempts in a certain period using some SET, that contains the time of each access attempt for a specific `key`.
If the number of attempts, in a given time range, is greater than required, the next attempts are not possible.
Attempts that do not fall within the specified range will be “forgotten”. 

This algorithm allows you to get a smoother service load and softer locks for the end-user.

### Login Rate limiter specs
* Should rate limit access from IP.
* Should rate limit access for UserId and IP pair
* On successful login must remove all logged attempts from User and IP keys.
* Block interval is calculated from the last attempt.

### Sliding window rate limiting Util
Additional JavaScript class and set of Lua scripts that provide rate-limiting logic.

#### LuaScripts
Solution provides `slidingWindowReserve.lua`, `slidingWindowCleanup.lua` and `slidingWindowCancel.lua` scripts.

##### slidingWindowReserve.lua
* The Script accepts the timestamp as scores in sorted SET to avoid some timestamp collision conditions.
* Gets count of the members from ZSET in `lastReservedToken - interval`.
    - If there is no `lastReservedToken`, `timestamp` is used.
* Checks If count is greater than `limit`, returns `reset` milliseconds(interval to next execution available). `reset` calculated as `timestamp - lastReservedToken + (blockInterval || interval)`
* If count is lower than `limit` returns `token` and some internal information.
* Assigns TTL for the `key` value `interval` or `blockInterval`.

##### slidingWindowCancel.lua
Removes provided token from ZSET, and this will allow to `reserve` new slot.

##### slidingWindowCleanup.lua
* Accepts key list as arguments. 
* Gets contents from the first key and deletes them from other provided keys

#### JavaScript classes
##### SlidingWindowLimiter
Utility class wrapping all calls to LUA scripts.

E.g.:
```javascript
const SlidingWindowLimiter = require('util/sliding-window-limiter/redis');
const { RateLimitError } = SlidingWindowLimiter;

const myLimiter = new SlidingWindowLimiter(redis, {
  windowInterval: 15 * 60 * 1000, // 15 minutes.
  windowLimit: 15,
  blockInterval: 60 * 60 * 1000, // 1 hour.
});

// Try to allocate span in `(lastAttempt || now())-interval` seconds with max 10 slots/tokens.
try {
  const { usage, token, reset } = await myLimiter.reserve('cats', 'perchik');
} catch (e) {
  if (e instanceof RateLimitError) {
    console.log(`Attempts count more than ${e.limit}. Wait for ${e.reset} milliseconds`)
  }
}

// Token/span assigned.
// We can proceed our work.

// Get RateLimit usage information.
const usageResult = myLimiter.check('cats');

// Free used span/token.
await limiter.cancel(token);
```

#### UserLoginLimiter
Class controls login action rate-limiting logic.

Class will use configuration from `config.rateLimiters.userLogin` in the format:

  ```javascript
exports.rateLimiters = {
  userLogin: {
    enabled: false,
    forIp: {
      windowInterval: 1000 * 60 * 60 * 24, // 24 hours
      windowLimit: 15,
      blockInterval: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
    forUserIp: {
      windowInterval: 1000 * 60 * 60 * 24, // 24 hours
      windowLimit: 5,
      blockInterval: 1000 * 60 * 60 * 24, // 1 day
    },
  },
};
  ```

#### Additional data handling classes:
##### UserIp
Class controls the list of the IP addresses from user tried to login.
Data from this class is used in `loginRateLimiter.cleanup` to form UserIp redis keys.

##### LoginAttempt
Class controls user login attempt tokens. Data from this class is used in `loginRateLimiter.cleanup` to remove tokens stored in IP rate-limiters.

## BTW Migrations rename
Decided to rename migration files into format: `$migrationFinalVer_$migrationName` for easier navigation.


## Updates
* Changed Microseconds to Milliseconds as scores. Dont' know why, but Redis messes with them ((((
