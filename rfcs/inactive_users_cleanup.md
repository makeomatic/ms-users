# Inactive user cleanup

## Overview and motivation
Currently `ms-users` service using TTL based cleanup for users who didn't pass the activation process. 
In this case, there are lots of data keys staying in the database. That brings additional 'mess' into DB data.
To provide generally better data handling and clean database structure, I introduce some changes in service logic.

## General defs
  - `inactive-users`
  Redis database sorted set key. Bound to `USER_ACTIVATE` constant.
  Record contains `userId` as value and `timestamp` as score. 
  - `user-audiences` [Described here](update_metadata_lua.md#audience-list-update)
  - `deleteInactivatedUsers` Redis script, handling all cleanup logic

## Organization Members
The `organization add member` process doesn't have validation whether
the user passed activation. This case allows inviting inactive users into an organization. The script checks whether inactivated user assigned to any organization
and deletes users from organization members and user->organization bindings.

## Registration and activation
On Activation and Registration request event `users:cleanup` is emitted, and executed as a hook.
When Activation action executes, the hook starts before all actions. This strategy saves from inactive users 
that hit TTL but tried to pass the activation process.
When Registration action executed, hook executed after `username` exists check.
Handler not breaking general logic and not throwing errors, logs error into a logfile.

## Registration process
When the user succeeds registration but activation not requested, the new record added to `inactive-users`. 
Record contains `userId` and `currenttimestamp`

## Activation process
When the user succeeds activation `userId` record deleted from `inactive-users`.

## `users:cleanup` hook
Calls `deleteInactivatedUsers` script with TTL parameter from `service.config.deleteInactiveAccounts`

## Redis Delete Inactive User Script
When service connects to Redis server and fires event "plugin:connect:$redisType" `utils/inactive/defineCommand.js` executed.
Function processes `deleteInactivatedUsers.lua.hbs` and loads resulting script into IORedis.
Script depends on lots of constants and key templates, so all these values rendered inside of the template.

#### deleteInactivatedUsers `USERS_ACTIVATED` `TTL` as seconds
##### Script paramerters:
1. KEYS[1] Sorted Set name containing the list of users that didn't pass activation
2. ARGS[1] TTL in seconds

##### When started:
1. Gets UserId's from ZSET `USERS` where score < `now() - TTL * 1000`
2. Gets dependent userData such username, alias, and SSO provider information, used in delete procedure.
3. Deletes processed user ids from `USER_ACTIVATED` key.

##### Delete process 
The main logic adopted from `actions/removeUsers.js`.
Using provided username, id, alias and SSO providers fields, script checks and deletes dependent data from the database:
* Alias to id binding
* Username to id binding
* All assigned metadata. Key names created from the provided template and `user-audiences`.
* SSO provider to id binding. Script decodes Data stored in JSON string and iterates over assigned `uid's`.
UID's extracted from Internal data by `SSO_PROVIDERS` name as the field name.
* user tokens
* private and public id indexes
* links and data used in Organization assignment
* throttle actions (???). **THROTTLE_PREFIX constant doesn't exist in constants.js, so assuming this left for backward 
 compatibility with previous version**
