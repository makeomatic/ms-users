# Login Sliding Window Blocks

## Overview and motivation
Service monitors login attempts count by two factors: IP address and IP + Username.
If one of the counters exceeds specified config parameter value, all requests identified by this factor
are blocked until TTL is expired. For better user experience, we introduce the new feature: sliding window block.

## Sliding window Block
The solution is based on `inredis-ratelimiter`(https://github.com/3hedgehogs/inredis-ratelimiter).
Standard block counters replaced by Sorted Sets with additional scripts.
The sliding window algorithm provides better control of operations/requests processed during the period.

## utils/sliding-window/limiter.js
Exports Redis script function wrappers for scripts `sWindowReserve`, `sWindowCheck`, `sWindowCancel`.

#### reserve(redis, key, interval, limit)
Wraps `sWindowReserve`. Returns:
```javascript
const result = {
  usage: int, // Count of attempts.
  token: string, // High resolution timestamp. It indicates that reserve operation successful.
  reset: int, // Interval in seconds to the next attempt available.
};
```

#### check(redis, key, interval, limit)
Wraps `sWindowCheck`. Returns:
```javascript
const result = {
  usage: int, // Count of attempts.
  reset: int, // Interval in seconds to the next attempt available.
};
```

#### cancel(redis, key, token)
Wraps `sWindowCancel`. Returns count of deleted spans/tokens.

##### Example
```javascript
const limiter = require('util/sliding-window/limiter');
// Try to allocate span in sliding window now()-interval seconds with max 10 slots/tokens
const {usage, token, reset} = await limiter.reserve(redis, "dataKey", 60 * 60, 10);
if (!token) {
  // Unable to reserve span/token. Limit exceeded.
  console.log(`Wait for ${reset} seconds`);
}
// Token/span assigned
// We can proceed our work
// ...
// Free used span/token.
await limiter.cancel(token);
```

### sWindowReserve
The Script uses the high-resolution timestamp as scores in sorted SET to avoid some timestamp collision conditions.
Deletes outdated entries from provided sorted SET within the current sliding `interval`.
Gets count of members in SET, if members count is greater than `limit` returns `reset` milliseconds(interval to next execution available).
Assigns TTL for `key` value `interval`, if `interval` is 0 TTL not set.
When `interval` is 0 value of `reset` may become negative, in this case, `reset` return 0.

### sWindowCheck
Used to check current usage count and projected reset interval for provided `key`. When executed automatically cleans
outdated members.

### sWindowCancel
Removes provided token from sorted SET, allowing to `reserve` new slot.

## `localLoginAttempts`, `globalLoginAttempts` (actions/login.js)
Methods perform checks in the same way:
- Generate local/global key name.
- Try to 'reserve' operation token.
 - Save token inside of function execution 'context'.
 - if Token present continues work.
 - if Token absent throws Throttling error with duration till next attempt available.
    The error message will contain "forever" or stringified duration depending on `reset` value.
If all checks passed and user successfully logged in:
 - "freeing" localLoginAttempt and globalLoginAttempt tokens that allow users to log-in one more time in the current sliding interval.
    All previous attempts for the user and IP stay in place this brings some "blade running" situation to the user (for the general user
  it's not a problem).

When a user not logged in and all checks successful:
 - 'tokens' remain in place and the next incorrect attempt will be locked.
