# Example 12: Sealing & Non-Identifying Projection (a Rites concepts exercise)

Learn two concepts a Rites `ritual/1` log depends on — a **content-addressed
digest** that binds to a record's content, and a **non-identifying public
projection** — using a deliberately simplified record.

> ⚠️ **This is a concepts exercise, not the canonical `ritual/1` format.**
> Real `ritual/1` fragments have **liturgies** and **observances** that climb a
> `performed → witnessed → consecrated` state ladder, require an `https://`
> **evidence** URL and an **independent witness** (neither the performer nor its
> principal), are **consecrated by a `person/`**, are **append-only**
> (corrections `supersede`), and carry **no reward or value** — accrual lives in
> a separate `reward/1` ("an observance that could carry its own reward is a slot
> machine with liturgical vocabulary"). Model real fragments on
> [`Rites-Network/SPEC.md`](https://github.com/FlashyLabs/Rites-Network/blob/main/SPEC.md)
> and the [flashy-docs rites guide](https://github.com/flashylabs/flashy-docs/blob/main/docs/guides/rites-witnessed-observances.md),
> **not** on this example's simplified record.

## What This Example Teaches

- **Content-addressed digest** — a seal's digest is `sha256` of the record's
  canonical JSON; `verify()` recomputes the canonical form *from the record
  itself*, so tampering is detected
- **Deterministic verification** — same record verifies the same way, anywhere,
  with no secret
- **Non-identifying projection** — a public leaf reveals only an opaque ref, a
  kind, and a timestamp; never the subject, object, or evidence

## The Simplified Record

```javascript
{
  id: 'ritual/academy/completion-2026-09-25-a7f2b1c3',
  kind: 'completion',                        // completion | achievement | contribution
  subject: 'person/alice',                   // who
  object: 'course/flashy-academy/101',       // what
  when: '2026-09-25T14:30:00Z',              // when
  witness: 'org/flashy-academy',             // who recorded it
  evidence: 'https://ci.example/runs/101',   // an https URL a stranger can open
  outcome: 'completed'                        // what happened — NO reward, NO value
}
```

Compare this to the canonical shape in the spec: there is no state ladder here,
no independent-witness rule, no `person/` consecration, and no append-only
`supersedes`. Those are what make `ritual/1` a witnessed practice rather than a
self-asserted claim.

## The Seal

```javascript
{
  ritual: { /* record above */ },
  canonical: '{"evidence":"...","kind":"completion",...}',  // sorted keys
  digest: 'sha256-of-canonical',             // content-addressed
  signature: 'hmac-of-canonical',
  at: '2026-09-25T14:30:05Z',
  by: 'person/verifier'
}
```

## Running This Example

```bash
npm run examples:rites
npm test examples/12-rites
```

## Code Walkthrough

```javascript
import { createRitual, seal, verify, nonIdentifyingProjection } from './index.mjs';

// 1. Create a record
const ritual = createRitual({
  kind: 'completion',
  subject: 'person/alice',
  object: 'course/flashy-academy/101',
  witness: 'org/flashy-academy',
  evidence: 'https://ci.example/runs/101',
  outcome: 'completed'
});

// 2. Seal it
const sealed = seal(ritual, { by: 'person/verifier', key: 'test-key' });

// 3. Verify — recomputes canonical FROM the record, so tampering flips to false
verify(sealed);  // true

// 4. Publish only the non-identifying projection
nonIdentifyingProjection(sealed);
// { ref: 'vrf/<digest-prefix>', kind: 'completion', sealedAt: '...' }
```

## Invariants Tested

✅ **Sealed records are content-addressed** — same record always hashes the same  
✅ **Tampering is detected** — `verify()` recomputes canonical from the record,
so swapping the record while keeping a stale digest returns `false`  
✅ **Verification is deterministic** — same sealed record always verifies the same  
✅ **Non-identifying projection** — the public leaf contains only ref, kind,
timestamp; a test asserts the subject, object, and evidence never leak  

## Why This Matters

A content-addressed digest lets a reader verify a record without trusting the
issuer, and a non-identifying projection lets a public log prove *that* something
happened without revealing *who*. Both are load-bearing for a real `ritual/1`
transparency log — this example isolates them so they are easy to see.

## The Flashy Estate Standards

| Standard | Format | Solves |
|----------|--------|--------|
| `trust/1` | Trust graphs and routing | Magician |
| `intent/1` | Federated roadmaps | IntentMesh |
| `ritual/1` | Witnessed practice (liturgies + observances) | Rites |
| `aao/0.1` | Machine-readable authority + conformance | FlashyOS |

## Next Steps

1. Read the [rites guide](https://github.com/flashylabs/flashy-docs/blob/main/docs/guides/rites-witnessed-observances.md)
   and [`Rites-Network/SPEC.md`](https://github.com/FlashyLabs/Rites-Network/blob/main/SPEC.md)
   for the real `ritual/1` shape
2. See how a real observance climbs `performed → witnessed → consecrated`
3. Note where reward is kept out (`reward/1`) and why
