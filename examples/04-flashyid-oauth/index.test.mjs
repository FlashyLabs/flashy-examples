import { test } from 'node:test';
import assert from 'node:assert';
import { mintGrant, attenuate, verifyGrant } from '@flashyid/sdk';

test('FlashyID: mint grant for user', async () => {
  const subject = 'user:alice:12345';

  const grant = mintGrant(subject, {
    cap: 100,
    expiry: Date.now() + 1000000
  });

  assert.equal(grant.subject, subject);
  assert.equal(grant.cap, 100);
  assert(grant.expiry > Date.now());
});

test('FlashyID: attenuate narrows grant', async () => {
  const grant = mintGrant('user:alice', {
    cap: 100,
    expiry: Date.now() + 1000000
  });

  const attenuated = attenuate(grant, {
    cap: 50,
    expiry: grant.expiry
  });

  assert.equal(attenuated.cap, 50);
  assert(attenuated.cap < grant.cap);
});

test('FlashyID: cannot widen grant', async () => {
  const grant = mintGrant('user:alice', {
    cap: 50,
    expiry: Date.now() + 1000000
  });

  await assert.rejects(
    () => attenuate(grant, { cap: 100, expiry: grant.expiry }),
    /cannot widen grant/i
  );
});

test('FlashyID: cannot extend expiry', async () => {
  const now = Date.now();
  const grant = mintGrant('user:alice', {
    cap: 100,
    expiry: now + 1000000
  });

  await assert.rejects(
    () => attenuate(grant, { cap: 50, expiry: now + 2000000 }),
    /cannot extend expiry/i
  );
});

test('FlashyID: expired grant refuses operations', async () => {
  const grant = mintGrant('user:alice', {
    cap: 100,
    expiry: Date.now() - 1000 // Already expired
  });

  const isValid = verifyGrant(grant);
  assert(!isValid, 'Grant should be expired');
});

test('FlashyID: delegation chain is auditable', async () => {
  const grant1 = mintGrant('user:alice', {
    cap: 100,
    expiry: Date.now() + 1000000
  });

  const grant2 = attenuate(grant1, {
    cap: 50,
    expiry: grant1.expiry
  });

  const grant3 = attenuate(grant2, {
    cap: 25,
    expiry: grant2.expiry
  });

  const chain = grant3.delegationChain();

  assert.equal(chain.length, 3);
  assert.equal(chain[0].action, 'mint');
  assert.equal(chain[1].action, 'attenuate');
  assert.equal(chain[2].action, 'attenuate');
  assert.equal(chain[0].cap, 100);
  assert.equal(chain[1].cap, 50);
  assert.equal(chain[2].cap, 25);
});

test('FlashyID: subject binding persists', async () => {
  const subject = 'user:alice:unique-id';
  const grant = mintGrant(subject, {
    cap: 100,
    expiry: Date.now() + 1000000
  });

  const attenuated = attenuate(grant, {
    cap: 50,
    expiry: grant.expiry
  });

  assert.equal(attenuated.subject, subject);
  assert.equal(attenuated.subject, grant.subject);
});
