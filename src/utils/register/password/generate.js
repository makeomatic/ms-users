const { CHALLENGE_TYPE_EMAIL, CHALLENGE_TYPE_PHONE } = require('../../../constants.js');
const Errors = require('common-errors');
const passwordByEmail = require('../../challenges/email/generate.js').register;
const passwordByPhone = require('../../challenges/phone/send').register;
const Promise = require('bluebird');

function factory(challengeType) {
  switch (challengeType) {
    case CHALLENGE_TYPE_EMAIL:
      return passwordByEmail;
    case CHALLENGE_TYPE_PHONE:
      return passwordByPhone;
    default:
      throw new Errors.NotImplementedError(`Auto password for ${challengeType}`);
  }
}

/*
 * Creates random password and send it to the user via challenge.
 * Returns generated password.
 *
 * @todo send password after user creation
 */
function generatePassword(challengeType, userId) {
  const passwordGenerator = factory(challengeType);

  return Promise
    .bind(this, userId)
    .then(passwordGenerator)
    .get('context')
    .get('password');
}

module.exports = generatePassword;
