const Promise = require('bluebird');
const Crypto = require('crypto');
const differenceWith = require('lodash/differenceWith');
const get = require('lodash/get');
const partial = require('lodash/partial');
const defaults = require('lodash/defaults');
const { Redirect } = require('../errors');

const FIELDS = [
  'id',
  'name',
  'email',
  'first_name',
  'last_name',
  'middle_name',
  'gender',
  'link',
  'locale',
  'timezone',
  'updated_time',
  'verified',
  'picture.type(square).width(200).height(200)',
].join(',');

const DEFAULT_API_VERSION = 'v2.8';

class Urls {
  static self = null;
  static instance(version = DEFAULT_API_VERSION) {
    let { self } = this;

    if (!self) {
      self = this.self = new Urls(version);
    }

    return self;
  }

  static setVersion(version) {
    return this.instance().setVersion(version);
  }

  static get auth() {
    return Urls.instance().auth;
  }

  static get token() {
    return Urls.instance().token;
  }

  constuctor(apiVersion) {
    this.apiVersion = apiVersion;
  }

  setVersion(version) {
    this.apiVersion = version;
    return this;
  }

  get auth() {
    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth`;
  }

  get token() {
    return `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
  }

  get permissions() {
    return `https://graph.facebook.com/${this.apiVersion}/me/permissions`;
  }

  get profile() {
    return `https://graph.facebook.com/${this.apiVersion}/me`;
  }
}

function scopeComparator(scopeValue, fbPermission) {
  return scopeValue === fbPermission.permission && fbPermission.status === 'granted';
}

function structureProfile(credentials, profile) {
  // embed profile
  credentials.profile = {
    id: profile.id,
    username: profile.username,
    displayName: profile.name,
    gender: profile.gender,
    age_range: profile.age_range,
    name: {
      first: profile.first_name,
      last: profile.last_name,
      middle: profile.middle_name,
    },
    email: profile.email,
    raw: profile,
  };

  // if we have actual picture
  if (get(profile, 'picture.data.is_silhouette', true) === false) {
    credentials.profile.picture = profile.picture.data.url;
  }

  return credentials;
}

function fetch(resource) {
  return (fetcher, options) => Promise.fromCallback(callback =>
    fetcher(Urls[resource], options, partial(callback, null))
  );
}

const fetchProfile = fetch('profile');
const fetchPermissions = fetch('permissions');

function verifyPermissions(permissions) {
  const requiredPermissions = get(this, 'provider.scope', []);
  const missingPermissions = differenceWith(
    requiredPermissions,
    permissions.data,
    scopeComparator
  );

  if (missingPermissions.length) {
    // TODO sample
    throw new Redirect(missingPermissions.join(this.provider.scopeSeparator));
  }

  return true;
}

function obtainProfile(credentials, params, getter, callback) {
  // eslint-disable-next-line camelcase
  const appsecret_proof = Crypto.createHmac('sha256', this.clientSecret)
    .update(credentials.token)
    .digest('hex');

  return Promise
    .resolve([getter, { appsecret_proof }])
    .bind(this)
    .spread(fetchPermissions)
    .tap(permissions => console.log('perms', permissions))
    .then(verifyPermissions)
    .tap(isOk => console.log('lacking permissions:', isOk))
    .return([getter, { appsecret_proof, fields: FIELDS }])
    .spread(fetchProfile)
    .then(partial(structureProfile, credentials))
    .asCallback(callback);
}

const defaultOptions = {
  protocol: 'oauth2',
  useParamsAuth: true,
  scope: ['email'],
  scopeSeparator: ',',
  profile: obtainProfile,
  auth: Urls.auth,
  token: Urls.token,
};

module.exports.options = (options) => {
  const { scope, scopeSeparator, apiVersion } = options;
  const urls = Urls.instance().setVersion(apiVersion);
  const configuredOptions = {
    scope,
    scopeSeparator,
    auth: urls.auth,
    token: urls.token,
  };

  return defaults(configuredOptions, defaultOptions);
};
