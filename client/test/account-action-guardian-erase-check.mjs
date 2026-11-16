// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a guardian asks for the child's account to be erased (D18)
//
// The withdrawal email (server/platform/authDelivery.js) carries a second link
// with the same bearer: /account-action#action=guardian-erase&token=…, which
// opens its own single-purpose page and posts the token to
// POST /v1/account/guardian/erase (server/platform/accounts.js). This proves
// the client speaks that contract:
//
//   · the email carries the erase link beside the withdrawal link, same token;
//   · the fragment parser accepts the action (and still refuses others);
//   · the page posts the token once through the transport and tells the four
//     outcomes apart: scheduled, already being erased, an invalid or used
//     link, an account not recorded as a child's, and any other failure;
//   · the page says what erasing does and that it cannot be undone before it
//     is done, offers one button, never draws the token, and is in Hindi too.
//
//   node client/test/account-action-guardian-erase-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

if (!globalThis.document) globalThis.document = { documentElement: { lang: 'en' }, cookie: '' };

const { parseAccountActionFragment } = await import('../src/platform/accountAction.js');
const { authEmailMessage, buildAuthActionUrl } = await import('../../server/platform/authDelivery.js');
// The English the page shows: catalogue templates with the ambient {brand} and
// {company} filled by the real lookup (plan E4); other placeholders unchanged.
const { translateEnglish } = await import('../src/i18n/index.js');
const en = Object.fromEntries(Object.entries((await import('../src/i18n/strings.en.js')).default)
  .map(([key, value]) => [key, typeof value === 'string' ? translateEnglish(key) : value]));
const { brandVars } = await import('../src/brand/edition.js');
const hiVars = brandVars('hi');
const hi = Object.fromEntries(Object.entries((await import('../src/i18n/strings.hi.js')).default)
  .map(([key, value]) => [key, typeof value === 'string' ? value.replace(/\{(brand|company)\}/g, (_, name) => hiVars[name]) : value]));

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const KEYS = ['eraseTitle', 'eraseIntro', 'eraseButton', 'eraseDone', 'eraseAlready', 'eraseNotAvailable', 'eraseInvalid', 'eraseFailed'].map(k => `accountAction.${k}`);

// ── 1 · The email carries the erase link, and the client recognises it ──────
{
  const withdrawUrl = buildAuthActionUrl('https://app.example.test', 'guardian-withdraw', 'keep-this-one');
  const mail = authEmailMessage('guardian-withdraw', withdrawUrl);
  const eraseUrl = 'https://app.example.test/account-action#action=guardian-erase&token=keep-this-one';
  ok(mail.text.includes(withdrawUrl) && mail.text.includes(eraseUrl), 'the withdrawal email carries both links, with the same token');
  ok(mail.html.includes('action=guardian-erase&amp;token=keep-this-one'), 'and so does its HTML');
  ok(/cannot be undone/.test(mail.text) && /a week later/.test(mail.text), 'the email says erasure cannot be undone and when it happens');
  ok(/only withdraw consent \(never give it\)/.test(mail.text), 'and still that the link never gives consent');
  eq(parseAccountActionFragment('#action=guardian-erase&token=keep-this-one'), { action: 'guardian-erase', token: 'keep-this-one' },
    'the erase action in the emailed fragment is parsed with its token');
  eq(parseAccountActionFragment('#action=guardian-erase'), null, 'an erase link without a token is refused');
  eq(parseAccountActionFragment('#action=guardian-delete&token=x'), null, 'an action the server never emails is still refused');
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
  const flow = page.performGuardianErase;
  const AccountAction = page.default;
  const calls = [];
  const fake = answer => ({ guardianErase: async token => { calls.push(token); return answer(token); } });
  const refusal = (code, status) => () => { throw Object.assign(new Error(code), { code, status }); };

  eq(await flow('tok-live', fake(() => ({ ok: true, erasure: 'scheduled', eraseAfter: 1 }))), { state: 'done', key: 'accountAction.eraseDone' },
    'a request is scheduled and the page says so');
  eq(await flow('tok-again', fake(() => ({ ok: true, erasure: 'scheduled', alreadyScheduled: true }))), { state: 'done', key: 'accountAction.eraseAlready' },
    'an account already being erased is its own, calm outcome');
  eq(await flow('tok-bad', fake(refusal('TOKEN_INVALID', 400))), { state: 'error', key: 'accountAction.eraseInvalid' }, 'an invalid or used link is named as such');
  eq(await flow('tok-adult', fake(refusal('GUARDIAN_ERASURE_NOT_AVAILABLE', 409))), { state: 'error', key: 'accountAction.eraseNotAvailable' },
    'an account not recorded as a child\'s is named as such');
  eq(await flow('tok-down', fake(refusal('CLOUD_REQUEST_FAILED', 503))), { state: 'error', key: 'accountAction.eraseFailed' }, 'any other failure says nothing changed');
  eq(calls, ['tok-live', 'tok-again', 'tok-bad', 'tok-adult', 'tok-down'], 'every attempt posted exactly its token, once');

  // ── 3 · The screen ─────────────────────────────────────────────────────────
  const html = renderToStaticMarkup(React.createElement(AccountAction, { actionData: { action: 'guardian-erase', token: 'tok-live' } }));
  const esc = text => text.replace(/'/g, '&#x27;');
  ok(html.includes(esc(en['accountAction.eraseTitle'])), 'the screen is titled as erasure');
  ok(html.includes(esc(en['accountAction.eraseIntro'])), 'it explains what erasing does before it is done');
  ok(/cannot be undone/.test(en['accountAction.eraseIntro']) && /a week later/.test(en['accountAction.eraseIntro']), 'including that it cannot be undone, and when');
  eq((html.match(/<button/g) || []).length, 1, 'one button');
  ok(/data-guardian-erase/.test(html) && html.includes(en['accountAction.eraseButton']), 'the button erases');
  ok(!/data-guardian-withdraw/.test(html), 'it is not the withdrawal page');
  ok(!html.includes('tok-live'), 'the token is never drawn into the page');
  await i18n.setLanguage('hi');
  const hindi = renderToStaticMarkup(React.createElement(AccountAction, { actionData: { action: 'guardian-erase', token: 'tok-live' } }));
  ok(hindi.includes(hi['accountAction.eraseTitle']) && hindi.includes(hi['accountAction.eraseButton']), 'a Hindi reader gets the screen in Hindi');
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

// ── 4 · Source contracts ─────────────────────────────────────────────────────
{
  const page = read('src/pages/AccountAction.jsx');
  ok(/transport\.guardianErase\(token\)/.test(page), 'the page erases through the transport, with the token alone');
  ok(!/localStorage|indexedDB|sessionStorage/.test(page), 'the token never enters browser persistence');
  const transport = read('src/platform/cloudTransport.js');
  ok(transport.includes("guardianErase: token => cloudRequest('/v1/account/guardian/erase', { method: 'POST', body: { token } })"),
    'the transport posts to the audited erase route');
  for (const key of KEYS) ok(typeof en[key] === 'string' && typeof hi[key] === 'string' && en[key] !== hi[key], `${key} is in both catalogues`);
}

console.log(failures.length
  ? `GUARDIAN ERASE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `GUARDIAN ERASE: PASS — ${pass}/${pass} checks — the emailed erase link is parsed, posted once through the audited route, and its outcomes are told plainly in both languages.`);
process.exit(failures.length ? 1 : 0);
