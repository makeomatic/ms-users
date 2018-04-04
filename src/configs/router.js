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
 * Catches errors from oauth.facebook and wraps them into HTML
 * @type {Function}
 */
const preResponse = require('../auth/oauth/preResponse');

/**
 * Specifies configuration for the router of the microservice
 * @type {Object}
 */
exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'users',
    transports: [ActionTransport.amqp, ActionTransport.http, ActionTransport.internal],
  },
  extensions: {
    enabled: ['postRequest', 'preRequest', 'preResponse'],
    register: [autoSchema, preResponse, auditLog],
  },
  auth: {
    strategies: {
      ...strategies,
    },
  },
};
