// Pri Learning · board mock papers ("Pri mock in board format", D22).
//
// Deterministic, no network. Proves:
//   1. a mock is built only on the CBSE Class X Standard and Class XII
//      reference blueprints, whose structure matches CBSE's published 2025-26
//      sample question papers (5 sections, 38 questions, 80 marks, 180
//      minutes, the internal choices) and which cite those papers; it is
//      always labelled "Pri mock in board format", never an official paper;
//   2. it is TYPED on the device: the exam room offers no writing surface on a
//      mock whatever the exam-handwriting flag says (the server refuses one
//      too: server/test/board-mock-check.mjs);
//   3. the Exams page offers it only where a mock exists, and every surface
//      that names it says what it is not (an official CBSE paper, CBSE's
//      marking scheme, a predictor), in English and Hindi.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD_MOCK_BLUEPRINTS, MOCK_LABEL, boardMockOf, mockTitleOf } from '../src/engine/boardMock.js';
import { indiaExamPaperSpec } from '../src/engine/indiaExams.js';

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const read = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };

// ── 1. Blueprints and labels ─────────────────────────────────────────────────
eq(MOCK_LABEL, 'Pri mock in board format', 'the label');
eq(BOARD_MOCK_BLUEPRINTS.map(m => [m.track, m.grade, m.variant]), [['cbse', 10, 'standard'], ['cbse', 12, 'standard']], 'mocks are built on CBSE X Standard and XII only');
for (const sel of [{ track: 'cbse', grade: 10, variant: 'basic' }, { track: 'cbse', grade: 11 }, { track: 'jee-main', grade: 12 }, { track: 'jee-advanced', grade: 12 }, { track: 'cbse', grade: 9 }, null, {}]) {
  ok(boardMockOf(sel) === null && mockTitleOf(sel) === null, `no mock on ${JSON.stringify(sel)}`);
}
const CHOICE = { 10: { B: 2, C: 2, D: 2, E: 3 }, 12: { B: 2, C: 3, D: 2, E: 2 } };
for (const m of BOARD_MOCK_BLUEPRINTS) {
  const spec = indiaExamPaperSpec({ track: m.track, grade: m.grade, variant: m.variant });
  ok(spec && spec.track === 'cbse', `${m.id}: the blueprint exists`);
  eq([spec.durationMinutes, spec.totalMarks, spec.sections.reduce((n, s) => n + s.questions, 0)], [180, 80, 38], `${m.id}: 180 minutes, 80 marks, 38 questions`);
  eq(spec.sections.map(s => [s.id, s.questions, s.marksEach, s.marks]), [['A', 20, 1, 20], ['B', 5, 2, 10], ['C', 6, 3, 18], ['D', 4, 5, 20], ['E', 3, 4, 12]], `${m.id}: the sample paper's sections`);
  eq(Object.fromEntries(spec.sections.filter(s => s.internalChoice).map(s => [s.id, s.internalChoice])), CHOICE[m.grade], `${m.id}: the sample paper's internal choices`);
  const sqp = (spec.sources || []).filter(s => s.kind === 'sample-paper');
  ok(sqp.length === 1 && /^https:\/\/cbseacademic\.nic\.in\/web_material\/SQP\//.test(sqp[0].url), `${m.id}: cites CBSE's published sample question paper`);
  ok(spec.authenticity === 'reference-pattern', `${m.id}: a reference pattern, not an official paper`);
  const title = mockTitleOf(m);
  ok(title.startsWith(MOCK_LABEL) && !/official|board paper|cbse paper/i.test(title), `${m.id}: titled "${title}"`);
}

// ── 2. Typed on the device ───────────────────────────────────────────────────
const room = read('pages/ExamRoom.jsx');
ok(/const inkAllowed = featureEnabled\('examHandwriting'\) && exam\?\.mock !== true;/.test(room), 'the exam room offers no writing surface on a mock, whatever the flag');
ok(/data-exam-mock-label/.test(room) && /mock\.notOfficial/.test(room) && /mock\.resultNote/.test(room), 'the exam room labels a mock while it is sat and on its result');
const backend = read('local/indiaExamBackend.js');
ok(/if \(mock && !boardMockOf\(\{ track, grade, variant \}\)\) throw error/.test(backend), 'the device refuses a mock where none is set');
ok(/\.\.\.\(mock \? \{ mock: true \} : \{\}\) \}/.test(backend), 'the device asks the server for a mock, which decides the title');
ok(/await assertExamAllowed\(profile\);\s*const created = await createIndiaExam\(profile, body \|\| \{\}\);\s*await recordExamSimulation\(profile\);/.test(backend),
  'D19: a mock goes through the same free-paper pre-check as any timed paper (no allowance of its own)');

// ── 3. Where it is offered, and what is said ────────────────────────────────
const exams = read('pages/Exams.jsx');
ok(/boardMockOf\(\{ track, grade: user\.year, variant: 'standard' \}\)/.test(exams) && /start\(\{ mock: true \}\)/.test(exams), 'the Exams page offers a mock only where one is set');
ok(/onRetry=\{start\}/.test(exams) && /options\?\.mock === undefined && refusal !== null && lastStart\.current/.test(exams), 'a retry after signing in starts the same kind of paper');
for (const [lang, cat] of [['en', en], ['hi', hi]]) {
  for (const k of ['mock.intro', 'mock.start', 'mock.notOfficial', 'mock.typed', 'mock.resultNote']) ok(typeof cat[k] === 'string' && cat[k].length > 3, `${k} exists in ${lang}`);
}
ok(/not one set by CBSE/.test(en['mock.intro']) && /type every answer/i.test(en['mock.intro']), 'the offer says it is Pri\'s own paper and typed');
ok(/not an official CBSE paper/.test(en['mock.notOfficial']), 'the label says it is not an official CBSE paper');
ok(/not CBSE’s marking scheme/.test(en['mock.resultNote']) && /does not predict a board result/.test(en['mock.resultNote']), 'the result says it is not CBSE\'s scheme and predicts nothing');
ok(!/step|method mark/i.test(en['mock.resultNote']), 'and claims no step marking (method marks stay off in production, D12)');
ok(!Object.entries(en).some(([k, v]) => k.startsWith('mock.') && /\b(official paper|guarantee|percentile|predicts? your|accurate|certified)\b/i.test(String(v)) && !/not an official/.test(String(v))),
  'no mock copy claims officialness, accuracy or a prediction (D24)');

console.log(`BOARD MOCK: PASS — ${count}/${count} checks — built only on the CBSE X Standard / XII sample-paper blueprints, labelled "${MOCK_LABEL}", typed on the device, offered only where set, and honest in both languages.`);
