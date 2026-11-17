// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "plane": the components. Kinds, specs and the pure
// geometry are in ./plane.kinds.js; everything a label or a description says is
// computed there, so the picture and its words come from the same numbers.
//
// Static: plane, parallelLines, areaModel, fractionBar. Interactive (Notes only):
// parallelLinesExplorer, triangleExplorer, circleExplorer. Each interactive kind is a
// titled section with native range inputs (arrow, Page and Home/End keys), a reset
// button, and a polite live region that states the same numbers as the picture; the
// circle's moving point is also a keyboard slider and can be dragged. Words come
// through useKitText (English and Hindi); mathematics is KaTeX in every language.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useMemo, useRef, useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import { Figure, Tex, Defs } from '../Diagram.jsx';
import { Slider } from '../Interactive.jsx';
import { useKitText } from '../kitText.js';
import { r3 } from '../geometry.js';
import {
  planeModel, parallelLinesModel, areaModelModel, fractionBarModel, triangleExplorerModel, triangleValues, triangleSliders,
  TRIANGLE_SLIDERS, circleExplorerModel, circleRange, snapToRange, PARALLEL_SLIDER, PLANE_TEXT
} from './plane.kinds.js';
import './plane.css';

const poly = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const plain = tex => String(tex).replace(/\\[,;!]/g, '').replace(/\^\{?\\circ\}?/g, '°').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}$]/g, '').replace(/\s+/g, ' ').trim();
const mod360 = d => ((d % 360) + 360) % 360;
const eqSign = approx => (approx ? '\\approx' : '=');

function Labels({ labels }) {
  return labels.map((l, i) => <Tex key={i} x={l.cx} y={l.cy} tex={l.tex} w={l.w} h={l.h} className={l.cls} />);
}

function Section({ title, children, controls, readout }) {
  const id = useId();
  return (
    <section className="dgi dgp" aria-labelledby={`${id}-h`} data-diagram-interactive>
      <h4 className="dgi-title" id={`${id}-h`}>{title}</h4>
      {children}
      <div className="dgi-controls">{controls}</div>
      <p className="dgi-readout" role="status" aria-live="polite"><MathText text={readout} /></p>
    </section>
  );
}

// ── plane ────────────────────────────────────────────────────────────────────
export function PlaneFigure({ title = null, caption = null, ...params }) {
  const tk = useKitText(PLANE_TEXT);
  const m = useMemo(() => planeModel(params), [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = m.frame;
  const desc = [
    tk(m.axes ? 'planeAxes' : 'planeNoAxes', { xmin: f.xmin, xmax: f.xmax, ymin: f.ymin, ymax: f.ymax }),
    ...m.points.map(p => (p.label != null ? tk('planePoint', { name: plain(p.label), x: p.x, y: p.y }) : tk('planePointBare', { x: p.x, y: p.y }))),
    ...m.segments.map(s => tk('planeSegment', { x1: s.from[0], y1: s.from[1], x2: s.to[0], y2: s.to[1], len: s.length })),
    m.segments.some(s => s.ticks.length) ? tk('planeTicks') : '',
    ...m.lines.map(l => (l.vertical ? tk('planeLineVertical', { x: l.x }) : tk('planeLine', { x1: l.through[0][0], y1: l.through[0][1], x2: l.through[1][0], y2: l.through[1][1], m: l.gradient, c: l.intercept }))),
    ...m.polygons.map(g => tk('planePolygon', { n: g.n, list: g.points.map(p => `(${p[0]}, ${p[1]})`).join(', '), area: g.area, perimeter: g.perimeter })),
    ...m.circles.map(c => tk('planeCircle', { cx: c.cx, cy: c.cy, r: c.r })),
    ...m.arcs.map(a => tk('planeArc', { cx: a.cx, cy: a.cy, r: a.r, from: a.from, to: a.to, len: a.length })),
    ...m.angles.map(a => (a.right ? tk('planeRight', { x: a.at[0], y: a.at[1] }) : tk('planeAngle', { x: a.at[0], y: a.at[1], deg: a.display }))),
    ...m.curves.map(c => tk('planeCurve', { expr: c.expr })),
    ...m.param.map(c => tk('planeParam', { x: c.x, y: c.y, t0: c.t[0], t1: c.t[1] }))
  ].filter(Boolean).join(' ');
  return (
    <Figure width={f.width} height={f.height} title={title || tk('planeTitle')} description={desc} caption={caption} className="dgp-fig">
      <Defs />
      {m.axes && m.grid && <g className="dg-axes">
        {m.axes.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
        {m.axes.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
      </g>}
      {m.axes && <g className="dg-axes">
        <line className="dg-axis" x1={m.axes.x[0][0]} y1={m.axes.x[0][1]} x2={m.axes.x[1][0]} y2={m.axes.x[1][1]} markerEnd="url(#dg-arrow)" />
        <line className="dg-axis" x1={m.axes.y[0][0]} y1={m.axes.y[0][1]} x2={m.axes.y[1][0]} y2={m.axes.y[1][1]} markerEnd="url(#dg-arrow)" />
      </g>}
      {m.polygons.map((g, i) => <path key={`pg${i}`} className={`${g.shade ? 'dg-shape' : 'dgp-outline'}${g.dashed ? ' dgp-dashed' : ''}`} d={`${poly(g.px)} Z`} />)}
      {m.circles.map((c, i) => <ellipse key={`ci${i}`} className={`dgp-seg${c.dashed ? ' dgp-dashed' : ''}`} cx={c.centre[0]} cy={c.centre[1]} rx={c.rx} ry={c.ry} />)}
      {m.arcs.map((a, i) => <path key={`ar${i}`} className="dgp-seg" d={poly(a.px)} />)}
      {m.lines.map((l, i) => <line key={`ln${i}`} className={`dgp-line${l.dashed ? ' dgp-dashed' : ''}`} x1={l.px[0][0]} y1={l.px[0][1]} x2={l.px[1][0]} y2={l.px[1][1]} />)}
      {m.curves.map((c, i) => c.segments.map((s, k) => <path key={`cv${i}-${k}`} className="dg-curve is-primary" d={poly(s)} />))}
      {m.param.map((c, i) => c.segments.map((s, k) => <path key={`pm${i}-${k}`} className="dg-curve is-primary" d={poly(s)} />))}
      {m.segments.map((s, i) => <g key={`sg${i}`}>
        <line className={`dgp-seg${s.dashed ? ' dgp-dashed' : ''}`} x1={s.px[0][0]} y1={s.px[0][1]} x2={s.px[1][0]} y2={s.px[1][1]} markerEnd={s.arrow ? 'url(#dg-arrow-s)' : undefined} />
        {s.ticks.map((t, k) => <line key={k} className="dgp-tick" x1={t[0][0]} y1={t[0][1]} x2={t[1][0]} y2={t[1][1]} />)}
      </g>)}
      {m.angles.map((a, i) => (a.square ? <path key={`an${i}`} className="dg-rightmark" d={poly(a.square)} /> : <path key={`an${i}`} className="dg-arc" d={poly(a.arc)} />))}
      {m.points.map((p, i) => <circle key={`pt${i}`} className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4" />)}
      <Labels labels={m.labels} />
    </Figure>
  );
}

// ── parallel lines ───────────────────────────────────────────────────────────
function parallelDescription(tk, m) {
  const parts = [tk('plDesc', { deg: r3(m.angle, 1), sup: r3(m.supplement, 1) })];
  if (m.marked.length) parts.push(tk('plMarked', { list: m.marked.join(', ') }));
  if (m.relation) { const r = m.relation; parts.push(tk(`plRel_${r.kind}`, { p: r.pair[0], q: r.pair[1], v1: r3(r.values[0], 1), v2: r3(r.values[1], 1), sum: r3(r.sum, 1) })); }
  return parts.join(' ');
}
function ParallelDrawing({ m, title, caption, tk }) {
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={parallelDescription(tk, m)} caption={caption} className="dgp-fig">
      {m.parallels.map((l, i) => <line key={`pl${i}`} className="dgp-seg" x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} />)}
      {m.chevrons.map((c, i) => <path key={`ch${i}`} className="dgp-chev" d={poly(c)} />)}
      <line className="dgp-seg is-transversal" x1={m.transversal[0][0]} y1={m.transversal[0][1]} x2={m.transversal[1][0]} y2={m.transversal[1][1]} />
      {Object.entries(m.arcs).map(([l, arc]) => <path key={`ma${l}`} className="dgp-mark-arc" d={poly(arc)} />)}
      <circle className="dg-dot" cx={m.crossings.upper[0]} cy={m.crossings.upper[1]} r="3" />
      <circle className="dg-dot" cx={m.crossings.lower[0]} cy={m.crossings.lower[1]} r="3" />
      <Labels labels={m.labels} />
    </Figure>
  );
}
export function ParallelLines({ angle = 60, mark = 'corresponding', values = true, title = null, caption = null }) {
  const tk = useKitText(PLANE_TEXT);
  const m = useMemo(() => parallelLinesModel({ angle, mark, values }), [angle, JSON.stringify(mark), values]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ParallelDrawing m={m} title={title || tk('plTitle')} caption={caption} tk={tk} />;
}
const EQUAL_KINDS = ['corresponding', 'alternate', 'alternateExterior', 'vertical'];
const SUM_KINDS = ['coInterior', 'coExterior', 'adjacent'];
export function ParallelLinesExplorer({ angle = 60, mark = 'corresponding', values = true, title = null }) {
  const tk = useKitText(PLANE_TEXT);
  const [deg, setDeg] = useState(angle);
  const m = useMemo(() => parallelLinesModel({ angle: deg, mark, values }), [deg, JSON.stringify(mark), values]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = m.relation;
  const vars = r ? { deg: r3(deg, 1), name: tk(`ple_name_${r.kind}`), p: r.pair[0], q: r.pair[1], v1: r3(r.values[0], 1), v2: r3(r.values[1], 1), sum: r3(r.sum, 1) } : { deg: r3(deg, 1), sup: r3(m.supplement, 1) };
  const readout = !r ? tk('ple_read_plain', vars) : EQUAL_KINDS.includes(r.kind) ? tk('ple_read_equal', vars) : SUM_KINDS.includes(r.kind) ? tk('ple_read_sum', vars) : tk('ple_read_plain', { deg: r3(deg, 1), sup: r3(m.supplement, 1) });
  return (
    <Section title={title || tk('ple_title')} readout={readout}
      controls={<>
        <Slider label={tk('ple_slider')} min={PARALLEL_SLIDER.min} max={PARALLEL_SLIDER.max} step={PARALLEL_SLIDER.step} value={deg} onChange={setDeg} format={v => `${v}°`} />
        <div className="dgi-buttons"><button type="button" onClick={() => setDeg(angle)}>{tk('reset')}</button></div>
      </>}>
      <ParallelDrawing m={m} title={tk('plTitle')} tk={tk} />
    </Section>
  );
}

// ── area model ───────────────────────────────────────────────────────────────
export function AreaModel({ rows, cols, cells = null, title = null, caption = null }) {
  const tk = useKitText(PLANE_TEXT);
  const m = useMemo(() => areaModelModel({ rows, cols, cells }), [JSON.stringify([rows, cols, cells])]); // eslint-disable-line react-hooks/exhaustive-deps
  const side = list => list.map(p => plain(p.label)).join(' + ');
  const desc = [
    tk('amDesc', { rows: `(${side(rows)})`, cols: `(${side(cols)})`, n: m.cells.length, cells: m.cells.map(c => plain(c.tex)).join(', ') }),
    m.numeric ? tk('amTotal', { total: m.total, rowSum: m.rowSum, colSum: m.colSum }) : ''
  ].filter(Boolean).join(' ');
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || tk('amTitle')} description={desc} caption={caption} className="dgp-fig">
      {m.cells.map((c, i) => <rect key={`c${i}`} className={`dgp-cell${(c.row + c.col) % 2 ? ' is-b' : ''}`} x={c.x} y={c.y} width={c.w} height={c.h} />)}
      {m.cells.map((c, i) => <Tex key={`t${i}`} x={c.cx} y={c.cy} tex={c.tex} w={Math.max(18, c.w - 2)} h={Math.min(22, Math.max(14, c.h - 2))} className={c.fits ? '' : 'dg-small'} />)}
      {m.rowLabels.map((l, i) => <Tex key={`r${i}`} x={l.cx} y={l.cy} tex={l.tex} w={l.w} h={20} className="is-mark" />)}
      {m.colLabels.map((l, i) => <Tex key={`k${i}`} x={l.cx} y={l.cy} tex={l.tex} w={l.w} h={20} className="is-mark" />)}
    </Figure>
  );
}

// ── fraction bars ────────────────────────────────────────────────────────────
export function FractionBar({ bars = [], title = null, caption = null }) {
  const tk = useKitText(PLANE_TEXT);
  const m = useMemo(() => fractionBarModel({ bars }), [JSON.stringify(bars)]); // eslint-disable-line react-hooks/exhaustive-deps
  const desc = [
    ...m.bars.map((b, i) => tk('fbBar', { i: i + 1, shaded: b.shaded, parts: b.parts, n: b.simplest.n, d: b.simplest.d, value: b.value })),
    ...m.equalGroups.map(g => tk('fbEqual', { list: g.map(i => i + 1).join(', ') }))
  ].join(' ');
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || tk('fbTitle')} description={desc} caption={caption} className="dgp-fig">
      {m.bars.map((b, i) => <g key={i}>
        {b.cells.map((c, k) => <rect key={k} className={`dgp-frac${c.shaded ? ' is-on' : ''}`} x={c.x} y={b.y} width={c.w} height={b.h} />)}
        <Tex x={b.labelAt[0]} y={b.labelAt[1]} tex={b.tex} w={66} h={40} anchor="start" />
      </g>)}
    </Figure>
  );
}

// ── triangle explorer ────────────────────────────────────────────────────────
const DEGREE_KEYS = ['A', 'B', 'C', 'angle'];
function TriangleDrawing({ m, title, description }) {
  const d = m.draw;
  const T0 = d.triangles[0];
  const tri = T => `M${T.A[0]} ${T.A[1]} L${T.B[0]} ${T.B[1]} L${T.C[0]} ${T.C[1]} Z`;
  return (
    <Figure width={d.frame.width} height={d.frame.height} title={title} description={description} className="dgp-fig">
      {d.squares.map((s, i) => <path key={`sq${i}`} className={`dgp-square${i === 2 ? ' is-c' : ''}`} d={`${poly(s)} Z`} />)}
      {d.foot && <>
        <line className="dgp-foot" x1={T0.A[0]} y1={T0.A[1]} x2={d.foot[0]} y2={d.foot[1]} />
        {(d.foot[0] < Math.min(T0.B[0], T0.C[0]) || d.foot[0] > Math.max(T0.B[0], T0.C[0])) && <line className="dgp-foot" x1={d.foot[0]} y1={d.foot[1]} x2={Math.abs(d.foot[0] - T0.C[0]) < Math.abs(d.foot[0] - T0.B[0]) ? T0.C[0] : T0.B[0]} y2={T0.C[1]} />}
      </>}
      {d.triangles.map((T, i) => <path key={`t${i}`} className={`dg-shape${i ? ' is-image' : ''}`} d={tri(T)} />)}
      {d.angleMarks.map((a, i) => (a.square ? <path key={`am${i}`} className="dg-rightmark" d={poly(a.square)} /> : <path key={`am${i}`} className="dgp-mark-arc" d={poly(a.arc)} />))}
      <Labels labels={d.labels} />
    </Figure>
  );
}
function triangleWords(tk, mode, n) {
  if (mode === 'angleSum') return { read: tk('te_read_angleSum', n), desc: tk('te_desc_angleSum', n) };
  if (mode === 'pythagoras') {
    if (!n.right) {
      const v = { ...n, s: n.sumSquares, op: n.correction >= 0 ? '-' : '+', corrAbs: r3(Math.abs(n.correction), 4) };
      return { read: tk('te_read_cosine', v), desc: tk('te_desc_cosine', v) };
    }
    const cTex = n.exact ? String(n.c) : `\\sqrt{${n.c2}}\\approx${n.c}`;
    return { read: tk('te_read_pythagoras', { ...n, cTex }), desc: tk('te_desc_pythagoras', n) };
  }
  if (mode === 'trigRatios') return { read: tk('te_read_trigRatios', { ...n, eqS: eqSign(n.approx.sin), eqC: eqSign(n.approx.cos), eqT: eqSign(n.approx.tan) }), desc: tk('te_desc_trigRatios', n) };
  if (mode === 'similar') return { read: tk('te_read_similar', n), desc: tk('te_desc_similar', n) };
  return { read: tk('te_read_area', { ...n, eq: eqSign(n.approx.area), eqh: eqSign(n.approx.h) }), desc: tk('te_desc_area', n) };
}
export function TriangleExplorer({ mode = 'angleSum', initial = {}, title = null }) {
  const tk = useKitText(PLANE_TEXT);
  const start = useMemo(() => triangleValues(mode, initial), [mode, JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState(start);
  const names = useMemo(() => ({ hyp: tk('hyp'), opp: tk('opp'), adj: tk('adj') }), [tk]);
  const m = useMemo(() => triangleExplorerModel({ mode, values, names }), [mode, values, names]);
  const words = triangleWords(tk, mode, m.numbers);
  const set = k => v => setValues(old => ({ ...old, [k]: v }));
  const maxOf = k => (mode === 'angleSum' && (k === 'A' || k === 'B') ? Math.min(TRIANGLE_SLIDERS[k].max, 170 - values[k === 'A' ? 'B' : 'A']) : TRIANGLE_SLIDERS[k].max);
  return (
    <Section title={title || tk(`te_title_${mode}`)} readout={words.read}
      controls={<>
        {triangleSliders(mode, values).map(k => (
          <Slider key={k} name={k} label={tk(`te_${k}`)} min={TRIANGLE_SLIDERS[k].min} max={maxOf(k)} step={TRIANGLE_SLIDERS[k].step} value={values[k]} onChange={set(k)}
            format={v => (DEGREE_KEYS.includes(k) ? `${v}°` : String(v))} />
        ))}
        <div className="dgi-buttons"><button type="button" onClick={() => setValues(start)}>{tk('reset')}</button></div>
      </>}>
      <TriangleDrawing m={m} title={title || tk(`te_title_${mode}`)} description={words.desc} />
    </Section>
  );
}

// ── circle explorer ──────────────────────────────────────────────────────────
function circleWords(tk, theorem, n) {
  const v = {
    centre: { centre: r3(n.centre, 1), circ: r3(n.circumference, 1) },
    segment: { r: r3(n.atR, 1), s: r3(n.atS, 1) },
    semicircle: { r: r3(n.atR, 1) },
    cyclic: { A: r3(n.A, 1), B: r3(n.B, 1), C: r3(n.C, 1), D: r3(n.D, 1), sAC: r3(n.sumAC, 1), sBD: r3(n.sumBD, 1) },
    tangent: { t: r3(n.atT, 1) },
    chords: { radius: n.radius, ap: r3(n.ap, 2), pb: r3(n.pb, 2), cp: r3(n.cp, 2), pd: r3(n.pd, 2), p1: r3(n.product1, 2), p2: r3(n.product2, 2) }
  }[theorem];
  return { read: tk(`ce_read_${theorem}`, v), desc: tk(`ce_desc_${theorem}`, v) };
}
export function CircleExplorer({ theorem = 'centre', initial = {}, radius = 5, title = null }) {
  const tk = useKitText(PLANE_TEXT);
  const start = useMemo(() => circleExplorerModel({ theorem, initial, radius }).values, [theorem, JSON.stringify(initial), radius]); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState(start);
  const svgRef = useRef(null);
  const m = useMemo(() => circleExplorerModel({ theorem, values, radius }), [theorem, values, radius]);
  const key = m.moving; const { lo, hi } = circleRange(theorem, values); const now = values[key];
  const setTo = v => setValues(old => ({ ...old, [key]: theorem === 'tangent' ? mod360(Math.round(v)) : Math.min(hi, Math.max(lo, Math.round(v))) }));
  const fromPointer = e => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal;
    const x = ((e.clientX - r.left) / r.width) * vb.width; const y = ((e.clientY - r.top) / r.height) * vb.height;
    const deg = (Math.atan2(m.draw.centre[1] - y, x - m.draw.centre[0]) * 180) / Math.PI;
    setValues(old => ({ ...old, [key]: snapToRange(theorem, old, deg) }));
  };
  const onKey = e => {
    const big = e.shiftKey ? 10 : 1;
    const moves = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 10, PageDown: -10 };
    if (e.key in moves) { e.preventDefault(); setTo(now + moves[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); setTo(lo); }
    else if (e.key === 'End') { e.preventDefault(); setTo(hi); }
  };
  const words = circleWords(tk, theorem, m.numbers);
  const d = m.draw; const P = d.points; const shown = mod360(now);
  const name = m.point;
  return (
    <Section title={title || tk(`ce_title_${theorem}`)} readout={words.read}
      controls={<>
        <Slider name={key} label={tk('ce_slider', { name })} min={lo} max={hi} step={1} value={now} onChange={setTo} format={v => `${mod360(v)}°`} />
        <div className="dgi-buttons"><button type="button" onClick={() => setValues(start)}>{tk('reset')}</button></div>
      </>}>
      <Figure width={d.frame.width} height={d.frame.height} title={title || tk(`ce_title_${theorem}`)} description={words.desc} className="dg-square dgp-fig"
        svgProps={{ role: 'group', ref: svgRef, onPointerDown: e => { e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(e); }, onPointerMove: e => { if (e.buttons) fromPointer(e); } }}>
        <circle className="dg-shape" cx={d.centre[0]} cy={d.centre[1]} r={d.radius} />
        {d.lines.map(([p, q], i) => <line key={i} className={`dg-curve is-${theorem === 'tangent' && i === 1 ? 'primary' : 'secondary'}`} x1={P[p][0]} y1={P[p][1]} x2={P[q][0]} y2={P[q][1]} />)}
        {d.angleMarks.map((a, i) => (a.square ? <path key={`am${i}`} className="dg-rightmark" d={poly(a.square)} /> : <path key={`am${i}`} className="dgp-mark-arc" d={poly(a.arc)} />))}
        {Object.entries(P).map(([k, p]) => <circle key={k} className="dg-dot" cx={p[0]} cy={p[1]} r={k === 'O' ? 3 : 4} />)}
        <Labels labels={d.labels} />
        <g className="dgi-handle" role="slider" tabIndex={0} aria-label={tk('ce_handle', { name })} aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={now}
          aria-valuetext={tk('ce_valuetext', { name, deg: shown })} onKeyDown={onKey}>
          <circle className="dgi-ring" cx={d.handle[0]} cy={d.handle[1]} r="11" />
          <circle className="dg-dot is-key" cx={d.handle[0]} cy={d.handle[1]} r="4" />
        </g>
      </Figure>
    </Section>
  );
}

export const STATIC_COMPONENTS = Object.freeze({ plane: PlaneFigure, parallelLines: ParallelLines, areaModel: AreaModel, fractionBar: FractionBar });
export const INTERACTIVE_COMPONENTS = Object.freeze({ parallelLinesExplorer: ParallelLinesExplorer, triangleExplorer: TriangleExplorer, circleExplorer: CircleExplorer });
