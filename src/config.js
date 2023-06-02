const { Store } = require('ms-conf');
const path = require('path');

module.exports = async function prepareConfiguration(defaultOpts = {}) {
  const store = new Store({ defaultOpts });
  store.prependDefaultConfiguration(path.resolve(__dirname, './configs'));
  await store.ready();

  return store;
};
