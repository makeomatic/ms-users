const getInternalData = require('../utils/getInternalData.js');

module.exports = function internalData(message) {
  return getInternalData.call(this, message.username);
};
