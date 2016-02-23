const Promise = require('bluebird');
const getInternalData = require('../utils/getInternalData.js');
const pick = require('lodash/pick');

module.exports = function internalData(message) {
  const { fields } = message;

  return Promise
    .bind(this, message.username)
    .then(getInternalData)
    .then(data => {
      return fields ? pick(data, fields) : data;
    });
};
