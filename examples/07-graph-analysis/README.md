# Example 7: Graph Analysis

Read a trust graph the way the router does — reachability, paths, bottlenecks,
decay, renewal — with `@magician-network/core`.

## The real shape of the API

There is no `MagicianRouter`, no `findReachable()`, no `analyze()`, no
`revokeEdge()`. A graph is a parsed `magician-graph/1` document the owner
holds; the router is a pure traversal over it; every analysis here is a fold
over the `Path[]` it returns.

```javascript
const graph = parseGraph(JSON.stringify(document));
findPathsTo(graph, new Set(['person/dave']), now);   // Path[] — to a specific person
findPaths(graph, intent, now);                        // Path[] — to whoever answers the intent's wants
rankPaths(paths);                                     // match, then fewest introductions, then trust
```

### Reachability

Someone is reachable if `findPathsTo` returns a path — within `MAX_HOPS` (3).
Frank, four introductions away, is not. That is a constant, not a setting:
every introduction costs a human a yes.

### Bottlenecks

The nodes every path to a target passes through:

```javascript
paths.map((p) => new Set(p.hops.slice(0, -1).map((h) => h.node)))
     .reduce((acc, s) => new Set([...acc].filter((n) => s.has(n))));
```

Every path to Erin runs through Dave; drop the edge that reaches Dave in two
hops and Erin falls out of range.

### Decay and renewal

Trust is perishable and the format refuses to let you paper over it. There is
no `expires` field; `freshness(edge, now)` is derived from `renewed` — fresh
within 180 days, aging to 365, stale after. A stale edge still routes, but
`effectiveStrength` caps it at `estimated`, and a path built on it carries that
register in its own `trust`.

Renewal is a human re-asserting the edge: `upsertEdge(graph, edge, now)`
restarts the clock, keeps `asserted` as history, and unions provenance rather
than replacing it.

### Asymmetry

`gina -> alice` is Gina's assertion. Traversed from Alice it is a **reversed**
hop: allowed, downgraded to `estimated`, and the consent it needs is Gina's —
she owns the edge.

### Every number carries its register

A path with one unrated hop has `trust: { value: null, register: 'unrated' }`
— not the minimum over the rated hops. An unknown link is at least as weak as
anything measured, and the router refuses to report otherwise.

### "Revocation"

`trust/1` has no revoke. An owner who no longer stands behind an edge drops it
from their own graph (local-first: it is their data) or lets it decay. Graphs
are plain values, so `{ ...graph, edges: graph.edges.filter(...) }` is the
whole operation, and the original is untouched.

## Running this example

```bash
npm run examples:graph
npm test examples/07-graph-analysis
```

## Invariants tested

- **Reachability bounded by `MAX_HOPS`** — six reachable, Frank not, an unknown id routes nothing
- **Ranking** — the 2-hop path first; `rankPaths` is pure; each hop names its `consentOf`
- **Bottleneck** — every path to Erin crosses Charlie and Dave
- **Stale edge routes at estimated** — and the path's `trust.register` says so
- **Renewal** — `renewed` today, `asserted` kept, one edge not two, path trust back to `asserted`
- **Reversed hop** — `reversed: true`, `estimated`, consent of the person reached
- **Unrated hop** — path trust `value: null`
- **Dropping an edge** — reachability follows; the original graph is unchanged

## Use cases

Network planning, deciding which relationships to renew before they decay,
seeing which single person your reach depends on.
