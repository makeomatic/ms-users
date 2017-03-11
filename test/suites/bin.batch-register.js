/* global inspectPromise */

const assert = require('assert');
const path = require('path');
const { exec } = require('child_process');

describe('binary: batch-register', function suite() {
  const binaryPath = path.resolve(__dirname, '../../bin/batch-register.js');

  before(global.startService);
  after(global.clearRedis);

  it('allows to register batch users from stdin', function test(next) {
    const input = {
      common: {
        roles: ['dj'],
        extra: 'method',
        param: true,
      },
      users: [
        'Vitaly Makeomatic test@makeomatic.ru',
        ['Anthony', 'Jacobs', 'monarch@makeomatic.ru'],
      ],
    };

    // pass env to ensure we can connect
    const env = {
      // this override parent env :(
      NCONF_NAMESPACE: 'MS_USERS',
      MS_USERS__AMQP__TRANSPORT__CONNECTION__HOST: global.AMQP_OPTS.transport.connection.host,
      MS_USERS__AMQP__TRANSPORT__CONNECTION__PORT: global.AMQP_OPTS.transport.connection.port,
    };

    exec(`echo '${JSON.stringify(input)}' | ${binaryPath}`, { env }, (err, stdout) => {
      if (err) return next(err);

      const users = stdout.split('\n');
      assert.equal(users[0].indexOf('[test@makeomatic.ru] - '), 0, JSON.stringify(users));
      assert.equal(users[1].indexOf('[monarch@makeomatic.ru] - '), 0, JSON.stringify(users));

      return next();
    });
  });
});
