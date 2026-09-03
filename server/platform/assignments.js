import { Router } from 'express';
import { sanitizeAssignmentSummary } from './assignmentProgress.js';
import { requireSession } from './security.js';

function parseObject(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function submission(row) {
  if (!row?.submission_state) return null;
  return {
    state: row.submission_state,
    summary: sanitizeAssignmentSummary(parseObject(row.submission_summary_json)),
    submittedAt: row.submitted_at || null,
    updatedAt: row.submission_updated_at || null,
    feedback: row.feedback_json ? parseObject(row.feedback_json) : null,
    returnedAt: row.returned_at || null
  };
}

function publicAssignment(row) {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    title: row.title,
    specification: parseObject(row.specification_json),
    dueAt: row.due_at || null,
    createdAt: row.created_at,
    submission: submission(row)
  };
}

function staffAuthorised(db, accountId, role, classId) {
  if (role === 'admin') {
    return !!db.prepare('SELECT 1 FROM classes WHERE id=? AND archived_at IS NULL').get(classId);
  }
  if (role !== 'teacher') return false;
  return !!db.prepare('SELECT 1 FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL')
    .get(classId, accountId);
}

export function listAssignmentsForAccount(db, accountId, role) {
  if (role === 'student') {
    const rows = db.prepare(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name,
      s.state AS submission_state,s.summary_json AS submission_summary_json,s.submitted_at,s.updated_at AS submission_updated_at,
      f.feedback_json,f.returned_at
      FROM assignments a
      JOIN classes c ON c.id=a.class_id
      JOIN class_members cm ON cm.class_id=c.id AND cm.student_account_id=? AND cm.removed_at IS NULL
      LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_account_id=?
      LEFT JOIN assignment_feedback f ON f.assignment_id=a.id AND f.student_account_id=?
      WHERE c.archived_at IS NULL AND a.archived_at IS NULL
      ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END,a.due_at,a.created_at DESC`).all(accountId, accountId, accountId);
    return rows.map(publicAssignment);
  }

  if (role === 'teacher' || role === 'admin') {
    const rows = role === 'admin'
      ? db.prepare(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
          FROM assignments a JOIN classes c ON c.id=a.class_id
          WHERE c.archived_at IS NULL AND a.archived_at IS NULL ORDER BY a.created_at DESC LIMIT 250`).all()
      : db.prepare(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
          FROM assignments a JOIN classes c ON c.id=a.class_id
          WHERE c.teacher_account_id=? AND c.archived_at IS NULL AND a.archived_at IS NULL
          ORDER BY a.created_at DESC LIMIT 250`).all(accountId);
    return rows.map(publicAssignment);
  }

  return [];
}

export function assignmentForAccount(db, accountId, role, classId, assignmentId) {
  let authorised = false;
  if (role === 'admin') authorised = true;
  else if (role === 'teacher') {
    authorised = !!db.prepare(`SELECT 1 FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL`).get(classId, accountId);
  } else if (role === 'student') {
    authorised = !!db.prepare(`SELECT 1 FROM class_members cm JOIN classes c ON c.id=cm.class_id
      WHERE cm.class_id=? AND cm.student_account_id=? AND cm.removed_at IS NULL AND c.archived_at IS NULL`).get(classId, accountId);
  }
  if (!authorised) return null;

  const row = db.prepare(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name,
    s.state AS submission_state,s.summary_json AS submission_summary_json,s.submitted_at,s.updated_at AS submission_updated_at,
    f.feedback_json,f.returned_at
    FROM assignments a JOIN classes c ON c.id=a.class_id
    LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_account_id=?
    LEFT JOIN assignment_feedback f ON f.assignment_id=a.id AND f.student_account_id=?
    WHERE a.id=? AND a.class_id=? AND a.archived_at IS NULL AND c.archived_at IS NULL`).get(accountId, accountId, assignmentId, classId);
  return row ? publicAssignment(row) : null;
}

export function assignmentSubmissionsForStaff(db, accountId, role, classId, assignmentId) {
  if (!staffAuthorised(db, accountId, role, classId)) return null;
  const assignment = db.prepare(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
    FROM assignments a JOIN classes c ON c.id=a.class_id
    WHERE a.id=? AND a.class_id=? AND a.archived_at IS NULL AND c.archived_at IS NULL`).get(assignmentId, classId);
  if (!assignment) return null;

  const rows = db.prepare(`SELECT ac.id AS student_id,ac.name AS student_name,
    s.state AS submission_state,s.summary_json AS submission_summary_json,s.started_at,s.submitted_at,s.updated_at AS submission_updated_at,
    f.feedback_json,f.returned_at
    FROM class_members cm
    JOIN accounts ac ON ac.id=cm.student_account_id
    LEFT JOIN assignment_submissions s ON s.assignment_id=? AND s.student_account_id=ac.id
    LEFT JOIN assignment_feedback f ON f.assignment_id=? AND f.student_account_id=ac.id
    WHERE cm.class_id=? AND cm.removed_at IS NULL AND ac.deleted_at IS NULL
    ORDER BY ac.name COLLATE NOCASE,ac.id`).all(assignmentId, assignmentId, classId);

  return {
    assignment: publicAssignment({ ...assignment, submission_state: null }),
    submissions: rows.map(row => ({
      student: { id: row.student_id, name: row.student_name },
      state: row.submission_state || 'not_started',
      summary: row.submission_state ? sanitizeAssignmentSummary(parseObject(row.submission_summary_json)) : null,
      startedAt: row.started_at || null,
      submittedAt: row.submitted_at || null,
      updatedAt: row.submission_updated_at || null,
      feedback: row.feedback_json ? parseObject(row.feedback_json) : null,
      returnedAt: row.returned_at || null
    }))
  };
}

export function createAssignmentExecutionRouter(db) {
  const router = Router();
  router.use(requireSession(db));

  router.get('/', (req, res) => {
    const assignments = listAssignmentsForAccount(db, req.platformSession.account_id, req.platformSession.role);
    res.json({ assignments });
  });

  router.get('/:classId/:assignmentId/submissions', (req, res) => {
    const result = assignmentSubmissionsForStaff(
      db,
      req.platformSession.account_id,
      req.platformSession.role,
      String(req.params.classId || ''),
      String(req.params.assignmentId || '')
    );
    if (!result) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
    res.json(result);
  });

  router.get('/:classId/:assignmentId', (req, res) => {
    const assignment = assignmentForAccount(
      db,
      req.platformSession.account_id,
      req.platformSession.role,
      String(req.params.classId || ''),
      String(req.params.assignmentId || '')
    );
    if (!assignment) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
    res.json({ assignment });
  });

  return router;
}
