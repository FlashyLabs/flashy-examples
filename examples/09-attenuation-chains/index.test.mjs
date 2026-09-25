import { test } from 'node:test';
import assert from 'node:assert';
import { FlashyID } from '@flashyid/sdk';

test('Attenuation: grant narrows only', async (t) => {
  const flashyId = new FlashyID();

  const root = flashyId.createGrant({
    subject: 'person/alice',
    cap: 1000,
    expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  });

  const child = flashyId.attenuate(root, {
    subject: 'person/bob',
    cap: 500,
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  assert.ok(child.cap <= root.cap, 'Child cap narrower than parent');
  assert.ok(child.expiry <= root.expiry, 'Child expiry earlier than parent');
});

test('Attenuation: widening rejected', async (t) => {
  const flashyId = new FlashyID();

  const root = flashyId.createGrant({
    subject: 'person/alice',
    cap: 500,
    expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  });

  assert.throws(
    () => flashyId.attenuate(root, {
      subject: 'person/bob',
      cap: 1000,  // WIDER
      expiry: root.expiry
    }),
    /widen|exceed|invalid/i
  );
});

test('Attenuation: revocation cascades to children', async (t) => {
  const flashyId = new FlashyID();

  const root = flashyId.createGrant({
    subject: 'person/alice',
    cap: 1000,
    expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  });

  const child = flashyId.attenuate(root, {
    subject: 'person/bob',
    cap: 500,
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  flashyId.revoke(root.id);

  assert.throws(
    () => flashyId.verify(child.id),
    /revoked|invalid/i,
    'Child grant invalid after parent revocation'
  );
});
