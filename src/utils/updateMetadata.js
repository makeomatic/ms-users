/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const is = require('is');
const { HttpStatusError } = require('common-errors');
const mapValues = require('lodash/mapValues');
const redisKey = require('../utils/key.js');
const { USERS_METADATA, USERS_AUDIENCE } = require('../constants.js');

const JSONStringify = (data) => JSON.stringify(data);
const JSONParse = (data) => JSON.parse(data);
const has = Object.prototype.hasOwnProperty;

function callUpdateMetadataScript(redis, userId, ops) {
  const audienceKeyTemplate = redisKey('{id}', USERS_AUDIENCE);
  const metaDataTemplate = redisKey('{id}', USERS_METADATA, '{audience}');

  return redis
    .updateMetadata(2, audienceKeyTemplate, metaDataTemplate, userId, JSONStringify(ops));
}

// Stabilizes Lua script response
function mapUpdateResponse(jsonStr) {
  const decodedData = JSONParse(jsonStr);
  const result = [];

  decodedData.forEach((metaResult) => {
    const opResult = {};
    for (const [key, ops] of Object.entries(metaResult)) {
      if (ops.length !== undefined && ops.length === 1) {
        [opResult[key]] = ops;
      } else {
        opResult[key] = ops;
      }
    }
    result.push(opResult);
  });

  return result.length > 1 ? result : result[0];
}

/**
 * Encodes operation field values ito json string
 * If encoding performed in LUA script using CJSON lib, empty arrays become empty objects.
 * This breaks logic
 * @param metaOps
 * @returns {*}
 */
function prepareOps(ops) {
  if (has.call(ops, '$set')) {
    ops.$set = mapValues(ops.$set, JSONStringify);
  }
  return ops;
}

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
function updateMetadata(opts) {
  const { redis } = this;
  const {
    userId, audience, metadata, script,
  } = opts;
  const audiences = is.array(audience) ? audience : [audience];

  let scriptOpts = {
    audiences,
  };

  if (metadata) {
    const rawMetaOps = is.array(metadata) ? metadata : [metadata];
    if (rawMetaOps.length !== audiences.length) {
      return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
    }

    const metaOps = rawMetaOps.map((opBlock) => prepareOps(opBlock));

    scriptOpts = { metaOps, ...scriptOpts };
    return callUpdateMetadataScript(redis, userId, scriptOpts)
      .then(mapUpdateResponse);
  }

  // dynamic scripts
  const $scriptKeys = Object.keys(script);
  const scripts = $scriptKeys.map((scriptName) => {
    const { lua, argv = [] } = script[scriptName];
    return {
      lua,
      argv,
      name: scriptName,
    };
  });

  scriptOpts = { scripts, ...scriptOpts };
  return callUpdateMetadataScript(redis, userId, scriptOpts)
    .then((result) => JSONParse(result));
}

updateMetadata.callUpdateMetadataScript = callUpdateMetadataScript;
updateMetadata.prepareOps = prepareOps;
module.exports = updateMetadata;
