exports.invocationRulesStorage = {
  syncEnabled: true,
  watchOptions: {
    backoffFactor: 100,
    backoffMax: 30000,
  },
};

exports.revocationRulesManager = {
  enabled: false,
  jobsEnabled: false,
  cleanupInterval: 10 * 60 * 1000, // 10 minutes
};
