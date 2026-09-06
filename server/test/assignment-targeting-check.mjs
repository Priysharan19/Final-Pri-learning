// Cloud assignments target the India syllabus, and the server is the authority.
//
// Two halves. The validator is driven directly with the curriculum the client
// serves from: chapter ids, dot-point bounds, difficulty ceilings and track/
// grade consistency. Then the real class router runs over HTTP with seeded
// sessions, proving a bad target is refused with ASSIGNMENT_SPEC_INVALID, a
// good one is stored normalised, and the analytics route returns the
// aggregated per-student / per-assignment / per-chapter view with intervention
// flags — and never a raw submission key.
//
// Usage: node server/test/assignment-targeting-check.mjs
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { createClassRouter } from '../platform/classes.js';
import { classAnalytics, validateAssignmentSpecification, DROP_POINTS, INACTIVE_DAYS } from '../platform/assignmentTargets.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';
import { IN_CHAPTER_BY_ID } from '../../client/src/engine/curriculum-in.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };

const DAY = 86_400_000;
// The analytics route reads the real clock, so the fixture's timestamps are
// relative to it. A pinned constant here would put every activity date in the
// future and silently switch off every intervention flag.
const now = Date.now();
const c11 = Object.values(IN_CHAPTER_BY_ID).find(ch => ch.grade === 11).id;

// ── 1 · the validator ────────────────────────────────────────────────────────
const legacy = validateAssignmentSpecification({ kind: 'practice', instructions: '  Show working. ', questionCount: 8, answers: ['x=2'], ink: { strokes: [] } });
eq(legacy, { ok: true, spec: { kind: 'practice', instructions: 'Show working.', questionCount: 8 } }, 'a generic practice spec survives with unknown keys dropped');
eq(validateAssignmentSpecification({}), { ok: true, spec: { kind: 'practice', questionCount: 10 } }, 'an empty spec defaults to ten generic questions');

const targeted = validateAssignmentSpecification({ instructions: 'Discriminant only.', questionCount: 6, track: 'cbse', subtopics: ['c10-quadratic-equations'], dotpoint: 2, difficulty: 3 });
eq(targeted, { ok: true, spec: { kind: 'practice', instructions: 'Discriminant only.', questionCount: 6, track: 'cbse', subtopics: ['c10-quadratic-equations'], subtopic: 'c10-quadratic-equations', dotpoint: 2, difficulty: 3 } },
  'a single-chapter target keeps chapter, dot point, difficulty and track');
eq(validateAssignmentSpecification({ subtopic: 'c10-polynomials', subtopics: ['c10-polynomials', 'c10-real-numbers'] }).spec.subtopics,
  ['c10-polynomials', 'c10-real-numbers'], 'subtopic and subtopics merge without duplicates');
eq(validateAssignmentSpecification({ subtopics: ['c10-polynomials', 'c10-real-numbers'] }).spec.track, 'cbse', 'class chapters default to the CBSE track');
eq(validateAssignmentSpecification({ subtopics: ['olymp-number-theory'] }).spec.track, 'olympiad', 'an olympiad topic defaults to the olympiad track');

const bad = input => { const r = validateAssignmentSpecification(input); ok(r.ok === false && r.code === 'ASSIGNMENT_SPEC_INVALID', `expected refusal for ${JSON.stringify(input)}`); return r.message; };
ok(/not a chapter/.test(bad({ subtopics: ['y10-quadratics'] })), 'an NSW subtopic id is not an India chapter');
ok(/not a chapter/.test(bad({ subtopic: 'c10-nope' })), 'an unknown chapter id is refused by name');
ok(/malformed/.test(bad({ subtopics: ['../etc'] })), 'a malformed id is refused');
ok(/dot points/.test(bad({ subtopics: ['c10-quadratic-equations'], dotpoint: 4 })), 'a dot point past the chapter is refused');
ok(/single chapter/.test(bad({ subtopics: ['c10-quadratic-equations', 'c10-polynomials'], dotpoint: 0 })), 'a dot point needs exactly one chapter');
ok(/1 to 3/.test(bad({ track: 'cbse', subtopics: ['c10-polynomials'], difficulty: 4 })), 'CBSE difficulty stops at its ceiling of 3');
eq(validateAssignmentSpecification({ track: 'jee-main', subtopics: [c11], difficulty: 4 }).ok, true, 'JEE Main allows difficulty 4 on a Class 11 chapter');
ok(/Classes 11/.test(bad({ track: 'jee-main', subtopics: ['c8-rational-numbers'] })), 'a JEE track cannot target a Class 8 chapter');
ok(/olympiad/.test(bad({ track: 'olympiad', subtopics: ['c10-polynomials'] })), 'the olympiad track cannot target a class chapter');
ok(/olympiad/.test(bad({ track: 'cbse', subtopics: ['olymp-geometry'] })), 'a class track cannot target an olympiad topic');
ok(/mix/.test(bad({ subtopics: ['olymp-geometry', 'c10-polynomials'] })), 'olympiad topics and class chapters do not mix');
ok(/1 to 50/.test(bad({ questionCount: 80 })), 'question count above 50 is refused');
ok(/1 to 50/.test(bad({ questionCount: 'ten' })), 'a non-numeric question count is refused');
ok(/characters/.test(bad({ instructions: 'x'.repeat(4001) })), 'over-long instructions are refused');
ok(/practice/.test(bad({ kind: 'exam' })), 'only practice assignments exist');
ok(/one of/.test(bad({ track: 'hsc' })), 'an unknown track is refused');
ok(/object/.test(bad('nope')), 'a non-object spec is refused');
ok(/at most 20/.test(bad({ subtopics: new Array(21).fill('c10-polynomials') })), 'the chapter list is bounded');

// ── 2 · the real router, seeded ──────────────────────────────────────────────
const db = createPlatformDb(':memory:');
for (const [id, email, name, role] of [
  ['teacher-1', 'teacher@example.test', 'Ms Rao', 'teacher'],
  ['teacher-2', 'teacher2@example.test', 'Mr Iyer', 'teacher'],
  ['student-1', 'asha@example.test', 'Asha', 'student'],
  ['student-2', 'bharat@example.test', 'Bharat', 'student'],
  ['student-3', 'chitra@example.test', 'Chitra', 'student']
]) {
  db.prepare(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(id, email, name, role, now - 40 * DAY, now - 40 * DAY);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'test', null, now, now, now + 30 * DAY);
}
db.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES ('class-1','teacher-1','Class 10 A','hash-a',?)`).run(now - 30 * DAY);
db.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES ('class-2','teacher-2','Class 10 B','hash-b',?)`).run(now - 30 * DAY);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-1',?)`).run(now - 30 * DAY);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-2',?)`).run(now - 30 * DAY);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-3',?)`).run(now - 10 * DAY);

const insertAssignment = (id, title, spec, dueAt, createdAt) => db.prepare(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,due_at,created_at)
  VALUES (?,?,?,?,?,?,?)`).run(id, 'class-1', 'teacher-1', title, JSON.stringify(spec), dueAt, createdAt);
insertAssignment('a1', 'Quadratics', { kind: 'practice', questionCount: 20, track: 'cbse', subtopics: ['c10-quadratic-equations'], subtopic: 'c10-quadratic-equations' }, now - 3 * DAY, now - 20 * DAY);
insertAssignment('a2', 'AP and polynomials', { kind: 'practice', questionCount: 20, track: 'cbse', subtopics: ['c10-arithmetic-progressions', 'c10-polynomials'] }, now + 5 * DAY, now - 10 * DAY);
insertAssignment('a3', 'Real numbers', { kind: 'practice', questionCount: 10, track: 'cbse', subtopics: ['c10-real-numbers'], subtopic: 'c10-real-numbers' }, null, now - 8 * DAY);

const insertSubmission = (assignmentId, studentId, state, summary, startedAt, submittedAt, updatedAt) => db.prepare(`INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,submitted_at,updated_at)
  VALUES (?,?,?,?,?,?,?)`).run(assignmentId, studentId, state, JSON.stringify(summary), startedAt, submittedAt, updatedAt);
insertSubmission('a1', 'student-1', 'submitted', { questionsAnswered: 20, correct: 18, xp: 180, targetQuestions: 20 }, now - 16 * DAY, now - 15 * DAY, now - 15 * DAY);
insertSubmission('a2', 'student-1', 'submitted', { questionsAnswered: 20, correct: 8, xp: 80, targetQuestions: 20 }, now - 3 * DAY, now - 2 * DAY, now - 2 * DAY);
insertSubmission('a1', 'student-2', 'started', { questionsAnswered: 10, correct: 7, xp: 70, targetQuestions: 20 }, now - 9 * DAY, null, now - 9 * DAY);
// A legacy row carrying keys the write guard would have stripped: the read path must not echo them.
insertSubmission('a3', 'student-2', 'started', { questionsAnswered: 4, correct: 2, xp: 20, rawInk: [{ x: 1 }], answers: ['secret'] }, now - 9 * DAY, null, now - 9 * DAY);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/classes', createClassRouter(db));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, path, who, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-${who}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, json: await res.json() };
};

try {
  const refused = await call('POST', '/classes/class-1/assignments', 'teacher-1', { title: 'Broken', specification: { subtopics: ['c10-nope'], questionCount: 5 } });
  eq([refused.status, refused.json.error?.code], [400, 'ASSIGNMENT_SPEC_INVALID'], 'the router refuses a target that is not on the syllabus');
  ok(/c10-nope/.test(refused.json.error.message), 'the refusal names the chapter');
  const tooHard = await call('POST', '/classes/class-1/assignments', 'teacher-1', { title: 'Too hard', specification: { track: 'cbse', subtopics: ['c10-polynomials'], difficulty: 4 } });
  eq([tooHard.status, tooHard.json.error?.code], [400, 'ASSIGNMENT_SPEC_INVALID'], 'the router refuses a difficulty above the track ceiling');

  const created = await call('POST', '/classes/class-1/assignments', 'teacher-1', {
    title: 'Discriminant drill', dueAt: now + 7 * DAY,
    specification: { instructions: 'Use b² − 4ac.', questionCount: 5, track: 'cbse', subtopics: ['c10-quadratic-equations'], dotpoint: 2, difficulty: 2, answers: ['leak'], strokes: [[1, 2]] }
  });
  eq(created.status, 201, 'a valid India target is accepted');
  eq(created.json.assignment.specification, { kind: 'practice', instructions: 'Use b² − 4ac.', questionCount: 5, track: 'cbse', subtopics: ['c10-quadratic-equations'], subtopic: 'c10-quadratic-equations', dotpoint: 2, difficulty: 2 },
    'the stored specification is the normalised one');
  const storedSpec = db.prepare('SELECT specification_json FROM assignments WHERE id=?').get(created.json.assignment.id).specification_json;
  ok(!/answers|strokes|leak/.test(storedSpec), 'unknown keys never reach storage');

  eq((await call('POST', '/classes/class-1/assignments', 'teacher-2', { title: 'Not mine', specification: { questionCount: 5 } })).status, 404, 'another teacher cannot publish into this class');
  eq((await call('POST', '/classes/class-1/assignments', 'student-1', { title: 'Nope', specification: { questionCount: 5 } })).status, 403, 'a student cannot publish an assignment');

  const analytics = await call('GET', '/classes/class-1/analytics', 'teacher-1');
  eq(analytics.status, 200, 'the teacher reads class analytics');
  const a = analytics.json;
  eq([a.students, a.assignments, a.startedSubmissions, a.submitted, a.returned], [3, 4, 4, 2, 0], 'the headline counts are kept');
  eq(a.studentRows.map(s => s.name), ['Asha', 'Bharat', 'Chitra'], 'one aggregated row per enrolled student, by name');
  const [asha, bharat, chitra] = a.studentRows;
  eq([asha.questionsAnswered, asha.correct, asha.accuracy, asha.submitted, asha.notStarted], [40, 26, 65, 2, 2], 'a student row aggregates answered, correct and accuracy across assignments');
  eq(asha.flags.map(f => f.code), ['accuracy-drop'], 'a fall from 90% to 40% across the latest twenty answered questions is flagged');
  ok(/90%.*40%/.test(asha.flags[0].reason), `the accuracy-drop reason names both numbers: ${asha.flags[0].reason}`);
  eq(bharat.flags.map(f => f.code), ['inactive', 'overdue'], 'nine idle days and an unsubmitted past-due assignment are both flagged');
  ok(bharat.flags[0].label === 'Inactive 9d' && /9 days/.test(bharat.flags[0].reason), 'inactivity says how long');
  ok(/Quadratics/.test(bharat.flags[1].reason), 'the overdue reason names the assignment');
  eq([bharat.questionsAnswered, bharat.correct, bharat.accuracy], [14, 9, 64], 'a started-but-unsubmitted assignment still counts as evidence');
  // She joined ten days ago, has never started, and one assignment is already
  // past due — a teacher should see both reasons, not just the earlier one.
  eq(chitra.flags.map(f => [f.code, f.label]), [['inactive', 'Not started'], ['overdue', '1 overdue']], 'a student who joined ten days ago and never started is flagged as inactive and overdue');
  eq(a.attention.map(s => s.name), ['Asha', 'Bharat', 'Chitra'], 'the attention list is every flagged student');

  const byId = Object.fromEntries(a.assignmentRows.map(r => [r.id, r]));
  eq([byId.a1.overdue, byId.a1.submitted, byId.a1.started, byId.a1.notStarted, byId.a1.accuracy], [true, 1, 1, 1, 83], 'an assignment row aggregates its class');
  eq(byId.a1.target.subtopics, ['c10-quadratic-equations'], 'the assignment row carries its target');
  eq([byId.a2.notStarted, byId.a2.accuracy, byId.a3.accuracy], [2, 40, 50], 'not-started counts the enrolled students with no submission');

  const name = id => IN_CHAPTER_BY_ID[id].name;
  eq(a.chapters.map(c => [c.id, c.questionsAnswered, c.accuracy]), [
    ['c10-arithmetic-progressions', 10, 40], ['c10-polynomials', 10, 40], ['c10-real-numbers', 4, 50], ['c10-quadratic-equations', 30, 83]
  ], 'chapter evidence shares a two-chapter assignment evenly and sorts weakest first');
  eq(a.chapters[0].name, name('c10-arithmetic-progressions'), 'chapters are named from the curriculum');
  eq(a.weakestChapters.map(c => c.id), ['c10-arithmetic-progressions', 'c10-polynomials', 'c10-quadratic-equations'], 'the three weakest chapters need at least five answered questions');
  const echoed = JSON.stringify(a);
  ok(!/rawInk|answers|secret/.test(echoed), 'a legacy raw submission key is never echoed by analytics');

  eq((await call('GET', '/classes/class-1/analytics', 'student-1')).status, 403, 'students cannot read class analytics');
  eq((await call('GET', '/classes/class-1/analytics', 'teacher-2')).status, 404, 'another teacher cannot read this class');

  // The pure function agrees with the route and honours its thresholds.
  const direct = classAnalytics(db, 'class-1', now);
  eq(direct.studentRows.map(s => s.flags.map(f => f.code)), a.studentRows.map(s => s.flags.map(f => f.code)), 'the route serves the aggregation function unchanged');
  eq(classAnalytics(db, 'class-1', now - 8 * DAY).studentRows[1].flags.map(f => f.code), ['overdue'].filter(() => false).concat([]), `one idle day short of ${INACTIVE_DAYS} is not inactive`);
  ok(DROP_POINTS === 15 && INACTIVE_DAYS === 7, 'thresholds are the ones the product states: 15 points, 7 days');
} finally {
  server.close();
  db.close();
}

console.log(`ASSIGNMENT TARGETING: PASS — ${checks}/${checks} checks (validator against the India curriculum, real class router over HTTP, aggregated analytics with flags)`);
