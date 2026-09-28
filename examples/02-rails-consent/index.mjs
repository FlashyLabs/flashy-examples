/**
 * Example 2: Rails Consent Flow
 *
 * The consent gate: an agent drafts, the holder consents, then value moves.
 * Demonstrates: draftTransfer -> approve -> execute, consent bound to one
 * draft, idempotent execution, and attenuated grants that never widen.
 *
 * Flashy Rails is a thin service over a @flashylabs/ledger store. Amounts at
 * its edge are person-facing decimals (numbers); the ledger sees Minor units.
 * toMinor(25) is 2500 — a number in, an integer out. Never a string.
 */

import { InMemoryLedgerStore } from '@flashylabs/ledger';
import {
  RailsService, approve, issueGrant, attenuate, revoke,
  toMinor, toGold, FLASHY_GOLD_ID,
} from '@flashylabs/rails';

const ALICE = 'hunter_a1';
const BOB = 'hunter_b2';

/** In a real app this is a person tapping "Approve". Nothing here can approve for them. */
function holderApproves(draft, holderId) {
  console.log(`   [${holderId}] approves "${draft.id}" for ${toGold(draft.amountMinor)} Gold`);
  return approve(draft, holderId, new Date());
}

async function main() {
  console.log('=== Rails Consent Flow ===\n');

  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });

  console.log('1. Rewards are rule-bound: an earn needs a source and an idempotency key');
  await rails.earn({ identityId: ALICE, amount: 100, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:a1' });
  await rails.earn({ identityId: BOB, amount: 50, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:b2' });
  console.log(`   Alice: ${(await rails.balance(ALICE)).gold} Gold, Bob: ${(await rails.balance(BOB)).gold} Gold\n`);

  console.log('2. Draft a transfer (pure — writes nothing)');
  const draft = rails.draftTransfer({
    fromId: ALICE, toId: BOB, amount: 25,
    source: { type: 'payment', id: 'inv-1' }, idempotencyKey: 'inv-1',
  });
  console.log(`   draft ${draft.id}: ${draft.identityId} -> ${draft.toId}, ${draft.amountMinor} minor units`);
  console.log(`   Alice still holds ${(await rails.balance(ALICE)).gold} Gold; store has ${store.size} entries\n`);

  console.log('3. Execute without consent — refused');
  try {
    await rails.execute(draft, null);
  } catch (err) {
    console.log(`   ${err.code}: ${err.message}\n`);
  }

  console.log('4. The holder consents, then the transfer settles');
  const consent = holderApproves(draft, ALICE);
  const results = await rails.execute(draft, consent);
  console.log(`   ${results.length} entries landed atomically (${results.map((r) => r.entry.kind).join(', ')})`);
  console.log(`   Alice: ${(await rails.balance(ALICE)).gold} Gold, Bob: ${(await rails.balance(BOB)).gold} Gold\n`);

  console.log('5. Replay the execution (same draft, same consent)');
  const replay = await rails.execute(draft, consent);
  console.log(`   deduplicated: ${replay.every((r) => r.deduplicated)} — settled once, not twice`);
  console.log(`   Alice: ${(await rails.balance(ALICE)).gold} Gold\n`);

  console.log('6. A consent is bound to ONE draft — it cannot authorise another');
  const other = rails.draftTransfer({ fromId: ALICE, toId: BOB, amount: 25, source: { type: 'payment', id: 'inv-2' }, idempotencyKey: 'inv-2' });
  try {
    await rails.execute(other, consent);
  } catch (err) {
    console.log(`   ${err.code}: ${err.message}\n`);
  }

  console.log('7. Delegated spend: Alice grants a cafe up to 20 Gold for coffee');
  const cafe = issueGrant({
    grantId: 'g-cafe', holderId: ALICE, spenderId: 'org/demo-cafe',
    assetId: FLASHY_GOLD_ID, capMinor: toMinor(20), purpose: 'coffee',
  });
  const kiosk = attenuate(cafe, { grantId: 'g-kiosk', spenderId: 'org/demo-cafe-kiosk', capMinor: toMinor(5) });
  console.log(`   cafe cap ${toGold(cafe.capMinor)} Gold -> kiosk cap ${toGold(kiosk.capMinor)} Gold (parent ${kiosk.parentGrantId})`);

  const { grant: after } = await rails.spendUnderGrant({
    grant: kiosk, amount: 3, source: { type: 'purchase', id: 'latte-1' }, idempotencyKey: 'latte-1',
  });
  console.log(`   kiosk spent 3 Gold; remaining ${toGold(after.remainingMinor)} Gold; Alice: ${(await rails.balance(ALICE)).gold} Gold\n`);

  console.log('8. Widening is refused: a child can never hold what its parent lacks');
  try {
    attenuate(kiosk, { grantId: 'g-wide', spenderId: 'org/demo-cafe', capMinor: toMinor(50) });
  } catch (err) {
    console.log(`   ${err.code}: ${err.message}\n`);
  }

  console.log('9. Revocation is immediate');
  const revoked = revoke(after);
  try {
    await rails.spendUnderGrant({ grant: revoked, amount: 1, source: { type: 'purchase', id: 'latte-2' }, idempotencyKey: 'latte-2' });
  } catch (err) {
    console.log(`   ${err.code}: ${err.message}\n`);
  }

  console.log('10. The books reconcile: every entry hashed, chained, settling to the balance');
  const report = await rails.reconcile(ALICE);
  console.log(`   ok: ${report.ok}, entries: ${report.entries}, balance: ${toGold(report.balance)} Gold\n`);

  console.log('=== Rails Consent Flow Example Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
