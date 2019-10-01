exports.rateLimiters = {
  loginGlobalIp: {
    interval: 60 * 60 * 24 * 7, // 7 days in seconds
    limit: 15,
  },
  loginUserIp: {
    interval: 2 * 60 * 60, // 2 hours in seconds
    limit: 5,
  },
};
