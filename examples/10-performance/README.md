# Example 10: Performance Patterns

Throughput on the in-memory reference store, measured — and the one concurrency
rule the numbers do not show.

## What is measured

| Scenario | What runs | What it proves |
|---|---|---|
| Populate | 100 `earn`s | baseline write cost |
| Sequential | 100 transfers around a ring, `draft → approve → execute` each | conservation: supply is unchanged |
| Parallel, safe | 50 transfers between **disjoint** pairs in one `Promise.all` | every holder's chain still verifies |
| Parallel, unsafe | 5 transfers from **one** holder in one `Promise.all` | `reconcile()` reports the fork |
| Reads | 100 balance lookups, one history read, one verification | read cost; the chain is intact |
| Memory | `process.memoryUsage()` after all of it | what the in-memory store holds |

Every number the example prints is a measurement of this process on this
machine. None is a claim about production, which runs on `MongoLedgerStore`.
The README that preceded this one said the system "scales linearly" and that
"in-memory uses ~X MB for Y operations"; neither was measured, so neither is
here.

## The rule the numbers hide: serialize writes per holder

`execute` reads the holder's state, `post()`s against it, then appends. Two
concurrent executes for the *same* holder both read the same head, both chain
onto it, and both land — the in-memory store does not lock, and nothing about
the second entry is wrong on its own. What breaks is the chain:

```
entry 2 (TRANSFER_OUT fork:1:out): previousHash 64a813ff03 does not link to the prior entry 48f7729c67
entry 2 (TRANSFER_OUT fork:1:out): balanceBefore 100000 ≠ the running balance 99900
```

`rails.reconcile(holder)` catches it, and the stored balance now disagrees
with the sum of the entries. The pattern is simple: parallelize across
holders, never within one. The safe scenario does exactly that — senders
`0..49`, recipients `50..99`, each identity touched once — and every chain
verifies afterwards.

The test for the unsafe case asserts what *must not* happen — five settlements
and a clean reconcile — rather than pinning how the store fails, so a store
that later refuses the conflicting write passes the same test.

## Conservation

A transfer is two entries of equal and opposite amount. After 100 sequential
and 50 parallel transfers, the sum of every balance equals the sum of every
`earn`. That is the invariant worth asserting under load; throughput is a
number, conservation is a promise.

## Running this example

```bash
npm run examples:perf
npm test examples/10-performance
```

## Invariants tested

- **Sequential transfers conserve supply** — and every holder reconciles
- **Disjoint parallel transfers are safe** — every chain verifies; balances are exact
- **Same-holder parallel transfers are caught** — refused, or reported by `reconcile`
- **Reads are cheap and history verifies** — 100 balances under a second; `verifyChain` valid

## In production

Use `MongoLedgerStore`; keep one writer per holder (a queue keyed by
`identityId` is enough); read balances from the store's projection and rebuild
it from entries whenever you doubt it — that is what "balances are derived"
buys you.
