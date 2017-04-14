#!/usr/bin/env node

let dir;
try {
  require('babel-register');
  dir = '../src';
} catch (e) {
  dir = '../lib';
}

// accepts conf through .env file
// suitable for configuring this in the docker env
const configuration = require('ms-conf');

// eslint-disable-next-line import/no-dynamic-require
const Service = require(dir);

const service = new Service(configuration.get('/'));

service.connect()
  .then(function serviceUp() {
    service.log.info('Started service, initiating admin accounts');
    return service.initAdminAccounts();
  })
  .tap(function initFakeAccounts() {
    if (process.env.NODE_ENV !== 'development') {
      return null;
    }

    return service.initFakeAccounts();
  })
  .catch(function serviceCrashed(err) {
    service.log.fatal('Failed to start service', err);
    setImmediate(function escapeTryCatch() {
      throw err;
    });
  });
