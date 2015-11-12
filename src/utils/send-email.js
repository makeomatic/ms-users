const Errors = require('common-errors');
const Promise = require('bluebird'); // jshint ignore: line
const uuid = require('node-uuid');
const redisKey = require('../utils/key.js');
const crypto = require('crypto');
const URLSafeBase64 = require('urlsafe-base64');
const render = require('ms-mailer-templates');

/**
 * Encrypts buffer using alg and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
function encrypt(algorithm, secret, buffer) {
  const cipher = crypto.createCipher(algorithm, secret);
  const crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return crypted;
}

/**
 * Decrypts buffer using algoruthm and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
function decrypt(algorithm, secret, buffer) {
  const decipher = crypto.createDecipher(algorithm, secret);
  const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);
  return dec;
}

/**
 * Generates complete link
 * @param  {Object} server
 * @param  {String} path
 * @return {String}
 */
function generateLink(server, path) {
  const { proto } = server;
  let { port } = server;

  if ((proto === 'http' && +port === 80) || (proto === 'https' && +port === 443)) {
    port = '';
  } else {
    port = `:${port}`;
  }

  return `${proto}://${server.host + port + path}`;
}

/**
 * Send an email with appropriate content
 *
 * @param  {String} email
 * @param  {String} type
 * @return {Promise}
 */
exports.send = function sendEmail(email, type = 'activate', wait = false) {
  const { _redis: redis, _config: config, _mailer: mailer } = this;
  const { validation, server } = config;
  const { ttl, subjects, paths, secret, algorithm, email: mailingAccount } = validation;

  // method specific stuff
  const throttleEmailsKey = redisKey('vthrottle-' + type, email);
  const activationSecret = uuid.v4();
  const logger = this.log.child({ action: 'sendEmail', email });

  return redis
    .get(throttleEmailsKey)
    .then(function isThrottled(reply) {
      if (reply) {
        throw new Errors.HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');
      }
    })
    .then(function generateContent() {
      // generate secret
      const enc = encrypt(algorithm, secret, new Buffer(JSON.stringify({ email, secret: activationSecret }), 'utf-8'));

      // generate context
      const context = {
        qs: '?q=' + URLSafeBase64.encode(enc),
      };

      switch (type) {
      case 'activate':
      case 'reset':
        context.link = generateLink(server, paths[type]);
        break;
      default:
        throw new Errors.InvalidOperationError(`${type} action is not supported`);
      }

      return render(type, context);
    })
    .then(function storeSecrets(emailTemplate) {
      return redis
        .set(throttleEmailsKey, 1, 'EX', ttl, 'NX')
        .then(function isThrottled(response) {
          if (!response) {
            throw new Errors.HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');
          }
        })
        .then(function updateSecret() {
          return redis.set(redisKey('vsecret-' + type, activationSecret), email);
        })
        .return(emailTemplate);
    })
    .then(function definedSubjectAndSend(emailTemplate) {
      let subject;
      switch (type) {
      case 'activate':
      case 'reset':
        subject = subjects[type];
        break;
      default:
        subject = '';
      }

      const mail = {
        subject,
        to: email,
        html: emailTemplate,
      };

      const mailSent = mailer.send(mailingAccount, mail)
        .catch(function mailingFailed(err) {
          logger.warn('couldn\'t send email', err);
        });

      if (wait) {
        return mailSent;
      }

      return { queued: true };
    });
};

/**
 * Safely decodes
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {String} string
 * @return {Promise}
 */
function safeDecode(algorithm, secret, string) {
  return Promise.try(function decode() {
    return JSON.parse(decrypt(algorithm, secret, URLSafeBase64.decode(string)));
  })
  .catch(function remapError() {
    throw new Errors.HttpStatusError(403, 'Invalid or expired activation token');
  });
}

/**
 * Verifies token
 * @param  {String}  string
 * @param  {String}  namespace
 * @param  {Boolean} expire
 * @return {Promise}
 */
exports.verify = function verifyToken(string, namespace = 'activate', expire) {
  const { _redis: redis, _config: config } = this;
  const { validation } = config;
  const { secret: validationSecret, algorithm } = validation;

  return safeDecode(algorithm, validationSecret, string)
    .then(function inspectResult(message) {
      const { email, secret } = message;

      if (!email || !secret) {
        throw new Errors.HttpStatusError(403, 'Invalid or expired activation token');
      }

      const secretKey = redisKey('vsecret-' + namespace, secret);
      return redis.get(secretKey)
        .then(function inspectAssociatedData(associatedEmail) {
          if (!associatedEmail || associatedEmail !== email) {
            throw new Errors.HttpStatusError(403, 'Invalid or expired activation token');
          }

          if (expire) {
            return redis.del(secretKey);
          }
        })
        .return(email);
    });
};
