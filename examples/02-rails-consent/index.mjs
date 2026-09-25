/**
 * Example 2: Rails Consent Flow
 *
 * Learn the consent gate: draft, get approval, execute atomically.
 * Demonstrates: drafting transfers, consent tokens, execution, attenuation.
 */

import { Rails, toMinor, toGold } from '@flashylabs/rails';

async function getApprovalFromUser(draft) {
  // In a real app, this would show a UI and wait for user click.
  // For this example, we simulate user approval.
  console.log(`   [USER] Approves: ${toGold(draft.amount)} ${draft.asset}`);
  return await Rails.createConsentToken(draft);
}

async function main() {
  console.log('=== Rails Consent Flow ===\n');

  const rails = new Rails();

  // Set up initial balances
  console.log('1. Setting up initial balances...');
  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));
  await rails.issue('bob', 'flashy-gold', toMinor('50.00'));
  console.log('   ✓ Alice: 100 Gold, Bob: 50 Gold\n');

  // Draft a transfer (pure, no side effects)
  console.log('2. Drafting transfer: Alice → Bob (25 Gold)...');
  const draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00'),
    reason: 'Payment for services'
  });
  console.log(`   ✓ Draft created (ID: ${draft.id})`);
  console.log(`   ✓ Alice still holds: ${await rails.getBalance('alice', 'flashy-gold')}\n`);

  // Get approval from user
  console.log('3. Getting user approval...');
  const consentToken = await getApprovalFromUser(draft);
  console.log('   ✓ Consent token received\n');

  // Execute the transfer
  console.log('4. Executing transfer with consent...');
  const result = await rails.execute(draft, consentToken);
  console.log(`   ✓ Transfer executed (ledger sealed)\n`);

  // Verify balances
  console.log('5. Verifying final balances...');
  const aliceBalance = await rails.getBalance('alice', 'flashy-gold');
  const bobBalance = await rails.getBalance('bob', 'flashy-gold');
  console.log(`   ✓ Alice: ${toGold(aliceBalance)} Gold`);
  console.log(`   ✓ Bob: ${toGold(bobBalance)} Gold\n`);

  // Demonstrate idempotency: replay execution
  console.log('6. Replaying execution (idempotency)...');
  const result2 = await rails.execute(draft, consentToken);
  const aliceReplay = await rails.getBalance('alice', 'flashy-gold');
  console.log(`   ✓ Alice balance after replay: ${toGold(aliceReplay)} Gold (unchanged)\n`);

  // Demonstrate attenuation: narrow a grant
  console.log('7. Creating attenuated grant...');
  const fullGrant = rails.createGrant('alice', {
    cap: toMinor('100.00'),
    expiry: Date.now() + 1000000
  });

  const attenuatedGrant = rails.attenuate(fullGrant, {
    cap: toMinor('10.00'), // Narrower cap
    expiry: fullGrant.expiry
  });
  console.log(`   ✓ Full grant cap: ${toGold(fullGrant.cap)} Gold`);
  console.log(`   ✓ Attenuated grant cap: ${toGold(attenuatedGrant.cap)} Gold\n`);

  // Try to widen (should fail)
  console.log('8. Attempting to widen grant (should fail)...');
  try {
    rails.attenuate(attenuatedGrant, {
      cap: toMinor('50.00'), // Trying to widen
      expiry: attenuatedGrant.expiry
    });
    console.log('   ✗ ERROR: Should have rejected widening!\n');
  } catch (err) {
    console.log(`   ✓ Correctly rejected: ${err.message}\n`);
  }

  console.log('=== Rails Consent Flow Example Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
