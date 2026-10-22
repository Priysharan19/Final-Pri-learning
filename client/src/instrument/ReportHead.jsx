import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { colourFor, scopeFor } from './chapters.js';
import { dayKey, localeOf, timezoneOf } from '../lib/locale.js';
import TermGloss from '../components/TermGloss.jsx';
import BarSlot from './BarSlot.jsx';
import './report.css';

/** The headline figure, rolled digit by digit (presentation only): each digit
 *  is a column 0–9 that settles on its value, the last digit first. The text
 *  itself is read once, by its label; Reduce Motion cross-fades instead. */
function Roll({ text }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(id); }, [text]);
  const chars = String(text).split('');
  const digits = chars.filter(c => /\d/.test(c)).length;
  let seen = 0;
  return (
    <span className={`lux-roll${on ? ' is-on' : ''}`} role="img" aria-label={String(text)} key={text}>
      {chars.map((c, i) => {
        if (!/\d/.test(c)) return <span key={i} className="lux-roll-c" aria-hidden="true">{c}</span>;
        const order = digits - 1 - seen++;
        return (
          <span key={i} className="lux-roll-d" aria-hidden="true" style={{ '--v': Number(c), '--o': order }}>
            <span className="lux-roll-col">{'0123456789'.split('').map(d => <span key={d}>{d}</span>)}</span>
            <span className="lux-roll-sizer">{c}</span>
          </span>
        );
      })}
    </span>
  );
}

// The top of the v1.1 Report (design s7): the period, a fixed-template lede
// built from the figures, four honest figures with their change against the
// window before, the method/accuracy chart, the practice heat-map and where
// marks were lost. Every figure is GET /report/series (server-certified
// receipts only, engine/reportSeries.js) or GET /marks/by-chapter; a
// percentage the evidence floor withholds is "—" and a chart point it
// withholds is a gap, never a zero. The existing Progress page follows.

const WEEKS = 15;
const PERIODS = ['week', 'month', 'term'];

function previousDate(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

const noon = key => `${key}T12:00:00Z`;
// A calendar date's name (a month or a weekday) in the interface language.
function dateName(key, user, options) {
  try { return new Intl.DateTimeFormat(user?.language === 'hi' ? 'hi-IN' : localeOf(user), { timeZone: 'UTC', ...options }).format(new Date(noon(key))); } catch { return key; }
}
const fmtPct = v => (v == null ? '—' : `${Math.round(v)}%`);

/** A signed change, or nothing when there is none to state. */
function Delta({ n, unit = '' }) {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  const v = Math.round(n);
  if (!v) return null;
  const text = `${v > 0 ? '+' : '−'}${Math.abs(v)}${unit ? ` ${unit}` : ''}`;
  return <> <em className={v < 0 ? 'is-down' : undefined} data-report-delta>{text}</em></>;
}

// The chart, drawn as SVG in a fixed 1000×300 frame (the design's .chart).
const CW = 1000; const CH = 300; const PADX = 40; const PADB = 30; const PADT = 40;

function Chart({ series, labels, t, spoken, failed }) {
  const n = series.length;
  const X = i => (n <= 1 ? CW / 2 : PADX + (i * (CW - 2 * PADX)) / (n - 1));
  const Y = v => CH - PADB - ((Math.max(0, Math.min(100, v)) - 0) / 100) * (CH - PADB - PADT);
  // Runs of consecutive non-null points: a null is a gap in the line.
  const runs = key => {
    const out = []; let cur = [];
    series.forEach((p, i) => { if (p[key] == null) { if (cur.length) out.push(cur); cur = []; } else cur.push(i); });
    if (cur.length) out.push(cur);
    return out;
  };
  const path = (run, key) => run.map((i, k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(series[i][key]).toFixed(1)}`).join(' ');
  const area = run => `${path(run, 'methodPct')} L${X(run[run.length - 1]).toFixed(1)} ${CH - PADB} L${X(run[0]).toFixed(1)} ${CH - PADB} Z`;
  const any = series.some(p => p.methodPct != null || p.accuracyPct != null);
  const last = key => { for (let i = n - 1; i >= 0; i--) if (series[i][key] != null) return i; return -1; };
  const lm = last('methodPct'); const la = last('accuracyPct');
  // The two end values never collide: the higher line's value goes above its
  // dot and the lower line's below, decided from the values (deterministic).
  const methodAbove = lm < 0 || la < 0 || Y(series[lm].methodPct) <= Y(series[la].accuracyPct);
  const side = above => (above ? ' is-above' : ' is-below');
  // Label every tick when they fit, else every other one (13 term weeks).
  const every = n > 8 ? 2 : 1;
  const gridX = Array.from({ length: 33 }, (_, i) => i * (CW / 32));
  const gridY = Array.from({ length: 11 }, (_, i) => i * (CH / 10));
  return (
    <div className="in-chart" data-report-chart={any ? 'drawn' : failed ? 'failed' : 'empty'}>
      <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label={spoken}>
        <defs><pattern id="lux-chart-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" /></pattern></defs>
        <g className="in-chart-grid" aria-hidden="true">
          {gridX.map(x => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={CH} />)}
          {gridY.map(y => <line key={`y${y}`} x1={0} y1={y} x2={CW} y2={y} />)}
        </g>
        {runs('methodPct').map((r, k) => r.length > 1 && <path key={`a${k}`} className="in-chart-area" d={area(r)} />)}
        {runs('methodPct').map((r, k) => r.length > 1
          ? <path key={`m${k}`} className="in-chart-line is-method" d={path(r, 'methodPct')} pathLength="1" data-chart-line="method" />
          : null)}
        {runs('accuracyPct').map((r, k) => r.length > 1
          ? <path key={`c${k}`} className="in-chart-line is-accuracy" d={path(r, 'accuracyPct')} data-chart-line="accuracy" />
          : null)}
      </svg>
      {/* Dots and text sit outside the stretched SVG so they stay round and
          undistorted: a lone point (a run of one) and each line's end. */}
      <div className="in-chart-text" aria-hidden="true">
        {['methodPct', 'accuracyPct'].flatMap(key => runs(key).filter(r => r.length === 1).map(r => (
          <i key={`${key}${r[0]}`} className={`in-chart-dot is-pt ${key === 'methodPct' ? 'is-method' : 'is-accuracy'}`} data-chart-line={key === 'methodPct' ? 'method' : 'accuracy'}
            style={{ left: `${(X(r[0]) / CW) * 100}%`, top: `${(Y(series[r[0]][key]) / CH) * 100}%` }} />)))}
        {lm >= 0 && <i className="in-chart-dot is-end is-method" style={{ left: `${(X(lm) / CW) * 100}%`, top: `${(Y(series[lm].methodPct) / CH) * 100}%` }} />}
        {la >= 0 && <i className="in-chart-dot is-end is-accuracy" style={{ left: `${(X(la) / CW) * 100}%`, top: `${(Y(series[la].accuracyPct) / CH) * 100}%` }} />}
        {lm >= 0 && <span className={`in-chart-val is-method${side(methodAbove)}`} style={{ left: `${(X(lm) / CW) * 100}%`, top: `${(Y(series[lm].methodPct) / CH) * 100}%` }}>{fmtPct(series[lm].methodPct)}</span>}
        {la >= 0 && <span className={`in-chart-val is-accuracy${side(!methodAbove)}`} style={{ left: `${(X(la) / CW) * 100}%`, top: `${(Y(series[la].accuracyPct) / CH) * 100}%` }}>{fmtPct(series[la].accuracyPct)}</span>}
        {labels.map((l, i) => (i % every === 0 || i === n - 1) && <span key={i} className="in-chart-tick" style={{ left: `${(X(i) / CW) * 100}%` }}>{l}</span>)}
      </div>
      <div className="in-chart-lg" aria-hidden="true"><span><i className="is-method" />{t('inst.chartMethod')}</span><span><i className="is-accuracy" />{t('inst.chartAccuracy')}</span></div>
      {!any && !failed && <p className="in-chart-empty" data-chart-empty>{t('inst.chartEmpty')}</p>}
    </div>
  );
}

export default function ReportHead() {
  const { user } = useApp();
  const t = useT();
  const [period, setPeriod] = useState('week');
  const [report, setReport] = useState(null);
  const [failed, setFailed] = useState(false);
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

  useEffect(() => {
    let live = true;
    setFailed(false);
    setReport(null);   // never the old period's figures under the new title
    // Week is the route's default period, so it is asked for without a query.
    api.get(period === 'week' ? '/report/series' : `/report/series?period=${period}`)
      .then(r => { if (live) setReport(r && r.period === period ? r : null); if (live && !r) setFailed(true); })
      .catch(() => { if (live) { setReport(null); setFailed(true); } });
    return () => { live = false; };
  }, [period]);

  const view = useMemo(() => {
    if (!stats || !marks) return null;
    const activity = Array.isArray(stats.activity) ? stats.activity : [];
    const byDay = new Map(activity.map(d => [d.date, Number(d.questions) || 0]));
    const keys = [dayKey(Date.now(), timezoneOf(user))];
    while (keys.length < WEEKS * 7) keys.push(previousDate(keys[keys.length - 1]));
    const cells = keys.reverse().map(key => ({ key, n: byDay.get(key) || 0 }));
    const heatDays = cells.filter(c => c.n > 0).length;
    const max = Math.max(1, ...cells.map(c => c.n));
    const rows = scopeFor(curriculum, user)?.chapters || scopeFor(curriculum, user)?.subtopics || [];
    const nameOf = id => rows.find(r => r.id === id)?.name || null;
    const colourOf = id => { const i = rows.findIndex(r => r.id === id); return i >= 0 ? colourFor(i) : '--in-tx-3'; };
    const lost = Object.entries(marks)
      .map(([id, m]) => ({ id, name: nameOf(id), lost: m.possible - m.earned, ...m }))
      .filter(c => c.name && c.lost > 0)
      .sort((a, b) => b.lost - a.lost || a.name.localeCompare(b.name)).slice(0, 3);
    return { cells, heatDays, max, lost, colourOf };
  }, [stats, marks, curriculum, user]);

  if (!view) return <div className="skeleton" style={{ height: 220, marginBottom: 24 }} aria-hidden="true" />;

  // Only the series for the period on screen is ever shown.
  const shown = report?.period === period ? report : null;
  const cur = shown?.current || null;
  const series = Array.isArray(shown?.series) ? shown.series : [];
  const title = period === 'week' ? t('inst.reportThisWeek')
    : period === 'term' ? t('inst.reportThisTerm')
      : cur ? dateName(cur.to, user, { month: 'long' }) : t('inst.periodMonth');
  const labels = series.map((p, i) => (period === 'week'
    ? dateName(p.from, user, { weekday: 'short' })
    : t('inst.chartWk', { n: i + 1 })));
  const spoken = `${t('inst.chartTitle')}. ` + series.map((p, i) => (p.methodPct == null && p.accuracyPct == null
    ? t('inst.chartPointNone', { label: labels[i] })
    : t('inst.chartPoint', { label: labels[i], m: fmtPct(p.methodPct), a: fmtPct(p.accuracyPct) }))).join('; ');

  // The lede: a fixed template over the figures above, nothing generated.
  const lede = [];
  if (cur) {
    if (cur.methodPct != null && cur.accuracyPct != null) {
      lede.push(t('inst.ledeMethod', { m: Math.round(cur.methodPct), a: Math.round(cur.accuracyPct) }));
      const methodLost = cur.methodMarksPossible - cur.methodMarksEarned;
      const answerLost = cur.accuracyMarksPossible - cur.accuracyMarksEarned;
      if (answerLost > methodLost) lede.push(t('inst.ledeLostAnswer'));
      else if (methodLost > answerLost) lede.push(t('inst.ledeLostMethod'));
    } else if (cur.questions > 0) lede.push(t('inst.ledeFew', { count: cur.questions, n: cur.questions }));
    else lede.push(t('inst.ledeNone'));
  }
  const worst = view.lost[0];

  return (
    <section className="in-report" aria-labelledby="in-report-title" data-instrument-report data-report-period={period} data-report-loaded={shown ? shown.period : 'none'}>
      <div className="in-report-head">
        <div>
          {user?.course === 'in'
            ? <h1 id="in-report-title" className="in-report-title">{title}</h1>
            : <h2 id="in-report-title" className="in-report-title">{title}</h2>}
          {lede.length > 0 && (
            <p className="in-report-lede" data-report-lede>
              {lede.join(' ')}
              {worst && (() => { const [pre, post = ''] = t('inst.ledeChapter', { chapter: '\u0000' }).split('\u0000'); return <> {pre}<span lang="en">{worst.name}</span>{post}</>; })()}
            </p>
          )}
        </div>
        <BarSlot><div className="in-segc" role="group" aria-label={t('inst.periodGroup')} data-report-periods>
          {PERIODS.map(p => (
            <button key={p} type="button" className="c-chip" aria-pressed={period === p} data-report-period-btn={p} onClick={() => setPeriod(p)}>
              {p === 'week' ? t('inst.periodWeek') : p === 'month' ? t('inst.periodMonth') : t('inst.periodTerm')}
            </button>
          ))}
        </div></BarSlot>
      </div>
      {failed && <p className="in-note" role="status">{t('inst.reportSeriesFailed')}</p>}
      <div className="in-report-figs">
        <div data-report-questions><b>{cur ? cur.questions : '—'}</b><small>{t('inst.reportQuestions')}</small>{cur && <Delta n={shown.delta?.questions} />}</div>
        <div data-report-marks><b>{cur?.marksPossible ? `${cur.marksEarned}` : '—'}{cur?.marksPossible ? <span>/{cur.marksPossible}</span> : null}</b>
          <small>{cur?.marksPct != null ? t('inst.reportMarksEarnedPct', { p: Math.round(cur.marksPct) }) : t('inst.reportMarksEarned')}</small>
          {cur?.marksPossible > 0 && <Delta n={shown.delta?.marksEarned} />}</div>
        <div data-report-method className="lux-report-hero"><b>{cur?.methodPct != null ? <Roll text={fmtPct(cur.methodPct)} /> : '—'}</b><small>{t('inst.reportMethod')}</small>{cur?.methodPct != null && <Delta n={shown.delta?.methodPct} unit={t('inst.reportPts')} />}</div>
        <div data-report-days><b>{cur ? cur.daysPractised : '—'}</b><small>{t('inst.reportDaysPractised')}</small>{cur?.streak > 0 && <> <em>{t('inst.reportStreakEm', { n: cur.streak })}</em></>}</div>
      </div>
      <div className="in-rp">
        <Chart series={series} labels={labels} t={t} spoken={spoken} failed={failed} />
        <div className="in-report-heat">
          <h2>{t('inst.reportHeat', { n: WEEKS })}</h2>
          <div className="in-heat" role="img" aria-label={t('inst.reportHeatSpoken', { days: view.heatDays, n: WEEKS })}>
            {view.cells.map(c => <i key={c.key} style={{ '--v': c.n ? 0.25 + (c.n / view.max) * 0.75 : 0 }} className={c.n ? 'is-on' : ''} title={t('inst.reportHeatCell', { date: c.key, n: c.n })} />)}
          </div>
          <div className="in-report-lost">
            <h3>{t('inst.reportLost')}</h3>
            {view.lost.length ? (
              <ul>{view.lost.map(c => (
                <li key={c.id} style={{ '--cc': `var(${view.colourOf(c.id)})` }}>
                  <i aria-hidden="true" /><span lang="en"><TermGloss text={c.name} /></span><small>{`${c.earned}/${c.possible}`}</small>
                </li>
              ))}</ul>
            ) : <p className="in-note">{t('inst.reportLostNone')}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
