// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the way into the Exam Desk, on a library paper (plan F4b)
//
// Drawn by the library's resource page for a paper that has a question count,
// and only where PRI_FEATURE_EXAM_DESK is on:
//   · "Practise at the desk" starts an attempt (the server answers with the
//     open one if there is one — a student never gets a second by accident);
//   · "Continue your attempt" when one is open;
//   · the attempts already closed, by date, with the time used and the
//     student's own done / flagged / note counts. There is no result column:
//     the desk has none to show.
// Starting needs a connection; nothing is started on the device alone.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import { formatClock } from '../engine/deskClock.js';
import { deskApi, newKey, unreachable } from './deskApi.js';
import './desk.css';

/** Whether a library resource can be sat at the desk: a paper with 1–200 questions. */
export const deskable = r => r?.type === 'paper' && Number.isInteger(r.questionCount) && r.questionCount >= 1 && r.questionCount <= 200;
const dateOf = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** The entry as drawn, given this paper's attempts. Exported for client/test/desk-ui-check.mjs. */
export function DeskEntryView({ t, attempts, error, busy, onStart }) {
  const open = attempts.find(a => a.state !== 'finished') || null;
  const closed = attempts.filter(a => a.state === 'finished');
  return (
    <section className="dk-entry" aria-labelledby="dk-entry-title" data-desk-entry>
      <h2 id="dk-entry-title">{t('desk.entryTitle')}</h2>
      <p className="dk-plate" data-desk-unmarked>{t('desk.unmarked')}</p>
      <p>{t('desk.entryLead')}</p>
      <div className="dk-actions">
        {open
          ? <PageLink to={`/desk/${open.id}`} className="btn btn-primary" data-desk-continue>{t('desk.continue')}</PageLink>
          : <button type="button" className="btn btn-primary" onClick={onStart} disabled={busy} data-desk-start>{t('desk.start')}</button>}
        <PageLink to="/desk/import" className="btn btn-ghost" data-desk-import-link>{t('desk.importLink')}</PageLink>
      </div>
      {error && <p className="dk-honest" role="alert" data-desk-start-error>{t(error)}</p>}
      {closed.length > 0 && (
        <>
          <h3>{t('desk.earlier')}</h3>
          <ul className="dk-history">
            {closed.map(a => (
              <li key={a.id}>
                <PageLink to={`/desk/${a.id}`}>{dateOf(a.finishedAt || a.createdAt)}</PageLink>
                <span className="in-note">
                  {a.origin === 'prithagoras-import' ? t('desk.historyImported') : t('desk.historyTime', { time: formatClock(a.time?.elapsedWorkingMs || 0) })}
                  {' · '}{t('desk.tallies', { done: a.tallies?.done || 0, flagged: a.tallies?.flagged || 0, notes: a.tallies?.notes || 0 })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function DeskEntry({ resource }) {
  const t = useT();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(null);
  useEffect(() => {
    let live = true;
    // The attempts already made on this paper. If the list cannot be read the
    // entry still offers Start: the server answers with the open attempt.
    deskApi.list().then(data => { if (live) setAttempts((data.attempts || []).filter(a => a.resourceId === resource.id)); }).catch(() => {});
    return () => { live = false; };
  }, [resource.id]);
  const start = async () => {
    setBusy(true); setError(null);
    // One key per press, kept for its retries: a second tap is the same start.
    key.current ||= newKey();
    try {
      const reply = await deskApi.start(resource.id, key.current);
      key.current = null;
      navigate(`/desk/${reply.attempt.id}`);
    } catch (err) {
      setError(unreachable(err) ? 'desk.needsConnection' : err?.status === 401 ? 'desk.signedOut' : 'desk.startFailed');
      setBusy(false);
    }
  };
  if (!deskable(resource)) return null;
  return <DeskEntryView t={t} attempts={attempts} error={error} busy={busy} onStart={start} />;
}
