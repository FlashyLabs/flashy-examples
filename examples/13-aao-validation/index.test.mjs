import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRole,
  validateCharter,
  listCapabilities,
  getRoleMembers,
  hasCap
} from './index.mjs';

describe('Example 13: AAO Charter Validation', () => {
  describe('validateRole()', () => {
    it('validates a complete role', () => {
      const role = {
        id: 'role/admin',
        name: 'Administrator',
        authority: ['can:write', 'can:delete'],
        members: ['person/alice']
      };

      const result = validateRole(role);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('requires id', () => {
      const role = {
        name: 'Admin',
        authority: ['can:write'],
        members: ['person/alice']
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('id')));
    });

    it('requires name', () => {
      const role = {
        id: 'role/admin',
        authority: ['can:write'],
        members: ['person/alice']
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('name')));
    });

    it('requires authority array', () => {
      const role = {
        id: 'role/admin',
        name: 'Admin',
        members: ['person/alice']
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('authority')));
    });

    it('requires members array', () => {
      const role = {
        id: 'role/admin',
        name: 'Admin',
        authority: ['can:write']
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('members')));
    });

    it('authority must be array of strings', () => {
      const role = {
        id: 'role/admin',
        name: 'Admin',
        authority: 'can:write',  // Not an array
        members: ['person/alice']
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
    });

    it('members must be array of strings', () => {
      const role = {
        id: 'role/admin',
        name: 'Admin',
        authority: ['can:write'],
        members: 'person/alice'  // Not an array
      };

      const result = validateRole(role);
      assert.equal(result.valid, false);
    });
  });

  describe('validateCharter()', () => {
    const validCharter = {
      kind: 'flashyos/1',
      name: 'ACME Corp',
      accountableTo: 'person/ceo',
      roles: [
        {
          id: 'role/admin',
          name: 'Admin',
          authority: ['can:write'],
          members: ['person/alice']
        }
      ]
    };

    it('validates a complete charter', () => {
      const result = validateCharter(validCharter);
      assert.equal(result.valid, true);
    });

    it('requires kind', () => {
      const charter = { ...validCharter, kind: undefined };
      const result = validateCharter(charter);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('kind')));
    });

    it('requires kind to be flashyos/1', () => {
      const charter = { ...validCharter, kind: 'flashyos/2' };
      const result = validateCharter(charter);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('flashyos/1')));
    });

    it('requires name', () => {
      const charter = { ...validCharter, name: undefined };
      const result = validateCharter(charter);
      assert.equal(result.valid, false);
    });

    it('requires accountableTo', () => {
      const charter = { ...validCharter, accountableTo: undefined };
      const result = validateCharter(charter);
      assert.equal(result.valid, false);
    });

    it('requires roles array', () => {
      const charter = { ...validCharter, roles: undefined };
      const result = validateCharter(charter);
      assert.equal(result.valid, false);
    });

    it('detects duplicate role IDs', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            authority: ['can:write'],
            members: ['person/alice']
          },
          {
            id: 'role/admin',  // Duplicate!
            name: 'Also Admin',
            authority: ['can:read'],
            members: ['person/bob']
          }
        ]
      };

      const result = validateCharter(charter);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('Duplicate role ID')));
    });

    it('validates nested roles', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            // Missing authority and members
          }
        ]
      };

      const result = validateCharter(charter);
      assert.equal(result.valid, false);
    });

    it('detects invalid capability references', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            authority: ['can:write'],
            members: ['person/alice']
          }
        ],
        capabilities: [
          {
            id: 'cap/test',
            role: 'role/nonexistent',  // Doesn't exist!
            action: 'can:write'
          }
        ]
      };

      const result = validateCharter(charter);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('non-existent')));
    });

    it('detects duplicate capability IDs', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            authority: ['can:write'],
            members: ['person/alice']
          }
        ],
        capabilities: [
          {
            id: 'cap/test',
            role: 'role/admin',
            action: 'can:write'
          },
          {
            id: 'cap/test',  // Duplicate!
            role: 'role/admin',
            action: 'can:read'
          }
        ]
      };

      const result = validateCharter(charter);
      assert.equal(result.valid, false);
      assert(result.errors.some(e => e.includes('Duplicate capability ID')));
    });
  });

  describe('listCapabilities()', () => {
    const charter = {
      kind: 'flashyos/1',
      name: 'Test',
      accountableTo: 'person/ceo',
      roles: [
        {
          id: 'role/admin',
          name: 'Admin',
          authority: ['can:read', 'can:write'],
          members: ['person/alice']
        },
        {
          id: 'role/viewer',
          name: 'Viewer',
          authority: ['can:read'],
          members: ['person/bob']
        }
      ]
    };

    it('lists capabilities by role', () => {
      const caps = listCapabilities(charter);

      assert(caps['role/admin']);
      assert(caps['role/viewer']);
    });

    it('preserves role names and members', () => {
      const caps = listCapabilities(charter);

      assert.equal(caps['role/admin'].name, 'Admin');
      assert.deepEqual(caps['role/admin'].members, ['person/alice']);
    });

    it('aggregates authority permissions', () => {
      const caps = listCapabilities(charter);

      assert.deepEqual(caps['role/admin'].authority, ['can:read', 'can:write']);
      assert.deepEqual(caps['role/viewer'].authority, ['can:read']);
    });
  });

  describe('getRoleMembers()', () => {
    const charter = {
      kind: 'flashyos/1',
      name: 'Test',
      accountableTo: 'person/ceo',
      roles: [
        {
          id: 'role/admin',
          name: 'Admin',
          authority: ['can:write'],
          members: ['person/alice', 'person/charlie']
        }
      ]
    };

    it('returns members of a role', () => {
      const members = getRoleMembers(charter, 'role/admin');
      assert.deepEqual(members, ['person/alice', 'person/charlie']);
    });

    it('returns empty array for non-existent role', () => {
      const members = getRoleMembers(charter, 'role/nonexistent');
      assert.deepEqual(members, []);
    });
  });

  describe('hasCap()', () => {
    const charter = {
      kind: 'flashyos/1',
      name: 'Test',
      accountableTo: 'person/ceo',
      roles: [
        {
          id: 'role/admin',
          name: 'Admin',
          authority: ['can:read', 'can:write', 'can:delete'],
          members: ['person/alice']
        },
        {
          id: 'role/editor',
          name: 'Editor',
          authority: ['can:read', 'can:write'],
          members: ['person/bob']
        },
        {
          id: 'role/viewer',
          name: 'Viewer',
          authority: ['can:read'],
          members: ['person/charlie']
        }
      ]
    };

    it('returns true when person has capability', () => {
      assert.equal(hasCap(charter, 'person/alice', 'can:delete'), true);
      assert.equal(hasCap(charter, 'person/bob', 'can:write'), true);
      assert.equal(hasCap(charter, 'person/charlie', 'can:read'), true);
    });

    it('returns false when person lacks capability', () => {
      assert.equal(hasCap(charter, 'person/bob', 'can:delete'), false);
      assert.equal(hasCap(charter, 'person/charlie', 'can:write'), false);
    });

    it('returns false for unknown person', () => {
      assert.equal(hasCap(charter, 'person/unknown', 'can:read'), false);
    });

    it('returns false for unknown capability', () => {
      assert.equal(hasCap(charter, 'person/alice', 'can:unknown'), false);
    });
  });

  describe('Invariants', () => {
    it('invariant: authority is explicit and closed', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            authority: ['can:write'],  // Explicitly named
            members: ['person/alice']  // Explicitly listed
          }
        ]
      };

      const validation = validateCharter(charter);
      assert.equal(validation.valid, true);

      // No implicit permissions
      assert.equal(hasCap(charter, 'person/alice', 'can:delete'), false);
      assert.equal(hasCap(charter, 'person/alice', 'can:manage-roles'), false);
    });

    it('invariant: roles are closed (member list is exhaustive)', () => {
      const charter = {
        kind: 'flashyos/1',
        name: 'Test',
        accountableTo: 'person/ceo',
        roles: [
          {
            id: 'role/admin',
            name: 'Admin',
            authority: ['can:write'],
            members: ['person/alice']  // Only alice
          }
        ]
      };

      // Bob is not in the members list, so doesn't have the capability
      assert.equal(hasCap(charter, 'person/bob', 'can:write'), false);
    });
  });
});
