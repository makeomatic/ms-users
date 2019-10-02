/* eslint-disable no-mixed-operators */
const { HttpStatusError } = require('common-errors');
const mapValues = require('lodash/mapValues');
const redisKey = require('../utils/key.js');

const { USERS_METADATA, USERS_AUDIENCE } = require('../constants.js');

const JSONStringify = (data) => JSON.stringify(data);
const JSONParse = (data) => JSON.parse(data);
const has = Object.prototype.hasOwnProperty;

function updateMetadataScript(userId, ops) {
  const { redis } = this;
  const audienceKeyTemplate = redisKey('{id}', USERS_AUDIENCE);
  const metaDataTemplate = redisKey('{id}', USERS_METADATA, '{audience}');

  return redis
    .updateMetadata(2, audienceKeyTemplate, metaDataTemplate, userId, JSONStringify(ops));
}

// Stabilizes Lua script response
function mapUpdateResponse(jsonStr) {
  const decodedData = JSONParse(jsonStr);

  const result = decodedData.map((metaResult) => {
    const opResult = {};
    for (const [key, ops] of Object.entries(metaResult)) {
      if (Array.isArray(ops) && ops.length === 1) {
        [opResult[key]] = ops;
      } else {
        opResult[key] = ops;
      }
    }
    return opResult;
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
async function updateMetadata(opts) {
  const {
    userId, audience, metadata, script,
  } = opts;
  const audiences = Array.isArray(audience) ? audience : [audience];

  let scriptOpts = {
    audiences,
  };

  if (metadata) {
    const rawMetaOps = Array.isArray(metadata) ? metadata : [metadata];
    if (rawMetaOps.length !== audiences.length) {
      throw new HttpStatusError(400, 'audiences must match metadata entries');
    }

    const metaOps = rawMetaOps.map((opBlock) => prepareOps(opBlock));
    scriptOpts = { metaOps, ...scriptOpts };

    const updateResult = await updateMetadataScript.call(this, userId, scriptOpts);
    return mapUpdateResponse(updateResult);
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
  const updateResult = await updateMetadataScript.call(this, userId, scriptOpts);
  return JSONParse(updateResult);
}

updateMetadata.prepareOps = prepareOps;
module.exports = updateMetadata;
