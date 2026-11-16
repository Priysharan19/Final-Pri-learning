// Plan F5 · the progress export holds only what the Progress page shows.
//   node client/test/progress-export-check.mjs
import assert from 'node:assert/strict';
import { composeProgress } from '../src/lib/exportProgress.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

const user = { id: 'profile-A', name: 'Asha', year: 10, course: 'in', indiaTrack: 'cbse' };
const HIDDEN = { answer: '42', solution: 'x=3', steps: ['a'], markingPlan: 'm', contentHash: 'a'.repeat(64), profile_id: 'profile-B', expected: '7', hiddenKey: 'secret' };
const curriculum = { years: [{ year: 10, chapters: [
  { id: 'ch-1', name: 'Real Numbers', attempts: 12, correct: 9, ...HIDDEN },
  { id: 'ch-2', name: 'Untouched', attempts: 0, correct: 0 }
] }] };
const stats = { totals: { attempts: 40, correct: 30, repeats: 2, ...HIDDEN }, examPrediction: { expected: 70, low: 60, high: 80 }, predicted: { mark: 80 } };
const exams = [
  { id: 'e1', title: 'Paper A', finished_at: 5, score: 8, total: 10, marked_by: 'server', provisional: false, detail: HIDDEN },
  { id: 'e2', title: 'OPEN paper', finished_at: null, score: null, total: 10 },
  { id: 'e3', title: 'Waiting', finished_at: 6, pending: true, score: 0, total: 5 }
];
const out = composeProgress({ stats, curriculum, exams, user });
const flat = JSON.stringify(out);

check('nothing shaped like an answer, solution, steps, plan or hash is in the file', () => {
  assert.ok(!/answer|solution|steps|markingplan|contenthash|hiddenkey|expected|secret/i.test(flat), flat);
  assert.ok(!/[a-f0-9]{32,}/i.test(flat));
  assert.ok(!flat.includes('profile-B') && !flat.includes('profile-A'));
});
check('no band, grade or score prediction', () => {
  assert.ok(!/predict(ed|ion)?"|"(expected|low|high|band|grade)"/i.test(flat.replace(/"notice":"[^"]*"/, '')));
});
check('the only profile fields are the display name, year and course', () => {
  assert.deepEqual(Object.keys(out.profile).sort(), ['course', 'name', 'year']);
});
check('chapters carry id, name and two counts; an untouched chapter is left out', () => {
  assert.deepEqual(out.chapters, [{ id: 'ch-1', name: 'Real Numbers', attempts: 12, correct: 9 }]);
});
check('a paper still open or waiting to be read is not in the file (sealed)', () => {
  assert.deepEqual(out.exams.map(e => e.title), ['Paper A']);
  assert.ok(!flat.includes('OPEN paper') && !flat.includes('Waiting'));
});
check('a finished paper carries the score the server decided and who marked it', () => {
  assert.deepEqual(out.exams[0], { title: 'Paper A', finishedAt: 5, score: 8, total: 10, markedBy: 'server', provisional: false });
});
check('totals are counts only', () => assert.deepEqual(out.totals, { attempts: 40, correct: 30, repeats: 2 }));
check('a hidden field added upstream does not reach the file (the scan would catch it)', () => {
  const again = composeProgress({ stats: { totals: { ...stats.totals, answerKey: 'k' } }, curriculum, exams, user });
  assert.ok(!JSON.stringify(again).includes('answerKey'));
});
check('top-level keys are exactly the allowed set', () => {
  assert.deepEqual(Object.keys(out).sort(), ['chapters', 'edition', 'exams', 'exportVersion', 'kind', 'notice', 'profile', 'source', 'totals']);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`FAIL ${failures.length}`); process.exit(1); }
console.log(`progress-export-check: ${pass} passed`);
