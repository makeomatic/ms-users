#!/usr/bin/env node

// quickly generates bearer for a passed username
/* eslint-disable no-console */

const { connect } = require('@microfleet/transport-amqp');
const { strict: assert } = require('assert');
const prepareConfig = require('../config');

const username = process.argv[2];
const name = process.argv[3];
assert(username, 'must provide id as argv[2]');
assert(name, 'must provide name of token as argv[3]');

(async () => {
  const store = await prepareConfig({ env: process.env.NODE_ENV });
  const config = store.get('/');
  const amqpConfig = config.amqp.transport;
  const { prefix } = config.router.routes;

  function approveSchool(amqp) {
    const message = { username, name };
    return amqp.publishAndWait(`${prefix}.token.create`, message, { timeout: 5000 });
  }

  // connection options
  const amqp = await connect(amqpConfig);
  try {
    const token = await approveSchool(amqp);
    console.info('Created token for %s with name %s:\n\n%s\n\n', username, name, token);
  } finally {
    await amqp.close();
  }
})();
