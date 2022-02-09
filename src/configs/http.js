const path = require('path');
const hbs = require('handlebars');

exports.http = {
  server: {
    handler: 'hapi',
    port: 3000,
    handlerConfig: {
      views: {
        engines: {
          hbs: {
            // NOTE: fix circular reference for handlebars
            // due to serialization issues with confidence module, which can't resolve
            // circular references (and it really shouldn't) we have to only extract 3 functions that we need
            // to perform rendering of the views
            //
            // Handlebars module is to blame, because it wants to be compatible with both ES6 modules & commonjs modules
            // and does this:
            //
            // handlebars[default] = handlebars
            // module.exports = handlerbars
            //
            compile: hbs.compile,
            registerPartial: hbs.registerPartial,
            registerHelper: hbs.registerHelper,
          },
        },
        path: path.resolve(__dirname, '../templates'),
      },
      plugins: {
        list: [{
          plugin: '@hapi/bell',
        }],
      },
    },
  },
};
