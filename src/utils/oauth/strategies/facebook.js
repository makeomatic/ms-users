const Promise = require('bluebird');
const Crypto = require('crypto');
const Errors = require('common-errors');
const differenceWith = require('lodash/differenceWith');
const get = require('lodash/get');
const partial = require('lodash/partial');
const { Redirect } = require('../errors');

// internal settings for facebook
const internals = {
  fields: [
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
  ].join(','),
  permissions: 'https://graph.facebook.com/v2.8/me/permissions',
  profileUrl: 'https://graph.facebook.com/v2.8/me',
  scopeComparator(scopeValue, fbPermission) {
    return scopeValue === fbPermission.permission && fbPermission.status === 'granted';
  },
  structureProfile(credentials, profile) {
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
  },
};

function fetch(url) {
  return (fetcher, options) => Promise.fromCallback(callback =>
    fetcher(url, options, partial(callback, null))
  );
}

const fetchProfile = fetch(internals.profileUrl);
const fetchPermissions = fetch(internals.permissions);

function verifyPermissions(permissions) {
  const requiredPermissions = get(this, 'provider.scope', []);
  const missingPermissions = differenceWith(
    requiredPermissions,
    permissions.data,
    internals.scopeComparator
  );

  if (missingPermissions.length) {
    // TODO sample
    throw Redirect(missingPermissions.join(this.provider.scopeSeparator));
  }

  return true;
}

function obtainProfile(credentials, params, getter, callback) {
  // eslint-disable-next-line camelcase
  const appsecret_proof = Crypto.createHmac('sha256', this.clientSecret)
    .update(credentials.token)
    .digest('hex');

  const { fields } = internals;

  return Promise
    .resolve([getter, { appsecret_proof }])
    .bind(this)
    .spread(fetchPermissions)
    .tap(permissions => console.log('perms', permissions))
    .then(verifyPermissions)
    .tap(isOk => console.log('lacking permissions:', isOk))
    .return([getter, { appsecret_proof, fields }])
    .spread(fetchProfile)
    .then(partial(internals.structureProfile, credentials))
    .asCallback(callback);
}

module.exports.options = {
  protocol: 'oauth2',
  useParamsAuth: true,
  auth: 'https://www.facebook.com/v2.3/dialog/oauth',
  token: 'https://graph.facebook.com/v2.3/oauth/access_token',
  scope: ['email'],
  scopeSeparator: ',',
  profile: obtainProfile,
};
