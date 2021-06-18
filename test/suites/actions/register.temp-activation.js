const { delay } = require('bluebird');
const { rejects, strict: assert } = require('assert');

const Users = require('../../../src');

describe('register: temporary activated users', function suite() {
  const service = new Users({
    temporaryActivation: {
      enabled: true,
      validTimeMs: 3 * 1000,
    },
    token: {
      email: {
        throttle: 1, // for creating token for activation without error in test
      },
    },
  });

  before(() => service.connect());
  after(async () => {
    if (service.redisType === 'redisCluster') {
      await Promise.all(
        service.redis.nodes('master').map((node) => node.flushdb())
      );
    } else {
      await service.redis.flushdb();
    }
  });
  after(() => service.close());

  it('should be able to login after register and send activation email', async () => {
    const { amqp, redis } = service;

    const data = await amqp.publishAndWait('users.register', {
      username: 'perchik@gmail.com',
      password: 'perchikisnotfatcat',
      alias: 'perchik2000',
      activate: false,
      audience: 'tikkothouse',
    });
    const redisData = await redis.hgetall(`${data.user.id}!data`);
    const redisMeta = await redis.hgetall(`${data.user.id}!metadata!*.localhost`);

    assert(data.jwt.length !== undefined);
    assert(data.user.id !== undefined);
    assert(data.user.metadata.tikkothouse !== undefined);
    assert(data.user.metadata['*.localhost'].id !== undefined);
    assert(data.user.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data.user.metadata['*.localhost'].created !== undefined);
    assert(data.user.metadata['*.localhost'].alias === 'perchik2000');
    assert(data.user.metadata['*.localhost'].aa === undefined);

    assert(redisData.tempActivatedTime !== undefined);
    assert(redisData.username === 'perchik@gmail.com');
    assert(redisData.active === 'false');
    assert(redisData.password !== undefined);
    assert(redisData.alias === 'perchik2000');
    assert(redisData.created !== undefined);

    assert(redisMeta.id !== undefined);
    assert(redisMeta.username === '"perchik@gmail.com"');
    assert(redisMeta.created !== undefined);
    assert(redisMeta.alias === '"perchik2000"');
    assert(redisMeta.aa === undefined);

    assert(await redis.ttl(`${data.user.id}!data`) === -1);

    assert(await redis.hget('users-alias', 'perchik2000') === data.user.id);

    assert(await redis.sismember('user-iterator-set', data.user.id) === 1);

    assert(await redis.exists('tmanager!1.0.0activate!perchik@gmail.com') === 1);

    // @todo assert that email has been sent
  });

  // depends on previous test
  it('should be able to login and verify', async () => {
    const { amqp } = service;

    const data0 = await amqp.publishAndWait('users.login', {
      username: 'perchik@gmail.com',
      password: 'perchikisnotfatcat',
      audience: '*.localhost',
    });

    assert(data0.jwt.length !== undefined);
    assert(data0.user.id !== undefined);
    assert(data0.user.metadata['*.localhost'].id !== undefined);
    assert(data0.user.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data0.user.metadata['*.localhost'].created !== undefined);
    assert(data0.user.metadata['*.localhost'].alias === 'perchik2000');
    assert(data0.user.metadata['*.localhost'].aa === undefined);
    assert(data0.mfa === false);

    const data1 = await amqp.publishAndWait('users.verify', {
      token: data0.jwt,
      audience: '*.localhost',
    });

    assert(data1.id !== undefined);
    assert(data1.metadata['*.localhost'].id !== undefined);
    assert(data1.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data1.metadata['*.localhost'].created !== undefined);
    assert(data1.metadata['*.localhost'].alias === 'perchik2000');
    assert(data1.metadata['*.localhost'].aa === undefined);
    assert(data1.mfa === false);

    this.jwt = data0.jwt;
  });

  // depends on previous test
  it('should be able to login or verify if temporary activation time is over', async () => {
    const { amqp } = service;

    await delay(3 * 1000); // time from config

    await rejects(
      amqp.publishAndWait('users.login', {
        username: 'perchik@gmail.com',
        password: 'perchikisnotfatcat',
        audience: '*.localhost',
      }),
      /Account hasn't been activated/
    );

    await rejects(
      amqp.publishAndWait('users.verify', {
        token: this.jwt,
        audience: '*.localhost',
      }),
      /Account hasn't been activated/
    );
  });

  // depends on previous test
  it('should be able to activate temporary activated account', async () => {
    const { amqp, redis } = service;
    // @todo get token from email
    const { secret } = await service.tokenManager.create({
      id: 'perchik@gmail.com',
      action: 'activate',
    });

    const data = await amqp.publishAndWait('users.activate', { token: secret });
    const redisData = await redis.hgetall(`${data.user.id}!data`);
    const redisMeta = await redis.hgetall(`${data.user.id}!metadata!*.localhost`);

    assert(data.jwt.length !== undefined);
    assert(data.user.id !== undefined);
    assert(data.user.metadata['*.localhost'].id !== undefined);
    assert(data.user.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data.user.metadata['*.localhost'].created !== undefined);
    assert(data.user.metadata['*.localhost'].alias === 'perchik2000');
    assert(data.user.metadata['*.localhost'].aa !== undefined);

    assert(redisData.tempActivatedTime === undefined);
    assert(redisData.username === 'perchik@gmail.com');
    assert(redisData.active === 'true');
    assert(redisData.password !== undefined);
    assert(redisData.alias === 'perchik2000');
    assert(redisData.created !== undefined);

    assert(redisMeta.id !== undefined);
    assert(redisMeta.username === '"perchik@gmail.com"');
    assert(redisMeta.created !== undefined);
    assert(redisMeta.alias === '"perchik2000"');
    assert(redisMeta.aa !== undefined);
  });

  // depends on previous test
  it('should be able to login and verify (includes old token)', async () => {
    const { amqp } = service;

    const data0 = await amqp.publishAndWait('users.login', {
      username: 'perchik@gmail.com',
      password: 'perchikisnotfatcat',
      audience: '*.localhost',
    });

    assert(data0.jwt.length !== undefined);
    assert(data0.user.id !== undefined);
    assert(data0.user.metadata['*.localhost'].id !== undefined);
    assert(data0.user.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data0.user.metadata['*.localhost'].created !== undefined);
    assert(data0.user.metadata['*.localhost'].alias === 'perchik2000');
    assert(data0.user.metadata['*.localhost'].aa !== undefined);
    assert(data0.mfa === false);

    const data1 = await amqp.publishAndWait('users.verify', {
      token: data0.jwt,
      audience: '*.localhost',
    });

    assert(data1.id !== undefined);
    assert(data1.metadata['*.localhost'].id !== undefined);
    assert(data1.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data1.metadata['*.localhost'].created !== undefined);
    assert(data1.metadata['*.localhost'].alias === 'perchik2000');
    assert(data1.metadata['*.localhost'].aa !== undefined);
    assert(data1.mfa === false);

    const data2 = await amqp.publishAndWait('users.verify', {
      token: this.jwt,
      audience: '*.localhost',
    });

    assert(data2.id !== undefined);
    assert(data2.metadata['*.localhost'].id !== undefined);
    assert(data2.metadata['*.localhost'].username === 'perchik@gmail.com');
    assert(data2.metadata['*.localhost'].created !== undefined);
    assert(data2.metadata['*.localhost'].alias === 'perchik2000');
    assert(data2.metadata['*.localhost'].aa !== undefined);
    assert(data2.mfa === false);
  });

  it('should be able to activate temporary activated user immediately', async () => {
    const { amqp } = service;

    const data0 = await amqp.publishAndWait('users.register', {
      username: 'perchik3000@gmail.com',
      password: 'perchikisnotfatcat',
      alias: 'perchik3000',
      activate: false,
      audience: 'tikkothouse',
    });

    assert(data0.user.metadata['*.localhost'].aa === undefined);

    // for creating token for activation without error
    await delay(1000);
    // @todo get token from email
    const { secret } = await service.tokenManager.create({
      id: 'perchik3000@gmail.com',
      action: 'activate',
    });
    const data1 = await amqp.publishAndWait('users.activate', { token: secret });

    assert(data1.user.metadata['*.localhost'].aa !== undefined);
  });
});
