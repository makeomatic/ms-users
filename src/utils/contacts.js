const { isEmpty } = require('lodash');
const { HttpStatusError } = require('@microfleet/validation');
const challengeAct = require('./challenges/challenge');
const redisKey = require('./key');
const handlePipeline = require('./pipeline-error');
const { USERS_CONTACTS, USERS_ACTION_VERIFY_CONTACT } = require('../constants');

async function add({ userId, contact }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const concatData = {
    ...contact,
    verified: false,
    challenge_uid: null,
  };

  const pipe = redis.pipeline();
  pipe.hmset(key, concatData);
  pipe.sadd(redisKey(userId, USERS_CONTACTS), contact.value);
  await pipe.exec().then(handlePipeline);

  return concatData;
}

async function list({ userId }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS);

  const contacts = await redis.smembers(key);

  if (contacts.length) {
    const pipe = redis.pipeline();
    contacts.forEach((kkey) => pipe.hgetall(redisKey(userId, USERS_CONTACTS, kkey)));
    const values = await pipe.exec().then(handlePipeline);
    return values;
  }

  return [];
}

async function challenge({ userId, contact }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const concatData = await redis.hgetall(key);
  const { throttle, ttl } = this.config.contacts[concatData.type];

  const challengeOpts = {
    ttl,
    throttle,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
    ...this.config.token[concatData.type],
  };

  const { context } = await challengeAct.call(this, concatData.type, challengeOpts, concatData);

  await redis.hset(key, 'challenge_uid', `"${context.token.uid}"`);
  return redis.hgetall(key);
}

async function verify({ userId, contact, token }) {
  const { redis, tokenManager } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);
  const concatData = await redis.hgetall(key);
  const args = {
    token,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
    uid: concatData.challenge_uid,
  };

  await tokenManager.verify(args, { erase: true });
  await redis.hset(key, 'verified', true);

  return redis.hgetall(key);
}

async function remove({ userId, contact }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const concatData = await redis.hgetall(key);

  if (!concatData || isEmpty(concatData)) {
    throw new HttpStatusError(404);
  }

  const pipe = redis.pipeline();
  pipe.del(key);
  pipe.srem(redisKey(userId, USERS_CONTACTS), contact.value);

  return pipe.exec().then(handlePipeline);
}

module.exports = {
  add,
  challenge,
  verify,
  remove,
  list,
};
