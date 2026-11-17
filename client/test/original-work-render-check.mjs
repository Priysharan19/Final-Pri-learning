// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · OriginalWork shows the student's own page (standard #08)
//
//   node client/test/original-work-render-check.mjs
//
// Proves, over src/components/originalWorkModel.js and the component source:
//   · the page is drawn through the kept samples only — one straight segment
//     per pair of samples, nothing interpolated, smoothed or typeset;
//   · a page whose bytes do not match the digest the mark names is refused,
//     never shown as the student's work (strokes and photos alike);
//   · boxes sit on the strokes each marked line came from; a line with no
//     kept strokes gets no box (nothing is guessed);
//   · the reading layer keeps "what Pri read" apart from what the student
//     confirmed, and the component draws the ink first and the reading small,
//     after it, under its "What Pri read" label;
//   · replay plays the strokes in written order, and reduced motion offers none;
//   · every string the component uses exists in English and Hindi.
// Evidence class: synthetic strokes; no browser, no device.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ink = await import('../src/engine/originalInk.js');
const model = await import('../src/components/originalWorkModel.js');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); passed++; };
const sha = b => createHash('sha256').update(b).digest('hex');

const raw = (x0, y0, n, t0) => Array.from({ length: n }, (_, i) => ({ x: x0 + i * 2.5, y: y0 + (i % 3), t: t0 + i / 120, p: 0.5 }));
const bytes = Buffer.from(ink.encodeInk({ strokes: [{ raw: raw(10, 10, 20, 1) }, { raw: raw(10, 60, 15, 2) }, { raw: raw(10, 110, 12, 3) }],
  removed: [{ raw: raw(200, 10, 5, 1.5), removedAt: 1.8 }], width: 400, height: 160 }));
const view = { kind: 'strokes', sha256: sha(bytes), data: bytes.toString('base64'),
  lines: [{ strokes: [0] }, { strokes: [1] }, { strokes: [2] }],
  reading: { read: 'x = 9', confirmed: '9', corrected: true, edits: [{ text: '9', at: 1 }] } };

// ── The page is the kept samples ───────────────────────────────────────────────
const opened = await model.openOriginal(view);
ok(opened.ok && opened.kind === 'strokes', 'a kept page opens');
eq([opened.width, opened.height, opened.page.strokes.length, opened.page.removed.length], [400, 160, 3, 1], 'with its size, strokes and crossed-out strokes');
const d = model.strokePath(opened.page.strokes[0].points);
eq((d.match(/L/g) || []).length, 19, 'a stroke of 20 samples is 19 straight segments: nothing interpolated');
ok(!/[CQSTA]/.test(d), 'no curve commands: the ink is not smoothed or redrawn');
ok(d.startsWith('M10 10L12.5 11'), 'the path goes through the samples as kept');

// ── Digest refusal ────────────────────────────────────────────────────────────
eq(await model.openOriginal({ ...view, sha256: 'f'.repeat(64) }), { ok: false, reason: 'digest' }, 'strokes whose bytes do not match the mark\'s digest are not shown');
const photo = 'data:image/jpeg;base64,' + Buffer.from('the page').toString('base64');
ok((await model.openOriginal({ kind: 'image', data: photo, sha256: sha(Buffer.from('the page')) })).ok, 'a kept photo opens');
eq((await model.openOriginal({ kind: 'image', data: photo, sha256: 'a'.repeat(64) })).reason, 'digest', 'a photo that does not match is refused');
eq((await model.openOriginal({ kind: 'image', data: 'data:text/html;base64,PGI+', sha256: 'a'.repeat(64) })).reason, 'format', 'only an image data URL is drawn as a photo');
eq((await model.openOriginal(null)).reason, 'missing', 'no original is said, not drawn');

// ── Boxes on the lines the marking speaks about ────────────────────────────────
const boxes = model.markBoxes(opened.page, view.lines, [{ line: 0, status: 'checked', n: 1 }, { line: 2, status: 'first-error', n: 2 }, { line: 7, status: 'checked', n: 3 }]);
eq(boxes.map(b => [b.line, b.n, b.status]), [[0, 1, 'checked'], [2, 2, 'first-error']], 'one box per marked line that has kept strokes; none guessed for a line without');
const b2 = boxes[1];
ok(b2.y <= 110 && b2.y + b2.h >= 112 && b2.x <= 10, 'the box encloses that line\'s own strokes');
eq(model.markBoxes(opened.page, view.lines, [{ line: 1, status: 'made-up' }])[0].status, 'not-verified', 'an unknown status is drawn as not verified, never as checked');

// ── Reading layer ─────────────────────────────────────────────────────────────
eq(model.readingLayer(view.reading), { read: 'x = 9', confirmed: '9', corrected: true, edits: 1 }, 'what Pri read and what the student confirmed are kept apart');
eq(model.readingLayer({ read: '9', confirmed: '9' }).corrected, false, 'agreement is not a correction');

// ── A fetched record is shown only as the page the mark names ─────────────────
eq(model.fetchedPhase(view, view.sha256), 'ready', 'the record carrying the mark\'s digest is shown');
eq(model.fetchedPhase(view, 'e'.repeat(64)), 'mismatch', 'a record with another digest is refused as this mark\'s work');
eq(model.fetchedPhase(view, null), 'none', 'no digest named: not shown (a record is never trusted on its own say-so)');
eq(model.fetchedPhase(null, view.sha256), 'none', 'no record: nothing shown');
eq(model.readingLayer({ read: null, confirmed: '9', corrected: true }).corrected, false, 'a correction whose reading the server no longer holds is not shown as a reading');
const marked = readFileSync(new URL('../src/components/OriginalWork.jsx', import.meta.url), 'utf8');
ok(/export function MarkedOriginal\(\{ originalId, sha256, /.test(marked) && /fetchedPhase\(original, sha256\)/.test(marked), 'MarkedOriginal decides with fetchedPhase and has no default digest');

// ── Replay ────────────────────────────────────────────────────────────────────
const tl = model.timeline(opened.page);
ok(tl.spans[0].start < tl.spans[1].start && tl.spans[1].start < tl.spans[2].start, 'strokes replay in the order written');
eq(model.pointsUntil(opened.page.strokes[1], tl.spans[1].start).length, 1, 'a replay frame shows only the samples written by then');

// ── The component: ink first, reading small and labelled ──────────────────────
const src = readFileSync(new URL('../src/components/OriginalWork.jsx', import.meta.url), 'utf8');
const inkAt = src.indexOf('className="ow-ink"'), photoAt = src.indexOf('className="ow-photo"'), readingAt = src.indexOf('className="ow-reading"');
ok(inkAt > 0 && photoAt > 0 && readingAt > inkAt && readingAt > photoAt, 'the student\'s ink (or photo) is drawn first; the reading comes after it');
ok(/ow\.whatPriRead/.test(src), 'and the reading is labelled as what Pri read');
ok(/reducedMotion\(\)/.test(src) && /page && !reducedMotion\(\)/.test(src), 'reduced motion offers no replay');
ok(!/dangerouslySetInnerHTML/.test(src), 'nothing from the record is injected as HTML');
const css = readFileSync(new URL('../src/components/OriginalWork.css', import.meta.url), 'utf8');
ok(/\.ow-reading\s*\{[^}]*font-size:\s*12\.5px/.test(css), 'the reading is set small');
const keys = [...new Set([...src.matchAll(/'(ow\.[A-Za-z.]+)'/g)].map(m => m[1]))];
ok(keys.length >= 12, `the component's strings are named (${keys.length})`);
eq(keys.filter(k => !(k in en) || !(k in hi)), [], 'every one exists in English and Hindi');

console.log(`original-work-render-check: ${passed} checks passed`);
