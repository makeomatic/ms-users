exports.bypass = {
  pumpJack: {
    enabled: false,
    baseUrl: 'https://inter-miami-prod-services.pumpjackdataworks.com/api/services/v1',
    authUrl: 'fanxp-integration/getUser',
    credentials: {
      imcf: process.env.PUMP_JACK_API_KEY,
    },
  },
};
