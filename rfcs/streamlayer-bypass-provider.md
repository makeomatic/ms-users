# StreamLayer Internal Bypass Provider

StreamLayer Internal Bypass Provider accept JWT token, verify and return it

## Purposes
- allow SDK clients acts with `ms-users` svc (in terms of client requests) using same `bypass` EPs (EndPoinds) and same properties: (`userKey`,`schema`) without full authentication flow, using exist JWT
- skip base flows: `authenticate` `registerAndLogin` `retreiveUser` `login`
- `authenticate` does JWT verification, update user metadata by setting `streamlayer` provider in extra attributes and assign new one JWT

## Prerequisites
- SDK clients pass JWT token in `userKey` request property of `users.auth-bypass` route

## Authentication flow
1. SDK clients pass JWT token in `userKey` request property of `users.auth-bypass` route
```json
{ 
	"userKey": "ext generated JWT access token", 
	"schema": "internal:streamlayer"
}
```
- where `internal` is bypass provider
- `streamlayer` is a `account` property

2. `ms-users` svc hanldle action `authBypass`
extract props
```js
const { schema, userKey } = params;
const [schemaName, account] = schema.split(':');
```
3. do `api.authenticate(userKey, account);` within providet JWT userKey
4. authenticate method does
- skips base flows skip base flows `registerAndLogin` `retreiveUser` `login`
- JWT verification and payload decode or throw Auth Error
- updates Redis user metadata via adding/setting `etx[account]` (`etx[streamlayer]`)
- assigns new JWT token with updated user metadata