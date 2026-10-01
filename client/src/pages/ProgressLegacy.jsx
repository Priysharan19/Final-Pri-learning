import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { LineChart, HBars, Calendar, StatTile, Sparkline, MASTERY_FILLS } from '../components/Charts.jsx';
import { useT, useTx } from '../i18n/index.js';

// Mastery band names, as catalogue keys resolved with t() at render time.
const BAND_KEY = { unseen: 'progressAu.bandUnseen', emerging: 'progressAu.bandEmerging', developing: 'progressAu.bandDeveloping', strong: 'progressAu.bandStrong', mastered: 'progressAu.bandMastered' };
const DIFFICULTY_KEY = ['difficulty.1', 'difficulty.2', 'difficulty.3', 'difficulty.4'];
const TABS = [['overview', 'progressAu.tabOverview'], ['priorities', 'progressAu.tabPriorities'], ['map', 'progressAu.tabMap']];
const RAMP = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];
const rampFor = m => RAMP[Math.min(4, Math.floor((m || 0) / 20))];

export default function Progress() {
  const t = useT();
  const { user } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const [stats, setStats] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [badges, setBadges] = useState(null);
  const defaultKey = user.year >= 11 && user.pathway === 'standard' ? `standard-${user.year}` : `y${user.year}`;
  const [sectionKey, setSectionKey] = useState(defaultKey);
  const [range, setRange] = useState('all');

  useEffect(() => { api.get('/stats').then(setStats).catch(() => { }); }, []);
  useEffect(() => { api.get('/curriculum').then(setCurriculum).catch(() => { }); }, []);
  useEffect(() => { api.get('/badges').then(setBadges).catch(() => { }); }, []);

  const sections = useMemo(() => {
    if (!curriculum) return [];
    const core = curriculum.years.map(y => ({ key: `y${y.year}`, label: y.year === user.year ? t('progressAu.yearYours', { n: y.year }) : t('common.yearNumber', { n: y.year }), ...y }));
    const streams = (curriculum.streams || []).map(g => ({ key: g.key, label: g.title, ...g }));
    return [...core, ...streams];
  }, [curriculum, user.year, t]);

  const section = useMemo(() => sections.find(s => s.key === sectionKey) || sections[0], [sections, sectionKey]);

  const setTab = k => setParams(k === 'overview' ? {} : { tab: k });

  const tabName = t((TABS.find(([k]) => k === tab) || TABS[0])[1]);

  return (
    <div>
      {/* The page draws no title of its own — the tab strip is the title bar —
          so the heading a screen reader needs is spoken rather than drawn. */}
      <h1 className="sr-only">{t('progressAu.srHeading', { tab: tabName })}</h1>
      <div className="page-tabs no-print">
        {TABS.map(([k, labelKey]) => (
          <button key={k} className={`page-tab ${tab === k ? 'on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{t(labelKey)}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview stats={stats} curriculum={curriculum} section={section} sections={sections} sectionKey={section?.key} setSectionKey={setSectionKey} badges={badges} range={range} setRange={setRange} user={user} nav={nav} />}
      {tab === 'priorities' && <Priorities stats={stats} nav={nav} curriculum={curriculum} user={user} />}
      {tab === 'map' && <KnowledgeMap curriculum={curriculum} user={user} nav={nav} />}
    </div>
  );
}

/* ───────────────────────────── Overview ───────────────────────────── */

function Overview({ stats, curriculum, section, sections, sectionKey, setSectionKey, badges, range, setRange, user, nav }) {
  const t = useT();
  const tx = useTx();
  if (!stats) return <div className="skeleton" style={{ height: 400 }} />;
  const acc = stats.totals.attempts ? Math.round(100 * stats.totals.correct / stats.totals.attempts) : 0;
  const scopeSubs = section?.subtopics || [];
  const attempted = scopeSubs.filter(s => s.attempts > 0);
  const outcomes = scopeSubs.reduce((n, s) => n + (s.dotpoints?.length || 0), 0);
  const outcomesCovered = attempted.reduce((n, s) => n + (s.dotpoints?.length || 0), 0);
  const band = stats.predicted.band;
  const traj = range === '30' ? stats.trajectory.slice(-30) : range === '60' ? stats.trajectory.slice(-60) : stats.trajectory;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row no-print" style={{ flexWrap: 'wrap' }}>
        <label className="sr-only" htmlFor="progress-scope">{t('progressAu.scopeLabel')}</label>
        <select className="input" id="progress-scope" style={{ width: 260 }} value={sectionKey} onChange={e => setSectionKey(e.target.value)}>
          {sections.map(sc => <option key={sc.key} value={sc.key}>{sc.label}</option>)}
        </select>
      </div>

      <div className="card card-flush band-card">
        <div className="band-left">
          <div className="sc-label" style={{ margin: 0 }}>{tx('progressAu.bandPredicted', { predicted: <span style={{ textTransform: 'none', letterSpacing: 0 }}>{t('progressAu.predictedParen')}</span> })}</div>
          <div className="band-big">{band ? (band.scale === 'grade' ? band.label : band.label.replace(/^Band\s*/, 'B')) : '—'}</div>
          {band && <div className="muted">{band.desc || ''}</div>}

          <div className="stat-line">
            <span>{t('progressAu.correctOf', { correct: stats.totals.correct, total: stats.totals.attempts })}</span>
            <span className="sc-label">{tx('progressAu.accuracyLabel', { pct: <span className="big" style={{ color: 'var(--ink)' }}>{acc}%</span> })}</span>
          </div>
          <div className="meter"><i style={{ width: `${acc}%` }} /></div>
          <div className="muted" style={{ marginTop: 6 }}>{t('progressAu.attemptsTopics', { count: stats.totals.attempts, n: stats.totals.attempts, topics: attempted.length })}</div>

          <div className="stat-line" style={{ marginTop: 20 }}>
            <span>{t('progressAu.outcomesOf', { covered: outcomesCovered, total: outcomes })}</span>
            <span className="sc-label">{tx('progressAu.coveredLabel', { pct: <span className="big" style={{ color: 'var(--ink)' }}>{outcomes ? Math.round(100 * outcomesCovered / outcomes) : 0}%</span> })}</span>
          </div>
          <div className="meter gold"><i style={{ width: `${Math.min(100, outcomes ? 100 * outcomesCovered / outcomes : 0)}%` }} /></div>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div className="spread">
            <h3>{t('progressAu.markHistory')}</h3>
            <label className="sr-only" htmlFor="progress-range">{t('progressAu.rangeLabel')}</label>
            <select className="input" id="progress-range" style={{ width: 130, padding: '5px 10px', fontSize: 13.5 }} value={range} onChange={e => setRange(e.target.value)}>
              <option value="all">{t('progressAu.allTime')}</option>
              <option value="60">{t('progressAu.lastDays', { count: 60, n: 60 })}</option>
              <option value="30">{t('progressAu.lastDays', { count: 30, n: 30 })}</option>
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            {traj.length >= 2
              ? <LineChart data={traj.map(p => ({ label: p.date.slice(5), value: p.predicted }))} band={{ low: stats.predicted.low, high: stats.predicted.high }} height={190} />
              : <div className="muted" style={{ padding: '48px 0', textAlign: 'center' }}>{t('progressAu.notEnoughHistory')}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <h3>{tx('progressAu.syllabusPerformance', { scope: <span className="muted" style={{ fontSize: 14 }}>| {section?.label}</span> })}</h3>
          <span className="sc-label" style={{ margin: 0 }}>{t('progressAu.topicsCount', { count: scopeSubs.length, n: scopeSubs.length })}</span>
        </div>
        <SyllabusBoard subs={scopeSubs} nav={nav} />
      </div>

      <div className="grid cols-4">
        <StatTile label={t('progressAu.predictedMark')} value={stats.predicted.mark} suffix="/100"
          delta={band
            ? t('progressAu.bandRange', { band: band.scale === 'grade' ? t('progressAu.gradeLabel', { label: band.label }) : band.label, low: stats.predicted.low, high: stats.predicted.high })
            : t('progressAu.range', { low: stats.predicted.low, high: stats.predicted.high })} deltaGood />
        <StatTile label={t('app.dayStreak')} value={stats.streak} suffix={t('progressAu.daysUnit', { count: stats.streak })}
          delta={stats.streak > 0 ? t('progressAu.keepAlive') : t('progressAu.answerToStart')} deltaGood={stats.streak > 0} />
        <StatTile label={t('progress.questionsAnswered')} value={stats.totals.attempts.toLocaleString()}
          spark={stats.activity.slice(-12).map(a => a.questions)} />
        <StatTile label={t('progressAu.timePractising')} value={t('progressAu.hours', { n: Math.round((stats.totals.ms || 0) / 3600000 * 10) / 10 })}
          delta={stats.examCount ? t('progressAu.examsSat', { count: stats.examCount, n: stats.examCount }) : t('progressAu.noExams')} deltaGood />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">{t('progressAu.accuracyByDifficulty')}</div>
          <HBars data={[1, 2, 3, 4].map(d => {
            const row = stats.byDiff.find(x => x.difficulty === d);
            const pct = row && row.n ? Math.round(100 * row.c / row.n) : 0;
            return { label: `D${d} ${t(DIFFICULTY_KEY[d - 1])}`, value: pct };
          })} />
          <p className="muted" style={{ marginTop: 8 }}>{t('progressAu.engineNear70')}</p>
        </div>
        <div className="card">
          <div className="card-title">{t('progressAu.practiceCalendar')}</div>
          <Calendar days={stats.activity} />
        </div>
      </div>

      {badges && (
        <div className="card">
          <div className="spread">
            <div className="card-title" style={{ margin: 0 }}>{t('progressAu.achievements')}</div>
            <span className="muted">{badges.earnedCount} / {badges.total}</span>
          </div>
          <div className="badge-grid" style={{ marginTop: 12 }}>
            {badges.badges.map(b => (
              <div key={b.id} className={`badge-card ${b.earnedAt ? '' : 'locked'}`}>
                <span className="badge-ico">{b.icon}</span>
                <div>
                  <div className="badge-name">{b.name}</div>
                  <div className="badge-desc">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReportCard user={user} />
    </div>
  );
}

function SyllabusBoard({ subs, nav }) {
  const t = useT();
  const byStrand = useMemo(() => {
    const m = new Map();
    for (const s of subs) { if (!m.has(s.strand)) m.set(s.strand, []); m.get(s.strand).push(s); }
    return [...m.entries()];
  }, [subs]);
  return (
    <table className="syl-table" style={{ marginTop: 8 }}>
      <thead>
        <tr className="syl-head-row">
          <th style={{ textAlign: 'right', paddingRight: 16 }}><span className="sr-only">{t('common.topic')}</span></th>
          {['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map(b => <th key={b} style={{ width: 64 }}>{b}</th>)}
          <th style={{ paddingLeft: 14 }}>{t('progressAu.dotPoints')}</th>
        </tr>
      </thead>
      <tbody>
        {byStrand.map(([strand, rows]) => (
          <React.Fragment key={strand}>
            <tr><td colSpan={8} style={{ border: 'none', paddingTop: 14 }}><span className="sc-label" style={{ margin: 0 }}>{strand}</span></td></tr>
            {rows.map(s => (
              <tr key={s.id}>
                <td className="syl-name">
                  {/* the row used to navigate from an onClick on the <tr> itself,
                      which no keyboard could reach. The cell's own text is the
                      control now, drawn with no chrome so the table is unchanged. */}
                  <button onClick={() => nav(`/practice?subtopic=${s.id}`)} title={t('progressAu.practiseThisTopic')}
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'inherit', width: '100%' }}>
                    {s.name}{s.due && <span style={{ color: 'var(--warn)' }}> ●<span className="sr-only"> {t('progressAu.reviewDue')}</span></span>}
                    <span className="sr-only"> — {t('progressAu.practiseThisTopicLower')}</span>
                  </button>
                </td>
                <td colSpan={6} className="syl-band-cell">
                  {/* the bar's position and colour ARE the mastery figure, so the
                      figure itself is spoken and the drawing is decoration */}
                  <div className="syl-guide" aria-hidden="true">
                    <span className="dotline" />
                    {s.attempts >= 3
                      ? <span className="syl-bandbar" style={{ left: `${Math.max(2, s.mastery * 0.94)}%`, width: 26, background: rampFor(s.mastery) }} />
                      : <span className="syl-nopred">{t('progressAu.noPrediction')}</span>}
                  </div>
                  <span className="sr-only">
                    {s.attempts >= 3 ? t('progressAu.masteryPct', { n: s.mastery }) : t('progressAu.notEnoughToPredict')}
                  </span>
                </td>
                <td>
                  <div className="syl-sq-wrap" aria-hidden="true">
                    {(s.dotpoints || []).map((dp, i) => (
                      <span key={i} className="syl-sq" title={typeof dp === 'string' ? dp : dp.text}
                        style={s.attempts > 0 ? { background: rampFor(s.mastery), borderColor: 'transparent', opacity: 0.55 + 0.45 * (s.mastery / 100) } : {}} />
                    ))}
                  </div>
                  <span className="sr-only">
                    {t('progressAu.dotPointsCount', { count: (s.dotpoints || []).length, n: (s.dotpoints || []).length })}
                    {' · '}{s.attempts > 0 ? t('progressAu.attemptsCount', { count: s.attempts, n: s.attempts }) : t('progressAu.notStartedLower')}
                  </span>
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

function ReportCard({ user }) {
  const t = useT();
  const [report, setReport] = useState(null);
  useEffect(() => { api.get('/report').then(setReport).catch(() => { }); }, []);
  if (!report) return null;
  return (
    <div className="card">
      <div className="spread no-print">
        <div className="card-title" style={{ marginBottom: 0 }}>{t('progressAu.reportTitle', { course: report.student.course || t('common.yearNumber', { n: report.student.year }) })}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>{t('progressAu.printPdf')}</button>
      </div>
      <p className="sub" style={{ margin: '10px 0 4px' }}>
        {t('progressAu.reportLine', { name: report.student.name, year: report.student.year, mark: report.predicted.mark, streak: report.streak, attempts: report.totals.attempts, correct: report.totals.correct })}
      </p>
      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr><th>{t('progressAu.colSubtopic')}</th><th>{t('progressAu.colStrand')}</th><th>{t('progressAu.colMastery')}</th><th>{t('common.attempts')}</th><th>{t('progress.colCorrect')}</th><th>{t('progressAu.colBand')}</th></tr>
        </thead>
        <tbody>
          {report.subtopics.map(s => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td className="muted">{s.strand}</td>
              <td><b>{s.mastery}%</b></td>
              <td>{s.attempts}</td>
              <td>{s.correct}</td>
              <td style={{ textTransform: 'capitalize' }}>{BAND_KEY[s.band] ? t(BAND_KEY[s.band]) : s.band}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────── Priorities ─────────────────────────── */

function Priorities({ stats, nav, curriculum, user }) {
  const t = useT();
  if (!stats) return <div className="skeleton" style={{ height: 400 }} />;
  const spark = stats.trajectory.slice(-20).map(p => p.predicted);
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 330px', alignItems: 'start' }}>
      <div className="card">
        <div className="spread">
          <div className="card-title" style={{ margin: 0 }}>{t('progressAu.rankedByImprovement')}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/practice')}>{t('progressAu.updateProgress')}</button>
        </div>
        <div style={{ marginTop: 6 }}>
          {stats.priorities.map((p, i) => (
            <div className="prio-item" key={p.subtopic}>
              <span className="prio-rank">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>{p.name} {p.year ? <span className="muted">· {t('progressAu.yearShort', { n: p.year })}</span> : null}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{p.reason}</div>
              </div>
              <span className="tag">{p.mastery}%</span>
              <button className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?subtopic=${p.subtopic}`)}>{t('progress.practise')}</button>
            </div>
          ))}
          {!stats.priorities.length && <p className="muted" style={{ padding: '20px 0' }}>{t('progressAu.emptyPriorities')}</p>}
        </div>
      </div>

      <div className="card">
        <div className="sc-label">◆ {t('progressAu.scoresSummary')}</div>
        <div className="sc-label" style={{ marginTop: 14 }}>{t('progressAu.predictedScaled')}</div>
        {stats.totals.attempts
          ? <div className="hero-num" style={{ fontSize: 40 }}>{stats.predicted.mark}<span style={{ fontSize: 17, color: 'var(--ink-3)' }}>/100</span></div>
          : <div className="muted">{t('progressAu.noPredictionYet')}</div>}
        {stats.predicted.band && <div className="band-chip">{stats.predicted.band.scale === 'grade' ? t('progressAu.gradeLabel', { label: stats.predicted.band.label }) : stats.predicted.band.label}</div>}

        <div className="sc-label" style={{ marginTop: 20 }}>{t('progressAu.predictionHistory')}</div>
        {spark.length >= 2
          ? <Sparkline points={spark} width={270} height={54} />
          : <div className="muted">{t('progressAu.notEnoughHistory')}</div>}

        <div className="sc-label" style={{ marginTop: 20 }}>{t('progressAu.outcomeCoverage')}</div>
        <div className="row">
          <div className="meter gold" style={{ flex: 1 }}><i style={{ width: `${stats.predicted.coverage}%` }} /></div>
          <span className="muted">{stats.predicted.coverage}%</span>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>{t('progressAu.outcomesEvidence')}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Knowledge map ────────────────────────── */

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

function KnowledgeMap({ curriculum, user, nav }) {
  const t = useT();
  const tx = useTx();
  const canvasRef = useRef(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => localStorage.getItem('pri-kmap-hello') !== 'off');
  const [tip, setTip] = useState(null);
  const [focusSub, setFocusSub] = useState(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);

  const model = useMemo(() => {
    if (!curriculum) return null;
    const sections = [...curriculum.years.map(y => ({ key: `y${y.year}`, label: t('common.yearNumber', { n: y.year }), subs: y.subtopics })),
    ...(curriculum.streams || []).map(g => ({ key: g.key, label: g.title, subs: g.subtopics }))];
    const nodes = [], links = [];
    const W = 1600, H = 1000, cx = W / 2, cy = H / 2;
    sections.forEach((sec, si) => {
      const secAng = (si / sections.length) * Math.PI * 2 + 0.35;
      const secR = 300 + 130 * hash01(sec.key);
      const scx = cx + Math.cos(secAng) * secR;
      const scy = cy + Math.sin(secAng) * secR * 0.62;
      let prevBySt = {};
      sec.subs.forEach(sub => {
        const a = hash01(sub.id) * Math.PI * 2;
        const r = 40 + 120 * hash01(sub.id + 'r');
        const sx = scx + Math.cos(a) * r;
        const sy = scy + Math.sin(a) * r * 0.8;
        const first = nodes.length;
        (sub.dotpoints || [{ text: sub.name }]).forEach((dp, i) => {
          const da = hash01(sub.id + i) * Math.PI * 2;
          const dr = 6 + 26 * hash01(sub.id + i + 'r');
          nodes.push({
            x: sx + Math.cos(da) * dr, y: sy + Math.sin(da) * dr * 0.9,
            sub, dpIndex: i, dpText: typeof dp === 'string' ? dp : dp.text,
            sec: sec.label,
          });
          if (i > 0) links.push([nodes.length - 2, nodes.length - 1, 0.1]);
        });
        if (prevBySt[sub.strand] != null) links.push([prevBySt[sub.strand], first, 0.06]);
        prevBySt[sub.strand] = first;
      });
    });
    return { nodes, links, W, H };
  }, [curriculum, t]);

  // draw
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !model) return;
    let raf;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      if (cv.width !== rect.width * dpr) { cv.width = rect.width * dpr; cv.height = rect.height * dpr; }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const { x, y, k } = view.current;
      const sc = (rect.width / model.W) * k;
      const T = p => [(p.x + x) * sc, (p.y + y) * sc + (rect.height - model.H * sc) / 2];
      const styles = getComputedStyle(document.documentElement);
      const ramp = ['--m1', '--m2', '--m3', '--m4', '--m5'].map(v => styles.getPropertyValue(v).trim());
      const dim = styles.getPropertyValue('--ink-3').trim();
      // links
      ctx.lineWidth = 0.6;
      for (const [a, b, o] of model.links) {
        const A = T(model.nodes[a]), B = T(model.nodes[b]);
        ctx.strokeStyle = `rgba(200,196,180,${o})`;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      // nodes
      for (const n of model.nodes) {
        const [X, Y] = T(n);
        if (X < -20 || Y < -20 || X > rect.width + 20 || Y > rect.height + 20) continue;
        const practised = n.sub.attempts > 0;
        const focused = focusSub && n.sub.id === focusSub;
        const m = n.sub.mastery || 0;
        ctx.beginPath();
        ctx.arc(X, Y, focused ? 3.6 : practised ? 3 : 1.8, 0, Math.PI * 2);
        if (practised) {
          ctx.fillStyle = ramp[Math.min(4, Math.floor(m / 20))];
          ctx.shadowColor = ramp[Math.min(4, Math.floor(m / 20))];
          ctx.shadowBlur = focused ? 14 : 8;
        } else {
          ctx.fillStyle = focused ? dim : 'rgba(200,196,180,0.34)';
          ctx.shadowBlur = focused ? 8 : 0;
          ctx.shadowColor = dim;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [model, focusSub]);

  const hitTest = (mx, my) => {
    if (!model) return null;
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const { x, y, k } = view.current;
    const sc = (rect.width / model.W) * k;
    const oy = (rect.height - model.H * sc) / 2;
    let best = null, bd = 12;
    for (const n of model.nodes) {
      const X = (n.x + x) * sc, Y = (n.y + y) * sc + oy;
      const d = Math.hypot(X - mx, Y - my);
      if (d < bd) { bd = d; best = { n, X, Y }; }
    }
    return best;
  };

  const onMove = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (drag.current) {
      const { sx, sy, ox, oy } = drag.current;
      const sc = (rect.width / model.W) * view.current.k;
      view.current.x = ox + (mx - sx) / sc;
      view.current.y = oy + (my - sy) / sc;
      setTip(null);
      return;
    }
    const hit = hitTest(mx, my);
    setTip(hit ? { x: hit.X + 14, y: hit.Y - 10, n: hit.n } : null);
  };

  const onWheel = e => {
    e.preventDefault();
    const k = Math.min(3, Math.max(0.55, view.current.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    view.current.k = k;
  };

  const totalIdeas = model?.nodes.length || 0;

  return (
    <div className="kmap-wrap">
      <canvas
        ref={canvasRef} className="kmap-canvas"
        role="img"
        aria-label={t('progressAu.mapAria', { count: totalIdeas, n: totalIdeas })}
        onMouseMove={onMove}
        onMouseDown={e => {
          const rect = canvasRef.current.getBoundingClientRect();
          drag.current = { sx: e.clientX - rect.left, sy: e.clientY - rect.top, ox: view.current.x, oy: view.current.y, moved: false };
        }}
        onMouseUp={e => {
          const rect = canvasRef.current.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          drag.current = null;
          if (hit) nav(`/practice?subtopic=${hit.n.sub.id}&dotpoint=${hit.n.dpIndex}`);
        }}
        onMouseLeave={() => { drag.current = null; setTip(null); }}
        onWheel={onWheel}
      />

      {panelOpen && model && (
        <div className="kmap-panel">
          <div className="spread">
            <div className="card-title" style={{ margin: 0 }}>{t('progressAu.curriculum')}</div>
            <button className="btn btn-quiet btn-sm" aria-label={t('progressAu.closeCurriculum')} onClick={() => setPanelOpen(false)}>✕</button>
          </div>
          <CurriculumList curriculum={curriculum} focusSub={focusSub} setFocusSub={setFocusSub} nav={nav} />
        </div>
      )}

      {welcome && (
        <div className="card kmap-welcome">
          <div className="spread">
            <h3>{t('progressAu.welcomeTitle')}</h3>
            <button className="btn btn-quiet btn-sm" aria-label={t('progressAu.dismissIntro')}
              onClick={() => { setWelcome(false); localStorage.setItem('pri-kmap-hello', 'off'); }}>✕</button>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('progressAu.welcomeBody')}
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => { setWelcome(false); localStorage.setItem('pri-kmap-hello', 'off'); }}>{t('progressAu.gotIt')}</button>
        </div>
      )}

      <div className="kmap-foot">
        <button className="btn btn-ghost btn-sm" aria-expanded={panelOpen} onClick={() => setPanelOpen(o => !o)}>☰ {t('progressAu.curriculum')}</button>
        <span className="kmap-legend">{tx('progressAu.legend', { grad: <span className="kmap-grad" /> })}</span>
      </div>
      <div className="kmap-count">{t('progressAu.ideasCount', { count: totalIdeas, n: totalIdeas.toLocaleString() })}</div>

      {tip && (
        <div className="kmap-tip" aria-hidden="true" style={{ left: tip.x, top: tip.y }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{tip.n.sec} · {tip.n.sub.strand}{tip.n.sub.code ? ` · ${tip.n.sub.code}` : ''}</div>
          <div style={{ marginTop: 2 }}><b>{tip.n.sub.name}</b></div>
          <div style={{ marginTop: 2 }}>{tip.n.dpText}</div>
          <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>
            {tip.n.sub.attempts > 0
              ? t('progressAu.bandMastery', { band: BAND_KEY[tip.n.sub.band] ? t(BAND_KEY[tip.n.sub.band]) : tip.n.sub.band, n: tip.n.sub.mastery })
              : t('progressAu.notStarted')}
          </div>
        </div>
      )}
    </div>
  );
}

function CurriculumList({ curriculum, focusSub, setFocusSub, nav }) {
  const t = useT();
  const sections = useMemo(() => {
    if (!curriculum) return [];
    return [...curriculum.years.map(y => ({ key: `y${y.year}`, label: t('common.yearNumber', { n: y.year }), subs: y.subtopics })),
    ...(curriculum.streams || []).map(g => ({ key: g.key, label: g.title, subs: g.subtopics }))];
  }, [curriculum, t]);
  const [openKey, setOpenKey] = useState(null);
  return (
    <div style={{ marginTop: 10 }}>
      {sections.map(sec => (
        <div key={sec.key} style={{ marginBottom: 4 }}>
          <button className="nav-item" style={{ width: '100%' }} aria-expanded={openKey === sec.key}
            onClick={() => setOpenKey(openKey === sec.key ? null : sec.key)}>
            <span style={{ flex: 1 }}>{sec.label}</span>
            <span className="muted">{openKey === sec.key ? '⌄' : '›'}</span>
          </button>
          {openKey === sec.key && sec.subs.map(s => (
            <div key={s.id} className="row" style={{ padding: '5px 8px 5px 16px' }}>
              <button className="btn btn-quiet btn-sm" style={{ flex: 1, justifyContent: 'flex-start', textAlign: 'left', gap: 8, color: focusSub === s.id ? 'var(--gold)' : undefined }}
                onClick={() => setFocusSub(focusSub === s.id ? null : s.id)}>
                <span className="lg-dot" aria-hidden="true" style={{ background: s.attempts > 0 ? rampFor(s.mastery) : 'var(--surface-3)', marginRight: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
              </button>
              <button className="btn btn-ghost btn-sm" aria-label={t('progressAu.practiseName', { name: s.name })} onClick={() => nav(`/practice?subtopic=${s.id}`)}>▸</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
