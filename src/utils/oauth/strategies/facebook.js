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
  static DEFAULT_API_VERSION = 'v2.9';
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

function defaultProfileHandler(profile) {
  const { credentials } = this;
  const { token, refreshToken } = credentials;
  const { id, email } = profile;

  // embed profile, contains only safe data, would be attached to user's metadata
  credentials.profile = {
    id,
    username: profile.username,
    displayName: profile.name,
    gender: profile.gender,
    age_range: profile.age_range,
    name: {
      first: profile.first_name,
      last: profile.last_name,
      middle: profile.middle_name,
    },
  };

  credentials.raw = profile;

  // if we have actual picture
  if (get(profile, 'picture.data.is_silhouette', true) === false) {
    credentials.profile.picture = profile.picture.data.url;
  }

  // inject email directly to credentials
  if (email) {
    credentials.email = email;
  }

  // private data to store
  credentials.internals = {
    id,
    email,
    token,
    refreshToken,
  };

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

function verifyPermissions(permissions) {
  const { credentials, requiredPermissions } = this;
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


function profileFactory(fields, profileHandler = defaultProfileHandler) {
  function obtainProfile(credentials, params, getter, callback) {
    // eslint-disable-next-line camelcase
    const appsecret_proof = Crypto.createHmac('sha256', this.clientSecret)
      .update(credentials.token)
      .digest('hex');

    const requiredPermissions = get(this, 'provider.scope', []);
    const ctx = {
      fields,
      credentials,
      requiredPermissions,
    };

    return Promise
      .bind(ctx, [getter, { appsecret_proof }])
      .spread(fetchPermissions)
      .tap(verifyPermissions)
      .return([getter, { appsecret_proof, fields }])
      .spread(fetchProfile)
      .then(profileHandler)
      .asCallback(callback);
  }

  return obtainProfile;
}

const defaultOptions = {
  protocol: 'oauth2',
  useParamsAuth: true,
  scope: ['email'],
  scopeSeparator: ',',
  profile: profileFactory(FIELDS),
  auth: Urls.auth,
  token: Urls.token,
};

module.exports.options = (options) => {
  const { scope, scopeSeparator, apiVersion } = options;

  if (apiVersion) {
    Urls.setVersion(apiVersion);
  }

  const fields = get(options, 'fields', FIELDS);
  const profileHandler = get(options, 'profileHandler', defaultProfileHandler);

  const configuredOptions = {
    scope,
    scopeSeparator,
    auth: Urls.auth,
    token: Urls.token,
    profile: profileFactory(fields, profileHandler),
  };

  return defaults(configuredOptions, defaultOptions);
};
