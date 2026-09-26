/**
 * Example 5: Combined Workflow
 *
 * Wire all systems: authenticate → introduce → draft → approve → settle
 * Demonstrates: end-to-end integration, error handling, audit logging.
 */

import { FlashyIDClient, mintGrant } from '@flashyid/sdk';
import { TrustGraph, Edge } from '@magician-network/core';
import { Rails, toMinor, toGold } from '@flashylabs/rails';

// Mock audit log
const auditLog = [];
function audit(event, data) {
  auditLog.push({ event, data, timestamp: new Date().toISOString() });
  console.log(`   [AUDIT] ${event}`);
}

async function main() {
  console.log('=== Combined Workflow: Settlement via Introduction ===\n');

  // 1. Setup: Build trust network
  console.log('1. Setting up trust network...');
  const graph = new TrustGraph();
  graph.addEdge(new Edge({ from: 'alice', to: 'bob', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'bob', to: 'carol', tier: 'direct' }));
  graph.addEdge(new Edge({ from: 'carol', to: 'dave', tier: 'direct' }));
  console.log('   ✓ Network: Alice → Bob → Carol → Dave\n');

  // 2. Alice authenticates
  console.log('2. Alice authenticates with FlashyID...');
  const _client = new FlashyIDClient({
    issuer: 'https://id.flashyid.com',
    clientId: 'settlement.example.com'
  });

  const session = {
    user: { sub: 'user:alice:12345', email: 'alice@example.com' },
    grant: mintGrant('user:alice:12345', {
      cap: 100,
      expiry: Date.now() + 365 * 24 * 60 * 60 * 1000
    })
  };
  audit('auth:success', { user: session.user.sub });
  console.log(`   ✓ Alice authenticated\n`);

  // 3. Query trust: can introduce Alice to Dave?
  console.log('3. Querying trust path (Alice → Dave)...');
  const intro = graph.route({
    requester: session.user.sub,
    target: 'user:dave',
    reason: 'settlement'
  });

  if (!intro.route || intro.route.length === 0) {
    console.log('   ✗ No trust path found\n');
    audit('introduction:failed', { reason: 'no_trust_path' });
    return;
  }

  audit('introduction:route_found', { path: intro.route });
  console.log(`   ✓ Route found: ${intro.route.join(' → ')}\n`);

  // 4. Collect consents through chain
  console.log('4. Collecting consents through chain...');
  const consents = {};
  for (const hop of intro.route) {
    console.log(`   [${hop}] Approves introduction`);
    consents[hop] = { approvedAt: Date.now() };
  }
  audit('introduction:consents_collected', { hops: intro.route });
  console.log('');

  // 5. Seal introduction
  console.log('5. Sealing introduction with proof...');
  const sealedIntro = {
    route: intro.route,
    consents,
    digest: 'sealed:proof:12345',
    sealedAt: Date.now()
  };
  audit('introduction:sealed', { digest: sealedIntro.digest });
  console.log(`   ✓ Introduction sealed\n`);

  // 6. Initialize Rails & Ledger
  console.log('6. Initializing settlement system...');
  const rails = new Rails();
  await rails.issue('user:alice:12345', 'usd', toMinor('100.00'));
  await rails.issue('user:dave', 'usd', toMinor('10.00'));
  console.log('   ✓ Ledger initialized with balances\n');

  // 7. Draft transfer
  console.log('7. Drafting transfer (Alice → Dave, $50 USD)...');
  const draft = rails.draftTransfer({
    from: session.user.sub,
    to: 'user:dave',
    asset: 'usd',
    amount: toMinor('50.00'),
    introduction: sealedIntro
  });
  audit('transfer:drafted', { draft: draft.id, amount: '$50.00' });
  console.log(`   ✓ Draft created (ID: ${draft.id})\n`);

  // 8. Request approval from Dave
  console.log('8. Requesting approval from Dave...');
  console.log('   [USER] Dave reviews transfer');
  console.log('   [USER] Dave approves');
  const approval = await Rails.createConsentToken(draft);
  audit('transfer:approved', { by: 'user:dave' });
  console.log('   ✓ Approval received\n');

  // 9. Execute settlement atomically
  console.log('9. Executing settlement...');
  const settlement = await rails.execute(draft, approval);
  audit('settlement:executed', { txHash: settlement.txHash });
  console.log(`   ✓ Settlement executed and sealed\n`);

  // 10. Verify final state
  console.log('10. Verifying settlement...');
  const aliceBalance = await rails.getBalance(session.user.sub, 'usd');
  const daveBalance = await rails.getBalance('user:dave', 'usd');
  console.log(`   ✓ Alice: ${toGold(aliceBalance)} USD`);
  console.log(`   ✓ Dave: ${toGold(daveBalance)} USD\n`);

  // 11. Display audit trail
  console.log('11. Audit Trail:');
  auditLog.forEach((entry, i) => {
    console.log(`   [${i + 1}] ${entry.event}`);
  });
  console.log('');

  console.log('=== Combined Workflow Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  audit('error', { message: err.message });
  process.exit(1);
});
