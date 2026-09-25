# Example 12: Rites — Witnessed Observances and Standing

Learn to record and verify witnessed observances using the ritual/1 format.

## What is Rites?

Rites is a protocol for recording witnessed observances that affect an agent's standing (reputation). Unlike IntentMesh (what you plan to build), Rites records what you actually did.

- **Witnessed events** — actions observed and recorded by multiple parties
- **Sealed outcomes** — cryptographically sealed observances cannot be altered
- **Standing impact** — verified actions affect reputation in networks that trust the witness
- **Non-identifying projection** — the public notary log reveals no personal data
- **Verifiable anywhere** — a reader can verify an observance against the seal without trusting the issuer

## Key Concepts

### Ritual — a structured observance

```javascript
{
  id: 'ritual/acme/module-completed-2026-09',
  kind: 'completion',                        // completion | achievement | contribution | certification
  subject: 'person/alice',                   // who did it
  object: 'course/flashy-academy/101',       // what they did it to
  when: '2026-09-25T14:30:00Z',             // when
  witness: 'org/flashy-academy',             // who saw it
  claimedValue: 'acme-token',                // what it's worth to the subject
  claimedOutcome: 'completed'                // what happened
}
```

### Seal — proof of witnessing

```javascript
{
  ritual: { /* ritual data above */ },
  digest: 'sha256-hash-of-canonical-json',   // content-addressed
  at: '2026-09-25T14:30:05Z',               // when sealed
  by: 'person/alice-academy-verifier'       // who sealed it
}
```

### Three Invariants

1. **Witnessed events are non-modifiable** — once sealed, a ritual cannot change
2. **Sealing requires explicit verification** — a witness must actively affirm they saw it
3. **Non-identifying projection** — the public notary reveals only that an observance happened, not who was involved

## Running This Example

```bash
npm run examples:rites
npm test examples/12-rites
```

## Code Walkthrough

See `index.mjs` for the full example. Key patterns:

```javascript
import { createRitual, seal, verify } from './index.mjs';

// 1. Create a ritual (observance)
const ritual = createRitual({
  kind: 'completion',
  subject: 'person/alice',
  object: 'course/flashy-academy/101',
  witness: 'org/flashy-academy',
  claimedValue: '100-gold',
  claimedOutcome: 'completed'
});

console.log(ritual.id);  // ritual/acme/completion-2026-09-25T...

// 2. Seal the ritual (witness affirms it)
const sealed = seal(ritual, {
  by: 'person/verifier-alice',
  key: 'test-key'  // in production: cryptographic signing key
});

console.log(sealed.digest);  // sha256 of canonical ritual

// 3. Verify the seal
const isValid = verify(sealed);
console.log(isValid);  // true

// 4. Create multiple rituals
const rituals = [
  createRitual({
    kind: 'completion',
    subject: 'person/alice',
    object: 'course/101',
    witness: 'org/academy',
    claimedValue: '100-gold',
    claimedOutcome: 'completed'
  }),
  createRitual({
    kind: 'achievement',
    subject: 'person/alice',
    object: 'hackathon/2026-09',
    witness: 'org/academy',
    claimedValue: '500-gold',
    claimedOutcome: '1st-place'
  })
];

// 5. Seal all
const sealed_rituals = rituals.map(r => seal(r, {
  by: 'person/verifier',
  key: 'test-key'
}));

console.log(`Sealed ${sealed_rituals.length} rituals`);
```

## Invariants Tested

✅ **Sealed rituals are immutable** — digest matches content forever  
✅ **Sealing requires witness affirmation** — `seal()` is explicit, not automatic  
✅ **Digests are content-addressed** — same ritual always hashes the same way  
✅ **Verification is deterministic** — same sealed ritual always verifies correctly  
✅ **Non-identifying projection** — notary log contains only digest, kind, timestamp  

## Why This Matters

**Problem:** Standing systems today are black boxes. An agent's reputation is a vendor-specific number with no way to verify why it changed.

**Solution:** Witnessed observances mean:
- Every standing change is backed by a sealed observance
- A reader can verify the seal using only the digest and the ritual
- The public notary reveals that something happened at a time, but not what
- Different networks can weight the same observances differently (some trust this witness, others don't)

## The Flashy Estate Standards

This example teaches the `ritual/1` format, part of the estate:

- `trust/1` — trust graphs and routing (Magician)
- `intent/1` — federated roadmaps (IntentMesh)
- `ritual/1` — witnessed observances (Rites)
- `aao/1` — authority, activation, outcomes (GDA-OS)

## Next Steps

1. Understand how sealed observances drive standing (see Flashy Network's `/settlements`)
2. Learn how the notary log aggregates seals from multiple witnesses
3. Explore how different policies weight the same observance differently
4. Integrate Rites into your own identity or rewards system

