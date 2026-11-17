// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher workspace for one class (lazy-loaded from
// ClassroomPanel on /teach)
//
//   · CLASS BOARD — per outcome, how many students are in each evidence state
//     (server/platform/classBoard.js). Each state is the syllabus board's own
//     SHAPE and WORD (progress/SyllabusBoard.jsx StateGlyph, board.state.*),
//     never a colour alone and never a percentage. A count opens the names
//     behind it. Re-teach names the misconception by its registry name.
//     Behind PRI_FEATURE_SYLLABUS_BOARD, as the student board is.
//   · PAPERS — set a timed paper the server issues and marks, then read the
//     results: engine marks and teacher marks always in separate, labelled
//     columns; Export CSV downloads the server's own file.
// Nothing here calls a model, and nothing here suggests a mark.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { featureEnabled } from '../platform/features.js';
import { defaultCourse } from '../platform/edition.js';
import { tLater, useT } from '../i18n/index.js';
import { StateGlyph, STATE_WORD } from '../progress/SyllabusBoard.jsx';
import { SUBTOPIC_BY_ID } from '../engine/curriculum.js';
import {
  INDIA_PAPERS, PAPER_MINUTES, isPaperAssignment, misconceptionName, paperLabel, pathwaysForYear, questionLabel
} from './classroomWords.js';

const errText = (err, fallback) => (err?.code === 'CLOUD_WEB_ONLY' ? tLater('tw.webOnly') : (err?.message || tLater(fallback)));

// ── Class board ──────────────────────────────────────────────────────────────

function ClassBoard({ classId }) {
  const t = useT();
  const [courses, setCourses] = useState(null);
  const [course, setCourse] = useState('');
  const [board, setBoard] = useState(null);
  const [drill, setDrill] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const drillRef = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    let live = true;
    cloud.boardCourses().then(r => {
      if (!live) return;
      const list = Array.isArray(r?.courses) ? r.courses : [];
      setCourses(list);
      setCourse(list[0]?.id || '');
    }).catch(err => { if (live) { setCourses([]); setError(errText(err, 'tw.board.loadFailed')); } });
    return () => { live = false; };
  }, [classId]);

  useEffect(() => {
    let live = true;
    setBoard(null); setDrill(null);
    if (!course) return () => { live = false; };
    setBusy(true);
    cloud.classBoard(classId, course).then(r => { if (live) { setBoard(r); setError(''); } })
      .catch(err => { if (live) setError(err?.code === 'CLASS_BOARD_NOT_YET' ? tLater('tw.board.notYet') : errText(err, 'tw.board.loadFailed')); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [classId, course]);

  useEffect(() => { if (drill) drillRef.current?.focus(); }, [drill?.node]);

  const askedRef = useRef('');
  askedRef.current = `${classId}|${course}`;
  async function openDrill(node, event) {
    opener.current = event?.currentTarget || null;
    const asked = `${classId}|${course}`;
    try {
      const r = await cloud.classBoard(classId, course, node.id);
      // The class or course changed while this was in flight: drop the answer.
      if (asked !== askedRef.current) return;
      setDrill({ node: node.id, code: node.code, group: node.groupName, states: r?.drill?.states || {} });
    } catch (err) { setError(errText(err, 'tw.board.loadFailed')); }
  }
  function closeDrill() { setDrill(null); opener.current?.focus?.(); }

  if (courses === null) return <p className="muted">{t('common.loading')}</p>;
  // Priyabhata: the server cannot draw the board yet, and says why.
  if (!courses.length) return <div className="notice" role="note" data-class-board-not-yet>{t('tw.board.notYet')}</div>;

  const states = Array.isArray(board?.states) ? board.states : [];
  return (
    <div className="tw-board" data-class-board>
      <div className="tw-row">
        <label className="tw-inline-field" htmlFor="tw-board-course">
          <span>{t('board.course')}</span>
          <select className="input" id="tw-board-course" value={course} onChange={e => setCourse(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{t('board.courseLabelPlain', { name: c.name, version: c.version })}</option>)}
          </select>
        </label>
      </div>

      <p className="tw-note" data-board-honest-note>{t('tw.board.evidenceNote')}</p>
      {board?.withheld > 0 && <p className="tw-note" data-board-withheld>{t('tw.board.withheld', { count: board.withheld, n: board.withheld })}</p>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {busy && !board && <p className="muted">{t('common.loading')}</p>}

      {board && <>
        <p className="tw-lede">{t('tw.board.lede', { count: board.students, n: board.students })}</p>

        <div className="table-scroll">
          <table className="table tw-board-table">
            <caption className="sr-only">{t('tw.board.caption', { course: board.course?.name || '' })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('tw.board.outcomeArea')}</th>
                {states.map(s => (
                  <th scope="col" key={s} className="tw-state-head">
                    <StateGlyph state={s} size={14} /><span>{t(STATE_WORD[s])}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
            {board.groups.map(g => (
                g.nodes.map(n => (
                  <tr key={n.id}>
                    <th scope="row" className="tw-outcome"><span className="tw-code">{n.code}</span><span className="tw-outcome-area">{g.name}</span></th>
                    {states.map(s => {
                      const count = Number(n.counts?.[s]) || 0;
                      const word = t(STATE_WORD[s]);
                      return (
                        <td key={s} className="tw-count">
                          {count > 0 ? (
                            <button type="button" className="tw-count-btn" data-drill={`${n.id}:${s}`}
                              aria-expanded={drill?.node === n.id} aria-controls="tw-drill"
                              aria-label={t('tw.board.countLabel', { count, n: count, state: word, code: n.code })}
                              onClick={e => openDrill({ ...n, groupName: g.name }, e)}>
                              <StateGlyph state={s} size={12} /><span>{count}</span>
                            </button>
                          ) : <span className="tw-zero" aria-label={t('tw.board.countLabel', { count: 0, n: 0, state: word, code: n.code })}>0</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))
            ))}
            </tbody>
          </table>
        </div>

        {drill && (
          <div className="tw-panel" id="tw-drill" role="region" tabIndex={-1} ref={drillRef} data-board-drill={drill.node}
            aria-label={t('tw.board.drillTitle', { code: drill.code })}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closeDrill(); } }}>
            <div className="tw-row tw-spread">
              <div>
                <h4 className="tw-h">{t('tw.board.drillTitle', { code: drill.code })}</h4>
                <div className="muted">{drill.group}</div>
              </div>
              <button type="button" className="btn btn-quiet btn-sm" onClick={closeDrill}>{t('board.close')}</button>
            </div>
            <dl className="tw-drill-list">
              {states.filter(s => (drill.states[s] || []).length).map(s => (
                <div key={s}>
                  <dt><StateGlyph state={s} size={14} /> {t(STATE_WORD[s])}</dt>
                  <dd>{drill.states[s].map(p => p.name).join(', ')}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <section className="tw-section" aria-labelledby="tw-reteach-title">
          <h4 className="tw-h" id="tw-reteach-title">{t('tw.reteach.title')}</h4>
          {!board.reteach?.length
            ? <p className="muted">{t('tw.reteach.none')}</p>
            : <ol className="tw-reteach" data-reteach>
              {board.reteach.map(r => (
                <li key={`${r.node}|${r.misconception}`}>
                  <span className="tw-code">{r.node}</span>
                  <span>{misconceptionName(t, r.misconception) || t('tw.reteach.unnamed')}</span>
                  <span className="muted">{t('tw.reteach.share', { students: r.students, of: r.of })}</span>
                </li>
              ))}
            </ol>}
          {board.reteachRule && <p className="tw-note">{t('tw.reteach.rule', {
            min: board.reteachRule.minStudents, share: Math.round(Number(board.reteachRule.minShare) * 100), days: board.reteachRule.windowDays
          })}</p>}
        </section>
      </>}
    </div>
  );
}

// ── Papers ───────────────────────────────────────────────────────────────────

const NSW_EDITION = defaultCourse() === 'nsw';
const blankPaper = () => ({
  title: '', due: '', instructions: '',
  kind: NSW_EDITION ? 'practice-paper' : 'india', blueprint: '', year: 7, minutes: 30, pathway: '', india: INDIA_PAPERS[0].id
});

function PaperForm({ classId, nswPapers, onPublished, onUntimed }) {
  const t = useT();
  const [form, setForm] = useState(blankPaper);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: '', text: '' });
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const pathways = pathwaysForYear(form.year);

  function template() {
    if (form.kind === 'nsw') return form.blueprint ? { kind: 'nsw', blueprint: form.blueprint } : null;
    if (form.kind === 'practice-paper') {
      const pathway = Number(form.year) >= 11 ? (form.pathway || pathways[0]?.id || null) : null;
      return { kind: 'practice-paper', year: Number(form.year), minutes: Number(form.minutes), ...(pathway ? { pathway } : {}) };
    }
    const p = INDIA_PAPERS.find(x => x.id === form.india) || INDIA_PAPERS[0];
    return { kind: 'india', track: p.track, grade: p.grade, variant: p.variant };
  }

  async function submit(e) {
    e.preventDefault();
    const title = form.title.trim();
    const paper = template();
    if (!title || !paper) { setStatus({ kind: 'error', text: tLater('tw.paper.needsTitle') }); return; }
    const dueAt = form.due ? new Date(form.due).getTime() : null;
    setBusy(true); setStatus({ kind: '', text: '' });
    try {
      await cloud.createAssignment(classId, {
        title,
        specification: { kind: 'paper', paper, ...(form.instructions.trim() ? { instructions: form.instructions.trim() } : {}) },
        dueAt: Number.isFinite(dueAt) ? dueAt : null
      });
      setForm(blankPaper());
      setStatus({ kind: 'success', text: tLater('tw.paper.published') });
      onPublished?.();
    } catch (err) { setStatus({ kind: 'error', text: errText(err, 'tw.paper.publishFailed') }); }
    finally { setBusy(false); }
  }

  const released = (nswPapers || []).filter(p => p.released);
  return (
    <form className="tw-panel" onSubmit={submit} aria-labelledby="tw-paper-form-title" data-paper-form>
      <h4 className="tw-h" id="tw-paper-form-title">{t('tw.paper.formTitle')}</h4>
      <p className="tw-note">{t('tw.paper.timedOnly')}{' '}
        <button type="button" className="btn btn-quiet btn-sm" onClick={onUntimed} data-untimed-link>{t('tw.paper.untimedLink')}</button>
      </p>
      <div className="field">
        <label className="label" htmlFor="tw-paper-title">{t('classroom.assignmentTitle')}</label>
        <input className="input" id="tw-paper-title" value={form.title} maxLength={160} onChange={e => set({ title: e.target.value })} placeholder={t('tw.paper.titlePlaceholder')} />
      </div>

      {NSW_EDITION ? (
        <fieldset className="tw-fieldset">
          <legend className="label">{t('tw.paper.which')}</legend>
          {released.length > 0 && <label className="tw-radio"><input type="radio" name="tw-kind" checked={form.kind === 'nsw'} onChange={() => set({ kind: 'nsw', blueprint: form.blueprint || released[0].id })} /> {t('tw.paper.kindNsw')}</label>}
          <label className="tw-radio"><input type="radio" name="tw-kind" checked={form.kind === 'practice-paper'} onChange={() => set({ kind: 'practice-paper' })} /> {t('tw.paper.kindPractice')}</label>
        </fieldset>
      ) : null}

      {form.kind === 'nsw' && (
        <div className="field">
          <label className="label" htmlFor="tw-paper-nsw">{t('tw.paper.nswPaper')}</label>
          <select className="input" id="tw-paper-nsw" value={form.blueprint} onChange={e => set({ blueprint: e.target.value })}>
            {released.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      )}
      {form.kind === 'practice-paper' && (
        <div className="tw-grid3">
          <div className="field">
            <label className="label" htmlFor="tw-paper-year">{t('exams.yearLevel')}</label>
            <select className="input" id="tw-paper-year" value={form.year} onChange={e => set({ year: Number(e.target.value), pathway: '' })}>
              {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{t('common.yearNumber', { n: y })}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="tw-paper-minutes">{t('exams.timeLimit')}</label>
            <select className="input" id="tw-paper-minutes" value={form.minutes} onChange={e => set({ minutes: Number(e.target.value) })}>
              {PAPER_MINUTES.map(m => <option key={m} value={m}>{t('exams.minutesOption', { count: m, n: m })}</option>)}
            </select>
          </div>
          {Number(form.year) >= 11 && (
            <div className="field">
              <label className="label" htmlFor="tw-paper-pathway">{t('tw.paper.pathway')}</label>
              <select className="input" id="tw-paper-pathway" value={form.pathway || pathways[0]?.id || ''} onChange={e => set({ pathway: e.target.value })}>
                {pathways.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      {form.kind === 'india' && (
        <div className="field">
          <label className="label" htmlFor="tw-paper-india">{t('tw.paper.indiaPaper')}</label>
          <select className="input" id="tw-paper-india" value={form.india} onChange={e => set({ india: e.target.value })}>
            {INDIA_PAPERS.map(p => <option key={p.id} value={p.id}>{t(p.key)}</option>)}
          </select>
        </div>
      )}

      <div className="tw-grid3">
        <div className="field">
          <label className="label" htmlFor="tw-paper-due">{t('classroom.due')}</label>
          <input className="input" id="tw-paper-due" type="datetime-local" value={form.due} onChange={e => set({ due: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="tw-paper-instructions">{t('tw.paper.instructionsOptional')}</label>
        <textarea className="input" id="tw-paper-instructions" rows={2} maxLength={1000} value={form.instructions} onChange={e => set({ instructions: e.target.value })} />
      </div>
      <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? t('classroom.publishing') : t('tw.paper.publish')}</button>
      <div aria-live="polite" className={status.text ? `notice ${status.kind}` : ''} style={status.text ? { marginTop: 10 } : undefined}>{status.text}</div>
    </form>
  );
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PaperResults({ classId, assignment, label, onClose }) {
  const t = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const head = useRef(null);

  useEffect(() => {
    let live = true;
    setData(null); setError('');
    cloud.paperResults(classId, assignment.id).then(r => { if (live) setData(r); })
      .catch(err => { if (live) setError(errText(err, 'tw.results.loadFailed')); });
    return () => { live = false; };
  }, [classId, assignment.id]);
  useEffect(() => { head.current?.focus(); }, [assignment.id]);

  async function exportCsv() {
    setExporting(true); setExportStatus('');
    try {
      const text = await cloud.paperResultsCsv(classId, assignment.id);
      const safe = String(assignment.title || 'results').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'results';
      downloadText(String(text || ''), `${safe}-results.csv`);
      setExportStatus(tLater('tw.results.exported'));
    } catch (err) { setExportStatus(errText(err, 'tw.results.exportFailed')); }
    finally { setExporting(false); }
  }

  const handedIn = (data?.students || []).filter(s => s.handedIn).length;
  return (
    <section className="tw-panel" aria-labelledby="tw-results-title" data-paper-results={assignment.id}>
      <div className="tw-row tw-spread">
        <div>
          <h4 className="tw-h" id="tw-results-title" tabIndex={-1} ref={head}>{t('tw.results.title', { title: assignment.title })}</h4>
          <div className="muted">{label}</div>
        </div>
        <div className="tw-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={exporting} data-export-csv>{exporting ? t('common.loading') : t('tw.results.exportCsv')}</button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>{t('nav.close')}</button>
        </div>
      </div>
      <div aria-live="polite" className="tw-note">{exportStatus}</div>
      <p className="tw-note">{t('tw.results.separateNote')}</p>
      {error && <div className="notice error" role="alert">{error}</div>}
      {!data && !error && <p className="muted">{t('common.loading')}</p>}
      {data && <>
        <p className="tw-lede">{t('tw.results.handedIn', { handed: handedIn, total: data.students.length })}</p>
        {data.withheld > 0 && <p className="tw-note">{t('tw.board.withheld', { count: data.withheld, n: data.withheld })}</p>}

        <h5 className="tw-h5">{t('tw.results.byQuestion')}</h5>
        {!data.questions.length ? <p className="muted">{t('tw.results.noneYet')}</p> : (
          <div className="table-scroll">
            <table className="table tw-results">
              <caption className="sr-only">{t('tw.results.byQuestion')}</caption>
              <thead><tr>
                <th scope="col">{t('tw.results.question')}</th>
                <th scope="col">{t('tw.results.outcome')}</th>
                <th scope="col">{t('tw.results.correct')}</th>
                <th scope="col">{t('tw.results.engineMarks')}</th>
                <th scope="col" className="tw-teacher-col">{t('tw.results.teacherMarks')}</th>
                <th scope="col">{t('tw.results.firstBreaks')}</th>
              </tr></thead>
              <tbody>
                {data.questions.map(q => (
                  <tr key={`${q.order}:${q.part ?? ''}`}>
                    <th scope="row">{questionLabel(q)}</th>
                    <td lang="en">{q.outcomes.map(o => SUBTOPIC_BY_ID[o]?.name || o).join(', ') || '—'}</td>
                    <td>{t('tw.results.correctOf', { correct: q.correct, sat: q.sat })}</td>
                    <td>{t('tw.results.marksOf', { awarded: q.engineAwarded, marks: q.marks })}</td>
                    <td className="tw-teacher-col">{q.teacherAwarded}</td>
                    <td>{q.commonFirstBreaks.length
                      ? q.commonFirstBreaks.map(b => t('tw.results.breakLine', { name: misconceptionName(t, b.misconception) || t('tw.reteach.unnamed'), count: b.students, n: b.students })).join('; ')
                      : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h5 className="tw-h5">{t('tw.results.byStudent')}</h5>
        <div className="table-scroll">
          <table className="table tw-results">
            <caption className="sr-only">{t('tw.results.byStudent')}</caption>
            <thead><tr>
              <th scope="col">{t('teach.student')}</th>
              <th scope="col">{t('tw.results.handedInCol')}</th>
              <th scope="col">{t('tw.results.engineMark')}</th>
              <th scope="col" className="tw-teacher-col">{t('tw.results.teacherMarks')}</th>
              <th scope="col">{t('tw.results.withTeacher')}</th>
            </tr></thead>
            <tbody>
              {data.students.map(r => (
                <tr key={r.student.id}>
                  <th scope="row">{r.student.name}</th>
                  {r.handedIn ? <>
                    <td>{new Date(r.handedInAt).toLocaleDateString()}</td>
                    <td>{t('tw.results.marksOf', { awarded: r.engine.score, marks: r.engine.total })}</td>
                    <td className="tw-teacher-col">{r.teacher.awarded}</td>
                    <td>{t('tw.results.marksOf', { awarded: r.withTeacherMarks.score, marks: r.withTeacherMarks.total })}</td>
                  </> : <td colSpan={4} className="muted">{t('tw.results.notHandedIn')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </section>
  );
}

function Papers({ classId, onUntimed }) {
  const t = useT();
  const [rows, setRows] = useState(null);
  const [nswPapers, setNswPapers] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const r = await cloud.assignments();
      setRows((Array.isArray(r?.assignments) ? r.assignments : []).filter(a => a.classId === classId && isPaperAssignment(a)));
      setError('');
    } catch (err) { setRows([]); setError(errText(err, 'tw.paper.loadFailed')); }
  }
  useEffect(() => { setOpen(null); load(); }, [classId]);
  useEffect(() => {
    if (!NSW_EDITION) return;
    cloud.nswExams().then(r => setNswPapers(Array.isArray(r?.papers) ? r.papers : [])).catch(() => setNswPapers([]));
  }, []);
  const titles = useMemo(() => Object.fromEntries((nswPapers || []).map(p => [p.id, p.title])), [nswPapers]);

  return (
    <div className="tw-papers">
      <PaperForm classId={classId} nswPapers={nswPapers} onPublished={load} onUntimed={onUntimed} />
      <section className="tw-section" aria-labelledby="tw-paper-list-title">
        <h4 className="tw-h" id="tw-paper-list-title">{t('tw.paper.listTitle')}</h4>
        {error && <div className="notice error" role="alert">{error}</div>}
        {rows === null ? <p className="muted">{t('common.loading')}</p> : !rows.length ? <p className="muted">{t('tw.paper.none')}</p> : (
          <ul className="tw-list" data-paper-list>
            {rows.map(a => (
              <li key={a.id} className="tw-list-row">
                <div>
                  <strong>{a.title}</strong>
                  <div className="muted">{paperLabel(t, a.specification.paper, titles)} · {a.dueAt ? t('inbox.dueOn', { date: new Date(a.dueAt).toLocaleString() }) : t('classroom.noDueDate')}</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open?.id === a.id} onClick={() => setOpen(open?.id === a.id ? null : a)} data-open-results={a.id}>
                  {t('tw.results.open')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open && <PaperResults classId={classId} assignment={open} label={paperLabel(t, open.specification.paper, titles)} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── The workspace ────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'board', key: 'tw.tab.board', on: () => featureEnabled('syllabusBoard') },
  { id: 'papers', key: 'tw.tab.papers', on: () => true }
];

export default function TeacherWorkspace({ classId, className, onUntimed }) {
  const t = useT();
  const views = VIEWS.filter(v => v.on());
  const [view, setView] = useState(views[0].id);
  return (
    <section className="tw" aria-labelledby="tw-title" data-teacher-workspace={classId}>
      <div className="tw-row tw-spread">
        <h3 className="tw-title" id="tw-title">{t('tw.title', { name: className })}</h3>
        <div className="seg" role="group" aria-label={t('tw.viewsLabel')}>
          {views.map(v => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} data-tw-view={v.id}>{t(v.key)}</button>)}
        </div>
      </div>
      <p className="tw-note">{t('tw.freeNote')}</p>
      {view === 'board' && <ClassBoard classId={classId} />}
      {view === 'papers' && <Papers classId={classId} onUntimed={onUntimed} />}
    </section>
  );
}
