exports.rateLimiters = {
  userLogin: {
    enabled: false,
    limitIp: {
      windowInterval: 1000 * 60 * 60 * 24, // 24 hours, milliseconds
      windowLimit: 40,
      blockInterval: 1000 * 60 * 60 * 24 * 7, // 7 days, milliseconds
    },
    limitUserIp: {
      windowInterval: 1000 * 60 * 60 * 24, // 24 hours, milliseconds
      windowLimit: 10,
      blockInterval: 1000 * 60 * 60 * 24, // 1 day, milliseconds
    },
  },
};
