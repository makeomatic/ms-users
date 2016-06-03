const Promise = require('bluebird');
const pick = require('lodash/pick');
const Users = require('../db/adapter');

module.exports = function internalData(message) {
  const { fields } = message;

  return Promise
    .bind(this, message.username)
    .then(Users.getUser)
    .then(data => {
      return fields ? pick(data, fields) : data;
    });
};
