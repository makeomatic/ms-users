const { promisify } = require('util');
const assert = require('assert');
const exec = promisify(require('child_process').exec);

module.exports = async (cmd) => {
  const { stderr, stdout } = await exec(cmd);
  assert(stderr.trim() === '');
  return stdout;
};
