const generatePassword = require('password-generator');
const got = require('got');
const {
  USERS_METADATA,
  USERS_INDEX,
} = require('../../constants');
const makeRedisKey = require('../../utils/key');

const voximplantInstance = got.extend({
  prefixUrl: 'https://api.voximplant.com/platform_api/',
  responseType: 'json',
});
async function voxReg({ redis, config, log }) {
  // const { jwt } = config;
  // const audience = jwt.defaultAudience;
  const { appName, accountName, credentials, userAudience: voxAudience } = config.voximplant;
  log.info({ vox: config.voximplant }, 'vox config');

  if (!credentials.account_id) {
    return null;
  }

  const registerVoxUser = async (userId) => {
    // const redisKey = makeRedisKey(userId, USERS_METADATA, audience);
    const redisVoxKey = makeRedisKey(userId, USERS_METADATA, voxAudience);

    // const username = await redis.hget(redisKey, 'username');

    const password = generatePassword(8);
    const voxUsername = `${userId}@${appName}.${accountName}.voximplant.com`;
    log.info({ voxUsername }, 'register voximplant user');

    try {
      const { statusCode, body } = await voximplantInstance('AddUser/', {
        searchParams: {
          ...credentials,
          user_name: userId,
          user_display_name: userId,
          user_password: password,
        },
      });

      if (statusCode === 200) {
        await redis.hmset(redisVoxKey, { password, username: voxUsername });
      } else {
        log.warn({ err: body.text(), statusCode }, 'failed to register voximplant user');
      }
    } catch (e) {
      log.warn({ err: e }, 'failed error to register voximplant user');

      throw e;
    }
  };

  const checkAndRegister = async (userId) => {
    const redisKey = makeRedisKey(userId, USERS_METADATA, voxAudience);
    const voxCredExist = await redis.exists(redisKey);

    if (!voxCredExist) {
      return registerVoxUser(userId);
    }

    log.info({ userId }, 'skip user, vox exist');

    return null;
  };

  return (new Promise((resolve, reject) => {
    const stream = redis.sscanStream(USERS_INDEX, {
      count: 100,
    });
    const usersCount = 0;

    stream.on('data', async (usersIds) => {
      stream.pause();

      const jobs = usersIds.map(checkAndRegister);

      await Promise.all(jobs);
      stream.resume();
    });

    stream.on('error', reject);
    stream.on('end', () => {
      log.info(`Process ${usersCount} users`);
      resolve();
    });
  }));
}

module.exports = {
  script: voxReg,
  min: 8,
  final: 9,
};
