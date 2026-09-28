# Example 6: Batch Transfers

Alice pays three people. Where does "atomic" actually live?

## Two honest patterns

### A. Through Rails' consent gate

```javascript
const drafts   = recipients.map((p) => rails.draftTransfer({ fromId: ALICE, toId: p.id, amount: p.amount, source, idempotencyKey: `payroll:2026-09:${p.id}` }));
const consents = drafts.map((d) => approve(d, ALICE, now));       // one consent PER draft
for (const [i, d] of drafts.entries()) await rails.execute(d, consents[i]);
```

- **One consent per draft.** A consent is bound to exactly one `draftId`. The
  consent for Bob's transfer cannot execute Carol's (`CONSENT_MISMATCH`). An
  earlier revision of this example claimed "a single consent decision" covered
  the batch; the real API makes that impossible by construction, and that is
  the point of it.
- **Each transfer is atomic.** `execute` lands the debit and the credit in one
  `appendAll` — both or neither.
- **The batch is not.** Rails has no batch primitive. If the second transfer
  fails on balance, the first stays settled and the third never runs. The
  example shows that state rather than hiding it.
- **Replay is safe.** Re-executing every draft returns `deduplicated: true`;
  nobody is paid twice.

### B. Straight onto the ledger — all or nothing

```javascript
let senderState = await store.readState(ref(ALICE));
const entries = [];
for (const p of recipients) {
  const [debit, credit] = postTransfer(
    { state: senderState, identityId: ALICE },
    { state: await store.readState(ref(p.id)), identityId: p.id },
    { tenantId, asset: gold, amount: toMinor(p.amount), source, idempotencyKey: `payroll:2026-09:${p.id}`, occurredAt: now },
  );
  entries.push(debit, credit);
  senderState = { balance: debit.balanceAfter, headHash: debit.hash };   // chain the next debit on
}
await store.appendAll(entries);   // all land, or none
```

`post()` is pure and decides each entry against the *running* sender state, so
a shortfall on the third recipient throws before `appendAll` is ever called —
nothing is written, nobody is paid. When it fits, one `appendAll` lands the
whole batch and `reconcile` proves the chain.

**The cost:** this bypasses Rails' gate. Nothing in the ledger asks whether
the holder consented. An application taking this path must hold Alice's
consent *for the batch* first — and Rails has no token for that today, which is
why pattern A is the default and pattern B is the deliberate exception.

## Running this example

```bash
npm run examples:batch
npm test examples/06-batch-transfers
```

## Invariants tested

- **Three recipients, one draft and one consent each** — balances, entry count, reconcile
- **One consent cannot cover the batch** — `CONSENT_MISMATCH`, `CONSENT_REQUIRED`
- **Each transfer atomic; the batch sequential** — a shortfall leaves the first paid, the second not, no half-written debit
- **Replay pays nobody twice** — every result `deduplicated`
- **Ledger batch that does not fit** — refused in `post()`; `store.size` unchanged
- **Ledger batch that fits** — six entries in one `appendAll`, correctly chained, replay is a no-op

## Use cases

Payroll, bulk refunds, multi-recipient payments — and the honest answer to
"can one approval cover them all?", which is: not through Rails, today.
