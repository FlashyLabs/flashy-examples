import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGraph, parseIntent, parseTrustEdge, findPaths, veilPath,
  openRequest, requestState, consentHop, declineHop, markIntroduced, toRequesterView,
  sealOutcome, verifyIntroduction, appendOutcome, digestOf, freshness, effectiveStrength,
} from '@magician-network/core';

const ALICE = 'person/alice';
const BOB = 'person/bob';
const CAROL = 'person/carol';
const DAVE = 'person/dave';
const NOW = new Date('2026-09-28T12:00:00Z');

const edge = (from, to, value, renewed = '2026-06-01') => ({
  format: 'trust/1', from, to, tier: 'private', domains: [],
  strength: { value, register: 'asserted' },
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }],
  asserted: '2026-01-15', renewed,
});

const person = (id, capabilities = []) => ({ id, name: `${id.slice(7)} (demo)`, capabilities, demo: true });

function graphOf(edges, people = [person(ALICE), person(BOB), person(CAROL), person(DAVE, ['cap/robotics-manufacturing'])]) {
  return parseGraph(JSON.stringify({ format: 'magician-graph/1', owner: ALICE, people, edges }));
}

const chain = () => graphOf([edge(ALICE, BOB, 0.8), edge(BOB, CAROL, 0.7), edge(CAROL, DAVE, 0.9)]);

const intent = parseIntent({
  id: 'robotics-jv', text: 'Find a robotics manufacturer for a joint venture',
  wants: ['cap/robotics-manufacturing'], opened: '2026-09-20',
});

function introduced(graph = chain()) {
  const [path] = findPaths(graph, intent, NOW);
  let request = openRequest('req-1', intent.id, path, NOW);
  for (const owner of path.hops.map((h) => h.consentOf)) request = consentHop(request, owner, NOW);
  return { path, request: markIntroduced(request, NOW) };
}

test('Magician: a route through the chain names every hop and whose consent it needs', () => {
  const paths = findPaths(chain(), intent, NOW);
  assert.equal(paths.length, 1);
  const [path] = paths;
  assert.equal(path.target, DAVE);
  assert.deepEqual(path.hops.map((h) => h.node), [BOB, CAROL, DAVE]);
  assert.deepEqual(path.hops.map((h) => h.consentOf), [ALICE, BOB, CAROL]);
  assert.equal(path.introductions, 3);
  assert.deepEqual(path.trust, { value: 0.7, register: 'asserted' }, 'the weakest hop, in the weakest register');
  assert.deepEqual(path.match, { value: 1, register: 'asserted' });
});

test('Magician: no chain, no introduction', () => {
  const noPath = graphOf([edge(ALICE, BOB, 0.8)]);
  assert.deepEqual(findPaths(noPath, intent, NOW), []);

  const nobodyAnswers = parseIntent({ id: 'x', text: 'Find a biotech founder to advise', wants: ['cap/biotech'], opened: '2026-09-20' });
  assert.deepEqual(findPaths(chain(), nobodyAnswers, NOW), []);
});

test('Magician: the veil hides every node past the consent frontier', () => {
  const graph = chain();
  const [path] = findPaths(graph, intent, NOW);

  const before = veilPath(graph, path, new Set());
  assert.deepEqual(before.hops.map((h) => h.veiled), [false, true, true], 'hop 1 is your own edge');
  assert.equal(before.hops[1].node, undefined);
  assert.equal(before.hops[2].hint, 'robotics-manufacturing');
  assert.equal(before.targetVeiled, true);

  const after = veilPath(graph, path, new Set([ALICE, BOB]));
  assert.deepEqual(after.hops.map((h) => h.veiled), [false, false, false]);
  assert.equal(after.hops[2].name, 'dave (demo)');
});

test('Magician: every request lands proposed and only the owner of an edge consents', () => {
  const [path] = findPaths(chain(), intent, NOW);
  let request = openRequest('req-1', intent.id, path, NOW);
  assert.equal(requestState(request), 'proposed');
  assert.ok(request.hops.every((h) => h.state === 'pending'), 'nothing constructs a consented hop directly');

  // Bob's edge is Bob's to cross. Alice cannot consent for him, nor can Dave.
  assert.throws(() => consentHop(request, DAVE, NOW), /owns no pending hop/);
  request = consentHop(request, ALICE, NOW);
  assert.throws(() => consentHop(request, ALICE, NOW), /already answered/);

  // No partial yes: two of three consents is not an introduction.
  request = consentHop(request, BOB, NOW);
  assert.equal(requestState(request), 'proposed');
  assert.throws(() => markIntroduced(request, NOW), /every hop has consented/);

  request = consentHop(request, CAROL, NOW);
  assert.equal(requestState(request), 'ready');
  assert.equal(requestState(markIntroduced(request, NOW)), 'introduced');
});

test('Magician: a declined introduction is opaque to the requester', () => {
  const [path] = findPaths(chain(), intent, NOW);

  const byBob = declineHop(consentHop(openRequest('req-1', intent.id, path, NOW), ALICE, NOW), BOB, NOW);
  const byCarol = declineHop(consentHop(consentHop(openRequest('req-1', intent.id, path, NOW), ALICE, NOW), BOB, NOW), CAROL, NOW);

  const view = toRequesterView(byBob);
  assert.deepEqual(view, { id: 'req-1', state: 'unavailable' });
  assert.deepEqual(Object.keys(view).sort(), ['id', 'state'], 'no hop, no owner, no reason leaks');
  // Which hop declined is not recoverable from what the requester is shown.
  assert.deepEqual(toRequesterView(byCarol), view);

  // A decline ends the path: no further consent revives it.
  assert.throws(() => markIntroduced(byBob, NOW));
});

test('Magician: the seal is portable and tamper-evident', () => {
  const { request } = introduced();
  const record = sealOutcome(request, intent, { kind: 'meeting', note: 'First call booked (demo).' }, NOW);

  assert.equal(record.format, 'introduction/1');
  assert.deepEqual(record.path, [BOB, CAROL, DAVE]);
  assert.deepEqual(record.consents.map((c) => c.by), [ALICE, BOB, CAROL]);
  assert.equal(verifyIntroduction(record), true);

  // Anyone can recompute the digest from the body: canonical JSON, sha256.
  const { digest, ...body } = record;
  assert.equal(digestOf(body), digest);
  assert.match(digest, /^[0-9a-f]{64}$/);

  const forged = { ...record, outcome: { ...record.outcome, kind: 'deal' } };
  assert.equal(verifyIntroduction(forged), false);
});

test('Magician: the outcome log is append-only and refuses a replayed digest', () => {
  const { request } = introduced();
  const record = sealOutcome(request, intent, { kind: 'deal', note: 'Term sheet signed (demo).' }, NOW);
  const log = appendOutcome([], record);
  assert.equal(log.length, 1);
  assert.throws(() => appendOutcome(log, record), /already in the log/);
  assert.throws(() => appendOutcome(log, { ...record, sealedAt: '2030-01-01T00:00:00.000Z' }), /does not verify/);
});

test('Magician: seal follows the event — an outcome needs an introduction that happened', () => {
  const [path] = findPaths(chain(), intent, NOW);
  const pending = openRequest('req-1', intent.id, path, NOW);
  assert.throws(() => sealOutcome(pending, intent, { kind: 'meeting', note: 'x' }, NOW), /only an introduction that happened/);

  const { request } = introduced();
  assert.throws(() => sealOutcome(request, intent, { kind: 'meeting', note: '' }, NOW), /note must say what happened/);
  assert.throws(() => sealOutcome(request, intent, { kind: 'won', note: 'x' }, NOW), /outcome.kind/);
});

test('Magician: a stale edge still routes, but contributes at estimated', () => {
  const stale = parseTrustEdge(edge(ALICE, BOB, 0.8, '2024-06-01'));
  assert.equal(freshness(stale, NOW), 'stale');
  assert.deepEqual(effectiveStrength(stale, NOW), { value: 0.8, register: 'estimated' });

  const fresh = parseTrustEdge(edge(ALICE, BOB, 0.8, '2026-06-01'));
  assert.equal(freshness(fresh, NOW), 'fresh');
  assert.deepEqual(effectiveStrength(fresh, NOW), { value: 0.8, register: 'asserted' });

  const graph = graphOf([edge(ALICE, BOB, 0.8, '2024-06-01'), edge(BOB, CAROL, 0.7), edge(CAROL, DAVE, 0.9)]);
  const [path] = findPaths(graph, intent, NOW);
  assert.equal(path.trust.register, 'estimated', 'a path built on a stale edge says so');
});

test('Magician: the parser refuses; it does not guess', () => {
  assert.throws(() => parseTrustEdge({ ...edge(ALICE, BOB, 0.8), expires: '2030-01-01' }), /'expires' is refused/);
  assert.throws(() => parseTrustEdge({ ...edge(ALICE, BOB, 0.8), strength: { value: 0.8 } }), /unlabeled number/);
  assert.throws(() => parseTrustEdge({ ...edge(ALICE, BOB, 0.8), provenance: [] }), /provenance/);
  assert.throws(() => parseTrustEdge(edge('alice', BOB, 0.8)), /has no kind/);
  assert.throws(() => parseIntent({ id: 'x', text: 'Find a robotics manufacturer', wants: [], opened: '2026-09-20' }), /invisible to routing/);

  // Tier defaults to private: absent never means public.
  const { tier, ...noTier } = edge(ALICE, BOB, 0.8);
  void tier;
  assert.equal(parseTrustEdge(noTier).tier, 'private');
});
