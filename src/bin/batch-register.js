#!/usr/bin/env node

// quickly registers users from CLI
/* eslint-disable no-console */

const is = require('is');
const Promise = require('bluebird');
const assert = require('node:assert/strict');
const { connect } = require('@microfleet/transport-amqp');
const getStdin = require('get-stdin');
const omit = require('lodash/omit');
const defaults = require('lodash/defaults');
const gen = require('password-generator');

const getStore = require('../config');
const { CHALLENGE_TYPE_EMAIL } = require('../constants');

/**
 * Registers batch users from stdin
 */
async function registerUsers(users) {
  const store = await getStore({ env: process.env.NODE_ENV });
  const config = store.get('/');
  const amqpConfig = omit(config.amqp.transport, ['queue', 'neck', 'listen', 'onComplete']);
  const audience = config.jwt.defaultAudience;
  const { prefix } = config.router.routes;

  const amqp = await connect({ ...amqpConfig, debug: false });
  try {
    await Promise.map(users, (user) => (
      amqp.publishAndWait(`${prefix}.register`, { ...user, audience }, { timeout: 5000 })
    ), { concurrency: 50 });
  } finally {
    await amqp.close();
  }

  return users;
}

// read data from stdin
getStdin()
  .then((input) => JSON.parse(input))
  .then((info) => {
    assert.equal(typeof info.common, 'object');
    assert.ok(Array.isArray(info.users));
    assert.ok(info.users.length > 0);

    return info.users.map((user) => {
      const data = is.string(user)
        ? user.split(/\s/g)
        : user;

      const [firstName, lastName, username] = data;

      assert.ok(firstName);
      assert.ok(lastName);
      assert.ok(username);

      return {
        username,
        password: gen(6),
        metadata: defaults({ firstName, lastName }, info.common),
        activate: true,
        challengeType: CHALLENGE_TYPE_EMAIL,
        skipPassword: false,
      };
    });
  })
  .then(registerUsers)
  .then((users) => (
    users.forEach((user) => (
      console.info('[%s] - %s', user.username, user.password)
    ))
  ))
  .then(() => {
    return process.exit();
  })
  .catch((err) => {
    console.info(err);
    setImmediate(() => { throw err; });
  });
