exports.revocationRules = {
  enabled: false,
  watchOptions: {
    backoffFactor: 100,
    backoffMax: 30000,
  },
  storageCacheTTL: 20 * 60 * 1000, // 20 minutes
};
