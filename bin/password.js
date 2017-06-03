#!/usr/bin/env node

/* eslint-disable no-console */
const Redis = require('ioredis').Cluster;
const assert = require('assert');
const conf = require('../lib/config');

const config = conf.get('/', { env: process.env.NODE_ENV });
const redisConfig = config.redis;
const updatePassword = require('../lib/actions/updatePassword').updatePassword;

const username = process.argv[2];
const password = process.argv[3];
assert(username, 'must provide id as argv[2]');
assert(password, 'must provide password of token as argv[3]');


const redis = new Redis(redisConfig.hosts, Object.assign({}, redisConfig.options, { lazyConnect: true }));

// connection options
redis
  .connect()
  .bind({ redis })
  .return([username, password])
  .spread(updatePassword)
  .then(() => {
    console.info('\nSet password for %s to "%s"\n', username, password);
    return redis.disconnect();
  })
  .catch(err => setImmediate(() => { throw err; }));
