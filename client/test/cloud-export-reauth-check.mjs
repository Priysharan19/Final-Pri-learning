// Pri Learning · the data export asks for fresh proof of the credential (#368 port)
//
// GET /v1/account/export answers 401 REAUTH_REQUIRED, naming the proofs the
// account can offer, when the credential was not proven inside ten minutes.
// The client then asks for that proof inline, sends it once to POST
// /v1/account/reauth (the server answers with a session-bound step-up cookie
// the browser or native jar holds — the page keeps nothing) and exports again.
//
// What this file holds:
//   1. The transport exposes the re-auth call and surfaces the proofs a
//      refusal names, as the known kinds only.
//   2. The Account panel's export flow: a REAUTH_REQUIRED refusal opens the
//      proof form instead of an error; a proof goes through cloud.reauth and
//      then cloud.exportAccount; the password field is cleared before the
//      request is sent; the proof never reaches storage.
//   3. The copy exists in both catalogues, with the same placeholders.
//
//   node client/test/cloud-export-reauth-check.mjs

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

// ── A fake cloud ────────────────────────────────────────────────────────────
const requests = [];
let exportReply = { status: 200, body: { format: 'pri-account-export-v1', account: { id: 'acct-1' } } };
let reauthReply = { status: 200, body: { ok: true, method: 'password', freshUntil: Date.now() + 600_000 } };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' } });
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const method = String(options.method || 'GET').toUpperCase();
  requests.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers || {} });
  if (path === '/v1/account/export') return json(exportReply.body, exportReply.status);
  if (path === '/v1/account/reauth' && method === 'POST') return json(reauthReply.body, reauthReply.status);
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { cloud } = await import('../src/platform/cloudTransport.js');

// ── 1 · Transport ────────────────────────────────────────────────────────────
ok('the transport exposes cloud.reauth', typeof cloud.reauth === 'function');
{
  requests.length = 0;
  const result = await cloud.reauth({ password: 'correct horse' });
  same('cloud.reauth POSTs the proof to /v1/account/reauth as given', requests.map(r => [r.method, r.path, r.body]), [['POST', '/v1/account/reauth', { password: 'correct horse' }]]);
  same('and returns the server\'s answer', [result.ok, result.method], [true, 'password']);
}
{
  requests.length = 0;
  exportReply = { status: 401, body: { error: { code: 'REAUTH_REQUIRED', message: 'Confirm it is you before continuing.', proofs: ['google', 'otp', 'bogus', 42], freshMs: 600000 } } };
  let error = null;
  try { await cloud.exportAccount(); } catch (err) { error = err; }
  same('a REAUTH_REQUIRED refusal surfaces its status and code', [error?.status, error?.code], [401, 'REAUTH_REQUIRED']);
  same('and the proofs it names, as the known kinds only', error?.proofs, ['google', 'otp']);
  exportReply = { status: 401, body: { error: { code: 'REAUTH_REQUIRED', message: 'x', proofs: 'password' } } };
  error = null;
  try { await cloud.exportAccount(); } catch (err) { error = err; }
  same('a malformed proofs field is ignored, not propagated', error?.proofs, undefined);
  exportReply = { status: 200, body: { format: 'pri-account-export-v1', account: { id: 'acct-1' } } };
  const exported = await cloud.exportAccount();
  same('a fresh session exports as before', exported.format, 'pri-account-export-v1');
}

// ── 2 · The Account panel's export flow (source contract) ───────────────────
{
  const panel = readFileSync(new URL('../src/components/CloudAccountSecurity.jsx', import.meta.url), 'utf8');
  const fn = name => {
    const start = panel.indexOf(`async function ${name}(`);
    if (start < 0) return '';
    const next = panel.indexOf('\n  async function ', start + 1);
    const sync = panel.indexOf('\n  function ', start + 1);
    const end = [next, sync].filter(i => i > start).sort((a, b) => a - b)[0];
    return panel.slice(start, end > 0 ? end : panel.length);
  };
  const exportAccount = fn('exportAccount');
  ok('exportAccount exists', !!exportAccount);
  ok('a REAUTH_REQUIRED refusal opens the proof form instead of reporting an error', /err\?\.code === 'REAUTH_REQUIRED'/.test(exportAccount) && /setExportProof\(\{\s*proofs:/.test(exportAccount));
  ok('the proof form is offered the proofs the server named', /Array\.isArray\(err\.proofs\) \? err\.proofs : \[\]/.test(exportAccount));
  const withProof = fn('exportWithProof');
  ok('exportWithProof exists', !!withProof);
  ok('a proof goes through cloud.reauth and then cloud.exportAccount, in that order', withProof.indexOf('cloud.reauth(proof)') > 0 && withProof.indexOf('cloud.exportAccount()') > withProof.indexOf('cloud.reauth(proof)'));
  ok('a wrong code is reported as such and the digits cleared', /OTP_REAUTH_FAILED/.test(withProof) && /setExportCode\(''\)/.test(withProof));
  const withPassword = fn('exportWithPassword');
  ok('the password field is cleared before the proof is sent', withPassword.indexOf("setExportPassword('')") > 0 && withPassword.indexOf("setExportPassword('')") < withPassword.indexOf('exportWithProof({ password })'));
  ok('the code proof is sent as the challenge id and the code', /exportWithProof\(\{ otpChallengeId: exportChallenge, otpCode: exportCode \}\)/.test(fn('exportWithCode')));
  ok('the provider proof carries the fresh token and its nonce', /exportWithProof\(\{ provider, idToken: token\.idToken, nonce: token\.nonce \}\)/.test(fn('exportWithProvider')));
  ok('a successful export closes the proof form (resetExportProof)', /function resetExportProof\(\)/.test(panel) && /async function deliverExport\(result\)[\s\S]*?resetExportProof\(\);/.test(panel));
  ok('the panel never writes the export proof anywhere persistent', !/localStorage|sessionStorage|idb|put\(/.test(panel));
  ok('the proof form is rendered under the export card', /data-testid="cloud-export-proof"/.test(panel) && /data-testid="cloud-export-with-password"/.test(panel) && /data-testid="cloud-export-with-code"/.test(panel) && /data-export-provider=\{kind\}/.test(panel));
  ok('the proof form can be cancelled', /onClick=\{resetExportProof\}/.test(panel) && /cloudSecurity\.exportCancel/.test(panel));
}

// ── 3 · Copy in both catalogues ──────────────────────────────────────────────
{
  const load = async rel => { const mod = await import(rel); return mod.default || mod.en || mod.hi || mod; };
  const en = await load('../src/i18n/strings.en.js');
  const hi = await load('../src/i18n/strings.hi.js');
  for (const key of ['cloudSecurity.exportConfirmFirst', 'cloudSecurity.exportReauthHelp', 'cloudSecurity.exportConfirm', 'cloudSecurity.exportWithCode', 'cloudSecurity.exportWithProvider', 'cloudSecurity.exportCancel']) {
    ok(`${key} exists in English`, typeof en?.[key] === 'string' && en[key].length > 3);
    ok(`${key} exists in Hindi`, typeof hi?.[key] === 'string' && hi[key].length > 3);
  }
  ok('the provider line carries {provider} in both languages', /\{provider\}/.test(en?.['cloudSecurity.exportWithProvider'] || '') && /\{provider\}/.test(hi?.['cloudSecurity.exportWithProvider'] || ''));
  ok('the help names the ten-minute window in both languages', /10/.test(en?.['cloudSecurity.exportReauthHelp'] || '') && /10/.test(hi?.['cloudSecurity.exportReauthHelp'] || ''));
}

console.log(`\nCloud export re-auth — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nCLOUD EXPORT REAUTH: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
