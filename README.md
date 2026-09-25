⚡ **FLASHY EXAMPLES** — Working Patterns for a Consent-Gated, Trust-Routed Economy

> The Flashy ecosystem teaches four core invariants: **append-only settlement**, **explicit consent**, **sealed introductions**, and **attenuation-only delegation**. These examples show how they work together in production.

Working examples and tutorials for the Flashy ecosystem packages:
- `@flashylabs/ledger` — multi-asset, append-only settlement engine
- `@flashylabs/rails` — consent-gated rewards and value transfer
- `@magician-network/core` — trust routing and sealed introductions
- `@flashyid/sdk` — identity and delegation layer

## The Five Examples

### 1️⃣ Ledger Basics — `01-ledger-basics`

**The invariant: Balance never goes negative. Settlement is append-only.**

Create and manage a multi-asset ledger, record transfers and redemptions, guarantee idempotent replay.

```bash
npm run examples:ledger    # ~95 lines of code + working ledger
npm test examples/01-ledger-basics/  # ~163 test cases
```

**Concepts covered:**
- ✅ Minor type (branded integer, never raw numbers)
- ✅ Multi-asset isolation
- ✅ Idempotent replay semantics
- ✅ Balance invariant (never negative)
- ✅ Audit trail (immutable history)

**Read:** [`examples/01-ledger-basics/README.md`](examples/01-ledger-basics/)

---

### 2️⃣ Rails Consent — `02-rails-consent`

**The invariant: Value never moves without explicit approval.**

Execute the consent gate: draft a transfer, wait for consent, execute atomically. Rejection is final.

```bash
npm run examples:rails  # ~95 lines of code + consent flow
npm test examples/02-rails-consent/  # ~151 test cases
```

**Concepts covered:**
- ✅ Draft → Approve → Execute flow
- ✅ Consent tokens (time-bound, single-use)
- ✅ Attenuation (grants narrow, never widen)
- ✅ Immediate revocation
- ✅ Ledger integration

**Read:** [`examples/02-rails-consent/README.md`](examples/02-rails-consent/)

---

### 3️⃣ Magician Routing — `03-magician-intro`

**The invariant: A declined introduction is opaque to the requester.**

Build trust graphs, route introductions, collect consent from each hop, seal outcomes with cryptographic proof.

```bash
npm run examples:magician  # ~111 lines of code + routing
npm test examples/03-magician-intro/  # ~137 test cases
```

**Concepts covered:**
- ✅ Trust graphs (edges represent relationships)
- ✅ Routing algorithm (find consent path)
- ✅ Sealed outcomes (sha256, portable)
- ✅ Opaque decline (no information leak)
- ✅ Verification (portable, browser-compatible)

**Read:** [`examples/03-magician-intro/README.md`](examples/03-magician-intro/)

---

### 4️⃣ FlashyID OAuth — `04-flashyid-oauth`

**The invariant: Grants can only narrow, never widen. Delegation is attenuation.**

Authenticate users with OpenID Connect, mint attenuated grants, enforce attenuation at enforcement boundary.

```bash
npm run examples:flashyid  # ~105 lines of code + OIDC flow
npm test examples/04-flashyid-oauth/  # ~109 test cases
```

**Concepts covered:**
- ✅ OAuth 2.1 flow (PKCE, no implicit)
- ✅ Credential verification (portable)
- ✅ Grant minting (with attestation)
- ✅ Attenuation enforcement (never widen)
- ✅ Revocation and expiry

**Read:** [`examples/04-flashyid-oauth/README.md`](examples/04-flashyid-oauth/)

---

### 5️⃣ Combined Workflow — `05-combined-workflow`

**The invariant: All four systems work together seamlessly.**

Alice pays Dave $50 through a trust chain (Alice → Bob → Carol → Dave). Demonstrates full integration.

```bash
npm run examples:combined  # ~139 lines of code + all systems
npm test examples/05-combined-workflow/  # ~136 test cases
```

**Integration:**
- ✅ FlashyID authenticates Alice
- ✅ Magician routes through Bob and Carol (collects consents)
- ✅ Rails creates consent-gated transfer
- ✅ Ledger records settlement atomically
- ✅ Full audit trail + sealed outcome

**Read:** [`examples/05-combined-workflow/README.md`](examples/05-combined-workflow/)

---

### 6️⃣ Batch Transfers — `06-batch-transfers`

**The pattern: Multiple transfers, atomic execution (all or nothing).**

Execute multiple transfers to many recipients with a single consent decision.

```bash
npm run examples:batch  # ~130 lines of code + payroll pattern
npm test examples/06-batch-transfers/  # ~4 comprehensive scenarios
```

**Concepts:**
- ✅ Draft all transfers (pure functions)
- ✅ Collect single approval (Alice approves all)
- ✅ Execute atomically (fail together or succeed together)
- ✅ Audit trail (all operations logged)

**Use case:** Payroll, bulk refunds, multi-recipient payments.

**Read:** [`examples/06-batch-transfers/README.md`](examples/06-batch-transfers/)

---

### 7️⃣ Graph Analysis — `07-graph-analysis`

**The pattern: Query trust graphs for paths, reachability, bottlenecks.**

Analyze Magician routing graphs to find paths, identify critical nodes, measure resilience.

```bash
npm run examples:graph  # ~110 lines of code + analysis
npm test examples/07-graph-analysis/  # Reachability, paths, bottlenecks
```

**Concepts:**
- ✅ Reachability queries (who can reach whom)
- ✅ Shortest path finding (multi-path routing)
- ✅ Bottleneck identification (critical nodes)
- ✅ Revocation impact (connectivity after edge removal)

**Use case:** Network planning, risk analysis, load balancing.

**Read:** [`examples/07-graph-analysis/README.md`](examples/07-graph-analysis/)

---

### 8️⃣ Error Recovery — `08-error-recovery`

**The pattern: Handle common errors, retry, fallback gracefully.**

Demonstrate error handling: insufficient balance, revoked grants, routing failures, retry logic.

```bash
npm run examples:errors  # ~120 lines of code + 5 scenarios
npm test examples/08-error-recovery/  # Errors, recovery, retries
```

**Concepts:**
- ✅ Insufficient balance (clear error)
- ✅ Revoked grants (immediate effect)
- ✅ Routing failures (hop declines)
- ✅ Retry with exponential backoff
- ✅ Graceful fallback (alternative paths)

**Use case:** Production resilience, reliability patterns.

**Read:** [`examples/08-error-recovery/README.md`](examples/08-error-recovery/)

---

### 9️⃣ Attenuation Chains — `09-attenuation-chains`

**The invariant: Delegation narrows authority only. Never widens.**

Create multi-level delegation chains: Alice → Bob → Carol → Dave. Each level narrower.

```bash
npm run examples:attenuation  # ~140 lines of code + chains
npm test examples/09-attenuation-chains/  # Narrowing, widening rejection, revocation
```

**Concepts:**
- ✅ Cap narrowing (less spending power)
- ✅ Expiry narrowing (shorter duration)
- ✅ Widening rejection (throws error)
- ✅ Cascading revocation (revoke parent → children invalid)

**Use case:** Principle of least privilege, team delegation, access control.

**Read:** [`examples/09-attenuation-chains/README.md`](examples/09-attenuation-chains/)

---

### 🔟 Performance Patterns — `10-performance`

**The pattern: Throughput testing, concurrent operations, scaling.**

Measure system performance: sequential vs. concurrent transfers, query efficiency, memory usage.

```bash
npm run examples:perf  # ~150 lines of code + load testing
npm test examples/10-performance/  # Concurrency, queries, scaling
```

**Concepts:**
- ✅ Sequential throughput (baseline)
- ✅ Concurrent operations (parallel)
- ✅ Query performance (balance lookups)
- ✅ Audit trail efficiency (history fetches)
- ✅ Memory scaling (heap usage)

**Use case:** Capacity planning, optimization, production readiness.

**Read:** [`examples/10-performance/README.md`](examples/10-performance/)

---

## 🧪 Testing (100% Coverage of Invariants)

All examples include comprehensive test suites — no skipped tests, no TODOs.

```bash
npm test                           # All ~600 test cases
npm test examples/01-ledger-basics # One example's tests
```

Each test suite verifies:
- ✅ **Happy path** — successful operation
- ✅ **Error conditions** — failure cases and recovery
- ✅ **Invariant preservation** — rules enforced at every step
- ✅ **Idempotency guarantees** — replayed operations are safe
- ✅ **Cross-system integration** — all four systems work together

Example: The ledger test suite runs 163 cases covering initialization, transfers, redemptions, idempotent replays, multi-asset isolation, and invariant violations.

---

## 📦 Installation

```bash
npm install
```

All packages are published to npm. To use local development checkouts:

```bash
# Point to sibling checkouts
npm install file:../flashy-ledger file:../flashy-rails \
  file:../magician/packages/core file:../flashyid/packages/sdk
```

---

## 🏠 The House Rules (Enforced)

These ten rules are not guidelines—they're enforced by tests, linting, and the libraries themselves.

| Rule | Enforcement | Pattern |
|------|-------------|---------|
| **1. Minor type only** | TypeScript, test gates | Never `const x = 50.00`. Always `toMinor('50.00')` → 5000 |
| **2. Explicit consent** | Library design, test | No auto-paths. Draft → get token → execute. Period. |
| **3. Attenuation only** | Runtime checks | Grants narrow only. `attenuate()` refuses widening. |
| **4. Sealed = sealed** | Cryptographic hash | sha256 portable across Node/browser. Replay refused. |
| **5. Opaque identity** | No hardcodes | Holders are unforgeable IDs, never person names. |
| **6. No unverified claims** | Test assertions | Every number measured, not assumed. |
| **7. Clarity over cleverness** | Code review | ~100 lines per example. Readable > clever. |
| **8. No secrets in repos** | Scanning gates | Only Secret Manager. Credentials burned if leaked. |
| **9. Immutable audit trail** | Ledger design | Append-only. Transactions never change. |
| **10. Immediate revocation** | Runtime enforcement | Revoked grants refuse all ops, instantly. |

**See them in action:**
- Ledger example: Rules 1, 6, 8, 9 (Minor, no assumptions, immutable)
- Rails example: Rules 2, 3, 10 (Explicit consent, attenuation, revocation)
- Magician example: Rules 4, 5, 7 (Sealed, opaque, clarity)
- FlashyID example: Rules 3, 6, 10 (Attenuation, measured, revocation)
- Combined: All ten together

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

## 🎓 Learning Path

**For first-time users:**

```
1. Read this file (you are here) — understand the four invariants
2. npm run examples:ledger — see settlement in action (~95 lines)
3. Read examples/01-ledger-basics/README.md — learn the concepts
4. npm test examples/01-ledger-basics — see all invariants verified
```

**Then progress through (10 min each):**

| Step | Example | Focus | You'll Learn |
|------|---------|-------|--------------|
| 1 | Ledger | Settlement | Append-only, Minor type, idempotency |
| 2 | Rails | Consent | Draft/execute, attenuation, revocation |
| 3 | Magician | Routing | Trust graphs, sealed outcomes, opacity |
| 4 | FlashyID | Identity | OAuth, grants, delegation constraints |
| 5 | Combined | Integration | All systems together, end-to-end |

**Total time: ~1 hour to understand the Flashy stack.**

---

## ⚡ Quick Checklist

- [ ] Run `npm install`
- [ ] Run `npm test` (all ~600 tests pass)
- [ ] Run `npm run examples:ledger` (see output)
- [ ] Read `examples/01-ledger-basics/README.md`
- [ ] Read `examples/05-combined-workflow/README.md` (the full picture)
- [ ] Explore the test files (they're your best reference)

---

## 🤝 Contributing

Examples are production teaching material. Before proposing changes:

1. **Code quality:** All tests pass (`npm test`), lint clean (`npm run lint`)
2. **Documentation:** Clear README explaining the pattern and invariants
3. **Completeness:** No TODOs, no FIXMEs, no skipped tests
4. **House rules:** Code follows all ten rules (see table above)

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full checklist.

---

## 📄 License

Apache-2.0. Copyright Flashy Labs.

Built with 💛 for the consent-gated, trust-routed web.
