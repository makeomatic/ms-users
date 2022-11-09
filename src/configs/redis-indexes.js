/**
 * Provides configuration for searching redis indexes
 * @type {Array} Array of objects: baseKey without prefix, audience list, fields [field, type, attributes]
*/

exports.redisIndexDefinitions = [
  { // index name: {ms-users}_metadata_*.localhost_idx
    filterKey: 'metadata',
    audience: '*.localhost',
    fields: [
      ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
      ['firstName', 'TEXT', 'NOSTEM', 'SORTABLE'],
      ['lastName', 'TEXT', 'NOSTEM', 'SORTABLE'],
    ],
  },
];
