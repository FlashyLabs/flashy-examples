# Example 2: Rails Consent Flow

The consent gate in `@flashylabs/rails`: an agent drafts, the holder consents,
then value moves.

## Why consent?

**Value never leaves a holder without their approval.** Agents suggest; humans
consent. There is no auto-approval at any tier — `execute()` is the one place
a holder's Gold moves out, and it refuses without a consent bound to exactly
this draft and exactly this holder.

## The flow

```
1. draftTransfer(cmd)          pure — computes what WOULD happen, writes nothing
2. approve(draft, holder, at)  the holder's yes, bound to this draft's id
3. execute(draft, consent)     the one write; two ledger entries land or neither
```

### Step 1: Draft (pure)

```javascript
const draft = rails.draftTransfer({
  fromId: 'hunter_a1', toId: 'hunter_b2',
  amount: 25,                                   // a decimal NUMBER; toMinor happens inside
  source: { type: 'payment', id: 'inv-1' },
  idempotencyKey: 'inv-1',
});
// draft.id === 'transfer:inv-1', draft.amountMinor === 2500
```

An agent may hold a draft. Nothing moves.

### Step 2: Consent

```javascript
const consent = approve(draft, 'hunter_a1', new Date());
// { draftId: 'transfer:inv-1', holderId: 'hunter_a1', action: 'transfer', approvedAt }
```

The consent names the draft, the holder and the action. A consent for `inv-1`
cannot execute `inv-2` (`CONSENT_MISMATCH`); Bob's consent cannot move Alice's
Gold (`CONSENT_MISMATCH`); no consent at all is `CONSENT_REQUIRED`. In
production the token is signed by flashyID; the *binding* rules are these and
hold wherever it comes from.

### Step 3: Execute

```javascript
const results = await rails.execute(draft, consent);
// two AppendResults: TRANSFER_OUT for Alice, TRANSFER_IN for Bob
```

Replaying `execute` with the same draft returns `deduplicated: true` on both
entries — the draft's `idempotencyKey` is the ledger's key, so a retry settles
once.

## Money at the edge

```javascript
toMinor(25);     // 2500 — a number in, an integer out
toGold(2500);    // 25   — presentation only
toMinor('25');   // never: amounts are numbers; a string is INVALID_AMOUNT at the edge
toMinor(0.005);  // throws PrecisionError — Gold settles to 2 decimals
```

`rails.balance(id)` answers `{ minor, gold, symbol }`; you never format minor
units by hand.

## Delegated spend: grants that only narrow

```javascript
const cafe  = issueGrant({ grantId: 'g-cafe', holderId: 'hunter_a1', spenderId: 'org/demo-cafe',
                           assetId: FLASHY_GOLD_ID, capMinor: toMinor(20), purpose: 'coffee' });
const kiosk = attenuate(cafe, { grantId: 'g-kiosk', spenderId: 'org/demo-cafe-kiosk', capMinor: toMinor(5) });

attenuate(kiosk, { grantId: 'g-wide', spenderId: 'org/x', capMinor: toMinor(50) }); // throws GRANT_WIDENED
```

A child grant can never hold authority its parent lacks: a larger cap, a later
(or dropped) expiry, or a different purpose all throw `GRANT_WIDENED`. Spends
go through `spendUnderGrant`, which checks `assertSpendable` before any write
(`GRANT_REVOKED`, `GRANT_EXPIRED`, `GRANT_EXCEEDED`) and returns the grant
with the amount drawn down — grants are immutable, like entries. A dedup
replay does not draw the grant down twice.

`revoke(grant)` returns a revoked copy; every operation on it refuses.

## Running this example

```bash
npm run examples:rails
npm test examples/02-rails-consent
```

## Invariants tested

- **A draft writes nothing** — `store.size` unchanged, balance unchanged
- **Amounts are numbers** — `'25'` is `INVALID_AMOUNT`; `toMinor(25) === 2500`
- **Execution requires consent** — `CONSENT_REQUIRED`, nothing written
- **Consent is bound to one draft and one holder** — `CONSENT_MISMATCH` otherwise
- **Execution settles both sides** — `TRANSFER_OUT` + `TRANSFER_IN`, `consentedAt` recorded
- **Execution is idempotent** — replay is `deduplicated`, balances unchanged
- **Insufficient balance is the ledger's refusal** — `LedgerError INSUFFICIENT_BALANCE`, unwrapped
- **Attenuation only narrows** — four ways to widen, all `GRANT_WIDENED`
- **Revocation is immediate; expiry is checked at spend time** — `GRANT_REVOKED`, `GRANT_EXPIRED`
- **A grant is a cap** — draws down, `GRANT_EXCEEDED` past remaining, replay does not double-draw
- **The books reconcile** — `reconcile()` is `ok` with a recomputable `sealHead`

## Next steps

1. Example 3: **trust graphs** — consent on every hop of an introduction
2. Example 4: **flashyID** — the delegation chains a signed consent token carries
