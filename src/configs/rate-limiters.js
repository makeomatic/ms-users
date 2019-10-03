exports.rateLimiters = {
  loginGlobalIp: {
    enabled: true,
    interval: 60 * 60 * 24 * 7, // 7 days in seconds
    limit: 15,
  },
  loginUserIp: {
    enabled: true,
    interval: 2 * 60 * 60, // 2 hours in seconds
    limit: 5,
  },
};
