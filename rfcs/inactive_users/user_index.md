# Inactive users index

## Overview and motivation
As other task dependency and to provide additional internal statistics the Service needs additional index
to track users that didn't pass the activation.

## `inactive-users` index
It's an Additional Redis Sorted Set which contains the list of IDs of the `inactive` users.
Each item score is equal to the `timestamp` set on user creation.

To avoid hardcoded SET name new `USERS_INACTIVATED` constant introduced.

## Inactive user tracking utils
New `deleteFromInactiveUsers(userID)` and `addToInactiveUsers(userID)` methods used to control data stored inside `inactive-users` set.

## Registration process
When the user succeeds registration but activation not requested, the new entry added to `inactive-users`.

**NOTE:** Old Redis `expire` setting methods left in their place, to save old service behavior.

## Activation process
When the user succeeds activation the entry deleted from `inactive-users`.
