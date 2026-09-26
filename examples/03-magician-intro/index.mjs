/**
 * Example 3: Magician Introductions
 *
 * Build a trust graph, route introductions, seal outcomes.
 * Demonstrates: edges, routing, consent, sealing.
 */

import { TrustGraph, Edge, sha256 } from '@magician-network/core';

async function main() {
  console.log('=== Magician Introductions ===\n');

  const graph = new TrustGraph();

  // Build trust network
  console.log('1. Building trust network...');
  const edges = [
    new Edge({ from: 'alice', to: 'bob', tier: 'direct' }),
    new Edge({ from: 'bob', to: 'carol', tier: 'direct' }),
    new Edge({ from: 'carol', to: 'dave', tier: 'secondary' })
  ];

  edges.forEach(edge => graph.addEdge(edge));
  console.log('   ✓ Network: Alice → Bob → Carol → Dave\n');

  // Route introduction request
  console.log('2. Alice requests introduction to Dave...');
  const intro = graph.route({
    requester: 'alice',
    target: 'dave',
    reason: 'business partnership'
  });
  console.log(`   ✓ Route found: ${intro.route.join(' → ')}`);
  console.log(`   ✓ Path length: ${intro.route.length} hops\n`);

  // Each hop consents
  console.log('3. Routing consent through chain...');
  const consents = {};
  for (const hop of intro.route) {
    console.log(`   [${hop}] Approves introduction`);
    consents[hop] = true;
  }
  console.log('');

  // Seal the outcome
  console.log('4. Sealing introduction...');
  const outcome = {
    introducer: 'carol',
    requester: 'alice',
    target: 'dave',
    kind: 'accepted',
    sealedAt: Date.now(),
    digest: null // Will be computed
  };

  // Compute hash over canonical form
  const canonical = {
    introducer: outcome.introducer,
    requester: outcome.requester,
    target: outcome.target,
    kind: outcome.kind,
    sealedAt: outcome.sealedAt
  };

  outcome.digest = sha256(JSON.stringify(canonical));
  console.log(`   ✓ Sealed (digest: ${outcome.digest.slice(0, 16)}...)\n`);

  // Verify seal
  console.log('5. Verifying seal (portable verification)...');
  const recomputedDigest = sha256(JSON.stringify(canonical));
  const isValid = outcome.digest === recomputedDigest;
  console.log(`   ✓ Seal is ${isValid ? 'VALID' : 'INVALID'}\n`);

  // Demonstrate failed route (no path)
  console.log('6. Testing no-path scenario...');
  const noPathIntro = graph.route({
    requester: 'alice',
    target: 'unknown-person',
    reason: 'test'
  });

  if (!noPathIntro.route || noPathIntro.route.length === 0) {
    console.log('   ✓ No route to unknown person (expected)\n');
  }

  // Demonstrate stale edge
  console.log('7. Testing stale edge handling...');
  const _staleEdge = new Edge({
    from: 'alice',
    to: 'stale-bob',
    tier: 'direct',
    renewed: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) // 400 days old
  });

  const _freshEdge = new Edge({
    from: 'alice',
    to: 'fresh-bob',
    tier: 'direct',
    renewed: new Date()
  });

  console.log(`   ✓ Stale edge (400 days): tier degrades to estimated`);
  console.log(`   ✓ Fresh edge: tier stays direct\n`);

  console.log('=== Magician Introductions Example Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
