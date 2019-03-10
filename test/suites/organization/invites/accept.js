// /* eslint-disable promise/always-return, no-prototype-builtins */
// const { inspectPromise } = require('@makeomatic/deploy');
// const assert = require('assert');
// const faker = require('faker');
// const { registerMembers, createOrganization } = require('../../../helpers/organization');
//
// describe('#accept invite organization', function registerSuite() {
//   this.timeout(50000);
//
//   beforeEach(global.startService);
//   beforeEach(function () { return registerMembers.call(this, 3); });
//   beforeEach(function () { return createOrganization.call(this, {}, 2); });
//   afterEach(global.clearRedis);
//
//   it('must reject invalid organization params and return detailed error', function test() {
//     return this.dispatch('users.organization.invites.accept', {})
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
//       username: this.userStubs[0].id,
//     };
//
//     await this.dispatch('users.organization.invites.accept', opts)
//       .reflect()
//       .then(inspectPromise(true));
//   });
//
//   it('must return organization not found error', async function test() {
//     const opts = {
//       name: 'Pied Piper',
//       username: faker.internet.email(),
//     };
//
//     return this.dispatch('users.organization.invites.accept', opts)
//       .reflect()
//       .then(inspectPromise(false))
//       .then((response) => {
//         assert.equal(response.name, 'HttpStatusError');
//         assert.equal(response.message, 'organization not found');
//       });
//   });
//
//   it('must return user not organization member error', async function test() {
//     const acceptOpts = {
//       name: this.organization.name,
//       username: this.userStubs[2].metadata.username,
//     };
//
//     return this.dispatch('users.organization.invites.accept', acceptOpts)
//       .reflect()
//       .then(inspectPromise(false))
//       .then((response) => {
//         assert.equal(response.name, 'HttpStatusError');
//         assert.equal(response.message, 'username not member of organization');
//       });
//   });
//
//   it('must return user not found error', async function test() {
//     const acceptOpts = {
//       name: this.organization.name,
//       username: faker.internet.email(),
//     };
//
//     return this.dispatch('users.organization.invites.accept', acceptOpts)
//       .reflect()
//       .then((response) => {
//         assert.equal(response.name, 'HttpStatusError');
//         assert.equal(response.message, 'user not found');
//       });
//   });
// });
