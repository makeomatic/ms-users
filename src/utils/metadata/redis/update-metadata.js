const { HttpStatusError } = require('common-errors');
const { RedisError } = require('common-errors').data;
const mapValues = require('lodash/mapValues');

/**
 * Class wraps User/Organization metadata update using atomic LUA script
 */
class UpdateMetadata {
  /**
   * @param redis
   * @param metadataKeyTemplate
   * @param audienceKeyTemplate
   */
  constructor(redis, metadataKeyTemplate, audienceKeyTemplate) {
    this.redis = redis;
    this.audienceKeyTemplate = audienceKeyTemplate;
    this.metadataKeyTemplate = metadataKeyTemplate;
  }

  callLuaScript(id, ops) {
    return this.redis
      .updateMetadata(2, this.audienceKeyTemplate, this.metadataKeyTemplate, id, JSON.stringify(ops));
  }

  /**
   * Updates metadata on a user object
   * @param  {Object} opts
   * @return {Promise}
   */
  async update(opts) {
    const {
      id, audience, metadata, script,
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

      const metaOps = rawMetaOps.map((opBlock) => UpdateMetadata.prepareOperations(opBlock));
      scriptOpts = { metaOps, ...scriptOpts };

      const updateJsonResult = await this.callLuaScript(id, scriptOpts);
      return UpdateMetadata.processOpUpdateResponse(updateJsonResult);
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
    const updateResultJson = await this.callLuaScript(id, scriptOpts);
    return UpdateMetadata.processLuaUpdateResponse(updateResultJson);
  }

  /**
   * Process results returned from LUA script when subset of Meta Operations passed
   * @param jsonStr
   * @returns {*}
   */
  static processOpUpdateResponse(jsonStr) {
    const decodedData = JSON.parse(jsonStr);

    if (decodedData.err !== undefined) {
      const errors = Object.entries(decodedData.err);
      const message = errors.map(([, error]) => error.err).join('; ');

      throw new RedisError(message, decodedData.err);
    }

    const result = decodedData.ok.map((metaResult) => {
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
   * Process results returned from LUA script when subset of LUA scripts passed
   * @param jsonStr
   * @returns {Response.ok|((value: any, message?: (string | Error)) => void)|string|boolean}
   */
  static processLuaUpdateResponse(jsonStr) {
    const decodedData = JSON.parse(jsonStr);

    if (decodedData.err !== undefined) {
      const errors = Object.entries(decodedData.err);
      const message = errors.map(([, error]) => `Script: ${error.script} Failed with error: ${error.err}`).join('; ');
      throw new RedisError(message, decodedData.err);
    }

    return decodedData.ok;
  }

  /**
   * Encodes operation field values ito json string
   * If encoding performed in LUA script using CJSON lib, empty arrays become empty objects.
   * This breaks logic
   * @param metaOps
   * @returns {*}
   */
  static prepareOperations(ops) {
    if (Object.hasOwnProperty.call(ops, '$set')) {
      ops.$set = mapValues(ops.$set, JSON.stringify);
    }
    return ops;
  }
}

module.exports = UpdateMetadata;
