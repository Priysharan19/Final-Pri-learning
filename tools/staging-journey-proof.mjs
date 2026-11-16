#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the deployed student journey on STAGING, end to end.
//
// The ~50 CI tours prove the code against stubs: an in-process server, a
// synthetic handwriting reader, network intercepts and test delivery adapters.
// This drives the real deployed product on Railway staging in a real browser,
// with nothing stubbed, and records each step as PASS, FAIL (a defect, with a
// repro and the owning lane), BLOCKED (an external need, named) or
// SYNTHETIC-PASS (passed on a synthetic input: drawn ink, a rendered photo).
// Every step keeps its screenshots and the /v1 requests and responses it made
// (tokens, codes, passwords and cookies redacted).
//
//   node tools/staging-journey-proof.mjs --sha <40-hex main SHA>            # no account is made
//   node tools/staging-journey-proof.mjs --sha <40-hex main SHA> --accounts # the full journey
//
// Staging only, by construction: any other origin is refused. --accounts
// makes synthetic test accounts on staging (owner's authorization required)
// and deletes every one it made before it exits, listing any it could not.
// Addresses are Resend's sink (delivered+<tag>@resend.dev) by default: mail
// to a reserved domain such as example.com bounces, and bounces count against
// the sending domain. Never a real person's address.
//
// A step that needs an email code (sign-up, the guardian's approval, deletion)
// reads it from the owner's dedicated test inbox over IMAP, configured ONLY in
// ~/Developer/.pri-fleet/staging-inbox.env (mode 600, outside the repo; see
// tools/staging-inbox.mjs). Each account gets <local>+pri-<run>-<n>@<domain>;
// evidence and screenshots show only the tag. With no inbox file those steps
// are BLOCKED (mailbox) and the rest still runs.
//
// Output: docs/release/evidence/staging-journeys/<sha>/report.md, results.json
// and the screenshots, unless --out says otherwise. Run it after every merge
// train: --sha must equal what staging reports, or the run says so first.
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { imapMailbox, loadInbox, redactAddress, tagAddress } from './staging-inbox.mjs';
import { e2eAddress, testMailbox, testMailboxLinks, testMailboxState, TEST_MAILBOX_LABEL } from './staging-test-mailbox.mjs';
import { imapLinkReader } from './staging-journey-mail.mjs';
import { codeSignIn, guardianWithdraw, isPaidReadRequest, isReaderRequest, stepFreeCap, stepHandwriting, stepHistory, stepIsolation, stepOffline, stepPhoto, stepSecondBrowser, stepTypedMark } from './staging-journey-steps.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'client', 'package.json'));
const STAGING = 'https://pri-learning-staging-staging.up.railway.app';
const ALLOWED_ORIGINS = new Set([STAGING]);
const LOOPBACK = /^http:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}$/;

/**
 * The one origin rule: staging, or — only for the in-process platform that
 * tools/staging-journey-local.mjs booted in THIS process — its loopback
 * origin. A command line can never supply that object, so the CLI stays
 * staging-only; parseArgs refuses every other origin before this is reached.
 */
export function assertJourneyOrigin(args) {
  if (ALLOWED_ORIGINS.has(args.origin)) return 'staging';
  const local = args.localPlatform;
  if (local && typeof local === 'object' && LOOPBACK.test(String(args.origin)) && local.origin === args.origin && typeof local.close === 'function') return 'local';
  throw new Error(`refused: ${args.origin} is not the staging origin (${STAGING}); this harness never touches production`);
}
// The phone runs in WebKit, the engine of the shipped iOS shell (WKWebView);
// the tablet runs in Chromium (the Android shell's WebView engine).
const SIZES = [
  { id: 'phone', engine: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { id: 'tablet', engine: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: false, hasTouch: true }
];
// Step 0 waits this long for the handwriting reader's probe to report ok.
const READER_WAIT_MS = 3 * 60 * 1000;
// Per-run budgets, inside staging's own limits per client identity:
// register 8/h, OTP request 20/h, login 12 per 15 min. A train run must leave
// room for a second run in the same hour; `full` uses the rest.
// paidReads: requests that buy a reading from the paid provider (handwriting,
// photo), at most 20 a run; the steps read 2 (one ink, one photo), well inside
// D20's 5 a day per kind on Free and D21's 120 an hour for the deployment.
export const PROFILES = {
  train: { register: 3, otpRequest: 9, login: 5, paidReads: 6 },
  full: { register: 4, otpRequest: 16, login: 9, paidReads: 20 }
};
const SECRET_KEY = /token|code|password|secret|cookie|nonce|challenge|session|csrf|otp|hash/i;

export function parseArgs(argv) {
  const args = { origin: STAGING, sha: null, accounts: false, out: null, headed: false, cleanup: null, profile: 'train' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--accounts') args.accounts = true;
    else if (flag === '--headed') args.headed = true;
    else if (flag === '--origin') args.origin = String(argv[++i] || '').replace(/\/$/, '');
    else if (flag === '--sha') args.sha = String(argv[++i] || '');
    else if (flag === '--out') args.out = String(argv[++i] || '');
    else if (flag === '--cleanup') args.cleanup = String(argv[++i] || '');
    else if (flag === '--profile') args.profile = String(argv[++i] || '');
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!PROFILES[args.profile]) throw new Error(`--profile must be ${Object.keys(PROFILES).join(' or ')}`);
  if (!ALLOWED_ORIGINS.has(args.origin)) throw new Error(`refused: ${args.origin} is not the staging origin (${STAGING}); this harness never touches production`);
  if (!args.cleanup && !/^[0-9a-f]{40}$/.test(args.sha || '')) throw new Error('--sha <40-hex main SHA> is required: the run proves one exact release');
  return args;
}

/** Replace every value whose key looks secret; keep shapes and codes of errors. */
export function redact(value, key = '') {
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => redact(v));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // An error's machine code (EMAIL_UNVERIFIED) is evidence, not a secret.
      if (/code$/i.test(k) && typeof v === 'string' && /^[A-Z][A-Z0-9_]+$/.test(v)) { out[k] = v; continue; }
      out[k] = SECRET_KEY.test(k) && v != null && typeof v !== 'boolean' ? '[redacted]' : redact(v, k);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  return value;
}

const now = () => new Date().toISOString();
const tag = () => randomBytes(3).toString('hex');

export async function runJourney(args) {
  const where = assertJourneyOrigin(args);
  if (where === 'local' && !args.out) throw new Error('a local run writes its evidence outside the repository: pass `out`');
  const { chromium, webkit } = require('playwright');
  const sha = args.sha;
  const out = args.out || join(ROOT, 'docs', 'release', 'evidence', 'staging-journeys', sha);
  mkdirSync(out, { recursive: true });
  const run = { origin: args.origin, sha, profile: args.profile, startedAt: now(), accounts: args.accounts, steps: [], created: [], deleted: [], notDeleted: [], marked: [] };
  if (where === 'local') run.local = args.localLabel || 'LOCAL in-process platform with a SYNTHETIC reader and test email adapters — not staging evidence';
  const browsers = { chromium: await chromium.launch({ headless: !args.headed }), webkit: await webkit.launch({ headless: !args.headed }) };
  const runTag = tag();
  let shotN = 0;
  // The run's one synthetic password lives outside the repo, readable only by
  // this user, until every account it made is deleted: a crash or a bug must
  // never leave a staging account nobody can sign in to and delete.
  const password = `Pri-${randomBytes(9).toString('base64url')}-staging`;
  // A fresh owner-only directory per run (mkdtemp, 0700): never a predictable path in the shared temp dir.
  const recovery = join(mkdtempSync(join(tmpdir(), 'pri-staging-journey-')), `${runTag}.json`);
  let recoveryWritten = false;
  // Code source, in order: a mailbox handed in (the local proof entry); L2's
  // staging test mailbox when /v1/ready says it is on (the default); the
  // owner's IMAP inbox file if it exists. Codes from the test mailbox prove
  // the app and server, not delivery to a real inbox, and say so.
  const readyNow = args.accounts && !args.mailbox ? await fetch(args.origin + '/v1/ready').then(r => r.json()).catch(() => null) : null;
  run.testMailbox = testMailboxState(readyNow);
  const useTestMailbox = args.accounts && !args.mailbox && run.testMailbox === 'on';
  const inbox = useTestMailbox ? { ok: false, reason: 'the staging test mailbox is the code source' } : args.accounts ? (args.inbox || loadInbox()) : { ok: false, reason: 'no --accounts' };
  const mailbox = useTestMailbox ? testMailbox(args.origin) : inbox.ok ? (args.mailbox || imapMailbox(inbox.config)) : (args.mailbox || null);
  // Links (a guardian's consent and withdrawal) are in message bodies.
  const links = useTestMailbox ? testMailboxLinks(args.origin) : inbox.ok ? (args.links || imapLinkReader(inbox.config, args.origin)) : (args.links || null);
  const inboxAddress = inbox.ok ? inbox.config.PRI_STAGING_INBOX_ADDRESS : null;
  run.mailbox = useTestMailbox ? TEST_MAILBOX_LABEL : inbox.ok ? (args.mailboxLabel || 'test inbox present (mode 600)')
    : args.mailbox ? (args.mailboxLabel || 'a mailbox handed in') : `no code source: the staging test mailbox is ${run.testMailbox}; ${inbox.reason}`;
  // Every request to the reader's routes, and every exchange with /v1/practice,
  // kept in memory for the steps' own checks (never written as they are: the
  // evidence in results.json is the redacted copy).
  const readerLog = []; const exchanges = []; const paidLog = [];
  const lastCodeAt = new Map();
  const addressFor = (role, n) => useTestMailbox ? e2eAddress(runTag, n) : inboxAddress ? tagAddress(inboxAddress, runTag, n) : `delivered+pri-${runTag}-${role}@resend.dev`;
  const typeCode = async (page, idPrefix, code) => { await page.locator(`#${idPrefix}-0`).click(); await page.keyboard.type(code, { delay: 30 }); };
  const waitCode = async (s, to, purposes, since) => {
    for (const purpose of [].concat(purposes)) {
      const got = await mailbox.waitForCode(to, purpose, since, 120000).catch(err => ({ code: null, error: String(err?.message || err).slice(0, 120) }));
      if (got.code) { s.notes.push(`a ${purpose} code reached the test inbox after ${Math.round(got.waitedMs / 1000)} s`); return got.code; }
      if (got.error) s.notes.push(`the test inbox could not be read: ${got.error}`);
    }
    s.defects.push({ what: `no ${[].concat(purposes).join('/')} code reached the test inbox within 120 s; staging email delivery to that address may be restricted (for example a Resend sandbox domain)`, where: 'staging email delivery (Resend) to the test inbox', repro: 'request a code on staging for a plus-address of the test inbox', lane: 'owner (email delivery)' });
    return null;
  };
  const remember = () => {
    // A local run's accounts live in an in-process database that goes with it.
    if (!args.accounts || where === 'local') return;
    writeFileSync(recovery, JSON.stringify({ origin: args.origin, password, accounts: run.created }, null, 2), { mode: 0o600, flag: recoveryWritten ? 'w' : 'wx' });
    recoveryWritten = true;
    chmodSync(recovery, 0o600);
  };

  const step = (id, name) => {
    const s = { id, name, status: 'PENDING', checks: [], notes: [], evidence: [], shots: [], defects: [], blocked: [] };
    run.steps.push(s);
    return s;
  };
  const check = (s, label, ok, detail = '') => { s.checks.push({ label, ok: !!ok, detail: String(detail).slice(0, 600) }); return !!ok; };
  const finish = (s, status) => { s.status = status; return s; };

  // A context records its /v1 traffic into whichever step is current.
  let current = null;
  async function newContext(size, label) {
    const ctx = await browsers[size.engine].newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, deviceScaleFactor: 2, serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    page.on('pageerror', err => current?.notes.push(`${label}: uncaught page error: ${String(err.message || err).slice(0, 200)}`));
    page.on('request', request => {
      let url; try { url = new URL(request.url()); } catch { return; }
      if (url.origin !== args.origin) return;
      // When a code was last asked for each address: the server allows one per 30 s per purpose.
      if (request.method() === 'POST' && /^\/v1\/account\/otp\/(request|reauth-request|delete-request)$/.test(url.pathname)) {
        let dest = null; try { dest = request.postDataJSON()?.destination; } catch { dest = null; }
        if (dest) lastCodeAt.set(String(dest).toLowerCase(), Date.now());
      }
      if (!isReaderRequest(url.pathname)) return;
      readerLog.push({ context: label, at: Date.now(), method: request.method(), path: url.pathname, step: current?.id || null });
      if (isPaidReadRequest(request.method(), url.pathname)) paidLog.push({ context: label, at: Date.now(), path: url.pathname, via: 'read', step: current?.id || null });
    });
    page.on('response', async response => {
      const url = new URL(response.url());
      if (url.origin !== args.origin || !url.pathname.startsWith('/v1/')) return;
      const request = response.request();
      let reqBody = null; let resBody = null;
      try { reqBody = request.postDataJSON(); } catch { reqBody = request.postData() ? '[non-JSON body]' : null; }
      try { resBody = await response.json(); } catch { resBody = null; }
      current?.evidence.push({ context: label, at: now(), method: request.method(), path: url.pathname, status: response.status(), request: redact(reqBody), response: redact(resBody) });
      if (request.method() === 'POST' && url.pathname.startsWith('/v1/practice/')) {
        exchanges.push({ context: label, at: Date.now(), path: url.pathname, status: response.status(), request: reqBody && typeof reqBody === 'object' ? reqBody : null, response: resBody });
        // A Submit that carried its picture and was not answered from a kept read bought one.
        if (/\/submit$/.test(url.pathname) && reqBody?.image && resBody?.reading && resBody.reading.reused === false) paidLog.push({ context: label, at: Date.now(), path: url.pathname, via: 'submit', step: current?.id || null });
      }
      if (isReaderRequest(url.pathname) && [429, 503].includes(response.status())) {
        current?.notes.push(`${label}: the reader route ${url.pathname} answered ${response.status()} ${resBody?.error?.code || ''} (a cap: ${JSON.stringify(redact({ limit: resBody?.error?.limit, plan: resBody?.error?.plan, resetAt: resBody?.error?.resetAt }))})`);
      }
    });
    return { ctx, page, label };
  }
  async function shot(s, page, name) {
    const file = join(out, `${String(++shotN).padStart(2, '0')}-${s.id}-${name}.png`);
    const mask = [page.locator('input[type="email"], #signup-destination, #signup-password-email, #guardian-destination, #delete-request-email, #signup-parent-destination')];
    if (inboxAddress) mask.push(page.getByText(inboxAddress.slice(inboxAddress.lastIndexOf('@')), { exact: false }));
    await page.screenshot({ path: file, fullPage: false, mask }).catch(() => null);
    s.shots.push(relative(out, file));
  }
  async function api(page, method, path, body) {
    return page.evaluate(async ({ method, path, body }) => {
      const csrf = document.cookie.split('; ').find(c => c.startsWith('pri_csrf='))?.split('=')[1];
      const headers = { Accept: 'application/json', 'X-Pri-Client': 'web-v1' };
      if (body) headers['Content-Type'] = 'application/json';
      if (csrf && method !== 'GET') headers['X-Pri-CSRF'] = decodeURIComponent(csrf);
      const r = await fetch(path, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
      let data = null; try { data = await r.json(); } catch { /* not JSON */ }
      return { status: r.status, data };
    }, { method, path, body });
  }
  const signedInAs = async page => (await api(page, 'GET', '/v1/account/me')).data?.account?.id || null;
  // The server allows one code per address and purpose every 30 s.
  const codeCooldown = async email => {
    const last = lastCodeAt.get(String(email).toLowerCase());
    const wait = last ? last + 31000 - Date.now() : 0;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  };
  const paidReads = () => paidLog.length;
  // What the practice steps (tools/staging-journey-steps.mjs) work with.
  const h = {
    args, run, origin: args.origin, SIZES, profile: PROFILES[args.profile], redact,
    begin: (id, name) => (current = step(id, name)), current: () => current,
    check, finish, shot, api, newContext, signedInAs, typeCode, codeCooldown,
    waitCode: (s, to, purposes, since) => waitCode(s, to, purposes, since),
    mailbox, links,
    readerRequests: () => readerLog, exchanges: () => exchanges, paidReads,
    readBudgetLeft: () => paidReads() < PROFILES[args.profile].paidReads,
    lastSubmitBody: path => exchanges.filter(e => e.path === path && e.request).at(-1)?.request || null,
    marked: m => run.marked.push(m),
    // Local only: the in-process SYNTHETIC reader is told what was drawn (it never sees the picture).
    local: where === 'local' ? {
      platform: args.localPlatform,
      script: ({ text, confidence }) => { Object.assign(args.localPlatform.reader, { text: String(text), lines: null, confidence, down: false, gate: null }); args.localPlatform.forgetKeptReads?.(); }
    } : null
  };

  try {
    // ── 0 · which release is staging serving? ──────────────────────────────
    current = step('0', 'Release identity: staging serves the nominated SHA');
    {
      const get = async path => { const r = await fetch(args.origin + path); return { status: r.status, data: await r.json().catch(() => null) }; };
      const web = await get('/release.json'); const health = await get('/v1/health'); const ready = await get('/v1/ready');
      current.evidence.push({ path: '/release.json', status: web.status, response: web.data }, { path: '/v1/health', status: health.status, response: redact(health.data) }, { path: '/v1/ready', status: ready.status, response: redact(ready.data) });
      run.deployed = { web: web.data?.releaseSha, server: health.data?.releaseIdentity?.releaseSha, ready: ready.data?.releaseSha, buildTimestamp: web.data?.buildTimestamp, engine: health.data?.database?.engine };
      const same = check(current, 'web, server and readiness all report the nominated SHA', [web.data?.releaseSha, health.data?.releaseIdentity?.releaseSha, ready.data?.releaseSha].every(v => v === sha), JSON.stringify(run.deployed));
      check(current, '/v1/ready says the replica can serve', ready.data?.ready === true, ready.data?.state);
      // The reader probes its provider after a deploy; a journey that writes
      // must not start while it still says 'probing'. Wait up to 3 minutes.
      let reader = ready.data?.checks?.handwriting?.state;
      const started = Date.now();
      while (reader !== 'ok' && Date.now() - started < READER_WAIT_MS) {
        await new Promise(r => setTimeout(r, 10000));
        reader = (await get('/v1/ready')).data?.checks?.handwriting?.state;
      }
      run.deployed.handwriting = reader;
      const readerOk = check(current, `/v1/ready reports the handwriting reader ok (waited ${Math.round((Date.now() - started) / 1000)} s)`, reader === 'ok', String(reader));
      if (!readerOk) current.defects.push({ what: `the handwriting reader is '${reader}' 3 minutes after the deploy`, where: '/v1/ready checks.handwriting', repro: `GET ${args.origin}/v1/ready`, lane: 'L4 (reader) / owner (provider key)' });
      // L2's staging test mailbox: absent (not deployed yet) is BLOCKED; off is a defect.
      const tm = testMailboxState(ready.data);
      if (tm === 'on') check(current, 'the staging test mailbox is on (/v1/ready testMailbox)', true);
      else if (tm === 'off') {
        check(current, 'the staging test mailbox is on (/v1/ready testMailbox)', false, 'off');
        current.defects.push({ what: 'staging reports testMailbox off, so no email code can be read', where: '/v1/ready testMailbox (RAILWAY_ENVIRONMENT_NAME must be staging)', repro: `GET ${args.origin}/v1/ready`, lane: 'L2' });
      } else current.blocked.push('/v1/ready does not report testMailbox yet: L2\'s staging test mailbox is not deployed');
      const base = same && ready.data?.ready === true && readerOk;
      finish(current, !base || tm === 'off' ? 'FAIL' : tm === 'on' ? 'PASS' : 'BLOCKED');
      if (!same) current.defects.push({ what: 'staging is not serving the nominated SHA', where: 'deployment', repro: `GET ${args.origin}/release.json`, lane: 'L8 (deploy)' });
    }

    // ── 1 · first open at phone and tablet ─────────────────────────────────
    current = step('1', 'First open: the app loads, offers sign-in and can be installed (phone 390×844, tablet 820×1180)');
    {
      let all = true;
      for (const size of SIZES) {
        const { ctx, page } = await newContext(size, size.id);
        await page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
        const card = page.locator('[data-signin-card="page"]');
        const shown = await card.waitFor({ timeout: 45000 }).then(() => true, () => false);
        all = check(current, `${size.id}: the sign-in card is shown to a new visitor`, shown) && all;
        const manifest = await page.evaluate(async () => {
          const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
          if (!href) return null;
          const r = await fetch(href); const m = await r.json().catch(() => null);
          return { href, status: r.status, name: m?.name, display: m?.display, icons: (m?.icons || []).length, start: m?.start_url };
        });
        all = check(current, `${size.id}: a web app manifest with a name and icons (installable)`, manifest?.status === 200 && !!manifest.name && manifest.icons > 0, JSON.stringify(manifest)) && all;
        const sw = await page.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration?.())?.active, null, { timeout: 30000 }).then(() => true, () => false);
        all = check(current, `${size.id}: a service worker is installed and active (opens again offline)`, sw) && all;
        await shot(current, page, `${size.id}-first-open`);
        await ctx.close();
      }
      const errors = current.notes.filter(n => n.includes('uncaught'));
      all = check(current, 'no uncaught errors on first open', errors.length === 0, errors.join(' | ')) && all;
      finish(current, all ? 'PASS' : 'FAIL');
    }

    if (!args.accounts) {
      for (const [id, name] of [['2', 'Sign-up and sign-in'], ['3', 'Minor account: guardian consent pending'], ['4', 'Account-bound sync and recovery'], ['5', 'Server-issued question, typed answer, server mark'], ['6', 'Handwritten answer through the real reader'], ['7', 'Photo answer through the real reader'], ['8', 'History and persistence'], ['9', 'Offline mid-answer'], ['10', 'Sign out everywhere'], ['11', 'Account deletion and cleanup']]) {
        const s = step(id, name);
        s.blocked.push('not run: account steps need --accounts (the owner authorizes test accounts on staging)');
        finish(s, 'BLOCKED');
      }
      return run;
    }

    // ── 2 · sign-up and sign-in ────────────────────────────────────────────
    const adult = { name: 'Staging Proof Adult', email: addressFor('adult', 4) };
    current = step('2', 'Sign-up and sign-in (email code on the card; a password account signs in before verifying)');
    let adultCtxA = null;
    const coder = { email: null, id: null, ctx: null };
    {
      // 2a · the card's sign-up: an email code. Its mail cannot be read.
      const { ctx, page } = await newContext(SIZES[0], 'phone');
      await page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const card = page.locator('[data-signin-card="page"]');
      await card.waitFor({ timeout: 45000 });
      const codeAddress = addressFor('code', 1);
      const sentAt = Date.now();
      await card.locator('#signup-destination').fill(codeAddress);
      await card.getByTestId('signup-send-code').click();
      const codeStep = await card.locator('#signup-code-0').waitFor({ timeout: 20000 }).then(() => true, () => false);
      check(current, 'email-code sign-up: the card sends a code and shows the six code boxes', codeStep);
      await shot(current, page, 'email-code-sent');
      if (!mailbox) {
        current.blocked.push(`email-code sign-up cannot finish: the six-digit code goes to a mailbox this harness cannot read (${run.mailbox}). Closes with the owner's test inbox file.`);
        await ctx.close();
      } else {
        const code = await waitCode(current, codeAddress, 'sign-in', sentAt);
        if (code) {
          await typeCode(page, 'signup-code', code);
          await card.locator('#signup-flow-name').waitFor({ timeout: 30000 }).catch(() => {});
          if (await card.locator('#signup-flow-name').count()) {
            await card.locator('#signup-flow-name').fill('Staging Proof Coder');
            await card.getByTestId('signup-age-18').click();
            await card.getByTestId('signup-agree').check();
            await card.getByTestId('signup-age-next').click();
          }
          if (await card.getByTestId('signup-class-10').waitFor({ timeout: 30000 }).then(() => true, () => false)) {
            await card.getByTestId('signup-class-10').click(); await card.getByTestId('signup-class-next').click();
          }
          const shell = await page.locator('.shell').waitFor({ timeout: 60000 }).then(() => true, () => false);
          const me = await api(page, 'GET', '/v1/account/me');
          await shot(current, page, 'email-code-signed-up');
          const inApp = check(current, 'email-code sign-up finishes: a verified account, inside the app', shell && me.status === 200 && me.data?.account?.emailVerified === true, `${me.status} shell=${shell}`);
          if (me.data?.account?.id) { coder.email = codeAddress; coder.id = me.data.account.id; run.created.push({ role: 'adult (email code)', email: codeAddress, id: coder.id, codeOnly: true }); remember(); }
          if (inApp) coder.ctx = { ctx, page, label: 'phone-code' }; else await ctx.close();
        } else await ctx.close();
      }

      // 2b · a password account, made through the server route the app's
      // Settings → Cloud account panel uses (the card itself only signs in).
      const made = await newContext(SIZES[0], 'phone');
      await made.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const reg = await api(made.page, 'POST', '/v1/account/register', { name: adult.name, email: adult.email, password, deviceId: `staging-proof-${runTag}`, isAdult: true, year: 10 });
      const regOk = check(current, 'a password account is registered (POST /v1/account/register, as Settings → Cloud account does)', reg.status === 201 || reg.status === 200, `${reg.status} ${JSON.stringify(redact(reg.data)).slice(0, 300)}`);
      if (regOk) { adult.id = reg.data?.account?.id; run.created.push({ role: 'adult', email: adult.email, id: adult.id }); remember(); }
      await made.ctx.close();

      // Sign in with that password on the card, in a fresh browser.
      adultCtxA = await newContext(SIZES[0], 'phone-A');
      const { page: pa } = adultCtxA;
      await pa.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const cardA = pa.locator('[data-signin-card="page"]');
      await cardA.waitFor({ timeout: 45000 });
      await cardA.getByTestId('signup-use-password').click();
      await cardA.locator('#signup-password-email').fill(adult.email);
      await cardA.locator('#signup-password').fill(password);
      await cardA.getByTestId('signup-password-submit').click();
      // A device with no profile is asked its class once, then the shell opens.
      const classStep = await cardA.getByTestId('signup-class-10').waitFor({ timeout: 30000 }).then(() => true, () => false);
      if (classStep) { await cardA.getByTestId('signup-class-10').click(); await cardA.getByTestId('signup-class-next').click(); }
      const shell = await pa.locator('.shell').waitFor({ timeout: 60000 }).then(() => true, () => false);
      await shot(current, pa, 'password-sign-in');
      const me = await api(pa, 'GET', '/v1/account/me');
      const serverIn = check(current, 'the server signs the password account in before its email is verified (session for that account)', me.status === 200 && me.data?.account?.id === adult.id, `${me.status}`);
      check(current, 'the account is still unverified (its code never left the mailbox)', me.data?.account && !me.data.account.emailVerified);
      const gate = await pa.locator('[data-testid="account-activation-gate"]').count();
      run.entered = shell && !gate;
      const message = (await pa.locator('[data-testid="signup-error"], [role="alert"]').first().innerText().catch(() => '')).trim();
      if (run.entered) {
        check(current, 'the card opens the app for it', true);
        finish(current, regOk && serverIn ? 'PASS' : 'FAIL');
      } else {
        // An unverified account may be held at the card by design; it must be
        // told the real reason and given a way on (verify the email).
        const toldVerify = /verif|confirm your email|email address/i.test(message);
        const blamesGuardian = /guardian|parent/i.test(message);
        check(current, 'held at the card, the student is told the email must be verified', toldVerify && !blamesGuardian, message || '(no message)');
        current.notes.push(`the card stays on its ${await pa.locator('[data-signin-card="page"]').getAttribute('data-signup-step').catch(() => '?')} step and says: "${message}"`);
        if (blamesGuardian) {
          current.defects.push({
            what: `an ADULT whose email is not verified signs in with a password and is told "${message}" — the guardian is not the blocker (the server's /guardian/state says required:false, not-required, eligible:false because emailVerified:false), and the card offers no way to verify the email, so the student is stuck`,
            where: 'client/src/components/onboardingAuthority.js decideOnboardingAuthority (an unverified adult returns "unavailable") → SignUpFlow.jsx finish() shows signup.consentCheckUnavailable',
            repro: 'POST /v1/account/register {isAdult:true} (as Settings → Cloud account does), then on a new device: "Sign in with password" on the card, class 10, Continue',
            lane: 'L2 (account/activation logic) with L3 (card copy)'
          });
        }
        finish(current, regOk && serverIn && toldVerify && !blamesGuardian ? 'PASS' : 'FAIL');
      }
    }

    if (mailbox && !coder.ctx && current.status !== 'FAIL') finish(current, 'FAIL');
    // The UI steps below use the verified email-code account when there is one.
    const ui = coder.ctx || (run.entered ? adultCtxA : null);
    const uiAccount = coder.ctx ? { email: coder.email, id: coder.id, codeOnly: true } : { email: adult.email, id: adult.id, codeOnly: false };
    run.entered = !!ui;

    // ── 3 · a minor: guardian consent is requested and the account waits ──
    current = step('3', 'Minor account: guardian consent requested, account held pending');
    const child = { name: 'Staging Proof Child', email: addressFor('child', 5), guardian: addressFor('guardian', 6) };
    {
      const { ctx, page } = await newContext(SIZES[1], 'tablet-child');
      await page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const reg = await api(page, 'POST', '/v1/account/register', { name: child.name, email: child.email, password, deviceId: `staging-proof-${runTag}-child`, isAdult: false, year: 8, guardianName: 'Staging Proof Guardian', guardianEmail: child.guardian });
      const made = check(current, 'a Class 8 account names its guardian and is registered', reg.status === 201 || reg.status === 200, `${reg.status} ${JSON.stringify(redact(reg.data)).slice(0, 300)}`);
      if (made) { child.id = reg.data?.account?.id; run.created.push({ role: 'child', email: child.email, id: child.id }); remember(); }
      const state = await api(page, 'GET', '/v1/account/guardian/state');
      const pending = check(current, 'the server holds the account pending guardian consent', state.status === 200 && state.data?.required === true && state.data?.state !== 'given', JSON.stringify(redact(state.data)));
      const practice = await api(page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
      check(current, `practice is refused to it before consent (403 ${practice.data?.error?.code || '?'}; the gate that answers first is recorded, not assumed)`, practice.status === 403, `${practice.status} ${practice.data?.error?.code}`);
      // What the student sees: sign in on the card in a fresh browser.
      await ctx.close();
      const fresh = await newContext(SIZES[1], 'tablet-child-2');
      await fresh.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const card = fresh.page.locator('[data-signin-card="page"]');
      await card.waitFor({ timeout: 45000 });
      await card.getByTestId('signup-use-password').click();
      await card.locator('#signup-password-email').fill(child.email);
      await card.locator('#signup-password').fill(password);
      await card.getByTestId('signup-password-submit').click();
      await fresh.page.waitForTimeout(4000);
      const classStep = await card.getByTestId('signup-class-8').isVisible().catch(() => false);
      if (classStep) { await card.getByTestId('signup-class-8').click(); await card.getByTestId('signup-class-next').click(); await fresh.page.waitForTimeout(3000); }
      const step = await card.getAttribute('data-signup-step').catch(() => null);
      const shellOpen = await fresh.page.locator('.shell').count() > 0 && !(await fresh.page.locator('[data-testid="account-activation-gate"]').count());
      await shot(current, fresh.page, 'child-sign-in');
      const held = check(current, 'signing in shows the guardian step, not the app', !shellOpen && (step === 'parent' || step === 'parent-wait' || /parent|guardian/i.test(String(step))), `card step ${step}, shell open ${shellOpen}`);
      await fresh.ctx.close();
      let approved = true;
      let withdrew = !mailbox;   // without a mailbox the minor journey is BLOCKED below
      let minorConsent = null;
      if (!mailbox) {
        current.blocked.push(`the guardian's approval code goes to the guardian's mailbox, which this harness cannot read (${run.mailbox}); closes with the owner's test inbox file`);
      } else {
        // The real minor journey: code sign-up, the parent step, the parent
        // approves on their own device with the code they were sent.
        const kidAddress = addressFor('child-code', 2); const parentAddress = addressFor('guardian-code', 3);
        const K = await newContext(SIZES[0], 'phone-child');
        await K.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
        const kcard = K.page.locator('[data-signin-card="page"]');
        await kcard.waitFor({ timeout: 45000 });
        const t0 = Date.now();
        await kcard.locator('#signup-destination').fill(kidAddress);
        await kcard.getByTestId('signup-send-code').click();
        await kcard.locator('#signup-code-0').waitFor({ timeout: 20000 });
        const kidCode = await waitCode(current, kidAddress, 'sign-in', t0);
        approved = false;
        if (kidCode) {
          await typeCode(K.page, 'signup-code', kidCode);
          await kcard.locator('#signup-flow-name').waitFor({ timeout: 30000 });
          await kcard.locator('#signup-flow-name').fill('Staging Proof Minor');
          await kcard.getByTestId('signup-age-13').click();
          if (await kcard.getByTestId('signup-agree').count()) await kcard.getByTestId('signup-agree').check();
          await kcard.getByTestId('signup-age-next').click();
          await kcard.getByTestId('signup-class-8').waitFor({ timeout: 30000 });
          await kcard.getByTestId('signup-class-8').click(); await kcard.getByTestId('signup-class-next').click();
          await kcard.locator('#signup-parent-name').waitFor({ timeout: 30000 });
          const kme = await api(K.page, 'GET', '/v1/account/me');
          if (kme.data?.account?.id) { run.created.push({ role: 'child (email code)', email: kidAddress, id: kme.data.account.id, codeOnly: true }); remember(); }
          await kcard.locator('#signup-parent-name').fill('Staging Proof Guardian');
          await kcard.locator('#signup-parent-destination').fill(parentAddress);
          const t1 = Date.now();
          await kcard.getByTestId('signup-parent-send').click();
          const waiting = await kcard.getByTestId('signup-parent-waiting').waitFor({ timeout: 20000 }).then(() => true, () => false);
          check(current, 'a 13-year-old signed up by email code waits for a parent, with no way into the app', waiting && !(await K.page.locator('.shell').count()));
          await shot(current, K.page, 'minor-waiting');
          const parentCode = await waitCode(current, parentAddress, 'guardian', t1);
          if (parentCode) {
            const G = await newContext(SIZES[0], 'phone-parent');
            await G.page.goto(args.origin + '/guardian/consent', { waitUntil: 'domcontentloaded' });
            // The page renders after the bundle loads: wait for it before choosing Email.
            await G.page.locator('#guardian-destination').waitFor({ timeout: 45000 });
            const emailRadio = G.page.getByRole('radio', { name: 'Email' });
            if (await emailRadio.count()) await emailRadio.click();
            await G.page.waitForFunction(() => document.querySelector('#guardian-destination')?.getAttribute('type') === 'email', null, { timeout: 10000 }).catch(() => {});
            await G.page.locator('#guardian-destination').fill(parentAddress);
            await G.page.getByTestId('guardian-agree').check();
            await typeCode(G.page, 'guardian-code', parentCode);
            const approvedAt = Date.now();
            minorConsent = { parentAddress, requestedAt: t1, approvedAt };
            await G.page.getByTestId('guardian-approve').click();
            const ok = await G.page.getByText('account is approved', { exact: false }).waitFor({ timeout: 20000 }).then(() => true, () => false);
            await shot(current, G.page, 'parent-approved');
            check(current, 'the parent approves on their own device with the code they were sent', ok);
            await G.ctx.close();
            if (await kcard.getByTestId('signup-parent-check').count()) await kcard.getByTestId('signup-parent-check').click();
            approved = check(current, 'once approved, the minor enters the app', await K.page.locator('.shell').waitFor({ timeout: 60000 }).then(() => true, () => false));
            await shot(current, K.page, 'minor-in-app');
            // The guardian withdraws; the child's next question is refused.
            if (approved && links) withdrew = await guardianWithdraw(h, current, { K, ...minorConsent }).catch(err => { current.notes.push(`the harness stopped the withdrawal: ${String(err?.message || err).slice(0, 200)}`); return false; });
            else if (approved) current.blocked.push('the guardian\'s withdrawal link is in the body of an email; this run has no link reader');
          }
        }
        await K.ctx.close();
      }
      finish(current, made && pending && held && approved && withdrew && current.checks.every(c => c.ok) ? 'PASS' : current.blocked.length && current.checks.every(c => c.ok) ? 'BLOCKED' : 'FAIL');
      if (made && !held) current.defects.push({ what: 'a pending minor reached the app (or no guardian step) on password sign-in', where: 'SignUpFlow / activation gate', repro: 'register a Class 8 account with a guardian, sign in with password on the card', lane: 'L2' });
    }

    // ── 4–9 need an issued question, which needs a verified email ──────────
    // With the mailbox, the verified email-code adult (step 2) drives them in
    // the phone (WebKit); a second browser (Chromium) joins for 4 and 8. The
    // order is the student's: mark (5, 6, 7, 9), then the second device (4, 8).
    let second = null;
    if (mailbox && coder.ctx) {
      const A = coder.ctx; const account = { id: coder.id, email: coder.email };
      // One step that throws (a selector that never came) fails that step, not the journey.
      const safely = async fn => {
        try { return await fn(); } catch (err) {
          current?.notes.push(`the harness stopped this step: ${String(err?.stack || err).split('\n').slice(0, 3).join(' | ')}`);
          if (current?.status === 'PENDING') finish(current, 'FAIL');
          return null;
        }
      };
      await safely(() => stepTypedMark(h, A, account));
      const unverified = await api(adultCtxA.page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
      check(current, 'and an UNVERIFIED account (the password account of step 2) is refused a question (403 EMAIL_UNVERIFIED), as designed', unverified.status === 403 && unverified.data?.error?.code === 'EMAIL_UNVERIFIED', `${unverified.status} ${unverified.data?.error?.code}`);
      if (current.status === 'PASS' && !current.checks.every(c => c.ok)) finish(current, 'FAIL');
      await safely(() => stepHandwriting(h, A, account));
      await safely(() => stepPhoto(h, A, account));
      await safely(() => stepOffline(h, A, account));
      const joined = await safely(() => stepSecondBrowser(h, A, account));
      second = joined?.B || null;
      await safely(() => stepHistory(h, A, second));
      if (args.profile === 'full') {
        // Account B: another verified adult, made by code here and deleted at cleanup.
        const s12 = h.begin('12', 'Cross-account isolation (full): account B is refused account A\'s question by id (404 QUESTION_NOT_FOUND)');
        const bAddress = addressFor('isolation', 7);
        const other = await safely(() => codeSignIn(h, SIZES[1], 'tablet-other', bAddress, { name: 'Staging Proof Other', s: s12 })) || {};
        if (other.id) { run.created.push({ role: 'adult B (email code)', email: bAddress, id: other.id, codeOnly: true }); remember(); }
        await safely(() => stepIsolation(h, other, account, s12));
        await safely(() => stepFreeCap(h, other));
        await other.ctx?.close().catch(() => {});
      }
    } else {
    current = step('5', 'Server-issued question, typed answer, server mark (and the #723 ₹/crore form)');
    {
      const { page } = adultCtxA;
      const issue = await api(page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
      check(current, 'the server refuses an unverified account a question (EMAIL_UNVERIFIED), as designed', issue.status === 403 && issue.data?.error?.code === 'EMAIL_UNVERIFIED', `${issue.status} ${issue.data?.error?.code}`);
      let told = true;
      if (run.entered) {
        await page.goto(args.origin + '/practice', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(6000);
        const text = (await page.locator('main, .shell').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
        await shot(current, page, 'practice-unverified');
        told = check(current, 'the student is told why there is no question (verify your email)', /verif/i.test(text), text);
        if (!told) current.defects.push({ what: 'an unverified student opens Practice and is not told that verifying the email unlocks questions', where: '/practice (client handling of 403 EMAIL_UNVERIFIED from /v1/practice/issue)', repro: 'sign in with an unverified password account, open /practice', lane: 'L3 (with L2 for the error contract)' });
      } else {
        current.blocked.push('the unverified account never got past the sign-in card (step 2), so Practice could not be opened in the app');
      }
      current.blocked.push('marking needs a verified email (server/platform/practice.js: requireVerifiedEmail on every practice route); verification needs the code from the mailbox. Closes with PRI_STAGING_MAILBOX_CMD.');
      finish(current, told ? 'BLOCKED' : 'FAIL');
    }
    for (const [id, name, why] of [
      ['4', 'Account-bound sync and recovery (second browser, same progress and History)', 'there is no marked work to compare until step 5 runs'],
      ['6', 'Handwritten answer through the real reader (SYNTHETIC ink)', 'reading and marking a handwritten answer are practice routes, behind the verified-email gate'],
      ['7', 'Photo answer through the real reader (SYNTHETIC photo)', 'the photo path issues and marks through the same verified-email gate'],
      ['8', 'History and persistence after reload, both browsers', 'there are no marked attempts to find until steps 5–7 run'],
      ['9', 'Offline mid-answer: the draft is kept and read when back online', 'needs an issued question to answer']
    ]) {
      const s = step(id, name);
      s.blocked.push(mailbox ? `${why}; the verified email-code account of step 2 did not reach the app, so there is no account to drive them with` : `${why}; that needs a verified email, so the mailbox (${run.mailbox}).`);
      finish(s, 'BLOCKED');
    }
    }

    // ── 10 · sign out everywhere ───────────────────────────────────────────
    current = step('10', 'Sign out everywhere: a second browser is signed out');
    {
      // The second browser of step 4, when there is one: still signed in to the same account.
      const B = second || await newContext(SIZES[1], 'tablet-B');
      if (!second) await B.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      let bIn;
      if (second) {
        bIn = check(current, 'the second browser of step 4 (Chromium) is still signed in to the same account', (await signedInAs(B.page)) === uiAccount.id);
      } else if (uiAccount.codeOnly) {
        const bcard = B.page.locator('[data-signin-card="page"]');
        await bcard.waitFor({ timeout: 45000 });
        await codeCooldown(uiAccount.email);
        const t0 = Date.now();
        await bcard.locator('#signup-destination').fill(uiAccount.email);
        await bcard.getByTestId('signup-send-code').click();
        await bcard.locator('#signup-code-0').waitFor({ timeout: 20000 });
        const code = await waitCode(current, uiAccount.email, 'sign-in', t0);
        if (code) await typeCode(B.page, 'signup-code', code);
        if (await bcard.getByTestId('signup-class-10').waitFor({ timeout: 20000 }).then(() => true, () => false)) { await bcard.getByTestId('signup-class-10').click(); await bcard.getByTestId('signup-class-next').click(); }
        await B.page.locator('.shell').waitFor({ timeout: 60000 }).catch(() => {});
        bIn = check(current, 'a second browser signs in to the same account (email code)', (await signedInAs(B.page)) === uiAccount.id);
      } else {
        const login = await api(B.page, 'POST', '/v1/account/login', { email: adult.email, password, deviceId: `staging-proof-${runTag}-B` });
        bIn = check(current, 'a second browser signs in to the same account', login.status === 200 && (await signedInAs(B.page)) === adult.id, `${login.status}`);
      }
      let hasControl = null;
      if (run.entered) {
        await ui.page.goto(args.origin + '/settings', { waitUntil: 'domcontentloaded' });
        await ui.page.waitForTimeout(3000);
        const control = ui.page.getByRole('button', { name: /sign out everywhere|sign out of all/i });
        hasControl = check(current, 'Settings offers "Sign out everywhere"', await control.count() > 0);
        await shot(current, ui.page, 'settings-sign-out-everywhere');
        if (hasControl) { await control.first().click(); await ui.page.waitForTimeout(3000); }
        else current.defects.push({ what: 'no "Sign out everywhere" control in Settings on this build', where: 'Settings (cloud account security)', repro: 'sign in, open /settings', lane: 'L2 (open PR #709 adds it)' });
      } else {
        current.blocked.push('Settings could not be opened: the unverified account never got past the sign-in card (step 2)');
      }
      if (!hasControl) {
        // The server half, through the route the control calls. Labelled API-only.
        const all = await api((ui || adultCtxA).page, 'POST', '/v1/account/logout-all', {});
        check(current, 'API only: POST /v1/account/logout-all revokes the account\'s sessions', all.status === 200, `${all.status} ${JSON.stringify(all.data)}`);
      }
      const bMe = await api(B.page, 'GET', '/v1/account/me');
      const bOut = check(current, 'the second browser is signed out (its /v1/account/me answers 401)', bMe.status === 401, `${bMe.status}`);
      await B.page.reload({ waitUntil: 'domcontentloaded' });
      await B.page.waitForTimeout(4000);
      await shot(current, B.page, 'second-browser-after');
      await B.ctx.close();
      finish(current, !bIn || !bOut ? 'FAIL' : hasControl === null ? 'BLOCKED' : hasControl ? 'PASS' : 'FAIL');
    }

    // ── 11 · deletion in the app, and cleanup of everything made ───────────
    current = step('11', 'Account deletion in the app (Settings → Cloud account), and cleanup');
    {
      if (!run.entered) {
        current.blocked.push('in-app deletion is in Settings, which the unverified account cannot reach (step 2); the public deletion page sends an email code to the mailbox. The accounts are deleted below through DELETE /v1/account with the password (the route the Settings form calls), labelled API cleanup');
        finish(current, 'BLOCKED');
      } else if (uiAccount.codeOnly) {
        // Sign in again (step 10 signed every session out), then delete in Settings with a code.
        const D = await newContext(SIZES[1], 'tablet-delete');
        await D.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
        const dcard = D.page.locator('[data-signin-card="page"]');
        await dcard.waitFor({ timeout: 45000 });
        await codeCooldown(uiAccount.email);
        let t0 = Date.now();
        await dcard.locator('#signup-destination').fill(uiAccount.email);
        await dcard.getByTestId('signup-send-code').click();
        await dcard.locator('#signup-code-0').waitFor({ timeout: 20000 });
        const signIn = await waitCode(current, uiAccount.email, 'sign-in', t0);
        if (signIn) await typeCode(D.page, 'signup-code', signIn);
        if (await dcard.getByTestId('signup-class-10').waitFor({ timeout: 20000 }).then(() => true, () => false)) { await dcard.getByTestId('signup-class-10').click(); await dcard.getByTestId('signup-class-next').click(); }
        await D.page.locator('.shell').waitFor({ timeout: 60000 }).catch(() => {});
        await D.page.goto(args.origin + '/settings#cloud-account-title', { waitUntil: 'domcontentloaded' });
        const send = D.page.getByTestId('cloud-delete-send-code');
        const found = check(current, 'Settings offers deletion by a code sent to the account\'s own address', await send.waitFor({ timeout: 30000 }).then(() => true, () => false));
        let deleted = false;
        if (found) {
          t0 = Date.now();
          await send.click();
          await D.page.locator('#cloud-delete-code-0').waitFor({ timeout: 15000 });
          const code = await waitCode(current, uiAccount.email, ['delete', 'sign-in'], t0);
          if (code) {
            await typeCode(D.page, 'cloud-delete-code', code);
            await D.page.locator('#cloud-delete-phrase').fill('DELETE');
            await shot(current, D.page, 'delete-with-code');
            await D.page.getByTestId('cloud-delete-with-code').click();
            await D.page.waitForFunction(() => !document.querySelector('#cloud-delete-code-0'), null, { timeout: 20000 }).catch(() => {});
            await D.page.waitForTimeout(3000);
            deleted = check(current, 'the account is deleted: its session is gone', (await api(D.page, 'GET', '/v1/account/me')).status === 401);
            if (deleted) run.deleted.push({ role: 'adult (email code)', email: uiAccount.email, via: 'in-app Settings (email code)' });
          }
        }
        await D.ctx.close();
        finish(current, found && deleted ? 'PASS' : 'FAIL');
        if (!(found && deleted)) current.defects.push({ what: 'in-app deletion of an email-code account did not complete', where: 'Settings → Cloud account → delete with a code', repro: 'email-code account, Settings, send code, enter it, type DELETE, delete', lane: 'L2' });
      } else {
        const D = adultCtxA;
        await D.page.goto(args.origin + '/settings#cloud-account-title', { waitUntil: 'domcontentloaded' });
        const pw = D.page.locator('#cloud-delete-password');
        const found = check(current, 'Settings shows the delete form for a password account', await pw.waitFor({ timeout: 30000 }).then(() => true, () => false));
        if (found) {
          await pw.fill(password);
          await D.page.locator('#cloud-delete-phrase').first().fill('DELETE');
          await shot(current, D.page, 'delete-form');
          await D.page.getByRole('button', { name: /Permanently delete cloud account/i }).click();
          await D.page.waitForTimeout(5000);
          await shot(current, D.page, 'after-delete');
        }
        const gone = await api(D.page, 'POST', '/v1/account/login', { email: adult.email, password, deviceId: `staging-proof-${runTag}-check` });
        const deleted = check(current, 'the deleted account can no longer sign in', gone.status === 401 || gone.status === 400 || gone.status === 404, `${gone.status} ${gone.data?.error?.code}`);
        if (deleted) run.deleted.push({ role: 'adult', email: adult.email, via: 'in-app Settings' });
        finish(current, found && deleted ? 'PASS' : 'FAIL');
        if (!(found && deleted)) current.defects.push({ what: 'in-app deletion of a password account did not complete', where: 'Settings → Cloud account → delete', repro: 'password account, Settings, confirm password, type DELETE, press delete', lane: 'L2' });
      }
    }
  } catch (err) {
    if (current) {
      current.notes.push(`the harness stopped here: ${String(err?.stack || err).split('\n').slice(0, 3).join(' | ')}`);
      if (current.status === 'PENDING') finish(current, 'FAIL');
    }
  } finally {
    // Cleanup: every account this run made and did not delete in the app.
    if (args.accounts) {
      for (const acct of run.created) {
        if (run.deleted.some(d => d.email === acct.email)) continue;
        const C = await newContext(SIZES[1], 'cleanup').catch(() => null);
        if (!C) { run.notDeleted.push({ ...acct, why: 'no browser for cleanup' }); continue; }
        if (acct.codeOnly) {
          // No password: the public deletion page, with a code from the test inbox.
          try {
            if (!mailbox) { run.notDeleted.push({ ...acct, why: 'a code-only account needs the test inbox to delete' }); continue; }
            await C.page.goto(args.origin + '/account/delete-request', { waitUntil: 'domcontentloaded' });
            await C.page.locator('#delete-request-email').fill(acct.email);
            await codeCooldown(acct.email);
            const t0 = Date.now();
            await C.page.getByTestId('delete-request-send').click();
            await C.page.locator('#delete-request-code-0').waitFor({ timeout: 15000 });
            const note = { notes: [], defects: [] };
            const code = await waitCode(note, acct.email, ['delete', 'sign-in'], t0);
            if (!code) { run.notDeleted.push({ ...acct, why: 'the deletion code never reached the test inbox' }); continue; }
            await typeCode(C.page, 'delete-request-code', code);
            const done = await C.page.getByTestId('delete-request-done').waitFor({ timeout: 20000 }).then(() => true, () => false);
            if (done) run.deleted.push({ role: acct.role, email: acct.email, via: 'public deletion page (email code)' });
            else run.notDeleted.push({ ...acct, why: 'the public deletion page did not confirm' });
          } catch (err) { run.notDeleted.push({ ...acct, why: String(err?.message || err).slice(0, 160) }); }
          finally { await C.ctx.close().catch(() => {}); }
          continue;
        }
        try {
          await C.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
          const login = await api(C.page, 'POST', '/v1/account/login', { email: acct.email, password, deviceId: `staging-proof-${runTag}-cleanup` });
          if (login.status !== 200) { run.notDeleted.push({ ...acct, why: `sign-in for cleanup answered ${login.status} ${login.data?.error?.code || ''}` }); continue; }
          const del = await api(C.page, 'DELETE', '/v1/account', { password, accountId: acct.id });
          if (del.status === 200 && del.data?.deleted) run.deleted.push({ role: acct.role, email: acct.email, via: 'API cleanup (DELETE /v1/account with the password)' });
          else run.notDeleted.push({ ...acct, why: `DELETE /v1/account answered ${del.status} ${del.data?.error?.code || ''}` });
        } catch (err) { run.notDeleted.push({ ...acct, why: String(err?.message || err).slice(0, 160) }); }
        finally { await C.ctx.close().catch(() => {}); }
      }
    }
    for (const b of Object.values(browsers)) await b.close().catch(() => {});
    if (args.accounts) {
      if (run.notDeleted.length) run.recoveryFile = recovery;   // kept: `--cleanup <file>` finishes the job
      else rmSync(dirname(recovery), { recursive: true, force: true });
    } else rmSync(dirname(recovery), { recursive: true, force: true });
    // What this run spent against staging's limits, from its own evidence.
    const calls = run.steps.flatMap(st => st.evidence).filter(e => e.method === 'POST');
    run.usage = {
      register: calls.filter(e => e.path === '/v1/account/register').length,
      otpRequest: calls.filter(e => /^\/v1\/account\/otp\/(request|reauth-request|delete-request|guardian\/request)$/.test(e.path)).length,
      login: calls.filter(e => e.path === '/v1/account/login').length,
      paidReads: paidLog.length
    };
    // Every request to the reader's routes (a status probe included), by step.
    run.reads = { paid: paidLog.map(r => ({ step: r.step, context: r.context, path: r.path.replace(/[0-9a-f-]{36}/g, ':id'), via: r.via })),
      readerRequests: readerLog.length, readerRequestsByStep: readerLog.reduce((m, r) => ({ ...m, [r.step || '-']: (m[r.step || '-'] || 0) + 1 }), {}) };
    run.budget = PROFILES[args.profile];
    run.overBudget = Object.keys(run.budget).filter(k => run.usage[k] > run.budget[k]);
    run.finishedAt = now();
    writeFileSync(join(out, 'results.json'), redactAddress(JSON.stringify(run, null, 2), inboxAddress) + '\n');
    writeFileSync(join(out, 'report.md'), redactAddress(report(run), inboxAddress));
  }
  return run;
}

export function report(run) {
  const order = s => Number(s.id);
  const steps = [...run.steps].sort((a, b) => order(a) - order(b));
  const lines = [];
  lines.push(`# ${run.local ? 'LOCAL journey proof (not staging)' : 'Staging journey proof'} · ${run.sha.slice(0, 9)}`, '');
  if (run.local) lines.push(`> **${run.local}.** A local pass is not staging evidence and not real-reader evidence.`, '');
  lines.push(`**Verdict: ${verdictOf(run).verdict}** (profile ${run.profile || 'train'}). PROVEN only when every step passed; INCOMPLETE when a step is BLOCKED; FAIL when a step failed.`, '');
  lines.push(`Origin \`${run.origin}\` · started ${run.startedAt} · finished ${run.finishedAt || '—'} · accounts ${run.accounts ? 'made and deleted by this run' : 'not made (no --accounts)'}.`);
  lines.push(`Mailbox: ${run.mailbox || 'not checked (no --accounts)'}.`);
  lines.push(`Deployed: web \`${run.deployed?.web || '?'}\`, server \`${run.deployed?.server || '?'}\`, readiness \`${run.deployed?.ready || '?'}\`, built ${run.deployed?.buildTimestamp || '?'}, database ${run.deployed?.engine || '?'}.`, '');
  lines.push(run.local
    ? 'The in-process platform server (client/test/support/online-session.mjs) serving the built client, in real browsers (the phone in WebKit, the tablet in Chromium; headless). Its handwriting reader is a SYNTHETIC stand-in that returns the text the harness drew and never looks at the picture; email codes and links are read from the server\'s test outbox. Drawn ink and rendered photos are SYNTHETIC inputs; nothing here is staging, real-reader, device, human or examiner evidence.'
    : 'Real deployed product, real browsers (Playwright: the phone in WebKit, the engine of the iOS shell; the tablet in Chromium; headless), nothing stubbed. Drawn ink and rendered photos are SYNTHETIC inputs; nothing here is device, human or examiner evidence.', '');
  lines.push('| Step | Status | What was proved or found |', '|---|---|---|');
  for (const s of steps) {
    const passed = s.checks.filter(c => c.ok).length;
    const summary = [s.checks.length ? `${passed}/${s.checks.length} checks` : '', ...s.defects.map(d => `DEFECT: ${d.what} (${d.lane})`), ...s.blocked.map(b => `BLOCKED: ${b.split(';')[0]}`)].filter(Boolean).join(' · ');
    lines.push(`| ${s.id} · ${s.name} | **${s.status}** | ${summary.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  for (const s of steps) {
    lines.push(`## ${s.id} · ${s.name} — ${s.status}`, '');
    for (const c of s.checks) lines.push(`- ${c.ok ? '✔' : '✖'} ${c.label}${c.detail ? ` — \`${c.detail.replace(/`/g, "'").slice(0, 300)}\`` : ''}`);
    for (const d of s.defects) lines.push(`- **Defect** (${d.lane}): ${d.what}. Where: ${d.where}. Repro: ${d.repro}.`);
    for (const b of s.blocked) lines.push(`- **Blocked:** ${b}`);
    if (run.mailbox === TEST_MAILBOX_LABEL && s.notes.some(n => /code reached|link reached/.test(n))) lines.push(`- **${TEST_MAILBOX_LABEL}**`);
    for (const n of s.notes) lines.push(`- Note: ${n}`);
    if (s.shots.length) lines.push(`- Screenshots: ${s.shots.map(f => `[${f}](${f})`).join(', ')}`);
    if (s.evidence.length) lines.push(`- /v1 evidence: ${s.evidence.length} request(s) in results.json (step ${s.id})`);
    lines.push('');
  }
  if (run.usage) lines.push(`Staging limits spent: register ${run.usage.register}/${run.budget.register}, OTP requests ${run.usage.otpRequest}/${run.budget.otpRequest}, logins ${run.usage.login}/${run.budget.login}, paid reads ${run.usage.paidReads ?? 0}/${run.budget.paidReads ?? '–'} (profile budget)${run.overBudget?.length ? ` — **OVER BUDGET: ${run.overBudget.join(', ')}**` : ''}.`, '');
  if (run.reads) lines.push(`Reader traffic: ${run.reads.readerRequests} request(s) to /v1/handwriting* and /recognize (by step ${JSON.stringify(run.reads.readerRequestsByStep)}); paid reads ${run.reads.paid.length} (${run.reads.paid.map(r => `step ${r.step} ${r.via}`).join(', ') || 'none'}). D20 allows 5 a day per kind on Free.`, '');
  lines.push('## Test accounts', '');
  lines.push(`Made: ${run.created.length ? run.created.map(a => `${a.role} ${a.email}`).join(', ') : 'none'}.`);
  lines.push(`Deleted: ${run.deleted.length ? run.deleted.map(a => `${a.role} (${a.via})`).join(', ') : 'none'}.`);
  lines.push(`**Not deleted: ${run.notDeleted.length ? run.notDeleted.map(a => `${a.role} ${a.email} — ${a.why}`).join('; ') : 'none'}.**`, '');
  if (run.recoveryFile) lines.push('The run kept a local recovery file outside the repository (owner-readable only); `node tools/staging-journey-proof.mjs --cleanup <that file>` deletes the accounts above.', '');
  return lines.join('\n') + '\n';
}

/** PROVEN (0) only when every step passed; INCOMPLETE (3) when none failed but one is BLOCKED; FAIL (1) otherwise. */
export function verdictOf(run) {
  const statuses = run.steps.map(s => s.status);
  if (!statuses.length || statuses.some(s => s === 'FAIL' || s === 'PENDING')) return { verdict: 'FAIL', exit: 1 };
  if (statuses.some(s => s !== 'PASS' && s !== 'SYNTHETIC-PASS')) return { verdict: 'INCOMPLETE', exit: 3 };
  return { verdict: 'PROVEN', exit: 0 };
}

/** Delete every account a recovery file lists: sign in with its password, DELETE /v1/account. */
export async function cleanupFromFile(file) {
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  if (!ALLOWED_ORIGINS.has(saved.origin)) throw new Error(`refused: ${saved.origin} is not the staging origin`);
  const results = [];
  for (const acct of saved.accounts || []) {
    const jar = {};
    const call = async (method, path, body) => {
      const headers = { Accept: 'application/json', 'X-Pri-Client': 'web-v1', Origin: saved.origin };
      if (body) headers['Content-Type'] = 'application/json';
      if (jar.cookie) headers.Cookie = jar.cookie;
      if (jar.csrf && method !== 'GET') headers['X-Pri-CSRF'] = jar.csrf;
      const r = await fetch(saved.origin + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const set = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
      if (set.length) {
        jar.cookie = set.map(c => c.split(';')[0]).join('; ');
        jar.csrf = decodeURIComponent((set.map(c => c.split(';')[0]).find(c => c.startsWith('pri_csrf=')) || '').slice(9));
      }
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    const login = await call('POST', '/v1/account/login', { email: acct.email, password: saved.password, deviceId: 'staging-proof-cleanup' });
    if (login.status !== 200) { results.push({ ...acct, deleted: false, why: `login ${login.status} ${login.data?.error?.code || ''}` }); continue; }
    const del = await call('DELETE', '/v1/account', { password: saved.password, accountId: acct.id });
    results.push({ ...acct, deleted: del.status === 200 && !!del.data?.deleted, why: del.status === 200 ? '' : `DELETE ${del.status} ${del.data?.error?.code || ''}` });
  }
  if (results.every(r => r.deleted)) rmSync(file, { force: true });
  return results;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = parseArgs(process.argv.slice(2));
  if (args.cleanup) {
    const results = await cleanupFromFile(args.cleanup);
    for (const r of results) console.log(`  ${r.deleted ? 'deleted' : 'NOT deleted'} ${r.role} ${r.email}${r.why ? ` — ${r.why}` : ''}`);
    process.exit(results.every(r => r.deleted) ? 0 : 1);
  }
  const run = await runJourney(args);
  for (const s of [...run.steps].sort((a, b) => Number(a.id) - Number(b.id))) console.log(`  ${s.id.padStart(2)} ${s.status.padEnd(14)} ${s.name}`);
  console.log(`  accounts made ${run.created.length}, deleted ${run.deleted.length}, NOT deleted ${run.notDeleted.length}`);
  const { verdict, exit } = verdictOf(run);
  console.log(`STAGING JOURNEY: ${verdict} — ${run.steps.filter(s => s.status === 'PASS' || s.status === 'SYNTHETIC-PASS').length} passed, ${run.steps.filter(s => s.status === 'FAIL').length} failed, ${run.steps.filter(s => s.status === 'BLOCKED').length} blocked · ${run.sha}`);
  process.exit(exit);
}
