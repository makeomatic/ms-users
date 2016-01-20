const mapValues = require('lodash/mapValues');
const redisKey = require('../utils/key.js');
const Promise = require('bluebird');
const { isArray } = Array;
const JSONParse = JSON.parse.bind(JSON);

module.exports = function getMetadata(username, _audience) {
  const { redis } = this;
  const audience = isArray(_audience) ? _audience : [_audience];

  return Promise.map(audience, function getAudienceData(aud) {
    return redis.hgetallBuffer(redisKey(username, 'metadata', aud));
  })
  .then(function remapAudienceData(data) {
    const output = {};
    audience.forEach(function transform(aud, idx) {
      const datum = data[idx];
      if (datum) {
        output[aud] = mapValues(datum, JSONParse);
      } else {
        output[aud] = {};
      }
    });

    return output;
  });
};
