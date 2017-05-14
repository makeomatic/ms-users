const path = require('path');

exports.http = {
  server: {
    handler: 'hapi',
    port: 3000,
    handlerConfig: {
      views: {
        engines: {
          hbs: require('handlebars'),
        },
        path: path.resolve(__dirname, '../templates'),
      },
      plugins: {
        list: [{
          register: 'bell',
        }],
      },
    },
  },
  router: {
    enabled: true,
  },
};
