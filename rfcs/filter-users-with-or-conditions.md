# Filter users with or confition

Provides an ability to get a list of users with different search parameters

## Why

For some tasks, we need to implement a search for users by id, name, etc. concurrent search by id and name will be carried out with the condition "and", which will return incomplete data.

## Solution 1

Change schema for users list.

### Solution 1.1

make filter parameter an array

```
"filter": {
    "type": "array",
    "items": {
        "$ref": "common.json#/definitions/filter"
    },
}
```
then we will be able to get users by different filters and merge them

#### disadvantages

breaks backward compatibility

### Solution 1.2

add additional property or for filter

schemas/common.json

```
"filter": {
  ...
  "additionalProperties": {
    "oneOf": [
        ...
      {
        "type": "object",
        "minProperties": 1,
        "maxProperties": 2,
        "patternProperties": {
          ...
          "or": {
            "type": "array",
            "items": {
              "$ref": "common.json#/definitions/filter"
            },
          }
        }
      }
    ]
  }
},
```
then we will be able to get users by different filters and merge them

#### disadvantages

will not be implemented in other filters (invites and organizations)


## Solution 2

update redis-filtered-sort library

make https://github.com/makeomatic/redis-filtered-sort  possible to accept the parameter "or"

#### advantages

it can be used in other projects

#### disadvantages

we need more time to develop

