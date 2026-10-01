import React, { useEffect, useMemo, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { assignmentSubmissions } from '../platform/assignmentReview.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { useT } from '../i18n/index.js';

function niceDate(t, value) {
  if (!value) return t('classroom.noDueDate');
  try { return new Date(value).toLocaleString(); } catch { return t('classroom.dueUnavailable'); }
}

function roleLabel(t, role) {
  if (role === 'admin') return t('classroom.roleAdmin');
  if (role === 'teacher') return t('login.teacher');
  return t('login.student');
}

function stateLabel(t, state) {
  if (state === 'submitted') return t('assignment.submitted');
  if (state === 'returned') return t('classroom.stateReturned');
  if (state === 'started') return t('classroom.inProgress');
  return t('classroom.notStarted');
}

export default function ClassroomPanel() {
  const t = useT();
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
      setError(err.message || t('classroom.loadSubmissionsFailed'));
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
        setError(err.message || t('classroom.loadClassesFailed'));
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
    loadDetail(selectedId, account.role).catch(err => setError(err.message || t('classroom.loadDetailFailed')));
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
      setMessage(t('classroom.classCreated'));
    } catch (err) { setError(err.message || t('classroom.createClassFailed')); }
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
      setMessage(t('classroom.classJoined'));
    } catch (err) { setError(err.message || t('classroom.joinClassFailed')); }
    finally { setBusy(''); }
  }

  async function createAssignment(e) {
    e.preventDefault();
    if (!selectedId) return;
    const title = assignment.title.trim();
    const instructions = assignment.instructions.trim();
    if (!title || !instructions) {
      setError(t('classroom.assignmentNeedsTitle'));
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
      setMessage(t('classroom.assignmentPublished'));
    } catch (err) { setError(err.message || t('classroom.createAssignmentFailed')); }
    finally { setBusy(''); }
  }

  async function returnForRevision(row) {
    const note = String(feedbackDraft[row.student.id] || '').trim();
    if (!note) {
      setError(t('classroom.feedbackRequired'));
      return;
    }
    if (note.length > 4000) {
      setError(t('classroom.feedbackTooLong'));
      return;
    }
    setBusy(`return:${row.student.id}`); setError(''); setMessage('');
    try {
      await cloud.returnSubmission(selectedId, review.assignment.id, row.student.id, { note });
      await loadReview(review.assignment.id);
      await loadDetail(selectedId, account?.role);
      setMessage(t('classroom.returnedForRevision', { name: row.student.name || t('login.student') }));
    } catch (err) { setError(err.message || t('classroom.returnFailed')); }
    finally { setBusy(''); }
  }

  if (!enabled) return null;
  if (!account) return null;

  return (
    <section className="card" aria-labelledby="classroom-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="classroom-title" style={{ marginBottom: 4 }}>{t('classroom.title')}</div>
          <p className="sub" style={{ margin: 0, maxWidth: 760 }}>
            {t('classroom.intro')}
          </p>
        </div>
        <span className="tag tag-brand">{roleLabel(t, account.role)}</span>
      </div>

      {error && <div className="notice error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {message && <div className="notice success" role="status" style={{ marginTop: 14 }}>{message}</div>}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div>
          {staff ? (
            <form onSubmit={createClass} className="card" style={{ padding: 14 }}>
              <strong>{t('classroom.createHeading')}</strong>
              <label className="field" style={{ marginTop: 10 }}>
                <span>{t('classroom.className')}</span>
                <input value={className} maxLength={120} onChange={e => setClassName(e.target.value)} placeholder={t('classroom.classNamePlaceholder')} />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy === 'class'}>{busy === 'class' ? t('classroom.creating') : t('classroom.createClass')}</button>
              {joinCode && <div className="notice" style={{ marginTop: 10 }}><strong>{t('classroom.joinCodeLabel')}</strong> <code>{joinCode}</code><br /><span className="muted">{t('classroom.joinCodeNote')}</span></div>}
            </form>
          ) : (
            <form onSubmit={joinClass} className="card" style={{ padding: 14 }}>
              <strong>{t('classroom.joinHeading')}</strong>
              <label className="field" style={{ marginTop: 10 }}>
                <span>{t('classroom.teacherJoinCode')}</span>
                <input value={joinCode} maxLength={12} autoCapitalize="characters" onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy === 'join'}>{busy === 'join' ? t('classroom.joining') : t('classroom.joinClass')}</button>
            </form>
          )}

          <div style={{ marginTop: 14 }}>
            <strong>{t('classroom.yourClasses')}</strong>
            {!classes.length && <p className="muted">{t('classroom.noClasses')}</p>}
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {classes.map(row => (
                <button key={row.id} type="button" className={`btn ${selectedId === row.id ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'space-between' }} onClick={() => setSelectedId(row.id)}>
                  <span>{row.name}</span><span className="muted">{row.archived ? t('classroom.archived') : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {!selected && <p className="muted">{t('classroom.chooseClass')}</p>}
          {selected && detail && <>
            <div className="spread" style={{ gap: 10 }}>
              <div><strong>{detail.class?.name || selected.name}</strong><div className="muted">{staff ? t('classroom.studentCount', { count: students.length, n: students.length }) : t('classroom.studentView')}</div></div>
            </div>

            {staff && <form onSubmit={createAssignment} className="card" style={{ padding: 14, marginTop: 12 }}>
              <strong>{t('classroom.publishAssignment')}</strong>
              <label className="field" style={{ marginTop: 10 }}><span>{t('classroom.assignmentTitle')}</span><input value={assignment.title} maxLength={160} onChange={e => setAssignment(v => ({ ...v, title: e.target.value }))} placeholder={t('classroom.titlePlaceholder')} /></label>
              <label className="field"><span>{t('classroom.instructions')}</span><textarea rows={3} value={assignment.instructions} onChange={e => setAssignment(v => ({ ...v, instructions: e.target.value }))} placeholder={t('classroom.instructionsPlaceholder')} /></label>
              <div className="grid-2" style={{ gap: 10 }}>
                <label className="field"><span>{t('classroom.questions')}</span><input type="number" min="1" max="50" value={assignment.questions} onChange={e => setAssignment(v => ({ ...v, questions: e.target.value }))} /></label>
                <label className="field"><span>{t('classroom.due')}</span><input type="datetime-local" value={assignment.due} onChange={e => setAssignment(v => ({ ...v, due: e.target.value }))} /></label>
              </div>
              <button className="btn btn-primary btn-sm" disabled={busy === 'assignment'}>{busy === 'assignment' ? t('classroom.publishing') : t('classroom.publishAssignment')}</button>
            </form>}

            <div style={{ marginTop: 14 }}>
              <strong>{t('classroom.assignments')}</strong>
              {!detail.assignments?.length && <p className="muted">{t('classroom.noAssignments')}</p>}
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(detail.assignments || []).map(row => (
                  <div key={row.id} className="card" style={{ padding: 12 }}>
                    <div className="spread"><strong>{row.title}</strong>{row.submission?.state && <span className="tag">{stateLabel(t, row.submission.state)}</span>}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{niceDate(t, row.dueAt)}</div>
                    {row.submission?.feedback && <div className="notice" style={{ marginTop: 8 }}>{t('classroom.feedbackAvailable')}</div>}
                    {staff && <div style={{ marginTop: 10 }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy === `review:${row.id}`} onClick={() => loadReview(row.id)}>
                        {busy === `review:${row.id}` ? t('common.loading') : t('classroom.reviewSubmissions')}
                      </button>
                    </div>}
                  </div>
                ))}
              </div>
            </div>

            {staff && review?.assignment && <div className="card" style={{ padding: 14, marginTop: 14 }}>
              <div className="spread" style={{ gap: 10 }}>
                <div>
                  <strong>{t('classroom.submissionReview', { title: review.assignment.title })}</strong>
                  <div className="muted">{t('classroom.reviewPrivacy')}</div>
                </div>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setReview(null)}>{t('nav.close')}</button>
              </div>

              {!review.submissions?.length && <p className="muted" style={{ marginTop: 12 }}>{t('classroom.noStudents')}</p>}
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {(review.submissions || []).map(row => {
                  const target = row.summary?.targetQuestions || review.assignment.specification?.questionCount || 10;
                  const answered = row.summary?.questionsAnswered || 0;
                  const correct = row.summary?.correct || 0;
                  return (
                    <div key={row.student.id} className="card" style={{ padding: 12 }}>
                      <div className="spread" style={{ gap: 10 }}>
                        <div><strong>{row.student.name || t('login.student')}</strong><div className="muted">{t('classroom.progressLine', { answered, target, correct })}</div></div>
                        <span className={`tag ${row.state === 'submitted' ? 'tag-brand' : ''}`}>{stateLabel(t, row.state)}</span>
                      </div>
                      {row.submittedAt && <div className="muted" style={{ marginTop: 5 }}>{t('classroom.submittedAt', { date: niceDate(t, row.submittedAt) })}</div>}
                      {row.feedback?.note && <div className="notice" style={{ marginTop: 8 }}><strong>{t('classroom.latestFeedback')}</strong> {row.feedback.note}</div>}
                      {row.state === 'submitted' && <div style={{ marginTop: 10 }}>
                        <label className="field">
                          <span>{t('classroom.feedbackForRevision')}</span>
                          <textarea rows={2} maxLength={4000} value={feedbackDraft[row.student.id] || ''}
                            onChange={e => setFeedbackDraft(current => ({ ...current, [row.student.id]: e.target.value }))}
                            placeholder={t('classroom.feedbackPlaceholder')} />
                        </label>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy === `return:${row.student.id}`} onClick={() => returnForRevision(row)}>
                          {busy === `return:${row.student.id}` ? t('classroom.returning') : t('classroom.returnForRevision')}
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
