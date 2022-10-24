/**
 * Provides configuration for searching redis indexes
 * @type {Array} Array of objects: key w/o prefix, fields schema [field, type, attributes]
*/

exports.redisIndexDefinitions = [
  {
    key: '*!data',
    fields: [
      ['id', 'TAG', 'SORTABLE'],
      ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
    ],
  },
];
