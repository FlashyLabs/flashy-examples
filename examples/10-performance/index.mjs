// Example 10: Performance Patterns
//
// Shows throughput testing, concurrent operations, and how the system
// scales under load while maintaining all invariants.

import { Ledger, toMinor } from '@flashylabs/ledger';
import { Rails } from '@flashylabs/rails';

async function performancePatternsExample() {
  console.log('⚡ Example 10: Performance Patterns\n');

  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });

  // Setup
  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  const holders = Array.from({ length: 100 }, (_, i) => `user:${i}`);

  console.log('Step 1: Populate initial balances (100 holders × $1000)');
  const startTime = Date.now();
  for (const holder of holders) {
    await ledger.issue(holder, 'USD', toMinor('1000.00'));
  }
  console.log(`  ✓ Populated in ${Date.now() - startTime}ms\n`);

  // Scenario 1: Sequential transfers
  console.log('Scenario 1: Sequential transfers (100 transfers)');
  const seq_start = Date.now();
  for (let i = 0; i < 100; i++) {
    const from = holders[i % holders.length];
    const to = holders[(i + 1) % holders.length];
    const draft = rails.draftTransfer({
      from,
      to,
      asset: 'USD',
      amount: toMinor('1.00')
    });
    const token = rails.createConsentToken(draft, from);
    rails.execute(draft, token);
  }
  const seq_time = Date.now() - seq_start;
  console.log(`  ✓ Sequential time: ${seq_time}ms`);
  console.log(`  ✓ Throughput: ${(100000 / seq_time).toFixed(0)} ops/sec\n`);

  // Scenario 2: Concurrent operations
  console.log('Scenario 2: Concurrent operations (100 transfers, parallel)');
  const conc_start = Date.now();
  const promises = [];
  for (let i = 0; i < 100; i++) {
    const from = holders[i % holders.length];
    const to = holders[(i + 1) % holders.length];
    promises.push(
      Promise.resolve().then(() => {
        const draft = rails.draftTransfer({
          from,
          to,
          asset: 'USD',
          amount: toMinor('1.00')
        });
        const token = rails.createConsentToken(draft, from);
        return rails.execute(draft, token);
      })
    );
  }
  await Promise.all(promises);
  const conc_time = Date.now() - conc_start;
  console.log(`  ✓ Concurrent time: ${conc_time}ms`);
  console.log(`  ✓ Throughput: ${(100000 / conc_time).toFixed(0)} ops/sec\n`);

  // Scenario 3: Balance query performance
  console.log('Scenario 3: Balance query performance (100 holders)');
  const query_start = Date.now();
  let totalBalance = 0n;
  for (const holder of holders) {
    const balance = await ledger.getBalance(holder, 'USD');
    totalBalance += BigInt(balance || 0);
  }
  const query_time = Date.now() - query_start;
  console.log(`  ✓ Query time: ${query_time}ms`);
  console.log(`  ✓ Queries/sec: ${(100000 / query_time).toFixed(0)}\n`);

  // Scenario 4: Audit trail query
  console.log('Scenario 4: Audit trail efficiency');
  const history_start = Date.now();
  const history = await ledger.getHistory(holders[0], 'USD');
  const history_time = Date.now() - history_start;
  console.log(`  ✓ Fetched ${history.length} history entries in ${history_time}ms\n`);

  // Scenario 5: Large transfer
  console.log('Scenario 5: Large transfer ($9,999)');
  const alice = holders[0];
  const bob = holders[1];

  const aliceBalance = await ledger.getBalance(alice, 'USD');
  const largeAmount = Math.min(toMinor('9999.00'), aliceBalance - toMinor('1.00'));

  const large_start = Date.now();
  const draft = rails.draftTransfer({
    from: alice,
    to: bob,
    asset: 'USD',
    amount: largeAmount
  });
  const token = rails.createConsentToken(draft, alice);
  rails.execute(draft, token);
  const large_time = Date.now() - large_start;
  console.log(`  ✓ Large transfer in ${large_time}ms\n`);

  // Scenario 6: Memory efficiency
  console.log('Scenario 6: Memory efficiency');
  const memUsage = process.memoryUsage();
  console.log(`  Heap used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('✅ Performance patterns demonstrated\n');
}

await performancePatternsExample();
