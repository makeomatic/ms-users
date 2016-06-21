const Promise = require('bluebird');
const pick = require('lodash/pick');
const { User } = require('../model/usermodel');

module.exports = function internalData(message) {
  const { fields } = message;

  return Promise
    .bind(this, message.username)
    .then(User.getOne)
    .then(data => {
      return fields ? pick(data, fields) : data;
    });
};
