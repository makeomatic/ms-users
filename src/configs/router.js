const path = require('path');
const { routerExtension, ActionTransport } = require('mservice');

/**
 * Loads existing auth strategies
 */
const strategies = require('../auth/strategies');

/**
 * This extension defaults schemas to the name of the action
 * @type {Function}
 */
const autoSchema = routerExtension('validate/schemaLessAction');

/**
 * Provides audit log for every performed action
 * @type {Function}
 */
const auditLog = routerExtension('audit/log');

/**
 * Catches errors from oauth.facebook and wraps them into HTML
 * @type {Function}
 */
const postHandler = require('../auth/oauth/postHandler');

/**
 * Specifies configuration for the router of the microservice
 * @type {Object}
 */
exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'users',
    transports: [ActionTransport.amqp, ActionTransport.http],
  },
  extensions: {
    enabled: ['postRequest', 'preRequest', 'postHandler', 'preResponse'],
    register: [autoSchema, postHandler, auditLog],
  },
  auth: {
    strategies: {
      ...strategies,
    },
  },
};
