const thirtyDays = 30 * 24 * 60 * 60 * 1000;
const fifteenMinutes = 15 * 60 * 1000;
const halfAnHour = 30 * 60 * 1000;

module.exports = {
  cfList: {
    enabled: false,
    accessList: {
      ttl: thirtyDays,
      listCacheTTL: fifteenMinutes,
    },
    worker: {
      concurrency: 5,
      cleanupInterval: halfAnHour,
    },
  },
};
