import { test } from 'node:test';
import assert from 'node:assert';
import { TrustGraph, Edge } from '@magician-network/core';
import { Rails, toMinor, toGold } from '@flashylabs/rails';

test('Combined: happy path (all systems)', async () => {
  // Setup
  const graph = new TrustGraph();
  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'bob', to: 'carol', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'carol', to: 'dave', tier: 'direct' }));

  const rails = new Rails();
  await rails.issue('user:alice', 'usd', toMinor('100.00'));
  await rails.issue('user:dave', 'usd', toMinor('10.00'));

  // Route introduction
  const _intro = graph.route({
    requester: 'user:alice',
    target: 'user:dave',
    reason: 'settlement'
  });

  assert(intro.route, 'Route should exist');
  assert.equal(intro.route.length, 2);

  // Draft transfer
  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:dave',
    asset: 'usd',
    amount: toMinor('50.00')
  });

  assert(draft.id);

  // Get approval and execute
  const approval = await Rails.createConsentToken(draft);
  await rails.execute(draft, approval);

  // Verify
  const aliceBalance = await rails.getBalance('user:alice', 'usd');
  const daveBalance = await rails.getBalance('user:dave', 'usd');

  assert.equal(toGold(aliceBalance), '50.00');
  assert.equal(toGold(daveBalance), '60.00');
});

test('Combined: no trust path fails', async () => {
  const graph = new TrustGraph();
  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  // No path to unknown

  const _intro = graph.route({
    requester: 'user:alice',
    target: 'user:unknown',
    reason: 'settlement'
  });

  assert(!intro.route || intro.route.length === 0, 'No route should exist');
});

test('Combined: insufficient balance fails', async () => {
  const rails = new Rails();

  await rails.issue('user:alice', 'usd', toMinor('10.00')); // Only $10
  await rails.issue('user:dave', 'usd', toMinor('0.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:dave',
    asset: 'usd',
    amount: toMinor('50.00') // Trying to send $50
  });

  const approval = await Rails.createConsentToken(draft);

  await assert.rejects(
    () => rails.execute(draft, approval),
    /insufficient balance/i
  );
});

test('Combined: approval required', async () => {
  const rails = new Rails();

  await rails.issue('user:alice', 'usd', toMinor('100.00'));
  await rails.issue('user:dave', 'usd', toMinor('10.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:dave',
    asset: 'usd',
    amount: toMinor('50.00')
  });

  // Try to execute without approval
  await assert.rejects(
    () => rails.execute(draft, null),
    /missing consent token/i
  );
});

test('Combined: end-to-end audit trail', async () => {
  const graph = new TrustGraph();
  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'bob', to: 'dave', tier: 'direct' }));

  const rails = new Rails();
  await rails.issue('user:alice', 'usd', toMinor('100.00'));
  await rails.issue('user:dave', 'usd', toMinor('10.00'));

  // Full workflow
  const _intro = graph.route({
    requester: 'user:alice',
    target: 'user:dave',
    reason: 'settlement'
  });

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:dave',
    asset: 'usd',
    amount: toMinor('50.00')
  });

  const approval = await Rails.createConsentToken(draft);
  await rails.execute(draft, approval);

  // All parts should exist in settlement record
  assert(settlement.id);
  assert.equal(settlement.from, 'user:alice');
  assert.equal(settlement.to, 'user:dave');
  assert.equal(settlement.amount, toMinor('50.00'));
  assert.equal(settlement.status, 'settled');
});
