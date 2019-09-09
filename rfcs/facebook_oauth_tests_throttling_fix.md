# Facebook OAuth tests change

## Overview and Motivation
After some updates Facebook Graph API throttling mechanisms, OAuth tests started failing randomly with 403 code or
`invalid credentials` ms-users error.
Graph API limits requests by a sliding window algorithm, which allows some(not all) requests even after block.
The changes listed here will provide better stability in OAuth error handling and overall test suites stability.

## Facebook Throttling
After some changes in Facebook GraphAPI `throttling` behavior became much stronger.
On Every GraphAPI request, facebook response contains special header `X-App-Usage`:
```javascript
const XAppUsage = {
  'call_count': 28,  //Percentage of calls made 
  'total_time': 15,  //Percentage of total time
  'total_cputime' : 24   //Percentage of total CPU time
}
```
If the value of any field becomes greater than 100 causes `throttling`.
This header helps to determine how soon `throttling` will happen.

### OAuth API v3.3 v4.0 Update
Updated OAuth API. There is no braking changes and there's no additional work to upgrade version.
API 3.3 is not available for new Applications and all requests made to this version are redirected to v4.0.

### Tests `Missing Credentials` Error
Mishandling `@hapi/boom` error causes the OAuth strategy to continue its execution but without mandatory `credentials` and this caused the random tests to fail.

##### Solution
Implement additional error conversion from `@boom/error` to general `HTTPError`. 
This return OAuth's error processing to normal behavior.
 
### Tests `403 - Application throttled` Error
Before every test, some direct GraphApi calls made. In some `throttling` conditions requests rejected with `403` Error,
this happens because of Facebook call Throttling. 

### @hapi/bell error handling
When the user declines an application to access the 500 Error returned from `@hapi/bell`.
When application throttled or request `200 < statusCode > 299` the same 500 Error returned with Response as `data` field.

On catch block after `http.auth.test` call added additional error processing on @hapi/boom error:
* Cleans references to `http.IncomingMessage` from error, otherwise further error serialization shows all contents of `http.IncommingMessage` class. 
IMHO: That's weird to show Buffers and other internal stuff.
* If error message contains information that user Rejected App access, returns Error.AuthenticationRequiredError` with `OAuth App rejected: Permissions error` . to save current behavior and return 401 StatusCode.
* Other errors are thrown as @hapi/Bomm error.

Removed `isError` check and function from `auth/oauth/index.js` because it's impossible to receive a response with statusCode other than 200 from `@hapi/bell`.
According to current source code, only `redirects` and `h.unauthenticated(internal_errors)`(used to report OAuth request errors) thrown from `hapi.auth.test`.

#### Overall Graph API over-usage
Over-usage of Graph API request time produced by `createTestUser` API calls, this API call uses a lot of API's execution time and increments Facebook's counters fast.
Before every test, we execute `createTestUser`  3*testCount times, so each suite execution performs about 39 long-running calls. 
Facebook Graph API starts throttling requests after 4-6 suite runs.

##### Solution
Exclude long-running `createTestUser` operation from tests and reuse test users.
Attempt to reduce API call count.
 
## Test logic changes

### Test Users Create
Test users will be created once before all tests and reused.
After each test run, users Application permissions revoked depending on user context:
* For `testUserInstalledPartial` test revokes only `email` permission.
* For `testUser` test revokes all permissions.

When the test suite finishes users deleted, this saves us from hitting the Facebook TestUser count limit.

### Test Users
There are 3 types of Facebook users used In the current test suites:
```javascript
const createTestUser = (localCache = cache) => Promise.props({
  testUser: createTestUserAPI(),
  testUserInstalled: createTestUserAPI({ installed: true }),
  testUserInstalledPartial: createTestUserAPI({ permissions: 'public_profile' }),
})
```

#### testUserInstalled
**`testUserInstalled`** not used in tests. After review of all commit history for `suites/oauth/facebook.js`, found that
this user was defined in [this commit](https://github.com/makeomatic/ms-users/blob/733aba371b62d90935c42087ca6d3912152cb63b/test/suites/oauth/facebook.js)
and never used.

According to the users' props, it defined for `sign-in` tests without creating the new user,
but these tests use `testUser` in all suite and behave like other sign-in/sign-up tests.

Startup logic and checks for these tests is almost the same and works like:
1. Call `https://mservice/users/oauth/facebook`
2. The Service redirects to the Facebook Login form.
3. Puppeter fills in Login and password.
4. Puppeter Confirms/Rejects Application request.

`testUser` totally responds to our needs and `testUserInstalled` looks unused.

**!!!** _Assuming that we can remove the `testUserInstalled` user._

#### testUserInstalledPartial
**`testUserPartial`** used in tests that checking partial permissions in registration/login and used as the previous scope,
but users prop `installed` false.

In current partial permission tests, Facebook asks 2 permissions(public_profile, email), this indicates that
partial `permissions` ignored on the user creation process. So we can safely deauthorize application using 'DELETE /uid/permissions' request.

#### Changes:
To make tests more readable and a bit easier to read some methods moved to separate files:
* WebExecuter class - contains all actions performed with the Facebook page using `Puppeter`.
* GraphApi Class - contains all calls to the Facebook Graph API.

Repeating `asserts` moved outside of tests into functions.
Tests regrouped by User type. Some duplicate actions moved into `hooks`.
  
### Additional tests/functionality?
Current tests cover all possible situations, even for the user with Application `installed === true` property.
All test cases for this type of user look the same as previous tests and code duplicates because the same API used. 
One difference in them, when the user already has some permissions provided to the application,
'Facebook Permission Access' screen shows a smaller permission list
and only `signInAndNavigate` method changed in 1 row(index of the checkbox to click).


### GDPR NOTE
In our case, GDPR not applied inside the scope of the 'Facebook Login' feature.
Facebook is a Data Provider for us and using own privacy policy that allows us to use 
data provided from Facebook.
From our side, we must add `Cookie and Data collection notification` - already exists.

Some changes should be made if We use Android or IOS Facebook SDK in event tracking functions. 
For Detailed description visit [this page](https://www.facebook.com/business/m/one-sheeters/gdpr-developer-faqs)

Additional info can be found [here](https://developers.facebook.com/docs/app-events/best-practices/gdpr-compliance)
