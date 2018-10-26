const get = require('get-value');

const { hasOwnProperty } = Object.prototype;
const isValid = (key, obj) => hasOwnProperty.call(obj, key) && obj[key] !== undefined;

module.exports = (target, path, options = {}) => {
  return get(target, path, { ...options, isValid });
};
