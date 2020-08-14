/* eslint-disable no-prototype-builtins */
const assert = require('assert');
const faker = require('faker');
const sinon = require('sinon');
const { createMembers } = require('../../helpers/organization');

describe('#user contacts', function registerSuite() {
  before(global.startService);
  before(async function pretest() {
    this.testUser = {
      username: faker.internet.email(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: faker.phone.phoneNumber('#########'),
    };

    const params = {
      username: this.testUser.username,
      password: '123',
      audience: '*.localhost',
    };

    await this.users.dispatch('register', { params });

    return createMembers.call(this, 1);
  });
  after(global.clearRedis);

  it('must be able to add user contact', async function test() {
    const params = {
      username: this.testUser.username,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    const response = await this.dispatch('users.contacts.add', params);
    assert(response);
    assert(response.data);
    assert(response.data.attributes);
    assert(response.data.attributes.value);
    assert(response.data.attributes.type);
    assert.strictEqual(response.data.attributes.verified, false);
    assert.strictEqual(response.data.attributes.challenge_uid, null);
  });

  it('must be able to get user contacts list', async function test() {
    const params = {
      username: this.testUser.username,
    };

    const response = await this.dispatch('users.contacts.list', params);
    assert(response);
    assert(response.data);
    response.data.forEach((contact) => {
      assert(contact);
      assert(contact.value);
      assert(contact.type);
      assert.equal(contact.verified, false);
      assert.equal(contact.challenge_uid, null);
    });
  });

  it('must be able to request contact challenge', async function test() {
    const params = {
      username: this.testUser.username,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');

    amqpStub.withArgs('phone.message.predefined')
      .resolves({ queued: true });

    const response = await this.dispatch('users.contacts.challenge', params);

    const { message } = amqpStub.args[0][1];
    const code = message.match(/^(\d{4}) is your verification code/)[1];
    amqpStub.restore();

    assert(message);
    assert(code);
    assert(response);
    assert(response.data);
    assert(response.data.attributes);
    assert.equal(response.data.attributes.value, this.testUser.phone);
    assert(response.data.attributes.type);
    assert.strictEqual(response.data.attributes.verified, false);
    assert(response.data.attributes.challenge_uid);

    this.testUser.code1 = code;
    this.testUser.challengeType = response.data.attributes.type;
    this.testUser.challengeId = response.data.attributes.challenge_uid;
  });

  it('must be able to request disposable password', async function test() {
    const params = {
      challengeType: this.testUser.challengeType,
      uid: this.testUser.challengeId,
    };

    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');

    amqpStub.withArgs('phone.message.predefined')
      .resolves({ queued: true });

    await this.dispatch('users.regenerate-token', params);

    const { message } = amqpStub.args[0][1];
    const code = message.match(/^(\d{4}) is your verification code/)[1];
    amqpStub.restore();

    assert(message);
    assert(code);

    this.testUser.code2 = code;
  });

  it('must throw error on verify contact with wrong code', async function test() {
    const params = {
      username: this.testUser.username,
      token: this.testUser.code1,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    await assert.rejects(this.dispatch('users.contacts.verify', params));
  });

  it('must throw error on verify contact with wrong phone', async function test() {
    const params = {
      username: this.testUser.username,
      token: this.testUser.code2,
      contact: {
        value: faker.phone.phoneNumber('#########'),
        type: 'phone',
      },
    };

    await assert.rejects(this.dispatch('users.contacts.verify', params));
  });

  it('must be able to verify contact', async function test() {
    const params = {
      username: this.testUser.username,
      token: this.testUser.code2,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    const response = await this.dispatch('users.contacts.verify', params);

    assert(response);
    assert(response.data);
    assert(response.data.attributes);
    assert.equal(response.data.attributes.value, this.testUser.phone);
    assert(response.data.attributes.type);
    assert.strictEqual(response.data.attributes.verified, true);
    assert(response.data.attributes.challenge_uid);
  });

  it('must be able to remove contact', async function test() {
    const params = {
      username: this.testUser.username,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    const response = await this.dispatch('users.contacts.remove', params);

    assert(response);
    const list = await this.dispatch('users.contacts.list', { username: this.testUser.username });
    assert.equal(list.data.length, 0);
  });
});
