/**
 * Example 3: Magician Introductions
 *
 * A trust/1 graph, an intent, a routed path, consent on every hop, and an
 * introduction/1 outcome sealed with a portable sha256.
 * Demonstrates: parseGraph, findPaths, the veil, the consent machine, the
 * opaque decline, sealOutcome/verifyIntroduction, and honest decay.
 *
 * There is no TrustGraph class and no graph.route(). A graph is a parsed
 * magician-graph/1 document; routing is findPaths(graph, intent); consent is a
 * pure state machine over an IntroductionRequest; sealing is digestOf over
 * canonical JSON, identical in Node and in a browser.
 */

import {
  parseGraph, parseIntent, parseTrustEdge, findPaths, veilPath,
  openRequest, requestState, consentHop, declineHop, markIntroduced, toRequesterView,
  sealOutcome, verifyIntroduction, appendOutcome, freshness, effectiveStrength,
} from '@magician-network/core';

// Every persona is fictional and says so: a demo graph mistakable for a real
// one is a fabricated claim about real people's relationships.
const ALICE = 'person/alice';
const BOB = 'person/bob';
const CAROL = 'person/carol';
const DAVE = 'person/dave';
const ERIN = 'person/erin';

const NOW = new Date('2026-09-28T12:00:00Z');

/** A private, rated trust/1 edge. A rated edge must name the event it stands on. */
const edge = (from, to, value, renewed = '2026-06-01') => ({
  format: 'trust/1', from, to, tier: 'private', domains: [],
  strength: { value, register: 'asserted' },
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }],
  asserted: '2026-01-15', renewed,
});

export const GRAPH_DOCUMENT = {
  format: 'magician-graph/1',
  owner: ALICE,
  people: [
    { id: ALICE, name: 'Alice (demo)', capabilities: [], demo: true },
    { id: BOB, name: 'Bob (demo)', capabilities: [], demo: true },
    { id: CAROL, name: 'Carol (demo)', capabilities: ['cap/logistics'], demo: true },
    { id: DAVE, name: 'Dave (demo)', capabilities: ['cap/robotics-manufacturing'], demo: true },
    { id: ERIN, name: 'Erin (demo)', capabilities: ['cap/biotech'], demo: true },
  ],
  edges: [
    edge(ALICE, BOB, 0.8),
    edge(BOB, CAROL, 0.7),
    edge(CAROL, DAVE, 0.9),
    edge(ALICE, ERIN, 0.6, '2024-06-01'), // deliberately stale: nobody renewed it
  ],
};

async function main() {
  console.log('=== Magician Introductions ===\n');

  console.log('1. Parse the graph (the parser refuses; it does not guess)');
  const graph = parseGraph(JSON.stringify(GRAPH_DOCUMENT));
  console.log(`   ${graph.people.length} people, ${graph.edges.length} edges, owner ${graph.owner}\n`);

  console.log('2. An intent: one sentence, and the cap/ tags that make it routable');
  const intent = parseIntent({
    id: 'robotics-jv',
    text: 'Find a robotics manufacturer for a joint venture',
    wants: ['cap/robotics-manufacturing'],
    opened: '2026-09-20',
  });
  console.log(`   "${intent.text}" wants ${intent.wants.join(', ')}\n`);

  console.log('3. Route: Alice -> Bob -> Carol -> Dave (three hops, three consents)');
  const [path] = findPaths(graph, intent, NOW);
  console.log(`   hops: ${path.hops.map((h) => h.node).join(' -> ')}`);
  console.log(`   consent of: ${path.hops.map((h) => h.consentOf).join(', ')}`);
  console.log(`   trust ${path.trust.value} (${path.trust.register}), match ${path.match.value} (${path.match.register})\n`);

  console.log('4. The veil: before consent, Alice sees her own edge and domain hints only');
  const veiled = veilPath(graph, path, new Set());
  for (const hop of veiled.hops) console.log(`   ${hop.veiled ? `[veiled: ${hop.hint}]` : hop.name}`);
  console.log('');

  console.log('5. Every request lands proposed; only the owner of an edge consents to crossing it');
  let request = openRequest('req-1', intent.id, path, NOW);
  console.log(`   state: ${requestState(request)}`);
  for (const owner of path.hops.map((h) => h.consentOf)) {
    request = consentHop(request, owner, NOW);
    console.log(`   [${owner}] consents -> ${requestState(request)}`);
  }
  request = markIntroduced(request, NOW);
  console.log(`   introduced -> ${requestState(request)}\n`);

  console.log('6. Seal the outcome (canonical JSON + sha256, portable)');
  const record = sealOutcome(request, intent, { kind: 'meeting', note: 'First call booked for October (demo).' }, NOW);
  console.log(`   digest ${record.digest.slice(0, 16)}… verifies: ${verifyIntroduction(record)}`);
  const tampered = { ...record, outcome: { ...record.outcome, kind: 'deal' } };
  console.log(`   tampered copy verifies: ${verifyIntroduction(tampered)}`);
  const log = appendOutcome([], record);
  try {
    appendOutcome(log, record);
  } catch (err) {
    console.log(`   replay refused: ${err.message.split(' — ')[0]}\n`);
  }

  console.log('7. A decline is silent: the requester reads "unavailable", never who or why');
  let declined = openRequest('req-2', intent.id, path, NOW);
  declined = consentHop(declined, ALICE, NOW);
  declined = declineHop(declined, BOB, NOW);
  console.log(`   requester view: ${JSON.stringify(toRequesterView(declined))}\n`);

  console.log('8. Decay is derived from renewed, never accepted as input');
  const stale = graph.edges.find((e) => e.to === ERIN);
  console.log(`   Alice -> Erin renewed ${stale.renewed}: ${freshness(stale, NOW)}, contributes at ${effectiveStrength(stale, NOW).register}`);
  try {
    parseTrustEdge({ ...edge(ALICE, BOB, 0.8), expires: '2030-01-01' });
  } catch (err) {
    console.log(`   ${err.message.split(':')[0]}: an 'expires' field is refused\n`);
  }

  console.log('=== Magician Introductions Example Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
