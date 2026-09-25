# Example 3: Magician Introductions

Learn to build trust graphs, route introductions, and seal outcomes with cryptographic proof.

## The Problem: Trusted Introductions at Scale

How do you make an introduction between two people who don't know each other?

- **No trust chain?** No introduction.
- **Trust chain exists?** Route it: ask each person along the chain for consent, then seal the outcome.

## Key Concepts

### `Edge` — a trust relationship

An edge from Alice to Bob means: *Alice asserts she knows Bob*.

```javascript
const edge = {
  from: 'alice',
  to: 'bob',
  tier: 'direct',        // How well Alice knows Bob
  stance: 'introduced',   // Alice is willing to introduce Bob
  provenance: '...',      // Who told Alice this
  renewed: new Date()
};
```

Tiers:
- `primary` — in-person relationship (strongest)
- `secondary` — mutual connections vouch
- `tertiary` — hearsay, claimed but unverified
- `none` — not connected

### `Graph` — the trust network

Build the graph by adding edges:

```javascript
const graph = new TrustGraph();
graph.addEdge(alice.to('bob'));
graph.addEdge(bob.to('carol'));
graph.addEdge(carol.to('dave'));
```

Now you can route introductions:
- Alice → Bob → Carol → Dave (4-hop chain)

### `Introduction` — a routed request

An introduction is a request traveling through the chain:

```javascript
const intro = {
  requester: 'alice',
  target: 'dave',
  reason: 'business partnership',
  route: ['bob', 'carol']  // The hops
};
```

Each hop must **consent** to forward it:

```javascript
// Bob receives request, decides: forward or decline?
// Only Bob can decide—not Alice, not Carol
await bob.consent(intro);
```

### `Sealed Outcome` — cryptographic proof

Once complete, the outcome is sealed with a hash:

```javascript
const outcome = {
  introducer: 'carol',
  requester: 'alice',
  target: 'dave',
  kind: 'accepted',
  digest: sha256(canonicalJSON(outcome))
};
```

The digest proves:
- ✅ The outcome happened (not forged)
- ✅ At a specific time (sealed)
- ✅ Cannot be changed (hash)

## Running This Example

```bash
npm run examples:magician
npm test examples/03-magician-intro
```

## Code Walkthrough

```javascript
// 1. Create a graph
const graph = new TrustGraph();

// 2. Add edges (assertions of trust)
graph.addEdge(new Edge({
  from: 'alice',
  to: 'bob',
  tier: 'direct'
}));

// 3. Route an introduction request
const intro = graph.route({
  requester: 'alice',
  target: 'dave',
  reason: 'business partnership'
});

// 4. Each hop consents (or declines)
await bob.consent(intro);
await carol.consent(intro);

// 5. Seal the outcome
const outcome = await graph.seal(intro);

// 6. Verify the seal
assert(graph.verify(outcome));
```

## Invariants Tested

✅ **No route = no introduction** — must have chain  
✅ **Each hop must consent** — no auto-forward  
✅ **Declined intro is opaque** — requester sees "unavailable"  
✅ **Sealed digest is portable** — verify in browser or Node  
✅ **Cannot forge seal** — digest proves authenticity  
✅ **Stale edges don't route** — must be renewed regularly  

## Next Steps

Once comfortable with introductions:
1. Move to Example 4 to learn **identity and delegation** (who decides who)
2. Understand FlashyID's OAuth flow
3. Learn attenuation grants for fine-grained authorization
