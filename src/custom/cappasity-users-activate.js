const find = require('lodash/find');
const moment = require('moment');
const setMetadata = require('../utils/updateMetadata.js');

/**
 * Adds metadata from billing into usermix
 * @param  {String} username
 * @return {Promise}
 */
module.exports = function mixPlan(username, params) {
  const { amqp, config } = this;
  const { audience } = params;
  const { payments } = config;
  const route = [payments.prefix, payments.routes.planGet].join('.');
  const id = 'free';

  return amqp
    .publishAndWait(route, id, { timeout: 5000 })
    .bind(this)
    .then(function mix(plan) {
      const subscription = find(plan.subs, ['name', 'month']);
      const nextCycle = moment().add(1, 'month').valueOf();
      const update = {
        username,
        audience,
        metadata: {
          $set: {
            plan: id,
            agreement: id,
            nextCycle,
            models: subscription.models,
            modelPrice: subscription.price,
            subscriptionPrice: '0',
            subscriptionInterval: 'month',
          },
        },
      };

      return setMetadata.call(this, update);
    });
};
