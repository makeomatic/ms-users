exports.invocationRulesStorage = {
  syncEnabled: true,
  watchOptions: {
    backoffFactor: 100,
    backoffMax: 30000,
  },
};

exports.revocationRulesManager = {
  enabled: true,
  enableJobs: true,
};
