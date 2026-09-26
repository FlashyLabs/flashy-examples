import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WELL_KNOWN,
  createFragment,
  publishLiturgy,
  observe,
  witness,
  consecrate,
  voidObservance,
  metrics,
  project,
  validateFragment
} from './index.mjs';

const LITURGY = {
  id: 'daily-office',
  title: 'The Daily Office',
  cadence: 'daily',
  rite: ['refresh the fragment', 'seal the log'],
  published_by: 'person/michael',
  since: '2026-09-01T00:00:00Z'
};

const OBS = {
  id: 'obs-1',
  liturgy: 'daily-office',
  performer: 'agent/ritualos-ci',
  for: 'org/ritualos',
  at: '2026-09-26T04:00:00Z',
  recorded: '2026-09-26T04:00:05Z',
  evidence: 'https://github.com/FlashyLabs/ritualos/actions/runs/9001'
};

const WITNESS = { by: 'org/gda-capital', basis: 'https://gda.group/.well-known/dir.json', at: '2026-09-26T05:00:00Z' };

function base() {
  return publishLiturgy(createFragment({ subject: 'org/ritualos', generated: '2026-09-26T06:00:00Z' }), LITURGY);
}

describe('Example 12: ritual/1', () => {
  describe('fragment + liturgy', () => {
    it('creates an empty, valid fragment', () => {
      const f = createFragment({ subject: 'org/ritualos' });
      assert.equal(f.contract, 'ritual/1');
      assert.deepEqual(f.liturgies, []);
      assert.deepEqual(f.observances, []);
      assert.equal(validateFragment(f).valid, true);
    });

    it('serves at one well-known path', () => {
      assert.equal(WELL_KNOWN, '/.well-known/ritual.json');
    });

    it('publishes a liturgy', () => {
      const f = base();
      assert.equal(f.liturgies.length, 1);
      assert.equal(f.liturgies[0].id, 'daily-office');
    });

    it('refuses a cadence outside the closed list', () => {
      assert.throws(() => publishLiturgy(createFragment({ subject: 'org/x' }), { ...LITURGY, cadence: 'hourly' }), /cadence/);
    });

    it('refuses a liturgy with no rite', () => {
      assert.throws(() => publishLiturgy(createFragment({ subject: 'org/x' }), { ...LITURGY, rite: [] }), /no rite/);
    });

    it('refuses a liturgy published by a non-person', () => {
      assert.throws(() => publishLiturgy(createFragment({ subject: 'org/x' }), { ...LITURGY, published_by: 'agent/ci' }), /published_by/);
    });
  });

  describe('observe() — the only door in', () => {
    it('records an observance at state performed', () => {
      const f = observe(base(), OBS);
      assert.equal(f.observances[0].state, 'performed');
    });

    it('refuses an asserted state', () => {
      assert.throws(() => observe(base(), { ...OBS, state: 'consecrated' }), /arrives performed/);
    });

    it('refuses an asserted witness block', () => {
      assert.throws(() => observe(base(), { ...OBS, witness: WITNESS }), /arrives performed/);
    });

    it('refuses a performer that is not an agent', () => {
      assert.throws(() => observe(base(), { ...OBS, performer: 'person/alice' }), /performer must be an agent/);
    });

    it('refuses an observance of a liturgy that does not exist', () => {
      assert.throws(() => observe(base(), { ...OBS, liturgy: 'nope' }), /activity, not practice/);
    });

    it('refuses evidence that is not an https URL', () => {
      assert.throws(() => observe(base(), { ...OBS, evidence: 'ftp://x' }), /evidence must be an https URL/);
    });

    it('refuses recorded preceding at', () => {
      assert.throws(() => observe(base(), { ...OBS, at: '2026-09-26T05:00:00Z', recorded: '2026-09-26T04:00:00Z' }), /recorded may not precede at/);
    });
  });

  describe('witness() — a second party', () => {
    it('transitions performed to witnessed', () => {
      const f = witness(observe(base(), OBS), 'obs-1', WITNESS);
      assert.equal(f.observances[0].state, 'witnessed');
      assert.equal(f.observances[0].witness.by, 'org/gda-capital');
    });

    it('refuses self-witness by the performer', () => {
      const f = observe(base(), OBS);
      assert.throws(() => witness(f, 'obs-1', { ...WITNESS, by: 'agent/ritualos-ci' }), /self-witness/);
    });

    it('refuses self-witness by the principal', () => {
      const f = observe(base(), OBS);
      assert.throws(() => witness(f, 'obs-1', { ...WITNESS, by: 'org/ritualos' }), /self-witness/);
    });

    it('refuses a witness basis that is not https', () => {
      const f = observe(base(), OBS);
      assert.throws(() => witness(f, 'obs-1', { ...WITNESS, basis: 'http://x' }), /basis must be the witness/);
    });

    it('refuses witnessing an observance that is not performed', () => {
      const f = witness(observe(base(), OBS), 'obs-1', WITNESS);
      assert.throws(() => witness(f, 'obs-1', WITNESS), /only a performed observance/);
    });
  });

  describe('consecrate() — a named human', () => {
    it('transitions witnessed to consecrated', () => {
      const f = consecrate(witness(observe(base(), OBS), 'obs-1', WITNESS), 'obs-1', { by: 'person/michael' });
      assert.equal(f.observances[0].state, 'consecrated');
      assert.equal(f.observances[0].consecration.by, 'person/michael');
    });

    it('refuses consecration by a non-person', () => {
      const f = witness(observe(base(), OBS), 'obs-1', WITNESS);
      assert.throws(() => consecrate(f, 'obs-1', { by: 'agent/ci' }), /consecration.by must be a person/);
    });

    it('refuses consecrating an unwitnessed observance', () => {
      const f = observe(base(), OBS);
      assert.throws(() => consecrate(f, 'obs-1', { by: 'person/michael' }), /unwitnessed observance cannot be consecrated/);
    });
  });

  describe('the four refusals', () => {
    it('refuses any money/amount/score field', () => {
      for (const banned of ['amount', 'value', 'reward', 'score', 'gold', 'points']) {
        assert.throws(() => observe(base(), { ...OBS, [banned]: 1 }), /refuses money/);
      }
    });

    it('append-only: void supersedes, never edits', () => {
      const f = voidObservance(observe(base(), OBS), 'obs-1', { id: 'obs-1-void', reason: 'wrong run' });
      assert.equal(f.observances.length, 2);
      assert.equal(f.observances[1].state, 'void');
      assert.equal(f.observances[1].supersedes, 'obs-1');
    });

    it('refuses a void that supersedes nothing real', () => {
      assert.throws(() => voidObservance(base(), 'ghost', { id: 'v' }), /must supersede a real observance/);
    });
  });

  describe('immutability', () => {
    it('every transition returns a new fragment, mutating nothing', () => {
      const f0 = base();
      const f1 = observe(f0, OBS);
      const f2 = witness(f1, 'obs-1', WITNESS);
      assert.equal(f0.observances.length, 0);
      assert.equal(f1.observances.length, 1);
      assert.equal(f1.observances[0].state, 'performed');
      assert.equal(f2.observances[0].state, 'witnessed');
    });
  });

  describe('metrics + projection (the anti-metric)', () => {
    it('metrics ship witnessed and consecrated with the raw count', () => {
      let f = base();
      f = observe(f, OBS);
      f = observe(f, { ...OBS, id: 'obs-2' });
      f = witness(f, 'obs-2', WITNESS);
      const m = metrics(f);
      assert.deepEqual(m, { performed: 2, witnessed: 1, consecrated: 0 });
    });

    it('void observances drop out of the raw count', () => {
      let f = observe(base(), OBS);
      f = voidObservance(f, 'obs-1', { id: 'v' });
      assert.equal(metrics(f).performed, 0);
    });

    it('projection carries a note stating the consecrated share and keeps evidence', () => {
      let f = consecrate(witness(observe(base(), OBS), 'obs-1', WITNESS), 'obs-1', { by: 'person/michael' });
      const p = project(f);
      assert.match(p.note, /1 of 1 observances carry consequence/);
      assert.equal(p.observances[0].evidence, OBS.evidence);
    });
  });
});
