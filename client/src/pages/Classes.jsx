import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { readJSONFile } from '../lib/files.js';

export default function Classes() {
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [tasks, setTasks] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { api.get('/tasks').then(r => setTasks(r.tasks || [])).catch(() => setTasks([])); }, []);

  const joined = (tasks || []).filter(t => t.fromPack || t.className);

  const importPack = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = await readJSONFile(f);
      const r = await api.post('/tasks/import-pack', data);
      toast(<div><b>Joined!</b><div className="badge-desc">“{r.task?.title || 'Task'}” from {typeof data.teacher === 'string' ? data.teacher : 'your teacher'} added to Tasks.</div></div>, 4600);
      const t = await api.get('/tasks'); setTasks(t.tasks || []);
    } catch (err) { toast(err.message || 'That file isn’t a class pack.', 4200); }
  };

  if (user.role === 'teacher') {
    nav('/teach', { replace: true });
    return null;
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 6 }}>
        <h1>Classes</h1>
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>＋ Join Class</button>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>your enrolled classes</p>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importPack} />

      {joined.length === 0 ? (
        <div className="locked-wrap">
          <div className="card locked-card" style={{ padding: 40 }}>
            <div className="locked-icon" aria-hidden="true">🎓</div>
            <div className="locked-title">No classes yet</div>
            <div className="locked-sub">
              Join a class with a <b>class pack</b> — a small file your teacher exports from their Pri Learning
              Teacher Studio and shares with you (AirDrop, email, USB — no internet account needed).
            </div>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>＋ Join Your First Class</button>
            <div className="muted" style={{ marginTop: 16, fontSize: 12.5 }}>
              A parent or tutor on this iPad? Create a teacher profile from the start screen and build tasks in Teacher Studio.
            </div>
          </div>
        </div>
      ) : (
        <div className="grid cols-2">
          {joined.map(t => (
            <div className="card" key={t.id}>
              <div className="spread">
                <h3>{t.title}</h3>
                <span className="tag tag-brand">{typeof t.fromPack === 'string' ? t.fromPack : 'Class task'}</span>
              </div>
              <p className="muted" style={{ margin: '6px 0 14px' }}>
                {t.count} questions{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}
              </p>
              <div className="row">
                <button className="btn btn-primary btn-sm" onClick={() => nav(`/practice?task=${t.id}`)}>Continue →</button>
                <button className="btn btn-quiet btn-sm" onClick={() => nav('/tasks')}>All tasks</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
