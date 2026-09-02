import assert from 'node:assert/strict';
import { createPlatformDb } from '../platform/db.js';
import {
  assignmentForAccount, assignmentSubmissionsForStaff, listAssignmentsForAccount
} from '../platform/assignments.js';
import { assignmentSubmissionPrivacyGuard, sanitizeAssignmentSummary } from '../platform/assignmentProgress.js';

const db = createPlatformDb(':memory:');
const now = 1_900_000_000_000;

for (const [id, email, role] of [
  ['teacher-1', 'teacher@example.test', 'teacher'],
  ['teacher-2', 'teacher2@example.test', 'teacher'],
  ['student-1', 'student@example.test', 'student'],
  ['student-2', 'student2@example.test', 'student'],
  ['admin-1', 'admin@example.test', 'admin']
]) {
  db.prepare(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run(id, email, id, role, now, now);
}

db.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-1','teacher-1','Class 10 A','hash-a',?)`).run(now);
db.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-2','teacher-2','Class 10 B','hash-b',?)`).run(now);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-1',?)`).run(now);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-2','student-2',?)`).run(now);

db.prepare(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,due_at,created_at)
  VALUES ('assignment-1','class-1','teacher-1','Linear equations',?, ?, ?)`).run(
  JSON.stringify({ kind: 'practice', instructions: 'Show full working.', questionCount: 8, subtopic: 'linear-equations' }),
  now + 86_400_000,
  now
);
db.prepare(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at)
  VALUES ('assignment-2','class-2','teacher-2','Quadratics',?,?)`).run(
  JSON.stringify({ kind: 'practice', instructions: 'Complete the set.', questionCount: 6 }),
  now
);

// Simulate a legacy/malicious row. Read paths must redact unknown/sensitive keys
// even if old data reached storage before the write-side privacy guard existed.
db.prepare(`INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,updated_at)
  VALUES ('assignment-1','student-1','started',?, ?, ?)`).run(JSON.stringify({
  questionsAnswered: 3,
  correct: 2,
  xp: 25,
  rawInk: [{ x: 1, y: 2 }],
  answers: ['private working'],
  solution: 'must never surface'
}), now + 10, now + 20);

const studentList = listAssignmentsForAccount(db, 'student-1', 'student');
assert.equal(studentList.length, 1);
assert.equal(studentList[0].id, 'assignment-1');
assert.equal(studentList[0].className, 'Class 10 A');
assert.equal(studentList[0].specification.questionCount, 8);
assert.equal(studentList[0].submission.state, 'started');
assert.deepEqual(studentList[0].submission.summary, {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 25
});

assert.equal(assignmentForAccount(db, 'student-1', 'student', 'class-2', 'assignment-2'), null,
  'a student must not read an assignment from a class they did not join');
assert.equal(assignmentForAccount(db, 'teacher-2', 'teacher', 'class-1', 'assignment-1'), null,
  'a teacher must not read another teacher’s assignment');
assert.equal(assignmentForAccount(db, 'teacher-1', 'teacher', 'class-1', 'assignment-1')?.id, 'assignment-1');
assert.equal(assignmentForAccount(db, 'admin-1', 'admin', 'class-1', 'assignment-1')?.id, 'assignment-1');

const teacherList = listAssignmentsForAccount(db, 'teacher-1', 'teacher');
assert.deepEqual(teacherList.map(x => x.id), ['assignment-1']);
const adminList = listAssignmentsForAccount(db, 'admin-1', 'admin');
assert.deepEqual(new Set(adminList.map(x => x.id)), new Set(['assignment-1', 'assignment-2']));

const review = assignmentSubmissionsForStaff(db, 'teacher-1', 'teacher', 'class-1', 'assignment-1');
assert.equal(review.assignment.id, 'assignment-1');
assert.equal(review.submissions.length, 1);
assert.equal(review.submissions[0].student.id, 'student-1');
assert.deepEqual(review.submissions[0].summary, {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 25
});
assert.equal(assignmentSubmissionsForStaff(db, 'teacher-2', 'teacher', 'class-1', 'assignment-1'), null,
  'another teacher must not review a class submission');
assert.equal(assignmentSubmissionsForStaff(db, 'student-1', 'student', 'class-1', 'assignment-1'), null,
  'students must not enumerate classmate submission summaries');

assert.deepEqual(sanitizeAssignmentSummary({
  kind: 'practice', questionsAnswered: 80, correct: 90, xp: 9_999_999,
  targetQuestions: 200, strokes: ['secret'], answer: 'secret', arbitrary: { nested: true }
}), {
  kind: 'practice', questionsAnswered: 50, correct: 50, xp: 1_000_000, targetQuestions: 50
});

const guarded = {
  method: 'PATCH',
  path: '/classes/class-1/assignments/assignment-1/submission',
  body: {
    state: 'started',
    summary: { questionsAnswered: 4, correct: 3, xp: 40, targetQuestions: 8, rawInk: 'secret', answers: ['secret'] }
  }
};
let nextCalled = false;
assignmentSubmissionPrivacyGuard(guarded, {}, () => { nextCalled = true; });
assert.equal(nextCalled, true);
assert.deepEqual(guarded.body.summary, {
  kind: 'practice', questionsAnswered: 4, correct: 3, xp: 40, targetQuestions: 8
});

// Non-assignment routes are untouched by the privacy middleware.
const unrelated = { method: 'PATCH', path: '/account/profile', body: { summary: { answer: 'keep' } } };
assignmentSubmissionPrivacyGuard(unrelated, {}, () => {});
assert.deepEqual(unrelated.body.summary, { answer: 'keep' });

db.close();
console.log('PASS — assignment execution is authorised, staff review is class-scoped, and classroom progress exposes only bounded aggregate metrics.');
