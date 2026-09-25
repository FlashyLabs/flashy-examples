import { test } from 'node:test';
import assert from 'node:assert';
import { InMemoryLedgerStore, toMinor, toGold } from '@flashylabs/ledger';

test('Ledger: create and query balances', async (t) => {
  const store = new InMemoryLedgerStore();

  await store.registerAsset({
    code: 'flashy-gold',
    decimals: 2,
    name: 'Flashy Gold'
  });

  // Issue to Alice
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('50.00') },
    idempotencyKey: 'issue-1'
  });

  const balance = await store.getBalance('alice', 'flashy-gold');
  assert.equal(balance, toMinor('50.00'));
  assert.equal(toGold(balance), '50.00');
});

test('Ledger: transfer between holders', async (t) => {
  const store = new InMemoryLedgerStore();

  await store.registerAsset({
    code: 'flashy-gold',
    decimals: 2,
    name: 'Flashy Gold'
  });

  // Issue to both
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('50.00') },
    idempotencyKey: 'issue-alice'
  });

  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'bob', amount: toMinor('10.00') },
    idempotencyKey: 'issue-bob'
  });

  // Transfer
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'transfer',
    debit: { holder: 'alice', amount: toMinor('20.00') },
    credit: { holder: 'bob', amount: toMinor('20.00') },
    idempotencyKey: 'transfer-1'
  });

  const aliceBalance = await store.getBalance('alice', 'flashy-gold');
  const bobBalance = await store.getBalance('bob', 'flashy-gold');

  assert.equal(toGold(aliceBalance), '30.00');
  assert.equal(toGold(bobBalance), '30.00');
});

test('Ledger: cannot debit more than held', async (t) => {
  const store = new InMemoryLedgerStore();

  await store.registerAsset({
    code: 'flashy-gold',
    decimals: 2,
    name: 'Flashy Gold'
  });

  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('10.00') },
    idempotencyKey: 'issue-1'
  });

  // Try to transfer more than held
  await assert.rejects(
    () => store.recordTransaction({
      asset: 'flashy-gold',
      kind: 'transfer',
      debit: { holder: 'alice', amount: toMinor('20.00') },
      credit: { holder: 'bob', amount: toMinor('20.00') },
      idempotencyKey: 'transfer-fail'
    }),
    /insufficient balance/i
  );
});

test('Ledger: idempotent replay', async (t) => {
  const store = new InMemoryLedgerStore();

  await store.registerAsset({
    code: 'flashy-gold',
    decimals: 2,
    name: 'Flashy Gold'
  });

  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('50.00') },
    idempotencyKey: 'issue-1'
  });

  // Record transfer
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'transfer',
    debit: { holder: 'alice', amount: toMinor('20.00') },
    credit: { holder: 'bob', amount: toMinor('20.00') },
    idempotencyKey: 'tx-1'
  });

  const balanceBefore = await store.getBalance('alice', 'flashy-gold');

  // Replay same transaction
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'transfer',
    debit: { holder: 'alice', amount: toMinor('20.00') },
    credit: { holder: 'bob', amount: toMinor('20.00') },
    idempotencyKey: 'tx-1'
  });

  const balanceAfter = await store.getBalance('alice', 'flashy-gold');

  // Balance should be unchanged (idempotent)
  assert.equal(balanceBefore, balanceAfter);
});

test('Ledger: multiple assets isolated', async (t) => {
  const store = new InMemoryLedgerStore();

  await store.registerAsset({ code: 'gold', decimals: 2, name: 'Gold' });
  await store.registerAsset({ code: 'usd', decimals: 2, name: 'USD' });

  await store.recordTransaction({
    asset: 'gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('50.00') },
    idempotencyKey: 'issue-gold'
  });

  await store.recordTransaction({
    asset: 'usd',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('100.00') },
    idempotencyKey: 'issue-usd'
  });

  const goldBalance = await store.getBalance('alice', 'gold');
  const usdBalance = await store.getBalance('alice', 'usd');

  assert.equal(toGold(goldBalance), '50.00');
  assert.equal(toGold(usdBalance), '100.00');
});
