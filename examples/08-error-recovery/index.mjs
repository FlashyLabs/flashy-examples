// Example 8: Error Recovery
//
// Shows how to handle errors gracefully: hop declination, revoked grants,
// insufficient balance, and how to implement retry logic.

import { Rails } from '@flashylabs/rails';
import { MagicianRouter } from '@magician-network/core';
import { Ledger, toMinor } from '@flashylabs/ledger';

async function errorRecoveryExample() {
  console.log('⚡ Example 8: Error Recovery\n');

  const ledger = new Ledger({ store: new Map() });
  const rails = new Rails({ ledger });
  const router = new MagicianRouter();

  // Setup
  await ledger.registerAsset({ symbol: 'USD', decimals: 2 });
  await ledger.issue('user:alice', 'USD', toMinor('200.00'));

  // Scenario 1: Insufficient balance
  console.log('Scenario 1: Insufficient balance');
  try {
    const draft = rails.draftTransfer({
      from: 'user:alice',
      to: 'user:bob',
      asset: 'USD',
      amount: toMinor('500.00')  // More than balance
    });
    const token = rails.createConsentToken(draft, 'user:alice');
    rails.execute(draft, token);
  } catch (err) {
    console.log(`  ✓ Caught error: ${err.message}\n`);
  }

  // Scenario 2: Revoked grant
  console.log('Scenario 2: Revoked grant');
  const draft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('50.00')
  });
  const token = rails.createConsentToken(draft, 'user:alice');

  // Simulate grant revocation between draft and execution
  rails.revokeGrant(draft.grantId);

  try {
    rails.execute(draft, token);
  } catch (err) {
    console.log(`  ✓ Caught error: ${err.message}\n`);
  }

  // Scenario 3: Routing failure (hop declined)
  console.log('Scenario 3: Routing through declined hop');
  router.addEdge({ from: 'alice', to: 'bob', tier: 'trusted' });
  router.addEdge({ from: 'bob', to: 'carol', tier: 'trusted' });

  // Request routing, but Bob declines
  try {
    const route = router.findRoute('alice', 'carol');
    // Bob declines this introduction
    router.decline(route);
  } catch (err) {
    console.log(`  ✓ Caught error: ${err.message}\n`);
  }

  // Scenario 4: Retry with backoff
  console.log('Scenario 4: Retry with exponential backoff');

  async function executeWithRetry(draft, token, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = rails.execute(draft, token);
        console.log(`  ✓ Success on attempt ${attempt}`);
        return result;
      } catch (err) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt - 1) * 100;  // exponential backoff
          console.log(`  Attempt ${attempt} failed: ${err.message}`);
          console.log(`  Retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        } else {
          console.log(`  ✗ Failed after ${maxRetries} attempts`);
          throw err;
        }
      }
    }
  }

  const recoveryDraft = rails.draftTransfer({
    from: 'user:alice',
    to: 'user:bob',
    asset: 'USD',
    amount: toMinor('50.00')
  });
  const recoveryToken = rails.createConsentToken(recoveryDraft, 'user:alice');

  await executeWithRetry(recoveryDraft, recoveryToken);

  // Scenario 5: Graceful degradation
  console.log('\nScenario 5: Graceful degradation (prefer direct path)');

  function choosePath(from, to, graph) {
    const paths = graph.findPaths(from, to, { maxHops: 5 });

    if (paths.length === 0) {
      console.log(`  ✗ No paths available`);
      return null;
    }

    // Prefer shortest path, but if it fails, try next
    for (const path of paths) {
      if (graph.isPathViable(path)) {
        console.log(`  ✓ Using path: ${path.join(' → ')}`);
        return path;
      }
    }

    console.log(`  ✗ No viable paths`);
    return null;
  }

  choosePath('alice', 'carol', router);

  console.log('\n✅ Error recovery patterns demonstrated\n');
}

await errorRecoveryExample();
