const { fromPairs } = require('lodash');
const assert = require('assert');

const FT_TYPE_ALIAS = 'AS';
const FT_TYPE_TEXT = 'TEXT';
const FT_TYPE_TAG = 'TAG';
const FT_TYPE_NUMERIC = 'NUMERIC';

const fieldTypes = [
  FT_TYPE_TEXT,
  FT_TYPE_TAG,
  FT_TYPE_NUMERIC,
  FT_TYPE_ALIAS,
];

function extractFieldTypes(fields) {
  const extractedFields = fields.map((definition) => {
    // assume always [name, fieldType]
    const [name, fieldType, aliasName, fieldAliasType] = definition;

    assert(fieldTypes.includes(fieldType), `invalid field type '${fieldType}' for field '${name}'`);

    if (fieldType === FT_TYPE_ALIAS) {
      return [aliasName, fieldAliasType];
    }

    return [name, fieldType];
  });

  console.debug('>>> extractFieldTypes', extractedFields);

  return fromPairs(extractedFields);
}

module.exports = {
  extractFieldTypes,
  FT_TYPE_ALIAS,
  FT_TYPE_NUMERIC,
  FT_TYPE_TAG,
  FT_TYPE_TEXT,
};
