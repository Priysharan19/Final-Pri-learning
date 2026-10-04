// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · syllabus board and Priorities suite
//
// India Progress draws every dot point coloured by its own mastery, and a
// Priorities list that is the topic queue's ranking joined to the mark
// predictor. This suite proves three things:
//
//   1. The board model (engine/syllabusBoard.js) never colours a dot point on
//      fewer than DOTPOINT_COLOUR_FLOOR answers, groups by strand in syllabus
//      order, and counts every dot point exactly once.
//   2. Priorities keep the topic queue's order — nothing here re-ranks — and
//      send the student to the weakest practisable dot point of each chapter.
//   3. Regression, driven through the real local backend on the demo history
//      (generator-keyed rating rows, as an older device holds): a chapter with
//      answers has dot points with answers, and the mark predictor's units
//      count the same answers GET /curriculum does. Before the fix the board
//      drew "Real Numbers" (13 answers) as wholly untouched and the predictor
//      called Trigonometry (47 answers) "nothing attempted yet".
//
// Usage: node client/test/syllabus-board-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`); };
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const B = await import(`${SRC}engine/syllabusBoard.js`);
const { DOTPOINT_COLOUR_FLOOR: FLOOR } = B;

// ── 1 · dot point states ─────────────────────────────────────────────────────
eq('no answers is not started', B.dotpointState({ attempts: 0, mastery: 90, band: 'mastered' }), 'unseen');
eq('one answer is too few, whatever its mastery', B.dotpointState({ attempts: 1, mastery: 95, band: 'mastered' }), 'thin');
eq('one below the floor is still too few', B.dotpointState({ attempts: FLOOR - 1, mastery: 95, band: 'mastered' }), 'thin');
eq('at the floor the backend band is used', B.dotpointState({ attempts: FLOOR, mastery: 50, band: 'developing' }), 'developing');
eq('a missing band falls back to the engine thresholds', B.dotpointState({ attempts: 10, mastery: 86 }), 'mastered');
eq('an unknown band never reads as unseen once evidenced', B.dotpointState({ attempts: 10, mastery: 0, band: 'unseen' }), 'emerging');

// ── 2 · the board ────────────────────────────────────────────────────────────
const dp = (attempts, mastery, band, extra = {}) => ({ attempts, correct: Math.floor(attempts / 2), mastery, band, ...extra });
const rows = [
  { id: 'a1', name: 'Alpha one', strand: 'Algebra', attempts: 12, mastery: 55, due: true, dotpoints: [dp(5, 40, 'emerging'), dp(0, 0, 'unseen'), dp(7, 90, 'mastered')] },
  { id: 'g1', name: 'Geo one', strand: 'Geometry', attempts: 1, mastery: 20, dotpoints: [dp(1, 20, 'emerging'), dp(0, 0, 'unseen', { generated: false })] },
  { id: 'a2', name: 'Alpha two', strand: 'Algebra', attempts: 0, mastery: 0, dotpoints: ['Plain string dot point', 'Another'] }
];
const board = B.syllabusBoard(rows);
eq('strands keep first-seen syllabus order', board.strands.map(s => s.name), ['Algebra', 'Geometry']);
eq('chapters keep their order inside a strand', board.strands[0].chapters.map(c => c.id), ['a1', 'a2']);
eq('every dot point is counted once', board.total, 7);
eq('state counts', board.counts, { unseen: 4, thin: 1, emerging: 1, developing: 0, strong: 0, mastered: 1 });
eq('seen counts any answered dot point', board.seen, 3);
eq('chapters due', board.chaptersDue, 1);
const a1 = board.strands[0].chapters[0];
eq('a chapter reports its seen dot points', a1.seen, 2);
ok('a chapter keeps its due flag', a1.due === true);
eq('string dot points become unseen rows', board.strands[0].chapters[1].dotpoints.map(d => d.state), ['unseen', 'unseen']);
eq('a dot point no form reaches is not practisable', board.strands[1].chapters[0].dotpoints.map(d => d.practisable), [true, false]);
eq('an empty scope is an empty board', B.syllabusBoard([]).total, 0);

// ── 3 · weakest dot point ────────────────────────────────────────────────────
eq('the weakest evidenced dot point beats an untouched one when it is below it',
  B.weakestDotpoint(a1.dotpoints)?.index, 1);
eq('an untouched gap beats a developing one',
  B.weakestDotpoint(B.syllabusBoard([{ id: 'x', dotpoints: [dp(6, 55, 'developing'), dp(0, 0, 'unseen')] }]).strands[0].chapters[0].dotpoints)?.index, 1);
eq('an emerging one beats an untouched gap',
  B.weakestDotpoint(B.syllabusBoard([{ id: 'x', dotpoints: [dp(6, 20, 'emerging'), dp(0, 0, 'unseen')] }]).strands[0].chapters[0].dotpoints)?.index, 0);
eq('mastered and unpractisable dot points are never the target',
  B.weakestDotpoint(B.syllabusBoard([{ id: 'x', dotpoints: [dp(9, 95, 'mastered'), dp(0, 0, 'unseen', { generated: false })] }]).strands[0].chapters[0].dotpoints), null);

// ── 4 · priorities ───────────────────────────────────────────────────────────
const queue = [
  { subtopic: 'g1', name: 'Geo one', mastery: 20, reason: 'mastery 20%', misconception: 'keeps repeating: sign slip', misconceptionLabel: 'sign slip' },
  { subtopic: 'a2', name: 'Alpha two', mastery: 0, reason: 'not attempted yet' },
  { subtopic: 'a1', name: 'Alpha one', mastery: 55, reason: 'mastery 55%', due: false },
  { subtopic: 'zz', name: 'Ahead chapter', mastery: 0, reason: 'not attempted yet' }
];
const prediction = {
  units: [{ unitId: 'alg', name: 'Algebra', marks: 20, chapters: ['a1', 'a2'] }, { unitId: 'geo', name: 'Geometry', marks: 10, chapters: ['g1'] }],
  priorities: [{ unitId: 'alg', atStake: 11.5 }, { unitId: 'geo', atStake: 6 }]
};
const prio = B.practisePriorities({ queue, prediction, rows });
eq('the queue order is kept, never re-ranked', prio.map(p => p.id), ['g1', 'a2', 'a1', 'zz']);
eq('ranks are 1-based', prio.map(p => p.rank), [1, 2, 3, 4]);
eq('tags: slip, new ground, due, new ground', prio.map(p => p.tag), ['misconception', 'new-ground', 'review-due', 'new-ground']);
eq('the bare slip label travels on its own field', prio.map(p => p.misconceptionLabel), ['sign slip', null, null, null]);
eq('the English clause is still published for older readers', prio[0].misconception, 'keeps repeating: sign slip');
eq('units join through the predictor', prio.map(p => p.unit?.id ?? null), ['geo', 'alg', 'alg', null]);
eq('marks at stake come from the predictor', prio.map(p => p.unit?.atStake ?? null), [6, 11.5, 11.5, null]);
eq('each chapter targets its weakest practisable dot point', prio.map(p => p.dotpoint?.index ?? null), [0, 0, 1, null]);
eq('a chapter outside the scope still lists by its queue name', prio[3].name, 'Ahead chapter');
eq('the limit trims the list', B.practisePriorities({ queue, prediction, rows, limit: 2 }).length, 2);
eq('no prediction is no unit, not an error', B.practisePriorities({ queue, prediction: null, rows }).map(p => p.unit), [null, null, null, null]);
eq('no queue is no priorities', B.practisePriorities({ queue: [], rows }).length, 0);

// ── 5 · regression through the real backend on legacy-keyed history ─────────
installBrowserEnv();
resetStorage();
const { dispatch } = await import(`${SRC}local/backend.js`);
const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
await dispatch('POST', '/profiles/demo', {});
const curriculum = await dispatch('GET', '/curriculum');
const stats = await dispatch('GET', '/stats');
const scope = (curriculum.years || []).find(s => Number(s.year) === 10);
ok('the demo has a Class 10 CBSE scope', !!scope?.subtopics?.length);
const chapters = scope?.subtopics || [];
const answered = chapters.filter(c => c.attempts > 0);
ok('the demo has answered chapters', answered.length >= 8, `${answered.length} answered`);
for (const c of answered) {
  const dpAnswers = (c.dotpoints || []).reduce((n, d) => n + (d.attempts || 0), 0);
  ok(`${c.id}: a chapter with answers has dot points with answers`, dpAnswers > 0, `${c.attempts} chapter answers, ${dpAnswers} on dot points`);
}
for (const c of chapters.filter(ch => ch.attempts === 0)) {
  ok(`${c.id}: an untouched chapter has untouched dot points`, (c.dotpoints || []).every(d => !d.attempts));
}
const byId = new Map(chapters.map(c => [c.id, c]));
const units = stats.examPrediction?.units || [];
ok('the demo has a predicted paper', units.length > 0);
for (const u of units) {
  const fromCurriculum = (u.chapters || []).reduce((n, id) => n + (byId.get(id)?.attempts || 0), 0);
  eq(`${u.unitId}: the predictor counts the answers Progress shows`, u.attempts, fromCurriculum);
  eq(`${u.unitId}: a unit is covered exactly when its chapters have answers`, u.covered, fromCurriculum > 0);
}
const live = B.practisePriorities({ queue: stats.priorities, prediction: stats.examPrediction, rows: chapters });
eq('live priorities follow GET /stats order', live.map(p => p.id), (stats.priorities || []).slice(0, 5).map(p => p.subtopic));
ok('live priorities each name a dot point to practise', live.every(p => p.dotpoint && Number.isInteger(p.dotpoint.index)), JSON.stringify(live.map(p => p.dotpoint)));
// ── 6 · the slip line is translated, not an English fragment (PR #300 review) ─
// The backend builds `misconception` as the English clause "keeps repeating:
// <label>" for its reason line. The surface must never print that clause in
// Hindi: it renders the bare label through `progress.prioSlip` instead.
const en = (await import(`${SRC}i18n/strings.en.js`)).default;
const hi = (await import(`${SRC}i18n/strings.hi.js`)).default;
ok('progress.prioSlip exists in the English catalogue', typeof en['progress.prioSlip'] === 'string' && en['progress.prioSlip'].includes('{label}'));
ok('progress.prioSlip exists in the Hindi catalogue', typeof hi['progress.prioSlip'] === 'string' && hi['progress.prioSlip'].includes('{label}'));
ok('the Hindi slip line is Devanagari with no English clause', /[\u0900-\u097F]/.test(hi['progress.prioSlip'] || '') && !/keeps repeating/i.test(hi['progress.prioSlip'] || ''));
const fillSlip = (tpl, label) => String(tpl).replace('{label}', label);
for (const row of stats.priorities || []) {
  if (!row.misconception) { ok(`${row.subtopic}: no slip means no label`, row.misconceptionLabel == null); continue; }
  ok(`${row.subtopic}: a slip row carries its bare label`, typeof row.misconceptionLabel === 'string' && row.misconceptionLabel.length > 0, JSON.stringify(row));
  eq(`${row.subtopic}: the English clause is the label wrapped`, row.misconception, `keeps repeating: ${row.misconceptionLabel}`);
  ok(`${row.subtopic}: the bare label is not the English clause`, !/keeps repeating/i.test(row.misconceptionLabel));
  ok(`${row.subtopic}: the Hindi slip line renders without 'keeps repeating'`, !/keeps repeating/i.test(fillSlip(hi['progress.prioSlip'], row.misconceptionLabel)));
}
for (const p of live) eq(`${p.id}: the board row carries the bare label through`, p.misconceptionLabel, (stats.priorities || []).find(r => r.subtopic === p.id)?.misconceptionLabel ?? null);
const boardSrc = (await import('node:fs')).readFileSync(new URL('../src/components/IndiaSyllabusBoard.jsx', import.meta.url), 'utf8');
ok('the Priorities surface renders the slip through progress.prioSlip', /t\('progress\.prioSlip', \{ label: p\.misconceptionLabel \}\)/.test(boardSrc));
ok('the Priorities surface never prints the raw English clause', !/\{p\.misconception\}/.test(boardSrc));

const liveBoard = B.syllabusBoard(chapters);
ok('the live board colours some dot points', liveBoard.total - liveBoard.counts.unseen - liveBoard.counts.thin > 0, JSON.stringify(liveBoard.counts));

const total = pass + failures.length;
if (failures.length) {
  console.error(`SYLLABUS BOARD: FAIL — ${failures.length}/${total} checks failed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`SYLLABUS BOARD: PASS — ${pass}/${total} checks — dot points coloured by their own evidence, priorities in the topic queue's order, predictor and board agree with Progress on legacy history.`);
