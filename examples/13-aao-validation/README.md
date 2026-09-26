# Example 13: AAO manifest validation (`aao/0.1`)

A faithful, dependency-free model of the `@flashyos/aao` manifest checker — the
format that decides whether an organization of agents is an **Agentic Autonomous
Organization** rather than a product with agents bolted on.

> Canon: [flashyos.com/aao](https://flashyos.com/aao),
> [flashyos.com/standard](https://flashyos.com/standard).
> Guide: [aao-governance-conformance.md](https://github.com/flashylabs/flashy-docs/blob/main/docs/guides/aao-governance-conformance.md).

## The manifest

```jsonc
{
  "aao": "0.1",
  "name": "Rites Protocol",
  "slug": "rites-protocol",                 // machine-safe: [a-z0-9-]+
  "description": "The present tense of the record.",
  "accountableTo": "michael@gda.capital",   // a real, reachable human
  "escalation": "spec",                      // must name a declared role
  "repositories": [ { "name": "rites-network", "default": true } ],
  "roles": [
    { "name": "consecration",                // a responsibility, <= 24 chars
      "family": "operations",                // lowercase family
      "purpose": "A named human consecrates an observance into consequence.",
      "measure": "Observances consecrated by a named person",
      "capabilities": ["review", "consecrate"],  // actions, not departments
      "humanApprovalAtOrAbove": "HIGH" }     // LOW | MEDIUM | HIGH | CRITICAL
  ]
}
```

## The seven questions

AAO asks seven questions about an agent holding credentials. Four are **static**
(from the manifest); three are **live** — they cannot be declared, only
demonstrated against a running org, so this example reports them `deferred`.

| # | Question | Kind |
| --- | --- | --- |
| 1 | Roles are standing responsibilities, not codenames? | static |
| 2 | Capabilities name actions, not departments? | static |
| 3 | Approval thresholds where a mistake would hurt? | static |
| 4 | A named, reachable human accountable? | static |
| 5 | Was each agent's authorizing human recorded? | live (deferred) |
| 6 | Does revoking an agent actually stop it? | live (deferred) |
| 7 | Does the org produce a real audit trail? | live (deferred) |

## The API

| Function | Does |
| --- | --- |
| `validateCharter(c)` | The static rules → `{ valid, errors }` |
| `conformance(c)` | The seven questions (static answered, live deferred) |
| `capabilitiesOf(c)` | Sorted union of every role's `x-capability` |
| `rolesGatingAtOrAbove(c, level)` | Roles that gate a human at/above a threshold |
| `roleHasCapability(c, role, cap)` | Explicit check — no implicit permissions |

## Running

```bash
node examples/13-aao-validation/index.mjs
npm test examples/13-aao-validation   # 21 test cases
```

## What the tests prove

✅ `aao` must be `"0.1"`; a stray top-level key is refused (only `x-` is allowed)  
✅ Role names are responsibilities capped at 24 chars — a codename is refused  
✅ Capabilities name actions; a role with none is refused  
✅ Approval is one of `LOW/MEDIUM/HIGH/CRITICAL`  
✅ `escalation` must name a declared role — a path to nobody is refused  
✅ The three live questions report `deferred`, never `passed`  
✅ Permissions are explicit — `roleHasCapability` never infers  

## Why it matters

Several orgs build on FlashyOS independently. If each reinvented identity,
permissions, approvals and audit, nothing would compose. One manifest format and
a short, hard-to-grow conformance contract mean a partner reads one file and
knows who to reach, what the org can do, and where money and shipping gate on a
human — without a meeting. Production conformance runs
`npx @flashyos/agent conform` in CI.

## The Flashy Estate standards

| Standard | Format | Solves |
| --- | --- | --- |
| Trust Routing | `trust/1` | Consent paths through graphs (Magician) |
| Federated Roadmaps | `intent/1` | Roadmap visibility without logins (IntentMesh) |
| Witnessed Practice | `ritual/1` | Legible, witnessed practice (Rites) |
| Governance | `aao/0.1` | Machine-readable authority + conformance |
