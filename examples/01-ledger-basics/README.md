# Example 1: Ledger Basics

Append-only, multi-asset settlement with `@flashylabs/ledger`.

## What is the ledger?

An append-only record of value movements across assets, with the rules in one
pure domain and storage behind one interface. It enforces:

- **Append-only history** — the `LedgerStore` port has no update and no delete
- **Balance invariant** — a debit past zero is refused before anything is written
- **Asset isolation** — every entry names its asset; balances never mix
- **Idempotent replay** — the same `idempotencyKey` returns the original entry
- **Opaque identity** — an email, phone number or wallet address is refused as an id
- **Tamper evidence** — every entry hashes over the previous one; `verifyChain` checks it

## The real shape of the API

There is no `Ledger` class and no `recordTransaction()`. Three pieces:

```javascript
import { InMemoryLedgerStore, FLASHY_GOLD, materialize, post, fromDecimal } from '@flashylabs/ledger';

// 1. An asset is a registry definition, materialized for a tenant
const gold = materialize(FLASHY_GOLD, { id: 'asset_fg', tenantId: 'example-01' });

// 2. post() is pure: state + command -> the entry that should exist, or a throw
const state = await store.readState({ tenantId: 'example-01', identityId: 'hunter_a1', assetId: gold.id });
const entry = post(state, {
  tenantId: 'example-01', identityId: 'hunter_a1', asset: gold,
  amount: fromDecimal(50, gold.decimals),   // 5000 minor units
  kind: 'EARN', source: { type: 'quest', id: 'q1' },
  idempotencyKey: 'quest:q1:hunter_a1', occurredAt: new Date(),
});

// 3. The store persists it — and reports whether this was a replay
const { deduplicated } = await store.append(entry);
```

### `Minor` — the smallest unit of value

Every amount is a whole number of an asset's smallest unit. Flashy Gold settles
to 2 decimals, so 25.50 Gold is `2550`; wheat settles to 0, so 5 bushels is `5`.

```javascript
fromDecimal(50, gold.decimals);   // 5000
toDecimal(2550, gold.decimals);   // 25.5 — presentation only, never fed back in
minor(1500);                      // an exact integer, asserted
fromDecimal(12.345, 2);           // throws PrecisionError: refused, not rounded
```

The ledger exports no Gold-specific `toMinor`/`toGold`; those live in Flashy
Rails (`@flashylabs/rails`), because "Gold has two decimals" is a product fact.
A ledger example that imported Rails would teach the dependency arrow backwards,
so this one uses the generic pair with the asset's own `decimals`.

### A transfer is two entries

```javascript
const [debit, credit] = postTransfer(
  { state: aliceState, identityId: 'hunter_a1' },
  { state: bobState, identityId: 'hunter_b2' },
  { tenantId, asset: gold, amount: minor(1500), source: { type: 'gift' }, idempotencyKey: 'gift:g1', occurredAt },
);
await store.appendAll([debit, credit]);   // both land, or neither
```

`postTransfer` derives two keys (`gift:g1:out`, `gift:g1:in`) so the pair
replays as a pair.

### Identity is opaque

`post()` calls `assertOpaqueIdentity` on the way in. `hunter_a1` passes;
`alice@example.com` is refused with `NATURAL_KEY_IDENTITY`. The ledger also
ships `surrogateIdentity(value, tenantSalt)` for deriving an opaque handle from
a natural one — per tenant, so two networks cannot correlate the same person.

## Running this example

```bash
npm run examples:ledger
npm test examples/01-ledger-basics
```

## Invariants tested

- **Minor is an integer** — over-precision throws `PrecisionError`
- **Balance cannot go negative** — `INSUFFICIENT_BALANCE`, and `store.size` is unchanged
- **A transfer lands whole** — two entries, `TRANSFER_OUT` and `TRANSFER_IN`
- **Idempotent replay** — `deduplicated: true`, same entry ids, same balance
- **Asset isolation, tenant scoping** — Gold and wheat never mix; the same key in another tenant is a new entry
- **Append-only and tamper-evident** — no `update`/`delete` on the store; a tampered copy fails `verifyChain`; `balanceOf(history)` equals the stored balance
- **Opaque identity** — an email or E.164 number is refused as an `identityId`
- **Every movement is keyed and non-zero** — `MISSING_IDEMPOTENCY_KEY`, `ZERO_AMOUNT`

## Next steps

1. Example 2 wraps this store in Flashy Rails' **consent gate**: value leaves a holder only with their approval
2. Example 3 moves to Magician: consent on every hop of an introduction
