# Facebook OAuth tests change

## Overview and Motivation
After some updates Facebook Graph API throttling mechanisms, OAuth tests started failing randomly with 403 code or
`invalid credentials` ms-users error.
 
Graph API limits requests by a sliding window algorithm, which allows some(not all) requests even after block.

Over-usage of Graph API request time was generally caused by `createTestUser` API calls that caused 403 error with
headers `{ x-app-usage: { total_time: > 100 }}`. Direct API calls throw this error, but `@hapi/bell` -> `@hapi/wreck`
not raised that error to the service and this seemed like a random floating error in test suites.

## Solution
Exclude long-running `createTestUser` operation from tests and reuse test users.

Now tests execute all suites with only 2 users:
 * 1 User without any permissions provided to Application.
 * 1 User with granted partial permissions to Application.

When the test starts:
 * Create test users.
 * Perform testing on all suites.
 * After each suite, revokes user's permissions from APP.
When all tests successful, deletes test users.
 
 
