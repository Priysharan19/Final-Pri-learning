// Teacher Studio — classes, assigned tasks, class analytics and custom
// questions, all with local profiles on this device. India first: the topic
// picker is the NCERT / JEE / olympiad syllabus, class analytics show the
// evidence the India product shows (attempts, accuracy, chapter mastery, active
// days) and never an HSC-scaled prediction for an Indian student, intervention
// flags carry the plain-language reason a teacher would say out loud, and every
// report prints through the app's own print stylesheet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { downloadJSON, readJSONFile, readTextFile, dateStamp } from '../lib/files.js';
import { parseRoster } from '../lib/csv.js';
import { MathText } from '../lib/latex.jsx';
import { CURRICULUM } from '../engine/curriculum.js';
import { assignmentSections, describeTaskTargets, sectionKeyForChapter } from '../platform/assignmentTarget.js';
import ClassroomPanel from '../components/ClassroomPanel.jsx';

const classWord = course => (course === 'in' ? 'Class' : 'Year');
const yearLabel = s => (s?.year ? `${classWord(s.course)} ${s.year}` : '—');
const localeFor = course => (course === 'in' ? 'en-IN' : 'en-AU');
const shortDate = (ms, course = 'in') => (ms ? new Date(ms).toLocaleDateString(localeFor(course), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const pct = v => (v == null ? '—' : `${v}%`);

const FLAG_MARK = { inactive: '⏸', overdue: '⏰', 'accuracy-drop': '▼', misconception: '↻' };
const EMPTY_TASK = { title: '', syllabus: 'in', sectionKey: 'in-cbse-10', chapters: [], dotpoint: null, difficulty: null, subtopics: [], count: 10, days: 7, customIds: [] };

/** Intervention chips — the label is the chip, the reason is the tooltip and the attention list. */
function FlagChips({ flags }) {
  if (!flags?.length) return <span className="muted">—</span>;
  return (
    <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
      {flags.map(f => <span key={f.code} className="tag" title={f.reason}>{FLAG_MARK[f.code] || '•'} {f.label}</span>)}
    </span>
  );
}

const sheetTable = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: '#111' };
const sheetTh = { textAlign: 'left', borderBottom: '1px solid #999', padding: '6px 6px', fontWeight: 650 };
const sheetTd = { borderBottom: '1px solid #ddd', padding: '6px 6px', verticalAlign: 'top' };

/** A printable sheet on the app's print stylesheet: only the sheet prints. */
function PrintSheet({ title, subtitle, onClose, children }) {
  return (
    <div className="paper-overlay" role="dialog" aria-modal="true" aria-labelledby="teach-print-title">
      <div className="paper-sheet">
        <div className="row no-print" style={{ marginBottom: 14, gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / save PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <h2 id="teach-print-title" style={{ margin: '0 0 4px', color: '#111' }}>{title}</h2>
        <div style={{ color: '#555', marginBottom: 16 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

function ClassReport({ analytics, onClose }) {
  const india = analytics.syllabus !== 'nsw';
  const generated = new Date(analytics.generatedAt || Date.now()).toLocaleString(india ? 'en-IN' : 'en-AU');
  return (
    <PrintSheet title={`Class report — ${analytics.class.name}`} subtitle={`${analytics.students.length} student${analytics.students.length === 1 ? '' : 's'} · generated ${generated} · Pri Learning`} onClose={onClose}>
      <table style={sheetTable}>
        <thead><tr>
          <th style={sheetTh}>Student</th><th style={sheetTh}>Class</th>{!india && <th style={sheetTh}>Predicted</th>}
          <th style={sheetTh}>Answered</th><th style={sheetTh}>Accuracy</th><th style={sheetTh}>Active days (28d)</th>
          {india && <th style={sheetTh}>Chapter mastery</th>}<th style={sheetTh}>Weakest</th><th style={sheetTh}>Needs attention</th>
        </tr></thead>
        <tbody>
          {analytics.students.map(s => (
            <tr key={s.id}>
              <td style={sheetTd}>{s.name}{s.imported ? ' (file)' : ''}</td>
              <td style={sheetTd}>{yearLabel(s)}</td>
              {!india && <td style={sheetTd}>{s.predicted == null ? '—' : `${s.predicted}/100`}</td>}
              <td style={sheetTd}>{s.attempts}</td>
              <td style={sheetTd}>{pct(s.accuracy)}</td>
              <td style={sheetTd}>{s.activeDays == null ? '—' : s.activeDays}</td>
              {india && <td style={sheetTd}>{s.evidence ? `${pct(s.evidence.mastery)} · ${s.evidence.chaptersStarted}/${s.evidence.chaptersTotal} started` : '—'}</td>}
              <td style={sheetTd}>{s.weakestChapters?.length ? s.weakestChapters.map(c => c.name).join(', ') : s.weakest}</td>
              <td style={sheetTd}>{s.flags?.length ? s.flags.map(f => f.reason).join(' ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {analytics.chapters?.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>Chapters this class finds hardest</h3>
          <table style={sheetTable}>
            <thead><tr><th style={sheetTh}>Chapter</th><th style={sheetTh}>Students</th><th style={sheetTh}>Attempts</th><th style={sheetTh}>Accuracy</th><th style={sheetTh}>Mastery</th></tr></thead>
            <tbody>{analytics.chapters.map(c => (
              <tr key={c.id}><td style={sheetTd}>{c.name}</td><td style={sheetTd}>{c.students}</td><td style={sheetTd}>{c.attempts}</td><td style={sheetTd}>{pct(c.accuracy)}</td><td style={sheetTd}>{pct(c.mastery)}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
      {india && <p style={{ color: '#555', fontSize: 12, marginTop: 16 }}>No predicted board or JEE score is shown: Pri Learning reports demonstrated attempts, accuracy and chapter mastery only.</p>}
    </PrintSheet>
  );
}

function StudentReport({ analytics, student, onClose }) {
  const india = student.course === 'in';
  const chapters = (student.chapters || []).filter(c => c.attempts > 0).sort((a, b) => a.mastery - b.mastery);
  const tasks = (analytics.tasks || []).map(t => ({ ...t, mine: t.progress.find(p => p.pid === student.id) })).filter(t => t.mine);
  return (
    <PrintSheet title={`${student.name} — progress report`} subtitle={`${student.courseLabel || yearLabel(student)} · ${analytics.class.name} · ${shortDate(analytics.generatedAt, student.course)}`} onClose={onClose}>
      <table style={sheetTable}>
        <tbody>
          <tr><td style={sheetTd}><b>Questions answered</b></td><td style={sheetTd}>{student.attempts} ({student.correct} correct · {pct(student.accuracy)})</td></tr>
          <tr><td style={sheetTd}><b>Active days (last 28)</b></td><td style={sheetTd}>{student.activeDays == null ? 'not in the file' : student.activeDays} · streak {student.streak} day{student.streak === 1 ? '' : 's'}</td></tr>
          {india && student.evidence && <tr><td style={sheetTd}><b>Chapters</b></td><td style={sheetTd}>{student.evidence.chaptersStarted}/{student.evidence.chaptersTotal} started · {student.evidence.chaptersPractised} practised (5+ attempts) · mastery {pct(student.evidence.mastery)}</td></tr>}
          {!india && <tr><td style={sheetTd}><b>Predicted</b></td><td style={sheetTd}>{student.predicted == null ? '—' : `${student.predicted}/100`}</td></tr>}
          <tr><td style={sheetTd}><b>Needs attention</b></td><td style={sheetTd}>{student.flags?.length ? student.flags.map(f => <div key={f.code}>{f.label} — {f.reason}</div>) : 'Nothing flagged.'}</td></tr>
        </tbody>
      </table>
      {chapters.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>Chapters practised</h3>
          <table style={sheetTable}>
            <thead><tr><th style={sheetTh}>Chapter</th><th style={sheetTh}>Attempts</th><th style={sheetTh}>Accuracy</th><th style={sheetTh}>Mastery</th></tr></thead>
            <tbody>{chapters.map(c => <tr key={c.id}><td style={sheetTd}>{c.name}</td><td style={sheetTd}>{c.attempts}</td><td style={sheetTd}>{pct(c.accuracy)}</td><td style={sheetTd}>{pct(c.mastery)} · {c.band}</td></tr>)}</tbody>
          </table>
        </>
      )}
      {student.misconceptions?.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>Repeated mistakes</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{student.misconceptions.map(m => <li key={m.key}>{m.label} — {m.count}× in {m.subtopicName}</li>)}</ul>
        </>
      )}
      {tasks.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>Tasks</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{tasks.map(t => <li key={t.id}>{t.title}: {t.mine.done}/{t.count}{t.mine.finished ? ' ✓' : t.overdue ? ' · overdue' : ''}</li>)}</ul>
        </>
      )}
      {india && <p style={{ color: '#555', fontSize: 12, marginTop: 16 }}>No predicted board or JEE score: this report is demonstrated evidence only.</p>}
    </PrintSheet>
  );
}

export default function Teach() {
  const { user } = useApp();
  const [data, setData] = useState(null);        // {classes, allProfiles}
  const [analytics, setAnalytics] = useState(null);
  const [selClass, setSelClass] = useState(null);
  const [newClass, setNewClass] = useState('');
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [customs, setCustoms] = useState([]);
  const [showQBuilder, setShowQBuilder] = useState(false);
  const [qForm, setQForm] = useState({ name: '', prompt: '', answerType: 'numeric', value: '', expr: '', mcqOptions: ['', '', '', ''], correctIndex: 0, solutionText: '', hint: '', difficulty: 2 });
  const [msg, setMsg] = useState('');
  const [sheet, setSheet] = useState(null);      // {kind:'class'} | {kind:'student', id}
  const progressRef = useRef(null);
  const rosterRef = useRef(null);

  const load = async () => {
    const r = await api.get('/classes');
    setData(r);
    if (selClass && !r.classes.find(c => c.id === selClass)) setSelClass(null);
    const cq = await api.get('/custom-questions');
    setCustoms(cq.questions);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const refreshAnalytics = (id = selClass) => {
    if (!id) { setAnalytics(null); return; }
    api.get(`/classes/${id}/analytics`).then(setAnalytics).catch(() => setAnalytics(null));
  };
  useEffect(() => { refreshAnalytics(selClass); }, [selClass]); // eslint-disable-line

  const cls = data?.classes.find(c => c.id === selClass);
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  // The syllabus the task picker opens on: India when the teacher or any
  // student in the class is on the India product (or the class is still
  // empty), NSW only when everyone in it is on the Australian syllabus.
  const sections = useMemo(() => assignmentSections(), []);
  useEffect(() => {
    if (!cls) return;
    const students = cls.students || [];
    const india = user?.course === 'in' || !students.length || students.some(s => s.course === 'in');
    const indian = students.filter(s => s.course === 'in');
    const year = indian[0]?.year || (user?.course === 'in' ? user.year : 10);
    const track = indian[0]?.indiaTrack || 'cbse';
    const key = track === 'olympiad' ? 'in-olympiad' : (track.startsWith('jee-') ? `in-${track}-${Math.max(11, year)}` : `in-cbse-${Math.min(12, Math.max(7, year))}`);
    setTaskForm(f => ({ ...f, syllabus: india ? 'in' : 'nsw', sectionKey: sections.some(s => s.key === key) ? key : 'in-cbse-10', chapters: [], dotpoint: null, subtopics: [] }));
  }, [cls?.id]); // eslint-disable-line

  const section = sections.find(s => s.key === taskForm.sectionKey) || sections[0];
  const selectedChapters = useMemo(() => {
    const byId = new Map(sections.flatMap(s => s.chapters.map(ch => [ch.id, ch])));
    return taskForm.chapters.map(id => byId.get(id)).filter(Boolean);
  }, [sections, taskForm.chapters]);
  const soleChapter = selectedChapters.length === 1 ? selectedChapters[0] : null;
  const canAssign = taskForm.customIds.length > 0 || (taskForm.syllabus === 'in' ? taskForm.chapters.length > 0 : taskForm.subtopics.length > 0);

  async function createClass() {
    if (!newClass.trim()) return;
    const r = await api.post('/classes', { name: newClass });
    setNewClass('');
    await load();
    setSelClass(r.class.id);
  }

  async function toggleStudent(pid, inClass) {
    await api.post(`/classes/${selClass}/students`, inClass ? { remove: [pid] } : { add: [pid] });
    await load();
    refreshAnalytics();
  }

  async function assignTask() {
    const india = taskForm.syllabus === 'in' && !taskForm.customIds.length;
    const targets = india ? taskForm.chapters.map(id => ({
      chapterId: id,
      dotpoint: soleChapter ? taskForm.dotpoint : null,
      track: section?.track || 'cbse',
      difficulty: taskForm.difficulty
    })) : [];
    await api.post('/tasks', {
      classId: selClass, title: taskForm.title || 'Class task',
      subtopics: india ? [] : taskForm.subtopics, targets, customIds: taskForm.customIds,
      count: taskForm.customIds.length || taskForm.count,
      dueAt: Date.now() + taskForm.days * 86400000
    });
    setTaskForm(f => ({ ...EMPTY_TASK, syllabus: f.syllabus, sectionKey: f.sectionKey }));
    flash('Task assigned ✓');
    refreshAnalytics();
  }

  /** Assignment intelligence: the three chapters this class finds hardest become the task. */
  function assignWeakest() {
    const weakest = (analytics?.weakestChapters || []).slice(0, 3);
    if (!weakest.length) return;
    const track = analytics.students.find(s => s.course === 'in')?.indiaTrack || 'cbse';
    setTaskForm(f => ({
      ...f, syllabus: 'in', sectionKey: sectionKeyForChapter(weakest[0].id, track) || f.sectionKey,
      chapters: weakest.map(c => c.id), dotpoint: null, subtopics: [], customIds: [],
      title: `Weakest chapters: ${weakest.map(c => c.name).join(', ')}`.slice(0, 80)
    }));
    flash('Task form filled from class analytics');
  }

  async function saveCustomQ() {
    const body = {
      name: qForm.name, prompt: qForm.prompt, answerType: qForm.answerType,
      difficulty: qForm.difficulty, solutionText: qForm.solutionText, hint: qForm.hint,
      mcqOptions: qForm.answerType === 'mcq' ? qForm.mcqOptions.filter(Boolean) : undefined,
      answer: qForm.answerType === 'mcq' ? { correctIndex: qForm.correctIndex }
        : qForm.answerType === 'expression' ? { expr: qForm.expr }
          : { value: Number(qForm.value) }
    };
    await api.post('/custom-questions', body);
    setShowQBuilder(false);
    setQForm({ name: '', prompt: '', answerType: 'numeric', value: '', expr: '', mcqOptions: ['', '', '', ''], correctIndex: 0, solutionText: '', hint: '', difficulty: 2 });
    flash('Question saved ✓');
    load();
  }

  async function importRoster(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !selClass) return;
    try {
      const rows = parseRoster(await readTextFile(f));
      if (!rows.length) throw new Error('No names found in that file. One student per line: name, class, track.');
      const r = await api.post(`/classes/${selClass}/roster`, { rows });
      await load();
      refreshAnalytics();
      flash(`Roster imported — ${r.matched} matched, ${r.created} created, ${r.skipped} skipped`);
    } catch (err) { setMsg(`⚠️ ${err.message}`); }
  }

  const allSubtopics = CURRICULUM.flatMap(y => y.subtopics.map(s => ({ ...s, year: y.year })));
  const indiaClass = analytics ? analytics.syllabus !== 'nsw' : true;
  const sheetStudent = sheet?.kind === 'student' ? analytics?.students.find(s => s.id === sheet.id) : null;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">Teacher Studio</h1>
      {msg && <div className="card" role="status" style={{ padding: '10px 16px', color: 'var(--good)', fontWeight: 650 }}>{msg}</div>}

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Your classes</div>
          {data?.classes.map(c => (
            <div key={c.id} className="prio-item">
              <span className="prio-rank">{c.students.length}<span className="sr-only"> students</span></span>
              <button onClick={() => setSelClass(c.id)} aria-pressed={selClass === c.id}
                style={{ flex: 1, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 650 }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{c.students.map(s => s.name).join(', ') || 'No students yet'}</div>
              </button>
              {selClass === c.id && <span className="tag tag-brand">selected</span>}
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" aria-label="New class name" placeholder="New class name (e.g. Class 10 A)" value={newClass}
              onChange={e => setNewClass(e.target.value)} onKeyDown={e => e.key === 'Enter' && createClass()} />
            <button className="btn btn-primary" onClick={createClass}>Create</button>
          </div>
        </div>

        <div className="card">
          <div className="spread">
            <div className="card-title" style={{ marginBottom: 0 }}>Students in {cls ? cls.name : '…'}</div>
            {cls && <button className="btn btn-ghost btn-sm" onClick={() => rosterRef.current?.click()} title="A CSV or text file, one student per line: name, class, track">📋 Import roster (CSV)</button>}
          </div>
          <input ref={rosterRef} type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display: 'none' }} onChange={importRoster} />
          {!cls && <p className="muted">Select or create a class, then add student profiles from this device or import a roster.</p>}
          {cls && <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 8px' }}>Roster files: one student per line — <code>name, class, track</code> (track: cbse, jee-main, jee-advanced, olympiad). Names already on this device join; new names get a student profile.</p>}
          {cls && (data?.allProfiles || []).map(p => {
            const inClass = cls.studentPids.includes(p.id);
            return (
              <div className="prio-item" key={p.id}>
                <span style={{ fontSize: 22 }}>{p.avatar || '🙂'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 640 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{yearLabel(p)}{p.course === 'in' && p.indiaTrack && p.indiaTrack !== 'cbse' ? ` · ${p.indiaTrack}` : ''}</div>
                </div>
                <button className={`btn btn-sm ${inClass ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleStudent(p.id, inClass)}>
                  {inClass ? 'Remove' : 'Add'}
                </button>
              </div>
            );
          })}
          {cls && !(data?.allProfiles || []).length && <p className="muted">No student profiles on this device yet — create some from the profile screen or import a roster.</p>}
        </div>
      </div>

      {cls && (
        <div className="card">
          <div className="card-title">Assign a task to {cls.name}</div>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <div>
              <div className="field">
                <label className="label" htmlFor="teach-task-title">Title</label>
                <input className="input" id="teach-task-title" value={taskForm.title} placeholder="e.g. Quadratic equations revision"
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div className="field">
                  <label className="label" htmlFor="teach-task-count">Questions — {taskForm.count}</label>
                  <input type="range" id="teach-task-count" min="5" max="30" step="5" value={taskForm.count} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
                    onChange={e => setTaskForm(f => ({ ...f, count: Number(e.target.value) }))} disabled={taskForm.customIds.length > 0} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="teach-task-days">Due in — {taskForm.days} days</label>
                  <input type="range" id="teach-task-days" min="1" max="21" value={taskForm.days} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
                    onChange={e => setTaskForm(f => ({ ...f, days: Number(e.target.value) }))} />
                </div>
              </div>
              {taskForm.syllabus === 'in' && (
                <div className="grid cols-2" style={{ gap: 10 }}>
                  <div className="field">
                    <div className="label" id="teach-difficulty">Difficulty</div>
                    <div className="pill-select" role="group" aria-labelledby="teach-difficulty">
                      {[null, ...Array.from({ length: section?.difficultyCeiling || 3 }, (_, i) => i + 1)].map(d => (
                        <button key={String(d)} className={`pill-opt ${taskForm.difficulty === d ? 'on' : ''}`} aria-pressed={taskForm.difficulty === d}
                          onClick={() => setTaskForm(f => ({ ...f, difficulty: d }))}>{d == null ? 'Adaptive' : `D${d}`}</button>
                      ))}
                    </div>
                  </div>
                  {soleChapter && (
                    <div className="field">
                      <div className="label" id="teach-dotpoint">Dot point in {soleChapter.name}</div>
                      <div className="pill-select" role="group" aria-labelledby="teach-dotpoint">
                        <button className={`pill-opt ${taskForm.dotpoint == null ? 'on' : ''}`} aria-pressed={taskForm.dotpoint == null} onClick={() => setTaskForm(f => ({ ...f, dotpoint: null }))}>Whole chapter</button>
                        {soleChapter.dotpoints.map((text, i) => (
                          <button key={i} className={`pill-opt ${taskForm.dotpoint === i ? 'on' : ''}`} aria-pressed={taskForm.dotpoint === i} title={text}
                            onClick={() => setTaskForm(f => ({ ...f, dotpoint: i }))}>{i + 1}. {text.length > 38 ? `${text.slice(0, 36)}…` : text}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {customs.length > 0 && (
                <div className="field">
                  <div className="label" id="teach-customs">Or use your custom questions</div>
                  <div className="pill-select" role="group" aria-labelledby="teach-customs">
                    {customs.map(c => (
                      <button key={c.id} className={`pill-opt ${taskForm.customIds.includes(c.id) ? 'on' : ''}`}
                        onClick={() => setTaskForm(f => ({ ...f, customIds: f.customIds.includes(c.id) ? f.customIds.filter(x => x !== c.id) : [...f.customIds, c.id] }))}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={!canAssign} onClick={assignTask}>Assign task</button>
                {analytics?.weakestChapters?.length > 0 && (
                  <button className="btn btn-ghost" onClick={assignWeakest} title={analytics.weakestChapters.slice(0, 3).map(c => `${c.name} (${c.accuracy}% accuracy)`).join(', ')}>
                    Assign the three weakest chapters
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="field">
                <div className="label" id="teach-syllabus">Syllabus</div>
                <div className="pill-select" role="group" aria-labelledby="teach-syllabus">
                  <button className={`pill-opt ${taskForm.syllabus === 'in' ? 'on' : ''}`} aria-pressed={taskForm.syllabus === 'in'} onClick={() => setTaskForm(f => ({ ...f, syllabus: 'in' }))}>India · NCERT / JEE / Olympiad</button>
                  <button className={`pill-opt ${taskForm.syllabus === 'nsw' ? 'on' : ''}`} aria-pressed={taskForm.syllabus === 'nsw'} onClick={() => setTaskForm(f => ({ ...f, syllabus: 'nsw' }))}>NSW · HSC</button>
                </div>
              </div>
              {taskForm.syllabus === 'in' ? (
                <>
                  <div className="field">
                    <label className="label" htmlFor="teach-section">Class / track</label>
                    <select className="input" id="teach-section" value={taskForm.sectionKey} onChange={e => setTaskForm(f => ({ ...f, sectionKey: e.target.value, dotpoint: null }))}>
                      {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <div className="label" id="teach-topics">Chapters ({taskForm.chapters.length} selected)</div>
                    <div className="pill-select" role="group" aria-labelledby="teach-topics" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {(section?.chapters || []).map(ch => (
                        <button key={ch.id} className={`pill-opt ${taskForm.chapters.includes(ch.id) ? 'on' : ''}`} aria-pressed={taskForm.chapters.includes(ch.id)}
                          onClick={() => setTaskForm(f => ({ ...f, dotpoint: null, chapters: f.chapters.includes(ch.id) ? f.chapters.filter(x => x !== ch.id) : [...f.chapters, ch.id] }))}>
                          {ch.name}
                        </button>
                      ))}
                    </div>
                    {selectedChapters.length > 0 && (
                      <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                        Selected: {describeTaskTargets(taskForm.chapters.map(id => ({ chapterId: id, dotpoint: soleChapter ? taskForm.dotpoint : null, track: section?.track, difficulty: taskForm.difficulty })))}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="field">
                  <div className="label" id="teach-topics">Generated topics ({taskForm.subtopics.length})</div>
                  <div className="pill-select" role="group" aria-labelledby="teach-topics" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {allSubtopics.map(s => (
                      <button key={s.id} className={`pill-opt ${taskForm.subtopics.includes(s.id) ? 'on' : ''}`}
                        onClick={() => setTaskForm(f => ({ ...f, subtopics: f.subtopics.includes(s.id) ? f.subtopics.filter(x => x !== s.id) : [...f.subtopics, s.id] }))}>
                        Y{s.year} · {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {analytics && (
        <div className="card">
          <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Class analytics — {analytics.class.name}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet({ kind: 'class' })} disabled={!analytics.students.length}>🖨 Print class report</button>
              <button className="btn btn-ghost btn-sm" onClick={() => progressRef.current?.click()}>📥 Import progress file</button>
            </div>
          </div>
          {/* a hidden file input behind a <label> is a control a keyboard cannot
              reach: the input is not focusable and the label is not a button */}
          <input ref={progressRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const data = await readJSONFile(f);
                    const r = await api.post(`/classes/${selClass}/import-progress`, data);
                    setMsg(`✅ Imported progress for ${r.student}`);
                    refreshAnalytics();
                  } catch (err) { setMsg(`⚠️ ${err.message}`); }
                }} />
          <p className="muted" style={{ margin: '6px 0 10px' }}>
            Students on other iPads export a progress file from Settings — import it here and they appear below alongside on-device profiles.
            {indiaClass && ' No predicted board or JEE score is shown for Indian students: the table is demonstrated evidence — attempts, accuracy, active days and chapter mastery.'}
          </p>

          {analytics.attention?.length > 0 && (
            <div className="notice" style={{ marginBottom: 12 }}>
              <strong>Needs attention</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {analytics.attention.map(a => (
                  <li key={a.id}>{a.name}: {a.flags.map(f => f.reason).join(' ')}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th>Student</th>{!indiaClass && <th>Predicted</th>}<th>Answered</th><th>Accuracy</th><th>Active days</th><th>Streak</th>
                {indiaClass && <th>Chapter mastery</th>}<th>Weakest {indiaClass ? 'chapters' : 'area'}</th><th>Flags</th><th><span className="sr-only">Report</span></th>
              </tr></thead>
              <tbody>
                {analytics.students.map(s => (
                  <tr key={s.id}>
                    <td>{s.avatar} {s.name} <span className="muted">{yearLabel(s)}</span>{s.imported && <span className="tag" style={{ marginLeft: 6 }} title={`Imported ${shortDate(s.importedAt, s.course)}`}>📄 file</span>}</td>
                    {!indiaClass && <td>{s.predicted == null ? <span className="muted">—</span> : <><b>{s.predicted}</b>/100</>}</td>}
                    <td>{s.attempts}</td>
                    <td>{pct(s.accuracy)}</td>
                    <td>{s.activeDays == null ? <span className="muted" title="Not in the imported file">—</span> : `${s.activeDays}/28`}</td>
                    <td>{s.streak}d</td>
                    {indiaClass && <td>{s.evidence ? <>{pct(s.evidence.mastery)} <span className="muted">· {s.evidence.chaptersStarted}/{s.evidence.chaptersTotal} started</span></> : <span className="muted">—</span>}</td>}
                    <td className="muted">{s.weakestChapters?.length ? s.weakestChapters.map(c => c.name).join(', ') : s.weakest}</td>
                    <td><FlagChips flags={s.flags} /></td>
                    <td><button className="btn btn-quiet btn-sm" onClick={() => setSheet({ kind: 'student', id: s.id })}>Report</button></td>
                  </tr>
                ))}
                {!analytics.students.length && <tr><td colSpan={indiaClass ? 9 : 9} className="muted">Add students to see analytics.</td></tr>}
              </tbody>
            </table>
          </div>

          {analytics.chapters?.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 18 }}>Chapters this class finds hardest</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Chapter</th><th>Students</th><th>Attempts</th><th>Accuracy</th><th>Mastery</th></tr></thead>
                  <tbody>
                    {analytics.chapters.slice(0, 8).map(c => (
                      <tr key={c.id}><td>{c.name} <span className="muted">· {c.strand}</span></td><td>{c.students}</td><td>{c.attempts}</td><td>{pct(c.accuracy)}</td><td>{pct(c.mastery)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {analytics.tasks.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 18 }}>Task progress</div>
              {analytics.tasks.map(t => (
                <div key={t.id} className="task-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 650 }}>{t.title} <span className="muted">· {t.count} questions</span>{t.overdue && <span className="tag" style={{ marginLeft: 6 }}>⏰ overdue</span>}</div>
                    {t.targets?.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{describeTaskTargets(t.targets)}</div>}
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {t.progress.map(p => `${p.name}: ${p.done}/${t.count}${p.finished ? ' ✓' : ''}`).join(' · ') || 'No progress yet'}
                      {t.dueAt ? ` · due ${shortDate(t.dueAt, indiaClass ? 'in' : 'nsw')}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-quiet btn-sm" title="Export as a task-pack file — AirDrop it to student iPads"
                    onClick={async () => {
                      try {
                        const pack = await api.get(`/tasks/${t.id}/pack`);
                        downloadJSON(pack, `pri-task-${t.title.replace(/\s+/g, '-').toLowerCase()}-${dateStamp()}.json`);
                        setMsg('📦 Task pack exported — students import it from their Tasks page');
                      } catch (err) { setMsg(`⚠️ ${err.message}`); }
                    }}>📦 Pack</button>
                  <button className="btn btn-quiet btn-sm" onClick={async () => { await api.post(`/tasks/${t.id}/delete`); refreshAnalytics(); }}>Delete</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>Custom questions ({customs.length})</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowQBuilder(s => !s)}>{showQBuilder ? 'Close' : '＋ Write a question'}</button>
        </div>
        {customs.length > 0 && !showQBuilder && (
          <div style={{ marginTop: 10 }}>
            {customs.map(c => (
              <div className="prio-item" key={c.id}>
                <span className="tag">D{c.difficulty}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 640 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><MathText text={c.q.prompt} /></div>
                </div>
                <button className="btn btn-quiet btn-sm" onClick={async () => { await api.post(`/custom-questions/${c.id}/delete`); load(); }}>Delete</button>
              </div>
            ))}
          </div>
        )}
        {showQBuilder && (
          <div style={{ marginTop: 14 }}>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="cq-name">Name</label>
                <input className="input" id="cq-name" value={qForm.name} onChange={e => setQForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Surds warm-up 1" />
              </div>
              <div className="field">
                <label className="label" htmlFor="cq-difficulty">Difficulty</label>
                <select className="input" id="cq-difficulty" value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: Number(e.target.value) }))}>
                  {[1, 2, 3, 4].map(d => <option key={d} value={d}>D{d}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="cq-prompt">Prompt (use $…$ for maths, e.g. Solve $2x + 1 = 9$)</label>
              <textarea className="input" id="cq-prompt" style={{ fontFamily: 'inherit' }} value={qForm.prompt} onChange={e => setQForm(f => ({ ...f, prompt: e.target.value }))} />
              {qForm.prompt && <div className="typed-preview" style={{ marginTop: 8 }}><MathText text={qForm.prompt} /></div>}
            </div>
            <div className="field">
              <div className="label" id="cq-type">Answer type</div>
              <div className="pill-select" role="group" aria-labelledby="cq-type">
                {['numeric', 'expression', 'mcq'].map(t => (
                  <button key={t} className={`pill-opt ${qForm.answerType === t ? 'on' : ''}`} onClick={() => setQForm(f => ({ ...f, answerType: t }))}>{t}</button>
                ))}
              </div>
            </div>
            {qForm.answerType === 'numeric' && (
              <div className="field"><label className="label" htmlFor="cq-value">Correct value</label>
                <input className="input" id="cq-value" value={qForm.value} onChange={e => setQForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 4" /></div>
            )}
            {qForm.answerType === 'expression' && (
              <div className="field"><label className="label" htmlFor="cq-expr">Correct expression</label>
                <input className="input" id="cq-expr" value={qForm.expr} onChange={e => setQForm(f => ({ ...f, expr: e.target.value }))} placeholder="e.g. 2x + 6 (equivalent forms accepted automatically)" /></div>
            )}
            {qForm.answerType === 'mcq' && (
              <div className="field">
                <div className="label">Options (tap the correct one)</div>
                {qForm.mcqOptions.map((o, i) => (
                  <div className="row" key={i} style={{ marginBottom: 6 }}>
                    <button className="mcq-key" aria-label={`Mark option ${'ABCD'[i]} as the correct answer`}
                      aria-pressed={qForm.correctIndex === i}
                      style={{ background: qForm.correctIndex === i ? 'var(--good)' : undefined, color: qForm.correctIndex === i ? '#04150c' : undefined, border: 'none', cursor: 'pointer' }}
                      onClick={() => setQForm(f => ({ ...f, correctIndex: i }))}>{'ABCD'[i]}</button>
                    <input className="input" aria-label={`Option ${'ABCD'[i]}`} value={o} onChange={e => setQForm(f => ({ ...f, mcqOptions: f.mcqOptions.map((x, j) => j === i ? e.target.value : x) }))} />
                  </div>
                ))}
              </div>
            )}
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field"><label className="label" htmlFor="cq-solution">Worked solution</label>
                <textarea className="input" id="cq-solution" style={{ fontFamily: 'inherit' }} value={qForm.solutionText} onChange={e => setQForm(f => ({ ...f, solutionText: e.target.value }))} /></div>
              <div className="field"><label className="label" htmlFor="cq-hint">Hint (optional)</label>
                <textarea className="input" id="cq-hint" style={{ fontFamily: 'inherit' }} value={qForm.hint} onChange={e => setQForm(f => ({ ...f, hint: e.target.value }))} /></div>
            </div>
            <button className="btn btn-primary" disabled={!qForm.prompt.trim()} onClick={saveCustomQ}>Save question</button>
          </div>
        )}
      </div>

      {/* Cloud classes live here too, so a teacher is not sent to Settings to
          find the join code, publish an assignment or review submissions. */}
      <ClassroomPanel />

      {sheet?.kind === 'class' && analytics && <ClassReport analytics={analytics} onClose={() => setSheet(null)} />}
      {sheetStudent && <StudentReport analytics={analytics} student={sheetStudent} onClose={() => setSheet(null)} />}
    </div>
  );
}
