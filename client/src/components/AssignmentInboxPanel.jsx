import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { useT } from '../i18n/index.js';

function dueText(t, value) {
  if (!value) return t('classroom.noDueDate');
  try { return t('inbox.dueOn', { date: new Date(value).toLocaleString() }); } catch { return t('classroom.dueUnavailable'); }
}

function stateText(t, state) {
  if (state === 'submitted') return t('assignment.submitted');
  if (state === 'returned') return t('inbox.returnedForRevision');
  if (state === 'started') return t('classroom.inProgress');
  return t('classroom.notStarted');
}

export default function AssignmentInboxPanel() {
  const nav = useNavigate();
  const t = useT();
  const enabled = cloudAvailable();
  const [role, setRole] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    if (!enabled) return () => { live = false; };

    const load = async () => {
      try {
        const [me, result] = await Promise.all([cloud.me(), cloud.assignments()]);
        if (!live) return;
        setRole(me?.account?.role || null);
        setAssignments(Array.isArray(result?.assignments) ? result.assignments : []);
        setError('');
      } catch (err) {
        if (!live) return;
        if (err?.status === 401) {
          setRole(null);
          setAssignments([]);
          setError('');
          return;
        }
        setError(err.message || t('inbox.loadFailed'));
      }
    };

    load();
    const stop = onCloudSessionChange(() => { load(); });
    return () => { live = false; stop(); };
  }, [enabled]);

  if (!enabled || role !== 'student') return null;

  function openAssignment(row) {
    const query = new URLSearchParams({ classId: row.classId, assignment: row.id });
    nav(`/practice?${query.toString()}`);
  }

  return (
    <section className="card" aria-labelledby="assignment-inbox-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="assignment-inbox-title" style={{ marginBottom: 4 }}>{t('inbox.title')}</div>
          <p className="sub" style={{ margin: 0, maxWidth: 760 }}>
            {t('inbox.intro')}
          </p>
        </div>
        <span className="tag">{assignments.length}</span>
      </div>

      {error && <div className="notice error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {!assignments.length && !error && <p className="muted" style={{ marginTop: 14 }}>{t('inbox.empty')}</p>}

      <div style={{ display: 'grid', gap: 10, marginTop: assignments.length ? 14 : 0 }}>
        {assignments.map(row => {
          const count = Math.max(1, Math.min(50, Number(row.specification?.questionCount) || 10));
          const state = row.submission?.state || null;
          return (
            <div className="card" key={row.id} style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10 }}>
                <div>
                  <strong>{row.title}</strong>
                  <div className="muted" style={{ marginTop: 3 }}>{row.className} · {t('common.questionsCounted', { count, n: count })} · {dueText(t, row.dueAt)}</div>
                </div>
                <span className={`tag ${state === 'submitted' ? 'tag-brand' : ''}`}>{stateText(t, state)}</span>
              </div>
              {row.specification?.instructions && <p style={{ margin: '10px 0 0' }}>{String(row.specification.instructions)}</p>}
              {row.submission?.feedback && <div className="notice" style={{ marginTop: 10 }}>{t('inbox.feedbackReturned')}</div>}
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => openAssignment(row)}>
                {state === 'submitted' ? t('inbox.review') : state === 'started' ? t('inbox.resume') : state === 'returned' ? t('inbox.revise') : t('inbox.start')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
