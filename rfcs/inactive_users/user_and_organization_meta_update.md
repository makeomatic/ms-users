# User/Organization metadata update rework
## Overview and Motivation
When user or organization metadata needs to be updated, the Service uses the Redis pipeline javascript code.
For each assigned meta hash always exists a single `audience`, but there is no list of `audiences` assigned to the user or company.
To achieve easier audience tracking and a combined metadata update, I advise using a Lua based script.

## Audience lists
Audiences stored in sets formed from `USERS_AUDIENCE` or `ORGANISATION_AUDIENCE` constants and `Id`
(eg: `{ms-users}10110110111!audiences`). Both keys contain `audience` names that are currently have assigned values.

## DEL utils/updateMetadata.js
All logic from this file moved to separate class `utils/metadata/redis/update-metadata.js`.

## utils/metadata/{user|organization}.js
Classes that perform user or organization metadata update and
audience list tracking.

Available methods:
  * update 
  * updateMulti
  * batchUpdate
  * delete

**TODO** Fill up


## global updates
`ms-users` source code now use new `UserMetadata` when any update operation happens.


