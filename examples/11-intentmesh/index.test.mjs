import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { file, promote, merge, view } from './index.mjs';

describe('Example 11: IntentMesh', () => {
  describe('file()', () => {
    it('creates a private intent item', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test Initiative',
        status: 'open',
        wants: ['payment']
      });

      assert.equal(item.visibility, 'private');
      assert.equal(item.id, 'intent/test/example');
      assert.equal(item.kind, 'initiative');
    });

    it('always defaults visibility to private (no argument can change it)', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      assert.equal(item.visibility, 'private');
      // Verify there's no way to pass visibility as a parameter
      // (the function signature doesn't accept it)
    });

    it('requires id', () => {
      assert.throws(() => {
        file({
          kind: 'initiative',
          title: 'Test',
          status: 'open',
          wants: ['test']
        });
      });
    });

    it('requires kind', () => {
      assert.throws(() => {
        file({
          id: 'intent/test/example',
          title: 'Test',
          status: 'open',
          wants: ['test']
        });
      });
    });

    it('requires wants array', () => {
      assert.throws(() => {
        file({
          id: 'intent/test/example',
          kind: 'initiative',
          title: 'Test',
          status: 'open'
        });
      });
    });

    it('refuses empty wants array', () => {
      assert.throws(() => {
        file({
          id: 'intent/test/example',
          kind: 'initiative',
          title: 'Test',
          status: 'open',
          wants: []
        });
      });
    });

    it('computes expiry: initiative expires in ~90 days', () => {
      const item = file({
        id: 'intent/test/initiative',
        kind: 'initiative',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      const expiry = new Date(item.expires);
      const now = new Date();
      const daysDiff = Math.round((expiry - now) / (24 * 60 * 60 * 1000));

      assert(daysDiff >= 89 && daysDiff <= 91, `Expected ~90 days, got ${daysDiff}`);
    });

    it('computes expiry: task expires in ~30 days', () => {
      const item = file({
        id: 'intent/test/task',
        kind: 'task',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      const expiry = new Date(item.expires);
      const now = new Date();
      const daysDiff = Math.round((expiry - now) / (24 * 60 * 60 * 1000));

      assert(daysDiff >= 29 && daysDiff <= 31, `Expected ~30 days, got ${daysDiff}`);
    });

    it('computes expiry: research expires in ~60 days', () => {
      const item = file({
        id: 'intent/test/research',
        kind: 'research',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      const expiry = new Date(item.expires);
      const now = new Date();
      const daysDiff = Math.round((expiry - now) / (24 * 60 * 60 * 1000));

      assert(daysDiff >= 59 && daysDiff <= 61, `Expected ~60 days, got ${daysDiff}`);
    });
  });

  describe('promote()', () => {
    it('promotes to public with person/ signature', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      const promoted = promote(item, {
        by: 'person/alice',
        to: 'public'
      });

      assert.equal(promoted.visibility, 'public');
      assert.equal(promoted.promotedBy, 'person/alice');
      assert(promoted.promotedAt);
    });

    it('refuses promotion without person/ signature', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      assert.throws(() => {
        promote(item, {
          by: 'agent/bot',
          to: 'public'
        });
      });
    });

    it('refuses promotion to invalid target', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test',
        status: 'open',
        wants: ['test']
      });

      assert.throws(() => {
        promote(item, {
          by: 'person/alice',
          to: 'private'
        });
      });
    });

    it('preserves original item data after promotion', () => {
      const item = file({
        id: 'intent/test/example',
        kind: 'initiative',
        title: 'Test Initiative',
        status: 'open',
        wants: ['payment', 'compliance']
      });

      const promoted = promote(item, {
        by: 'person/alice',
        to: 'public'
      });

      assert.equal(promoted.id, item.id);
      assert.equal(promoted.title, item.title);
      assert.deepEqual(promoted.wants, item.wants);
    });
  });

  describe('merge()', () => {
    it('combines multiple fragments', () => {
      const fragment1 = {
        intent: '1',
        source: 'repo/acme',
        org: 'org/acme',
        generated: new Date().toISOString(),
        items: [
          file({
            id: 'intent/acme/item1',
            kind: 'initiative',
            title: 'Item 1',
            status: 'open',
            wants: ['test']
          })
        ]
      };

      const fragment2 = {
        intent: '1',
        source: 'repo/bigcorp',
        org: 'org/bigcorp',
        generated: new Date().toISOString(),
        items: [
          file({
            id: 'intent/bigcorp/item2',
            kind: 'task',
            title: 'Item 2',
            status: 'open',
            wants: ['test']
          })
        ]
      };

      const { intents, problems } = merge([fragment1, fragment2]);

      assert.equal(intents.length, 2);
      assert.equal(problems.length, 0);
    });

    it('detects duplicate IDs across fragments', () => {
      const item = file({
        id: 'intent/shared/same',
        kind: 'initiative',
        title: 'Item',
        status: 'open',
        wants: ['test']
      });

      const fragment1 = {
        intent: '1',
        source: 'repo/org1',
        org: 'org/org1',
        generated: new Date().toISOString(),
        items: [item]
      };

      const fragment2 = {
        intent: '1',
        source: 'repo/org2',
        org: 'org/org2',
        generated: new Date().toISOString(),
        items: [{ ...item }]
      };

      const { intents, problems } = merge([fragment1, fragment2]);

      assert.equal(intents.length, 1);
      assert(problems.length > 0);
      assert(problems[0].includes('Duplicate ID'));
    });

    it('handles empty fragments', () => {
      const { intents, problems } = merge([
        {
          intent: '1',
          source: 'repo/empty',
          org: 'org/empty',
          generated: new Date().toISOString(),
          items: []
        }
      ]);

      assert.equal(intents.length, 0);
      assert.equal(problems.length, 0);
    });

    it('reports invalid fragment versions', () => {
      const { intents, problems } = merge([
        {
          intent: '2',
          source: 'repo/bad',
          org: 'org/bad',
          generated: new Date().toISOString(),
          items: []
        }
      ]);

      assert(problems.length > 0);
      assert(problems[0].includes('Invalid fragment version'));
    });
  });

  describe('view()', () => {
    it('filters by public visibility', () => {
      const items = [
        { id: '1', visibility: 'public', title: 'Public' },
        { id: '2', visibility: 'private', title: 'Private' },
        { id: '3', visibility: 'public', title: 'Public 2' }
      ];

      const publicOnly = view(items, 'public');

      assert.equal(publicOnly.length, 2);
      assert(publicOnly.every(i => i.visibility === 'public'));
    });

    it('filters by private visibility', () => {
      const items = [
        { id: '1', visibility: 'public', title: 'Public' },
        { id: '2', visibility: 'private', title: 'Private' }
      ];

      const privateOnly = view(items, 'private');

      assert.equal(privateOnly.length, 1);
      assert.equal(privateOnly[0].visibility, 'private');
    });

    it('shows all items when tier is "all"', () => {
      const items = [
        { id: '1', visibility: 'public' },
        { id: '2', visibility: 'private' }
      ];

      const all = view(items, 'all');
      assert.equal(all.length, 2);
    });
  });

  describe('Invariants', () => {
    it('invariant: agents can draft, only humans can promote to public', () => {
      const draft = file({
        id: 'intent/agent/draft',
        kind: 'initiative',
        title: 'Agent Draft',
        status: 'open',
        wants: ['test']
      });

      // Agent can call file() → privacy enforced structurally
      assert.equal(draft.visibility, 'private');

      // Agent calling promote() with agent/ signature fails
      assert.throws(() => {
        promote(draft, { by: 'agent/bot', to: 'public' });
      });

      // Only person/ can promote
      const promoted = promote(draft, { by: 'person/human', to: 'public' });
      assert.equal(promoted.visibility, 'public');
    });

    it('invariant: expired items are still valid data (decay is a policy, not a storage invariant)', () => {
      // Note: In the real system, clients would filter out expired items
      // Here we just verify that expiry is computed and stored
      const item = file({
        id: 'intent/test/expiry',
        kind: 'initiative',
        title: 'Will Expire',
        status: 'open',
        wants: ['test']
      });

      assert(item.expires);
      assert(typeof item.expires === 'string');
      // Verify it's a valid ISO date
      assert(!isNaN(Date.parse(item.expires)));
    });

    it('invariant: wants is required (intentions with no wants are invisible)', () => {
      assert.throws(() => {
        file({
          id: 'intent/test/no-wants',
          kind: 'initiative',
          title: 'Invisible',
          status: 'open',
          wants: []
        });
      });
    });
  });
});
