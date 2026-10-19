// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one server statement decides whether an account may enter
//
// The sign-in card (SignUpFlow.jsx finish) and the activation gate
// (platform/accountActivation.js) judge the server's /v1/account/guardian/state
// reply through components/onboardingAuthority.js. The session cookie is
// shared by every tab of the device, so between "who is signed in" and "may
// they enter" another tab can sign a different account in: the reply must
// therefore carry the account id, the consent state and the eligibility
// verdict together, and this module must accept nothing less. These are its
// rules, exercised without a browser, including the A→B→A split identity.
//
// Usage:  node client/test/onboarding-authority-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readOnboardingAuthority, decideOnboardingAuthority } from '../src/components/onboardingAuthority.js';

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log(`  ✔ ${name}`); };
const adult = (accountId = 'A') => ({ accountId, required: false, state: 'not-required', emailVerified: true, eligible: true });
const child = (state = 'pending', accountId = 'A') => ({ accountId, required: true, state, emailVerified: true, eligible: state === 'given' });
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

await test('an adult, in one bound and eligible reply, may finish', async () => {
  let calls = 0;
  const reply = await readOnboardingAuthority('A', async () => { calls++; return adult(); });
  assert.equal(reply.outcome, 'approved');
  assert.deepEqual(reply.consent, { required: false, state: 'not-required' });
  assert.equal(calls, 1, 'one statement is read, not two');
});
await test('a guardian-approved child may finish, as the same account', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('given')))).outcome, 'approved');
});
await test('a child whose guardian has not approved waits — a verified session is not enough', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('pending')))).outcome, 'waiting');
});
await test('a withdrawn approval is revoked, not pending', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('withdrawn')))).outcome, 'revoked');
});
await test('an earlier approval is no permission once the fresh statement says pending', async () => {
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('given')))).outcome, 'approved');
  assert.equal((await readOnboardingAuthority('A', () => Promise.resolve(child('pending')))).outcome, 'waiting');
});
await test('A→B→A: a statement about account B (another tab signed in) cannot admit A', async () => {
  const request = deferred();
  const pending = readOnboardingAuthority('A', () => request.promise);
  request.release(adult('B'));
  const verdict = await pending;
  assert.equal(verdict.outcome, 'changed');
  assert.equal(verdict.consent, undefined, 'and carries no consent to act on');
});
await test('an out-of-order "eligible" reply for B after A\'s guardian withdrew cannot admit A', async () => {
  const request = deferred();
  const pending = readOnboardingAuthority('A', () => request.promise);
  request.release({ ...adult('B'), eligible: true });
  assert.equal((await pending).outcome, 'changed');
});
await test('a reply missing the account id, the consent state, the verdict or the verified flag is unavailable — never grandfathered in', async () => {
  for (const key of ['accountId', 'required', 'state', 'emailVerified', 'eligible']) {
    const value = adult();
    delete value[key];
    assert.equal(decideOnboardingAuthority('A', value).outcome, 'unavailable', `without ${key}`);
  }
  assert.equal(decideOnboardingAuthority('A', null).outcome, 'unavailable', 'no reply');
  assert.equal(decideOnboardingAuthority('A', 'yes').outcome, 'unavailable', 'a non-object');
  assert.equal(decideOnboardingAuthority('A', { ...adult(), accountId: 7 }).outcome, 'unavailable', 'a numeric account id (the server sends a string)');
  assert.equal(decideOnboardingAuthority('', adult()).outcome, 'unavailable', 'no expected account');
});
await test('a reply that claims eligible while pending, withdrawn or undeclared contradicts itself and is refused', async () => {
  for (const state of ['pending', 'withdrawn', 'undeclared']) {
    assert.equal(decideOnboardingAuthority('A', { ...child(state), eligible: true }).outcome, 'unavailable', state);
  }
});
await test('an unverified contact is never eligible, whatever the server says', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), emailVerified: false, eligible: true }).outcome, 'unavailable');
});
await test('an adult the server calls ineligible is not admitted by the client\'s own age declaration', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), eligible: false }).outcome, 'unavailable');
});
await test('an approved child the server calls ineligible is refused, not told to wait', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...child('given'), eligible: false }).outcome, 'unavailable');
});
await test('an undeclared age waits: the server\'s correction path, never the client, repairs it', async () => {
  assert.equal(decideOnboardingAuthority('A', child('undeclared')).outcome, 'waiting');
});
await test('a statement for another account never reaches the profile-writing callback', async () => {
  let wrote = 0;
  const read = await readOnboardingAuthority('A', async () => adult('B'));
  if (read.outcome === 'approved') wrote++;
  assert.equal(wrote, 0);
});
await test('the card and the gate both judge the statement through this module, and the gate reads it against the linked account', async () => {
  const card = readFileSync(new URL('../src/components/SignUpFlow.jsx', import.meta.url), 'utf8');
  const gate = readFileSync(new URL('../src/platform/accountActivation.js', import.meta.url), 'utf8');
  assert.match(card, /readOnboardingAuthority\(signedInAccount\.id, \(\) => cloud\.guardianState\(\)\)/);
  assert.match(gate, /decideOnboardingAuthority\(link\.accountId, statement\)/);
  assert.doesNotMatch(gate, /statement\.eligible\s*(===|&&)/, 'the gate never reads `eligible` on its own, outside the bound decision');
});
await test('the server answers with the binding: account id, state, eligibility and the verified flag in one reply', async () => {
  const accounts = readFileSync(new URL('../../server/platform/accounts.js', import.meta.url), 'utf8');
  assert.match(accounts, /router\.get\('\/guardian\/state', requireSession\(db\), async \(req, res\) => \{[\s\S]{0,900}accountId: String\(req\.platformSession\.account_id\),[\s\S]{0,700}eligible: consentBlockerCode\(state\) === null && !!req\.platformSession\.email_verified_at,[\s\S]{0,200}emailVerified: !!req\.platformSession\.email_verified_at/,
    'one handler, one session: the account id, the eligibility verdict and the verified flag come from the same session in the same reply');
  assert.match(accounts, /res\.set\('Cache-Control', 'no-store'\);\s*res\.json\(\{\s*accountId/, 'and the statement is never cached');
});

console.log(`ONBOARDING AUTHORITY: PASS — ${count}/${count} checks — one bound statement admits an account; a statement about another account, a contradictory one or a partial one never does`);
