/**
 * Example 4: FlashyID OAuth & Delegation
 *
 * Learn authentication with OIDC and fine-grained authorization with grants.
 * Demonstrates: OAuth flow, token verification, grant attenuation.
 */

import { FlashyIDClient, mintGrant, attenuate } from '@flashyid/sdk';

async function main() {
  console.log('=== FlashyID OAuth & Delegation ===\n');

  const client = new FlashyIDClient({
    issuer: 'https://id.flashyid.com',
    clientId: 'app.example.com',
    clientSecret: process.env.FLASHYID_CLIENT_SECRET
  });

  // 1. Start OAuth flow
  console.log('1. Initiating OAuth flow...');
  const { authUrl, state, nonce } = client.initAuthFlow({
    redirectUri: 'https://app.example.com/callback',
    scope: ['openid', 'profile', 'email']
  });
  console.log(`   ✓ Auth URL: ${authUrl}`);
  console.log(`   ✓ State: ${state}\n`);

  // Simulate user authenticating and redirecting back
  console.log('2. Simulating user authentication...');
  const simulatedCode = 'AUTH_CODE_12345';
  console.log(`   [USER] Authenticates with FlashyID`);
  console.log(`   [BROWSER] Redirects with code: ${simulatedCode}\n`);

  // 2. Exchange code for tokens
  console.log('3. Exchanging code for tokens...');
  const { idToken, accessToken } = await client.exchangeCode(
    simulatedCode,
    state,
    nonce
  );
  console.log(`   ✓ ID Token received`);
  console.log(`   ✓ Access Token received\n`);

  // 3. Verify token
  console.log('4. Verifying token signature...');
  const user = client.verifyIdToken(idToken);
  console.log(`   ✓ Token verified`);
  console.log(`   ✓ Subject: ${user.sub}`);
  console.log(`   ✓ Email: ${user.email}\n`);

  // 4. Mint full grant
  console.log('5. Minting full grant for user...');
  const fullGrant = mintGrant(user.sub, {
    cap: 100, // Full authority
    expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
  });
  console.log(`   ✓ Grant minted`);
  console.log(`   ✓ Cap: ${fullGrant.cap}`);
  console.log(`   ✓ Subject: ${fullGrant.subject}\n`);

  // 5. Attenuate for specific purpose
  console.log('6. Attenuating grant for API key...');
  const apiKeyGrant = attenuate(fullGrant, {
    cap: 10, // Limited authority
    expiry: Date.now() + 24 * 60 * 60 * 1000 // 1 day
  });
  console.log(`   ✓ API Key grant created`);
  console.log(`   ✓ Cap: ${apiKeyGrant.cap} (narrower)`);
  console.log(`   ✓ Expires: ${new Date(apiKeyGrant.expiry).toISOString()}\n`);

  // 6. Attenuate further for webhook
  console.log('7. Attenuating API key grant for webhook...');
  const webhookGrant = attenuate(apiKeyGrant, {
    cap: 5, // Even more limited
    expiry: apiKeyGrant.expiry
  });
  console.log(`   ✓ Webhook grant created`);
  console.log(`   ✓ Cap: ${webhookGrant.cap} (most limited)`);
  console.log(`   ✓ Delegation chain length: ${webhookGrant.delegationChain().length}\n`);

  // 7. Demonstrate what cannot be done
  console.log('8. Testing attenuation constraints...');
  try {
    // Try to widen
    attenuate(apiKeyGrant, { cap: 50 });
    console.log('   ✗ ERROR: Should have rejected widening!\n');
  } catch (err) {
    console.log(`   ✓ Correctly rejected: ${err.message}\n`);
  }

  // 8. Display delegation chain
  console.log('9. Delegation chain (audit trail)...');
  const chain = webhookGrant.delegationChain();
  chain.forEach((step, i) => {
    console.log(`   [${ i }] ${step.action} (cap: ${step.cap})`);
  });
  console.log('');

  console.log('=== FlashyID OAuth & Delegation Example Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
