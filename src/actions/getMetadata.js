const ld = require('lodash');
const redisKey = require('../utils/key.js');
const Promise = require('bluebird');
const { isArray } = Array;

module.exports = function getMetadata(username, _audience) {
  const { _redis: redis } = this;
  const audience = isArray(_audience) ? _audience : [ _audience ];

  return Promise.map(audience, function getAudienceData(aud) {
    return redis.hgetallBuffer(redisKey(username, 'metadata', aud));
  })
  .then(function remapAudienceData(data) {
    const output = {};
    audience.forEach(function transform(aud, idx) {
      const datum = data[idx];
      if (datum) {
        output[aud] = ld.mapValues(datum, JSON.parse, JSON);
      } else {
        output[aud] = {};
      }
    });

    return output;
  });
};
