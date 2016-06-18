/**
 * Created by Stainwoortsel on 18.06.2016.
 */
const mapValues = require('lodash/mapValues');
const pick = require('lodash/pick');
const JSONParse = JSON.parse.bind(JSON);

module.exports = function remapMeta(data, audiences, fields) {
  const output = {};
  audiences.forEach(function transform(aud, idx) {
    const datum = data[idx];

    if (datum) {
      const pickFields = fields[aud];
      output[aud] = mapValues(datum, JSONParse);
      if (pickFields) {
        output[aud] = pick(output[aud], pickFields);
      }
    } else {
      output[aud] = {};
    }
  });

  return output;
};
