const { isEmpty } = require('lodash');
const { HttpStatusError } = require('@microfleet/validation');
const challengeAct = require('./challenges/challenge');
const redisKey = require('./key');
const handlePipeline = require('./pipeline-error');
const { USERS_CONTACTS, USERS_DEFAULT_CONTACT, USERS_ACTION_VERIFY_CONTACT, lockContact } = require('../constants');

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

async function checkLimit({ userId }) {
  const contactsLength = await this.redis.scard(redisKey(userId, USERS_CONTACTS));

  if (contactsLength >= this.config.contacts.max) {
    throw new HttpStatusError(400, 'contact limit reached');
  }

  return contactsLength;
}

async function setVerifiedIfExist({ redis, userId, value }) {
  const key = redisKey(userId, USERS_CONTACTS, value);
  const exist = await redis.hexists(key, 'verified');
  if (exist) {
    await redis.hset(key, 'verified', true);
  }

  return key;
}

async function add({ userId, contact, skipChallenge }) {
  this.log.debug({ userId, contact }, 'add contact key params');

  const { redis } = this;
  const contactsCount = await checkLimit.call(this, { userId });
  const lock = await this.dlock.manager.once(lockContact(contact.value));

  try {
    const key = redisKey(userId, USERS_CONTACTS, contact.value);

    const contactData = {
      ...contact,
      verified: false,
    };

    const pipe = redis.pipeline();
    pipe.hmset(key, stringifyObj(contactData));
    pipe.sadd(redisKey(userId, USERS_CONTACTS), contact.value);

    if (!contactsCount) {
      pipe.set(redisKey(userId, USERS_DEFAULT_CONTACT), contact.value);
    }

    if (skipChallenge) {
      pipe.hset(key, 'verified', true);
    }

    await pipe.exec().then(handlePipeline);

    return contactData;
  } finally {
    await lock.release();
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

async function challenge({ userId, contact, i18nLocale }) {
  const { redis } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  const contactData = await redis.hgetall(key).then(parseObj);
  const { throttle, ttl } = this.config.contacts[contactData.type];

  const challengeOpts = {
    ttl,
    throttle,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
    metadata: { contact, userId },
    ...this.config.token[contactData.type],
  };

  const { context } = await challengeAct.call(this, contactData.type, challengeOpts, { ...contactData, i18nLocale });

  return {
    ...contact,
    challenge_uid: context.token.uid,
  };
}

async function setAllEmailContactsOfUserAsUnVerified(redis, userId) {
  const key = redisKey(userId, USERS_CONTACTS);
  const contacts = await redis.smembers(key);

  if (contacts.length) {
    const pipe = redis.pipeline();
    contacts.forEach((kkey) => pipe.hset(kkey, 'verified', false));
    await pipe.exec().then(handlePipeline);
  }
}

async function verifyEmail(secret) {
  const { redis, tokenManager } = this;
  const { metadata: { contact, userId } } = await tokenManager.verify(secret);
  const key = redisKey(userId, USERS_CONTACTS, contact.value);

  if (this.config.contacts.onlyOneEmail) {
    await setAllEmailContactsOfUserAsUnVerified(redis, userId);
  }

  await redis.hset(key, 'verified', true);

  return redis.hgetall(key).then(parseObj);
}

async function verify({ userId, contact, token }) {
  const { redis, tokenManager } = this;
  const key = redisKey(userId, USERS_CONTACTS, contact.value);
  const contactData = await redis.hgetall(key).then(parseObj);

  if (!contactData || isEmpty(contactData)) {
    throw new HttpStatusError(404);
  }

  const args = {
    token,
    action: USERS_ACTION_VERIFY_CONTACT,
    id: contact.value,
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

  const contactsCount = await checkLimit.call(this, { userId });
  const defaultContact = await redis.get(redisKey(userId, USERS_DEFAULT_CONTACT));

  if (defaultContact === contact.value && contactsCount !== 1) {
    throw new HttpStatusError(400, 'cannot remove default contact');
  }

  await tokenManager.remove({
    id: contact.value,
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
  verifyEmail,
  setVerifiedIfExist,
};
