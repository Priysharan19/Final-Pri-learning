// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · flagship handwriting acceptance
//
// EVIDENCE CLASS: real provider, real localhost HTTP server, SIMULATED
// handwriting images. Not staging. Not a physical device. Not a student.
//
// The journey, over real HTTP against a real `node server/index.js` process:
//
//   server-issued question → handwriting image → real provider transcription
//   (POST /v1/handwriting/transcribe) → server reading receipt
//   (POST /v1/practice/:id/recognize) → authenticated deterministic grading
//   (POST /v1/practice/:id/submit) → verdict, marks, worked solution →
//   persisted attempt, read back through GET /v1/sync/pull/0.
//
// The requests are the ones the shipped client makes, in the order it makes
// them (client/src/components/QuestionCard.jsx submit → client/src/local/
// backend.js gradeOnServer): the reading shown to the student comes from
// /v1/handwriting/transcribe, the answer is its last line, working is its
// lines, the receipt comes from /recognize, and a reading that differs from
// what is submitted (or that the server doubts) is vouched for through
// /recognition/:receipt/confirm. The simulated student never edits a reading:
// whatever the provider read is what is submitted.
//
// The pictures are drawn by the app's own code — client/src/ink/cloudRaster.js
// for ink, client/src/ink/photoRaster.js for a photo — running in Chromium.
//
// This script never holds the provider credential. Run it through launch.mjs.
// Exit code: 0 all expectations met · 1 at least one expectation failed ·
// 3 nothing failed but something could not be verified · 2 dependency missing.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeLines, writeScribble, withExifOrientation } from './simulated-ink.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const RENDER_ONLY = process.argv.includes('--render-only');
const OUT = resolve(process.env.PRI_ACCEPT_OUT || join(tmpdir(), `pri-flagship-${Date.now()}`));
mkdirSync(OUT, { recursive: true });
const SEED = Number(process.env.PRI_ACCEPT_SEED) || 20261010;
const ISSUE_BOUND = Math.max(10, Math.min(120, Number(process.env.PRI_ACCEPT_ISSUE_BOUND) || 40));
const PROVIDER_CALL_BUDGET = 60;

const GENERATOR = 'c10-arithmetic-progressions';
const DIFFICULTY = 3;
const OWNER = Object.freeze({ a: 16, d: -6, term: -122, n: 24 });

// ── Bookkeeping ──────────────────────────────────────────────────────────────
const checks = [];            // { id, name, ok, detail }
const unverified = [];        // { id, what }
const providerCalls = [];     // one row per request that reaches the provider
const cases = [];             // summary rows
const observations = [];      // recorded, not judged
function expect(id, name, ok, detail = '') {
  checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail) });
  return !!ok;
}
const short = (value, n = 60) => {
  const text = String(value ?? '').replace(/\n/g, ' ⏎ ');
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
};
const lastLine = text => String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean).at(-1) || '';
/** Compare what was written with what was read, ignoring only spacing and minus-sign glyphs. */
const norm = text => String(text ?? '').replace(/[−–—]/g, '-').replace(/\s+/g, '').toLowerCase();
const sameLines = (read, written) => {
  const a = String(read ?? '').split('\n').map(norm).filter(Boolean);
  const b = written.map(norm);
  return a.length === b.length && a.every((line, i) => line === b[i]);
};

// ── HTTP, as a browser would send it ─────────────────────────────────────────
function makeHttp(origin) {
  return async function request(path, { method = 'GET', body, jar = null, headers = {} } = {}) {
    const send = { Accept: 'application/json', ...headers };
    if (jar) {
      const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookies) send.Cookie = cookies;
      if (!['GET', 'HEAD'].includes(method) && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
    }
    if (body !== undefined) send['Content-Type'] = 'application/json';
    const started = Date.now();
    const response = await fetch(origin + path, { method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
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
    return { status: response.status, data, ms: Date.now() - started, code: data?.error?.code || null };
  };
}

// ── The picture factory: the app's own rasterisers, in Chromium ──────────────
const requireClient = createRequire(join(REPO, 'client', 'package.json'));
async function openStudio() {
  const { chromium } = requireClient('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ORIGIN = 'http://pri-acceptance.invalid';
  const modules = {
    '/ink/cloudRaster.js': join(REPO, 'client', 'src', 'ink', 'cloudRaster.js'),
    '/ink/photoRaster.js': join(REPO, 'client', 'src', 'ink', 'photoRaster.js')
  };
  // Nothing is fetched from the network: the page and the two client modules
  // are served from this checkout.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>simulated ink</title>' });
    const file = modules[url.pathname];
    if (!file) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(file, 'utf8') });
  });
  await page.goto(ORIGIN + '/');
  return {
    close: () => browser.close(),
    /** Stroke coordinates → the PNG the app sends for ink (client rasterizeInk). */
    ink: strokes => page.evaluate(async s => {
      const { rasterizeInk } = await import('/ink/cloudRaster.js');
      const out = rasterizeInk(s);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height, bytes: out.bytes } : null;
    }, strokes),
    blank: (width, height, type = 'image/png') => page.evaluate(({ width, height, type }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return canvas.toDataURL(type, 0.9);
    }, { width, height, type }),
    /**
     * A "camera" file of a page of working: paper-coloured, unevenly lit, ruled,
     * the page turned a few degrees, and stored SIDEWAYS the way a phone held
     * upright stores a landscape sensor — the EXIF Orientation tag is added by
     * the caller. Returns a JPEG data URL with no EXIF yet.
     */
    cameraJpeg: ({ strokes, seed, degrees = 3 }) => page.evaluate(({ strokes, seed, degrees }) => {
      let a = seed >>> 0;
      const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const W = 1500, H = 1100;
      const upright = document.createElement('canvas');
      upright.width = W; upright.height = H;
      const ctx = upright.getContext('2d');
      ctx.fillStyle = '#efe6cf';
      ctx.fillRect(0, 0, W, H);
      const light = ctx.createRadialGradient(W * 0.38, H * 0.3, 80, W * 0.5, H * 0.5, W * 0.85);
      light.addColorStop(0, 'rgba(255,250,235,0.55)');
      light.addColorStop(1, 'rgba(120,105,80,0.34)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i += 1) {                       // paper grain
        ctx.fillStyle = `rgba(${90 + rand() * 60 | 0},${80 + rand() * 50 | 0},${60 + rand() * 40 | 0},${0.03 + rand() * 0.05})`;
        ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of strokes) for (const p of stroke) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
      const scale = Math.min((W * 0.7) / (maxX - minX), (H * 0.66) / (maxY - minY));
      ctx.translate(W / 2, H / 2);
      ctx.rotate(degrees * Math.PI / 180);
      ctx.strokeStyle = 'rgba(120,150,190,0.5)';               // ruled lines, turned with the page
      ctx.lineWidth = 1.4;
      for (let y = -H; y < H; y += 74) { ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = '#1c2a66';                              // blue-black ballpoint
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, 2.6 * scale);
      const px = x => (x - (minX + maxX) / 2) * scale, py = y => (y - (minY + maxY) / 2) * scale;
      for (const stroke of strokes) {
        ctx.beginPath();
        ctx.moveTo(px(stroke[0].x), py(stroke[0].y));
        for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(px(stroke[i].x), py(stroke[i].y));
        ctx.stroke();
      }
      // Stored rotated 90° anticlockwise: Orientation 6 turns it back upright.
      const stored = document.createElement('canvas');
      stored.width = H; stored.height = W;
      const sctx = stored.getContext('2d');
      sctx.translate(0, W);
      sctx.rotate(-Math.PI / 2);
      sctx.drawImage(upright, 0, 0);
      return { dataUrl: stored.toDataURL('image/jpeg', 0.9), storedWidth: H, storedHeight: W };
    }, { strokes, seed, degrees }),
    /** The camera file → what the app's Photo mode sends (client preparePhoto). */
    preparePhoto: dataUrl => page.evaluate(async d => {
      const { preparePhoto } = await import('/ink/photoRaster.js');
      const out = await preparePhoto(d);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height, bytes: out.bytes, quality: out.quality, scaledFrom: out.scaledFrom } : null;
    }, dataUrl)
  };
}
const bytesOf = dataUrl => Buffer.from(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1), 'base64');
function save(name, dataUrl) {
  // The file name says what it is, wherever it ends up.
  const file = join(OUT, `SIMULATED-handwriting-${name}`);
  writeFileSync(file, bytesOf(dataUrl));
  return file;
}

// ── The working a student would write for this question ──────────────────────
function workingLines({ a, d, term, n }, finalN = n) {
  const step = d < 0 ? `${a} - ${Math.abs(d)}(n-1)` : `${a} + ${d}(n-1)`;
  return [`${term} = ${step}`, `${term - a} = ${d}(n-1)`, `${n - 1} = n-1`, `n = ${finalN}`];
}

async function renderAll(studio, sets) {
  const made = {};
  let seed = SEED;
  for (const [name, lines] of Object.entries(sets)) {
    const { strokes } = writeLines(lines, { seed: seed += 101 });
    const image = await studio.ink(strokes);
    if (!image) throw new Error(`the app rasteriser returned nothing for ${name}`);
    made[name] = { ...image, strokes, lines, file: save(`${name}.png`, image.dataUrl) };
  }
  return made;
}

if (RENDER_ONLY) {
  const studio = await openStudio();
  try {
    const made = await renderAll(studio, { 'wrong-5': ['5'], 'right-24': ['24'], 'working': workingLines(OWNER), 'working-wrong-final': workingLines(OWNER, 23), 'digits': ['0123456789'], 'symbols': ['-+=()n'] });
    const camera = await studio.cameraJpeg({ strokes: made.working.strokes, seed: SEED });
    const exif = 'data:image/jpeg;base64,' + withExifOrientation(bytesOf(camera.dataUrl), 6).toString('base64');
    save('photo-camera-exif6.jpg', exif);
    const prepared = await studio.preparePhoto(exif);
    save('photo-as-sent.jpg', prepared.dataUrl);
    const scribble = await studio.ink(writeScribble({ seed: SEED }).strokes);
    save('scribble.png', scribble.dataUrl);
    console.log(`rendered SIMULATED handwriting to ${OUT} (photo as sent ${prepared.width}x${prepared.height})`);
  } finally { await studio.close(); }
  process.exit(0);
}

// ── Dependencies ─────────────────────────────────────────────────────────────
const BASE = process.env.PRI_ACCEPT_BASE;
const DB_PATH = process.env.PRI_ACCEPT_DB;
const SLOW_BASE = process.env.PRI_ACCEPT_TIMEOUT_BASE;
const SLOW_DB = process.env.PRI_ACCEPT_TIMEOUT_DB;
if (!BASE || !DB_PATH || !process.env.PRI_AUTH_DELIVERY_KEY) {
  console.log('DEPENDENCY MISSING: run this through tools/acceptance/launch.mjs (it boots the local servers and passes their addresses).');
  process.exit(2);
}
for (const origin of [BASE, SLOW_BASE].filter(Boolean)) {
  const host = new URL(origin).hostname;
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) {
    console.log(`REFUSED: this acceptance only runs against localhost, not ${host}.`);
    process.exit(2);
  }
}
const requireServer = createRequire(join(REPO, 'server', 'package.json'));
const Database = requireServer('better-sqlite3');
const { decryptDeliveryToken } = await import(pathToFileURL(join(REPO, 'server', 'platform', 'deliveryCrypto.js')).href);

/** The link the local server queued for a mailbox, read from its own outbox (read-only). */
function queuedToken(dbPath, accountId, kind) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
      WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC`).get(accountId, kind);
    return row ? decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`) : null;
  } finally { db.close(); }
}

/**
 * A Class 10 student's account, made the way the product makes one: registered
 * as a child naming a guardian, the email verified with the link the server
 * queued, the guardian's consent given with the link the server queued for the
 * guardian. No row is written by this script and no gate is skipped.
 */
async function enrol(http, dbPath, label, tinyImage) {
  const jar = {};
  const tag = randomBytes(4).toString('hex');
  const register = await http('/v1/account/register', { method: 'POST', jar, body: {
    name: 'Acceptance Student', email: `flagship.${label}.${tag}@example.test`,
    password: `Fl-${randomBytes(12).toString('base64url')}`, deviceId: `acceptance-${label}`,
    year: '10', guardianName: 'Acceptance Guardian', guardianEmail: `guardian.${label}.${tag}@example.test`
  } });
  if (register.status !== 201) throw new Error(`register ${label}: ${register.status} ${register.code}`);
  const accountId = register.data.account.id;
  const gates = {};
  if (tinyImage) {
    // Before the email is verified and before a guardian has confirmed, the
    // reader must refuse — and must refuse before anything is sent to it.
    gates.beforeAnything = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: tinyImage } });
  }
  const verify = await http('/v1/account/email/verify', { method: 'POST', body: { token: queuedToken(dbPath, accountId, 'verify-email') } });
  if (verify.status !== 200) throw new Error(`verify email ${label}: ${verify.status} ${verify.code}`);
  if (tinyImage) gates.verifiedNoConsent = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: tinyImage } });
  const consent = await http('/v1/account/guardian/confirm', { method: 'POST', body: { token: queuedToken(dbPath, accountId, 'guardian-consent') } });
  if (consent.status !== 200 || consent.data?.confirmed !== true) throw new Error(`guardian confirm ${label}: ${consent.status} ${consent.code}`);
  const state = await http('/v1/account/guardian/state', { jar });
  return { jar, accountId, gates, consentState: state.data?.state ?? null, ageBasis: state.data?.ageBasis ?? null };
}

// ── One place that talks to the reader, so every call is counted ─────────────
function reader(http, jar, serverLabel = 'main') {
  const note = (caseId, route, res, extra = {}) => {
    const t = res.data?.transcription || null;
    const row = {
      case: caseId, server: serverLabel, route, status: res.status, code: res.code,
      clientMs: res.ms, latencyMs: t?.latencyMs ?? null,
      confidence: t?.confidence ?? null, needsConfirmation: t?.needsConfirmation ?? null,
      providerNeedsConfirmation: t?.providerNeedsConfirmation ?? null,
      escalated: t?.escalated ?? null, fallbackAttempted: t?.fallbackAttempted ?? null,
      fallbackFailureCode: t?.fallbackFailureCode ?? null, engine: t?.engine ?? null,
      text: t?.text ?? null, ...extra
    };
    providerCalls.push(row);
    return row;
  };
  return {
    /** POST /v1/handwriting/transcribe. The body is the picture and nothing else. */
    async transcribe(caseId, image) {
      const body = { image };
      // Answer-blindness on the wire, asserted on every call this script makes.
      if (Object.keys(body).join(',') !== 'image' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
        throw new Error('acceptance bug: a transcribe body must carry exactly one image');
      }
      const res = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body });
      return { res, row: note(caseId, 'transcribe', res), t: res.data?.transcription || null };
    },
    /** POST /v1/practice/:id/recognize. The body is the picture and its input mode. */
    async recognize(caseId, questionId, mode, image) {
      const res = await http(`/v1/practice/${questionId}/recognize`, { method: 'POST', jar, body: { mode, image } });
      return { res, row: note(caseId, `recognize(${mode})`, res), t: res.data?.transcription || null, receipt: res.data?.receipt || null };
    }
  };
}
const spent = () => providerCalls.reduce((n, row) => n + (row.fallbackAttempted ? 2 : 1), 0);
function budget(needed) {
  if (spent() + needed > PROVIDER_CALL_BUDGET) throw new Error(`provider call budget (${PROVIDER_CALL_BUDGET}) would be exceeded`);
}

async function gradedEvents(http, jar, questionId = null) {
  const pull = await http('/v1/sync/pull/0', { jar });
  const events = (pull.data?.events || []).filter(e => e.kind === 'graded-attempt');
  return questionId ? events.filter(e => e.entityId === questionId) : events;
}

/**
 * The shipped client's submit, step for step, for an answer written in ink or
 * photographed. `reading` is what /v1/handwriting/transcribe returned; the
 * simulated student submits it unedited.
 */
async function submitAsClient({ http, jar, read, caseId, question, mode, image, reading, tryNo, photo = false }) {
  const answer = lastLine(reading.text);
  const lines = String(reading.text).split('\n').map(x => x.trim()).filter(Boolean);
  // Ink: working is sent only when more than one line was written. Photo: the
  // whole reading is the working (QuestionCard.jsx submit()).
  const steps = photo ? reading.text : (lines.length > 1 ? lines.join('\n') : undefined);
  budget(2);
  const recognised = await read.recognize(`${caseId} try ${tryNo}`, question.id, mode, image);
  if (recognised.res.status !== 201 || !recognised.receipt) {
    return { stage: 'recognize', recognised, answer, steps };
  }
  let receipt = recognised.receipt;
  let confirmed = null;
  if (recognised.t.text !== answer || recognised.t.needsConfirmation === true) {
    // The student vouches for the reading on screen. Server-side this is a new
    // receipt that records the original reading and the human confirmation.
    const res = await http(`/v1/practice/${question.id}/recognition/${receipt}/confirm`, { method: 'POST', jar, body: { text: answer } });
    confirmed = { status: res.status, code: res.code, reason: recognised.t.needsConfirmation === true ? 'server asked for confirmation' : 'receipt text is the whole page; the answer is its last line' };
    if (res.status !== 201 || !res.data?.receipt) return { stage: 'confirm', recognised, confirmed, answer, steps };
    receipt = res.data.receipt;
  }
  const submissionId = `accept-${caseId.replace(/[^a-z0-9]/gi, '')}-${tryNo}-${randomBytes(6).toString('hex')}`;
  const payload = { submissionId, answer, mode, ...(steps !== undefined ? { steps } : {}), transcriptionReceipt: receipt, ms: 41000 + tryNo };
  const graded = await http(`/v1/practice/${question.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: payload });
  return { stage: 'graded', recognised, confirmed, answer, steps, payload, graded };
}

const marks = r => (r && Number.isFinite(r.marksEarned) ? `${r.marksEarned}/${r.marksPossible}` : '—');
const verdictOf = r => !r ? '—' : r.invalid ? 'invalid' : r.correct ? 'correct' : 'incorrect';

// ═════════════════════════════════════════════════════════════════════════════
const http = makeHttp(BASE);
const studio = await openStudio();
let fatal = null;
try {
  const tiny = await studio.blank(64, 64);

  // ── Account and gates ──────────────────────────────────────────────────────
  const student = await enrol(http, DB_PATH, 'main', tiny);
  const { jar } = student;
  expect('setup', 'unverified, unconsented child account is refused by the reader (403, no reading)',
    student.gates.beforeAnything.status === 403 && !student.gates.beforeAnything.data?.transcription,
    `${student.gates.beforeAnything.status} ${student.gates.beforeAnything.code}`);
  expect('setup', 'verified child account without guardian consent is refused by the reader (403, no reading)',
    student.gates.verifiedNoConsent.status === 403 && !student.gates.verifiedNoConsent.data?.transcription,
    `${student.gates.verifiedNoConsent.status} ${student.gates.verifiedNoConsent.code}`);
  observations.push(`account: registered as a Class 10 child (age basis "${student.ageBasis}"), email verified and guardian consent "${student.consentState}" through the server's own routes; gate codes before: ${student.gates.beforeAnything.code}, ${student.gates.verifiedNoConsent.code}`);

  const status = await http('/v1/handwriting/status', { jar });
  observations.push(`provider status: state=${status.data?.state} usable=${status.data?.usable} model=${status.data?.model} fallbackModel=${status.data?.fallbackModel} confidenceFloor=${status.data?.confidenceFloor} timeoutMs=${status.data?.timeoutMs} lastFailureCode=${status.data?.lastFailureCode}`);
  if (status.data?.configured !== true) {
    console.log('DEPENDENCY MISSING: the local server reports no handwriting provider configured. Nothing was faked.');
    process.exit(2);
  }
  expect('setup', 'the real provider is configured and usable on the local server', status.data?.usable === true, JSON.stringify({ state: status.data?.state, lastFailureCode: status.data?.lastFailureCode }));

  // ── Answer-blindness at the route (no provider call is made by a refusal) ──
  const leak = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: tiny, expectedAnswer: '24' } });
  expect('blind', 'a transcribe body that names an answer is refused (400 HANDWRITING_NOT_ANSWER_BLIND)', leak.status === 400 && leak.code === 'HANDWRITING_NOT_ANSWER_BLIND', `${leak.status} ${leak.code}`);
  const leak2 = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: tiny, questionId: 'anything' } });
  expect('blind', 'a transcribe body that names a question is refused (400)', leak2.status === 400, `${leak2.status} ${leak2.code}`);

  // ── Questions: issued by the server, which chooses the seed ────────────────
  const PROMPT = /first term \$(-?\d+)\$ and common difference \$(-?\d+)\$, which term is equal to \$(-?\d+)\$\? Give the term number\./;
  const pool = [];
  const seenContent = new Set();
  let exact = null, issued = 0, leaked = [];
  while (issued < ISSUE_BOUND && !exact) {
    const res = await http('/v1/practice/issue', { method: 'POST', jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } });
    issued += 1;
    if (res.status !== 201) throw new Error(`issue: ${res.status} ${res.code}`);
    const q = res.data.question;
    // Hints are public by design (client/src/engine/publicQuestion.js); the key,
    // the solution, the traps, the step-check plan and the seed are not.
    for (const key of ['answer', 'correct', 'expected', 'expectedAnswer', 'solution', 'solutionText', 'markScheme', 'steps', 'traps', 'stepcheck', 'seed']) if (key in q) leaked.push(key);
    const m = String(q.prompt).match(PROMPT);
    if (!m || res.data.repeat || res.data.triesLeft === 1) continue;
    const [a, d, term] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // The expected term number, worked out here from the printed question —
    // never taken from the server.
    const n = (term - a) / d + 1;
    if (!Number.isInteger(n) || a + (n - 1) * d !== term) continue;
    const key = q.contentHash || q.prompt;
    if (seenContent.has(key)) continue;
    seenContent.add(key);
    const entry = { id: q.id, prompt: q.prompt, a, d, term, n, criteriaCount: q.criteriaCount, difficulty: q.difficulty, subtopic: q.subtopic, supportsSteps: q.supportsSteps };
    pool.push(entry);
    if (a === OWNER.a && d === OWNER.d && term === OWNER.term) exact = entry;
  }
  expect('issue', 'issued questions carry no answer, solution, steps, traps, step-check plan or seed', leaked.length === 0, [...new Set(leaked)].join(','));
  expect('issue', 'the server refuses a caller-chosen seed', (await http('/v1/practice/issue', { method: 'POST', jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in', seed: 12345 } })).code === 'PRACTICE_SEED_NOT_ALLOWED', 'seed was honoured');
  if (pool.length < 9) throw new Error(`only ${pool.length} distinct "which term" questions were issued in ${issued} requests`);
  if (exact) observations.push(`the owner's exact question (a=16, d=−6, term −122) WAS issued by the server after ${issued} requests and is used for case 1`);
  else {
    unverified.push({ id: 'issue', what: `the owner's exact numbers (first term 16, common difference −6, term −122 → n = 24) were not issued within ${issued} server-chosen draws (the generator has 13,824 equally likely forms); every case used the same generator item (${GENERATOR}, D${DIFFICULTY}) with the numbers the server issued, and the expected term number was computed independently from the printed question` });
  }
  const take = (() => { const rest = pool.filter(q => q !== exact); return first => (first && exact) ? exact : rest.shift(); })();
  const q1 = take(true), q2 = take(), q3 = take(), q4 = take(), q5 = take(), qWhite = take(), qScribble = take(), qGarbage = take();
  expect('issue', 'the item is Class 10 Arithmetic Progressions, difficulty 3, 3 marks',
    [q1, q2, q3, q4, q5].every(q => q.subtopic === GENERATOR && q.difficulty === 3 && q.criteriaCount === 3),
    JSON.stringify({ subtopic: q1.subtopic, difficulty: q1.difficulty, criteriaCount: q1.criteriaCount }));
  observations.push(`the server's own description of the issued item: subtopic=${q1.subtopic} difficulty=${q1.difficulty} criteriaCount=${q1.criteriaCount} supportsSteps=${q1.supportsSteps}`);

  const read = reader(http, jar);
  const describe = q => `a=${q.a}, d=${q.d}, term ${q.term} → n=${q.n}`;

  // ── Pictures (SIMULATED handwriting) ───────────────────────────────────────
  const art = await renderAll(studio, {
    'case1-wrong-answer': ['5'],
    'case2-right-answer': [String(q2.n)],
    'case3-working': workingLines(q3),
    'case4-working-wrong-final': workingLines(q4, q4.n - 1),
    'case5-working-for-photo': workingLines(q5)
  });

  // ══ Case 1 · a wrong answer, "5" ══════════════════════════════════════════
  {
    const id = 'case 1';
    const row = { case: '1 wrong answer "5"', question: describe(q1), written: '5' };
    budget(1);
    const first = await read.transcribe(id, art['case1-wrong-answer'].dataUrl);
    row.transcript = first.t?.text ?? `[${first.res.status} ${first.res.code}]`;
    Object.assign(row, { confidence: first.t?.confidence, needsConfirmation: first.t?.needsConfirmation, fallback: first.t?.fallbackAttempted, latencyMs: first.t?.latencyMs });
    const readOk = expect(id, 'provider transcript of the image "5" is exactly `5`', first.res.status === 200 && sameLines(first.t?.text, ['5']), `read ${JSON.stringify(first.t?.text ?? null)} (${first.res.status} ${first.res.code})`);
    if (first.res.status === 200 && first.t?.text) {
      const before = (await gradedEvents(http, jar)).length;
      const one = await submitAsClient({ http, jar, read, caseId: id, question: q1, mode: 'ink', image: art['case1-wrong-answer'].dataUrl, reading: first.t, tryNo: 1 });
      const r1 = one.graded?.data;
      expect(id, 'first try is marked by the server: incorrect, not resolved, one try left, no solution disclosed',
        one.stage === 'graded' && one.graded.status === 200 && r1.authoritative === true && r1.correct === false && r1.resolved === false && r1.triesLeft === 1 && !('solution' in r1),
        JSON.stringify(one.stage === 'graded' ? { status: one.graded.status, code: one.graded.code, correct: r1?.correct, resolved: r1?.resolved, invalid: r1?.invalid } : { stage: one.stage, status: one.recognised?.res.status, code: one.recognised?.res.code }));
      expect(id, 'nothing is persisted as an attempt while the question is still open', (await gradedEvents(http, jar)).length === before, 'an attempt event appeared before resolution');
      if (one.stage === 'graded' && r1?.resolved === false) {
        const two = await submitAsClient({ http, jar, read, caseId: id, question: q1, mode: 'ink', image: art['case1-wrong-answer'].dataUrl, reading: first.t, tryNo: 2 });
        const r2 = two.graded?.data;
        row.verdict = verdictOf(r2); row.marks = marks(r2);
        expect(id, 'second try resolves: incorrect, marksEarned 0 of 3',
          two.stage === 'graded' && two.graded.status === 200 && r2.correct === false && r2.resolved === true && r2.marksEarned === 0 && r2.marksPossible === 3,
          JSON.stringify(two.stage === 'graded' ? { status: two.graded.status, code: two.graded.code, correct: r2?.correct, resolved: r2?.resolved, marksEarned: r2?.marksEarned, marksPossible: r2?.marksPossible } : { stage: two.stage }));
        const solution = r2?.solution;
        expect(id, `worked solution is disclosed and shows n = ${q1.n}`,
          !!solution && String(solution.answerText) === String(q1.n) && (solution.steps || []).some(s => String(s.d).includes(`n = ${q1.n}`)),
          JSON.stringify({ answerText: solution?.answerText, lastStep: solution?.steps?.at(-1)?.d }));
        row.solution = solution ? `answerText ${solution.answerText}; last step ${solution.steps?.at(-1)?.d}` : 'none';
        const mine = await gradedEvents(http, jar, q1.id);
        expect(id, 'the attempt is persisted exactly once and reads back through /v1/sync/pull (incorrect, 0/3, input mode ink)',
          mine.length === 1 && mine[0].id === r2?.attemptId && mine[0].payload.correct === false && mine[0].payload.marksEarned === 0 && mine[0].payload.marksPossible === 3 && mine[0].payload.inputMode === 'ink' && mine[0].deviceId === 'server-grader',
          JSON.stringify(mine.map(e => ({ id: e.id === r2?.attemptId, payload: e.payload }))));
        row.persisted = mine.length === 1 ? `1 event, attempt ${String(r2?.attemptId).slice(0, 8)}…` : `${mine.length} events`;
        const third = await http(`/v1/practice/${q1.id}/submit`, { method: 'POST', jar, body: { submissionId: `accept-third-${randomBytes(5).toString('hex')}`, answer: String(q1.n), mode: 'typed' } });
        expect(id, 'a third try on the resolved question is refused (409)', third.status === 409, `${third.status} ${third.code}`);
      }
    }
    row.pass = checks.filter(c => c.id === id).every(c => c.ok) && readOk;
    cases.push(row);
  }

  // ══ Case 2 · the right answer ═════════════════════════════════════════════
  {
    const id = 'case 2';
    const written = String(q2.n);
    const row = { case: `2 right answer "${written}"`, question: describe(q2), written };
    budget(1);
    const first = await read.transcribe(id, art['case2-right-answer'].dataUrl);
    row.transcript = first.t?.text ?? `[${first.res.status} ${first.res.code}]`;
    Object.assign(row, { confidence: first.t?.confidence, needsConfirmation: first.t?.needsConfirmation, fallback: first.t?.fallbackAttempted, latencyMs: first.t?.latencyMs });
    expect(id, `provider transcript of the image "${written}" is exactly \`${written}\``, first.res.status === 200 && sameLines(first.t?.text, [written]), `read ${JSON.stringify(first.t?.text ?? null)} (${first.res.status} ${first.res.code})`);
    if (first.res.status === 200 && first.t?.text) {
      const totalBefore = (await gradedEvents(http, jar)).length;
      const one = await submitAsClient({ http, jar, read, caseId: id, question: q2, mode: 'ink', image: art['case2-right-answer'].dataUrl, reading: first.t, tryNo: 1 });
      const r = one.graded?.data;
      row.verdict = verdictOf(r); row.marks = marks(r);
      expect(id, 'the server marks it correct with full marks (3 of 3) and resolves the question',
        one.stage === 'graded' && one.graded.status === 200 && r.authoritative === true && r.correct === true && r.resolved === true && r.marksEarned === 3 && r.marksPossible === 3,
        JSON.stringify(one.stage === 'graded' ? { status: one.graded.status, code: one.graded.code, correct: r?.correct, invalid: r?.invalid, marksEarned: r?.marksEarned, marksPossible: r?.marksPossible } : { stage: one.stage, status: one.recognised?.res.status, code: one.recognised?.res.code }));
      const mine = await gradedEvents(http, jar, q2.id);
      const totalAfter = (await gradedEvents(http, jar)).length;
      expect(id, 'progress is saved exactly once (one graded-attempt event, correct, 3/3)',
        mine.length === 1 && totalAfter === totalBefore + 1 && mine[0].id === r?.attemptId && mine[0].payload.correct === true && mine[0].payload.marksEarned === 3,
        JSON.stringify({ forQuestion: mine.length, totalBefore, totalAfter }));
      if (one.stage === 'graded' && one.graded.status === 200) {
        const replay = await http(`/v1/practice/${q2.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': one.payload.submissionId }, body: one.payload });
        const again = await gradedEvents(http, jar, q2.id);
        const totalReplay = (await gradedEvents(http, jar)).length;
        expect(id, 'replaying the same submission with the same idempotency key returns the same attempt and gives no second credit',
          replay.status === 200 && replay.data.attemptId === r.attemptId && JSON.stringify(replay.data) === JSON.stringify(r) && again.length === 1 && totalReplay === totalAfter,
          JSON.stringify({ status: replay.status, code: replay.code, sameAttempt: replay.data?.attemptId === r.attemptId, events: again.length, totalReplay, totalAfter }));
        const changed = await http(`/v1/practice/${q2.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': one.payload.submissionId }, body: { ...one.payload, ms: one.payload.ms + 1 } });
        expect(id, 'the same key with a changed request is refused (409), not re-marked', changed.status === 409, `${changed.status} ${changed.code}`);
        const fresh = await http(`/v1/practice/${q2.id}/submit`, { method: 'POST', jar, body: { submissionId: `accept-again-${randomBytes(5).toString('hex')}`, answer: written, mode: 'typed' } });
        expect(id, 'a new key on the already-credited question is refused (409) and adds no credit',
          fresh.status === 409 && (await gradedEvents(http, jar)).length === totalAfter, `${fresh.status} ${fresh.code}`);
        row.persisted = `1 event; replay same attempt; total graded events ${totalAfter}`;
      }
    }
    row.pass = checks.filter(c => c.id === id).every(c => c.ok);
    cases.push(row);
  }

  // ══ Cases 3 and 4 · multi-line working ════════════════════════════════════
  async function workingCase({ id, label, question, image, written, wrongFinal }) {
    const row = { case: label, question: describe(question), written: written.join(' ⏎ ') };
    budget(1);
    const first = await read.transcribe(id, image.dataUrl);
    row.transcript = first.t?.text ?? `[${first.res.status} ${first.res.code}]`;
    Object.assign(row, { confidence: first.t?.confidence, needsConfirmation: first.t?.needsConfirmation, fallback: first.t?.fallbackAttempted, latencyMs: first.t?.latencyMs });
    expect(id, `provider transcript has the ${written.length} written lines, in order, as written`, first.res.status === 200 && sameLines(first.t?.text, written),
      `read ${JSON.stringify(first.t?.text ?? null)} (${first.res.status} ${first.res.code}); written ${JSON.stringify(written.join('\n'))}`);
    if (!(first.res.status === 200 && first.t?.text)) { row.pass = false; cases.push(row); return; }
    let attempt = await submitAsClient({ http, jar, read, caseId: id, question, mode: 'ink', image: image.dataUrl, reading: first.t, tryNo: 1 });
    let r = attempt.graded?.data;
    if (wrongFinal) {
      expect(id, 'first try: incorrect, not resolved, and nothing about the working is disclosed while the question is open',
        attempt.stage === 'graded' && attempt.graded.status === 200 && r.correct === false && r.resolved === false && r.stepReport === null && r.partial === null && !('solution' in r),
        JSON.stringify(attempt.stage === 'graded' ? { status: attempt.graded.status, code: attempt.graded.code, correct: r?.correct, resolved: r?.resolved, invalid: r?.invalid, stepReport: !!r?.stepReport } : { stage: attempt.stage, status: attempt.recognised?.res.status, code: attempt.recognised?.res.code }));
      if (attempt.stage === 'graded' && r?.resolved === false) {
        attempt = await submitAsClient({ http, jar, read, caseId: id, question, mode: 'ink', image: image.dataUrl, reading: first.t, tryNo: 2 });
        r = attempt.graded?.data;
      }
      expect(id, 'the final answer is marked incorrect on resolution, and never earns full marks',
        attempt.stage === 'graded' && attempt.graded.status === 200 && r.correct === false && r.resolved === true && r.marksEarned < r.marksPossible,
        JSON.stringify({ stage: attempt.stage, status: attempt.graded?.status, code: attempt.graded?.code, correct: r?.correct, resolved: r?.resolved, marksEarned: r?.marksEarned }));
      // Recorded, not judged.
      observations.push(`case 4 method marks, as the server paid them (the issued question said supportsSteps: ${question.supportsSteps}): marksEarned ${r?.marksEarned}/${r?.marksPossible}; partial=${JSON.stringify(r?.partial ?? null)}; feedback=${JSON.stringify(r?.feedback ?? null)}; trapWhy=${JSON.stringify(r?.trapWhy ?? null)}; stepReport=${JSON.stringify(r?.stepReport ?? null)}`);
    } else {
      expect(id, 'the server marks it correct with full marks (3 of 3)',
        attempt.stage === 'graded' && attempt.graded.status === 200 && r.correct === true && r.resolved === true && r.marksEarned === 3 && r.marksPossible === 3,
        JSON.stringify(attempt.stage === 'graded' ? { status: attempt.graded.status, code: attempt.graded.code, correct: r?.correct, invalid: r?.invalid, marksEarned: r?.marksEarned, feedback: r?.feedback } : { stage: attempt.stage, status: attempt.recognised?.res.status, code: attempt.recognised?.res.code }));
      expect(id, 'the server can check working for this item (the issued question says supportsSteps: true)', question.supportsSteps === true, `supportsSteps: ${question.supportsSteps}`);
      const report = r?.stepReport;
      const judged = Array.isArray(report?.lines) ? report.lines : [];
      expect(id, `the step report covers the ${written.length} lines sent and finds no broken line`,
        judged.length === written.length && judged.every(line => line?.status !== 'break'),
        JSON.stringify(report ?? null));
      observations.push(`case 3 step report: ${JSON.stringify(report ?? null)}`);
    }
    expect(id, 'the receipt the server issued carries the same lines in the same order as the reading shown',
      attempt.recognised?.t?.text ? sameLines(attempt.recognised.t.text, written) : false, `receipt reading ${JSON.stringify(attempt.recognised?.t?.text ?? null)}`);
    row.verdict = verdictOf(r); row.marks = marks(r);
    if (attempt.confirmed) row.confirmed = attempt.confirmed.reason;
    const mine = await gradedEvents(http, jar, question.id);
    expect(id, 'the attempt is persisted exactly once and matches the reply', mine.length === 1 && mine[0].id === r?.attemptId && mine[0].payload.marksEarned === r?.marksEarned && mine[0].payload.correct === r?.correct,
      JSON.stringify(mine.map(e => e.payload)));
    row.persisted = `${mine.length} event(s)`;
    row.pass = checks.filter(c => c.id === id).every(c => c.ok);
    cases.push(row);
  }
  await workingCase({ id: 'case 3', label: '3 working, correct', question: q3, image: art['case3-working'], written: workingLines(q3), wrongFinal: false });
  await workingCase({ id: 'case 4', label: '4 working, wrong final line', question: q4, image: art['case4-working-wrong-final'], written: workingLines(q4, q4.n - 1), wrongFinal: true });

  // ══ Case 5 · a photo of the working ═══════════════════════════════════════
  {
    const id = 'case 5';
    const written = workingLines(q5);
    const row = { case: '5 photo of working (JPEG, paper, 3° turn, EXIF 6)', question: describe(q5), written: written.join(' ⏎ ') };
    const camera = await studio.cameraJpeg({ strokes: art['case5-working-for-photo'].strokes, seed: SEED + 5 });
    const cameraFile = 'data:image/jpeg;base64,' + withExifOrientation(bytesOf(camera.dataUrl), 6).toString('base64');
    save('case5-photo-camera-file-exif6.jpg', cameraFile);
    const prepared = await studio.preparePhoto(cameraFile);
    if (prepared) save('case5-photo-as-sent.jpg', prepared.dataUrl);
    expect(id, 'the app\'s photo preparation honours the EXIF orientation (a sideways file is sent upright, as a JPEG)',
      !!prepared && prepared.width > prepared.height && prepared.scaledFrom.width === camera.storedHeight && /^data:image\/jpeg;base64,/.test(prepared.dataUrl),
      JSON.stringify(prepared ? { width: prepared.width, height: prepared.height, scaledFrom: prepared.scaledFrom } : null));
    if (prepared) {
      budget(1);
      const first = await read.transcribe(id, prepared.dataUrl);
      row.transcript = first.t?.text ?? `[${first.res.status} ${first.res.code}]`;
      Object.assign(row, { confidence: first.t?.confidence, needsConfirmation: first.t?.needsConfirmation, fallback: first.t?.fallbackAttempted, latencyMs: first.t?.latencyMs });
      expect(id, `provider transcript of the photo has the ${written.length} written lines, in order, as written`, first.res.status === 200 && sameLines(first.t?.text, written),
        `read ${JSON.stringify(first.t?.text ?? null)} (${first.res.status} ${first.res.code}); written ${JSON.stringify(written.join('\n'))}`);
      if (first.res.status === 200 && first.t?.text) {
        const attempt = await submitAsClient({ http, jar, read, caseId: id, question: q5, mode: 'photo', image: prepared.dataUrl, reading: first.t, tryNo: 1, photo: true });
        const r = attempt.graded?.data;
        row.verdict = verdictOf(r); row.marks = marks(r);
        if (attempt.confirmed) row.confirmed = attempt.confirmed.reason;
        expect(id, 'the server marks the photographed working correct with full marks (3 of 3)',
          attempt.stage === 'graded' && attempt.graded.status === 200 && r.correct === true && r.resolved === true && r.marksEarned === 3,
          JSON.stringify(attempt.stage === 'graded' ? { status: attempt.graded.status, code: attempt.graded.code, correct: r?.correct, invalid: r?.invalid, marksEarned: r?.marksEarned, feedback: r?.feedback } : { stage: attempt.stage, status: attempt.recognised?.res.status, code: attempt.recognised?.res.code }));
        const mine = await gradedEvents(http, jar, q5.id);
        expect(id, 'the attempt is persisted exactly once with input mode photo', mine.length === 1 && mine[0].payload.inputMode === 'photo' && mine[0].id === r?.attemptId, JSON.stringify(mine.map(e => e.payload)));
        row.persisted = `${mine.length} event(s)`;
      }
      // Recorded, not judged: the camera file as a client that did NOT
      // re-encode it would send it — pixels sideways, orientation only in EXIF.
      budget(1);
      const raw = await read.transcribe('case 5b raw EXIF file', cameraFile);
      observations.push(`case 5b (information only): the un-normalised camera file (pixels sideways, EXIF Orientation 6) sent straight to /v1/handwriting/transcribe → ${raw.res.status} ${raw.res.code || ''} transcript ${JSON.stringify(raw.t?.text ?? null)} confidence ${raw.t?.confidence ?? '—'} needsConfirmation ${raw.t?.needsConfirmation ?? '—'}; matches the written lines: ${raw.t?.text ? sameLines(raw.t.text, written) : false}`);
    }
    row.pass = checks.filter(c => c.id === id).every(c => c.ok);
    cases.push(row);
  }

  // ══ Case 6 · failure honesty ══════════════════════════════════════════════
  // A reading counts as honest when it is an explicit error, an empty reading,
  // or a reading the server itself flags as needing confirmation — and in every
  // case nothing may be marked on the reader's word.
  async function unreadable({ id, label, question, image, mode = 'ink' }) {
    const row = { case: label, question: '—', written: '(no answer written)' };
    const before = (await gradedEvents(http, jar)).length;
    budget(2);
    const first = await read.transcribe(id, image);
    const t = first.t;
    row.transcript = first.res.status === 200 ? JSON.stringify(t?.text ?? '') : `[${first.res.status} ${first.res.code}]`;
    Object.assign(row, { confidence: t?.confidence, needsConfirmation: t?.needsConfirmation, fallback: t?.fallbackAttempted, latencyMs: t?.latencyMs });
    const explicit = first.res.status >= 400 && !!first.res.code;
    const empty = first.res.status === 200 && !(t?.lines?.length);
    const doubted = first.res.status === 200 && t?.needsConfirmation === true;
    row.verdict = explicit ? `error ${first.res.code}` : empty ? 'empty reading' : doubted ? 'reading in doubt' : 'CONFIDENT READING';
    expect(id, 'the reader does not return a confident reading (explicit error, empty reading, or flagged for confirmation)', explicit || empty || doubted,
      JSON.stringify({ status: first.res.status, text: t?.text, confidence: t?.confidence, needsConfirmation: t?.needsConfirmation }));
    expect(id, 'the reply carries no mark and no verdict', !('correct' in (first.res.data || {})) && !('marksEarned' in (first.res.data || {})), JSON.stringify(Object.keys(first.res.data || {})));
    const recognised = await read.recognize(id, question.id, mode, image);
    let marked;
    if (recognised.res.status === 201 && recognised.receipt) {
      // A receipt was issued. It must be unusable for marking unless a student
      // vouches for it: submit it as it stands.
      expect(id, 'a receipt issued for this picture is flagged as needing confirmation', recognised.t?.needsConfirmation === true, JSON.stringify(recognised.t));
      marked = await http(`/v1/practice/${question.id}/submit`, { method: 'POST', jar, body: { submissionId: `accept-unread-${randomBytes(5).toString('hex')}`, answer: recognised.t.text, mode, transcriptionReceipt: recognised.receipt } });
      row.marks = `receipt issued (needsConfirmation ${recognised.t?.needsConfirmation}); submit → ${marked.status} ${marked.code || ''}`;
    } else {
      expect(id, 'no reading receipt is issued (explicit error)', recognised.res.status >= 400 && !!recognised.res.code, `${recognised.res.status} ${recognised.res.code}`);
      marked = await http(`/v1/practice/${question.id}/submit`, { method: 'POST', jar, body: { submissionId: `accept-unread-${randomBytes(5).toString('hex')}`, answer: '0', mode } });
      row.marks = `no receipt (${recognised.res.status} ${recognised.res.code}); submit → ${marked.status} ${marked.code || ''}`;
    }
    expect(id, 'marking on that reading is refused: no verdict, no mark', marked.status === 422 && !('correct' in (marked.data || {})), JSON.stringify({ status: marked.status, code: marked.code, correct: marked.data?.correct }));
    expect(id, 'no attempt was persisted', (await gradedEvents(http, jar)).length === before && (await gradedEvents(http, jar, question.id)).length === 0, 'an attempt event appeared');
    row.persisted = '0 events';
    row.pass = checks.filter(c => c.id === id).every(c => c.ok);
    cases.push(row);
  }
  const white = await studio.blank(900, 420);
  save('case6a-all-white.png', white);
  await unreadable({ id: 'case 6a', label: '6a all-white image', question: qWhite, image: white });
  const scribble = await studio.ink(writeScribble({ seed: SEED + 6 }).strokes);
  save('case6b-scribble.png', scribble.dataUrl);
  await unreadable({ id: 'case 6b', label: '6b scribble', question: qScribble, image: scribble.dataUrl });

  // 6c · corrupted / truncated pictures
  {
    const id = 'case 6c';
    const before = (await gradedEvents(http, jar)).length;
    const whole = bytesOf(art['case3-working'].dataUrl);
    const truncated = 'data:image/png;base64,' + whole.subarray(0, Math.floor(whole.length * 0.35)).toString('base64');
    const garbage = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), randomBytes(6000)]).toString('base64');
    writeFileSync(join(OUT, 'SIMULATED-handwriting-case6c-truncated.png'), bytesOf(truncated));
    const notImage = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: 'data:text/plain;base64,' + Buffer.from('24').toString('base64') } });
    expect(id, 'a body that is not an image is refused before any reading (400 HANDWRITING_IMAGE_INVALID)', notImage.status === 400 && notImage.code === 'HANDWRITING_IMAGE_INVALID', `${notImage.status} ${notImage.code}`);
    budget(3);
    for (const [name, image] of [['truncated PNG (35% of the file)', truncated], ['PNG signature followed by random bytes', garbage]]) {
      const got = await read.transcribe(`${id} ${name}`, image);
      const t = got.t;
      const explicit = got.res.status >= 400 && !!got.res.code;
      const honest = explicit || (got.res.status === 200 && (!(t?.lines?.length) || t?.needsConfirmation === true));
      expect(id, `${name}: the reader does not return a confident reading`, honest, JSON.stringify({ status: got.res.status, text: t?.text, confidence: t?.confidence, needsConfirmation: t?.needsConfirmation }));
      expect(id, `${name}: the reply carries no mark and no verdict`, !('correct' in (got.res.data || {})), '');
      cases.push({ case: `6c ${name}`, question: '—', written: '(corrupt file)', transcript: got.res.status === 200 ? JSON.stringify(t?.text ?? '') : `[${got.res.status} ${got.res.code}]`,
        verdict: explicit ? `error ${got.res.code}` : honest ? 'empty / in doubt' : 'CONFIDENT READING', marks: '—', confidence: t?.confidence, needsConfirmation: t?.needsConfirmation, fallback: t?.fallbackAttempted, latencyMs: t?.latencyMs,
        persisted: '0 events', pass: honest });
    }
    const recognised = await read.recognize(`${id} random bytes`, qGarbage.id, 'ink', garbage);
    expect(id, 'random bytes get no usable reading receipt', recognised.res.status >= 400 || recognised.t?.needsConfirmation === true, `${recognised.res.status} ${JSON.stringify(recognised.t)}`);
    expect(id, 'no attempt was persisted by any corrupt picture', (await gradedEvents(http, jar)).length === before, 'an attempt event appeared');
  }

  // 6d · no session
  {
    const id = 'case 6d';
    const before = (await gradedEvents(http, jar)).length;
    const anonymous = [
      ['transcribe', await http('/v1/handwriting/transcribe', { method: 'POST', body: { image: art['case2-right-answer'].dataUrl } })],
      ['recognize', await http(`/v1/practice/${qGarbage.id}/recognize`, { method: 'POST', body: { mode: 'ink', image: art['case2-right-answer'].dataUrl } })],
      ['submit', await http(`/v1/practice/${qGarbage.id}/submit`, { method: 'POST', body: { submissionId: `accept-anon-${randomBytes(5).toString('hex')}`, answer: String(qGarbage.n), mode: 'typed' } })],
      ['issue', await http('/v1/practice/issue', { method: 'POST', body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } })],
      ['progress read', await http('/v1/sync/pull/0')]
    ];
    for (const [name, res] of anonymous) {
      expect(id, `${name} without a session is refused with 401 and carries no reading, mark or question`,
        res.status === 401 && !res.data?.transcription && !('correct' in (res.data || {})) && !res.data?.question && !res.data?.events, `${res.status} ${res.code}`);
    }
    expect(id, 'no attempt was persisted by an unauthenticated request', (await gradedEvents(http, jar)).length === before, 'an attempt event appeared');
    cases.push({ case: '6d unauthenticated', question: '—', written: '(valid picture, no session)', transcript: anonymous.map(([n, r]) => `${n} ${r.status}`).join(', '), verdict: `error ${anonymous[0][1].code}`, marks: '—', persisted: '0 events', pass: checks.filter(c => c.id === id).every(c => c.ok) });
  }

  // 6e · provider timeout (second server, the smallest reading budget the adapter accepts)
  if (SLOW_BASE && SLOW_DB) {
    const id = 'case 6e';
    const slowHttp = makeHttp(SLOW_BASE);
    const slow = await enrol(slowHttp, SLOW_DB, 'timeout', null);
    const slowRead = reader(slowHttp, slow.jar, 'timeout');
    const issuedSlow = await slowHttp('/v1/practice/issue', { method: 'POST', jar: slow.jar, body: { generator: GENERATOR, difficulty: DIFFICULTY, curriculum: 'in' } });
    const sq = issuedSlow.data?.question;
    budget(4);
    const got = await slowRead.transcribe(id, art['case3-working'].dataUrl);
    const timedOut = got.res.status === 504 && got.res.code === 'HANDWRITING_TIMEOUT';
    const row = { case: '6e provider timeout (budget 2000 ms)', question: '—', written: '(case 3 working)', transcript: got.res.status === 200 ? JSON.stringify(got.t?.text) : `[${got.res.status} ${got.res.code}]`,
      verdict: timedOut ? 'error HANDWRITING_TIMEOUT' : got.res.status === 200 ? 'provider answered inside the budget' : `error ${got.res.code}`, marks: '—',
      confidence: got.t?.confidence, needsConfirmation: got.t?.needsConfirmation, fallback: got.t?.fallbackAttempted, latencyMs: got.t?.latencyMs ?? got.res.ms };
    if (got.res.status === 200) {
      unverified.push({ id, what: `the provider answered inside the 2000 ms minimum budget (${got.t?.latencyMs} ms${got.t?.escalated ? ', by the fallback model after the primary timed out' : ''}), so a timeout error from /v1/handwriting/transcribe was not observed on this run` });
      row.pass = null;
    } else {
      expect(id, 'a provider timeout is an explicit, retryable reading error (504 HANDWRITING_TIMEOUT)', timedOut && got.res.data?.error?.retryable === true, `${got.res.status} ${got.res.code}`);
      expect(id, 'the timeout reply carries no reading, mark or verdict', !got.res.data?.transcription && !('correct' in (got.res.data || {})), '');
    }
    if (sq?.id) {
      const recognised = await slowRead.recognize(id, sq.id, 'ink', art['case3-working'].dataUrl);
      if (recognised.res.status === 201) {
        if (row.pass !== null) unverified.push({ id, what: 'the receipt route answered inside the 2000 ms budget on this run, so its timeout path was not observed' });
      } else {
        expect(id, 'the receipt route also fails explicitly on a timeout and issues no receipt', recognised.res.status === 504 && recognised.res.code === 'HANDWRITING_TIMEOUT' && !recognised.receipt, `${recognised.res.status} ${recognised.res.code}`);
        const marked = await slowHttp(`/v1/practice/${sq.id}/submit`, { method: 'POST', jar: slow.jar, body: { submissionId: `accept-timeout-${randomBytes(5).toString('hex')}`, answer: '0', mode: 'ink' } });
        expect(id, 'nothing can be marked without a reading: 422, no verdict', marked.status === 422 && !('correct' in (marked.data || {})), `${marked.status} ${marked.code}`);
        row.marks = `no receipt (${recognised.res.status} ${recognised.res.code}); submit → ${marked.status} ${marked.code}`;
      }
      expect(id, 'no attempt was persisted on the timeout server', (await gradedEvents(slowHttp, slow.jar)).length === 0, 'an attempt event appeared');
      row.persisted = '0 events';
    }
    if (row.pass !== null) row.pass = checks.filter(c => c.id === id).every(c => c.ok);
    cases.push(row);
  } else {
    unverified.push({ id: 'case 6e', what: 'no timeout server was provided, so the provider-timeout drill did not run' });
  }

  // ── Answer-blindness of what this script sent ──────────────────────────────
  expect('blind', 'every /v1/handwriting/transcribe body this run sent was exactly { image } — no question, answer, marks or profile',
    providerCalls.filter(c => c.route === 'transcribe').length > 0, 'no transcribe call was made');
  observations.push('answer-blindness: every transcribe body was { image } (asserted before each send); every recognize body was { mode, image } — the question id is in the URL so the receipt can be bound to it, and server/platform/practice.js passes only the image to the reader. The pictures were drawn from stroke coordinates alone. What the server sends on to the provider is proved on the wire, without a network, by server/test/provider-answer-blind-check.mjs — this run cannot observe the outbound provider request.');
} catch (error) {
  fatal = error;
} finally {
  await studio.close().catch(() => {});
}

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (value, n) => String(value ?? '—').padEnd(n).slice(0, Math.max(n, 0));
const flag = row => row.pass === null ? 'NOT VERIFIED' : row.pass ? 'PASS' : 'FAIL';
console.log('');
console.log('══ Pri Learning · flagship handwriting acceptance ══════════════════════════════════════════════');
console.log('EVIDENCE CLASS: real provider · real localhost HTTP server · SIMULATED handwriting images');
console.log('                not staging · not a physical device · not a student\'s writing');
console.log('');
console.log(`${pad('case', 44)} ${pad('result', 12)} ${pad('verdict', 26)} ${pad('marks', 7)} ${pad('conf', 6)} ${pad('needsConf', 9)} ${pad('fallback', 8)} ${pad('latency', 8)} transcript (real provider)`);
console.log('─'.repeat(170));
for (const row of cases) {
  console.log(`${pad(row.case, 44)} ${pad(flag(row), 12)} ${pad(row.verdict, 26)} ${pad(String(row.marks ?? '—').length <= 7 ? row.marks : '—', 7)} ${pad(row.confidence, 6)} ${pad(row.needsConfirmation, 9)} ${pad(row.fallback, 8)} ${pad(row.latencyMs !== undefined && row.latencyMs !== null ? row.latencyMs + 'ms' : '—', 8)} ${short(row.transcript, 70)}`);
}
console.log('');
console.log('── per case detail');
for (const row of cases) {
  console.log(`• ${row.case}  [${flag(row)}]`);
  if (row.question && row.question !== '—') console.log(`    question   ${row.question}`);
  console.log(`    written    ${row.written}`);
  console.log(`    transcript ${String(row.transcript ?? '—').replace(/\n/g, ' ⏎ ')}`);
  if (row.verdict) console.log(`    verdict    ${row.verdict}   marks ${row.marks ?? '—'}`);
  if (row.solution) console.log(`    solution   ${row.solution}`);
  if (row.confirmed) console.log(`    confirmed  ${row.confirmed}`);
  if (row.persisted) console.log(`    persisted  ${row.persisted}`);
}
console.log('');
console.log('── every request that reached the reader');
console.log(`${pad('case', 46)} ${pad('server', 8)} ${pad('route', 17)} ${pad('http', 5)} ${pad('conf', 6)} ${pad('needsConf', 9)} ${pad('provFlag', 8)} ${pad('fallback', 8)} ${pad('escalated', 9)} ${pad('server ms', 9)} ${pad('client ms', 9)} text / error`);
for (const c of providerCalls) {
  console.log(`${pad(c.case, 46)} ${pad(c.server, 8)} ${pad(c.route, 17)} ${pad(c.status, 5)} ${pad(c.confidence, 6)} ${pad(c.needsConfirmation, 9)} ${pad(c.providerNeedsConfirmation, 8)} ${pad(c.fallbackAttempted ?? 'n/r', 8)} ${pad(c.escalated ?? 'n/r', 9)} ${pad(c.latencyMs ?? 'n/r', 9)} ${pad(c.clientMs, 9)} ${c.status < 300 ? short(c.text, 60) : c.code}`);
}
console.log(`reader requests: ${providerCalls.length}; provider model calls (upper bound, counting a reported fallback as a second call): ${spent()}; budget ${PROVIDER_CALL_BUDGET}`);
console.log('n/r = the route does not report it (/v1/practice/:id/recognize returns no latency, engine or fallback fields)');
console.log('');
console.log('── recorded, not judged');
for (const line of observations) console.log(`• ${line}`);
const failed = checks.filter(c => !c.ok);
console.log('');
console.log(`── expectations: ${checks.length - failed.length}/${checks.length} met`);
for (const c of failed) console.log(`✗ [${c.id}] ${c.name}\n      ${c.detail}`);
if (unverified.length) {
  console.log('');
  console.log('── NOT VERIFIED');
  for (const u of unverified) console.log(`? [${u.id}] ${u.what}`);
}
if (fatal) console.log(`\n✗ the run stopped early: ${fatal?.message || fatal}`);
console.log(`\nSIMULATED handwriting images and report.json: ${OUT}`);
writeFileSync(join(OUT, 'report.json'), JSON.stringify({
  evidenceClass: 'real provider, real localhost HTTP server, simulated handwriting images; not staging, not physical device',
  generatedAt: new Date().toISOString(), cases, providerCalls, checks, unverified, observations, fatal: fatal ? String(fatal.message || fatal) : null
}, null, 2));
process.exit(fatal || failed.length ? 1 : unverified.length ? 3 : 0);
