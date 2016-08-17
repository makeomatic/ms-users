// This migrations adds external ids to the existings users
//
const { USERS_ALIAS_TO_LOGIN } = require('../../constants.js');

// migration configuration
exports.min = 0;
exports.final = 1;
exports.keys = [USERS_ALIAS_TO_LOGIN];
exports.script = `${__dirname}/migrate.lua`;
