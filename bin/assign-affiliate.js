#!/usr/bin/env node

const assert = require('assert');
const Redis = require('ioredis').Cluster;
const { argv } = require('yargs')
  .option('id', {
    type: 'string',
    description: 'user id that is being altered',
    required: true,
  })
  .option('code', {
    type: 'string',
    description: 'referral code to assign to the user',
    required: true,
  })
  .option('overwrite', {
    type: 'boolean',
    description: 'when referral was already set - must pass to overwrite',
    default: false,
  });

(async () => {
  const conf = require('../lib/config');
  const {
    USERS_REFERRAL_INDEX,
    USERS_REFERRAL_FIELD,
    USERS_METADATA,
    USERS_ALIAS_TO_ID,
  } = require('../lib/constants');

  const handleRedisPipelineError = require('../lib/utils/pipeline-error');
  const redisKey = require('../lib/utils/key');
  const redisConfig = conf.get('/redis', { env: process.env.NODE_ENV });
  const audience = conf.get('/jwt/defaultAudience', { env: process.env.NODE_ENV });
  const opts = { ...redisConfig.options, lazyConnect: true };
  const redis = new Redis(redisConfig.hosts, opts);
  const metaKey = redisKey(argv.id, USERS_METADATA, audience);

  try {
    await redis.connect();

    // ensure that this user exists
    assert.equal(await redis.exists(metaKey), 1, 'user does not exist');

    const currentReferral = await redis.hget(metaKey, USERS_REFERRAL_FIELD);

    // ensure that referral was not already set
    if (argv.overwrite !== true) {
      assert.equal(currentReferral, null, 'referral was already set, pass --overwrite to args to force it');
    }

    // verify that referral code is valid, which is basically
    // checking whether that alias exists or not
    assert.equal(
      await redis.hexists(USERS_ALIAS_TO_ID, argv.code),
      1,
      'referral code is invalid - it does not exist'
    );

    const commands = [
      ['hset', metaKey, USERS_REFERRAL_FIELD, `"${argv.code}"`],
      ['sadd', `${USERS_REFERRAL_INDEX}:${argv.code}`, argv.id],
    ];

    if (currentReferral) {
      commands.push(['srem', `${USERS_REFERRAL_INDEX}:${JSON.parse(currentReferral)}`, argv.id]);
    }

    await redis.pipeline(commands).exec().then(handleRedisPipelineError);
  } catch (e) {
    console.error('Failed', e); // eslint-disable-line no-console
  } finally {
    redis.disconnect();
  }
})();
