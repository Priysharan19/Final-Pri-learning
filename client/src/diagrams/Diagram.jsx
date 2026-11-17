// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit: static diagrams (Notes and questions)
//
// Every diagram is drawn from a MODEL computed by geometry.js from plain
// parameters, so the picture, its labels and its text alternative all come from
// the same numbers as the note or question beside it. Labels are typeset with the
// app's KaTeX (MathText) inside the SVG. Colours are the Instrument's tokens, so
// light and dark follow the theme. Nothing here is interactive: the Notes-only
// interactive variants are in Interactive.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useId } from 'react';
import { MathText } from '../lib/latex.jsx';
import './diagrams.css';
import { place, circlePath, labelSize, boxOf, outline } from './placement.js';
import {
  functionGraphModel, unitCircleModel, triangleModel, regularPolygonModel, circleTheoremModel, numberLineModel, treeModel, vennModel,
  twoWayModel, histogramModel, boxPlotModel, normalCurveModel, vectorModel, sequenceModel, compoundModel, timelineModel,
  secantTangentModel, riemannModel, networkModel, niceTicks, axesOf, scatterModel, solidModel, ftex, ftext, r3
} from './geometry.js';

const poly = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** A KaTeX label centred (or anchored) at an SVG point. */
export function Tex({ x, y, tex, w = 64, h = 26, anchor = 'middle', baseline = 'middle', className = '' }) {
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const top = baseline === 'top' ? y : baseline === 'bottom' ? y - h : y - h / 2;
  return (
    <foreignObject x={left} y={top} width={w} height={h} className={`dg-tex ${className}`} style={{ overflow: 'visible' }}>
      <div xmlns="http://www.w3.org/1999/xhtml" className={`dg-tex-in is-${anchor}`}><MathText text={`$${tex}$`} /></div>
    </foreignObject>
  );
}

/** A KaTeX label at the first candidate position [x, y, anchor] that touches no obstacle polyline. */
/** Candidate positions for a label beside a point, nearest first. */
const pointCands = ([x, y]) => [[8, -16], [8, 18], [-8, -16], [-8, 18], ...[32, 48, 64, 82].flatMap(d => [[8, -d], [8, d], [-8, -d], [-8, d]])].map(([dx, dy]) => [x + dx, y + dy, dx > 0 ? 'start' : 'end']);
/** An axis label: a single letter stays maths; words are set as text. */
const axisTex = s => (/^[A-Za-z]$|\\|[\^_{}]/.test(String(s)) ? String(s) : `\\text{${s}}`);
const PlacedLabels = createContext(null);

/** A short break mark across an axis, drawn where the axis does not start at zero. */
function AxisBreak({ x, y, vertical }) {
  const d = vertical ? `M${x - 7} ${y - 3} L${x + 7} ${y - 8} M${x - 7} ${y + 3} L${x + 7} ${y - 2}` : `M${x - 3} ${y + 7} L${x + 2} ${y - 7} M${x + 3} ${y + 7} L${x + 8} ${y - 7}`;
  return <path className="dg-break" d={d} fill="none" />;
}
export function PTex({ tex, cands, obstacles = [], small = false, ...rest }) {
  // Labels in one figure are placed in order; each placed label is an obstacle for the next.
  const placed = useContext(PlacedLabels);
  const [x, y, anchor] = place(tex, cands, placed ? [...obstacles, ...placed] : obstacles, { small });
  if (placed) placed.push(outline(boxOf(tex, [x, y, anchor], { small })));
  return <Tex x={x} y={y} anchor={anchor || 'middle'} tex={tex} {...rest} />;
}

/** The figure shell: an accessible SVG with a title, a description (the text alternative) and an optional caption. */
export function Figure({ width, height, title, description, caption = null, children, className = '', svgProps = {}, frame = null }) {
  const id = useId();
  const placed = [];
  return (
    <figure className={`dg ${className}`} data-diagram>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet" className="dg-svg" data-frame={frame ? JSON.stringify({ xmin: frame.xmin, xmax: frame.xmax, ymin: frame.ymin, ymax: frame.ymax, left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom }) : undefined} {...svgProps}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{description}</desc>
        <PlacedLabels.Provider value={placed}>{children}</PlacedLabels.Provider>
      </svg>
      {caption && <figcaption className="dg-caption"><MathText text={caption} /></figcaption>}
    </figure>
  );
}

function Axes({ m, grid = true, labels = true, xLabel = null, yLabel = null, obstacles = [] }) {
  const f = m.frame;
  const x0 = m.axes.x[0][1]; const y0 = m.axes.y[0][0];
  const obs = [...obstacles, [[f.left, x0], [f.right, x0]], [[y0, f.bottom], [y0, f.top]]];
  const origin = f.xmin <= 0 && f.xmax >= 0 && f.ymin <= 0 && f.ymax >= 0;
  return (
    <g className="dg-axes">
      {grid && m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
      {grid && m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
      <line className="dg-axis" x1={m.axes.x[0][0]} x2={m.axes.x[1][0]} y1={x0} y2={x0} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={y0} x2={y0} y1={m.axes.y[1][1]} y2={m.axes.y[0][1]} markerEnd="url(#dg-arrow)" />
      {labels && m.xTicks.filter(t => !(t.value === 0 && origin)).map(t => <PTex key={`lx${t.value}`} tex={String(t.value)} cands={[[t.px, x0 + 14], [t.px, x0 - 14], [t.px, f.bottom + 14]]} obstacles={obs} w={40} h={20} />)}
      {labels && m.yTicks.filter(t => !(t.value === 0 && origin)).map(t => <PTex key={`ly${t.value}`} tex={String(t.value)} cands={[[y0 - 6, t.px, 'end'], [y0 + 6, t.px, 'start'], [f.left - 6, t.px, 'end']]} obstacles={obs} w={40} h={20} />)}
      {labels && origin && <PTex tex="0" cands={[[y0 - 8, x0 + 13, 'end'], [y0 + 8, x0 + 13, 'start'], [y0 - 8, x0 - 13, 'end']]} obstacles={obs} w={20} h={20} />}
      {!(f.ymin <= 0 && f.ymax >= 0) && <AxisBreak x={y0} y={f.bottom - 14} vertical />}
      {!(f.xmin <= 0 && f.xmax >= 0) && <AxisBreak x={f.left + 14} y={x0} vertical={false} />}
      {xLabel && <PTex tex={axisTex(xLabel)} cands={[[f.right, x0 - 12, 'end'], [f.right, x0 + 14, 'end'], [f.right, f.bottom + 14, 'end'], [f.right, x0 - 30, 'end'], [f.right, x0 + 32, 'end'], [f.right - 36, x0 - 12, 'end'], [f.right - 36, x0 + 14, 'end']]} obstacles={obs} w={36} h={20} />}
      {yLabel && <PTex tex={axisTex(yLabel)} cands={[[y0 + 8, f.top - 2, 'start'], [y0 - 8, f.top - 2, 'end'], [f.left + 8, f.top - 2, 'start'], [y0 + 8, f.top + 18, 'start'], [y0 - 8, f.top + 18, 'end']]} obstacles={obs} w={36} h={20} />}
    </g>
  );
}
export function Defs() {
  return <defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="dg-arrowhead" /></marker><marker id="dg-arrow-s" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 1 L10 5 L0 9 z" className="dg-arrowhead" /></marker></defs>;
}

const sentence = (...parts) => parts.filter(Boolean).join(' ');

// ── Function graphs ──────────────────────────────────────────────────────────
export function FunctionGraph({ title = 'Graph of a function', caption = null, xLabel = 'x', yLabel = 'y', hideIntercepts = false, ...spec }) {
  const m = functionGraphModel(spec);
  const desc = sentence(
    `Axes: x from ${r3(m.frame.xmin, 2)} to ${r3(m.frame.xmax, 2)}, y from ${r3(m.frame.ymin, 2)} to ${r3(m.frame.ymax, 2)}.`,
    m.curves.map(c => `Curve: y = ${c.expr}.${c.shade ? ` The area between it and the x-axis from x = ${c.shade.from} to x = ${c.shade.to} is shaded.` : ''}`).join(' '),
    m.curves.flatMap(c => [c.yIntercept ? `It crosses the y-axis at ${c.yIntercept.y}.` : '', c.xIntercepts?.length ? `It crosses the x-axis at x = ${c.xIntercepts.map(i => i.x).join(', ')}.` : '']).join(' '),
    m.asymptotes.map(a => `${a.axis === 'x' ? 'Vertical' : 'Horizontal'} asymptote ${a.axis} = ${a.value}.`).join(' ')
  );
  const fnObstacles = [...m.curves.flatMap(c => c.segments), ...m.asymptotes.map(a => a.px), m.axes.x, m.axes.y];
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <Defs />
      <Axes m={m} xLabel={xLabel} yLabel={yLabel} obstacles={fnObstacles} />
      {m.asymptotes.map((a, i) => (
        <g key={`as${i}`}><line className="dg-asymptote" x1={a.px[0][0]} y1={a.px[0][1]} x2={a.px[1][0]} y2={a.px[1][1]} />{a.label && <PTex tex={a.label} cands={a.axis === 'x' ? [[a.px[0][0] + 4, a.px[0][1] + 12, 'start'], [a.px[0][0] - 4, a.px[0][1] + 12, 'end'], [a.px[0][0] + 4, a.px[0][1] + 36, 'start'], [a.px[0][0] - 4, a.px[0][1] + 36, 'end'], [a.px[0][0] + 4, a.px[0][1] + 70, 'start'], [a.px[0][0] - 4, a.px[0][1] + 70, 'end'], [a.px[0][0] + 4, a.px[0][1] + 110, 'start'], [a.px[0][0] - 4, a.px[0][1] + 110, 'end']] : [[a.px[1][0] - 4, a.px[0][1] - 12, 'end'], [a.px[1][0] - 4, a.px[0][1] + 12, 'end'], [m.frame.left + 6, a.px[0][1] - 12, 'start']]} obstacles={fnObstacles} w={70} />}</g>
      ))}
      {m.curves.map(c => c.shade && c.shade.path.length > 0 && <path key={`sh${c.id}`} className="dg-shade" d={`${poly(c.shade.path)} Z`} />)}
      {m.curves.map(c => c.segments.map((seg, k) => <path key={`${c.id}${k}`} className={`dg-curve is-${c.tone}`} d={poly(seg)} />))}
      {!hideIntercepts && m.curves.flatMap(c => [c.yIntercept, ...(c.xIntercepts || [])].filter(Boolean).filter((p, i, all) => all.findIndex(q => q.x === p.x && q.y === p.y) === i).map((p, i) => <g key={`ic${c.id}${i}`}><circle className="dg-dot" cx={p.px[0]} cy={p.px[1]} r="4" /><PTex tex={`(${p.x},\\,${p.y})`} cands={pointCands(p.px)} obstacles={fnObstacles} w={80} /></g>))}
      {m.points.map((p, i) => <g key={`pt${i}`}><circle className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4.5" />{p.label && <PTex tex={p.label} cands={pointCands(p.px)} obstacles={fnObstacles} w={90} />}</g>)}
      {m.curves.map(c => c.label && (() => { const ex = Math.min(m.frame.right - 40, (c.segments.at(-1)?.at(-1)?.[0] ?? m.frame.right) - 4); const ey = c.segments.at(-1)?.at(-1)?.[1] ?? m.frame.top; return <PTex key={`lb${c.id}`} tex={c.label} cands={[[ex, ey - 12, 'end'], [ex - 14, ey + 16, 'end'], [ex - 70, ey - 18, 'end'], [m.frame.right - 6, m.frame.top + 12, 'end'], [m.frame.left + 8, m.frame.top + 12, 'start'], ...[30, 50, 70, 96, 130, 170].flatMap(d => [[ex, ey - 12 + d, 'end'], [ex - d, ey - 12, 'end'], [ex - d, ey + 16, 'end'], [m.frame.right - 6, m.frame.top + 12 + d, 'end'], [m.frame.left + 8, m.frame.top + 12 + d, 'start'], [m.frame.left + 8, m.frame.bottom - 14 - d, 'start']])]} obstacles={fnObstacles} w={110} className="dg-curve-label" />; })())}
    </Figure>
  );
}

// ── The unit circle and trig graphs ──────────────────────────────────────────
export function UnitCircle({ deg = 30, showTan = false, title = 'The unit circle', caption = null, overlay = null, svgProps = {} }) {
  const m = unitCircleModel({ deg });
  const p = m.point;
  const ucObs = [[[m.frame.left, m.centre[1]], [m.frame.right, m.centre[1]]], [[m.centre[0], m.frame.bottom], [m.centre[0], m.frame.top]], circlePath(m.centre[0], m.centre[1], m.radius), m.arc, [m.centre, m.px], [m.px, m.foot], [m.centre, m.foot], circlePath(m.px[0], m.px[1], 13, 20)];
  // Labels are placed one after another; each placed label is an obstacle for the next, so none overlaps another.
  const boxes = [];
  const put = (tex, cands, small = false) => { const c = place(tex, cands, [...ucObs, ...boxes], { small }); boxes.push(outline(boxOf(tex, c, { small }))); return c; };
  const ux = m.px[0] - m.centre[0]; const uy = m.px[1] - m.centre[1]; const un = Math.hypot(ux, uy) || 1;
  const coordTex = `(${r3(p.cos, 2)},\\,${r3(p.sin, 2)})`;
  const est = labelSize(coordTex).w + 6;
  const lim = x => (ux >= 0 ? Math.min(x, m.frame.width - est) : Math.max(x, est));
  const a = ux >= 0 ? 'start' : 'end';
  const coordAt = put(coordTex, [[lim(m.px[0] + (ux / un) * 16), m.px[1] + (uy / un) * 18 + (uy / un < 0 ? -6 : 6), a], [lim(m.px[0] + (ux / un) * 38), m.px[1] + (uy / un) * 32, a], [lim(m.px[0] + (ux >= 0 ? 16 : -16)), m.px[1] + (p.sin >= 0 ? -26 : 26), a], [lim(m.px[0] + (ux >= 0 ? 16 : -16)), m.px[1] + (p.sin >= 0 ? 26 : -26), a], [ux >= 0 ? Math.min(m.px[0] + 10, m.frame.width - est / 2 - 2) : Math.max(m.px[0] - 10, est / 2 + 2), m.px[1] + (p.sin >= 0 ? -34 : 34), 'middle'], [ux >= 0 ? Math.min(m.px[0] + 10, m.frame.width - est / 2 - 2) : Math.max(m.px[0] - 10, est / 2 + 2), m.px[1] + (p.sin >= 0 ? -52 : 52), 'middle'], [m.px[0] - (ux >= 0 ? est / 2 - 4 : -(est / 2 - 4)), m.px[1] + (p.sin >= 0 ? -34 : 34), 'middle'], [m.px[0] - (ux >= 0 ? est / 2 - 4 : -(est / 2 - 4)), m.px[1] + (p.sin >= 0 ? -50 : 50), 'middle'], [m.px[0] - (ux >= 0 ? est / 2 - 4 : -(est / 2 - 4)), m.px[1] + (p.sin >= 0 ? 34 : -34), 'middle']]);
  const thetaTex = `\\theta=${p.deg}^{\\circ}`;
  const thetaAt = put(thetaTex, [[m.centre[0] + 36, m.centre[1] - 8, 'start'], [m.centre[0] + 36, m.centre[1] + 16, 'start'], [m.centre[0] - 36, m.centre[1] - 8, 'end'], [m.centre[0] - 36, m.centre[1] + 16, 'end'], [m.centre[0] + 60, m.centre[1] - 30, 'start'], [m.centre[0] - 60, m.centre[1] - 30, 'end'], [m.centre[0] + 60, m.centre[1] + 30, 'start'], [m.centre[0] - 60, m.centre[1] + 30, 'end']], true);
  const tanTex = showTan && p.tan !== null ? `\\tan\\theta=${r3(p.tan, 2)}` : null;
  if (tanTex) boxes.push(outline(boxOf(tanTex, [m.frame.left + 8, m.frame.top + 12, 'start'])));
  const tickAt = m.ticks.map(t => {
    const tx = t.px[0] - m.centre[0]; const ty = t.px[1] - m.centre[1]; const n = Math.hypot(tx, ty) || 1; const nx = -ty / n; const ny = tx / n; const rx = tx / n; const ry = ty / n;
    return put(`${t.deg}^{\\circ}`, [[t.px[0] + nx * 17, t.px[1] + ny * 12], [t.px[0] - nx * 17, t.px[1] - ny * 12], [t.px[0] + rx * 12 + nx * 20, t.px[1] + ry * 12 + ny * 14], [t.px[0] + rx * 12 - nx * 20, t.px[1] + ry * 12 - ny * 14], [t.px[0] + rx * 26, t.px[1] + ry * 22], [t.px[0] + rx * 40 + nx * 6, t.px[1] + ry * 30 + ny * 6], [t.px[0] + rx * 40 - nx * 6, t.px[1] + ry * 30 - ny * 6], [t.px[0] + rx * 56, t.px[1] + ry * 40], [t.px[0] + rx * 56 + nx * 16, t.px[1] + ry * 40 + ny * 16], [t.px[0] + rx * 56 - nx * 16, t.px[1] + ry * 40 - ny * 16]], true);
  });
  const desc = `A point on the unit circle at ${p.deg} degrees: cosine ${p.cos}, sine ${p.sin}${p.tan !== null ? `, tangent ${p.tan}` : ', tangent undefined'}. Quadrant ${p.quadrant || 'on an axis'}, reference angle ${p.reference} degrees.`;
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption} className="dg-square" svgProps={svgProps}>
      <Defs />
      <line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.centre[1]} y2={m.centre[1]} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={m.centre[0]} x2={m.centre[0]} y1={m.frame.bottom} y2={m.frame.top} markerEnd="url(#dg-arrow)" />
      <circle className="dg-curve is-secondary" cx={m.centre[0]} cy={m.centre[1]} r={m.radius} fill="none" />
      {m.ticks.map((t, i) => <g key={t.deg}><circle className="dg-tick-dot" cx={t.on[0]} cy={t.on[1]} r="2.2" /><Tex x={tickAt[i][0]} y={tickAt[i][1]} anchor={tickAt[i][2] || 'middle'} tex={`${t.deg}^{\\circ}`} w={44} h={18} className="dg-small" /></g>)}
      <path className="dg-arc" d={poly(m.arc)} fill="none" />
      <line className="dg-curve is-primary" x1={m.centre[0]} y1={m.centre[1]} x2={m.px[0]} y2={m.px[1]} />
      <line className="dg-dash is-cos" x1={m.px[0]} y1={m.px[1]} x2={m.foot[0]} y2={m.foot[1]} />
      <line className="dg-dash is-sin" x1={m.centre[0]} y1={m.centre[1]} x2={m.foot[0]} y2={m.foot[1]} />
      <circle className="dg-dot is-key" cx={m.px[0]} cy={m.px[1]} r="5" />
      <Tex x={coordAt[0]} y={coordAt[1]} anchor={coordAt[2] || 'middle'} tex={coordTex} w={120} />
      <Tex x={thetaAt[0]} y={thetaAt[1]} anchor={thetaAt[2] || 'middle'} tex={thetaTex} w={90} className="dg-small" />
      {tanTex && <Tex x={m.frame.left + 8} y={m.frame.top + 12} tex={tanTex} w={150} anchor="start" />}
      {overlay && overlay(m)}
    </Figure>
  );
}
/** A sine, cosine or tangent graph y = a·f(b(x − c)) + d, with the period and amplitude named. */
export function TrigGraph({ fn = 'sin', a = 1, b = 1, c = 0, d = 0, title = null, caption = null }) {
  const period = fn === 'tan' ? Math.PI / b : (2 * Math.PI) / b;
  const spec = { xmin: -2 * Math.PI, xmax: 2 * Math.PI, ymin: fn === 'tan' ? -4 : Math.min(-1.5, d - Math.abs(a) - 0.5), ymax: fn === 'tan' ? 4 : Math.max(1.5, d + Math.abs(a) + 0.5), curves: [{ type: fn, a, b, c, d, label: `y=${a === 1 ? '' : a}\\${fn}${b === 1 && c === 0 ? '\\,x' : '(\\ldots)'}` }], asymptotes: fn === 'tan' ? Array.from({ length: 5 }, (_, k) => ({ x: r3(c + (k - 2) * period + period / 2, 6) })).filter(s => Math.abs(s.x) <= 2 * Math.PI + 1e-9) : [] };
  const m = functionGraphModel({ ...spec, xTicks: [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI].map(v => r3(v, 6)) });
  const f = m.frame; const y0 = m.axes.x[0][1];
  const trigObs = [...m.curves.flatMap(c => c.segments), ...m.asymptotes.map(a => a.px), [[f.left, y0], [f.right, y0]], [[m.axes.y[0][0], f.bottom], [m.axes.y[0][0], f.top]]];
  const piLabel = v => ({ [-6.283]: '-2\\pi', [-3.142]: '-\\pi', 3.142: '\\pi', 6.283: '2\\pi' })[r3(v, 3)] || null;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title || `Graph of y = ${a}${fn}(${b}(x - ${c})) + ${d}`} description={`A ${fn} curve with amplitude ${fn === 'tan' ? 'none' : Math.abs(a)}, period ${r3(period, 4)} radians, shifted ${c} right and ${d} up.`} caption={caption}>
      <Defs />
      <g className="dg-axes">
        {m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
        {m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={y0} y2={y0} markerEnd="url(#dg-arrow)" />
        <line className="dg-axis" x1={m.axes.y[0][0]} x2={m.axes.y[0][0]} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" />
        <PTex tex="0" cands={[[m.axes.y[0][0] - 8, y0 + 13, 'end'], [m.axes.y[0][0] + 8, y0 + 13, 'start'], [m.axes.y[0][0] - 8, y0 - 13, 'end'], [m.axes.y[0][0] + 8, y0 - 13, 'start']]} obstacles={trigObs} w={20} h={20} />
        {m.xTicks.map(t => piLabel(t.value) && <PTex key={`lx${t.value}`} tex={piLabel(t.value)} cands={[[t.px, y0 + 14], [t.px, y0 - 14], [t.px, f.bottom + 14]]} obstacles={trigObs} w={44} h={20} />)}
        {m.yTicks.filter(t => t.value !== 0).map(t => <PTex key={`ly${t.value}`} tex={String(t.value)} cands={[[m.axes.y[0][0] - 6, t.px, 'end'], [m.axes.y[0][0] + 6, t.px, 'start'], [f.left - 6, t.px, 'end']]} obstacles={trigObs} w={40} h={20} />)}
      </g>
      {m.asymptotes.map((s, i) => <line key={i} className="dg-asymptote" x1={s.px[0][0]} y1={s.px[0][1]} x2={s.px[1][0]} y2={s.px[1][1]} />)}
      {m.curves.map(cv => cv.segments.map((seg, k) => <path key={`${cv.id}${k}`} className="dg-curve is-primary" d={poly(seg)} />))}
    </Figure>
  );
}

// ── Triangles and polygons ───────────────────────────────────────────────────
export function Triangle({ a, b, c, C, labels = { sides: true, angles: true }, title = 'A triangle', caption = null, showArea = false }) {
  const m = triangleModel({ a, b, c, C });
  const V = m.vertices;
  const triObs = [[V.A, V.B, V.C, V.A]];
  const sideLabel = (k, p, away) => <PTex key={k} tex={String(r3(m.sides[k], 2))} cands={[18, 26, 36].map(d => [p[0] + (away[0] / 16) * d, p[1] + (away[1] / 16) * d])} obstacles={triObs} w={46} h={22} className="dg-side" />;
  const cx = (V.A[0] + V.B[0] + V.C[0]) / 3; const cy = (V.A[1] + V.B[1] + V.C[1]) / 3;
  const away = p => { const dx = p[0] - cx; const dy = p[1] - cy; const n = Math.hypot(dx, dy) || 1; return [(dx / n) * 16, (dy / n) * 16]; };
  const corner = (k) => { const p = V[k]; const dx = cx - p[0]; const dy = cy - p[1]; const n = Math.hypot(dx, dy) || 1; return [p[0] + (dx / n) * 46, p[1] + (dy / n) * 46]; };
  const rightMark = m.right ? (() => { const p = V[m.right]; const others = Object.keys(V).filter(k => k !== m.right).map(k => V[k]); const u = others.map(q => { const dx = q[0] - p[0]; const dy = q[1] - p[1]; const n = Math.hypot(dx, dy) || 1; return [dx / n * 14, dy / n * 14]; }); return `M${p[0] + u[0][0]} ${p[1] + u[0][1]} L${p[0] + u[0][0] + u[1][0]} ${p[1] + u[0][1] + u[1][1]} L${p[0] + u[1][0]} ${p[1] + u[1][1]}`; })() : null;
  const desc = `Triangle ABC with sides a = ${m.sides.a}, b = ${m.sides.b}, c = ${m.sides.c}; angles A = ${m.angles.A}°, B = ${m.angles.B}°, C = ${m.angles.C}°${m.right ? `, a right angle at ${m.right}` : ''}; area ${m.area}.`;
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <path className="dg-shape" d={`M${V.A[0]} ${V.A[1]} L${V.B[0]} ${V.B[1]} L${V.C[0]} ${V.C[1]} Z`} />
      {rightMark && <path className="dg-rightmark" d={rightMark} fill="none" />}
      {labels.sides && <>{sideLabel('a', m.midpoints.a, away(m.midpoints.a))}{sideLabel('b', m.midpoints.b, away(m.midpoints.b))}{sideLabel('c', m.midpoints.c, away(m.midpoints.c))}</>}
      {['A', 'B', 'C'].map(k => <Tex key={k} x={V[k][0] + away(V[k])[0] * 1.4} y={V[k][1] + away(V[k])[1] * 1.4} tex={k} w={24} h={22} className="dg-vertex" />)}
      {labels.angles && ['A', 'B', 'C'].filter(k => k !== m.right).map(k => { const p = V[k]; const dx = cx - p[0]; const dy = cy - p[1]; const n = Math.hypot(dx, dy) || 1; return <PTex key={`an${k}`} small tex={`${r3(m.angles[k], 1)}^{\\circ}`} cands={[34, 42, 52, 62, 74, 88].map(d => [p[0] + (dx / n) * d, p[1] + (dy / n) * d])} obstacles={triObs} w={60} h={20} className="dg-small" />; })}
      {showArea && <Tex x={cx} y={cy} tex={`\\text{area}=${r3(m.area, 2)}`} w={110} className="dg-small" />}
    </Figure>
  );
}
export function RegularPolygon({ n = 5, side = 1, title = null, caption = null }) {
  const m = regularPolygonModel({ n, side });
  const cx = m.frame.sx(0); const cy = m.frame.sy(0);
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title || `A regular polygon with ${n} sides`} description={`A regular polygon with ${n} sides each of length ${m.side}; each interior angle is ${m.interior}°, each exterior angle ${m.exterior}°, and the interior angles add to ${m.angleSum}°.`} caption={caption}>
      <path className="dg-shape" d={`${poly(m.vertices)} Z`} />
      {m.vertices.map((v, i) => <circle key={i} className="dg-tick-dot" cx={v[0]} cy={v[1]} r="2.6" />)}
      <Tex x={cx} y={cy - 10} tex={`n=${n}`} w={60} />
      <Tex x={cx} y={cy + 12} tex={`${m.interior}^{\\circ}`} w={70} className="dg-small" />
    </Figure>
  );
}

// ── Circles and the circle theorems ──────────────────────────────────────────
export function CircleTheorem({ theorem = 'centre', params = {}, title = null, caption = null }) {
  const m = circleTheoremModel({ theorem, params });
  const P = m.points; const labelOf = { centre: 'Angle at the centre is twice the angle at the circumference', segment: 'Angles in the same segment are equal', semicircle: 'The angle in a semicircle is a right angle', cyclic: 'Opposite angles of a cyclic quadrilateral add to 180°', tangent: 'A tangent is perpendicular to the radius at the point of contact' }[theorem];
  const desc = `${labelOf}. Marked angles: ${m.marks.map(k => `${k.value}° at ${k.at}`).join('; ')}.`;
  const ctObs = [circlePath(m.centre[0], m.centre[1], m.radius), ...m.lines.map(([a, b]) => [P[a], P[b]])];
  const nudge = (name) => { const p = P[name]; const dx = p[0] - m.centre[0]; const dy = p[1] - m.centre[1]; const n = Math.hypot(dx, dy) || 1; return [p[0] + (dx / n) * 16 || p[0] + 16, p[1] + (dy / n) * 16]; };
  const markPos = k => { const v = P[k.at]; const a = P[k.between[0]]; const b = P[k.between[1]]; const mx = (a[0] + b[0]) / 2 - v[0]; const my = (a[1] + b[1]) / 2 - v[1]; const n = Math.hypot(mx, my) || 1; return [v[0] + (mx / n) * 38, v[1] + (my / n) * 38]; };
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title || labelOf} description={desc} caption={caption || labelOf} className="dg-square">
      <circle className="dg-shape" cx={m.centre[0]} cy={m.centre[1]} r={m.radius} />
      {m.lines.map(([p, q], i) => <line key={i} className={`dg-curve is-${theorem === 'tangent' && i === 1 ? 'primary' : 'secondary'}`} x1={P[p][0]} y1={P[p][1]} x2={P[q][0]} y2={P[q][1]} />)}
      {Object.keys(P).map(k => <g key={k}><circle className="dg-dot" cx={P[k][0]} cy={P[k][1]} r={k === 'O' ? 3 : 4} />{!/^E/.test(k) && <PTex tex={k} cands={(() => { const dx = P[k][0] - m.centre[0]; const dy = P[k][1] - m.centre[1]; const n = Math.hypot(dx, dy) || 1; const ux = dx / n; const uy = dy / n; return k === 'O' ? [[P[k][0] + 12, P[k][1] + 14], [P[k][0] - 12, P[k][1] + 14], [P[k][0] + 12, P[k][1] - 14], [P[k][0] - 12, P[k][1] - 14], [P[k][0], P[k][1] + 24]] : [16, 24, 32, 42].flatMap(d => [[P[k][0] + ux * d, P[k][1] + uy * d], [P[k][0] + ux * d - uy * 12, P[k][1] + uy * d + ux * 12], [P[k][0] + ux * d + uy * 12, P[k][1] + uy * d - ux * 12]]); })()} obstacles={ctObs} w={24} h={22} className="dg-vertex" />}</g>)}
      {m.marks.map((k, i) => { const v = P[k.at]; const a = P[k.between[0]]; const b = P[k.between[1]]; const mx = (a[0] + b[0]) / 2 - v[0]; const my = (a[1] + b[1]) / 2 - v[1]; const n = Math.hypot(mx, my) || 1; return <PTex key={i} small tex={`${k.value}^{\\circ}`} cands={[38, 30, 46, 54, 64].map(d => [v[0] + (mx / n) * d, v[1] + (my / n) * d])} obstacles={ctObs} w={58} h={20} className="dg-small is-mark" />; })}
    </Figure>
  );
}

// ── Number lines ─────────────────────────────────────────────────────────────
export function NumberLine({ title = 'A number line', caption = null, ...spec }) {
  const m = numberLineModel(spec);
  const desc = sentence(m.points.map(p => `${p.open ? 'Open' : 'Closed'} point at ${p.value}.`).join(' '), m.intervals.map(i => `Shaded from ${i.from === null ? 'the left' : `${i.from}${i.fromOpen ? ' (not included)' : ''}`} to ${i.to === null ? 'the right' : `${i.to}${i.toOpen ? ' (not included)' : ''}`}.`).join(' '));
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc || 'An empty number line.'} caption={caption}>
      <Defs />
      <line className="dg-axis" x1={m.frame.left - 6} x2={m.frame.right + 6} y1={m.y} y2={m.y} markerStart="url(#dg-arrow)" markerEnd="url(#dg-arrow)" />
      {m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.y - 6} y2={m.y + 6} /><Tex x={t.px} y={m.y + 20} tex={String(t.value)} w={40} h={20} /></g>)}
      {m.intervals.map((i, k) => <g key={`iv${k}`}><line className="dg-interval" x1={i.x1} x2={i.x2} y1={m.y} y2={m.y} />{!i.arrowLeft && <circle className={i.fromOpen ? 'dg-open' : 'dg-dot is-key'} cx={i.x1} cy={m.y} r="5" />}{!i.arrowRight && <circle className={i.toOpen ? 'dg-open' : 'dg-dot is-key'} cx={i.x2} cy={m.y} r="5" />}</g>)}
      {m.points.map((p, k) => <g key={`pt${k}`}><circle className={p.open ? 'dg-open' : 'dg-dot is-key'} cx={p.px[0]} cy={p.px[1]} r="5.5" />{p.label && <Tex x={p.px[0]} y={p.px[1] - 18} tex={p.label} w={70} />}</g>)}
    </Figure>
  );
}

// ── Probability: tree, Venn, two-way table ───────────────────────────────────
export function TreeDiagram({ branches, title = 'A probability tree', caption = null, showOutcomes = true }) {
  const m = treeModel({ branches });
  const treeObs = m.flat.map(n => [[n.fromX, n.fromY], [n.x, n.y]]);
  const desc = `A probability tree. ${m.leaves.map(l => `${l.path.join(' then ')}: ${ftext(l.prob)}`).join('; ')}. The outcomes add to ${ftext(m.total)}.`;
  return (
    <Figure width={m.width} height={m.height} title={title} description={desc} caption={caption}>
      <circle className="dg-dot" cx={m.root.x} cy={m.root.y} r="3" />
      {m.flat.map((n, i) => <g key={i}><line className="dg-curve is-secondary" x1={n.fromX} y1={n.fromY} x2={n.x} y2={n.y} /><Tex x={(n.fromX + n.x) / 2} y={(n.fromY + n.y) / 2 - 11} tex={ftex(n.p)} w={44} h={20} className="dg-small" /><circle className="dg-dot" cx={n.x} cy={n.y} r="3" /><PTex tex={n.label} cands={[[n.x + 8, n.y - 1, 'start'], [n.x + 8, n.y - 14, 'start'], [n.x + 8, n.y + 14, 'start'], [n.x - 8, n.y - 14, 'end'], [n.x - 8, n.y + 14, 'end']]} obstacles={treeObs} w={40} h={20} className="dg-vertex" /></g>)}
      {showOutcomes && m.leaves.map((l, i) => <Tex key={`o${i}`} x={m.width - 8} y={l.y} tex={`P=${ftex(l.prob)}`} w={86} h={22} anchor="end" className="dg-outcome" />)}
    </Figure>
  );
}
export function VennDiagram({ title = 'A Venn diagram', caption = null, ...spec }) {
  const m = vennModel(spec);
  const names = m.labels;
  const desc = `A Venn diagram of ${m.sets} sets. ${Object.entries(m.regions).map(([k, v]) => `${k}: ${v.count}`).join(', ')}, outside: ${m.outside.count}. Total ${m.total}.`;
  return (
    <Figure width={m.width} height={m.height} title={title} description={desc} caption={caption}>
      <rect className="dg-shape is-universe" x="6" y="6" width={m.width - 12} height={m.height - 12} rx="6" />
      {m.centres.map((c, i) => <g key={i}><circle className={`dg-venn is-${i}`} cx={c[0]} cy={c[1]} r={m.r} /><Tex x={c[0] + (i === 0 ? -m.r * 0.72 : i === 1 ? m.r * 0.72 : 0)} y={c[1] + (i === 2 ? m.r + 12 : -m.r - 12)} tex={names[i]} w={40} h={22} className="dg-vertex" /></g>)}
      {Object.entries(m.regions).map(([k, v]) => <Tex key={k} x={v.at[0]} y={v.at[1]} tex={String(v.count)} w={44} h={22} />)}
      <Tex x={m.outside.at[0]} y={m.outside.at[1]} tex={String(m.outside.count)} w={44} h={22} />
    </Figure>
  );
}
/** A two-way table as an HTML table (it is a table), with totals computed. */
export function ProbabilityTable({ rows, cols, cells, caption = null, asFractions = false }) {
  const m = twoWayModel({ rows, cols, cells });
  const cell = v => (asFractions ? `$${ftex({ n: v, d: m.total })}$` : String(v));
  return (
    <figure className="dg dg-table" data-diagram>
      <table className="dg-grid-table">
        <caption className="dg-sr">Two-way table with row and column totals</caption>
        <thead><tr><td />{m.cols.map(c => <th key={c} scope="col"><MathText text={c} /></th>)}<th scope="col">Total</th></tr></thead>
        <tbody>{m.rows.map((r, i) => <tr key={r}><th scope="row"><MathText text={r} /></th>{m.cells[i].map((v, j) => <td key={j}><MathText text={cell(v)} /></td>)}<td className="is-total"><MathText text={cell(m.rowTotals[i])} /></td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Total</th>{m.colTotals.map((v, j) => <td key={j} className="is-total"><MathText text={cell(v)} /></td>)}<td className="is-total"><MathText text={cell(m.total)} /></td></tr></tfoot>
      </table>
      {caption && <figcaption className="dg-caption"><MathText text={caption} /></figcaption>}
    </figure>
  );
}

// ── Statistics ───────────────────────────────────────────────────────────────
export function Histogram({ title = 'A histogram', caption = null, xLabel = null, ...spec }) {
  const m = histogramModel(spec);
  const f = m.frame;
  const desc = `A histogram of ${m.total} values in ${m.counts.length} bins: ${m.bars.map(b => `${b.from} to ${b.to}: ${b.count}`).join('; ')}.`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <g className="dg-axes">
        {m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={36} h={20} anchor="end" /></g>)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} />
        <line className="dg-axis" x1={f.left} x2={f.left} y1={f.sy(0)} y2={f.top} />
      </g>
      {m.bars.map((b, i) => <rect key={i} className="dg-bar" x={b.x1} y={b.y} width={Math.max(0, b.x2 - b.x1)} height={Math.max(0, b.base - b.y)} />)}
      {m.edges.map((e, i) => <Tex key={`e${i}`} x={f.sx(e)} y={f.sy(0) + 14} tex={String(e)} w={40} h={20} />)}
      {m.bars.map((b, i) => b.count > 0 && <Tex key={`c${i}`} x={(b.x1 + b.x2) / 2} y={b.y - 9} tex={String(b.count)} w={30} h={18} className="dg-small" />)}
      {xLabel && <Tex x={f.right} y={f.height - 6} tex={xLabel} w={140} anchor="end" />}
    </Figure>
  );
}
export function BoxPlot({ title = 'A box plot', caption = null, ...spec }) {
  const m = boxPlotModel(spec);
  const s = m.summary; const px = m.px; const y = m.y; const h = m.h;
  const desc = `A box plot: minimum ${s.min}, lower quartile ${s.q1}, median ${s.median}, upper quartile ${s.q3}, maximum ${s.max}; range ${s.range}, interquartile range ${s.iqr}.${m.outliers.length ? ` The whiskers end at ${m.whisker.lo} and ${m.whisker.hi}; ${m.outliers.join(' and ')} ${m.outliers.length > 1 ? 'are outliers' : 'is an outlier'}, beyond the fences ${m.fences.lo} and ${m.fences.hi}.` : ''}`;
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <g className="dg-axes">{m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.frame.bottom} y2={m.frame.bottom + 5} /><Tex x={t.px} y={m.frame.bottom + 18} tex={String(t.value)} w={40} h={20} /></g>)}<line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.frame.bottom} y2={m.frame.bottom} /></g>
      <line className="dg-curve is-secondary" x1={px.min} y1={y} x2={px.q1} y2={y} /><line className="dg-curve is-secondary" x1={px.q3} y1={y} x2={px.max} y2={y} />
      <line className="dg-curve is-secondary" x1={px.min} y1={y - h / 3} x2={px.min} y2={y + h / 3} /><line className="dg-curve is-secondary" x1={px.max} y1={y - h / 3} x2={px.max} y2={y + h / 3} />
      <rect className="dg-box" x={px.q1} y={y - h / 2} width={px.q3 - px.q1} height={h} />
      <line className="dg-curve is-primary" x1={px.median} y1={y - h / 2} x2={px.median} y2={y + h / 2} />
      {[['min', m.whisker.lo], ['q1', s.q1], ['median', s.median], ['q3', s.q3], ['max', m.whisker.hi]].map(([k, v]) => <PTex small key={k} tex={String(v)} cands={[12, 30, 48].map(d => [px[k], y - h / 2 - d])} w={46} h={20} className="dg-small" />)}
      {m.outlierPx.map(o => <g key={`o${o.value}`}><circle className="dg-open" cx={o.px} cy={y} r="4.5" /><PTex small tex={String(o.value)} cands={[12, 30, 48].map(d => [o.px, y - h / 2 - d])} w={46} h={20} className="dg-small" /></g>)}
    </Figure>
  );
}
export function NormalCurve({ title = 'The normal distribution', caption = null, ...spec }) {
  const m = normalCurveModel(spec);
  const f = m.frame;
  const desc = `A normal curve with mean ${m.mu} and standard deviation ${m.sigma}. The shaded area from z = ${m.za} (x = ${m.xa}) to z = ${m.zb} (x = ${m.xb}) is ${m.area}, which is ${r3(m.area * 100, 2)}% of the distribution.`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} />
      {m.shade.length > 0 && <path className="dg-shade" d={`${poly(m.shade)} Z`} />}
      <path className="dg-curve is-primary" d={poly(m.curve)} fill="none" />
      {m.xTicks.map(t => <g key={t.z}><line className="dg-tick" x1={t.px} x2={t.px} y1={f.sy(0)} y2={f.sy(0) + 5} /><Tex x={t.px} y={f.sy(0) + 16} tex={m.sigma === 1 && m.mu === 0 ? String(t.z) : String(t.x)} w={44} h={20} /><Tex x={t.px} y={f.sy(0) + 31} tex={`z=${t.z}`} w={44} h={16} className="dg-small" /></g>)}
      <Tex x={(f.sx(m.xa) + f.sx(m.xb)) / 2} y={f.sy(0) - 26} tex={`${r3(m.areaExact * 100, 1)}\\%`} w={80} className="dg-area" />
    </Figure>
  );
}

// ── Vectors, sequences and finance ───────────────────────────────────────────
export function VectorDiagram({ title = 'Vectors', caption = null, ...spec }) {
  const m = vectorModel(spec);
  const f = m.frame; const x0 = m.origin[1]; const y0 = m.origin[0];
  const vObs = [[[f.left, x0], [f.right, x0]], [[y0, f.bottom], [y0, f.top]], ...m.vectors.map(v => v.px), ...(m.resultant ? [m.resultant.px] : [])];
  const desc = `${m.vectors.map(v => `Vector ${v.label || ''} = (${v.dx}, ${v.dy}), magnitude ${v.magnitude}, direction ${v.angle}°.`).join(' ')}${m.resultant ? ` Resultant = (${m.resultant.dx}, ${m.resultant.dy}), magnitude ${m.resultant.magnitude}.` : ''}`;
  const arrow = (a, b, cls, key) => <line key={key} className={`dg-vector ${cls}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} markerEnd="url(#dg-arrow)" />;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <g className="dg-axes">{m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}{m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={x0} y2={x0} markerEnd="url(#dg-arrow)" /><line className="dg-axis" x1={y0} x2={y0} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" /></g>
      {m.vectors.map((v, i) => <g key={i}>{arrow(v.px[0], v.px[1], 'is-part', `v${i}`)}{v.label && <PTex tex={v.label} cands={[[1, -1], [-1, 1], [1, 1], [-1, -1]].flatMap(([sx, sy]) => [18, 28].map(d => [(v.px[0][0] + v.px[1][0]) / 2 + sx * d, (v.px[0][1] + v.px[1][1]) / 2 + sy * d]))} obstacles={vObs} w={60} className="dg-vertex" />}</g>)}
      {m.resultant && <g>{arrow(m.resultant.px[0], m.resultant.px[1], 'is-resultant', 'res')}<PTex small tex={`\\mathbf{r}=\\begin{pmatrix}${m.resultant.dx}\\\\${m.resultant.dy}\\end{pmatrix}`} cands={[[1, -1], [-1, 1], [1, 1], [-1, -1]].flatMap(([sx, sy]) => [34, 48, 62].map(d => [(m.resultant.px[0][0] + m.resultant.px[1][0]) / 2 + sx * d, (m.resultant.px[0][1] + m.resultant.px[1][1]) / 2 + sy * d]))} obstacles={vObs} w={86} h={44} className="dg-small" /></g>}
    </Figure>
  );
}
// `type` is 'arithmetic' or 'geometric' (the spec's own `kind` names the diagram).
export function SequenceDiagram({ type = 'arithmetic', title = 'A sequence', caption = null, ...spec }) {
  const m = sequenceModel({ ...spec, kind: type }); const f = m.frame;
  const desc = `The first ${m.n} terms of a ${m.kind} sequence starting at ${m.first} with ${m.kind === 'arithmetic' ? 'common difference' : 'common ratio'} ${m.step}: ${m.terms.join(', ')}. Their sum is ${m.total}.`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <g className="dg-axes">{m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={40} h={20} anchor="end" /></g>)}<line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(Math.max(0, f.ymin))} y2={f.sy(Math.max(0, f.ymin))} /></g>
      <path className="dg-curve is-secondary" d={poly(m.points.map(p => p.px))} fill="none" strokeDasharray="4 4" />
      {m.points.map(p => <g key={p.k}><line className="dg-stem" x1={p.px[0]} x2={p.px[0]} y1={f.sy(0)} y2={p.px[1]} /><circle className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4.5" /><Tex x={p.px[0]} y={p.px[1] - 14} tex={String(p.value)} w={44} h={20} className="dg-small" /><Tex x={p.px[0]} y={f.sy(0) + 14} tex={`T_{${p.k}}`} w={40} h={20} className="dg-small" /></g>)}
    </Figure>
  );
}
export function CompoundGrowth({ title = 'Compound interest', caption = null, ...spec }) {
  const m = compoundModel(spec); const f = m.frame;
  const desc = `A $${m.principal} investment at ${r3(m.rate * 100, 3)}% per year compounded ${m.perYear} time${m.perYear === 1 ? '' : 's'} a year grows to $${m.final} after ${m.years} years, earning $${m.interest} in interest; simple interest would give $${m.simpleFinal}.`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <g className="dg-axes">{m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={`\\$${t.value}`} w={52} h={20} anchor="end" /></g>)}{m.xTicks.map(t => <Tex key={t.value} x={t.px} y={f.bottom + 14} tex={String(t.value)} w={36} h={20} />)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={f.bottom} y2={f.bottom} /><line className="dg-axis" x1={f.left} x2={f.left} y1={f.bottom} y2={f.top} /></g>
      <path className="dg-curve is-secondary" d={poly(m.simplePx)} fill="none" strokeDasharray="5 4" />
      <path className="dg-curve is-primary" d={poly(m.px)} fill="none" />
      <circle className="dg-dot is-key" cx={m.px.at(-1)[0]} cy={m.px.at(-1)[1]} r="5" />
      <Tex x={m.px.at(-1)[0] - 8} y={m.px.at(-1)[1] - 16} tex={`\\$${m.final}`} w={90} anchor="end" />
      <Tex x={f.left + 10} y={f.top + 10} tex={`A=P(1+r)^n`} w={130} anchor="start" className="dg-small" />
    </Figure>
  );
}
export function Timeline({ title = 'A timeline of payments', caption = null, ...spec }) {
  const m = timelineModel(spec);
  const desc = `A timeline of ${m.events.length} payments over ${m.end} years: ${m.events.map(e => `${e.amount >= 0 ? 'receive' : 'pay'} $${Math.abs(e.amount)} at year ${e.t}`).join('; ')}. Net ${m.net >= 0 ? '+' : '-'}$${Math.abs(m.net)}.`;
  return (
    <Figure frame={m.frame} width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <Defs />
      <line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.y} y2={m.y} markerEnd="url(#dg-arrow)" />
      {m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.y - 5} y2={m.y + 5} /><PTex small tex={String(t.value)} cands={[[t.px, m.y + 20], [t.px, m.y - 20], [t.px + 14, m.y + 20], [t.px - 14, m.y + 20]]} obstacles={m.events.map(e => [[e.px[0], m.y], [e.px[0], e.up ? m.y - 34 : m.y + 34]])} w={36} h={18} className="dg-small" /></g>)}
      {m.events.map((e, i) => <g key={i}><line className={`dg-vector ${e.up ? 'is-resultant' : 'is-part'}`} x1={e.px[0]} y1={m.y} x2={e.px[0]} y2={e.up ? m.y - 34 : m.y + 34} markerEnd="url(#dg-arrow)" /><Tex x={e.px[0]} y={e.up ? m.y - 48 : m.y + 52} tex={`${e.amount >= 0 ? '+' : '-'}\\$${Math.abs(e.amount)}`} w={80} h={20} className="dg-small" /></g>)}
    </Figure>
  );
}

// ── Tangents, secants and Riemann rectangles ─────────────────────────────────
export function SecantTangent({ title = 'A secant and a tangent', caption = null, ...spec }) {
  const m = secantTangentModel(spec); const f = m.frame;
  const desc = `The curve y = ${m.expr}. The secant through x = ${m.x0} and x = ${r3(m.x0 + m.h, 4)} has gradient ${m.secantSlope}; the tangent at x = ${m.x0} has gradient ${m.tangentSlope}.`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <Axes m={{ ...m, xTicks: niceTicks(f.xmin, f.xmax, 8).map(v => ({ value: v, px: f.sx(v) })), yTicks: niceTicks(f.ymin, f.ymax, 6).map(v => ({ value: v, px: f.sy(v) })) }} obstacles={[...m.curve, m.tangent, ...(m.secant ? [m.secant] : [])]} />
      {m.curve.map((s, i) => <path key={i} className="dg-curve is-primary" d={poly(s)} fill="none" />)}
      <line className="dg-curve is-tangent" x1={m.tangent[0][0]} y1={m.tangent[0][1]} x2={m.tangent[1][0]} y2={m.tangent[1][1]} />
      {m.secant && <line className="dg-curve is-secant" x1={m.secant[0][0]} y1={m.secant[0][1]} x2={m.secant[1][0]} y2={m.secant[1][1]} />}
      <circle className="dg-dot is-key" cx={m.p0[0]} cy={m.p0[1]} r="5" />
      {Math.abs(m.h) > 1e-9 && <circle className="dg-dot" cx={m.p1[0]} cy={m.p1[1]} r="4.5" />}
      <Tex x={f.left + 8} y={f.top + 10} tex={`\\text{secant: } ${m.secantSlope}`} w={150} anchor="start" className="dg-small is-secant" />
      <Tex x={f.left + 8} y={f.top + 30} tex={`\\text{tangent: } ${m.tangentSlope}`} w={150} anchor="start" className="dg-small is-tangent" />
    </Figure>
  );
}
export function RiemannRectangles({ title = 'Riemann rectangles', caption = null, ...spec }) {
  const m = riemannModel(spec); const f = m.frame;
  const desc = `${m.n} ${m.mode}-point rectangles under y = ${m.expr} from x = ${m.a} to x = ${m.b}, each of width ${m.width}. Their total area is ${m.sum}; the area under the curve is ${m.area}.`;
  // The readout sits in the caption, outside the plot, so it can never collide with the curve.
  const readout = caption ?? `$\\text{sum}=${r3(m.sum, 2)}$ and $\\text{area}=${r3(m.area, 2)}$`;
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={readout}>
      <Defs />
      <Axes m={m} obstacles={m.curve} />
      {m.rects.map((r, i) => <rect key={i} className="dg-bar" x={r.x1} y={r.y} width={Math.max(0, r.x2 - r.x1)} height={Math.max(0, r.base - r.y)} />)}
      {m.curve.map((s, i) => <path key={i} className="dg-curve is-primary" d={poly(s)} fill="none" />)}
    </Figure>
  );
}

// ── Networks ─────────────────────────────────────────────────────────────────
export function Network({ nodes, edges, path = [], directed = false, title = 'A network', caption = null }) {
  const m = networkModel({ nodes, edges, path, directed });
  const desc = sentence(
    `A ${directed ? 'directed ' : ''}network of ${m.nodes.length} nodes and ${m.edges.length} edges.`,
    m.edges.map(e => `${e.from} ${directed ? 'to' : 'joined to'} ${e.to}${e.label ? `, ${e.label.replace(/[\\${}]/g, '')}` : ''}.`).join(' '),
    m.path.length > 1 && m.pathOk ? `The route ${m.path.join(', ')} is highlighted${m.edges.every(e => e.weight !== null) ? `, with total ${m.pathWeight}` : ''}.` : ''
  );
  return (
    <Figure width={m.width} height={m.height} title={title} description={desc} caption={caption}>
      <Defs />
      {m.edges.map((e, i) => (
        <g key={i}>
          <line className={`dg-edge${e.inPath ? ' is-path' : ''}`} x1={e.start[0]} y1={e.start[1]} x2={e.end[0]} y2={e.end[1]} markerEnd={directed ? 'url(#dg-arrow-s)' : undefined} />
          {e.label && <Tex x={e.labelAt[0]} y={e.labelAt[1]} tex={e.label} w={56} h={20} className={e.inPath ? 'is-mark' : ''} />}
        </g>
      ))}
      {m.nodes.map(n => (
        <g key={n.id}>
          <circle className={`dg-node${n.onPath ? ' is-path' : ''}`} cx={n.px[0]} cy={n.px[1]} r={m.radius} />
          <Tex x={n.px[0]} y={n.px[1]} tex={n.label} w={32} h={22} className="dg-vertex" />
        </g>
      ))}
    </Figure>
  );
}

// ── Bivariate data ───────────────────────────────────────────────────────────
export function Scatter({ points, line = null, xLabel = 'x', yLabel = 'y', title = 'A scatterplot', caption = null, ...range }) {
  const m = scatterModel({ points, line, ...range });
  const f = m.frame;
  const desc = sentence(
    `A scatterplot of ${m.n} points: ${m.points.map(p => `(${p.x}, ${p.y})`).join(', ')}.`,
    m.line ? `A line ${m.line.fitted ? 'of best fit (least squares) ' : ''}with gradient ${m.line.m} and y-intercept ${m.line.c} is drawn.` : '',
    m.r !== null ? `The correlation coefficient is ${m.r}.` : ''
  );
  return (
    <Figure frame={f} width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      {m.xTicks.map(t => <g key={`x${t.value}`}><line className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} /><Tex x={t.px} y={f.bottom + 14} tex={String(t.value)} w={40} h={20} /></g>)}
      {m.yTicks.map(t => <g key={`y${t.value}`}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={40} h={20} anchor="end" /></g>)}
      <line className="dg-axis" x1={f.left} y1={axesOf(f).x[0][1]} x2={f.right + 6} y2={axesOf(f).x[0][1]} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={axesOf(f).y[0][0]} y1={f.bottom} x2={axesOf(f).y[0][0]} y2={f.top - 6} markerEnd="url(#dg-arrow)" />
      <PTex tex={axisTex(xLabel)} cands={[[(f.left + f.right) / 2, f.bottom + 30]]} w={140} h={20} />
      <PTex tex={axisTex(yLabel)} cands={[[f.left + 8, f.top - 4, 'start']]} w={140} h={20} />
      {!(f.ymin <= 0 && f.ymax >= 0) && <AxisBreak x={axesOf(f).y[0][0]} y={f.bottom - 14} vertical />}
      {!(f.xmin <= 0 && f.xmax >= 0) && <AxisBreak x={f.left + 14} y={axesOf(f).x[0][1]} vertical={false} />}
      {m.line?.segment && <line className="dg-curve is-secant" x1={m.line.segment[0][0]} y1={m.line.segment[0][1]} x2={m.line.segment[1][0]} y2={m.line.segment[1][1]} style={{ strokeDasharray: 'none' }} />}
      {m.points.map((p, i) => <circle key={i} className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4.5" />)}
    </Figure>
  );
}

// ── Solids ───────────────────────────────────────────────────────────────────
const SOLID_NAME = { rectPrism: 'rectangular prism', cylinder: 'cylinder', cone: 'cone', sphere: 'sphere', pyramid: 'rectangular pyramid' };
export function Solid({ title = null, caption = null, ...spec }) {
  const m = solidModel(spec);
  const dims = { rectPrism: `length ${spec.l ?? 4}, width ${spec.w ?? 3}, height ${spec.h ?? 3}`, pyramid: `base ${spec.l ?? 4} by ${spec.w ?? 3}, height ${spec.h ?? 3}`, cylinder: `radius ${spec.r ?? 2}, height ${spec.h ?? 3}`, cone: `radius ${spec.r ?? 2}, height ${spec.h ?? 3}`, sphere: `radius ${spec.r ?? 2}` }[m.shape];
  const desc = `A ${SOLID_NAME[m.shape]}: ${dims}. Its volume is ${r3(m.volume, 2)} cubic units.`;
  return (
    <Figure width={m.width} height={m.height} title={title || `A ${SOLID_NAME[m.shape]}`} description={desc} caption={caption} className="dg-square">
      {m.hidden.map((pts, i) => <path key={`h${i}`} className="dg-hidden" d={poly(pts)} />)}
      {m.solid.map((pts, i) => <path key={`s${i}`} className="dg-solid" d={poly(pts)} />)}
      {m.marks.map((k, i) => <line key={`m${i}`} className="dg-hidden is-mark" x1={k.from[0]} y1={k.from[1]} x2={k.to[0]} y2={k.to[1]} />)}
      {m.labels.map((l, i) => <Tex key={`l${i}`} x={l.at[0]} y={l.at[1]} tex={l.tex} w={44} h={20} className="dg-small" />)}
    </Figure>
  );
}
