/**
 * Example 13: AAO manifest validation (aao/0.1)
 *
 * A faithful, dependency-free model of the @flashyos/aao manifest checker — the
 * format that decides whether an organization of agents is an Agentic
 * Autonomous Organization rather than a product with agents in it.
 *
 * Canon: flashyos.com/aao, flashyos.com/standard. This mirrors the static
 * checks the real validateCharter runs; the three LIVE conformance questions
 * (was the authorizing human recorded, does revocation stop the agent, is there
 * a real audit trail) cannot be answered from a manifest and are reported as
 * deferred, never declared passed.
 */

export const AAO_VERSION = '0.1';
export const SPEC_FIELDS = ['aao', 'name', 'slug', 'description', 'accountableTo', 'escalation', 'repositories', 'roles'];
export const APPROVALS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ROLE_NAME_MAX = 24;

/**
 * Validate a manifest against the AAO static rules. Returns { valid, errors }.
 * A stray top-level key fails: a manifest that carries an unknown field has not
 * answered the questions the format asks, it has changed the subject.
 */
export function validateCharter(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return { valid: false, errors: ['not an object'] };

  for (const k of Object.keys(c)) {
    if (!SPEC_FIELDS.includes(k) && !k.startsWith('x-')) {
      errors.push(`top-level key "${k}" is neither a spec field nor x- prefixed`);
    }
  }

  if (c.aao !== AAO_VERSION) errors.push(`aao must be "${AAO_VERSION}"`);

  for (const k of ['name', 'slug', 'description', 'accountableTo', 'escalation']) {
    if (typeof c[k] !== 'string' || !c[k].trim()) errors.push(`${k} is missing`);
  }
  if (typeof c.slug === 'string' && !/^[a-z0-9-]+$/.test(c.slug)) errors.push('slug is not machine-safe');

  if (!Array.isArray(c.roles) || c.roles.length < 1) {
    errors.push('a charter with no role is undeclared');
  } else {
    const names = new Set();
    for (const [i, r] of c.roles.entries()) {
      const w = r && r.name ? `role "${r.name}"` : `role ${i}`;
      if (typeof r.name !== 'string' || !r.name.trim()) { errors.push(`${w}: no name`); continue; }
      if (r.name.length > ROLE_NAME_MAX) errors.push(`${w}: over ${ROLE_NAME_MAX} characters`);
      if (names.has(r.name)) errors.push(`duplicate role "${r.name}"`);
      names.add(r.name);
      if (typeof r.family !== 'string' || !/^[a-z-]+$/.test(r.family)) errors.push(`${w}: family is not a lowercase family name`);
      if (typeof r.purpose !== 'string' || r.purpose.length < 12) errors.push(`${w}: purpose is missing or too thin`);
      if (typeof r.measure !== 'string' || !r.measure.trim()) errors.push(`${w}: names no measure`);
      if (!Array.isArray(r.capabilities) || r.capabilities.length < 1) errors.push(`${w}: declares no capability`);
      if (!APPROVALS.includes(r.humanApprovalAtOrAbove)) errors.push(`${w}: humanApprovalAtOrAbove is not one of ${APPROVALS.join('/')}`);
    }
    // An escalation path to nobody is worse than none.
    if (typeof c.escalation === 'string' && !names.has(c.escalation)) {
      errors.push(`escalation names "${c.escalation}", which is not a declared role`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** The seven conformance questions: four static (from the manifest), three live. */
export function conformance(charter) {
  const v = validateCharter(charter);
  const roles = Array.isArray(charter.roles) ? charter.roles : [];

  const q1_rolesAreResponsibilities = roles.length > 0 &&
    roles.every((r) => typeof r.name === 'string' && r.name.length <= ROLE_NAME_MAX && typeof r.purpose === 'string');
  const q2_capabilitiesNameActions = roles.every((r) => Array.isArray(r.capabilities) && r.capabilities.length > 0);
  const q3_approvalWhereItHurts = roles.every((r) => APPROVALS.includes(r.humanApprovalAtOrAbove));
  const q4_reachableHuman = typeof charter.accountableTo === 'string' && charter.accountableTo.trim().length > 0;

  return {
    static: {
      valid: v.valid,
      q1_rolesAreResponsibilities,
      q2_capabilitiesNameActions,
      q3_approvalWhereItHurts,
      q4_reachableHuman
    },
    // These cannot be declared — only demonstrated against a running org.
    live: {
      q5_authorizingHumanRecorded: 'deferred',
      q6_revocationStops: 'deferred',
      q7_realAuditTrail: 'deferred'
    },
    errors: v.errors
  };
}

/** The mesh capabilities: the union of every role's x-capability, sorted. */
export function capabilitiesOf(charter) {
  const set = new Set();
  for (const r of charter.roles ?? []) for (const cap of r['x-capability'] ?? []) set.add(cap);
  return [...set].sort();
}

/** The roles a given approval threshold gates at or above. */
export function rolesGatingAtOrAbove(charter, level) {
  const floor = APPROVALS.indexOf(level);
  return (charter.roles ?? [])
    .filter((r) => APPROVALS.indexOf(r.humanApprovalAtOrAbove) >= floor)
    .map((r) => r.name);
}

/** Does a role declare a given capability? (No implicit permissions.) */
export function roleHasCapability(charter, roleName, capability) {
  const role = (charter.roles ?? []).find((r) => r.name === roleName);
  return !!role && Array.isArray(role.capabilities) && role.capabilities.includes(capability);
}

/** Main example. */
export async function run() {
  console.log('=== Example 13: AAO manifest validation (aao/0.1) ===\n');

  const charter = {
    aao: '0.1',
    name: 'Rites Protocol',
    slug: 'rites-protocol',
    description: 'The present tense of the record: the recurring, witnessed, consequence-bearing act.',
    accountableTo: 'michael@gda.capital',
    escalation: 'spec',
    repositories: [{ name: 'rites-network', url: 'github.com/FlashyLabs/Rites-Network', default: true }],
    roles: [
      { name: 'spec', family: 'engineering',
        purpose: 'Publishes and maintains the ritual/1 standard, its schema and corpus, and validates a fragment against them.',
        measure: 'Conformance corpus cases the reference implementation passes',
        capabilities: ['publish', 'validate'], humanApprovalAtOrAbove: 'MEDIUM',
        'x-capability': ['content-exchange'] },
      { name: 'witness', family: 'risk',
        purpose: 'Attends and records an observance on its rhythm. Unwitnessed practice moves nothing down the ladder.',
        measure: 'Observances recorded with a present witness, as a share of those performed',
        capabilities: ['observe', 'witness'], humanApprovalAtOrAbove: 'LOW' },
      { name: 'consecration', family: 'operations',
        purpose: 'A named human consecrates an observance into consequence. No org, agent or flag substitutes for a person/.',
        measure: 'Observances consecrated by a named person, as a share of those eligible',
        capabilities: ['review', 'consecrate'], humanApprovalAtOrAbove: 'HIGH' }
    ]
  };

  console.log('1. Validating a real charter (Rites Protocol)...');
  const v = validateCharter(charter);
  console.log(`   Valid: ${v.valid}  Errors: ${v.errors.length}\n`);

  console.log('2. The seven conformance questions...');
  const c = conformance(charter);
  console.log('   Static:', JSON.stringify(c.static));
  console.log('   Live:  ', JSON.stringify(c.live), '(cannot be declared)\n');

  console.log('3. Mesh capabilities (union of x-capability):', capabilitiesOf(charter).join(', '), '\n');

  console.log('4. Approval placed where a mistake hurts...');
  console.log('   Gating at HIGH or above:', rolesGatingAtOrAbove(charter, 'HIGH').join(', '));
  console.log('   Gating at LOW or above: ', rolesGatingAtOrAbove(charter, 'LOW').join(', '), '\n');

  console.log('5. Capabilities are explicit (no implicit permissions)...');
  console.log('   consecration has "consecrate":', roleHasCapability(charter, 'consecration', 'consecrate'));
  console.log('   witness has "consecrate":     ', roleHasCapability(charter, 'witness', 'consecrate'), '(closed)\n');

  console.log('6. Refusals...');
  const cases = [
    ['a stray top-level key', { ...charter, foo: 1 }],
    ['a codename role over 24 chars', { ...charter, roles: [{ ...charter.roles[0], name: 'nova-hermes-aura-sage-atlas-extra' }] }],
    ['escalation naming nobody', { ...charter, escalation: 'ghost' }],
    ['a role with no capability', { ...charter, roles: [{ ...charter.roles[0], capabilities: [] }] }]
  ];
  for (const [label, bad] of cases) {
    const r = validateCharter(bad);
    console.log(`   ${label}: valid=${r.valid} (${r.errors[0] ?? ''})`);
  }
  console.log();

  console.log('=== Example 13 Complete ===');
  return { charter, conformance: c };
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
