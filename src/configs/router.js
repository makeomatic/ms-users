const path = require('path');
const { routerExtension, ActionTransport } = require('@microfleet/core');

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
 * Provides prometheus metrics
 * @type {Function}
 */
const metrics = routerExtension('audit/metrics');

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
    transports: [ActionTransport.amqp, ActionTransport.http, ActionTransport.internal],
    enabledGenericActions: ['health'],
  },
  extensions: {
    enabled: ['preRequest', 'postRequest', 'postValidate', 'preResponse', 'postResponse'],
    register: [autoSchema, preResponse, auditLog(), metrics()],
  },
  auth: {
    strategies: {
      ...strategies,
    },
  },
};
