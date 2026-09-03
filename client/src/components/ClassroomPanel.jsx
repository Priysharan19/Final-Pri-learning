import React, { useEffect, useMemo, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { assignmentSubmissions } from '../platform/assignmentReview.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';

function niceDate(value) {
  if (!value) return 'No due date';
  try { return new Date(value).toLocaleString(); } catch { return 'Due date unavailable'; }
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'teacher') return 'Teacher';
  return 'Student';
}

function stateLabel(state) {
  if (state === 'submitted') return 'Submitted';
  if (state === 'returned') return 'Returned';
  if (state === 'started') return 'In progress';
  return 'Not started';
}

export default function ClassroomPanel() {
  const enabled = cloudAvailable();
  const [account, setAccount] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [assignment, setAssignment] = useState({ title: '', instructions: '', questions: 10, due: '' });
  const [review, setReview] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const staff = ['teacher', 'admin'].includes(account?.role);
  const selected = useMemo(() => classes.find(row => row.id === selectedId) || null, [classes, selectedId]);

  async function loadClasses({ keepSelection = true } = {}) {
    if (!enabled) return;
    const [me, list] = await Promise.all([cloud.me(), cloud.classes()]);
    const rows = Array.isArray(list?.classes) ? list.classes : [];
    setAccount(me?.account || null);
    setClasses(rows);
    const next = keepSelection && rows.some(row => row.id === selectedId)
      ? selectedId
      : (rows[0]?.id || '');
    setSelectedId(next);
  }

  async function loadDetail(classId = selectedId, role = account?.role) {
    if (!classId) {
      setDetail(null);
      setStudents([]);
      return;
    }
    const data = await cloud.classDetails(classId);
    setDetail(data);
    if (['teacher', 'admin'].includes(role)) {
      const roster = await cloud.classStudents(classId);
      setStudents(Array.isArray(roster?.students) ? roster.students : []);
    } else setStudents([]);
  }

  async function loadReview(assignmentId) {
    if (!selectedId || !assignmentId) return;
    setBusy(`review:${assignmentId}`); setError(''); setMessage('');
    try {
      const result = await assignmentSubmissions(selectedId, assignmentId);
      setReview(result || null);
      const drafts = {};
      for (const row of result?.submissions || []) {
        const note = row.feedback?.note;
        if (note) drafts[row.student.id] = String(note);
      }
      setFeedbackDraft(drafts);
    } catch (err) {
      setError(err.message || 'Could not load assignment submissions.');
      setReview(null);
    } finally { setBusy(''); }
  }

  useEffect(() => {
    let live = true;
    if (!enabled) return () => { live = false; };

    const refresh = async () => {
      try {
        await loadClasses({ keepSelection: false });
        if (live) setError('');
      } catch (err) {
        if (!live) return;
        if (err?.status === 401) {
          setAccount(null);
          setClasses([]);
          setSelectedId('');
          setDetail(null);
          setStudents([]);
          setReview(null);
          setError('');
          return;
        }
        setError(err.message || 'Classrooms could not be loaded.');
      }
    };

    refresh();
    const stop = onCloudSessionChange(() => { refresh(); });
    return () => { live = false; stop(); };
  }, [enabled]);

  useEffect(() => {
    setReview(null);
    setFeedbackDraft({});
    if (!selectedId || !account) {
      setDetail(null);
      setStudents([]);
      return;
    }
    loadDetail(selectedId, account.role).catch(err => setError(err.message || 'Class details could not be loaded.'));
  }, [selectedId, account?.role]);

  async function createClass(e) {
    e.preventDefault();
    const name = className.trim();
    if (!name) return;
    setBusy('class'); setError(''); setMessage(''); setJoinCode('');
    try {
      const result = await cloud.createClass(name);
      setClassName('');
      setJoinCode(result?.joinCode || '');
      await loadClasses({ keepSelection: false });
      if (result?.class?.id) setSelectedId(result.class.id);
      setMessage('Class created. Share the join code with students using a trusted channel.');
    } catch (err) { setError(err.message || 'Could not create the class.'); }
    finally { setBusy(''); }
  }

  async function joinClass(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy('join'); setError(''); setMessage('');
    try {
      const result = await cloud.joinClass(code);
      setJoinCode('');
      await loadClasses({ keepSelection: false });
      if (result?.class?.id) setSelectedId(result.class.id);
      setMessage('Class joined.');
    } catch (err) { setError(err.message || 'Could not join that class.'); }
    finally { setBusy(''); }
  }

  async function createAssignment(e) {
    e.preventDefault();
    if (!selectedId) return;
    const title = assignment.title.trim();
    const instructions = assignment.instructions.trim();
    if (!title || !instructions) {
      setError('Give the assignment a title and clear instructions.');
      return;
    }
    const questionCount = Math.max(1, Math.min(50, Number(assignment.questions) || 10));
    const dueAt = assignment.due ? new Date(assignment.due).getTime() : null;
    setBusy('assignment'); setError(''); setMessage('');
    try {
      await cloud.createAssignment(selectedId, {
        title,
        specification: { kind: 'practice', instructions, questionCount },
        dueAt: Number.isFinite(dueAt) ? dueAt : null
      });
      setAssignment({ title: '', instructions: '', questions: 10, due: '' });
      await loadDetail(selectedId, account?.role);
      setMessage('Assignment published to this class.');
    } catch (err) { setError(err.message || 'Could not create the assignment.'); }
    finally { setBusy(''); }
  }

  async function returnForRevision(row) {
    const note = String(feedbackDraft[row.student.id] || '').trim();
    if (!note) {
      setError('Add a short feedback note before returning an assignment for revision.');
      return;
    }
    if (note.length > 4000) {
      setError('Teacher feedback must be 4000 characters or fewer.');
      return;
    }
    setBusy(`return:${row.student.id}`); setError(''); setMessage('');
    try {
      await cloud.returnSubmission(selectedId, review.assignment.id, row.student.id, { note });
      await loadReview(review.assignment.id);
      await loadDetail(selectedId, account?.role);
      setMessage(`${row.student.name || 'Student'} can now revise and resubmit this assignment.`);
    } catch (err) { setError(err.message || 'Could not return this submission.'); }
    finally { setBusy(''); }
  }

  if (!enabled) return null;
  if (!account) return null;

  return (
    <section className="card" aria-labelledby="classroom-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="classroom-title" style={{ marginBottom: 4 }}>Classes & assignments</div>
          <p className="sub" style={{ margin: 0, maxWidth: 760 }}>
            Cloud classrooms are optional. Practice remains local-first; class membership, assignment metadata, aggregate completion and teacher feedback use the authenticated Pri Learning account. Student answers and handwriting stay out of classroom progress sync.
          </p>
        </div>
        <span className="tag tag-brand">{roleLabel(account.role)}</span>
      </div>

      {error && <div className="notice error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {message && <div className="notice success" role="status" style={{ marginTop: 14 }}>{message}</div>}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div>
          {staff ? (
            <form onSubmit={createClass} className="card" style={{ padding: 14 }}>
              <strong>Create a class</strong>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Class name</span>
                <input value={className} maxLength={120} onChange={e => setClassName(e.target.value)} placeholder="Class 10 Mathematics" />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy === 'class'}>{busy === 'class' ? 'Creating…' : 'Create class'}</button>
              {joinCode && <div className="notice" style={{ marginTop: 10 }}><strong>Join code:</strong> <code>{joinCode}</code><br /><span className="muted">This code is shown after creation so you can share it with your students.</span></div>}
            </form>
          ) : (
            <form onSubmit={joinClass} className="card" style={{ padding: 14 }}>
              <strong>Join a class</strong>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Teacher join code</span>
                <input value={joinCode} maxLength={12} autoCapitalize="characters" onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy === 'join'}>{busy === 'join' ? 'Joining…' : 'Join class'}</button>
            </form>
          )}

          <div style={{ marginTop: 14 }}>
            <strong>Your classes</strong>
            {!classes.length && <p className="muted">No classes yet.</p>}
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {classes.map(row => (
                <button key={row.id} type="button" className={`btn ${selectedId === row.id ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'space-between' }} onClick={() => setSelectedId(row.id)}>
                  <span>{row.name}</span><span className="muted">{row.archived ? 'Archived' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {!selected && <p className="muted">Choose a class to see its assignments.</p>}
          {selected && detail && <>
            <div className="spread" style={{ gap: 10 }}>
              <div><strong>{detail.class?.name || selected.name}</strong><div className="muted">{staff ? `${students.length} student${students.length === 1 ? '' : 's'}` : 'Student view'}</div></div>
            </div>

            {staff && <form onSubmit={createAssignment} className="card" style={{ padding: 14, marginTop: 12 }}>
              <strong>Publish assignment</strong>
              <label className="field" style={{ marginTop: 10 }}><span>Title</span><input value={assignment.title} maxLength={160} onChange={e => setAssignment(v => ({ ...v, title: e.target.value }))} placeholder="Linear equations practice" /></label>
              <label className="field"><span>Instructions</span><textarea rows={3} value={assignment.instructions} onChange={e => setAssignment(v => ({ ...v, instructions: e.target.value }))} placeholder="Complete the assigned practice and show full working." /></label>
              <div className="grid-2" style={{ gap: 10 }}>
                <label className="field"><span>Questions</span><input type="number" min="1" max="50" value={assignment.questions} onChange={e => setAssignment(v => ({ ...v, questions: e.target.value }))} /></label>
                <label className="field"><span>Due</span><input type="datetime-local" value={assignment.due} onChange={e => setAssignment(v => ({ ...v, due: e.target.value }))} /></label>
              </div>
              <button className="btn btn-primary btn-sm" disabled={busy === 'assignment'}>{busy === 'assignment' ? 'Publishing…' : 'Publish assignment'}</button>
            </form>}

            <div style={{ marginTop: 14 }}>
              <strong>Assignments</strong>
              {!detail.assignments?.length && <p className="muted">No assignments have been published.</p>}
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(detail.assignments || []).map(row => (
                  <div key={row.id} className="card" style={{ padding: 12 }}>
                    <div className="spread"><strong>{row.title}</strong>{row.submission?.state && <span className="tag">{row.submission.state}</span>}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{niceDate(row.dueAt)}</div>
                    {row.submission?.feedback && <div className="notice" style={{ marginTop: 8 }}>Teacher feedback is available for this submission.</div>}
                    {staff && <div style={{ marginTop: 10 }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy === `review:${row.id}`} onClick={() => loadReview(row.id)}>
                        {busy === `review:${row.id}` ? 'Loading…' : 'Review submissions'}
                      </button>
                    </div>}
                  </div>
                ))}
              </div>
            </div>

            {staff && review?.assignment && <div className="card" style={{ padding: 14, marginTop: 14 }}>
              <div className="spread" style={{ gap: 10 }}>
                <div>
                  <strong>Submission review · {review.assignment.title}</strong>
                  <div className="muted">Only aggregate completion metrics are available here. Student answers and handwriting are not uploaded to this view.</div>
                </div>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setReview(null)}>Close</button>
              </div>

              {!review.submissions?.length && <p className="muted" style={{ marginTop: 12 }}>No enrolled students.</p>}
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {(review.submissions || []).map(row => {
                  const target = row.summary?.targetQuestions || review.assignment.specification?.questionCount || 10;
                  const answered = row.summary?.questionsAnswered || 0;
                  const correct = row.summary?.correct || 0;
                  return (
                    <div key={row.student.id} className="card" style={{ padding: 12 }}>
                      <div className="spread" style={{ gap: 10 }}>
                        <div><strong>{row.student.name || 'Student'}</strong><div className="muted">{answered}/{target} completed · {correct} correct</div></div>
                        <span className={`tag ${row.state === 'submitted' ? 'tag-brand' : ''}`}>{stateLabel(row.state)}</span>
                      </div>
                      {row.submittedAt && <div className="muted" style={{ marginTop: 5 }}>Submitted {niceDate(row.submittedAt)}</div>}
                      {row.feedback?.note && <div className="notice" style={{ marginTop: 8 }}><strong>Latest feedback:</strong> {row.feedback.note}</div>}
                      {row.state === 'submitted' && <div style={{ marginTop: 10 }}>
                        <label className="field">
                          <span>Feedback for revision</span>
                          <textarea rows={2} maxLength={4000} value={feedbackDraft[row.student.id] || ''}
                            onChange={e => setFeedbackDraft(current => ({ ...current, [row.student.id]: e.target.value }))}
                            placeholder="Explain exactly what the student should revisit before resubmitting." />
                        </label>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy === `return:${row.student.id}`} onClick={() => returnForRevision(row)}>
                          {busy === `return:${row.student.id}` ? 'Returning…' : 'Return for revision'}
                        </button>
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>}
          </>}
        </div>
      </div>
    </section>
  );
}
