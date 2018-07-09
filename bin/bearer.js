#!/usr/bin/env node

// quickly generates bearer for a passed username
/* eslint-disable no-console */

const conf = require('../lib/config');
const AMQPTransport = require('@microfleet/transport-amqp');
const assert = require('assert');

const config = conf.get('/', { env: process.env.NODE_ENV });
const amqpConfig = config.amqp.transport;
const { prefix } = config.router.routes;

const username = process.argv[2];
const name = process.argv[3];
assert(username, 'must provide id as argv[2]');
assert(name, 'must provide name of token as argv[3]');

function approveSchool(amqp) {
  const message = { username, name };
  return amqp.publishAndWait(`${prefix}.token.create`, message, { timeout: 5000 });
}

// connection options
AMQPTransport
  .connect(amqpConfig)
  .then(amqp => approveSchool(amqp).tap(() => amqp.close()))
  .then((token) => {
    console.info('Created token for %s with name %s:\n\n%s\n\n', username, name, token);
    return process.exit();
  })
  .catch((err) => {
    setImmediate(() => { throw err; });
  });
