const Users = require('../adapter');
const fsort = require('redis-filtered-sort');
const { USERS_INDEX, USERS_PUBLIC_INDEX } = require('../constants.js');

module.exports = function iterateOverActiveUsers(opts) {
  const { criteria, audience, filter } = opts;

  return Users.getList({
    criteria,
    audience,
    index: opts.public ? USERS_PUBLIC_INDEX : USERS_INDEX,
    strFilter: typeof filter === 'string' ? filter : fsort.filter(filter || {}),
    order: opts.order || 'ASC',
    offset: opts.offset || 0,
    limit: opts.limit || 10
  });

};
