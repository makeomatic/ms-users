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
exports.encrypt = function encrypt(algorithm, secret, buffer) {
  const cipher = crypto.createCipher(algorithm, secret);
  const crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return crypted;
};

/**
 * Decrypts buffer using algoruthm and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
exports.decrypt = function decrypt(algorithm, secret, buffer) {
  const decipher = crypto.createDecipher(algorithm, secret);
  const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);
  return dec;
};

/**
 * Generates complete link
 * @param  {Object} server
 * @param  {String} path
 * @return {String}
 */
exports.generateLink = function generateLink(server, path) {
  const { proto } = server;
  let { port } = server;

  if ((proto === 'http' && +port === 80) || (proto === 'https' && +port === 443)) {
    port = '';
  } else {
    port = `:${port}`;
  }

  return `${proto}://${server.host + port + path}`;
};

/**
 * Safely decodes
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {String} string
 * @return {Promise}
 */
exports.safeDecode = function safeDecode(algorithm, secret, string) {
  return Promise
    .try(function decode() {
      return JSON.parse(exports.decrypt(algorithm, secret, URLSafeBase64.decode(string)));
    })
    .bind(this)
    .catch(function remapError(err) {
      this.log.warn('cant decode token', err);
      throw new Errors.HttpStatusError(403, 'could not decode token');
    });
};

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
  const { ttl, throttle, subjects, paths, secret, algorithm, email: mailingAccount } = validation;

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
      const enc = exports.encrypt(algorithm, secret, new Buffer(JSON.stringify({ email, token: activationSecret })));

      // generate context
      const context = {
        qs: '?q=' + URLSafeBase64.encode(enc),
      };

      switch (type) {
      case 'activate':
      case 'reset':
        context.link = exports.generateLink(server, paths[type]);
        break;
      default:
        throw new Errors.InvalidOperationError(`${type} action is not supported`);
      }

      return render(type, context);
    })
    .then(function storeSecrets(emailTemplate) {
      const throttleArgs = [ throttleEmailsKey, 1, 'NX' ];
      if (throttle > 0) {
        throttleArgs.splice(2, 0, 'EX', throttle);
      }
      return redis
        .set(throttleArgs)
        .then(function isThrottled(response) {
          if (!response) {
            throw new Errors.HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');
          }
        })
        .then(function updateSecret() {
          const secretKey = redisKey('vsecret-' + type, activationSecret);
          const args = [ secretKey, email ];
          if (ttl > 0) {
            args.push('EX', ttl);
          }
          return redis.set(args);
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
 * Verifies token
 * @param  {String}  string
 * @param  {String}  namespace
 * @param  {Boolean} expire
 * @return {Promise}
 */
exports.verify = function verifyToken(string, namespace = 'activate', expires) {
  const { _redis: redis, _config: config } = this;
  const { validation } = config;
  const { secret: validationSecret, algorithm } = validation;

  return exports.safeDecode.call(this, algorithm, validationSecret, string)
    .then(function inspectResult(message) {
      const { email, token } = message;

      if (!email || !token) {
        throw new Errors.HttpStatusError(403, 'Decoded token misses references to email and/or secret');
      }

      const secretKey = redisKey('vsecret-' + namespace, token);
      return redis
        .get(secretKey)
        .then(function inspectAssociatedData(associatedEmail) {
          if (!associatedEmail) {
            throw new Errors.HttpStatusError(404, 'token expired or is invalid');
          }

          if (associatedEmail !== email) {
            throw new Errors.HttpStatusError(412, 'associated email doesn\'t match token');
          }

          if (expires) {
            return redis.del(secretKey);
          }
        })
        .return(email);
    });
};
