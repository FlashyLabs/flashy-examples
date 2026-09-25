⚡ **Example 7: Graph Analysis**

> Query trust graphs to find paths, identify bottlenecks, measure resilience, and understand network topology.

## The Pattern

Analyze the Magician routing graph to understand:
- Who can be reached from each holder (reachability)
- What paths exist between two holders (routing)
- Which holders are critical to network connectivity (bottlenecks)
- How network resilience changes when edges are revoked

## Key Concepts

### 1. Reachability

```javascript
const reachable = router.findReachable('user:alice');
// Result: all holders Alice can reach through trust edges
```

### 2. Path Finding

```javascript
const paths = router.findPaths('user:alice', 'user:dave', {
  maxHops: 5
});
// Result: all paths from Alice to Dave, sorted by length
```

### 3. Network Analysis

```javascript
const structure = router.analyze();
// Metrics: node count, edge count, diameter, components
```

### 4. Bottleneck Identification

```javascript
const bottlenecks = router.findBottlenecks();
// Result: holders that appear in many critical paths
```

### 5. Revocation Impact

```javascript
router.revokeEdge('user:bob', 'user:carol');
const newReachable = router.findReachable('user:alice');
// Result: reachability after edge revocation
```

## Use Cases

| Use Case | Query |
|----------|-------|
| **Payment routing** | `findPaths(alice, dave)` - find route for settlement |
| **Risk analysis** | `findBottlenecks()` - identify critical nodes |
| **Network planning** | `analyze()` - understand connectivity |
| **Access control** | `findReachable(alice)` - who can Alice reach? |
| **Incident response** | `revokeEdge()` - block compromised node |

## Test Coverage

- Reachability queries (who can reach whom)
- Shortest path finding (prefer fewer hops)
- Revocation impact (connectivity after edge removal)
- Bottleneck identification (critical nodes)

## House Rules at Work

| Rule | How It Appears |
|------|---|
| **Trust is explicit** | Edges exist only if registered (no implicit trust) |
| **Opacity** | Declined paths don't leak information |
| **Sealed outcomes** | Path digests are portable sha256 |
| **Clarity** | Code shows the graph structure clearly |
| **Audit trail** | Graph operations are logged |
| **Immediate revocation** | Revoked edges take effect instantly |

## Production Patterns

- **Path caching:** Cache shortest paths but invalidate on revocation
- **Load balancing:** Use bottleneck analysis to load-balance traffic
- **Health checks:** Periodically verify critical paths still exist
- **Alerting:** Alert if reachability drops unexpectedly

---

**Read next:** Example 8 (Error Recovery) or Example 9 (Attenuation Chains).
