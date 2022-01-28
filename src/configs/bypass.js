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
    baseUrl: 'https://simulation.masters.com',
    authPath: '/auth/services/id/validateToken',
    httpPoolOptions: {
      connections: 1,
      pipelining: 1,
    },
    httpClientOptions: {
      headersTimeout: 5,
      bodyTimeout: 5,
    },
    credentials: {
      local: {},
    },
  },
};
