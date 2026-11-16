// Plan F5 · the exports' file layer and the desk attempt export (version 2).
//   node client/test/export-file-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonical, canonicalJson, safeFileName, GRADING_LINE, UNMARKED_LINE } from '../src/lib/exportFile.js';
import { composeDeskExport, DESK_EXPORT_VERSION } from '../src/desk/deskExport.js';
import { readDeskExport } from '../src/engine/deskImport.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

check('keys are written in sorted order, recursively; arrays keep their order', () => {
  assert.equal(JSON.stringify(canonical({ b: 1, a: { d: [3, 1], c: 2 } })), '{"a":{"c":2,"d":[3,1]},"b":1}');
});
check('two exports of the same data are byte-identical whatever the key order', () => {
  assert.equal(canonicalJson({ x: 1, y: { b: 1, a: 2 } }), canonicalJson({ y: { a: 2, b: 1 }, x: 1 }));
  assert.ok(canonicalJson({ a: 1 }).endsWith('\n'));
});
check('file names are safe on every platform', () => {
  for (const bad of ['../../etc/passwd', 'a/b\\c:d*e?"<>|', 'नाम', '  ', '', null, '..', 'x'.repeat(500)]) {
    const n = safeFileName(bad);
    assert.match(n, /^[A-Za-z0-9._-]{1,84}\.json$/, `${bad}`);
    assert.ok(!n.includes('..') && !n.startsWith('.') && !n.startsWith('-'), n);
  }
  assert.equal(safeFileName('desk-2027 paper', 'json'), 'desk-2027-paper.json');
});

const attempt = { state: 'finished', resource: { id: 'paper-one', title: 'Paper One' }, paper: { questionCount: 3, readingMinutes: 5, workingMinutes: 60, title: 'Paper One' } };
const questions = { 1: { done: true, flagged: false, note: 'check the domain', ms: 90000 }, 3: { done: false, flagged: true, note: '', ms: 0 } };
const clock = { elapsedWorkingMs: 3000000, elapsedReadingMs: 300000, pausedMs: 0, overtimeMs: 0 };
const doc = composeDeskExport({ attempt, clock, questions, groups: [{ label: 'Q', start: 1, end: 3 }] });

check('version 2 carries the grading line, the notice and the app as source', () => {
  assert.equal(doc.exportVersion, DESK_EXPORT_VERSION);
  assert.equal(doc.source, 'app');
  assert.equal(doc.grading, GRADING_LINE);
  assert.match(doc.grading, /not a result/);
  assert.equal(doc.notice, UNMARKED_LINE);
});
check('the export has exactly the allowed keys: nothing that could hold a mark', () => {
  assert.deepEqual(Object.keys(doc).sort(), ['edition', 'exportVersion', 'grading', 'notice', 'paper', 'questions', 'resource', 'source', 'state', 'tallies', 'time']);
  assert.deepEqual(Object.keys(doc.questions['1']).sort(), ['done', 'flagged', 'ms', 'note']);
  const flat = JSON.stringify(doc);
  assert.ok(!/"(score|mark|marks|grade|band|result|correct|answer|solution)"/i.test(flat));
});
check('only questions with something recorded are listed; tallies add up', () => {
  assert.deepEqual(Object.keys(doc.questions), ['1', '3']);
  assert.deepEqual(doc.tallies, { done: 1, flagged: 1, notes: 1 });
});
check('the same attempt exports byte-identically twice', () => {
  assert.equal(canonicalJson(doc), canonicalJson(composeDeskExport({ attempt, clock, questions, groups: [{ label: 'Q', start: 1, end: 3 }] })));
});
check('the import refuses a version 2 file, whichever paper it names', () => {
  const r = readDeskExport(JSON.parse(canonicalJson(doc)), { id: 'paper-one', type: 'paper', title: 'Paper One', questionCount: 3 });
  assert.equal(r.refused, 'DESK_IMPORT_VERSION');
  assert.match(r.detail, /made by this app/);
});
check('the fixture version 1 still reads', () => {
  const v1 = JSON.parse(readFileSync(new URL('./fixtures/prithagoras-desk-export-v1.synthetic.json', import.meta.url), 'utf8'));
  assert.equal(readDeskExport(v1, { id: v1.resource.id, type: 'paper', title: 'x', questionCount: v1.exam.questions }).ok, true);
});
check('the flag is wired and pending', () => {
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /'EXAM_DESK', 'EXPORTS'/);
  assert.match(readFileSync(new URL('../src/platform/features.js', import.meta.url), 'utf8'), /exports: typeof __PRI_FEATURE_EXPORTS__/);
  assert.match(readFileSync(new URL('../src/components/ExportActions.jsx', import.meta.url), 'utf8'), /featureEnabled\('exports'\)/);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`FAIL ${failures.length}`); process.exit(1); }
console.log(`export-file-check: ${pass} passed`);
