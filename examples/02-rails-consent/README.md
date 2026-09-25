# Example 2: Rails Consent Flow

Learn the consent gate pattern: draft a transfer, get approval, then execute atomically.

## Why Consent?

The consent gate enforces a critical invariant: **value never moves without explicit approval from the holder**.

This prevents:
- ❌ Accidental transfers
- ❌ Buggy code moving value
- ❌ Unauthorized automation

It enables:
- ✅ Multi-party settlement
- ✅ Reversible decisions
- ✅ Audit trail

## The Flow

```
1. Draft       (pure function) → Proposal
2. Get Consent (out-of-band)   → Approval Token
3. Execute     (one-way)       → Settlement
```

### Step 1: Draft (Pure, No Side Effects)

Create a draft transfer. This is pure—nothing is recorded yet:

```javascript
const draft = draftTransfer({
  from: 'alice',
  to: 'bob',
  asset: 'flashy-gold',
  amount: toMinor('25.00'),
  reason: 'payment for services'
});

// draft is just data, can be serialized, forwarded, etc.
```

### Step 2: Get Consent

Get approval from the account holder (not from code):

```javascript
// Out-of-band: user clicks "Approve" in UI
// Returns a cryptographically signed consent token
const consentToken = await getUserApproval(draft);

// Consent is explicit for THIS draft
// Cannot approve a different draft with same token
```

### Step 3: Execute

Execute the transfer using the consent token:

```javascript
const result = await execute(draft, consentToken);

// Now it's recorded in the ledger
// Cannot be executed twice (idempotent by draft ID)
```

## Key Constraints

**Attenuation, not inheritance.** A delegated grant can never be wider than its parent:

```javascript
// ✅ Correct: narrow the scope
attenuate(grant, {
  cap: grant.cap,      // Same or lower
  expiry: grant.expiry  // Same or earlier
});

// ❌ Wrong: cannot widen
attenuate(grant, {
  cap: grant.cap + toMinor('1.00')  // ERROR
});
```

**Revocation is immediate.** Once revoked, a grant refuses all operations:

```javascript
revoke(grant);
// Any subsequent execute(draft, consentToken) fails
```

**Expiry is checked at execute time.** Not at draft time:

```javascript
const draft = draftTransfer(...);
const token = getApproval(draft);
// ... time passes ...
const result = execute(draft, token);  // Fails if token expired
```

## Running This Example

```bash
npm run examples:rails
npm test examples/02-rails-consent
```

## Code Walkthrough

See `index.mjs` for the full example.

```javascript
// 1. Initialize rails (wraps ledger + consent)
const rails = new Rails(ledgerStore);

// 2. Draft a transfer (pure function)
const draft = rails.draftTransfer({
  from: 'alice',
  to: 'bob',
  asset: 'flashy-gold',
  amount: toMinor('25.00')
});

// 3. Get approval (simulated)
const approval = await getApprovalFromUser(draft);

// 4. Execute with consent token
const result = await rails.execute(draft, approval);

// 5. Verify ledger was updated
const balance = await ledgerStore.getBalance('bob', 'flashy-gold');
```

## Invariants Tested

✅ **Draft cannot execute without consent token**  
✅ **Consent token is bound to specific draft**  
✅ **Execution is idempotent by draft ID**  
✅ **Revoked grants refuse execution**  
✅ **Expired tokens are rejected**  
✅ **Attenuated grants cannot exceed parent scope**  

## Next Steps

Once comfortable with the consent gate:
1. Move to Example 3 to learn **trust graphs** (multi-party routing)
2. Understand how Magician seals outcomes
3. Learn identity and delegation in FlashyID
