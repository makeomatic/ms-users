# Statefull JWT auth upgrade

## Refresh and access tokens

**TBD.**

## Revoke lists

In the case of the stateful JWT verification process, we should provide an ability to revoke/verify any tokens provided by users using a predefined or custom ruleset. 

Such rules should handle system-wide or user-based checks and provide an ability to set `ttl` for them.

* Refresh token compromised. We should revoke All session tokens generated using this token.
* Access token compromised and must be revoked.
* Revoke all tokens that have an issue date before or between some dates.
* Revoke tokens using any other possible condition such as `UserAgent` `DeviceId` etc.

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
  'some.nested.path': 'some' // also support nested properties
}
```


### RadixFilter

Revocation lists must perform fast, reliable in-memory rule match, so generic iteration is too slow and will increase response time for the `users.verify` action. To provide a fast rule matching process generic `Trie` structure that will perform an optimized lookup. Each rule will be stored using the specified prefix:

```js
const rules = [
  [`g:${ruleId}`, new RuleGroup()],
  [`g:${ruleId}`, new RuleGroup()],
  [`u:${userId}:${ruleId}`, new RuleGroup()],
  [`u:${userId}:${ruleId}`, new RuleGroup()],
]
```

Using such prefix allows querying using specific prefix(`g:`- for system-wide rules, `u:${id}:` - for user rules) path, and this will allow finding any rules for the user in 2 queries: `GlobalPrefix` and `UserBasedPrefix`.

### Consul as `rule` resource

Provides reliable data sync and update notification using `kv.watch`.

Service should provide additional classes and endpoints to perform rule updates.

#### RevocationRuleManager

`RevocationRuleManager` class provides crud operations for consul kv, also contains TTL validation routines.

* Provides CRUD for `consul.kv`. Available for all nodes.
* Manages TTL of the keys. All sync jobs are performed in the background and should run on `leader`.

#### RevocationRuleStorage

`InvocationRuleStorage` class provides in-memory rule synchronization and runtime preload.

* Watches specified `consul.kv` prefix and reload `RadixFilter` on keys update.
* Provides in-memory rule search for token validation.

## Token validation process

`users.verify` endpoint should be updated and use provided `InvocationRuleStorage` to check token validation. 

1. Should prepare any required data: 

   ```javascript
   const data = {
     jwt: {
       // ... decoded token data
     },
     req: {
       // .. any data from request that could be used in validation
       // ip, useragent and etc.
     }
   }
   ```

2. Execute `InvocationRulesStorage.verify(userId, data): boolean` to perform validation:

   - If `data` matched any of the rules, we should consider that token is invalid
   - If there is no match - the token is valid
   
