# Inactive user cleanup

## Overview and motivation
For users who didn't pass the activation process, the service using TTL keyspace cleanup and only `Internal Data` deleted.
A lot of linked keys remain in the database, and this leads to keyspace pollution.
For better data handling and clean database structure, I introduce some changes in service logic:

## General defs
  - `inactive-users` [Described here](#inactive-users-index) 
  - `user-audiences` [Described here](user_and_organization_meta_update.md)

## `inactive-users` index
It's an Additional Redis Sorted Set which contains the list of IDs of the `inactive` users.
Each item score is equal to the `timestamp` set on user creation.
To avoid hardcoded SET name new `USERS_INACTIVATED` constant introduced.

#### Registration process
When the user succeeds registration but activation not requested, the new entry added to `inactive-users`.

#### Activation process
When the user succeeds activation the entry deleted from `inactive-users`.

#### Index cleanup
On `registration` cleanup method executes before user creation.
On `activation` cleanup method executes before any checks performed by `activation` action.
* Uses `dlock` to be sure that only one process runs.
* Gets outdated user list and deletes them.

## TODO Organization Members --- Need additional information
The `organization add member` process doesn't have validation whether the user passed activation and allows
inviting inactive users into an organization.

* Should We Delete Organization Members?


