// Pri Learning · a signed-in account with no password can set a first one
//
// Settings → Account shows "Set a password" when the account has no password
// identity and a real, verified email (a phone account's address is
// synthetic). The panel POSTs /v1/account/password; a 401 REAUTH_REQUIRED
// opens a code step (POST /v1/account/otp/reauth-request, then
// /v1/account/reauth) and only then sets the password again. "Change
// password" stays for accounts that have one.
//
//   node client/test/cloud-set-password-check.mjs

import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const requests = [];
let setReply = { status: 200, body: { ok: true, sessionsRotated: true } };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' } });
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const method = String(options.method || 'GET').toUpperCase();
  requests.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined });
  if (path === '/v1/account/password' && method === 'POST') return json(setReply.body, setReply.status);
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { cloud } = await import('../src/platform/cloudTransport.js');

// ── 1 · Transport ────────────────────────────────────────────────────────────
ok('the transport exposes cloud.setPassword', typeof cloud.setPassword === 'function');
{
  requests.length = 0;
  await cloud.setPassword({ newPassword: 'quiet-instrument-paper' });
  same('cloud.setPassword POSTs to /v1/account/password (PATCH stays the change)', requests.map(r => [r.method, r.path, r.body]), [['POST', '/v1/account/password', { newPassword: 'quiet-instrument-paper' }]]);
  setReply = { status: 401, body: { error: { code: 'REAUTH_REQUIRED', message: 'x', proofs: ['otp'], freshMs: 600000 } } };
  let error = null;
  try { await cloud.setPassword({ newPassword: 'quiet-instrument-paper' }); } catch (err) { error = err; }
  same('a REAUTH_REQUIRED refusal surfaces its code and proofs', [error?.status, error?.code, error?.proofs], [401, 'REAUTH_REQUIRED', ['otp']]);
}

// ── 2 · The panel (source contract) ─────────────────────────────────────────
{
  const panel = readFileSync(new URL('../src/components/CloudAccountSecurity.jsx', import.meta.url), 'utf8');
  const fn = name => {
    const start = panel.search(new RegExp(`(async )?function ${name}\\(`));
    if (start < 0) return '';
    const rest = panel.slice(start + 1);
    const ends = ['\n  async function ', '\n  function '].map(m => rest.indexOf(m)).filter(i => i >= 0);
    return panel.slice(start, ends.length ? start + 1 + Math.min(...ends) : panel.length);
  };
  const gate = (panel.match(/const canSetPassword = [^\n]+/) || [''])[0];
  ok('the control is gated on having no password', /!hasPassword/.test(gate));
  ok('and on a real, verified email', /account\?\.email/.test(gate) && /account\?\.emailVerified/.test(gate) && /@phone\.invalid/.test(gate));
  ok('and waits for the sign-in methods to load', /providers\.length > 0/.test(gate));
  ok('the form renders only through that gate', /\{canSetPassword && <form[^>]*data-testid="cloud-set-password"/.test(panel));
  ok('"Change password" is still shown only with a password', /\{hasPassword && <form[^>]*onSubmit=\{changePassword\}/.test(panel));
  const now = fn('setFirstPasswordNow');
  ok('mismatched entries are refused before any request', now.indexOf('passwordMismatch') > 0 && now.indexOf('passwordMismatch') < now.indexOf('cloud.setPassword'));
  ok('a proof goes through cloud.reauth before cloud.setPassword', now.indexOf('cloud.reauth(proof)') > 0 && now.indexOf('cloud.setPassword(') > now.indexOf('cloud.reauth(proof)'));
  ok('REAUTH_REQUIRED opens the code step instead of an error', /err\?\.code === 'REAUTH_REQUIRED'[\s\S]*?setFirstProof\(true\)/.test(now));
  ok('a wrong code is reported and the digits cleared', /OTP_REAUTH_FAILED/.test(now) && /setFirstCode\(''\)/.test(now));
  ok('success clears the entered password', /resetFirstPassword\(\);/.test(now) && /setFirstPassword\(\{ next: '', confirm: '' \}\)/.test(fn('resetFirstPassword')));
  ok('the code proof is the challenge id and the code', /setFirstPasswordNow\(\{ otpChallengeId: firstChallenge, otpCode: firstCode \}\)/.test(fn('submitFirstPassword')));
  ok('the code is asked for through the account\'s own reauth-request', /cloud\.otpReauthRequest\(\)/.test(fn('requestFirstPasswordCode')));
  ok('nothing is written anywhere persistent', !/localStorage|sessionStorage|idb|put\(/.test(panel));
}

// ── 3 · Copy in both catalogues ──────────────────────────────────────────────
{
  const load = async rel => { const mod = await import(rel); return mod.default || mod.en || mod.hi || mod; };
  const en = await load('../src/i18n/strings.en.js');
  const hi = await load('../src/i18n/strings.hi.js');
  for (const key of ['setPasswordTitle', 'setPasswordHelp', 'setPasswordAction', 'setPasswordConfirmFirst', 'setPasswordReauthHelp', 'setPasswordWithCode', 'setPasswordFailed', 'passwordSet'].map(k => `cloudSecurity.${k}`)) {
    ok(`${key} exists in English`, typeof en?.[key] === 'string' && en[key].length > 3);
    ok(`${key} exists in Hindi`, typeof hi?.[key] === 'string' && hi[key].length > 3 && hi[key] !== en[key]);
  }
}

console.log(`\nCloud set password — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nCLOUD SET PASSWORD: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
