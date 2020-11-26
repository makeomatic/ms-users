/* eslint-disable no-mixed-operators */
const mapValues = require('lodash/mapValues');
const handlePipeline = require('../pipeline-error');

const JSONStringify = (data) => JSON.stringify(data);

async function updateMember(memberKey, memberData) {
  const { redis } = this;
  const pipeline = redis.pipeline();

  const { $remove } = memberData;
  const $removeOps = $remove && $remove.length || 0;
  if ($removeOps > 0) {
    pipeline.hdel(memberKey, $remove);
  }

  const { $set } = memberData;
  const $setKeys = $set && Object.keys($set);
  const $setLength = $setKeys && $setKeys.length || 0;
  if ($setLength > 0) {
    pipeline.hmset(memberKey, mapValues($set, JSONStringify));
  }

  return pipeline.exec().then(handlePipeline);
}

module.exports = updateMember;
