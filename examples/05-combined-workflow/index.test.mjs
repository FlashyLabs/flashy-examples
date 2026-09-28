import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { issueRoot, attenuate, signAssertion, authorize, agentSubject } from '@flashyid/sdk';
import {
  parseGraph, parseIntent, findPaths, openRequest, consentHop, markIntroduced,
  sealOutcome, verifyIntroduction,
} from '@magician-network/core';
import { RailsService, approve, toMinor } from '@flashylabs/rails';
import { InMemoryLedgerStore } from '@flashylabs/ledger';

const ALICE = 'person/alice';
const BOB = 'person/bob';
const CAROL = 'person/carol';
const DAVE = 'person/dave';
const ASSISTANT = agentSubject('alice', 'assistant');
const ISSUER = 'https://issuer.example';
const AUDIENCE = 'settlement.app.example';
const NOW = new Date();
const nowSec = Math.floor(NOW.getTime() / 1000);

const edge = (from, to, value) => ({
  format: 'trust/1', from, to, tier: 'private', domains: [],
  strength: { value, register: 'asserted' },
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }], asserted: '2026-01-15', renewed: '2026-06-01',
});
const person = (id, capabilities = []) => ({ id, name: `${id.slice(7)} (demo)`, capabilities, demo: true });

const network = (edges = [edge(ALICE, BOB, 0.8), edge(BOB, CAROL, 0.7), edge(CAROL, DAVE, 0.9)]) =>
  parseGraph(JSON.stringify({
    format: 'magician-graph/1', owner: ALICE,
    people: [person(ALICE), person(BOB), person(CAROL), person(DAVE, ['cap/consulting'])], edges,
  }));

const intent = parseIntent({ id: 'consulting-engagement', text: 'Find a consultant for our robotics JV due diligence', wants: ['cap/consulting'], opened: '2026-09-20' });

function introduce(graph) {
  const [path] = findPaths(graph, intent, NOW);
  if (!path) return null;
  let request = openRequest('req-1', intent.id, path, NOW);
  for (const owner of path.hops.map((h) => h.consentOf)) request = consentHop(request, owner, NOW);
  request = markIntroduced(request, NOW);
  return sealOutcome(request, intent, { kind: 'deal', note: 'Dave engaged (demo).' }, NOW);
}

async function railsWith(alice = 100, dave = 10) {
  const store = new InMemoryLedgerStore();
  const rails = new RailsService({ store });
  if (alice) await rails.earn({ identityId: ALICE, amount: alice, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' });
  if (dave) await rails.earn({ identityId: DAVE, amount: dave, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:dave' });
  return { store, rails };
}

const paymentDraft = (rails, record, amount = 50) => rails.draftTransfer({
  fromId: ALICE, toId: DAVE, amount,
  source: { type: 'settlement', id: record.digest.slice(0, 12) },
  idempotencyKey: `intro:${record.digest.slice(0, 16)}`,
  metadata: { introduction: record.digest },
});

async function assistant() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const root = issueRoot({
    rootHuman: ALICE, holder: ALICE, scp: ['intent.open', 'transfer.draft', 'transfer.execute'], res: [],
    lim: { spend_max: toMinor(100) }, iat: nowSec, exp: nowSec + 86_400, jti: 'root-alice',
  });
  const chain = attenuate(root, {
    holder: ASSISTANT, scp: ['intent.open', 'transfer.draft'], lim: { spend_max: toMinor(50) },
    iat: nowSec, exp: nowSec + 3_600, jti: 'assistant-1',
  });
  const jws = await signAssertion({ privateKey, issuer: ISSUER, audience: AUDIENCE, subject: ASSISTANT, delegation: chain });
  const rp = { issuer: ISSUER, audience: AUDIENCE, getKey: publicKey, nowSec };
  return { jws, rp };
}

test('Combined: happy path across all four systems', async () => {
  const { jws, rp } = await assistant();
  const record = introduce(network());
  assert.equal(verifyIntroduction(record), true);
  assert.deepEqual(record.path, [BOB, CAROL, DAVE]);

  const { rails } = await railsWith();
  const mandate = await authorize(jws, { scope: 'transfer.draft', amount: toMinor(50) }, rp);
  assert.equal(mandate.result.ok, true);

  const draft = paymentDraft(rails, record);
  const results = await rails.execute(draft, approve(draft, ALICE, NOW));

  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.entry.metadata.introduction === record.digest), 'settlement points at the sealed introduction');
  assert.equal((await rails.balance(ALICE)).gold, 50);
  assert.equal((await rails.balance(DAVE)).gold, 60);
  assert.equal((await rails.reconcile(ALICE)).ok, true);
  assert.equal((await rails.reconcile(DAVE)).ok, true);
});

test('Combined: no trust path, no introduction, nothing to settle', async () => {
  const graph = network([edge(ALICE, BOB, 0.8)]);
  assert.deepEqual(findPaths(graph, intent, NOW), []);
  assert.equal(introduce(graph), null);
});

test('Combined: an introduction requires every hop\'s consent — and the seal follows the event', () => {
  const [path] = findPaths(network(), intent, NOW);
  let request = openRequest('req-1', intent.id, path, NOW);
  request = consentHop(request, ALICE, NOW);
  request = consentHop(request, BOB, NOW);
  assert.throws(() => markIntroduced(request, NOW), /every hop has consented/);
  assert.throws(() => sealOutcome(request, intent, { kind: 'deal', note: 'x' }, NOW), /only an introduction that happened/);
});

test('Combined: the assistant may draft but never execute', async () => {
  const { jws, rp } = await assistant();
  assert.equal((await authorize(jws, { scope: 'intent.open' }, rp)).result.ok, true);
  assert.equal((await authorize(jws, { scope: 'transfer.draft', amount: toMinor(50) }, rp)).result.ok, true);
  assert.equal((await authorize(jws, { scope: 'transfer.draft', amount: toMinor(51) }, rp)).result.code, 'out_of_mandate');
  assert.equal((await authorize(jws, { scope: 'transfer.execute', amount: toMinor(1) }, rp)).result.code, 'out_of_mandate');
});

test('Combined: settlement needs the HOLDER\'s consent — not the agent\'s, not the recipient\'s', async () => {
  const record = introduce(network());
  const { store, rails } = await railsWith();
  const draft = paymentDraft(rails, record);
  const size = store.size;

  await assert.rejects(() => rails.execute(draft, null), { code: 'CONSENT_REQUIRED' });
  await assert.rejects(() => rails.execute(draft, approve(draft, DAVE, NOW)), { code: 'CONSENT_MISMATCH' });
  await assert.rejects(() => rails.execute(draft, approve(draft, ASSISTANT, NOW)), { code: 'CONSENT_MISMATCH' });
  assert.equal(store.size, size, 'nothing moved');
  assert.equal((await rails.balance(ALICE)).gold, 100);
});

test('Combined: insufficient balance is refused by the ledger, after consent, before any write', async () => {
  const record = introduce(network());
  const { store, rails } = await railsWith(10, 0);
  const draft = paymentDraft(rails, record);
  const size = store.size;
  await assert.rejects(
    () => rails.execute(draft, approve(draft, ALICE, NOW)),
    (err) => err.name === 'LedgerError' && err.code === 'INSUFFICIENT_BALANCE',
  );
  assert.equal(store.size, size);
});

test('Combined: a retried settlement settles once', async () => {
  const record = introduce(network());
  const { rails } = await railsWith();
  const draft = paymentDraft(rails, record);
  const consent = approve(draft, ALICE, NOW);
  await rails.execute(draft, consent);
  const replay = await rails.execute(draft, consent);
  assert.ok(replay.every((r) => r.deduplicated));
  assert.equal((await rails.balance(DAVE)).gold, 60);
});
