import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { colourFor, scopeFor } from './chapters.js';
import { dayKey, timezoneOf } from '../lib/locale.js';
import TermGloss from '../components/TermGloss.jsx';

// The top of the v1.1 Report: four honest figures, the practice heat-map and
// where marks were lost. Every figure states its count; marks are the server-
// certified totals only. The existing Progress page follows unchanged.

const WEEKS = 15;

// Activity is filed under the profile's own calendar day (dayKey with the
// profile's timezone, local/backend.js), so the squares are built the same
// way: today in that timezone, then one calendar date back at a time — never a
// fixed 24-hour step, which skips or repeats a date across a clock change.
function previousDate(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

export default function ReportHead() {
  const { user } = useApp();
  const t = useT();
  const [stats, setStats] = useState(null);
  const [marks, setMarks] = useState(null);
  const [curriculum, setCurriculum] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/stats').then(s => live && setStats(s)).catch(() => live && setStats({}));
    api.get('/marks/by-chapter').then(r => live && setMarks(r?.chapters || {})).catch(() => live && setMarks({}));
    api.get('/curriculum').then(c => live && setCurriculum(c)).catch(() => { });
    return () => { live = false; };
  }, []);

  const view = useMemo(() => {
    if (!stats || !marks) return null;
    const certified = Object.values(marks).reduce((a, m) => ({ earned: a.earned + m.earned, possible: a.possible + m.possible }), { earned: 0, possible: 0 });
    const activity = Array.isArray(stats.activity) ? stats.activity : [];
    const byDay = new Map(activity.map(d => [d.date, Number(d.questions) || 0]));
    const keys = [dayKey(Date.now(), timezoneOf(user))];
    while (keys.length < WEEKS * 7) keys.push(previousDate(keys[keys.length - 1]));
    const cells = keys.reverse().map(key => ({ key, n: byDay.get(key) || 0 }));
    // Days practised in the window the grid shows, so the figure, the grid and
    // its spoken label all say the same thing.
    const days = cells.filter(c => c.n > 0).length;
    const max = Math.max(1, ...cells.map(c => c.n));
    const rows = scopeFor(curriculum, user)?.chapters || scopeFor(curriculum, user)?.subtopics || [];
    const nameOf = id => rows.find(r => r.id === id)?.name || null;
    const colourOf = id => { const i = rows.findIndex(r => r.id === id); return i >= 0 ? colourFor(i) : '--in-tx-3'; };
    const lost = Object.entries(marks)
      .map(([id, m]) => ({ id, name: nameOf(id), lost: m.possible - m.earned, ...m }))
      .filter(c => c.name && c.lost > 0)
      .sort((a, b) => b.lost - a.lost || a.name.localeCompare(b.name)).slice(0, 3);
    const streak = typeof stats.streak === 'number' ? stats.streak : Number(stats.streak?.current) || 0;
    // Answers checked, without repeats (an answer to a question whose solution
    // the student had already seen is not a new answer).
    const answered = Math.max(0, (Number(stats.totals?.attempts) || 0) - (Number(stats.totals?.repeats) || 0));
    return { certified, answered, days, streak, cells, max, lost, colourOf };
  }, [stats, marks, curriculum, user]);

  if (!view) return <div className="skeleton" style={{ height: 220, marginBottom: 24 }} aria-hidden="true" />;

  return (
    <section className="in-report" aria-labelledby="in-report-title" data-instrument-report>
      {/* The Progress page below carries the page's h1; this summary is its own
          section heading so the page keeps one h1. */}
      <h2 id="in-report-title" className="in-report-title">{t('inst.reportTitle')}</h2>
      <div className="in-report-figs">
        <div><b>{view.answered}</b><small>{t('inst.reportAnswered')}</small></div>
        <div data-report-marks><b>{view.certified.possible ? `${view.certified.earned}` : '—'}{view.certified.possible ? <span>/{view.certified.possible}</span> : null}</b><small>{t('inst.reportMarks')}</small></div>
        <div><b>{view.days}</b><small>{t('inst.reportDays', { n: WEEKS })}</small></div>
        <div><b>{view.streak}</b><small>{t('inst.reportStreak')}</small></div>
      </div>
      <div className="in-report-row">
        <div className="in-report-heat">
          <h2>{t('inst.reportHeat', { n: WEEKS })}</h2>
          <div className="in-heat" role="img" aria-label={t('inst.reportHeatSpoken', { days: view.days, n: WEEKS })}>
            {view.cells.map(c => <i key={c.key} style={{ '--v': c.n ? 0.25 + (c.n / view.max) * 0.75 : 0 }} className={c.n ? 'is-on' : ''} title={t('inst.reportHeatCell', { date: c.key, n: c.n })} />)}
          </div>
        </div>
        <div className="in-report-lost">
          <h2>{t('inst.reportLost')}</h2>
          {view.lost.length ? (
            <ul>{view.lost.map(c => (
              <li key={c.id} style={{ '--cc': `var(${view.colourOf(c.id)})` }}>
                <i aria-hidden="true" /><span lang="en"><TermGloss text={c.name} /></span><small>{`${c.earned} / ${c.possible}`}</small>
              </li>
            ))}</ul>
          ) : <p className="in-note">{t('inst.reportLostNone')}</p>}
        </div>
      </div>
    </section>
  );
}
