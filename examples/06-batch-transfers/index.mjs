/**
 * Example 6: Batch Transfers
 *
 * Alice pays three people. Two honest ways to do it, with different guarantees:
 *
 *   A. Through Rails' consent gate — one draft per transfer, one consent per
 *      draft (a consent binds exactly one draft), each transfer atomic on its
 *      own. The BATCH is sequential: a failure mid-way leaves earlier
 *      transfers settled. Rails has no batch primitive today, and this example
 *      says so rather than pretending one consent covers three drafts.
 *
 *   B. Straight onto the ledger — post every entry against a running state in
 *      the pure domain, then appendAll() once. A shortfall throws in post()
 *      before anything is written, so the batch lands whole or not at all.
 *      This bypasses Rails' gate: the application must hold the holder's
 *      consent for the batch itself before taking this path.
 *
 * Demonstrates: draft -> approve -> execute in a loop, idempotent replay, the
 * running-state pattern for appendAll, and where atomicity really lives.
 */

import { InMemoryLedgerStore, postTransfer } from '@flashylabs/ledger';
import { RailsService, approve, toMinor, toGold, flashyGold, FLASHY_TENANT } from '@flashylabs/rails';

const ALICE = 'hunter_a1';
const PAYROLL = [
  { id: 'hunter_b2', amount: 100 },
  { id: 'hunter_c3', amount: 100 },
  { id: 'hunter_d4', amount: 150 },
];
const NOW = new Date();

async function fund(rails, amount) {
  await rails.earn({ identityId: ALICE, amount, source: { type: 'quest', id: 'q1' }, idempotencyKey: `quest:q1:${ALICE}` });
}

async function main() {
  console.log('=== Batch Transfers ===\n');

  console.log('A. Through the consent gate: one draft, one consent, one atomic transfer — each');
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });
  await fund(rails, 500);
  console.log(`   Alice starts with ${(await rails.balance(ALICE)).gold} Gold`);

  console.log('   1. Draft every transfer (pure — nothing written)');
  const drafts = PAYROLL.map((p) => rails.draftTransfer({
    fromId: ALICE, toId: p.id, amount: p.amount,
    source: { type: 'payroll', id: '2026-09' }, idempotencyKey: `payroll:2026-09:${p.id}`,
  }));
  console.log(`      ${drafts.length} drafts, store still holds ${store.size} entry`);

  console.log('   2. Alice consents to each draft — a consent is bound to ONE draft id');
  const consents = drafts.map((d) => approve(d, ALICE, NOW));

  console.log('   3. Execute each; the debit and credit of each transfer land together');
  for (const [i, draft] of drafts.entries()) {
    const results = await rails.execute(draft, consents[i]);
    console.log(`      ${draft.toId}: ${toGold(draft.amountMinor)} Gold (${results.map((r) => r.entry.kind).join(' + ')})`);
  }
  console.log(`   Alice: ${(await rails.balance(ALICE)).gold} Gold; ` +
    (await Promise.all(PAYROLL.map(async (p) => `${p.id}: ${(await rails.balance(p.id)).gold}`))).join(', '));

  console.log('   4. Replaying the batch settles nothing twice');
  const replays = await Promise.all(drafts.map((d, i) => rails.execute(d, consents[i])));
  console.log(`      all deduplicated: ${replays.every((rs) => rs.every((r) => r.deduplicated))}\n`);

  console.log('B. Straight onto the ledger: all-or-nothing, at the cost of Rails\' gate');
  const gold = flashyGold();
  const ref = (identityId) => ({ tenantId: FLASHY_TENANT, identityId, assetId: gold.id });
  const store2 = new InMemoryLedgerStore();
  const rails2 = new RailsService({ store: store2 });
  await fund(rails2, 200);
  console.log(`   Alice starts with ${(await rails2.balance(ALICE)).gold} Gold; payroll totals ${toGold(PAYROLL.reduce((s, p) => s + toMinor(p.amount), 0))}`);

  /** Post every transfer against a RUNNING sender state; return the entries or throw before any write. */
  async function batchEntries(store, recipients, period) {
    let senderState = await store.readState(ref(ALICE));
    const entries = [];
    for (const p of recipients) {
      const toState = await store.readState(ref(p.id));
      const [debit, credit] = postTransfer(
        { state: senderState, identityId: ALICE },
        { state: toState, identityId: p.id },
        { tenantId: FLASHY_TENANT, asset: gold, amount: toMinor(p.amount), source: { type: 'payroll', id: period }, idempotencyKey: `payroll:${period}:${p.id}`, occurredAt: NOW },
      );
      entries.push(debit, credit);
      senderState = { balance: debit.balanceAfter, headHash: debit.hash }; // chain the next debit onto this one
    }
    return entries;
  }

  console.log('   1. A batch that does not fit is refused in post(), before appendAll');
  try {
    await store2.appendAll(await batchEntries(store2, PAYROLL, '2026-09'));
  } catch (err) {
    console.log(`      ${err.code}; store holds ${store2.size} entry — nobody was paid`);
  }

  console.log('   2. A batch that fits lands in one appendAll');
  const smaller = PAYROLL.map((p) => ({ ...p, amount: 50 }));
  const results = await store2.appendAll(await batchEntries(store2, smaller, '2026-09'));
  console.log(`      ${results.length} entries landed; Alice: ${(await rails2.balance(ALICE)).gold} Gold; books reconcile: ${(await rails2.reconcile(ALICE)).ok}\n`);

  console.log('=== Batch Transfers Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
