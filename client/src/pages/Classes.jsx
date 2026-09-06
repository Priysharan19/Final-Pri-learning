import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';
import Class10NCERTLibrary from '../components/Class10NCERTLibrary.jsx';
import { readJSONFile } from '../lib/files.js';
import { useT } from '../i18n/index.js';

export default function Classes() {
  const { user, toast } = useApp();
  const nav = useNavigate();
  const t = useT();
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
      toast(<div><b>{t('classes.joined')}</b><div className="badge-desc">{t('classes.joinedFrom', {
        title: r.task?.title || t('classes.aTask'),
        teacher: typeof data.teacher === 'string' ? data.teacher : t('classes.yourTeacher')
      })}</div></div>, 4600);
      const fresh = await api.get('/tasks'); setTasks(fresh.tasks || []);
    } catch (err) { toast(err.message || t('classes.notAPack'), 4200); }
  };

  if (user.role === 'teacher') {
    nav('/teach', { replace: true });
    return null;
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 6 }}>
        <h1>{t('classes.title')}</h1>
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>{t('classes.importPack')}</button>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>{t('classes.sub')}</p>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importPack} />

      <AssignmentInboxPanel />

      {Number(user.year) === 10 && <Class10NCERTLibrary />}

      <section style={{ marginTop: 20 }} aria-labelledby="offline-class-packs-title">
        <div className="spread" style={{ marginBottom: 10 }}>
          <div>
            <h2 id="offline-class-packs-title" style={{ marginBottom: 2 }}>{t('classes.offlineTitle')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('classes.offlineSub')}</p>
          </div>
        </div>

        {joined.length === 0 ? (
          <div className="locked-wrap">
            <div className="card locked-card" style={{ padding: 40 }}>
              <div className="locked-icon" aria-hidden="true">🎓</div>
              <div className="locked-title">{t('classes.emptyTitle')}</div>
              <div className="locked-sub">{t('classes.emptySub')}</div>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>{t('classes.emptyImport')}</button>
              <div className="muted" style={{ marginTop: 16, fontSize: 12.5 }}>{t('classes.cloudNote')}</div>
            </div>
          </div>
        ) : (
          <div className="grid cols-2">
            {joined.map(task => (
              <div className="card" key={task.id}>
                <div className="spread">
                  <h3>{task.title}</h3>
                  <span className="tag tag-brand">{typeof task.fromPack === 'string' ? task.fromPack : t('classes.classTask')}</span>
                </div>
                <p className="muted" style={{ margin: '6px 0 14px' }}>
                  {t('common.questionsCounted', { count: task.count, n: task.count })}
                  {task.dueAt ? t('classes.dueOn', { date: new Date(task.dueAt).toLocaleDateString(user.locale) }) : ''}
                </p>
                <div className="row">
                  <button className="btn btn-primary btn-sm" onClick={() => nav(`/practice?task=${task.id}`)}>{t('classes.continue')}</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => nav('/tasks')}>{t('classes.allTasks')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
