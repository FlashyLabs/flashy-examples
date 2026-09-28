/**
 * Example 1: Ledger Basics
 *
 * Append-only, multi-asset settlement with @flashylabs/ledger.
 * Demonstrates: Minor units, post() + append(), a transfer as two entries,
 * idempotent replay, the balance invariant, the hash chain, opaque identity.
 *
 * The ledger's domain is pure: post() decides what entry SHOULD exist (or
 * throws) and a LedgerStore persists it. There is no Ledger class, no
 * registerAsset() and no recordTransaction() — an asset is a record you
 * materialize from the registry, and every movement is post() then append().
 */

import {
  InMemoryLedgerStore, FLASHY_GOLD, WHEAT, materialize,
  post, postTransfer, fromDecimal, toDecimal, minor,
  verifyChain, balanceOf,
} from '@flashylabs/ledger';

// Every read and every uniqueness constraint is scoped to a tenant.
const TENANT = 'example-01';

// An asset is configuration, not code: the definition (slug, symbol, decimals,
// class) lives once in the registry; materialize() adds where this copy lives.
const gold = materialize(FLASHY_GOLD, { id: 'asset_fg', tenantId: TENANT });
const wheat = materialize(WHEAT, { id: 'asset_wht', tenantId: TENANT });

// Identities are opaque handles. post() refuses an email, a phone number or a
// wallet address — a natural key can never be taken back out of a hash chain.
const ALICE = 'hunter_a1';
const BOB = 'hunter_b2';

const AT = new Date('2026-09-28T09:00:00Z');
const ref = (identityId, asset) => ({ tenantId: TENANT, identityId, assetId: asset.id });

/** Credit a holder: read their state, decide the entry, persist it. */
async function earn(store, identityId, asset, amount, idempotencyKey) {
  const state = await store.readState(ref(identityId, asset));
  const entry = post(state, {
    tenantId: TENANT, identityId, asset, amount, kind: 'EARN',
    source: { type: 'quest', id: idempotencyKey }, idempotencyKey, occurredAt: AT,
  });
  return store.append(entry);
}

/** A transfer is two entries — the debit and the credit — that land together or not at all. */
async function transfer(store, fromId, toId, asset, amount, idempotencyKey) {
  const [fromState, toState] = await Promise.all([
    store.readState(ref(fromId, asset)),
    store.readState(ref(toId, asset)),
  ]);
  const [debit, credit] = postTransfer(
    { state: fromState, identityId: fromId },
    { state: toState, identityId: toId },
    { tenantId: TENANT, asset, amount, source: { type: 'gift' }, idempotencyKey, occurredAt: AT },
  );
  return store.appendAll([debit, credit]);
}

const show = (minorUnits, asset) => `${toDecimal(minorUnits, asset.decimals)} ${asset.symbol}`;

async function main() {
  console.log('=== Flashy Ledger Basics ===\n');

  const store = new InMemoryLedgerStore();

  console.log('1. Assets come from the registry, materialized for this tenant');
  console.log(`   ${gold.slug}: ${gold.decimals} decimals (${gold.class})`);
  console.log(`   ${wheat.slug}: ${wheat.decimals} decimals (${wheat.class})\n`);

  console.log('2. Earn: 50 Flashy Gold to Alice, 30 to Bob');
  // fromDecimal turns a person-facing decimal into Minor units — an integer.
  await earn(store, ALICE, gold, fromDecimal(50, gold.decimals), 'quest:q1:a1');
  await earn(store, BOB, gold, fromDecimal(30, gold.decimals), 'quest:q1:b2');
  console.log(`   Alice: ${show((await store.readState(ref(ALICE, gold))).balance, gold)}`);
  console.log(`   Bob:   ${show((await store.readState(ref(BOB, gold))).balance, gold)}\n`);

  console.log('3. Transfer: Alice sends 15 Gold to Bob (two entries, one appendAll)');
  const results = await transfer(store, ALICE, BOB, gold, minor(1500), 'gift:g1');
  for (const { entry } of results) console.log(`   ${entry.kind.padEnd(12)} ${entry.identityId} ${entry.amount}`);
  console.log(`   Alice: ${show((await store.readState(ref(ALICE, gold))).balance, gold)}`);
  console.log(`   Bob:   ${show((await store.readState(ref(BOB, gold))).balance, gold)}\n`);

  console.log('4. Replay the same transfer (same idempotency key)');
  const replay = await transfer(store, ALICE, BOB, gold, minor(1500), 'gift:g1');
  console.log(`   deduplicated: ${replay.every((r) => r.deduplicated)} — nothing new was written`);
  console.log(`   Alice still: ${show((await store.readState(ref(ALICE, gold))).balance, gold)}\n`);

  console.log('5. The balance invariant: Alice cannot send 100 Gold she does not hold');
  try {
    await transfer(store, ALICE, BOB, gold, minor(10000), 'gift:g2');
  } catch (err) {
    console.log(`   refused: ${err.name} ${err.code}`);
    console.log(`   store still holds ${store.size} entries — a refused post writes nothing\n`);
  }

  console.log('6. Multi-asset: 5 bushels of wheat to Alice (0 decimals, whole units)');
  await earn(store, ALICE, wheat, minor(5), 'harvest:h1:a1');
  console.log(`   Alice holds ${show((await store.readState(ref(ALICE, wheat))).balance, wheat)}`);
  console.log(`   and still ${show((await store.readState(ref(ALICE, gold))).balance, gold)} — assets do not mix\n`);

  console.log('7. History is a hash chain; the balance is a fold over it');
  const history = await store.readEntries(ref(ALICE, gold));
  const verdict = verifyChain(history);
  console.log(`   ${history.length} Gold entries for Alice, chain valid: ${verdict.valid}`);
  console.log(`   balanceOf(history) = ${balanceOf(history)} minor units\n`);

  console.log('8. Opaque identity: an email is refused before anything is hashed');
  try {
    post({ balance: minor(0), headHash: null }, {
      tenantId: TENANT, identityId: 'alice@example.com', asset: gold, amount: minor(100),
      kind: 'EARN', source: { type: 'quest' }, idempotencyKey: 'bad-identity', occurredAt: AT,
    });
  } catch (err) {
    console.log(`   refused: ${err.code}\n`);
  }

  console.log('=== Ledger Basics Example Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
