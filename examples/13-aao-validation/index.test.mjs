import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AAO_VERSION,
  APPROVALS,
  ROLE_NAME_MAX,
  validateCharter,
  conformance,
  capabilitiesOf,
  rolesGatingAtOrAbove,
  roleHasCapability
} from './index.mjs';

const CHARTER = {
  aao: '0.1',
  name: 'Rites Protocol',
  slug: 'rites-protocol',
  description: 'The present tense of the record.',
  accountableTo: 'michael@gda.capital',
  escalation: 'spec',
  repositories: [{ name: 'rites-network', url: 'github.com/FlashyLabs/Rites-Network', default: true }],
  roles: [
    { name: 'spec', family: 'engineering', purpose: 'Publishes and maintains the ritual/1 standard.', measure: 'Corpus cases passed', capabilities: ['publish', 'validate'], humanApprovalAtOrAbove: 'MEDIUM', 'x-capability': ['content-exchange'] },
    { name: 'witness', family: 'risk', purpose: 'Attends and records an observance on its rhythm.', measure: 'Observances with a witness', capabilities: ['observe', 'witness'], humanApprovalAtOrAbove: 'LOW' },
    { name: 'consecration', family: 'operations', purpose: 'A named human consecrates into consequence.', measure: 'Observances consecrated', capabilities: ['review', 'consecrate'], humanApprovalAtOrAbove: 'HIGH' }
  ]
};

describe('Example 13: AAO manifest validation (aao/0.1)', () => {
  describe('validateCharter()', () => {
    it('validates a real charter', () => {
      const r = validateCharter(CHARTER);
      assert.equal(r.valid, true, r.errors.join('; '));
    });

    it('requires aao "0.1"', () => {
      assert.equal(AAO_VERSION, '0.1');
      assert.equal(validateCharter({ ...CHARTER, aao: '0.2' }).valid, false);
      assert.equal(validateCharter({ ...CHARTER, aao: undefined }).valid, false);
    });

    it('refuses a stray top-level key', () => {
      const r = validateCharter({ ...CHARTER, foo: 1 });
      assert.equal(r.valid, false);
      assert(r.errors.some((e) => e.includes('neither a spec field nor x-')));
    });

    it('allows an x- prefixed top-level key', () => {
      assert.equal(validateCharter({ ...CHARTER, 'x-comment': ['note'] }).valid, true);
    });

    it('requires name, description, accountableTo, escalation', () => {
      for (const k of ['name', 'description', 'accountableTo', 'escalation']) {
        assert.equal(validateCharter({ ...CHARTER, [k]: '' }).valid, false, `missing ${k} should fail`);
      }
    });

    it('requires a machine-safe slug', () => {
      assert.equal(validateCharter({ ...CHARTER, slug: 'Rites Protocol' }).valid, false);
    });

    it('refuses a charter with no roles', () => {
      assert.equal(validateCharter({ ...CHARTER, roles: [] }).valid, false);
    });

    it('refuses a role name over the character cap', () => {
      const long = 'x'.repeat(ROLE_NAME_MAX + 1);
      const r = validateCharter({ ...CHARTER, roles: [{ ...CHARTER.roles[0], name: long }] });
      assert.equal(r.valid, false);
      assert(r.errors.some((e) => e.includes('characters')));
    });

    it('refuses a duplicate role name', () => {
      const r = validateCharter({ ...CHARTER, roles: [CHARTER.roles[0], CHARTER.roles[0]] });
      assert.equal(r.valid, false);
      assert(r.errors.some((e) => e.includes('duplicate role')));
    });

    it('refuses a role with a thin purpose', () => {
      assert.equal(validateCharter({ ...CHARTER, roles: [{ ...CHARTER.roles[0], purpose: 'too thin' }] }).valid, false);
    });

    it('refuses a role that names no measure', () => {
      assert.equal(validateCharter({ ...CHARTER, roles: [{ ...CHARTER.roles[0], measure: '' }] }).valid, false);
    });

    it('refuses a role with no capability', () => {
      const r = validateCharter({ ...CHARTER, roles: [{ ...CHARTER.roles[0], capabilities: [] }] });
      assert.equal(r.valid, false);
      assert(r.errors.some((e) => e.includes('no capability')));
    });

    it('refuses an approval threshold off the closed list', () => {
      assert.equal(validateCharter({ ...CHARTER, roles: [{ ...CHARTER.roles[0], humanApprovalAtOrAbove: 'SOMETIMES' }] }).valid, false);
      assert.deepEqual(APPROVALS, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    });

    it('refuses an escalation naming a role that does not exist', () => {
      const r = validateCharter({ ...CHARTER, escalation: 'ghost' });
      assert.equal(r.valid, false);
      assert(r.errors.some((e) => e.includes('not a declared role')));
    });
  });

  describe('conformance()', () => {
    it('answers the four static questions true for a good charter', () => {
      const c = conformance(CHARTER);
      assert.equal(c.static.valid, true);
      assert.equal(c.static.q1_rolesAreResponsibilities, true);
      assert.equal(c.static.q2_capabilitiesNameActions, true);
      assert.equal(c.static.q3_approvalWhereItHurts, true);
      assert.equal(c.static.q4_reachableHuman, true);
    });

    it('reports the three live questions as deferred, never passed', () => {
      const c = conformance(CHARTER);
      assert.equal(c.live.q5_authorizingHumanRecorded, 'deferred');
      assert.equal(c.live.q6_revocationStops, 'deferred');
      assert.equal(c.live.q7_realAuditTrail, 'deferred');
    });

    it('q4 fails when there is no reachable human', () => {
      assert.equal(conformance({ ...CHARTER, accountableTo: '' }).static.q4_reachableHuman, false);
    });
  });

  describe('capabilitiesOf()', () => {
    it('is the sorted union of every role x-capability', () => {
      assert.deepEqual(capabilitiesOf(CHARTER), ['content-exchange']);
    });

    it('is empty when no role declares one', () => {
      assert.deepEqual(capabilitiesOf({ ...CHARTER, roles: [{ ...CHARTER.roles[1] }] }), []);
    });
  });

  describe('rolesGatingAtOrAbove()', () => {
    it('lists roles gating at or above a threshold', () => {
      assert.deepEqual(rolesGatingAtOrAbove(CHARTER, 'HIGH'), ['consecration']);
      assert.deepEqual(rolesGatingAtOrAbove(CHARTER, 'MEDIUM').sort(), ['consecration', 'spec']);
      assert.deepEqual(rolesGatingAtOrAbove(CHARTER, 'LOW').sort(), ['consecration', 'spec', 'witness']);
    });
  });

  describe('roleHasCapability() — no implicit permissions', () => {
    it('is true only for explicitly declared capabilities', () => {
      assert.equal(roleHasCapability(CHARTER, 'consecration', 'consecrate'), true);
      assert.equal(roleHasCapability(CHARTER, 'witness', 'consecrate'), false);
      assert.equal(roleHasCapability(CHARTER, 'unknown', 'anything'), false);
    });
  });
});
