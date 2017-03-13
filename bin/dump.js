#!/usr/bin/env node

// quickly dump specific fields for users
const argv = require('yargs')
  .option('field', {
    alias: 'f',
    describe: 'fields to dump',
    type: 'array',
  })
  .option('username', {
    alias: 'u',
    describe: 'custom field to treat as username',
    default: null,
  })
  .option('output', {
    alias: 'o',
    describe: 'output for the data',
    default: 'console',
    choices: ['console', 'csv'],
  })
  .option('filter', {
    describe: 'filter users - pass stringified JSON',
    default: '{}',
  })
  .option('public', {
    describe: 'list public users or not',
    default: false,
  })
  .option('audience', {
    describe: 'audience to fetch data from',
  })
  .coerce({
    filter: JSON.parse,
  })
  .demandOption(['field'], 'Please provide at least 1 field to dump')
  .help('h')
  .argv;

// deps
const fs = require('fs');
const Promise = require('bluebird');
const conf = require('ms-conf');
const AMQPTransport = require('ms-amqp-transport');
const csvWriter = require('csv-write-stream');
const merge = require('lodash/merge');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const defaultOpts = require('../lib/config');

const config = merge({}, defaultOpts, conf.get('/'));
const amqpConfig = omit(config.amqp.transport, ['queue', 'neck', 'listen', 'onComplete']);
const audience = argv.audience || config.jwt.defaultAudience;
const prefix = config.router.routes.prefix;
const route = `${prefix}.list`;
const iterator = {
  offset: 0,
  limit: 24,
  audience,
  filter: argv.filter,
  public: argv.public,
};

/**
 * Get transport
 */
const getTransport = () => AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());

/**
 * Output stream
 */
let output;
const headers = ['id', ...argv.field];
switch (argv.output) {
  case 'console':
    // so it's somewhat easier to read
    output = csvWriter({ headers, separator: '\t' });
    output.pipe(process.stdout);
    break;

  case 'csv': {
    const filename = `${process.cwd()}/dump-${Date.now()}.csv`;
    process.stdout.write(`Writing to "${filename}"\n`);

    output = csvWriter({ headers });
    output.pipe(fs.createWriteStream(filename));
    break;
  }

  default:
    throw new Error('unknown output');
}

/**
 * Writing user to output
 */
const writeUserToOutput = (user) => {
  const attributes = user.metadata[audience];
  const id = (argv.username && attributes[argv.username]) || user.id;
  output.write(Object.assign(pick(attributes, argv.field), { id }));
};

/**
 * List users
 */
const listUsers = amqp => (
  amqp
    .publishAndWait(route, iterator, { timeout: 5000 })
    .then((data) => {
      data.users.forEach(writeUserToOutput);

      // prepare for next iteration
      if (data.page < data.pages) {
        iterator.offset = data.cursor;
        return listUsers(amqp);
      }

      return output.end();
    })
);

Promise
  .using(getTransport(), listUsers)
  .catch((err) => {
    setImmediate(() => { throw err; });
  });
