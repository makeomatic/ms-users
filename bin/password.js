#!/usr/bin/env node

/* eslint-disable no-console */
const Redis = require('ioredis');
const assert = require('assert');
const conf = require('../lib/config');
const { updatePassword } = require('../lib/actions/updatePassword');

const config = conf.get('/', { env: process.env.NODE_ENV });

const initRedis = (redisConfig) => {
  const opts = {
    lazyConnect: true,
    ...redisConfig.options,
  };

  if (redisConfig.sentinels) {
    opts.name = redisConfig.name;
    opts.sentinels = redisConfig.sentinels;
    return new Redis(opts);
  }

  return new Redis.Cluster(redisConfig.hosts, opts);
};

const redis = initRedis(config.redis);

// connection options
const main = async (username, password) => {
  assert(username, 'must provide user id');
  assert(password, 'must provide password');

  try {
    await redis.connect();
    await updatePassword({ redis }, username, password);
  } catch (err) {
    setImmediate(() => {
      throw err;
    });
  } finally {
    await redis.disconnect();
  }
};

if (module.parent === null) {
  const username = process.argv[2];
  const password = process.argv[3];
  assert(username, 'must provide id as argv[2]');
  assert(password, 'must provide password of token as argv[3]');

  // eslint-disable-next-line promise/catch-or-return
  main(username, password)
    .then(() => {
      console.info('\nSet password for %s to "%s"\n', username, password);
      return null;
    });
}

exports.main = main;
