#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · scripted staging acceptance A–D
//
// The journey that blocks the cross-device V1 is PRI_V1_RELEASE_SCOPE.md §22.2:
//
//   install → email sign-in / OTP → required guardian consent → account-bound
//   sync → server-issued question → handwriting or camera photo → explicit
//   transcript correction / confirmation → server-authoritative grading →
//   History and persistent sync.
//
// This runner drives the parts of that journey that can be driven over HTTP
// against a DEPLOYED host, in the shipped client's order, and names the parts
// only a person can do. The letters are this tool's (production-cutover-
// checklist.md §4 and the cutover runbook §4.4 step 4 describe the same
// test-account journey without naming its parts):
//
//   0  preflight — health, readiness, release identity, schema versions
//   A  one-time-code sign-in with a REAL mailbox (a human reads the code)
//   B  guardian confirmation for a child account (a human reads the parent's code)
//   C  handwriting read + server mark   (a SYNTHETIC picture, the REAL reader and marker)
//   D  photo read + server mark         (a SYNTHETIC "photo", the REAL reader and marker)
//   E  account isolation probe — a VERIFIED student B2 (code sign-up, HUMAN STEP) never sees,
//      marks or revokes student A; refusals must be the ownership refusal (404 QUESTION_NOT_FOUND)
//   F  cleanup — delete the TEST accounts this run created (never a pre-existing one)
//
// Evidence classes (AGENTS.md: synthetic evidence stays separate from real
// human/physical evidence) are printed with every step and written to the
// report. Nothing here is a student, a physical device, Apple Pencil or a
// camera; those are docs/release/device-matrix.md.
//
// Every line that needs a person starts with `HUMAN STEP [<step>]:`. In an
// interactive terminal the runner waits for the code; otherwise it prints the
// line, marks the step NOT VERIFIED and exits 3. Codes are never printed,
// logged or saved. Test accounts are made through the public sign-up routes the
// app itself uses; no row is written directly and no gate is skipped.
//
// Targets: staging by default. `--target production` is refused unless the
// SHA given with --sha passes scripts/release-nominate.mjs first, and then
// deletes every account it created (production-cutover-checklist.md §6).
//
//   node tools/acceptance/staging-acceptance.mjs --email <your mailbox> --tester "<your name>"
//     [--target staging|production] [--sha <40-hex>] [--guardian-email <mailbox>]
//     [--child-email <mailbox>] [--skip B,E] [--cleanup|--no-cleanup]
//     [--non-interactive] [--out <dir>] [--max-reads 4] [--json]
//
// Exit 0 every attempted step passed · 1 a check failed · 3 nothing failed but
// a step is NOT VERIFIED (a human step is open) · 2 refused or a dependency.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../../server/platform/schemaVersions.js';
import { PRODUCTION_ORIGIN, STAGING_ORIGIN } from '../../scripts/release-nominate.mjs';
import { NOT_A_HUMAN } from '../../scripts/device-matrix-record.mjs';
import { simulatedInkPng, simulatedPhotoPng, toDataUrl } from './synthetic-png.mjs';

const SHA = /^[0-9a-f]{40}$/;
const REQUEST_TIMEOUT_MS = 60_000;
const GENERATOR = 'c10-arithmetic-progressions';
const DIFFICULTY = 3;
const ISSUE_DRAWS = 12;
/** The same question form the flagship acceptance reads; the answer is worked out from the printed question, never taken from the server. */
const PROMPT = /first term \$(-?\d+)\$ and common difference \$(-?\d+)\$, which term is equal to \$(-?\d+)\$\? Give the term number\./;

export const TARGETS = Object.freeze({ staging: STAGING_ORIGIN, production: PRODUCTION_ORIGIN });
export const STEP_IDS = Object.freeze(['0', 'A', 'B', 'C', 'D', 'E', 'F']);
/**
 * GET /v1/account/export needs the credential proven inside this window
 * (server/platform/security.js REAUTH_FRESH_MS; accounts.js requireRecentAuth):
 * the sign-in that made the session, or POST /v1/account/reauth. Student A
 * signs in at step A and reaches the export at the end of step E, after three
 * human mailbox reads, so A's session is usually older than this by then and
 * the contract the probe holds is the refusal, not the export.
 */
export const EXPORT_FRESH_MS = 10 * 60 * 1000;
/** Either outcome is accepted this close to the window's edge (clock and request latency). */
const EXPORT_FRESH_MARGIN_MS = 30 * 1000;
export const STEPS = Object.freeze({
  0: 'Preflight: health, readiness, release identity, schema versions',
  A: 'One-time-code sign-in with a real mailbox',
  B: 'Guardian confirmation for a child account',
  C: 'Handwriting read and server mark',
  D: 'Photo read and server mark',
  E: 'Account isolation probe (server ownership authorisation and RLS, observed over HTTP with a verified second test account)',
  F: 'Cleanup: delete the test accounts this run created'
});
export const EVIDENCE = Object.freeze({
  REAL_HOST: 'REAL deployed host: unauthenticated HTTP reads. Not device evidence.',
  REAL_MAILBOX: 'REAL mailbox delivery, code read by the named human; TEST account, not a student.',
  SYNTHETIC_PICTURE: 'SYNTHETIC picture (simulated pen strokes: not a student, not a device, not a camera) read by the REAL deployed reader and marked by the REAL deployed server; TEST account.',
  TEST_ACCOUNTS: 'TEST accounts on the deployed host, server authorisation and Postgres RLS observed from outside; not student evidence and not a substitute for server/test/security-acceptance-check.mjs.',
  NONE: 'No evidence recorded.'
});
export const STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', NOT_VERIFIED: 'NOT VERIFIED', SKIPPED: 'SKIPPED' });

export function parseArgs(argv) {
  const args = {
    target: 'staging', origin: null, sha: null, email: null, childEmail: null, guardianEmail: null, tester: null,
    nonInteractive: false, skip: new Set(), cleanup: null, out: null, maxReads: 4, json: false
  };
  const valued = new Map([
    ['--target', 'target'], ['--origin', 'origin'], ['--sha', 'sha'], ['--email', 'email'], ['--child-email', 'childEmail'],
    ['--guardian-email', 'guardianEmail'], ['--tester', 'tester'], ['--out', 'out'], ['--max-reads', 'maxReads'], ['--skip', 'skip']
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--non-interactive') { args.nonInteractive = true; continue; }
    if (flag === '--cleanup') { args.cleanup = true; continue; }
    if (flag === '--no-cleanup') { args.cleanup = false; continue; }
    if (flag === '--json') { args.json = true; continue; }
    if (!valued.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    i += 1;
    const key = valued.get(flag);
    if (key === 'skip') { for (const id of value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)) args.skip.add(id); continue; }
    if (key === 'maxReads') { args.maxReads = Number(value); continue; }
    args[key] = value;
  }
  if (!Object.hasOwn(TARGETS, args.target)) throw new Error('--target must be staging or production');
  if (args.sha !== null && !SHA.test(String(args.sha).toLowerCase())) throw new Error('--sha must be a full 40-hex commit');
  if (args.sha) args.sha = args.sha.toLowerCase();
  // C and D each reserve 2 reads before they start; a budget of 1 would silently skip both.
  if (!Number.isInteger(args.maxReads) || args.maxReads < 2 || args.maxReads > 10) throw new Error('--max-reads must be a whole number from 2 to 10 (each of C and D reserves 2 reads)');
  for (const id of args.skip) if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(id)) throw new Error(`--skip names an unknown step: ${id}`);
  if (args.target === 'production') {
    if (!args.sha) throw new Error('--target production needs --sha <nominated 40-hex main SHA>');
    if (args.origin && args.origin !== PRODUCTION_ORIGIN) throw new Error(`--target production always means ${PRODUCTION_ORIGIN}; --origin cannot change it`);
    if (args.cleanup === false) throw new Error('--target production always deletes the accounts it creates; --no-cleanup is refused');
    args.cleanup = true;
  }
  if (args.cleanup === null) args.cleanup = false;
  if (args.origin) {
    let url;
    try { url = new URL(args.origin); } catch { throw new Error('--origin is not a URL'); }
    if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) throw new Error('--origin must be a bare origin');
    if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) throw new Error('--origin must be https:// (http only for loopback)');
    args.origin = url.origin;
  } else {
    args.origin = TARGETS[args.target];
  }
  for (const key of ['email', 'childEmail', 'guardianEmail']) {
    if (args[key] !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args[key])) throw new Error(`--${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())} is not an email address`);
  }
  return args;
}

/** `local+tag@domain`: a second address that lands in the same mailbox when the provider supports plus-addressing. */
export function plusAddress(email, tag) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at).split('+')[0];
  return `${local}+${tag}@${email.slice(at + 1)}`;
}

/** Never write a whole address into a report: the local part is cut to two characters. */
export function maskEmail(email) {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1) return '…';
  return `${email.slice(0, Math.min(2, at))}…@${email.slice(at + 1)}`;
}

export function deriveAddresses({ email, childEmail = null, guardianEmail = null }, tag) {
  if (!email) return { student: null, child: null, guardian: null, isolation: null };
  return {
    student: email,
    child: childEmail || plusAddress(email, `pri-child-${tag}`),
    guardian: guardianEmail || plusAddress(email, `pri-guardian-${tag}`),
    isolation: plusAddress(email, `pri-iso-${tag}`)
  };
}

/**
 * Rows of a pri-account-export-v1 body that belong to another account A: any
 * learningEvents or entities row whose entity_id/entityId is one of A's questions,
 * or whose id/entity_id is one of A's attempts. Used by step E against the real
 * export shape (server/platform/accounts.js: `learningEvents`, `entities`).
 */
export function exportedForeignRows(body, A) {
  const rows = [...(Array.isArray(body?.learningEvents) ? body.learningEvents : []), ...(Array.isArray(body?.entities) ? body.entities : [])];
  return rows.filter(row => {
    const entity = row?.entity_id ?? row?.entityId;
    return A.questionIds.has(entity) || A.attemptIds.has(entity) || A.attemptIds.has(row?.id);
  });
}

/** The expected term number from the printed question, or null when the prompt is another form. */
export function expectedFromPrompt(prompt) {
  const m = String(prompt || '').match(PROMPT);
  if (!m) return null;
  const [a, d, term] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const n = d === 0 ? NaN : (term - a) / d + 1;
  if (!Number.isInteger(n) || n < 1 || a + (n - 1) * d !== term) return null;
  return { a, d, term, n };
}

/**
 * HTTP as the web app on `origin` sends it: cookies from the jar, the CSRF
 * header on every mutation, and the page's own Origin (a Node client has no
 * browser Origin; the deployed server refuses a mutation without one, and this
 * tool never claims to be a native shell).
 */
export function makeHttp(origin, { fetchImpl = globalThis.fetch, onRequest = null } = {}) {
  return async function request(path, { method = 'GET', body, jar = null, headers = {} } = {}) {
    const mutation = !['GET', 'HEAD'].includes(method);
    const send = { accept: 'application/json', ...headers };
    if (mutation) send.origin = origin;
    if (jar) {
      const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookies) send.cookie = cookies;
      if (mutation && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
    }
    if (body !== undefined) send['content-type'] = 'application/json';
    const started = Date.now();
    const response = await fetchImpl(origin + path, {
      method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (jar) {
      for (const raw of response.headers.getSetCookie?.() || []) {
        const first = String(raw).split(';', 1)[0];
        const at = first.indexOf('=');
        if (at > 0) jar[first.slice(0, at)] = first.slice(at + 1);
      }
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    const result = { status: response.status, data, code: data?.error?.code || null, ms: Date.now() - started };
    if (onRequest) onRequest({ method, path, status: result.status, ms: result.ms });
    return result;
  };
}

function refusal(message, code = 'REFUSED') { return Object.assign(new Error(message), { code, exitCode: 2 }); }

async function defaultNominate(options) {
  const { nominate } = await import('../../scripts/release-nominate.mjs');
  return nominate(options);
}

async function defaultPrompt(question) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

/**
 * Runs the acceptance. Dependencies are injectable so the whole flow can be
 * proved against a fake origin without a mailbox or a provider:
 *   fetchImpl  — fetch
 *   prompt     — async (text) => the human's answer; null means no terminal
 *   nominate   — scripts/release-nominate.mjs nominate(), consulted for production only
 *   pictures   — { ink(lines), photo(lines) } → { png, label, width, height }
 *   log        — line sink
 * Returns the report; the caller decides the exit code (exitCodeFor).
 */
export async function runAcceptance(args, deps = {}) {
  const {
    fetchImpl = globalThis.fetch, prompt = null, nominate = defaultNominate, log = line => console.log(line),
    pictures = { ink: simulatedInkPng, photo: simulatedPhotoPng }, now = () => Date.now(), outDir = null
  } = deps;
  const interactive = !args.nonInteractive && typeof prompt === 'function';
  const tag = randomBytes(3).toString('hex');
  const addresses = deriveAddresses(args, tag);
  const report = {
    tool: 'tools/acceptance/staging-acceptance.mjs', target: args.target, origin: args.origin, nominatedSha: args.sha,
    startedAt: new Date(now()).toISOString(), finishedAt: null, tester: args.tester || null, interactive, tag,
    journey: 'docs/release/PRI_V1_RELEASE_SCOPE.md §22.2', evidenceClasses: EVIDENCE,
    requests: 0, providerReads: 0, maxReads: args.maxReads, steps: [], humanSteps: [], accounts: [], pictures: []
  };
  const out = outDir ? resolve(outDir) : (args.out ? resolve(args.out) : mkdtempSync(join(tmpdir(), 'pri-staging-acceptance-')));
  mkdirSync(out, { recursive: true, mode: 0o700 });
  report.outDir = out;

  // ── Step bookkeeping ──────────────────────────────────────────────────────
  const steps = new Map();
  const open = (id, evidence) => {
    const step = { id, title: STEPS[id], status: STATUS.NOT_VERIFIED, evidence, checks: [], human: [], notes: [], pending: false };
    steps.set(id, step);
    report.steps.push(step);
    log(`\n── ${id} · ${STEPS[id]}`);
    log(`   evidence: ${evidence}`);
    return step;
  };
  const check = (step, ok, label, detail) => {
    step.checks.push({ ok: !!ok, label, ...(detail !== undefined && detail !== null && detail !== '' ? { detail: String(detail) } : {}) });
    log(`  ${ok ? '✓' : '✗'} [${step.id}] ${label}${detail !== undefined && detail !== null && detail !== '' ? `  (${detail})` : ''}`);
    return !!ok;
  };
  const note = (step, text) => { step.notes.push(text); log(`  · [${step.id}] ${text}`); };
  const human = (step, text) => { step.human.push(text); report.humanSteps.push({ step: step.id, text }); log(`HUMAN STEP [${step.id}]: ${text}`); };
  /** A human step whose answer the run needs (a code). Null when nobody is at the terminal. */
  const ask = async (step, text) => {
    human(step, text);
    if (!interactive) { step.pending = true; return null; }
    let answer = null;
    try { answer = String((await prompt(`[${step.id}] type it here (never printed or saved) > `)) ?? '').trim(); } catch { answer = ''; }
    if (!answer) { step.pending = true; note(step, 'no answer was typed; the step stays open'); return null; }
    return answer;
  };
  const skipped = (id, why) => {
    const step = open(id, EVIDENCE.NONE);
    step.status = STATUS.SKIPPED;
    note(step, why);
    return step;
  };
  const settle = step => {
    if (step.status === STATUS.SKIPPED) return;
    if (step.checks.some(c => !c.ok)) step.status = STATUS.FAIL;
    else if (step.pending || step.checks.length === 0) step.status = STATUS.NOT_VERIFIED;
    else step.status = STATUS.PASS;
    log(`   → ${step.id}: ${step.status}`);
  };
  const want = id => !args.skip.has(id);
  const needsTester = () => {
    if (!interactive) return;
    if (!args.tester || String(args.tester).trim().length < 3) throw refusal('an interactive run records REAL mailbox evidence and needs --tester "<the named human reading the codes>"', 'TESTER_REQUIRED');
    if (NOT_A_HUMAN.test(args.tester)) throw refusal(`--tester ${JSON.stringify(args.tester)} does not name a human; agent, CI and placeholder names are refused (no fabricated evidence)`, 'TESTER_REQUIRED');
  };

  // ── Production is refused unless the SHA is nominated ─────────────────────
  if (args.target === 'production') {
    log(`── production target requested: consulting scripts/release-nominate.mjs for ${args.sha} before any request to ${args.origin}`);
    const verdict = await nominate({ sha: args.sha, productionOrigin: PRODUCTION_ORIGIN, stagingOrigin: STAGING_ORIGIN, fetchOrigin: true });
    const failed = (verdict?.results || []).filter(item => item.ok === false).map(item => item.label);
    if (!verdict?.ok) throw refusal(`production refused: ${args.sha} is not a nominated SHA (${failed.length ? failed.join('; ') : 'nomination did not pass'}). Nothing was sent to production.`, 'NOT_NOMINATED');
    log('   nomination PASS; proceeding against production with cleanup on');
  }

  const http = makeHttp(args.origin, { fetchImpl, onRequest: () => { report.requests += 1; } });
  let readsSpent = 0;
  const spend = (step, n) => {
    if (readsSpent + n > args.maxReads) { note(step, `read budget (${args.maxReads}) would be exceeded; the step stops here`); return false; }
    return true;
  };
  const sessionIdOf = async jar => (await http('/v1/account/devices', { jar })).data?.devices?.find(d => d.current)?.id || null;

  // ══ 0 · preflight ══════════════════════════════════════════════════════════
  const pre = open('0', EVIDENCE.REAL_HOST);
  let runningSha = null;
  try {
    const [health, ready, web] = await Promise.all([http('/v1/health'), http('/v1/ready'), http('/release.json')]);
    const h = health.data || {}, r = ready.data || {};
    check(pre, health.status === 200 && h.ok === true && h.service === 'pri-learning-platform', '/v1/health answers as pri-learning-platform', `status ${health.status}`);
    runningSha = h.releaseIdentity?.releaseSha || null;
    check(pre, SHA.test(String(runningSha || '')), 'the server reports a full release SHA', runningSha || 'none');
    if (args.sha) check(pre, runningSha === args.sha, 'the host runs the nominated SHA', `running ${runningSha}`);
    else note(pre, `running ${runningSha} (no --sha given; recorded, not compared)`);
    check(pre, web.status === 200 && web.data?.releaseSha === runningSha, 'the web bundle (release.json) is the same build as the server', `web ${web.data?.releaseSha || 'unknown'}`);
    check(pre, h.database?.engine === 'postgres', 'database engine is postgres', `running ${h.database?.engine || 'unknown'}`);
    const dbSchema = r.checks?.database?.schemaVersion ?? h.schemaVersion;
    const dbBilling = r.checks?.database?.billingSchemaVersion ?? h.billingSchemaVersion;
    check(pre, String(dbSchema) === String(SCHEMA_VERSION), `schema_version is ${SCHEMA_VERSION} (this checkout's schemaVersions.js)`, `running ${dbSchema}`);
    check(pre, String(dbBilling) === String(BILLING_SCHEMA_VERSION), `billing_schema_version is ${BILLING_SCHEMA_VERSION}`, `running ${dbBilling}`);
    const readyDetail = [r.state, ...(r.failing || []), ...(r.degraded || []).map(code => `degraded:${code}`)].filter(Boolean).join(' ');
    check(pre, ready.status === 200 && r.ready === true, '/v1/ready says the replica can serve', readyDetail || `status ${ready.status}`);
    check(pre, r.checks?.authEmail?.state === 'ok', 'verification email is ready (codes can be delivered)', `state ${r.checks?.authEmail?.state ?? 'unknown'}`);
    if (r.checks?.handwriting && r.checks.handwriting.state !== 'ok') note(pre, `handwriting readiness is ${r.checks.handwriting.state} (${r.checks.handwriting.code || 'no code'}); C and D will show whether the reader answers`);
    note(pre, 'run this tool from a checkout at the running SHA so the expected schema versions are that build\'s');
  } catch (error) {
    check(pre, false, 'host reachable', error?.message || String(error));
  }
  settle(pre);
  if (pre.status === STATUS.FAIL) {
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) skipped(id, 'preflight failed; nothing else was attempted');
    return finish();
  }

  // ══ A · one-time-code sign-in, real mailbox ════════════════════════════════
  const A = { jar: {}, accountId: null, created: false, email: addresses.student, sessionId: null, signedInAt: null, verified: false, questionIds: new Set(), attemptIds: new Set() };
  if (!want('A') || !addresses.student) {
    skipped('A', want('A') ? 'no --email: a real mailbox is needed for the code' : 'skipped by --skip');
  } else {
    needsTester();
    const a = open('A', EVIDENCE.REAL_MAILBOX);
    const requested = await http('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination: A.email } });
    if (check(a, requested.status === 202 && requested.data?.challengeId, 'POST /v1/account/otp/request accepted (202) for the mailbox', `status ${requested.status} ${requested.code || ''}`)) {
      const code = await ask(a, `open the mailbox ${maskEmail(A.email)}; read the 6-digit Pri Learning sign-in code from the email that just arrived (the sender must be the deployed service's configured address, not a lookalike).`);
      if (code) {
        const body = { channel: 'email', destination: A.email, challengeId: requested.data.challengeId, code, deviceId: `acceptance-A-${tag}` };
        let verified = await http('/v1/account/otp/verify', { method: 'POST', jar: A.jar, body });
        if (verified.status === 200 && verified.data?.status === 'profile-required') {
          note(a, 'new address: the server asked for a profile without spending the code (profile-required); signing up as an ADULT test account');
          verified = await http('/v1/account/otp/verify', { method: 'POST', jar: A.jar, body: { ...body, code: undefined, signupTicket: verified.data.signupTicket, profile: { name: `Acceptance Student A ${tag}`, isAdult: true } } });
          A.created = verified.status === 201;
        }
        check(a, [200, 201].includes(verified.status) && verified.data?.status === 'signed-in', 'the code signs the mailbox in (otp/verify → signed-in)', `status ${verified.status} ${verified.code || ''}`);
        A.accountId = verified.data?.account?.id || null;
        if (A.accountId) A.signedInAt = now();
        check(a, !!A.jar.pri_cloud_session && !!A.jar.pri_csrf, 'a session cookie pair was issued');
        const me = await http('/v1/account/me', { jar: A.jar });
        check(a, me.status === 200 && me.data?.account?.id === A.accountId, 'GET /v1/account/me answers for the signed-in account', `status ${me.status}`);
        A.verified = me.data?.account?.emailVerified === true || verified.data?.account?.emailVerified === true;
        check(a, A.verified, 'the mailbox counts as verified (the code proved it)');
        const consent = verified.data?.guardianConsent;
        if (consent?.required && consent.state !== 'given') note(a, `this account needs guardian consent (${consent.state}); C and D will be gated until it is given`);
        A.sessionId = await sessionIdOf(A.jar);
        report.accounts.push({ role: 'A', email: maskEmail(A.email), accountId: A.accountId, created: A.created, ageBasis: consent?.required ? 'child' : 'adult' });
        note(a, `account ${A.accountId} ${A.created ? 'CREATED by this run' : 'already existed (signed in; it will NOT be deleted)'}`);
      }
    }
    settle(a);
  }

  // ══ B · guardian confirmation ══════════════════════════════════════════════
  const B = { jar: {}, accountId: null, created: false, email: addresses.child, guardian: addresses.guardian };
  if (!want('B') || !addresses.student) {
    skipped('B', want('B') ? 'no --email: two mailboxes are needed (child and parent)' : 'skipped by --skip');
  } else {
    needsTester();
    const b = open('B', EVIDENCE.REAL_MAILBOX);
    note(b, `child address ${maskEmail(B.email)}, parent address ${maskEmail(B.guardian)}${args.childEmail || args.guardianEmail ? '' : ' (plus-addressed into the same mailbox; pass --child-email / --guardian-email if your provider drops +tags)'}`);
    const requested = await http('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination: B.email } });
    if (check(b, requested.status === 202 && requested.data?.challengeId, 'otp/request accepted (202) for the child address', `status ${requested.status} ${requested.code || ''}`)) {
      const code = await ask(b, `open the mailbox for ${maskEmail(B.email)}; read the 6-digit sign-in code for the CHILD account.`);
      if (code) {
        const body = { channel: 'email', destination: B.email, challengeId: requested.data.challengeId, code, deviceId: `acceptance-B-${tag}` };
        let verified = await http('/v1/account/otp/verify', { method: 'POST', jar: B.jar, body });
        if (verified.status === 200 && verified.data?.status === 'profile-required') {
          verified = await http('/v1/account/otp/verify', { method: 'POST', jar: B.jar, body: { ...body, code: undefined, signupTicket: verified.data.signupTicket, profile: { name: `Acceptance Child B ${tag}`, isAdult: false, year: '10' } } });
          B.created = verified.status === 201;
        }
        check(b, [200, 201].includes(verified.status) && verified.data?.status === 'signed-in', 'the child signs in with the code', `status ${verified.status} ${verified.code || ''}`);
        B.accountId = verified.data?.account?.id || null;
        report.accounts.push({ role: 'B (child)', email: maskEmail(B.email), accountId: B.accountId, created: B.created, ageBasis: 'child' });
        const consent = verified.data?.guardianConsent || {};
        if (consent.required && consent.state === 'pending') {
          const gated = await http('/v1/practice/issue', { method: 'POST', jar: B.jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } });
          check(b, gated.status === 403 && gated.code === 'GUARDIAN_CONSENT_PENDING', 'before approval the child is refused a server question (403 GUARDIAN_CONSENT_PENDING)', `status ${gated.status} ${gated.code || ''}`);
          const asked = await http('/v1/account/otp/guardian/request', { method: 'POST', jar: B.jar, body: { guardianName: 'Acceptance Guardian', channel: 'email', destination: B.guardian } });
          if (check(b, asked.status === 202 && asked.data?.noticeVersion, 'the child asks for a parent\'s approval; the code goes to the PARENT\'s address (202)', `status ${asked.status} ${asked.code || ''}`)) {
            const parentCode = await ask(b, `the PARENT opens their mailbox ${maskEmail(B.guardian)}, reads the notice and the 6-digit approval code. In the product the parent approves on /guardian/consent on THEIR device (device-matrix step 03); here the same server route is driven with the code the human read.`);
            if (parentCode) {
              const approved = await http('/v1/account/otp/guardian/approve', { method: 'POST', body: { approve: true, noticeVersion: asked.data.noticeVersion, channel: 'email', destination: B.guardian, code: parentCode } });
              check(b, approved.status === 200 && approved.data?.confirmed === true, 'the parent\'s code approves (guardian/approve → confirmed, no child session involved)', `status ${approved.status} ${approved.code || ''}`);
              const state = await http('/v1/account/guardian/state', { jar: B.jar });
              check(b, state.status === 200 && state.data?.state === 'given', 'the child\'s guardian state is now given', `state ${state.data?.state ?? 'unknown'}`);
              const issued = await http('/v1/practice/issue', { method: 'POST', jar: B.jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } });
              check(b, issued.status === 201 && issued.data?.question?.id, 'after approval the child is issued a server question (201)', `status ${issued.status} ${issued.code || ''}`);
            }
          }
        } else if (consent.required && consent.state === 'given') {
          note(b, 'this child address already has an approved account; the approval ceremony was not exercised on this run (use a fresh --child-email)');
          b.pending = true;
        } else {
          check(b, false, 'the child account requires guardian consent', `guardianConsent ${JSON.stringify(consent)}`);
        }
      }
    }
    settle(b);
  }

  // ══ C and D · read + server mark ═══════════════════════════════════════════
  const needA = id => {
    if (!want(id)) return skipped(id, 'skipped by --skip'), false;
    if (!A.accountId) return skipped(id, 'needs the signed-in account from A'), false;
    return true;
  };
  async function issueQuestion(step) {
    let fallback = null;
    for (let i = 0; i < ISSUE_DRAWS; i += 1) {
      const res = await http('/v1/practice/issue', { method: 'POST', jar: A.jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } });
      if (res.status !== 201 || !res.data?.question?.id) { check(step, false, 'the server issues a question (201)', `status ${res.status} ${res.code || ''}`); return null; }
      const q = res.data.question;
      A.questionIds.add(q.id);
      const leaked = ['answer', 'correct', 'expected', 'expectedAnswer', 'solution', 'solutionText', 'markScheme', 'steps', 'traps', 'stepcheck', 'seed'].filter(key => key in q);
      if (leaked.length) { check(step, false, 'the issued question carries no answer, solution, steps, traps or seed', leaked.join(',')); return null; }
      const expected = expectedFromPrompt(q.prompt);
      if (expected && !res.data.repeat && res.data.triesLeft !== 1) {
        check(step, true, `issued ${q.subtopic || GENERATOR} D${q.difficulty ?? DIFFICULTY} after ${i + 1} draw(s); the expected term number is worked out from the printed question`, `n = ${expected.n}`);
        return { q, expected };
      }
      fallback = fallback || { q, expected: null };
    }
    note(step, `no "which term" form was issued in ${ISSUE_DRAWS} draws; marking is recorded, not judged, on the first question issued`);
    check(step, true, 'the server issues a question (201)');
    return fallback;
  }
  /**
   * The shipped client's submit, step for step: issue → write → transcribe →
   * recognize → (confirm) → submit → pull. `linesFor(expected)` is what the
   * simulated student writes: the term number they work out from the printed
   * question (never read from the server), or a fixed line when the issued
   * form is not the one this tool can work out.
   */
  async function readAndMark(step, { mode, linesFor, render }) {
    // transcribe + recognize are two paid reads unless the server reuses the first.
    if (!spend(step, 2)) return;
    const issued = await issueQuestion(step);
    if (!issued) return;
    const { q, expected } = issued;
    const lines = linesFor(expected);
    const picture = render(lines);
    const image = toDataUrl(picture.png);
    const file = join(out, `${picture.label}-${step.id}.png`);
    writeFileSync(file, picture.png);
    report.pictures.push({ step: step.id, file, label: picture.label, width: picture.width, height: picture.height, lines });
    note(step, `${picture.label}: ${picture.width}×${picture.height}, ${picture.strokes} strokes, written ${JSON.stringify(lines)}, saved as ${file}`);
    const transcribeBody = { image };
    if (Object.keys(transcribeBody).join(',') !== 'image') throw new Error('acceptance bug: a transcribe body must carry exactly one image');
    const read = await http('/v1/handwriting/transcribe', { method: 'POST', jar: A.jar, body: transcribeBody });
    if (!read.data?.reused) readsSpent += 1;
    report.providerReads = readsSpent;
    const t = read.data?.transcription || null;
    if (!check(step, read.status === 200 && typeof t?.text === 'string', 'POST /v1/handwriting/transcribe read the picture (the body was exactly { image }: answer-blind on the wire)', `status ${read.status} ${read.code || ''}${t?.latencyMs != null ? `, provider ${t.latencyMs} ms` : ''}${t?.engine ? `, engine ${t.engine}` : ''}`)) return;
    const written = lines.map(l => l.replace(/\s+/g, '')).join('\n');
    const readBack = String(t.text).split('\n').map(l => l.replace(/[−–—]/g, '-').replace(/\s+/g, '')).filter(Boolean).join('\n');
    note(step, `reader text ${JSON.stringify(t.text)} confidence ${t.confidence ?? '—'} needsConfirmation ${t.needsConfirmation ?? '—'}; matches what was written: ${readBack === written} (recorded, not judged: one SYNTHETIC picture is not a reading-accuracy measure)`);
    const recognised = await http(`/v1/practice/${q.id}/recognize`, { method: 'POST', jar: A.jar, body: { mode, image } });
    if (!recognised.data?.reused) readsSpent += 1;
    report.providerReads = readsSpent;
    if (!check(step, recognised.status === 201 && recognised.data?.receipt, 'POST /v1/practice/:id/recognize minted a server reading receipt (201)', `status ${recognised.status} ${recognised.code || ''}${recognised.data?.reused === true ? ', reused the paid read' : ''}`)) return;
    check(step, recognised.data.reused === true, 'the receipt reused the read already paid for (one provider call for transcribe + recognize)');
    // The client: the answer is the last line; ink working is sent only when
    // more than one line was written; a photo's whole reading is the working.
    const receiptText = String(recognised.data.transcription?.text ?? t.text);
    const readLines = receiptText.split('\n').map(x => x.trim()).filter(Boolean);
    // The student vouches for what they wrote (the last line). The shipped client
    // (client/src/local/backend.js) confirms unless the receipt text is EXACTLY the
    // answer string; the server compares the same way, so so does this tool —
    // a stray space or a different dash in the receipt is a confirmation, not a
    // spurious RECOGNITION_RECEIPT_MISMATCH.
    const answer = String(lines[lines.length - 1]).replace(/\s+/g, ' ').trim();
    let receipt = recognised.data.receipt;
    const needsCorrection = receiptText !== answer || recognised.data.transcription?.needsConfirmation === true;
    if (needsCorrection) {
      // §22.2: explicit transcript correction / confirmation. The student vouches
      // for the final line; the server records the original reading too.
      const confirmed = await http(`/v1/practice/${q.id}/recognition/${receipt}/confirm`, { method: 'POST', jar: A.jar, body: { text: answer } });
      if (!check(step, confirmed.status === 201 && confirmed.data?.receipt, 'the explicit transcript correction/confirmation is recorded as a new receipt (201)', `status ${confirmed.status} ${confirmed.code || ''}`)) return;
      receipt = confirmed.data.receipt;
      note(step, readLines.length !== 1 ? 'the receipt text is the whole page; the final line was confirmed as the answer' : 'the receipt text is not exactly what was written; it was confirmed as what was written (as the product lets a student do)');
    }
    const steps = mode === 'photo' ? readLines.join('\n') : (readLines.length > 1 ? readLines.join('\n') : undefined);
    const submissionId = `accept-${step.id}-${tag}-${randomBytes(4).toString('hex')}`;
    const payload = { submissionId, answer, mode, ...(steps !== undefined ? { steps } : {}), transcriptionReceipt: receipt, ms: 41_000 };
    const graded = await http(`/v1/practice/${q.id}/submit`, { method: 'POST', jar: A.jar, headers: { 'Idempotency-Key': submissionId }, body: payload });
    const g = graded.data || {};
    if (!check(step, graded.status === 200 && g.authoritative === true && Number.isFinite(g.marksPossible) && g.marksPossible > 0, 'POST /v1/practice/:id/submit returned the server\'s authoritative mark', `status ${graded.status} ${graded.code || ''}`)) return;
    note(step, `verdict ${g.invalid ? 'invalid' : g.correct ? 'correct' : 'incorrect'}, marks ${g.marksEarned}/${g.marksPossible}, resolved ${g.resolved}, attempt ${g.attemptId}`);
    if (g.attemptId) A.attemptIds.add(g.attemptId);
    const finalNumber = answer.replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(/^n=/, '');
    if (expected && finalNumber === String(expected.n)) check(step, g.correct === true && g.marksEarned === g.marksPossible, 'the right term number is marked right with full marks', `${g.marksEarned}/${g.marksPossible}`);
    else if (expected) note(step, `the submitted answer ${JSON.stringify(answer)} is not the expected ${expected.n}; the verdict is recorded, not judged`);
    const replay = await http(`/v1/practice/${q.id}/submit`, { method: 'POST', jar: A.jar, headers: { 'Idempotency-Key': submissionId }, body: payload });
    check(step, replay.status === 200 && replay.data?.attemptId === g.attemptId, 'replaying the same submission returns the same attempt (no double credit)', `status ${replay.status} ${replay.code || ''}`);
    const pull = await http('/v1/sync/pull/0', { jar: A.jar });
    const events = (pull.data?.events || []).filter(e => e.kind === 'graded-attempt' && e.entityId === q.id);
    check(step, pull.status === 200 && events.length === 1, 'the attempt is persisted once and reads back through GET /v1/sync/pull (History)', `status ${pull.status}, ${events.length} graded-attempt event(s) for the question`);
  }

  if (needA('C')) {
    const c = open('C', EVIDENCE.SYNTHETIC_PICTURE);
    try {
      // Write mode: the answer alone, as a student writes it on the page.
      await readAndMark(c, {
        mode: 'ink',
        linesFor: expected => [String(expected ? expected.n : 24)],
        render: lines => pictures.ink(lines, { seed: 20261018 })
      });
    } catch (error) { check(c, false, 'C ran to completion', error?.message || String(error)); }
    settle(c);
  }
  if (needA('D')) {
    const d = open('D', EVIDENCE.SYNTHETIC_PICTURE);
    try {
      // Photo mode: a page of working whose last line is the answer
      // (a + (n-1)d = term, then n), in the glyphs the simulated pen has.
      await readAndMark(d, {
        mode: 'photo',
        linesFor: expected => expected
          ? [`${expected.a} + (n-1)(${expected.d}) = ${expected.term}`, `n = ${expected.n}`]
          : ['(n-1) = 23', 'n = 24'],
        render: lines => pictures.photo(lines, { seed: 20261019 })
      });
    } catch (error) { check(d, false, 'D ran to completion', error?.message || String(error)); }
    settle(d);
  }

  // ══ E · account isolation ══════════════════════════════════════════════════
  // Student B2 is signed up the same way as A (a code read from the plus-addressed
  // pri-iso mailbox) so that its mailbox is VERIFIED: the practice router refuses
  // every unverified account with 403 EMAIL_UNVERIFIED before it looks the question
  // up, so only a verified B2 reaches the per-account ownership check this step
  // is about. The ownership refusal is 404 QUESTION_NOT_FOUND; any other refusal
  // (EMAIL_UNVERIFIED included) does not prove isolation and is not counted.
  const ISO = { jar: {}, accountId: null, created: false, email: addresses.isolation, verified: false };
  const OWNERSHIP_REFUSAL = Object.freeze({ status: 404, code: 'QUESTION_NOT_FOUND' });
  const isOwnershipRefusal = res => res.status === OWNERSHIP_REFUSAL.status && res.code === OWNERSHIP_REFUSAL.code && res.data?.authoritative !== true;
  if (needA('E')) {
    const e = open('E', EVIDENCE.TEST_ACCOUNTS);
    try {
      const anon = await http('/v1/sync/pull/0');
      check(e, anon.status === 401, 'no session: GET /v1/sync/pull is refused (401)', `status ${anon.status} ${anon.code || ''}`);
      const requested = await http('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination: ISO.email } });
      if (check(e, requested.status === 202 && requested.data?.challengeId, 'otp/request accepted (202) for the isolation address', `status ${requested.status} ${requested.code || ''}`)) {
        const code = await ask(e, `open the mailbox ${maskEmail(ISO.email)} (student B2, the isolation account); read the 6-digit sign-in code that just arrived.`);
        if (code) {
          const body = { channel: 'email', destination: ISO.email, challengeId: requested.data.challengeId, code, deviceId: `acceptance-E-${tag}` };
          let verified = await http('/v1/account/otp/verify', { method: 'POST', jar: ISO.jar, body });
          if (verified.status === 200 && verified.data?.status === 'profile-required') {
            verified = await http('/v1/account/otp/verify', { method: 'POST', jar: ISO.jar, body: { ...body, code: undefined, signupTicket: verified.data.signupTicket, profile: { name: `Acceptance Isolation B2 ${tag}`, isAdult: true } } });
            ISO.created = verified.status === 201;
          }
          ISO.accountId = verified.data?.account?.id || null;
          check(e, [200, 201].includes(verified.status) && verified.data?.status === 'signed-in' && ISO.accountId && ISO.accountId !== A.accountId, 'student B2 signed in by code as a separate adult test account', `status ${verified.status} ${verified.code || ''}`);
          const me = await http('/v1/account/me', { jar: ISO.jar });
          ISO.verified = me.status === 200 && me.data?.account?.id === ISO.accountId && me.data?.account?.emailVerified === true;
          check(e, ISO.verified, 'student B2\'s mailbox counts as verified (so the practice router\'s ownership check, not EMAIL_UNVERIFIED, is what refuses it below)', `status ${me.status}, emailVerified ${me.data?.account?.emailVerified}`);
          report.accounts.push({ role: 'B2 (isolation)', email: maskEmail(ISO.email), accountId: ISO.accountId, created: ISO.created, ageBasis: 'adult' });
        }
      }
      if (ISO.accountId) {
        const pullB = await http('/v1/sync/pull/0', { jar: ISO.jar });
        const leakedEvents = (pullB.data?.events || []).filter(ev => A.questionIds.has(ev.entityId) || A.attemptIds.has(ev.id) || A.attemptIds.has(ev.entityId));
        check(e, pullB.status === 200 && Array.isArray(pullB.data?.events) && leakedEvents.length === 0 && pullB.data.events.length === 0, 'student B2\'s sync pull holds none of student A\'s questions or attempts', `status ${pullB.status}, ${(pullB.data?.events || []).length} event(s), ${leakedEvents.length} of A's`);
        const [qid] = [...A.questionIds];
        if (!qid) {
          human(e, 'A issued no question this run (C and D were skipped or stopped early): the cross-account question probes were NOT run and E cannot read PASS without them.');
          e.pending = true;
        } else if (!ISO.verified) {
          human(e, 'student B2 is not verified: the four cross-account question probes were NOT run (an unverified account is refused EMAIL_UNVERIFIED before ownership is checked, which proves nothing about isolation).');
          e.pending = true;
        } else {
          const steal = await http(`/v1/practice/${qid}/submit`, { method: 'POST', jar: ISO.jar, body: { submissionId: `accept-E-${tag}`, answer: '0', mode: 'typed' } });
          check(e, isOwnershipRefusal(steal), `verified student B2 submitting to student A's question is refused by ownership (${OWNERSHIP_REFUSAL.status} ${OWNERSHIP_REFUSAL.code})`, `status ${steal.status} ${steal.code || ''}`);
          const peek = await http(`/v1/practice/${qid}/recognize`, { method: 'POST', jar: ISO.jar, body: { mode: 'ink', image: 'data:image/png;base64,iVBORw0KGgo=' } });
          check(e, isOwnershipRefusal(peek), `verified student B2 minting a reading receipt on student A's question is refused by ownership (${OWNERSHIP_REFUSAL.status} ${OWNERSHIP_REFUSAL.code})`, `status ${peek.status} ${peek.code || ''}`);
          // /:id/reveal and /:id/repeat carry the same per-account check (server/platform/practice.js).
          const reveal = await http(`/v1/practice/${qid}/reveal`, { method: 'POST', jar: ISO.jar, body: {} });
          check(e, isOwnershipRefusal(reveal), `verified student B2 revealing student A's question is refused by ownership (${OWNERSHIP_REFUSAL.status} ${OWNERSHIP_REFUSAL.code})`, `status ${reveal.status} ${reveal.code || ''}`);
          const repeat = await http(`/v1/practice/${qid}/repeat`, { method: 'POST', jar: ISO.jar, body: {} });
          check(e, isOwnershipRefusal(repeat), `verified student B2 repeating student A's question is refused by ownership (${OWNERSHIP_REFUSAL.status} ${OWNERSHIP_REFUSAL.code})`, `status ${repeat.status} ${repeat.code || ''}`);
        }
        if (A.sessionId) {
          const revoke = await http(`/v1/account/devices/${A.sessionId}`, { method: 'DELETE', jar: ISO.jar });
          check(e, revoke.data?.revoked !== true, 'student B2 cannot revoke student A\'s session', `status ${revoke.status} revoked ${revoke.data?.revoked}`);
          const stillA = await http('/v1/account/me', { jar: A.jar });
          check(e, stillA.status === 200 && stillA.data?.account?.id === A.accountId, 'student A\'s session still works afterwards', `status ${stillA.status}`);
        }
        // GET /v1/account/export answers { format: 'pri-account-export-v1', account,
        // learningEvents, entities, … } (server/platform/accounts.js). Rows carry
        // entity_id (SQL column names) — entityId is accepted too so a renamed
        // column cannot make the probe vacuous; a missing array FAILS, never passes.
        const exportB = await http('/v1/account/export', { jar: ISO.jar });
        const rowsB = exportB.data || {};
        const exportShape = exportB.status === 200 && rowsB.format === 'pri-account-export-v1' && rowsB.account?.id === ISO.accountId && Array.isArray(rowsB.learningEvents) && Array.isArray(rowsB.entities);
        check(e, exportShape, 'student B2\'s export has the pri-account-export-v1 shape (account, learningEvents[], entities[])', `status ${exportB.status} ${exportB.code || ''}, format ${rowsB.format}, learningEvents ${Array.isArray(rowsB.learningEvents) ? rowsB.learningEvents.length : 'missing'}, entities ${Array.isArray(rowsB.entities) ? rowsB.entities.length : 'missing'}`);
        if (exportShape) {
          const foreign = exportedForeignRows(rowsB, A);
          check(e, foreign.length === 0, 'student B2\'s export holds none of student A\'s questions or attempts', `${rowsB.learningEvents.length} event(s), ${rowsB.entities.length} entit(y/ies), ${foreign.length} of A's`);
        }
        // Student A's session was made at step A. Inside EXPORT_FRESH_MS the
        // sign-in is fresh proof and the export is A's own; past it, the cookie
        // alone must be refused 401 REAUTH_REQUIRED naming the one-time code as
        // the proof a code-only account can offer — that refusal is the security
        // property (#521), and B2's export above already probed the shape.
        const exportA = await http('/v1/account/export', { jar: A.jar });
        const sessionAgeMs = A.signedInAt ? now() - A.signedInAt : null;
        const exportServed = exportA.status === 200 && exportA.data?.format === 'pri-account-export-v1' && exportA.data?.account?.id === A.accountId && Array.isArray(exportA.data?.learningEvents);
        const exportRefused = exportA.status === 401 && exportA.code === 'REAUTH_REQUIRED' && Array.isArray(exportA.data?.error?.proofs) && exportA.data.error.proofs.includes('otp') && !JSON.stringify(exportA.data).includes('pri-account-export-v1');
        const ageDetail = sessionAgeMs == null ? 'sign-in time unknown' : `session ${Math.round(sessionAgeMs / 1000)} s old`;
        if (sessionAgeMs != null && sessionAgeMs < EXPORT_FRESH_MS - EXPORT_FRESH_MARGIN_MS) {
          check(e, exportServed, 'student A\'s export, inside the fresh-proof window, is student A\'s', `${ageDetail}; status ${exportA.status} ${exportA.code || ''}, ${Array.isArray(exportA.data?.learningEvents) ? exportA.data.learningEvents.length : 'no'} event(s)`);
        } else if (sessionAgeMs != null && sessionAgeMs > EXPORT_FRESH_MS + EXPORT_FRESH_MARGIN_MS) {
          check(e, exportRefused, 'student A\'s older session is refused the export (401 REAUTH_REQUIRED, proofs name otp): the cookie alone is not enough', `${ageDetail}; status ${exportA.status} ${exportA.code || ''}, proofs ${JSON.stringify(exportA.data?.error?.proofs ?? null)}`);
        } else {
          check(e, exportServed || exportRefused, 'student A\'s export at the edge of the fresh-proof window is either A\'s own or refused 401 REAUTH_REQUIRED naming otp', `${ageDetail}; status ${exportA.status} ${exportA.code || ''}`);
        }
      }
    } catch (error) { check(e, false, 'E ran to completion', error?.message || String(error)); }
    settle(e);
  }

  // ══ F · cleanup ════════════════════════════════════════════════════════════
  if (!want('F') || !args.cleanup) {
    skipped('F', !want('F') ? 'skipped by --skip' : `cleanup is off for ${args.target} (pass --cleanup to delete the accounts this run created)`);
  } else {
    const f = open('F', EVIDENCE.TEST_ACCOUNTS);
    for (const [label, acct] of [['A', A], ['B (child)', B], ['B2 (isolation)', ISO]]) {
      if (!acct.created || !acct.accountId) { if (acct.accountId) note(f, `${label} existed before this run and is left alone`); continue; }
      const requested = await http('/v1/account/otp/delete-request', { method: 'POST', body: { email: acct.email } });
      if (!check(f, requested.status === 202 && requested.data?.challengeId, `${label}: a deletion code was requested (202)`, `status ${requested.status} ${requested.code || ''}`)) continue;
      const code = await ask(f, `open the mailbox ${maskEmail(acct.email)}; read the 6-digit DELETION code for the ${label} test account.`);
      if (!code) continue;
      const deleted = await http('/v1/account/otp/delete-confirm', { method: 'POST', body: { email: acct.email, challengeId: requested.data.challengeId, code } });
      check(f, deleted.status === 200 && deleted.data?.deleted === true, `${label}: the test account is deleted`, `status ${deleted.status} ${deleted.code || ''}`);
    }
    if (f.checks.length === 0 && !f.pending) note(f, 'nothing to delete: this run created no account');
    settle(f);
  }

  return finish();

  function finish() {
    report.finishedAt = new Date(now()).toISOString();
    report.providerReads = readsSpent;
    const summary = Object.fromEntries(STEP_IDS.map(id => [id, steps.get(id)?.status || STATUS.SKIPPED]));
    report.summary = summary;
    const file = join(out, 'report.json');
    writeFileSync(file, JSON.stringify(report, null, 2));
    report.reportFile = file;
    return report;
  }
}

export function exitCodeFor(report) {
  const statuses = report.steps.map(step => step.status);
  if (statuses.includes(STATUS.FAIL)) return 1;
  if (statuses.includes(STATUS.NOT_VERIFIED)) return 3;
  return 0;
}

async function main() {
  const usage = 'Usage: node tools/acceptance/staging-acceptance.mjs --email <mailbox> --tester "<name>" [--target staging|production] [--sha <40-hex>] [--guardian-email <mailbox>] [--child-email <mailbox>] [--skip B,E] [--cleanup] [--non-interactive] [--out <dir>] [--max-reads 4] [--json]';
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  const interactive = !args.nonInteractive && process.stdin.isTTY === true;
  console.log(`── Pri Learning staging acceptance A–D ─ target ${args.target} ─ ${args.origin}${args.sha ? ` ─ nominated ${args.sha}` : ''}`);
  console.log(`   ${interactive ? 'interactive: HUMAN STEP lines wait for the person at this terminal' : 'non-interactive: HUMAN STEP lines are printed and left open (NOT VERIFIED)'}`);
  let report;
  try {
    report = await runAcceptance(args, { prompt: interactive ? defaultPrompt : null });
  } catch (error) {
    console.error(error?.message || String(error));
    process.exit(error?.exitCode || 2);
  }
  console.log('');
  for (const step of report.steps) console.log(`  ${step.id}  ${step.status.padEnd(12)} ${step.title}`);
  if (report.humanSteps.length) {
    console.log('\nHuman steps this run named:');
    for (const item of report.humanSteps) console.log(`  [${item.step}] ${item.text}`);
  }
  console.log(`\nrequests ${report.requests} · provider reads spent ${report.providerReads}/${report.maxReads} · report ${report.reportFile}`);
  console.log('Evidence classes are per step (see the report). Nothing here is a student, a physical device, Apple Pencil or a camera: that is docs/release/device-matrix.md.');
  if (args.json) console.log(JSON.stringify(report, null, 2));
  const code = exitCodeFor(report);
  console.log(`STAGING ACCEPTANCE: ${code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'NOT VERIFIED'} — ${report.target} — ${Object.entries(report.summary).map(([id, status]) => `${id}:${status}`).join(' ')}`);
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
