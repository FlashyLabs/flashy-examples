import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATES,
  readSource,
  mergeIntents,
  summarizeRituals,
  consume,
  memoryFetcher
} from './index.mjs';

const intentBody = (items) => JSON.stringify({ intent: '1', source: 'repo/x', org: 'org/x', generated: 't', items });
const ritualBody = (observances) => JSON.stringify({
  contract: 'ritual/1', subject: 'org/x', generated: 't',
  liturgies: [{ id: 'l', title: 'L', cadence: 'daily', rite: ['x'], published_by: 'person/m' }],
  observances
});

const okObs = (id, state) => ({
  id, liturgy: 'l', performer: 'agent/ci', for: 'org/x', evidence: `https://e/${id}`, state,
  ...(state !== 'performed' ? { witness: { by: 'org/w', basis: 'https://w/1' } } : {}),
  ...(state === 'consecrated' ? { consecration: { by: 'person/m' } } : {})
});

describe('Example 14: mesh reference consumer', () => {
  describe('readSource() — the four findings', () => {
    it('reads a valid intent/1 fragment as ok', async () => {
      const f = memoryFetcher({ 'https://x.com/i.json': { status: 200, body: intentBody([]) } });
      const r = await readSource(f, 'https://x.com/i.json');
      assert.equal(r.state, 'ok');
      assert.equal(r.contract, 'intent/1');
    });

    it('reads a valid ritual/1 fragment as ok', async () => {
      const f = memoryFetcher({ 'https://x.com/r.json': { status: 200, body: ritualBody([]) } });
      const r = await readSource(f, 'https://x.com/r.json');
      assert.equal(r.state, 'ok');
      assert.equal(r.contract, 'ritual/1');
    });

    it('distinguishes absent (404) from unreachable (throw)', async () => {
      const f = memoryFetcher({ 'https://up.com/i.json': { status: 404 }, 'https://down.com/i.json': new Error('x') });
      assert.equal((await readSource(f, 'https://up.com/i.json')).state, 'absent');
      assert.equal((await readSource(f, 'https://down.com/i.json')).state, 'unreachable');
    });

    it('treats a null fetcher result as unreachable', async () => {
      const r = await readSource(async () => null, 'https://x.com/i.json');
      assert.equal(r.state, 'unreachable');
    });

    it('rejects non-https as invalid', async () => {
      const r = await readSource(memoryFetcher({}), 'http://x.com/i.json');
      assert.equal(r.state, 'invalid');
      assert.match(r.reason, /https/);
    });

    it('rejects non-JSON and unknown contracts as invalid', async () => {
      const f = memoryFetcher({
        'https://x.com/bad.json': { status: 200, body: 'not json' },
        'https://x.com/other.json': { status: 200, body: JSON.stringify({ contract: 'shiplog/1' }) }
      });
      assert.equal((await readSource(f, 'https://x.com/bad.json')).state, 'invalid');
      assert.equal((await readSource(f, 'https://x.com/other.json')).state, 'invalid');
    });

    it('follows one same-domain redirect but refuses a cross-host one', async () => {
      const f = memoryFetcher({
        'https://acme.com/i.json': { status: 301, location: 'https://www.acme.com/i.json' },
        'https://www.acme.com/i.json': { status: 200, body: intentBody([]) },
        'https://evil.com/i.json': { status: 301, location: 'https://other.com/i.json' }
      });
      assert.equal((await readSource(f, 'https://acme.com/i.json')).state, 'ok');
      const cross = await readSource(f, 'https://evil.com/i.json');
      assert.equal(cross.state, 'invalid');
      assert.match(cross.reason, /another host/);
    });

    it('exposes the four state names', () => {
      assert.deepEqual(STATES, ['ok', 'absent', 'unreachable', 'invalid']);
    });
  });

  describe('mergeIntents()', () => {
    it('dedups by id and flags duplicates', () => {
      const a = JSON.parse(intentBody([{ id: 'a' }, { id: 'b' }]));
      const b = JSON.parse(intentBody([{ id: 'b' }, { id: 'c' }]));
      const { intents, problems } = mergeIntents([a, b]);
      assert.deepEqual(intents.map((i) => i.id).sort(), ['a', 'b', 'c']);
      assert(problems.some((p) => p.includes('duplicate intent id b')));
    });
  });

  describe('summarizeRituals() — the anti-metric survives', () => {
    it('sums witnessed and consecrated with the raw count', () => {
      const f = JSON.parse(ritualBody([okObs('1', 'consecrated'), okObs('2', 'witnessed'), okObs('3', 'performed')]));
      assert.deepEqual(summarizeRituals([f]), { performed: 3, witnessed: 2, consecrated: 1 });
    });

    it('drops void and superseded observances from the raw count', () => {
      const f = JSON.parse(ritualBody([okObs('1', 'performed'), { id: 'v', state: 'void', supersedes: '1' }]));
      assert.deepEqual(summarizeRituals([f]), { performed: 0, witnessed: 0, consecrated: 0 });
    });

    it('returns null (never zero) when there are no fragments', () => {
      assert.equal(summarizeRituals([]), null);
    });
  });

  describe('consume() — the fold', () => {
    it('produces counts, merged intents, and a ritual summary', async () => {
      const f = memoryFetcher({
        'https://a.com/i.json': { status: 200, body: intentBody([{ id: 'a/1' }]) },
        'https://b.com/r.json': { status: 200, body: ritualBody([okObs('1', 'consecrated')]) }
      });
      const r = await consume(f, ['https://a.com/i.json', 'https://b.com/r.json']);
      assert.equal(r.counts.ok, 2);
      assert.deepEqual(r.intents.map((i) => i.id), ['a/1']);
      assert.deepEqual(r.ritual, { performed: 1, witnessed: 1, consecrated: 1 });
    });

    it('null is never zero: all ritual sources unreachable → ritual is null', async () => {
      const f = memoryFetcher({ 'https://down.com/r.json': new Error('x') });
      const r = await consume(f, ['https://down.com/r.json']);
      assert.equal(r.ritual, null);
      assert.equal(r.counts.unreachable, 1);
      assert.match(r.note, /connectivity/);
    });

    it('never throws — every source failure is a finding', async () => {
      const f = memoryFetcher({ 'https://x.com/i.json': new Error('x') });
      const r = await consume(f, ['https://x.com/i.json', 'http://bad', 'https://gone.com/i.json']);
      assert.equal(r.counts.unreachable, 1);
      assert.equal(r.counts.invalid, 1);
      assert.equal(r.counts.absent, 1);
    });

    it('strips fragment bodies from the reported sources (report stays small)', async () => {
      const f = memoryFetcher({ 'https://a.com/i.json': { status: 200, body: intentBody([{ id: 'a/1' }]) } });
      const r = await consume(f, ['https://a.com/i.json']);
      assert.equal(r.sources[0].fragment, undefined);
      assert.equal(r.sources[0].state, 'ok');
    });
  });
});
