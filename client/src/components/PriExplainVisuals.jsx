import React, { useMemo } from 'react';
import { MathText } from '../lib/latex.jsx';
import { sanitizeFigure } from '../lib/sanitize.js';

function operationLabel(before, after) {
  const a = String(before || '').toLowerCase(), b = String(after || '').toLowerCase();
  if (/\\frac|\//.test(b) && !/\\frac|\//.test(a)) return 'divide through';
  if (/\([^)]*\)\([^)]*\)/.test(b) && !/\([^)]*\)\([^)]*\)/.test(a)) return 'factorise';
  if (/\\sqrt/.test(b) && !/\\sqrt/.test(a)) return 'take the square root';
  if ((b.match(/=/g) || []).length && a !== b) return 'preserve equality';
  if (b.length < a.length) return 'simplify';
  return 'transform';
}

function TokenStrip({ tokens, label }) {
  if (!tokens?.length) return null;
  return (
    <div className="pri-v-tokenstrip" aria-label={label}>
      {tokens.map((token, index) => (
        <span key={`${index}-${token.text}`} className={token.changed ? 'changed' : 'same'}>{token.text}</span>
      ))}
    </div>
  );
}

export function EquationTransform({ visual }) {
  if (!visual?.before || !visual?.after) return null;
  return (
    <div className="pri-v-transform" aria-label={`Equation transformation: ${visual.before} to ${visual.after}`}>
      <div className="pri-v-transform-math before"><MathText text={`$${visual.before}$`} /></div>
      <TokenStrip tokens={visual.diff?.before} label="Terms before the transformation" />
      <div className="pri-v-transform-arrow" aria-hidden="true">
        <i />
        <span>{operationLabel(visual.before, visual.after)}</span>
        <b>↓</b>
      </div>
      <TokenStrip tokens={visual.diff?.after} label="Terms after the transformation" />
      <div className="pri-v-transform-math after"><MathText text={`$${visual.after}$`} /></div>
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

export function InkReplay({ visual }) {
  const geometry = useMemo(() => inkGeometry(visual?.attempt), [visual]);
  const attempt = visual?.attempt;
  if (!attempt || !geometry.strokes.length) return null;
  const b = geometry.box;
  return (
    <div className="pri-v-ink">
      <div className="pri-v-caption"><span>Your actual working</span><b>replayed stroke by stroke</b></div>
      <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} role="img" aria-label="Replay of your submitted handwriting">
        {geometry.strokes.map((stroke, index) => (
          <path
            key={index}
            d={pathOf(stroke.points)}
            pathLength="1"
            className={stroke.tone === 'scribble' ? 'scribble' : 'ink'}
            style={{ '--stroke-delay': `${Math.min(index * 85, 1800)}ms` }}
          />
        ))}
      </svg>
      {attempt.working && <div className="pri-v-recognized"><span>Pri read</span><MathText text={attempt.working} /></div>}
    </div>
  );
}

export function AttemptReplay({ visual }) {
  const attempt = visual?.attempt;
  if (!attempt) return null;
  return (
    <div className="pri-v-attempt">
      <span>Your submitted working</span>
      {attempt.working && <MathText text={attempt.working} />}
      {!attempt.working && attempt.answer && <MathText text={attempt.answer} />}
    </div>
  );
}

export function AnimatedFigure({ visual }) {
  // Keep the sanitised value named `figure`: the independent security gate
  // inventories every raw-markup sink and only accepts figure-provenance sinks.
  const figure = useMemo(() => sanitizeFigure(visual?.figure), [visual?.figure]);
  if (!figure) return null;
  return (
    <div className={`pri-v-figure ${visual.mode || 'figure'}`}>
      <div className="pri-v-caption">
        <span>{visual.mode === 'calculus' ? 'Dynamic calculus view' : visual.mode === 'geometry' ? 'Dynamic geometry view' : 'Dynamic graph view'}</span>
        <b>{visual.mode === 'calculus' ? 'region + boundary build' : visual.mode === 'geometry' ? 'construction order' : 'drawn from axes outward'}</b>
      </div>
      <div className="pri-v-figure-inner" dangerouslySetInnerHTML={{ __html: figure }} />
    </div>
  );
}

export function VisualBlock({ visual }) {
  if (!visual) return null;
  if (visual.kind === 'transform') return <EquationTransform visual={visual} />;
  if (visual.kind === 'ink') return <InkReplay visual={visual} />;
  if (visual.kind === 'attempt') return <AttemptReplay visual={visual} />;
  if (visual.kind === 'figure') return <AnimatedFigure visual={visual} />;
  return null;
}
