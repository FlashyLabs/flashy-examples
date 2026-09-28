import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGraph, parseIntent, parseTrustEdge, findPaths, findPathsTo, rankPaths, MAX_HOPS,
  freshness, effectiveStrength, upsertEdge,
} from '@magician-network/core';

const NOW = new Date('2026-09-28T12:00:00Z');
const P = (slug) => `person/${slug}`;

const edge = (from, to, value, renewed = '2026-06-01') => ({
  format: 'trust/1', from, to, tier: 'private', domains: [],
  strength: { value, register: 'asserted' },
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }], asserted: '2026-01-15', renewed,
});
const person = (slug, capabilities = []) => ({ id: P(slug), name: `${slug} (demo)`, capabilities, demo: true });

const PEOPLE = [
  person('alice'), person('bob'), person('carol', ['cap/logistics']), person('charlie'),
  person('dave', ['cap/robotics-manufacturing']), person('erin', ['cap/biotech']),
  person('frank', ['cap/family-office']), person('gina', ['cap/sovereign-fund']),
];
const EDGES = [
  edge(P('alice'), P('bob'), 0.8), edge(P('bob'), P('carol'), 0.7), edge(P('carol'), P('dave'), 0.9),
  edge(P('alice'), P('charlie'), 0.6, '2024-09-01'), edge(P('charlie'), P('dave'), 0.8),
  edge(P('dave'), P('erin'), 0.7), edge(P('erin'), P('frank'), 0.9), edge(P('gina'), P('alice'), 0.9),
];

const graphOf = (edges = EDGES, people = PEOPLE) => parseGraph(JSON.stringify({ format: 'magician-graph/1', owner: P('alice'), people, edges }));
const pathsTo = (graph, slug) => findPathsTo(graph, new Set([P(slug)]), NOW);
const nodes = (path) => path.hops.map((h) => h.node.slice(7));

test('Graph: reachability is a question the router answers, bounded by MAX_HOPS', () => {
  const graph = graphOf();
  assert.equal(MAX_HOPS, 3);
  for (const slug of ['bob', 'carol', 'charlie', 'dave', 'erin', 'gina']) {
    assert.ok(pathsTo(graph, slug).length > 0, `${slug} reachable`);
  }
  assert.deepEqual(pathsTo(graph, 'frank'), [], 'frank is four introductions away');
  assert.deepEqual(pathsTo(graph, 'nobody'), [], 'an id not in the graph routes nothing');
});

test('Graph: paths are ranked by match, then fewest introductions, then trust', () => {
  const graph = graphOf();
  const toDave = pathsTo(graph, 'dave');
  assert.equal(toDave.length, 2);
  assert.deepEqual(nodes(toDave[0]), ['charlie', 'dave']);
  assert.deepEqual(nodes(toDave[1]), ['bob', 'carol', 'dave']);
  assert.deepEqual(toDave.map((p) => p.introductions), [2, 3]);
  // The ranking is a pure function the caller can re-run on any Path[].
  assert.deepEqual(rankPaths([...toDave].reverse()), toDave);
  // Every hop names whose consent it needs: the owner of the edge crossed.
  assert.deepEqual(toDave[1].hops.map((h) => h.consentOf), [P('alice'), P('bob'), P('carol')]);
});

test('Graph: a bottleneck is a node every path to a target crosses', () => {
  const graph = graphOf();
  const toErin = pathsTo(graph, 'erin');
  assert.equal(toErin.length, 1, 'only the 2-hop route to Dave leaves room for a third hop');
  assert.deepEqual(nodes(toErin[0]), ['charlie', 'dave', 'erin']);

  const intersection = toErin
    .map((p) => new Set(p.hops.slice(0, -1).map((h) => h.node)))
    .reduce((acc, s) => new Set([...acc].filter((n) => s.has(n))));
  assert.ok(intersection.has(P('dave')));
  assert.ok(intersection.has(P('charlie')));
});

test('Graph: a stale edge routes at estimated, and a path built on it says so', () => {
  const graph = graphOf();
  const stale = graph.edges.find((e) => e.to === P('charlie'));
  assert.equal(freshness(stale, NOW), 'stale');
  assert.deepEqual(effectiveStrength(stale, NOW), { value: 0.6, register: 'estimated' });

  const [viaCharlie, viaBob] = pathsTo(graph, 'dave');
  assert.equal(viaCharlie.trust.register, 'estimated');
  assert.equal(viaBob.trust.register, 'asserted');
  assert.ok(viaCharlie.introductions < viaBob.introductions, 'hop count still ranks it first');
});

test('Graph: renewal is a human re-asserting the edge — provenance is kept, the clock restarts', () => {
  const graph = graphOf();
  const renewed = upsertEdge(graph, parseTrustEdge(edge(P('alice'), P('charlie'), 0.6)), NOW);
  const fresh = renewed.edges.find((e) => e.to === P('charlie'));
  assert.equal(fresh.renewed, '2026-09-28');
  assert.equal(fresh.asserted, '2026-01-15', 'first assertion is history, not an input');
  assert.equal(freshness(fresh, NOW), 'fresh');
  assert.equal(renewed.edges.length, graph.edges.length, 'a union, never a duplicate');
  assert.equal(pathsTo(renewed, 'dave')[0].trust.register, 'asserted');
});

test('Graph: crossing an edge backwards is a guess — reversed hops downgrade to estimated', () => {
  const graph = graphOf();
  const intent = parseIntent({ id: 'sovereign', text: 'Reach a sovereign fund for a co-investment', wants: ['cap/sovereign-fund'], opened: '2026-09-20' });
  const [path] = findPaths(graph, intent, NOW);
  assert.equal(path.hops[0].node, P('gina'));
  assert.equal(path.hops[0].reversed, true);
  assert.equal(path.hops[0].strength.register, 'estimated');
  assert.equal(path.hops[0].consentOf, P('gina'), 'the person reached owns the edge, so the consent is theirs');
});

test('Graph: an unrated hop makes the whole path\'s trust unknown, never a number', () => {
  const unrated = { ...edge(P('alice'), P('bob'), 0), strength: { register: 'unrated' }, provenance: [] };
  const graph = graphOf([unrated, edge(P('bob'), P('carol'), 0.7), edge(P('carol'), P('dave'), 0.9)]);
  const [path] = pathsTo(graph, 'dave');
  assert.deepEqual(path.trust, { value: null, register: 'unrated' });
});

test('Graph: there is no revoke — the owner drops the edge, and reachability follows', () => {
  const graph = graphOf();
  const without = { ...graph, edges: graph.edges.filter((e) => !(e.from === P('alice') && e.to === P('charlie'))) };
  assert.equal(pathsTo(without, 'dave').length, 1);
  assert.deepEqual(nodes(pathsTo(without, 'dave')[0]), ['bob', 'carol', 'dave']);
  assert.deepEqual(pathsTo(without, 'erin'), [], 'four hops away now');
  assert.equal(pathsTo(graph, 'erin').length, 1, 'the original graph is untouched — documents are values');
});
