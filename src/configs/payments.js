/**
 * Payments service integration
 * https://github.com/makeomatic/ms-payments
 * @type {Object}
 */
exports.payments = {
  prefix: 'payments',
  routes: {
    planGet: 'plan.get',
  },
  publishOptions: {
    planGet: {},
  },
};
