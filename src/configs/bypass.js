exports.bypass = {
  pumpJack: {
    enabled: false,
    authUrl: '/fanxp-integration/getUser',
    credentials: {
      imcf: {
        baseUrl: 'https://inter-miami-prod-services.pumpjackdataworks.com/api/services/v1',
        apiKey: process.env.PUMP_JACK_API_KEY,
      },
    },
  },
  masters: {
    enabled: false,
    provider: 'masters',
    baseUrl: 'https://simulation.masters.com',
    authPath: '/auth/services/id/validateToken',
    httpPoolOptions: {
      connections: 1,
      pipelining: 1,
    },
    httpClientOptions: {
      headersTimeout: 5000,
      bodyTimeout: 5000,
    },
    credentials: {
      local: {},
    },
    additionalMeta: null,
  },
  generic: {
    enabled: false,
    subaccounts: [],
  },
  streamlayer: {
    enabled: false,
    provider: 'streamlayer',
  },
  /**
   * schemaName: `sla`
   * account: should be equal `organizationId` -- must be set on the gateway
   * userKey: should be either `jwe` for POST or `kid` for GET
   */
  slrAnonymous: {
    enabled: false,
    provider: 'slra',
    audience: 'sec.local', // TOTP & private key must be there
    totpKey: 'totp',
    pkKey: 'pk',
    idField: 'device-id',
    issuers: undefined, // specify to restrict
  },
};
