import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryLedgerStore } from '@flashylabs/ledger';
import {
  RailsService, approve, issueGrant, attenuate, revoke,
  toMinor, toGold, FLASHY_GOLD_ID,
} from '@flashylabs/rails';

const ALICE = 'hunter_a1';
const BOB = 'hunter_b2';
const NOW = new Date('2026-09-28T12:00:00Z');

async function setup({ alice = 100, bob = 10, clock } = {}) {
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store, ...(clock ? { clock } : {}) });
  if (alice) await rails.earn({ identityId: ALICE, amount: alice, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:a1' });
  if (bob) await rails.earn({ identityId: BOB, amount: bob, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:b2' });
  return { store, rails };
}

const draftOf = (rails, amount = 25, key = 'inv-1') =>
  rails.draftTransfer({ fromId: ALICE, toId: BOB, amount, source: { type: 'payment', id: key }, idempotencyKey: key });

const grantOf = (capGold = 20, extra = {}) => issueGrant({
  grantId: 'g-1', holderId: ALICE, spenderId: 'org/demo-cafe',
  assetId: FLASHY_GOLD_ID, capMinor: toMinor(capGold), purpose: 'coffee', ...extra,
});

test('Rails: toMinor takes a decimal NUMBER and returns integer minor units', () => {
  assert.equal(toMinor(25), 2500);
  assert.equal(toGold(2500), 25);
  assert.equal(typeof toMinor(25), 'number');
  assert.throws(() => toMinor(0.005), { name: 'PrecisionError' });
});

test('Rails: a draft writes nothing', async () => {
  const { store, rails } = await setup();
  const before = store.size;
  const draft = draftOf(rails);
  assert.equal(draft.action, 'transfer');
  assert.equal(draft.amountMinor, 2500);
  assert.equal(store.size, before);
  assert.equal((await rails.balance(ALICE)).gold, 100);
});

test('Rails: amounts are numbers — a string amount is refused at the edge', async () => {
  const { rails } = await setup();
  assert.throws(() => draftOf(rails, '25'), { name: 'RailsError', code: 'INVALID_AMOUNT' });
  assert.throws(() => draftOf(rails, 0), { code: 'INVALID_AMOUNT' });
  assert.throws(() => draftOf(rails, -5), { code: 'INVALID_AMOUNT' });
});

test('Rails: execution requires consent', async () => {
  const { store, rails } = await setup();
  const draft = draftOf(rails);
  const before = store.size;
  await assert.rejects(() => rails.execute(draft, null), { name: 'RailsError', code: 'CONSENT_REQUIRED' });
  await assert.rejects(() => rails.execute(draft, undefined), { code: 'CONSENT_REQUIRED' });
  assert.equal(store.size, before, 'nothing written');
});

test('Rails: a consent is bound to one draft and one holder', async () => {
  const { rails } = await setup();
  const draft = draftOf(rails, 25, 'inv-1');
  const other = draftOf(rails, 25, 'inv-2');

  const consent = approve(draft, ALICE, NOW);
  await assert.rejects(() => rails.execute(other, consent), { code: 'CONSENT_MISMATCH' });

  const bobsConsent = approve(draft, BOB, NOW);
  await assert.rejects(() => rails.execute(draft, bobsConsent), { code: 'CONSENT_MISMATCH' });

  assert.equal((await rails.balance(ALICE)).gold, 100, 'nothing moved');
});

test('Rails: execute with the holder\'s consent settles both sides', async () => {
  const { rails } = await setup();
  const draft = draftOf(rails);
  const results = await rails.execute(draft, approve(draft, ALICE, NOW));

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.entry.kind), ['TRANSFER_OUT', 'TRANSFER_IN']);
  assert.equal(results[0].entry.metadata.consentedAt, NOW.toISOString());
  assert.equal((await rails.balance(ALICE)).gold, 75);
  assert.equal((await rails.balance(BOB)).gold, 35);
});

test('Rails: execution is idempotent by the draft\'s key', async () => {
  const { store, rails } = await setup();
  const draft = draftOf(rails);
  const consent = approve(draft, ALICE, NOW);

  await rails.execute(draft, consent);
  const size = store.size;
  const replay = await rails.execute(draft, consent);

  assert.ok(replay.every((r) => r.deduplicated));
  assert.equal(store.size, size);
  assert.equal((await rails.balance(ALICE)).gold, 75);
  assert.equal((await rails.balance(BOB)).gold, 35);
});

test('Rails: insufficient balance is the ledger\'s refusal, passed through unwrapped', async () => {
  const { rails } = await setup({ alice: 10 });
  const draft = draftOf(rails, 25);
  await assert.rejects(
    () => rails.execute(draft, approve(draft, ALICE, NOW)),
    (err) => err.name === 'LedgerError' && err.code === 'INSUFFICIENT_BALANCE',
  );
  assert.equal((await rails.balance(ALICE)).gold, 10);
});

test('Rails: attenuate narrows a grant, never widens it', () => {
  const parent = grantOf(20, { expiresAt: new Date('2026-12-31T00:00:00Z') });
  const child = attenuate(parent, { grantId: 'g-2', spenderId: 'org/demo-kiosk', capMinor: toMinor(5) });

  assert.equal(child.capMinor, 500);
  assert.equal(child.remainingMinor, 500);
  assert.equal(child.parentGrantId, 'g-1');
  assert.equal(child.holderId, ALICE);
  assert.equal(child.purpose, 'coffee');
  assert.deepEqual(child.expiresAt, parent.expiresAt, 'inherits the parent\'s expiry');

  const widen = (narrow) => assert.throws(
    () => attenuate(parent, { grantId: 'g-x', spenderId: 'org/demo-kiosk', ...narrow }),
    { name: 'RailsError', code: 'GRANT_WIDENED' },
  );
  widen({ capMinor: toMinor(50) });                                   // larger cap
  widen({ capMinor: toMinor(5), expiresAt: new Date('2027-06-01T00:00:00Z') }); // outlives parent
  widen({ capMinor: toMinor(5), purpose: 'anything' });              // different purpose

  // There is no way to DROP a parent's expiry: `expiresAt: null` reads as
  // "inherit", the same as leaving it out, so the child still expires with it.
  const inherits = attenuate(parent, { grantId: 'g-3', spenderId: 'org/demo-kiosk', capMinor: toMinor(5), expiresAt: null });
  assert.deepEqual(inherits.expiresAt, parent.expiresAt);
});

test('Rails: a revoked grant refuses everything, immediately', async () => {
  const { store, rails } = await setup();
  const revoked = revoke(grantOf());
  const before = store.size;

  await assert.rejects(
    () => rails.spendUnderGrant({ grant: revoked, amount: 1, source: { type: 'purchase' }, idempotencyKey: 'p-1' }),
    { code: 'GRANT_REVOKED' },
  );
  assert.throws(() => attenuate(revoked, { grantId: 'g-2', spenderId: 'org/x', capMinor: toMinor(1) }), { code: 'GRANT_REVOKED' });
  assert.equal(store.size, before);
});

test('Rails: an expired grant is refused at spend time', async () => {
  const { rails } = await setup({ clock: () => new Date('2027-01-01T00:00:00Z') });
  const grant = grantOf(20, { expiresAt: new Date('2026-12-31T00:00:00Z') });
  await assert.rejects(
    () => rails.spendUnderGrant({ grant, amount: 1, source: { type: 'purchase' }, idempotencyKey: 'p-1' }),
    { code: 'GRANT_EXPIRED' },
  );
});

test('Rails: a grant is a cap — spends draw it down, a replay does not draw twice', async () => {
  const { rails } = await setup();
  const grant = grantOf(20);

  const first = await rails.spendUnderGrant({ grant, amount: 15, source: { type: 'purchase' }, idempotencyKey: 'p-1' });
  assert.equal(first.grant.remainingMinor, 500);
  assert.equal((await rails.balance(ALICE)).gold, 85);

  // A retrying caller never received the drawn-down grant; it replays with the
  // one it holds. The ledger dedups the key, and the grant is handed back
  // UNCHANGED rather than debited a second time.
  const replay = await rails.spendUnderGrant({ grant, amount: 15, source: { type: 'purchase' }, idempotencyKey: 'p-1' });
  assert.equal(replay.result.deduplicated, true);
  assert.equal(replay.grant, grant, 'a dedup replay does not draw the grant down again');
  assert.equal((await rails.balance(ALICE)).gold, 85);

  // The cap is checked before any write — and before the dedup lookup — so a
  // spend past what remains is refused even if its key was seen before.
  await assert.rejects(
    () => rails.spendUnderGrant({ grant: first.grant, amount: 6, source: { type: 'purchase' }, idempotencyKey: 'p-2' }),
    { code: 'GRANT_EXCEEDED' },
  );
  await assert.rejects(
    () => rails.spendUnderGrant({ grant: first.grant, amount: 15, source: { type: 'purchase' }, idempotencyKey: 'p-1' }),
    { code: 'GRANT_EXCEEDED' },
  );
  assert.equal((await rails.balance(ALICE)).gold, 85);
});

test('Rails: the books reconcile after the flow', async () => {
  const { rails } = await setup();
  const draft = draftOf(rails);
  await rails.execute(draft, approve(draft, ALICE, NOW));
  const report = await rails.reconcile(ALICE);
  assert.equal(report.ok, true);
  assert.equal(report.entries, 2);
  assert.equal(report.balance, toMinor(75));
  assert.match(report.sealHead, /^0x[0-9a-f]{64}$/);
});
