/**
 * Example 4: FlashyID Assertions & Delegation
 *
 * The issuer signs an OIDC-shaped EdDSA assertion that carries a delegation
 * chain; a relying party verifies it holding only the public key, then asks
 * whether the chain permits THIS action.
 * Demonstrates: issueRoot/attenuate (a chain only narrows), signAssertion,
 * verifyAssertion, authorize, the refusal codes, and the enforcement gate.
 *
 * @flashyid/sdk has no OAuth client class — no initAuthFlow(), no
 * exchangeCode(). The browser redirect dance belongs to the OIDC provider
 * (id.flashyid.com). What the SDK gives a relying party is the verify surface
 * for the assertion that dance produces, plus the grant kernel inside it.
 * Here the issuer and the relying party run in one process so the whole loop
 * is visible; the private key still never crosses to the verifying side.
 */

import { generateKeyPairSync } from 'node:crypto';
import {
  issueRoot, attenuate, verifyChain, permits,
  signAssertion, verifyAssertion, authorize, evaluateGrant, agentSubject,
} from '@flashyid/sdk';

// In production the issuer is https://id.flashyid.com and the relying party
// fetches its public JWKS. Here both sides are local, so the label is local too.
const ISSUER = 'https://issuer.example';
const AUDIENCE = 'payments.app.example';

const ACCOUNTABLE = 'alice@example.com';       // the human every chain roots at
const ORG = 'org/demo-acme';
const AGENT = agentSubject('demo-acme', 'payments'); // 'agent:demo-acme/payments'

const DAY = 86_400;
const nowSec = Math.floor(Date.now() / 1000);

async function main() {
  console.log('=== FlashyID Assertions & Delegation ===\n');

  console.log('1. Keys: the issuer holds the private half; a relying party only ever sees the public half');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  console.log(`   ${privateKey.asymmetricKeyType} keypair generated\n`);

  console.log('2. The root grant: issued FROM the accountable human TO the organisation');
  const root = issueRoot({
    rootHuman: ACCOUNTABLE, holder: ORG,
    scp: ['payment.draft', 'payment.execute', 'report.read'],
    res: ['ledger:demo-acme'],
    lim: { approval_at_or_above: 'HIGH', spend_max: 100_000 },
    iat: nowSec, exp: nowSec + 365 * DAY, jti: 'root-1',
  });
  console.log(`   ${root[0].iss} -> ${root[0].sub}: ${root[0].scp.join(', ')} (spend_max ${root[0].lim.spend_max})\n`);

  console.log('3. Attenuate down to the agent: fewer scopes, a lower ceiling, a shorter life');
  const chain = attenuate(root, {
    holder: AGENT,
    scp: ['payment.draft', 'report.read'],
    lim: { approval_at_or_above: 'HIGH', spend_max: 5_000 },
    iat: nowSec, exp: nowSec + DAY, jti: 'agent-1',
  });
  const leaf = chain[chain.length - 1];
  console.log(`   ${leaf.iss} -> ${leaf.sub}: ${leaf.scp.join(', ')} (spend_max ${leaf.lim.spend_max})\n`);

  console.log('4. Widening is refused — attenuate RETURNS a refusal, it does not throw');
  const widened = attenuate(chain, { holder: 'agent:demo-acme/rogue', scp: ['payment.execute'], iat: nowSec, exp: nowSec + DAY, jti: 'rogue-1' });
  console.log(`   ok: ${widened.ok}, code: ${widened.code}, detail: ${widened.detail}\n`);

  console.log('5. Verify the chain end to end: what authority is actually in effect');
  const effective = verifyChain(chain, nowSec);
  console.log(`   holder ${effective.holder}, root ${effective.root}`);
  console.log(`   scp ${effective.scp.join(', ')}; spend_max ${effective.lim.spend_max}; expires in ${(effective.exp - nowSec) / DAY} day(s)\n`);

  console.log('6. The issuer signs an assertion for the agent, carrying the chain');
  const jws = await signAssertion({ privateKey, issuer: ISSUER, audience: AUDIENCE, subject: AGENT, delegation: chain, jti: 'tok-1' });
  console.log(`   ${jws.split('.').length} JWS parts, ${jws.length} chars\n`);

  console.log('7. The relying party verifies it with the public key only');
  const assertion = await verifyAssertion(jws, { issuer: ISSUER, audience: AUDIENCE, getKey: publicKey });
  console.log(`   sub ${assertion.sub}, delegation of ${assertion.del.length} links`);
  const elsewhere = await verifyAssertion(jws, { issuer: ISSUER, audience: 'other.app.example', getKey: publicKey });
  console.log(`   the same token at another audience: ${elsewhere} (a 401, never a throw)\n`);

  console.log('8. authorize(): genuine, AND does the delegation permit this action?');
  const opts = { issuer: ISSUER, audience: AUDIENCE, getKey: publicKey, nowSec };
  const demands = [
    { scope: 'payment.draft', amount: 1_240 },
    { scope: 'payment.draft', amount: 9_000 },
    { scope: 'payment.execute', amount: 100 },
    { scope: 'payment.draft', amount: 100, impact: 'HIGH' },
  ];
  for (const demand of demands) {
    const { result } = await authorize(jws, demand, opts);
    console.log(`   ${JSON.stringify(demand).padEnd(58)} -> ${result.ok ? 'ALLOWED' : result.code}`);
  }
  console.log('');

  console.log('9. The gate maps approval_required to ESCALATE: in mandate, but a named human co-signs');
  const decision = evaluateGrant(chain, { scope: 'payment.draft', impact: 'HIGH' }, { nowSec });
  console.log(`   ${decision.action} at or above ${decision.escalateAtOrAbove}`);
  console.log(`   permits() alone says: ${JSON.stringify(permits(effective, { scope: 'payment.draft', impact: 'LOW' }))}\n`);

  console.log('10. Revocation walks down: revoke the root and the agent\'s assertion stops working');
  const revoked = await authorize(jws, { scope: 'payment.draft', amount: 100 }, { ...opts, revokedJtis: new Set(['root-1']) });
  console.log(`   -> ${revoked.result.code} at link ${revoked.result.at}\n`);

  console.log('=== FlashyID Assertions & Delegation Example Complete ===\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
