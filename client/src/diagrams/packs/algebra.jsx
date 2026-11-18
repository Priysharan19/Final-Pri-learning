// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "algebra": the components. Kinds, specs, models and
// words: ./algebra.kinds.js (docs/design/notes-e3-contract.md §2).
//
// Each static kind is one accessible <figure> (Figure from Diagram.jsx) whose text
// alternative is composed from the same model as the picture; each interactive kind
// is a titled section with native range inputs and real buttons, a polite live
// region stating the new numbers, and the static figure inside. Labels are KaTeX
// (Tex). Colours are Instrument tokens (diagrams.css, algebra.css). Words come from
// TEXT through useKitText, in English (en-AU) or Hindi.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useMemo, useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import { Figure, Tex, Defs } from '../Diagram.jsx';
import { Slider } from '../Interactive.jsx';
import { useKitText } from '../kitText.js';
import { r3 } from '../geometry.js';
import '../diagrams.css';
import './algebra.css';
import * as K from './algebra.kinds.js';

const poly = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const specKey = spec => JSON.stringify(spec);

function Shell({ title, children, controls, readout, className = '' }) {
  const id = useId();
  return (
    <section className={`dgi dga ${className}`} aria-labelledby={`${id}-h`} data-diagram-interactive>
      <h4 className="dgi-title" id={`${id}-h`}>{title}</h4>
      {children}
      <div className="dgi-controls">{controls}</div>
      <p className="dgi-readout" role="status" aria-live="polite"><MathText text={readout} /></p>
    </section>
  );
}

/** Grid, axes through the true origin (on the frame's edge when 0 is out of view) and tick labels. */
function PlotAxes({ m, xLabel = 'x', yLabel = 'y', grid = true }) {
  const f = m.frame;
  return (
    <g className="dg-axes">
      {grid && m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
      {grid && m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
      <line className="dg-axis" x1={f.left} x2={f.right} y1={m.axisY} y2={m.axisY} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={m.axisX} x2={m.axisX} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" />
      {m.xTicks.filter(t => t.value !== 0).map(t => <Tex key={`lx${t.value}`} x={t.px} y={m.axisY + 14} tex={String(t.value)} w={K.texWidth(String(t.value))} h={18} className="dg-small" />)}
      {m.yTicks.filter(t => t.value !== 0).map(t => <Tex key={`ly${t.value}`} x={m.axisX - 6} y={t.px} tex={String(t.value)} w={K.texWidth(String(t.value))} h={18} anchor="end" className="dg-small" />)}
      {xLabel && <Tex data-axis-name="x" x={f.right + 5} y={m.axisY - 4} tex={xLabel} w={14} h={14} anchor="start" />}
      {yLabel && <Tex data-axis-name="y" x={m.axisX + 8} y={f.top - 8} tex={yLabel} w={14} h={14} anchor="start" />}
    </g>
  );
}

const Labels = ({ labels, className = '' }) => labels.map((l, i) => (
  <Tex key={`lab${i}`} x={l.x} y={l.y} tex={l.tex} w={l.w} h={l.h} anchor={l.anchor} className={`${className} ${l.small ? 'dg-small' : ''} ${l.optimal ? 'is-mark' : ''}`.trim()} />
));

// ═════════════════════════════════════════════════════════════════════════════
// paramGraph (interactive) and paramFunction (static)
// ═════════════════════════════════════════════════════════════════════════════
function ParamFigure({ m, title, description, caption = null }) {
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={description} caption={caption}>
      <Defs />
      <PlotAxes m={m} />
      {m.vLines.map(a => <line key={`va${a.x}`} className="dg-asymptote" x1={a.px[0][0]} y1={a.px[0][1]} x2={a.px[1][0]} y2={a.px[1][1]} />)}
      {m.hLines.map(a => <line key={`ha${a.y}`} className="dg-asymptote" x1={a.px[0][0]} y1={a.px[0][1]} x2={a.px[1][0]} y2={a.px[1][1]} />)}
      {m.fixed.map(c => c.segments.map((seg, k) => <path key={`${c.id}-${k}`} className="dg-curve is-secondary" d={poly(seg)} />))}
      {m.fixed.map(c => c.place && <Tex key={`fl${c.id}`} className="dg-ref-label" x={c.place.x} y={c.place.y} tex={c.label} w={c.place.w} h={c.place.h} anchor={c.place.anchor} />)}
      {m.segments.map((seg, k) => <path key={`c${k}`} className="dg-curve is-primary" d={poly(seg)} />)}
      {m.points.map((p, i) => <circle key={`p${i}`} className={`dg-dot${p.kinds.includes('min') || p.kinds.includes('max') ? ' is-key' : ''}`} cx={p.px[0]} cy={p.px[1]} r="4.5" />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}

export function ParamFunction({ title = null, caption, ...spec }) {
  const tk = useKitText(K.TEXT);
  const m = useMemo(() => K.paramGraphModel(spec), [specKey(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ParamFigure m={m} title={title || tk('pg.staticTitle')} description={K.paramGraphWords(m, tk, 'plain')} caption={caption === undefined ? `$y=${m.equation.tex.replace(/\\frac/g, '\\dfrac')}$` : caption} />;
}

export function ParamGraph({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const [vals, setVals] = useState(() => K.paramValues(spec));
  const key = specKey(spec);
  const m = useMemo(() => K.paramGraphModel(spec, vals), [key, vals]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmtV = v => K.fmt(v);
  return (
    <Shell title={title || tk('pg.title')} readout={K.paramGraphWords(m, tk, 'tex')}
      controls={<>
        {(spec.params || []).map(q => (
          <Slider key={q.name} name={q.name} label={<MathText text={q.label || tk('pg.slider', { name: `$${q.name}$` })} />}
            min={q.min} max={q.max} step={q.step} value={vals[q.name]} format={fmtV}
            onChange={v => setVals(s => ({ ...s, [q.name]: v }))} />
        ))}
        <div className="dgi-buttons"><button type="button" onClick={() => setVals(K.paramValues(spec))}>{tk('reset')}</button></div>
      </>}>
      <ParamFigure m={m} title={title || tk('pg.staticTitle')} description={K.paramGraphWords(m, tk, 'plain')} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// sequenceExplorer (its static counterpart is the core `sequence`)
// ═════════════════════════════════════════════════════════════════════════════
function SequenceFigure({ m, title, description }) {
  const f = m.frame;
  const legendY = f.top - 16;
  return (
    <Figure width={f.width} height={f.height} title={title} description={description}>
      <Defs />
      <g className="dg-axes">
        {m.yTicks.map(t => <g key={`y${t.value}`}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={K.numTex(t.value)} w={K.texWidth(K.numTex(t.value))} h={18} anchor="end" className="dg-small" /></g>)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={m.zero} y2={m.zero} markerEnd="url(#dg-arrow)" />
        <line className="dg-axis" x1={f.left} x2={f.left} y1={f.bottom} y2={f.top} />
        {m.xTicks.map(t => <Tex key={`x${t.value}`} x={t.px} y={f.bottom + 14} tex={String(t.value)} w={K.texWidth(String(t.value))} h={18} className="dg-small" />)}
        <Tex x={f.right - 2} y={f.bottom + 14} tex="k" w={16} h={18} anchor="end" />
      </g>
      {m.bars.map(b => <rect key={`b${b.k}`} className="dg-bar" x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 0.5)} />)}
      {m.limitPx && <g><line className="dga-limit" x1={m.limitPx[0][0]} y1={m.limitPx[0][1]} x2={m.limitPx[1][0]} y2={m.limitPx[1][1]} /><Tex x={f.right - 4} y={m.limitPx[0][1] + (m.limitPx[0][1] - f.top < 22 ? 12 : -12)} tex={`S_\\infty=${K.numTex(m.limit)}`} w={K.texWidth(`S_\\infty=${K.numTex(m.limit)}`)} h={20} anchor="end" className="dg-small" /></g>}
      <path className="dga-sum" d={poly(m.sumPts.map(p => p.px))} />
      {m.sumPts.map(p => <circle key={`s${p.k}`} className="dga-sumdot" cx={p.px[0]} cy={p.px[1]} r="3.6" />)}
      <g className="dga-legend">
        <rect className="dg-bar" x={f.left + 4} y={legendY - 6} width={12} height={12} />
        <Tex x={f.left + 22} y={legendY} tex="T_k" w={30} h={20} anchor="start" />
        <circle className="dga-sumdot" cx={f.left + 72} cy={legendY} r="3.6" />
        <Tex x={f.left + 82} y={legendY} tex="S_k" w={30} h={20} anchor="start" />
      </g>
    </Figure>
  );
}

export function SequenceExplorer({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const ranges = K.sequenceRanges(spec);
  const start = { first: spec.first, step: spec.step, n: spec.n };
  const [v, setV] = useState(start);
  const geometric = spec.type === 'geometric';
  // A geometric sequence never takes the ratio 0 (the slider skips it).
  const setStep = s => setV(o => ({ ...o, step: geometric && Math.abs(s) < 1e-12 ? (o.step > 0 ? -ranges.step[2] : ranges.step[2]) : r3(s, 6) }));
  const m = useMemo(() => K.sequenceExplorerModel(spec, v), [specKey(spec), v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell title={title || tk('seq.title')} readout={K.sequenceWords(m, tk, 'tex')}
      controls={<>
        <Slider name="first" label={<MathText text={tk('seq.first')} />} min={ranges.first[0]} max={ranges.first[1]} step={ranges.first[2]} value={v.first} format={K.numText} onChange={a => setV(o => ({ ...o, first: geometric && a === 0 ? (o.first > 0 ? -ranges.first[2] : ranges.first[2]) : r3(a, 6) }))} />
        <Slider name="step" label={<MathText text={tk(geometric ? 'seq.r' : 'seq.d')} />} min={ranges.step[0]} max={ranges.step[1]} step={ranges.step[2]} value={v.step} format={K.numText} onChange={setStep} />
        <Slider name="n" label={<MathText text={tk('seq.n')} />} min={ranges.n[0]} max={ranges.n[1]} step={1} value={v.n} onChange={n => setV(o => ({ ...o, n }))} />
        <div className="dgi-buttons"><button type="button" onClick={() => setV(start)}>{tk('reset')}</button></div>
      </>}>
      <SequenceFigure m={m} title={title || tk('seq.title')} description={K.sequenceWords(m, tk, 'plain')} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// slopeField (static) and slopeFieldExplorer (interactive)
// ═════════════════════════════════════════════════════════════════════════════
function SlopeFigure({ m, title, description, caption = null, svgProps = {} }) {
  const labels = useMemo(() => K.placeLabels(m.curves.map(c => ({ px: [m.frame.sx(c.x0), m.frame.sy(c.y0)], tex: `(${K.fmt(c.x0)},\\,${K.fmt(c.y0)})` })), {
    width: m.frame.width, height: m.frame.height, obstacles: K.tickBoxes(m), ink: m.curves.flatMap(c => c.px.filter((_, i) => i % 4 === 0)), dots: m.curves.map(c => [m.frame.sx(c.x0), m.frame.sy(c.y0)])
  }), [m]);
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={description} caption={caption} svgProps={svgProps}>
      <Defs />
      <PlotAxes m={m} grid={false} />
      {m.marks.map((s, i) => <line key={`m${i}`} className="dga-slope" x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} />)}
      {m.curves.map((c, i) => <path key={`c${i}`} className="dg-curve is-primary" d={poly(c.px)} />)}
      {m.curves.map((c, i) => <circle key={`d${i}`} className="dg-dot is-key" cx={m.frame.sx(c.x0)} cy={m.frame.sy(c.y0)} r="5" />)}
      <Labels labels={labels} />
    </Figure>
  );
}

export function SlopeField({ title = null, caption, ...spec }) {
  const tk = useKitText(K.TEXT);
  const m = useMemo(() => K.slopeFieldModel(spec), [specKey(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SlopeFigure m={m} title={title || tk('sf.staticTitle')} description={K.slopeFieldWords(m, tk, 'plain')} caption={caption === undefined ? `$\\dfrac{dy}{dx}=${m.equation.tex}$` : caption} />;
}

/** The slider step for a coordinate: the coarsest of 1, 0.5, 0.25, 0.2, 0.1, 0.05 that lands on `v`, with at most 240 stops. */
function coordStep(lo, hi, v) {
  for (const s of [1, 0.5, 0.25, 0.2, 0.1, 0.05]) { const k = (v - lo) / s; if ((hi - lo) / s <= 240 && Math.abs(k - Math.round(k)) < 1e-9 && (hi - lo) / s >= 8) return s; }
  return 0.05;
}

export function SlopeFieldExplorer({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const p0 = spec.through?.[0] || [Math.min(spec.xmax, Math.max(spec.xmin, 0)), Math.min(spec.ymax, Math.max(spec.ymin, 0))];
  const sx = coordStep(spec.xmin, spec.xmax, p0[0]); const sy = coordStep(spec.ymin, spec.ymax, p0[1]);
  const [pt, setPt] = useState(p0);
  const m = useMemo(() => K.slopeFieldModel(spec, pt), [specKey(spec), pt]); // eslint-disable-line react-hooks/exhaustive-deps
  const snapTo = (v, lo, hi, s) => r3(Math.min(hi, Math.max(lo, lo + Math.round((v - lo) / s) * s)), 6);
  const fromPointer = e => {
    const svg = e.currentTarget; const r = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal;
    const px = ((e.clientX - r.left) / r.width) * vb.width; const py = ((e.clientY - r.top) / r.height) * vb.height;
    if (px < m.frame.left - 4 || px > m.frame.right + 4 || py < m.frame.top - 4 || py > m.frame.bottom + 4) return;
    setPt([snapTo(m.frame.ix(px), spec.xmin, spec.xmax, sx), snapTo(m.frame.iy(py), spec.ymin, spec.ymax, sy)]);
  };
  return (
    <Shell title={title || tk('sf.title')} readout={K.slopeFieldWords(m, tk, 'tex')}
      controls={<>
        <Slider name="x0" label={<MathText text={tk('sf.x0')} />} min={spec.xmin} max={spec.xmax} step={sx} value={pt[0]} format={K.fmt} onChange={x => setPt(p => [r3(x, 6), p[1]])} />
        <Slider name="y0" label={<MathText text={tk('sf.y0')} />} min={spec.ymin} max={spec.ymax} step={sy} value={pt[1]} format={K.fmt} onChange={y => setPt(p => [p[0], r3(y, 6)])} />
        <div className="dgi-buttons"><button type="button" onClick={() => setPt(p0)}>{tk('reset')}</button></div>
      </>}>
      <SlopeFigure m={m} title={title || tk('sf.staticTitle')} description={K.slopeFieldWords(m, tk, 'plain')}
        svgProps={{ className: 'dg-svg dga-pick', onPointerDown: e => { e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(e); }, onPointerMove: e => { if (e.buttons) fromPointer(e); } }} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// region (static) and lpExplorer (interactive)
// ═════════════════════════════════════════════════════════════════════════════
function RegionFigure({ m, title, description, caption = null }) {
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={description} caption={caption}>
      <Defs />
      {m.shown.length > 2 && <path className="dga-feasible" d={`${poly(m.shown)} Z`} />}
      <PlotAxes m={m} />
      {m.lines.filter(l => l.px).map(l => <line key={`l${l.i}`} className={`dga-boundary${l.strict ? ' is-strict' : ''}`} x1={l.px[0][0]} y1={l.px[0][1]} x2={l.px[1][0]} y2={l.px[1][1]} />)}
      {m.levelLine?.px && <line className="dga-level" x1={m.levelLine.px[0][0]} y1={m.levelLine.px[0][1]} x2={m.levelLine.px[1][0]} y2={m.levelLine.px[1][1]} />}
      {m.dots.map((d, i) => <circle key={`v${i}`} className={d.open ? 'dg-open' : `dg-dot${d.optimal ? ' is-key' : ''}`} cx={d.px[0]} cy={d.px[1]} r={d.optimal ? 5.5 : 4.5} />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}

export function Region({ title = null, caption = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const m = useMemo(() => K.regionModel(spec), [specKey(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <RegionFigure m={m} title={title || tk('rg.staticTitle')} description={K.regionWords(m, tk, 'plain')} caption={caption} />;
}

export function LpExplorer({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const base = useMemo(() => K.regionModel(spec), [specKey(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  const stops = useMemo(() => K.levelStops(base), [base]);
  const optIndex = base.opt && !base.opt.unbounded ? stops.findIndex(v => Math.abs(v - K.qnum(base.opt.value)) < 1e-9) : -1;
  const startIndex = stops.length ? (base.opt?.goal === 'min' ? stops.length - 1 : 0) : 0;
  const [i, setI] = useState(startIndex);
  const k = stops[Math.min(i, stops.length - 1)] ?? 0;
  const m = useMemo(() => K.regionModel(spec, { level: k }), [specKey(spec), k]); // eslint-disable-line react-hooks/exhaustive-deps
  const atOpt = i === optIndex;
  const readout = [K.levelWords(m, k, tk, 'tex'), atOpt ? K.optimumWords(m, tk, 'tex') : ''].filter(Boolean).join(' ');
  const form = base.opt?.form;
  return (
    <Shell title={title || tk('rg.title')} readout={readout}
      controls={stops.length > 0 && <>
        <Slider name="k" label={<MathText text={tk('lp.k')} />} min={0} max={stops.length - 1} step={1} value={i} onChange={setI}
          format={j => `${form ? form.text : 'k'} = ${K.numText(stops[j])}`} />
        <div className="dgi-buttons">
          {optIndex >= 0 && <button type="button" aria-pressed={atOpt} onClick={() => setI(optIndex)}>{tk('lp.toOpt')}</button>}
          <button type="button" onClick={() => setI(startIndex)}>{tk('reset')}</button>
        </div>
      </>}>
      <RegionFigure m={m} title={title || tk('rg.staticTitle')} description={K.regionWords(m, tk, 'plain')} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// numberLineJumps (static) and numberLineStepper (interactive)
// ═════════════════════════════════════════════════════════════════════════════
function JumpsFigure({ m, title, description, shown = null }) {
  const f = m.frame; const k = shown === null ? m.count : shown;
  const at = k === 0 ? m.start : m.jumps[k - 1].to;
  const sizeW = K.texWidth(m.sizeTex);
  const roomy = m.arcs.every(a => Math.abs(a.x2 - a.x1) >= sizeW + 2);
  return (
    <Figure width={f.width} height={f.height} title={title} description={description}>
      <Defs />
      <line className="dg-axis" x1={f.left - 10} x2={f.right + 10} y1={m.y} y2={m.y} markerStart="url(#dg-arrow)" markerEnd="url(#dg-arrow)" />
      {m.ticks.map((t, i) => <g key={`t${i}`}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.y - (t.major ? 7 : 4)} y2={m.y + (t.major ? 7 : 4)} />{t.label && <Tex x={t.px} y={m.y + 22} tex={t.label} w={K.texWidth(t.label)} h={24} className="dg-small" />}</g>)}
      {m.arcs.slice(0, k).map(a => <path key={`a${a.i}`} className="dga-jump" d={a.d} markerEnd="url(#dg-arrow-s)" />)}
      {m.showSize && roomy && m.arcs.slice(0, k).map(a => <Tex key={`s${a.i}`} x={a.mid[0]} y={a.mid[1]} tex={m.sizeTex} w={sizeW} h={20} className="dg-small" />)}
      <circle className="dg-dot" cx={m.startPx} cy={m.y} r="4.5" />
      <circle className="dg-dot is-key" cx={f.sx(K.qnum(at))} cy={m.y} r="5.5" />
    </Figure>
  );
}

export function NumberLineJumps({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const m = useMemo(() => K.numberLineModel(spec), [specKey(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <JumpsFigure m={m} title={title || tk('nl.staticTitle')} description={K.numberLineWords(m, tk, 'plain')} />;
}

export function NumberLineStepper({ title = null, ...spec }) {
  const tk = useKitText(K.TEXT);
  const unit = spec.fractions ? 1 / spec.fractions : spec.step || 1;
  const toIdx = v => Math.round(K.qnum(K.toQ(v)) / unit);
  const fromIdx = j => (spec.fractions ? `${j}/${spec.fractions}` : r3(j * unit, 9));
  const [ab, setAb] = useState({ a: toIdx(spec.a), b: toIdx(spec.b) });
  const [shown, setShown] = useState(0);
  const values = { a: fromIdx(ab.a), b: fromIdx(ab.b) };
  const m = useMemo(() => K.numberLineModel(spec, values), [specKey(spec), ab.a, ab.b]); // eslint-disable-line react-hooks/exhaustive-deps
  const lo = Math.ceil(spec.min / unit - 1e-9); const hi = Math.floor(spec.max / unit + 1e-9);
  const add = spec.op !== 'subtract';
  const bLo = add ? lo - ab.a : ab.a - hi; const bHi = add ? hi - ab.a : ab.a - lo;
  const label = j => K.qText(K.toQ(fromIdx(j)));
  const setA = a => setAb(o => { const nbLo = add ? lo - a : a - hi; const nbHi = add ? hi - a : a - lo; return { a, b: Math.min(nbHi, Math.max(nbLo, o.b)) }; });
  const k = Math.min(shown, m.count);
  return (
    <Shell title={title || tk('nl.title')} readout={K.numberLineWords(m, tk, 'tex', k)}
      controls={<>
        {spec.op !== 'multiply' && <>
          <Slider name="a" label={<MathText text={tk('nl.a')} />} min={lo} max={hi} step={1} value={ab.a} format={label} onChange={j => { setA(j); setShown(0); }} />
          <Slider name="b" label={<MathText text={tk('nl.b')} />} min={bLo} max={bHi} step={1} value={Math.min(bHi, Math.max(bLo, ab.b))} format={label} onChange={j => { setAb(o => ({ ...o, b: j })); setShown(0); }} />
        </>}
        <div className="dgi-buttons">
          <button type="button" onClick={() => setShown(s => Math.min(m.count, s + 1))} disabled={k >= m.count}>{tk('nl.next')}</button>
          <button type="button" onClick={() => setShown(s => Math.max(0, Math.min(m.count, s) - 1))} disabled={k <= 0}>{tk('nl.back')}</button>
          <button type="button" onClick={() => setShown(m.count)} disabled={k >= m.count}>{tk('nl.all')}</button>
          <button type="button" onClick={() => { setAb({ a: toIdx(spec.a), b: toIdx(spec.b) }); setShown(0); }}>{tk('nl.restart')}</button>
        </div>
      </>}>
      <JumpsFigure m={m} title={title || tk('nl.staticTitle')} description={K.numberLineWords(m, tk, 'plain', k)} shown={k} />
    </Shell>
  );
}

export const STATIC_COMPONENTS = Object.freeze({ slopeField: SlopeField, region: Region, paramFunction: ParamFunction, numberLineJumps: NumberLineJumps });
export const INTERACTIVE_COMPONENTS = Object.freeze({ paramGraph: ParamGraph, sequenceExplorer: SequenceExplorer, slopeFieldExplorer: SlopeFieldExplorer, lpExplorer: LpExplorer, numberLineStepper: NumberLineStepper });
