import assert from 'node:assert/strict';
import { openTestStore } from './support/engine.mjs';
import {
  assignmentForAccount, assignmentSubmissionsForStaff, listAssignmentsForAccount
} from '../platform/assignments.js';
import { sanitizeAssignmentSummary } from '../platform/assignmentProgress.js';
import { writeStudentSubmission } from '../platform/classes.js';

// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
const testStore = await openTestStore(undefined, { label: 'assignment_execution' });
const db = testStore.store;
const now = 1_900_000_000_000;

for (const [id, email, role] of [
  ['teacher-1', 'teacher@example.test', 'teacher'],
  ['teacher-2', 'teacher2@example.test', 'teacher'],
  ['student-1', 'student@example.test', 'student'],
  ['student-2', 'student2@example.test', 'student'],
  ['admin-1', 'admin@example.test', 'admin']
]) {
  await db.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, [id, email, id, role, now, now]);
}

await db.run(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-1','teacher-1','Class 10 A','hash-a',?)`, [now]);
await db.run(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-2','teacher-2','Class 10 B','hash-b',?)`, [now]);
await db.run(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-1',?)`, [now]);
await db.run(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-2','student-2',?)`, [now]);

await db.run(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,due_at,created_at)
  VALUES ('assignment-1','class-1','teacher-1','Linear equations',?, ?, ?)`, [JSON.stringify({ kind: 'practice', instructions: 'Show full working.', questionCount: 8, subtopic: 'linear-equations' }),
  now + 86_400_000,
  now]);
await db.run(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at)
  VALUES ('assignment-2','class-2','teacher-2','Quadratics',?,?)`, [JSON.stringify({ kind: 'practice', instructions: 'Complete the set.', questionCount: 6 }),
  now]);

// Simulate a legacy/malicious row. Read paths must redact unknown/sensitive keys
// even if old data reached storage before the write-side privacy guard existed.
await db.run(`INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,updated_at)
  VALUES ('assignment-1','student-1','started',?, ?, ?)`, [JSON.stringify({
  questionsAnswered: 3,
  correct: 2,
  xp: 25,
  rawInk: [{ x: 1, y: 2 }],
  answers: ['private working'],
  solution: 'must never surface'
}), now + 10, now + 20]);

const studentList = await listAssignmentsForAccount(db, 'student-1', 'student');
assert.equal(studentList.length, 1);
assert.equal(studentList[0].id, 'assignment-1');
assert.equal(studentList[0].className, 'Class 10 A');
assert.equal(studentList[0].specification.questionCount, 8);
assert.equal(studentList[0].submission.state, 'started');
assert.deepEqual(studentList[0].submission.summary, {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 25
});

assert.equal(await assignmentForAccount(db, 'student-1', 'student', 'class-2', 'assignment-2'), null,
  'a student must not read an assignment from a class they did not join');
assert.equal(await assignmentForAccount(db, 'teacher-2', 'teacher', 'class-1', 'assignment-1'), null,
  'a teacher must not read another teacher’s assignment');
assert.equal((await assignmentForAccount(db, 'teacher-1', 'teacher', 'class-1', 'assignment-1'))?.id, 'assignment-1');
assert.equal((await assignmentForAccount(db, 'admin-1', 'admin', 'class-1', 'assignment-1'))?.id, 'assignment-1');

const teacherList = await listAssignmentsForAccount(db, 'teacher-1', 'teacher');
assert.deepEqual(teacherList.map(x => x.id), ['assignment-1']);
const adminList = await listAssignmentsForAccount(db, 'admin-1', 'admin');
assert.deepEqual(new Set(adminList.map(x => x.id)), new Set(['assignment-1', 'assignment-2']));

const review = await assignmentSubmissionsForStaff(db, 'teacher-1', 'teacher', 'class-1', 'assignment-1');
assert.equal(review.assignment.id, 'assignment-1');
assert.equal(review.submissions.length, 1);
assert.equal(review.submissions[0].student.id, 'student-1');
assert.deepEqual(review.submissions[0].summary, {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 25
});
assert.equal(await assignmentSubmissionsForStaff(db, 'teacher-2', 'teacher', 'class-1', 'assignment-1'), null,
  'another teacher must not review a class submission');
assert.equal(await assignmentSubmissionsForStaff(db, 'student-1', 'student', 'class-1', 'assignment-1'), null,
  'students must not enumerate classmate submission summaries');

assert.deepEqual(sanitizeAssignmentSummary({
  kind: 'practice', questionsAnswered: 80, correct: 90, xp: 9_999_999,
  targetQuestions: 200, strokes: ['secret'], answer: 'secret', arbitrary: { nested: true }
}), {
  kind: 'practice', questionsAnswered: 50, correct: 50, xp: 1_000_000, targetQuestions: 50
});

// The writer sanitises: whatever a caller hands it, only aggregate metrics
// reach the row. No route, spelling of a route or future caller can pass this.
await writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { questionsAnswered: 4, correct: 3, xp: 40, targetQuestions: 8, rawInk: 'secret', answers: ['secret'] },
  now: now + 30
});
const stored = (await db.get(`SELECT summary_json FROM assignment_submissions
  WHERE assignment_id='assignment-1' AND student_account_id='student-1'`)).summary_json;
assert.deepEqual(JSON.parse(stored), {
  kind: 'practice', questionsAnswered: 4, correct: 3, xp: 40, targetQuestions: 8
});
assert.ok(!stored.includes('rawInk') && !stored.includes('answers') && !stored.includes('secret'),
  'ink and answers must not reach the classroom control plane at all');

await testStore.close();
console.log(`engine: ${testStore.engine}`);
console.log('PASS — assignment execution is authorised, staff review is class-scoped, and classroom progress exposes only bounded aggregate metrics.');
