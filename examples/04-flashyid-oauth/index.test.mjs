import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  issueRoot, attenuate, verifyChain, permits,
  signAssertion, verifyAssertion, authorize, evaluateGrant, agentSubject,
} from '@flashyid/sdk';

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'payments.app.example';
const ACCOUNTABLE = 'alice@example.com';
const ORG = 'org/demo-acme';
const AGENT = agentSubject('demo-acme', 'payments');
const DAY = 86_400;
const nowSec = Math.floor(Date.now() / 1000);

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const verifyOpts = { issuer: ISSUER, audience: AUDIENCE, getKey: publicKey };

const rootChain = () => issueRoot({
  rootHuman: ACCOUNTABLE, holder: ORG,
  scp: ['payment.draft', 'payment.execute', 'report.read'], res: ['ledger:demo-acme'],
  lim: { approval_at_or_above: 'HIGH', spend_max: 100_000 },
  iat: nowSec, exp: nowSec + 365 * DAY, jti: 'root-1',
});

const agentChain = () => attenuate(rootChain(), {
  holder: AGENT, scp: ['payment.draft', 'report.read'],
  lim: { approval_at_or_above: 'HIGH', spend_max: 5_000 },
  iat: nowSec, exp: nowSec + DAY, jti: 'agent-1',
});

const sign = (subject, delegation) => signAssertion({ privateKey, issuer: ISSUER, audience: AUDIENCE, subject, delegation });

test('FlashyID: what the issuer signs, the relying party verifies — holding only the public key', async () => {
  const chain = agentChain();
  const jws = await sign(AGENT, chain);
  const assertion = await verifyAssertion(jws, verifyOpts);
  assert.equal(assertion.sub, AGENT);
  assert.deepEqual(assertion.del, chain);
  assert.equal(assertion.claims.iss, ISSUER);
  assert.equal(assertion.claims.aud, AUDIENCE);
});

test('FlashyID: verification never throws — a bad token is null (a 401)', async () => {
  const jws = await sign(AGENT, agentChain());
  assert.equal(await verifyAssertion(jws, { ...verifyOpts, audience: 'other.app.example' }), null);
  assert.equal(await verifyAssertion(jws, { ...verifyOpts, issuer: 'https://someone-else.example' }), null);

  const other = generateKeyPairSync('ed25519');
  assert.equal(await verifyAssertion(jws, { ...verifyOpts, getKey: other.publicKey }), null, 'a different key');

  const [h, p, s] = jws.split('.');
  const flipped = p[0] === 'A' ? `B${p.slice(1)}` : `A${p.slice(1)}`;
  assert.equal(await verifyAssertion(`${h}.${flipped}.${s}`, verifyOpts), null, 'a tampered payload');
  assert.equal(await verifyAssertion(undefined, verifyOpts), null);
});

test('FlashyID: attenuate narrows only, and refuses by RETURNING a refusal', () => {
  const chain = agentChain();
  assert.equal(chain.length, 2);
  assert.equal(chain[1].iss, ORG, 'the parent\'s holder is the child\'s issuer');
  assert.equal(chain[1].sub, AGENT);

  const child = { holder: 'agent:demo-acme/rogue', iat: nowSec, exp: nowSec + DAY, jti: 'rogue-1' };
  const refused = (input) => {
    const out = attenuate(chain, { ...child, ...input });
    assert.equal(out.ok, false);
    assert.equal(out.code, 'chain_widened');
    assert.equal(out.at, 2);
    return out.detail;
  };
  assert.equal(refused({ scp: ['payment.execute'] }), 'scope widened');
  assert.equal(refused({ res: ['ledger:everyone'] }), 'resource widened');
  assert.equal(refused({ lim: { approval_at_or_above: 'HIGH', spend_max: 6_000 } }), 'limit loosened');
  assert.equal(refused({ lim: { spend_max: 1_000 } }), 'limit loosened', 'dropping a required approval bar is a widening');
  assert.equal(refused({ lim: { approval_at_or_above: 'CRITICAL', spend_max: 1_000 } }), 'limit loosened', 'raising the bar is a widening');
});

test('FlashyID: a child never outlives its parent — expiry is capped, not refused', () => {
  const chain = agentChain();
  const longer = attenuate(chain, { holder: 'agent:demo-acme/reporter', scp: ['report.read'], iat: nowSec, exp: nowSec + 30 * DAY, jti: 'rep-1' });
  assert.equal(longer[2].exp, chain[1].exp);

  const effective = verifyChain(longer, nowSec);
  assert.equal(effective.ok, true);
  assert.equal(effective.exp, chain[1].exp, 'effective expiry is the minimum across the chain');
  assert.deepEqual(effective.chain, ['root-1', 'agent-1', 'rep-1']);
});

test('FlashyID: authorize() answers with the effective grant, or a specific refusal', async () => {
  const jws = await sign(AGENT, agentChain());
  const opts = { ...verifyOpts, nowSec };

  const ok = await authorize(jws, { scope: 'payment.draft', amount: 1_240 }, opts);
  assert.equal(ok.result.ok, true);
  assert.equal(ok.result.holder, AGENT);
  assert.equal(ok.result.root, ACCOUNTABLE);
  assert.equal(ok.result.lim.spend_max, 5_000);

  const code = async (demand) => (await authorize(jws, demand, opts)).result.code;
  assert.equal(await code({ scope: 'payment.execute', amount: 1 }), 'out_of_mandate');
  assert.equal(await code({ scope: 'payment.draft', amount: 9_000 }), 'out_of_mandate');
  assert.equal(await code({ scope: 'payment.draft', resource: 'ledger:other' }), 'out_of_mandate');
  assert.equal(await code({ scope: 'payment.draft', impact: 'HIGH' }), 'approval_required');
  assert.equal(await code({ scope: 'payment.draft', impact: 'CRITICAL' }), 'approval_required');

  assert.equal(await authorize(jws, { scope: 'payment.draft' }, { ...opts, audience: 'other.app.example' }), null);
});

test('FlashyID: the enforcement gate turns approval_required into ESCALATE, everything else into DENY', () => {
  const chain = agentChain();
  const escalate = evaluateGrant(chain, { scope: 'payment.draft', impact: 'HIGH' }, { nowSec });
  assert.equal(escalate.action, 'ESCALATE');
  assert.equal(escalate.escalateAtOrAbove, 'HIGH');

  assert.equal(evaluateGrant(chain, { scope: 'payment.draft', impact: 'LOW' }, { nowSec }).action, 'ALLOW');

  const deny = evaluateGrant(chain, { scope: 'payment.execute' }, { nowSec });
  assert.equal(deny.action, 'DENY');
  assert.equal(deny.code, 'out_of_mandate');

  assert.equal(permits(verifyChain(chain, nowSec), { scope: 'report.read' }), true);
});

test('FlashyID: the chain\'s leaf holder must be the assertion\'s subject', async () => {
  const chain = agentChain();
  const jws = await sign(ORG, chain); // the org presents the agent's chain as its own
  const { result } = await authorize(jws, { scope: 'payment.draft' }, { ...verifyOpts, nowSec });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'broken_chain');
});

test('FlashyID: revocation walks down; expiry is evaluated at nowSec', async () => {
  const chain = agentChain();
  const jws = await sign(AGENT, chain);

  const revoked = await authorize(jws, { scope: 'payment.draft' }, { ...verifyOpts, nowSec, revokedJtis: new Set(['root-1']) });
  assert.equal(revoked.result.code, 'revoked');
  assert.equal(revoked.result.at, 0, 'the refusal points at the highest revoked link');

  assert.deepEqual(verifyChain(chain, nowSec + 2 * DAY), { ok: false, code: 'expired', at: 1, detail: undefined });
  assert.equal(verifyChain(rootChain(), nowSec + 2 * DAY).ok, true, 'the root alone is still in date');
});

test('FlashyID: an assertion with no delegation authorizes nothing', async () => {
  const jws = await sign(AGENT, undefined);
  const { result } = await authorize(jws, { scope: 'report.read' }, { ...verifyOpts, nowSec });
  assert.equal(result.code, 'empty_chain');
});
