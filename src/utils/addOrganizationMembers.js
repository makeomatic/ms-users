/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const { ORGANIZATIONS_MEMBERS, ErrorUserNotFound } = require('../constants.js');
const { resolveUserId } = require('./userData');

/**
 * Process metadata update operation for a passed audience
 * @param  {Object} pipeline
 * @param  {String} audience
 * @param  {Object} metadata
 */
function handleAudience(pipeline, key, metadata) {
  const { $remove } = metadata;
  const $removeOps = $remove && $remove.length || 0;
  if ($removeOps > 0) {
    pipeline.hdel(key, $remove);
  }

  const { $set } = metadata;
  const $setKeys = $set && Object.keys($set);
  const $setLength = $setKeys && $setKeys.length || 0;
  if ($setLength > 0) {
    pipeline.hmset(key, $set);
  }

  const { $incr } = metadata;
  const $incrFields = $incr && Object.keys($incr);
  const $incrLength = $incrFields && $incrFields.length || 0;
  if ($incrLength > 0) {
    $incrFields.forEach((fieldName) => {
      pipeline.hincrby(key, fieldName, $incr[fieldName]);
    });
  }

  return {
    $removeOps, $setLength, $incrLength, $incrFields,
  };
}

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members } = opts;

  const checkMembers = members.map(member => Promise.bind(this, member.id)
    .tap(resolveUserId)
    .then(ErrorUserNotFound));
  await Promise.all(checkMembers);

  // if we have meta, then we can
  if (members) {
    const pipe = redis.pipeline();

    const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
    for (const member of members) {
      const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.id);
      member.invited = Date.now();
      member.accepted = null;
      member.permissions = member.permissions || [];
      pipe.hmset(memberKey, member);
      pipe.zadd(membersKey, Date.now(), memberKey);
    }

    await pipe.exec().then(handlePipeline);
  }

  return true;
}

module.exports = addOrganizationMembers;
