/**
 * Provides configuration for searching redis indexes
 * @type {Array} Array of objects: filterKey without prefix, audience list, fields [field, type, attributes]
*/

exports.redisIndexDefinitions = [
  // Index Name: {ms-users}-metadata-*.localhost-v1-idx
  // Index Filter: metadata!*.localhost
  {
    version: '1',
    filterKey: 'metadata',
    audience: ['*.localhost'], // for access to index on search
    fields: [
      ['id', 'TAG', 'SORTABLE']
      ['username', 'TEXT', 'NOSTEM', 'SORTABLE'],
      ['created', 'NUMERIC', 'SORTABLE'],
    ],
    multiWords: ['username'],
  },
];
