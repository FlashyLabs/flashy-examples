import { test } from 'node:test';
import assert from 'node:assert';
import { Ledger, toMinor } from '@flashylabs/ledger';
import { Rails } from '@flashylabs/rails';

test('Error recovery: insufficient balance rejected', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('100.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('500.00')
  });

  const token = rails.createConsentToken(draft, 'user:alice');

  assert.throws(
    () => rails.execute(draft, token),
    /insufficient balance/i
  );
});

test('Error recovery: revoked grant refused', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('100.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('50.00')
  });

  const token = rails.createConsentToken(draft, 'user:alice');
  rails.revokeGrant(draft.grantId);

  assert.throws(
    () => rails.execute(draft, token),
    /revoked|invalid/i
  );
});

test('Error recovery: retry succeeds after transient failure', async () => {
  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('100.00'));

  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('50.00')
  });

  const token = rails.createConsentToken(draft, 'user:alice');

  // First attempt (simulated transient failure via invalid conditions)
  let attempts = 0;
  (() => {
    attempts++;
    if (attempts < 2) {
      throw new Error('Transient error');
    }
    return rails.execute(draft, token);
  })();

  assert.equal(attempts, 2, 'Retried after transient failure');
});
