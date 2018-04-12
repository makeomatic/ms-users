/**
 * @api {amqp} <prefix>.generate-key Generates secret key
 * @apiVersion 1.0.0
 * @apiName GenerateKey
 * @apiGroup Users
 *
 * @apiDescription Generates secret key for 2FA.
 *
 * @apiParam (Payload) {String} username - id of the user
 *
 */
module.exports = function generateKey() {
  // pass
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
