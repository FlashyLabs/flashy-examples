# Example 5: Combined Workflow

Wire all systems together: authenticate a user, establish trust, execute a consent-gated settlement.

## The Scenario

Alice wants to pay Dave $50 for consulting. Alice and Dave don't know each other, but:
1. Alice trusts Bob (direct relationship)
2. Bob trusts Carol (direct relationship)
3. Carol knows Dave (direct relationship)

**The system:**
1. ✅ Alice authenticates with FlashyID
2. ✅ Introduce Alice to Dave via the trust chain (Bob → Carol)
3. ✅ Draft a payment
4. ✅ Dave approves (consent gate)
5. ✅ Execute the transfer atomically
6. ✅ Seal the settlement with cryptographic proof

## Architecture

```
┌─ FlashyID (Authentication)
│  ├─ Alice logs in
│  └─ Receives delegation grant
│
├─ Magician (Trust Routing)
│  ├─ Query: Alice → Dave?
│  ├─ Route: Alice → Bob → Carol → Dave
│  ├─ Collect consents
│  └─ Seal introduction
│
└─ Rails + Ledger (Settlement)
   ├─ Draft: Alice sends $50 to Dave
   ├─ Consent: Dave approves
   └─ Execute: Record transfer atomically
```

## Data Structures

### User Session

```javascript
{
  idToken: 'eyJhbGc...',           // FlashyID OIDC token
  user: { sub: 'user:alice', ... }, // Verified claims
  grant: { cap: 100, ... },         // Delegation authority
}
```

### Settlement Record

```javascript
{
  id: 'settlement:12345',
  from: 'user:alice',
  to: 'user:dave',
  asset: 'usd',
  amount: 5000,  // $50.00
  
  // Proof of consent routing
  introduction: {
    digest: 'sha256(...)',  // Sealed proof
    route: ['bob', 'carol']
  },
  
  // Proof of consent approval
  approval: {
    token: 'consent:...',
    grantId: 'grant:dave:...'
  },
  
  // Proof of ledger settlement
  ledger: {
    txHash: 'tx:...'
  },
  
  status: 'settled',
  settledAt: 1234567890
}
```

## Running This Example

```bash
npm run examples:combined
npm test examples/05-combined-workflow
```

## Code Walkthrough

```javascript
// 1. Alice authenticates
const session = await authenticate('alice');

// 2. Query trust graph: can introduce Alice to Dave?
const intro = trustGraph.route({
  requester: session.user.sub,
  target: 'user:dave',
  reason: 'payment'
});

// 3. Collect consents through chain
const consents = await collectConsents(intro.route);

// 4. Seal introduction
const sealedIntro = await trustGraph.seal(intro, consents);

// 5. Draft transfer
const draft = rails.draftTransfer({
  from: session.user.sub,
  to: 'user:dave',
  asset: 'usd',
  amount: toMinor('50.00'),
  introduction: sealedIntro
});

// 6. Send for Dave's approval
const approval = await requestApproval(draft);

// 7. Execute atomically
const settlement = await rails.execute(draft, approval);

// 8. Verify all proofs
assert(verifyIntroduction(settlement.introduction));
assert(verifyApproval(settlement.approval));
assert(ledger.verifyTransaction(settlement.ledger.txHash));
```

## Invariants Preserved

✅ **Authentication proves identity** — FlashyID token verifies subject  
✅ **Trust enables introduction** — no introduction without consent chain  
✅ **Consent gates settlement** — no transfer without explicit approval  
✅ **Ledger is immutable** — settlement is append-only, cannot be reversed  
✅ **Settlement is provable** — all proofs are cryptographic, verifiable by strangers  

## Production Patterns

### Error Recovery

If any step fails, the whole flow rolls back:

```javascript
try {
  // Any step can throw
  const settlement = await executeWorkflow(user, target);
} catch (err) {
  if (err.kind === 'no_trust_path') {
    // User cannot introduce target
    return { status: 'no_path' };
  }
  if (err.kind === 'approval_timeout') {
    // Target took too long
    return { status: 'timeout' };
  }
  if (err.kind === 'insufficient_balance') {
    // User doesn't have enough
    return { status: 'insufficient_funds' };
  }
  throw err; // Unexpected
}
```

### Audit Logging

Log every step for compliance:

```javascript
audit.log({
  event: 'settlement:initiated',
  from: session.user.sub,
  to: target,
  amount,
  timestamp: Date.now()
});

audit.log({
  event: 'introduction:route_found',
  path: intro.route,
  timestamp: Date.now()
});

audit.log({
  event: 'settlement:approved',
  by: target,
  timestamp: Date.now()
});

audit.log({
  event: 'settlement:sealed',
  txHash: settlement.ledger.txHash,
  timestamp: Date.now()
});
```

### Rate Limiting

Limit operations per user:

```javascript
const limit = rateLimiter.check({
  user: session.user.sub,
  action: 'settlement',
  window: '1 hour'
});

if (limit.exceeded) {
  throw new Error(`Rate limit: ${limit.remaining}/${limit.quota} remaining`);
}
```

## Testing Strategy

The test file demonstrates:
1. Happy path (all systems working)
2. No trust path (introduction fails)
3. Approval timeout (user doesn't respond)
4. Insufficient balance (not enough funds)
5. Ledger verification (cryptographic proof)

## Next Steps

Once comfortable with the combined workflow:
1. Deploy to production with proper rate limiting
2. Add compliance logging
3. Implement error recovery and retry logic
4. Monitor for suspicious patterns
5. Build dashboard for operations team
