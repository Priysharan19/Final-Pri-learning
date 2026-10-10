// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · recognition cost measurement
//
// EVIDENCE CLASS: real provider, real localhost HTTP server, SIMULATED
// handwriting (tools/acceptance/simulated-ink.mjs, drawn by the app's own
// rasterisers in Chromium). Not staging. Not a device. Not a student. A dozen
// pictures: a measurement of what one call costs in tokens, not a benchmark of
// reading accuracy and not a forecast of real handwriting.
//
// What it records, per picture, from the server's own counters (GET
// /v1/metrics on loopback — numbers only): provider HTTP calls, the model id
// the provider reported it ran, input / output / reasoning tokens, whether the
// fallback model ran, latency. And it demonstrates over real HTTP that
// /handwriting/transcribe followed by /practice/:id/recognize on the same
// picture is ONE provider call.
//
// This script never holds the provider credential. Run it through
// launch-recognition-cost.mjs, whose local spend ceiling (25) is the hard cap;
// this script also stops itself before it could exceed it.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeLines, withExifOrientation } from './simulated-ink.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const BASE = process.env.PRI_ACCEPT_BASE;
const DB = process.env.PRI_ACCEPT_DB;
const OUT = process.env.PRI_ACCEPT_OUT;
const CAP = Number(process.env.PRI_ACCEPT_CALL_CAP) || 25;
if (!BASE || !DB || !OUT) {
  console.log('DEPENDENCY MISSING: run this through tools/acceptance/launch-recognition-cost.mjs.');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

async function http(path, { method = 'GET', body, jar = null } = {}) {
  const send = { Accept: 'application/json' };
  if (jar) {
    const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookies) send.Cookie = cookies;
    if (!['GET', 'HEAD'].includes(method) && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
  }
  if (body !== undefined) send['Content-Type'] = 'application/json';
  const started = Date.now();
  const response = await fetch(BASE + path, { method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
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
}

// ── The picture factory: the app's own rasterisers, in Chromium ──────────────
const requireClient = createRequire(join(REPO, 'client', 'package.json'));
const requireServer = createRequire(join(REPO, 'server', 'package.json'));
async function openStudio() {
  const { chromium } = requireClient('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ORIGIN = 'http://pri-acceptance.invalid';
  const modules = {
    '/ink/cloudRaster.js': join(REPO, 'client', 'src', 'ink', 'cloudRaster.js'),
    '/ink/photoRaster.js': join(REPO, 'client', 'src', 'ink', 'photoRaster.js')
  };
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>simulated ink</title>' });
    const file = modules[url.pathname];
    return file ? route.fulfill({ contentType: 'text/javascript', body: readFileSync(file, 'utf8') }) : route.fulfill({ status: 404, body: '' });
  });
  await page.goto(ORIGIN + '/');
  return {
    close: () => browser.close(),
    ink: strokes => page.evaluate(async s => {
      const { rasterizeInk } = await import('/ink/cloudRaster.js');
      const out = rasterizeInk(s);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height } : null;
    }, strokes),
    blank: (width, height) => page.evaluate(({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png');
    }, { width, height }),
    /** A paper-coloured, slightly turned "camera" page stored sideways; the caller adds EXIF Orientation 6. */
    cameraJpeg: ({ strokes, degrees = 3 }) => page.evaluate(({ strokes, degrees }) => {
      const W = 1500, H = 1100;
      const upright = document.createElement('canvas');
      upright.width = W; upright.height = H;
      const ctx = upright.getContext('2d');
      ctx.fillStyle = '#efe6cf';
      ctx.fillRect(0, 0, W, H);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const stroke of strokes) for (const p of stroke) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
      const scale = Math.min((W * 0.7) / (maxX - minX), (H * 0.66) / (maxY - minY));
      ctx.translate(W / 2, H / 2);
      ctx.rotate(degrees * Math.PI / 180);
      ctx.strokeStyle = 'rgba(120,150,190,0.5)';
      ctx.lineWidth = 1.4;
      for (let y = -H; y < H; y += 74) { ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = '#1c2a66';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, 2.6 * scale);
      const px = x => (x - (minX + maxX) / 2) * scale, py = y => (y - (minY + maxY) / 2) * scale;
      for (const stroke of strokes) {
        ctx.beginPath();
        ctx.moveTo(px(stroke[0].x), py(stroke[0].y));
        for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(px(stroke[i].x), py(stroke[i].y));
        ctx.stroke();
      }
      const stored = document.createElement('canvas');
      stored.width = H; stored.height = W;
      const sctx = stored.getContext('2d');
      sctx.translate(0, W);
      sctx.rotate(-Math.PI / 2);
      sctx.drawImage(upright, 0, 0);
      return stored.toDataURL('image/jpeg', 0.9);
    }, { strokes, degrees }),
    preparePhoto: dataUrl => page.evaluate(async d => {
      const { preparePhoto } = await import('/ink/photoRaster.js');
      const out = await preparePhoto(d);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height } : null;
    }, dataUrl)
  };
}
const bytesOf = dataUrl => Buffer.from(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1), 'base64');
const save = (name, dataUrl) => writeFileSync(join(OUT, `SIMULATED-handwriting-${name}`), bytesOf(dataUrl));

// ── The server's own counters ────────────────────────────────────────────────
async function counters() {
  const res = await http('/v1/metrics');
  if (res.status !== 200) throw new Error(`metrics: ${res.status}`);
  const out = { calls: {}, tokens: {}, paid: 0 };
  for (const [key, value] of Object.entries(res.data?.counters || {})) {
    const labels = key.includes('{') ? Object.fromEntries(key.slice(key.indexOf('{') + 1, -1).split(',').map(p => p.split('='))) : {};
    if (labels.provider !== 'handwriting') continue;
    if (key.startsWith('provider_http_calls_total')) out.calls[labels.model] = value.total;
    if (key.startsWith('provider_tokens_total')) (out.tokens[labels.model] ||= {})[labels.kind] = value.total;
  }
  return out;
}
function delta(after, before) {
  const rows = [];
  for (const model of Object.keys(after.calls)) {
    const calls = after.calls[model] - (before.calls[model] || 0);
    if (!calls) continue;
    const kind = name => (after.tokens[model]?.[name] ?? 0) - (before.tokens[model]?.[name] ?? 0);
    rows.push({ model, calls, input: kind('input'), inputImage: after.tokens[model]?.input_image === undefined ? null : kind('input_image'), output: kind('output'), reasoning: kind('reasoning') });
  }
  return rows;
}

const rows = [];
let providerCalls = 0;
async function measured(label, kind, send) {
  if (providerCalls + 2 > CAP) { rows.push({ label, kind, skipped: 'call budget' }); return null; }
  const before = await counters();
  const res = await send();
  const used = delta(await counters(), before);
  const calls = used.reduce((n, r) => n + r.calls, 0);
  providerCalls += calls;
  const t = res.data?.transcription || {};
  rows.push({
    label, kind, status: res.status, code: res.code, reused: res.data?.reused ?? null, httpMs: res.ms,
    providerCalls: calls, perModel: used, fallbackRan: used.length > 1 || t.fallbackAttempted === true,
    readLatencyMs: Number.isFinite(t.latencyMs) ? t.latencyMs : null,
    lines: Array.isArray(t.lines) ? t.lines.length : null, needsConfirmation: t.needsConfirmation ?? null,
    confidence: t.confidence ?? null, engine: t.engine ?? null
  });
  return res;
}

const Database = requireServer('better-sqlite3');
const { decryptDeliveryToken } = await import(pathToFileURL(join(REPO, 'server', 'platform', 'deliveryCrypto.js')).href);

let exit = 0;
const studio = await openStudio();
try {
  // ── An adult test account, made through the product's own routes ───────────
  const jar = {};
  const register = await http('/v1/account/register', { method: 'POST', jar, body: {
    name: 'Cost Measurement', email: `cost.${randomBytes(4).toString('hex')}@example.test`,
    password: `Cm-${randomBytes(12).toString('base64url')}`, deviceId: 'cost-measurement', isAdult: true } });
  if (register.status !== 201) throw new Error(`register: ${register.status} ${register.code}`);
  const accountId = register.data.account.id;
  const outbox = new Database(DB, { readonly: true, fileMustExist: true });
  const row = outbox.prepare("SELECT token_id, token_ciphertext FROM auth_delivery_outbox WHERE account_id=? AND kind='verify-email' AND delivered_at IS NULL ORDER BY created_at DESC").get(accountId);
  outbox.close();
  const verify = await http('/v1/account/email/verify', { method: 'POST', body: { token: decryptDeliveryToken(row.token_ciphertext, `${accountId}:verify-email:${row.token_id}`) } });
  if (verify.status !== 200) throw new Error(`verify: ${verify.status} ${verify.code}`);
  const status = await http('/v1/handwriting/status', { jar });
  console.log(`reader status: ${status.data?.state}  configured model ${status.data?.model}  fallback ${status.data?.fallbackModel}  confidence floor ${status.data?.confidenceFloor}  timeout ${status.data?.timeoutMs} ms`);

  // ── Pictures ───────────────────────────────────────────────────────────────
  let seed = 20261010;
  const ink = async (name, lines) => {
    const { strokes } = writeLines(lines, { seed: seed += 101 });
    const image = await studio.ink(strokes);
    save(`${name}.png`, image.dataUrl);
    return { ...image, strokes, bytes: bytesOf(image.dataUrl).length };
  };
  const working = ['-122 = 16 - 6(n-1)', '-138 = -6(n-1)', '23 = n-1', 'n = 24'];
  const pictures = {
    digit: await ink('digit-7', ['7']),
    number: await ink('number-24', ['24']),
    equation: await ink('equation', ['n = 24']),
    digits: await ink('digits', ['0123456789']),
    working: await ink('working-4-lines', working),
    working2: await ink('working-3-lines', ['3(n+2) = 21', 'n+2 = 7', 'n = 5']),
    working6: await ink('working-6-lines', ['2(n-3) + 4 = 18', '2(n-3) = 14', 'n-3 = 7', 'n = 10', '2(10-3) + 4', '= 18'])
  };
  const camera = await studio.cameraJpeg({ strokes: pictures.working.strokes });
  const exif = 'data:image/jpeg;base64,' + withExifOrientation(bytesOf(camera), 6).toString('base64');
  const photo = await studio.preparePhoto(exif);
  save('photo-page.jpg', photo.dataUrl);
  pictures.photo = { ...photo, bytes: bytesOf(photo.dataUrl).length };
  const camera2 = await studio.cameraJpeg({ strokes: pictures.working6.strokes, degrees: -2 });
  const photo2 = await studio.preparePhoto('data:image/jpeg;base64,' + withExifOrientation(bytesOf(camera2), 6).toString('base64'));
  save('photo-page-2.jpg', photo2.dataUrl);
  pictures.photo2 = { ...photo2, bytes: bytesOf(photo2.dataUrl).length };
  const blankUrl = await studio.blank(900, 420);
  save('blank.png', blankUrl);
  pictures.blank = { dataUrl: blankUrl, width: 900, height: 420, bytes: bytesOf(blankUrl).length };
  for (const [name, p] of Object.entries(pictures)) console.log(`picture ${name.padEnd(9)} ${p.width}×${p.height}  ${p.bytes} bytes`);

  const transcribe = image => http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image } });
  const issue = async () => {
    const res = await http('/v1/practice/issue', { method: 'POST', jar, body: { generator: 'c10-arithmetic-progressions', difficulty: 3, curriculum: 'in' } });
    if (res.status !== 201) throw new Error(`issue: ${res.status} ${res.code}`);
    return res.data.question.id;
  };
  const recognize = (qid, image, mode) => http(`/v1/practice/${qid}/recognize`, { method: 'POST', jar, body: { mode, image } });

  // ── Reads: each distinct picture once ──────────────────────────────────────
  for (const name of ['digit', 'number', 'equation', 'digits', 'working', 'working2', 'working6']) {
    const res = await measured(name, 'ink read', () => transcribe(pictures[name].dataUrl));
    if (rows.at(-1)) { rows.at(-1).width = pictures[name].width; rows.at(-1).height = pictures[name].height; rows.at(-1).imageBytes = pictures[name].bytes; }
    if (res && res.status !== 200) exit = 1;
  }
  for (const name of ['photo', 'photo2']) {
    await measured(name, 'photo read', () => transcribe(pictures[name].dataUrl));
    Object.assign(rows.at(-1), { width: pictures[name].width, height: pictures[name].height, imageBytes: pictures[name].bytes });
  }
  await measured('blank', 'blank page', () => transcribe(pictures.blank.dataUrl));
  Object.assign(rows.at(-1), { width: 900, height: 420, imageBytes: pictures.blank.bytes });

  // ── The invariant, with the real provider: display + receipt = one call ────
  const proofs = [];
  for (const [name, mode] of [['working', 'ink'], ['photo', 'photo'], ['digit', 'ink']]) {
    const qid = await issue();
    const res = await measured(`${name} → recognize`, 'receipt for a picture already read', () => recognize(qid, pictures[name].dataUrl, mode));
    proofs.push({ name, status: res?.status, reused: res?.data?.reused, receipt: !!res?.data?.receipt, providerCalls: rows.at(-1).providerCalls });
  }
  await measured('working (again)', 'same picture re-sent', () => transcribe(pictures.working.dataUrl));
  await measured('blank (again)', 'same blank picture re-sent', () => transcribe(pictures.blank.dataUrl));
  // A genuine edit: one more line of working is a new picture and a new read.
  const edited = await ink('working-edited', [...working, '= 24']);
  await measured('working (edited)', 'ink read after an edit', () => transcribe(edited.dataUrl));
  Object.assign(rows.at(-1), { width: edited.width, height: edited.height, imageBytes: edited.bytes });

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('\nper request (tokens are the provider\'s own `usage`, summed by the server per model):');
  for (const r of rows) {
    if (r.skipped) { console.log(`  ${r.label.padEnd(22)} SKIPPED (${r.skipped})`); continue; }
    const models = r.perModel.map(m => `${m.model}: in ${m.input}${m.inputImage === null ? '' : ` (image ${m.inputImage})`} out ${m.output} reasoning ${m.reasoning}`).join(' | ') || '—';
    console.log(`  ${r.label.padEnd(22)} ${String(r.status).padEnd(4)} calls ${r.providerCalls}  reused ${String(r.reused).padEnd(5)} fallback ${String(r.fallbackRan).padEnd(5)} read ${String(r.readLatencyMs ?? '—').padStart(6)} ms  http ${String(r.httpMs).padStart(6)} ms  lines ${r.lines ?? '—'}  ${models}`);
  }
  const perCall = rows.flatMap(r => (r.perModel || []).map(m => ({ ...m, label: r.label, kind: r.kind })));
  const paidReads = rows.filter(r => r.providerCalls > 0);
  const stat = values => values.length ? { n: values.length, mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length), min: Math.min(...values), max: Math.max(...values) } : { n: 0 };
  const summary = {
    evidenceClass: 'real provider on a localhost server with SIMULATED handwriting; nothing deployed',
    providerCallsTotal: providerCalls, cap: CAP,
    paidReads: paidReads.length,
    readsWhereFallbackRan: paidReads.filter(r => r.fallbackRan).length,
    modelsReported: [...new Set(perCall.map(c => c.model))],
    perCallInputTokens: stat(perCall.map(c => c.input)),
    perCallOutputTokens: stat(perCall.map(c => c.output)),
    perCallReasoningTokens: stat(perCall.map(c => c.reasoning)),
    perReadLatencyMs: stat(paidReads.map(r => r.readLatencyMs).filter(Number.isFinite)),
    imageTokensReportedSeparately: perCall.some(c => c.inputImage !== null),
    transcribeThenRecognize: proofs
  };
  console.log('\nsummary: ' + JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'recognition-cost-report.json'), JSON.stringify({ rows, summary }, null, 2));
  const proven = proofs.every(p => p.status === 201 && p.reused === true && p.receipt && p.providerCalls === 0);
  console.log(`\ntranscribe → recognize on the same picture, real provider: ${proven ? 'ONE provider call (the receipt cost none)' : 'NOT DEMONSTRATED — see rows above'}`);
  if (!proven) exit = 1;
  console.log(`provider calls made by this run: ${providerCalls} (cap ${CAP})`);
} catch (error) {
  console.log(`measurement failed: ${error?.message || 'unknown error'}`);
  exit = 1;
} finally {
  await studio.close();
}
process.exit(exit);
