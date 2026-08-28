import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { sanitizeFigure } from '../lib/sanitize.js';
import { clamp01, figureRevealSchedule, primitiveReveal, tokenMotionPlan } from '../explain/choreography.js';
import './PriExplainVisuals.css';
import './PriExplainV6.css';

function TokenStrip({ tokens, label, phase = 'rest', registerToken, motionOrder }) {
  if (!tokens?.length) return null;
  return (
    <div className={`pri-v-tokenstrip phase-${phase}`} aria-label={label}>
      {tokens.map((token, index) => {
        const order = token.motionKey ? (motionOrder?.get(token.motionKey) ?? 0) : 0;
        return (
          <span
            key={`${index}-${token.text}`}
            ref={node => registerToken?.(token, node)}
            className={`state-${token.state || (token.changed ? 'changed' : 'stable')}`}
            data-motion-key={token.motionKey || undefined}
            style={token.state === 'moving' ? { '--landing-delay': `${1180 + order * 55}ms` } : undefined}
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
}

function FlightLayer({ flights }) {
  if (!flights?.length) return null;
  return (
    <div className="pri-v-flight-layer" aria-hidden="true">
      {flights.map((flight, index) => (
        <span
          key={flight.key}
          className="pri-v-flight-token"
          style={{
            left: `${flight.left}px`,
            top: `${flight.top}px`,
            width: `${flight.width}px`,
            height: `${flight.height}px`,
            '--flight-dx': `${flight.dx}px`,
            '--flight-dy': `${flight.dy}px`,
            '--flight-mid-x': `${flight.dx * 0.58}px`,
            '--flight-mid-y': `${flight.dy * 0.58 - Math.min(14, 8 + Math.abs(flight.dy) * 0.08)}px`,
            '--flight-delay': `${460 + index * 55}ms`,
          }}
        >
          {flight.text}
        </span>
      ))}
    </div>
  );
}

export function EquationTransform({ visual, progress = 1 }) {
  const plan = useMemo(() => tokenMotionPlan(visual?.diff), [visual?.diff]);
  const rootRef = useRef(null);
  const beforeNodes = useRef(new Map());
  const afterNodes = useRef(new Map());
  const [flights, setFlights] = useState([]);
  const motionOrder = useMemo(() => new Map(plan.pairs.map((pair, index) => [pair.key, index])), [plan]);

  const p = clamp01(progress);
  const started = p > 0;
  const completed = p >= 0.92;

  useLayoutEffect(() => {
    if (!started || !rootRef.current || !plan.pairs.length) {
      setFlights([]);
      return undefined;
    }

    let frame = 0;
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const next = plan.pairs.map(pair => {
        const fromNode = beforeNodes.current.get(pair.key);
        const toNode = afterNodes.current.get(pair.key);
        if (!fromNode || !toNode) return null;
        const from = fromNode.getBoundingClientRect();
        const to = toNode.getBoundingClientRect();
        return {
          ...pair,
          left: from.left - rootRect.left,
          top: from.top - rootRect.top,
          width: Math.max(from.width, to.width),
          height: Math.max(from.height, to.height),
          dx: to.left - from.left,
          dy: to.top - from.top,
        };
      }).filter(Boolean);
      setFlights(next);
    };

    frame = window.requestAnimationFrame(measure);
    const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(measure) : null;
    if (observer) observer.observe(rootRef.current);
    else window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', measure);
    };
  }, [started, plan]);

  if (!visual?.before || !visual?.after) return null;

  const registerBefore = (token, node) => {
    if (!token?.motionKey) return;
    if (node) beforeNodes.current.set(token.motionKey, node);
    else beforeNodes.current.delete(token.motionKey);
  };
  const registerAfter = (token, node) => {
    if (!token?.motionKey) return;
    if (node) afterNodes.current.set(token.motionKey, node);
    else afterNodes.current.delete(token.motionKey);
  };

  return (
    <div
      ref={rootRef}
      className={`pri-v-transform pri-v-transform-v6 pri-v-choreographed ${started ? 'has-started' : ''} ${completed ? 'is-complete' : ''}`}
      data-progress={Math.round(p * 100)}
      aria-label={`Equation transformation from ${visual.before}${started ? ` to ${visual.after}` : ''}`}
    >
      <FlightLayer flights={started ? flights : []} />

      <div className="pri-v-transform-state">
        <span className="pri-v-state-label">verified line</span>
        <div className="pri-v-transform-math before"><MathText text={`$${visual.before}$`} /></div>
      </div>

      <TokenStrip
        tokens={plan.before}
        phase={started ? 'depart' : 'inspect'}
        label="Terms in the verified line before the transformation"
        registerToken={registerBefore}
        motionOrder={motionOrder}
      />

      <div className="pri-v-transform-arrow" aria-hidden="true">
        <i />
        <span>track what changes</span>
        <b>↓</b>
      </div>

      {!!plan.pairs.length && <div className="pri-v-position-note" aria-hidden="true">same verified term · real position</div>}

      <TokenStrip
        tokens={plan.after}
        phase={started ? 'arrive' : 'prepare'}
        label="Terms in the next verified line"
        registerToken={registerAfter}
        motionOrder={motionOrder}
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

const FIGURE_SEQUENCE = {
  geometry: ['points', 'lines', 'construction', 'labels'],
  graph: ['axes', 'curve', 'points', 'labels'],
  calculus: ['axes', 'boundary', 'region', 'labels'],
  statistics: ['axes', 'marks', 'data', 'labels'],
  figure: ['setup', 'structure', 'details', 'labels'],
};

function figureSequence(mode) {
  return FIGURE_SEQUENCE[mode] || FIGURE_SEQUENCE.figure;
}

function hasDrawableStroke(element) {
  const stroke = window.getComputedStyle(element).stroke;
  return Boolean(stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)');
}

export function AnimatedFigure({ visual, progress = 1 }) {
  // Keep the sanitised value named `figure`: the independent security gate
  // inventories raw-markup sinks and only accepts figure-provenance sinks.
  const figure = useMemo(() => sanitizeFigure(visual?.figure), [visual?.figure]);
  const figureRef = useRef(null);
  const p = clamp01(progress);
  const ready = p >= 0.08;
  const phase = p < 0.38 ? 'constructing' : p < 0.82 ? 'developing' : 'complete';
  const mode = visual?.mode || 'figure';
  const sequence = figureSequence(mode);
  const activeSequence = Math.min(sequence.length - 1, Math.floor(p * sequence.length));

  useLayoutEffect(() => {
    const host = figureRef.current;
    if (!host || !ready) return;
    const primitives = [...host.querySelectorAll('line,path,polyline,polygon,circle,ellipse,rect,text')]
      .filter(element => !element.closest('defs'));
    const schedule = figureRevealSchedule(mode, primitives.map(element => ({ tagName: element.tagName })));
    const total = schedule.length;

    schedule.forEach(item => {
      const element = primitives[item.sourceIndex];
      if (!element) return;
      const reveal = primitiveReveal(p, item.order, total);
      element.dataset.priChoreo = String(item.order);
      element.style.opacity = String(reveal <= 0 ? 0 : Math.max(0.04, reveal));

      const tag = element.tagName.toLowerCase();
      if (['circle', 'ellipse', 'rect'].includes(tag)) {
        element.style.transform = `scale(${0.72 + reveal * 0.28})`;
      } else {
        element.style.transform = '';
      }

      if (tag === 'text') return;
      if (typeof element.getTotalLength !== 'function' || !hasDrawableStroke(element)) return;
      let length = 0;
      try { length = element.getTotalLength(); } catch { length = 0; }
      if (!Number.isFinite(length) || length <= 0) return;
      element.style.strokeDasharray = `${length}`;
      element.style.strokeDashoffset = `${length * (1 - reveal)}`;
    });
  }, [figure, mode, p, ready]);

  if (!figure) return null;
  return (
    <div className={`pri-v-figure pri-v-figure-v6 ${mode} pri-v-choreographed`} data-phase={phase}>
      <div className="pri-v-caption">
        <span>{mode === 'calculus' ? 'Dynamic calculus view' : mode === 'geometry' ? 'Dynamic geometry view' : mode === 'statistics' ? 'Dynamic data view' : 'Dynamic graph view'}</span>
        <b>{phase === 'constructing' ? 'building the setup in teaching order' : phase === 'developing' ? 'adding the next verified structure' : 'construction complete'}</b>
      </div>
      {ready
        ? <div ref={figureRef} className="pri-v-figure-inner" dangerouslySetInnerHTML={{ __html: figure }} />
        : <div className="pri-v-figure-placeholder" aria-hidden="true"><i /><i /><i /></div>}
      <div className="pri-v-figure-sequence" aria-label="Figure construction order">
        {sequence.map((label, index) => <span key={label} className={index === activeSequence ? 'active' : ''}>{label}</span>)}
      </div>
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
