// Teacher Studio — classes, assigned tasks, class analytics and custom
// questions, all with local profiles on this device.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { downloadJSON, readJSONFile, dateStamp } from '../lib/files.js';
import { MathText } from '../lib/latex.jsx';
import { SUBTOPIC_BY_ID, CURRICULUM } from '../engine/curriculum.js';

export default function Teach() {
  const [data, setData] = useState(null);        // {classes, allProfiles}
  const [analytics, setAnalytics] = useState(null);
  const [selClass, setSelClass] = useState(null);
  const [newClass, setNewClass] = useState('');
  const [taskForm, setTaskForm] = useState({ title: '', subtopics: [], count: 10, days: 7, customIds: [] });
  const [customs, setCustoms] = useState([]);
  const [showQBuilder, setShowQBuilder] = useState(false);
  const [qForm, setQForm] = useState({ name: '', prompt: '', answerType: 'numeric', value: '', expr: '', mcqOptions: ['', '', '', ''], correctIndex: 0, solutionText: '', hint: '', difficulty: 2 });
  const [msg, setMsg] = useState('');
  const progressRef = useRef(null);

  const load = async () => {
    const r = await api.get('/classes');
    setData(r);
    if (selClass && !r.classes.find(c => c.id === selClass)) setSelClass(null);
    const cq = await api.get('/custom-questions');
    setCustoms(cq.questions);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!selClass) { setAnalytics(null); return; }
    api.get(`/classes/${selClass}/analytics`).then(setAnalytics).catch(() => setAnalytics(null));
  }, [selClass]);

  const cls = data?.classes.find(c => c.id === selClass);
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

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
    api.get(`/classes/${selClass}/analytics`).then(setAnalytics).catch(() => { });
  }

  async function assignTask() {
    await api.post('/tasks', {
      classId: selClass, title: taskForm.title || 'Class task',
      subtopics: taskForm.subtopics, customIds: taskForm.customIds,
      count: taskForm.customIds.length || taskForm.count,
      dueAt: Date.now() + taskForm.days * 86400000
    });
    setTaskForm({ title: '', subtopics: [], count: 10, days: 7, customIds: [] });
    flash('Task assigned ✓');
    api.get(`/classes/${selClass}/analytics`).then(setAnalytics).catch(() => { });
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

  const allSubtopics = CURRICULUM.flatMap(y => y.subtopics.map(s => ({ ...s, year: y.year })));

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
              {/* selecting the class used to be an onClick on this row's <div> */}
              <button onClick={() => setSelClass(c.id)} aria-pressed={selClass === c.id}
                style={{ flex: 1, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 650 }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{c.students.map(s => s.name).join(', ') || 'No students yet'}</div>
              </button>
              {selClass === c.id && <span className="tag tag-brand">selected</span>}
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" aria-label="New class name" placeholder="New class name (e.g. 10MaA)" value={newClass}
              onChange={e => setNewClass(e.target.value)} onKeyDown={e => e.key === 'Enter' && createClass()} />
            <button className="btn btn-primary" onClick={createClass}>Create</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Students in {cls ? cls.name : '…'}</div>
          {!cls && <p className="muted">Select or create a class, then add student profiles from this device.</p>}
          {cls && (data?.allProfiles || []).map(p => {
            const inClass = cls.studentPids.includes(p.id);
            return (
              <div className="prio-item" key={p.id}>
                <span style={{ fontSize: 22 }}>{p.avatar || '🙂'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 640 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Year {p.year}</div>
                </div>
                <button className={`btn btn-sm ${inClass ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleStudent(p.id, inClass)}>
                  {inClass ? 'Remove' : 'Add'}
                </button>
              </div>
            );
          })}
          {cls && !(data?.allProfiles || []).length && <p className="muted">No student profiles on this device yet — create some from the profile screen.</p>}
        </div>
      </div>

      {cls && (
        <div className="card">
          <div className="card-title">Assign a task to {cls.name}</div>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <div>
              <div className="field">
                <label className="label" htmlFor="teach-task-title">Title</label>
                <input className="input" id="teach-task-title" value={taskForm.title} placeholder="e.g. Quadratics revision"
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
              <button className="btn btn-primary" disabled={!taskForm.subtopics.length && !taskForm.customIds.length} onClick={assignTask}>
                Assign task
              </button>
            </div>
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
          </div>
        </div>
      )}

      {analytics && (
        <div className="card">
          <div className="spread">
            <div className="card-title" style={{ marginBottom: 0 }}>Class analytics — {analytics.class.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => progressRef.current?.click()}>📥 Import progress file</button>
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
                    api.get(`/classes/${selClass}/analytics`).then(setAnalytics);
                  } catch (err) { setMsg(`⚠️ ${err.message}`); }
                }} />
          <p className="muted" style={{ margin: '6px 0 10px' }}>Students on other iPads export a progress file from Settings — import it here and they appear below alongside on-device profiles.</p>
          <table className="table">
            <thead><tr><th>Student</th><th>Predicted</th><th>Answered</th><th>Accuracy</th><th>Streak</th><th>Weakest area</th></tr></thead>
            <tbody>
              {analytics.students.map(s => (
                <tr key={s.id}>
                  <td>{s.avatar} {s.name} <span className="muted">Y{s.year}</span>{s.imported && <span className="tag" style={{ marginLeft: 6 }} title={`Imported ${new Date(s.importedAt).toLocaleDateString()}`}>📄 file</span>}</td>
                  <td><b>{s.predicted}</b>/100</td>
                  <td>{s.attempts}</td>
                  <td>{s.attempts ? Math.round(100 * s.correct / s.attempts) : 0}%</td>
                  <td>{s.streak}d</td>
                  <td className="muted">{s.weakest}</td>
                </tr>
              ))}
              {!analytics.students.length && <tr><td colSpan="6" className="muted">Add students to see analytics.</td></tr>}
            </tbody>
          </table>
          {analytics.tasks.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 18 }}>Task progress</div>
              {analytics.tasks.map(t => (
                <div key={t.id} className="task-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 650 }}>{t.title} <span className="muted">· {t.count} questions</span></div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {t.progress.map(p => `${p.name}: ${p.done}/${t.count}${p.finished ? ' ✓' : ''}`).join(' · ')}
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
                  <button className="btn btn-quiet btn-sm" onClick={async () => { await api.post(`/tasks/${t.id}/delete`); api.get(`/classes/${selClass}/analytics`).then(setAnalytics); }}>Delete</button>
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
    </div>
  );
}
