#!/usr/bin/env node

// quickly dump specific fields for users
const { argv } = require('yargs')
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
  .option('prefix', {
    describe: 'prefix for launched users microservice',
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
  .option('criteria', {
    alias: 's',
    describe: 'sort by supplied field, defaults to original id',
  })
  .option('order', {
    describe: 'sort order',
    default: 'DESC',
    choices: ['DESC', 'ASC'],
  })
  .option('separator', {
    describe: 'separator for console output',
    default: '\t',
  })
  .option('toDate', {
    describe: 'transforms field to date',
    type: 'array',
  })
  .option('dateFormat', {
    describe: 'date transform format',
    default: 'L',
  })
  .coerce({
    filter: JSON.parse,
  })
  .demandOption(['field'], 'Please provide at least 1 field to dump')
  .help('h');

// deps
const fs = require('fs');
const Promise = require('bluebird');
const AMQPTransport = require('@microfleet/transport-amqp');
const csvWriter = require('csv-write-stream');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const moment = require('moment');
const conf = require('../lib/config');
const { USERS_USERNAME_FIELD } = require('../lib/constants');

const config = conf.get('/', { env: process.env.NODE_ENV });
const amqpConfig = omit(config.amqp.transport, ['queue', 'neck', 'listen', 'onComplete']);
const audience = argv.audience || config.jwt.defaultAudience;
const prefix = argv.prefix || config.router.routes.prefix;
const route = `${prefix}.list`;
const iterator = {
  offset: 0,
  limit: 24,
  audience,
  filter: argv.filter,
  public: argv.public,
  order: argv.order,
};

// add sorting by this
if (argv.criteria) iterator.criteria = argv.criteria;

/**
 * Get transport
 */
const getTransport = () => AMQPTransport
  .connect({ ...amqpConfig, debug: false })
  .disposer((amqp) => amqp.close());

/**
 * Output stream
 */
let output;
const headers = ['id', 'username', ...argv.field];
switch (argv.output) {
  case 'console':
    // so it's somewhat easier to read
    output = csvWriter({ headers, separator: argv.separator });
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
  const { id } = user;
  const username = (argv.username && attributes[argv.username]) || attributes[USERS_USERNAME_FIELD];

  if (argv.toDate) {
    argv.toDate.forEach((fieldName) => {
      const value = attributes[fieldName];
      if (value) {
        attributes[fieldName] = moment(value).format(argv.dateFormat);
      }
    });
  }

  output.write(Object.assign(pick(attributes, argv.field), { id, username }));
};

/**
 * List users
 */
const listUsers = (amqp) => (
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
  .catch((err) => setImmediate(() => { throw err; }));
