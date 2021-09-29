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
    authUrl: '/auth/services/id/validateToken',
    credentials: {
      imcf: {
        baseUrl: 'https://simulation.masters.com',
      },
    },
  },
};
