import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';

function dueText(value) {
  if (!value) return 'No due date';
  try { return `Due ${new Date(value).toLocaleString()}`; } catch { return 'Due date unavailable'; }
}

function stateText(state) {
  if (state === 'submitted') return 'Submitted';
  if (state === 'returned') return 'Returned for revision';
  if (state === 'started') return 'In progress';
  return 'Not started';
}

export default function AssignmentInboxPanel() {
  const nav = useNavigate();
  const enabled = cloudAvailable();
  const [role, setRole] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    if (!enabled) return () => { live = false; };
    Promise.all([cloud.me(), cloud.assignments()])
      .then(([me, result]) => {
        if (!live) return;
        setRole(me?.account?.role || null);
        setAssignments(Array.isArray(result?.assignments) ? result.assignments : []);
      })
      .catch(err => {
        if (!live || err?.status === 401) return;
        setError(err.message || 'Assignments could not be loaded.');
      });
    return () => { live = false; };
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
          <div className="card-title" id="assignment-inbox-title" style={{ marginBottom: 4 }}>My assignments</div>
          <p className="sub" style={{ margin: 0, maxWidth: 760 }}>
            Teacher assignment metadata is cloud-backed, while questions, handwriting and marking still run through Pri Learning’s normal local-first Practice engine.
          </p>
        </div>
        <span className="tag">{assignments.length}</span>
      </div>

      {error && <div className="notice error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {!assignments.length && !error && <p className="muted" style={{ marginTop: 14 }}>No active assignments.</p>}

      <div style={{ display: 'grid', gap: 10, marginTop: assignments.length ? 14 : 0 }}>
        {assignments.map(row => {
          const count = Math.max(1, Math.min(50, Number(row.specification?.questionCount) || 10));
          const state = row.submission?.state || null;
          return (
            <div className="card" key={row.id} style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10 }}>
                <div>
                  <strong>{row.title}</strong>
                  <div className="muted" style={{ marginTop: 3 }}>{row.className} · {count} question{count === 1 ? '' : 's'} · {dueText(row.dueAt)}</div>
                </div>
                <span className={`tag ${state === 'submitted' ? 'tag-brand' : ''}`}>{stateText(state)}</span>
              </div>
              {row.specification?.instructions && <p style={{ margin: '10px 0 0' }}>{String(row.specification.instructions)}</p>}
              {row.submission?.feedback && <div className="notice" style={{ marginTop: 10 }}>Your teacher returned feedback. Reopen the assignment to revise and resubmit.</div>}
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => openAssignment(row)}>
                {state === 'submitted' ? 'Review assignment' : state === 'started' ? 'Resume assignment' : state === 'returned' ? 'Revise assignment' : 'Start assignment'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
