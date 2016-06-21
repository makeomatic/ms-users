const find = require('lodash/find');
const moment = require('moment');
const { User } = require('../model/usermodel');

/**
 * Adds metadata from billing into usermix
 * @param  {String} username
 * @param  {String} audience
 * @return {Promise}
 */
module.exports = function mixPlan(username, audience) {
  const { amqp, config: payments } = this;
  const route = [payments.prefix, payments.routes.planGet].join('.');
  const id = 'free';

  return amqp
    .publishAndWait(route, id, { timeout: 5000 })
    .bind(this)
    .then(function mix(plan) {
      const subscription = find(plan.subs, ['name', 'month']);
      const nextCycle = moment().add(1, 'month').valueOf();
      const metadata = {
        $set: {
          plan: id,
          agreement: id,
          nextCycle,
          models: subscription.models,
          modelPrice: subscription.price,
          subscriptionPrice: '0',
          subscriptionInterval: 'month',
        },
      };

      return User.setMeta.call(this, username, audience, metadata);
    });
};
