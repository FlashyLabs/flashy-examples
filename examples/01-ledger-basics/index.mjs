/**
 * Example 1: Ledger Basics
 *
 * Learn to create and manage a multi-asset ledger.
 * Demonstrates: issuance, transfers, balance queries, idempotency.
 */

import { InMemoryLedgerStore, toMinor, toGold } from '@flashylabs/ledger';

async function main() {
  console.log('=== Flashy Ledger Basics ===\n');

  // Create an in-memory ledger store
  const store = new InMemoryLedgerStore();

  // Register two assets
  console.log('1. Registering assets...');
  await store.registerAsset({
    code: 'flashy-gold',
    decimals: 2,
    name: 'Flashy Gold Rewards'
  });
  await store.registerAsset({
    code: 'usd',
    decimals: 2,
    name: 'US Dollar'
  });
  console.log('   ✓ Registered flashy-gold and usd\n');

  // Issue Gold to Alice
  console.log('2. Issuing 50 Flashy Gold to Alice...');
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'alice', amount: toMinor('50.00') },
    idempotencyKey: 'issue-alice-1',
    timestamp: Date.now()
  });
  const aliceBalance = await store.getBalance('alice', 'flashy-gold');
  console.log(`   ✓ Alice now holds: ${toGold(aliceBalance)} Flashy Gold\n`);

  // Issue Gold to Bob
  console.log('3. Issuing 30 Flashy Gold to Bob...');
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'issuance',
    credit: { holder: 'bob', amount: toMinor('30.00') },
    idempotencyKey: 'issue-bob-1',
    timestamp: Date.now()
  });
  const bobBalance = await store.getBalance('bob', 'flashy-gold');
  console.log(`   ✓ Bob now holds: ${toGold(bobBalance)} Flashy Gold\n`);

  // Transfer: Alice sends 15 Gold to Bob
  console.log('4. Alice transfers 15 Gold to Bob...');
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'transfer',
    debit: { holder: 'alice', amount: toMinor('15.00') },
    credit: { holder: 'bob', amount: toMinor('15.00') },
    idempotencyKey: 'transfer-alice-bob-1',
    timestamp: Date.now()
  });
  const aliceAfter = await store.getBalance('alice', 'flashy-gold');
  const bobAfter = await store.getBalance('bob', 'flashy-gold');
  console.log(`   ✓ Alice now holds: ${toGold(aliceAfter)} Flashy Gold`);
  console.log(`   ✓ Bob now holds: ${toGold(bobAfter)} Flashy Gold\n`);

  // Demonstrate idempotency: replay the same transfer
  console.log('5. Replaying the same transfer (idempotency check)...');
  await store.recordTransaction({
    asset: 'flashy-gold',
    kind: 'transfer',
    debit: { holder: 'alice', amount: toMinor('15.00') },
    credit: { holder: 'bob', amount: toMinor('15.00') },
    idempotencyKey: 'transfer-alice-bob-1', // Same key!
    timestamp: Date.now()
  });
  const aliceIdempotent = await store.getBalance('alice', 'flashy-gold');
  const bobIdempotent = await store.getBalance('bob', 'flashy-gold');
  console.log(`   ✓ Alice balance (unchanged): ${toGold(aliceIdempotent)} Flashy Gold`);
  console.log(`   ✓ Bob balance (unchanged): ${toGold(bobIdempotent)} Flashy Gold\n`);

  // Query transaction history
  console.log('6. Transaction history...');
  const history = await store.getTransactionHistory('alice');
  console.log(`   ✓ Alice has ${history.length} transactions\n`);

  console.log('=== Ledger Basics Example Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
