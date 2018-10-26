const Promise = require('bluebird');
const Crypto = require('crypto');
const differenceWith = require('lodash/differenceWith');
const defaults = require('lodash/defaults');
const Urls = require('../utils/fb-urls');
const get = require('../../../utils/get-value');

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

function scopeComparator(scopeValue, fbPermission) {
  return scopeValue === fbPermission.permission && fbPermission.status === 'granted';
}

function defaultProfileHandler(profile) {
  const { credentials } = this;
  const { token, refreshToken } = credentials;
  const { id, email, username } = profile;

  // embed profile, contains only safe data, would be attached to user's metadata
  credentials.profile = {
    id,
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
  if (get(profile, 'picture.data.is_silhouette', { default: true }) === false) {
    credentials.profile.picture = profile.picture.data.url;
  }

  // private data to store
  credentials.internals = {
    id,
    token,
    refreshToken,
    username,
  };

  // inject email directly to credentials
  if (email) {
    credentials.email = email;
    credentials.internals.email = email;
  }

  return credentials;
}

function fetch(resource) {
  const endpoint = Urls.instance()[resource];
  return (fetcher, options) => fetcher(endpoint, options);
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
    return false;
  }

  return true;
}

function profileFactory(fields, profileHandler = defaultProfileHandler) {
  return async function obtainProfile(credentials, params, getter) {
    const ap = Crypto.createHmac('sha256', this.clientSecret)
      .update(credentials.token)
      .digest('hex');

    const requiredPermissions = get(this, 'provider.scope', { default: [] });
    const ctx = {
      fields,
      credentials,
      requiredPermissions,
    };

    return Promise
      .bind(ctx, [getter, { appsecret_proof: ap }])
      .spread(fetchPermissions)
      .tap(verifyPermissions)
      .return([getter, { appsecret_proof: ap, fields }])
      .spread(fetchProfile)
      .then(profileHandler);
  };
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

exports.options = (options) => {
  const { scope, scopeSeparator, apiVersion } = options;

  if (apiVersion) {
    Urls.setVersion(apiVersion);
  }

  const fields = get(options, 'fields', { default: FIELDS });
  const profileHandler = get(options, 'profileHandler', { default: defaultProfileHandler });

  const configuredOptions = {
    scope,
    scopeSeparator,
    auth: Urls.auth,
    token: Urls.token,
    profile: profileFactory(fields, profileHandler),
  };

  return defaults(configuredOptions, defaultOptions);
};
