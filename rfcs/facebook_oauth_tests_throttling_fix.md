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

#### Tests `Missing Credentials` Error
Mishandling `@hapi/boom` error causes the OAuth strategy to continue its execution but without mandatory `credentials` and this caused the random tests to fail.

###### Solution
Implement additional error conversion from `@boom/error` to general `HTTPError`. 
This return OAuth's error processing to normal behavior.
 
#### Tests `403 - Application throttled` Error
Before every test, some direct GraphApi calls made. In some `throttling` conditions requests rejected with `403` Error,
this happens because of Facebook call Throttling. 

##### Overall Graph API over-usage
Over-usage of Graph API request time produced by `createTestUser` API calls, this API call uses a lot of API's execution time and increments Facebook's counters fast.
Before every test, we execute `createTestUser`  3*testCount times, so each suite execution performs about 39 long-running calls. 
Facebook Graph API starts throttling requests after 4-6 suite runs.

###### Solution
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

##### Projected Change
If `installed` set to true then facebook tries to request access only `email` permission in all tests,
so `signinAndNavigate` should be updated to match DOM.

Revoking application permissions in this case working partially, but breaks service behavior.
Service rejecting requests with `Missing credential` errors.
The only solution is to recreate the partial user before every test.

### Additional tests/functionality?
`partial` tests must cover the situation, when the user already installed application, but revoked `email` permissions.
In this condition service dropping requests with 'Missing permissions' and not trying to reRequest them.
So should we add additional tests and functionality?

