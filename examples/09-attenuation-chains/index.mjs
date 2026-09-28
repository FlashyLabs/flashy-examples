/**
 * Example 9: Attenuation Chains
 *
 * Alice -> Bob -> Carol -> Dave. Each link holds strictly less than the one
 * above: a lower spend ceiling, a shorter life, fewer scopes. Revoking any
 * link kills everything delegated from it.
 * Demonstrates: issueRoot, attenuate (refusal by return), verifyChain,
 * permits, revocation walking down, and defence in depth.
 *
 * @flashyid/sdk's grant kernel is pure: no class to instantiate, no clock —
 * time is an argument, so an auditor re-checks a historical decision at the
 * moment it was made.
 */

import { issueRoot, attenuate, verifyChain, permits } from '@flashyid/sdk';

const DAY = 86_400;
const nowSec = Math.floor(Date.now() / 1000);

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';
const DAVE = 'dave@example.com';

const describe = (chain) => chain.map((l) =>
  `   ${l.iss.padEnd(18)} -> ${l.sub.padEnd(18)} spend_max ${String(l.lim.spend_max).padStart(6)}  ` +
  `expires +${((l.exp - nowSec) / DAY).toFixed(0).padStart(3)}d  scp ${l.scp.join(',')}`,
).join('\n');

function main() {
  console.log('=== Attenuation Chains ===\n');

  console.log('1. Alice, the accountable human, issues the root to herself');
  const alice = issueRoot({
    rootHuman: ALICE, holder: ALICE,
    scp: ['spend', 'report'], res: ['budget:team'],
    lim: { spend_max: 100_000 },
    iat: nowSec, exp: nowSec + 365 * DAY, jti: 'g-alice',
  });

  console.log('2. Each delegation narrows: Alice -> Bob -> Carol -> Dave');
  const bob = attenuate(alice, { holder: BOB, lim: { spend_max: 50_000 }, iat: nowSec, exp: nowSec + 30 * DAY, jti: 'g-bob' });
  const carol = attenuate(bob, { holder: CAROL, scp: ['spend'], lim: { spend_max: 25_000 }, iat: nowSec, exp: nowSec + 7 * DAY, jti: 'g-carol' });
  const dave = attenuate(carol, { holder: DAVE, lim: { spend_max: 10_000 }, iat: nowSec, exp: nowSec + DAY, jti: 'g-dave' });
  console.log(describe(dave), '\n');

  console.log('3. Widening is refused — by return value, not by throw');
  const wider = attenuate(bob, { holder: 'eve@example.com', lim: { spend_max: 75_000 }, iat: nowSec, exp: bob[1].exp, jti: 'g-eve' });
  console.log(`   Bob delegating 75,000 of his 50,000: ok=${wider.ok} code=${wider.code} at link ${wider.at} (${wider.detail})`);
  const broader = attenuate(carol, { holder: 'eve@example.com', scp: ['spend', 'report'], iat: nowSec, exp: carol[2].exp, jti: 'g-eve' });
  console.log(`   Carol handing out 'report' she no longer holds: ok=${broader.ok} (${broader.detail})\n`);

  console.log('4. Expiry is the one field capped rather than refused');
  const outlive = attenuate(carol, { holder: 'eve@example.com', iat: nowSec, exp: nowSec + 365 * DAY, jti: 'g-eve' });
  console.log(`   Carol's link expires +7d; a child asking for +365d gets +${(outlive[3].exp - nowSec) / DAY}d\n`);

  console.log('5. verifyChain: the authority actually in effect at the leaf');
  const effective = verifyChain(dave, nowSec);
  console.log(`   holder ${effective.holder}, root ${effective.root}, scp ${effective.scp.join(',')}`);
  console.log(`   spend_max ${effective.lim.spend_max} (tightest), expires +${(effective.exp - nowSec) / DAY}d (minimum)`);
  console.log(`   audit trail: ${effective.chain.join(' -> ')}\n`);

  console.log('6. permits: enforcement at the operation boundary');
  for (const demand of [{ scope: 'spend', amount: 5_000 }, { scope: 'spend', amount: 20_000 }, { scope: 'report' }]) {
    const verdict = permits(effective, demand);
    console.log(`   ${JSON.stringify(demand).padEnd(36)} -> ${verdict === true ? 'permitted' : `${verdict.code} (${verdict.detail})`}`);
  }
  console.log('');

  console.log('7. Revocation walks down: revoke Bob and every link below him dies');
  const revoked = new Set(['g-bob']);
  for (const [name, chain] of [['Alice', alice], ['Bob', bob], ['Carol', carol], ['Dave', dave]]) {
    const v = verifyChain(chain, nowSec, revoked);
    console.log(`   ${name.padEnd(6)} ${v.ok ? 'still holds authority' : `${v.code} at link ${v.at}`}`);
  }
  console.log('');

  console.log('8. Defence in depth: a chain that widened by any other route is caught on verify');
  const forged = [...carol, { ...dave[3], lim: { spend_max: 99_000 } }];
  const caught = verifyChain(forged, nowSec);
  console.log(`   hand-built link with spend_max 99,000 under a 25,000 parent: ${caught.code} at link ${caught.at}\n`);

  console.log('=== Attenuation Chains Example Complete ===\n');
}

main();
