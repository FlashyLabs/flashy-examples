# Example 3: Magician Introductions

A trust graph, a routed introduction, consent on every hop, and a sealed
outcome — with `@magician-network/core`.

## The problem: trusted introductions at scale

How do you introduce two people who do not know each other?

- **No trust chain?** No introduction.
- **A chain exists?** Route it, ask the owner of each edge for consent, then
  seal what happened.

## The real shape of the API

There is no `TrustGraph` class and no `graph.route()`. The core is a set of
pure functions over parsed documents:

```javascript
const graph  = parseGraph(JSON.stringify(document));       // magician-graph/1
const intent = parseIntent({ id, text, wants: ['cap/robotics-manufacturing'], opened });
const [path] = findPaths(graph, intent, now);               // hops, trust, match
let request  = openRequest('req-1', intent.id, path, now);  // lands PROPOSED
request      = consentHop(request, 'person/bob', now);      // only the edge's owner
request      = markIntroduced(request, now);                // only when every hop said yes
const record = sealOutcome(request, intent, { kind: 'meeting', note }, now);
verifyIntroduction(record);                                 // true — anywhere, in any browser
```

### `trust/1` — an edge

```javascript
{
  format: 'trust/1', from: 'person/alice', to: 'person/bob',
  tier: 'private',                                  // the default; absent never means public
  domains: [],
  strength: { value: 0.8, register: 'asserted' },   // every number says how it knows
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }],
  asserted: '2026-01-15', renewed: '2026-06-01',     // decay is derived from renewed
}
```

Ids carry a kind — `person/`, `org/`, `circle/`, `cap/` — and a bare name is
refused. A rated edge must name the event it stands on. There is no `expires`
field; a document that carries one fails to parse.

### The route and the veil

`findPaths` traverses at most three hops from the graph's owner. Each hop
records `consentOf` — whose edge is being crossed. `veilPath` renders the path
for the requester: the first hop is your own edge, and everything past the
consent frontier is a domain hint, not a name.

### The consent machine

Every request lands `proposed`. `consentHop(request, by)` refuses anyone who
does not own a pending hop, and refuses a second answer. `markIntroduced`
refuses until every hop has consented — there is no partial yes.

### The opaque decline

`declineHop` kills the path. `toRequesterView` collapses it to
`{ id, state: 'unavailable' }` — the same object whether Bob or Carol declined,
with no `by` and no reason. A visible refusal would leak exactly the
relationship data the refusal protects.

### `introduction/1` — the seal

`sealOutcome` hashes over canonical JSON with a pure-TypeScript sha256, so the
digest is identical in Node and in a browser. `appendOutcome` refuses a record
that does not verify and a digest already in the log: the log is a union, never
a replay.

## Running this example

```bash
npm run examples:magician
npm test examples/03-magician-intro
```

## Invariants tested

- **A route names every hop and whose consent it needs** — `[bob, carol, dave]`, consent of `[alice, bob, carol]`
- **No chain, no introduction** — `findPaths` returns `[]`
- **The veil** — hop 1 visible, later hops are hints until their owner consents
- **Every request lands proposed; only the owner consents** — a stranger's consent throws; a second answer throws; no partial yes
- **Declined is opaque** — `{ id, state: 'unavailable' }`, deep-equal whichever hop declined
- **The seal is portable and tamper-evident** — `digestOf(body) === digest`; a forged copy fails
- **The log is append-only** — a replayed digest is refused
- **Seal follows the event** — no outcome on a request that was not introduced
- **Stale edges route at estimated** — `freshness`, `effectiveStrength`, and the path's own register
- **The parser refuses** — `expires`, unlabeled numbers, missing provenance, bare ids, an intent with no `wants`

## Next steps

1. Example 4: **flashyID** — a signed assertion carrying a delegation chain that only narrows
2. Example 5: wire an introduction to a consent-gated settlement
