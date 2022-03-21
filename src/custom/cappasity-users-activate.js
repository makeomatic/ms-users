const find = require('lodash/find');
const moment = require('moment');
const setMetadata = require('../utils/update-metadata');

/**
 * Adds metadata from billing into usermix
 * @param  {String} username
 * @return {Promise}
 */
module.exports = async function mixPlan(userId, params) {
  const { amqp, config } = this;
  const { audience } = params;
  const { payments } = config;
  const route = [payments.prefix, payments.routes.planGet].join('.');
  const id = 'free';

  const plan = await amqp.publishAndWait(route, id, { timeout: 5000 });

  const subscription = find(plan.subs, ['name', 'month']);
  const nextCycle = moment().add(1, 'month').valueOf();
  const update = {
    userId,
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
        subscriptionType: 'free',
      },
    },
  };

  return setMetadata.call(this, update);
};
