// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · regressions from a real browser run of main (e12b52f8)
//
// An iPad-size, signed-in Class 10 practice run found copy and layout that no
// longer matched the server-read handwriting shipped in #316. Each check here
// pins one of those findings so it cannot quietly come back. The server-side
// reading budget is covered in server/test/handwriting-transcription-check.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { featureDefines, featureStates } from '../vite.config.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(`${ROOT}${path}`, 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const en = (await import(new URL('../src/i18n/strings.en.js', import.meta.url).href)).default;
const hi = (await import(new URL('../src/i18n/strings.hi.js', import.meta.url).href)).default;

// ── 1 · A slow server read says "still reading", not an error ────────────────
const inkAnswer = read('client/src/ink/InkAnswer.jsx');
ok(/export const STILL_READING_MS = 5000;/.test(inkAnswer), 'the still-reading note appears after 5 s');
ok(/t\(slowRead \? 'ink\.serverStillReading' : 'ink\.serverReading'\)/.test(inkAnswer), 'a slow read switches to the still-reading note');
ok(typeof en['ink.serverStillReading'] === 'string' && typeof hi['ink.serverStillReading'] === 'string', 'the still-reading note exists in English and Hindi');
const transport = read('client/src/platform/cloudTransport.js');
const clientTimeout = Number(transport.match(/transcribeHandwriting: \(image, \{ signal = null, timeoutMs = (\d+)\b/)?.[1]);
const serverDefault = Number(read('server/platform/handwritingProvider.js').match(/const DEFAULT_TIMEOUT_MS = ([\d_]+);/)?.[1].replace(/_/g, ''));
ok(serverDefault === 45000, 'the server reading budget defaults to 45 s');
ok(clientTimeout > serverDefault && clientTimeout <= 60000, 'the client waits longer than the server budget, inside the 60 s transport cap');

// ── 2 · Help copy no longer claims on-device recognition ─────────────────────
for (const key of ['settings.helpBody', 'settings.helpBodyIndia']) {
  ok(!/on this device|on-device|strokes → symbols/.test(en[key]) && /server reader/.test(en[key]), `${key} (EN) says handwriting is read by the server`);
  ok(!/इसी डिवाइस पर पहचाने|स्ट्रोक → चिह्न/.test(hi[key]) && /सर्वर रीडर/.test(hi[key]), `${key} (HI) says handwriting is read by the server`);
}
// Online-only checking (owner decision 2026-10-10): the welcome line promises
// no offline or on-device marking, and says what checking needs.
ok(!/offline|on your device/i.test(en['login.heroSub']) && /checked by Pri’s server/.test(en['login.heroSub']) && /Pri account and a connection/.test(en['login.heroSub']), 'the welcome line says answers are checked by the server with an account and a connection (EN)');
ok(!/बिना इंटरनेट/.test(hi['login.heroSub']) && /Pri का सर्वर जाँचता है/.test(hi['login.heroSub']) && /Pri खाता और कनेक्शन चाहिए/.test(hi['login.heroSub']), 'and in Hindi');

// ── 3 · The editor footer names who reads, accurately ────────────────────────
const card = read('client/src/components/QuestionCard.jsx');
ok(!/t\('verdict\.inkEngine'\)/.test(card), 'no editor footer says "Pri Ink Engine"');
ok(/startsWith\('cloud'\) \? t\('verdict\.inkReadByServer'\) : t\('verdict\.inkReadByServerPending'\)/.test(card),
  'pen mode says the server reads before a reading and "read by" only after one');
ok(typeof en['verdict.inkReadByServerPending'] === 'string' && typeof hi['verdict.inkReadByServerPending'] === 'string',
  'the before-a-reading label exists in English and Hindi');

// ── 4 · Fixed bars never cover the page's last controls on iPad ──────────────
const theme = read('client/src/theme.css');
const outsideMedia = theme.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
ok(/\.content:has\(\.ctx-pill\) \{ padding-bottom: calc\(120px/.test(outsideMedia), 'the context pill reserves room at every width');
ok(/\.content:has\(\.pri-explain-launch\) \{ padding-bottom: calc\(200px/.test(outsideMedia), 'and so does the Pri Explain launcher');

// ── 5 · Unconfigured pricing is not shown to students ────────────────────────
const cloudPanel = read('client/src/components/CloudAccountPanel.jsx');
ok(!/t\('cloud\.pricingUnset'\)/.test(cloudPanel), 'the "pricing has not been configured" note is never rendered');
ok(/if \(!monthly && !annual\) return null;/.test(cloudPanel) && /return note \? <div/.test(cloudPanel), 'with no prices the pricing line is absent');

// ── 6 · The sign-up course comes from the edition, not a flag (mission E3) ───
ok(!('__PRI_FEATURE_AUSTRALIA__' in featureDefines('build', { PRI_FEATURE_AUSTRALIA: '1' })), 'no build constant for an Australia flag exists, even when the variable is set');
ok(!('australia' in featureStates('build', { PRI_FEATURE_AUSTRALIA: '1' })), 'and the build manifest carries no australia key');
ok(featureStates('build', { PRI_EDITION: 'prithagoras' }).edition === 'prithagoras' && featureStates('build', {}).edition === 'priyabhata', 'the edition, recorded in the manifest, is what selects the course');
const login = read('client/src/pages/Login.jsx');
ok(/const SIGNUP_COURSE = defaultCourse\(\);/.test(login) && !/openAustralia|featureEnabled\('australia'\)/.test(login),
  'the sign-up course step follows the edition, with no link to the other one');

// ── 7 · A prefilled name is replaced, not appended to ────────────────────────
ok(/id="cloud-name"[\s\S]{0,400}onFocus=\{e => \{ if \(e\.target\.value && e\.target\.value === \(user\?\.name \|\| ''\)\) e\.target\.select\(\); \}\}/.test(cloudPanel),
  'focusing the prefilled account name selects it');

// ── 8 · WebKit Playwright stubs see requests ahead of the service worker ─────
// These two tours intercept *synthetic* /v1/ responses. With an installed
// service worker, WebKit can satisfy a request before context.route sees it,
// making a test claim no request happened while a real reading may finish.
// inspectNetwork is only used in the e2e context; it never changes app code.
const e2eHarness = read('client/test/e2e.mjs');
ok(/flow\.inspectNetwork\s*\?\s*\{\s*serviceWorkers:\s*['"]block['"]\s*\}/.test(e2eHarness),
  'inspectNetwork excludes service workers from stub-network Playwright contexts');
function hasVisibleStubRequests(src, id) {
  const pos = src.indexOf("id: '" + id + "'");
  return pos >= 0 && /inspectNetwork:\s*true\s*,/.test(src.slice(pos, pos + 250)) &&
    /ctx\.route\(/.test(src);
}
for (const [file, id] of [['client/test/tour-stale-cloud.js', 'stale-cloud'], ['client/test/tour-photo-practise.js', 'photo-practise']]) {
  const source = read(file);
  ok(hasVisibleStubRequests(source, id), `${id} opts into network-visible intercepts`);
  // Negative control: removing the opt-in has to make the guard fail.
  const disabled = source.replace(/inspectNetwork:\s*true\s*,/, '');
  ok(!hasVisibleStubRequests(disabled, id), `${id} loses eligibility when the opt-in is removed`);
}

if (failures.length) {
  for (const f of failures) console.log('  ✖ ' + f);
  console.log(`BROWSER RUN FIXES: FAIL — ${pass}/${pass + failures.length} checks`);
  process.exit(1);
}
console.log(`BROWSER RUN FIXES: PASS — ${pass}/${pass} checks — server-read copy, still-reading state, footer label, bar padding, pricing, V1 scope and name prefill.`);
