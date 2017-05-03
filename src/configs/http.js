exports.http = {
  server: {
    handler: 'hapi',
    port: 3000,
    handlerConfig: {
      views: {
        engines: {
          hbs: require('handlebars'),
        },
        path: '../templates',
        resolveTo: __dirname,
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
