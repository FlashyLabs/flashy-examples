/**
 * Example 13: AAO Charter Validation
 *
 * This example demonstrates validation of AAO (Authority, Activation, Outcomes)
 * charters that declare organization governance.
 */

/**
 * Validate a single role
 */
export function validateRole(role) {
  const errors = [];

  if (!role.id) errors.push('Role missing "id"');
  if (!role.name) errors.push('Role missing "name"');
  if (!role.authority || !Array.isArray(role.authority)) {
    errors.push('Role missing "authority" array');
  }
  if (!role.members || !Array.isArray(role.members)) {
    errors.push('Role missing "members" array');
  }

  if (role.authority && Array.isArray(role.authority)) {
    role.authority.forEach((auth, i) => {
      if (typeof auth !== 'string') {
        errors.push(`Role authority[${i}] must be string, got ${typeof auth}`);
      }
    });
  }

  if (role.members && Array.isArray(role.members)) {
    role.members.forEach((member, i) => {
      if (typeof member !== 'string') {
        errors.push(`Role members[${i}] must be string, got ${typeof member}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a charter against AAO rules
 */
export function validateCharter(charter) {
  const errors = [];
  const warnings = [];

  // Required top-level fields
  if (!charter.kind) errors.push('Charter missing "kind"');
  if (charter.kind && charter.kind !== 'flashyos/1') {
    errors.push(`Charter kind must be "flashyos/1", got "${charter.kind}"`);
  }

  if (!charter.name) errors.push('Charter missing "name"');
  if (!charter.accountableTo) errors.push('Charter missing "accountableTo"');

  // Roles validation
  if (!charter.roles) {
    errors.push('Charter missing "roles" array');
  } else if (!Array.isArray(charter.roles)) {
    errors.push('"roles" must be an array');
  } else {
    const roleIds = new Set();

    charter.roles.forEach((role, i) => {
      const roleValidation = validateRole(role);
      if (!roleValidation.valid) {
        errors.push(`Role ${i}: ${roleValidation.errors.join('; ')}`);
      }

      // Check for duplicate IDs
      if (role.id) {
        if (roleIds.has(role.id)) {
          errors.push(`Duplicate role ID: ${role.id}`);
        }
        roleIds.add(role.id);
      }
    });
  }

  // Capabilities validation (if present)
  if (charter.capabilities && Array.isArray(charter.capabilities)) {
    const roleIds = new Set(charter.roles ? charter.roles.map(r => r.id) : []);
    const capIds = new Set();

    charter.capabilities.forEach((cap, i) => {
      if (!cap.id) {
        errors.push(`Capability ${i} missing "id"`);
      }

      // Check for duplicate capability IDs
      if (cap.id) {
        if (capIds.has(cap.id)) {
          errors.push(`Duplicate capability ID: ${cap.id}`);
        }
        capIds.add(cap.id);
      }

      // Check that role exists
      if (cap.role && !roleIds.has(cap.role)) {
        errors.push(`Capability ${cap.id} references non-existent role ${cap.role}`);
      }

      // Check that action is specified
      if (!cap.action) {
        errors.push(`Capability ${i} missing "action"`);
      }
    });
  }

  // At least one role should exist
  if (!charter.roles || charter.roles.length === 0) {
    warnings.push('Charter has no roles defined');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * List all capabilities in a charter
 * Groups by role
 */
export function listCapabilities(charter) {
  const capabilities = {};

  if (charter.roles) {
    charter.roles.forEach(role => {
      capabilities[role.id] = {
        name: role.name,
        authority: role.authority || [],
        members: role.members || []
      };
    });
  }

  if (charter.capabilities) {
    charter.capabilities.forEach(cap => {
      if (!capabilities[cap.role]) {
        capabilities[cap.role] = {
          name: `Unknown (${cap.role})`,
          authority: [],
          members: []
        };
      }

      if (!capabilities[cap.role].authority.includes(cap.action)) {
        capabilities[cap.role].authority.push(cap.action);
      }
    });
  }

  return capabilities;
}

/**
 * Get all members of a role
 */
export function getRoleMembers(charter, roleId) {
  const role = charter.roles ? charter.roles.find(r => r.id === roleId) : null;
  return role ? role.members : [];
}

/**
 * Check if a person has a capability
 */
export function hasCap(charter, person, capability) {
  if (!charter.roles) return false;

  for (const role of charter.roles) {
    if (!role.members.includes(person)) continue;
    if (!role.authority) continue;
    if (role.authority.includes(capability)) return true;
  }

  return false;
}

/**
 * Main example
 */
export async function run() {
  console.log('=== Example 13: AAO Charter Validation ===\n');

  // 1. Create a valid charter
  console.log('1. Creating a valid charter...');
  const validCharter = {
    kind: 'flashyos/1',
    name: 'ACME Corporation',
    accountableTo: 'person/alice-ceo',
    roles: [
      {
        id: 'role/admin',
        name: 'Administrator',
        authority: ['can:read', 'can:write', 'can:delete', 'can:manage-roles'],
        members: ['person/alice-ceo']
      },
      {
        id: 'role/editor',
        name: 'Content Editor',
        authority: ['can:read', 'can:write'],
        members: ['person/bob-editor', 'person/carol-editor']
      },
      {
        id: 'role/viewer',
        name: 'Viewer',
        authority: ['can:read'],
        members: ['person/dave-viewer', 'person/eve-viewer']
      }
    ],
    capabilities: [
      { id: 'cap/admin', role: 'role/admin', action: 'can:manage-roles' },
      { id: 'cap/edit', role: 'role/editor', action: 'can:write' },
      { id: 'cap/view', role: 'role/viewer', action: 'can:read' }
    ]
  };

  const validation = validateCharter(validCharter);
  console.log(`   Valid: ${validation.valid}`);
  console.log(`   Errors: ${validation.errors.length}`);
  console.log(`   Warnings: ${validation.warnings.length}\n`);

  // 2. Validate a specific role
  console.log('2. Validating admin role...');
  const adminRole = validCharter.roles[0];
  const roleValidation = validateRole(adminRole);
  console.log(`   Valid: ${roleValidation.valid}`);
  console.log(`   Name: ${adminRole.name}`);
  console.log(`   Authority: ${adminRole.authority.join(', ')}`);
  console.log(`   Members: ${adminRole.members.join(', ')}\n`);

  // 3. List all capabilities
  console.log('3. Listing all capabilities...');
  const capabilities = listCapabilities(validCharter);
  Object.entries(capabilities).forEach(([roleId, cap]) => {
    console.log(`   ${roleId} (${cap.name}):`);
    console.log(`     - Authority: ${cap.authority.join(', ')}`);
    console.log(`     - Members: ${cap.members.join(', ')}`);
  });
  console.log();

  // 4. Check permissions
  console.log('4. Checking permissions...');
  const checks = [
    { person: 'person/alice-ceo', cap: 'can:delete', expected: true },
    { person: 'person/bob-editor', cap: 'can:write', expected: true },
    { person: 'person/bob-editor', cap: 'can:delete', expected: false },
    { person: 'person/dave-viewer', cap: 'can:read', expected: true },
    { person: 'person/dave-viewer', cap: 'can:write', expected: false }
  ];

  checks.forEach(({ person, cap, expected }) => {
    const has = hasCap(validCharter, person, cap);
    const status = has === expected ? '✓' : '✗';
    console.log(`   ${status} ${person} ${has ? 'HAS' : 'lacks'} ${cap}`);
  });
  console.log();

  // 5. Create an invalid charter
  console.log('5. Validating an invalid charter...');
  const invalidCharter = {
    kind: 'flashyos/1',
    name: 'Invalid Org',
    // Missing: accountableTo
    roles: [
      {
        id: 'role/admin',
        name: 'Admin'
        // Missing: authority, members
      }
    ],
    capabilities: [
      {
        id: 'cap/admin',
        role: 'role/nonexistent',  // Role doesn't exist
        action: 'can:write'
      }
    ]
  };

  const invalidValidation = validateCharter(invalidCharter);
  console.log(`   Valid: ${invalidValidation.valid}`);
  console.log(`   Errors:`);
  invalidValidation.errors.forEach(err => {
    console.log(`     - ${err}`);
  });
  console.log();

  // 6. Create a charter with duplicate IDs
  console.log('6. Detecting duplicate IDs...');
  const duplicateCharter = {
    kind: 'flashyos/1',
    name: 'Duplicate Test',
    accountableTo: 'person/test',
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

  const dupValidation = validateCharter(duplicateCharter);
  console.log(`   Valid: ${dupValidation.valid}`);
  console.log(`   Errors: ${dupValidation.errors.filter(e => e.includes('Duplicate')).join(', ')}\n`);

  // 7. Show role member queries
  console.log('7. Querying role members...');
  const adminMembers = getRoleMembers(validCharter, 'role/admin');
  const editorMembers = getRoleMembers(validCharter, 'role/editor');
  const viewerMembers = getRoleMembers(validCharter, 'role/viewer');

  console.log(`   Admins: ${adminMembers.join(', ')}`);
  console.log(`   Editors: ${editorMembers.join(', ')}`);
  console.log(`   Viewers: ${viewerMembers.join(', ')}\n`);

  // 8. Show charter structure
  console.log('8. Charter structure for ${validCharter.name}...');
  console.log(`   Kind: ${validCharter.kind}`);
  console.log(`   Accountable to: ${validCharter.accountableTo}`);
  console.log(`   Roles: ${validCharter.roles.length}`);
  console.log(`   Capabilities: ${validCharter.capabilities ? validCharter.capabilities.length : 0}`);
  console.log(`   Total members: ${validCharter.roles.reduce((sum, r) => sum + r.members.length, 0)}\n`);

  console.log('=== Example 13 Complete ===');
  return { validCharter, validValidation: validation };
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
