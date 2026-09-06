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
import { cloudReadingEnabled, readWithCloud, shouldSupersede, toReading } from '../src/ink/cloudReader.js';

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

// ── 4 · Off unless the student turned it on ──────────────────────────────────
const there = () => true;
ok(cloudReadingEnabled({ cloudHandwriting: undefined }, { available: there }) === false, 'off for a profile that predates the setting');
ok(cloudReadingEnabled({ cloudHandwriting: false }, { available: there }) === false, 'off when declined');
ok(cloudReadingEnabled({}, { available: there }) === false, 'off by default');
ok(cloudReadingEnabled(null, { available: there }) === false, 'off with no profile at all');
ok(cloudReadingEnabled({ cloudHandwriting: true }, { available: () => false }) === false, 'and off where the deployment has nowhere to send it');

let called = 0;
const transport = { transcribeHandwriting: async () => { called += 1; return { transcription: { lines: [{ text: 'x = 4', confidence: 0.9 }], text: 'x = 4', confidence: 0.9, needsConfirmation: false, engine: 'cloud-test' } }; } };
const rasterize = () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, bytes: 3 });

await readWithCloud(STROKES, { user: { cloudHandwriting: false }, transport, rasterize, available: there });
eq(called, 0, 'with the setting off, nothing is sent');

// ── 5 · Turning it on sends the ink, and only the ink ────────────────────────
let sentArgs = null;
const spy = { transcribeHandwriting: async (image, opts) => { sentArgs = { image, opts }; return { transcription: { lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.94 }], text: '-1, 0, 1, 2, 4', confidence: 0.94, needsConfirmation: false, engine: 'cloud-test' } }; } };
const outcome = await readWithCloud(STROKES, { user: { cloudHandwriting: true, id: 'p1', name: 'Asha' }, transport: spy, rasterize, available: there });
ok(sentArgs !== null, 'with the setting on, the ink is sent');
ok(typeof sentArgs.image === 'string' && sentArgs.image.startsWith('data:image/'), 'what is sent is an image');
eq(Object.keys(sentArgs.opts || {}), ['signal'], 'and nothing else travels beside it but the cancel signal');
eq(outcome.transcription.text, '-1, 0, 1, 2, 4', 'the transcription comes back with the comma the local reader has no class for');

const failing = { transcribeHandwriting: async () => { const e = new Error('nope'); e.code = 'HANDWRITING_UNAVAILABLE'; throw e; } };
const failed = await readWithCloud(STROKES, { user: { cloudHandwriting: true }, transport: failing, rasterize, available: there });
ok(failed?.error?.code === 'HANDWRITING_UNAVAILABLE', 'a refusal is reported, not thrown at the student mid-question');

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
const confident = { text: '-1, 0, 1, 2, 4', needsConfirmation: false };
ok(shouldSupersede(confident, local), 'a confident, different reading supersedes');
ok(!shouldSupersede(confident, local, { hasManualCorrections: true }),
  'but never one the student has corrected by hand');
ok(!shouldSupersede({ text: 'x', needsConfirmation: true }, local), 'an unconfident reading is never applied');
ok(!shouldSupersede({ text: '-1/0/1/2)4', needsConfirmation: false }, local),
  'a reading identical to the local one does not redraw the screen');
ok(!shouldSupersede({ text: '   ', needsConfirmation: false }, local), 'an empty reading never supersedes');
ok(!shouldSupersede(null, local), 'no reading, no change');

console.log(failures.length
  ? `CLOUD HANDWRITING CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CLOUD HANDWRITING CLIENT: PASS — ${pass}/${pass} checks — off by default, ink only, never over a hand correction, never on an unconfident read.`);
process.exit(failures.length ? 1 : 0);
