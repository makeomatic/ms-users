# Password validator
The validator provides a complexity check for AJV validator schemas when initialized defines `password` keyword.
Validator dependencies: 
- `dropbox/zxcvbn` complexity checker
- `mfleet.validator` plugin.

## Configuration
Validator configuration stored under `service.config.passwordValidator` key:

### minStrength _int_
Sets minimal password complexity to accept a given password

### skipFieldName _string_
Objects field name containing a boolean value. Allows skipping field validation if value === true Eg:
```js

const data = {
  myfield: 'fooBar', // in schema "myfield":{"password": true} keyword
  validate: false,
};

const validatorConfig = {
  minStrength: 4,
  skipFieldName: 'validate', // if `data.validate` eq true 'data.myfield' is skipped during validation
}
```
### inputFieldNames _array_
Allows using additional fields from the parent object. These values used inside `zxcvbn` to avoid sensitive information inside passwords.
```js
const data = {
  username: 'foouser',
  password: 'foouser1232',
  altname: 'barname',
};

// if 'username' and 'password' or other data will match, complexity level dropped
const validatorConfig = {
  minStrength: 4,
  inputFieldNames: [
    'username',
    'altname',
  ]
}
```

## Schema
Add the `password` keyword to any field in your schema.
```json
{
  "$id": "register",
  "type": "object",
  "required": [
    "username",
    "audience"
  ],
  "properties": {
    "username": {
      "type": "string"
    },
    "alias": {
      "type": "string"
    },
    "password": {
      "type": "string",
      "password":true
    },
    "audience": {
      "type": "string",
      "minLength": 1
    }
  }
}
```
