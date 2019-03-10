// /* eslint-disable promise/always-return, no-prototype-builtins */
// const { inspectPromise } = require('@makeomatic/deploy');
// const assert = require('assert');
// const { registerMembers, createOrganization } = require('../../../helpers/organization');
//
// describe('#send invite organization', function registerSuite() {
//   this.timeout(50000);
//
//   beforeEach(global.startService);
//   beforeEach(function () { return registerMembers.call(this, 2); });
//   beforeEach(function () { return createOrganization.call(this, {}, 0); });
//   afterEach(global.clearRedis);
//
//   it('must reject invalid organization params and return detailed error', function test() {
//     return this.dispatch('users.organization.invites.send', {})
//       .reflect()
//       .then(inspectPromise(false))
//       .then((response) => {
//         assert.equal(response.name, 'HttpStatusError');
//         assert.equal(response.errors.length, 2);
//       });
//   });
//
//   it('must be able to add member to organization', async function test() {
//     const opts = {
//       name: this.organization.name,
//     };
//     const member = this.userNames[0];
//
//     return this.dispatch('users.organization.invites.send', { ...opts, ...member })
//       .reflect()
//       .then(inspectPromise(true))
//       .then((createdOrganization) => {
//         assert(createdOrganization.name === opts.name);
//         assert(createdOrganization.members.length === 1);
//       });
//   });
//
//   it('must return organization not found error', async function test() {
//     const opts = {
//       name: 'Pied Piper',
//     };
//
//     return this.dispatch('users.organization.invites.send', opts)
//       .reflect()
//       .then(inspectPromise(false))
//       .then((response) => {
//         assert.equal(response.name, 'HttpStatusError');
//       });
//   });
// });
