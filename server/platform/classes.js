import { Router } from 'express';
import { id, opaqueToken, rateLimit, requireRole, requireSession, sha256 } from './security.js';

function classCode() {
  return opaqueToken(6).replace(/[-_]/g, '').slice(0, 8).toUpperCase();
}

function cleanTitle(value, max = 160) {
  const text = String(value || '').trim();
  return text && text.length <= max ? text : null;
}

function teacherOwns(db, teacherId, classId) {
  return !!db.prepare('SELECT id FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL').get(classId, teacherId);
}

export function createClassRouter(db) {
  const router = Router();
  router.use(requireSession(db));

  router.get('/', (req, res) => {
    const accountId = req.platformSession.account_id;
    if (['teacher', 'admin'].includes(req.platformSession.role)) {
      const rows = db.prepare(`SELECT id,name,created_at,archived_at FROM classes WHERE teacher_account_id=? ORDER BY created_at DESC`).all(accountId);
      return res.json({ classes: rows.map(x => ({ id: x.id, name: x.name, createdAt: x.created_at, archived: !!x.archived_at, role: 'teacher' })) });
    }
    const rows = db.prepare(`SELECT c.id,c.name,c.created_at,cm.joined_at
      FROM class_members cm JOIN classes c ON c.id=cm.class_id
      WHERE cm.student_account_id=? AND cm.removed_at IS NULL AND c.archived_at IS NULL ORDER BY cm.joined_at DESC`).all(accountId);
    res.json({ classes: rows.map(x => ({ id: x.id, name: x.name, createdAt: x.created_at, joinedAt: x.joined_at, role: 'student' })) });
  });

  router.post('/', requireRole('teacher', 'admin'), rateLimit(db, 'class-create', { limit: 20, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const name = cleanTitle(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: { code: 'CLASS_NAME_INVALID', message: 'Class name is required.' } });
    let code;
    let hash;
    for (let attempts = 0; attempts < 8; attempts++) {
      code = classCode(); hash = sha256(code);
      if (!db.prepare('SELECT 1 FROM classes WHERE join_code_hash=?').get(hash)) break;
    }
    const classId = id('cls');
    const now = Date.now();
    db.prepare('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)')
      .run(classId, req.platformSession.account_id, name, hash, now);
    db.prepare(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`)
      .run(req.platformSession.account_id, 'class.create', 'class', classId, '{}', now);
    res.status(201).json({ class: { id: classId, name, createdAt: now }, joinCode: code });
  });

  router.post('/join', requireRole('student'), rateLimit(db, 'class-join', { limit: 20, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return res.status(400).json({ error: { code: 'JOIN_CODE_INVALID', message: 'Class code is invalid.' } });
    const row = db.prepare('SELECT id,name FROM classes WHERE join_code_hash=? AND archived_at IS NULL').get(sha256(code));
    if (!row) return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'No active class matches that code.' } });
    const now = Date.now();
    db.prepare(`INSERT INTO class_members(class_id,student_account_id,joined_at,removed_at) VALUES (?,?,?,NULL)
      ON CONFLICT(class_id,student_account_id) DO UPDATE SET joined_at=excluded.joined_at,removed_at=NULL`)
      .run(row.id, req.platformSession.account_id, now);
    res.json({ class: { id: row.id, name: row.name, joinedAt: now } });
  });

  router.get('/:classId', (req, res) => {
    const classId = String(req.params.classId || '');
    const accountId = req.platformSession.account_id;
    const teacher = teacherOwns(db, accountId, classId);
    const member = !!db.prepare('SELECT 1 FROM class_members WHERE class_id=? AND student_account_id=? AND removed_at IS NULL').get(classId, accountId);
    if (!teacher && !member && req.platformSession.role !== 'admin') return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'Class not found.' } });
    const cls = db.prepare('SELECT id,name,teacher_account_id,created_at,archived_at FROM classes WHERE id=?').get(classId);
    const assignments = db.prepare(`SELECT id,title,due_at,created_at,archived_at FROM assignments WHERE class_id=? ORDER BY created_at DESC`).all(classId);
    res.json({ class: { id: cls.id, name: cls.name, createdAt: cls.created_at, archived: !!cls.archived_at }, assignments: assignments.map(x => ({ id: x.id, title: x.title, dueAt: x.due_at, createdAt: x.created_at, archived: !!x.archived_at })), role: teacher ? 'teacher' : 'student' });
  });

  router.get('/:classId/students', requireRole('teacher', 'admin'), (req, res) => {
    const classId = String(req.params.classId || '');
    if (req.platformSession.role !== 'admin' && !teacherOwns(db, req.platformSession.account_id, classId)) return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'Class not found.' } });
    const rows = db.prepare(`SELECT a.id,a.name,cm.joined_at FROM class_members cm JOIN accounts a ON a.id=cm.student_account_id
      WHERE cm.class_id=? AND cm.removed_at IS NULL AND a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE`).all(classId);
    res.json({ students: rows.map(x => ({ id: x.id, name: x.name, joinedAt: x.joined_at })) });
  });

  router.delete('/:classId/students/:studentId', requireRole('teacher', 'admin'), (req, res) => {
    const classId = String(req.params.classId || '');
    if (req.platformSession.role !== 'admin' && !teacherOwns(db, req.platformSession.account_id, classId)) return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'Class not found.' } });
    const info = db.prepare('UPDATE class_members SET removed_at=? WHERE class_id=? AND student_account_id=? AND removed_at IS NULL')
      .run(Date.now(), classId, String(req.params.studentId || ''));
    res.json({ removed: info.changes === 1 });
  });

  router.post('/:classId/assignments', requireRole('teacher', 'admin'), rateLimit(db, 'assignment-create', { limit: 100, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const classId = String(req.params.classId || '');
    if (req.platformSession.role !== 'admin' && !teacherOwns(db, req.platformSession.account_id, classId)) return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'Class not found.' } });
    const title = cleanTitle(req.body?.title);
    const spec = req.body?.specification;
    if (!title || !spec || typeof spec !== 'object' || Array.isArray(spec)) return res.status(400).json({ error: { code: 'ASSIGNMENT_INVALID', message: 'Assignment title and specification are required.' } });
    const encoded = JSON.stringify(spec);
    if (Buffer.byteLength(encoded) > 128 * 1024) return res.status(413).json({ error: { code: 'ASSIGNMENT_TOO_LARGE', message: 'Assignment specification is too large.' } });
    const dueAt = Number.isFinite(Number(req.body?.dueAt)) ? Math.max(Date.now(), Number(req.body.dueAt)) : null;
    const assignmentId = id('asn');
    const now = Date.now();
    db.prepare(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,due_at,created_at)
      VALUES (?,?,?,?,?,?,?)`).run(assignmentId, classId, req.platformSession.account_id, title, encoded, dueAt, now);
    res.status(201).json({ assignment: { id: assignmentId, classId, title, specification: spec, dueAt, createdAt: now } });
  });

  router.patch('/:classId/assignments/:assignmentId/submission', requireRole('student'), (req, res) => {
    const classId = String(req.params.classId || '');
    const assignmentId = String(req.params.assignmentId || '');
    const member = db.prepare('SELECT 1 FROM class_members WHERE class_id=? AND student_account_id=? AND removed_at IS NULL').get(classId, req.platformSession.account_id);
    const assignment = db.prepare('SELECT id FROM assignments WHERE id=? AND class_id=? AND archived_at IS NULL').get(assignmentId, classId);
    if (!member || !assignment) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
    const state = ['started', 'submitted'].includes(req.body?.state) ? req.body.state : null;
    const summary = req.body?.summary && typeof req.body.summary === 'object' && !Array.isArray(req.body.summary) ? req.body.summary : {};
    const encoded = JSON.stringify(summary);
    if (!state || Buffer.byteLength(encoded) > 64 * 1024) return res.status(400).json({ error: { code: 'SUBMISSION_INVALID', message: 'Submission state or summary is invalid.' } });
    const now = Date.now();
    db.prepare(`INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,submitted_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(assignment_id,student_account_id) DO UPDATE SET state=excluded.state,summary_json=excluded.summary_json,
        submitted_at=CASE WHEN excluded.state='submitted' THEN excluded.updated_at ELSE assignment_submissions.submitted_at END,updated_at=excluded.updated_at`)
      .run(assignmentId, req.platformSession.account_id, state, encoded, now, state === 'submitted' ? now : null, now);
    res.json({ ok: true, state, updatedAt: now });
  });

  router.get('/:classId/analytics', requireRole('teacher', 'admin'), (req, res) => {
    const classId = String(req.params.classId || '');
    if (req.platformSession.role !== 'admin' && !teacherOwns(db, req.platformSession.account_id, classId)) return res.status(404).json({ error: { code: 'CLASS_NOT_FOUND', message: 'Class not found.' } });
    const students = db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE class_id=? AND removed_at IS NULL').get(classId)?.n || 0;
    const assignments = db.prepare('SELECT COUNT(*) AS n FROM assignments WHERE class_id=? AND archived_at IS NULL').get(classId)?.n || 0;
    const submissions = db.prepare(`SELECT s.assignment_id,s.student_account_id,s.state,s.summary_json,s.submitted_at,s.updated_at
      FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.class_id=?`).all(classId);
    const submitted = submissions.filter(x => x.state === 'submitted').length;
    res.json({ classId, students, assignments, startedSubmissions: submissions.length, submitted, submissionRows: submissions.map(x => ({ assignmentId: x.assignment_id, studentId: x.student_account_id, state: x.state, summary: JSON.parse(x.summary_json || '{}'), submittedAt: x.submitted_at, updatedAt: x.updated_at })) });
  });

  return router;
}
