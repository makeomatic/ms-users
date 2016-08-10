/**
 * Created by Stainwoortsel on 01.08.2016.
 */
const Promise = require('bluebird');
const storage = require('./storages/redisstorage');
const moment = require('moment');
const mongoose = require('mongoose'); //для самопроверки )
const { Schema } = mongoose;



const {
  ModelError,
  ERR_ALIAS_ALREADY_ASSIGNED, ERR_ALIAS_ALREADY_TAKEN, ERR_USERNAME_NOT_EXISTS, ERR_USERNAME_NOT_FOUND,
  ERR_TOKEN_FORGED, ERR_CAPTCHA_WRONG_USERNAME, ERR_ATTEMPTS_TO_MUCH_REGISTERED,
  ERR_ALIAS_ALREADY_EXISTS, ERR_ACCOUNT_IS_ALREADY_EXISTS, ERR_ACCOUNT_ALREADY_ACTIVATED,
} = require('../modelError');
/*
 ERR_USERNAME_ALREADY_ACTIVE,
 ERR_USERNAME_ALREADY_EXISTS,  ERR_ACCOUNT_MUST_BE_ACTIVATED,
 ERR_ACCOUNT_NOT_ACTIVATED, ERR_ACCOUNT_IS_LOCKED
 ERR_ADMIN_IS_UNTOUCHABLE, ERR_CAPTCHA_ERROR_RESPONSE, ERR_EMAIL_DISPOSABLE,
 ERR_EMAIL_NO_MX, ERR_EMAIL_ALREADY_SENT, ERR_TOKEN_INVALID, ERR_TOKEN_AUDIENCE_MISMATCH, ERR_TOKEN_MISS_EMAIL,
 ERR_TOKEN_EXPIRED, ERR_TOKEN_BAD_EMAIL, ERR_TOKEN_CANT_DECODE, ERR_PASSWORD_INVALID,
 ERR_PASSWORD_INVALID_HASH, ERR_PASSWORD_INCORRECT, ERR_PASSWORD_SCRYPT_ERROR,

 */

const {
  USERS_DATA, USERS_METADATA, USERS_ALIAS_TO_LOGIN,
  USERS_ACTIVE_FLAG, USERS_INDEX, USERS_PUBLIC_INDEX,
  USERS_ALIAS_FIELD, USERS_TOKENS, USERS_BANNED_FLAG, USERS_BANNED_DATA,
} = require('../../constants');

/**
 * Adapter pattern class with user model methods
 */
exports.User = {
  UserModel: null,

  /**
   * Initialize the storage
   */
  init() {
    exports.User.TokenModel = new Schema({
      'key': { type: 'String', required: true },
      'token': { type: 'String', required: true },
      'expires': { type: 'Date', required: true }
    });
    exports.User.UserModel = this.mongo.model('User', new Schema({
      'username': { type: 'String', required: true, unique: true  },
      'alias': { type: 'String' },
      'password': { type: 'String', required: true },
      'isbanned': { type: 'Boolean', default: false },
      'isactive': { type: 'Boolean', default: false },
      'ispublic': { type: 'Boolean', default: false },
      'registered': { type: 'Date' },
      'meta': { type: 'Mixed' },
      'tokens': { type: 'Mixed' } // вместо массива проще сделать K->V чтобы было легче работать
    }));
    // поиск по внутренней структуре докумнета тоже может работать, если использовать не могус, а нативный монго
    // почитать про это
    // мета: сохранять как { audience: { key: value } } и не надо будет извращаться с поиском
    // по метаданным, потому что не будет стрингифай
    //

  },


  /**
   * Get user by username
   * @param username
   * @returns {Object}
   */
  getOne(username) {
    //return exports.User.UserModel.findOne({ 'username' : username });
    return exports.User.UserModel
      .find({ $or:[ { 'username': username }, { 'alias': username } ]})
      .limit(1)
      .exec()
      .then((data) => {
        if(data.length === 0) throw new ModelError(ERR_USERNAME_NOT_EXISTS);

        return data;
      });
  },

  /**
   * TODO: needed
   * Get list of users by params
   * @param opts
   * @returns {Array}
   */
  getList(opts) {
    // TODO: check list of options
    // criteria поле для поиска -- название, и поле для сортировки
    // если что, смотреть LUA

    // filter -- это переменная redis filter format, находится в redis-filtered-sort пакете
    const { criteria, audience, filter } = opts;
    const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
    const order = opts.order || 'ASC';
    const offset = opts.offset || 0;
    const limit = opts.limit || 10;
    const index = opts.public ? USERS_PUBLIC_INDEX : USERS_INDEX;

    const metaKey = generateKey('*', USERS_METADATA, audience);

    return exports.User.UserModel.find(opts).exec();
  },

  /**
   * TODO: needed
   * Get metadata of user
   * @param username
   * @param audiences
   * @param fields
   * @param _public
   * @returns {Object}
   */
  getMeta(username, audiences, fields = {}, _public = null) {
    //TODO: check this method
    return mongoose.connection.users.find({ 'username': username, 'meta.<audience>.<key>': '<value>' });
  },

  /**
   * Get ~real~ username by username or alias
   * @param username
   * @returns {String} username
   */
  getUsername(username) {
    return exports.User.UserModel.find({ $or:[ { 'username': username }, { 'alias': username } ]})
      .limit(1)
      .exec()
      .then((data) => {
        return data.username;
      });
  },

  /**
   * Check alias existence
   * @param alias
   * @returns {*}
   */
  checkAlias(alias) {
    return exports.User.UserModel
      .find({ alias })
      .limit(1)
      .exec()
      .then((user) => {
        if(user.alias) {
          throw new ModelError(ERR_ALIAS_ALREADY_EXISTS, user.alias);
        }

        return user.username;
      });
  },

  /**
   * Sets alias to the user by username
   * @param opts
   * @returns {*}
   */
  setAlias(opts) {
    const { config } = this;
    const { jwt: { defaultAudience } } = config;
    const { username, alias, data } = opts;

    // TODO: same logic as in redis, but I feel something wrong...
    if (data && data[USERS_ALIAS_FIELD]) {
      throw new ModelError(ERR_ALIAS_ALREADY_ASSIGNED);
    }

    return exports.User.UserModel
      .find({ username, alias: { $exists: true } })
      .limit(1)
      .exec()
      .then((item) => {
        if(item.length > 0) {
          throw new ModelError(ERR_ALIAS_ALREADY_TAKEN);
        }

        const data = { alias };
        data[defaultAudience] = {};
        data[defaultAudience][USERS_ALIAS_FIELD] = alias;

        return exports.User.UserModel.findOneAndUpdate({ username }, data);
      });
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {String} username
   */
  setPassword(username, hash) {
    return exports.User.UserModel.findOneAndUpdate({ username }, { password: hash });
  },

  /**
   * Updates metadata of user by username and audience
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  setMeta(opts) {
    // ...
  },

  /**
   * Create user account with alias and password
   * @param username
   * @param alias
   * @param hash
   * @param activate
   * @returns {*}
   */
  create(username, alias, hash, activate) {
    const { config } = this;
    const { deleteInactiveAccounts } = config;
    const userDataKey = generateKey(username, USERS_DATA);
    const pipeline = redis.pipeline();

    const data = {
      username,
      alias,
      password: hash,
      isactive: activare
    };

//TODO: refactor it! by using UNIQUE in schema and error catching
    return exports.User.UserModel
      .find({ username })
      .limit(1)
      .exec()
      .then((data) => {
        if(data.length) {
          throw new ModelError(ERR_ACCOUNT_IS_ALREADY_EXISTS, username);
        }

        const usr = new exports.User.UserModel(data);
        return usr
          .save()
          .then(() => {
            if (!activate && deleteInactiveAccounts >= 0) {
// TODO: expires logic!
            }

            return null;

          })
          // setting alias, if we can
          .tap(activate && alias ? () => exports.User.setAlias.call(this, { username, alias }) : noop);
      });
  },

  /**
   * Remove user
   * @param username
   * @param data
   * @returns {*}
   */
  remove(username, data) {
    return exports.User.UserModel.findOneAndDelete({ username });
  },

  /**
   * Activate user
   * @param username
   * @returns {*}
   */
  activate(username) {
    // TODO: error on already activated
    return exports.User.UserModel.findOneAndUpdate({ username }, { isactive: true });
  },

  /**
   * Disactivate user
   * @param username
   * @returns {*}
   */
  disactivate(username) {
    // TODO: error on already disactivated
    return exports.User.UserModel.findOneAndUpdate({ username }, { isactive: false });
  },

  /**
   * Ban user
   * @param username
   * @param opts
   * @returns {*}
   */
  lock(opts) {
    const { username, reason, whom, remoteip } = opts; // to guarantee writing only those three variables to metadata from opts
    const data = {
      isbanned: true,
      [USERS_BANNED_DATA]: {
        reason: reason || '',
        whom: whom || '',
        remoteip: remoteip || '',
      },
      tokens: []
    };

    return exports.User.UserModel.findOneAndUpdate({ username }, data);
  },

  /**
   * Unlock banned user
   * @param { username }
   * @returns {*}
   */
  unlock({ username }) {
    return exports.User.UserModel.findOneAndUpdate({ username }, { isbanned: false });
  },
};

/**
 * Adapter pattern class for user login attempts counting
 */
class AttemptsClass {
  /**
   * Attempts class constructor, _context parameter is the context of service
   * @param _context
   */
  constructor(_context) {
    this.context = _context;
    this.loginAttempts = 0;
  }

  /**
   * Check login attempts
   * @param username
   * @param ip
   * @returns {*}
   */
  check(username, ip) {
    const { config: { jwt: { lockAfterAttempts }, keepLoginAttempts } } = this.context;
    return Promise.bind(this.context, { username, ip })
      .then(storage.Attempts.check)
      .then((attempts) => {
        if (attempts === null) return;

        this.loginAttempts = attempts;
        if (this.loginAttempts > lockAfterAttempts) {
          const duration = moment().add(keepLoginAttempts, 'seconds').toNow(true);
          const verifyIp = ip && lockAfterAttempts > 0;

          const err = new ModelError(ERR_ATTEMPTS_LOCKED, duration);
          if (verifyIp) {
            err.loginAttempts = this.loginAttempts;
          }

          throw err;
        }
      });
  }

  /**
   * Drop login attempts
   * @param username
   * @param ip
   * @returns {*}
   */
  drop(username, ip) {
    this.loginAttempts = 0;
    return storage.Attempts.drop.call(this.context, username, ip);
  }

  /**
   * Get attempts count
   * @returns {integer}
   */
  count() {
    return this.loginAttempts;
  }
}
exports.Attempts = AttemptsClass;

/**
 * Adapter pattern class for user tokens
 */
exports.Tokens = {
  /**
   * Add the token
   * @param username
   * @param token
   * @returns {*}
   */
  add(username, token) {
    return storage.Tokens.add.call(this, username, token);
  },

  /**
   * Drop the token
   * @param username
   * @param token
   * @returns {*}
   */
  drop(username, token = null) {
    return storage.Tokens.drop.call(this, username, token);
  },

  /**
   * Get last token score
   * @param username
   * @param token
   * @returns {integer}
   */
  lastAccess(username, token) {
    return storage.Tokens.lastAccess.call(this, username, token);
  },

  /**
   * Get special email throttle state
   * @param type
   * @param email
   * @returns {bool} state
   */
  getEmailThrottleState(type, email) {
    return storage.Tokens.getEmailThrottleState.call(this, type, email);
  },

  /**
   * Set special email throttle state
   * @param type
   * @param email
   * @returns {*}
   */
  setEmailThrottleState(type, email) {
    return storage.Tokens.setEmailThrottleState.call(this, type, email);
  },

  /**
   * Get special email throttle token
   * @param type
   * @param token
   * @returns {string} email
   */
  getEmailThrottleToken(type, token) {
    return storage.Tokens.getEmailThrottleToken.call(this, type, token);
  },

  /**
   * Set special email throttle token
   * @param type
   * @param email
   * @param token
   * @returns {*}
   */
  setEmailThrottleToken(type, email, token) {
    return storage.Tokens.setEmailThrottleToken.call(this, type, email, token);
  },

  /**
   * Drop special email throttle token
   * @param type
   * @param token
   * @returns {*}
   */
  dropEmailThrottleToken(type, token) {
    return storage.Tokens.dropEmailThrottleToken.call(this, type, token);
  },
};

/**
 * Adapter pattern class for util methods with IP
 */
exports.Utils = {
  /**
   * Check IP limits for registration
   * @param ipaddress
   * @returns {*}
   */
  checkIPLimits(ipaddress) {
    return storage.Utils.checkIPLimits.call(this, ipaddress);
  },

  /**
   * Check captcha
   * @param username
   * @param captcha
   * @param next
   * @returns {*}
   */
  checkCaptcha(username, captcha, next = null) {
    return storage.Utils.checkCaptcha.call(this, username, captcha, next);
  },
};
