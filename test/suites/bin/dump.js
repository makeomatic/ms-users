const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { startService, clearRedis, initFakeAccounts } = require('../../config');
const exec = require('../../helpers/exec');
const { redisIndexDefinitions } = require('../../configs/redis-indexes');

describe('binary: dump', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../src/bin/dump.js');

  const ctx = {
    redisSearch: {
      enabled: true,
    },
    redisIndexDefinitions,
  };

  before(async function init() {
    await startService.call(this, ctx);
  });
  before('register fake users', initFakeAccounts);
  after('stop service & clean db', clearRedis);

  // 103 is the amount of fake users generated

  it('dumps 103 fake users to console', async () => {
    const stdout = await exec(`${binaryPath} -f firstName lastName`);

    const lines = stdout.split('\n');
    const headers = lines[0];
    const data = lines.slice(1, -1);

    assert.equal(headers, 'id\tusername\tfirstName\tlastName');
    assert.equal(data.length, 103);
  });

  it('dumps 103 fake users to csv file', async () => {
    const stdout = await exec(`${binaryPath} -f firstName lastName -o csv`);

    const stdoutLines = stdout.split('\n');
    const filename = stdoutLines[0].split('"')[1];

    assert.ok(/\/dump-\d+\.csv$/, filename, `filename ${filename} doesnt match format`);
    const file = fs.readFileSync(filename, 'utf8');

    const lines = file.split('\n');
    const headers = lines[0];
    const data = lines.slice(1, -1);

    assert.equal(headers, 'id,username,firstName,lastName');
    assert.equal(data.length, 103);
  });

  it('is able to use filter, users generated are random, so cant know for sure whats returned', async () => {
    const cmd = `${binaryPath} -f firstName lastName -o csv --filter '${JSON.stringify({
      username: '@yahoo.com',
    })}'`;

    const stdout = await exec(cmd);
    const stdoutLines = stdout.split('\n');
    const filename = stdoutLines[0].split('"')[1];

    assert.ok(/\/dump-\d+\.csv$/, filename, `filename ${filename} doesnt match format`);
    const file = fs.readFileSync(filename, 'utf8');

    const lines = file.split('\n');
    const headers = lines[0];
    const data = lines.slice(1, -1);

    assert.equal(headers, 'id,username,firstName,lastName');
    assert.ok(data.length < 103);

    data.forEach((it) => {
      assert.ok(/@yahoo\.com/.test(it), `${it} doesnt have yahoo.com`);
    });
  });

  it('is able to use transform toDate', async () => {
    const stdout = await exec(`${binaryPath} -f firstName -f created --toDate created`);
    const stdoutLines = stdout.split('\n');
    const headers = stdoutLines[0];
    const data = stdoutLines.slice(1, -1);

    assert.equal(headers, 'id\tusername\tfirstName\tcreated');
    data.forEach((line) => {
      const created = line.split(/\t/)[3];
      assert.ok(/^\d{2}\/\d{2}\/\d{4}$/.test(created));
    });
  });

  it('is able to use chunking', async () => {
    const stdout = await exec(`${binaryPath} -f firstName -f created -f aa --toDate created --criteria aa --chunk aa --chunk-op gt`);
    const stdoutLines = stdout.split('\n');
    const headers = stdoutLines[0];
    const data = stdoutLines.slice(1, -1);

    assert.equal(headers, 'id\tusername\tfirstName\tcreated\taa');
    data.forEach((line) => {
      const created = line.split(/\t/)[3];
      assert.ok(/^\d{2}\/\d{2}\/\d{4}$/.test(created));
    });
  });
});
