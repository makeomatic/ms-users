const Errors = require('common-errors');
const Promise = require('bluebird'); // jshint ignore: line
const uuid = require('node-uuid');
const crypto = require('crypto');
const URLSafeBase64 = require('urlsafe-base64');
const render = require('ms-mailer-templates');
const { updatePassword } = require('../actions/updatePassword.js');
const generatePassword = require('password-generator');
const { MAIL_ACTIVATE, MAIL_RESET, MAIL_PASSWORD, MAIL_REGISTER } = require('../constants.js');
const { Tokens } = require('../model/usermodel');
const { ModelError, ERR_TOKEN_CANT_DECODE, ERR_EMAIL_ALREADY_SENT, ERR_TOKEN_BAD_EMAIL,
  ERR_TOKEN_EXPIRED, ERR_TOKEN_MISS_EMAIL } = require('../model/modelError');

// TODO: merge this code with master!!!

/**
 * Throttled error
 * @param  {Mixed}  reply
 */
function isThrottled(compare) {
  return function comparator(reply) {
    if (!!reply === compare) {
      throw new ModelError(ERR_EMAIL_ALREADY_SENT);
    }
  };
}

/**
 * Creates (de)cipher
 * @param  {Boolean} isDecipher
 * @return {Function}
 */
function createCipher(isDecipher) {
  const thunk = crypto[isDecipher ? 'createDecipher' : 'createCipher'];
  return (algorithm, secret, buffer) => {
    const cipher = thunk(algorithm, secret);
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  };
}

/**
 * Encrypts buffer using alg and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
exports.encrypt = createCipher(false);

/**
 * Decrypts buffer using algoruthm and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
exports.decrypt = createCipher(true);

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
      throw new ModelError(ERR_TOKEN_CANT_DECODE);
    });
};

/**
 * Send an email with appropriate content
 *
 * @param  {String} email
 * @param  {String} type
 * @return {Promise}
 */
exports.send = function sendEmail(email, type = MAIL_ACTIVATE, wait = false) {
  const { config, mailer } = this;
  const { validation, server } = config;
  const { subjects, senders, paths, secret, algorithm, email: mailingAccount } = validation; // eslint-disable-line

  // method specific stuff
  const activationSecret = uuid.v4();
  const logger = this.log.child({ action: 'sendEmail', email });

  return Promise
    .bind(this, [type, email])
    .spread(Tokens.getEmailThrottleState)
    .then(isThrottled(true))
    .then(function generateContent() {
      // generate context
      const context = {};
      const templateName = validation.templates[type] || type;

      switch (type) {
        case MAIL_ACTIVATE:
        case MAIL_RESET: {
          // generate secret
          const str = new Buffer(JSON.stringify({ email, token: activationSecret }));
          const enc = exports.encrypt(algorithm, secret, str);
          context.qs = `?q=${URLSafeBase64.encode(enc)}`;
          context.link = exports.generateLink(server, paths[type]);
          break;
        }
        case MAIL_PASSWORD:
        case MAIL_REGISTER:
          context.password = generatePassword(config.pwdReset.length, config.pwdReset.memorable);
          context.login = email;
          break;

        default:
          throw new Errors.InvalidOperationError(`${type} action is not supported`);
      }

      return Promise.props({
        context,
        emailTemplate: render(templateName, context),
      });
    })
    .tap(data => {
      const { context } = data;

      // in case we need to setup a new password
      if (type === MAIL_PASSWORD) {
        return updatePassword.call(this, email, context.password);
      }

      return Promise
        .bind(this, [type, email, activationSecret])
        .spread(Tokens.setEmailThrottleState)
        .then(isThrottled(false))
        .then(() => Tokens.setEmailThrottleToken.call(this, type, email, activationSecret));
    })
    .then(function definedSubjectAndSend({ context, emailTemplate }) {
      const mail = {
        subject: subjects[type] || '',
        from: senders[type] || 'noreply <support@example.com>',
        to: email,
        html: emailTemplate,
      };

      const mailSent = mailer
        .send(mailingAccount, mail)
        .return({ sent: true, context })
        .catch(function mailingFailed(err) {
          logger.warn('couldn\'t send email', err);
          return { sent: false, context, err };
        });

      if (wait) {
        return mailSent;
      }

      return {
        queued: true,
        context,
      };
    });
};

/**
 * Verifies token
 * @param  {String}  string
 * @param  {String}  namespace
 * @param  {Boolean} expire
 * @return {Promise}
 */
exports.verify = function verifyToken(string, namespace = MAIL_ACTIVATE, expires) {
  const { config: { validation: { secret: validationSecret, algorithm } } } = this;

  return exports
    .safeDecode
    .call(this, algorithm, validationSecret, string)
    .then(message => {
      const { email, token } = message;

      if (!email || !token) {
        throw new ModelError(ERR_TOKEN_MISS_EMAIL);
      }

      return Promise
//        .bind(this)
//        .then(() => Tokens.getEmailThrottleToken(namespace, token))
//        .then(function inspectAssociatedData(associatedEmail) {
        .bind(this, [namespace, token])
        .spread(Tokens.getEmailThrottleToken)
        .then(associatedEmail => {
          if (!associatedEmail) {
            throw new ModelError(ERR_TOKEN_EXPIRED);
          }

          if (associatedEmail !== email) {
            throw new ModelError(ERR_TOKEN_BAD_EMAIL);
          }

          if (expires) {
            return Tokens.dropEmailThrottleToken.call(this, namespace, token);
          }

          return null;
        })
        .return(email);
    });
};
