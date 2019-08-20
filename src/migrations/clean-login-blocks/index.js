const redisKey = require('../../utils/key');

const MIN = 1;
const FINAL = 6;

const globalBlockKeyPattern = redisKey('gl!ip!ctr', '{ip}');
const localBlockKeyPattern = redisKey('{uid}', 'ip', '{ip}');

module.exports = {
  keys: [globalBlockKeyPattern, localBlockKeyPattern],
  script: `${__dirname}/migrate.lua`,
  min: MIN,
  final: FINAL,
};
