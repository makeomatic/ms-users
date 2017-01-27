/**
 * @api {amqp} <prefix>.token.erase Create Token
 * @apiVersion 1.0.0
 * @apiName EraseToken
 * @apiGroup Tokens
 *
 * @apiDescription This method invalidates tokens from future use. Token includes
 *  username encoded in it, so that we can recreate database keys from it for verification
 *
 * @apiParam (Payload) {String} token - token to be invalidated
 *
 */
module.exports = function eraseToken({ params }) {

};
