# Inactive users index

## Overview and motivation
As other task dependency and to provide additional internal statistics the Service needs additional index
to track users that didn't pass the activation.

## `inactive-users` index
It's an Additional Redis Sorted Set which contains the list of IDs of the `inactive` users.
Each item score is equal to the `timestamp` set on user creation.

To avoid hardcoded SET name new `USERS_INACTIVATED` constant introduced.

## Registration process
When the user succeeds registration but activation not requested, the new entry added to `inactive-users`.

**NOTE:** Old Redis `expire` setting methods left in their place, to save old service behavior.

## Activation process
When the user succeeds activation the entry deleted from `inactive-users`.

## Index cleanup
Temporarily add `inactive-users` index cleanup. The functionality will move into one LUA script
with `delete inactive users` logic. This will save us from `dlock` based implementations and all operations will execute in `one-shot` avoiding race conditions.
On `registration` cleanup method executes before user creation.

On `activation` cleanup method executes before any checks performed by `activation` action.


