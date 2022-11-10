const { ActionTransport } = require('@microfleet/plugin-router');

const { USERS_WALLET_ADD, WALLET_INDEX } = require('../constants');

/**
 * @api {amqp} <prefix>.add-wallet Save User Nft Wallet
 * @apiVersion 1.0.0
 * @apiName addwallet
 * @apiGroup Users
 *
 * @apiDescription Add nft wallet address to user account
 *
 * @apiParam (Payload) {Object} address - wallet address
 * @apiParam (Payload) {Object} sign - signed nft message
 *
 */
module.exports = async function addWallet({ params }) {
  const { redis, tokenManager } = this;
  const { message, sign } = params;

  //extract timestamp from message
  const [addressElement, timestampElement] = message.split("\n\n").slice("-2");
  const timestamp = timestampElement.split(":")[1];
  const address = addressElement.split(":")[1];

  // verify timestamp not older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 300) {
    return res.status(401).json({
      message: "Bro... this time stamp old af",
    });
  }

  const hashMessage = ethers.utils.hashMessage(message);
  const pk = ethers.utils.recoverPublicKey(hashMessage, signature);
  const recoveredAddress = ethers.utils.computeAddress(pk);

  if (recoveredAddress !== address) {
    return res.status(401).json({
      message: "Bro... this signature is not for you",
    });
  }

  const response = await tokenManager.add({
    address,
    action: USERS_WALLET_ADD,
  });

  await redis.sadd(WALLET_INDEX, address);

  return response;
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
