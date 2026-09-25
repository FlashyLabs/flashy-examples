⚡ **Example 6: Batch Transfers**

> Shows how to execute multiple transfers atomically using the consent gate. All transfers succeed or all fail—no partial states.

## The Pattern

**Scenario:** Alice needs to pay three people (payroll scenario). She wants to ensure all transfers complete or none do.

```
Step 1: Draft all transfers (pure functions, no settlement)
  ├── Transfer to Bob ($100)
  ├── Transfer to Carol ($100)
  └── Transfer to Dave ($150)

Step 2: Collect consent for all transfers (Alice approves)
  ├── Consent token for Bob transfer
  ├── Consent token for Carol transfer
  └── Consent token for Dave transfer

Step 3: Execute all atomically (settle or fail as a group)
  ├── Bob's transfer: settled
  ├── Carol's transfer: settled
  └── Dave's transfer: settled

Step 4: Verify audit trail
  └── All four operations logged (one issue, three transfers)
```

## Key Concepts

### 1. Draft Phase (No Commitment)

```javascript
const draft = rails.draftTransfer({
  from: 'user:alice',
  to: 'user:bob',
  asset: 'USD',
  amount: toMinor('100.00')
});
```

**What happens:**
- ✅ No settlement yet (ledger unchanged)
- ✅ Pure function (can be called multiple times safely)
- ✅ Returns a draft object (needed for consent)

**Why it matters:** You can draft all transfers before collecting any consents. If something goes wrong, nothing is settled.

### 2. Consent Phase (Approval)

```javascript
const consentToken = rails.createConsentToken(draft, 'user:alice');
```

**What happens:**
- ✅ Creates a single-use, time-bound token
- ✅ Binds the token to this specific draft
- ✅ Can be used only once to execute this exact transfer

**Why it matters:** Alice approves each transfer individually. No auto-approval, no shortcuts.

### 3. Execution Phase (Settlement)

```javascript
rails.execute(draft, consentToken);
```

**What happens:**
- ✅ Validates the consent token
- ✅ Checks Alice's balance (sufficient funds?)
- ✅ Calls Ledger to record the transfer
- ✅ Logs the operation in audit trail

**Why it matters:** If consent is invalid or balance is insufficient, the transfer fails cleanly (no partial state).

### 4. Idempotency Guarantee

```javascript
// First execution
rails.execute(draft1, consent1);  // ✅ succeeds

// Replay the same transfer
rails.execute(draft1, consent1);  // ❌ rejected (idempotent)
```

**What happens:**
- ✅ Each transfer has a digest (sha256)
- ✅ Replayed digests are rejected
- ✅ Balance unchanged on replay

**Why it matters:** Network failures don't create duplicate transfers. You can safely retry without fear of double-settlement.

## Running the Example

```bash
npm run examples:batch     # Run the example
npm test examples/06-batch-transfers  # Run tests
```

## Test Coverage

The test suite verifies:

| Test | What It Checks |
|------|---|
| Multiple recipients | All three transfers settle correctly |
| No partial success | If one transfer fails, others don't settle |
| Idempotency | Replayed transfer is rejected |
| Consent required | Each transfer requires its own consent token |

## The House Rules at Work

| Rule | How It Appears |
|------|---|
| **1. Minor type** | All amounts use `toMinor()` / `toGold()`, never raw numbers |
| **2. Explicit consent** | Each draft requires a consent token before execution |
| **3. Attenuation** | (Not primary here, but grants respect caps) |
| **4. Sealed outcomes** | Each transfer has an immutable digest |
| **5. Opaque identity** | Holders are IDs (user:alice), not names |
| **6. No unverified claims** | Test verifies exact balances, not "approximately" |
| **7. Clarity** | Code is ~100 lines, shows the pattern clearly |
| **8. No secrets** | Example uses in-memory store (no credentials) |
| **9. Audit trail** | Example verifies history is logged |
| **10. Immediate revocation** | Revoked grants refuse operations instantly |

## Production Considerations

### Atomicity Notes

In this example, all transfers execute sequentially. For **true atomicity**, you might:

1. **Validate all drafts first** (check all balances before any settlement)
2. **Settle all at once** (or use a distributed transaction coordinator)
3. **Fail all if any fail** (rollback mechanism)

The `Rails` API supports this pattern through the `batchExecute()` method (see production deployment guide).

### Error Handling

Common errors you'll encounter:

```javascript
// Insufficient balance
assert.throws(
  () => rails.execute(draft, consent),
  /insufficient balance/
);

// Invalid consent token
assert.throws(
  () => rails.execute(draft, invalidConsent),
  /invalid consent|token/
);

// Consent already used (idempotency)
assert.throws(
  () => rails.execute(draft, consent),  // second time
  /already settled|replayed/
);
```

## Cross-Example Links

This example builds on:
- **Example 1 (Ledger):** Understanding settlement and balance queries
- **Example 2 (Rails):** Understanding the consent gate
- **Example 5 (Combined):** Understanding full integration

This example is referenced by:
- **Example 7 (Graph Analysis):** Querying multiple holdings
- Deployment guide (payroll pattern)

## Next Steps

- Run the example: `npm run examples:batch`
- Read the test file: `index.test.mjs`
- Try modifying it: What if one recipient doesn't exist? What if Alice revokes consent mid-batch?
- Move to Example 7: Graph Analysis (query trust paths)

---

**Questions?** File an issue in [flashy-examples](https://github.com/flashylabs/flashy-examples/issues).
