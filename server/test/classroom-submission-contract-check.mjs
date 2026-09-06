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
  summary: { kind: 'practice', questionsAnswered: 2, correct: 1, xp: 10, targetQuestions: 10 }, now: now + 10
});
assert.equal(started.state, 'started');
const submitted = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { kind: 'practice', questionsAnswered: 10, correct: 8, xp: 80, targetQuestions: 10 }, now: now + 20
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
  summary: { kind: 'practice', questionsAnswered: 0, correct: 0, xp: 0, targetQuestions: 10 }, now: now + 50
});
assert.equal(revised.state, 'started');
const resubmitted = writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { kind: 'practice', questionsAnswered: 10, correct: 9, xp: 90, targetQuestions: 10 }, now: now + 60
});
assert.equal(resubmitted.submittedAt, now + 60);

assert.throws(() => returnStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', teacherId: 'teacher-1',
  feedback: { blob: 'x'.repeat(40 * 1024) }, now: now + 70
}), error => error?.code === 'FEEDBACK_TOO_LARGE');

const audit = db.prepare(`SELECT action,target_id FROM audit_log WHERE action='assignment.return'`).all();
assert.deepEqual(audit, [{ action: 'assignment.return', target_id: 'assignment-1' }]);

// ── The privacy guarantee is a property of the writer, not of a path ─────────
//
// Express routes `.../submission/` to the same handler as `.../submission`, so a
// middleware matching the exact path let a trailing slash carry answers and raw
// ink into the classroom control plane while the write still succeeded. Both
// spellings, and the function itself, must strip.
const forbidden = {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 10,
  answers: ['x = 42 (the student wrote this)'], ink: 'RAW-HANDWRITING-STROKES', studentNote: 'private free text'
};
const { startApp } = await import('./support/app-harness.mjs');
const http = await startApp({ db });
try {
  const jar = {};
  const registration = await http.request('/v1/account/register', {
    method: 'POST', jar, body: { email: 'slash.student@example.test', name: 'Slash', password: 'correct-horse-battery', deviceId: 'ipad-slash' }
  });
  assert.equal(registration.status, 201);
  const studentId = registration.data.account.id;
  db.prepare("UPDATE accounts SET email_verified_at=? WHERE id=?").run(now + 80, studentId);
  db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1',?,?)`).run(studentId, now + 80);

  for (const path of [
    `/v1/classes/class-1/assignments/assignment-1/submission`,
    `/v1/classes/class-1/assignments/assignment-1/submission/`
  ]) {
    const response = await http.request(path, { method: 'PATCH', jar, body: { state: 'started', summary: forbidden } });
    assert.equal(response.status, 200, `${path} is the same route`);
    const row = db.prepare(`SELECT summary_json FROM assignment_submissions
      WHERE assignment_id='assignment-1' AND student_account_id=?`).get(studentId).summary_json;
    assert.deepEqual(JSON.parse(row), { kind: 'practice', questionsAnswered: 3, correct: 2, xp: 10 }, `${path} stores metrics only`);
    assert.ok(!/answers|ink|studentNote|wrote this/.test(row), `${path} stores no answer, ink or free text`);
    db.prepare(`DELETE FROM assignment_submissions WHERE assignment_id='assignment-1' AND student_account_id=?`).run(studentId);
  }
} finally {
  await http.close();
}

db.close();
console.log('PASS — classroom submissions cannot be silently unsubmitted; teacher returns are bounded, persisted and auditable; and no spelling of the submission route can store an answer or ink.');
