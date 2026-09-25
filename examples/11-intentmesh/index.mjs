/**
 * Example 11: IntentMesh — Federated Roadmaps
 *
 * This example demonstrates the intent/1 format for publishing and merging
 * federated roadmaps across organizations.
 */

/**
 * Compute expiry based on kind
 * - initiative: 90 days
 * - task: 30 days
 * - research: 60 days
 */
function computeExpiry(kind) {
  const now = new Date();
  let days;

  switch (kind) {
    case 'initiative':
      days = 90;
      break;
    case 'task':
      days = 30;
      break;
    case 'research':
      days = 60;
      break;
    default:
      throw new Error(`Unknown kind: ${kind}`);
  }

  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
}

/**
 * Create a private intent item
 * Visibility is ALWAYS private — there is no parameter to change this
 */
export function file({
  id,
  kind,
  title,
  status,
  wants
}) {
  if (!id) throw new Error('id is required');
  if (!kind) throw new Error('kind is required');
  if (!title) throw new Error('title is required');
  if (!status) throw new Error('status is required');
  if (!wants || wants.length === 0) throw new Error('wants array is required and must not be empty');

  return {
    id,
    kind,
    title,
    status,
    wants,
    visibility: 'private',
    expires: computeExpiry(kind)
  };
}

/**
 * Promote an intent to public visibility
 * Requires a person/ signature — never an agent/
 */
export function promote(item, { by, to }) {
  if (to !== 'public') {
    throw new Error(`Cannot promote to "${to}" — only "public" is valid`);
  }

  if (!by || !by.startsWith('person/')) {
    throw new Error(`Promotion requires person/ signature, got: ${by}`);
  }

  return {
    ...item,
    visibility: to,
    promotedBy: by,
    promotedAt: new Date().toISOString()
  };
}

/**
 * Merge multiple intent fragments
 * Returns { intents, problems }
 */
export function merge(fragments) {
  const intents = [];
  const problems = [];
  const seenIds = new Set();

  for (const fragment of fragments) {
    if (!fragment.intent || fragment.intent !== '1') {
      problems.push(`Invalid fragment version: ${fragment.intent}`);
      continue;
    }

    if (!fragment.items) {
      continue;
    }

    for (const item of fragment.items) {
      if (seenIds.has(item.id)) {
        problems.push(`Duplicate ID across fragments: ${item.id}`);
        continue;
      }

      seenIds.add(item.id);
      intents.push(item);
    }
  }

  return { intents, problems };
}

/**
 * Filter intents by visibility tier
 */
export function view(intents, tier) {
  return intents.filter(item => item.visibility === tier || tier === 'all');
}

/**
 * Main example
 */
export async function run() {
  console.log('=== Example 11: IntentMesh ===\n');

  // 1. Create a private draft (agent-safe)
  console.log('1. Creating a private draft intent...');
  const draft = file({
    id: 'intent/acme/settlement-rails',
    kind: 'initiative',
    title: 'Settlement rails for cross-border payouts',
    status: 'open',
    wants: ['payments', 'compliance']
  });

  console.log(`   Created: ${draft.id}`);
  console.log(`   Title: ${draft.title}`);
  console.log(`   Visibility: ${draft.visibility} (always private)`);
  console.log(`   Expires: ${draft.expires}\n`);

  // 2. Promote to public (requires human)
  console.log('2. Promoting to public (requires person/ signature)...');
  const publicIntent = promote(draft, {
    by: 'person/alice',
    to: 'public'
  });

  console.log(`   Visibility: ${publicIntent.visibility}`);
  console.log(`   Promoted by: ${publicIntent.promotedBy}\n`);

  // 3. Create a fragment with multiple intents
  console.log('3. Creating a complete fragment...');
  const acmeIntents = [
    file({
      id: 'intent/acme/settlement-rails',
      kind: 'initiative',
      title: 'Settlement rails for cross-border payouts',
      status: 'open',
      wants: ['payments', 'compliance']
    }),
    file({
      id: 'intent/acme/audit-log',
      kind: 'task',
      title: 'Build append-only audit log',
      status: 'open',
      wants: ['transparency', 'compliance']
    }),
    file({
      id: 'intent/acme/consensus-research',
      kind: 'research',
      title: 'Research Raft consensus for distributed settlement',
      status: 'open',
      wants: ['resilience']
    })
  ];

  // Promote some to public
  const acmeFragment = {
    intent: '1',
    source: 'repo/acme',
    org: 'org/acme',
    generated: new Date().toISOString(),
    items: [
      promote(acmeIntents[0], { by: 'person/alice', to: 'public' }),
      promote(acmeIntents[1], { by: 'person/alice', to: 'public' }),
      acmeIntents[2] // leave private
    ]
  };

  console.log(`   Fragment: ${acmeFragment.source}`);
  console.log(`   Items: ${acmeFragment.items.length}`);
  console.log(`   Public items: ${acmeFragment.items.filter(i => i.visibility === 'public').length}\n`);

  // 4. Create another org's fragment
  console.log('4. Creating BigCorp fragment...');
  const bigcorpIntents = [
    file({
      id: 'intent/bigcorp/defi-integration',
      kind: 'initiative',
      title: 'DeFi protocol integration',
      status: 'open',
      wants: ['payments', 'interop']
    }),
    file({
      id: 'intent/bigcorp/id-provider',
      kind: 'task',
      title: 'Implement OIDC provider',
      status: 'blocked',
      wants: ['identity']
    })
  ];

  const bigcorpFragment = {
    intent: '1',
    source: 'repo/bigcorp',
    org: 'org/bigcorp',
    generated: new Date().toISOString(),
    items: [
      promote(bigcorpIntents[0], { by: 'person/bob', to: 'public' }),
      promote(bigcorpIntents[1], { by: 'person/bob', to: 'public' })
    ]
  };

  console.log(`   Fragment: ${bigcorpFragment.source}`);
  console.log(`   Items: ${bigcorpFragment.items.length}\n`);

  // 5. Merge fragments
  console.log('5. Merging fragments...');
  const { intents, problems } = merge([acmeFragment, bigcorpFragment]);

  console.log(`   Total intents: ${intents.length}`);
  console.log(`   Merge problems: ${problems.length}`);
  if (problems.length > 0) {
    console.log(`   Issues: ${problems.join(', ')}`);
  }
  console.log();

  // 6. View only public items
  console.log('6. Filtering by visibility...');
  const publicOnly = view(intents, 'public');
  console.log(`   Public items: ${publicOnly.length}`);
  console.log(`   Private items: ${view(intents, 'private').length}\n`);

  // 7. Find intents by "wants"
  console.log('7. Finding intents that want "payments"...');
  const paymentIntents = intents.filter(i => i.wants.includes('payments'));
  paymentIntents.forEach(item => {
    console.log(`   - ${item.title} (${item.status})`);
  });
  console.log();

  // 8. Group by status
  console.log('8. Grouping by status...');
  const byStatus = intents.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || []).concat(item);
    return acc;
  }, {});

  Object.entries(byStatus).forEach(([status, items]) => {
    console.log(`   ${status}: ${items.length} items`);
  });
  console.log();

  // 9. Check expiry
  console.log('9. Expiry timestamps (computed from kind)...');
  const kindExamples = [
    { kind: 'initiative', expectedDays: 90 },
    { kind: 'task', expectedDays: 30 },
    { kind: 'research', expectedDays: 60 }
  ];

  kindExamples.forEach(({ kind, expectedDays }) => {
    const item = file({
      id: `intent/test/${kind}`,
      kind,
      title: `Test ${kind}`,
      status: 'open',
      wants: ['test']
    });

    const expiry = new Date(item.expires);
    const now = new Date();
    const daysUntilExpiry = Math.round((expiry - now) / (24 * 60 * 60 * 1000));

    console.log(`   ${kind}: expires in ${daysUntilExpiry} days (expected ~${expectedDays})`);
  });
  console.log();

  console.log('=== Example 11 Complete ===');
  return { intents, problems };
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
