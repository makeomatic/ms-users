const Promise = require('bluebird');
const getInternalData = require('../utils/getInternalData.js');

module.exports = function internalData(message) {
  return Promise
    .bind(this, message.username)
    .then(getInternalData);
};
