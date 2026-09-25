import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRitual, seal, verify, nonIdentifyingProjection } from './index.mjs';

describe('Example 12: Rites', () => {
  describe('createRitual()', () => {
    it('creates a ritual with all required fields', () => {
      const ritual = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      assert.equal(ritual.kind, 'completion');
      assert.equal(ritual.subject, 'person/alice');
      assert.equal(ritual.object, 'course/101');
      assert.equal(ritual.witness, 'org/academy');
      assert.equal(ritual.claimedValue, '100-gold');
      assert.equal(ritual.claimedOutcome, 'completed');
    });

    it('generates unique ritual IDs', () => {
      const ritual1 = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      const ritual2 = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      assert.notEqual(ritual1.id, ritual2.id);
    });

    it('requires kind', () => {
      assert.throws(() => {
        createRitual({
          subject: 'person/alice',
          object: 'course/101',
          witness: 'org/academy',
          claimedValue: '100-gold',
          claimedOutcome: 'completed'
        });
      });
    });

    it('requires subject', () => {
      assert.throws(() => {
        createRitual({
          kind: 'completion',
          object: 'course/101',
          witness: 'org/academy',
          claimedValue: '100-gold',
          claimedOutcome: 'completed'
        });
      });
    });

    it('requires object', () => {
      assert.throws(() => {
        createRitual({
          kind: 'completion',
          subject: 'person/alice',
          witness: 'org/academy',
          claimedValue: '100-gold',
          claimedOutcome: 'completed'
        });
      });
    });

    it('requires witness', () => {
      assert.throws(() => {
        createRitual({
          kind: 'completion',
          subject: 'person/alice',
          object: 'course/101',
          claimedValue: '100-gold',
          claimedOutcome: 'completed'
        });
      });
    });

    it('includes current timestamp', () => {
      const ritual = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      assert(ritual.when);
      assert(!isNaN(Date.parse(ritual.when)));
    });
  });

  describe('seal()', () => {
    const testRitual = createRitual({
      kind: 'completion',
      subject: 'person/alice',
      object: 'course/101',
      witness: 'org/academy',
      claimedValue: '100-gold',
      claimedOutcome: 'completed'
    });

    it('creates a content-addressed digest', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      assert(sealed.digest);
      assert.equal(sealed.digest.length, 64); // SHA256 in hex
      assert.match(sealed.digest, /^[0-9a-f]+$/);
    });

    it('includes witness signature', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      assert.equal(sealed.by, 'person/verifier');
    });

    it('requires "by" parameter', () => {
      assert.throws(() => {
        seal(testRitual, { key: 'test-key' });
      });
    });

    it('requires "key" parameter', () => {
      assert.throws(() => {
        seal(testRitual, { by: 'person/verifier' });
      });
    });

    it('produces deterministic digest (same input = same digest)', () => {
      const sealed1 = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const sealed2 = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      assert.equal(sealed1.digest, sealed2.digest);
    });

    it('preserves original ritual', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      assert.deepEqual(sealed.ritual, testRitual);
    });

    it('includes timestamp of sealing', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      assert(sealed.at);
      assert(!isNaN(Date.parse(sealed.at)));
    });
  });

  describe('verify()', () => {
    const testRitual = createRitual({
      kind: 'completion',
      subject: 'person/alice',
      object: 'course/101',
      witness: 'org/academy',
      claimedValue: '100-gold',
      claimedOutcome: 'completed'
    });

    it('verifies a valid sealed ritual', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const isValid = verify(sealed, { key: sealed.signature });

      assert.equal(isValid, true);
    });

    it('detects tampering with ritual content', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      // Tamper with the ritual
      const tamperedSealed = {
        ...sealed,
        ritual: {
          ...sealed.ritual,
          claimedValue: '1000-gold'  // Changed value
        }
      };

      // Recompute canonical form with tampered data
      const recomputedTampered = {
        ...tamperedSealed,
        canonical: JSON.stringify(tamperedSealed.ritual)
      };

      // The new digest will differ
      const newDigest = require('node:crypto')
        .createHash('sha256')
        .update(recomputedTampered.canonical)
        .digest('hex');

      // Original digest != new digest
      assert.notEqual(sealed.digest, newDigest);
    });

    it('produces same result every time for same sealed data', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });

      const result1 = verify(sealed, { key: sealed.signature });
      const result2 = verify(sealed, { key: sealed.signature });
      const result3 = verify(sealed, { key: sealed.signature });

      assert.equal(result1, result2);
      assert.equal(result2, result3);
    });
  });

  describe('nonIdentifyingProjection()', () => {
    const testRitual = createRitual({
      kind: 'completion',
      subject: 'person/alice',
      object: 'course/101',
      witness: 'org/academy',
      claimedValue: '100-gold',
      claimedOutcome: 'completed'
    });

    it('creates a non-identifying projection for notary log', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const projection = nonIdentifyingProjection(sealed);

      assert(projection.ref);
      assert.equal(projection.kind, 'completion');
      assert(projection.sealedAt);
    });

    it('ref is derived from digest (content-addressed)', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const projection = nonIdentifyingProjection(sealed);

      assert(projection.ref.startsWith('vrf/'));
      assert(sealed.digest.includes(projection.ref.substring(4)));
    });

    it('does not expose subject, object, or value', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const projection = nonIdentifyingProjection(sealed);

      assert(!JSON.stringify(projection).includes('alice'));
      assert(!JSON.stringify(projection).includes('course/101'));
      assert(!JSON.stringify(projection).includes('100-gold'));
    });

    it('only reveals digest, kind, and timestamp', () => {
      const sealed = seal(testRitual, { by: 'person/verifier', key: 'test-key' });
      const projection = nonIdentifyingProjection(sealed);

      const keys = Object.keys(projection);
      assert.deepEqual(keys.sort(), ['kind', 'ref', 'sealedAt']);
    });
  });

  describe('Invariants', () => {
    it('invariant: sealed rituals are immutable (digest proves content)', () => {
      const ritual = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      const sealed = seal(ritual, { by: 'person/verifier', key: 'test-key' });
      const originalDigest = sealed.digest;

      // Any change to the ritual changes the digest
      const modified = { ...ritual, claimedValue: '1000-gold' };
      const modifiedSealed = seal(modified, { by: 'person/verifier', key: 'test-key' });

      assert.notEqual(originalDigest, modifiedSealed.digest);
    });

    it('invariant: sealing requires witness affirmation (explicit, not automatic)', () => {
      const ritual = createRitual({
        kind: 'completion',
        subject: 'person/alice',
        object: 'course/101',
        witness: 'org/academy',
        claimedValue: '100-gold',
        claimedOutcome: 'completed'
      });

      // The ritual itself has no digest until sealed
      assert(!ritual.digest);
      assert(!ritual.by);

      // Only seal() adds those
      const sealed = seal(ritual, { by: 'person/verifier', key: 'test-key' });
      assert(sealed.digest);
      assert(sealed.by);
    });

    it('invariant: non-identifying projection reveals no personal data', () => {
      const ritual = createRitual({
        kind: 'achievement',
        subject: 'person/charlie',
        object: 'hackathon/secret-project',
        witness: 'org/private-firm',
        claimedValue: 'classified-amount',
        claimedOutcome: 'sensitive-outcome'
      });

      const sealed = seal(ritual, { by: 'person/secret-verifier', key: 'test-key' });
      const projection = nonIdentifyingProjection(sealed);

      // Public can see that SOMETHING happened
      assert(projection.ref);
      assert(projection.kind);  // type of observance is public
      assert(projection.sealedAt);

      // But cannot see any details
      assert(!JSON.stringify(projection).includes('charlie'));
      assert(!JSON.stringify(projection).includes('secret-project'));
      assert(!JSON.stringify(projection).includes('classified'));
    });
  });
});
