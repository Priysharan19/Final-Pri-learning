// Tasks — assigned by a teacher on this device, or set for yourself.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Ring } from '../components/Charts.jsx';
import { readJSONFile } from '../lib/files.js';

export default function Tasks() {
  const { user, toast } = useApp();
  const [tasks, setTasks] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', subtopics: [], count: 10 });
  const packRef = useRef(null);
  const nav = useNavigate();

  const load = () => api.get('/tasks').then(r => setTasks(r.tasks)).catch(() => setTasks([]));
  useEffect(() => { load(); api.get('/curriculum').then(setCurriculum).catch(() => { }); }, []);

  const mySubtopics = (() => {
    if (!curriculum) return [];
    if (user.year >= 11 && user.pathway === 'standard') {
      return curriculum.streams?.find(g => g.key === `standard-${user.year}`)?.subtopics || [];
    }
    const core = curriculum.years.find(y => y.year === user.year)?.subtopics || [];
    const extra = (curriculum.streams || []).filter(g => g.year === user.year).flatMap(g => g.subtopics);
    return [...core, ...extra];
  })();

  async function importPack(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = await readJSONFile(f);
      const r = await api.post('/tasks/import-pack', data);
      toast?.(<span>📦 Imported “{r.task.title}”{data.teacher ? ` from ${data.teacher}` : ''}</span>);
      load();
    } catch (err) { toast?.(<span>⚠️ {err.message}</span>); }
  }

  async function create() {
    await api.post('/tasks', { ...form, title: form.title || 'My practice goal' });
    setCreating(false);
    setForm({ title: '', subtopics: [], count: 10 });
    load();
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">Tasks</h1>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Tasks</h2>
          <p className="sub" style={{ marginTop: 3 }}>Assignments from your teacher on this device, plus goals you set yourself.</p>
        </div>
        <div className="row">
          {/* this was a <label> wrapping a display:none file input — clickable
              with a mouse, unreachable with a keyboard, because a hidden input
              is not focusable and a label is not a control */}
          <button className="btn btn-ghost" onClick={() => packRef.current?.click()}>📦 Import task pack</button>
          <input ref={packRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importPack} />
          <button className="btn btn-primary" onClick={() => setCreating(c => !c)}>{creating ? 'Cancel' : '＋ Set myself a task'}</button>
        </div>
      </div>

      {creating && (
        <div className="card">
          <div className="field">
            <label className="label" htmlFor="task-title">Task name</label>
            <input className="input" id="task-title" value={form.title} placeholder="e.g. Trig tune-up before Friday"
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <div className="label" id="task-topics">Topics ({form.subtopics.length} selected)</div>
            <div className="pill-select" role="group" aria-labelledby="task-topics">
              {mySubtopics.map(s => (
                <button key={s.id} className={`pill-opt ${form.subtopics.includes(s.id) ? 'on' : ''}`}
                  onClick={() => setForm(f => ({ ...f, subtopics: f.subtopics.includes(s.id) ? f.subtopics.filter(x => x !== s.id) : [...f.subtopics, s.id] }))}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label className="label" htmlFor="task-count">Questions — {form.count}</label>
            <input type="range" id="task-count" min="5" max="30" step="5" value={form.count} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
              onChange={e => setForm(f => ({ ...f, count: Number(e.target.value) }))} />
          </div>
          <button className="btn btn-primary" disabled={!form.subtopics.length} onClick={create}>Create task</button>
        </div>
      )}

      <div className="card">
        {!tasks && <div className="skeleton" style={{ height: 120 }} />}
        {tasks && !tasks.length && (
          <p className="muted">No tasks yet. A teacher profile on this device can assign them from Teacher Studio — or set yourself a goal above.</p>
        )}
        {tasks && tasks.map(t => (
          <div className="task-row" key={t.id}>
            <div className="task-ring">
              <Ring value={Math.min(t.done, t.count)} max={t.count} size={40}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{Math.min(t.done, t.count)}</span>
              </Ring>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{t.title} {t.finished && <span className="tag" style={{ color: 'var(--good)' }}>✓ done</span>}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {t.className ? `From ${t.className} · ` : 'Personal · '}
                {t.done}/{t.count} answered{t.done ? ` · ${Math.round(100 * t.correctCount / Math.max(1, t.done))}% correct` : ''}
                {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
              </div>
            </div>
            {!t.finished && (
              <button className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?task=${t.id}`)}>Continue</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
