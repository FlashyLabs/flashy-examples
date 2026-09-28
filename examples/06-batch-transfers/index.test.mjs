import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryLedgerStore, postTransfer } from '@flashylabs/ledger';
import { RailsService, approve, toMinor, flashyGold, FLASHY_TENANT } from '@flashylabs/rails';

const ALICE = 'hunter_a1';
const PAYROLL = [
  { id: 'hunter_b2', amount: 100 },
  { id: 'hunter_c3', amount: 100 },
  { id: 'hunter_d4', amount: 150 },
];
const NOW = new Date();
const gold = flashyGold();
const ref = (identityId) => ({ tenantId: FLASHY_TENANT, identityId, assetId: gold.id });

async function setup(balance) {
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });
  await rails.earn({ identityId: ALICE, amount: balance, source: { type: 'quest', id: 'q1' }, idempotencyKey: `quest:q1:${ALICE}` });
  return { store, rails };
}

const draftsFor = (rails, recipients) => recipients.map((p) => rails.draftTransfer({
  fromId: ALICE, toId: p.id, amount: p.amount,
  source: { type: 'payroll', id: '2026-09' }, idempotencyKey: `payroll:2026-09:${p.id}`,
}));

async function batchEntries(store, recipients, period = '2026-09') {
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
    senderState = { balance: debit.balanceAfter, headHash: debit.hash };
  }
  return entries;
}

test('Batch (Rails): three recipients, one draft and one consent each', async () => {
  const { store, rails } = await setup(500);
  const drafts = draftsFor(rails, PAYROLL);
  assert.equal(store.size, 1, 'drafting wrote nothing');

  for (const draft of drafts) await rails.execute(draft, approve(draft, ALICE, NOW));

  assert.equal((await rails.balance(ALICE)).gold, 150);
  assert.equal((await rails.balance('hunter_b2')).gold, 100);
  assert.equal((await rails.balance('hunter_c3')).gold, 100);
  assert.equal((await rails.balance('hunter_d4')).gold, 150);
  assert.equal(store.size, 7, 'one earn plus three debit/credit pairs');
  assert.equal((await rails.reconcile(ALICE)).ok, true);
});

test('Batch (Rails): one consent cannot cover the batch — it is bound to one draft', async () => {
  const { rails } = await setup(500);
  const [first, second] = draftsFor(rails, PAYROLL);
  const consent = approve(first, ALICE, NOW);
  await rails.execute(first, consent);
  await assert.rejects(() => rails.execute(second, consent), { code: 'CONSENT_MISMATCH' });
  await assert.rejects(() => rails.execute(second, null), { code: 'CONSENT_REQUIRED' });
  assert.equal((await rails.balance('hunter_c3')).gold, 0);
});

test('Batch (Rails): each transfer is atomic; the batch is not — a shortfall stops it mid-way', async () => {
  const { store, rails } = await setup(200);
  const drafts = draftsFor(rails, PAYROLL.map((p) => ({ ...p, amount: 150 })));

  await rails.execute(drafts[0], approve(drafts[0], ALICE, NOW));
  const sizeAfterFirst = store.size;
  await assert.rejects(
    () => rails.execute(drafts[1], approve(drafts[1], ALICE, NOW)),
    (err) => err.name === 'LedgerError' && err.code === 'INSUFFICIENT_BALANCE',
  );
  assert.equal(store.size, sizeAfterFirst, 'the failed transfer left no half-written debit');

  // Honest state: the first recipient was paid, the second was not.
  assert.equal((await rails.balance('hunter_b2')).gold, 150);
  assert.equal((await rails.balance('hunter_c3')).gold, 0);
  assert.equal((await rails.balance(ALICE)).gold, 50);
});

test('Batch (Rails): replaying an executed draft pays nobody twice', async () => {
  const { store, rails } = await setup(500);
  const drafts = draftsFor(rails, PAYROLL);
  const consents = drafts.map((d) => approve(d, ALICE, NOW));
  for (const [i, d] of drafts.entries()) await rails.execute(d, consents[i]);
  const size = store.size;

  const replays = await Promise.all(drafts.map((d, i) => rails.execute(d, consents[i])));
  assert.ok(replays.every((rs) => rs.every((r) => r.deduplicated)));
  assert.equal(store.size, size);
  assert.equal((await rails.balance(ALICE)).gold, 150);
});

test('Batch (ledger): a batch that does not fit is refused before anything is written', async () => {
  const { store, rails } = await setup(200);
  await assert.rejects(
    () => batchEntries(store, PAYROLL.map((p) => ({ ...p, amount: 150 }))),
    { code: 'INSUFFICIENT_BALANCE' },
  );
  assert.equal(store.size, 1, 'post() threw in the pure domain; appendAll was never reached');
  assert.equal((await rails.balance(ALICE)).gold, 200);
  assert.equal((await rails.balance('hunter_b2')).gold, 0);
});

test('Batch (ledger): a batch that fits lands whole in one appendAll, correctly chained', async () => {
  const { store, rails } = await setup(200);
  const entries = await batchEntries(store, PAYROLL.map((p) => ({ ...p, amount: 50 })));
  assert.equal(entries.length, 6);

  const results = await store.appendAll(entries);
  assert.ok(results.every((r) => !r.deduplicated));
  assert.equal((await rails.balance(ALICE)).gold, 50);
  assert.equal((await rails.balance('hunter_d4')).gold, 50);

  // Each debit chained onto the previous one — reconcile proves the running state was right.
  const reconciled = await rails.reconcile(ALICE);
  assert.equal(reconciled.ok, true, reconciled.problems.join('; '));
  assert.equal(reconciled.entries, 4);

  // A retrying client resubmits the entries it already built — the same keys
  // replay as a no-op. (Rebuilding them against the post-batch state would be a
  // NEW batch, and would rightly fail on balance.)
  const replay = await store.appendAll(entries);
  assert.ok(replay.every((r) => r.deduplicated), 'the same keys replay as a no-op');
  assert.equal((await rails.balance(ALICE)).gold, 50);
});
