# Flashy Examples

Working examples and tutorials for the Flashy ecosystem packages:
- `@flashylabs/ledger` — multi-asset, append-only settlement engine
- `@flashylabs/rails` — consent-gated rewards and value transfer
- `@magician-network/core` — trust routing and sealed introductions
- `@flashyid/sdk` — identity and delegation layer

## Examples

### 1. Ledger Basics (`01-ledger-basics`)
Create and manage a multi-asset ledger, record transfers and redemptions.

```bash
npm run examples:ledger
npm test examples/01-ledger-basics/
```

**What you'll learn:**
- Initializing a ledger store
- Adding assets (Flashy Gold, USD)
- Recording debits and credits
- Querying balances and history
- Idempotent replay semantics

---

### 2. Rails Consent Flow (`02-rails-consent`)
Execute the consent gate: draft a transfer, get approval, then execute atomically.

```bash
npm run examples:rails
npm test examples/02-rails-consent/
```

**What you'll learn:**
- Drafting a transfer (pure function)
- Creating consent tokens
- Executing with approval
- Handling rejections
- Ledger integration

---

### 3. Magician Introductions (`03-magician-intro`)
Build trust graphs, route introductions, seal outcomes with cryptographic proof.

```bash
npm run examples:magician
npm test examples/03-magician-intro/
```

**What you'll learn:**
- Creating trust edges
- Routing introduction requests
- Consent on every hop
- Sealing outcomes
- Verifying sealed records

---

### 4. FlashyID OAuth (`04-flashyid-oauth`)
Authenticate users with OpenID Connect, mint attenuated grants.

```bash
npm run examples:flashyid
npm test examples/04-flashyid-oauth/
```

**What you'll learn:**
- OIDC provider flow
- Minting delegation grants
- Attenuation rules (never widen scope)
- Revocation and expiry
- Verification

---

### 5. Combined Workflow (`05-combined-workflow`)
Wire all systems together: authenticate a user, establish trust, execute a consent-gated settlement.

```bash
npm run examples:combined
npm test examples/05-combined-workflow/
```

**What you'll learn:**
- End-to-end application pattern
- Cross-system integration
- Error handling and recovery
- Audit logging
- Production-ready structure

---

## Running Tests

All examples include comprehensive test suites:

```bash
npm test                           # Run all tests
npm test examples/01-ledger-basics # Run specific example tests
```

Tests verify:
- ✅ Happy path execution
- ✅ Error conditions
- ✅ Invariant preservation
- ✅ Idempotency guarantees
- ✅ Cross-system integration

---

## Installation

```bash
npm install
```

If installing from monorepo checkouts (before packages are published to npm):

```bash
# Use file: dependencies pointing to local checkouts
npm install file:../flashy-ledger file:../flashy-rails \
  file:../magician/packages/core file:../flashyid/packages/sdk
```

---

## House Rules

**Never hardcode amounts.** Use the `Minor` type (smallest unit of value):
```javascript
import { toMinor, toGold } from '@flashylabs/ledger';

const amount = toMinor('25.50');  // 2550 minor units
const display = toGold(2550);     // '25.50'
```

**Consent is explicit.** No auto-approval paths exist:
```javascript
// ✅ Correct: draft, wait for consent token, execute
const draft = draftTransfer({ ... });
const consentToken = await getApproval(draft);
const result = execute(draft, consentToken);

// ❌ Wrong: no auto-execute, no implicit consent
```

**Sealed means sealed.** Digests are cryptographic:
```javascript
// Hash is portable sha256 across Node and browser
import { sha256 } from '@magician-network/core';
```

**Grants never widen.** Delegation is attenuation only:
```javascript
// ✅ Can attenuate
const childGrant = attenuate(parentGrant, {
  cap: parentGrant.cap,      // same or lower
  expiry: parentGrant.expiry  // same or earlier
});

// ❌ Cannot widen
```

---

## Project Structure

```
examples/
├── 01-ledger-basics/
│   ├── index.mjs              # Example walkthrough
│   ├── index.test.mjs         # Test suite
│   └── README.md              # Detailed guide
├── 02-rails-consent/
│   ├── index.mjs
│   ├── index.test.mjs
│   └── README.md
├── ... (more examples)
└── README.md                  # This file
```

---

## Learning Path

**Start here:**
1. Run `npm run examples:ledger` to see basic operations
2. Read `examples/01-ledger-basics/README.md` for concepts
3. Read the test file to see all invariants

**Then progress through:**
2. Rails consent flow (understand the gate)
3. Magician trust graph (understand routing)
4. FlashyID delegation (understand attenuation)
5. Combined workflow (understand integration)

---

## Contributing

Examples are maintained as teaching material. Before proposing changes:

1. All examples must have tests (`*.test.mjs`)
2. All tests must pass (`npm test`)
3. Code must be lint-clean (`npm run lint`)
4. Documentation must be clear and complete

---

## License

Apache-2.0. Copyright Flashy Labs.
