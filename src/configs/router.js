const path = require('path');
const { Extensions: { auditLog, validateTransportOptions, validateQueryStringParser } } = require('@microfleet/plugin-router');

/**
 * Loads existing auth strategies
 */
const strategies = require('../auth/strategies');

/**
 * Catches errors from oauth.facebook and wraps them into HTML
 * @type {Function}
 */
const preResponse = require('../auth/oauth/pre-response');

/**
 * Specifies configuration for the router of the microservice
 * @type {Object}
 */
exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'users',
    enabledGenericActions: ['health'],
  },
  extensions: {
    register: [
      preResponse,
      validateTransportOptions,
      validateQueryStringParser,
      auditLog(),
    ],
  },
  auth: {
    strategies: {
      ...strategies,
    },
  },
};
