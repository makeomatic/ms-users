const assert = require('assert');
const hook = require('../../src/custom/rfx-create-room-on-activate');
const sinon = require('sinon');
const Promise = require('bluebird');

describe('Hook `rfx-create-room-on-activate`', function suite() {
  before(function start() {
    return global.startService.call(this, {
      hooks: { 'users:activate': hook },
    });
  });
  after(global.clearRedis);

  it('should be able to create room after register', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const room = {
      id: 'ee39afd6-b99a-47d0-a43b-a942cfd5451f',
      name: 'Bar Station | Foo Scool',
      createdBy: 'foo@gmail.com',
    };

    amqpStub.withArgs('chat.internal.rooms.create')
      .returns(Promise.resolve(room));

    return this.dispatch('users.invite', {
        email: 'foo@gmail.com',
        ctx: {
          firstName: 'Foo',
          lastName: 'Bar',
        },
        metadata: {
          '*.localhost': {
            scool: 'Foo Scool',
            station: 'Bar Station',
          },
        },
      })
      .reflect()
      .then(inspectPromise())
      .then(result => {
        assert.ok(result.context.token.secret);

        return this.dispatch('users.register', {
          username: 'foo@gmail.com',
          password: '123',
          inviteToken: result.context.token.secret,
          audience: '*.localhost',
        });
      })
      .reflect()
      .then(inspectPromise())
      .then(result => {
        const stubArgs = amqpStub.args[0];
        assert.equal(stubArgs[0], 'chat.internal.rooms.create');
        assert.deepEqual(stubArgs[1], { name: room.name, createdBy: room.createdBy });

        assert.equal(result.user.username, 'foo@gmail.com');
        assert.equal(
          result.user.metadata['*.localhost'].roomId,
          'ee39afd6-b99a-47d0-a43b-a942cfd5451f'
        );

        amqpStub.restore();
      });
  });
});
