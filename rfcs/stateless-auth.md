# Statefull JWT auth upgrade

This feature will provide additional security to the User JWT tokens management and should not break existing intergration.

### Compatibility

This feature should be considered as plugin and should be easily enabled without losing any user authorizations.



## Refresh and access tokens

### Refresh token

Long living token, used when creating new `Access` tokens during token refresh process.
Should be passed only to `users.refresh` and `users.logout` actions.

```ts
type RefreshToken = {
  // global payload
  cs: number; // token id
  iat: number; // issued at timestamp
  irt: number; // always 1, as it's a refresh token
  exp: number; // expire timestamp

  // app specific payload
  aud: string; // audience
  username: string; // userId
}
```

#### Refresh token lifecycle

* Created on `user.login`, `users.refresh`
* Expires on `exp` date.
* Expires on `users.logout`.

### Access token

The token with short TTL, generally passed with all requests, except `users.refresh` and `users.logout`.

```ts
type AccessToken = {
  cs: number;
  iat: number;
  exp: number;
  rt: number; // RefreshToken id that created this token
  
  // app specific payload
  aud: string; // audience
  username: string; // userId
}
```

#### Access token lifecycle

* Created on `users.login`, `users.refresh`.
* Always expires on `RefreshToken.exp`.
* Expires when `RefreshToken` revoked.

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

## Implementation

### RevocationRuleManager

`RevocationRuleManager` class provides crud operations for Redis keys with rules.

* Manages rules and TTL of the rules.
* On rule `add` operation updates rule version in the consul storage - this forces all RuleStorage to reset their caches for the corresponding users and global group

#### TTL of the rules

The `RevocationRulemanager` setups recurrent jobs on service startup and stops them on shutdown. This job performs the rule cleanup procedure by checking the `kv.key.Flags` value.

* Outdated rules should have `Flags < Date.now() && Flags !== 0`.
* Delete is performed in transaction.

#### Provided endpoits

If `username` is empty, the request performs over System-Global rules.

##### `revoke-rule.update`

Creates or updates System-Global or User rules.

```javascript
const req = await amqp.publishAndWait('revocation-rule.update', {
  username, // optional 
  rule: {
    id, // empty on create
    params, // revocation rule definition, is required
  }
})
```

##### `revoke-rule.list`

The action lists System-Global or User rules.

```javascript
const req = await amqp.publishAndWait('revocation-rule.list', {
  username, // optional 
})
```

##### `revoke-rule.get`

The action gets System-Global or User rule.

```javascript
const req = await amqp.publishAndWait('revocation-rule.get', {
  username, // optional 
  rule, // id of the rule, is required
})
```

##### `revoke-rule.get`

The action deletes System-Global or User rule.

```javascript
const req = await amqp.publishAndWait('revocation-rule.delete', {
  username, // optional 
  rule, // id of the rule is required
})
```

### RevocationRuleStorage

`RevocationRuleStorage` class provides in-memory rule synchronization and validation results caching.

* Watches specified `consul.kv` prefix and invalidates rule and result caches.
* Provides in-memory rule search for token validation. Loads rules from Redis.

### Stateless JWT rules

All rules use the `RefreshToken.exp` value as the TTL boundary.

#### Login

No rules created.

#### Refresh

Creates rule that invalidates all previously issued tokens issued by the `RefreshToken`.

```javascript
await createRule({
  username: userId,
  rule: {
    params: {
      ttl: refreshToken.exp,
      rt: refreshToken.cs, // id of the refresh token
      iat: { lte: Date.now() }, // 
    },
  },
});
```

#### Logout

Creates rule that invalidates all issued tokens by `RefreshToken` and itself.

```javascript
await createRule(service, {
  username: userId,
  rule: {
    params: {
      ttl: refreshToken.exp,
      _or: true,
      cs: token.cs,
      rt: token.cs,
    },
  },
});
```

#### Reset

Creates rule that invalidates all tokens issued before `Date.now()`.

```javascript
await createRule({
  username: userId,
  params: {
    iat: { lte: Date.now() },
  },
});
```

