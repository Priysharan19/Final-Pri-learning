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
// A step that needs to read an email (a sign-up code, the verification code
// that unlocks marking, a guardian's link) is BLOCKED (mailbox) unless
// PRI_STAGING_MAILBOX_CMD names a command that prints the newest code for an
// address (`$PRI_STAGING_MAILBOX_CMD <address>`); none exists yet.
//
// Output: docs/release/evidence/staging-journeys/<sha>/report.md, results.json
// and the screenshots, unless --out says otherwise. Run it after every merge
// train: --sha must equal what staging reports, or the run says so first.
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'client', 'package.json'));
const STAGING = 'https://pri-learning-staging-staging.up.railway.app';
const ALLOWED_ORIGINS = new Set([STAGING]);
const SIZES = [
  { id: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { id: 'tablet', viewport: { width: 820, height: 1180 }, isMobile: false, hasTouch: true }
];
const SECRET_KEY = /token|code|password|secret|cookie|nonce|challenge|session|csrf|otp|hash/i;

export function parseArgs(argv) {
  const args = { origin: STAGING, sha: null, accounts: false, out: null, headed: false, cleanup: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--accounts') args.accounts = true;
    else if (flag === '--headed') args.headed = true;
    else if (flag === '--origin') args.origin = String(argv[++i] || '').replace(/\/$/, '');
    else if (flag === '--sha') args.sha = String(argv[++i] || '');
    else if (flag === '--out') args.out = String(argv[++i] || '');
    else if (flag === '--cleanup') args.cleanup = String(argv[++i] || '');
    else throw new Error(`Unknown argument: ${flag}`);
  }
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
  const { chromium } = require('playwright');
  const sha = args.sha;
  const out = args.out || join(ROOT, 'docs', 'release', 'evidence', 'staging-journeys', sha);
  mkdirSync(out, { recursive: true });
  const run = { origin: args.origin, sha, startedAt: now(), accounts: args.accounts, steps: [], created: [], deleted: [], notDeleted: [] };
  const browser = await chromium.launch({ headless: !args.headed });
  const runTag = tag();
  let shotN = 0;
  // The run's one synthetic password lives outside the repo, readable only by
  // this user, until every account it made is deleted: a crash or a bug must
  // never leave a staging account nobody can sign in to and delete.
  const password = `Pri-${randomBytes(9).toString('base64url')}-staging`;
  const recovery = join(tmpdir(), 'pri-staging-journey', `${runTag}.json`);
  const remember = () => {
    if (!args.accounts) return;
    mkdirSync(dirname(recovery), { recursive: true, mode: 0o700 });
    writeFileSync(recovery, JSON.stringify({ origin: args.origin, password, accounts: run.created }, null, 2), { mode: 0o600 });
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
    const ctx = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, deviceScaleFactor: 2, serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    page.on('pageerror', err => current?.notes.push(`${label}: uncaught page error: ${String(err.message || err).slice(0, 200)}`));
    page.on('response', async response => {
      const url = new URL(response.url());
      if (url.origin !== args.origin || !url.pathname.startsWith('/v1/')) return;
      const request = response.request();
      let reqBody = null; let resBody = null;
      try { reqBody = request.postDataJSON(); } catch { reqBody = request.postData() ? '[non-JSON body]' : null; }
      try { resBody = await response.json(); } catch { resBody = null; }
      current?.evidence.push({ context: label, at: now(), method: request.method(), path: url.pathname, status: response.status(), request: redact(reqBody), response: redact(resBody) });
    });
    return { ctx, page, label };
  }
  async function shot(s, page, name) {
    const file = join(out, `${String(++shotN).padStart(2, '0')}-${s.id}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => null);
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
      finish(current, same && ready.data?.ready === true ? 'PASS' : 'FAIL');
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
    const adult = { name: 'Staging Proof Adult', email: `delivered+pri-${runTag}-adult@resend.dev` };
    current = step('2', 'Sign-up and sign-in (email code on the card; a password account signs in before verifying)');
    let adultCtxA = null;
    {
      // 2a · the card's sign-up: an email code. Its mail cannot be read.
      const { ctx, page } = await newContext(SIZES[0], 'phone');
      await page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const card = page.locator('[data-signin-card="page"]');
      await card.waitFor({ timeout: 45000 });
      const codeAddress = `delivered+pri-${runTag}-code@resend.dev`;
      await card.locator('#signup-destination').fill(codeAddress);
      await card.getByTestId('signup-send-code').click();
      const codeStep = await card.locator('#signup-code-0').waitFor({ timeout: 20000 }).then(() => true, () => false);
      check(current, 'email-code sign-up: the card sends a code and shows the six code boxes', codeStep);
      await shot(current, page, 'email-code-sent');
      current.blocked.push('email-code sign-up cannot finish: the six-digit code goes to a mailbox this harness cannot read (no account is created without it). Closes when PRI_STAGING_MAILBOX_CMD reads a dedicated test inbox.');
      await ctx.close();

      // 2b · a password account, made through the server route the app's
      // Settings → Cloud account panel uses (the card itself only signs in).
      const made = await newContext(SIZES[0], 'phone');
      await made.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const reg = await api(made.page, 'POST', '/v1/account/register', { name: adult.name, email: adult.email, password, deviceId: `staging-proof-${runTag}`, isAdult: true, year: 10 });
      current.evidence.push({ context: 'phone', method: 'POST', path: '/v1/account/register', status: reg.status, request: redact({ name: adult.name, email: adult.email, password, isAdult: true, year: 10 }), response: redact(reg.data) });
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

    // ── 3 · a minor: guardian consent is requested and the account waits ──
    current = step('3', 'Minor account: guardian consent requested, account held pending');
    const child = { name: 'Staging Proof Child', email: `delivered+pri-${runTag}-child@resend.dev`, guardian: `delivered+pri-${runTag}-guardian@resend.dev` };
    {
      const { ctx, page } = await newContext(SIZES[1], 'tablet-child');
      await page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const reg = await api(page, 'POST', '/v1/account/register', { name: child.name, email: child.email, password, deviceId: `staging-proof-${runTag}-child`, isAdult: false, year: 8, guardianName: 'Staging Proof Guardian', guardianEmail: child.guardian });
      current.evidence.push({ context: 'tablet-child', method: 'POST', path: '/v1/account/register', status: reg.status, request: redact({ name: child.name, email: child.email, password, isAdult: false, year: 8, guardianName: 'Staging Proof Guardian', guardianEmail: child.guardian }), response: redact(reg.data) });
      const made = check(current, 'a Class 8 account names its guardian and is registered', reg.status === 201 || reg.status === 200, `${reg.status} ${JSON.stringify(redact(reg.data)).slice(0, 300)}`);
      if (made) { child.id = reg.data?.account?.id; run.created.push({ role: 'child', email: child.email, id: child.id }); remember(); }
      const state = await api(page, 'GET', '/v1/account/guardian/state');
      current.evidence.push({ context: 'tablet-child', method: 'GET', path: '/v1/account/guardian/state', status: state.status, response: redact(state.data) });
      const pending = check(current, 'the server holds the account pending guardian consent', state.status === 200 && state.data?.required === true && state.data?.state !== 'given', JSON.stringify(redact(state.data)));
      const practice = await api(page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
      current.evidence.push({ context: 'tablet-child', method: 'POST', path: '/v1/practice/issue', status: practice.status, response: redact(practice.data) });
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
      current.blocked.push('the guardian confirmation link goes to the guardian mailbox, which this harness cannot read; closes with PRI_STAGING_MAILBOX_CMD reading a dedicated test inbox, then: open the link, confirm, and check the account opens');
      finish(current, made && pending && held ? 'PASS' : 'FAIL');
      if (made && !held) current.defects.push({ what: 'a pending minor reached the app (or no guardian step) on password sign-in', where: 'SignUpFlow / activation gate', repro: 'register a Class 8 account with a guardian, sign in with password on the card', lane: 'L2' });
    }

    // ── 4–9 need an issued question, which needs a verified email ──────────
    current = step('5', 'Server-issued question, typed answer, server mark (and the #723 ₹/crore form)');
    {
      const { page } = adultCtxA;
      const issue = await api(page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
      current.evidence.push({ context: 'phone-A', method: 'POST', path: '/v1/practice/issue', status: issue.status, response: redact(issue.data) });
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
      s.blocked.push(`${why}; that needs a verified email, so the mailbox (PRI_STAGING_MAILBOX_CMD).`);
      finish(s, 'BLOCKED');
    }

    // ── 10 · sign out everywhere ───────────────────────────────────────────
    current = step('10', 'Sign out everywhere: a second browser is signed out');
    {
      const B = await newContext(SIZES[1], 'tablet-B');
      await B.page.goto(args.origin + '/', { waitUntil: 'domcontentloaded' });
      const login = await api(B.page, 'POST', '/v1/account/login', { email: adult.email, password, deviceId: `staging-proof-${runTag}-B` });
      const bIn = check(current, 'a second browser signs in to the same account', login.status === 200 && (await signedInAs(B.page)) === adult.id, `${login.status}`);
      let hasControl = null;
      if (run.entered) {
        await adultCtxA.page.goto(args.origin + '/settings', { waitUntil: 'domcontentloaded' });
        await adultCtxA.page.waitForTimeout(3000);
        const control = adultCtxA.page.getByRole('button', { name: /sign out everywhere|sign out of all/i });
        hasControl = check(current, 'Settings offers "Sign out everywhere"', await control.count() > 0);
        await shot(current, adultCtxA.page, 'settings-sign-out-everywhere');
        if (hasControl) { await control.first().click(); await adultCtxA.page.waitForTimeout(3000); }
        else current.defects.push({ what: 'no "Sign out everywhere" control in Settings on this build', where: 'Settings (cloud account security)', repro: 'sign in, open /settings', lane: 'L2 (open PR #709 adds it)' });
      } else {
        current.blocked.push('Settings could not be opened: the unverified account never got past the sign-in card (step 2)');
      }
      if (!hasControl) {
        // The server half, through the route the control calls. Labelled API-only.
        const all = await api(adultCtxA.page, 'POST', '/v1/account/logout-all', {});
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
    await browser.close().catch(() => {});
    if (args.accounts) {
      if (run.notDeleted.length) run.recoveryFile = recovery;   // kept: `--cleanup <file>` finishes the job
      else rmSync(recovery, { force: true });
    }
    run.finishedAt = now();
    writeFileSync(join(out, 'results.json'), JSON.stringify(run, null, 2) + '\n');
    writeFileSync(join(out, 'report.md'), report(run));
  }
  return run;
}

export function report(run) {
  const order = s => Number(s.id);
  const steps = [...run.steps].sort((a, b) => order(a) - order(b));
  const lines = [];
  lines.push(`# Staging journey proof · ${run.sha.slice(0, 9)}`, '');
  lines.push(`Origin \`${run.origin}\` · started ${run.startedAt} · finished ${run.finishedAt || '—'} · accounts ${run.accounts ? 'made and deleted by this run' : 'not made (no --accounts)'}.`);
  lines.push(`Deployed: web \`${run.deployed?.web || '?'}\`, server \`${run.deployed?.server || '?'}\`, readiness \`${run.deployed?.ready || '?'}\`, built ${run.deployed?.buildTimestamp || '?'}, database ${run.deployed?.engine || '?'}.`, '');
  lines.push('Real deployed product, real browser (Playwright Chromium, headless), nothing stubbed. Drawn ink and rendered photos are SYNTHETIC inputs; nothing here is device, human or examiner evidence.', '');
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
    for (const n of s.notes) lines.push(`- Note: ${n}`);
    if (s.shots.length) lines.push(`- Screenshots: ${s.shots.map(f => `[${f}](${f})`).join(', ')}`);
    if (s.evidence.length) lines.push(`- /v1 evidence: ${s.evidence.length} request(s) in results.json (step ${s.id})`);
    lines.push('');
  }
  lines.push('## Test accounts', '');
  lines.push(`Made: ${run.created.length ? run.created.map(a => `${a.role} ${a.email}`).join(', ') : 'none'}.`);
  lines.push(`Deleted: ${run.deleted.length ? run.deleted.map(a => `${a.role} (${a.via})`).join(', ') : 'none'}.`);
  lines.push(`**Not deleted: ${run.notDeleted.length ? run.notDeleted.map(a => `${a.role} ${a.email} — ${a.why}`).join('; ') : 'none'}.**`, '');
  if (run.recoveryFile) lines.push('The run kept a local recovery file outside the repository (owner-readable only); `node tools/staging-journey-proof.mjs --cleanup <that file>` deletes the accounts above.', '');
  return lines.join('\n') + '\n';
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
  const failed = run.steps.filter(s => s.status === 'FAIL').length;
  console.log(`STAGING JOURNEY: ${failed ? 'FAIL' : 'NO FAILURES'} — ${run.steps.filter(s => s.status === 'PASS' || s.status === 'SYNTHETIC-PASS').length} passed, ${failed} failed, ${run.steps.filter(s => s.status === 'BLOCKED').length} blocked · ${run.sha}`);
  process.exit(failed ? 1 : 0);
}
