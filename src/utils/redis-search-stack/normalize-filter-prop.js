const { USERS_ID_FIELD } = require('../../constants');
const { PIPE_SEPARATOR } = require('./expressions');

const normalizeFilterProp = (propName, actionTypeOrValue) => {
  let field = propName;
  if (field === '#') { // id
    field = USERS_ID_FIELD;
  } else if (field === '#multi') {
    field = actionTypeOrValue.fields.join(PIPE_SEPARATOR);
  }
  // else if (field === 'alias') {
  //   field = 'alias_tag';
  // }
  return field;
};

module.exports = normalizeFilterProp;
