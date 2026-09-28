/**
 * Example 7: Graph Analysis
 *
 * Read a trust graph the way the router does: who is reachable, which paths
 * exist, which node every path depends on, how decay and renewal move trust,
 * and what happens when the owner stops standing behind an edge.
 * Demonstrates: findPaths/findPathsTo, rankPaths, MAX_HOPS, reversed hops,
 * freshness/effectiveStrength, upsertEdge, and the register on every number.
 *
 * There is no MagicianRouter class, no findReachable(), no revokeEdge(). The
 * graph is a document the owner holds; the router is a pure traversal over it;
 * the analyses below are folds over the Path[] it returns.
 */

import {
  parseGraph, parseIntent, parseTrustEdge, findPaths, findPathsTo, MAX_HOPS,
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

export const DOCUMENT = {
  format: 'magician-graph/1',
  owner: P('alice'),
  people: [
    person('alice'), person('bob'), person('carol', ['cap/logistics']), person('charlie'),
    person('dave', ['cap/robotics-manufacturing']), person('erin', ['cap/biotech']),
    person('frank', ['cap/family-office']), person('gina', ['cap/sovereign-fund']),
  ],
  edges: [
    edge(P('alice'), P('bob'), 0.8),
    edge(P('bob'), P('carol'), 0.7),
    edge(P('carol'), P('dave'), 0.9),
    edge(P('alice'), P('charlie'), 0.6, '2024-09-01'), // stale: nobody renewed it in two years
    edge(P('charlie'), P('dave'), 0.8),
    edge(P('dave'), P('erin'), 0.7),
    edge(P('erin'), P('frank'), 0.9),                  // four hops from Alice
    edge(P('gina'), P('alice'), 0.9),                  // Gina asserts she knows Alice — not the other way
  ],
};

/** Everyone the owner can reach within MAX_HOPS, with the fewest introductions it takes. */
function reachability(graph) {
  return graph.people
    .filter((p) => p.id !== graph.owner)
    .map((p) => ({ id: p.id, paths: findPathsTo(graph, new Set([p.id]), NOW) }))
    .map(({ id, paths }) => ({ id, reachable: paths.length > 0, hops: paths[0]?.introductions ?? null }));
}

/** Nodes every path to a target passes through — remove one and the target is gone. */
function bottlenecks(paths) {
  const [first, ...rest] = paths.map((p) => new Set(p.hops.slice(0, -1).map((h) => h.node)));
  if (!first) return [];
  return [...first].filter((n) => rest.every((s) => s.has(n)));
}

function main() {
  console.log('=== Graph Analysis ===\n');
  const graph = parseGraph(JSON.stringify(DOCUMENT));

  console.log(`1. Reachability from ${graph.owner} (MAX_HOPS = ${MAX_HOPS})`);
  for (const r of reachability(graph)) {
    console.log(`   ${r.id.padEnd(16)} ${r.reachable ? `${r.hops} hop(s)` : 'unreachable — beyond three introductions'}`);
  }
  console.log('');

  console.log('2. Every path to Dave, ranked: match, then fewest introductions, then trust');
  const toDave = findPathsTo(graph, new Set([P('dave')]), NOW);
  for (const p of toDave) {
    console.log(`   ${p.hops.map((h) => h.node.slice(7)).join(' -> ').padEnd(28)} trust ${p.trust.value} (${p.trust.register})`);
  }
  console.log('   the 2-hop path wins on hop count, yet its trust reads estimated: its first edge is stale\n');

  console.log('3. Bottlenecks: whom does every path to Erin depend on?');
  const toErin = findPathsTo(graph, new Set([P('erin')]), NOW);
  console.log(`   ${toErin.length} path(s); every one passes through: ${bottlenecks(toErin).join(', ')}\n`);

  console.log('4. Decay is derived, renewal is human');
  const stale = graph.edges.find((e) => e.to === P('charlie'));
  console.log(`   alice -> charlie renewed ${stale.renewed}: ${freshness(stale, NOW)}, contributes at ${effectiveStrength(stale, NOW).register}`);
  const renewed = upsertEdge(graph, parseTrustEdge(edge(P('alice'), P('charlie'), 0.6)), NOW);
  const fresh = renewed.edges.find((e) => e.to === P('charlie'));
  console.log(`   after Alice re-asserts it today: renewed ${fresh.renewed}, ${freshness(fresh, NOW)}, provenance kept (${fresh.provenance.length} event)`);
  const [best] = findPathsTo(renewed, new Set([P('dave')]), NOW);
  console.log(`   the 2-hop path to Dave now reads ${best.trust.value} (${best.trust.register})\n`);

  console.log('5. Trust is asymmetric: crossing an edge backwards is a guess');
  const intent = parseIntent({ id: 'sovereign', text: 'Reach a sovereign fund for a co-investment', wants: ['cap/sovereign-fund'], opened: '2026-09-20' });
  const [viaGina] = findPaths(graph, intent, NOW);
  const hop = viaGina.hops[0];
  console.log(`   gina -> alice is Gina's assertion; reached from Alice it is reversed=${hop.reversed}, ` +
    `register ${hop.strength.register}, and the consent is ${hop.consentOf}'s\n`);

  console.log('6. There is no revoke: an owner stops standing behind an edge by dropping it from their graph');
  const without = { ...graph, edges: graph.edges.filter((e) => !(e.from === P('alice') && e.to === P('charlie'))) };
  console.log(`   paths to Dave: ${toDave.length} -> ${findPathsTo(without, new Set([P('dave')]), NOW).length}`);
  console.log(`   Erin reachable: ${toErin.length > 0} -> ${findPathsTo(without, new Set([P('erin')]), NOW).length > 0} (now four hops away)\n`);

  console.log('=== Graph Analysis Complete ===\n');
}

main();
