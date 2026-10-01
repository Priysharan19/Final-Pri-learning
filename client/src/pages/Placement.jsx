// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Placement check and the Class 7 → JEE mastery map.
//
// A lazily-loaded route. The adaptive process lives in engine/placement.js and
// runs inside the local backend; this page only shows the question on screen
// (the practice question card, in its diagnostic mode, so handwriting works
// exactly as it does in practice), and the finished result: strand estimates,
// the traced root gaps with their chains, and the map.
//
// Everything this page says about a result is phrased as an estimate from a
// handful of questions. The confidence it shows is the engine's, which is
// never higher than 'moderate'.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import TermGloss from '../components/TermGloss.jsx';
import { tLater, useT } from '../i18n/index.js';
import { MAP_STRANDS, PREREQ_GRAPH_VERSION, mapStrandOf } from '../engine/prerequisites.js';
import { PREREQ_SKILLS_HI } from '../engine/prerequisiteSkillsHi.js';

const GRADES = [7, 8, 9, 10, 11, 12];
const PHASE_KEY = {
  anchor: 'placement.phaseAnchor', trace: 'placement.phaseTrace',
  climb: 'placement.phaseClimb', depth: 'placement.phaseDepth'
};
const STRAND_KEY = {
  number: 'placement.strand.number', algebra: 'placement.strand.algebra', geometry: 'placement.strand.geometry',
  trig: 'placement.strand.trig', coord: 'placement.strand.coord', calculus: 'placement.strand.calculus', data: 'placement.strand.data'
};
const OUTCOME_KEY = {
  'root-gap': 'placement.legendRoot', gap: 'placement.legendGap', 'inferred-gap': 'placement.legendInferred',
  secure: 'placement.legendSecure', practised: 'placement.legendPractised', untested: 'placement.legendUntested',
  mixed: 'placement.legendMixed'
};
// Practice evidence strong enough that a single placement miss must not be
// shown as if it overrode it: five or more attempts at 'strong' mastery.
const STRONG_PRACTICE = { attempts: 5, mastery: 65 };

export default function Placement() {
  const { user } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState(null);
  const [answered, setAnswered] = useState(null);      // the reply for the question on screen
  const [params, setParams] = useSearchParams();
  const autoStart = params.get('go') === '1';

  const refresh = useCallback(async () => {
    try {
      const v = await api.get('/placement');
      setView(v);
      setQuestion(v.status === 'active' ? v.question : null);
      setProgress(v.progress || null);
      setAnswered(null);
      setError('');
    } catch (err) { setError(err.message || tLater('placement.couldNotLoad')); }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  // "Start" on the home card lands here with ?go=1: begin straight away rather
  // than asking twice. The flag is consumed so a reload does not restart.
  useEffect(() => {
    if (!autoStart || !view) return;
    setParams({}, { replace: true });
    if (view.available && (view.status === 'none' || view.status === 'skipped')) start(false);
  }, [autoStart, view]); // eslint-disable-line

  const start = async (restart = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.post('/placement/start', { restart });
      setView(v => ({ ...(v || {}), status: 'active' }));
      setQuestion(r.question);
      setProgress(r.progress);
      setAnswered(null);
      setError('');
    } catch (err) { setError(err.message || tLater('placement.couldNotLoad')); }
    finally { setBusy(false); }
  };

  const skip = async () => {
    try { await api.post('/placement/skip', {}); } catch { /* skipping is a preference; nothing to recover */ }
    nav('/', { replace: true });
  };

  const advance = () => {
    if (!answered) return;
    if (answered.done) { refresh(); return; }
    setQuestion(answered.next);
    setProgress(answered.progress);
    setAnswered(null);
    if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
  };

  if (error && !view) return <div className="card" role="alert">{error}</div>;
  if (!view) return <div className="skeleton" style={{ height: 420 }} />;

  if (!view.available) {
    return (
      <div className="card">
        <h1 className="card-title">{t('placement.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('placement.unavailable')}</p>
      </div>
    );
  }

  // ── A question on screen ──
  if (question) {
    const n = (progress?.asked || 0) + 1;
    return (
      <div className="grid" style={{ gap: 14 }}>
        <h1 className="sr-only">{t('placement.title')}</h1>
        <div className="card pm-progress" role="status">
          <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
            <b>{t('placement.progress', { n, target: progress?.target || 10, max: progress?.max || 12 })}</b>
            {question.phase && PHASE_KEY[question.phase] && <span className="tag tag-brand" data-placement-phase={question.phase}>{t(PHASE_KEY[question.phase])}</span>}
          </div>
          <div className="pm-bar" aria-hidden="true"><div style={{ width: `${Math.min(100, Math.round(100 * (n - 1) / (progress?.target || 10)))}%` }} /></div>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <QuestionCard
          key={question.id}
          question={question}
          diagnostic={{ submitPath: `/placement/${question.id}/answer` }}
          onResolved={setAnswered}
        />
        {answered && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-lg" onClick={advance} data-placement-next>
              {t(answered.done ? 'placement.seeResult' : 'placement.next')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Intro (not started, or skipped) ──
  if (!view.result) {
    return (
      <div className="card" style={{ maxWidth: 760 }}>
        <h1 className="card-title">{t('placement.title')}</h1>
        <p className="sub">{t('placement.introLead')}</p>
        <p>{t('placement.introHow')}</p>
        <p>{t('placement.introMarking')}</p>
        <p className="muted">{t('placement.introEvidence')}</p>
        <p className="muted" style={{ fontSize: 12.5 }}>{t('placement.provenance', { version: PREREQ_GRAPH_VERSION })}</p>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => start(false)} data-placement-start>{t('placement.start')}</button>
          <button className="btn btn-quiet" disabled={busy} onClick={skip}>{t('placement.notNow')}</button>
        </div>
      </div>
    );
  }

  return <PlacementResult view={view} user={user} busy={busy} onRetake={() => start(true)} error={error} />;
}

function levelLabel(t, level) {
  if (level == null) return t('placement.levelUnknown');
  if (level < 7) return t('placement.levelBelow7');
  return t('placement.levelClass', { n: level });
}

function PlacementResult({ view, user, busy, onRetake, error }) {
  const t = useT();
  const nav = useNavigate();
  const r = view.result;
  const names = useMemo(() => Object.fromEntries((view.chapters || []).map(c => [c.id, c])), [view.chapters]);
  const nameOf = id => names[id]?.name || id;
  const [focus, setFocus] = useState(r.rootGaps?.[0]?.chapterId || null);
  const focusChain = useMemo(() => new Set((r.rootGaps || []).find(g => g.chapterId === focus)?.chain.map(c => c.chapterId) || []), [r, focus]);
  const finished = r.finishedAt ? new Date(r.finishedAt).toLocaleDateString(user?.locale || undefined) : '';
  // Edge skills are authored in English beside the graph; a Hindi reader gets
  // the reviewed Hindi label, never a blank.
  const skillText = skill => (user?.language === 'hi' && PREREQ_SKILLS_HI[skill]) || skill;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <div className="spread" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 className="card-title" style={{ marginBottom: 4 }}>{t('placement.resultTitle')}</h1>
            <p className="sub" style={{ margin: 0 }}>{t('placement.resultSub', { count: r.asked, n: r.asked, date: finished })}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="sc-label" style={{ margin: 0 }}>{t('placement.overall')}</div>
            <div className="big" data-placement-level={r.overallLevel ?? ''}>{levelLabel(t, r.overallLevel)}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{t('placement.estimateNote')} {t('placement.introEvidence')}</p>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{t('placement.provenance', { version: r.graphVersion || PREREQ_GRAPH_VERSION })}</p>
      </div>

      <div className="card">
        <div className="card-title">{t('placement.rootGapsTitle')}</div>
        {!r.rootGaps?.length ? <p className="muted" style={{ margin: 0 }}>{t('placement.noRootGaps')}</p> : (
          <div className="grid" style={{ gap: 12 }}>
            {r.rootGaps.map(g => (
              <div key={g.chapterId} className={`pm-root ${focus === g.chapterId ? 'on' : ''}`} data-root-gap={g.chapterId}>
                <div className="spread" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button className="linklike" onClick={() => setFocus(g.chapterId)} aria-pressed={focus === g.chapterId}>
                    <b>{t('placement.rootGapAt', { chapter: nameOf(g.chapterId), grade: g.grade })}</b>
                  </button>
                  <span className={`tag ${g.confidence === 'moderate' ? 'tag-brand' : ''}`}>{t(g.confidence === 'moderate' ? 'placement.confidenceModerate' : 'placement.confidenceLow')}</span>
                </div>
                <div className="sc-label" style={{ margin: '8px 0 4px' }}>{t('placement.chainLabel')}</div>
                <ol className="pm-chain" data-chain={g.chain.map(c => c.chapterId).join('<')}>
                  {g.chain.map((c, i) => (
                    <li key={c.chapterId}>
                      {i > 0 && <span className="pm-arrow" aria-hidden="true">←</span>}
                      <span className={`pm-link ${c.chapterId === g.chapterId ? 'root' : ''}`}>
                        <TermGloss text={nameOf(c.chapterId)} />
                        <span className="muted"> · {t('common.classNumber', { n: c.grade })}</span>
                        {c.tested
                          ? <>
                            <span className="pm-mark" aria-hidden="true">{c.correct ? ' ✓' : ' ✗'}</span>
                            <span className="sr-only">{t(c.correct ? 'placement.linkRight' : 'placement.linkWrong')}</span>
                          </>
                          : <span className="muted" style={{ fontSize: 12 }}> ({t('placement.untested')})</span>}
                      </span>
                      {c.skill && <span className="muted pm-skill">{skillText(c.skill)}</span>}
                    </li>
                  ))}
                </ol>
                {g.sameChapter && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{t('placement.sameChapter')}</p>}
                {!g.resolved && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }} data-stopped-by={g.stoppedBy || 'budget'}>{t(g.stoppedBy === 'trace-cap' ? 'placement.unresolvedCap' : 'placement.unresolvedBudget')}</p>}
                {g.belowFloor && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{t('placement.belowFloor')}</p>}
                {g.contradicted && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{t('placement.contradicted')}</p>}
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                  onClick={() => nav(`/practice?subtopic=${encodeURIComponent(g.chapterId)}&track=cbse`)}>
                  {t('placement.practiseRoot', { chapter: nameOf(g.chapterId) })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">{t('placement.strandsTitle')}</div>
        <div className="table-scroll">
          <table className="syl-table">
            <thead><tr>
              <th style={{ textAlign: 'left' }}>{t('placement.colStrand')}</th>
              <th>{t('placement.colSecure')}</th><th>{t('placement.colHighest')}</th><th>{t('placement.colQuestions')}</th>
            </tr></thead>
            <tbody>
              {(r.strands || []).filter(s => s.probes > 0).map(s => (
                <tr key={s.id} data-strand={s.id}>
                  <td style={{ textAlign: 'left' }}>
                    <b>{t(STRAND_KEY[s.id])}</b>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t(s.confidence === 'moderate' ? 'placement.confidenceModerate' : 'placement.confidenceLow')}
                      {s.lowSample && <> · {t('placement.lowSample')}</>}
                      {s.inconsistent && <> · {t('placement.inconsistent')}</>}
                      {s.jeeDepth && <> · {t('placement.jeeDepthYes')}</>}
                    </div>
                  </td>
                  <td>{levelLabel(t, s.securedThrough)}</td>
                  <td>{s.highestPassed == null ? '—' : t('common.classNumber', { n: s.highestPassed })}</td>
                  <td>{s.probes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MasteryMap view={view} result={r} chain={focusChain} />

      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" disabled={busy} onClick={onRetake} data-placement-retake>{t('placement.retake')}</button>
        <button className="btn btn-quiet" onClick={() => nav('/progress')}>{t('placement.backToProgress')}</button>
        {view.previous?.length > 0 && <span className="muted" style={{ alignSelf: 'center', fontSize: 12.5 }}>{t('placement.previousCount', { count: view.previous.length, n: view.previous.length })}</span>}
      </div>
    </div>
  );
}

/** Class 7 → 12 plus JEE depth, one row per strand group. */
function MasteryMap({ view, result, chain }) {
  const t = useT();
  const chapters = view.chapters || [];
  const cells = useMemo(() => {
    const out = new Map();
    for (const ch of chapters) {
      const row = mapStrandOf(ch.id);
      if (!row) continue;
      const key = `${row}:${ch.grade}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(ch);
    }
    return out;
  }, [chapters]);

  const statusOf = ch => {
    const diag = result.chapters?.[ch.id];
    const strong = ch.attempts >= STRONG_PRACTICE.attempts && ch.mastery >= STRONG_PRACTICE.mastery;
    // One missed placement question does not outweigh substantial practice:
    // where they disagree, the chip says both.
    if (diag && strong && diag.outcome !== 'secure') return 'mixed';
    if (diag) return diag.outcome;
    if (ch.attempts > 0) return 'practised';
    return 'untested';
  };

  const chip = (ch, status, extra = '') => {
    const label = t(OUTCOME_KEY[status] || 'placement.legendUntested');
    const full = ch.attempts > 0 ? t('placement.practiceMastery', { status: label, n: ch.mastery }) : label;
    return (
      <li key={ch.id + extra} className={`pm-chip pm-${status} ${chain.has(ch.id) ? 'pm-in-chain' : ''}`}
        data-chapter={ch.id} data-status={status}
        title={t('placement.cellStatus', { chapter: ch.name, status: full })}>
        <span className="sr-only">{t('placement.cellStatus', { chapter: ch.name, status: full })}</span>
        <span aria-hidden="true">{ch.name}</span>
        {ch.attempts > 0 && <span className="pm-mastery" aria-hidden="true" style={{ width: `${Math.max(4, ch.mastery)}%` }} />}
      </li>
    );
  };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>{t('placement.mapTitle')}</div>
      <p className="muted" style={{ marginTop: 0 }}>{t('placement.mapSub')}</p>
      <ul className="pm-legend" aria-label={t('placement.mapTitle')}>
        {['root-gap', 'gap', 'inferred-gap', 'secure', 'mixed', 'practised', 'untested'].map(s => (
          <li key={s} className={`pm-chip pm-${s}`}>{t(OUTCOME_KEY[s])}</li>
        ))}
      </ul>
      <div className="table-scroll" style={{ marginTop: 10 }}>
        <table className="pm-map">
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left' }}>{t('placement.colStrand')}</th>
              {GRADES.map(g => <th scope="col" key={g}>{t('common.classNumber', { n: g })}</th>)}
              <th scope="col">{t('placement.colJee')}</th>
            </tr>
          </thead>
          <tbody>
            {MAP_STRANDS.map(row => (
              <tr key={row.id}>
                <th scope="row" style={{ textAlign: 'left' }}>{t(STRAND_KEY[row.id])}</th>
                {GRADES.map(g => (
                  <td key={g}>
                    <ul className="pm-cell">{(cells.get(`${row.id}:${g}`) || []).map(ch => chip(ch, statusOf(ch)))}</ul>
                  </td>
                ))}
                <td>
                  <ul className="pm-cell">
                    {[11, 12].flatMap(g => cells.get(`${row.id}:${g}`) || [])
                      .filter(ch => result.depth?.[ch.id])
                      .map(ch => {
                        const d = result.depth[ch.id];
                        const status = d.correct && d.difficulty >= 3 ? 'secure' : 'gap';
                        return (
                          <li key={ch.id} className={`pm-chip pm-${status}`} data-chapter={ch.id} data-status={`jee-${status}`}
                            title={t('placement.cellStatus', { chapter: ch.name, status: t(status === 'secure' ? 'placement.jeeDepthShown' : 'placement.jeeDepthMissed') })}>
                            <span className="sr-only">{t('placement.cellStatus', { chapter: ch.name, status: t(status === 'secure' ? 'placement.jeeDepthShown' : 'placement.jeeDepthMissed') })}</span>
                            <span aria-hidden="true">{ch.name}</span>
                          </li>
                        );
                      })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
