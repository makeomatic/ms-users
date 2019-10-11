const twoHours = 2 * 60 * 60;
const sevenDays = 7 * 24 * 60 * 60;
exports.rateLimiters = {
  userLogin: {
    keyPrefix: 'act-login',

    // IP
    ipLimitEnabled: true,
    ipLimitInterval: sevenDays,
    ipLimitAttemptsCount: 15,
    ipBlockInterval: sevenDays,

    // User + IP
    userIpLimitEnabled: true,
    userIpLimitInterval: twoHours,
    userIpLimitAttemptsCount: 5,
    userIpBlockInterval: twoHours,
  },
};
