import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryLedgerStore, FLASHY_GOLD, WHEAT, materialize,
  post, postTransfer, fromDecimal, toDecimal, minor,
  verifyChain, balanceOf,
} from '@flashylabs/ledger';

const TENANT = 'test-01';
const gold = materialize(FLASHY_GOLD, { id: 'asset_fg', tenantId: TENANT });
const wheat = materialize(WHEAT, { id: 'asset_wht', tenantId: TENANT });
const AT = new Date('2026-09-28T09:00:00Z');
const ref = (identityId, asset) => ({ tenantId: TENANT, identityId, assetId: asset.id });

async function earn(store, identityId, asset, amount, idempotencyKey) {
  const state = await store.readState(ref(identityId, asset));
  return store.append(post(state, {
    tenantId: TENANT, identityId, asset, amount, kind: 'EARN',
    source: { type: 'quest', id: idempotencyKey }, idempotencyKey, occurredAt: AT,
  }));
}

async function transfer(store, fromId, toId, asset, amount, idempotencyKey) {
  const [fromState, toState] = await Promise.all([
    store.readState(ref(fromId, asset)), store.readState(ref(toId, asset)),
  ]);
  const [debit, credit] = postTransfer(
    { state: fromState, identityId: fromId },
    { state: toState, identityId: toId },
    { tenantId: TENANT, asset, amount, source: { type: 'gift' }, idempotencyKey, occurredAt: AT },
  );
  return store.appendAll([debit, credit]);
}

const balance = async (store, id, asset) => (await store.readState(ref(id, asset))).balance;

test('Ledger: Minor is an integer count of the smallest unit', () => {
  assert.equal(fromDecimal(50, gold.decimals), 5000);
  assert.equal(toDecimal(minor(2550), gold.decimals), 25.5);
  assert.equal(fromDecimal(5, wheat.decimals), 5);
  // Over-precision is refused, never rounded: rounding a balance invents value.
  assert.throws(() => fromDecimal(12.345, gold.decimals), { name: 'PrecisionError' });
  assert.throws(() => fromDecimal(1.5, wheat.decimals), { name: 'PrecisionError' });
  assert.throws(() => minor(12.5), { name: 'PrecisionError' });
});

test('Ledger: earn, then read the balance back', async () => {
  const store = new InMemoryLedgerStore();
  const { entry, deduplicated } = await earn(store, 'hunter_a1', gold, fromDecimal(50, 2), 'quest:q1:a1');
  assert.equal(deduplicated, false);
  assert.equal(entry.kind, 'EARN');
  assert.equal(entry.balanceBefore, 0);
  assert.equal(entry.balanceAfter, 5000);
  assert.equal(await balance(store, 'hunter_a1', gold), 5000);
});

test('Ledger: a transfer is two entries that land together', async () => {
  const store = new InMemoryLedgerStore();
  await earn(store, 'hunter_a1', gold, minor(5000), 'quest:q1:a1');
  await earn(store, 'hunter_b2', gold, minor(1000), 'quest:q1:b2');

  const results = await transfer(store, 'hunter_a1', 'hunter_b2', gold, minor(2000), 'gift:g1');
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.entry.kind), ['TRANSFER_OUT', 'TRANSFER_IN']);
  assert.deepEqual(results.map((r) => r.entry.amount), [-2000, 2000]);
  assert.equal(await balance(store, 'hunter_a1', gold), 3000);
  assert.equal(await balance(store, 'hunter_b2', gold), 3000);
});

test('Ledger: balance cannot go negative, and a refused post writes nothing', async () => {
  const store = new InMemoryLedgerStore();
  await earn(store, 'hunter_a1', gold, minor(1000), 'quest:q1:a1');
  const before = store.size;

  await assert.rejects(
    () => transfer(store, 'hunter_a1', 'hunter_b2', gold, minor(2000), 'gift:too-much'),
    (err) => err.name === 'LedgerError' && err.code === 'INSUFFICIENT_BALANCE',
  );
  assert.equal(store.size, before, 'neither the debit nor the credit landed');
  assert.equal(await balance(store, 'hunter_a1', gold), 1000);
  assert.equal(await balance(store, 'hunter_b2', gold), 0);
});

test('Ledger: idempotent replay returns the original and writes nothing', async () => {
  const store = new InMemoryLedgerStore();
  await earn(store, 'hunter_a1', gold, minor(5000), 'quest:q1:a1');
  const first = await transfer(store, 'hunter_a1', 'hunter_b2', gold, minor(2000), 'gift:g1');
  const sizeAfterFirst = store.size;

  const replay = await transfer(store, 'hunter_a1', 'hunter_b2', gold, minor(2000), 'gift:g1');
  assert.ok(replay.every((r) => r.deduplicated));
  assert.deepEqual(replay.map((r) => r.entry.id), first.map((r) => r.entry.id));
  assert.equal(store.size, sizeAfterFirst);
  assert.equal(await balance(store, 'hunter_a1', gold), 3000);
});

test('Ledger: assets are isolated, and the same key is scoped per tenant', async () => {
  const store = new InMemoryLedgerStore();
  await earn(store, 'hunter_a1', gold, minor(5000), 'quest:q1:a1');
  await earn(store, 'hunter_a1', wheat, minor(5), 'harvest:h1:a1');

  assert.equal(await balance(store, 'hunter_a1', gold), 5000);
  assert.equal(await balance(store, 'hunter_a1', wheat), 5);

  // Another tenant reusing the key is a different entry, not a dedup.
  const other = materialize(FLASHY_GOLD, { id: 'asset_fg', tenantId: 'other-tenant' });
  const state = await store.readState({ tenantId: 'other-tenant', identityId: 'hunter_a1', assetId: other.id });
  const { deduplicated } = await store.append(post(state, {
    tenantId: 'other-tenant', identityId: 'hunter_a1', asset: other, amount: minor(1),
    kind: 'EARN', source: { type: 'quest' }, idempotencyKey: 'quest:q1:a1', occurredAt: AT,
  }));
  assert.equal(deduplicated, false);
  assert.equal(await balance(store, 'hunter_a1', gold), 5000, 'this tenant is untouched');
});

test('Ledger: history is append-only and tamper-evident; the balance is a fold over it', async () => {
  const store = new InMemoryLedgerStore();
  await earn(store, 'hunter_a1', gold, minor(5000), 'quest:q1:a1');
  await transfer(store, 'hunter_a1', 'hunter_b2', gold, minor(1500), 'gift:g1');
  await earn(store, 'hunter_a1', gold, minor(700), 'quest:q2:a1');

  // The port has no update and no delete. That is the whole append-only rule.
  assert.equal(store.update, undefined);
  assert.equal(store.delete, undefined);

  const history = await store.readEntries(ref('hunter_a1', gold));
  assert.equal(history.length, 3);
  assert.equal(history[0].previousHash, null);
  assert.equal(history[1].previousHash, history[0].hash);
  assert.equal(verifyChain(history).valid, true);
  assert.equal(balanceOf(history), await balance(store, 'hunter_a1', gold));

  // Edit one amount in a copy: its own hash no longer matches and the chain breaks.
  const tampered = history.map((e, i) => (i === 1 ? { ...e, amount: minor(-100) } : e));
  const verdict = verifyChain(tampered);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.problems.length > 0);
});

test('Ledger: identity is opaque — a natural key is refused before it is hashed', () => {
  const state = { balance: minor(0), headHash: null };
  const cmd = (identityId) => ({
    tenantId: TENANT, identityId, asset: gold, amount: minor(100), kind: 'EARN',
    source: { type: 'quest' }, idempotencyKey: 'k', occurredAt: AT,
  });
  assert.throws(() => post(state, cmd('alice@example.com')), { code: 'NATURAL_KEY_IDENTITY' });
  assert.throws(() => post(state, cmd('+14155550100')), { code: 'NATURAL_KEY_IDENTITY' });
  assert.throws(() => post(state, cmd('')), { code: 'NATURAL_KEY_IDENTITY' });
  assert.doesNotThrow(() => post(state, cmd('hunter_a1')));
});

test('Ledger: a movement needs an idempotency key and a non-zero amount', () => {
  const state = { balance: minor(0), headHash: null };
  const base = { tenantId: TENANT, identityId: 'hunter_a1', asset: gold, kind: 'EARN', source: { type: 'quest' }, occurredAt: AT };
  assert.throws(() => post(state, { ...base, amount: minor(100), idempotencyKey: '' }), { code: 'MISSING_IDEMPOTENCY_KEY' });
  assert.throws(() => post(state, { ...base, amount: minor(0), idempotencyKey: 'k' }), { code: 'ZERO_AMOUNT' });
});
