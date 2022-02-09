const path = require('path');
const { Extensions: { auditLog } } = require('@microfleet/plugin-router');

/**
 * Loads existing auth strategies
 */
const strategies = require('../auth/strategies');

/**
 * This extension defaults schemas to the name of the action
 * @type {Function}
 */
// const autoSchema = routerExtension('validate/schemaLessAction');

/**
 * Provides prometheus metrics
 * @type {Function}
 */
// const metrics = routerExtension('audit/metrics');

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
      // autoSchema,
      preResponse,
      auditLog(),
      // metrics(),
    ],
  },
  auth: {
    strategies: {
      ...strategies,
    },
  },
};
