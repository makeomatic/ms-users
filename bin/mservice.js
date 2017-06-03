#!/usr/bin/env node

let dir;
try {
  require('babel-register');
  dir = '../src';
} catch (e) {
  dir = '../lib';
}

const Service = require(dir); // eslint-disable-line import/no-dynamic-require
const service = new Service();
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
