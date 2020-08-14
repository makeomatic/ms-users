const { isEmpty } = require('lodash');
const { HttpStatusError } = require('@microfleet/validation');
const challengeAct = require('./challenges/challenge');
const redisKey = require('./key');
const handlePipeline = require('./pipeline-error');
const { USERS_CONTACTS, USERS_ACTION_VERIFY_CONTACT } = require('../constants');

const stringifyObj = (obj) => {
  const newObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    newObj[key] = JSON.stringify(value);
  }

  return newObj;
};

const parseObj = (obj) => {
  const newObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    newObj[key] = JSON.parse(value);
  }

  return newObj;
};

async function add({ userId, contact }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const contactData = {
    ...contact,
    verified: false,
    challenge_uid: null,
  };

  const pipe = redis.pipeline();
  pipe.hmset(key, stringifyObj(contactData));
  pipe.sadd(redisKey(userId, USERS_CONTACTS), contact.value);
  await pipe.exec().then(handlePipeline);

  return contactData;
}

async function checkLimit({ userId }) {
  const contactsLength = await this.redis.scard(redisKey(userId, USERS_CONTACTS));

  if (contactsLength >= this.config.contacts.max) {
    throw new HttpStatusError(400, 'contact limit reached');
  }
}

async function list({ userId }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS);

  const contacts = await redis.smembers(key);

  if (contacts.length) {
    const pipe = redis.pipeline();
    contacts.forEach((kkey) => pipe.hgetall(redisKey(userId, USERS_CONTACTS, kkey)));
    const values = await pipe.exec().then(handlePipeline);
    return values.map(parseObj);
  }

  return [];
}

async function challenge({ userId, contact }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const contactData = await redis.hgetall(key).then(parseObj);
  const { throttle, ttl } = this.config.contacts[contactData.type];

  const challengeOpts = {
    ttl,
    throttle,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
    ...this.config.token[contactData.type],
  };

  const { context } = await challengeAct.call(this, contactData.type, challengeOpts, contactData);

  await redis.hset(key, 'challenge_uid', `"${context.token.uid}"`);
  return redis.hgetall(key).then(parseObj);
}

async function verify({ userId, contact, token }) {
  const { redis, tokenManager } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);
  const contactData = await redis.hgetall(key).then(parseObj);
  const args = {
    token,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
    uid: contactData.challenge_uid,
  };

  await tokenManager.verify(args, { erase: false });
  await redis.hset(key, 'verified', true);

  return redis.hgetall(key).then(parseObj);
}

async function remove({ userId, contact }) {
  const { redis, tokenManager } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const contactData = await redis.hgetall(key).then(parseObj);

  if (!contactData || isEmpty(contactData)) {
    throw new HttpStatusError(404);
  }

  await tokenManager.remove({
    id: contact.value,
    uid: contactData.challenge_uid,
    action: USERS_ACTION_VERIFY_CONTACT,
  });

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
  checkLimit,
};
