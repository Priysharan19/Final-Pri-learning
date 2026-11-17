// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "See why it's wrong"
//
// The first break Step Check found, drawn as two graphs: the line before and
// the student's line. Where a step is right the two curves are one curve; where
// it is wrong they part, and the marker sits on a value of x where anyone can
// check the difference by substitution (engine/mistakeView.js).
//
// FEEDBACK ONLY. This reads the two lines the server's step report already
// shows and nothing else: no hidden answer, no mark, no receipt. It cannot
// change a verdict, a mark or credit, and it renders nothing at all when the
// engine cannot show the step honestly.
//
// It is its own lazy chunk (QuestionCard imports it with React.lazy), so the
// first-visit bundle does not carry the plotting code. It starts closed — one
// more panel of feedback is a cost as well as a help — and it has no animation,
// so it is the same with reduced motion as without.
//
// The two curves are told apart by dash pattern AND by name, never by colour
// alone. The edition accent is not used: the editions decision keeps it off
// charts and plots (docs/brand/editions-decision.md).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { mistakeView, liveValues, formatValue } from '../engine/mistakeView.js';
import { curvePaths, projector, ticksFor, tickStep } from '../engine/plot.js';
import { useT } from '../i18n/index.js';
import './MistakeGraph.css';

const W = 600;
const H = 300;
const BOX = { width: W, height: H, pad: { left: 44, right: 14, top: 14, bottom: 26 } };
/** The two strokes: the line before is solid, the student's line is dashed. */
export const DASH = { before: null, yours: '9 6' };

function Swatch({ which }) {
  return (
    <svg className={`mg-swatch mg-${which}`} width="30" height="10" viewBox="0 0 30 10" aria-hidden="true" focusable="false">
      <line x1="1" y1="5" x2="29" y2="5" strokeDasharray={DASH[which] || undefined} />
    </svg>
  );
}

/**
 * The graph alone, given a view from mistakeView(). Exported so the render check
 * can draw it open without a click.
 */
export function MistakeGraphView({ view }) {
  const t = useT();
  const clip = useId().replace(/:/g, '');
  const { window: win, point } = view;
  const project = useMemo(() => projector(win, BOX), [win]);
  const curves = useMemo(() => ({
    before: curvePaths(view.before.at, win, project).paths,
    yours: curvePaths(view.yours.at, win, project).paths
  }), [view, win, project]);
  const xTicks = useMemo(() => ticksFor(win.xMin, win.xMax, 10), [win]);
  const yTicks = useMemo(() => ticksFor(win.yMin, win.yMax, 6), [win]);
  const step = useMemo(() => tickStep(win.xMax - win.xMin, 40), [win]);

  const [x, setX] = useState(point.x);
  // What the live region says. It follows a key press or the end of a drag,
  // not every pointer move, so a screen reader hears a value, not a stream.
  const [spokenX, setSpokenX] = useState(point.x);
  const plotRef = useRef(null);
  const dragging = useRef(false);

  const clampX = v => Math.min(win.xMax, Math.max(win.xMin, v));
  const snap = v => clampX(Math.round(v / step) * step);
  const fromPointer = useCallback(e => {
    const el = plotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const inner = W - BOX.pad.left - BOX.pad.right;
    setX(snap(win.xMin + ((px - BOX.pad.left) / inner) * (win.xMax - win.xMin)));
  }, [win, step]);

  const onKeyDown = e => {
    const moves = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
    let next = null;
    if (e.key in moves) next = snap(x + moves[e.key]);
    else if (e.key === 'Home') next = win.xMin;
    else if (e.key === 'End') next = win.xMax;
    if (next === null) return;
    e.preventDefault();
    setX(next);
    setSpokenX(next);
  };
  const endDrag = () => { if (dragging.current) { dragging.current = false; setSpokenX(x); } };
  const reset = () => { setX(point.x); setSpokenX(point.x); };

  const vars = { variable: view.symbol, x: formatValue(point.x) };
  const live = liveValues(view, spokenX);
  const liveText = t(live.key, live.vars);
  const b = view.before.at(x);
  const y = view.yours.at(x);
  const inY = v => Number.isFinite(v) && v >= win.yMin && v <= win.yMax;
  const X0 = project.x(0);
  const Y0 = project.y(0);
  const top = BOX.pad.top;
  const bottom = H - BOX.pad.bottom;
  const left = BOX.pad.left;
  const right = W - BOX.pad.right;
  const mx = project.x(x);
  // Tick labels go beside the axes, clamped inside the frame so none is cut off,
  // and a label that would sit on the other axis is skipped rather than overlap it.
  const xLabelY = Math.min(H - 8, Math.max(top + 12, Y0 + 16));
  const yLabelX = Math.min(right - 4, Math.max(left - 6, X0 - 6));

  return (
    <div className="mg-body" role="group" aria-label={t('mistake.graph.figure')}>
      <p className="mg-say" data-mistake-say>{t(view.message.key, view.message.vars)}</p>
      {view.kind === 'equation' && <p className="mg-note">{t('mistake.graph.equationNote')}</p>}
      {view.rhs && <p className="mg-note">{t('mistake.graph.rhsNote')}</p>}
      <div className="mg-plot" ref={plotRef} role="slider" tabIndex={0}
        aria-label={t('mistake.graph.marker', { variable: view.symbol })}
        aria-valuemin={win.xMin} aria-valuemax={win.xMax} aria-valuenow={Number(x.toFixed(6))}
        aria-valuetext={t('mistake.graph.at', { variable: view.symbol, x: formatValue(x) ?? '' })} aria-describedby={`${clip}-how`}
        data-mistake-marker={formatValue(x)}
        onKeyDown={onKeyDown}
        onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(e); }}
        onPointerMove={e => { if (dragging.current) fromPointer(e); }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={`${clip}-c`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
          </defs>
          <g className="mg-grid">
            {xTicks.map(v => <line key={`gx${v}`} x1={project.x(v)} x2={project.x(v)} y1={top} y2={bottom} />)}
            {yTicks.map(v => <line key={`gy${v}`} x1={left} x2={right} y1={project.y(v)} y2={project.y(v)} />)}
          </g>
          <g className="mg-axes">
            <line x1={left} x2={right} y1={Y0} y2={Y0} />
            <line x1={X0} x2={X0} y1={top} y2={bottom} />
          </g>
          <g clipPath={`url(#${clip}-c)`}>
            {curves.before.map((p, i) => <path key={`b${i}`} className="mg-curve mg-before" d={p.d} data-curve="before" />)}
            {curves.yours.map((p, i) => <path key={`y${i}`} className="mg-curve mg-yours" d={p.d} strokeDasharray={DASH.yours} data-curve="yours" />)}
            <line className="mg-marker" x1={mx} x2={mx} y1={top} y2={bottom} />
            {inY(b) && inY(y) && <line className="mg-gap" x1={mx} x2={mx} y1={project.y(b)} y2={project.y(y)} />}
            {inY(b) && <circle className="mg-dot mg-before" cx={mx} cy={project.y(b)} r="5" />}
            {inY(y) && <rect className="mg-dot mg-yours" x={mx - 4.5} y={project.y(y) - 4.5} width="9" height="9" />}
          </g>
          {/* Labels after the curves, each on a paper halo, so a curve never runs through one. */}
          <g className="mg-axes">
            {xTicks.filter(v => v !== 0).map(v => <text key={`tx${v}`} x={project.x(v)} y={xLabelY} textAnchor="middle">{formatValue(v)}</text>)}
            {yTicks.filter(v => v !== 0).map(v => <text key={`ty${v}`} x={yLabelX} y={project.y(v) + 4} textAnchor="end">{formatValue(v)}</text>)}
            <text x={Math.max(left + 10, X0 - 6)} y={Math.min(bottom - 4, Y0 + 16)} textAnchor="end">0</text>
          </g>
          <path className="mg-handle" d={`M${mx - 7} ${bottom + 9} L${mx} ${bottom + 1} L${mx + 7} ${bottom + 9} Z`} />
        </svg>
      </div>
      <div className="mg-read" data-mistake-readout>
        <div className="mg-read-at">{t('mistake.graph.at', { variable: view.symbol, x: formatValue(x) })}</div>
        <div className="mg-read-row" data-row="yours">
          <Swatch which="yours" /><span className="mg-read-name">{t('mistake.graph.yours')}</span>
          <span className="mg-read-line">{view.yours.text}</span>
          <b className="mg-read-v">{Number.isFinite(y) ? formatValue(y) : '—'}</b>
        </div>
        <div className="mg-read-row" data-row="before">
          <Swatch which="before" /><span className="mg-read-name">{t('mistake.graph.before')}</span>
          <span className="mg-read-line">{view.before.text}</span>
          <b className="mg-read-v">{Number.isFinite(b) ? formatValue(b) : '—'}</b>
        </div>
      </div>
      <p className="mg-live" aria-live="polite" data-mistake-live>{liveText}</p>
      <p className="mg-how" id={`${clip}-how`}>{t('mistake.graph.howTo', vars)}</p>
      {x !== point.x && <button type="button" className="btn btn-quiet mg-reset" onClick={reset} data-mistake-reset>{t('mistake.graph.reset', vars)}</button>}
      <p className="mg-how">{t('mistake.graph.feedbackOnly')}</p>
    </div>
  );
}

/**
 * Whatever goes wrong inside the graph stays inside it: the verdict, the step
 * report and the diagnosis around it are the server's and must still render.
 */
class GraphBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* feedback only: nothing to report, nothing to retry */ }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * The disclosure in the diagnosis area. Renders nothing unless the engine can
 * show this step honestly.
 */
export default function MistakeGraph(props) {
  return <GraphBoundary><Disclosure {...props} /></GraphBoundary>;
}

function Disclosure({ prevText, brokenText }) {
  const t = useT();
  const view = useMemo(() => mistakeView({ prevText, brokenText }), [prevText, brokenText]);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (!view) return null;
  return (
    <div className="mistake-graph" data-mistake-graph={view.kind}>
      <button type="button" className="btn btn-quiet mg-toggle" aria-expanded={open} aria-controls={bodyId}
        onClick={() => setOpen(o => !o)} data-mistake-toggle>
        {t(open ? 'mistake.graph.close' : 'mistake.graph.open')}
      </button>
      <div id={bodyId} hidden={!open}>{open && <MistakeGraphView view={view} />}</div>
    </div>
  );
}
