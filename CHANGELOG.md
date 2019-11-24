## [12.1.1](https://github.com/makeomatic/ms-users/compare/v12.1.0...v12.1.1) (2019-11-24)


### Bug Fixes

* docker build size ([9959505](https://github.com/makeomatic/ms-users/commit/995950524f48581995e072902138a313e06c9874))
* improve logging & dlock startup ([3113e84](https://github.com/makeomatic/ms-users/commit/3113e84820b45421cc7700b5245d372a4c6e5645))

# [12.1.0](https://github.com/makeomatic/ms-users/compare/v12.0.0...v12.1.0) (2019-11-21)


### Features

* record user activation time ([#433](https://github.com/makeomatic/ms-users/issues/433)) ([9c8dec8](https://github.com/makeomatic/ms-users/commit/9c8dec8cc8626c36ecd925289f91c32d600d6622))

# [12.0.0](https://github.com/makeomatic/ms-users/compare/v11.4.0...v12.0.0) (2019-10-31)


### Features

* upgrade deps for node 12.13.0 ([#432](https://github.com/makeomatic/ms-users/issues/432)) ([d092478](https://github.com/makeomatic/ms-users/commit/d0924786a9274d655f19393033af26c369bf4115))


### BREAKING CHANGES

* removes scrypt for built-in crypto implementation, while API remains the same the underlaying library is slightly different. Node has changed a major version, too

# [11.4.0](https://github.com/makeomatic/ms-users/compare/v11.3.1...v11.4.0) (2019-10-03)


### Bug Fixes

* upgrade deps, ensure schemas are valid ([5b29710](https://github.com/makeomatic/ms-users/commit/5b29710))


### Features

* optional password strength checks ([#429](https://github.com/makeomatic/ms-users/issues/429)) ([63d8ffb](https://github.com/makeomatic/ms-users/commit/63d8ffb))

## [11.3.1](https://github.com/makeomatic/ms-users/compare/v11.3.0...v11.3.1) (2019-09-18)


### Bug Fixes

* added clear cache after remove user ([#426](https://github.com/makeomatic/ms-users/issues/426)) ([f85d4ea](https://github.com/makeomatic/ms-users/commit/f85d4ea))

# [11.3.0](https://github.com/makeomatic/ms-users/compare/v11.2.7...v11.3.0) (2019-09-13)


### Features

* **ms-users:** 429 error add more info ([#412](https://github.com/makeomatic/ms-users/issues/412)) ([6f989a8](https://github.com/makeomatic/ms-users/commit/6f989a8))

## [11.2.7](https://github.com/makeomatic/ms-users/compare/v11.2.6...v11.2.7) (2019-09-10)


### Bug Fixes

* stringify organization invite params in mail ([#423](https://github.com/makeomatic/ms-users/issues/423)) ([81366c0](https://github.com/makeomatic/ms-users/commit/81366c0))

## [11.2.6](https://github.com/makeomatic/ms-users/compare/v11.2.5...v11.2.6) (2019-09-10)


### Bug Fixes

* upgrade dependencies, make fb tests more reliable ([#424](https://github.com/makeomatic/ms-users/issues/424)) ([0825a6d](https://github.com/makeomatic/ms-users/commit/0825a6d))

## [11.2.5](https://github.com/makeomatic/ms-users/compare/v11.2.4...v11.2.5) (2019-08-24)


### Bug Fixes

* clear cache after remove organization ([#419](https://github.com/makeomatic/ms-users/issues/419)) ([fcc4ff0](https://github.com/makeomatic/ms-users/commit/fcc4ff0))

## [11.2.4](https://github.com/makeomatic/ms-users/compare/v11.2.3...v11.2.4) (2019-08-23)


### Bug Fixes

* added expiration param to organization list json schema ([#418](https://github.com/makeomatic/ms-users/issues/418)) ([701aae5](https://github.com/makeomatic/ms-users/commit/701aae5))

## [11.2.3](https://github.com/makeomatic/ms-users/compare/v11.2.2...v11.2.3) (2019-08-22)


### Bug Fixes

* fix remove organization member ([#417](https://github.com/makeomatic/ms-users/issues/417)) ([542ce96](https://github.com/makeomatic/ms-users/commit/542ce96))

## [11.2.2](https://github.com/makeomatic/ms-users/compare/v11.2.1...v11.2.2) (2019-08-20)


### Bug Fixes

* move member organizations to user metadata ([#416](https://github.com/makeomatic/ms-users/issues/416)) ([9f6d257](https://github.com/makeomatic/ms-users/commit/9f6d257))
* update flakeless, fixed deprecations ([cb37024](https://github.com/makeomatic/ms-users/commit/cb37024))

## [11.2.1](https://github.com/makeomatic/ms-users/compare/v11.2.0...v11.2.1) (2019-08-07)


### Bug Fixes

* update node to 10.16.1, chrome 76, last puppeteer ([5e548cd](https://github.com/makeomatic/ms-users/commit/5e548cd))

# [11.2.0](https://github.com/makeomatic/ms-users/compare/v11.1.2...v11.2.0) (2019-08-04)


### Features

* added handling custom audience to organization api ([#413](https://github.com/makeomatic/ms-users/issues/413)) ([a66e97a](https://github.com/makeomatic/ms-users/commit/a66e97a))

## [11.1.2](https://github.com/makeomatic/ms-users/compare/v11.1.1...v11.1.2) (2019-07-24)


### Bug Fixes

* edited qs in organization invite link ([#410](https://github.com/makeomatic/ms-users/issues/410)) ([f3b9c15](https://github.com/makeomatic/ms-users/commit/f3b9c15))

## [11.1.1](https://github.com/makeomatic/ms-users/compare/v11.1.0...v11.1.1) (2019-07-16)


### Bug Fixes

* update deps ([b2fed65](https://github.com/makeomatic/ms-users/commit/b2fed65))

# [11.1.0](https://github.com/makeomatic/ms-users/compare/v11.0.0...v11.1.0) (2019-06-28)


### Features

* reset of throttle on successful verification ([c08dcd4](https://github.com/makeomatic/ms-users/commit/c08dcd4))

# [11.0.0](https://github.com/makeomatic/ms-users/compare/v10.6.3...v11.0.0) (2019-06-27)


### Features

* upgrade deps, move hapi to @hapi/hapi, enable oauth tests ([49cc46d](https://github.com/makeomatic/ms-users/commit/49cc46d))


### BREAKING CHANGES

* requires newer node versions, dependencies had breaking changes

## [10.6.3](https://github.com/makeomatic/ms-users/compare/v10.6.2...v10.6.3) (2019-06-18)


### Bug Fixes

* edit audience for register organization members ([#409](https://github.com/makeomatic/ms-users/issues/409)) ([49099c0](https://github.com/makeomatic/ms-users/commit/49099c0))

## [10.6.2](https://github.com/makeomatic/ms-users/compare/v10.6.1...v10.6.2) (2019-06-17)


### Bug Fixes

* upgrade microfleet core ([#408](https://github.com/makeomatic/ms-users/issues/408)) ([df515c8](https://github.com/makeomatic/ms-users/commit/df515c8))

## [10.6.1](https://github.com/makeomatic/ms-users/compare/v10.6.0...v10.6.1) (2019-06-17)


### Bug Fixes

* edited generate password, send invite mail ([#407](https://github.com/makeomatic/ms-users/issues/407)) ([4312113](https://github.com/makeomatic/ms-users/commit/4312113))

# [10.6.0](https://github.com/makeomatic/ms-users/compare/v10.5.1...v10.6.0) (2019-06-10)


### Features

* added register new organization members ([#406](https://github.com/makeomatic/ms-users/issues/406)) ([8629369](https://github.com/makeomatic/ms-users/commit/8629369))

## [10.5.1](https://github.com/makeomatic/ms-users/compare/v10.5.0...v10.5.1) (2019-06-06)


### Bug Fixes

* edited send organization invite mail ([#404](https://github.com/makeomatic/ms-users/issues/404)) ([f97cf8b](https://github.com/makeomatic/ms-users/commit/f97cf8b))

# [10.5.0](https://github.com/makeomatic/ms-users/compare/v10.4.8...v10.5.0) (2019-04-25)


### Features

* verify ban status on metadata request ([#403](https://github.com/makeomatic/ms-users/issues/403)) ([4f8baa6](https://github.com/makeomatic/ms-users/commit/4f8baa6))

## [10.4.8](https://github.com/makeomatic/ms-users/compare/v10.4.7...v10.4.8) (2019-04-22)


### Bug Fixes

* update deps ([#402](https://github.com/makeomatic/ms-users/issues/402)) ([2e74c99](https://github.com/makeomatic/ms-users/commit/2e74c99))

## [10.4.7](https://github.com/makeomatic/ms-users/compare/v10.4.6...v10.4.7) (2019-04-18)


### Bug Fixes

* parse organization internal data ([#401](https://github.com/makeomatic/ms-users/issues/401)) ([219b52b](https://github.com/makeomatic/ms-users/commit/219b52b))

## [10.4.6](https://github.com/makeomatic/ms-users/compare/v10.4.5...v10.4.6) (2019-04-17)


### Bug Fixes

* edited remove organization name ([#400](https://github.com/makeomatic/ms-users/issues/400)) ([4009d7f](https://github.com/makeomatic/ms-users/commit/4009d7f))

## [10.4.5](https://github.com/makeomatic/ms-users/compare/v10.4.4...v10.4.5) (2019-04-15)


### Bug Fixes

* fix edit organisation member permissions ([#399](https://github.com/makeomatic/ms-users/issues/399)) ([358907b](https://github.com/makeomatic/ms-users/commit/358907b))

## [10.4.4](https://github.com/makeomatic/ms-users/compare/v10.4.3...v10.4.4) (2019-04-15)


### Bug Fixes

* edited response format for organization member permissions ([#398](https://github.com/makeomatic/ms-users/issues/398)) ([a0797a6](https://github.com/makeomatic/ms-users/commit/a0797a6))
* edited responses in organization docs ([#397](https://github.com/makeomatic/ms-users/issues/397)) ([1a38517](https://github.com/makeomatic/ms-users/commit/1a38517))

## [10.4.3](https://github.com/makeomatic/ms-users/compare/v10.4.2...v10.4.3) (2019-04-10)


### Bug Fixes

* edited organizations response ([#396](https://github.com/makeomatic/ms-users/issues/396)) ([bf11f46](https://github.com/makeomatic/ms-users/commit/bf11f46))

## [10.4.2](https://github.com/makeomatic/ms-users/compare/v10.4.1...v10.4.2) (2019-04-01)


### Bug Fixes

* removed auth on organization api ([#395](https://github.com/makeomatic/ms-users/issues/395)) ([1b8f5bd](https://github.com/makeomatic/ms-users/commit/1b8f5bd))

## [10.4.1](https://github.com/makeomatic/ms-users/compare/v10.4.0...v10.4.1) (2019-03-31)


### Bug Fixes

* node version ([ac18c08](https://github.com/makeomatic/ms-users/commit/ac18c08))

# [10.4.0](https://github.com/makeomatic/ms-users/compare/v10.3.3...v10.4.0) (2019-03-29)


### Bug Fixes

* support redis sentinel in migrations ([#394](https://github.com/makeomatic/ms-users/issues/394)) ([562608a](https://github.com/makeomatic/ms-users/commit/562608a))


### Features

* organizations api ([#393](https://github.com/makeomatic/ms-users/issues/393)) ([1b7c7ab](https://github.com/makeomatic/ms-users/commit/1b7c7ab))

## [10.3.3](https://github.com/makeomatic/ms-users/compare/v10.3.2...v10.3.3) (2019-02-15)


### Bug Fixes

* added users total count to list response ([#392](https://github.com/makeomatic/ms-users/issues/392)) ([27ee712](https://github.com/makeomatic/ms-users/commit/27ee712))

## [10.3.2](https://github.com/makeomatic/ms-users/compare/v10.3.1...v10.3.2) (2019-02-11)


### Bug Fixes

* add roles to init admins ([#391](https://github.com/makeomatic/ms-users/issues/391)) ([8011a71](https://github.com/makeomatic/ms-users/commit/8011a71))

## [10.3.1](https://github.com/makeomatic/ms-users/compare/v10.3.0...v10.3.1) (2019-02-09)

# [10.3.0](https://github.com/makeomatic/ms-users/compare/v10.2.5...v10.3.0) (2019-02-08)


### Features

* upgrade dependencies ([8a120ef](https://github.com/makeomatic/ms-users/commit/8a120ef))

## [10.2.5](https://github.com/makeomatic/ms-users/compare/v10.2.4...v10.2.5) (2018-12-23)


### Bug Fixes

* sentry logger ([672c27c](https://github.com/makeomatic/ms-users/commit/672c27c))

## [10.2.4](https://github.com/makeomatic/ms-users/compare/v10.2.3...v10.2.4) (2018-12-21)


### Bug Fixes

* sentry logger ([7e58b1d](https://github.com/makeomatic/ms-users/commit/7e58b1d))
* upgrade deps ([bb71c52](https://github.com/makeomatic/ms-users/commit/bb71c52))

## [10.2.3](https://github.com/makeomatic/ms-users/compare/v10.2.2...v10.2.3) (2018-12-20)


### Bug Fixes

* sentry logging ([6808593](https://github.com/makeomatic/ms-users/commit/6808593))

## [10.2.2](https://github.com/makeomatic/ms-users/compare/v10.2.1...v10.2.2) (2018-12-20)


### Bug Fixes

* upgrade deps ([0c37902](https://github.com/makeomatic/ms-users/commit/0c37902))

## [10.2.1](https://github.com/makeomatic/ms-users/compare/v10.2.0...v10.2.1) (2018-12-17)


### Bug Fixes

* missing context ([bcc61d9](https://github.com/makeomatic/ms-users/commit/bcc61d9))

# [10.2.0](https://github.com/makeomatic/ms-users/compare/v10.1.1...v10.2.0) (2018-12-16)


### Features

* facebook oauth mfa ([#388](https://github.com/makeomatic/ms-users/issues/388)) ([8f09b15](https://github.com/makeomatic/ms-users/commit/8f09b15))

## [10.1.1](https://github.com/makeomatic/ms-users.git/compare/v10.1.0...v10.1.1) (2018-11-07)


### Bug Fixes

* correct headers location in AMQP ([e64441b](https://github.com/makeomatic/ms-users.git/commit/e64441b))

# [10.1.0](https://github.com/makeomatic/ms-users.git/compare/v10.0.6...v10.1.0) (2018-11-07)


### Features

* check params for totp, report clock skew ([#387](https://github.com/makeomatic/ms-users.git/issues/387)) ([d366bb4](https://github.com/makeomatic/ms-users.git/commit/d366bb4))

## [10.0.6](https://github.com/makeomatic/ms-users.git/compare/v10.0.5...v10.0.6) (2018-11-07)


### Bug Fixes

* mfa adjustment ([#386](https://github.com/makeomatic/ms-users.git/issues/386)) ([58c0337](https://github.com/makeomatic/ms-users.git/commit/58c0337))

## [10.0.5](https://github.com/makeomatic/ms-users.git/compare/v10.0.4...v10.0.5) (2018-11-05)


### Bug Fixes

* mfa internals updated ([#385](https://github.com/makeomatic/ms-users.git/issues/385)) ([6d82f95](https://github.com/makeomatic/ms-users.git/commit/6d82f95))

## [10.0.4](https://github.com/makeomatic/ms-users.git/compare/v10.0.3...v10.0.4) (2018-10-28)


### Bug Fixes

* global login counter redis op ([c133d9e](https://github.com/makeomatic/ms-users.git/commit/c133d9e))

## [10.0.3](https://github.com/makeomatic/ms-users.git/compare/v10.0.2...v10.0.3) (2018-10-27)


### Bug Fixes

* update deps ([f2fd70b](https://github.com/makeomatic/ms-users.git/commit/f2fd70b))

## [10.0.2](https://github.com/makeomatic/ms-users/compare/v10.0.1...v10.0.2) (2018-10-27)


### Bug Fixes

* update [@microfleet](https://github.com/microfleet)/core ([2e7e52b](https://github.com/makeomatic/ms-users/commit/2e7e52b))

## [10.0.1](https://github.com/makeomatic/ms-users/compare/v10.0.0...v10.0.1) (2018-10-26)


### Bug Fixes

* updates deps ([#384](https://github.com/makeomatic/ms-users/issues/384)) ([9cdb298](https://github.com/makeomatic/ms-users/commit/9cdb298))

# [10.0.0](https://github.com/makeomatic/ms-users/compare/v9.5.0...v10.0.0) (2018-10-16)


### Features

* use [@microfleet](https://github.com/microfleet)/validation ([#383](https://github.com/makeomatic/ms-users/issues/383)) ([311334d](https://github.com/makeomatic/ms-users/commit/311334d))


### BREAKING CHANGES

* uses new @microfleet/validation, potentially changing returned error types. Adds new global remote ip login tracker

# [9.5.0](https://github.com/makeomatic/ms-users/compare/v9.4.4...v9.5.0) (2018-10-04)


### Features

* updated deps ([f65a5a7](https://github.com/makeomatic/ms-users/commit/f65a5a7))

## [9.4.4](https://github.com/makeomatic/ms-users/compare/v9.4.3...v9.4.4) (2018-08-20)


### Bug Fixes

* removes username to user id reference ([#382](https://github.com/makeomatic/ms-users/issues/382)) ([e066994](https://github.com/makeomatic/ms-users/commit/e066994))

## [9.4.3](https://github.com/makeomatic/ms-users/compare/v9.4.2...v9.4.3) (2018-08-16)


### Bug Fixes

* TFA -> MFA ([#380](https://github.com/makeomatic/ms-users/issues/380)) ([96fdad5](https://github.com/makeomatic/ms-users/commit/96fdad5))

## [9.4.2](https://github.com/makeomatic/ms-users/compare/v9.4.1...v9.4.2) (2018-07-10)


### Bug Fixes

* invalid key ([4cbe39f](https://github.com/makeomatic/ms-users/commit/4cbe39f))

## [9.4.1](https://github.com/makeomatic/ms-users/compare/v9.4.0...v9.4.1) (2018-07-10)


### Bug Fixes

* **assign-affiliate:** metaKey & rem from old index during overwrite ([38bc125](https://github.com/makeomatic/ms-users/commit/38bc125))

# [9.4.0](https://github.com/makeomatic/ms-users/compare/v9.3.2...v9.4.0) (2018-07-09)


### Features

* **bin:** assign affiliate ([1288b1d](https://github.com/makeomatic/ms-users/commit/1288b1d))

## [9.3.2](https://github.com/makeomatic/ms-users/compare/v9.3.1...v9.3.2) (2018-07-05)

## [9.3.1](https://github.com/makeomatic/ms-users/compare/v9.3.0...v9.3.1) (2018-06-06)


### Bug Fixes

* http-bearer, release chores ([2c6ef84](https://github.com/makeomatic/ms-users/commit/2c6ef84))
* request.method -> request.transport ([2b48601](https://github.com/makeomatic/ms-users/commit/2b48601))
