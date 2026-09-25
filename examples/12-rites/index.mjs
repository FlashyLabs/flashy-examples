/**
 * Example 12: Rites — Witnessed Observances and Standing
 *
 * This example demonstrates the ritual/1 format for recording and verifying
 * witnessed observances that affect standing/reputation.
 */

import crypto from 'node:crypto';

let ritualCounter = 0;

/**
 * Create a ritual (observance)
 * Does NOT seal — just records what was observed
 */
export function createRitual({
  kind,
  subject,
  object,
  witness,
  claimedValue,
  claimedOutcome
}) {
  if (!kind) throw new Error('kind is required');
  if (!subject) throw new Error('subject is required');
  if (!object) throw new Error('object is required');
  if (!witness) throw new Error('witness is required');
  if (!claimedValue) throw new Error('claimedValue is required');
  if (!claimedOutcome) throw new Error('claimedOutcome is required');

  // Generate a unique ritual ID
  const timestamp = new Date().toISOString();
  ritualCounter++;
  const hash = crypto
    .createHash('sha256')
    .update(`${kind}:${subject}:${object}:${ritualCounter}`)
    .digest('hex')
    .substring(0, 12);

  return {
    id: `ritual/${witness.replace('org/', '').replace('person/', '')}/${kind}-${timestamp.split('T')[0]}-${hash}`,
    kind,
    subject,
    object,
    when: timestamp,
    witness,
    claimedValue,
    claimedOutcome
  };
}

/**
 * Canonical JSON string (sorted keys, no whitespace)
 * This is what gets hashed for the digest
 */
function canonicalJSON(obj) {
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => {
    let value = obj[k];
    if (typeof value === 'object' && value !== null) {
      value = JSON.parse(canonicalJSON(value));
    }
    return `"${k}":${JSON.stringify(value)}`;
  });
  return `{${pairs.join(',')}}`;
}

/**
 * Seal a ritual (witness affirms it)
 * Creates a content-addressed digest that proves the ritual's content
 */
export function seal(ritual, { by, key }) {
  if (!by) throw new Error('Sealing requires "by" (witness signature)');
  if (!key) throw new Error('Sealing requires "key" for signing');

  // Create canonical form of ritual
  const canonical = canonicalJSON(ritual);

  // Hash the canonical form
  const digest = crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex');

  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', key)
    .update(canonical)
    .digest('hex');

  return {
    ritual,
    canonical,
    digest,
    signature,
    at: new Date().toISOString(),
    by
  };
}

/**
 * Verify a sealed ritual
 *
 * Recomputes the canonical form FROM the ritual itself, then hashes it and
 * compares against the stored digest. It deliberately does NOT trust
 * `sealed.canonical`: if it did, an attacker could swap `sealed.ritual` and
 * leave the stale canonical/digest in place, and tampering would go undetected.
 * Binding the check to `sealed.ritual` is what makes the digest content-addressed.
 */
export function verify(sealed) {
  const canonical = canonicalJSON(sealed.ritual);
  const recomputed = crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex');

  return recomputed === sealed.digest;
}

/**
 * Create non-identifying projection for notary log
 * Public reveals only: digest, kind, timestamp
 * Never reveals: subject, object, or witness
 */
export function nonIdentifyingProjection(sealed) {
  return {
    ref: `vrf/${sealed.digest.substring(0, 12)}`,
    kind: sealed.ritual.kind,
    sealedAt: sealed.at
  };
}

/**
 * Main example
 */
export async function run() {
  console.log('=== Example 12: Rites — Witnessed Observances ===\n');

  // 1. Create a ritual (observance)
  console.log('1. Creating a ritual (observance)...');
  const ritual1 = createRitual({
    kind: 'completion',
    subject: 'person/alice',
    object: 'course/flashy-academy/101',
    witness: 'org/flashy-academy',
    claimedValue: '100-gold',
    claimedOutcome: 'completed'
  });

  console.log(`   ID: ${ritual1.id}`);
  console.log(`   Kind: ${ritual1.kind}`);
  console.log(`   Subject: ${ritual1.subject}`);
  console.log(`   Witness: ${ritual1.witness}\n`);

  // 2. Seal the ritual
  console.log('2. Sealing the ritual (witness affirms it)...');
  const sealed1 = seal(ritual1, {
    by: 'person/verifier-alice',
    key: 'test-key-12345'
  });

  console.log(`   Digest: ${sealed1.digest}`);
  console.log(`   Sealed by: ${sealed1.by}`);
  console.log(`   Sealed at: ${sealed1.at}\n`);

  // 3. Verify the seal
  console.log('3. Verifying the seal...');
  const isValid1 = verify(sealed1, { key: sealed1.signature });
  console.log(`   Valid: ${isValid1}\n`);

  // 4. Create multiple rituals
  console.log('4. Creating multiple sealed rituals...');
  const rituals = [
    {
      kind: 'completion',
      subject: 'person/alice',
      object: 'course/101',
      witness: 'org/academy',
      claimedValue: '100-gold',
      claimedOutcome: 'completed'
    },
    {
      kind: 'achievement',
      subject: 'person/alice',
      object: 'hackathon/2026-09',
      witness: 'org/academy',
      claimedValue: '500-gold',
      claimedOutcome: '1st-place'
    },
    {
      kind: 'contribution',
      subject: 'person/bob',
      object: 'repo/magician',
      witness: 'org/magician',
      claimedValue: '250-gold',
      claimedOutcome: 'merged-pr'
    }
  ];

  const sealed_rituals = rituals.map(r =>
    seal(createRitual(r), {
      by: 'person/verifier',
      key: 'test-key-12345'
    })
  );

  console.log(`   Created and sealed: ${sealed_rituals.length} rituals\n`);

  // 5. Verify all seals
  console.log('5. Verifying all seals...');
  const verifications = sealed_rituals.map((s, i) => ({
    ritual: i,
    valid: verify(s, { key: s.signature })
  }));

  verifications.forEach(v => {
    console.log(`   Ritual ${v.ritual}: ${v.valid ? '✓ valid' : '✗ invalid'}`);
  });
  console.log();

  // 6. Create notary projection (non-identifying)
  console.log('6. Creating non-identifying notary projection...');
  const notary = sealed_rituals.map(s => nonIdentifyingProjection(s));

  console.log(`   Public notary log (${notary.length} entries):`);
  notary.forEach(entry => {
    console.log(`   - ${entry.ref} (${entry.kind}) sealed at ${entry.sealedAt}`);
  });
  console.log();

  // 7. Show what the public sees
  console.log('7. What the public can see vs cannot see...');
  const sealed = sealed_rituals[0];

  console.log('   Sealed ritual (private):');
  console.log(`   - Subject: ${sealed.ritual.subject}`);
  console.log(`   - Object: ${sealed.ritual.object}`);
  console.log(`   - Value: ${sealed.ritual.claimedValue}`);

  console.log('\n   Notary projection (public):');
  const projection = nonIdentifyingProjection(sealed);
  console.log(`   - Reference: ${projection.ref}`);
  console.log(`   - Kind: ${projection.kind}`);
  console.log(`   - Sealed at: ${projection.sealedAt}`);
  console.log('   → No personal data revealed!\n');

  // 8. Demonstrate immutability
  console.log('8. Testing immutability...');

  // Try to tamper with the ritual, leaving the stale canonical/digest in place
  const tamperedRitual = { ...sealed1.ritual, claimedValue: '1000-gold' };
  const tamperedSealed = {
    ...sealed1,
    ritual: tamperedRitual
  };

  // verify() recomputes the canonical form from the ritual, so a swapped
  // ritual no longer matches the sealed digest
  const genuineValid = verify(sealed1);
  const isTamperedValid = verify(tamperedSealed);

  console.log(`   Sealed digest:    ${sealed1.digest}`);
  console.log(`   Genuine valid:    ${genuineValid} (true = intact)`);
  console.log(`   Tampered valid:   ${isTamperedValid} (false = protected)\n`);

  // 9. Show digest properties
  console.log('9. Digest properties (content-addressed)...');
  const ritual_a = createRitual({
    kind: 'completion',
    subject: 'person/alice',
    object: 'course/101',
    witness: 'org/academy',
    claimedValue: '100-gold',
    claimedOutcome: 'completed'
  });

  const sealed_a = seal(ritual_a, {
    by: 'person/verifier',
    key: 'test-key-12345'
  });

  // Create identical ritual with slightly different timing
  const ritual_b = createRitual({
    kind: 'completion',
    subject: 'person/alice',
    object: 'course/101',
    witness: 'org/academy',
    claimedValue: '100-gold',
    claimedOutcome: 'completed'
  });

  const sealed_b = seal(ritual_b, {
    by: 'person/verifier',
    key: 'test-key-12345'
  });

  console.log(`   Ritual A digest: ${sealed_a.digest}`);
  console.log(`   Ritual B digest: ${sealed_b.digest}`);
  console.log(`   Digests differ (content differs by timestamp): ${sealed_a.digest !== sealed_b.digest}\n`);

  console.log('=== Example 12 Complete ===');
  return {
    sealed: sealed_rituals,
    notary: notary,
    verifications: verifications
  };
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
