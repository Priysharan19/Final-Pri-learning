// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the guardian's withdrawal link, end to end on the client
//
// server/platform/accounts.js issues a long-lived 'guardian-withdraw' bearer
// after a guardian confirms, and server/platform/authDelivery.js emails it as
// /account-action#action=guardian-withdraw&token=…. This proves the client
// speaks that contract:
//
//   · the fragment parser accepts the action (and still refuses anything else);
//   · the page posts the token to POST /v1/account/guardian/withdraw through
//     the audited transport and reads the three outcomes the server gives:
//     withdrawn, nothing left to withdraw, invalid link;
//   · the confirm screen says what withdrawing does and offers one button;
//   · the catalogue copy exists in both languages, and the consent screen now
//     says a separate withdrawal email follows confirmation.
//
//   node client/test/account-action-guardian-withdraw-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!globalThis.document) globalThis.document = { documentElement: { lang: 'en' }, cookie: '' };

const { parseAccountActionFragment } = await import('../src/platform/accountAction.js');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// ── 1 · The link the email carries is one the client recognises ──────────────
{
  eq(parseAccountActionFragment('#action=guardian-withdraw&token=keep-this-one'), { action: 'guardian-withdraw', token: 'keep-this-one' },
    'the withdrawal action in the emailed fragment is parsed with its token');
  eq(parseAccountActionFragment('#action=guardian-withdraw'), null, 'a withdrawal link without a token is refused');
  eq(parseAccountActionFragment('#action=guardian-revoke&token=x'), null, 'an action the server never emails is still refused');
  const delivery = read('../server/platform/authDelivery.js');
  ok(/'guardian-withdraw'/.test(delivery) && /new URL\('\/account-action'/.test(delivery),
    'the server emails the withdrawal link to /account-action, where this page mounts');
  ok(/url\.hash = new URLSearchParams\(\{ action: kind, token \}\)\.toString\(\)/.test(delivery), 'the emailed fragment names the delivery kind as the action, so guardian-withdraw arrives as action=guardian-withdraw');
}

// ── 2 · The flow against a fake transport ────────────────────────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  await i18n.setLanguage('en');
  const page = await server.ssrLoadModule('/src/pages/AccountAction.jsx');
  const flow = page.performGuardianWithdraw;
  const AccountAction = page.default;

  const calls = [];
  const fake = answer => ({ guardianWithdraw: async token => { calls.push(token); return answer(token); } });

  eq(await flow('tok-live', fake(() => ({ ok: true, withdrawn: true }))), { state: 'done', key: 'accountAction.withdrawDone' },
    'a live consent is withdrawn and the page says so');
  eq(await flow('tok-spent', fake(() => ({ ok: true, withdrawn: false }))), { state: 'already', key: 'accountAction.withdrawAlready' },
    'nothing left to withdraw is its own, calm outcome');
  eq(await flow('tok-bad', fake(() => { throw Object.assign(new Error('This withdrawal link is invalid.'), { code: 'TOKEN_INVALID', status: 400 }); })),
    { state: 'error', key: 'accountAction.withdrawInvalid' }, 'an invalid or used link is named as such');
  eq(await flow('tok-down', fake(() => { throw Object.assign(new Error('boom'), { code: 'CLOUD_REQUEST_FAILED', status: 503 }); })),
    { state: 'error', key: 'accountAction.withdrawFailed' }, 'any other failure asks the guardian to try the link again');
  eq(calls, ['tok-live', 'tok-spent', 'tok-bad', 'tok-down'], 'every attempt posted exactly its token, once');

  // ── 3 · The confirm screen ─────────────────────────────────────────────────
  const html = renderToStaticMarkup(React.createElement(AccountAction, { actionData: { action: 'guardian-withdraw', token: 'tok-live' } }));
  ok(html.includes(en['accountAction.withdrawTitle']), 'the screen is titled as withdrawal');
  ok(html.includes(en['accountAction.withdrawIntro'].replace(/’/g, '&#x27;').replace(/'/g, '&#x27;')) || html.includes(en['accountAction.withdrawIntro']),
    'it explains what withdrawing does before it is done');
  eq((html.match(/<button/g) || []).length, 1, 'one button, no second choice to confuse a parent');
  ok(/data-guardian-withdraw/.test(html) && html.includes(en['accountAction.withdrawButton']), 'the button withdraws');
  ok(!html.includes('tok-live'), 'the token is never drawn into the page');
  ok(!html.includes(en['accountAction.allowSync']), 'the consent screen’s "allow" choice is not offered on a link that can only withdraw');

  await i18n.setLanguage('hi');
  const hindi = renderToStaticMarkup(React.createElement(AccountAction, { actionData: { action: 'guardian-withdraw', token: 'tok-live' } }));
  ok(hindi.includes(hi['accountAction.withdrawTitle']) && hindi.includes(hi['accountAction.withdrawButton']), 'a Hindi reader gets the screen in Hindi');
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

// ── 4 · Source contracts ─────────────────────────────────────────────────────
{
  const page = read('src/pages/AccountAction.jsx');
  ok(/transport\.guardianWithdraw\(token\)/.test(page), 'the page withdraws through the transport, with the token alone');
  ok(!/localStorage|indexedDB|sessionStorage/.test(page), 'the withdrawal token never enters browser persistence');
  const transport = read('src/platform/cloudTransport.js');
  ok(transport.includes("guardianWithdraw: token => cloudRequest('/v1/account/guardian/withdraw', { method: 'POST', body: { token } })"),
    'the transport posts to the audited withdrawal route');
  for (const key of ['accountAction.withdrawTitle', 'accountAction.withdrawIntro', 'accountAction.withdrawButton', 'accountAction.withdrawDone', 'accountAction.withdrawAlready', 'accountAction.withdrawInvalid', 'accountAction.withdrawFailed']) {
    ok(typeof en[key] === 'string' && typeof hi[key] === 'string' && en[key] !== hi[key], `${key} is in both catalogues`);
  }
  ok(/separate email follows/.test(en['accountAction.guardianChangeLater']) && /{privacy}/.test(hi['accountAction.guardianChangeLater']),
    'the consent screen says a separate withdrawal email follows confirmation, in both languages');
}

console.log(failures.length
  ? `GUARDIAN WITHDRAW: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `GUARDIAN WITHDRAW: PASS — ${pass}/${pass} checks — the emailed withdrawal link is parsed, posted once through the audited route, and its three outcomes are told plainly in both languages.`);
process.exit(failures.length ? 1 : 0);
