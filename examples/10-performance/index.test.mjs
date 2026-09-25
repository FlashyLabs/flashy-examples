import { test } from 'node:test';
import assert from 'node:assert';
import { Ledger, toMinor } from '@flashylabs/ledger';
import { Rails } from '@flashylabs/rails';

test('Performance: concurrent operations', async (t) => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('10000.00'));

  const holders = Array.from({ length: 50 }, (_, i) => `user:recipient:${i}`);

  const start = Date.now();
  const promises = [];

  for (let i = 0; i < 50; i++) {
    promises.push(
      Promise.resolve().then(() => {
        const draft = rails.draftTransfer({
          from: 'user:alice',
          to: holders[i],
          asset: 'USD',
          amount: toMinor('100.00')
        });
        const token = rails.createConsentToken(draft, 'user:alice');
        return rails.execute(draft, token);
      })
    );
  }

  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;

  assert.equal(results.length, 50, '50 concurrent operations completed');
  assert.ok(elapsed < 10000, `Completed in ${elapsed}ms (< 10s)`);
});

test('Performance: query efficiency', async (t) => {
  const ledger = new Ledger({ store: new Map() });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('1000.00'));

  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    await ledger.getBalance('user:alice', 'USD');
  }
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 1000, `100 balance queries in ${elapsed}ms (< 1s)`);
});
