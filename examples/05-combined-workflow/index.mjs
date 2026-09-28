/**
 * Example 5: Combined Workflow
 *
 * Alice's assistant opens an intent, Magician routes it through Bob and Carol
 * to Dave, each hop consents, the introduction is sealed, and Alice pays Dave
 * 50 Flashy Gold through Rails' consent gate onto the ledger.
 * Demonstrates: four packages, one story, and the one boundary they share —
 * agents suggest; humans consent.
 *
 *   flashyID   the assistant acts under a chain that lets it DRAFT, never execute
 *   Magician   the path is consented hop by hop and the outcome sealed
 *   Rails      the transfer is drafted by the agent, consented by Alice
 *   Ledger     two entries land atomically, each naming the sealed introduction
 */

import { generateKeyPairSync } from 'node:crypto';
import { issueRoot, attenuate, signAssertion, authorize, agentSubject } from '@flashyid/sdk';
import {
  parseGraph, parseIntent, findPaths, openRequest, consentHop, markIntroduced,
  sealOutcome, verifyIntroduction, requestState,
} from '@magician-network/core';
import { RailsService, approve, toMinor } from '@flashylabs/rails';
import { InMemoryLedgerStore } from '@flashylabs/ledger';

// One id per person, used by every system. person/ ids pass the ledger's
// opaque-identity guard and are Magician's native grammar.
const ALICE = 'person/alice';
const BOB = 'person/bob';
const CAROL = 'person/carol';
const DAVE = 'person/dave';
const ASSISTANT = agentSubject('alice', 'assistant');

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'settlement.app.example';
const NOW = new Date();
const nowSec = Math.floor(NOW.getTime() / 1000);

const auditLog = [];
function audit(event, data) {
  auditLog.push({ event, data, at: NOW.toISOString() });
  console.log(`   [AUDIT] ${event}`);
}

const edge = (from, to, value) => ({
  format: 'trust/1', from, to, tier: 'private', domains: [],
  strength: { value, register: 'asserted' },
  provenance: [{ kind: 'worked-with', at: '2026-01-15' }],
  asserted: '2026-01-15', renewed: '2026-06-01',
});

const person = (id, capabilities = []) => ({ id, name: `${id.slice(7)} (demo)`, capabilities, demo: true });

async function main() {
  console.log('=== Combined Workflow: Settlement via Introduction ===\n');

  console.log('1. The trust network: Alice -> Bob -> Carol -> Dave (all fictional)');
  const graph = parseGraph(JSON.stringify({
    format: 'magician-graph/1', owner: ALICE,
    people: [person(ALICE), person(BOB), person(CAROL), person(DAVE, ['cap/consulting'])],
    edges: [edge(ALICE, BOB, 0.8), edge(BOB, CAROL, 0.7), edge(CAROL, DAVE, 0.9)],
  }));
  console.log('');

  console.log('2. flashyID: Alice delegates to her assistant — it may open intents and draft, never execute');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const root = issueRoot({
    rootHuman: ALICE, holder: ALICE, scp: ['intent.open', 'transfer.draft', 'transfer.execute'], res: [],
    lim: { spend_max: toMinor(100) }, iat: nowSec, exp: nowSec + 86_400, jti: 'root-alice',
  });
  const chain = attenuate(root, {
    holder: ASSISTANT, scp: ['intent.open', 'transfer.draft'],
    lim: { spend_max: toMinor(50) }, iat: nowSec, exp: nowSec + 3_600, jti: 'assistant-1',
  });
  const jws = await signAssertion({ privateKey, issuer: ISSUER, audience: AUDIENCE, subject: ASSISTANT, delegation: chain });
  const rp = { issuer: ISSUER, audience: AUDIENCE, getKey: publicKey, nowSec };
  const opened = await authorize(jws, { scope: 'intent.open' }, rp);
  audit('assistant:authorized', { subject: opened.assertion.sub, scope: 'intent.open' });
  console.log('');

  console.log('3. Magician: the assistant opens the intent and the router finds the path');
  const intent = parseIntent({ id: 'consulting-engagement', text: 'Find a consultant for our robotics JV due diligence', wants: ['cap/consulting'], opened: NOW.toISOString() });
  const [path] = findPaths(graph, intent, NOW);
  if (!path) {
    audit('introduction:no-path', {});
    console.log('   no trust path — nothing to draft\n');
    return;
  }
  audit('introduction:path-found', { hops: path.hops.map((h) => h.node) });
  console.log(`   ${path.hops.map((h) => h.node).join(' -> ')} (trust ${path.trust.value}, ${path.trust.register})\n`);

  console.log('4. Consent on every hop — by the owner of each edge, never by the agent');
  let request = openRequest('req-1', intent.id, path, NOW);
  for (const owner of path.hops.map((h) => h.consentOf)) {
    request = consentHop(request, owner, NOW);
    console.log(`   [${owner}] consents`);
  }
  request = markIntroduced(request, NOW);
  audit('introduction:made', { state: requestState(request) });
  console.log('');

  console.log('5. Seal the outcome — the record every later step points at');
  const record = sealOutcome(request, intent, { kind: 'deal', note: 'Dave engaged for the due diligence (demo).' }, NOW);
  audit('introduction:sealed', { digest: record.digest });
  console.log(`   digest ${record.digest.slice(0, 16)}… verifies: ${verifyIntroduction(record)}\n`);

  console.log('6. Rails: the assistant drafts the payment — within its mandate');
  const rails = new RailsService({ store: new InMemoryLedgerStore() });
  await rails.earn({ identityId: ALICE, amount: 100, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:alice' });
  await rails.earn({ identityId: DAVE, amount: 10, source: { type: 'quest', id: 'q1' }, idempotencyKey: 'quest:q1:dave' });

  const mayDraft = await authorize(jws, { scope: 'transfer.draft', amount: toMinor(50) }, rp);
  console.log(`   authorize(transfer.draft, ${toMinor(50)} minor): ${mayDraft.result.ok ? 'ALLOWED' : mayDraft.result.code}`);
  const draft = rails.draftTransfer({
    fromId: ALICE, toId: DAVE, amount: 50,
    source: { type: 'settlement', id: record.digest.slice(0, 12) },
    idempotencyKey: `intro:${record.digest.slice(0, 16)}`,
    metadata: { introduction: record.digest },
  });
  audit('transfer:drafted', { draft: draft.id });
  console.log('');

  console.log('7. The assistant cannot execute — and Rails would refuse it anyway');
  const mayExecute = await authorize(jws, { scope: 'transfer.execute', amount: toMinor(50) }, rp);
  console.log(`   authorize(transfer.execute): ${mayExecute.result.code}`);
  try {
    await rails.execute(draft, null);
  } catch (err) {
    console.log(`   rails.execute without consent: ${err.code}\n`);
  }

  console.log('8. Alice consents; the settlement lands as two chained entries');
  const results = await rails.execute(draft, approve(draft, ALICE, NOW));
  audit('settlement:executed', { entries: results.map((r) => r.entry.id) });
  console.log(`   ${results.map((r) => `${r.entry.kind} ${r.entry.identityId}`).join(', ')}`);
  console.log(`   each entry names the introduction: ${results.every((r) => r.entry.metadata.introduction === record.digest)}\n`);

  console.log('9. Verify: balances, the sealed chain, the sealed introduction');
  console.log(`   Alice ${(await rails.balance(ALICE)).gold} Gold, Dave ${(await rails.balance(DAVE)).gold} Gold`);
  const reconciled = await rails.reconcile(ALICE);
  console.log(`   Alice's books reconcile: ${reconciled.ok} (sealHead ${reconciled.sealHead.slice(0, 14)}…)`);
  console.log(`   introduction verifies: ${verifyIntroduction(record)}\n`);

  console.log('10. Audit trail');
  auditLog.forEach((e, i) => console.log(`   [${i + 1}] ${e.event}`));
  console.log('\n=== Combined Workflow Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
