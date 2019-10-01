# Password validator
The validator provides a complexity check for AJV validator schemas when initialized defines `password` keyword.
Validator dependencies: 
- `dropbox/zxcvbn` complexity checker
- `mfleet.validator` plugin.

## Configuration
Validator configuration stored under `service.config.passwordValidator` key:

### minStrength _int_
Sets minimal password complexity to accept a given password.

### skipCheckFieldNames _string[]_
Allows skipping field validation:

- When passed field value is `boolean`:
    * Validation skipped if `Object[field]` === `true`.
    * Validation performed if `Object[field]` === `false`.
- When passed field value is `any` type except `boolean`:
    * Validation skipped if `Object[field]` set.
    * Validation performed if `Object[field]` not exists.

E.g.:
```js
const validatorConfig = {
  minStrength: 4,
  enabled: true,
  skipCheckFieldNames: ['skipPassword'],
};

// Skip validation
const dataSkipOnBool = {
  myField: 'fooBar', // schema "myField":{"password": true} keyword
  skipPassword: true,
};

// Skip validation `skipPassword` is string
const dataSkipOnString = {
  myField: 'fooBar',
  skipPassword: 'fooStringValue',
};

// Validation performed
const dataSkipOnBoolFalse = {
  myField: 'fooBar',
  skipPassword: false,
};

const data = {
  myField: 'fooBar',
  skipPassword: true,
};

```

### forceCheckFieldNames __string[]__
Allows to force Validation event if the Validator is disabled:
- When any of passed fields value is `boolean`:
    * Validation performed if `Object[field]` === `true`.
    * Validation skipped if `Object[field]` === `false`.
- When any of passed fields value is `any` type except `boolean`:
    * Validation performed if `Object[field]` set.
    * Validation skipped if `Object[field]` not exists.

```js
const validatorConfig = {
  minStrength: 4,
  enabled: false, // Will validate the `data` object anyway
  forceCheckFieldNames: ['forceValidate'],
}

// Force validation
const data = {
  myField: 'fooBar', // in schema "myField":{"password": true} keyword.
  forceValidate: true,
};

// Force validation, `forceValidate` is a string.
const dataSkipOnString = {
  myField: 'fooBar',
  forceValidate: 'fooStringValue',
};

// Validation NOT performed.
const dataSkipOnBoolFalse = {
  myField: 'fooBar',
  forceValidate: false,
};

// Validation NOT performed.
const data = {
  myField: 'fooBar',
};
```

### inputFieldNames _string[]_
Allows using additional fields from the parent object. These values used inside `zxcvbn` to avoid sensitive information inside passwords.
```js
const data = {
  username: 'foouser',
  password: 'foouser1232',
  altname: 'barname',
};

// if 'username' and 'password' or other data will match, the complexity level dropped.
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
