⚡ **FLASHY EXAMPLES** — Working Patterns for a Consent-Gated, Trust-Routed Economy

> The Flashy ecosystem teaches four core invariants: **append-only settlement**, **explicit consent**, **sealed introductions**, and **attenuation-only delegation**. These examples show how they work together in production.

Working examples and tutorials for the Flashy ecosystem packages:
- `@flashylabs/ledger` — multi-asset, append-only settlement engine
- `@flashylabs/rails` — consent-gated rewards and value transfer
- `@magician-network/core` — trust routing and sealed introductions
- `@flashyid/sdk` — identity and delegation layer

## The Examples

### 1️⃣ Ledger Basics — `01-ledger-basics`

**The invariant: Balance never goes negative. Settlement is append-only.**

Materialize an asset from the registry, `post()` an entry against a holder's
state, `append()` it, move value as two entries that land together, replay a
key and get the original back.

```bash
npm run examples:ledger
npm test examples/01-ledger-basics/
```

**Concepts covered:**
- ✅ `Minor` — integer minor units via `fromDecimal`/`minor`; over-precision refused
- ✅ `post()` is pure; `InMemoryLedgerStore` persists; there is no `Ledger` class
- ✅ A transfer is `postTransfer` → `appendAll([debit, credit])`
- ✅ Idempotent replay (`deduplicated: true`), asset isolation, tenant scoping
- ✅ The hash chain (`verifyChain`) and opaque identity (an email is refused)

**Runs:** needs `@flashylabs/ledger`

**Read:** [`examples/01-ledger-basics/README.md`](examples/01-ledger-basics/)

---

### 2️⃣ Rails Consent — `02-rails-consent`

**The invariant: Value never moves without the holder's explicit approval.**

`draftTransfer` (pure) → `approve(draft, holder, at)` → `execute(draft, consent)`.
A consent is bound to one draft and one holder. Grants narrow, never widen.

```bash
npm run examples:rails
npm test examples/02-rails-consent/
```

**Concepts covered:**
- ✅ `RailsService` over an `InMemoryLedgerStore`; amounts are decimal *numbers* at the edge
- ✅ `CONSENT_REQUIRED` / `CONSENT_MISMATCH`; execution idempotent by the draft's key
- ✅ `issueGrant` / `attenuate` / `revoke`; `GRANT_WIDENED`, `GRANT_REVOKED`, `GRANT_EXPIRED`, `GRANT_EXCEEDED`
- ✅ `toMinor(25) === 2500`; a string amount is `INVALID_AMOUNT`
- ✅ `reconcile()` — every entry hashed, chained, settling to the balance

**Runs:** needs `@flashylabs/ledger`, `@flashylabs/rails`

**Read:** [`examples/02-rails-consent/README.md`](examples/02-rails-consent/)

---

### 3️⃣ Magician Routing — `03-magician-intro`

**The invariant: A declined introduction is opaque to the requester.**

Parse a `magician-graph/1` document, route an intent with `findPaths`, collect
consent from the owner of every edge crossed, seal the outcome as `introduction/1`.

```bash
npm run examples:magician
npm test examples/03-magician-intro/
```

**Concepts covered:**
- ✅ `trust/1` edges: ids carry a kind, every number carries a register, no `expires` field
- ✅ `findPaths` / `veilPath` — the first hop is yours, the rest are hints until consent
- ✅ The consent machine: `openRequest` → `consentHop` (owner only) → `markIntroduced` (no partial yes)
- ✅ `toRequesterView` collapses a decline to `unavailable` — deep-equal whichever hop declined
- ✅ `sealOutcome` / `verifyIntroduction` / `appendOutcome` — portable sha256, append-only log

**Runs:** needs `@magician-network/core`

**Read:** [`examples/03-magician-intro/README.md`](examples/03-magician-intro/)

---

### 4️⃣ FlashyID Assertions & Delegation — `04-flashyid-oauth`

**The invariant: Grants can only narrow, never widen. Delegation is attenuation.**

The issuer signs an EdDSA assertion carrying a delegation chain; the relying
party verifies it holding only the public key and asks whether the chain
permits *this* action. **The SDK has no OAuth client** — the redirect dance is
the OIDC provider's job; the SDK is the verify surface and the grant kernel.

```bash
npm run examples:flashyid
npm test examples/04-flashyid-oauth/
```

**Concepts covered:**
- ✅ `issueRoot` / `attenuate` — refuses by *returning* `{ ok: false, code: 'chain_widened' }`
- ✅ `signAssertion` (issuer) / `verifyAssertion` (relying party; `null`, never a throw)
- ✅ `authorize` — `out_of_mandate`, `approval_required`, `revoked`, `broken_chain`, `empty_chain`
- ✅ `evaluateGrant` — the gate maps `approval_required` to `ESCALATE`
- ✅ Expiry capped at the parent; revocation walks down

**Runs:** needs `@flashyid/sdk`

**Read:** [`examples/04-flashyid-oauth/README.md`](examples/04-flashyid-oauth/)

---

### 5️⃣ Combined Workflow — `05-combined-workflow`

**The invariant: Agents suggest; humans consent — in all four systems.**

Alice's assistant opens an intent under a chain that lets it draft but never
execute; Magician routes Alice → Bob → Carol → Dave and each hop consents; the
introduction is sealed; the assistant drafts a 50 Gold payment; Alice consents;
two ledger entries land naming the sealed digest.

```bash
npm run examples:combined
npm test examples/05-combined-workflow/
```

**Integration:**
- ✅ flashyID: `authorize(transfer.execute)` is `out_of_mandate` for the assistant
- ✅ Magician: consent on every hop, `sealOutcome` after `markIntroduced`
- ✅ Rails: the *holder* consents — Dave's or the agent's consent is `CONSENT_MISMATCH`
- ✅ Ledger: atomic pair, `metadata.introduction === record.digest`, `reconcile()` ok
- ✅ One id per person everywhere: `person/alice`

**Runs:** needs `@flashyid/sdk`, `@magician-network/core`, `@flashylabs/rails`, `@flashylabs/ledger`

**Read:** [`examples/05-combined-workflow/README.md`](examples/05-combined-workflow/)

---

### 6️⃣ Batch Transfers — `06-batch-transfers`

**The pattern: Many transfers — and where "atomic" honestly lives.**

Through Rails: one draft and one consent *per transfer* (a consent binds one
draft), each transfer atomic, the batch sequential. Through the ledger: post
every entry against a running state and `appendAll` once — all or nothing, at
the cost of bypassing the consent gate.

```bash
npm run examples:batch
npm test examples/06-batch-transfers/
```

**Concepts:**
- ✅ One consent cannot cover a batch — `CONSENT_MISMATCH` by construction
- ✅ Each transfer lands whole; a shortfall mid-batch leaves earlier ones settled (shown, not hidden)
- ✅ The running-state pattern for `postTransfer` → `appendAll`
- ✅ A batch that does not fit is refused in `post()` before anything is written
- ✅ Replay pays nobody twice

**Runs:** needs `@flashylabs/ledger`, `@flashylabs/rails`

**Read:** [`examples/06-batch-transfers/README.md`](examples/06-batch-transfers/)

---

### 7️⃣ Graph Analysis — `07-graph-analysis`

**The pattern: Read a trust graph the way the router does.**

Reachability within `MAX_HOPS`, ranked paths, bottlenecks as a fold over
`Path[]`, decay and renewal, reversed hops, and dropping an edge you no longer
stand behind.

```bash
npm run examples:graph
npm test examples/07-graph-analysis/
```

**Concepts:**
- ✅ `findPathsTo` / `findPaths` / `rankPaths` — match, then fewest introductions, then trust
- ✅ Bottleneck = the intersection of every path's hops
- ✅ `freshness` / `effectiveStrength` — stale edges route at `estimated`; `upsertEdge` renews
- ✅ Reversed hops downgrade to `estimated`; an unrated hop makes path trust `null`
- ✅ No revoke primitive: drop the edge from your own graph

**Runs:** needs `@magician-network/core`

**Read:** [`examples/07-graph-analysis/README.md`](examples/07-graph-analysis/)

---

### 8️⃣ Error Recovery — `08-error-recovery`

**The pattern: Every layer refuses with a stable code; only transient failures are retried.**

`INSUFFICIENT_BALANCE`, `CONSENT_*`, `GRANT_*`, the opaque decline, and a
retry that is safe only because every write carries an idempotency key.

```bash
npm run examples:errors
npm test examples/08-error-recovery/
```

**Concepts:**
- ✅ `LedgerError` passes through Rails unwrapped; `RailsError` is `AppError(code, httpStatus, message)`
- ✅ A refusal is a decision — never retried; the fix is a new draft, a fresh grant, the right consent
- ✅ A declined hop reads `unavailable`; take another path, never learn who
- ✅ A transient failure after `post()` and before commit writes nothing; the retry settles once
- ✅ Widening as a "recovery" is `GRANT_WIDENED`

**Runs:** needs `@flashylabs/ledger`, `@flashylabs/rails`, `@magician-network/core`

**Read:** [`examples/08-error-recovery/README.md`](examples/08-error-recovery/)

---

### 9️⃣ Attenuation Chains — `09-attenuation-chains`

**The invariant: Delegation narrows authority only. Never widens.**

Alice → Bob → Carol → Dave, each link a lower ceiling, a shorter life, fewer
scopes. Revoke Bob and Carol and Dave fall with him.

```bash
npm run examples:attenuation
npm test examples/09-attenuation-chains/
```

**Concepts:**
- ✅ A grant is a chain, root-first; `issueRoot` then `attenuate`
- ✅ Widening returns `chain_widened` at the offending index — no exception
- ✅ Expiry capped at the parent; effective expiry is the chain minimum
- ✅ `permits` at the boundary: `out_of_mandate` past the ceiling or outside scope
- ✅ Revocation is a set of `jti`s and walks down; a hand-built widened chain is caught on verify

**Runs:** needs `@flashyid/sdk`

**Read:** [`examples/09-attenuation-chains/README.md`](examples/09-attenuation-chains/)

---

### 🔟 Performance Patterns — `10-performance`

**The pattern: Measured throughput — and the concurrency rule the numbers hide.**

Sequential and parallel settlement on the in-memory store, conservation of
supply under load, and why writes for one holder must be serialized.

```bash
npm run examples:perf
npm test examples/10-performance/
```

**Concepts:**
- ✅ Every printed figure is a measurement of this process, not a production claim
- ✅ Parallel across disjoint holders: every chain verifies
- ✅ Parallel within one holder: the chain forks and `reconcile()` reports it
- ✅ Conservation: the sum of balances equals the sum of earns
- ✅ Reads: 100 balances, history, `verifyChain`

**Runs:** needs `@flashylabs/ledger`, `@flashylabs/rails`

**Read:** [`examples/10-performance/README.md`](examples/10-performance/)

---

### 1️⃣1️⃣ IntentMesh Roadmaps — `11-intentmesh`

**The format: Federated organization roadmaps with computed expiry.**

Create, publish, and merge organization intentions using the `intent/1` format. Intentions decay unless restated (no stale backlog).

```bash
npm run examples:intentmesh  # ~200 lines of code + federated roadmaps
npm test examples/11-intentmesh/  # ~180 test cases
```

**Concepts covered:**
- ✅ Intent creation (private by structural design)
- ✅ Human-gated promotion (agents draft, people publish)
- ✅ Computed expiry (derived from kind, never user input)
- ✅ Fragment merging (safe multi-org combination)
- ✅ Visibility filtering (public/private projection)

**Runs:** standalone — nothing to install.

**Read:** [`examples/11-intentmesh/README.md`](examples/11-intentmesh/)

**Why:** Part of the Flashy estate standards. Solves roadmap visibility: partnership conversations start from shared understanding, agents can discover overlapping work, no stale backlog.

---

### 1️⃣2️⃣ Rites — the `ritual/1` present tense — `12-rites`

**The format: recurring, witnessed, consequence-bearing practice.**

A faithful model of `ritual/1`: liturgies and observances climbing a
`performed → witnessed → consecrated` ladder **by transition, never by
assertion** — evidence URLs required, independent witness, `person/`
consecration, append-only, and no reward (accrual is a separate `reward/1`).

```bash
node examples/12-rites/index.mjs
npm test examples/12-rites/  # 28 test cases
```

**Concepts covered:**
- ✅ The state ladder (an asserted state is refused)
- ✅ Independent witness (self-witness throws)
- ✅ Human consecration (`person/` only, and only when witnessed)
- ✅ The four refusals (agents observe/humans consecrate; no money; append-only)
- ✅ The anti-metric (`metrics` ship witnessed/consecrated with the raw count)

**Runs:** standalone — nothing to install.

**Read:** [`examples/12-rites/README.md`](examples/12-rites/)

**Why:** Part of the Flashy estate standards. Makes a practice legible — a
witnessed, verifiable record a stranger can check, with the flattering digit
never shown alone.

---

### 1️⃣3️⃣ AAO Manifest Validation — `13-aao-validation`

**The format: the `aao/0.1` manifest — machine-readable governance and conformance.**

Validate an org manifest against the real AAO rules (`aao:"0.1"`, roles with
purpose/capabilities/humanApprovalAtOrAbove, an accountable human, escalation to
a declared role), answer the seven conformance questions, and query capabilities.

```bash
node examples/13-aao-validation/index.mjs
npm test examples/13-aao-validation/  # 21 test cases
```

**Concepts covered:**
- ✅ The manifest shape (roles are responsibilities ≤24 chars, capabilities name actions)
- ✅ The seven questions (four static answered, three live deferred — never faked)
- ✅ Refusals (stray keys, codenames, dangling escalation, no-capability roles)
- ✅ Approval placed where a mistake hurts (`rolesGatingAtOrAbove`)
- ✅ Explicit permissions (`roleHasCapability` never infers)

**Runs:** standalone — nothing to install.

**Read:** [`examples/13-aao-validation/README.md`](examples/13-aao-validation/)

**Why:** Part of the Flashy estate standards. A partner reads one manifest and
knows who to reach, what the org can do, and where money and shipping gate on a
human — production conformance runs `npx @flashyos/agent conform` in CI.

---

### 1️⃣4️⃣ Mesh Reference Consumer — `14-mesh-consumer`

**The consumer side: read `intent/1` + `ritual/1` fragments from many sources, fold into one report.**

The shape a real scheduled "observe" job takes — the network read is injected, so
the fold is pure and testable without egress.

```bash
node examples/14-mesh-consumer/index.mjs
npm test examples/14-mesh-consumer/  # 16 test cases
```

**Concepts covered:**
- ✅ Four findings never collapsed (`ok` / `absent` / `unreachable` / `invalid`)
- ✅ **Null is never zero** (all sources down → `ritual: null`, not `{performed: 0}`)
- ✅ https only; one redirect to the same domain or a subdomain of it
- ✅ The anti-metric survives the fold (witnessed/consecrated with the raw count)
- ✅ Never throws — every source failure is a finding

**Runs:** standalone — nothing to install.

**Read:** [`examples/14-mesh-consumer/README.md`](examples/14-mesh-consumer/)

---

## Machine-readable index

Every example is listed in [`examples/manifest.json`](examples/manifest.json)
(contract `flashy-examples/1`), validated against
[`examples/manifest.schema.json`](examples/manifest.schema.json). A test
(`manifest.test.mjs`) pins the manifest to the filesystem — no example is added
or renamed without the index following. Each entry carries `runs` —
`"standalone"` for the dependency-free examples (11–14) that run and test with
nothing installed, `"needs-packages"` for 01–10 — and `packages`, the exact
list of npm packages that example imports. Both are **measured, not typed**:
the test derives `packages` from the `import` lines of each `index.mjs` and
`index.test.mjs`, checks every listed package is declared in `package.json`,
checks `test:standalone` runs exactly the standalone set, and checks the
**Runs:** line in each block above says the same thing. (`standalone: true` is
the same fact as a boolean, kept for readers of the first revision.)

---

## The Four Flashy Estate Standards

Examples 1-10 teach the **core four systems**. Examples 11-14 teach the
**estate standards** and how to consume them:

| Standard | Format | Example | Solves |
|----------|--------|---------|--------|
| **Trust Routing** | `trust/1` | 03-magician-intro | Consent paths through graphs |
| **Federated Roadmaps** | `intent/1` | 11-intentmesh | Roadmap visibility without logins |
| **Witnessed Practice** | `ritual/1` | 12-rites | Legible, witnessed practice |
| **Governance Declarations** | `aao/0.1` | 13-aao-validation | Machine-readable authority |

---

## 🧪 Testing

Every example ships a `node:test` suite — no skipped tests, no TODOs. The
counts below are what `npm test` reports on 2026-09-28 against the sibling
checkouts; the standalone set is pinned to **103** by CI.

```bash
npm test                           # manifest + all 14 examples (needs the file: installs)
npm run test:standalone            # manifest + examples 11–14, nothing installed
npm test examples/01-ledger-basics # one example
```

Each suite verifies the invariant its README names — happy path, the refusals,
idempotent replay, and (for 05 and 08) the cross-system seams. Tests assert on
stable error `code`s (`INSUFFICIENT_BALANCE`, `CONSENT_MISMATCH`,
`chain_widened`, …), never on message text alone, because the codes are the
packages' published contract and the messages are for people.

---

## 📦 Installation

**Examples 11–14 need nothing installed.** They import only `node:` builtins:

```bash
node examples/12-rites/index.mjs
npm run test:standalone        # manifest + 11–14, zero install
```

**Examples 01–10 need the four core packages, and none of the four is on the
public npm registry today** (measured 2026-09-28 against the sibling checkouts):

| Package | Version in its repository | Where it publishes |
|---|---|---|
| `@flashylabs/ledger` | 1.0.0 | GitHub Packages (`npm.pkg.github.com`), access **restricted** |
| `@flashylabs/rails` | 1.0.0 | not yet published; incubated in `flashy-labs` |
| `@magician-network/core` | 0.1.0 | not yet published |
| `@flashyid/sdk` | 0.1.1 | not yet published |

So a plain `npm install` fails on a clean machine, `npm test` cannot run for a
stranger, and this repository carries no lockfile (see
[`CONTRIBUTING.md`](CONTRIBUTING.md), *Why there is no lockfile yet*). The
ranges in `package.json` (`^1.0.0`, `^1.0.0`, `^0.1.0`, `^0.1.1`) are the
versions that actually exist, so the day each package publishes the same
`npm install` resolves it with no edit here.

**The working install today is the sibling checkouts.** With the four
repositories cloned beside this one (and the ledger built — its `prepare`
script does that on install):

```bash
npm install --no-package-lock \
  file:../flashy-ledger \
  file:../flashy-rails \
  file:../magician/packages/core \
  file:../flashyid/packages/sdk
npm test
```

Nothing above claims a package is published. When one is, this section is the
place that changes.

---

## 🏠 The House Rules (Enforced)

These ten rules are not guidelines—they're enforced by tests, linting, and the libraries themselves.

| Rule | Enforcement | Pattern |
|------|-------------|---------|
| **1. Minor type only** | TypeScript, test gates | Never do money arithmetic on floats. `toMinor(50)` → `5000`, an integer; `toMinor('50')` is refused; `fromDecimal(12.345, 2)` throws |
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
2. npm run examples:ledger — see settlement in action
3. Read examples/01-ledger-basics/README.md — learn the concepts
4. npm test examples/01-ledger-basics — see all invariants verified
```

**Then progress through (10 min each):**

| Step | Example | Focus | You'll Learn |
|------|---------|-------|--------------|
| 1 | Ledger | Settlement | Append-only, Minor type, idempotency |
| 2 | Rails | Consent | Draft/execute, attenuation, revocation |
| 3 | Magician | Routing | Trust graphs, sealed outcomes, opacity |
| 4 | FlashyID | Identity | Signed assertions, grant chains, delegation constraints |
| 5 | Combined | Integration | All systems together, end-to-end |

**Total time: ~1 hour to understand the Flashy stack.**

---

## ⚡ Quick Checklist

- [ ] Run `npm run test:standalone` (manifest + examples 11–14, nothing installed)
- [ ] Link the sibling checkouts (see Installation), then run `npm test`
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
