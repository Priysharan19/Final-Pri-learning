import React, { useMemo } from 'react';
import { MathText } from '../lib/latex.jsx';
import { sanitizeFigure } from '../lib/sanitize.js';
import './PriExplainVisuals.css';

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function tokenMotionPlan(diff) {
  const before = (diff?.before || []).map((token, index) => ({ ...token, index, state: token.changed ? 'leaving' : 'stable' }));
  const after = (diff?.after || []).map((token, index) => ({ ...token, index, state: token.changed ? 'entering' : 'stable' }));
  const waitingAfter = new Map();
  const pairs = [];

  for (const token of after) {
    if (!token.changed) continue;
    const bucket = waitingAfter.get(token.text) || [];
    bucket.push(token.index);
    waitingAfter.set(token.text, bucket);
  }

  for (const token of before) {
    if (!token.changed) continue;
    const bucket = waitingAfter.get(token.text);
    if (!bucket?.length) continue;
    const afterIndex = bucket.shift();
    token.state = 'moving';
    after[afterIndex].state = 'moving';
    const key = `${token.text}-${token.index}-${afterIndex}`;
    token.motionKey = key;
    after[afterIndex].motionKey = key;
    pairs.push({ key, text: token.text, beforeIndex: token.index, afterIndex });
  }

  return { before, after, pairs };
}

function TokenStrip({ tokens, label, phase = 'rest' }) {
  if (!tokens?.length) return null;
  return (
    <div className={`pri-v-tokenstrip phase-${phase}`} aria-label={label}>
      {tokens.map((token, index) => (
        <span
          key={`${index}-${token.text}`}
          className={`state-${token.state || (token.changed ? 'changed' : 'stable')}`}
          data-motion-key={token.motionKey || undefined}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

function MotionLane({ pairs }) {
  if (!pairs?.length) return null;
  return (
    <div className="pri-v-motion-lane" aria-label="Verified terms carried into the next line">
      <span className="pri-v-motion-label">track the same term</span>
      <div>
        {pairs.map((pair, index) => (
          <b key={pair.key} style={{ '--motion-order': index }}>{pair.text}</b>
        ))}
      </div>
    </div>
  );
}

export function EquationTransform({ visual, progress = 1 }) {
  const plan = useMemo(() => tokenMotionPlan(visual?.diff), [visual?.diff]);
  if (!visual?.before || !visual?.after) return null;
  const p = clamp01(progress);
  const started = p > 0;
  const completed = p >= 0.92;
  return (
    <div
      className={`pri-v-transform pri-v-choreographed ${started ? 'has-started' : ''} ${completed ? 'is-complete' : ''}`}
      data-progress={Math.round(p * 100)}
      aria-label={`Equation transformation from ${visual.before}${started ? ` to ${visual.after}` : ''}`}
    >
      <div className="pri-v-transform-state">
        <span className="pri-v-state-label">verified line</span>
        <div className="pri-v-transform-math before"><MathText text={`$${visual.before}$`} /></div>
      </div>

      <TokenStrip
        tokens={plan.before}
        phase={started ? 'depart' : 'inspect'}
        label="Terms in the verified line before the transformation"
      />

      <div className="pri-v-transform-arrow" aria-hidden="true">
        <i />
        <span>track what changes</span>
        <b>↓</b>
      </div>

      <MotionLane pairs={plan.pairs} />

      <TokenStrip
        tokens={plan.after}
        phase={started ? 'arrive' : 'prepare'}
        label="Terms in the next verified line"
      />

      <div className="pri-v-transform-state after-state">
        <span className="pri-v-state-label">next verified line</span>
        <div className="pri-v-transform-math after"><MathText text={`$${visual.after}$`} /></div>
      </div>

      {!started && <div className="pri-v-awaiting" aria-hidden="true">building the next verified state</div>}
    </div>
  );
}

export function MathFocus({ visual, progress = 1 }) {
  if (!visual?.expression) return null;
  const p = clamp01(progress);
  const tokens = Array.isArray(visual.tokens) ? visual.tokens : [];
  return (
    <div className="pri-v-focus pri-v-choreographed" aria-label={`Focus on ${visual.expression}`}>
      <div className="pri-v-caption">
        <span>{visual.label || 'Focus on the structure'}</span>
        <b>verified expression</b>
      </div>
      {p >= 0.18 ? <div className="pri-v-focus-math"><MathText text={`$${visual.expression}$`} /></div> : <div className="pri-v-focus-placeholder" aria-hidden="true" />}
      {!!tokens.length && p >= 0.64 && (
        <div className="pri-v-focus-chips" aria-label="Important terms">
          {tokens.map((token, index) => (
            <span key={`${token}-${index}`}><MathText text={`$${token}$`} /></span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Checkpoint({ visual, complete = true }) {
  if (!visual?.prompt || !complete) return null;
  return (
    <div className="pri-v-checkpoint" aria-label="Understanding checkpoint">
      <span>Pause and predict</span>
      <strong>{visual.prompt}</strong>
      <small>Say or write what you think happens next, then continue.</small>
    </div>
  );
}

function pointOf(raw) {
  const x = Number(raw?.x), y = Number(raw?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function inkGeometry(attempt) {
  const groups = [
    ...(Array.isArray(attempt?.strokes) ? attempt.strokes.map(s => ({ ...s, tone: 'ink' })) : []),
    ...(Array.isArray(attempt?.scribble) ? attempt.scribble.map(s => ({ ...s, tone: 'scribble' })) : []),
  ];
  const clean = groups.map(stroke => ({
    tone: stroke.tone,
    points: (stroke.points || []).map(pointOf).filter(Boolean),
  })).filter(stroke => stroke.points.length > 0);
  const pts = clean.flatMap(stroke => stroke.points);
  if (!pts.length) return { strokes: [], box: { x: 0, y: 0, w: 100, h: 60 } };
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 18;
  return {
    strokes: clean,
    box: { x: minX - pad, y: minY - pad, w: Math.max(80, maxX - minX + pad * 2), h: Math.max(50, maxY - minY + pad * 2) },
  };
}

function pathOf(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

export function InkReplay({ visual, progress = 1 }) {
  const geometry = useMemo(() => inkGeometry(visual?.attempt), [visual]);
  const attempt = visual?.attempt;
  if (!attempt || !geometry.strokes.length) return null;
  const p = clamp01(progress);
  const visibleCount = p < 0.1 ? 0 : Math.max(1, Math.ceil(geometry.strokes.length * p));
  const b = geometry.box;
  return (
    <div className="pri-v-ink pri-v-choreographed">
      <div className="pri-v-caption"><span>Your actual working</span><b>{visibleCount < geometry.strokes.length ? 'replaying with the explanation' : 'replay complete'}</b></div>
      <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} role="img" aria-label="Replay of your submitted handwriting">
        {geometry.strokes.slice(0, visibleCount).map((stroke, index) => (
          <path
            key={index}
            d={pathOf(stroke.points)}
            pathLength="1"
            className={stroke.tone === 'scribble' ? 'scribble' : 'ink'}
            style={{ '--stroke-delay': `${Math.min(index * 55, 900)}ms` }}
          />
        ))}
      </svg>
      {attempt.working && p >= 0.9 && <div className="pri-v-recognized"><span>Pri read</span><MathText text={attempt.working} /></div>}
    </div>
  );
}

export function AttemptReplay({ visual }) {
  const attempt = visual?.attempt;
  if (!attempt) return null;
  return (
    <div className="pri-v-attempt pri-v-choreographed">
      <span>Your submitted working</span>
      {attempt.working && <MathText text={attempt.working} />}
      {!attempt.working && attempt.answer && <MathText text={attempt.answer} />}
    </div>
  );
}

export function AnimatedFigure({ visual, progress = 1 }) {
  const figure = useMemo(() => sanitizeFigure(visual?.figure), [visual?.figure]);
  if (!figure) return null;
  const p = clamp01(progress);
  const ready = p >= 0.24;
  const phase = p < 0.5 ? 'constructing' : p < 0.85 ? 'developing' : 'complete';
  return (
    <div className={`pri-v-figure ${visual.mode || 'figure'} pri-v-choreographed`} data-phase={phase}>
      <div className="pri-v-caption">
        <span>{visual.mode === 'calculus' ? 'Dynamic calculus view' : visual.mode === 'geometry' ? 'Dynamic geometry view' : 'Dynamic graph view'}</span>
        <b>{phase === 'constructing' ? 'building the setup' : phase === 'developing' ? 'adding the important structure' : 'construction complete'}</b>
      </div>
      {ready
        ? <div className="pri-v-figure-inner" key={`${visual.mode}-${phase}`} dangerouslySetInnerHTML={{ __html: figure }} />
        : <div className="pri-v-figure-placeholder" aria-hidden="true"><i /><i /><i /></div>}
    </div>
  );
}

export function VisualBlock({ visual, progress = 1, complete = true }) {
  if (!visual) return null;
  if (visual.kind === 'transform') return <EquationTransform visual={visual} progress={progress} />;
  if (visual.kind === 'focus') return <MathFocus visual={visual} progress={progress} />;
  if (visual.kind === 'checkpoint') return <Checkpoint visual={visual} complete={complete} />;
  if (visual.kind === 'ink') return <InkReplay visual={visual} progress={progress} />;
  if (visual.kind === 'attempt') return <AttemptReplay visual={visual} />;
  if (visual.kind === 'figure') return <AnimatedFigure visual={visual} progress={progress} />;
  return null;
}
