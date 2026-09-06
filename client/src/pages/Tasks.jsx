// Tasks — assigned by a teacher on this device, or set for yourself. An Indian
// student sets a goal on the NCERT / JEE / olympiad syllabus — a class or
// track, chapters, optionally one dot point and a difficulty — and the task is
// served through the same India question path as Practice.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Ring } from '../components/Charts.jsx';
import { readJSONFile } from '../lib/files.js';
import { assignmentSections, defaultSectionKey, describeTaskTargets } from '../platform/assignmentTarget.js';
import { useT } from '../i18n/index.js';

export default function Tasks() {
  const { user, toast } = useApp();
  const t = useT();
  const india = user?.course === 'in';
  const [tasks, setTasks] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', subtopics: [], count: 10, sectionKey: defaultSectionKey(user), chapters: [], dotpoint: null, difficulty: null });
  const packRef = useRef(null);
  const nav = useNavigate();

  const load = () => api.get('/tasks').then(r => setTasks(r.tasks)).catch(() => setTasks([]));
  useEffect(() => { load(); if (!india) api.get('/curriculum').then(setCurriculum).catch(() => { }); }, []); // eslint-disable-line

  const sections = useMemo(() => (india ? assignmentSections() : []), [india]);
  const section = sections.find(s => s.key === form.sectionKey) || sections[0];
  const soleChapter = form.chapters.length === 1 ? section?.chapters.find(ch => ch.id === form.chapters[0]) || sections.flatMap(s => s.chapters).find(ch => ch.id === form.chapters[0]) : null;

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
      toast?.(<span>{data.teacher
        ? t('tasks.importedFrom', { title: r.task.title, teacher: data.teacher })
        : t('tasks.imported', { title: r.task.title })}</span>);
      load();
    } catch (err) { toast?.(<span>⚠️ {err.message}</span>); }
  }

  async function create() {
    const body = india
      ? {
          title: form.title || t('tasks.defaultName'), count: form.count,
          targets: form.chapters.map(id => ({ chapterId: id, dotpoint: soleChapter ? form.dotpoint : null, track: section?.track || user.indiaTrack || 'cbse', difficulty: form.difficulty }))
        }
      : { title: form.title || t('tasks.defaultName'), subtopics: form.subtopics, count: form.count };
    await api.post('/tasks', body);
    setCreating(false);
    setForm(f => ({ ...f, title: '', subtopics: [], chapters: [], dotpoint: null, difficulty: null, count: 10 }));
    load();
  }

  const canCreate = india ? form.chapters.length > 0 : form.subtopics.length > 0;
  const dueText = ms => new Date(ms).toLocaleDateString(india ? 'en-IN' : 'en-AU', { day: 'numeric', month: 'short' });

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">{t('tasks.title')}</h1>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>{t('tasks.title')}</h2>
          <p className="sub" style={{ marginTop: 3 }}>{t('tasks.sub')}</p>
        </div>
        <div className="row">
          {/* this was a <label> wrapping a display:none file input — clickable
              with a mouse, unreachable with a keyboard, because a hidden input
              is not focusable and a label is not a control */}
          <button className="btn btn-ghost" onClick={() => packRef.current?.click()}>{t('tasks.importPack')}</button>
          <input ref={packRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importPack} />
          <button className="btn btn-primary" onClick={() => setCreating(c => !c)}>{creating ? t('common.cancel') : t('tasks.setMyself')}</button>
        </div>
      </div>

      {creating && (
        <div className="card">
          <div className="field">
            <label className="label" htmlFor="task-title">{t('tasks.name')}</label>
            <input className="input" id="task-title" value={form.title} placeholder={t(india ? 'tasks.namePlaceholderIndia' : 'tasks.namePlaceholder')}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          {india ? (
            <>
              <div className="field" style={{ maxWidth: 360 }}>
                <label className="label" htmlFor="task-section">{t('tasks.classOrTrack')}</label>
                <select className="input" id="task-section" value={form.sectionKey} onChange={e => setForm(f => ({ ...f, sectionKey: e.target.value, dotpoint: null }))}>
                  {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="label" id="task-topics">{t('tasks.chaptersSelected', { n: form.chapters.length })}</div>
                <div className="pill-select" role="group" aria-labelledby="task-topics">
                  {(section?.chapters || []).map(ch => (
                    <button key={ch.id} className={`pill-opt ${form.chapters.includes(ch.id) ? 'on' : ''}`} aria-pressed={form.chapters.includes(ch.id)}
                      onClick={() => setForm(f => ({ ...f, dotpoint: null, chapters: f.chapters.includes(ch.id) ? f.chapters.filter(x => x !== ch.id) : [...f.chapters, ch.id] }))}>
                      {ch.name}
                    </button>
                  ))}
                </div>
              </div>
              {soleChapter && (
                <div className="field">
                  <div className="label" id="task-dotpoint">{t('tasks.dotpointIn', { chapter: soleChapter.name })}</div>
                  <div className="pill-select" role="group" aria-labelledby="task-dotpoint">
                    <button className={`pill-opt ${form.dotpoint == null ? 'on' : ''}`} aria-pressed={form.dotpoint == null} onClick={() => setForm(f => ({ ...f, dotpoint: null }))}>{t('tasks.wholeChapter')}</button>
                    {soleChapter.dotpoints.map((text, i) => (
                      <button key={i} className={`pill-opt ${form.dotpoint === i ? 'on' : ''}`} aria-pressed={form.dotpoint === i} title={text}
                        onClick={() => setForm(f => ({ ...f, dotpoint: i }))}>{i + 1}. {text.length > 44 ? `${text.slice(0, 42)}…` : text}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="field">
                <div className="label" id="task-difficulty">{t('common.difficulty')}</div>
                <div className="pill-select" role="group" aria-labelledby="task-difficulty">
                  {[null, ...Array.from({ length: section?.difficultyCeiling || 3 }, (_, i) => i + 1)].map(d => (
                    <button key={String(d)} className={`pill-opt ${form.difficulty === d ? 'on' : ''}`} aria-pressed={form.difficulty === d}
                      onClick={() => setForm(f => ({ ...f, difficulty: d }))}>{d == null ? t('common.adaptive') : `D${d}`}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="field">
              <div className="label" id="task-topics">{t('tasks.topicsSelected', { n: form.subtopics.length })}</div>
              <div className="pill-select" role="group" aria-labelledby="task-topics">
                {mySubtopics.map(s => (
                  <button key={s.id} className={`pill-opt ${form.subtopics.includes(s.id) ? 'on' : ''}`}
                    onClick={() => setForm(f => ({ ...f, subtopics: f.subtopics.includes(s.id) ? f.subtopics.filter(x => x !== s.id) : [...f.subtopics, s.id] }))}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field" style={{ maxWidth: 260 }}>
            <label className="label" htmlFor="task-count">{t('tasks.questionCount', { n: form.count })}</label>
            <input type="range" id="task-count" min="5" max="30" step="5" value={form.count} style={{ width: '100%', accentColor: 'var(--brand-1)' }}
              onChange={e => setForm(f => ({ ...f, count: Number(e.target.value) }))} />
          </div>
          <button className="btn btn-primary" disabled={!canCreate} onClick={create}>{t('tasks.create')}</button>
        </div>
      )}

      <div className="card">
        {!tasks && <div className="skeleton" style={{ height: 120 }} />}
        {tasks && !tasks.length && (
          <p className="muted">{t('tasks.empty')}</p>
        )}
        {tasks && tasks.map(task => (
          <div className="task-row" key={task.id}>
            <div className="task-ring">
              <Ring value={Math.min(task.done, task.count)} max={task.count} size={40}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{Math.min(task.done, task.count)}</span>
              </Ring>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{task.title} {task.finished && <span className="tag" style={{ color: 'var(--good)' }}>{t('tasks.finished')}</span>}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {task.className ? t('tasks.fromClass', { className: task.className }) : t('tasks.personal')}
                {t('tasks.answeredOf', { done: task.done, count: task.count })}
                {task.done ? t('tasks.percentCorrect', { n: Math.round(100 * task.correctCount / Math.max(1, task.done)) }) : ''}
                {task.dueAt ? t('tasks.due', { date: dueText(task.dueAt) }) : ''}
              </div>
              {task.targets?.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{describeTaskTargets(task.targets)}</div>}
            </div>
            {!task.finished && (
              <button className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?task=${task.id}`)}>{t('common.continue')}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
