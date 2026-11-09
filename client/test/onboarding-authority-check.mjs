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
// ── An unproved address (L8's real-staging finding on 1d3829103) ────────────
// An adult password account whose email is unverified signed in, chose a
// class and was told "We couldn't confirm your account's guardian approval":
// the reply was {required:false, state:'not-required', eligible:false,
// emailVerified:false}, judged 'unavailable', and nothing let them prove the
// address. The only thing missing is the proof, so the outcome says so.
const unverified = shape => ({ ...shape, emailVerified: false, eligible: false });
await test('an adult whose only missing step is a proved address is told to confirm it, not that a guardian is missing', async () => {
  const verdict = decideOnboardingAuthority('A', unverified(adult()));
  assert.equal(verdict.outcome, 'unverified');
  assert.deepEqual(verdict.consent, { required: false, state: 'not-required' });
});
await test('a child a guardian approved, with an unproved address, confirms the address next', async () => {
  const verdict = decideOnboardingAuthority('A', unverified(child('given')));
  assert.equal(verdict.outcome, 'unverified');
  assert.deepEqual(verdict.consent, { required: true, state: 'given' });
});
await test('consent first: an unproved child still waiting for a guardian waits, a withdrawn one is revoked, an undeclared one waits', async () => {
  assert.equal(decideOnboardingAuthority('A', unverified(child('pending'))).outcome, 'waiting');
  assert.equal(decideOnboardingAuthority('A', unverified(child('withdrawn'))).outcome, 'revoked');
  assert.equal(decideOnboardingAuthority('A', unverified(child('undeclared'))).outcome, 'waiting');
});
await test('"unverified" is never permission: an unproved address the server calls eligible is still refused as contradictory', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), emailVerified: false, eligible: true }).outcome, 'unavailable');
  assert.equal(decideOnboardingAuthority('A', { ...child('given'), emailVerified: false, eligible: true }).outcome, 'unavailable');
});
await test('a proved address the server still calls ineligible stays unavailable, not "confirm your email"', async () => {
  assert.equal(decideOnboardingAuthority('A', { ...adult(), eligible: false }).outcome, 'unavailable');
  assert.equal(decideOnboardingAuthority('A', { ...child('given'), eligible: false }).outcome, 'unavailable');
});
await test('an unproved statement about another account is still "changed", never "unverified"', async () => {
  assert.equal(decideOnboardingAuthority('A', unverified(adult('B'))).outcome, 'changed');
});
await test('every eligibility shape has exactly one outcome', async () => {
  const table = [];
  for (const base of [adult(), child('given'), child('pending'), child('withdrawn'), child('undeclared')]) {
    for (const emailVerified of [true, false]) {
      for (const eligible of [true, false]) {
        table.push(`${base.required ? `child:${base.state}` : 'adult'} verified=${emailVerified} eligible=${eligible} → ${decideOnboardingAuthority('A', { ...base, emailVerified, eligible }).outcome}`);
      }
    }
  }
  assert.deepEqual(table, [
    'adult verified=true eligible=true → approved',
    'adult verified=true eligible=false → unavailable',
    'adult verified=false eligible=true → unavailable',
    'adult verified=false eligible=false → unverified',
    'child:given verified=true eligible=true → approved',
    'child:given verified=true eligible=false → unavailable',
    'child:given verified=false eligible=true → unavailable',
    'child:given verified=false eligible=false → unverified',
    'child:pending verified=true eligible=true → unavailable',
    'child:pending verified=true eligible=false → waiting',
    'child:pending verified=false eligible=true → unavailable',
    'child:pending verified=false eligible=false → waiting',
    'child:withdrawn verified=true eligible=true → unavailable',
    'child:withdrawn verified=true eligible=false → revoked',
    'child:withdrawn verified=false eligible=true → unavailable',
    'child:withdrawn verified=false eligible=false → revoked',
    'child:undeclared verified=true eligible=true → unavailable',
    'child:undeclared verified=true eligible=false → waiting',
    'child:undeclared verified=false eligible=true → unavailable',
    'child:undeclared verified=false eligible=false → waiting'
  ]);
});
await test('the card sends "unverified" to the confirm-your-email step and keeps the guardian sentence for guardian outcomes only', async () => {
  const card = readFileSync(new URL('../src/components/SignUpFlow.jsx', import.meta.url), 'utf8');
  const gate = readFileSync(new URL('../src/platform/accountActivation.js', import.meta.url), 'utf8');
  assert.match(card, /authority\.outcome === 'unverified'[\s\S]{0,700}go\('verify-email'\)/);
  assert.match(card, /authority\.outcome === 'unavailable'[\s\S]{0,300}signup\.accountCheckUnavailable/);
  assert.doesNotMatch(card, /consentCheckUnavailable/, 'the old "guardian approval" sentence for an unavailable statement is gone');
  assert.match(card, /step === 'verify-email'[\s\S]{0,1500}sendCode\(\)[\s\S]{0,1500}useDifferentEmail/);
  assert.match(gate, /authority\.outcome === 'unverified'\) throw new ActivationBlocked\('EMAIL_UNVERIFIED'\)/);
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
  assert.match(accounts, /router\.get\('\/guardian\/state', requireSession\(db\), async \(req, res\) => \{[\s\S]{0,900}accountId: String\(req\.platformSession\.account_id\),[\s\S]{0,400}eligible: blockerCode === null && !!account\?\.email_verified_at,[\s\S]{0,200}emailVerified: !!account\?\.email_verified_at/);
  assert.match(accounts, /res\.set\('Cache-Control', 'no-store'\);\s*res\.json\(\{\s*accountId/, 'and the statement is never cached');
});

console.log(`ONBOARDING AUTHORITY: PASS — ${count}/${count} checks — one bound statement admits an account; a statement about another account, a contradictory one or a partial one never does`);
