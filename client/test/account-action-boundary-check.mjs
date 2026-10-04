import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountActionCleanUrl, parseAccountActionFragment } from '../src/platform/accountAction.js';

const verify = parseAccountActionFragment('#action=verify-email&token=abc_DEF-123');
assert.deepEqual(verify, { action: 'verify-email', token: 'abc_DEF-123' });
const reset = parseAccountActionFragment('#action=reset-password&token=reset-secret');
assert.deepEqual(reset, { action: 'reset-password', token: 'reset-secret' });
// The long-lived withdrawal bearer a guardian keeps (server/platform/accounts.js)
// arrives on the same page as its own action.
const withdraw = parseAccountActionFragment('#action=guardian-withdraw&token=withdraw-bearer');
assert.deepEqual(withdraw, { action: 'guardian-withdraw', token: 'withdraw-bearer' });
assert.equal(parseAccountActionFragment('#action=unknown&token=secret'), null);
assert.equal(parseAccountActionFragment('#action=verify-email'), null);
assert.equal(parseAccountActionFragment('#token=secret'), null);
assert.equal(accountActionCleanUrl({ pathname: '/account-action', search: '' }), '/account-action');
assert.equal(accountActionCleanUrl({ pathname: '/account-action', search: '?source=email' }), '/account-action?source=email');
assert.ok(!accountActionCleanUrl({ pathname: '/account-action', search: '' }).includes('secret'));

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/AccountAction.jsx', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../src/platform/cloudTransport.js', import.meta.url), 'utf8');

const parseAt = main.indexOf('parseAccountActionFragment(window.location.hash)');
const stripAt = main.indexOf("window.history.replaceState(null, '', accountActionCleanUrl(window.location))");
const renderAt = main.indexOf("const root = createRoot(document.getElementById('root'))");
assert.ok(parseAt >= 0 && stripAt > parseAt && renderAt > stripAt,
  'the token fragment must be parsed and stripped before React renders');
assert.ok(main.includes('if (!window.__PRI_CLOUD_ORIGIN__) window.__PRI_CLOUD_ORIGIN__ = window.location.origin'),
  'an emailed action served by PRI_PUBLIC_ORIGIN must use that same origin as its cloud authority');
assert.ok(main.includes('Deliberately outside StrictMode'),
  'one-time token consumption must not be mounted under development StrictMode replay');

assert.ok(page.includes('cloud.verifyEmail({ token })'));
assert.ok(page.includes('cloud.resetPassword({ token, password })'));
// A spent verify link (mail scanners open it first) must not read as an error
// when the signed-in account is verified; only then is the error replaced.
assert.ok(/cloud\.me\(\)[\s\S]{0,120}emailVerified === true/.test(page),
  'a refused verify link falls back to the signed-in account\'s verified state');
// The brand on standalone link pages reads "Pri Learning", never "P ri Learning".
assert.ok(page.includes('<span className="logo-name">Pri Learning<'), 'the wordmark spells the full product name');
assert.ok(page.includes('<span className="logo-bb" aria-hidden="true">P</span>'), 'the brand tile letter is decorative');
for (const file of ['../src/pages/AccountAction.jsx', '../src/App.jsx', '../src/components/QuestionCard.jsx']) {
  assert.ok(!/>ri Learning/.test(readFileSync(new URL(file, import.meta.url), 'utf8')),
    `${file}: no wordmark relies on the tile letter to complete the name`);
}
assert.ok(!/localStorage|indexedDB|sessionStorage/.test(page), 'account action tokens/passwords must never enter browser persistence');
assert.ok(page.includes('autoComplete="new-password"'));
assert.ok(page.includes('password.length < 10'));
assert.ok(transport.includes("verifyEmail: body => cloudRequest('/v1/account/email/verify'"));
assert.ok(transport.includes("resetPassword: body => cloudRequest('/v1/account/password/reset'"));
assert.ok(page.includes("action === 'guardian-withdraw'"), 'the withdrawal link has its own confirm screen');
assert.ok(transport.includes("guardianWithdraw: token => cloudRequest('/v1/account/guardian/withdraw', { method: 'POST', body: { token } })"));

console.log('PASS — emailed account actions are fragment-only, stripped before render, non-persistent and routed through audited cloud verification/reset endpoints.');
