const Promise = require('bluebird');
const Crypto = require('crypto');
const differenceWith = require('lodash/differenceWith');
const get = require('lodash/get');
const partial = require('lodash/partial');
const defaults = require('lodash/defaults');

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

class Urls {
  static DEFAULT_API_VERSION = 'v2.8';
  static self = null;
  static instance(version = Urls.DEFAULT_API_VERSION) {
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

  constructor(apiVersion) {
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
  const endpoint = Urls.instance()[resource];

  return (fetcher, options) => Promise.fromCallback(callback =>
    fetcher(endpoint, options, partial(callback, null))
  );
}

const fetchProfile = fetch('profile');
const fetchPermissions = fetch('permissions');

function verifyPermissions(credentials, permissions) {
  const requiredPermissions = get(this, 'provider.scope', []);
  const missingPermissions = differenceWith(
    requiredPermissions,
    permissions.data,
    scopeComparator
  );

  if (missingPermissions.length) {
    credentials.missingPermissions = missingPermissions;

    // doesn't matter what to throw here because there's no handling in bell
    // https://github.com/hapijs/bell/blob/master/lib/oauth.js#L304
    // leave it for the route handler
    throw new Error('missing permissions');
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
    .then(partial(verifyPermissions, credentials))
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

  if (apiVersion) {
    Urls.setVersion(apiVersion);
  }

  const configuredOptions = {
    scope,
    scopeSeparator,
    auth: Urls.auth,
    token: Urls.token,
  };

  return defaults(configuredOptions, defaultOptions);
};
