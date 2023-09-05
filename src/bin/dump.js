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
  .option('chunk', {
    describe: 'which field to take for chunking',
  })
  .option('chunk-op', {
    describe: 'which operation to use for chunking',
    choices: ['gt', 'lt'],
  })
  .coerce({
    filter: JSON.parse,
  })
  .demandOption(['field'], 'Please provide at least 1 field to dump')
  .help('h');

// deps
const fs = require('fs');
const { connect } = require('@microfleet/transport-amqp');
const csvWriter = require('csv-write-stream');
const omit = require('lodash/omit');
const moment = require('moment');
const assert = require('node:assert');
const { once } = require('node:events');
const SonicBoom = require('sonic-boom');
const getStore = require('../config');
const { USERS_USERNAME_FIELD } = require('../constants');

(async () => {
  const store = await getStore({ env: process.env.NODE_ENV });
  const config = store.get('/');
  const amqpConfig = omit(config.amqp.transport, ['queue', 'neck', 'listen', 'onComplete']);
  const audience = argv.audience || config.jwt.defaultAudience;
  const prefix = argv.prefix || config.router.routes.prefix;
  const route = `${prefix}.list`;
  const iterator = {
    offset: 0,
    limit: 100,
    audience,
    filter: argv.filter,
    public: argv.public,
    order: argv.order,
  };

  // add sorting by this
  if (argv.criteria) iterator.criteria = argv.criteria;
  if (argv.chunk) {
    assert.equal(iterator.criteria, argv.chunk, 'must sort results on the same field as argv.chunk');
  }

  /**
   * Get transport
   */
  const getTransport = () => connect({ ...amqpConfig, debug: false });

  /**
 * Output stream
 * @type {NodeJS.WritableStream}
 */
  let output;
  const headers = ['id', 'username', ...argv.field];
  switch (argv.output) {
    case 'console':
      // so it's somewhat easier to read
      output = csvWriter({ headers, separator: argv.separator });
      output.pipe(new SonicBoom({ fd: process.stdout.fd }));
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

  const extractUsername = argv.username
    ? (attributes) => attributes[argv.username] || attributes[USERS_USERNAME_FIELD]
    : (attributes) => attributes[USERS_USERNAME_FIELD];

  const transformDate = argv.toDate && argv.dateFormat
    ? (attributes) => {
      for (const fieldName of argv.toDate) {
        const value = attributes[fieldName];
        if (value) {
          attributes[fieldName] = moment(value).format(argv.dateFormat);
        }
      }
    }
    : () => { };

  const prepareWriteObject = (id, username, attributes) => {
    const writeObj = {
      id,
      username,
    };

    for (const field of argv.field) {
      writeObj[field] = attributes[field];
    }

    return writeObj;
  };

  /**
   * Writing user to output
   */
  const writeUserToOutput = (user) => {
    const attributes = user.metadata[audience];
    const { id } = user;
    const username = extractUsername(attributes);

    transformDate(attributes);

    return output.write(prepareWriteObject(id, username, attributes));
  };

  /**
   * List users
   */
  const listUsers = async (amqp) => {
    const data = await amqp.publishAndWait(route, iterator, { timeout: 30000 });
    const { users, page, pages, cursor: baseCursor } = data;

    output.cork();
    for (const user of users) {
      if (!writeUserToOutput(user)) {
        output.uncork();
        // eslint-disable-next-line no-await-in-loop
        await once(output, 'drain');
        output.cork();
      }
    }
    output.uncork();

    // prepare for next iteration
    if (page < pages) {
      if (argv.chunk) {
        const cursor = users.at(-1).metadata[audience][argv.chunk];
        iterator.filter[argv.chunk] = { [argv['chunk-op']]: cursor };
      } else {
        iterator.offset = baseCursor;
      }
      return listUsers(amqp);
    }

    return output.end();
  };

  const amqp = await getTransport();
  try {
    await listUsers(amqp);
  } catch (err) {
    console.error(err);
    output.end();
    process.exit(128);
  } finally {
    await amqp.close();
  }
})();
