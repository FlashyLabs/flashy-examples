/**
 * Example 10: Performance Patterns
 *
 * Throughput on the in-memory reference store, measured rather than assumed —
 * and the one concurrency rule the numbers do not show: writes for ONE holder
 * must be serialized, because the store does not lock and the chain forks.
 * Demonstrates: sequential vs parallel settlement, what parallelism is safe,
 * how reconcile() catches the unsafe kind, read costs, and conservation.
 *
 * Every figure printed is a measurement of this process on this machine. None
 * of them is a claim about production, which runs on MongoLedgerStore.
 */

import { InMemoryLedgerStore } from '@flashylabs/ledger';
import { RailsService, approve } from '@flashylabs/rails';

const HOLDERS = Array.from({ length: 100 }, (_, i) => `hunter_${String(i).padStart(3, '0')}`);
const NOW = new Date();
const ms = (start) => (performance.now() - start).toFixed(1);
const perSec = (n, start) => Math.round((n / (performance.now() - start)) * 1000);

async function settle(rails, from, to, amount, key) {
  const draft = rails.draftTransfer({ fromId: from, toId: to, amount, source: { type: 'transfer', id: key }, idempotencyKey: key });
  return rails.execute(draft, approve(draft, from, NOW));
}

async function totalSupply(rails) {
  const balances = await Promise.all(HOLDERS.map((h) => rails.balance(h)));
  return balances.reduce((sum, b) => sum + b.minor, 0);
}

async function main() {
  console.log('=== Performance Patterns ===\n');
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });

  console.log('1. Populate: 100 holders earn 1000 Gold each');
  let t = performance.now();
  for (const h of HOLDERS) await rails.earn({ identityId: h, amount: 1000, source: { type: 'quest', id: 'q1' }, idempotencyKey: `quest:q1:${h}` });
  console.log(`   ${ms(t)} ms, ${perSec(100, t)} earns/s; supply ${await totalSupply(rails)} minor\n`);

  console.log('2. Sequential: 100 transfers of 1 Gold around the ring (holder i -> i+1)');
  t = performance.now();
  for (let i = 0; i < 100; i++) await settle(rails, HOLDERS[i], HOLDERS[(i + 1) % 100], 1, `ring:${i}`);
  console.log(`   ${ms(t)} ms, ${perSec(100, t)} transfers/s; supply ${await totalSupply(rails)} minor (conserved)\n`);

  console.log('3. Parallel, SAFE: 50 transfers between disjoint pairs (0..49 -> 50..99), one Promise.all');
  t = performance.now();
  await Promise.all(Array.from({ length: 50 }, (_, i) => settle(rails, HOLDERS[i], HOLDERS[i + 50], 10, `pair:${i}`)));
  console.log(`   ${ms(t)} ms, ${perSec(50, t)} transfers/s`);
  const reports = await Promise.all(HOLDERS.map((h) => rails.reconcile(h)));
  console.log(`   every holder reconciles: ${reports.every((r) => r.ok)}; supply ${await totalSupply(rails)} minor\n`);

  console.log('4. Parallel, UNSAFE: 5 transfers from ONE holder in one Promise.all');
  const store2 = new InMemoryLedgerStore();
  const rails2 = new RailsService({ store: store2 });
  await rails2.earn({ identityId: HOLDERS[0], amount: 100, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:h0' });
  const outcomes = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => settle(rails2, HOLDERS[0], HOLDERS[i + 1], 1, `fork:${i}`)));
  const report = await rails2.reconcile(HOLDERS[0]);
  console.log(`   ${outcomes.filter((o) => o.status === 'fulfilled').length} settled, reconcile ok: ${report.ok}`);
  for (const p of report.problems.slice(0, 2)) console.log(`   - ${p}`);
  console.log(`   the store reports ${(await rails2.balance(HOLDERS[0])).gold} Gold; the entries sum to ${100 - outcomes.filter((o) => o.status === 'fulfilled').length}`);
  console.log('   every attempt read the same head and chained onto it: serialize writes per holder\n');

  console.log('5. Reads: 100 balance lookups, one history read, one chain verification');
  t = performance.now();
  for (const h of HOLDERS) await rails.balance(h);
  console.log(`   100 balances in ${ms(t)} ms`);
  t = performance.now();
  const history = await rails.history(HOLDERS[0]);
  const verified = await rails.reconcile(HOLDERS[0]);
  console.log(`   ${history.length} entries read and verified in ${ms(t)} ms (ok: ${verified.ok})\n`);

  console.log('6. Memory: this process, after everything above');
  const { heapUsed, heapTotal } = process.memoryUsage();
  console.log(`   heap ${(heapUsed / 1048576).toFixed(1)} MB used of ${(heapTotal / 1048576).toFixed(1)} MB; ${store.size} entries held\n`);

  console.log('=== Performance Patterns Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
