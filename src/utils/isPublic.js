/**
 * Created by Stainwoortsel on 03.07.2016.
 */
const get = require('lodash/get');
const { ModelError, ERR_USERNAME_NOT_FOUND } = require('../model/modelError');
const { USERS_ALIAS_FIELD } = require('../constants.js');

module.exports = function isPublic(username, audiences) {
  return metadata => {
    let notFound = true;

    // iterate over passed audiences
    audiences.forEach(audience => {
      if (notFound && get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
        notFound = false;
      }
    });

    if (notFound) {
      throw new ModelError(ERR_USERNAME_NOT_FOUND);
    }
  };
};

