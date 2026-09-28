# Example 5: Combined Workflow

Four packages, one story: an assistant opens an intent, Magician routes it,
every hop consents, the outcome is sealed, and the holder settles a payment
through Rails onto the ledger.

## The scenario

Alice wants Dave for due diligence on a robotics JV. She does not know Dave, but
Alice trusts Bob, Bob trusts Carol, and Carol knows Dave. Alice's assistant does
the legwork; Alice does the consenting.

1. **flashyID** — Alice delegates to her assistant a chain that permits
   `intent.open` and `transfer.draft` up to 50 Gold. Not `transfer.execute`.
2. **Magician** — the assistant opens the intent; `findPaths` finds
   Alice → Bob → Carol → Dave; each edge's owner consents; the introduction is
   sealed as `introduction/1`.
3. **Rails** — the assistant drafts the 50 Gold transfer (pure, within
   mandate). Alice consents. `execute` moves value.
4. **Ledger** — two entries land atomically, each carrying the introduction's
   digest in its metadata, and Alice's books reconcile to a sealed head.

## The one boundary every system shares

**Agents suggest; humans consent.** The same rule appears four times, enforced
four ways:

| Where | How it is enforced |
|---|---|
| flashyID | the assistant's chain has no `transfer.execute`; `authorize` says `out_of_mandate` |
| Magician | `consentHop` accepts only the owner of the edge being crossed; `markIntroduced` needs every hop |
| Rails | `execute(draft, consent)` refuses without a consent bound to this draft *by the holder* |
| Ledger | `post()` refuses a debit past zero — after consent, before any write |

An earlier revision of this example had Dave approve the payment. Dave is the
recipient; the value leaving is Alice's, and the consent gate is the
*holder's*. `approve(draft, 'person/dave', …)` is `CONSENT_MISMATCH`.

## Identity across systems

One id per person, everywhere: `person/alice`. That is Magician's native
grammar (`kind/slug`), it passes the ledger's opaque-identity guard (no email,
no phone, no wallet), and it is the `rootHuman` of the assistant's chain. The
assistant itself is `agentSubject('alice', 'assistant')` — `agent:alice/assistant`.

## What the settlement carries

```javascript
rails.draftTransfer({
  fromId: 'person/alice', toId: 'person/dave', amount: 50,
  source: { type: 'settlement', id: record.digest.slice(0, 12) },
  idempotencyKey: `intro:${record.digest.slice(0, 16)}`,
  metadata: { introduction: record.digest },
});
```

The `idempotencyKey` derives from the sealed introduction, so a retried
settlement of the same introduction settles once. Every entry's `metadata`
names the digest; `verifyIntroduction(record)` and `rails.reconcile(id)` are
the two checks a stranger runs.

## Running this example

```bash
npm run examples:combined
npm test examples/05-combined-workflow
```

## Invariants tested

- **Happy path** — 50/60 Gold, two entries naming the digest, both holders reconcile
- **No trust path, nothing to settle** — `findPaths` is `[]`
- **Every hop consents; the seal follows the event** — `markIntroduced` and `sealOutcome` refuse early
- **The assistant may draft, never execute** — `out_of_mandate` for `transfer.execute` and over 50 Gold
- **The holder consents** — no consent, Dave's consent, the agent's consent: nothing moves
- **Insufficient balance is the ledger's refusal** — after consent, before any write
- **A retried settlement settles once** — `deduplicated`

## Next steps

- Example 6: many transfers, and what "atomic" honestly means for a batch
- Example 8: the error codes each layer throws, and how to recover
