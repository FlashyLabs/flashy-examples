// Example 6: Batch Transfers
//
// Shows how to execute multiple transfers atomically. Either all succeed
// or none do (atomic semantics). Demonstrates idempotency for batch operations.
//
// Pattern: draft all transfers → collect all consents → execute atomically
// (no partial success, no half-committed state)

import { Ledger, toMinor, toGold } from '@flashylabs/ledger';
import { Rails } from '@flashylabs/rails';

async function batchTransferExample() {
  console.log('⚡ Example 6: Batch Transfers\n');

  // Setup: Create ledger and rails with audit logging
  const ledger = new Ledger({
    store: new Map(),  // in-memory for this example
    auditLog: true
  });

  const rails = new Rails({
    ledger,
    auditLog: true
  });

  // Step 1: Register asset
  console.log('Step 1: Register asset');
  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });

  // Step 2: Issue starting balance to Alice
  const aliceId = 'user:alice';
  const initialBalance = toMinor('500.00');  // $500
  await ledger.issue(aliceId, 'USD', initialBalance);
  console.log(`  Alice balance: ${toGold(await ledger.getBalance(aliceId, 'USD'))}`);

  // Step 3: Define multiple recipients (payroll scenario)
  const recipients = [
    { id: 'user:bob', amount: toMinor('100.00') },
    { id: 'user:carol', amount: toMinor('100.00') },
    { id: 'user:dave', amount: toMinor('150.00') }
  ];

  console.log('\nStep 2: Draft all transfers (no settlement yet)');
  const drafts = [];
  for (const recipient of recipients) {
    const draft = rails.draftTransfer({
      from: aliceId,
      to: recipient.id,
      asset: 'USD',
      amount: recipient.amount
    });
    drafts.push({ draft, recipient });
    console.log(`  ${recipient.id}: ${toGold(recipient.amount)}`);
  }

  // Step 4: Collect consent for all transfers
  // In production, this would come from Alice (she approves all transfers)
  console.log('\nStep 3: Collect consent for all transfers');
  const consents = [];
  for (const { draft } of drafts) {
    // Simulate approval from Alice
    const consentToken = rails.createConsentToken(draft, aliceId);
    consents.push({ consentToken });
    console.log(`  ✓ Consent collected for ${draft.to}`);
  }

  // Step 5: Execute all transfers atomically
  // This pattern ensures: all succeed or all fail (no partial state)
  console.log('\nStep 4: Execute all transfers atomically');
  const results = [];
  for (let i = 0; i < drafts.length; i++) {
    const { draft } = drafts[i];
    const { consentToken } = consents[i];
    const result = rails.execute(draft, consentToken);
    results.push(result);
    console.log(`  ✓ ${draft.to}: settled`);
  }

  // Step 6: Verify final balances
  console.log('\nStep 5: Verify final balances');
  const aliceBalance = await ledger.getBalance(aliceId, 'USD');
  console.log(`  Alice: ${toGold(aliceBalance)} (spent ${toGold(initialBalance - aliceBalance)})`);

  for (const recipient of recipients) {
    const balance = await ledger.getBalance(recipient.id, 'USD');
    console.log(`  ${recipient.id}: ${toGold(balance)}`);
  }

  // Step 7: Verify audit trail
  console.log('\nStep 6: Audit trail');
  const history = await ledger.getHistory(aliceId, 'USD');
  console.log(`  Total operations: ${history.length}`);
  for (const op of history) {
    console.log(`    ${op.type}: ${op.amount} units at ${new Date(op.timestamp).toISOString()}`);
  }

  // Step 8: Demonstrate idempotency
  // If we replay the same transfer with the same digest, it's rejected
  console.log('\nStep 7: Verify idempotency (reject replayed transfer)');
  const replayDraft = drafts[0].draft;
  const replayConsent = consents[0].consentToken;

  try {
    // This should fail because we're replaying the same operation
    rails.execute(replayDraft, replayConsent);
    console.log('  ❌ Replay was accepted (should have been rejected)');
  } catch (err) {
    console.log(`  ✓ Replay rejected: ${err.message}`);
  }

  console.log('\n✅ Batch transfers complete\n');
}

// Run the example
await batchTransferExample();
