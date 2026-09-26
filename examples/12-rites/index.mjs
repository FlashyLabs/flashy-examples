/**
 * Example 12: Rites — the ritual/1 present tense
 *
 * A faithful, dependency-free model of ritual/1 (Rites-Network/SPEC.md): the
 * recurring, witnessed, consequence-bearing act. A subject publishes LITURGIES
 * (recurring rites on a cadence) and records OBSERVANCES against them. Each
 * observance climbs a state ladder by transition, never by assertion:
 *
 *     performed  ->  witnessed  ->  consecrated        (or  void)
 *
 * The four refusals this format outranks everything with:
 *   1. Agents observe; humans consecrate. performer is agent/; consecration.by
 *      is person/ and nothing else.
 *   2. Standing comes from what others assert. A witness may be neither the
 *      performer nor its principal; self-witness throws.
 *   3. No money, no amounts, no scores — ever. Accrual is a separate reward/1.
 *   4. The log is append-only. A correction is a new `void` observance whose
 *      `supersedes` names the old one; nothing is edited or deleted.
 *
 * Every transition returns a NEW fragment and re-validates the whole thing.
 * Nothing mutates.
 */

export const WELL_KNOWN = '/.well-known/ritual.json';

const CADENCES = ['daily', 'weekly', 'monthly', 'seasonal', 'once'];
const STATES = ['performed', 'witnessed', 'consecrated', 'void'];

const isPerson = (id) => typeof id === 'string' && id.startsWith('person/');
const isAgent = (id) => typeof id === 'string' && id.startsWith('agent/');
const isOrgOrPerson = (id) =>
  typeof id === 'string' && (id.startsWith('org/') || id.startsWith('person/'));
const isHttps = (u) => typeof u === 'string' && u.startsWith('https://');

/** Deep clone so a returned fragment never shares structure with its input. */
const clone = (x) => JSON.parse(JSON.stringify(x));

/**
 * Validate a whole fragment. Every transition calls this and refuses on any
 * problem — the ladder is climbed by transition, never by asserting a state.
 */
export function validateFragment(fragment) {
  const errors = [];
  const f = fragment;

  if (!f || typeof f !== 'object') return { valid: false, errors: ['not an object'] };
  if (f.contract !== 'ritual/1') errors.push('contract must be "ritual/1"');
  if (!isOrgOrPerson(f.subject)) errors.push('subject must be an org/ or person/ id');
  if (typeof f.generated !== 'string') errors.push('generated is missing');
  if (!Array.isArray(f.liturgies)) errors.push('liturgies must be an array');
  if (!Array.isArray(f.observances)) errors.push('observances must be an array');

  const liturgyIds = new Set();
  for (const l of f.liturgies ?? []) {
    if (!l.id) errors.push('liturgy: missing id');
    else if (liturgyIds.has(l.id)) errors.push(`duplicate liturgy id ${l.id}`);
    else liturgyIds.add(l.id);
    if (!l.title) errors.push(`liturgy ${l.id}: missing title`);
    if (!CADENCES.includes(l.cadence)) errors.push(`liturgy ${l.id}: cadence not one of ${CADENCES.join('/')}`);
    if (!Array.isArray(l.rite) || l.rite.length < 1) errors.push(`liturgy ${l.id}: a liturgy with no rite is a name with no practice`);
    if (!isPerson(l.published_by)) errors.push(`liturgy ${l.id}: published_by must be a person/ id`);
  }

  const obsIds = new Set();
  for (const o of f.observances ?? []) {
    if (!o.id) errors.push('observance: missing id');
    else if (obsIds.has(o.id)) errors.push(`duplicate observance id ${o.id}`);
    else obsIds.add(o.id);
    if (!STATES.includes(o.state)) errors.push(`observance ${o.id}: unknown state`);

    if (o.state === 'void') {
      if (!o.supersedes) errors.push(`observance ${o.id}: a void must supersede another observance`);
      continue;
    }

    if (!liturgyIds.has(o.liturgy)) errors.push(`observance ${o.id}: an observance of nothing is activity, not practice`);
    if (!isAgent(o.performer)) errors.push(`observance ${o.id}: performer must be an agent/ id`);
    if (!isOrgOrPerson(o.for)) errors.push(`observance ${o.id}: for must be an org/ or person/ id`);
    if (!isHttps(o.evidence)) errors.push(`observance ${o.id}: evidence must be an https URL a stranger can open`);
    if (o.recorded && o.at && o.recorded < o.at) errors.push(`observance ${o.id}: recorded may not precede at`);

    // No money, no amounts, no scores — ever (refusal 3).
    for (const banned of ['amount', 'value', 'reward', 'score', 'gold', 'points']) {
      if (banned in o) errors.push(`observance ${o.id}: carries "${banned}" — ritual/1 refuses money; accrual is a separate reward/1`);
    }

    const hasWitness = !!o.witness;
    const hasConsecration = !!o.consecration;
    if (o.state === 'performed' && (hasWitness || hasConsecration)) {
      errors.push(`observance ${o.id}: performed carries no witness/consecration — the ladder is climbed by transition`);
    }
    if (o.state === 'witnessed' || o.state === 'consecrated') {
      if (!hasWitness) errors.push(`observance ${o.id}: ${o.state} requires a witness block`);
      else {
        if (!isOrgOrPerson(o.witness.by)) errors.push(`observance ${o.id}: witness.by must be an org/ or person/ id`);
        if (o.witness.by === o.performer || o.witness.by === o.for) errors.push(`observance ${o.id}: self-witness — witness must be neither performer nor principal`);
        if (!isHttps(o.witness.basis)) errors.push(`observance ${o.id}: witness.basis must be the witness's own https URL`);
      }
    }
    if (o.state === 'consecrated') {
      if (!hasConsecration) errors.push(`observance ${o.id}: consecrated requires a consecration block`);
      else if (!isPerson(o.consecration.by)) errors.push(`observance ${o.id}: consecration.by must be a person/ id`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function guard(fragment) {
  const { valid, errors } = validateFragment(fragment);
  if (!valid) throw new Error(`ritual/1 refuses: ${errors.join('; ')}`);
  return fragment;
}

/** A fresh, empty calendar for one subject. */
export function createFragment({ subject, generated = new Date().toISOString() }) {
  return guard({ contract: 'ritual/1', subject, generated, liturgies: [], observances: [] });
}

/** Publish a recurring rite. A person publishes it — publishing asks agents to act. */
export function publishLiturgy(fragment, liturgy) {
  const next = clone(fragment);
  next.liturgies.push({ ...liturgy });
  return guard(next);
}

/**
 * The only door in. An observance arrives `performed`. Passing state, witness
 * or consecration throws — you cannot assert your way up the ladder.
 */
export function observe(fragment, observance) {
  if ('state' in observance || 'witness' in observance || 'consecration' in observance) {
    throw new Error('ritual/1 refuses: an observance arrives performed; pass no state, witness or consecration');
  }
  const next = clone(fragment);
  next.observances.push({
    ...observance,
    recorded: observance.recorded ?? new Date().toISOString(),
    state: 'performed'
  });
  return guard(next);
}

/** A second party attests. Self-witness throws. Returns a new fragment. */
export function witness(fragment, id, { by, basis, at }) {
  const next = clone(fragment);
  const o = next.observances.find((x) => x.id === id);
  if (!o) throw new Error(`ritual/1 refuses: no observance ${id}`);
  if (o.state !== 'performed') throw new Error(`ritual/1 refuses: only a performed observance can be witnessed (${id} is ${o.state})`);
  o.witness = { by, basis, at: at ?? new Date().toISOString() };
  o.state = 'witnessed';
  return guard(next);
}

/** A named human confers consequence. Non-person or unwitnessed throws. */
export function consecrate(fragment, id, { by, at }) {
  const next = clone(fragment);
  const o = next.observances.find((x) => x.id === id);
  if (!o) throw new Error(`ritual/1 refuses: no observance ${id}`);
  if (o.state !== 'witnessed') throw new Error(`ritual/1 refuses: an unwitnessed observance cannot be consecrated (${id} is ${o.state})`);
  o.consecration = { by, at: at ?? new Date().toISOString() };
  o.state = 'consecrated';
  return guard(next);
}

/** Correct by appending a void that names the observance it replaces. */
export function voidObservance(fragment, supersedesId, { id, reason }) {
  const next = clone(fragment);
  if (!next.observances.some((x) => x.id === supersedesId)) {
    throw new Error(`ritual/1 refuses: a void must supersede a real observance (${supersedesId} not found)`);
  }
  next.observances.push({ id, state: 'void', supersedes: supersedesId, ...(reason ? { reason } : {}) });
  return guard(next);
}

/**
 * Metrics ship witnessed and consecrated WITH the raw count, so a renderer
 * cannot take the flattering number alone. Raw volume is the anti-metric.
 */
export function metrics(fragment) {
  const superseded = new Set(
    fragment.observances.filter((o) => o.state === 'void').map((o) => o.supersedes)
  );
  const live = fragment.observances.filter((o) => o.state !== 'void' && !superseded.has(o.id));
  const performed = live.length;
  const witnessed = live.filter((o) => o.state === 'witnessed' || o.state === 'consecrated').length;
  const consecrated = live.filter((o) => o.state === 'consecrated').length;
  return { performed, witnessed, consecrated };
}

/**
 * The public projection: the whole fragment plus a note a renderer may not
 * drop, stating how many observances carry consequence. It keeps the evidence
 * URLs — a summary that strips them keeps the flattering digits, which is the
 * anti-metric run backwards.
 */
export function project(fragment) {
  const m = metrics(fragment);
  return {
    ...clone(fragment),
    note: `${m.consecrated} of ${m.performed} observances carry consequence (consecrated); ${m.witnessed} witnessed.`
  };
}

/** Main example. */
export async function run() {
  console.log('=== Example 12: Rites — the ritual/1 present tense ===\n');

  // 1. A subject opens its calendar and publishes a liturgy
  let frag = createFragment({ subject: 'org/ritualos', generated: '2026-09-26T06:00:00Z' });
  frag = publishLiturgy(frag, {
    id: 'daily-office',
    title: 'The Daily Office',
    cadence: 'daily',
    rite: ['refresh the fragment', 'seal the log', 'dispatch to the merge'],
    published_by: 'person/michael',
    since: '2026-09-01T00:00:00Z'
  });
  console.log('1. Published liturgy "daily-office" (cadence: daily)\n');

  // 2. An agent performs and records an observance (arrives performed)
  frag = observe(frag, {
    id: 'obs-2026-09-26-ritualos',
    liturgy: 'daily-office',
    performer: 'agent/ritualos-ci',
    for: 'org/ritualos',
    at: '2026-09-26T04:00:00Z',
    recorded: '2026-09-26T04:00:05Z',
    evidence: 'https://github.com/FlashyLabs/ritualos/actions/runs/9001'
  });
  console.log('2. Observance recorded, state =', frag.observances[0].state);

  // 3. Refusal: you cannot assert your way up the ladder
  try {
    observe(frag, { id: 'x', liturgy: 'daily-office', performer: 'agent/x', for: 'org/ritualos', evidence: 'https://e.example/1', state: 'consecrated' });
  } catch (e) {
    console.log('   Refused an asserted state:', e.message.split(':').slice(1).join(':').trim(), '\n');
  }

  // 4. An independent party witnesses it (self-witness throws)
  try {
    witness(frag, 'obs-2026-09-26-ritualos', { by: 'org/ritualos', basis: 'https://ritualos.com/x', at: '2026-09-26T05:00:00Z' });
  } catch (e) {
    console.log('3. Self-witness refused:', e.message.split(':').slice(1).join(':').trim());
  }
  frag = witness(frag, 'obs-2026-09-26-ritualos', {
    by: 'org/gda-capital',
    basis: 'https://gda.group/.well-known/flashyos-directory.json',
    at: '2026-09-26T05:00:00Z'
  });
  console.log('   Witnessed by an independent party, state =', frag.observances[0].state, '\n');

  // 5. A human consecrates (non-person throws)
  try {
    consecrate(frag, 'obs-2026-09-26-ritualos', { by: 'agent/ritualos-ci', at: '2026-09-26T06:00:00Z' });
  } catch (e) {
    console.log('4. Machine consecration refused:', e.message.split(':').slice(1).join(':').trim());
  }
  frag = consecrate(frag, 'obs-2026-09-26-ritualos', { by: 'person/michael', at: '2026-09-26T06:00:00Z' });
  console.log('   Consecrated by a named human, state =', frag.observances[0].state, '\n');

  // 6. Reward coupling is refused
  try {
    observe(frag, { id: 'r', liturgy: 'daily-office', performer: 'agent/x', for: 'org/ritualos', evidence: 'https://e.example/2', amount: 100 });
  } catch (e) {
    console.log('5. Reward coupling refused:', e.message.split('refuses:').slice(1).join('').trim(), '\n');
  }

  // 7. Metrics ship witnessed/consecrated WITH the raw count
  console.log('6. Metrics:', JSON.stringify(metrics(frag)));

  // 8. The public projection carries the anti-metric note
  console.log('7. Projection note:', project(frag).note);
  console.log('   Served at', WELL_KNOWN, '\n');

  console.log('=== Example 12 Complete ===');
  return { fragment: frag, metrics: metrics(frag) };
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
