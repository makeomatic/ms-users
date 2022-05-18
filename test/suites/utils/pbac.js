const { ok } = require('assert');

const { defaultScopes, getAbility, isActionPossible, isObjectActionPossible } = require('../../../src/utils/pbac');

describe('#RBAC/PBAC', function RevocationRulesSyncSuite() {
  it('should provide access to admin', () => {
    const ability = getAbility(defaultScopes.admin);

    ok(isActionPossible(ability, 'manage', 'some'));
    ok(isActionPossible(ability, 'access', 'some'));
    ok(isActionPossible(ability, 'read', 'some'));
    ok(isActionPossible(ability, 'write', 'some'));
    ok(isActionPossible(ability, 'delete', 'some'));
  });

  it('should validate passed object and subject', () => {
    const ability = getAbility(defaultScopes.admin);

    ok(isObjectActionPossible(ability, 'manage', 'some', {}));
    ok(isObjectActionPossible(ability, 'access', 'some', {}));
    ok(isObjectActionPossible(ability, 'read', 'some', {}));
    ok(isObjectActionPossible(ability, 'write', 'some', {}));
    ok(isObjectActionPossible(ability, 'delete', 'some', {}));
  });

  it('should deny access without specific scope', () => {
    const ability = getAbility([{
      subject: 'some',
      action: 'read',
    }]);

    ok(isActionPossible(ability, 'read', 'some'));
    ok(!isActionPossible(ability, 'write', 'some'));
    ok(!isActionPossible(ability, 'read', 'other'));
  });

  it('should support parent scope', () => {
    const ability = getAbility([
      {
        subject: 'parent:some',
        action: 'manage',
        inverted: true,
      },
      {
        subject: 'parent:some',
        action: 'read',
      },
      {
        subject: 'parent',
        action: 'write',
      },
    ]);

    ok(!isActionPossible(ability, 'manage', 'parent:some'));
    ok(!isActionPossible(ability, 'write', 'parent:some'));
    ok(isActionPossible(ability, 'read', 'parent:some'));

    ok(!isActionPossible(ability, 'manage', 'parent:some-more'));
    ok(isActionPossible(ability, 'write', 'parent:some-more'));
    ok(!isActionPossible(ability, 'read', 'parent:some-more'));

    ok(!isActionPossible(ability, 'manage', 'parent'));
    ok(!isActionPossible(ability, 'read', 'parent'));
    ok(isActionPossible(ability, 'write', 'parent'));
  });

  it('should support parent allow, child deny scope', () => {
    const ability = getAbility([
      {
        subject: 'parent',
        action: 'write',
      },
      {
        subject: 'parent:some',
        action: 'write',
        inverted: true,
      },
    ]);

    ok(!isActionPossible(ability, 'manage', 'parent:some'));
    ok(!isActionPossible(ability, 'write', 'parent:some'));
    ok(!isActionPossible(ability, 'read', 'parent:some'));

    ok(!isActionPossible(ability, 'manage', 'parent'));
    ok(!isActionPossible(ability, 'read', 'parent'));
    ok(isActionPossible(ability, 'write', 'parent'));
  });

  it('should support parent deny, child allow scope', () => {
    const ability = getAbility([
      {
        subject: 'parent',
        action: 'write',
        inverted: true,
      },
      {
        subject: 'parent:some',
        action: 'write',
      },
    ]);

    ok(!isActionPossible(ability, 'manage', 'parent:some'));
    ok(isActionPossible(ability, 'write', 'parent:some'));
    ok(!isActionPossible(ability, 'read', 'parent:some'));

    ok(!isActionPossible(ability, 'manage', 'parent'));
    ok(!isActionPossible(ability, 'read', 'parent'));
    ok(!isActionPossible(ability, 'write', 'parent'));
  });

  it('should support parent manage allow, child deny scope', () => {
    const ability = getAbility([
      {
        subject: 'parent',
        action: 'manage',
      },
      {
        subject: 'parent:some',
        action: 'manage',
        inverted: true,
      },
    ]);

    ok(!isActionPossible(ability, 'manage', 'parent:some'));
    ok(!isActionPossible(ability, 'write', 'parent:some'));
    ok(!isActionPossible(ability, 'read', 'parent:some'));

    ok(isActionPossible(ability, 'manage', 'parent'));
    ok(isActionPossible(ability, 'read', 'parent'));
    ok(isActionPossible(ability, 'write', 'parent'));
  });

  it('should support global manage allow, some scope deny', () => {
    const ability = getAbility([
      {
        action: 'manage',
        subject: 'all',
      },
      {
        subject: 'parent',
        action: 'read',
        inverted: true,
      },
    ]);

    ok(isActionPossible(ability, 'manage', 'parent'));
    ok(!isActionPossible(ability, 'read', 'parent'));
    ok(isActionPossible(ability, 'write', 'parent'));
  });
});
