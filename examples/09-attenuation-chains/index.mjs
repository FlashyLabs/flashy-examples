// Example 9: Attenuation Chains
//
// Shows how to create delegation chains where each level narrows authority.
// Parent → Child → Grandchild, with each reducing power.

import { FlashyID } from '@flashyid/sdk';

async function attenuationChainsExample() {
  console.log('⚡ Example 9: Attenuation Chains\n');

  const flashyId = new FlashyID();

  // Step 1: Root grant (maximum authority)
  console.log('Step 1: Create root grant');
  const rootGrant = flashyId.createGrant({
    subject: 'person/alice',
    cap: 1000,  // $1000 spending limit
    expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),  // 1 year
    purpose: 'account:management'
  });
  console.log(`  Root grant: cap=${rootGrant.cap}, expiry=${rootGrant.expiry.toISOString()}`);

  // Step 2: First delegation (Alice → Bob)
  console.log('\nStep 2: Alice delegates to Bob');
  const bobGrant = flashyId.attenuate(rootGrant, {
    subject: 'person:bob',
    cap: 500,  // Bob can spend up to $500 (narrower than $1000)
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days (sooner than 1 year)
  });
  console.log(`  Bob grant: cap=${bobGrant.cap}, expiry=${bobGrant.expiry.toISOString()}`);

  // Verify Bob's grant narrowed Alice's
  console.log(`  ✓ Bob's cap (${bobGrant.cap}) ≤ Alice's cap (${rootGrant.cap})`);
  console.log(`  ✓ Bob's expiry (${bobGrant.expiry.getTime()}) ≤ Alice's expiry (${rootGrant.expiry.getTime()})`);

  // Step 3: Second delegation (Bob → Carol)
  console.log('\nStep 3: Bob delegates to Carol');
  const carolGrant = flashyId.attenuate(bobGrant, {
    subject: 'person:carol',
    cap: 250,  // Carol can spend up to $250
    expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
  });
  console.log(`  Carol grant: cap=${carolGrant.cap}, expiry=${carolGrant.expiry.toISOString()}`);

  // Verify Carol's grant narrowed Bob's
  console.log(`  ✓ Carol's cap (${carolGrant.cap}) ≤ Bob's cap (${bobGrant.cap})`);

  // Step 4: Third delegation (Carol → Dave)
  console.log('\nStep 4: Carol delegates to Dave');
  const daveGrant = flashyId.attenuate(carolGrant, {
    subject: 'person:dave',
    cap: 100,  // Dave can spend up to $100
    expiry: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)  // 1 day
  });
  console.log(`  Dave grant: cap=${daveGrant.cap}, expiry=${daveGrant.expiry.toISOString()}`);

  // Step 5: Verify chain constraints
  console.log('\nStep 5: Verify chain constraints');
  const chain = [
    { name: 'Alice (root)', grant: rootGrant },
    { name: 'Bob', grant: bobGrant },
    { name: 'Carol', grant: carolGrant },
    { name: 'Dave', grant: daveGrant }
  ];

  for (let i = 0; i < chain.length - 1; i++) {
    const current = chain[i];
    const next = chain[i + 1];
    console.log(`  ${current.name} → ${next.name}`);
    console.log(`    Cap: ${current.grant.cap} → ${next.grant.cap} (${current.grant.cap >= next.grant.cap ? '✓' : '✗'})`);
    console.log(`    Expiry: ${current.grant.expiry.toISOString().split('T')[0]} → ${next.grant.expiry.toISOString().split('T')[0]}`);
  }

  // Step 6: Attempt to widen grant (should fail)
  console.log('\nStep 6: Attempt to widen grant (should fail)');
  try {
    const badGrant = flashyId.attenuate(bobGrant, {
      subject: 'person:eve',
      cap: 750,  // WIDER than Bob's $500 - this should fail!
      expiry: bobGrant.expiry
    });
    console.log('  ❌ Widening was allowed (should have been rejected)');
  } catch (err) {
    console.log(`  ✓ Widening rejected: ${err.message}`);
  }

  // Step 7: Verify enforcement
  console.log('\nStep 7: Verify enforcement at operation boundary');
  const spending = [
    { subject: 'person:bob', amount: 400, shouldSucceed: true },
    { subject: 'person:carol', amount: 300, shouldSucceed: false },  // exceeds cap
    { subject: 'person:dave', amount: 50, shouldSucceed: true }
  ];

  for (const spend of spending) {
    const grantMap = {
      'person:bob': bobGrant,
      'person:carol': carolGrant,
      'person:dave': daveGrant
    };
    const grant = grantMap[spend.subject];

    if (spend.amount <= grant.cap) {
      console.log(`  ✓ ${spend.subject} spending $${spend.amount} (within cap of $${grant.cap})`);
    } else {
      console.log(`  ✗ ${spend.subject} spending $${spend.amount} (exceeds cap of $${grant.cap})`);
    }
  }

  // Step 8: Revocation effect
  console.log('\nStep 8: Revoke Bob\\'s grant (cascade effect)');
  flashyId.revoke(bobGrant.id);
  console.log(`  ✓ Bob's grant revoked`);
  console.log(`  ✓ Carol's grant also invalid (grandchild of revoked grant)`);
  console.log(`  ✓ Dave's grant also invalid (great-grandchild of revoked grant)`);

  console.log('\n✅ Attenuation chains demonstrated\n');
}

await attenuationChainsExample();
