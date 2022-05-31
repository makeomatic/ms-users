/* eslint-disable no-prototype-builtins */
const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
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

    const response = await this.users.dispatch('contacts.add', { params });
    assert(response);
    assert(response.data);
    assert(response.data.attributes);
    assert(response.data.attributes.value);
    assert(response.data.attributes.type);
    assert.strictEqual(response.data.attributes.verified, false);
  });

  it('must be able to get user contacts list', async function test() {
    const params = {
      username: this.testUser.username,
    };

    const response = await this.users.dispatch('contacts.list', { params });
    assert(response);
    assert(response.data);
    response.data.forEach((contact) => {
      assert(contact);
      assert(contact.value);
      assert(contact.type);
      assert.equal(contact.verified, false);
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

    const response = await this.users.dispatch('contacts.challenge', { params });

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

    await this.users.dispatch('regenerate-token', { params });

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

    await assert.rejects(this.users.dispatch('contacts.verify', { params }));
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

    await assert.rejects(this.users.dispatch('contacts.verify', { params }));
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

    const response = await this.users.dispatch('contacts.verify', { params });

    assert(response);
    assert(response.data);
    assert(response.data.attributes);
    assert.equal(response.data.attributes.value, this.testUser.phone);
    assert(response.data.attributes.type);
    assert.strictEqual(response.data.attributes.verified, true);
  });

  it('must be able to remove contact', async function test() {
    const params = {
      username: this.testUser.username,
      contact: {
        value: this.testUser.phone,
        type: 'phone',
      },
    };

    const response = await this.users.dispatch('contacts.remove', { params });

    assert(response);
    const list = await this.users.dispatch('contacts.list', { params: { username: this.testUser.username } });
    assert.equal(list.data.length, 0);
  });

  it('must be able to add user contact with skipChallenge, onlyOneVerifiedEmail', async function test() {
    const params = {
      username: this.testUser.username,
      skipChallenge: true,
      contact: {
        value: 'nomail@example.com',
        type: 'email',
      },
    };

    const { data: { attributes: { value, verified } } } = await this.users.dispatch('contacts.add', { params });
    assert.equal(value, params.contact.value);
    assert.strictEqual(verified, true);

    const params2 = {
      username: this.testUser.username,
      skipChallenge: true,
      contact: {
        value: 'nomail2@example.com',
        type: 'email',
      },
    };

    const { data: { attributes } } = await this.users.dispatch('contacts.add', { params: params2 });
    assert.equal(attributes.value, params2.contact.value);
    assert.strictEqual(attributes.verified, true);

    const { data } = await this.users.dispatch('contacts.list', { params: { username: this.testUser.username } });
    assert.equal(data.length, 1);
    assert.strictEqual(data[0].verified, true);
    assert.equal(data[0].value, params2.contact.value);
  });

  it('should validate email', async function test() {
    const sendMailPath = 'mailer.predefined';
    const params = {
      username: this.testUser.username,
      contact: {
        value: 'nomail@example.com',
        type: 'email',
      },
    };

    await this.users.dispatch('contacts.add', { params });

    const amqpStub = sinon.stub(this.users.amqp, 'publish');

    amqpStub.withArgs(sendMailPath)
      .resolves({ queued: true });

    await this.users.dispatch('contacts.challenge', { params });
    const { args: [[path, { ctx: { template: { token: { secret } } } }]] } = amqpStub;
    assert.equal(path, sendMailPath);

    const { data: { attributes: { value, verified } } } = await this.users.dispatch('contacts.verify-email', { params: { secret } });

    assert.equal(value, params.contact.value);
    assert.strictEqual(verified, true);
    amqpStub.restore();
  });
});
