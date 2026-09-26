/**
 * Example 14: Mesh reference consumer (Phase 3)
 *
 * A dependency-free, pure consumer that reads estate fragments (intent/1 and
 * ritual/1) from many sources and folds them into one machine-readable report.
 * It is the shape a real "observe" job takes: the network read is injected as a
 * `fetcher`, so the fold is pure and every path is testable without egress.
 *
 * The estate rules this enforces, each a real failure it refuses to hide:
 *
 *   - **Null is never zero.** An unreachable source is not an empty one. If
 *     every ritual source is unreachable, the ritual summary is `null` — a fact
 *     about this process's connectivity — never `{performed: 0}`, which would be
 *     a claim about the network.
 *   - **Absent, unreachable and invalid are different findings.** A 404
 *     (absent), a thrown fetch (unreachable) and a 200 that does not validate
 *     (invalid) are reported distinctly. Collapsing them makes an outage look
 *     like a publisher that published nothing.
 *   - **https only, one redirect within the same registrable domain.** A source
 *     that redirects to another host is not the same publisher.
 *   - **The anti-metric survives the fold.** Ritual metrics carry witnessed and
 *     consecrated beside the raw count, always.
 */

/** A source's read state. `ok` carries a fragment; the rest are findings. */
export const STATES = ['ok', 'absent', 'unreachable', 'invalid'];

const sameRegistrableDomain = (a, b) => {
  try {
    const ha = new URL(a).hostname.split('.').slice(-2).join('.');
    const hb = new URL(b).hostname.split('.').slice(-2).join('.');
    return ha === hb;
  } catch {
    return false;
  }
};

/**
 * Read one source with an injected fetcher. The fetcher returns
 * { status, body, location? } or throws (an unreachable host). This never
 * throws: a failure is a finding, not an exception.
 *
 * @param fetcher (url) => Promise<{status:number, body?:string, location?:string}>
 */
export async function readSource(fetcher, url) {
  if (!url.startsWith('https://')) return { url, state: 'invalid', reason: 'not https' };

  let res;
  try {
    res = await fetcher(url);
  } catch {
    return { url, state: 'unreachable' };
  }
  if (!res) return { url, state: 'unreachable' };

  // Follow at most one redirect, and only within the same registrable domain.
  if (res.status >= 300 && res.status < 400 && res.location) {
    if (!sameRegistrableDomain(url, res.location)) {
      return { url, state: 'invalid', reason: 'redirect to another host' };
    }
    try {
      res = await fetcher(res.location);
    } catch {
      return { url, state: 'unreachable' };
    }
    if (!res) return { url, state: 'unreachable' };
  }

  if (res.status === 404) return { url, state: 'absent' };
  if (res.status !== 200) return { url, state: 'unreachable' };

  let fragment;
  try {
    fragment = JSON.parse(res.body);
  } catch {
    return { url, state: 'invalid', reason: 'not JSON' };
  }
  const contract = fragment.contract ?? (fragment.intent === '1' ? 'intent/1' : undefined);
  if (contract !== 'intent/1' && contract !== 'ritual/1') {
    return { url, state: 'invalid', reason: 'unknown contract' };
  }
  return { url, state: 'ok', contract, fragment };
}

/** Merge intent/1 fragments: dedup by id, report duplicate-id problems. */
export function mergeIntents(fragments) {
  const seen = new Map();
  const problems = [];
  for (const f of fragments) {
    for (const item of f.items ?? []) {
      if (seen.has(item.id)) problems.push(`duplicate intent id ${item.id}`);
      else seen.set(item.id, { ...item, source: f.source ?? f.org });
    }
  }
  return { intents: [...seen.values()], problems };
}

/**
 * Aggregate ritual/1 metrics across fragments, keeping the raw count beside the
 * witnessed and consecrated shares. Returns `null` when there is nothing to
 * summarize — never a zeroed object.
 */
export function summarizeRituals(fragments) {
  if (fragments.length === 0) return null;
  let performed = 0, witnessed = 0, consecrated = 0;
  for (const f of fragments) {
    const superseded = new Set(
      (f.observances ?? []).filter((o) => o.state === 'void').map((o) => o.supersedes)
    );
    for (const o of f.observances ?? []) {
      if (o.state === 'void' || superseded.has(o.id)) continue;
      performed++;
      if (o.state === 'witnessed' || o.state === 'consecrated') witnessed++;
      if (o.state === 'consecrated') consecrated++;
    }
  }
  return { performed, witnessed, consecrated };
}

/**
 * Read every URL, route by contract, and fold into one report. `ritual` is
 * `null` when no ritual source was read successfully (null is never zero).
 */
export async function consume(fetcher, urls) {
  const sources = [];
  for (const url of urls) sources.push(await readSource(fetcher, url));

  const counts = { ok: 0, absent: 0, unreachable: 0, invalid: 0 };
  for (const s of sources) counts[s.state]++;

  const ok = sources.filter((s) => s.state === 'ok');
  const intentFrags = ok.filter((s) => s.contract === 'intent/1').map((s) => s.fragment);
  const ritualFrags = ok.filter((s) => s.contract === 'ritual/1').map((s) => s.fragment);

  const { intents, problems } = mergeIntents(intentFrags);
  const ritual = ritualFrags.length > 0 ? summarizeRituals(ritualFrags) : null;

  return {
    sources: sources.map(({ fragment, ...rest }) => rest),
    counts,
    intents,
    problems,
    ritual,
    note: ritual
      ? `${ritual.consecrated} of ${ritual.performed} observances carry consequence; ${ritual.witnessed} witnessed.`
      : 'no ritual source was read (null, not zero — a fact about connectivity, not the network)'
  };
}

/** A tiny in-memory fetcher for demos and tests. `map`: url -> response|Error. */
export function memoryFetcher(map) {
  return async (url) => {
    const r = map[url];
    if (r instanceof Error) throw r;
    if (r === undefined) return { status: 404 };
    return r;
  };
}

/** Main example. */
export async function run() {
  console.log('=== Example 14: Mesh reference consumer ===\n');

  const intentFrag = JSON.stringify({
    intent: '1', source: 'repo/acme', org: 'org/acme', generated: '2026-09-26T00:00:00Z',
    items: [{ id: 'intent/acme/rails', kind: 'initiative', title: 'Settlement rails', status: 'open', wants: ['payments'], visibility: 'public' }]
  });
  const ritualFrag = JSON.stringify({
    contract: 'ritual/1', subject: 'org/ritualos', generated: '2026-09-26T00:00:00Z',
    liturgies: [{ id: 'daily', title: 'Daily Office', cadence: 'daily', rite: ['x'], published_by: 'person/m' }],
    observances: [
      { id: 'o1', liturgy: 'daily', performer: 'agent/ci', for: 'org/ritualos', evidence: 'https://e/1', state: 'consecrated', witness: { by: 'org/w', basis: 'https://w/1' }, consecration: { by: 'person/m' } },
      { id: 'o2', liturgy: 'daily', performer: 'agent/ci', for: 'org/ritualos', evidence: 'https://e/2', state: 'performed' }
    ]
  });

  const fetcher = memoryFetcher({
    'https://acme.com/.well-known/intent.json': { status: 200, body: intentFrag },
    'https://ritualos.com/.well-known/ritual.json': { status: 200, body: ritualFrag },
    'https://down.example/.well-known/intent.json': new Error('ECONNREFUSED')
  });

  const report = await consume(fetcher, [
    'https://acme.com/.well-known/intent.json',
    'https://ritualos.com/.well-known/ritual.json',
    'https://down.example/.well-known/intent.json',
    'https://never-published.example/.well-known/intent.json'
  ]);

  console.log('Source states:');
  for (const s of report.sources) console.log(`  ${s.state.padEnd(12)} ${s.url}`);
  console.log('\nCounts:', JSON.stringify(report.counts));
  console.log('Merged intents:', report.intents.length, '→', report.intents.map((i) => i.id).join(', '));
  console.log('Ritual summary:', JSON.stringify(report.ritual));
  console.log('Note:', report.note, '\n');

  // The null-is-never-zero case: every ritual source down.
  const allDown = await consume(memoryFetcher({}), ['https://a.example/.well-known/ritual.json']);
  console.log('All ritual sources absent → ritual =', JSON.stringify(allDown.ritual), '(null, not {performed:0})');

  console.log('\n=== Example 14 Complete ===');
  return report;
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
