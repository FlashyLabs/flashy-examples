import { test } from 'node:test';
import assert from 'node:assert';
import { Rails, toMinor, toGold } from '@flashylabs/rails';

test('Rails: draft does not execute until approved', async () => {
  const rails = new Rails();

  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));
  await rails.issue('bob', 'flashy-gold', toMinor('10.00'));

  const _draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00')
  });

  // Balance should not change before execution
  const balanceBefore = await rails.getBalance('alice', 'flashy-gold');
  assert.equal(toGold(balanceBefore), '100.00');
});

test('Rails: execution requires consent token', async () => {
  const rails = new Rails();

  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));

  const _draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00')
  });

  // Try to execute without consent token
  await assert.rejects(
    () => rails.execute(draft, null),
    /missing consent token/i
  );
});

test('Rails: execute updates ledger', async () => {
  const rails = new Rails();

  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));
  await rails.issue('bob', 'flashy-gold', toMinor('10.00'));

  const _draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00')
  });

  const token = await Rails.createConsentToken(draft);
  await rails.execute(draft, token);

  const aliceBalance = await rails.getBalance('alice', 'flashy-gold');
  const bobBalance = await rails.getBalance('bob', 'flashy-gold');

  assert.equal(toGold(aliceBalance), '75.00');
  assert.equal(toGold(bobBalance), '35.00');
});

test('Rails: execution is idempotent', async () => {
  const rails = new Rails();

  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));
  await rails.issue('bob', 'flashy-gold', toMinor('10.00'));

  const _draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00')
  });

  const token = await Rails.createConsentToken(draft);

  // Execute twice
  await rails.execute(draft, token);
  await rails.execute(draft, token);

  const aliceBalance = await rails.getBalance('alice', 'flashy-gold');
  const bobBalance = await rails.getBalance('bob', 'flashy-gold');

  // Should only transfer once
  assert.equal(toGold(aliceBalance), '75.00');
  assert.equal(toGold(bobBalance), '35.00');
});

test('Rails: attenuate narrows grant', async () => {
  const rails = new Rails();

  const fullGrant = rails.createGrant('alice', {
    cap: toMinor('100.00'),
    expiry: Date.now() + 1000000
  });

  const attenuated = rails.attenuate(fullGrant, {
    cap: toMinor('10.00'),
    expiry: fullGrant.expiry
  });

  assert.equal(attenuated.cap, toMinor('10.00'));
});

test('Rails: cannot widen grant', async () => {
  const rails = new Rails();

  const grant = rails.createGrant('alice', {
    cap: toMinor('50.00'),
    expiry: Date.now() + 1000000
  });

  await assert.rejects(
    () => rails.attenuate(grant, {
      cap: toMinor('100.00'), // Trying to widen
      expiry: grant.expiry
    }),
    /cannot widen grant/i
  );
});

test('Rails: revoked grant refuses execution', async () => {
  const rails = new Rails();

  await rails.issue('alice', 'flashy-gold', toMinor('100.00'));
  await rails.issue('bob', 'flashy-gold', toMinor('10.00'));

  const grant = rails.createGrant('alice', {
    cap: toMinor('100.00'),
    expiry: Date.now() + 1000000
  });

  rails.revoke(grant);

  const _draft = rails.draftTransfer({
    from: 'alice',
    to: 'bob',
    asset: 'flashy-gold',
    amount: toMinor('25.00')
  });

  const token = Rails.createConsentTokenWithGrant(draft, grant);

  await assert.rejects(
    () => rails.execute(draft, token),
    /grant revoked/i
  );
});
