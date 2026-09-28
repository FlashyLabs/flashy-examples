import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryLedgerStore } from '@flashylabs/ledger';
import { RailsService, approve, issueGrant, attenuate, revoke, toMinor, FLASHY_GOLD_ID, RailsError } from '@flashylabs/rails';
import {
  parseGraph, findPathsTo, openRequest, consentHop, declineHop, toRequesterView, requestState,
} from '@magician-network/core';

const ALICE = 'person/alice';
const BOB = 'person/bob';
const CHARLIE = 'person/charlie';
const DAVE = 'person/dave';
const NOW = new Date();

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

async function withRetry(fn, { attempts = 3, baseMs = 1, isTransient = (e) => e.code === 'ETRANSIENT' } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isTransient(err) || attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** (attempt - 1)));
    }
  }
}

async function funded(amount = 200, store = new InMemoryLedgerStore()) {
  const rails = new RailsService({ store });
  await rails.earn({ identityId: ALICE, amount, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' });
  return { store, rails };
}
const transfer = (rails, amount, key) => rails.draftTransfer({ fromId: ALICE, toId: BOB, amount, source: { type: 'payment', id: key }, idempotencyKey: key });

test('Recovery: insufficient balance — refused by the ledger, recovered by a smaller draft and a fresh consent', async () => {
  const { store, rails } = await funded(200);
  const tooMuch = transfer(rails, 500, 'p1');
  const size = store.size;
  await assert.rejects(
    () => rails.execute(tooMuch, approve(tooMuch, ALICE, NOW)),
    (err) => err.name === 'LedgerError' && err.code === 'INSUFFICIENT_BALANCE',
  );
  assert.equal(store.size, size);

  const { gold } = await rails.balance(ALICE);
  const affordable = transfer(rails, gold, 'p1b');
  // The consent for the failed draft does not carry over: a new draft, a new yes.
  await assert.rejects(() => rails.execute(affordable, approve(tooMuch, ALICE, NOW)), { code: 'CONSENT_MISMATCH' });
  await rails.execute(affordable, approve(affordable, ALICE, NOW));
  assert.equal((await rails.balance(BOB)).gold, 200);
});

test('Recovery: grant refusals — revoked, exceeded, expired; widening is not a recovery', async () => {
  const { rails } = await funded(200);
  const grant = issueGrant({ grantId: 'g1', holderId: ALICE, spenderId: 'org/demo-shop', assetId: FLASHY_GOLD_ID, capMinor: toMinor(20), purpose: 'supplies' });
  const spend = (g, amount, key) => rails.spendUnderGrant({ grant: g, amount, source: { type: 'purchase' }, idempotencyKey: key });

  await assert.rejects(() => spend(revoke(grant), 5, 's1'), { name: 'RailsError', code: 'GRANT_REVOKED', httpStatus: 403 });
  await assert.rejects(() => spend(grant, 25, 's2'), { code: 'GRANT_EXCEEDED' });
  assert.throws(() => attenuate(grant, { grantId: 'g1-w', spenderId: 'org/demo-shop', capMinor: toMinor(25) }), { code: 'GRANT_WIDENED' });

  const expired = issueGrant({ grantId: 'g0', holderId: ALICE, spenderId: 'org/demo-shop', assetId: FLASHY_GOLD_ID, capMinor: toMinor(20), purpose: 'supplies', expiresAt: new Date(NOW.getTime() - 1000) });
  await assert.rejects(() => spend(expired, 1, 's0'), { code: 'GRANT_EXPIRED' });

  // The only recovery: the holder issues a fresh grant.
  const fresh = issueGrant({ grantId: 'g2', holderId: ALICE, spenderId: 'org/demo-shop', assetId: FLASHY_GOLD_ID, capMinor: toMinor(30), purpose: 'supplies' });
  const { grant: after } = await spend(fresh, 25, 's3');
  assert.equal(after.remainingMinor, toMinor(5));
  assert.equal((await rails.balance(ALICE)).gold, 175);
});

test('Recovery: consent mismatch — the fix is the holder\'s consent for THIS draft', async () => {
  const { rails } = await funded(10);
  const a = transfer(rails, 1, 'pa');
  const b = transfer(rails, 1, 'pb');
  await assert.rejects(() => rails.execute(b, approve(a, ALICE, NOW)), { code: 'CONSENT_MISMATCH' });
  await assert.rejects(() => rails.execute(b, approve(b, BOB, NOW)), { code: 'CONSENT_MISMATCH' });
  await assert.rejects(() => rails.execute(b, null), { code: 'CONSENT_REQUIRED' });
  await rails.execute(b, approve(b, ALICE, NOW));
  assert.equal((await rails.balance(BOB)).gold, 1);
});

test('Recovery: a declined hop reads unavailable — the requester takes another path, never learns who', () => {
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
  const paths = findPathsTo(graph, new Set([DAVE]), NOW);
  assert.equal(paths.length, 2);

  const [first, second] = paths;
  const declined = declineHop(consentHop(openRequest('req-1', 'consulting', first, NOW), ALICE, NOW), first.hops[1].consentOf, NOW);
  assert.deepEqual(toRequesterView(declined), { id: 'req-1', state: 'unavailable' });

  // Had the decline been Alice's own hop-owner instead, the view is identical.
  const declinedEarly = declineHop(openRequest('req-1', 'consulting', first, NOW), ALICE, NOW);
  assert.deepEqual(toRequesterView(declinedEarly), toRequesterView(declined));

  let alt = openRequest('req-2', 'consulting', second, NOW);
  for (const owner of second.hops.map((h) => h.consentOf)) alt = consentHop(alt, owner, NOW);
  assert.equal(requestState(alt), 'ready');
});

test('Recovery: a transient failure is retried with the same draft and consent, and settles once', async () => {
  const flaky = new FlakyStore(new InMemoryLedgerStore(), 0);
  const { rails } = await funded(10, flaky);
  const draft = transfer(rails, 4, 'p9');
  const consent = approve(draft, ALICE, NOW);

  flaky.failures = 1;
  const sizeBefore = flaky.size;
  await assert.rejects(() => rails.execute(draft, consent), { code: 'ETRANSIENT' });
  assert.equal(flaky.size, sizeBefore, 'the failed attempt wrote nothing');

  flaky.failures = 1;
  const attempts = [];
  const results = await withRetry((n) => { attempts.push(n); return rails.execute(draft, consent); });
  assert.deepEqual(attempts, [1, 2]);
  assert.ok(results.every((r) => !r.deduplicated), 'the retry is the write that landed');

  const replay = await rails.execute(draft, consent);
  assert.ok(replay.every((r) => r.deduplicated), 'a third attempt is a no-op');
  assert.equal((await rails.balance(ALICE)).gold, 6);
  assert.equal((await rails.balance(BOB)).gold, 4);
});

test('Recovery: a refusal is a decision — it is never retried', async () => {
  const { rails } = await funded(10);
  const tooMuch = transfer(rails, 500, 'p1');
  let attempts = 0;
  await assert.rejects(
    () => withRetry(() => { attempts += 1; return rails.execute(tooMuch, approve(tooMuch, ALICE, NOW)); }),
    { code: 'INSUFFICIENT_BALANCE' },
  );
  assert.equal(attempts, 1);

  attempts = 0;
  await assert.rejects(() => withRetry(() => { attempts += 1; return rails.execute(tooMuch, null); }), { code: 'CONSENT_REQUIRED' });
  assert.equal(attempts, 1);
});

test('Recovery: every refusal carries a stable code a caller can switch on', async () => {
  const { rails } = await funded(1);
  const draft = transfer(rails, 1, 'p1');
  const err = await rails.execute(draft, null).catch((e) => e);
  assert.ok(err instanceof RailsError);
  assert.equal(err.name, 'RailsError');
  assert.equal(err.code, 'CONSENT_REQUIRED');
  assert.equal(err.httpStatus, 403);

  const ledgerErr = await rails.execute(transfer(rails, 5, 'p2'), approve(transfer(rails, 5, 'p2'), ALICE, NOW)).catch((e) => e);
  assert.equal(ledgerErr.name, 'LedgerError');
  assert.equal(ledgerErr.code, 'INSUFFICIENT_BALANCE');
  assert.equal(ledgerErr.httpStatus, undefined, 'the ledger knows nothing about HTTP; Rails maps it at the route');
});
