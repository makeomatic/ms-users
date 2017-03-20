const path = require('path');
const routerExtension = require('mservice').routerExtension;

/**
 * Loads existing auth strategies
 */
const { strategies } = require('../utils/oauth');
const jwt = require('../utils/jwtAuthStrategy');

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
 * Specifies configuration for the router of the microservice
 * @type {Object}
 */
exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'users',
    setTransportsAsDefault: true,
    transports: ['amqp'],
  },
  extensions: {
    enabled: ['postRequest', 'preRequest', 'preResponse'],
    register: [autoSchema, auditLog],
  },
  auth: {
    strategies: {
      ...strategies,
      jwt,
    },
  },
};
