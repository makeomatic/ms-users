# User/Organization metadata update
## Overview and Motivation
When user or organization metadata is updated, the Service should track audiences with assigned metadata.
For each assigned meta hash always exists a single `audience`, but there is no list of `audiences` assigned to the user or organization.

To achieve this ability, I advise these updates: 

## Audience lists
Audiences stored in sets with names created from `USERS_AUDIENCE` or `ORGANISATION_AUDIENCE` constants and `Id`
(e.g.: `{ms-users}10110110111!audiences`). Both keys contain `audience` names that are currently have assigned values.

The `audience` list will be updated on each update of the metadata.

## Metadata Handling classes
Service logic is updated to use 2 specific classes that will perform all CRUD operations on User or Organization metadata.

* Classes located in: `utils/metadata/{user|organization}.js`.
* Both classes use same [Redis backend](#redis-metadata-backend-class).

## Redis Metadata Backend class
The class performs all work on metadata using Redis DB as a backend.

## Notice
* All User or Organization metadata operations should be performed using Provided classes otherwise, audiences won't be tracked.
