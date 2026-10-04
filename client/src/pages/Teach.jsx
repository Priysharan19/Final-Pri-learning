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
import { downloadJSON, readJSONFile, readTextFile, dateStamp, printPage } from '../lib/files.js';
import { parseRoster } from '../lib/csv.js';
import { MathText } from '../lib/latex.jsx';
import { CURRICULUM } from '../engine/curriculum.js';
import { assignmentSections, describeTaskTargets, sectionKeyForChapter } from '../platform/assignmentTarget.js';
import ClassroomPanel from '../components/ClassroomPanel.jsx';
import { tLater, translate, useT, useTx } from '../i18n/index.js';

// Resolved at render time through translate(), so it follows the current language.
const yearLabel = s => (s?.year ? translate(s.course === 'in' ? 'common.classNumber' : 'common.yearNumber', { n: s.year }) : '—');
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
  const t = useT();
  return (
    <div className="paper-overlay" role="dialog" aria-modal="true" aria-labelledby="teach-print-title">
      <div className="paper-sheet">
        <div className="row no-print" style={{ marginBottom: 14, gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { printPage().catch(() => {}); }}>{t('teach.printSavePdf')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('nav.close')}</button>
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
  const t = useT();
  const generated = new Date(analytics.generatedAt || Date.now()).toLocaleString(india ? 'en-IN' : 'en-AU');
  return (
    <PrintSheet title={t('teach.classReportTitle', { name: analytics.class.name })} subtitle={t('teach.classReportSubtitle', { count: analytics.students.length, n: analytics.students.length, date: generated })} onClose={onClose}>
      <table style={sheetTable}>
        <thead><tr>
          <th style={sheetTh}>{t('teach.student')}</th><th style={sheetTh}>{t('common.class')}</th>{!india && <th style={sheetTh}>{t('teach.predicted')}</th>}
          <th style={sheetTh}>{t('teach.answered')}</th><th style={sheetTh}>{t('common.accuracy')}</th><th style={sheetTh}>{t('teach.activeDays28d')}</th>
          {india && <th style={sheetTh}>{t('teach.chapterMastery')}</th>}<th style={sheetTh}>{t('teach.weakest')}</th><th style={sheetTh}>{t('teach.needsAttention')}</th>
        </tr></thead>
        <tbody>
          {analytics.students.map(s => (
            <tr key={s.id}>
              <td style={sheetTd}>{s.name}{s.imported ? t('teach.fileSuffix') : ''}</td>
              <td style={sheetTd}>{yearLabel(s)}</td>
              {!india && <td style={sheetTd}>{s.predicted == null ? '—' : `${s.predicted}/100`}</td>}
              <td style={sheetTd}>{s.attempts}</td>
              <td style={sheetTd}>{pct(s.accuracy)}</td>
              <td style={sheetTd}>{s.activeDays == null ? '—' : s.activeDays}</td>
              {india && <td style={sheetTd}>{s.evidence ? `${pct(s.evidence.mastery)} ${t('teach.startedOfTotal', { started: s.evidence.chaptersStarted, total: s.evidence.chaptersTotal })}` : '—'}</td>}
              <td style={sheetTd}>{s.weakestChapters?.length ? s.weakestChapters.map(c => c.name).join(', ') : s.weakest}</td>
              <td style={sheetTd}>{s.flags?.length ? s.flags.map(f => f.reason).join(' ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {analytics.chapters?.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>{t('teach.hardestChapters')}</h3>
          <table style={sheetTable}>
            <thead><tr><th style={sheetTh}>{t('teach.chapter')}</th><th style={sheetTh}>{t('teach.students')}</th><th style={sheetTh}>{t('common.attempts')}</th><th style={sheetTh}>{t('common.accuracy')}</th><th style={sheetTh}>{t('teach.mastery')}</th></tr></thead>
            <tbody>{analytics.chapters.map(c => (
              <tr key={c.id}><td style={sheetTd}>{c.name}</td><td style={sheetTd}>{c.students}</td><td style={sheetTd}>{c.attempts}</td><td style={sheetTd}>{pct(c.accuracy)}</td><td style={sheetTd}>{pct(c.mastery)}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
      {india && <p style={{ color: '#555', fontSize: 12, marginTop: 16 }}>{t('teach.noPredictionClassReport')}</p>}
    </PrintSheet>
  );
}

function StudentReport({ analytics, student, onClose }) {
  const t = useT();
  const india = student.course === 'in';
  const chapters = (student.chapters || []).filter(c => c.attempts > 0).sort((a, b) => a.mastery - b.mastery);
  const tasks = (analytics.tasks || []).map(task => ({ ...task, mine: task.progress.find(p => p.pid === student.id) })).filter(task => task.mine);
  return (
    <PrintSheet title={t('teach.studentReportTitle', { name: student.name })} subtitle={`${student.courseLabel || yearLabel(student)} · ${analytics.class.name} · ${shortDate(analytics.generatedAt, student.course)}`} onClose={onClose}>
      <table style={sheetTable}>
        <tbody>
          <tr><td style={sheetTd}><b>{t('teach.questionsAnswered')}</b></td><td style={sheetTd}>{t('teach.attemptsCorrect', { attempts: student.attempts, correct: student.correct, accuracy: pct(student.accuracy) })}</td></tr>
          <tr><td style={sheetTd}><b>{t('teach.activeDaysLast28')}</b></td><td style={sheetTd}>{t('teach.activeDaysStreak', { count: student.streak, n: student.streak, days: student.activeDays == null ? t('teach.notInFile') : student.activeDays })}</td></tr>
          {india && student.evidence && <tr><td style={sheetTd}><b>{t('teach.chapters')}</b></td><td style={sheetTd}>{t('teach.chaptersEvidence', { started: student.evidence.chaptersStarted, total: student.evidence.chaptersTotal, practised: student.evidence.chaptersPractised, mastery: pct(student.evidence.mastery) })}</td></tr>}
          {!india && <tr><td style={sheetTd}><b>{t('teach.predicted')}</b></td><td style={sheetTd}>{student.predicted == null ? '—' : `${student.predicted}/100`}</td></tr>}
          <tr><td style={sheetTd}><b>{t('teach.needsAttention')}</b></td><td style={sheetTd}>{student.flags?.length ? student.flags.map(f => <div key={f.code}>{f.label} — {f.reason}</div>) : t('teach.nothingFlagged')}</td></tr>
        </tbody>
      </table>
      {chapters.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>{t('progress.chaptersPractised')}</h3>
          <table style={sheetTable}>
            <thead><tr><th style={sheetTh}>{t('teach.chapter')}</th><th style={sheetTh}>{t('common.attempts')}</th><th style={sheetTh}>{t('common.accuracy')}</th><th style={sheetTh}>{t('teach.mastery')}</th></tr></thead>
            <tbody>{chapters.map(c => <tr key={c.id}><td style={sheetTd}>{c.name}</td><td style={sheetTd}>{c.attempts}</td><td style={sheetTd}>{pct(c.accuracy)}</td><td style={sheetTd}>{pct(c.mastery)} · {c.band}</td></tr>)}</tbody>
          </table>
        </>
      )}
      {student.misconceptions?.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>{t('teach.repeatedMistakes')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{student.misconceptions.map(m => <li key={`${m.subtopic}:${m.key}`}>{t('teach.mistakeLine', { label: m.label, count: m.count, subtopic: m.subtopicName })}</li>)}</ul>
        </>
      )}
      {tasks.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 6px', color: '#111' }}>{t('tasks.title')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{tasks.map(task => <li key={task.id}>{task.title}: {task.mine.done}/{task.count}{task.mine.finished ? ' ✓' : task.overdue ? t('teach.overdueSuffix') : ''}</li>)}</ul>
        </>
      )}
      {india && <p style={{ color: '#555', fontSize: 12, marginTop: 16 }}>{t('teach.noPredictionStudentReport')}</p>}
    </PrintSheet>
  );
}

export default function Teach() {
  const t = useT();
  const tx = useTx();
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
  const flash = text => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

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
      classId: selClass, title: taskForm.title || t('classes.classTask'),
      subtopics: india ? [] : taskForm.subtopics, targets, customIds: taskForm.customIds,
      count: taskForm.customIds.length || taskForm.count,
      dueAt: Date.now() + taskForm.days * 86400000
    });
    setTaskForm(f => ({ ...EMPTY_TASK, syllabus: f.syllabus, sectionKey: f.sectionKey }));
    flash(t('teach.taskAssigned'));
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
      title: t('teach.weakestTaskTitle', { names: weakest.map(c => c.name).join(', ') }).slice(0, 80)
    }));
    flash(t('teach.formFilled'));
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
    flash(t('teach.questionSaved'));
    load();
  }

  async function importRoster(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !selClass) return;
    try {
      const rows = parseRoster(await readTextFile(f));
      if (!rows.length) throw new Error(t('teach.rosterEmpty'));
      const r = await api.post(`/classes/${selClass}/roster`, { rows });
      await load();
      refreshAnalytics();
      flash(t('teach.rosterImported', { matched: r.matched, created: r.created, skipped: r.skipped }));
    } catch (err) { setMsg(`⚠️ ${err.message}`); }
  }

  const allSubtopics = CURRICULUM.flatMap(y => y.subtopics.map(s => ({ ...s, year: y.year })));
  const indiaClass = analytics ? analytics.syllabus !== 'nsw' : true;
  const sheetStudent = sheet?.kind === 'student' ? analytics?.students.find(s => s.id === sheet.id) : null;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <header className="teacher-workspace-head">
        <div className="hero-kicker">{t('nav.teacherWorkspace')}</div>
        <h1>{t('teach.heroTitle')}</h1>
        <p className="muted">{t('teach.heroSub')}</p>
      </header>
      {msg && <div className="card" role="status" style={{ padding: '10px 16px', color: 'var(--good)', fontWeight: 650 }}>{msg}</div>}

      <div id="teacher-classes" tabIndex={-1} className="grid cols-2 teacher-anchor" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">{t('teach.yourClasses')}</div>
          {data?.classes.map(c => (
            <div key={c.id} className="prio-item">
              <span className="prio-rank">{c.students.length}<span className="sr-only">{t('teach.studentsSr')}</span></span>
              <button onClick={() => setSelClass(c.id)} aria-pressed={selClass === c.id}
                style={{ flex: 1, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 650 }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{c.students.map(s => s.name).join(', ') || t('teach.noStudentsYet')}</div>
              </button>
              {selClass === c.id && <span className="tag tag-brand">{t('teach.selected')}</span>}
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" aria-label={t('teach.newClassName')} placeholder={t('teach.newClassPlaceholder')} value={newClass}
              onChange={e => setNewClass(e.target.value)} onKeyDown={e => e.key === 'Enter' && createClass()} />
            <button className="btn btn-primary" onClick={createClass}>{t('teach.create')}</button>
          </div>
        </div>

        <div className="card">
          <div className="spread">
            <div className="card-title" style={{ marginBottom: 0 }}>{t('teach.studentsIn', { name: cls ? cls.name : '…' })}</div>
            {cls && <button className="btn btn-ghost btn-sm" onClick={() => rosterRef.current?.click()} title={t('teach.importRosterTitle')}>{t('teach.importRoster')}</button>}
          </div>
          <input ref={rosterRef} type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display: 'none' }} onChange={importRoster} />
          {!cls && <p className="muted">{t('teach.selectClassFirst')}</p>}
          {cls && <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 8px' }}>{tx('teach.rosterHelp', { format: <code>name, class, track</code> })}</p>}
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
                  {inClass ? t('teach.remove') : t('teach.add')}
                </button>
              </div>
            );
          })}
          {cls && !(data?.allProfiles || []).length && <p className="muted">{t('teach.noProfiles')}</p>}
        </div>
      </div>

      {!cls && (
        <div id="teacher-assignments" tabIndex={-1} className="card teacher-anchor">
          <div className="card-title">{t('nav.teacherAssignments')}</div>
          <p className="muted">{t('teach.selectClassAssign')}</p>
        </div>
      )}
      {cls && (
        <div id="teacher-assignments" tabIndex={-1} className="card teacher-anchor">
          <div className="card-title">{t('teach.assignTo', { name: cls.name })}</div>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <div>
              <div className="field">
                <label className="label" htmlFor="teach-task-title">{t('teach.title')}</label>
                <input className="input" id="teach-task-title" value={taskForm.title} placeholder={t('teach.titlePlaceholder')}
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div className="field">
                  <label className="label" htmlFor="teach-task-count">{t('tasks.questionCount', { n: taskForm.count })}</label>
                  <input type="range" id="teach-task-count" min="5" max="30" step="5" value={taskForm.count} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
                    onChange={e => setTaskForm(f => ({ ...f, count: Number(e.target.value) }))} disabled={taskForm.customIds.length > 0} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="teach-task-days">{t('teach.dueInDays', { count: taskForm.days, n: taskForm.days })}</label>
                  <input type="range" id="teach-task-days" min="1" max="21" value={taskForm.days} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
                    onChange={e => setTaskForm(f => ({ ...f, days: Number(e.target.value) }))} />
                </div>
              </div>
              {taskForm.syllabus === 'in' && (
                <div className="grid cols-2" style={{ gap: 10 }}>
                  <div className="field">
                    <div className="label" id="teach-difficulty">{t('common.difficulty')}</div>
                    <div className="pill-select" role="group" aria-labelledby="teach-difficulty">
                      {[null, ...Array.from({ length: section?.difficultyCeiling || 3 }, (_, i) => i + 1)].map(d => (
                        <button key={String(d)} className={`pill-opt ${taskForm.difficulty === d ? 'on' : ''}`} aria-pressed={taskForm.difficulty === d}
                          onClick={() => setTaskForm(f => ({ ...f, difficulty: d }))}>{d == null ? t('common.adaptive') : t('teach.difficultyLevel', { n: d })}</button>
                      ))}
                    </div>
                  </div>
                  {soleChapter && (
                    <div className="field">
                      <div className="label" id="teach-dotpoint">{t('tasks.dotpointIn', { chapter: soleChapter.name })}</div>
                      <div className="pill-select" role="group" aria-labelledby="teach-dotpoint">
                        <button className={`pill-opt ${taskForm.dotpoint == null ? 'on' : ''}`} aria-pressed={taskForm.dotpoint == null} onClick={() => setTaskForm(f => ({ ...f, dotpoint: null }))}>{t('tasks.wholeChapter')}</button>
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
                  <div className="label" id="teach-customs">{t('teach.orCustom')}</div>
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
                <button className="btn btn-primary" disabled={!canAssign} onClick={assignTask}>{t('teach.assignTask')}</button>
                {analytics?.weakestChapters?.length > 0 && (
                  <button className="btn btn-ghost" onClick={assignWeakest} title={analytics.weakestChapters.slice(0, 3).map(c => t('teach.weakestAccuracy', { name: c.name, n: c.accuracy })).join(', ')}>
                    {t('teach.assignWeakest')}
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="field">
                <div className="label" id="teach-syllabus">{t('settings.syllabus')}</div>
                <div className="pill-select" role="group" aria-labelledby="teach-syllabus">
                  <button className={`pill-opt ${taskForm.syllabus === 'in' ? 'on' : ''}`} aria-pressed={taskForm.syllabus === 'in'} onClick={() => setTaskForm(f => ({ ...f, syllabus: 'in' }))}>{t('teach.syllabusIndia')}</button>
                  <button className={`pill-opt ${taskForm.syllabus === 'nsw' ? 'on' : ''}`} aria-pressed={taskForm.syllabus === 'nsw'} onClick={() => setTaskForm(f => ({ ...f, syllabus: 'nsw' }))}>{t('teach.syllabusNsw')}</button>
                </div>
              </div>
              {taskForm.syllabus === 'in' ? (
                <>
                  <div className="field">
                    <label className="label" htmlFor="teach-section">{t('tasks.classOrTrack')}</label>
                    <select className="input" id="teach-section" value={taskForm.sectionKey} onChange={e => setTaskForm(f => ({ ...f, sectionKey: e.target.value, dotpoint: null }))}>
                      {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <div className="label" id="teach-topics">{t('tasks.chaptersSelected', { n: taskForm.chapters.length })}</div>
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
                        {t('teach.selectedTargets', { targets: describeTaskTargets(taskForm.chapters.map(id => ({ chapterId: id, dotpoint: soleChapter ? taskForm.dotpoint : null, track: section?.track, difficulty: taskForm.difficulty }))) })}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="field">
                  <div className="label" id="teach-topics">{t('teach.generatedTopics', { n: taskForm.subtopics.length })}</div>
                  <div className="pill-select" role="group" aria-labelledby="teach-topics" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {allSubtopics.map(s => (
                      <button key={s.id} className={`pill-opt ${taskForm.subtopics.includes(s.id) ? 'on' : ''}`}
                        onClick={() => setTaskForm(f => ({ ...f, subtopics: f.subtopics.includes(s.id) ? f.subtopics.filter(x => x !== s.id) : [...f.subtopics, s.id] }))}>
                        {t('teach.yearTopic', { year: s.year, name: s.name })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!analytics && (
        <div id="teacher-analytics" tabIndex={-1} className="card teacher-anchor">
          <div className="card-title">{t('nav.teacherAnalytics')}</div>
          <p className="muted">{t('teach.selectClassAnalytics')}</p>
        </div>
      )}
      {analytics && (
        <div id="teacher-analytics" tabIndex={-1} className="card teacher-anchor">
          <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>{t('teach.classAnalytics', { name: analytics.class.name })}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet({ kind: 'class' })} disabled={!analytics.students.length}>{t('teach.printClassReport')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => progressRef.current?.click()}>{t('teach.importProgress')}</button>
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
                    setMsg(tLater('teach.importedProgressFor', { student: r.student }));
                    refreshAnalytics();
                  } catch (err) { setMsg(`⚠️ ${err.message}`); }
                }} />
          <p className="muted" style={{ margin: '6px 0 10px' }}>
            {t('teach.progressImportNote')}
            {indiaClass && ` ${t('teach.noPredictionIndia')}`}
          </p>

          {analytics.attention?.length > 0 && (
            <div className="notice" style={{ marginBottom: 12 }}>
              <strong>{t('teach.needsAttention')}</strong>
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
                <th>{t('teach.student')}</th>{!indiaClass && <th>{t('teach.predicted')}</th>}<th>{t('teach.answered')}</th><th>{t('common.accuracy')}</th><th>{t('teach.activeDays')}</th><th>{t('teach.streak')}</th>
                {indiaClass && <th>{t('teach.chapterMastery')}</th>}<th>{indiaClass ? t('teach.weakestChapters') : t('teach.weakestArea')}</th><th>{t('teach.flags')}</th><th><span className="sr-only">{t('teach.report')}</span></th>
              </tr></thead>
              <tbody>
                {analytics.students.map(s => (
                  <tr key={s.id}>
                    <td>{s.avatar} {s.name} <span className="muted">{yearLabel(s)}</span>{s.imported && <span className="tag" style={{ marginLeft: 6 }} title={t('teach.importedOn', { date: shortDate(s.importedAt, s.course) })}>{t('teach.fileTag')}</span>}</td>
                    {!indiaClass && <td>{s.predicted == null ? <span className="muted">—</span> : <><b>{s.predicted}</b>/100</>}</td>}
                    <td>{s.attempts}</td>
                    <td>{pct(s.accuracy)}</td>
                    <td>{s.activeDays == null ? <span className="muted" title={t('teach.notInImportedFile')}>—</span> : `${s.activeDays}/28`}</td>
                    <td>{t('teach.streakShort', { n: s.streak })}</td>
                    {indiaClass && <td>{s.evidence ? <>{pct(s.evidence.mastery)} <span className="muted">{t('teach.startedOfTotal', { started: s.evidence.chaptersStarted, total: s.evidence.chaptersTotal })}</span></> : <span className="muted">—</span>}</td>}
                    <td className="muted">{s.weakestChapters?.length ? s.weakestChapters.map(c => c.name).join(', ') : s.weakest}</td>
                    <td><FlagChips flags={s.flags} /></td>
                    <td><button className="btn btn-quiet btn-sm" onClick={() => setSheet({ kind: 'student', id: s.id })}>{t('teach.report')}</button></td>
                  </tr>
                ))}
                {!analytics.students.length && <tr><td colSpan={indiaClass ? 9 : 9} className="muted">{t('teach.addStudentsForAnalytics')}</td></tr>}
              </tbody>
            </table>
          </div>

          {analytics.chapters?.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 18 }}>{t('teach.hardestChapters')}</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>{t('teach.chapter')}</th><th>{t('teach.students')}</th><th>{t('common.attempts')}</th><th>{t('common.accuracy')}</th><th>{t('teach.mastery')}</th></tr></thead>
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
              <div className="card-title" style={{ marginTop: 18 }}>{t('teach.taskProgress')}</div>
              {analytics.tasks.map(task => (
                <div key={task.id} className="task-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 650 }}>{task.title} <span className="muted">· {t('common.questionsCounted', { count: task.count, n: task.count })}</span>{task.overdue && <span className="tag" style={{ marginLeft: 6 }}>{t('teach.overdueTag')}</span>}</div>
                    {task.targets?.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{describeTaskTargets(task.targets)}</div>}
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {task.progress.map(p => `${p.name}: ${p.done}/${task.count}${p.finished ? ' ✓' : ''}`).join(' · ') || t('teach.noProgressYet')}
                      {task.dueAt ? t('tasks.due', { date: shortDate(task.dueAt, indiaClass ? 'in' : 'nsw') }) : ''}
                    </div>
                  </div>
                  <button className="btn btn-quiet btn-sm" title={t('teach.packTitle')}
                    onClick={async () => {
                      try {
                        const pack = await api.get(`/tasks/${task.id}/pack`);
                        downloadJSON(pack, `pri-task-${task.title.replace(/\s+/g, '-').toLowerCase()}-${dateStamp()}.json`);
                        setMsg(tLater('teach.packExported'));
                      } catch (err) { setMsg(`⚠️ ${err.message}`); }
                    }}>{t('teach.pack')}</button>
                  <button className="btn btn-quiet btn-sm" onClick={async () => { await api.post(`/tasks/${task.id}/delete`); refreshAnalytics(); }}>{t('teach.delete')}</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div id="teacher-questions" tabIndex={-1} className="card teacher-anchor">
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>{t('teach.customQuestions', { n: customs.length })}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowQBuilder(s => !s)}>{showQBuilder ? t('nav.close') : t('teach.writeQuestion')}</button>
        </div>
        {customs.length > 0 && !showQBuilder && (
          <div style={{ marginTop: 10 }}>
            {customs.map(c => (
              <div className="prio-item" key={c.id}>
                <span className="tag">{t('teach.difficultyLevel', { n: c.difficulty })}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 640 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><MathText text={c.q.prompt} /></div>
                </div>
                <button className="btn btn-quiet btn-sm" onClick={async () => { await api.post(`/custom-questions/${c.id}/delete`); load(); }}>{t('teach.delete')}</button>
              </div>
            ))}
          </div>
        )}
        {showQBuilder && (
          <div style={{ marginTop: 14 }}>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="cq-name">{t('settings.name')}</label>
                <input className="input" id="cq-name" value={qForm.name} onChange={e => setQForm(f => ({ ...f, name: e.target.value }))} placeholder={t('teach.namePlaceholder')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cq-difficulty">{t('common.difficulty')}</label>
                <select className="input" id="cq-difficulty" value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: Number(e.target.value) }))}>
                  {[1, 2, 3, 4].map(d => <option key={d} value={d}>{t('teach.difficultyLevel', { n: d })}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="cq-prompt">{t('teach.promptLabel')}</label>
              <textarea className="input" id="cq-prompt" style={{ fontFamily: 'inherit' }} value={qForm.prompt} onChange={e => setQForm(f => ({ ...f, prompt: e.target.value }))} />
              {qForm.prompt && <div className="typed-preview" style={{ marginTop: 8 }}><MathText text={qForm.prompt} /></div>}
            </div>
            <div className="field">
              <div className="label" id="cq-type">{t('teach.answerType')}</div>
              <div className="pill-select" role="group" aria-labelledby="cq-type">
                {[['numeric', 'teach.typeNumeric'], ['expression', 'teach.typeExpression'], ['mcq', 'teach.typeMcq']].map(([type, labelKey]) => (
                  <button key={type} className={`pill-opt ${qForm.answerType === type ? 'on' : ''}`} onClick={() => setQForm(f => ({ ...f, answerType: type }))}>{t(labelKey)}</button>
                ))}
              </div>
            </div>
            {qForm.answerType === 'numeric' && (
              <div className="field"><label className="label" htmlFor="cq-value">{t('teach.correctValue')}</label>
                <input className="input" id="cq-value" value={qForm.value} onChange={e => setQForm(f => ({ ...f, value: e.target.value }))} placeholder={t('teach.valuePlaceholder')} /></div>
            )}
            {qForm.answerType === 'expression' && (
              <div className="field"><label className="label" htmlFor="cq-expr">{t('teach.correctExpression')}</label>
                <input className="input" id="cq-expr" value={qForm.expr} onChange={e => setQForm(f => ({ ...f, expr: e.target.value }))} placeholder={t('teach.expressionPlaceholder')} /></div>
            )}
            {qForm.answerType === 'mcq' && (
              <div className="field">
                <div className="label">{t('teach.optionsLabel')}</div>
                {qForm.mcqOptions.map((o, i) => (
                  <div className="row" key={i} style={{ marginBottom: 6 }}>
                    <button className="mcq-key" aria-label={t('teach.markOptionCorrect', { letter: 'ABCD'[i] })}
                      aria-pressed={qForm.correctIndex === i}
                      style={{ background: qForm.correctIndex === i ? 'var(--good)' : undefined, color: qForm.correctIndex === i ? '#04150c' : undefined, border: 'none', cursor: 'pointer' }}
                      onClick={() => setQForm(f => ({ ...f, correctIndex: i }))}>{'ABCD'[i]}</button>
                    <input className="input" aria-label={t('teach.option', { letter: 'ABCD'[i] })} value={o} onChange={e => setQForm(f => ({ ...f, mcqOptions: f.mcqOptions.map((x, j) => j === i ? e.target.value : x) }))} />
                  </div>
                ))}
              </div>
            )}
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field"><label className="label" htmlFor="cq-solution">{t('verdict.workedSolution')}</label>
                <textarea className="input" id="cq-solution" style={{ fontFamily: 'inherit' }} value={qForm.solutionText} onChange={e => setQForm(f => ({ ...f, solutionText: e.target.value }))} /></div>
              <div className="field"><label className="label" htmlFor="cq-hint">{t('teach.hintOptional')}</label>
                <textarea className="input" id="cq-hint" style={{ fontFamily: 'inherit' }} value={qForm.hint} onChange={e => setQForm(f => ({ ...f, hint: e.target.value }))} /></div>
            </div>
            <button className="btn btn-primary" disabled={!qForm.prompt.trim()} onClick={saveCustomQ}>{t('teach.saveQuestion')}</button>
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
