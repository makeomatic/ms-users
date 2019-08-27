# Inactive user cleanup

## Overview and motivation
For users who didn't pass the activation process, the service using TTL keyspace cleanup and only `Internal Data` deleted.
A lot of linked keys remain in the database, and this leads to keyspace pollution.
For better data handling and clean database structure, I introduce some changes in service logic:

## General defs
  - `inactive-users`
  Redis database sorted set key. Assigned to `USER_ACTIVATE` constant.
  Record contains `userId` as value and `timestamp` as score. 
  - `user-audiences` [Described here](update_metadata_lua.md#audience-list-update)
  - `deleteInactivatedUsers` Redis script, handling all cleanup logic.

## Organization Members
The `organization add member` process doesn't have validation whether the user passed activation and allows
inviting inactive users into an organization. The script checks whether inactivated user assigned to any organization
and deletes users from organization members and user->organization bindings.

## Registration and activation
Every Activation and Registration request event executes  `users:cleanup`  hook.
The Activation request executes the hook first this strategy saves from inactive
users that hit TTL but tried to pass the activation process.
The Registration request executes the hook after `username` exists check.

## Registration process
When the user succeeds registration but activation not requested, the new entry added to `inactive-users`.
Record contains `userId` and `current timestamp`.

## Activation process
When the user succeeds activation `userId`,the entry deleted from `inactive-users`.

## `users:cleanup` hook `cleanUsers(suppress?)`
`suppress` parameter defines function error behavior. If parameter set, the function throws errors,
otherwise, function calls `log.error` with `error.message` as message.
Default value is `true`. IMHO User shouldn't know about our problems.

Other option, is to define new config parameter as object and move `config.deleteInactiveAccounts` into it:
```javascript
const conf = {
  deleteInactiveUsers: {
    ttl: seconds, // replaces deleteInactiveAccounts
    suppressErrors: true || false,
  },
}
```
Calls `deleteInactivatedUsers` script with TTL parameter from `service.config.deleteInactiveAccounts`.
When script finished, calls TokenManager to delete Action tokens(`USER_ACTION_*`, ``). 
*NOTE*: Should we update TokenManager to add support of pipeline?

## Redis Delete Inactive User Script
When the service connects to the Redis server and fires event "plugin:connect:$redisType" `utils/inactive/defineCommand.js` executed.
Function rendering `deleteInactivatedUsers.lua.hbs` and evals resulting script into IORedis.
The Script using a dozen constants, keys, and templates, so all these values rendered inside of the template using template context.
Returns list of deleted users.

#### deleteInactivatedUsers `USERS_ACTIVATED` `TTL` as seconds
##### Script paramerters:
1. KEYS[1] Sorted Set name containing the list of users that didn't pass activation.
2. ARGS[1] TTL in seconds.

##### When started:
1. Gets UserId's from ZSET `USERS_ACTIVATED` where score < `now() - TTL * 1000` and iterates over them.
2. Gets dependent userData such as username, alias, and SSO provider information used in delete procedure and calls [Delete process](#delete-process).
3. Deletes processed user ids from `USER_ACTIVATED` key.

##### Delete process 
The main logic is based on `actions/removeUsers.js`.
Using the username, id, alias and SSO providers fields, script checks and removes dependent data from the database:
* Alias to id binding.
* Username to id binding.
* All assigned metadata. Key names rendered from the template and `user-audiences`.
* SSO provider to id binding. Using `SSO_PROVIDERS` items as the field name decodes and extracts UID's from Internal data.
* User tokens.
* Private and public id indexes
* Links and data used in Organization assignment

