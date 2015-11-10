#!/usr/bin/env node

'use strict';

// accepts conf through .env file
// suitable for configuring this in the docker env
var configuration = require('ms-amqp-conf');

var dir;
if (process.env.NODE_ENV === 'production') {
  dir = '../lib';
} else {
  dir = '../src';
  require('../test/babelhook.js');
}

var Service = require(dir);
var service = new Service(configuration);
return service.connect()
  .catch(function serviceCrashed(err) {
    setImmediate(function escapeTryCatch() {
      throw err;
    });
  });
