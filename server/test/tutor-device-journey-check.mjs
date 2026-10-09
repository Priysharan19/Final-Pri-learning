// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the AI tutor switched on, device to server to model and back
//
// tutor-help-check.mjs proves the server contract with the router mounted
// alone and the model call stubbed in-process; tour-ai-tutor.js proves the
// browser wiring with /v1 intercepted. Nothing proved the two halves meet. This
// suite runs an authenticated student and the shipped local backend against
// the whole shipped /v1 app with an actual server-issued India question. The
// public question deliberately omits secret worked-solution steps; the Tutor
// must be grounded on the trusted server, not on a leaked client answer key.
// PRI_FEATURE_TUTOR=1, and the provider endpoint pointed at a local fake of the
// Responses API. No model, no key, no network beyond 127.0.0.1, no spend.
//
//   1. level 1 from the practice route reaches the model and shows its words,
//      and what the model was sent is grounded and carries no identifiers;
//   2. a reply the model itself declares a leak never reaches the student: the
//      question's own hint does;
//   3. level 3 is the deterministic walkthrough, closes the question as Reveal
//      does, and costs no model call;
//   4. the tutored attempt syncs to the account with its help level on it;
//   5. a connection loss — the provider down behind the server, or the device
//      cut off from the server — shows the question's bundled hint, coded, with
//      no model call, and the help is still counted on the row.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── A fake Responses API on localhost ───────────────────────────────────────
const providerCalls = [];
let nextReply = null;
const provider = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    let body = null;
    try { body = JSON.parse(raw); } catch { /* recorded as null */ }
    providerCalls.push({ authorization: req.headers.authorization || '', body });
    const reply = nextReply || { message: 'Look at what is done to the unknown, and undo it first.', references_step_index: 0, reveals_answer: false };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ output_text: JSON.stringify(reply) }));
  });
});
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
const providerOrigin = `http://127.0.0.1:${provider.address().port}`;

const names = [
  'NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FEATURE_TUTOR',
  'PRI_HANDWRITING_API_KEY', 'PRI_TUTOR_ENDPOINT', 'PRI_TUTOR_MODEL', 'PRI_PAID_CALLS_PER_HOUR',
  'PRI_PAID_CALLS_PER_DAY', 'PRI_TUTOR_CALLS_PER_ACCOUNT_DAY'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-tutor-journey-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '66'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_FEATURE_TUTOR = '1';
process.env.PRI_HANDWRITING_API_KEY = 'k-journey-test-only';
process.env.PRI_TUTOR_ENDPOINT = `${providerOrigin}/v1/responses`;
process.env.PRI_TUTOR_MODEL = 'journey-model';
process.env.PRI_PAID_CALLS_PER_HOUR = '10000';
process.env.PRI_PAID_CALLS_PER_DAY = '100000';
process.env.PRI_TUTOR_CALLS_PER_ACCOUNT_DAY = '1000';

const { startApp, checks, registerAccount, verifyEmail, absorbCookies, cookieHeader } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const c = checks();
const app = await startApp({ engine: requestedEngine() });
const db = app.db;

// ── The device ───────────────────────────────────────────────────────────────
const { installBrowserEnv, resetStorage } = await import('../../client/test/backend-check.mjs');
installBrowserEnv(); resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = app.origin;
// A non-production build reads the runtime switch; a staging build bakes it in.
globalThis.__PRI_TUTOR_OVERRIDE__ = true;

const deviceJar = {};
const realFetch = globalThis.fetch;
// Section 5b cuts the device off from /v1/tutor: the request never leaves it.
let deviceOffline = false;
let tutorRequestsLeftDevice = 0;
globalThis.fetch = async (url, options = {}) => {
  if (options.credentials !== 'include') return realFetch(url, options);
  if (String(url).includes('/v1/tutor/')) {
    if (deviceOffline) throw new TypeError('fetch failed');
    tutorRequestsLeftDevice += 1;
  }
  const headers = { ...(options.headers || {}) };
  const cookies = cookieHeader(deviceJar);
  if (cookies) headers.Cookie = cookies;
  const { credentials: _c, cache: _k, redirect: _r, ...rest } = options;
  const response = await realFetch(url, { ...rest, headers, redirect: 'manual' });
  absorbCookies(response, deviceJar);
  return response;
};
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { get cookie() { return Object.entries(deviceJar).map(([k, v]) => `${k}=${v}`).join('; '); } };
}

const { api } = await import('../../client/src/api.js');
const idb = await import('../../client/src/local/idb.js');
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { loginCloudAccount } = await import('../../client/src/platform/cloudAccount.js');
const { syncNow } = await import('../../client/src/platform/syncWorker.js');
await loadAllBanks();

const YEAR10 = ['c8-linear-equations-both-sides'];
let turn = 0;

/** A practice question the tutor can be grounded in: verified steps and a hint. */
async function tutorable() {
  for (let i = 0; i < 80; i++) {
    const s = await api.post('/practice/next', { mode: 'topic', subtopic: YEAR10[turn++ % YEAR10.length], resume: false });
    const q = (await idb.get('questions', s.question.id)).payload;
    if (Array.isArray(q.hints) && q.hints.length) {
      const before = providerCalls.length;
      nextReply = null;
      const first = await api.post(`/practice/${s.question.id}/tutor`, { level: 1, locale: 'en' });
      // Some questions are refused upstream as ungrounded (too long, not
      // maths): those fall back without a model call. Keep looking.
      // A model that never receives authorised grounding has no right to
      // claim premium tutoring; the old all-local fixture could pass by
      // reading q.steps, but this public issued question has none.
      c.eq(first.source, 'tutor',
        'a real server-issued student question must reach server-grounded tutor help');
      return { id: s.question.id, q, first, calls: providerCalls.length - before };
    }
    await api.post(`/practice/${s.question.id}/discard`, {}).catch(() => {});
  }
  throw new Error('no practice question reached the tutor');
}

/** A grounded practice question whose level-1 help comes back deterministic with `code`. */
async function fallsBackWith(code) {
  for (let i = 0; i < 80; i++) {
    const s = await api.post('/practice/next', { mode: 'topic', subtopic: YEAR10[turn++ % YEAR10.length], resume: false });
    const q = (await idb.get('questions', s.question.id)).payload;
    if (Array.isArray(q.hints) && q.hints.length) {
      const first = await api.post(`/practice/${s.question.id}/tutor`, { level: 1, locale: 'en' });
      if (first.source === 'tutor') throw new Error('the provider answered while it was meant to be unreachable');
      if (first.code === code) return { id: s.question.id, q, first };
      // Refused upstream as ungrounded before any provider call: keep looking.
    }
    await api.post(`/practice/${s.question.id}/discard`, {}).catch(() => {});
  }
  throw new Error(`no practice question fell back with ${code}`);
}

let providerClosed = false;
try {
  const email = 'tutor.journey@example.test';
  const password = 'correct-horse-battery';
  const name = 'Tutor Journey';
  const reg = await registerAccount(app, { email, password, name, deviceId: 'ipad-tutor-journey' });
  c.eq(reg.status, 201, 'a student account exists on the server');
  const accountId = reg.account.id;
  c.ok((await verifyEmail(app, accountId)).status === 200, 'its email is verified');

  const me = (await api.post('/profiles', { name, year: 8, course: 'in', indiaTrack: 'cbse' })).user;
  await loginCloudAccount(me.id, { email, password });
  await syncNow(me.id);

  const status = await app.request('/v1/tutor/status', { jar: deviceJar });
  c.eq(status.status, 200, 'the switched-on server exposes the tutor');
  c.eq(status.data?.available, true, 'and reports a configured provider');

  // ── 1 · level 1 reaches the model and shows its words ─────────────────────
  const t = await tutorable();
  c.eq(t.first.source, 'tutor', 'level 1 is answered by the tutor');
  c.eq(t.first.level, 1, 'at level 1');
  c.match(t.first.message, /undo it first/, 'with the model\'s own words');
  c.ok(t.calls >= 1, 'which took a call to the provider');
  const sent = providerCalls[providerCalls.length - 1];
  c.eq(sent.authorization, 'Bearer k-journey-test-only', 'the server, not the device, holds the provider key');
  c.eq(sent.body?.model, 'journey-model', 'the configured model is asked');
  c.eq(sent.body?.store, false, 'with storage off');
  const wire = JSON.stringify(sent.body);
  c.ok(wire.includes('VERIFIED SOLUTION'), 'the request is grounded in the verified solution');
  for (const secret of [email, name, accountId, me.id]) {
    c.ok(!wire.includes(secret), `the provider is not sent ${secret === email ? 'the email' : secret === name ? 'the name' : 'an id'}`);
  }

  // ── 2 · a self-declared leak never reaches the student ─────────────────────
  nextReply = { message: 'The answer is right there.', references_step_index: 0, reveals_answer: true };
  const before2 = providerCalls.length;
  const second = await api.post(`/practice/${t.id}/tutor`, { level: 2, locale: 'en' });
  c.eq(second.level, 2, 'level 2 follows level 1');
  c.eq(second.source, 'deterministic', 'a leaking reply is replaced');
  c.ok(!/right there/.test(String(second.message || '')), 'the leaking words are never shown');
  c.ok(t.q.hints.includes(second.message), 'the question\'s own hint is shown instead');
  c.ok(providerCalls.length > before2, 'the provider was asked');

  // ── 3 · the walkthrough is deterministic and ends the question ─────────────
  const before3 = providerCalls.length;
  const third = await api.post(`/practice/${t.id}/tutor`, { level: 3, locale: 'en', ms: 4000 });
  c.eq(third.source, 'deterministic', 'level 3 is the verified walkthrough');
  c.eq(third.resolved, true, 'which closes the question');
  c.eq(third.correct, false, 'as not correct, like Reveal');
  c.eq(providerCalls.length, before3, 'and costs no model call');
  const late = await api.post(`/practice/${t.id}/submit`, { answer: '1', ms: 500, submissionId: 'sub_tutor_journey_late' }).then(r => r, e => e);
  c.eq(late?.status, 409, 'the answer cannot then be submitted for credit');

  // ── 4 · the tutored attempt syncs with its help level ──────────────────────
  await syncNow(me.id);
  const events = await db.all('SELECT kind, payload_json FROM learning_events WHERE account_id=? AND entity_id=?', [accountId, t.id]);
  c.eq(events.length, 1, 'the server holds one learning event for the tutored question');
  const payload = JSON.parse(events[0]?.payload_json || '{}');
  c.eq(payload.tutorLevel, 3, 'carrying the help level the student used');
  c.eq(payload.support, 'supported', 'and recorded as supported, not independent');
  c.eq(payload.correct, false, 'and not correct');

  // ── 5a · the provider is down behind the server ───────────────────────────
  await new Promise(resolve => provider.close(resolve));
  providerClosed = true;
  const calls5 = providerCalls.length;
  const left5 = tutorRequestsLeftDevice;
  const down = await fallsBackWith('TUTOR_UNREACHABLE');
  c.eq(down.first.level, 1, 'with the provider unreachable, level 1 is still answered');
  c.eq(down.first.source, 'deterministic', 'by the deterministic engine');
  c.eq(down.first.code, 'TUTOR_UNREACHABLE', 'coded as the server failing to reach the provider');
  c.eq(down.first.message, down.q.hints[0], 'showing the question\'s own first hint');
  c.eq(providerCalls.length, calls5, 'the provider recorded no call');
  c.ok(tutorRequestsLeftDevice > left5, 'though the device did ask the server');
  c.eq((await idb.get('questions', down.id)).tutorLevel, 1, 'and the help is counted on the row like a hint');
  await api.post(`/practice/${down.id}/discard`, {}).catch(() => {});

  // ── 5b · the device is cut off from the server ─────────────────────────────
  deviceOffline = true;
  const left5b = tutorRequestsLeftDevice;
  const off = await fallsBackWith('TUTOR_FAILED');
  c.eq(off.first.source, 'deterministic', 'with the server unreachable, the deterministic engine answers');
  c.eq(off.first.code, 'TUTOR_FAILED', 'coded as the transport failing');
  c.eq(off.first.message, off.q.hints[0], 'with the question\'s own first hint');
  c.eq(tutorRequestsLeftDevice, left5b, 'and no tutor request left the device');
  c.eq(providerCalls.length, calls5, 'nor reached the provider');
  c.eq((await idb.get('questions', off.id)).tutorLevel, 1, 'and the help is counted on the row');
  deviceOffline = false;
} finally {
  await app.close();
  if (!providerClosed) await new Promise(resolve => provider.close(resolve));
  globalThis.fetch = realFetch;
  delete globalThis.__PRI_TUTOR_OVERRIDE__;
  rmSync(scratch, { recursive: true, force: true });
  for (const key of names) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
}

console.log(`engine: ${app.engine}`);
console.log(`TUTOR DEVICE JOURNEY — PASS — ${c.count()}/${c.count()} checks — with PRI_FEATURE_TUTOR=1 a practice question's help goes device → /v1 → provider → device, leaks are replaced, the tutored attempt syncs with its help level, and a connection loss at either hop shows the bundled hint.`);
