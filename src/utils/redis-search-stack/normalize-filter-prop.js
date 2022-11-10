const { USERS_ID_FIELD } = require('../../constants');

const normalizeFilterProp = (propName, actionTypeOrValue) => {
  let field = propName;
  if (field === '#') { // id
    field = USERS_ID_FIELD;
  } else if (field === '#multi') {
    field = actionTypeOrValue.fields.join('|');
  }

  return field;
};

module.exports = normalizeFilterProp;
