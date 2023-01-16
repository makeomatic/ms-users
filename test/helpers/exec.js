const { promisify } = require('util');
const { strict: assert } = require('assert');
const exec = promisify(require('child_process').exec);

module.exports = async (cmd) => {
  const { stderr, stdout } = await exec(cmd, {
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
  });
  assert(stderr.trim() === '', `Got stderr: '${stderr}'`);
  return stdout;
};
