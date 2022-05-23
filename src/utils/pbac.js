const { Ability, subject } = require('@casl/ability');

/**
 * Creates ability based on passed rules
 * @param {*} rules
 * @returns
 */
function getAbility(rules) {
  return new Ability(rules);
}

/**
 * Verifies whether action is available on provided bubject.
 * @param {Ability} ability
 * @param {string} action
 * @param {string|Object} sub
 * @param {string} [_overrideSubject]
 * @returns
 */
function isActionPossible(ability, action, targetSubject, _overrideSubject) {
  const actionSubject = typeof _overrideSubject === 'string' ? _overrideSubject : targetSubject;
  const parts = actionSubject.split(':');
  const [scopeSubject] = parts;

  if (ability.possibleRulesFor(action, actionSubject).length > 0) {
    return ability.can(action, actionSubject);
  }

  return parts.length > 1 && ability.can(action, scopeSubject);
}

/**
 * Verifies whether action is available on provided object.
 * Wraps object with secified Subject to mach rules.
 *
 * @param {Ability} ability
 * @param {string} action
 * @param {string} subject
 * @param {Object} obj
 * @returns
 */
function isObjectActionPossible(ability, action, sub, obj) {
  return isActionPossible(ability, action, subject(sub, obj), sub);
}

module.exports = {
  getAbility,
  isObjectActionPossible,
  isActionPossible,
};
