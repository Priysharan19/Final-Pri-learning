import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import { EDITION_ID } from '../brand/edition.js';
import { featureEnabled } from '../platform/features.js';
import './signInScenes.css';

// The sign-in's left half (design "Sign-in A", UI): a few capability scenes
// that rotate every six seconds, pause while the pointer or focus is on the
// panel, crossfade, and can be picked with labelled dot buttons. Every scene
// states only what the product does in THIS edition today:
//   · handwriting checked line by line — live in both editions;
//   · the Exam Desk — Prithagoras, only where the desk is switched on
//     (PRI_FEATURE_EXAM_DESK); it is unmarked, and the scene says so;
//   · full timed papers in board format — Priyabhata (CBSE Class 10 and 12);
//   · notes with diagrams — Priyabhata (the NCERT notes);
//   · the daily review set — both editions.
// A scene that is not live is not listed. Nothing here is data of a student.
// Under prefers-reduced-motion nothing animates or rotates; the dots still work.

// The catalogue keys, written out so the i18n contract can see each one.
const LABEL = Object.freeze({ hand: 'scn.label.hand', desk: 'scn.label.desk', papers: 'scn.label.papers', notes: 'scn.label.notes', daily: 'scn.label.daily' });
const IN = EDITION_ID !== 'prithagoras';
const FUNCTION = IN
  ? { f: x => x * x - 2 * x - 8, xs: [-3, 5], ticks: [-2, 4], turn: 1, label: 'login.plotAltP', fact: 'login.plotZeroes', line1: '(x − 4)(x + 2) = 0', line2: 'x = 4 or x = −2' }
  : { f: x => x * x - 2 * x - 3, xs: [-3, 5], ticks: [-1, 3], turn: 1, label: 'login.plotAltY', fact: 'login.plotTurning', line1: '(x − 3)(x + 1) = 0', line2: 'x = 3 or x = −1' };
const DAILY = IN
  ? [['Quadratic Equations', 'scn.tagDue'], ['Arithmetic Progressions', 'scn.tagRetest'], ['Trigonometry', 'scn.tagNew']]
  : [['Integration', 'scn.tagDue'], ['Sequences & Series', 'scn.tagRetest'], ['Trigonometric Calculus', 'scn.tagNew']];

/** Which scenes this edition may show now. */
export function scenesFor(edition = EDITION_ID, flags = { desk: featureEnabled('examDesk') }) {
  if (edition === 'prithagoras') return ['hand', ...(flags.desk ? ['desk'] : []), 'daily'];
  return ['hand', 'papers', 'notes', 'daily'];
}

function Math1({ children }) { return <span className="sc-m">{children}</span>; }

function Graph({ t }) {
  const W = 640; const H = 440; const u = 56; const cx = 250; const cy = 230;
  const px = x => cx + x * u;
  const py = y => cy - (y * u) / 2.2;
  const pts = [];
  for (let x = FUNCTION.xs[0]; x <= FUNCTION.xs[1] + 0.001; x += 0.2) pts.push(`${px(x).toFixed(1)},${py(FUNCTION.f(x)).toFixed(1)}`);
  const grid = [];
  for (let k = -4; k <= 6; k++) grid.push(<line key={`v${k}`} x1={px(k)} y1={20} x2={px(k)} y2={H - 10} />);
  for (let k = -5; k <= 6; k++) grid.push(<line key={`h${k}`} x1={20} y1={cy - k * 25} x2={W - 20} y2={cy - k * 25} />);
  return (
    <svg className="sc-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(FUNCTION.label)}>
      <g className="sc-grid">{grid}</g>
      <line className="sc-axis" x1={20} y1={cy} x2={W - 20} y2={cy} />
      <line className="sc-axis" x1={px(0)} y1={20} x2={px(0)} y2={H - 10} />
      <polyline className="sc-curve" pathLength="1" points={pts.join(' ')} />
      {FUNCTION.ticks.map((x, i) => <circle key={x} className={`sc-pop sc-pop${i + 1}`} cx={px(x)} cy={cy} r="5" />)}
      <circle className="sc-pop sc-pop3 sc-dot" cx={px(FUNCTION.turn)} cy={py(FUNCTION.f(FUNCTION.turn))} r="6" />
      {FUNCTION.ticks.map((x, i) => <text key={`t${x}`} className={`sc-pop sc-pop${i + 1} sc-tick`} x={px(x)} y={cy - 14} textAnchor="middle">{String(x).replace('-', '−')}</text>)}
    </svg>
  );
}

function Scene({ id, t }) {
  if (id === 'hand') {
    return (
      <>
        <p className="sc-eyebrow sc-r1">{t('scn.hand.eyebrow')}</p>
        <Graph t={t} />
        <div className="sc-foot">
          <p className="sc-head sc-r2">{t('login.instrumentHeadline')}</p>
          <div className="sc-card" aria-hidden="true">
            <p className="sc-r3"><span className="sc-tick-ico">✓</span><Math1>{FUNCTION.line1}</Math1></p>
            <p className="sc-r4"><span className="sc-tick-ico">✓</span><Math1>{FUNCTION.line2}</Math1></p>
          </div>
        </div>
        <p className="sc-fact sc-r3">{t(FUNCTION.fact)}</p>
      </>
    );
  }
  if (id === 'desk' || id === 'papers') {
    const desk = id === 'desk';
    return (
      <div className="sc-centre">
        <p className="sc-eyebrow sc-r1">{t(desk ? 'scn.desk.eyebrow' : 'scn.papers.eyebrow')}</p>
        <svg className="sc-ring-svg" viewBox="0 0 120 120" role="img" aria-label={t('scn.timer')}>
          <circle cx="60" cy="60" r="48" className="sc-ring-bg" />
          <circle cx="60" cy="60" r="48" className="sc-ring" pathLength="100" transform="rotate(-90 60 60)" />
          <text x="60" y="58" textAnchor="middle" className="sc-ring-t">{desk ? '3:00:00' : '2:41:09'}</text>
          <text x="60" y="76" textAnchor="middle" className="sc-ring-s">{t(desk ? 'scn.desk.reading' : 'scn.timeLeft')}</text>
        </svg>
        <div className="sc-chips sc-r2"><span>{t(desk ? 'scn.desk.chip1' : 'scn.papers.chip1')}</span><span>{t(desk ? 'scn.desk.chip2' : 'scn.papers.chip2')}</span></div>
        <p className="sc-head sc-r3 sc-c">{t(desk ? 'scn.desk.head' : 'scn.papers.head')}</p>
      </div>
    );
  }
  if (id === 'notes') {
    return (
      <div className="sc-centre sc-left">
        <p className="sc-eyebrow sc-r1">{t('scn.notes.eyebrow')}</p>
        <svg className="sc-bars" viewBox="0 0 460 200" role="img" aria-label={t('scn.notes.alt')}>
          <line className="sc-axis" x1="20" y1="180" x2="440" y2="180" />
          {[8, 30, 62, 104, 156].map((h, i) => <rect key={h} className="sc-bar" style={{ animationDelay: `${0.2 + i * 0.15}s` }} x={40 + i * 48} y={180 - h} width="48" height={h} />)}
          <path className="sc-curve sc-thin" pathLength="1" d="M40 180 Q160 176 280 20" />
        </svg>
        <p className="sc-head sc-r3">{t('scn.notes.head')}</p>
      </div>
    );
  }
  return (
    <div className="sc-centre sc-left">
      <p className="sc-eyebrow sc-r1">{t('scn.daily.eyebrow')}</p>
      {DAILY.map(([name, tag], i) => (
        <div key={name} className={`sc-row sc-r${i + 1}`}><span lang="en">{name}</span><em className={i === 1 ? 'is-hot' : undefined}>{t(tag)}</em></div>
      ))}
      <p className="sc-head sc-r4">{t('scn.daily.head')}</p>
    </div>
  );
}

export default function SignInScenes() {
  const t = useT();
  const ids = useMemo(() => scenesFor(), []);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const fade = useRef(0);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReduced(!!mq?.matches);
    const onVis = () => setVisible(document.visibilityState !== 'hidden');
    mq?.addEventListener?.('change', onMotion);
    document.addEventListener('visibilitychange', onVis);
    return () => { mq?.removeEventListener?.('change', onMotion); document.removeEventListener('visibilitychange', onVis); clearTimeout(fade.current); };
  }, []);
  const go = useCallback(next => {
    setIndex(cur => {
      if (next === cur) return cur;
      setPrev(cur);
      clearTimeout(fade.current);
      fade.current = setTimeout(() => setPrev(null), 600);
      return next;
    });
  }, []);
  useEffect(() => {
    if (reduced || paused || !visible || ids.length < 2) return undefined;
    const timer = setInterval(() => go((index + 1) % ids.length), 6000);
    return () => clearInterval(timer);
  }, [reduced, paused, visible, ids.length, index, go]);
  return (
    <figure className="in-signin-plot in-scenes" data-scenes={ids.join(',')} data-reduced={reduced ? 'true' : undefined}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {prev !== null && <div key={`out-${ids[prev]}`} className="sc-scene is-out" aria-hidden="true"><Scene id={ids[prev]} t={t} /></div>}
      <div key={`in-${ids[index]}`} className="sc-scene is-in" aria-live={paused ? 'polite' : 'off'}><Scene id={ids[index]} t={t} /></div>
      {ids.length > 1 && (
        <div className="sc-dots" role="group" aria-label={t('scn.group', {})}>
          {ids.map((id, i) => (
            <button key={id} type="button" className={`sc-dot-btn${i === index ? ' is-on' : ''}`} aria-label={t(LABEL[id])} aria-pressed={i === index} onClick={() => go(i)}><i /></button>
          ))}
        </div>
      )}
    </figure>
  );
}
