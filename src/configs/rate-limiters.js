exports.rateLimiters = {
  userLogin: {
    enabled: false,
    forIp: {
      interval: 60 * 60 * 24, // 24 hours
      attempts: 15,
      blockInterval: 60 * 60 * 24 * 7, // 7 days
    },
    forUserIp: {
      interval: 60 * 60 * 24, // 24 hours
      attempts: 5,
      blockInterval: 60 * 60 * 24, // 1 day
    },
  },
};
