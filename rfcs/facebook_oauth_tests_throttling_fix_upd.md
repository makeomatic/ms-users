# Facebook OAuth Tests and Service Logic
First version of this file was targeted only on Tests update but after some research,
was decided to change some logic in `OAuth` handler too.
 
General changes were intended to add additional tests for Facebook OAuth 
and provide a better WebExecuter error handling when Facebook throttling occurs.

Services OAuth handler and `preResponse` hook need to be updated.

## Tests changes
### OAuth Err raise test
The test will Check that OAuth Errors coming from `@hapi/bell` are shown in service response.
Test required to be sure that service performs correct serialization and handling of this error.
Test uses stub as `http.auth.test` method with custom error and check that `service`
returns the same results.

### WebExecuter Timeout Error
Adding additional error processing logic into `helpers/oauth/facebook/web-executer.js` will
provide more informative output from tests. Now if `page.waitFor...` Timeout happens, error message will
contain last Service response or page contents.

## Service logic changes
### @hapi/bell Boom error handling
In `production` ENV the Service still renders full error data coming from `@hapi/bell`. Stubbed OAuth call with simulated errors
returns such response:

```javascript
const $ms_users_inj_post_messsge = { payload:
   { data:
      { data: { i_am_very_long_body: true, },
        isBoom: true,
        isServer: false,
        output:
         { statusCode: 403,
           payload:
            { statusCode: 403, error: 'Forbidden', message: 'X-Throttled' },
           headers: {} },
        name: 'Error',
        message: 'X-Throttled',
        stack:
         'Error: X-Throttled\n    at Context.forbidden (/src/test/suites/oauth/facebook.js:97:34)\n    at process._tickCallback (internal/process/next_tick.js:68:7)' },
     isBoom: true,
     isServer: true,
     output:
      { statusCode: 500,
        payload:
         { statusCode: 500,
           error: 'Internal Server Error',
           message: 'An internal server error occurred' },
        headers: {} },
     name: 'Error',
     message: 'BadError' },
  error: true,
  type: 'ms-users:attached',
  title: 'Failed to attach account',
  meta: {} }
```

Even if `http.IncomingMessage` deleted from error, too much data passed in response.
Rendering of the Error is performed by `serialize-error` in Hook instead `hapi` server and this shows all error contents.

This great for debug purposes but not for passing to the client, so  `preResponse` hook should delete all this data

**UPD**

Added new error `OAuthError` with custom `toJSON` serializer, which removes all unnecessary data
and returns Simplified Object. Usage of this error should be limited by `auth/OAuth` scope

After this change Errors rendered in this way:

```javascript
const p = { 
  payload: { 
    message: 'BadError',
    name: 'OAuthError',
    inner_error: {
      message: 'BadError',
      name: 'Error',
      stack:
       'Error: BadError\n    at Object.internal (/src/test/suites/oauth/facebook.js:106:28)\n    at Object.invoke (/src/node_modules/sinon/lib/sinon/behavior.js:151:35)\n    at module.exports.internals.Auth.functionStub (/src/node_modules/sinon/lib/sinon/stub.js:130:47)\n    at Function.invoke (/src/node_modules/sinon/lib/sinon/spy.js:297:51)\n    at module.exports.internals.Auth.functionStub (/src/node_modules/sinon/lib/sinon/spy.js:90:30)\n    at Users.test (/src/src/auth/oauth/index.js:149:45)\n    at Users.tryCatcher (/src/node_modules/bluebird/js/release/util.js:16:23)\n    at Promise._settlePromiseFromHandler (/src/node_modules/bluebird/js/release/promise.js:517:31)\n    at Promise._settlePromise (/src/node_modules/bluebird/js/release/promise.js:574:18)\n    at Promise._settlePromiseCtx (/src/node_modules/bluebird/js/release/promise.js:611:10)\n    at _drainQueueStep (/src/node_modules/bluebird/js/release/async.js:142:12)\n    at _drainQueue (/src/node_modules/bluebird/js/release/async.js:131:9)\n    at Async._drainQueues (/src/node_modules/bluebird/js/release/async.js:147:5)\n    at Immediate.Async.drainQueues [as _onImmediate] (/src/node_modules/bluebird/js/release/async.js:17:14)\n    at runCallback (timers.js:705:18)\n    at tryOnImmediate (timers.js:676:5)\n    at processImmediate (timers.js:658:5)',
      data:
       { message: 'X-Throttled',
         name: 'Error',
         stack:
          'Error: X-Throttled\n    at Context.forbidden (/src/test/suites/oauth/facebook.js:97:34)\n    at process._tickCallback (internal/process/next_tick.js:68:7)',
         data: { i_am_very_long_body: true } } } },
   error: true,
   type: 'ms-users:attached',
   title: 'Failed to attach account',
   meta: {} 
}

```

## TODO
- [x] WebExecuter Timeout handling
- [x] Test checking that service return error
- [x] `@hapi/boom` error serialization on `OAuth preResponse` hook

- [ ] Clean up code
- [ ] Cleanup docs
 
