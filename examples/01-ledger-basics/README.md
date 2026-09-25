# Example 1: Ledger Basics

Learn to create and manage a multi-asset ledger using `@flashylabs/ledger`.

## What is a Ledger?

A ledger is an append-only record of value movements across multiple assets. It enforces:
- **Append-only history** — transactions never modify or disappear
- **Balance invariant** — you cannot spend what you don't have
- **Asset namespacing** — each asset has separate balances
- **Idempotent replay** — re-submitting the same transaction has no effect
- **Opaque identity** — balances are keyed by opaque holder IDs, not names

## Key Concepts

### `Minor` — the smallest unit of value

All amounts are integers (minor units):
- Flashy Gold has 2 decimals: 25.50 Gold = 2550 minor units
- USD has 2 decimals: 100.00 USD = 10000 minor units

Convert with `toMinor()` and `toGold()`:

```javascript
import { toMinor, toGold } from '@flashylabs/ledger';

const amount = toMinor('25.50');  // 2550
const display = toGold(2550);     // '25.50'
```

### `Holder` — opaque identity

Holders are identified by random IDs, not names. This enforces privacy:

```javascript
const holder1 = 'holder-abc123';
const holder2 = 'holder-xyz789';
```

### Transactions — debit and credit

Record value movements atomically:

```javascript
const tx = {
  asset: 'flashy-gold',
  kind: 'transfer',
  debit: { holder: 'alice', amount: toMinor('10.00') },
  credit: { holder: 'bob', amount: toMinor('10.00') },
  idempotencyKey: 'transfer-1',
  timestamp: Date.now()
};
```

## Running This Example

```bash
npm run examples:ledger
npm test examples/01-ledger-basics
```

## Code Walkthrough

See `index.mjs` for the full example. Key patterns:

```javascript
// 1. Create a ledger store
const store = new InMemoryLedgerStore();

// 2. Add an asset
await store.registerAsset({
  code: 'flashy-gold',
  decimals: 2,
  name: 'Flashy Gold'
});

// 3. Record a credit (give Alice 50 Gold)
await store.recordTransaction({
  asset: 'flashy-gold',
  kind: 'issuance',
  credit: { holder: 'alice', amount: toMinor('50.00') },
  idempotencyKey: 'issue-alice-1'
});

// 4. Query balance
const balance = await store.getBalance('alice', 'flashy-gold');
console.log(toGold(balance)); // '50.00'

// 5. Transfer between holders
await store.recordTransaction({
  asset: 'flashy-gold',
  kind: 'transfer',
  debit: { holder: 'alice', amount: toMinor('10.00') },
  credit: { holder: 'bob', amount: toMinor('10.00') },
  idempotencyKey: 'transfer-alice-to-bob-1'
});

// 6. Verify Bob received it
const bobBalance = await store.getBalance('bob', 'flashy-gold');
console.log(toGold(bobBalance)); // '10.00'
```

## Invariants Tested

✅ **Balance cannot go negative** — debiting more than held fails  
✅ **Atomic transfers** — both debit and credit succeed or both fail  
✅ **Idempotent replay** — submitting same idempotencyKey twice has no effect  
✅ **Asset isolation** — Gold and USD balances don't interfere  
✅ **Holder opacity** — you cannot query by name, only by ID  

## Next Steps

Once comfortable with ledger operations:
1. Move to Example 2 to learn the **consent gate** (approval before execution)
2. Understand how Rails wraps the ledger in business rules
3. Learn Magician for multi-party coordination
