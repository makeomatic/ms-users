## [15.10.2](https://github.com/makeomatic/ms-users/compare/v15.10.1...v15.10.2) (2023-03-09)


### Bug Fixes

* redis parameter name validation ([#585](https://github.com/makeomatic/ms-users/issues/585)) ([636cbe2](https://github.com/makeomatic/ms-users/commit/636cbe224adb4dc8ef400275a267802efa65a719))

## [15.10.1](https://github.com/makeomatic/ms-users/compare/v15.10.0...v15.10.1) (2023-03-08)


### Bug Fixes

* redis search improvements ([#584](https://github.com/makeomatic/ms-users/issues/584)) ([6411075](https://github.com/makeomatic/ms-users/commit/6411075b326c24aa4bd7f86c7a3431b00f741762))

# [15.10.0](https://github.com/makeomatic/ms-users/compare/v15.9.0...v15.10.0) (2023-03-07)


### Features

* embed extra fields in old jwt ([#583](https://github.com/makeomatic/ms-users/issues/583)) ([097b658](https://github.com/makeomatic/ms-users/commit/097b6582a0df27edfa5df23e7e4e8a151a913e49))

# [15.9.0](https://github.com/makeomatic/ms-users/compare/v15.8.1...v15.9.0) (2023-01-31)


### Features

* allow amqp publishOptions in phone/mailer service integration ([6596e4f](https://github.com/makeomatic/ms-users/commit/6596e4fd54441ba1db46822f2e0943ad68bf64b6))

## [15.8.1](https://github.com/makeomatic/ms-users/compare/v15.8.0...v15.8.1) (2023-01-27)


### Bug Fixes

* upgrade deps ([1b86dc5](https://github.com/makeomatic/ms-users/commit/1b86dc582019c19f4c4a95ef01c675779cffe590))

# [15.8.0](https://github.com/makeomatic/ms-users/compare/v15.7.3...v15.8.0) (2023-01-17)


### Features

* get-metadata improvements ([5e61461](https://github.com/makeomatic/ms-users/commit/5e61461808c1096cc53bc51d73438f566183803d))

## [15.7.3](https://github.com/makeomatic/ms-users/compare/v15.7.2...v15.7.3) (2023-01-09)


### Bug Fixes

* add aggregation search method ([20e71a9](https://github.com/makeomatic/ms-users/commit/20e71a955192dfc77c27ef6d83a8f80ee39502d6))
* import RedisSerachIndexes class ([7125be1](https://github.com/makeomatic/ms-users/commit/7125be120b7da3ec2819109d4bc6638ae1434e6f))
* restore active user index name ([8cde91a](https://github.com/makeomatic/ms-users/commit/8cde91a698d95a423c3778a9c39282598806b0a3))
* small redis search improvements ([5755464](https://github.com/makeomatic/ms-users/commit/5755464fe7149e42595b3bd294bc35466d87b841))
* token match query builder ([9ea2879](https://github.com/makeomatic/ms-users/commit/9ea2879b8c4d4c9dcccc5a84370b3a4bfbf93632))

## [15.7.2](https://github.com/makeomatic/ms-users/compare/v15.7.1...v15.7.2) (2022-12-10)


### Bug Fixes

* await return on try/Catch ([bc3df6a](https://github.com/makeomatic/ms-users/commit/bc3df6a247d90c3d41254ce9744432bca2798f97))

## [15.7.1](https://github.com/makeomatic/ms-users/compare/v15.7.0...v15.7.1) (2022-12-09)


### Bug Fixes

* log & unused template string ([a05a722](https://github.com/makeomatic/ms-users/commit/a05a722a438969703f5a5f7d2673ea3db811c63b))
* suppress error on FT index creation ([c7c6444](https://github.com/makeomatic/ms-users/commit/c7c6444918394b9665aab143530e17f53b5f3742))

# [15.7.0](https://github.com/makeomatic/ms-users/compare/v15.6.8...v15.7.0) (2022-11-21)


### Bug Fixes

* add connector for ensure indexes ([8328f2e](https://github.com/makeomatic/ms-users/commit/8328f2eee64c751bf5b365fa44057f3ccf6f4c9e))
* add predefined users for serach tests ([f2d4cce](https://github.com/makeomatic/ms-users/commit/f2d4cceb4d8f2f60066a48549befbdd07c2e2d03))
* add redis search config ([6b08c9e](https://github.com/makeomatic/ms-users/commit/6b08c9e6c11210de6b72531c6a8246cef59efe92))
* add redis search expressions utils ([ff380d7](https://github.com/makeomatic/ms-users/commit/ff380d79a55949b7f3853292cbc79577cc8d581e))
* add redisSearchIds skeleton ([a226c1d](https://github.com/makeomatic/ms-users/commit/a226c1de6af0d0f29955cc430a3598a1826f4ce9))
* add test case for redis search impl ([931c1e2](https://github.com/makeomatic/ms-users/commit/931c1e208d8fe4995f07211fcc84c221e9545119))
* add tokenization utils ([7d9fb03](https://github.com/makeomatic/ms-users/commit/7d9fb03e68e42f32845781a0e02ec8d2be114194))
* add uniq for user search result ([90cefcc](https://github.com/makeomatic/ms-users/commit/90cefcc5db3e3e089c9b04de3b715374895d977e))
* bump dependencies ([61187c5](https://github.com/makeomatic/ms-users/commit/61187c5df6154907c5ac74b967107c288ea668e7))
* correct search filter function ([e88e14d](https://github.com/makeomatic/ms-users/commit/e88e14dcdbdc6f71f8bdab43fea0a813b0e0c1bd))
* create indexes depends on audience array ([7634a02](https://github.com/makeomatic/ms-users/commit/7634a0284423864afc336347cb8749fc18008562))
* extend index definitions with  multi-words ([77bb74c](https://github.com/makeomatic/ms-users/commit/77bb74c3b061b953af9072ce71214b41faa84312))
* generalize with fsort format for total ([2159e37](https://github.com/makeomatic/ms-users/commit/2159e37c2358788e8d25bdac9028915c03479345))
* normalize index name, improve tests ([5d03ce3](https://github.com/makeomatic/ms-users/commit/5d03ce315f7287499f207faf17ef737c525b7747))
* obtain fetch data key from search config ([ed49c1d](https://github.com/makeomatic/ms-users/commit/ed49c1d3919a4f3d25cc95a6d6f69bbfbc41fb98))
* obtain total for search differently ([1fca49a](https://github.com/makeomatic/ms-users/commit/1fca49a9ef9a6a8c38a185470bf77583d514783f))
* query actions impl, more tests ([e9ceac8](https://github.com/makeomatic/ms-users/commit/e9ceac8dba387eb40c5ba5cd4b390b58191910e3))
* redis search ids with additional data fetch ([c286b01](https://github.com/makeomatic/ms-users/commit/c286b01ba199d345a4d073c0025c31bdabd871c3))
* redis search params builders ([432c6bb](https://github.com/makeomatic/ms-users/commit/432c6bbe03cdc7a8afd53f2d18c05904b2700a42))
* **redis-search:** add config, ensure indexes utility ([a37a76d](https://github.com/makeomatic/ms-users/commit/a37a76de1396d1a2db8a30766a5e67c92af6a967))
* register FT index by audience ([d95f62f](https://github.com/makeomatic/ms-users/commit/d95f62fe5abdc7587b0dec3e9ec356f3c45f09a9))
* rename function ([a7606bb](https://github.com/makeomatic/ms-users/commit/a7606bb0a3a57c3f6a6ea6c0458f4d8075ddc96a))
* restore back compatobility for bin ([dc2428f](https://github.com/makeomatic/ms-users/commit/dc2428f6439d1a83c11a94f6fa5021832b80fa85))
* search using tokenization for multi-word params ([e42bd62](https://github.com/makeomatic/ms-users/commit/e42bd629ce311b1f7060963c3b6cc4379506e727))
* sort lua script paramenters ([52d84df](https://github.com/makeomatic/ms-users/commit/52d84df31f5dfa36e4f55f56c2703160421f787c))
* update expressions module export ([bb41b9c](https://github.com/makeomatic/ms-users/commit/bb41b9c6eeb82f65b748efe86d638d2416b2e534))
* use redis search filter ([05d2d00](https://github.com/makeomatic/ms-users/commit/05d2d008763eccd7c5b6ebb718b5e9cf40bc26ae))


### Features

* update deps, include index versioning ([f9d490e](https://github.com/makeomatic/ms-users/commit/f9d490e520b196de2da037b35c0efd728e858a13))

## [15.6.8](https://github.com/makeomatic/ms-users/compare/v15.6.7...v15.6.8) (2022-10-07)


### Bug Fixes

* update deps, node 18 docker image ([#575](https://github.com/makeomatic/ms-users/issues/575)) ([4dff7eb](https://github.com/makeomatic/ms-users/commit/4dff7eb69eae1932cb91371e898297106a958881))

## [15.6.7](https://github.com/makeomatic/ms-users/compare/v15.6.6...v15.6.7) (2022-10-07)


### Bug Fixes

* bump microfleet amqp plugin ([#574](https://github.com/makeomatic/ms-users/issues/574)) ([2181457](https://github.com/makeomatic/ms-users/commit/2181457ba8a8d4a2f10d89e5ba79b44912719fd1))

## [15.6.6](https://github.com/makeomatic/ms-users/compare/v15.6.5...v15.6.6) (2022-07-15)


### Bug Fixes

* **invite:** set accepted for existing users ([#571](https://github.com/makeomatic/ms-users/issues/571)) ([8c454fe](https://github.com/makeomatic/ms-users/commit/8c454fe5b8d9984e06fba72e53d9915d8b3bfd38))
* validate signature using raw body ([#567](https://github.com/makeomatic/ms-users/issues/567)) ([16142ca](https://github.com/makeomatic/ms-users/commit/16142caf4cfd649c16499cf8818c099310274f48))

## [15.6.5](https://github.com/makeomatic/ms-users/compare/v15.6.4...v15.6.5) (2022-07-05)


### Bug Fixes

* **user-org-list:** add joined_at to response by username ([#569](https://github.com/makeomatic/ms-users/issues/569)) ([b73e272](https://github.com/makeomatic/ms-users/commit/b73e27261425c41e0c7af0bb82b95097a97b1604))

## [15.6.4](https://github.com/makeomatic/ms-users/compare/v15.6.3...v15.6.4) (2022-06-26)


### Bug Fixes

* validation host configuration ([#566](https://github.com/makeomatic/ms-users/issues/566)) ([9362e4a](https://github.com/makeomatic/ms-users/commit/9362e4abc5f2360515b0739396be5953d70d89ca))

## [15.6.3](https://github.com/makeomatic/ms-users/compare/v15.6.2...v15.6.3) (2022-06-23)


### Bug Fixes

* verify email on activate ([#565](https://github.com/makeomatic/ms-users/issues/565)) ([5e4f13f](https://github.com/makeomatic/ms-users/commit/5e4f13f6c4ee8af9edf33f5fe4d3eaa0d6449d73))

## [15.6.2](https://github.com/makeomatic/ms-users/compare/v15.6.1...v15.6.2) (2022-06-21)


### Bug Fixes

* wrap verify signature error with 403 ([#564](https://github.com/makeomatic/ms-users/issues/564)) ([455cc4e](https://github.com/makeomatic/ms-users/commit/455cc4e74814e38d82b5b15bf6b30879025f9477))

## [15.6.1](https://github.com/makeomatic/ms-users/compare/v15.6.0...v15.6.1) (2022-06-20)


### Bug Fixes

* remove unchalleged contact ([#563](https://github.com/makeomatic/ms-users/issues/563)) ([21f82b0](https://github.com/makeomatic/ms-users/commit/21f82b0780b077f17194990eeda0fc0c3b132602))

# [15.6.0](https://github.com/makeomatic/ms-users/compare/v15.5.0...v15.6.0) (2022-06-09)


### Features

* http-signature based auth + sign tokens ([#560](https://github.com/makeomatic/ms-users/issues/560)) ([247db24](https://github.com/makeomatic/ms-users/commit/247db2426354c6e13b22c18ecd9c3fbd2d36299e))

# [15.5.0](https://github.com/makeomatic/ms-users/compare/v15.4.1...v15.5.0) (2022-06-02)


### Features

* verifiable contact email ([#562](https://github.com/makeomatic/ms-users/issues/562)) ([158e875](https://github.com/makeomatic/ms-users/commit/158e8757b04a5abbd0e62fc2dbdc7e3ce93a01f6))

## [15.4.1](https://github.com/makeomatic/ms-users/compare/v15.4.0...v15.4.1) (2022-05-16)


### Bug Fixes

* longer time for dumping ([d907e13](https://github.com/makeomatic/ms-users/commit/d907e13dc14950511ecf041070e79c30b1049fc1))

# [15.4.0](https://github.com/makeomatic/ms-users/compare/v15.3.4...v15.4.0) (2022-05-13)


### Features

* return organization list by username ([#561](https://github.com/makeomatic/ms-users/issues/561)) ([3f70955](https://github.com/makeomatic/ms-users/commit/3f70955d7b2802829b0f831ed35779f746cf6e36))

## [15.3.4](https://github.com/makeomatic/ms-users/compare/v15.3.3...v15.3.4) (2022-05-11)


### Bug Fixes

* save masters id for the previously registered users ([#558](https://github.com/makeomatic/ms-users/issues/558)) ([198eb9f](https://github.com/makeomatic/ms-users/commit/198eb9f6ce062fb7fe20b7efdb7c174b6f8c6a36))

## [15.3.3](https://github.com/makeomatic/ms-users/compare/v15.3.2...v15.3.3) (2022-05-03)


### Bug Fixes

* wrap sso token error with 403 ([#559](https://github.com/makeomatic/ms-users/issues/559)) ([971824c](https://github.com/makeomatic/ms-users/commit/971824c38c07cd335fd7acff8ad3abcb79751130))

## [15.3.2](https://github.com/makeomatic/ms-users/compare/v15.3.1...v15.3.2) (2022-04-25)


### Bug Fixes

* restore jsonwebtoken usage for apple sign-in ([#557](https://github.com/makeomatic/ms-users/issues/557)) ([ff8db5a](https://github.com/makeomatic/ms-users/commit/ff8db5a75e30394b8f32f318f05d0220d50a3705))

## [15.3.1](https://github.com/makeomatic/ms-users/compare/v15.3.0...v15.3.1) (2022-04-21)


### Bug Fixes

* **stateless-token:** refresh token strategy ([#556](https://github.com/makeomatic/ms-users/issues/556)) ([33003f0](https://github.com/makeomatic/ms-users/commit/33003f089f61e2e86d9348687bcfcc499cb30b60))

# [15.3.0](https://github.com/makeomatic/ms-users/compare/v15.2.1...v15.3.0) (2022-04-19)


### Features

* encrypted stateless tokens ([#554](https://github.com/makeomatic/ms-users/issues/554)) ([c4b1a24](https://github.com/makeomatic/ms-users/commit/c4b1a24198b97814bbb0c08f3ed190a9b1608182))

## [15.2.1](https://github.com/makeomatic/ms-users/compare/v15.2.0...v15.2.1) (2022-04-07)


### Bug Fixes

* masters multi-pool support ([03e6f42](https://github.com/makeomatic/ms-users/commit/03e6f4271dcb1e55204ebbde5fbc1b87e353a953))

# [15.2.0](https://github.com/makeomatic/ms-users/compare/v15.1.7...v15.2.0) (2022-04-05)


### Features

* stateless auth ([#552](https://github.com/makeomatic/ms-users/issues/552)) ([99a2ac0](https://github.com/makeomatic/ms-users/commit/99a2ac0836e00de6f10c70c03020a945cf26f04a)), closes [#519](https://github.com/makeomatic/ms-users/issues/519) [#529](https://github.com/makeomatic/ms-users/issues/529) [#530](https://github.com/makeomatic/ms-users/issues/530) [#531](https://github.com/makeomatic/ms-users/issues/531)

## [15.1.7](https://github.com/makeomatic/ms-users/compare/v15.1.6...v15.1.7) (2022-04-05)


### Bug Fixes

* generate random name for bypass user ([#551](https://github.com/makeomatic/ms-users/issues/551)) ([4f0085e](https://github.com/makeomatic/ms-users/commit/4f0085e2bd5e4a6c7d19651d695ea8ba3fdecf53))

## [15.1.6](https://github.com/makeomatic/ms-users/compare/v15.1.5...v15.1.6) (2022-04-04)


### Bug Fixes

* remove permissions required from accept invite ([#549](https://github.com/makeomatic/ms-users/issues/549)) ([fc246f5](https://github.com/makeomatic/ms-users/commit/fc246f5145365d6e9634d9b6eab27b68c6cd48d7))

## [15.1.5](https://github.com/makeomatic/ms-users/compare/v15.1.4...v15.1.5) (2022-03-28)


### Bug Fixes

* upgrade deps ([89af4a6](https://github.com/makeomatic/ms-users/commit/89af4a6f3acdb74a18af59da492a049c85427f32))

## [15.1.4](https://github.com/makeomatic/ms-users/compare/v15.1.3...v15.1.4) (2022-03-25)


### Bug Fixes

* upgrade dependencies ([49cb026](https://github.com/makeomatic/ms-users/commit/49cb0268fa8fbcc619e03dd601ba367132891698))
* upgrade deps, swap out faker for @faker-js/faker ([cece5ce](https://github.com/makeomatic/ms-users/commit/cece5ceb000e81327de744f081acfc8816c7334b))

## [15.1.3](https://github.com/makeomatic/ms-users/compare/v15.1.2...v15.1.3) (2022-03-24)


### Bug Fixes

* catch phone challenge error ([db16a3e](https://github.com/makeomatic/ms-users/commit/db16a3ecfe4d8b9f8ab067c747e431e764b24a7d))

## [15.1.2](https://github.com/makeomatic/ms-users/compare/v15.1.1...v15.1.2) (2022-03-23)


### Bug Fixes

* transport-amqp ([97d67ad](https://github.com/makeomatic/ms-users/commit/97d67adf5ac9fa6c73a2233a905c56b1e6e3afbc))

## [15.1.1](https://github.com/makeomatic/ms-users/compare/v15.1.0...v15.1.1) (2022-03-23)


### Bug Fixes

* updated transport-amqp ([67c94bd](https://github.com/makeomatic/ms-users/commit/67c94bdcc3d08ffee4ba7222fd7ae031336ab260))

# [15.1.0](https://github.com/makeomatic/ms-users/compare/v15.0.6...v15.1.0) (2022-03-23)


### Bug Fixes

* bump dev deps ([b7eb065](https://github.com/makeomatic/ms-users/commit/b7eb0651d55a162cd597507c11bf0743e3bbabfd))
* bump dev deps ([98578b7](https://github.com/makeomatic/ms-users/commit/98578b79ba0b15afa385732ba46c950818e0d300))


### Features

* pump core, amqp transport ([42ee21f](https://github.com/makeomatic/ms-users/commit/42ee21f8b42abea512b7e1ae042c8a27f2517ae4))
* pump microfleet ([02263d8](https://github.com/makeomatic/ms-users/commit/02263d8b039f556fb2ef6b49ca99398c5534a9ea))

## [15.0.6](https://github.com/makeomatic/ms-users/compare/v15.0.5...v15.0.6) (2022-03-22)


### Bug Fixes

* user id pattern expansion ([9f5801c](https://github.com/makeomatic/ms-users/commit/9f5801c13b7fa0be953fe17f7a33e2b5f4473caf))

## [15.0.5](https://github.com/makeomatic/ms-users/compare/v15.0.4...v15.0.5) (2022-03-22)


### Bug Fixes

* enable numeric ids for masters ([1e79a93](https://github.com/makeomatic/ms-users/commit/1e79a93728d64bf4ae60152e5438082dba5ae318))

## [15.0.4](https://github.com/makeomatic/ms-users/compare/v15.0.3...v15.0.4) (2022-03-21)


### Bug Fixes

* custom hooks and init admin accounts ([#545](https://github.com/makeomatic/ms-users/issues/545)) ([23ae463](https://github.com/makeomatic/ms-users/commit/23ae463f2a21415f36ae3e81510616537a1d0880))

## [15.0.3](https://github.com/makeomatic/ms-users/compare/v15.0.2...v15.0.3) (2022-03-17)


### Bug Fixes

* **masters:** retry profile validation ([197ad0a](https://github.com/makeomatic/ms-users/commit/197ad0a54780b84743756abc7d2a9351e3781375))

## [15.0.2](https://github.com/makeomatic/ms-users/compare/v15.0.1...v15.0.2) (2022-03-17)


### Bug Fixes

* unhandled promise rejection send/phone ([d9db4cb](https://github.com/makeomatic/ms-users/commit/d9db4cb8ae63925c380b8a2112d88da40d5ff7b7))

## [15.0.1](https://github.com/makeomatic/ms-users/compare/v15.0.0...v15.0.1) (2022-03-17)


### Bug Fixes

* add error log for bypass ([9d07f67](https://github.com/makeomatic/ms-users/commit/9d07f673bb37af072bab8f2894f6e911cd40af72))
* graph-api fb issues, updated deps ([fcbc5f7](https://github.com/makeomatic/ms-users/commit/fcbc5f7228abdb98a9a72ad47bfac88d3e7583c0))

# [15.0.0](https://github.com/makeomatic/ms-users/compare/v14.25.1...v15.0.0) (2022-02-11)


### Features

* microfleet 18 ([#542](https://github.com/makeomatic/ms-users/issues/542)) ([7b6533c](https://github.com/makeomatic/ms-users/commit/7b6533c331d35622577180e5994844ef15890652))


### BREAKING CHANGES

* migrates to microfleet 18 with plugins and upgraded configuration. Do not deploy without adjusting your configuration files

## [14.25.1](https://github.com/makeomatic/ms-users/compare/v14.25.0...v14.25.1) (2022-02-09)


### Bug Fixes

* provider to bypass config multi-schema ([#541](https://github.com/makeomatic/ms-users/issues/541)) ([d829b91](https://github.com/makeomatic/ms-users/commit/d829b91bdef78f46a6daacfc24d0a5ec511c0726))

# [14.25.0](https://github.com/makeomatic/ms-users/compare/v14.24.0...v14.25.0) (2022-02-09)


### Features

* add-provider-to-bypass-config ([#540](https://github.com/makeomatic/ms-users/issues/540)) ([ea70c18](https://github.com/makeomatic/ms-users/commit/ea70c18a1523e74e2d0200361b3da1deb19ee678))

# [14.24.0](https://github.com/makeomatic/ms-users/compare/v14.23.2...v14.24.0) (2022-01-28)


### Features

* use undici for masters ([#537](https://github.com/makeomatic/ms-users/issues/537)) ([f3160ff](https://github.com/makeomatic/ms-users/commit/f3160ffbc180f2e7f379c6ee526c76fddf43bb1a))

## [14.23.2](https://github.com/makeomatic/ms-users/compare/v14.23.1...v14.23.2) (2022-01-17)


### Bug Fixes

* change masters user id ([#535](https://github.com/makeomatic/ms-users/issues/535)) ([f758399](https://github.com/makeomatic/ms-users/commit/f758399058c4817fc5d832a3f4977269c9905482))

## [14.23.1](https://github.com/makeomatic/ms-users/compare/v14.23.0...v14.23.1) (2021-11-12)


### Bug Fixes

* fix adding contacts on bypass actions ([#532](https://github.com/makeomatic/ms-users/issues/532)) ([db29c4c](https://github.com/makeomatic/ms-users/commit/db29c4c9a4d5746723a6d3c5e3379b1e4698f732))

# [14.23.0](https://github.com/makeomatic/ms-users/compare/v14.22.0...v14.23.0) (2021-10-06)


### Features

* add masters to bypass ([#527](https://github.com/makeomatic/ms-users/issues/527)) ([ffc6985](https://github.com/makeomatic/ms-users/commit/ffc6985e88eadfa9eb94401f7acf0d39555de202))

# [14.22.0](https://github.com/makeomatic/ms-users/compare/v14.21.3...v14.22.0) (2021-09-28)


### Features

* add id and type to getMember() ([#523](https://github.com/makeomatic/ms-users/issues/523)) ([d867d1a](https://github.com/makeomatic/ms-users/commit/d867d1a0f6d203277ef1dab9b80d594fa4d8a5e4))

## [14.21.3](https://github.com/makeomatic/ms-users/compare/v14.21.2...v14.21.3) (2021-09-09)


### Bug Fixes

* add id and type to getMember() ([#524](https://github.com/makeomatic/ms-users/issues/524)) ([884dcf7](https://github.com/makeomatic/ms-users/commit/884dcf7eff95ba14d412f52db362658534706c9d))

## [14.21.2](https://github.com/makeomatic/ms-users/compare/v14.21.1...v14.21.2) (2021-09-06)


### Bug Fixes

* glob as dep ([b44034a](https://github.com/makeomatic/ms-users/commit/b44034af228dc41edc2cd3fb24c35e77da387d6b))

## [14.21.1](https://github.com/makeomatic/ms-users/compare/v14.21.0...v14.21.1) (2021-09-06)


### Bug Fixes

* python ([4de339d](https://github.com/makeomatic/ms-users/commit/4de339d88a124f7256f845fca94cf854b8370854))
* split users.list fsort into 2 calls ([bbd2ea7](https://github.com/makeomatic/ms-users/commit/bbd2ea70120d1f4134f175bdfb1c20e1b44b6754))

# [14.21.0](https://github.com/makeomatic/ms-users/compare/v14.20.0...v14.21.0) (2021-08-09)


### Features

* set subscriptionType to free on cpst-activate hook ([#505](https://github.com/makeomatic/ms-users/issues/505)) ([4785d46](https://github.com/makeomatic/ms-users/commit/4785d46865984f7f81ea2b478fa26bb5bd2e2600))

# [14.20.0](https://github.com/makeomatic/ms-users/compare/v14.19.0...v14.20.0) (2021-06-15)


### Features

* sign in with apple (web) ([#503](https://github.com/makeomatic/ms-users/issues/503)) ([dd0969e](https://github.com/makeomatic/ms-users/commit/dd0969e430572d532f00e3c4e103a706b643a1ae))

# [14.19.0](https://github.com/makeomatic/ms-users/compare/v14.18.2...v14.19.0) (2021-04-05)


### Features

* add sender info to invitation email ([6452d67](https://github.com/makeomatic/ms-users/commit/6452d67ab196ef6ee6813fc103d3b76bf60333f2))

# [14.19.0-rc.1](https://github.com/makeomatic/ms-users/compare/v14.18.0...v14.19.0-rc.1) (2021-03-30)


### Bug Fixes

* clear changelog [skip ci] ([af3ec44](https://github.com/makeomatic/ms-users/commit/af3ec448b2ec45e79e83c6c877cd5b4634e92fe7))
* edit pump-jack config ([36ad3d1](https://github.com/makeomatic/ms-users/commit/36ad3d1712c2c62c07296156a8dcfa5628506ce9))
* fix validation pump-jack response ([71fa789](https://github.com/makeomatic/ms-users/commit/71fa7890a9f5600be7f53241b4d7fbe922afeeae))
* remove validate token length for bypass ([8a0a332](https://github.com/makeomatic/ms-users/commit/8a0a3329b1eb24df22b840c272fd8db7fa861a65))


### Features

* add sender info to invitation email ([#502](https://github.com/makeomatic/ms-users/issues/502)) ([d92e2b1](https://github.com/makeomatic/ms-users/commit/d92e2b1bd7619b5912f3ab6e75f65f8789ecb961))
* added pump-jack account ([e1d34f1](https://github.com/makeomatic/ms-users/commit/e1d34f1699dbc7c8f868c3352fc2ac392417e3b1))

# [14.18.0](https://github.com/makeomatic/ms-users/compare/v14.17.1...v14.18.0) (2021-03-15)


### Features

* added pump-jack account ([735a484](https://github.com/makeomatic/ms-users/commit/735a484ec0fbf0d72f3ac54636214f8370560f11))

# [14.18.0-rc.2](https://github.com/makeomatic/ms-users/compare/v14.18.0-rc.1...v14.18.0-rc.2) (2021-03-15)


### Bug Fixes

* edit pump-jack config ([36ad3d1](https://github.com/makeomatic/ms-users/commit/36ad3d1712c2c62c07296156a8dcfa5628506ce9))

# [14.18.0-rc.1](https://github.com/makeomatic/ms-users/compare/v14.17.1...v14.18.0-rc.1) (2021-03-12)


### Bug Fixes

* clear changelog [skip ci] ([af3ec44](https://github.com/makeomatic/ms-users/commit/af3ec448b2ec45e79e83c6c877cd5b4634e92fe7))
* fix validation pump-jack response ([71fa789](https://github.com/makeomatic/ms-users/commit/71fa7890a9f5600be7f53241b4d7fbe922afeeae))


### Features

* added pump-jack account ([e1d34f1](https://github.com/makeomatic/ms-users/commit/e1d34f1699dbc7c8f868c3352fc2ac392417e3b1))

## [14.17.1](https://github.com/makeomatic/ms-users/compare/v14.17.0...v14.17.1) (2021-03-05)


### Bug Fixes

* fix validation pump-jack response ([7c37f1a](https://github.com/makeomatic/ms-users/commit/7c37f1a2cf6d32a5a5b9291fb895d94fa6a8d270))

## [14.17.1-rc.1](https://github.com/makeomatic/ms-users/compare/v14.17.0...v14.17.1-rc.1) (2021-03-05)


### Bug Fixes

* clear changelog [skip ci] ([af3ec44](https://github.com/makeomatic/ms-users/commit/af3ec448b2ec45e79e83c6c877cd5b4634e92fe7))
* fix validation pump-jack response ([71fa789](https://github.com/makeomatic/ms-users/commit/71fa7890a9f5600be7f53241b4d7fbe922afeeae))

# [14.17.0](https://github.com/makeomatic/ms-users/compare/v14.16.0...v14.17.0) (2021-03-01)


### Features

* **emails:** add lng parameter to email links ([aa1f6b3](https://github.com/makeomatic/ms-users/commit/aa1f6b38dad640c99504981a774df48b1b0960ef))

# [14.16.0](https://github.com/makeomatic/ms-users/compare/v14.15.0...v14.16.0) (2021-02-27)


### Features

* implemented bypass-api, pump-jack integration, removed tbits ([#491](https://github.com/makeomatic/ms-users/issues/491)) ([277190c](https://github.com/makeomatic/ms-users/commit/277190cee8016fde0a66b8bd4b23aad6adb1cd0b))

# [14.15.0](https://github.com/makeomatic/ms-users/compare/v14.14.1...v14.15.0) (2021-02-25)


### Bug Fixes

* **tests:** adjust tests ([fef5d11](https://github.com/makeomatic/ms-users/commit/fef5d11f86ad0938a286ecf5fecf69605e484388))


### Features

* **i18n:** pass lng context option, support mailer-client send template method ([382e187](https://github.com/makeomatic/ms-users/commit/382e187ab8a13cc1952784f353747e16fbd8421f))

## [14.14.1](https://github.com/makeomatic/ms-users/compare/v14.14.0...v14.14.1) (2021-02-24)


### Bug Fixes

* handle error for migration ([#493](https://github.com/makeomatic/ms-users/issues/493)) ([ffb0eef](https://github.com/makeomatic/ms-users/commit/ffb0eef976c3233b91a0e0f483fb108e6ad9119f))

# [14.14.0](https://github.com/makeomatic/ms-users/compare/v14.13.6...v14.14.0) (2021-02-24)


### Features

* **migration:** user id to meta ([#490](https://github.com/makeomatic/ms-users/issues/490)) ([5e60690](https://github.com/makeomatic/ms-users/commit/5e60690248156d014565b6f3c43f09e720521906))

## [14.13.6](https://github.com/makeomatic/ms-users/compare/v14.13.5...v14.13.6) (2021-02-18)


### Bug Fixes

* CF list pending operations processing ([#492](https://github.com/makeomatic/ms-users/issues/492)) ([ffcc548](https://github.com/makeomatic/ms-users/commit/ffcc548c5ba2f30845abdf7c0350c45fb863224e))

## [14.13.5](https://github.com/makeomatic/ms-users/compare/v14.13.4...v14.13.5) (2021-01-19)


### Bug Fixes

* **ci:** fix ci tests ([69b92ba](https://github.com/makeomatic/ms-users/commit/69b92ba5f74af53744e58cc6fb4bface0f3990be))
* **deps:** update mailer templates ([83d8b5a](https://github.com/makeomatic/ms-users/commit/83d8b5a6bd86d3eaabc68216eadee7a39fcefdd5))
* **deps:** update mailer templates ([f202c55](https://github.com/makeomatic/ms-users/commit/f202c55978ff1f94c48915ce0f93a9a112e15494))
* **tests:** skip relay/tbits tests for a while ([9a6086a](https://github.com/makeomatic/ms-users/commit/9a6086a22ea063f2bc0314a0ab9be8f0fde24dc8))

## [14.13.4](https://github.com/makeomatic/ms-users/compare/v14.13.3...v14.13.4) (2020-12-18)


### Bug Fixes

* **deps:** update ms-mailer-templates ([7ee1777](https://github.com/makeomatic/ms-users/commit/7ee177763783d379301b532a6ad19802a95d934a))

## [14.13.3](https://github.com/makeomatic/ms-users/compare/v14.13.2...v14.13.3) (2020-12-17)


### Bug Fixes

* **deps:** update ms-mailer-templates dep ([4641b00](https://github.com/makeomatic/ms-users/commit/4641b00e13a05f595a84c990f4403bb945f9d8a2))

## [14.13.2](https://github.com/makeomatic/ms-users/compare/v14.13.1...v14.13.2) (2020-12-17)


### Bug Fixes

* **deps:** update ms-mailer-templates version ([82d2cff](https://github.com/makeomatic/ms-users/commit/82d2cff507f3cb954378c2bef4fc2615b87f005a))

## [14.13.1](https://github.com/makeomatic/ms-users/compare/v14.13.0...v14.13.1) (2020-12-17)


### Bug Fixes

* **pkgs:** update ms-mailer-templaes dep ([3fc40b9](https://github.com/makeomatic/ms-users/commit/3fc40b977344dfa05dee6f2d7ae8d8f74911eab3))

# [14.13.0](https://github.com/makeomatic/ms-users/compare/v14.12.3...v14.13.0) (2020-12-01)


### Features

* merge pull request [#485](https://github.com/makeomatic/ms-users/issues/485) staging to master ([37645a5](https://github.com/makeomatic/ms-users/commit/37645a5d29595fc699e9b4be1591d749ffc527dd)), closes [#481](https://github.com/makeomatic/ms-users/issues/481) [#481](https://github.com/makeomatic/ms-users/issues/481) [#484](https://github.com/makeomatic/ms-users/issues/484)
* merge pull request [#486](https://github.com/makeomatic/ms-users/issues/486) staging to master ([19b4576](https://github.com/makeomatic/ms-users/commit/19b457607a069b3e372fea836f08e441c79c29b5))

# [14.13.0-rc.1](https://github.com/makeomatic/ms-users/compare/v14.12.3...v14.13.0-rc.1) (2020-11-29)


### Bug Fixes

* added new props form email config in validation scheme ([c11d040](https://github.com/makeomatic/ms-users/commit/c11d040414b0e8da6717663c59cee92a1a21d5f7))
* allow any types for user permission ([2c708e9](https://github.com/makeomatic/ms-users/commit/2c708e950e8f4682358d2b90f5179f7b308fb6ba))
* edit emal types in validate config ([b162bdf](https://github.com/makeomatic/ms-users/commit/b162bdf46f1b5021b241e4cb6aaec871bba8ecba))
* edited actions for the organization members and invites ([#481](https://github.com/makeomatic/ms-users/issues/481)) ([cc276bc](https://github.com/makeomatic/ms-users/commit/cc276bc6acc86e3983f8a8bb7ee842a89f58febb))
* fix test config ([c1f88e1](https://github.com/makeomatic/ms-users/commit/c1f88e115c83af4ed28495f9cb06a8c4210fd47b))
* omit required email types in validation config ([a05b4fd](https://github.com/makeomatic/ms-users/commit/a05b4fd89f511b4aac3e2fff4a4cfd916e81bf27))
* remove invite after accept ([2eac8c4](https://github.com/makeomatic/ms-users/commit/2eac8c47ca5b484fc912ac3bdd4a8d699e082e47))


### Features

* added get and update actions for organization member ([#484](https://github.com/makeomatic/ms-users/issues/484)) ([6d59440](https://github.com/makeomatic/ms-users/commit/6d59440f868af50ef124accbb821ebf10b0ed0b0))

## [14.12.3-rc.5](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.4...v14.12.3-rc.5) (2020-11-23)


### Bug Fixes

* remove invite after accept ([287f7b3](https://github.com/makeomatic/ms-users/commit/287f7b3b55877b40c6a3f9e130658c8eb240b1c8))

## [14.12.3-rc.4](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.3...v14.12.3-rc.4) (2020-11-20)


### Bug Fixes

* allow any types for user permission ([be0d9dc](https://github.com/makeomatic/ms-users/commit/be0d9dc24f3a0c644945c9a0a02b04de7fe03dc1))

## [14.12.3-rc.3](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.2...v14.12.3-rc.3) (2020-11-18)


### Bug Fixes

* remove invite after accept ([287f7b3](https://github.com/makeomatic/ms-users/commit/287f7b3b55877b40c6a3f9e130658c8eb240b1c8))

## [14.12.3-rc.4](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.3...v14.12.3-rc.4) (2020-11-20)


### Bug Fixes

* allow any types for user permission ([be0d9dc](https://github.com/makeomatic/ms-users/commit/be0d9dc24f3a0c644945c9a0a02b04de7fe03dc1))

## [14.12.3-rc.3](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.2...v14.12.3-rc.3) (2020-11-18)


### Bug Fixes

* edit emal types in validate config ([43896ba](https://github.com/makeomatic/ms-users/commit/43896ba2ba856568e2e77479e9c8e0af3b4899c2))
* fix test config ([0db5127](https://github.com/makeomatic/ms-users/commit/0db5127bc650ab0f47732ac793ab7e86ab6f2a45))
* omit required email types in validation config ([f2b16de](https://github.com/makeomatic/ms-users/commit/f2b16dee5bf9c096a1e92c9f7de75f023a38578a))

## [14.12.3-rc.2](https://github.com/makeomatic/ms-users/compare/v14.12.3-rc.1...v14.12.3-rc.2) (2020-11-18)


### Bug Fixes

* added new props form email config in validation scheme ([6625eb6](https://github.com/makeomatic/ms-users/commit/6625eb6bad53243037044a96a013b162375041fe))

## [14.12.3-rc.1](https://github.com/makeomatic/ms-users/compare/v14.12.2...v14.12.3-rc.1) (2020-11-16)

### Bug Fixes

* edited actions for the organization members and invites ([#481](https://github.com/makeomatic/ms-users/issues/481)) ([a3f2627](https://github.com/makeomatic/ms-users/commit/a3f26273633a67a2d04c79b8b027427b5bbb12c8))
*
## [14.12.3](https://github.com/makeomatic/ms-users/compare/v14.12.2...v14.12.3) (2020-11-23)

### Bug Fixes

* bump mail-templates + deps upgrade ([#482](https://github.com/makeomatic/ms-users/issues/482)) ([27367cc](https://github.com/makeomatic/ms-users/commit/27367cc7b6de54610c85d38757e63927520c4623))

## [14.12.2](https://github.com/makeomatic/ms-users/compare/v14.12.1...v14.12.2) (2020-11-05)


### Bug Fixes

* update ms-token version ([69eb027](https://github.com/makeomatic/ms-users/commit/69eb02732460d3b48573c04f2623f44d072668ee))
* upgrade deps ([f1aeefd](https://github.com/makeomatic/ms-users/commit/f1aeefdd599e624293818d6d75683cce4047a4a6))

## [14.12.1](https://github.com/makeomatic/ms-users/compare/v14.12.0...v14.12.1) (2020-11-03)


### Bug Fixes

* organization members ([#477](https://github.com/makeomatic/ms-users/issues/477)) ([4628b3e](https://github.com/makeomatic/ms-users/commit/4628b3e7b2676dfb80156f938cdc1264989d7f4f)), closes [#475](https://github.com/makeomatic/ms-users/issues/475) [#476](https://github.com/makeomatic/ms-users/issues/476) [#479](https://github.com/makeomatic/ms-users/issues/479) [#474](https://github.com/makeomatic/ms-users/issues/474)

# [14.12.0](https://github.com/makeomatic/ms-users/compare/v14.11.0...v14.12.0) (2020-11-02)


### Features

* sso token upgrade flow ([#451](https://github.com/makeomatic/ms-users/issues/451)) ([77d820b](https://github.com/makeomatic/ms-users/commit/77d820b3bee690dbb5cb8a67eb82e783d8b6dd67))

# [14.11.0](https://github.com/makeomatic/ms-users/compare/v14.10.2...v14.11.0) (2020-09-16)


### Features

* added user contacts api ([#468](https://github.com/makeomatic/ms-users/issues/468)) ([6ad461d](https://github.com/makeomatic/ms-users/commit/6ad461df56c10069adeeed33cfac1e0a7e0ea9e0))

## [14.10.2](https://github.com/makeomatic/ms-users/compare/v14.10.1...v14.10.2) (2020-07-30)


### Bug Fixes

* **org:** send emails on creation and member invitation ([#467](https://github.com/makeomatic/ms-users/issues/467)) ([981c56a](https://github.com/makeomatic/ms-users/commit/981c56acfdbcfd4733f1c45e8270d0c1f587d2fc))

## [14.10.1](https://github.com/makeomatic/ms-users/compare/v14.10.0...v14.10.1) (2020-07-27)


### Bug Fixes

* **bin:** update password tool ([#466](https://github.com/makeomatic/ms-users/issues/466)) ([c74f848](https://github.com/makeomatic/ms-users/commit/c74f8481bd3505b2bc90d4032ef554e1f9ad0670))

# [14.10.0](https://github.com/makeomatic/ms-users/compare/v14.9.0...v14.10.0) (2020-07-17)


### Features

* added referral metadata ([#462](https://github.com/makeomatic/ms-users/issues/462)) ([0e56d8a](https://github.com/makeomatic/ms-users/commit/0e56d8a487330cf92a8c200286dd86a42f7b3b98))

# [14.9.0](https://github.com/makeomatic/ms-users/compare/v14.8.2...v14.9.0) (2020-07-15)


### Features

* **activation:** return detailed error when missing activation ([#463](https://github.com/makeomatic/ms-users/issues/463)) ([9220c95](https://github.com/makeomatic/ms-users/commit/9220c954572451486f2ad7fb8de2e1d8ac469fc6))

## [14.8.2](https://github.com/makeomatic/ms-users/compare/v14.8.1...v14.8.2) (2020-06-30)


### Bug Fixes

* skip password for tbits user registration ([#459](https://github.com/makeomatic/ms-users/issues/459)) ([46a83bb](https://github.com/makeomatic/ms-users/commit/46a83bbff6c51340c995a181277d2a35e3de66e5))

## [14.8.1](https://github.com/makeomatic/ms-users/compare/v14.8.0...v14.8.1) (2020-06-29)


### Bug Fixes

* edit metro area in tbits response schema ([#458](https://github.com/makeomatic/ms-users/issues/458)) ([aece5de](https://github.com/makeomatic/ms-users/commit/aece5de3fe93116575531fbe5a8496cfc9eb99a8))

# [14.8.0](https://github.com/makeomatic/ms-users/compare/v14.7.0...v14.8.0) (2020-06-24)


### Features

* tbits relay auth ([#457](https://github.com/makeomatic/ms-users/issues/457)) ([25e8024](https://github.com/makeomatic/ms-users/commit/25e8024178ede86bab27acd785ef6eaa1dd48a76))

# [14.7.0](https://github.com/makeomatic/ms-users/compare/v14.6.0...v14.7.0) (2020-05-28)


### Features

* added banned field to org member, remove deactivate action ([#455](https://github.com/makeomatic/ms-users/issues/455)) ([a99754d](https://github.com/makeomatic/ms-users/commit/a99754d4c6e1d043a86d38e07d993c12e00f2ce9))

# [14.6.0](https://github.com/makeomatic/ms-users/compare/v14.5.1...v14.6.0) (2020-05-28)


### Features

* added deactivate user action ([#454](https://github.com/makeomatic/ms-users/issues/454)) ([bf0e8cc](https://github.com/makeomatic/ms-users/commit/bf0e8cc39644b04f0184725a016fb0bb4a0d060c))

## [14.5.1](https://github.com/makeomatic/ms-users/compare/v14.5.0...v14.5.1) (2020-05-27)


### Bug Fixes

* edit distributeUsersByExist for organization members ([#453](https://github.com/makeomatic/ms-users/issues/453)) ([6198f57](https://github.com/makeomatic/ms-users/commit/6198f5768bece765287600721bce80587ce46704))

# [14.5.0](https://github.com/makeomatic/ms-users/compare/v14.4.0...v14.5.0) (2020-05-26)


### Features

* edit organization invites api ([#452](https://github.com/makeomatic/ms-users/issues/452)) ([51203bf](https://github.com/makeomatic/ms-users/commit/51203bff55a3b958916551978c9ad63963e41b2a))

# [14.4.0](https://github.com/makeomatic/ms-users/compare/v14.3.0...v14.4.0) (2020-05-12)


### Features

* **restore-pwd:** expand 429 error with actual ttl ([c544d8a](https://github.com/makeomatic/ms-users/commit/c544d8a4767ed543cd18a2aedab6c2517977d226))

# [14.3.0](https://github.com/makeomatic/ms-users/compare/v14.2.0...v14.3.0) (2020-04-01)


### Features

* **restore-pwd:** introduce distinct support email ([310f18c](https://github.com/makeomatic/ms-users/commit/310f18c65efa0d5543f48090b0ab834a521703ec))

# [14.2.0](https://github.com/makeomatic/ms-users/compare/v14.1.1...v14.2.0) (2020-03-18)


### Bug Fixes

* remove unnecessary error instantiation ([eadcfc3](https://github.com/makeomatic/ms-users/commit/eadcfc3d32f0440b4074556be5fa9164b2b42f35))


### Features

* **restore-pwd:** add details to restore pwd error ([89d550c](https://github.com/makeomatic/ms-users/commit/89d550c277b6054e96f5fa28fd8a05862bd6b572))

## [14.1.1](https://github.com/makeomatic/ms-users/compare/v14.1.0...v14.1.1) (2020-03-02)

# [14.1.0](https://github.com/makeomatic/ms-users/compare/v14.0.2...v14.1.0) (2020-02-16)


### Bug Fixes

* improve stability of tests with depends_on ([465d170](https://github.com/makeomatic/ms-users/commit/465d170e3c60c0a00c3b5415d7604080b32c7f78))


### Features

* migration for default activation time on old users ([c47c65d](https://github.com/makeomatic/ms-users/commit/c47c65da6ddfc4b73dc8a14cfbb7b675809c49a6))

## [14.0.2](https://github.com/makeomatic/ms-users/compare/v14.0.1...v14.0.2) (2020-02-12)

## [14.0.1](https://github.com/makeomatic/ms-users/compare/v14.0.0...v14.0.1) (2020-02-04)


### Bug Fixes

* invalid throttle message ([#442](https://github.com/makeomatic/ms-users/issues/442)) ([1b36c77](https://github.com/makeomatic/ms-users/commit/1b36c77bb6834f6dc5c13fd1ac5f8c8e1f0ef40b))

# [14.0.0](https://github.com/makeomatic/ms-users/compare/v13.0.2...v14.0.0) (2020-01-25)


### Features

* upgrades @hapi/hapi to 19, otplib to 12 ([75ce95c](https://github.com/makeomatic/ms-users/commit/75ce95c25700cc1fe73a45b0fd2d5b37eba86cdd))


### BREAKING CHANGES

* requires node 12.14.x, configuration changes
Public facing APIs remain exactly the same

## [13.0.2](https://github.com/makeomatic/ms-users/compare/v13.0.1...v13.0.2) (2020-01-21)


### Bug Fixes

* metadata to email context ([#440](https://github.com/makeomatic/ms-users/issues/440)) ([54b140a](https://github.com/makeomatic/ms-users/commit/54b140ab57f1e5a8648dd7cd349766ee395b6b92))

## [13.0.1](https://github.com/makeomatic/ms-users/compare/v13.0.0...v13.0.1) (2019-12-18)


### Bug Fixes

* delete lock for user ip after password reset ([#439](https://github.com/makeomatic/ms-users/issues/439)) ([cb9d3fd](https://github.com/makeomatic/ms-users/commit/cb9d3fd5b2c69bca4805f2cd444b8bbda07cc5a8))

# [13.0.0](https://github.com/makeomatic/ms-users/compare/v12.1.4...v13.0.0) (2019-12-17)


### Features

* sliding window rate limitation for sign in ([#438](https://github.com/makeomatic/ms-users/issues/438)) ([1b4273c](https://github.com/makeomatic/ms-users/commit/1b4273c4241db66ec29003fab7d310c66b31c731))


### BREAKING CHANGES

* implements new rate limiting algorithm using sliding window. While overall the mechanics of rate limiting remain the same - it's now harder to lock out the ip completely as each unsuccessful attempt wont extend login attempt capture duration for another <keep login attempts time>. Consult with the docs on a new configuration format for the rate limiter

## [12.1.4](https://github.com/makeomatic/ms-users/compare/v12.1.3...v12.1.4) (2019-12-10)


### Bug Fixes

* upgrade deps ([4d11f2c](https://github.com/makeomatic/ms-users/commit/4d11f2c8f2b1c23fa857507b3bb8becc40aacaa6))

## [12.1.3](https://github.com/makeomatic/ms-users/compare/v12.1.2...v12.1.3) (2019-11-28)


### Bug Fixes

* **deps:** dlock, @microfleet/transport-amqp ([d1a526d](https://github.com/makeomatic/ms-users/commit/d1a526dfe4ec9c7b9fc6706dd14f50f4de6bd0dc))

## [12.1.2](https://github.com/makeomatic/ms-users/compare/v12.1.1...v12.1.2) (2019-11-26)


### Bug Fixes

* added audience to organization list request ([#434](https://github.com/makeomatic/ms-users/issues/434)) ([068cdc2](https://github.com/makeomatic/ms-users/commit/068cdc2578ff7d81b953dabf546f5b62e69c6d0b))

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
