// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's original ink, on the device (standard #08)
//
//   node client/test/original-ink-check.mjs
//
// Part 1 — the pri-ink-v1 format (src/engine/originalInk.js), shared with the
// server: canonical round trip, float32 fidelity, raw samples preferred over
// the canvas's smoothed display points (and CONDITIONED said out loud when
// only those exist), erased strokes kept as corrections, strict decoding,
// limits.
// Part 2 — the builder (src/ink/originalWork.js): digest over the canonical
// bytes, gzip on the wire, line → stroke links, photos named by digest.
// Part 3 — offline, then upload, through the device backend a student's tap
// uses and the real /v1 app: a submission that could not be sent is not
// marked; the retry under the same key carries the same original, and the
// server keeps it bound to the mark by the same SHA-256.
//
// Evidence class: synthetic strokes and a stand-in reader. No real student's
// handwriting, no physical device.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const ink = await import('../src/engine/originalInk.js');
const builder = await import('../src/ink/originalWork.js');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed++; };
const throwsCode = (fn, code, msg) => { let got = null; try { fn(); } catch (e) { got = e.code; } eq(got, code, msg); };

// A page as InkCanvas captures it: raw samples beside the 1€ display points.
const stroke = (x0, y0, n, t0, { raw = true } = {}) => {
  const samples = Array.from({ length: n }, (_, i) => ({ x: x0 + i * 1.13, y: y0 + Math.cos(i) * 2.7, t: t0 + i / 240, p: (i % 9) / 9, azimuth: 0.5, altitude: 1.1 }));
  const points = samples.filter((_, i) => i % 2 === 0).map(p => ({ x: p.x + 0.4, y: p.y - 0.2, w: 2, t: p.t, p: p.p }));
  return raw ? { raw: samples, points } : { points };
};

// ══ Part 1 · the format ═══════════════════════════════════════════════════════
{
  const page = { strokes: [stroke(10, 20, 40, 500.5), stroke(15, 80, 30, 501.25)], removed: [{ ...stroke(200, 20, 12, 500.9), removedAt: 501 }], width: 640, height: 300 };
  const bytes = ink.encodeInk(page);
  const back = ink.decodeInk(bytes);
  eq([back.format, back.version, back.source, back.width, back.height], ['pri-ink-v1', 1, 'web-pointer', 640, 300], 'the header says what the page is');
  eq([back.strokes.length, back.removed.length], [2, 1], 'strokes on the page and erased strokes are both kept');
  ok(page.strokes.every((s, i) => s.raw.every((p, j) => back.strokes[i].points[j].x === Math.fround(p.x) && back.strokes[i].points[j].y === Math.fround(p.y))),
    'every RAW pen sample is kept at its float32 value — not the smoothed display points');
  ok(back.strokes.every(s => s.points.length === 40 || s.points.length === 30), 'no sample is dropped (the display path drops near-duplicates; the original does not)');
  ok(back.strokes.every(s => !s.conditioned), 'raw strokes are not marked CONDITIONED');
  ok(Math.abs(back.strokes[1].points[3].t - (501.25 + 3 / 240 - 500.5)) < 1e-4, 'times are kept relative to the page\'s first sample');
  ok(Math.abs(back.strokes[0].points[5].p - 5 / 9) <= 1 / 65535, 'pressure is kept');
  ok(Math.abs(back.removed[0].removedAt - 0.5) < 1e-9, 'an erased stroke keeps when it was erased');
  ok(Buffer.from(ink.encodeDecoded(back)).equals(Buffer.from(bytes)), 'canonical: decode → encode gives the very same bytes');
  eq(sha(ink.encodeInk(page)), sha(bytes), 'and one capture gives one digest');

  const smoothedOnly = ink.decodeInk(ink.encodeInk({ strokes: [stroke(1, 1, 10, 1, { raw: false })], width: 10, height: 10 }));
  ok(smoothedOnly.strokes[0].conditioned === true, 'a stroke with only display points is flagged CONDITIONED, never passed off as raw');
  const pencil = ink.decodeInk(ink.encodeInk({ strokes: [stroke(1, 1, 10, 1, { raw: false })], width: 10, height: 10, source: 'pencilkit', rawPoints: true }));
  ok(pencil.source === 'pencilkit' && pencil.strokes[0].conditioned === false, 'PencilKit\'s own samples are kept as the native source');

  // Strict decoding: anything that is not exactly a page is refused.
  const bad = Buffer.from(bytes); bad[0] = 0x58;
  throwsCode(() => ink.decodeInk(bad), 'INK_FORMAT_INVALID', 'wrong magic is refused');
  throwsCode(() => ink.decodeInk(bytes.subarray(0, bytes.length - 3)), 'INK_FORMAT_INVALID', 'a truncated page is refused');
  throwsCode(() => ink.decodeInk(Buffer.concat([Buffer.from(bytes), Buffer.from([0])])), 'INK_FORMAT_INVALID', 'trailing bytes are refused');
  const v2 = Buffer.from(bytes); v2[4] = 2;
  throwsCode(() => ink.decodeInk(v2), 'INK_FORMAT_INVALID', 'an unknown version is refused');
  const nan = Buffer.from(bytes); nan.writeFloatLE(NaN, 20 + 13);
  throwsCode(() => ink.decodeInk(nan), 'INK_FORMAT_INVALID', 'a point that is not a number is refused');
  throwsCode(() => ink.encodeInk({ strokes: Array.from({ length: ink.INK_LIMITS.maxStrokes + 1 }, () => stroke(1, 1, 1, 1)), width: 1, height: 1 }), 'INK_TOO_LARGE', 'too many strokes is refused, never cut');
  throwsCode(() => ink.encodeInk({ strokes: [stroke(1, 1, ink.INK_LIMITS.maxPointsPerStroke + 1, 1)], width: 1, height: 1 }), 'INK_TOO_LARGE', 'a stroke with too many points is refused');
  throwsCode(() => ink.cleanLineRegions([{ strokes: [5] }], 2), 'INK_FORMAT_INVALID', 'a line naming a stroke not on the page is refused');
  eq(ink.cleanLineRegions([{ strokes: [1, 0, 1] }], 2), [{ strokes: [0, 1] }], 'line links are kept sorted and unique');
}

// ══ Part 2 · the builder ═════════════════════════════════════════════════════
{
  const strokes = [stroke(10, 20, 40, 9.5), stroke(12, 120, 30, 10.5)];
  const built = await builder.buildInkOriginal({ strokes, removed: [], page: { width: 600, height: 300 } });
  eq([built.kind, built.encoding], ['strokes', 'gzip'], 'strokes go gzip-compressed');
  const canonical = gunzipSync(Buffer.from(built.data, 'base64'));
  eq(sha(canonical), built.sha256, 'the digest is over the canonical bytes inside');
  ok(Buffer.from(ink.encodeInk({ strokes, width: 600, height: 300 })).equals(canonical), 'and those bytes are exactly the encoded page');
  eq(built.lines, [{ strokes: [0] }, { strokes: [1] }], 'each written line names its strokes, top to bottom');
  const again = await builder.buildInkOriginal({ strokes, removed: [], page: { width: 600, height: 300 } });
  eq(again.sha256, built.sha256, 'the same page twice is the same digest (a retry is the same original)');
  eq(await builder.buildInkOriginal({ strokes: [] }), null, 'an empty page has no original');
  const restored = await builder.buildInkOriginal({ strokes: [{ points: [{ x: 3, y: 4 }, { x: 5, y: 6 }] }] });
  const wire = Buffer.from(restored.data, 'base64');
  ok(ink.decodeInk(restored.encoding === 'gzip' ? gunzipSync(wire) : wire).strokes[0].conditioned === true, 'a page restored from a draft (points only) is kept and labelled CONDITIONED');
  const photo = 'data:image/png;base64,' + Buffer.from('a photographed page').toString('base64');
  const named = await builder.buildImageOriginal(photo, { samePicture: true });
  eq(named, { kind: 'image', origin: 'photo', samePicture: true, sha256: sha(Buffer.from('a photographed page')) }, 'a photo is named by its digest when the request already carries it');
  // A long page of raw samples past the limit keeps its drawn points instead
  // (flagged CONDITIONED), rather than nothing.
  const long = Array.from({ length: 4 }, (_, k) => {
    const rawS = Array.from({ length: 12000 }, (_, i) => ({ x: (i % 500) + 0.37, y: k * 60 + (i % 7), t: k * 100 + i / 240, p: 0.5 }));
    return { raw: rawS, points: rawS.filter((_, i) => i % 40 === 0) };
  });
  const big = await builder.buildInkOriginal({ strokes: long, page: { width: 600, height: 300 } });
  const bigWire = Buffer.from(big.data, 'base64');
  const bigPage = ink.decodeInk(big.encoding === 'gzip' ? gunzipSync(bigWire) : bigWire);
  ok(bigPage.strokes.length === 4 && bigPage.strokes.every(s => s.conditioned && s.points.length === 300), 'a page too long to keep raw keeps its drawn points, labelled CONDITIONED');
  eq(builder.originalState({ original: built, sent: true }).state, 'uploading', 'state: uploading while the answer is out');
  eq(builder.originalState({ reply: { original: { saved: true, sha256: built.sha256, id: 'x' } } }).state, 'saved', 'state: saved when the server says so');
  eq(builder.originalState({ reply: { original: { saved: false, reason: 'quota' } } }), { state: 'device', reason: 'quota' }, 'state: on this device when the server did not keep it');
}

// ══ Part 3 · offline, then upload ════════════════════════════════════════════
installBrowserEnv();
resetStorage();
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const online = await startOnlineAuthority({ label: 'original-ink', ink: true });
try {
  const { dispatch } = await import('../src/local/backend.js');
  const { loadAllBanks } = await import('../src/engine/generators/index.js');
  const idb = await import('../src/local/idb.js');
  await loadAllBanks();
  const POST = (path, body = {}) => dispatch('POST', path, body);
  const me = (await POST('/profiles', { name: 'Ink Student', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
  await online.link(me.id, { entitlement: 'premium' });

  // A question whose answer is a number, so '7' is an attempt (not unreadable).
  let qid = null;
  for (let i = 0; i < 40 && !qid; i++) {
    const { question } = await POST('/practice/next', { mode: 'smart', resume: false });
    const q = await online.answerKey(await idb.get('questions', question.id));
    if (q?.answerType === 'numeric' && String(q.answer?.value) !== '7') qid = question.id;
    else await POST(`/practice/${question.id}/discard`, {}).catch(() => {});
  }
  ok(!!qid, 'a numeric practice question was served');
  const strokes = [stroke(20, 30, 50, 100), stroke(22, 110, 40, 101)];
  const original = await builder.buildInkOriginal({ strokes, page: { width: 640, height: 260 } });
  const submissionId = nextSubmissionId();
  const body = { answer: '7', ms: 1200, submissionId, viaInk: true,
    ink: { strokes: strokes.map(s => ({ points: s.points.map(p => [Math.round(p.x), Math.round(p.y)]) })), recognized: 'reader stand-in', original } };
  const kept = async () => online.db.all('SELECT sha256 FROM attempt_originals');

  // Offline: the request never lands, nothing is marked, nothing is kept.
  online.setOffline(true);
  let refused = null;
  try { await POST(`/practice/${qid}/submit`, body); } catch (e) { refused = e; }
  online.setOffline(false);
  ok(refused, 'offline, the answer is not marked');
  eq((await kept()).length, 0, 'and the server holds no original');
  const row = await idb.get('questions', qid);
  ok(!row.pendingGrade || row.pendingGrade.payload?.original?.sha256 === original.sha256, 'whatever the device kept for the retry carries the same original');

  // Online again: the same key, the same original — kept with the mark.
  const res = await POST(`/practice/${qid}/submit`, body);
  const reply = res?.original || res?.result?.original || res?.server?.original || null;
  const rows = await kept();
  eq(rows.map(r => r.sha256), [original.sha256], 'back online, the server keeps the original under the digest the device computed');
  ok(!reply || reply.sha256 === original.sha256, 'and the reply names that digest');
  // The receipt the server committed for this submission (a first wrong try
  // is not yet resolved, so no graded-attempt event exists: the grade row is
  // the receipt, and it names the handwriting).
  const grade = (await online.db.all("SELECT response_json FROM idempotency_keys WHERE scope='practice-grade'")).map(r => JSON.parse(r.response_json)).find(r => r.submissionId === submissionId);
  eq([grade?.original?.saved, grade?.original?.sha256], [true, original.sha256], 'the committed receipt is bound to the same handwriting');
  ok(online.reader.calls >= 1 && !JSON.stringify(online.traffic).includes(original.data.slice(0, 40)), 'the reader was sent pictures only');

  // The server refuses an original (here: one whose digest is wrong, as a
  // device bug would send): the answer is still marked, without it.
  const fallbackQ = async seed => {
    for (let i = 0; i < 40; i++) {
      const { question } = await POST('/practice/next', { mode: 'smart', resume: false });
      const q = await online.answerKey(await idb.get('questions', question.id));
      if (q?.answerType === 'numeric' && String(q.answer?.value) !== '7') return question.id;
      await POST(`/practice/${question.id}/discard`, {}).catch(() => {});
    }
    throw new Error('no numeric question ' + seed);
  };
  {
    const q2 = await fallbackQ(2);
    const before = (await kept()).length;
    const broken = { ...original, sha256: 'f'.repeat(64) };
    const res2 = await POST(`/practice/${q2}/submit`, { ...body, submissionId: nextSubmissionId(), ink: { ...body.ink, original: broken } });
    ok(res2 && !res2.error, 'a refused original never blocks the mark: the same press goes again without it');
    eq((await kept()).length, before, 'and nothing unverified is kept');
  }
  // A server that does not take originals yet (a rollback to schema 17) refuses
  // the request by its shape: handwritten answers are still marked.
  {
    const q3 = await fallbackQ(3);
    const realFetch = globalThis.fetch;
    let refusedOnce = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (/\/v1\/practice\/[^/]+\/submit$/.test(String(url)) && String(options.body || '').includes('"original"')) {
        refusedOnce += 1;
        return new Response(JSON.stringify({ error: { code: 'PRACTICE_SUBMISSION_INVALID', message: 'A server-issued question and allowed answer fields are required.' } }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      return realFetch(url, options);
    };
    try {
      const res3 = await POST(`/practice/${q3}/submit`, { ...body, submissionId: nextSubmissionId() });
      ok(refusedOnce >= 1 && res3 && !res3.error, 'an older server that refuses the field still marks the handwritten answer, sent without it');
    } finally { globalThis.fetch = realFetch; }
  }
} finally {
  await online.close();
}

console.log(`original-ink-check: ${passed} checks passed`);
