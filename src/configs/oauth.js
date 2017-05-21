exports.oauth = {
  token: {
    hashingFunction: 'HS256',
    issuer: 'ms-users',
    secret: 'dajs123jnida071241d-ar-01129hbad7as-akd810', // make sure to update this in production
  },
  providers: {
    facebook: {
      clientId: 'fb-client-id',
      location: 'location',
      clientSecret: 'fb-client-secret',
    },
  },
};
