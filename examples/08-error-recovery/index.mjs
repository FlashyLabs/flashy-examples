/**
 * Example 8: Error Recovery
 *
 * Every layer refuses with a stable code, and each code has exactly one
 * honest recovery. Demonstrates: the ledger's INSUFFICIENT_BALANCE, Rails'
 * CONSENT_* and GRANT_* refusals, Magician's opaque decline, and a retry that
 * is safe only because every write carries an idempotency key.
 *
 * The rule under all of it: a REFUSAL is a decision and is never retried —
 * the recovery is to change the request or ask a human. A TRANSIENT failure
 * (the store was unreachable) is retried, and the idempotency key is what
 * makes the retry settle once.
 */

import { InMemoryLedgerStore } from '@flashylabs/ledger';
import { RailsService, approve, issueGrant, attenuate, revoke, toMinor, FLASHY_GOLD_ID } from '@flashylabs/rails';
import {
  parseGraph, findPathsTo, openRequest, consentHop, declineHop, toRequesterView, requestState,
} from '@magician-network/core';

const ALICE = 'person/alice';
const BOB = 'person/bob';
const CHARLIE = 'person/charlie';
const DAVE = 'person/dave';
const NOW = new Date();

/** A store whose next appendAll fails the way a network does — after post(), before commit. */
class FlakyStore {
  constructor(inner, failures = 1) { this.inner = inner; this.failures = failures; }
  async append(entry) { return (await this.appendAll([entry]))[0]; }
  async appendAll(entries) {
    if (this.failures > 0) {
      this.failures -= 1;
      throw Object.assign(new Error('connection reset before commit'), { code: 'ETRANSIENT' });
    }
    return this.inner.appendAll(entries);
  }
  readState(ref) { return this.inner.readState(ref); }
  readEntries(ref) { return this.inner.readEntries(ref); }
  findByIdempotencyKey(tenantId, key) { return this.inner.findByIdempotencyKey(tenantId, key); }
  get size() { return this.inner.size; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry ONLY transient failures, with exponential backoff. A refusal is thrown straight back. */
export async function withRetry(fn, { attempts = 3, baseMs = 5, isTransient = (e) => e.code === 'ETRANSIENT' } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isTransient(err) || attempt >= attempts) throw err;
      await sleep(baseMs * 2 ** (attempt - 1));
    }
  }
}

/** What each code means for the caller. The codes are the contract; the messages are for people. */
const RECOVERY = {
  INSUFFICIENT_BALANCE: 'ledger refused: draft a smaller amount (a new draft needs a new consent)',
  CONSENT_REQUIRED: 'no consent presented: ask the holder — never construct one',
  CONSENT_MISMATCH: 'consent is for a different draft or holder: ask the holder for THIS draft',
  GRANT_REVOKED: 'the holder took the authority back: ask them for a fresh grant',
  GRANT_EXCEEDED: 'a grant is a cap: ask the holder for more — attenuate() cannot widen it',
  GRANT_EXPIRED: 'the grant lapsed: ask the holder for a fresh one',
  GRANT_WIDENED: 'a child cannot hold what its parent lacks: this is a bug in the caller, not a retry',
  ETRANSIENT: 'the store was unreachable: retry the same draft with the same consent',
};

function report(err) {
  console.log(`   ${err.name} ${err.code}${err.httpStatus ? ` (${err.httpStatus})` : ''} -> ${RECOVERY[err.code] ?? 'unknown code'}`);
}

async function main() {
  console.log('=== Error Recovery ===\n');

  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });
  await rails.earn({ identityId: ALICE, amount: 200, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' });

  console.log('1. Insufficient balance — the ledger refuses after consent, before any write');
  const tooMuch = rails.draftTransfer({ fromId: ALICE, toId: BOB, amount: 500, source: { type: 'payment', id: 'p1' }, idempotencyKey: 'p1' });
  try {
    await rails.execute(tooMuch, approve(tooMuch, ALICE, NOW));
  } catch (err) {
    report(err);
  }
  const { gold } = await rails.balance(ALICE);
  const affordable = rails.draftTransfer({ fromId: ALICE, toId: BOB, amount: Math.min(500, gold), source: { type: 'payment', id: 'p1b' }, idempotencyKey: 'p1b' });
  await rails.execute(affordable, approve(affordable, ALICE, NOW));
  console.log(`   recovered: re-drafted for ${gold} Gold, Alice consented again, settled\n`);

  console.log('2. Grant refusals — revoked, exceeded, and the one recovery that is refused');
  await rails.earn({ identityId: ALICE, amount: 100, source: { type: 'quest', id: 'q2' }, idempotencyKey: 'quest:q2:alice' });
  const grant = issueGrant({ grantId: 'g1', holderId: ALICE, spenderId: 'org/demo-shop', assetId: FLASHY_GOLD_ID, capMinor: toMinor(20), purpose: 'supplies' });
  try {
    await rails.spendUnderGrant({ grant: revoke(grant), amount: 5, source: { type: 'purchase' }, idempotencyKey: 's1' });
  } catch (err) {
    report(err);
  }
  try {
    await rails.spendUnderGrant({ grant, amount: 25, source: { type: 'purchase' }, idempotencyKey: 's2' });
  } catch (err) {
    report(err);
  }
  try {
    attenuate(grant, { grantId: 'g1-wider', spenderId: 'org/demo-shop', capMinor: toMinor(25) });
  } catch (err) {
    report(err);
  }
  const fresh = issueGrant({ grantId: 'g2', holderId: ALICE, spenderId: 'org/demo-shop', assetId: FLASHY_GOLD_ID, capMinor: toMinor(30), purpose: 'supplies' });
  await rails.spendUnderGrant({ grant: fresh, amount: 25, source: { type: 'purchase' }, idempotencyKey: 's3' });
  console.log('   recovered: the holder issued a fresh grant with a higher cap\n');

  console.log('3. Consent mismatch — the fix is the right consent, nothing else');
  const a = rails.draftTransfer({ fromId: ALICE, toId: BOB, amount: 1, source: { type: 'payment', id: 'pa' }, idempotencyKey: 'pa' });
  const b = rails.draftTransfer({ fromId: ALICE, toId: BOB, amount: 1, source: { type: 'payment', id: 'pb' }, idempotencyKey: 'pb' });
  try {
    await rails.execute(b, approve(a, ALICE, NOW));
  } catch (err) {
    report(err);
  }
  await rails.execute(b, approve(b, ALICE, NOW));
  console.log('   recovered: Alice consented to draft b itself\n');

  console.log('4. A declined hop — the requester reads "unavailable" and tries another path');
  const person = (id, capabilities = []) => ({ id, name: `${id.slice(7)} (demo)`, capabilities, demo: true });
  const edge = (from, to) => ({
    format: 'trust/1', from, to, tier: 'private', domains: [], strength: { value: 0.8, register: 'asserted' },
    provenance: [{ kind: 'worked-with', at: '2026-01-15' }], asserted: '2026-01-15', renewed: '2026-06-01',
  });
  const graph = parseGraph(JSON.stringify({
    format: 'magician-graph/1', owner: ALICE,
    people: [person(ALICE), person(BOB), person(CHARLIE), person(DAVE, ['cap/consulting'])],
    edges: [edge(ALICE, BOB), edge(BOB, DAVE), edge(ALICE, CHARLIE), edge(CHARLIE, DAVE)],
  }));
  const [first, second] = findPathsTo(graph, new Set([DAVE]), NOW);
  let req = openRequest('req-1', 'consulting', first, NOW);
  req = consentHop(req, ALICE, NOW);
  req = declineHop(req, first.hops[1].consentOf, NOW);
  console.log(`   request 1: ${JSON.stringify(toRequesterView(req))} — not who, not why`);
  let alt = openRequest('req-2', 'consulting', second, NOW);
  for (const owner of second.hops.map((h) => h.consentOf)) alt = consentHop(alt, owner, NOW);
  console.log(`   request 2 via the other path: ${requestState(alt)}\n`);

  console.log('5. A transient failure — retry the SAME draft with the SAME consent; the key makes it safe');
  const flaky = new FlakyStore(new InMemoryLedgerStore(), 1);
  const rails2 = new RailsService({ store: flaky });
  await rails2.earn({ identityId: ALICE, amount: 10, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' })
    .catch((err) => { report(err); return rails2.earn({ identityId: ALICE, amount: 10, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' }); });
  const draft = rails2.draftTransfer({ fromId: ALICE, toId: BOB, amount: 4, source: { type: 'payment', id: 'p9' }, idempotencyKey: 'p9' });
  const consent = approve(draft, ALICE, NOW);
  flaky.failures = 1;
  const results = await withRetry(async (attempt) => {
    console.log(`   attempt ${attempt}`);
    return rails2.execute(draft, consent);
  });
  console.log(`   settled on retry: ${results.every((r) => !r.deduplicated)}; a further replay dedups: ${(await rails2.execute(draft, consent)).every((r) => r.deduplicated)}`);
  console.log(`   Alice: ${(await rails2.balance(ALICE)).gold} Gold — moved once\n`);

  console.log('6. A refusal is never retried');
  let attempts = 0;
  try {
    await withRetry(() => { attempts += 1; return rails.execute(tooMuch, approve(tooMuch, ALICE, NOW)); });
  } catch (err) {
    console.log(`   ${err.code} after ${attempts} attempt — a decision, not a blip\n`);
  }

  console.log('=== Error Recovery Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
