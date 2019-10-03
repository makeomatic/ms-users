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

## Sliding window rate limiting Util
Additional JavaScript class and set of Lua scripts that provide Sliding Algorithm.
Attempt registry will use Redis ZSET.

### LuaScripts
Solution provides `sWindowReserve.lua` and `sWindowCancel.lua` scripts.

#### sWindowReserve.lua
The Script accepts the high-resolution timestamp as scores in sorted SET to avoid some timestamp collision conditions.
Deletes outdated entries from provided sorted SET within the current sliding `interval`.
Gets count of members in SET, if members count is greater than `limit` returns `reset` milliseconds(interval to next execution available).
Assigns TTL for the `key` value `interval`.
When `interval` is 0 value of `reset` may become negative, in this case, `reset` return 0.

#### sWindowCancel.lua
Removes provided token from ZSET, and this will allow to `reserve` new slot.

### SlidingWindowLimiter
Utility class wrapping all calls to LUA scripts.

E.g.:
```javascript
const SlidingWindowlimiter = require('util/sliding-window/limiter');
const { RateLimitError } = SlidingWindowLimiter;

const myLimiter = new SlidingWindoLimiter(redis, 10 * 60, 15);

// Try to allocate span in `now()-interval` seconds with max 10 slots/tokens
try {
  const {usage, token, reset} = await myLimiter.reserve("myKey");
} catch (e) {
  if (e instanceof RateLimitError) {
    console.log(`Attempts count ${e.usage} > 15. Wait for ${e.reset} milliseconds`)
  }
}

// Token/span assigned
// We can proceed our work

// Get RateLimit usage information
const usageResult = myLimiter.check('myKey');

// Free used span/token.
await limiter.cancel(token);
```

# BREAKING CHANGES
It was decided to add two separate classes to control the local and global number for login attempts.
So some configuration options will be moved into a separate object.

## Login Rate Limiters
1. Create classes that use `SlidingWindowLimiter`: `LoginLocalIp` and `LoginGlobalIp`.
Each of the classes will take a separate configuration from `config.rateLimiters.$rateLimiterName` in the format:
  ```javascript
  const config={
    enabled: true || false, // default false
    interval: 10, // seconds
    limit: 1, // number
  }
  ```

2. Remove unnecessary options `lockAfterAttempts`, `globalLockAfterAttempts`, `keepGlobalLoginAttempts` and `keepLoginAttempts` from `config.jwt`.

3. Add new validation schemas to match `config.rateLimiters` section.
4. Change `actions/login.js` to use new `LoginRateLimiter` classes.
5. Add `clean-login-blocks` migration to remove previous data.

## CHANGES
* Add Sliding Window Utility tests
* Alternate current `login` tests to support new configurations and check some additional cases.

## BTW Migrations rename
Decided to rename migration files into format: `$migrationFinalVer_$migrationName` for easier navigation.
