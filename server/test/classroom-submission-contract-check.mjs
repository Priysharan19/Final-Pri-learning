import assert from 'node:assert/strict';
import { createPlatformDb } from '../platform/db.js';
import {
  returnStudentSubmission, studentSubmissionTransitionAllowed, writeStudentSubmission
} from '../platform/classes.js';

const db = createPlatformDb(':memory:');
const now = 1_900_000_000_000;

for (const [id, email, role] of [
  ['teacher-1', 'teacher@example.test', 'teacher'],
  ['student-1', 'student@example.test', 'student']
]) {
  db.prepare(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run(id, email, id, role, now, now);
}
db.prepare(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-1','teacher-1','Class 10','hash-code',?)`).run(now);
db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-1',?)`).run(now);
db.prepare(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at)
  VALUES ('assignment-1','class-1','teacher-1','Quadratics','{}',?)`).run(now);

assert.equal(studentSubmissionTransitionAllowed(null, 'started'), true);
assert.equal(studentSubmissionTransitionAllowed(null, 'submitted'), true);
assert.equal(studentSubmissionTransitionAllowed('started', 'submitted'), true);
assert.equal(studentSubmissionTransitionAllowed('submitted', 'started'), false);
assert.equal(studentSubmissionTransitionAllowed('returned', 'started'), true);
assert.equal(studentSubmissionTransitionAllowed('returned', 'submitted'), true);

const started = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: { attempted: 2 }, now: now + 10
});
assert.equal(started.state, 'started');
const submitted = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { attempted: 10, score: 8 }, now: now + 20
});
assert.equal(submitted.state, 'submitted');

assert.throws(() => writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: {}, now: now + 30
}), error => error?.code === 'SUBMISSION_TRANSITION_INVALID');

const returned = returnStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', teacherId: 'teacher-1',
  feedback: { note: 'Rework factorisation in question 4.' }, now: now + 40
});
assert.equal(returned.state, 'returned');
assert.equal(db.prepare(`SELECT state FROM assignment_submissions WHERE assignment_id='assignment-1' AND student_account_id='student-1'`).get().state, 'returned');
const feedback = db.prepare(`SELECT teacher_account_id,feedback_json,returned_at FROM assignment_feedback
  WHERE assignment_id='assignment-1' AND student_account_id='student-1'`).get();
assert.equal(feedback.teacher_account_id, 'teacher-1');
assert.equal(JSON.parse(feedback.feedback_json).note, 'Rework factorisation in question 4.');
assert.equal(feedback.returned_at, now + 40);

const revised = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: { attempted: 10, revised: true }, now: now + 50
});
assert.equal(revised.state, 'started');
const resubmitted = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { attempted: 10, revised: true }, now: now + 60
});
assert.equal(resubmitted.submittedAt, now + 60);

assert.throws(() => returnStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', teacherId: 'teacher-1',
  feedback: { blob: 'x'.repeat(40 * 1024) }, now: now + 70
}), error => error?.code === 'FEEDBACK_TOO_LARGE');

const audit = db.prepare(`SELECT action,target_id FROM audit_log WHERE action='assignment.return'`).all();
assert.deepEqual(audit, [{ action: 'assignment.return', target_id: 'assignment-1' }]);

db.close();
console.log('PASS — classroom submissions cannot be silently unsubmitted; teacher returns are bounded, persisted and auditable.');
