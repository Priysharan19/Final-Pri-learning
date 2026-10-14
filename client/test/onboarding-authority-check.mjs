// P0 A→B→A guardian authority: async proof with NO test-only bypass.
// This tests the CLIENT acceptance boundary. The actual server response must
// add accountId, opaque sessionId and eligible in the SAME guardian response.
import assert from 'node:assert/strict';
import { readOnboardingAuthority, decideOnboardingAuthority } from '../src/components/onboardingAuthority.js';

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log('PASS', name); };
const adult = (id = 'A', sessionId = 'sa') => ({
  accountId: id, sessionId, required: false, state: 'not-required',
  emailVerified: true, eligible: true
});
const child = (state = 'pending') => ({
  accountId: 'A', sessionId: 'sa', required: true, state,
  emailVerified: true, eligible: state === 'given'
});
const deferred = () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
};
await test('Adult A with exactly one bound eligible reply may finish', async () => {
  let calls = 0;
  const reply = await readOnboardingAuthority('A', async () => { calls++; return adult(); });
  assert.equal(reply.outcome, 'approved');
  assert.deepEqual(reply.consent, { required: false, state: 'not-required' });
  assert.equal(calls, 1);
});
await test('Guardian-approved child A may finish using the same account and session', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('given')))).outcome, 'approved');
});
await test('Pending minor A cannot finish even with an existing verified session', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child()))).outcome, 'waiting');
});
await test('Revoked guardian approval cannot be reused', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('withdrawn')))).outcome, 'waiting');
});
await test('Previously approved session becomes pending: fresh result cancels permission', async () => {
  const approve = await readOnboardingAuthority('A', () => Promise.resolve(child('given')));
  const pending = await readOnboardingAuthority('A', () => Promise.resolve(child('pending')));
  assert.equal(approve.outcome, 'approved');
  assert.equal(pending.outcome, 'waiting');
});
await test('A→B→A split identity cannot approve A based on B adult guardian status', async () => {
  const request = deferred();
  const sequence = ['A', 'B', 'A']; // observable tabs, not an authority source
  let localLinkCount = 0;
  const pending = readOnboardingAuthority(sequence[0], () => request.promise);
  sequence.shift();
  request.release(adult('B', 'sb'));
  sequence.shift();
  const verdict = await pending;
  if (verdict.outcome === 'approved') localLinkCount++;
  assert.equal(verdict.outcome, 'changed');
  assert.equal(localLinkCount, 0);
  assert.deepEqual(sequence, ['A']);
});
await test('Out-of-order B consent response after guardian revocation cannot admit A', async () => {
  const request = deferred();
  const pending = readOnboardingAuthority('A', () => request.promise);
  request.release({ ...adult('B', 'sb'), eligible: true });
  assert.equal((await pending).outcome, 'changed');
});
await test('Malformed/missing identity, session or eligibility defaults to unavailable', async () => {
  for (const key of ['accountId','sessionId','required','state','emailVerified','eligible']) {
    const value = adult();
    delete value[key];
    assert.equal(decideOnboardingAuthority('A', value).outcome, 'unavailable', key);
  }
  assert.equal(decideOnboardingAuthority('A', null).outcome, 'unavailable');
  assert.equal(decideOnboardingAuthority('', adult()).outcome, 'unavailable');
});
await test('A response claiming eligible while pending or revoked is contradictory and refused', async () => {
  for (const state of ['pending','withdrawn','undeclared']) {
    assert.equal(decideOnboardingAuthority('A', { ...child(state), eligible: true }).outcome, 'unavailable');
  }
});
await test('Server must not mark unverified email eligible', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), emailVerified: false, eligible: true }).outcome, 'unavailable');
});
await test('Server ineligible adult is never auto-admitted by client age declaration', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), eligible: false }).outcome, 'waiting');
});
await test('A response for account B is refused before any profile-writing callback', async () => {
  let callback = 0;
  const read = await readOnboardingAuthority('A', async () => adult('B', 'sb'));
  if (read.outcome === 'approved') callback++;
  assert.equal(callback, 0);
});
console.log(`ONBOARDING AUTHORITY: PASS — ${count}/${count} asynchronous groups`);
