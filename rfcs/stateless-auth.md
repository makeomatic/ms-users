# Statefull JWT auth upgrade

## Refresh and access tokens

**TBD.**

## Revoke lists

In the case of the stateful JWT verification process, we should provide an ability to revoke/verify any tokens provided by users using a predefined or custom ruleset. 

Such rules should handle system-wide or user-based checks and provide an ability to set `ttl` for them.

* Refresh token compromised. We should revoke All session tokens generated using this token.
* Access token compromised and must be revoked.
* Revoke all tokens that have an issue date before or between some dates.

### Rule

Single or multiple fields filters that perform the check on the provided object. Initially, should provide a generic subset of operations:

* eq/neq
* gt{e}/lt{e}
* Regex

##### Example:

```js
const rule = {
  iss: 'some-issuer'
}

const rule2 = {
  issAt: { gte: Date.now() - 100, lte: Date.now()},
}
```

### RuleGroup

`RuleGroup` is used to perform complex matching to any amount of rules and wraps them. Should support `and` or `or` operations.

##### Example:

```js
const andRuleGroup = {
  iss: 'some-issuer',
  deviceId: 'some'
}

const orRuleGroup = {
  _or: true,
  iss: 'some-issuer',
  deviceId: 'some',
}
```

### Redis + Consul based filter

This filter uses Redis as the rule source and Consul as the rule version update notification source.

#### Redis structures

All rules are stored in `ZSET` where `member` is stringified rule and `score` is rule `ttl`.

#### RevocationRuleManager

`RevocationRuleManager` class provides crud operations for Redis keys with rules.

* Manages rules and TTL of the rules.
* On rule `add` operation updates rule version in the consul storage - this forces all RuleStorage to reset their caches for the corresponding users and global group

#### RevocationRuleStorage

`RevocationRuleStorage` class provides in-memory rule synchronization and validation results caching.

* Watches specified `consul.kv` prefix and invalidates rule and result caches.
* Provides in-memory rule search for token validation. Loads rules from Redis.

## Token validation process

`users.verify` endpoint should be updated and use provided `RevocationRuleStorage` to check token validation. 

1. Should prepare any required data: 

   ```javascript
   const data = {
       // ... decoded token data
     }
   }
   ```

2. Execute `RevocationRuleStorage.verify(userId, data): boolean` to perform validation:

   - If `data` matched any of the rules, we should consider that token is invalid
   - If there is no match - the token is valid
   
