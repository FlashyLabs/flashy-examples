// Example 7: Graph Analysis
//
// Shows how to analyze trust graphs: find all reachable holders, discover paths,
// identify bottlenecks, and verify graph connectivity.
//
// Pattern: register edges → query connectivity → find shortest paths → analyze

import { MagicianRouter } from '@magician-network/core';

async function graphAnalysisExample() {
  console.log('⚡ Example 7: Graph Analysis\n');

  // Create router with graph store
  const router = new MagicianRouter();

  // Step 1: Build a trust graph
  console.log('Step 1: Build trust graph');
  const edges = [
    { from: 'user:alice', to: 'user:bob', tier: 'trusted' },
    { from: 'user:bob', to: 'user:carol', tier: 'trusted' },
    { from: 'user:carol', to: 'user:dave', tier: 'trusted' },
    { from: 'user:alice', to: 'user:charlie', tier: 'friend' },
    { from: 'user:charlie', to: 'user:dave', tier: 'trusted' }
  ];

  for (const edge of edges) {
    router.addEdge({
      from: edge.from,
      to: edge.to,
      tier: edge.tier,
      bidirectional: false
    });
    console.log(`  ${edge.from} → ${edge.to} (${edge.tier})`);
  }

  // Step 2: Query all reachable holders from Alice
  console.log('\nStep 2: Find all reachable holders from Alice');
  const reachable = router.findReachable('user:alice');
  console.log(`  Reachable from Alice: ${reachable.join(', ')}`);
  for (const holder of reachable) {
    const distance = router.distanceTo('user:alice', holder);
    console.log(`    ${holder}: ${distance} hop${distance > 1 ? 's' : ''}`);
  }

  // Step 3: Find shortest paths to Dave
  console.log('\nStep 3: Find shortest paths from Alice to Dave');
  const paths = router.findPaths('user:alice', 'user:dave', {
    maxHops: 5,
    sortBy: 'length'
  });

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const hopList = path.route.join(' → ');
    console.log(`  Path ${i + 1} (${path.length} hops): ${hopList}`);
  }

  // Step 4: Analyze graph structure
  console.log('\nStep 4: Analyze graph structure');
  const structure = router.analyze();
  console.log(`  Total nodes: ${structure.nodeCount}`);
  console.log(`  Total edges: ${structure.edgeCount}`);
  console.log(`  Connected components: ${structure.connectedComponents}`);
  console.log(`  Diameter: ${structure.diameter} hops (longest shortest path)`);

  // Step 5: Identify bottlenecks (holders that appear in many shortest paths)
  console.log('\nStep 5: Identify bottlenecks');
  const bottlenecks = router.findBottlenecks();
  for (const { holder, pathCount } of bottlenecks) {
    console.log(`  ${holder}: appears in ${pathCount} critical paths`);
  }

  // Step 6: Measure network resilience
  console.log('\nStep 6: Network resilience');
  const resilience = router.analyzeResilience();
  console.log(`  Average path length: ${resilience.averagePathLength.toFixed(2)} hops`);
  console.log(`  Network redundancy: ${resilience.redundancyFactor}x`);
  console.log(`  Single point of failure: ${resilience.criticalNodes.length > 0 ? 'YES' : 'NO'}`);
  if (resilience.criticalNodes.length > 0) {
    console.log(`    Critical: ${resilience.criticalNodes.join(', ')}`);
  }

  // Step 7: Verify consent requirements
  console.log('\nStep 7: Verify consent requirements for path');
  const bestPath = paths[0];
  const consentsNeeded = bestPath.route.length - 1;  // each hop except first
  console.log(`  Path: ${bestPath.route.join(' → ')}`);
  console.log(`  Consents needed: ${consentsNeeded}`);
  for (let i = 0; i < bestPath.route.length - 1; i++) {
    const from = bestPath.route[i];
    const to = bestPath.route[i + 1];
    console.log(`    ${from} → ${to}: need consent from ${from}`);
  }

  // Step 8: Test path viability (all edges exist and are not revoked)
  console.log('\nStep 8: Check path viability');
  const viable = router.isPathViable(bestPath.route);
  console.log(`  Path viable: ${viable ? '✓' : '✗'}`);

  // Step 9: Simulate edge revocation and analyze impact
  console.log('\nStep 9: Simulate edge revocation (Bob → Carol)');
  router.revokeEdge('user:bob', 'user:carol');
  const reachableAfter = router.findReachable('user:alice');
  console.log(`  Reachable before: ${reachable.length} holders`);
  console.log(`  Reachable after: ${reachableAfter.length} holders`);
  if (reachableAfter.length < reachable.length) {
    const lost = reachable.filter(h => !reachableAfter.includes(h));
    console.log(`  Lost access to: ${lost.join(', ')}`);
  }

  // Step 10: Find alternative paths after revocation
  console.log('\nStep 10: Find alternative paths after revocation');
  const altPaths = router.findPaths('user:alice', 'user:dave', { maxHops: 5 });
  if (altPaths.length > 0) {
    console.log(`  ${altPaths.length} path${altPaths.length > 1 ? 's' : ''} still available:`);
    for (const path of altPaths) {
      console.log(`    ${path.route.join(' → ')}`);
    }
  } else {
    console.log(`  ✗ No paths available to Dave`);
  }

  console.log('\n✅ Graph analysis complete\n');
}

// Run the example
await graphAnalysisExample();
