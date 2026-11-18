// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's side of the teacher workspace
//
//   · PaperAssignment — a paper a teacher set: "Sit the paper" (the existing
//     exam flow) and "Hand in a finished paper" (POST …/hand-in with one of the
//     student's own server-marked papers). Every refusal is said in plain words.
//   · WhatTeacherSees — GET /v1/classroom/mine: what a teacher can and cannot
//     see, whether sharing is on, and the student's teacher marks, each
//     labelled "Teacher mark" and kept apart from the engine's mark.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { cloud } from '../platform/cloudTransport.js';
import { featureEnabled } from '../platform/features.js';
import { tLater, useT } from '../i18n/index.js';
import { CRITERION_WORD, HANDIN_ERROR, NEVER_WORD, SEES_WORD, paperLabel } from './classroomWords.js';

const UUID = /^[0-9a-f-]{36}$/i;
const lengthFor = minutes => (minutes >= 45 ? 15 : 10);

/** How this device can start the paper a teacher set, or null (then the student is sent to Exams). */
function startBody(paper, user) {
  if (paper?.kind === 'nsw' && user?.course === 'nsw' && featureEnabled('nswExams')) return { nsw: paper.blueprint };
  if (paper?.kind === 'practice-paper' && user?.course === 'nsw') return { year: paper.year, minutes: paper.minutes, length: lengthFor(paper.minutes) };
  return null;
}

export function PaperAssignment({ row, handin, onHandedIn }) {
  const t = useT();
  const nav = useNavigate();
  const { user } = useApp();
  const paper = row.specification.paper;
  const [open, setOpen] = useState(false);
  const [papers, setPapers] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState({ kind: '', text: '' });
  const body = startBody(paper, user);

  async function sit() {
    if (!body) { nav('/exams'); return; }
    setBusy('sit'); setStatus({ kind: '', text: '' });
    try {
      const r = await api.post('/exams', body);
      nav(`/exams/${r.exam.id}`);
    } catch (err) { setStatus({ kind: 'error', text: err.message || tLater('tw.student.sitFailed') }); }
    finally { setBusy(''); }
  }

  async function openHandIn() {
    setOpen(true);
    try {
      const r = await api.get('/exams');
      const since = Number(row.createdAt) || 0;
      const done = (r?.exams || []).filter(e => e.finished_at && e.marked_by === 'server' && UUID.test(String(e.id)) && Number(e.created_at) >= since - 60000);
      setPapers(done);
      setChoice(done[0]?.id || '');
    } catch { setPapers([]); }
  }

  async function handIn(e) {
    e.preventDefault();
    if (!choice) return;
    setBusy('handin'); setStatus({ kind: '', text: '' });
    try {
      await cloud.handInPaper(row.classId, row.id, choice);
      setStatus({ kind: 'success', text: tLater('tw.handin.done') });
      setOpen(false);
      onHandedIn?.();
    } catch (err) {
      const key = HANDIN_ERROR[err?.code];
      setStatus({ kind: 'error', text: key ? tLater(key) : (err.message || tLater('tw.handin.failed')) });
    } finally { setBusy(''); }
  }

  return (
    <div className="tw-student-paper" data-paper-assignment={row.id}>
      <div className="muted">{paperLabel(t, paper)} · {t('tw.student.timed')}</div>
      {handin ? (
        <p className="tw-note" data-handed-in>{t('tw.student.handedIn', { date: new Date(handin.handedInAt).toLocaleDateString(), score: handin.engine.score, total: handin.engine.total })}</p>
      ) : (
        <>
          {!body && <p className="tw-note">{t('tw.student.sitOnExams', { paper: paperLabel(t, paper) })}</p>}
          <div className="tw-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={sit} disabled={busy === 'sit'} data-sit-paper>{busy === 'sit' ? t('common.loading') : (body ? t('tw.student.sit') : t('tw.student.openExams'))}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openHandIn} aria-expanded={open} data-open-handin>{t('tw.student.handIn')}</button>
          </div>
          {open && (
            <form className="tw-panel" onSubmit={handIn} style={{ marginTop: 10 }}>
              {papers === null ? <p className="muted">{t('common.loading')}</p> : !papers.length ? <p className="muted">{t('tw.student.noFinished')}</p> : <>
                <div className="field">
                  <label className="label" htmlFor={`tw-handin-${row.id}`}>{t('tw.student.choosePaper')}</label>
                  <select className="input" id={`tw-handin-${row.id}`} value={choice} onChange={e => setChoice(e.target.value)}>
                    {papers.map(p => <option key={p.id} value={p.id}>{t('tw.student.paperOption', { title: p.title, date: new Date(p.finished_at).toLocaleDateString(), score: p.score ?? 0, total: p.total ?? 0 })}</option>)}
                  </select>
                </div>
                <p className="tw-note">{t('tw.student.handInNote')}</p>
                <button className="btn btn-primary btn-sm" disabled={busy === 'handin'}>{busy === 'handin' ? t('common.loading') : t('tw.student.handInConfirm')}</button>
              </>}
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)} style={{ marginLeft: 8 }}>{t('nav.close')}</button>
            </form>
          )}
        </>
      )}
      <div aria-live="polite" className={status.text ? `notice ${status.kind}` : ''} style={status.text ? { marginTop: 10 } : undefined}>{status.text}</div>
    </div>
  );
}

function markWords(t, m) {
  const tm = m.teacherMark;
  if (!tm || tm.state === 'awaiting-teacher') return t('tw.student.awaitingTeacher');
  if (tm.decision === 'award') return t('tw.student.awarded', { count: tm.marks, n: tm.marks });
  return t('tw.student.declined');
}

export function WhatTeacherSees({ mine }) {
  const t = useT();
  if (!mine || !mine.classes?.length) return null;
  const sees = mine.visibility?.sees || [];
  const never = mine.visibility?.never || [];
  return (
    <section className="tw-subsection" aria-labelledby="tw-sees-title" data-teacher-can-see>
      <h3 className="tw-h3" id="tw-sees-title">{t('tw.sees.title')}</h3>
      <p className="sub" style={{ margin: 0 }}>{t('tw.sees.classes', { names: mine.classes.map(c => c.name).join(', ') })}</p>
      {mine.sharing !== 'on' && <div className="notice" role="note" style={{ marginTop: 10 }}>{t('tw.sees.paused')}</div>}
      <div className="tw-cols" style={{ marginTop: 12 }}>
        <div>
          <h4 className="tw-h">{t('tw.sees.canSee')}</h4>
          <ul className="tw-plain">{sees.map(k => <li key={k}>{SEES_WORD[k] ? t(SEES_WORD[k]) : k}</li>)}</ul>
        </div>
        <div>
          <h4 className="tw-h">{t('tw.sees.never')}</h4>
          <ul className="tw-plain">{never.map(k => <li key={k}>{NEVER_WORD[k] ? t(NEVER_WORD[k]) : k}</li>)}</ul>
        </div>
      </div>
      {mine.handins?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 className="tw-h">{t('tw.sees.handedIn')}</h4>
          {mine.handins.map(h => (
            <div key={h.assignmentId} className="tw-list-row tw-handin" data-student-handin={h.assignmentId}>
              <div>
                <strong>{h.title}</strong>
                <div><span className="tw-label">{t('tw.student.engineMark')}</span> {t('tw.results.marksOf', { awarded: h.engine.score, marks: h.engine.total })}</div>
                {h.teacherMarks.length > 0 && (
                  <ul className="tw-plain tw-teacher-marks">
                    {h.teacherMarks.map((m, i) => (
                      <li key={`${m.questionKey}:${m.criterion}:${i}`}>
                        <span className="tw-teacher-tag">{t('tw.teacherMark')}</span>{' '}
                        {t('tw.student.markLine', { q: m.order, criterion: t(CRITERION_WORD[m.criterion] || 'tw.criterion.method'), words: markWords(t, m) })}
                        {m.teacherMark?.comment ? <span className="muted"> — {m.teacherMark.comment}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** /v1/classroom/mine, for a student: null until read, or when it cannot be read. */
export function useClassroomMine(enabled, role, refresh = 0) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    let live = true;
    if (!enabled || role !== 'student') { setMine(null); return () => { live = false; }; }
    cloud.classroomMine().then(r => { if (live) setMine(r || null); }).catch(() => { if (live) setMine(null); });
    return () => { live = false; };
  }, [enabled, role, refresh]);
  return mine;
}
