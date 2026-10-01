// Pri dream interface · recommendation scenarios (from KALP-04, PR #240) and
// workspace contracts. Pure node: no browser, no build.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_RECOMMENDATION_POLICY, resolveHomeRecommendation } from '../src/home/recommendation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = rel => readFile(join(ROOT, rel), 'utf8');
const now = Date.parse('2026-10-01T12:00:00+05:30');
const student = {
  id: 'student-1', role: 'student', course: 'in', year: 10,
  indiaTrackName: 'CBSE / NCERT', courseLabel: 'CBSE / NCERT',
  dailyGoal: 10, today: { questions: 0 }
};
const base = {
  user: student,
  stats: { totals: { attempts: 12 }, priorities: [{ id: 'algebra', name: 'Algebra' }] },
  dueCount: 0, tasks: [], exams: [], resume: null,
  assignments: [], online: true, cloudReady: true, now
};

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.log('  ✘ ' + name); }
}
const selected = overrides => resolveHomeRecommendation({ ...base, ...overrides }).primary;

check('active exam outranks ordinary work', () => {
  const row = selected({
    exams: [{ id: 'exam-1', title: 'Paper', created_at: now - 1000, finished_at: null }],
    dueCount: 1,
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'exam');
  assert.equal(row.destination, '/exams/exam-1');
});

check('returned teacher assignment is urgent and contextual', () => {
  const row = selected({ assignments: [{
    id: 'a1', classId: 'c1', title: 'Quadratics', dueAt: now + 10 * 86400000,
    specification: { questionCount: 10 }, submission: { state: 'returned', summary: { questionsAnswered: 4 } }
  }] });
  assert.equal(row.kind, 'assignment');
  assert.equal(row.priority, HOME_RECOMMENDATION_POLICY.returnedAssignment);
  assert.equal(row.destination, '/practice?classId=c1&assignment=a1');
});

check('teacher assignment due soon outranks ordinary resume', () => {
  const row = selected({
    assignments: [{ id: 'a2', classId: 'c1', title: 'Due', dueAt: now + 2 * 3600000, specification: { questionCount: 8 } }],
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'assignment');
});

check('active local resume outranks due reviews', () => {
  const row = selected({
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' },
    dueCount: 2
  });
  assert.equal(row.kind, 'practice-resume');
});

check('due reviews outrank daily goal', () => {
  const row = selected({
    user: { ...student, today: { questions: 4 } },
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('partial daily goal beats generic adaptive work', () => {
  const row = selected({ user: { ...student, today: { questions: 6 } } });
  assert.equal(row.kind, 'daily-goal');
  assert.equal(row.data.remaining, 4);
});

check('new student receives a real first practice action', () => {
  const row = selected({
    stats: { totals: { attempts: 0 }, priorities: [{ id: 'zero-history', name: 'Algebra' }] },
    user: { ...student, today: { questions: 0 } }
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.destination, '/practice');
});

check('new offline student receives honest caveat', () => {
  const row = selected({
    stats: { totals: { attempts: 0 } },
    user: { ...student, today: { questions: 0 } },
    online: false, cloudState: 'offline'
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.offlineCaveat, true);
});

check('cloud assignments are excluded while offline', () => {
  const row = selected({
    online: false, cloudState: 'offline',
    assignments: [{ id: 'a3', classId: 'c1', title: 'Cloud only', dueAt: now - 1000 }],
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('cloud failure leaves local recommendation usable', () => {
  const decision = resolveHomeRecommendation({
    ...base, cloudReady: false,
    assignments: [{ id: 'a4', classId: 'c1', title: 'Unavailable', dueAt: now - 1000 }]
  });
  assert.ok(decision.primary);
  assert.notEqual(decision.primary.kind, 'assignment');
});

check('unfinished local class task preserves task context', () => {
  const row = selected({ tasks: [{ id: 't1', title: 'Teacher pack', classId: 'cl', className: '10A', count: 10, done: 3, finished: false, dueAt: now + 6 * 3600000 }] });
  assert.equal(row.kind, 'task');
  assert.equal(row.destination, '/practice?task=t1');
});

check('finished local task is never primary', () => {
  const row = selected({ tasks: [{ id: 't2', title: 'Done', count: 10, done: 10, finished: true }] });
  assert.notEqual(row.id, 't2');
});

check('submitted cloud assignment is never primary', () => {
  const row = selected({ assignments: [{ id: 'a5', classId: 'c1', title: 'Submitted', submission: { state: 'submitted' } }] });
  assert.notEqual(row.id, 'a5');
});

check('teacher role receives no student recommendation', () => {
  const decision = resolveHomeRecommendation({ ...base, user: { ...student, role: 'teacher' } });
  assert.equal(decision.primary, null);
});

check('policy is deterministic under identical inputs', () => {
  const input = { ...base, dueCount: 1, tasks: [{ id: 't4', title: 'Task', count: 10, done: 0, finished: false }] };
  assert.deepEqual(resolveHomeRecommendation(input), resolveHomeRecommendation(input));
});

check('tie-break prefers earlier real deadline', () => {
  const row = selected({ assignments: [
    { id: 'later', classId: 'c', title: 'Later', dueAt: now + 10 * 3600000 },
    { id: 'earlier', classId: 'c', title: 'Earlier', dueAt: now + 2 * 3600000 }
  ] });
  assert.equal(row.id, 'earlier');
});

check('assignment without a due date is not falsely urgent', () => {
  const row = selected({
    assignments: [{ id: 'undated', classId: 'c', title: 'Undated' }],
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('unfinished task question keeps resume priority', () => {
  const row = selected({
    tasks: [{ id: 'task-resume', title: 'Task', count: 10, done: 1, finished: false }],
    resume: { kind: 'task', taskId: 'task-resume', questionId: 'q9', title: 'Task', destination: '/practice?task=task-resume' },
    user: { ...student, today: { questions: 4 } }
  });
  assert.equal(row.kind, 'task-resume');
  assert.equal(row.destination, '/practice?task=task-resume');
});

// ── Dream interface contracts ────────────────────────────────────────────────
// Source-level guards for the paper/instrument workspace. Each one names a
// behaviour a student relies on, so a refactor that drops it fails here first.
const src = rel => readFile(join(ROOT, rel), 'utf8');
const [backend, home, app, card, practicePage, ink, exam, en] = await Promise.all([
  'src/local/backend.js', 'src/pages/Home.jsx', 'src/App.jsx', 'src/components/QuestionCard.jsx',
  'src/pages/PracticeBase.jsx', 'src/ink/InkAnswer.jsx', 'src/pages/ExamRoom.jsx', 'src/i18n/strings.en.js'
].map(src));

check('every component that calls t() first obtains it from useT() (the Diagnosis crash)', () => {
  const offenders = [];
  for (const [file, text] of [['QuestionCard.jsx', card], ['PracticeBase.jsx', practicePage], ['InkAnswer.jsx', ink], ['ExamRoom.jsx', exam], ['Home.jsx', home], ['App.jsx', app]]) {
    const parts = text.split(/\n(?=(?:export default )?function [A-Z])/);
    for (const part of parts) {
      const name = (part.match(/^(?:export default )?function ([A-Z]\w*)\s*\(([^)]*)\)/) || [])[1];
      if (!name) continue;
      const params = (part.match(/^(?:export default )?function [A-Z]\w*\s*\(([^)]*)\)/) || [])[1] || '';
      const uses = /[^\w.]t\(\s*['`(a-z]/.test(part);
      const has = /const t = useT\(\)/.test(part) || /\bt\b/.test(params);
      if (uses && !has) offenders.push(`${file}:${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

check('Home consumes one central recommendation resolver and one primary action', () => {
  assert.match(home, /resolveHomeRecommendation/);
  assert.match(home, /api\.get\('\/practice\/resume'\)/);
  assert.equal((home.match(/data-home-primary(?!-)/g) || []).length, 1);
  assert.equal((home.match(/data-home-primary-cta/g) || []).length, 1);
  assert.ok(home.indexOf('<HomeAction primary') < home.indexOf('className="genbar"'));
  assert.match(home, /assignments === false/);
  assert.doesNotMatch(home, /TAGLINES|Tagline|DiamondTrack|adaptiveOn/);
});

check('practice is a thinking-mode route: no navigation furniture while working', () => {
  assert.match(app, /focusMode = user\.role !== 'teacher'\s*&& \(loc\.pathname === '\/practice' \|\| \/\^\\\/exams\\\/\[\^\/\]\+\/\.test\(loc\.pathname\)\)/);
  assert.match(practicePage, /className="ws-bar/);
  assert.match(practicePage, /aria-label=\{t\('practice\.leave'\)\}/);
});

check('the action bar holds exactly one primary action', () => {
  const bar = card.slice(card.indexOf('<div className="ws-actions'), card.indexOf('</section>', card.indexOf('<div className="ws-actions')));
  assert.equal((bar.match(/btn-primary/g) || []).length, 1);
});

check('status only claims what the device actually knows', () => {
  assert.doesNotMatch(en, /'verdict\.status[A-Za-z]*': '[^']*(synced|uploaded|cloud)/i);
  assert.match(card, /saveDraft\('question', question\.id/);
  assert.match(card, /\.then\(\(\) => setSaveState\(s => \(s === 'saving' \? 'saved' : s\)\)\)/);
});

check('handwriting drafts persist on the question row and are restored, never marked', () => {
  assert.match(backend, /'POST \/practice\/:id\/ink-draft'/);
  assert.match(backend, /key === 'POST \/practice\/:id\/ink-draft'/);
  assert.match(backend, /inkDraft: !row\.answered/);
  assert.match(card, /initialStrokes=\{latestInk\.current \|\| question\.inkDraft \|\| null\}/);
  assert.match(ink, /canvasRef\.current\?\.setStrokes\?\.\(initialStrokes\)/);
});

check('a reading in doubt is confirmed in place, not by rewriting', () => {
  assert.match(card, /needsCheck && checking\s*\? \{ label: t\('verdict\.confirmReading'\), run: acceptReading/);
  assert.match(card, /className="ws-check"/);
});

check('mistakes, uncertainty and failures are three different states', () => {
  assert.match(card, /verdict-technical/);
  assert.match(card, /verdict-unsure/);
  assert.match(card, /'verdict-bad'/);
  assert.match(card, /technical: true/);
});

check('the first meaningful break leads; the rest wait behind a disclosure', () => {
  assert.match(card, /const first = report\.lines\.findIndex\(l => l\.status === 'break'\)/);
  assert.match(card, /className="stepcheck-more"/);
});

check('scratch work is labelled as never marked', () => {
  assert.match(card, /verdict\.scratchNotMarked/);
  assert.match(en, /'verdict\.scratchNotMarked': ["']Not marked["']/);
});

check('no learner-model numbers or game points in the result', () => {
  assert.doesNotMatch(card, /verdict\.mastery|verdict\.skillUp|xp-pop|PRAISE_KEYS/);
});

check('formal assessment: no hints, confirmed submission, flags and a spoken timer', () => {
  assert.doesNotMatch(exam, /getHint|hintsAvailable|PriExplain/);
  assert.match(exam, /role="dialog"[\s\S]*exam\.confirmUnanswered/);
  assert.match(exam, /setFlagged/);
  assert.match(exam, /left === 600 \|\| left === 300 \|\| left === 60/);
  assert.match(exam, /role="timer"/);
});

check('no effect shadows the translator it calls (the exam-timer crash)', () => {
  for (const [file, text] of [['ExamRoom.jsx', exam], ['QuestionCard.jsx', card], ['InkAnswer.jsx', ink], ['PracticeBase.jsx', practicePage], ['Home.jsx', home]]) {
    assert.doesNotMatch(text, /\bconst t = set(?:Timeout|Interval)\(/, `${file} declares a local \`t\` that is not the translator`);
  }
});

console.log('');
console.log('DREAM INTERFACE CHECK — ' + passed + '/' + (passed + failures.length) + ' checks');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
