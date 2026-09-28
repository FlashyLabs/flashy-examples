# Example 9: Attenuation Chains

Delegation is attenuation. Each link narrower than the last:
Alice → Bob → Carol → Dave, with `@flashyid/sdk`'s grant kernel.

## The invariant

A child link can **never widen** authority. It can only:

- lower the spend ceiling (`lim.spend_max`)
- expire sooner (`exp` — capped at the parent's if you ask for more)
- hold a subset of scopes (`scp`) and resources (`res`)
- keep or lower the human-approval bar (`lim.approval_at_or_above`)

```
alice@example.com  (root)      spend_max 100,000   +365d   spend, report
  └─ bob@example.com            spend_max  50,000    +30d   spend, report
       └─ carol@example.com     spend_max  25,000     +7d   spend
            └─ dave@example.com spend_max  10,000     +1d   spend
```

## The real shape of the API

There is no `FlashyID` class, no `createGrant()`, no `revoke(id)`. A grant is a
**chain** — an array of links, root-first — and the kernel is four pure
functions:

```javascript
const alice = issueRoot({ rootHuman: ALICE, holder: ALICE, scp, res, lim, iat, exp, jti: 'g-alice' });
const bob   = attenuate(alice, { holder: BOB, lim: { spend_max: 50_000 }, iat, exp, jti: 'g-bob' });

const effective = verifyChain(dave, nowSec);           // the authority in effect at the leaf
permits(effective, { scope: 'spend', amount: 5_000 });  // true, or a Refusal
```

**`attenuate` refuses by returning.** Asking Bob to delegate 75,000 of his
50,000 comes back as `{ ok: false, code: 'chain_widened', at: 2, detail:
'limit loosened' }` — no exception. Check `.ok` before treating the result as
a chain.

**Time is an argument.** `verifyChain(chain, nowSec)` — never a clock — so an
auditor evaluates a historical decision at the moment it was made.

**Revocation is a set of `jti`s**, held by whoever verifies:
`verifyChain(dave, nowSec, new Set(['g-bob']))` refuses with `revoked` at link
1. Revoking Bob invalidates Carol and Dave; Alice's root stands.

**Defence in depth.** `verifyChain` re-checks the narrowing invariant at every
hop, so a chain that widened by any route other than `attenuate` — a
hand-built link, a tampered claim — is caught on verify, not trusted because
it arrived.

## Running this example

```bash
npm run examples:attenuation
npm test examples/09-attenuation-chains
```

## Invariants tested

- **Every link holds no more than the one above** — issuer continuity, ceilings, expiry, scopes
- **Widening returns a refusal** — limit, scope, resource; `empty_chain` on nothing
- **Expiry is capped, effective expiry is the minimum** — and the audit trail is the chain of `jti`s
- **`permits` enforces at the boundary** — amount over ceiling, dropped scope, foreign resource
- **Revocation walks down** — revoke Bob: Bob, Carol and Dave refuse; Alice does not
- **Expiry is evaluated at `nowSec`, link by link** — the shortest link lapses first
- **A widened chain is caught on verify** — `chain_widened`, `broken_chain`, whatever route it took

## Use cases

- Manager → team lead → engineer spend authority
- Org → service → per-request agent scopes
- Any principle-of-least-privilege handoff where the delegate must be unable to exceed the delegator
