const thirtyDays = 30 * 24 * 60 * 60 * 1000;
const fifteenMinutes = 15 * 60 * 1000;
const halfAnHour = 30 * 60 * 1000;

module.exports = {
  cfAccessList: {
    enabled: false,
    accessList: {
      ttl: thirtyDays,
      listCacheTTL: fifteenMinutes,
    },
    worker: {
      enabled: true,
      concurrency: 5,
      cleanupInterval: halfAnHour,
    },
    api: {
      retry: {
        retries: 20,
        factor: 2,
      },
    },
  },
};
