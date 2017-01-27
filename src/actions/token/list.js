/**
 * @api {amqp} <prefix>.token.list Create Token
 * @apiVersion 1.0.0
 * @apiName ListTokens
 * @apiGroup Tokens
 *
 * @apiDescription This method lists issued tokens to the passed user
 *  It only returns description of the token and the day it was last issued
 *  and accessed, not the token itself
 *
 * @apiParam (Payload) {String} username - id of the user
 *
 */
module.exports = function listTokens({ params }) {

};
