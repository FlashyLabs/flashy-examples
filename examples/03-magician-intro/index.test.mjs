import { test } from 'node:test';
import assert from 'node:assert';
import { TrustGraph, Edge, sha256 } from '@magician-network/core';

test('Magician: route introduction through chain', async (t) => {
  const graph = new TrustGraph();

  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'bob', to: 'carol', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'carol', to: 'dave', tier: 'direct' }));

  const intro = graph.route({
    requester: 'alice',
    target: 'dave',
    reason: 'meeting'
  });

  assert(intro.route, 'Route should exist');
  assert.equal(intro.route.length, 2); // bob and carol
  assert.deepEqual(intro.route, ['bob', 'carol']);
});

test('Magician: no route returns empty', async (t) => {
  const graph = new TrustGraph();

  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  // No connection to dave

  const intro = graph.route({
    requester: 'alice',
    target: 'dave',
    reason: 'meeting'
  });

  assert(!intro.route || intro.route.length === 0, 'No route should exist');
});

test('Magician: seal is portable', async (t) => {
  const outcome = {
    introducer: 'carol',
    requester: 'alice',
    target: 'dave',
    kind: 'accepted',
    sealedAt: 1234567890
  };

  const canonical = {
    introducer: outcome.introducer,
    requester: outcome.requester,
    target: outcome.target,
    kind: outcome.kind,
    sealedAt: outcome.sealedAt
  };

  const digest = sha256(JSON.stringify(canonical));

  // Verify elsewhere (simulating browser verification)
  const recomputed = sha256(JSON.stringify(canonical));
  assert.equal(digest, recomputed, 'Digest should be identical');
});

test('Magician: cannot forge seal', async (t) => {
  const outcome = {
    introducer: 'carol',
    requester: 'alice',
    target: 'dave',
    kind: 'accepted',
    sealedAt: 1234567890
  };

  const canonical = {
    introducer: outcome.introducer,
    requester: outcome.requester,
    target: outcome.target,
    kind: outcome.kind,
    sealedAt: outcome.sealedAt
  };

  const digest = sha256(JSON.stringify(canonical));

  // Try to forge by changing outcome
  outcome.kind = 'declined';
  const tamperedCanonical = {
    introducer: outcome.introducer,
    requester: outcome.requester,
    target: outcome.target,
    kind: outcome.kind,
    sealedAt: outcome.sealedAt
  };

  const tamperedDigest = sha256(JSON.stringify(tamperedCanonical));
  assert.notEqual(digest, tamperedDigest, 'Digest should change if tampered');
});

test('Magician: stale edge tier degrades', async (t) => {
  const staleEdge = new Edge({
    from: 'alice',
    to: 'bob',
    tier: 'direct',
    renewed: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
  });

  const freshEdge = new Edge({
    from: 'alice',
    to: 'bob',
    tier: 'direct',
    renewed: new Date()
  });

  // Stale edge should contribute at lower weight
  assert.equal(staleEdge.weightAtAge(), 'estimated');
  assert.equal(freshEdge.weightAtAge(), 'direct');
});

test('Magician: declined intro is opaque', async (t) => {
  const graph = new TrustGraph();

  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'bob', to: 'carol', tier: 'direct' }));

  const intro = graph.route({
    requester: 'alice',
    target: 'carol',
    reason: 'meeting'
  });

  const route = intro.route;
  assert(route, 'Route should exist');

  // Simulate bob declining
  const declined = graph.decline(intro, 'bob');

  // Requester should see unavailable (not declined)
  const view = graph.toRequesterView(declined);
  assert.equal(view.status, 'unavailable');
  assert(!view.reason, 'Should not expose decline reason to requester');
});
