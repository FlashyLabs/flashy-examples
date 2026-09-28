# Example 8: Error Recovery

Every layer refuses with a stable code. Each code has one honest recovery, and
only one class of failure is ever retried.

## The codes

| Layer | Code | When | Recovery |
|---|---|---|---|
| Ledger | `INSUFFICIENT_BALANCE` | a debit would pass zero — checked after consent, before any write | draft a smaller amount; a new draft needs a new consent |
| Rails | `CONSENT_REQUIRED` | `execute` with no consent | ask the holder — never construct one |
| Rails | `CONSENT_MISMATCH` | consent for another draft, or by someone who is not the holder | the holder's consent for *this* draft |
| Rails | `GRANT_REVOKED` / `GRANT_EXPIRED` | the grant is dead | the holder issues a fresh grant |
| Rails | `GRANT_EXCEEDED` | a grant is a cap | ask the holder for more — `attenuate` cannot widen (`GRANT_WIDENED`) |
| Magician | *(none)* | a hop declined | the requester reads `unavailable` and tries another path |
| Your store | transient (`ETRANSIENT` here) | the write did not commit | retry the **same** draft with the **same** consent |

`RailsError` is the estate's `AppError(code, httpStatus, message)` shape. The
ledger's `LedgerError` passes through Rails unwrapped and carries no
`httpStatus` — the ledger knows nothing about HTTP; a route maps it.

## Refusals are decisions; blips are retried

```javascript
async function withRetry(fn, { attempts = 3, baseMs = 5, isTransient = (e) => e.code === 'ETRANSIENT' } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await fn(attempt); }
    catch (err) {
      if (!isTransient(err) || attempt >= attempts) throw err;
      await sleep(baseMs * 2 ** (attempt - 1));
    }
  }
}
```

A refusal — `INSUFFICIENT_BALANCE`, any `CONSENT_*`, any `GRANT_*` — is thrown
straight back after one attempt. Retrying a decision does not change it; it
only spams the human who made it. A transient failure is retried with the
*identical* draft and consent, and that is safe for one reason: the draft's
`idempotencyKey` is the ledger's key, so the attempt that lands settles once and
any later replay returns `deduplicated: true`.

The example models the transient case with a `FlakyStore` whose `appendAll`
throws once *after* `post()` decided the entries and *before* they were
committed — the shape a dropped connection takes. Nothing is written; the
retry is the write.

## The opaque decline

Magician does not throw when a hop declines. `declineHop` ends the path and
`toRequesterView` collapses it to `{ id, state: 'unavailable' }` — the same
object whichever hop declined. The recovery is to open a new request on
another path `findPathsTo` returned. The requester never learns who said no,
and that is the feature.

## Running this example

```bash
npm run examples:errors
npm test examples/08-error-recovery
```

## Invariants tested

- **Insufficient balance** — `LedgerError INSUFFICIENT_BALANCE`, nothing written; the old consent does not carry to the new draft
- **Grant refusals** — `GRANT_REVOKED` (403), `GRANT_EXCEEDED`, `GRANT_EXPIRED`; widening as a "fix" is `GRANT_WIDENED`; a fresh grant works
- **Consent mismatch** — wrong draft, wrong holder, no consent; the right consent settles
- **Declined hop** — `unavailable`, identical whichever hop declined; the alternative path reaches `ready`
- **Transient failure** — the failed attempt writes nothing; the retry settles once; a third attempt dedups
- **A refusal is never retried** — exactly one attempt for `INSUFFICIENT_BALANCE` and `CONSENT_REQUIRED`
- **Stable codes** — `RailsError` has `name`, `code`, `httpStatus`; `LedgerError` has `name`, `code`

## Use cases

Production resilience: a retry policy that cannot double-spend, an error switch
that never bypasses a human, and a routing layer that fails without leaking.
