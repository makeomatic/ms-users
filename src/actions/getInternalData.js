const Promise = require('bluebird');
const { getInternalData } = require('../utils/userData');
const pick = require('lodash/pick');

/**
 * @api {amqp} <prefix>.getInternalData Retrieve Internal Data
 * @apiVersion 1.0.0
 * @apiName getInternalData
 * @apiGroup Users
 *
 * @apiDescription Could be used to retrieve optionally filtered internal data, including password hashes, aliases, time
 * user was registered and so on. This should be used by internal microservices. Direct access to this method must not be
 * granted to the users
 *
 * @apiParam (Payload) {String} username - user's username
 * @apiParam (Payload) {String[]} [fields] - return only these fields of user's internal data
 *
 */
module.exports = function internalData({ params }) {
  const { fields } = params;

  return Promise
    .bind(this, params.username)
    .then(getInternalData)
    .then(data => (
      fields ? pick(data, fields) : data
    ));
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
