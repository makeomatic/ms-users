/**
 * Provides configuration for searching redis indexes
 * @type {Array} Array of objects: baseKey without prefix, audience list, fields [field, type, attributes]
*/

exports.redisIndexDefinitions = [
  {
    baseKey: '*!metadata',
    audience: ['*.localhost'],
    fields: [
      ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
    ],
  },
  // {
  //   baseKey: 'user-iterator-set',
  //   audience: [],
  //   fields: [
  //     ['id', 'TAG', 'SORTABLE'],
  //     ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
  //   ],
  // },
];
