# Microservice for handling users over AMQP transport layer

[![npm version](https://badge.fury.io/js/ms-users.svg)](https://badge.fury.io/js/ms-users)
[![Build Status](https://semaphoreci.com/api/v1/projects/27a0c3e3-ba64-49e1-a1be-7655eae716b9/632945/shields_badge.svg)](https://semaphoreci.com/makeomatic/ms-users)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![codecov.io](https://codecov.io/github/makeomatic/ms-users/coverage.svg?branch=master)](https://codecov.io/github/makeomatic/ms-users?branch=master)

## Installation

`npm i ms-users -S`

## Overview

Starts horizontally scalable nodejs worker communicating over amqp layer with redis cluster backend.
Supports a broad range of operations for working with users. Please refer to the configuration options for now,
that contains description of routes and their capabilities. Aims to provide a complete extendable solution to user's management.

## Configuration

1. Configuration options for plugins from https://github.com/makeomatic/mservice:
  * `redis` - options for https://github.com/luin/ioredis
  * `amqp`:
    * `connection`: options for https://github.com/dropbox/amqp-coffee
    * `queue` - which queue to listen
    * `prefix` - which prefix to listen
    * `postfix` - either object with filename : route name map or path to directory with actions
    * `initRoutes` - set to `false` to use custom postfix:action mapping
    * `initRouter` - set to `false` to use a custom router
  * `logger` - `true` / `false` / bunyan logger instance
  * `validator` - array of absolute or relative paths to validation schemas

2. Service configuration options
  * `debug` - Boolean. Defaults to `true` in `development` `NODE_ENV`
  * `deleteInactiveAccounts` - delete inactive account after X seconds
  * `pwdReset` - used to configure passwords that are generated in a reset email
    * `memorable`: Boolean
    * `length`: Number
  * `jwt` - json web token generation and validation options. Check https://github.com/auth0/node-jsonwebtoken
    * `defaultAudience` - namespace for metadata
    * `hashingFunction`
    * `issuer`
    * `secret` ***UPDATE TO YOUR OWN VALUE***
    * `ttl` how long to keep the token in the DB, milliseconds
    * `lockAfterAttempts` if set to val > 0 - locks account for `keepLoginAttempts` seconds after this many unsuccessful login attempts
    * `keepLoginAttempts` defaults to 3600 seconds
  * `validation` - configuration for validation emails
    * `secret` - specify your own, encodes json data with it so that people can't tamper tokens
    * `algorithm` - `aes-256-ctr`
    * `throttle` - don't send email more frequently than this, seconds
    * `ttl` - expire token in seconds
    * `paths` - generate URLs with these paths:
    * `subjects` - generate emails with these subjects
    * `senders` - generate emails with these senders
    * `templates` - template names
    * `email` - sender
  * `server` - used to generate URLs
    * `proto` - 'http' or 'https'
    * `host`
    * `port`
  * `mailer` - configuration for mailing microservice
  * `payments` - configuration for payments microservice
  * `admins` - admin accounts to init when starting service
  * `plugins` - enabled microservice plugins
  * `hooks`:
    `users:activate` - set to array of functions or a function. Will be performed after user is activated. Example of custom action is placed in src/custom

## Usage

`node ./bin/mservice.js` and send messages via AMQP

## Routes

0. `users.register` - register new user
0. `users.activate` - activate registered user
0. `users.challenge` - request activation challenge again
0. `users.login` - login and return token
0. `users.verify` - verify JWT token and return metadata
0. `users.logout` - invalidate token
0. `users.ban` - lock account
0. `users.list` - list users
0. `users.updateMetadata` - update metadata for a given user
0. `users.getMetadata` - get metadata for a given user
0. `users.requestPassword` - request password reset email
0. `users.updatePassword` - change password

## API

Currently consult `schemas` for message format that is required by any route. Filenames correspond to each other

## Roadmap

1. Register user:
  - [x] email, password + metadata
  - [ ] third party services
2. Validation challenges:
  - [x] email validation
  - [ ] sms
4. Auto-cleaning of accounts that failed their validation challenge
5. Login/Logout + JWT token issuing
6. Ability to erase all issued JWT tokens
7. Get and update user's metadata
8. Admin capabilities:
  - [x] listing, filtering, sorting and paginating users
  - [x] viewing info about a single user account
  - [x] un/locking user accounts
  - [x] updating user info
  - [x] pre-create admin accounts
1. Add extra features to registration:
 - [x] limit registrations per ip per time span
 - [x] reject known disposable email addresses
 - [ ] add text message validation
 - [ ] add ability to change username
2. Abstract storage options:
 - [ ] create abstract storage class
 - [ ] move interactions with redis to an abstract class
 - [ ] write docs about adding more storage options
3. Test coverage
4. Extra features for challenge:
 - [ ] be able to set metadata on request
 - [ ] record ip address for such a request
 - [ ] extra types of validation
5. Update Metadata:
 - [ ] Add/remove batch operations
 - [ ] support operations on multiple audiences
6. Ban:
 - [ ] Add security log
7. Logging serializers to remove passwords from logs
