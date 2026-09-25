import { test } from 'node:test';
import assert from 'node:assert';
import { MagicianRouter } from '@magician-network/core';

test('Graph analysis: reachability', async (t) => {
  const router = new MagicianRouter();

  router.addEdge({ from: 'alice', to: 'bob', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'carol', tier: 'trusted' });

  const reachable = router.findReachable('alice');
  assert.ok(reachable.includes('bob'), 'Bob reachable from Alice');
  assert.ok(reachable.includes('carol'), 'Carol reachable from Alice');
});

test('Graph analysis: shortest path', async (t) => {
  const router = new MagicianRouter();

  router.addEdge({ from: 'alice', to: 'bob', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'carol', tier: 'trusted' });
  router.addEdge({ from: 'alice', to: 'charlie', tier: 'friend' });
  router.addEdge({ from: 'charlie', to: 'carol', tier: 'trusted' });

  const paths = router.findPaths('alice', 'carol', { maxHops: 5 });
  assert.ok(paths.length >= 2, 'At least two paths exist');

  const shortest = paths.sort((a, b) => a.length - b.length)[0];
  assert.equal(shortest.length, 2, 'Shortest path is 2 hops');
});

test('Graph analysis: revocation breaks connectivity', async (t) => {
  const router = new MagicianRouter();

  router.addEdge({ from: 'alice', to: 'bob', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'carol', tier: 'trusted' });

  const reachableBefore = router.findReachable('alice');
  assert.ok(reachableBefore.includes('carol'), 'Carol reachable before revocation');

  router.revokeEdge('bob', 'carol');

  const reachableAfter = router.findReachable('alice');
  assert.ok(!reachableAfter.includes('carol'), 'Carol not reachable after revocation');
});

test('Graph analysis: bottleneck identification', async (t) => {
  const router = new MagicianRouter();

  // Star topology (Bob is bottleneck)
  router.addEdge({ from: 'alice', to: 'bob', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'carol', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'dave', tier: 'trusted' });

  const bottlenecks = router.findBottlenecks();
  assert.ok(bottlenecks.some(b => b.holder === 'bob'), 'Bob identified as bottleneck');
});
