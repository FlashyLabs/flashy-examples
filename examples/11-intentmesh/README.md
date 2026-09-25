# Example 11: IntentMesh — Federated Roadmaps

Learn to create, publish, and merge federated roadmaps using `intentmesh` (intent/1 format).

## What is IntentMesh?

IntentMesh is a federated format for publishing what your organization intends to build next. It solves the roadmap visibility problem:

- **One file per repository** — `intent.fragment.json` at `.well-known/intent.json`
- **No login required** — published at `https://yourcompany.com/.well-known/intent.json`
- **Merge-safe** — readers combine roadmaps from multiple sources
- **Decay by design** — intentions expire unless restated (no stale backlog)
- **Human-gated publication** — agents can draft, only humans can promote to public

## Key Concepts

### Intent Item — a single planned initiative

```javascript
{
  id: "intent/acme/settlement-rails",      // globally unique identifier
  kind: "initiative",                      // initiative | task | research
  title: "Settlement rails for payouts",
  status: "open",                          // open | blocked | paused | shipped
  wants: ["payments", "compliance"],       // what the org wants to be able to do
  visibility: "public",                    // public | partner | private
  expires: "2026-12-31T23:59:59Z"         // computed from kind, never accepted as input
}
```

### Fragment — one organization's complete intent

```javascript
{
  "intent": "1",
  "source": "repo/acme",
  "org": "org/acme",
  "generated": "2026-09-25T18:00:00Z",
  "items": [ /* array of intent items */ ]
}
```

### Three Invariants

1. **Expiry is computed, never accepted** — prevents stale intentions from living forever
2. **Public requires human approval** — agents can draft, `promote()` requires `person/` signature
3. **The served projection is non-identifying** — a public roadmap reveals plans, never which human authored them

## Running This Example

```bash
npm run examples:intentmesh
npm test examples/11-intentmesh
```

## Code Walkthrough

See `index.mjs` for the full example. Key patterns:

```javascript
import { file, promote, merge, view } from 'intentmesh';

// 1. Create a private draft (agent-safe)
const item = file({
  id: 'intent/acme/settlement-rails',
  kind: 'initiative',
  title: 'Settlement rails for cross-border payouts',
  status: 'open',
  wants: ['payments', 'compliance']
});
console.log(item.visibility);  // 'private' — there is no argument to change this

// 2. Promote to public (requires human approval)
const promoted = promote(item, {
  by: 'person/alice',           // only person/ IDs can promote
  to: 'public'
});
console.log(promoted.visibility);  // 'public'

// 3. Create multiple intents
const items = [
  file({ id: 'intent/acme/item-1', kind: 'initiative', title: 'First', status: 'open', wants: ['x'] }),
  file({ id: 'intent/acme/item-2', kind: 'task', title: 'Second', status: 'paused', wants: ['y'] }),
  file({ id: 'intent/acme/item-3', kind: 'research', title: 'Third', status: 'blocked', wants: ['z'] })
];

// 4. Merge multiple fragments
const fragment1 = { intent: '1', source: 'repo/acme', org: 'org/acme', generated: new Date().toISOString(), items: items.slice(0, 2) };
const fragment2 = { intent: '1', source: 'repo/bigcorp', org: 'org/bigcorp', generated: new Date().toISOString(), items: items.slice(2) };

const { intents, problems } = merge([fragment1, fragment2]);
console.log(intents.length);      // 3
console.log(problems.length);     // 0

// 5. View only public items
const publicOnly = view(intents, 'public');
console.log(publicOnly.length);   // number of public items

// 6. Filter by wants
const paymentFocused = intents.filter(i => i.wants.includes('payments'));
console.log(paymentFocused);

// 7. Group by status
const byStatus = intents.reduce((acc, i) => {
  acc[i.status] = (acc[i.status] || []).concat(i);
  return acc;
}, {});
console.log(byStatus);
```

## Invariants Tested

✅ **Visibility always defaults to private** — no parameter can override it  
✅ **Promotion requires person/ signature** — `promote()` throws on `agent/` or missing signature  
✅ **Expiry is computed from kind** — initiative expires in 90 days, task in 30, research in 60  
✅ **Merge combines fragments safely** — duplicate IDs fail with clear error  
✅ **View filters by tier** — `view(intents, 'public')` excludes private/partner  
✅ **Wants are required** — item with no `wants` is refused  

## Why This Matters

**Problem:** Every company knows what it is working on. Almost none can tell another company in a form a machine can read without a meeting.

**Solution:** Federated intent means:
- Partnership conversations start from a shared understanding
- An agent working on your behalf can discover that another org has been solving your problem for weeks
- No registry to maintain — two organizations reading each other's files is the network
- Intentions decay naturally — no stale backlog that looks current

## The Format You're Building

This example teaches the `intent/1` format, which is part of the **Flashy estate standards**:
- `trust/1` — trust graphs and routing (Magician)
- `ritual/1` — witnessed observances and standing (Rites)
- `intent/1` — federated roadmaps (IntentMesh)
- `aao/1` — authority, activation, outcomes (GDA-OS)

## Next Steps

1. Read the full IntentMesh spec at `https://intentmesh.org/SPEC.md`
2. Adopt IntentMesh for your own organization: `npx intentmesh adopt`
3. Merge your roadmap with others: `npx intentmesh merge ./fragments`
4. Verify your implementation: `npx intentmesh verify yourcompany.com`

