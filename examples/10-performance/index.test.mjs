import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryLedgerStore, verifyChain } from '@flashylabs/ledger';
import { RailsService, approve, toMinor } from '@flashylabs/rails';

const HOLDERS = Array.from({ length: 100 }, (_, i) => `hunter_${String(i).padStart(3, '0')}`);
const NOW = new Date();

async function populated(count = 100, amount = 1000) {
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });
  for (const h of HOLDERS.slice(0, count)) {
    await rails.earn({ identityId: h, amount, source: { type: 'quest', id: 'q1' }, idempotencyKey: `quest:q1:${h}` });
  }
  return { store, rails };
}

async function settle(rails, from, to, amount, key) {
  const draft = rails.draftTransfer({ fromId: from, toId: to, amount, source: { type: 'transfer', id: key }, idempotencyKey: key });
  return rails.execute(draft, approve(draft, from, NOW));
}

const supply = async (rails, holders) => (await Promise.all(holders.map((h) => rails.balance(h)))).reduce((s, b) => s + b.minor, 0);

test('Performance: 100 sequential transfers conserve supply and every chain verifies', async () => {
  const { rails } = await populated();
  const before = await supply(rails, HOLDERS);
  assert.equal(before, 100 * toMinor(1000));

  const start = performance.now();
  for (let i = 0; i < 100; i++) await settle(rails, HOLDERS[i], HOLDERS[(i + 1) % 100], 1, `ring:${i}`);
  const elapsed = performance.now() - start;

  assert.equal(await supply(rails, HOLDERS), before, 'a transfer moves value; it never creates or destroys it');
  assert.ok(elapsed < 10_000, `100 transfers took ${elapsed.toFixed(0)} ms`);
  const reports = await Promise.all(HOLDERS.map((h) => rails.reconcile(h)));
  assert.ok(reports.every((r) => r.ok));
});

test('Performance: parallel transfers between DISJOINT holders are safe', async () => {
  const { rails } = await populated();
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => settle(rails, HOLDERS[i], HOLDERS[i + 50], 10, `pair:${i}`)));
  const elapsed = performance.now() - start;

  assert.equal(results.length, 50);
  assert.ok(elapsed < 10_000, `50 parallel transfers took ${elapsed.toFixed(0)} ms`);
  assert.equal(await supply(rails, HOLDERS), 100 * toMinor(1000));
  for (const h of HOLDERS) {
    const history = await rails.history(h);
    assert.equal(verifyChain(history).valid, true, `${h}'s chain is intact`);
  }
  assert.equal((await rails.balance(HOLDERS[0])).gold, 990);
  assert.equal((await rails.balance(HOLDERS[50])).gold, 1010);
});

test('Performance: parallel transfers from ONE holder are not silently fine — reconcile catches the fork', async () => {
  const { rails } = await populated(1, 100);
  const outcomes = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => settle(rails, HOLDERS[0], `hunter_r${i}`, 1, `fork:${i}`)));
  const report = await rails.reconcile(HOLDERS[0]);
  const rejected = outcomes.filter((o) => o.status === 'rejected').length;

  // The in-memory store does not lock. Either the store refuses the conflicting
  // writes, or they land on the same head and reconcile reports the fork. What
  // may never happen is five settlements AND a clean reconcile.
  assert.ok(rejected > 0 || report.ok === false, 'concurrent writes for one holder must be refused or detected');
  if (!report.ok) {
    assert.ok(report.problems.some((p) => /previousHash|running balance/.test(p)), report.problems.join('; '));
  }
});

test('Performance: reads are cheap and history verifies', async () => {
  const { rails } = await populated();
  for (let i = 0; i < 20; i++) await settle(rails, HOLDERS[0], HOLDERS[1], 1, `r:${i}`);

  const start = performance.now();
  for (const h of HOLDERS) await rails.balance(h);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1_000, `100 balance reads took ${elapsed.toFixed(0)} ms`);

  const history = await rails.history(HOLDERS[0]);
  assert.equal(history.length, 21);
  assert.equal(verifyChain(history).valid, true);
  const report = await rails.reconcile(HOLDERS[0]);
  assert.equal(report.ok, true);
  assert.equal(report.balance, toMinor(980));
});
