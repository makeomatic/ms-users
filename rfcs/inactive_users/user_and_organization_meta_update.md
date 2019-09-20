# User/Organization metadata update rework
## Overview and Motivation
When user or organization metadata needs to be updated, the Service uses the Redis pipeline javascript code.
For each assigned meta hash always exists a single `audience`, but there is no list of `audiences` assigned to the user or company.
To achieve easier audience tracking and a combined metadata update, I advise using a Lua based script.

## Audience lists
Audiences stored in sets formed from `USERS_AUDIENCE` or `ORGANISATION_AUDIENCE` constants and `Id`
(eg: `{ms-users}10110110111!audiences`). Both keys contain `audience` names that are currently have assigned values.

## utils/updateMetadata.js
Almost all logic in this file removed and ported into LUA Script.
This Function checks the consistency of the provided `opts`. If `opts.metadata` and `opts.audiences` are objects, script transforming them to an array containing these objects. Checks count of meta operations and audiences to equal each other.
Organization meta update request `utils/setOrganizationMetadata.js` uses the same functionality, so the same changes applied to it.

After commands execution result returned from the script, decoded from JSON string.

## script/updateMetadata.lua
Script repeats all logic including custom scripts support.

### Script parameters:
1. KEYS[1] Audiences key template.
2. KEYS[2] used as metadata key template, eg: "{ms-users}{id}!metadata!{audience}".
3. ARGV[1] Id - organization or user-id.
4. ARGV[2] JSON encoded opts parameter opts.{script, metadata, audiences}.

### Depending on metadata or script set:
If `opt.metadata` set:
 * Script starts iterating audiences.
 * On each audience, creates metadata key from provided template.
 * Iterates operations from `opt.metadata`, based on index of `opts.audiences`.
    ```javascript
     const opts = {
       audiences: ['first', 'second'],
       metadata: [{
         // first audience commands
       }, {
         // second audience commands
       }], 
     }
    ```
   Commands execute in order: `audiences[0]` => `metadata[0]`,`audiences[1]` => `metadata[1]`, 

If `opt.script` set:
* Script iterates `audiences` and creates metadata keys from provided template
 * Iterates `opt.script`:
    * EVAL's script from `script.lua` and executes with params generated from: metadata keys(look to the previous step)
     and passed `script.argv`.
    * If script evaluation fails, script returns redis.error witch description.

When operations/scripts processed, the script forms JSON object like
```javascript
const metaResponse = [
  //forEach audience
  {
    '$incr': {
      field: 'result', // result returned from HINCRBY command
    },
    '$remove': intCount, // count of deleted fields
    '$set': "OK", // or cmd hset result.
  },
];

const scriptResponse = {
  'scriptName': [
    // values returned from script
  ],
};
```

### Audience list update
When all update operations succeeded:
* Script get's current list of user's or organization's audiences from HSET `KEYS[1]`,
unions them with `opts.audiences` and generates full list metadata keys.
* Iterates over them to check whether some data exists.
* If no data exists, the script deletes the corresponding audience from HSET `KEYS[1]`.

