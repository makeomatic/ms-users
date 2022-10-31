/**
 * Provides configuration for searching redis indexes
 * @type {Array} Array of objects: baseKey without prefix, audience list, fields [field, type, attributes]
*/

exports.redisIndexDefinitions = [
  { // name: {ms-users}_metadata_*.localhost_idx
    filterKey: 'metadata',
    audience: ['*.localhost'],
    fields: [
      ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
    ],
  },
];
