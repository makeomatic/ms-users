# Facebook OAuth Additional tests and Browser security
These changes are targeted to add additional tests for Facebook OAuth 
and provide a better WebExecuter error notification, when Facebook throttling occurs.

## Raise OAuth error Test
The test will Check that OAuth Errors coming from `@hapi/bell` are shown in service response. To be sure that service performs
correct serialization and handling of this error we need this test.
Test will use stub as `http.auth.test` method with custom error and check that `service`
returns the same results.

## WebExecuter console notification
Some changes `facebook.WebExecuter`'s  `waitFor...` action timeout error caused by throttling, needed. Now
you can't understand why this timeout happens. We can check all `chrome.page`'s requests, if any
finished with 500 Status Code, we will try to parse the response. If the response contains `ms-users` error
with information that throttling occurred, `WebExecuter` will log Notification into the console
and throw a custom error.

After this, we can wrap all tests with try...catch blocks using `function wrapper` and handle this situation.

## Boom error handling
Should we move error's fields and stack cleanup for errors that thrown on `auth.test` in 'oauth/facebook/index.js' to a different place like `preResponse` hook? 
Found that in "production" environment, sub errors coming from `@hapi/bell` still contains stack trace, think it's better to remove it. 
