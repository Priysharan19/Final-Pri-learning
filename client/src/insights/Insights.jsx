// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Insights — /insights
//
// Two Premium readings of the student's own server-marked practice:
//   · the readiness estimate for their paper (server/platform/forecast.js):
//     a range over the marks practised, its coverage, and how it moved week
//     by week. Always "an estimate from your practice", never a predicted
//     board score: the server's `wording` is 'estimate' and this page has no
//     stronger copy to show.
//   · Mistake DNA (server/platform/mistakeDna.js): the moves the student's
//     slips keep making, each with its chances ("7 of 12"), across chapters.
//   · Where a gap starts (server/platform/rootGap.js): a failing chapter
//     followed down the prerequisite graph, link by link, only while the
//     chapter below has its own failing answers; every link shows its
//     evidence, and chapters with too few answers are named as unchecked.
//
// Premium is the server's decision (`advanced-analytics`). A free account is
// shown what the server sends it — the coverage, and how many habits exist —
// and one plain line about what Premium adds. No band, no habit names.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import PageLink from '../components/PageLink.jsx';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { cloudRequest } from '../platform/cloudTransport.js';
import { blueprintLabel } from '../lib/blueprintKeys.js';
import { chancesValues, chapterMatrix, headline, paperQuery, trendGeometry } from './insightsView.js';
import './insights.css';

const loadForecast = q => cloudRequest(`/v1/forecast?${q}`);
const loadHabits = () => cloudRequest('/v1/habits');
const loadRootGap = () => cloudRequest('/v1/root-gap');

function useChapterNames() {
  const [names, setNames] = useState({});
  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => {
      const out = {};
      const walk = v => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') {
          if (typeof v.id === 'string' && typeof (v.name || v.title) === 'string') out[v.id] = v.name || v.title;
          Object.values(v).forEach(walk);
        }
      };
      walk(c);
      if (live) setNames(out);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  return names;
}

function Load({ state, t, children }) {
  if (state.status === 'loading') return <p className="in-note" role="status">{t('insights.loading')}</p>;
  if (state.status === 'error') return <p className="ins-honest" role="alert" data-insights-error={state.code || 'unknown'}>{t('insights.loadFailed')}</p>;
  return children(state.data);
}

function Coverage({ coverage, covered, total, t }) {
  const pct = Math.round((coverage || 0) * 100);
  return (
    <div className="ins-coverage">
      <div className="ins-coverage-track" role="img" aria-label={t('insights.coverage', { pct, covered, total })}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="in-note">{t('insights.coverage', { pct, covered, total })}</p>
    </div>
  );
}

function Trend({ trend, t, locale }) {
  const g = useMemo(() => trendGeometry(trend), [trend]);
  if (!trend.length) return <p className="in-note">{t('insights.trendNone')}</p>;
  const day = at => new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return (
    <figure className="ins-trend" data-trend-weeks={trend.length}>
      <svg viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-labelledby="ins-trend-cap" preserveAspectRatio="none">
        {g.grid.map(l => (
          <g key={l.v}>
            <line x1={30} x2={g.width - 8} y1={l.y} y2={l.y} className="ins-grid" />
            <text x={26} y={l.y + 3} className="ins-axis" textAnchor="end">{`${l.v}%`}</text>
          </g>
        ))}
        {g.bands.map((d, i) => <path key={`b${i}`} d={d} className="ins-band" data-trend-band />)}
        {g.lines.map((d, i) => <path key={`l${i}`} d={d} className="ins-line" />)}
        {g.dots.map((d, i) => d.banded && <circle key={`d${i}`} cx={d.cx} cy={d.cy} r={2.4} className="ins-dot" />)}
        {g.ticks.map((tk, i) => <line key={`t${i}`} x1={tk.x} x2={tk.x} y1={g.baseline + 4} y2={g.baseline + 4 + tk.h} className="ins-tick" />)}
      </svg>
      <figcaption id="ins-trend-cap" className="in-note">{t('insights.trendCaption')}</figcaption>
      {/* The same numbers as text, for a screen reader and for anyone checking the drawing. */}
      <table className="sr-only">
        <caption>{t('insights.trendTable')}</caption>
        <tbody>
          {g.points.map(p => (
            <tr key={p.weekEnding}>
              <th scope="row">{day(p.weekEnding)}</th>
              <td>{p.banded ? t('insights.trendRow', { low: p.low, high: p.high, mid: p.mid }) : t('insights.trendRowNone')}</td>
              <td>{t('insights.trendCoverage', { pct: Math.round(p.coverage * 100) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Forecast({ data, t, locale }) {
  const paper = blueprintLabel(t, data.paper?.id, data.paper?.label);
  if (!data.premium) {
    return (
      <section className="ins-sheet" aria-labelledby="ins-fc" data-insights-forecast="free">
        <h2 className="sc-label" id="ins-fc">{t('insights.forecastTitle')}</h2>
        <p className="sub">{paper}</p>
        <Coverage coverage={data.coverage} covered={data.coveredMarks} total={data.paper?.totalMarks} t={t} />
        <p className="ins-premium" data-premium-gate="forecast">
          {t('insights.forecastPremium')} <PageLink to="/premium" state={{ from: 'insights' }}>{t('insights.seePremium')}</PageLink>
        </p>
      </section>
    );
  }
  const f = data.forecast;
  const h = headline(f);
  return (
    <section className="ins-sheet" aria-labelledby="ins-fc" data-insights-forecast={f.show ? 'band' : 'below-floor'}>
      <h2 className="sc-label" id="ins-fc">{t('insights.forecastTitle')}</h2>
      <p className="sub">{paper}</p>
      {f.show && (
        <div className="ins-figure" aria-hidden="true">
          <b>{f.low}–{f.high}</b><span>{`/${f.coveredMarks}`}</span>
        </div>
      )}
      <p className="ins-sentence" data-forecast-sentence>{t(h.key, h.values)}</p>
      <Coverage coverage={f.coverage} covered={f.coveredMarks} total={f.totalMarks} t={t} />
      <h3 className="sc-label">{t('insights.trendTitle')}</h3>
      <Trend trend={data.trend || []} t={t} locale={locale} />
      {f.priorities?.length > 0 && (
        <>
          <h3 className="sc-label">{t('insights.movesMost')}</h3>
          <ul className="ins-list">
            {f.priorities.map(u => (
              <li key={u.unitId}>
                <span lang="en">{u.name}</span>
                <b>{u.covered ? t('insights.atStake', { n: u.atStake }) : t('insights.untouched', { n: u.marks })}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="in-note">{t('insights.forecastHonesty')}</p>
    </section>
  );
}

function Habit({ row, names, t, locale }) {
  const c = chancesValues(row);
  const when = at => new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return (
    <li className="ins-habit" data-habit={row.id}>
      <div className="ins-habit-head">
        <span className="ins-habit-name">{t(row.nameKey)}</span>
        <b data-habit-chances>{t('insights.chances', c)}</b>
      </div>
      <div className="ins-meter" role="img" aria-label={t('insights.chances', c)}>
        <i style={{ width: `${c.chances ? Math.round((100 * c.times) / c.chances) : 0}%` }} />
      </div>
      <p className="in-note">
        {t('insights.inChapters', { count: row.chapters.length, n: row.chapters.length })}
        {': '}<span lang="en">{row.chapters.map(id => names[id] || id).join(', ')}</span>
      </p>
      {row.fixedSinceLast
        ? <p className="in-note" data-habit-fixed>{t('insights.fixedSince', { date: when(row.lastFixedAt) })}</p>
        : row.lastAt ? <p className="in-note">{t('insights.lastSeen', { date: when(row.lastAt) })}</p> : null}
    </li>
  );
}

function Matrix({ habits, names, t }) {
  const m = useMemo(() => chapterMatrix(habits), [habits]);
  if (m.chapters.length < 2) return null;
  return (
    <div className="ins-matrix-wrap">
      <table className="ins-matrix" data-habit-matrix>
        <caption className="sc-label">{t('insights.acrossChapters')}</caption>
        <thead>
          <tr><th scope="col"><span className="sr-only">{t('insights.habit')}</span></th>
            {m.chapters.map(c => <th key={c} scope="col" lang="en">{names[c] || c}</th>)}</tr>
        </thead>
        <tbody>
          {habits.map((h, i) => (
            <tr key={h.id}>
              <th scope="row">{t(h.nameKey)}</th>
              {m.rows[i].cells.map((on, j) => (
                <td key={m.chapters[j]} data-on={on ? '1' : '0'}>
                  <span className={on ? 'ins-cell on' : 'ins-cell'} aria-hidden="true" />
                  <span className="sr-only">{t(on ? 'insights.seenHere' : 'insights.notSeenHere')}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dna({ data, names, t, locale }) {
  if (!data.premium) {
    return (
      <section className="ins-sheet" aria-labelledby="ins-dna" data-insights-dna="free">
        <h2 className="sc-label" id="ins-dna">{t('insights.dnaTitle')}</h2>
        <p>{data.habitCount
          ? t('insights.dnaFreeCount', { count: data.habitCount, n: data.habitCount })
          : t('insights.dnaNone', { count: data.answered, n: data.answered })}</p>
        <p className="ins-premium" data-premium-gate="dna">
          {t('insights.dnaPremium')} <PageLink to="/premium" state={{ from: 'insights' }}>{t('insights.seePremium')}</PageLink>
        </p>
      </section>
    );
  }
  return (
    <section className="ins-sheet" aria-labelledby="ins-dna" data-insights-dna="premium">
      <h2 className="sc-label" id="ins-dna">{t('insights.dnaTitle')}</h2>
      <p className="in-note">{t('insights.dnaLead', { count: data.answered, n: data.answered })}</p>
      {data.habits.length
        ? <ul className="ins-habits">{data.habits.map(h => <Habit key={h.id} row={h} names={names} t={t} locale={locale} />)}</ul>
        : <p>{t('insights.dnaNone', { count: data.answered, n: data.answered })}</p>}
      <Matrix habits={data.habits} names={names} t={t} />
      {data.oneOffs?.length > 0 && <p className="in-note">{t('insights.oneOffs', { count: data.oneOffs.length, n: data.oneOffs.length })}</p>}
      <p className="in-note">{t('insights.dnaHonesty')}</p>
    </section>
  );
}

function RootGap({ data, names, t }) {
  const name = id => names[id] || id;
  if (!data.premium) {
    return (
      <section className="ins-sheet" aria-labelledby="ins-gap" data-insights-gap="free">
        <h2 className="sc-label" id="ins-gap">{t('insights.gapTitle')}</h2>
        <p>{data.gapCount ? t('insights.gapFreeCount', { count: data.gapCount, n: data.gapCount }) : t('insights.gapNone')}</p>
        <p className="ins-premium" data-premium-gate="gap">
          {t('insights.gapPremium')} <PageLink to="/premium" state={{ from: 'insights' }}>{t('insights.seePremium')}</PageLink>
        </p>
      </section>
    );
  }
  return (
    <section className="ins-sheet" aria-labelledby="ins-gap" data-insights-gap="premium">
      <h2 className="sc-label" id="ins-gap">{t('insights.gapTitle')}</h2>
      {data.gaps.length ? (
        <ul className="ins-habits">
          {data.gaps.map(g => (
            <li key={g.from} className="ins-habit" data-gap-from={g.from} data-gap-root={g.root}>
              <p className="ins-habit-name">{g.root === g.from
                ? t('insights.gapHere', { chapter: name(g.from) })
                : t('insights.gapStarts', { chapter: name(g.from), root: name(g.root) })}</p>
              <ol className="in-note" data-gap-chain>
                {g.chain.map(l => (
                  <li key={l.chapter} data-gap-link={l.chapter}>
                    <span lang="en">{name(l.chapter)}</span>{': '}
                    <b data-gap-chances>{t('insights.gapWrong', { wrong: l.wrong, count: l.chances, n: l.chances })}</b>
                    {l.skill ? <> · <span lang="en">{l.skill}</span></> : null}
                  </li>
                ))}
              </ol>
              {g.unchecked.length > 0 && <p className="in-note" data-gap-unchecked>{t('insights.gapUnchecked')}{' '}<span lang="en">{g.unchecked.map(name).join(', ')}</span></p>}
            </li>
          ))}
        </ul>
      ) : <p>{t('insights.gapNone')}</p>}
      <p className="in-note">{t('insights.gapHonesty')}</p>
    </section>
  );
}

export default function Insights() {
  const { user } = useApp();
  const t = useT();
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'hi' ? 'hi-IN' : 'en-IN';
  const q = paperQuery(user);
  const names = useChapterNames();
  const [forecast, setForecast] = useState({ status: q ? 'loading' : 'none' });
  const [dna, setDna] = useState({ status: 'loading' });
  const [gap, setGap] = useState({ status: 'loading' });

  useEffect(() => {
    let live = true;
    if (q) loadForecast(q).then(data => live && setForecast({ status: 'ready', data }), err => live && setForecast({ status: 'error', code: err?.code }));
    loadHabits().then(data => live && setDna({ status: 'ready', data }), err => live && setDna({ status: 'error', code: err?.code }));
    loadRootGap().then(data => live && setGap({ status: 'ready', data }), err => live && setGap({ status: 'error', code: err?.code }));
    return () => { live = false; };
  }, [q]);

  return (
    <div className="ins-page">
      <h1>{t('insights.title')}</h1>
      <p className="in-note">{t('insights.lead')}</p>
      {forecast.status !== 'none' && <Load state={forecast} t={t}>{data => <Forecast data={data} t={t} locale={locale} />}</Load>}
      <Load state={dna} t={t}>{data => <Dna data={data} names={names} t={t} locale={locale} />}</Load>
      <Load state={gap} t={t}>{data => <RootGap data={data} names={names} t={t} />}</Load>
    </div>
  );
}
