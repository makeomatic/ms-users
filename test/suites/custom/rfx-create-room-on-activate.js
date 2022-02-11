const _ = require('lodash');
const { strict: assert } = require('assert');
const Promise = require('bluebird');
const sinon = require('sinon').usingPromise(Promise);
const hook = require('../../../src/custom/rfx-create-room-on-activate');

describe('Hook `rfx-create-room-on-activate`', function suite() {
  before(_.partial(global.startService, { hooks: { 'users:activate': hook } }));
  after(global.clearRedis);

  it('should be able to create room after register', async function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const room = {
      id: 'ee39afd6-b99a-47d0-a43b-a942cfd5451f',
      name: 'Bar Station | Foo Scool',
    };

    amqpStub
      .withArgs('chat.internal.rooms.create')
      .resolves(room);

    const result = await this.users.dispatch('invite', { params: {
      email: 'foo@gmail.com',
      ctx: {
        firstName: 'Foo',
        lastName: 'Bar',
      },
      metadata: {
        '*.localhost': {
          stationSchool: 'Foo Scool',
          stationName: 'Bar Station',
        },
      },
    } });

    assert.ok(result.context.token.secret);

    const res2 = await this.users.dispatch('register', { params: {
      username: 'foo@gmail.com',
      password: '123',
      inviteToken: result.context.token.secret,
      audience: '*.localhost',
    } });

    const stubArgs = amqpStub.args[0];

    assert.equal(stubArgs[0], 'chat.internal.rooms.create');
    assert.deepEqual(stubArgs[1], { name: room.name, createdBy: res2.user.id });

    assert.ok(res2.user.id);
    assert.equal(res2.user.metadata['*.localhost'].username, 'foo@gmail.com');
    assert.equal(
      res2.user.metadata['*.localhost'].stationChatId,
      'ee39afd6-b99a-47d0-a43b-a942cfd5451f'
    );

    amqpStub.restore();
  });
});
