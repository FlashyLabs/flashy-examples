import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueRoot, attenuate, verifyChain, permits } from '@flashyid/sdk';

const DAY = 86_400;
const nowSec = Math.floor(Date.now() / 1000);
const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';
const DAVE = 'dave@example.com';

const root = () => issueRoot({
  rootHuman: ALICE, holder: ALICE, scp: ['spend', 'report'], res: ['budget:team'],
  lim: { spend_max: 100_000 }, iat: nowSec, exp: nowSec + 365 * DAY, jti: 'g-alice',
});

function fourLinks() {
  const alice = root();
  const bob = attenuate(alice, { holder: BOB, lim: { spend_max: 50_000 }, iat: nowSec, exp: nowSec + 30 * DAY, jti: 'g-bob' });
  const carol = attenuate(bob, { holder: CAROL, scp: ['spend'], lim: { spend_max: 25_000 }, iat: nowSec, exp: nowSec + 7 * DAY, jti: 'g-carol' });
  const dave = attenuate(carol, { holder: DAVE, lim: { spend_max: 10_000 }, iat: nowSec, exp: nowSec + DAY, jti: 'g-dave' });
  return { alice, bob, carol, dave };
}

test('Attenuation: every link holds no more than the one above', () => {
  const { dave } = fourLinks();
  assert.equal(dave.length, 4);
  for (let i = 1; i < dave.length; i++) {
    const parent = dave[i - 1];
    const child = dave[i];
    assert.equal(child.iss, parent.sub, 'each issuer is the holder above');
    assert.ok(child.lim.spend_max <= parent.lim.spend_max);
    assert.ok(child.exp <= parent.exp);
    assert.ok(child.scp.every((s) => parent.scp.includes(s)));
  }
  assert.deepEqual(dave.map((l) => l.lim.spend_max), [100_000, 50_000, 25_000, 10_000]);
  assert.deepEqual(dave.map((l) => l.sub), [ALICE, BOB, CAROL, DAVE]);
});

test('Attenuation: widening is refused by return value — a Refusal, not an exception', () => {
  const { bob, carol } = fourLinks();
  const refusal = attenuate(bob, { holder: 'eve@example.com', lim: { spend_max: 75_000 }, iat: nowSec, exp: nowSec + DAY, jti: 'g-eve' });
  assert.deepEqual(refusal, { ok: false, code: 'chain_widened', at: 2, detail: 'limit loosened' });

  const scope = attenuate(carol, { holder: 'eve@example.com', scp: ['spend', 'report'], iat: nowSec, exp: nowSec + DAY, jti: 'g-eve' });
  assert.equal(scope.code, 'chain_widened');
  assert.equal(scope.detail, 'scope widened');

  const resource = attenuate(carol, { holder: 'eve@example.com', res: ['budget:company'], iat: nowSec, exp: nowSec + DAY, jti: 'g-eve' });
  assert.equal(resource.detail, 'resource widened');

  assert.equal(attenuate([], { holder: 'eve@example.com', iat: nowSec, exp: nowSec + DAY, jti: 'g-eve' }).code, 'empty_chain');
});

test('Attenuation: expiry is capped at the parent, and the effective expiry is the chain minimum', () => {
  const { carol, dave } = fourLinks();
  const eve = attenuate(carol, { holder: 'eve@example.com', iat: nowSec, exp: nowSec + 365 * DAY, jti: 'g-eve' });
  assert.equal(eve[3].exp, carol[2].exp, 'a child asking to outlive its parent gets the parent\'s expiry');

  const effective = verifyChain(dave, nowSec);
  assert.equal(effective.ok, true);
  assert.equal(effective.exp, nowSec + DAY);
  assert.equal(effective.holder, DAVE);
  assert.equal(effective.root, ALICE);
  assert.deepEqual(effective.scp, ['spend']);
  assert.deepEqual(effective.lim, { spend_max: 10_000 });
  assert.deepEqual(effective.chain, ['g-alice', 'g-bob', 'g-carol', 'g-dave']);
});

test('Attenuation: permits enforces the leaf\'s authority at the operation boundary', () => {
  const { dave } = fourLinks();
  const effective = verifyChain(dave, nowSec);
  assert.equal(permits(effective, { scope: 'spend', amount: 5_000 }), true);
  assert.equal(permits(effective, { scope: 'spend', amount: 10_000 }), true);
  assert.equal(permits(effective, { scope: 'spend', amount: 10_001 }).code, 'out_of_mandate');
  assert.equal(permits(effective, { scope: 'report' }).code, 'out_of_mandate', 'Carol dropped report; Dave never had it');
  assert.equal(permits(effective, { scope: 'spend', resource: 'budget:company' }).code, 'out_of_mandate');
});

test('Attenuation: revocation walks down — revoke Bob and Carol and Dave fall with him', () => {
  const { alice, bob, carol, dave } = fourLinks();
  const revoked = new Set(['g-bob']);
  assert.equal(verifyChain(alice, nowSec, revoked).ok, true, 'Alice is above Bob');
  assert.deepEqual(verifyChain(bob, nowSec, revoked), { ok: false, code: 'revoked', at: 1, detail: undefined });
  assert.equal(verifyChain(carol, nowSec, revoked).code, 'revoked');
  assert.equal(verifyChain(dave, nowSec, revoked).code, 'revoked');
  assert.equal(verifyChain(dave, nowSec, revoked).at, 1, 'the refusal points at the highest revoked link');
});

test('Attenuation: expiry is evaluated at the time given, link by link', () => {
  const { dave } = fourLinks();
  assert.equal(verifyChain(dave, nowSec + 2 * DAY).code, 'expired');
  assert.equal(verifyChain(dave, nowSec + 2 * DAY).at, 3, 'Dave\'s one-day link is the first to lapse');
  assert.equal(verifyChain(dave.slice(0, 3), nowSec + 2 * DAY).ok, true, 'Carol\'s seven-day chain is still in date');
  assert.equal(verifyChain(dave.slice(0, 3), nowSec + 8 * DAY).at, 2);
});

test('Attenuation: a chain that widened by any other route is caught on verify', () => {
  const { carol, dave } = fourLinks();
  const forged = [...carol, { ...dave[3], lim: { spend_max: 99_000 } }];
  assert.deepEqual(verifyChain(forged, nowSec), { ok: false, code: 'chain_widened', at: 3, detail: 'limit loosened' });

  const broken = [...carol, { ...dave[3], iss: ALICE }];
  assert.equal(verifyChain(broken, nowSec).code, 'broken_chain');

  const scopeCreep = [...carol, { ...dave[3], scp: ['spend', 'report'] }];
  assert.equal(verifyChain(scopeCreep, nowSec).detail, 'scope widened');
});
