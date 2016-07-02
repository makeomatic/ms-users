/**
 * Created by Stainwoortsel on 02.07.2016.
 */
const { httpErrorMapper } = require('./model/modelError');

module.exports = function resolveMessage(err, data) {
  if (err) {
    if (err.name === 'ModelError') {
      throw httpErrorMapper(err);
    }

    throw err;
  }

  return data;
};
