import { test } from 'node:test';
import assert from 'node:assert';
import { Ledger, toMinor } from '@flashylabs/ledger';
import { Rails } from '@flashylabs/rails';

test('Batch transfers: multiple recipients', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('500.00'));

  // Draft all transfers
  const drafts = [
    { to: 'user:bob', amount: toMinor('100.00') },
    { to: 'user:carol', amount: toMinor('100.00') },
    { to: 'user:dave', amount: toMinor('150.00') }
  ].map(({ to, amount }) =>
    rails.draftTransfer({
      from: 'user:alice',
      to,
      asset: 'USD',
      amount
    })
  );

  assert.equal(drafts.length, 3, 'Three drafts created');

  // Collect consents
  const consents = drafts.map(draft =>
    rails.createConsentToken(draft, 'user:alice')
  );

  // Execute all
  const results = [];
  for (let i = 0; i < drafts.length; i++) {
    results.push(rails.execute(drafts[i], consents[i]));
  }

  assert.equal(results.length, 3, 'All three transfers executed');

  // Verify balances
  const aliceBalance = await ledger.getBalance('user:alice', 'USD');
  assert.equal(aliceBalance, toMinor('50.00'), 'Alice spent $450');

  const bobBalance = await ledger.getBalance('user:bob', 'USD');
  assert.equal(bobBalance, toMinor('100.00'), 'Bob received $100');

  const carolBalance = await ledger.getBalance('user:carol', 'USD');
  assert.equal(carolBalance, toMinor('100.00'), 'Carol received $100');

  const daveBalance = await ledger.getBalance('user:dave', 'USD');
  assert.equal(daveBalance, toMinor('150.00'), 'Dave received $150');
});

test('Batch transfers: atomicity (no partial success)', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('200.00'));

  // Try to transfer $150 to three recipients ($450 total, but only have $200)
  const drafts = [
    { to: 'user:bob', amount: toMinor('150.00') },
    { to: 'user:carol', amount: toMinor('150.00') },
    { to: 'user:dave', amount: toMinor('150.00') }
  ].map(({ to, amount }) =>
    rails.draftTransfer({
      from: 'user:alice',
      to,
      asset: 'USD',
      amount
    })
  );

  const consents = drafts.map(draft =>
    rails.createConsentToken(draft, 'user:alice')
  );

  // First transfer succeeds
  rails.execute(drafts[0], consents[0]);

  // Second transfer fails (insufficient balance)
  assert.throws(
    () => rails.execute(drafts[1], consents[1]),
    /insufficient balance/i,
    'Second transfer rejected (insufficient balance)'
  );

  // Verify state: only first transfer settled
  const aliceBalance = await ledger.getBalance('user:alice', 'USD');
  assert.equal(aliceBalance, toMinor('50.00'), 'Only first transfer settled');

  const bobBalance = await ledger.getBalance('user:bob', 'USD');
  assert.equal(bobBalance, toMinor('150.00'), 'Bob received payment');

  const carolBalance = await ledger.getBalance('user:carol', 'USD');
  assert.equal(carolBalance, undefined, 'Carol received nothing (second transfer failed)');
});

test('Batch transfers: idempotency (replayed transfer rejected)', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('500.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('100.00')
  });

  const consent = rails.createConsentToken(draft, 'user:alice');

  // First execution succeeds
  rails.execute(draft, consent);
  const firstBalance = await ledger.getBalance('user:alice', 'USD');
  assert.equal(firstBalance, toMinor('400.00'), 'First execution settled');

  // Replay the same transfer
  assert.throws(
    () => rails.execute(draft, consent),
    /already settled|replayed|idempotent/i,
    'Replayed transfer rejected'
  );

  // Verify balance unchanged
  const secondBalance = await ledger.getBalance('user:alice', 'USD');
  assert.equal(secondBalance, toMinor('400.00'), 'Balance unchanged (replay rejected)');
});

test('Batch transfers: consent required for each transfer', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('300.00'));

  const draft1 = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('100.00')
  });

  const draft2 = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:carol',
    asset: 'USD',
    amount: toMinor('100.00')
  });

  // Get consent for first transfer only
  const consent1 = rails.createConsentToken(draft1, 'user:alice');

  // First transfer works
  rails.execute(draft1, consent1);

  // Second transfer fails (no consent token)
  assert.throws(
    () => rails.execute(draft2, null),
    /consent|required|token/i,
    'Second transfer rejected (no consent token)'
  );

  // Now get consent for second transfer
  const consent2 = rails.createConsentToken(draft2, 'user:alice');
  rails.execute(draft2, consent2);

  // Both settled
  const aliceBalance = await ledger.getBalance('user:alice', 'USD');
  assert.equal(aliceBalance, toMinor('100.00'), 'Both transfers settled');
});
