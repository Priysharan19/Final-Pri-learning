import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
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

async function staffAuthorised(db, accountId, role, classId) {
  if (role === 'admin') {
    return !!await db.get('SELECT 1 FROM classes WHERE id=? AND archived_at IS NULL', [classId]);
  }
  if (role !== 'teacher') return false;
  return !!await db.get('SELECT 1 FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL', [classId, accountId]);
}

export async function listAssignmentsForAccount(db, accountId, role) {
  db = asStore(db);
  if (role === 'student') {
    const rows = await db.all(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name,
      s.state AS submission_state,s.summary_json AS submission_summary_json,s.submitted_at,s.updated_at AS submission_updated_at,
      f.feedback_json,f.returned_at
      FROM assignments a
      JOIN classes c ON c.id=a.class_id
      JOIN class_members cm ON cm.class_id=c.id AND cm.student_account_id=? AND cm.removed_at IS NULL
      LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_account_id=?
      LEFT JOIN assignment_feedback f ON f.assignment_id=a.id AND f.student_account_id=?
      WHERE c.archived_at IS NULL AND a.archived_at IS NULL
      ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END,a.due_at,a.created_at DESC`, [accountId, accountId, accountId]);
    return rows.map(publicAssignment);
  }

  if (role === 'teacher' || role === 'admin') {
    const rows = role === 'admin'
      ? await db.all(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
          FROM assignments a JOIN classes c ON c.id=a.class_id
          WHERE c.archived_at IS NULL AND a.archived_at IS NULL ORDER BY a.created_at DESC LIMIT 250`)
      : await db.all(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
          FROM assignments a JOIN classes c ON c.id=a.class_id
          WHERE c.teacher_account_id=? AND c.archived_at IS NULL AND a.archived_at IS NULL
          ORDER BY a.created_at DESC LIMIT 250`, [accountId]);
    return rows.map(publicAssignment);
  }

  return [];
}

export async function assignmentForAccount(db, accountId, role, classId, assignmentId) {
  db = asStore(db);
  let authorised = false;
  if (role === 'admin') authorised = true;
  else if (role === 'teacher') {
    authorised = !!await db.get(`SELECT 1 FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL`, [classId, accountId]);
  } else if (role === 'student') {
    authorised = !!await db.get(`SELECT 1 FROM class_members cm JOIN classes c ON c.id=cm.class_id
      WHERE cm.class_id=? AND cm.student_account_id=? AND cm.removed_at IS NULL AND c.archived_at IS NULL`, [classId, accountId]);
  }
  if (!authorised) return null;

  const row = await db.get(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name,
    s.state AS submission_state,s.summary_json AS submission_summary_json,s.submitted_at,s.updated_at AS submission_updated_at,
    f.feedback_json,f.returned_at
    FROM assignments a JOIN classes c ON c.id=a.class_id
    LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_account_id=?
    LEFT JOIN assignment_feedback f ON f.assignment_id=a.id AND f.student_account_id=?
    WHERE a.id=? AND a.class_id=? AND a.archived_at IS NULL AND c.archived_at IS NULL`, [accountId, accountId, assignmentId, classId]);
  return row ? publicAssignment(row) : null;
}

export async function assignmentSubmissionsForStaff(db, accountId, role, classId, assignmentId) {
  db = asStore(db);
  if (!(await staffAuthorised(db, accountId, role, classId))) return null;
  const assignment = await db.get(`SELECT a.id,a.class_id,a.title,a.specification_json,a.due_at,a.created_at,c.name AS class_name
    FROM assignments a JOIN classes c ON c.id=a.class_id
    WHERE a.id=? AND a.class_id=? AND a.archived_at IS NULL AND c.archived_at IS NULL`, [assignmentId, classId]);
  if (!assignment) return null;

  const rows = await db.all(`SELECT ac.id AS student_id,ac.name AS student_name,
    s.state AS submission_state,s.summary_json AS submission_summary_json,s.started_at,s.submitted_at,s.updated_at AS submission_updated_at,
    f.feedback_json,f.returned_at
    FROM class_members cm
    JOIN accounts ac ON ac.id=cm.student_account_id
    LEFT JOIN assignment_submissions s ON s.assignment_id=? AND s.student_account_id=ac.id
    LEFT JOIN assignment_feedback f ON f.assignment_id=? AND f.student_account_id=ac.id
    WHERE cm.class_id=? AND cm.removed_at IS NULL AND ac.deleted_at IS NULL
    ORDER BY ${db.nocaseOrder('ac.name')},${db.binaryText('ac.id')}`, [assignmentId, assignmentId, classId]);

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
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db));

  router.get('/', async (req, res) => {
    const assignments = await listAssignmentsForAccount(db, req.platformSession.account_id, req.platformSession.role);
    res.json({ assignments });
  });

  router.get('/:classId/:assignmentId/submissions', async (req, res) => {
    const result = await assignmentSubmissionsForStaff(
      db,
      req.platformSession.account_id,
      req.platformSession.role,
      String(req.params.classId || ''),
      String(req.params.assignmentId || '')
    );
    if (!result) return res.status(404).json({ error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' } });
    res.json(result);
  });

  router.get('/:classId/:assignmentId', async (req, res) => {
    const assignment = await assignmentForAccount(
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
