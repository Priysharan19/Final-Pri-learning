// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a prithagoras-web desk export (plan F4a)
// client/src/engine/deskImport.js — the shared validator the device previews
// with and the server decides with.
//
// The fixture (fixtures/prithagoras-desk-export-v1.synthetic.json) is
// SYNTHETIC: written by hand in exactly the shape desk.js exportSession()
// produces at Priysharan19/prithagoras-web 46e1476 (exportVersion 1). It is
// not a student's file.
//
//   node client/test/desk-import-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalImport, exportResourceId, readDeskExport, MAX_EXPORT_BYTES } from '../src/engine/deskImport.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

const FILE = JSON.parse(readFileSync(new URL('./fixtures/prithagoras-desk-export-v1.synthetic.json', import.meta.url), 'utf8'));
const PAPER = { id: '2027-mathematics-advanced-assessment-1', title: '2027 HSC Mathematics Advanced — 100-Mark Practice Examination', type: 'paper', questionCount: 27 };
const copy = patch => ({ ...JSON.parse(JSON.stringify(FILE)), ...patch });
const refused = (obj, code, resource = PAPER) => assert.equal(readDeskExport(obj, resource).refused, code);
const digest = plan => createHash('sha256').update(canonicalImport(plan)).digest('hex');

check('the fixture reads', () => {
  const r = readDeskExport(FILE, PAPER);
  assert.equal(r.ok, true);
  assert.deepEqual(r.plan.tallies, { done: 4, flagged: 2, notes: 3 });
  assert.deepEqual(Object.keys(r.plan.questions), ['1', '2', '3', '5', '11', '14']);
  assert.deepEqual(r.plan.questions['3'], { done: false, flagged: true, note: 'check the domain before squaring' });
  assert.deepEqual(r.plan.questions['11'], { done: true, flagged: false, note: 'used the chain rule; compare with the published solution' });
  assert.equal(r.plan.exportedAt, Date.parse('2026-11-12T11:42:07.000Z'));
  assert.equal(r.plan.phase, 'working');
});
check('an empty note is dropped, not imported', () => assert.ok(!('12' in readDeskExport(FILE, PAPER).plan.questions)));
check('the timer never reaches the plan', () => {
  const plan = readDeskExport(copy({ session: { ...FILE.session, deadline: 1, remainingMs: 5 } }), PAPER).plan;
  const text = JSON.stringify(plan);
  for (const k of ['running', 'remainingTimeSeconds', 'remainingMs', 'deadline', 'lastUpdated', '4360']) assert.ok(!text.includes(k), k);
  assert.deepEqual(Object.keys(plan).sort(), ['exportedAt', 'phase', 'questionCount', 'questions', 'resourceId', 'tallies', 'title']);
});
check('counts are recomputed, never trusted', () => {
  assert.deepEqual(readDeskExport(copy({ counts: { done: 27, flagged: 0, unseen: 0 } }), PAPER).plan.tallies, { done: 4, flagged: 2, notes: 3 });
});
check('nothing score-shaped can pass through', () => {
  const plan = readDeskExport(copy({ score: 100, result: 'pass', marks: { 1: 3 } }), PAPER).plan;
  assert.ok(!/score|result|"marks"/.test(JSON.stringify(plan)));
});
check('exportResourceId', () => {
  assert.equal(exportResourceId(FILE), PAPER.id);
  for (const bad of [null, {}, { resource: { id: '../x' } }, { resource: { id: 'UPPER' } }, { resource: { id: 7 } }]) assert.equal(exportResourceId(bad), null);
});

// Each refusal of the spec's table.
check('not an object', () => { for (const v of [null, 'x', 7, [FILE]]) refused(v, 'DESK_IMPORT_NOT_A_DESK_FILE'); });
check('over 256 KB', () => refused(copy({ padding: 'x'.repeat(MAX_EXPORT_BYTES) }), 'DESK_IMPORT_NOT_A_DESK_FILE'));
check('another version', () => {
  refused(copy({ exportVersion: 2 }), 'DESK_IMPORT_VERSION');
  refused(copy({ exportVersion: '1' }), 'DESK_IMPORT_VERSION');
  refused({ bundleVersion: 1, exports: [FILE] }, 'DESK_IMPORT_VERSION');
});
check('unknown paper (or another edition\'s: the caller passes null)', () => {
  refused(FILE, 'DESK_IMPORT_UNKNOWN_PAPER', null);
  refused(copy({ resource: { id: 'some-other-paper' } }), 'DESK_IMPORT_UNKNOWN_PAPER');
  refused(FILE, 'DESK_IMPORT_UNKNOWN_PAPER', { ...PAPER, type: 'notes' });
});
check('paper changed', () => {
  refused(copy({ exam: { ...FILE.exam, questions: 26 } }), 'DESK_IMPORT_PAPER_CHANGED');
  refused(copy({ exam: undefined }), 'DESK_IMPORT_PAPER_CHANGED');
  refused(FILE, 'DESK_IMPORT_PAPER_CHANGED', { ...PAPER, questionCount: null });
});
check('malformed statuses', () => {
  for (const statuses of [{ 28: 'done' }, { 0: 'done' }, { '01': 'done' }, { x: 'done' }, { 1: 'unseen' }, { 1: 'correct' }, { 1: true }, ['done']]) {
    refused(copy({ statuses }), 'DESK_IMPORT_MALFORMED');
  }
});
check('malformed notes', () => {
  for (const notes of [{ 28: 'x' }, { 1: 7 }, { 1: 'x'.repeat(5001) }, { 1: 'bell\u0007' }, { 1: null }]) refused(copy({ notes }), 'DESK_IMPORT_MALFORMED');
  assert.equal(readDeskExport(copy({ statuses: {}, notes: { 1: 'tab\tand\r\nlines' } }), PAPER).ok, true, 'tabs and line breaks are kept');
});
check('empty', () => {
  refused(copy({ statuses: {}, notes: {} }), 'DESK_IMPORT_EMPTY');
  refused(copy({ statuses: {}, notes: { 2: '   ' } }), 'DESK_IMPORT_EMPTY');
  refused(copy({ statuses: undefined, notes: undefined }), 'DESK_IMPORT_EMPTY');
});
check('unknown top-level fields are ignored', () => assert.equal(readDeskExport(copy({ theme: 'dark' }), PAPER).ok, true));

// The canonical digest identifies what is brought across, and only that.
check('digest is stable under key order and the export date', () => {
  const a = readDeskExport(FILE, PAPER).plan;
  const reordered = copy({ statuses: Object.fromEntries(Object.entries(FILE.statuses).reverse()), notes: Object.fromEntries(Object.entries(FILE.notes).reverse()),
    createdAt: '2026-11-13T00:00:00.000Z', session: { phase: 'finished', running: false, remainingTimeSeconds: 0 } });
  assert.equal(digest(readDeskExport(reordered, PAPER).plan), digest(a));
});
check('digest ignores empty notes', () => {
  const without = copy({ notes: { 3: FILE.notes['3'], 11: FILE.notes['11'], 14: FILE.notes['14'] } });
  assert.equal(digest(readDeskExport(without, PAPER).plan), digest(readDeskExport(FILE, PAPER).plan));
});
check('digest changes with the content', () => {
  const more = copy({ statuses: { ...FILE.statuses, 20: 'done' } });
  assert.notEqual(digest(readDeskExport(more, PAPER).plan), digest(readDeskExport(FILE, PAPER).plan));
  const edited = copy({ notes: { ...FILE.notes, 3: 'check the range' } });
  assert.notEqual(digest(readDeskExport(edited, PAPER).plan), digest(readDeskExport(FILE, PAPER).plan));
});

if (failures.length) {
  console.error(`DESK IMPORT: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DESK IMPORT: PASS — ${pass}/${pass} checks`);
