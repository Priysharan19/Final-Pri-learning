// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit: interactive variants (Notes only)
//
// Interaction is for teaching, never decoration: each of these lets a student
// change ONE thing and watch what it does to the picture and to the numbers that
// go with it. Every control is a native range input (arrow keys, Home/End and
// Page keys work, and screen readers announce a name, a value and a range) or a
// real button; the draggable unit-circle point is a slider as well (arrow keys
// move it, Shift for larger steps). Every change is announced in a polite live
// region with the same numbers the picture shows. Motion is a short transition
// only, and is switched off by prefers-reduced-motion (diagrams.css). Colours are
// the Instrument's tokens, so light and dark follow the theme.
// Interactive diagrams are NOT used in questions: a question's figure is static.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import './diagrams.css';
import { FunctionGraph, UnitCircle, SecantTangent, RiemannRectangles, NormalCurve, CompoundGrowth, Tex } from './Diagram.jsx';
import { unitCirclePoint, secantTangentModel, riemannModel, normalCurveModel, compoundModel, r3 } from './geometry.js';

/** A labelled range input with its current value; arrow keys, Home/End and Page keys are the browser's own. */
export function Slider({ label, min, max, step, value, onChange, format = v => String(v), name }) {
  const id = useId();
  return (
    <div className="dgi-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="range" min={min} max={max} step={step} value={value}
        aria-valuetext={format(value)} onChange={e => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{format(value)}</output>
    </div>
  );
}

function Shell({ title, children, controls, readout, className = '' }) {
  const id = useId();
  return (
    <section className={`dgi ${className}`} aria-labelledby={`${id}-h`} data-diagram-interactive>
      <h4 className="dgi-title" id={`${id}-h`}>{title}</h4>
      {children}
      <div className="dgi-controls">{controls}</div>
      <p className="dgi-readout" role="status" aria-live="polite"><MathText text={readout} /></p>
    </section>
  );
}

// ── Transformations: y = a·f(b(x − h)) + k ───────────────────────────────────
const BASES = {
  linear: { expr: 'x', name: 'x', xmin: -6, xmax: 6, ymin: -8, ymax: 8 },
  quadratic: { expr: 'x^2', name: 'x^2', xmin: -6, xmax: 6, ymin: -6, ymax: 10 },
  cubic: { expr: 'x^3', name: 'x^3', xmin: -4, xmax: 4, ymin: -8, ymax: 8 },
  abs: { expr: 'abs(x)', name: '|x|', xmin: -6, xmax: 6, ymin: -6, ymax: 8 },
  sin: { expr: 'sin(x)', name: '\\sin x', xmin: -7, xmax: 7, ymin: -4, ymax: 4 },
  exponential: { expr: '2^x', name: '2^x', xmin: -5, xmax: 5, ymin: -4, ymax: 10 }
};
const place = (expr, u) => expr.replace(/\bx\b/g, u);

export function TransformSliders({ base = 'quadratic', title = null, initial = {}, show = ['a', 'b', 'h', 'k'], names = {} }) {
  const B = BASES[base];
  const [a, setA] = useState(initial.a ?? 1);
  const [b, setB] = useState(initial.b ?? 1);
  const [h, setH] = useState(initial.h ?? 0);
  const [k, setK] = useState(initial.k ?? 0);
  const expr = useMemo(() => `(${a})*(${place(B.expr, `((${b})*(x-(${h})))`)})+(${k})`, [B, a, b, h, k]);
  const coef = a === 1 ? '' : a === -1 ? '-' : `${a}`;
  const bs = b === 1 ? '' : b === -1 ? '-' : `${b}`;
  const shifted = `x${h === 0 ? '' : h > 0 ? `-${h}` : `+${-h}`}`;
  const inner = b === 1 && h === 0 ? 'x' : b === 1 ? shifted : `${bs}(${shifted})`;
  const body = inner === 'x' ? B.name : ({
    quadratic: `\\left(${inner}\\right)^2`, cubic: `\\left(${inner}\\right)^3`, abs: `\\left|${inner}\\right|`,
    sin: `\\sin\\left(${inner}\\right)`, exponential: `2^{${inner}}`
  }[base] || place(B.name, inner));
  const tex = base === 'linear'
    ? `y=${coef}x${k === 0 ? '' : k > 0 ? `+${k}` : k}`
    : `y=${coef}${base === 'exponential' && coef && coef !== '-' ? '\\cdot ' : ''}${body}${k === 0 ? '' : k > 0 ? `+${k}` : k}`;
  const reset = () => { setA(1); setB(1); setH(0); setK(0); };
  const fmt = v => r3(v, 2).toString();
  return (
    <Shell title={title || (base === 'linear' ? 'Change the gradient and the intercept' : `Transform y = ${B.name.replace(/\\/g, '')}`)} readout={base === 'linear' ? `$${tex}$: gradient $${fmt(a)}$ (it rises ${fmt(Math.abs(a))} for each 1 across${a < 0 ? ', falling' : ''}), crossing the y-axis at $${fmt(k)}$.` : `$${tex}$: stretch ${fmt(Math.abs(a))}${a < 0 ? ' and reflect in the x-axis' : ''}; horizontal scale ${b === 0 ? 'none' : fmt(1 / Math.abs(b))}${b < 0 ? ' and reflect in the y-axis' : ''}; shift ${fmt(h)} right and ${fmt(k)} up.`}
      controls={<>
        {show.includes('a') && <Slider label={names.a || 'a (vertical stretch)'} min={-3} max={3} step={0.25} value={a} onChange={setA} format={fmt} />}
        {show.includes('b') && <Slider label={names.b || 'b (horizontal)'} min={-3} max={3} step={0.25} value={b} onChange={setB} format={fmt} />}
        {show.includes('h') && <Slider label={names.h || 'h (shift right)'} min={-5} max={5} step={0.5} value={h} onChange={setH} format={fmt} />}
        {show.includes('k') && <Slider label={names.k || 'k (shift up)'} min={-5} max={5} step={0.5} value={k} onChange={setK} format={fmt} />}
        <div className="dgi-buttons"><button type="button" onClick={reset}>Reset</button></div>
      </>}>
      <FunctionGraph xmin={B.xmin} xmax={B.xmax} ymin={B.ymin} ymax={B.ymax} hideIntercepts title={base === 'linear' ? 'The line y = mx + c' : `Graph of y = ${B.name.replace(/\\/g, '')} and its transformation`}
        curves={[{ expr: B.expr, tone: 'secondary', id: 'base' }, { expr, label: tex, tone: 'primary', id: 'moved' }]} />
    </Shell>
  );
}

// ── Unit circle: drag a point ────────────────────────────────────────────────
export function UnitCircleDrag({ initial = 30, title = 'Drag the point around the unit circle', showTan = true }) {
  const [deg, setDeg] = useState(initial);
  const svgRef = useRef(null);
  const p = unitCirclePoint(deg);
  const set = useCallback(v => setDeg(((Math.round(v) % 360) + 360) % 360), []);
  const fromPointer = e => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = ((e.clientX - r.left) / r.width) * vb.width; const y = ((e.clientY - r.top) / r.height) * vb.height;
    const cx = vb.width / 2; const cy = vb.height / 2;
    set((Math.atan2(cy - y, x - cx) * 180) / Math.PI);
  };
  const onKey = e => {
    const big = e.shiftKey ? 15 : 1;
    const moves = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 15, PageDown: -15 };
    if (e.key in moves) { e.preventDefault(); set(deg + moves[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); set(0); }
    else if (e.key === 'End') { e.preventDefault(); set(359); }
  };
  const readout = `$\\theta=${p.deg}^{\\circ}$: $\\cos\\theta=${p.cos}$, $\\sin\\theta=${p.sin}$, ${p.tan === null ? '$\\tan\\theta$ is undefined' : `$\\tan\\theta=${p.tan}$`}. ${p.quadrant ? `Quadrant ${p.quadrant}; reference angle ${p.reference}°.` : 'On an axis.'}`;
  return (
    <Shell title={title} readout={readout} className="dg-square"
      controls={<>
        <Slider label="Angle θ (degrees)" min={0} max={359} step={1} value={Math.round(p.deg) % 360} onChange={set} format={v => `${v}°`} />
        <div className="dgi-buttons" role="group" aria-label="Common angles">{[0, 30, 45, 60, 90, 120, 150, 180, 270].map(a => <button key={a} type="button" aria-pressed={Math.round(p.deg) === a} onClick={() => set(a)}>{a}°</button>)}</div>
      </>}>
      <UnitCircle deg={deg} showTan={showTan && p.tan !== null} title="The unit circle with a movable point"
        svgProps={{ role: 'group', ref: svgRef, onPointerDown: e => { e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(e); }, onPointerMove: e => { if (e.buttons) fromPointer(e); } }}
        overlay={m => (
          <g className="dgi-handle" role="slider" tabIndex={0} aria-label="Point on the unit circle" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(p.deg) % 360}
            aria-valuetext={`${p.deg} degrees, cosine ${p.cos}, sine ${p.sin}`} onKeyDown={onKey}>
            <circle className="dgi-ring" cx={m.px[0]} cy={m.px[1]} r="11" />
            <circle className="dg-dot is-key" cx={m.px[0]} cy={m.px[1]} r="4" />
          </g>
        )} />
    </Shell>
  );
}

// ── Secant to tangent ────────────────────────────────────────────────────────
const H_STEPS = [2, 1.5, 1, 0.75, 0.5, 0.25, 0.1, 0.05, 0.01, 0.001];
export function SecantToTangent({ expr = 'x^2', x0 = 1, xmin = -1, xmax = 4, ymin = -1, ymax = 10, title = 'Move the secant towards the tangent' }) {
  const [i, setI] = useState(2);
  const h = H_STEPS[i];
  const m = secantTangentModel({ expr, x0, h, xmin, xmax, ymin, ymax });
  return (
    <Shell title={title} readout={`Second point at $x=${r3(x0 + h, 4)}$ ($h=${h}$): secant gradient $${m.secantSlope}$; tangent gradient at $x=${x0}$ is $${m.tangentSlope}$. As $h\\to0$ the secant gradient approaches the tangent's.`}
      controls={<>
        <Slider label="h (distance to the second point)" min={0} max={H_STEPS.length - 1} step={1} value={i} onChange={setI} format={v => `h = ${H_STEPS[v]}`} />
        <div className="dgi-buttons"><button type="button" onClick={() => setI(H_STEPS.length - 1)}>Move to the tangent</button><button type="button" onClick={() => setI(2)}>Reset</button></div>
      </>}>
      <SecantTangent expr={expr} x0={x0} h={h} xmin={xmin} xmax={xmax} ymin={ymin} ymax={ymax} />
    </Shell>
  );
}

// ── Riemann rectangles ───────────────────────────────────────────────────────
export function RiemannSlider({ expr = 'x^2', a = 0, b = 3, initialN = 4, title = 'Add rectangles under the curve' }) {
  const [n, setN] = useState(initialN);
  const [mode, setMode] = useState('left');
  const m = riemannModel({ expr, a, b, n, mode });
  return (
    <Shell title={title} readout={`${n} ${mode}-point rectangles: total area $${r3(m.sum, 2)}$; the area under the curve is $${r3(m.area, 2)}$ (difference $${r3(m.error, 2)}$). More rectangles fit the curve more closely.`}
      controls={<>
        <Slider label="n (number of rectangles)" min={1} max={60} step={1} value={n} onChange={setN} format={v => `n = ${v}`} />
        <div className="dgi-buttons" role="group" aria-label="Where each rectangle meets the curve">{['left', 'mid', 'right'].map(k => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{k === 'mid' ? 'Midpoint' : `${k[0].toUpperCase()}${k.slice(1)} endpoint`}</button>)}</div>
      </>}>
      <RiemannRectangles expr={expr} a={a} b={b} n={n} mode={mode} />
    </Shell>
  );
}

// ── Normal curve: area by z ──────────────────────────────────────────────────
export function NormalAreaByZ({ initial = [-1, 1], title = 'Shade the area between two z-scores' }) {
  const [lo, setLo] = useState(initial[0]);
  const [hi, setHi] = useState(initial[1]);
  const a = Math.min(lo, hi); const bz = Math.max(lo, hi);
  const m = normalCurveModel({ from: a, to: bz, mode: 'z' });
  return (
    <Shell title={title} readout={`$P(${a}\\le Z\\le ${bz})=${m.area}$, which is ${r3(m.area * 100, 2)}% of the distribution. About 68%, 95% and 99.7% lie within 1, 2 and 3 standard deviations of the mean.`}
      controls={<>
        <Slider label="Lower z" min={-3.5} max={3.5} step={0.1} value={lo} onChange={setLo} format={v => `z = ${r3(v, 1)}`} />
        <Slider label="Upper z" min={-3.5} max={3.5} step={0.1} value={hi} onChange={setHi} format={v => `z = ${r3(v, 1)}`} />
        <div className="dgi-buttons" role="group" aria-label="Within k standard deviations">{[1, 2, 3].map(k => <button key={k} type="button" aria-pressed={a === -k && bz === k} onClick={() => { setLo(-k); setHi(k); }}>±{k} SD</button>)}</div>
      </>}>
      <NormalCurve from={a} to={bz} mode="z" />
    </Shell>
  );
}

// ── Compound interest ────────────────────────────────────────────────────────
export function CompoundInterestExplorer({ principal = 1000, initialRate = 5, initialYears = 10, title = 'Compound interest by rate and time' }) {
  const [rate, setRate] = useState(initialRate);
  const [years, setYears] = useState(initialYears);
  const [perYear, setPerYear] = useState(1);
  const m = compoundModel({ principal, rate: rate / 100, years, perYear });
  return (
    <Shell title={title} readout={`$\\$${principal}$ at $${rate}\\%$ per year, compounded ${perYear === 1 ? 'yearly' : `${perYear} times a year`}, grows to $\\$${m.final}$ in ${years} ${years === 1 ? 'year' : 'years'}: interest $\\$${m.interest}$ (simple interest would give $\\$${m.simpleFinal}$).`}
      controls={<>
        <Slider label="Rate (% per year)" min={0} max={15} step={0.5} value={rate} onChange={setRate} format={v => `${v}%`} />
        <Slider label="Time (years)" min={1} max={30} step={1} value={years} onChange={setYears} format={v => `${v} ${v === 1 ? 'year' : 'years'}`} />
        <div className="dgi-buttons" role="group" aria-label="Compounding periods per year">{[[1, 'Yearly'], [2, 'Half-yearly'], [4, 'Quarterly'], [12, 'Monthly']].map(([v, l]) => <button key={v} type="button" aria-pressed={perYear === v} onClick={() => setPerYear(v)}>{l}</button>)}</div>
      </>}>
      <CompoundGrowth principal={principal} rate={rate / 100} years={years} perYear={perYear} />
    </Shell>
  );
}

export { Tex };
