import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountActionCleanUrl, parseAccountActionFragment } from '../src/platform/accountAction.js';

const verify = parseAccountActionFragment('#action=verify-email&token=abc_DEF-123');
assert.deepEqual(verify, { action: 'verify-email', token: 'abc_DEF-123' });
const reset = parseAccountActionFragment('#action=reset-password&token=reset-secret');
assert.deepEqual(reset, { action: 'reset-password', token: 'reset-secret' });
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
assert.ok(!/localStorage|indexedDB|sessionStorage/.test(page), 'account action tokens/passwords must never enter browser persistence');
assert.ok(page.includes('autoComplete="new-password"'));
assert.ok(page.includes('password.length < 10'));
assert.ok(transport.includes("verifyEmail: body => cloudRequest('/v1/account/email/verify'"));
assert.ok(transport.includes("resetPassword: body => cloudRequest('/v1/account/password/reset'"));

console.log('PASS — emailed account actions are fragment-only, stripped before render, non-persistent and routed through audited cloud verification/reset endpoints.');
