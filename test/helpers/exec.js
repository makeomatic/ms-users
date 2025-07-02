const { promisify } = require('util');
const assert = require('node:assert/strict');
const exec = promisify(require('child_process').exec);

module.exports = async (cmd) => {
  const { stderr, stdout } = await exec(cmd, {
    maxBuffer: 1024 * 1024 * 10,
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
  });
  assert(stderr.trim() === '', `Got stderr: '${stderr}'`);
  return stdout;
};
