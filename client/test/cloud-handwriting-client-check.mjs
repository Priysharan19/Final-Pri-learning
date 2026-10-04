// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what leaves the device when server reading is on
//
// The server contract is checked next door. This is the client half, and its
// job is the promise made to the student:
//
//   · nothing is sent unless they turned the setting on, and it is off by
//     default and off for every profile that predates it;
//   · what is sent is a picture drawn from their own strokes — never a
//     screenshot, never the question, never the expected answer;
//   · a server read never overwrites a glyph they corrected by hand;
//   · an unconfident server read is offered, not applied.
//
// The canvas is a recording stub, so this runs in bare Node with no browser.
// ─────────────────────────────────────────────────────────────────────────────
import { inkBounds, rasterScale, paintInk, rasterizeInk, MAX_IMAGE_BYTES } from '../src/ink/cloudRaster.js';
import { cloudAllowanceExhausted, clearCloudAllowanceExhausted, inkReadingBlockedKey } from '../src/ink/cloudReader.js';
import { readFileSync } from 'node:fs';
import { plausibleLineMatch, segmentInkLines } from '../src/ink/inkLines.js';
import { retryDelayMs, RETRY_CAP_MS } from '../src/ink/cloudReader.js';
import { announceEntitlementChange } from '../src/platform/cloudSession.js';
import { UNAVAILABLE_READINESS_TTL_MS, cloudHandwritingReadiness, cloudReadingEnabled, handwritingDiagnostics, readWithCloud, recordLocalHandwritingDiagnostics, shouldSupersede, toReading } from '../src/ink/cloudReader.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

/** A canvas that records what was drawn instead of drawing it. */
function recordingCanvas(bytes = 1000) {
  const ops = [];
  return {
    canvas: {
      width: 0, height: 0,
      getContext: () => ({
        ops,
        set fillStyle(v) { ops.push(['fillStyle', v]); },
        set strokeStyle(v) { ops.push(['strokeStyle', v]); },
        set lineWidth(v) { ops.push(['lineWidth', v]); },
        get lineWidth() { return 2; },
        set lineCap(v) { ops.push(['lineCap', v]); },
        set lineJoin(v) { ops.push(['lineJoin', v]); },
        fillRect: (...a) => ops.push(['fillRect', ...a]),
        beginPath: () => ops.push(['beginPath']),
        moveTo: (...a) => ops.push(['moveTo', ...a]),
        lineTo: (...a) => ops.push(['lineTo', ...a]),
        arc: (...a) => ops.push(['arc', ...a]),
        fill: () => ops.push(['fill']),
        stroke: () => ops.push(['stroke'])
      }),
      toDataURL: () => 'data:image/png;base64,' + 'A'.repeat(Math.ceil((bytes * 4) / 3))
    },
    ops
  };
}

const STROKES = [
  { points: [{ x: 10, y: 10 }, { x: 40, y: 12 }, { x: 70, y: 11 }] },
  { points: [{ x: 12, y: 60 }, { x: 44, y: 63 }] },
  { points: [{ x: 90, y: 62 }] }               // a dot: a decimal point
];

// ── 1 · Bounds and framing ───────────────────────────────────────────────────
const bounds = inkBounds(STROKES);
eq([bounds.minX, bounds.minY, bounds.maxX, bounds.maxY], [10, 10, 90, 63], 'the frame is the tight box around the ink');
eq(bounds.points, 6, 'every point is counted');
ok(inkBounds([]) === null, 'nothing written means nothing to send');
ok(inkBounds([{ points: [{ x: NaN, y: 3 }] }]) === null, 'unusable coordinates are not a page');
ok(rasterScale(bounds) > 0, 'a scale is chosen');

// ── 2 · Only the ink is drawn ────────────────────────────────────────────────
const { canvas, ops } = recordingCanvas();
paintInk(canvas.getContext('2d'), STROKES, bounds, 1);
const colours = ops.filter(o => o[0] === 'fillStyle' || o[0] === 'strokeStyle').map(o => o[1]);
ok(colours.includes('#ffffff') && colours.includes('#000000'), 'it is drawn black on white');
eq(ops.filter(o => o[0] === 'fillRect').length, 1, 'the page is filled once, as a blank ground');
eq(ops.filter(o => o[0] === 'stroke').length, 2, 'each multi-point stroke is drawn once');
eq(ops.filter(o => o[0] === 'arc').length, 1, 'a single-point stroke is drawn as a dot, not dropped');
ok(!ops.some(o => o[0] === 'drawImage' || o[0] === 'fillText' || o[0] === 'strokeText'),
  'no image and no text is ever composited in — this is not a screenshot');

// ── 3 · The picture fits the transport ───────────────────────────────────────
const small = rasterizeInk(STROKES, { createCanvas: () => recordingCanvas(5_000).canvas });
ok(small && small.bytes <= MAX_IMAGE_BYTES, `a normal page fits the budget (${small?.bytes} bytes)`);
ok(small.dataUrl.startsWith('data:image/png;base64,'), 'and it is a PNG data URL');

let attempts = 0;
const shrinking = rasterizeInk(STROKES, {
  createCanvas: () => { attempts += 1; return recordingCanvas(attempts < 3 ? 2_000_000 : 300_000).canvas; }
});
ok(attempts >= 2, 'an oversized page is redrawn smaller rather than refused');
ok(shrinking && shrinking.bytes <= MAX_IMAGE_BYTES, 'until it fits');
ok(rasterizeInk([], { createCanvas: () => recordingCanvas().canvas }) === null, 'a blank page produces nothing to send');
// At the smallest scale and still over budget, the old code returned the image
// anyway — five times the transport's 1 MB body cap — which threw and reached
// the student as "couldn't reach the reader" for a page that was never sent.
ok(rasterizeInk(STROKES, { createCanvas: () => recordingCanvas(4_000_000).canvas }) === null,
  'a page that cannot be drawn under the budget is refused rather than sent unsendably');

// ── 4 · Off unless the student turned it on ──────────────────────────────────
const there = () => true;
const READY_SHA = '2222222222222222222222222222222222222222';
const ready = async () => ({ usable: true, available: true, state: 'ready', releaseSha: READY_SHA });
ok(cloudReadingEnabled({ cloudHandwriting: undefined }, { available: there }) === false, 'off for a profile that predates the setting');
ok(cloudReadingEnabled({ cloudHandwriting: false }, { available: there }) === false, 'off when declined');
ok(cloudReadingEnabled({}, { available: there }) === false, 'off by default');
ok(cloudReadingEnabled(null, { available: there }) === false, 'off with no profile at all');
ok(cloudReadingEnabled({ cloudHandwriting: true }, { available: () => false }) === false, 'and off where the deployment has nowhere to send it');
ok(cloudReadingEnabled({ cloudHandwriting: true }, { available: there, readiness: { usable: false } }) === false,
  'and off when generic cloud transport exists but handwriting itself is not usable');

let statusCalls = 0;
const statusTransport = {
  handwritingStatus: async () => {
    statusCalls += 1;
    return {
      available: true, configured: true, usable: true, degraded: false, state: 'ready',
      model: 'test-primary', fallbackModel: 'test-fallback',
      confidenceFloor: 0.82, timeoutMs: 20000, lastLatencyMs: 9,
      lastFailureCode: null, releaseSha: READY_SHA
    };
  }
};
const statusReady = await cloudHandwritingReadiness({
  user: { cloudHandwriting: true }, transport: statusTransport, available: there, cache: false
});
ok(statusReady.usable === true && statusReady.state === 'ready' && statusReady.releaseSha === READY_SHA,
  'the client checks handwriting-specific readiness, not only generic cloud transport');
eq(statusCalls, 1, 'readiness makes one bounded status request');

let unavailableTranscribes = 0;
const unavailableOutcome = await readWithCloud(STROKES, {
  user: { cloudHandwriting: true }, rasterize: () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, bytes: 3 }), available: there,
  transport: { transcribeHandwriting: async () => { unavailableTranscribes += 1; } },
  readiness: async () => ({ usable: false, state: 'unavailable', lastFailureCode: 'HANDWRITING_NOT_CONFIGURED', releaseSha: READY_SHA })
});
eq(unavailableOutcome.reason, 'unavailable', 'a deployment with generic cloud but no usable handwriting stays local');
eq(unavailableTranscribes, 0, 'unavailable handwriting is rejected before ink is sent');

const offlineReady = await cloudHandwritingReadiness({
  user: { cloudHandwriting: true },
  available: there,
  cache: false,
  transport: { handwritingStatus: async () => { throw new TypeError('offline'); } }
});
ok(offlineReady.usable === false && offlineReady.lastFailureCode === 'HANDWRITING_STATUS_UNREACHABLE',
  'offline status failure is coded and fails closed');

// An "unavailable" answer must not be reused after the deployment recovers.
// Times are far in the future so no earlier cached answer can interfere.
let recoveringCalls = 0;
const recoveringTransport = {
  handwritingStatus: async () => {
    recoveringCalls += 1;
    return recoveringCalls === 1
      ? { available: false, configured: true, usable: false, degraded: true, state: 'degraded', lastFailureCode: 'HANDWRITING_PROVIDER_5XX' }
      : { available: true, configured: true, usable: true, degraded: false, state: 'ready', lastFailureCode: null, releaseSha: READY_SHA };
  }
};
const T0 = 9_000_000_000_000;
const firstOutage = await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: recoveringTransport, available: there, now: T0 });
ok(firstOutage.usable === false, 'readiness reports the outage');
await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: recoveringTransport, available: there, now: T0 + 1_000 });
eq(recoveringCalls, 1, 'a just-seen outage is briefly cached rather than re-asked on every stroke');
ok(UNAVAILABLE_READINESS_TTL_MS <= 15_000, `a non-ready answer is short-lived (${UNAVAILABLE_READINESS_TTL_MS} ms)`);
const recovered = await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: recoveringTransport, available: there, now: T0 + UNAVAILABLE_READINESS_TTL_MS + 1 });
ok(recovered.usable === true && recoveringCalls === 2, 'once the short TTL passes readiness is re-checked and recovery is seen');
await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: recoveringTransport, available: there, now: T0 + UNAVAILABLE_READINESS_TTL_MS + 30_000 });
eq(recoveringCalls, 2, 'a ready answer keeps its normal cache lifetime');
let throwingCalls = 0;
const throwingTransport = { handwritingStatus: async () => { throwingCalls += 1; throw new TypeError('offline'); } };
await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: throwingTransport, available: there, now: T0 * 2 });
await cloudHandwritingReadiness({ user: { cloudHandwriting: true }, transport: throwingTransport, available: there, now: T0 * 2 + 1 });
eq(throwingCalls, 2, 'a status request that failed outright is never cached');

recordLocalHandwritingDiagnostics({ nativeAvailable: true, engine: 'pri-foundation', releaseSha: READY_SHA });
const localDiag = handwritingDiagnostics();
ok(localDiag.localNativeAvailable === true && localDiag.selectedEngine === 'pri-foundation' && localDiag.releaseSha === READY_SHA,
  'safe diagnostics can identify local/native availability, active engine and release');
ok(!JSON.stringify(localDiag).includes('data:image') && !('strokes' in localDiag),
  'diagnostics contain no raw ink payload');

let called = 0;
const transport = { transcribeHandwriting: async () => { called += 1; return { transcription: { lines: [{ text: 'x = 4', confidence: 0.9 }], text: 'x = 4', confidence: 0.9, needsConfirmation: false, engine: 'cloud-test' } }; } };
const rasterize = () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, bytes: 3 });

const offOutcome = await readWithCloud(STROKES, { user: { cloudHandwriting: false }, transport, rasterize, available: there });
eq(called, 0, 'with the setting off, nothing is sent');
// Three different things used to come back as a bare null — switched off, a page
// that could not be drawn, and a server that read nothing — so the caller could
// only ever offer one generic message.
eq(offOutcome.reason, 'disabled', 'and the caller is told it was switched off, not that something failed');
const unrenderable = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport, rasterize: () => null, available: there, readiness: ready });
eq(unrenderable.reason, 'too-large', 'a page that could not be drawn small enough says so');
const nothingRead = await readWithCloud(STROKES, {
  user: { cloudHandwriting: true }, rasterize, available: there, readiness: ready,
  transport: { transcribeHandwriting: async () => ({ transcription: { lines: [] } }) }
});
eq(nothingRead.reason, 'empty', 'and a server that read nothing says that instead');

// ── 5 · Turning it on sends the ink, and only the ink ────────────────────────
let sentArgs = null;
const spy = { transcribeHandwriting: async (image, opts) => { sentArgs = { image, opts }; return { transcription: { lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.94 }], text: '-1, 0, 1, 2, 4', confidence: 0.94, needsConfirmation: false, engine: 'cloud-test', latencyMs: 23, fallbackAttempted: true, fallbackFailureCode: 'HANDWRITING_PROVIDER_5XX' } }; } };
const outcome = await readWithCloud(STROKES, { user: { cloudHandwriting: true, id: 'p1', name: 'Asha' }, transport: spy, rasterize, available: there, readiness: ready });
ok(sentArgs !== null, 'with the setting on, the ink is sent');
ok(typeof sentArgs.image === 'string' && sentArgs.image.startsWith('data:image/'), 'what is sent is an image');
eq(Object.keys(sentArgs.opts || {}), ['signal'], 'and nothing else travels beside it but the cancel signal');
eq(outcome.transcription.text, '-1, 0, 1, 2, 4', 'the transcription comes back with the comma the local reader has no class for');
const cloudDiag = handwritingDiagnostics();
ok(cloudDiag.cloudAvailable === true && cloudDiag.selectedEngine === 'cloud-test' && cloudDiag.lastLatencyMs === 23
  && cloudDiag.lastFailureCode === 'HANDWRITING_PROVIDER_5XX' && cloudDiag.fallbackOccurred === true && cloudDiag.releaseSha === READY_SHA,
  'safe diagnostics retain cloud engine, latency, coded fallback failure, fallback occurrence and release');

const failing = { transcribeHandwriting: async () => { const e = new Error('nope'); e.code = 'HANDWRITING_UNAVAILABLE'; throw e; } };
const failed = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport: failing, rasterize, available: there, readiness: ready });
ok(failed?.error?.code === 'HANDWRITING_UNAVAILABLE', 'a refusal is reported, not thrown at the student mid-question');

const cancelledTransport = { transcribeHandwriting: async () => { throw new DOMException('Aborted', 'AbortError'); } };
const cancelledOutcome = await readWithCloud(STROKES, {
  user: { cloudHandwriting: true }, transport: cancelledTransport, rasterize, available: there, readiness: ready
});
eq(cancelledOutcome?.error?.code, 'HANDWRITING_CANCELLED', 'client cancellation stays distinct from provider failure');

// ── 5b · The server's daily allowance (SEC-COMM-01) ──────────────────────────
{
  if (typeof globalThis.addEventListener !== 'function') {
    const target = new EventTarget();
    globalThis.addEventListener = target.addEventListener.bind(target);
    globalThis.removeEventListener = target.removeEventListener.bind(target);
    globalThis.dispatchEvent = target.dispatchEvent.bind(target);
  }
  let sent = 0;
  const resetAt = Date.now() + 2 * 60 * 60 * 1000;
  const exhausted = { transcribeHandwriting: async () => { sent += 1; const e = new Error('used up'); e.code = 'AI_ALLOWANCE_EXHAUSTED'; e.status = 429; e.resetAt = resetAt; throw e; } };
  const first = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport: exhausted, rasterize, available: there, readiness: ready });
  ok(first?.reason === 'allowance' && first.until === resetAt && !first.error, 'an exhausted allowance is a reason (the on-device reading stays), not a failure');
  const second = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport: exhausted, rasterize, available: there, readiness: ready });
  ok(second?.reason === 'allowance' && sent === 1 && cloudAllowanceExhausted(), 'no doomed request is sent again until the allowance resets');
  announceEntitlementChange({ localProfileId: 'p1', plan: 'premium', status: 'active', active: true });
  ok(!cloudAllowanceExhausted(), 'an entitlement change (an upgrade) clears it at once');
  const noReset = { transcribeHandwriting: async () => { const e = new Error('used up'); e.code = 'AI_ALLOWANCE_EXHAUSTED'; e.resetAt = Date.now() + 365 * 24 * 3600e3; throw e; } };
  const capped = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport: noReset, rasterize, available: there, readiness: ready });
  ok(capped.until - Date.now() <= 31 * 60 * 1000, 'an implausible reset time falls back to a 30-minute back-off');
  clearCloudAllowanceExhausted();
}

// ── 6 · Turning a transcription into a reading ───────────────────────────────
const local = { lines: [{ text: '-1/0/1/2)4', box: { x: 1, y: 2 } }], text: '-1/0/1/2)4' };
const aligned = toReading({ lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.94 }], confidence: 0.94, needsConfirmation: false, engine: 'cloud-test' }, local);
eq(aligned.lines[0].box, { x: 1, y: 2 }, 'line geometry is borrowed from the local reading so ticks land on the right line');
ok(aligned.alignedToLocalLines, 'and it says the lines lined up');

const mismatched = toReading({ lines: [{ text: 'a', confidence: 1 }, { text: 'b', confidence: 1 }], confidence: 1, needsConfirmation: false }, local);
ok(mismatched.lines.every(l => l.box === undefined), 'when the line counts differ the boxes are dropped, not guessed');
ok(!mismatched.alignedToLocalLines, 'and it says so');
ok(toReading({ lines: [] }, local) === null, 'an empty transcription is not a reading');

// ── 7 · When a server read may replace what is on screen ─────────────────────
const confident = { text: '-1, 0, 1, 2, 4', needsConfirmation: false, alignedToLocalLines: true };
ok(shouldSupersede(confident, local), 'a confident, different reading that lines up supersedes');
ok(!shouldSupersede(confident, local, { hasManualCorrections: true }),
  'but never one the student has corrected by hand');
// A reading that re-split the page carries no boxes and no per-glyph symbols,
// so the ✓/✗ overlay draws nothing and the tap-to-correct row is empty. Applying
// it would leave the student unable to fix a single character of a reading they
// did not produce.
ok(!shouldSupersede({ ...confident, alignedToLocalLines: false }, local),
  'a reading that split the page differently is never applied, however confident');
ok(!shouldSupersede({ text: 'x', needsConfirmation: true }, local), 'an unconfident reading is never applied');
ok(!shouldSupersede({ text: '-1/0/1/2)4', needsConfirmation: false, alignedToLocalLines: true }, local),
  'a reading identical to the local one does not redraw the screen');
ok(!shouldSupersede({ text: '   ', needsConfirmation: false, alignedToLocalLines: true }, local), 'an empty reading never supersedes');
ok(!shouldSupersede(null, local), 'no reading, no change');

// ── Server-only reading of ink (owner decision, 2026-10) ────────────────────
// "Pri Learning does not have the feature to mark handwriting or photo when
// not online, since the local engine is just not good enough." The ink surface
// must therefore never show or publish an on-device reading.
{
  const src = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  ok(!/from '\.\/recognizer\.js'/.test(src), 'the ink surface does not import the on-device recogniser');
  ok(!/nativeInk\.(recognize|foundationRecognize)\(/.test(src), 'nor call the native on-device readers');
  ok(!/recognizeWithStructuralDev|recognizeWithoutDetachedSideWork|chooseNativeConsensus/.test(src), 'nor any other local reading path');
  ok(/readWithCloud\(/.test(src), 'it reads through the answer-blind server reader');
  ok(/addEventListener\?\.\('online'/.test(src) && /onCloudSessionChange\(/.test(src),
    'and kept working is read again when the connection or the sign-in comes back');
  const there = () => true;
  eq(inkReadingBlockedKey({ cloudLinked: true }, { online: () => false, available: there }), 'ink.waitingOffline', 'offline ink says it is saved and will be read when back online');
  eq(inkReadingBlockedKey({ cloudHandwriting: null }, { online: () => true, available: there }), 'ink.waitingSignIn', 'signed out ink says sign in');
  eq(inkReadingBlockedKey({ cloudLinked: true }, { online: () => true, available: there, outcome: { error: { code: 'HANDWRITING_UNAVAILABLE' } } }), 'ink.waitingServiceDown', 'a reader that is down says so');
  eq(inkReadingBlockedKey({ cloudHandwriting: false, cloudLinked: true }, { online: () => true, available: there }), 'ink.waitingTurnedOff', 'only an explicit off points at Settings');

  // Default-on ink path, answer-blind: a signed-in profile that never chose is
  // read without visiting Settings, and the request carries the picture only.
  let args = null;
  const t2 = { transcribeHandwriting: async (...a) => { args = a; return { transcription: { lines: [{ text: '5+5+∫(0,5)2x dx', confidence: 0.95 }], text: '5+5+∫(0,5)2x dx', confidence: 0.95, needsConfirmation: false, engine: 'cloud-test' } }; } };
  const readyNow = async () => ({ usable: true, available: true, state: 'ready', releaseSha: null });
  const inkUser = { cloudHandwriting: null, cloudLinked: true, expectedAnswer: '35', solution: 'integrate 2x' };
  const got = await readWithCloud(STROKES, { user: inkUser, transport: t2, rasterize, available: there, readiness: readyNow });
  ok(got?.transcription?.text === '5+5+∫(0,5)2x dx', 'default-on ink is read by the server');
  eq(args?.length, 2, 'the ink request is the picture and options only');
  eq(Object.keys(args?.[1] || {}), ['signal'], 'whose only option is the cancel signal');
  ok(!JSON.stringify(args).includes('integrate 2x') && !JSON.stringify(args).includes('"35"'), 'and no expected answer or solution travels with it');
}

// ── Line geometry without recognition: ✓/✗ on the student's own lines ───────
{
  const st = (x, y, w = 30, h = 40) => ({ points: [{ x, y }, { x: x + w, y: y + h }] });
  const page = [st(10, 10), st(50, 14), st(90, 8), st(10, 120), st(60, 125), st(15, 230, 80, 4)];
  const segs = segmentInkLines(page);
  eq(segs.length, 3, 'three written lines are found from geometry alone');
  eq(segmentInkLines([st(10, 40, 30, 1), st(50, 10, 30, 60)]).length, 1, 'a minus sign before a digit stays on the digit\'s line');
  eq(segs.map(l => l.strokeIdxs), [[0, 1, 2], [3, 4], [5]], 'each stroke belongs to its own line, top to bottom');
  ok(segs.every(l => !('text' in l) && !('symbols' in l)), 'segmentation names no symbol — it reads nothing');
  const tr = { lines: [{ text: '2x+3=11' }, { text: '2x=8' }, { text: 'x=4' }], text: '2x+3=11\n2x=8\nx=4', confidence: 0.95, engine: 'cloud-t' };
  const placed = toReading(tr, { lines: segs });
  ok(placed.alignedToLocalLines && placed.lines.every((l, i) => l.box === segs[i].box), 'when the counts agree, server line i is drawn on ink line i');
  const unplaced = toReading({ ...tr, lines: tr.lines.slice(0, 2), text: '2x+3=11\n2x=8' }, { lines: segs });
  ok(!unplaced.alignedToLocalLines && unplaced.lines.every(l => !l.box), 'when they differ, no box is guessed — panel badges only');
  const inkSrc = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
  ok(/segmentInkLines\(strokes\)/.test(inkSrc) && /ink-linebox/.test(inkSrc) && /ink\.mistakeHere/.test(inkSrc), 'the ink surface draws line boxes and the mistake note again');
  const qc = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  ok(/inkResult\?\.afterWait/.test(qc) && /autoMarkedRef\.current === inkResult\.readKey/.test(qc), 'ink read after waiting is marked once, by its reading key');
}

// ── Review follow-ups: plausible placement, unbounded backoff, deferred mark ─
{
  const box = (w) => ({ box: { x: 0, y: 0, w, h: 40 } });
  const L = (...t) => t.map(text => ({ text }));
  ok(plausibleLineMatch(L('2x+3=11', '2x=8', 'x=4'), [box(280), box(160), box(120)]), 'widths in proportion to the reading: drawn on the ink');
  ok(!plausibleLineMatch(L('2x+3=11', 'x=4'), [box(40), box(400)]), 'a short read line on the widest ink line: panel only');
  ok(!plausibleLineMatch(L('2x+3=11', 'x=4'), [box(200)]), 'counts differ: panel only');
  ok(!plausibleLineMatch(L('', 'x=4'), [box(100), box(100)]), 'an empty read line is never placed');
  ok(plausibleLineMatch(L('x=4'), [box(500)]), 'a single line is its own line');
  eq([0, 1, 2, 3].map(retryDelayMs), [20000, 40000, 80000, 160000], 'retries back off by doubling');
  ok(retryDelayMs(4) === RETRY_CAP_MS && retryDelayMs(50) === RETRY_CAP_MS, 'and keep going at the cap rather than stopping');
  const ink = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
  ok(!/MAX_RETRIES/.test(ink) && /scheduleRetry\(seq\)/.test(ink), 'the ink surface has no retry ceiling');
  ok(/'visibilitychange'/.test(ink) && /'focus'/.test(ink), 'and retries on focus and on a return to the tab');
  ok(/plausibleLineMatch\(/.test(ink), 'and only places a reading on the ink when it plausibly matches');
  const qc = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  ok(/if \(busy \|\| inFlightRef\.current\) return;\s*autoMarkedRef\.current = inkResult\.readKey;/.test(qc) && /\}, \[inkResult, busy\]\)/.test(qc),
    'a waited-for reading that lands while the card is busy is marked when it is idle, not dropped');
}

// ── Doubtful lines, one-tap correction, and no second provider call (4.4) ───
// The server reader's per-line confidence is surfaced: a line under the floor
// is marked as doubtful and the student can say what they wrote in one tap.
// The correction is applied to the reading on screen and marked by the
// deterministic engine; the provider is NOT asked again.
{
  const { LOW_CONFIDENCE, applyLineCorrection, cleanCorrection, isLowConfidence, lowConfidenceLines } = await import('../src/ink/readingCorrection.js');
  eq(LOW_CONFIDENCE, 0.82, 'the client floor mirrors the server default confidence floor');
  const transcription = {
    engine: 'cloud-test', confidence: 0.4, needsConfirmation: true,
    lines: [{ text: '2x + 3 = 11', confidence: 0.97 }, { text: '2x = 3', confidence: 0.4 }, { text: 'x = 4', confidence: 0.9 }]
  };
  const reading = toReading(transcription, null);
  eq(lowConfidenceLines(reading), [1], 'only the line under the floor is doubtful');
  ok(reading.needsConfirmation === true, 'and the reading as a whole asks to be confirmed, so the card will not mark it silently');

  let providerCalls = 0;
  const transport = { transcribeHandwriting: async () => { providerCalls += 1; return { transcription }; } };
  clearCloudAllowanceExhausted();
  const first = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport, rasterize, available: there, readiness: ready });
  eq(providerCalls, 1, `reading the page is one provider call (${JSON.stringify(first?.reason || 'read')})`);
  const onScreen = toReading(first.transcription, null);
  ok(onScreen && onScreen.lines.length === 3, 'the reading reaches the screen');

  const corrected = applyLineCorrection(onScreen, 1, ' 2x  = 8 ');
  eq(providerCalls, 1, 'correcting a line is NOT a second provider call');
  ok(corrected !== onScreen && onScreen.lines[1].text === '2x = 3', 'the correction is a new reading; the one on screen is left alone');
  eq(corrected.lines[1], { text: '2x = 8', conf: 1, corrected: true, readText: '2x = 3' }, 'the corrected line is what the student wrote, fully confident, with the reader’s text kept beside it');
  eq(corrected.text, '2x + 3 = 11\n2x = 8\nx = 4', 'the page text follows');
  eq([corrected.needsConfirmation, lowConfidenceLines(corrected)], [false, []], 'nothing doubtful is left, so the engine may mark it');
  ok(corrected.confidence >= 0.9 && corrected.corrected === true && corrected.engine === 'cloud-test', 'confidence is the worst remaining line; the engine name is unchanged — the reading is still the server’s');
  eq(applyLineCorrection(onScreen, 1, '   '), onScreen, 'an empty correction changes nothing');
  eq(applyLineCorrection(onScreen, 7, 'x'), onScreen, 'nor one for a line that does not exist');
  eq(applyLineCorrection(corrected, 1, '2x = 8'), corrected, 'nor repeating the same correction');
  eq(cleanCorrection('a'.repeat(900)).length, 400, 'a correction is bounded like a read line');
  ok(!isLowConfidence(corrected.lines[1]) && isLowConfidence({ text: 'x', conf: 0.5 }) && !isLowConfidence({ text: 'x', conf: 0.82 }), 'doubt is strictly under the floor and never for a corrected line');

  // The surface wires it the same way: the correction handler publishes and
  // never reaches the reader.
  const inkAnswer = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
  const handler = inkAnswer.slice(inkAnswer.indexOf('const correctLine = useCallback('), inkAnswer.indexOf('}, [rec, publish]);'));
  ok(handler.length > 50 && /applyLineCorrection\(rec, index, text\)/.test(handler) && /publish\(next, strokesRef\.current\)/.test(handler), 'InkAnswer applies a correction to the reading on screen and publishes it');
  ok(!/readWithCloud|sendToReader|scheduleRead|transport/.test(handler), 'and the correction handler never calls the reader');
  ok(/needsConfirmation: r\.needsConfirmation === true/.test(inkAnswer), 'the reader’s own doubt travels with the published reading');
  const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  ok(/if \(ink\.needsConfirmation === true\) return \{ why: 'glyph', weakest \};/.test(card), 'and the card turns that doubt into the confirmation step instead of a mark');
  ok(/data-confidence=/.test(inkAnswer) && /ink-line-low/.test(inkAnswer) && /t\('ink\.iWrote'\)/.test(inkAnswer), 'doubtful lines are highlighted with a one-tap “I wrote…” control');
}

// ── Offline capture: saved, sealed, read when back online (4.3) ─────────────
{
  const en = (await import('../src/i18n/strings.en.js')).default;
  const hi = (await import('../src/i18n/strings.hi.js')).default;
  ok(en['ink.waitingOffline'].startsWith('Saved. It will be read when you are back online.'), 'offline, the student is told plainly: saved, read when back online');
  ok(hi['ink.waitingOffline'].startsWith('सहेज लिया गया। ऑनलाइन होते ही इसे पढ़ा जाएगा।'), 'in Hindi too');
  eq(inkReadingBlockedKey({ cloudLinked: true, cloudHandwriting: true }, { available: () => true, online: () => false }), 'ink.waitingOffline', 'and that is the key an offline page shows');
  const recovery = readFileSync(new URL('../src/components/practiceRecovery.js', import.meta.url), 'utf8');
  ok(/export \{ compactStrokes, saveInkDraft, readInkDraft, clearInkDraft \} from '\.\.\/local\/inkDrafts\.js';/.test(recovery), 'kept ink comes from the sealed IndexedDB store, not the localStorage draft store');
  ok(!/queueDraft\(INK|readDraft\(INK/.test(recovery), 'and no ink is written to localStorage any more');
  const idb = readFileSync(new URL('../src/local/idb.js', import.meta.url), 'utf8');
  ok(/inkDrafts: \{ owner: 'pid', clear: \['id', 'pid'\] \}/.test(idb), 'inkDrafts is a sealed store: id and pid in the clear, strokes inside the blob');
  ok(/\['inkDrafts', 'pid'\]/.test(idb), 'and is erased with its profile');
  const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  ok(/InkAnswer && restoredInk !== undefined && \(/.test(card), 'the ink surface mounts only once the kept page has been looked for');
  ok(/autoMarkedRef\.current === inkResult\.readKey/.test(card), 'a page read after waiting is marked once per reading (idempotent on the read key)');
}

console.log(failures.length
  ? `CLOUD HANDWRITING CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CLOUD HANDWRITING CLIENT: PASS — ${pass}/${pass} checks — on by default only for a signed-in account, server-only and answer-blind, never over a hand correction, never on an unconfident read.`);
process.exit(failures.length ? 1 : 0);
