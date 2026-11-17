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
import React, { useId } from 'react';
import { MathText } from '../lib/latex.jsx';
import './diagrams.css';
import {
  functionGraphModel, unitCircleModel, triangleModel, regularPolygonModel, circleTheoremModel, numberLineModel, treeModel, vennModel,
  twoWayModel, histogramModel, boxPlotModel, normalCurveModel, vectorModel, sequenceModel, compoundModel, timelineModel,
  secantTangentModel, riemannModel, ftex, ftext, r3
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

/** The figure shell: an accessible SVG with a title, a description (the text alternative) and an optional caption. */
export function Figure({ width, height, title, description, caption = null, children, className = '', svgProps = {} }) {
  const id = useId();
  return (
    <figure className={`dg ${className}`} data-diagram>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet" className="dg-svg" {...svgProps}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{description}</desc>
        {children}
      </svg>
      {caption && <figcaption className="dg-caption"><MathText text={caption} /></figcaption>}
    </figure>
  );
}

function Axes({ m, grid = true, labels = true, xLabel = null, yLabel = null }) {
  const f = m.frame;
  const x0 = m.axes.x[0][1]; const y0 = m.axes.y[0][0];
  return (
    <g className="dg-axes">
      {grid && m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
      {grid && m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
      <line className="dg-axis" x1={m.axes.x[0][0]} x2={m.axes.x[1][0]} y1={x0} y2={x0} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={y0} x2={y0} y1={m.axes.y[1][1]} y2={m.axes.y[0][1]} markerEnd="url(#dg-arrow)" />
      {labels && m.xTicks.filter(t => t.value !== 0).map(t => <Tex key={`lx${t.value}`} x={t.px} y={x0 + 14} tex={String(t.value)} w={40} h={20} />)}
      {labels && m.yTicks.filter(t => t.value !== 0).map(t => <Tex key={`ly${t.value}`} x={y0 - 6} y={t.px} tex={String(t.value)} w={40} h={20} anchor="end" />)}
      {xLabel && <Tex x={f.right} y={x0 - 12} tex={xLabel} w={36} h={20} anchor="end" />}
      {yLabel && <Tex x={y0 + 8} y={f.top - 2} tex={yLabel} w={36} h={20} anchor="start" />}
    </g>
  );
}
export function Defs() {
  return <defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="dg-arrowhead" /></marker></defs>;
}

const sentence = (...parts) => parts.filter(Boolean).join(' ');

// ── Function graphs ──────────────────────────────────────────────────────────
export function FunctionGraph({ title = 'Graph of a function', caption = null, xLabel = 'x', yLabel = 'y', hideIntercepts = false, ...spec }) {
  const m = functionGraphModel(spec);
  const desc = sentence(
    `Axes: x from ${r3(m.frame.xmin, 2)} to ${r3(m.frame.xmax, 2)}, y from ${r3(m.frame.ymin, 2)} to ${r3(m.frame.ymax, 2)}.`,
    m.curves.map(c => `${c.label ? `Curve ${c.label.replace(/[\\${}]/g, '')}` : 'A curve'}: y = ${c.expr}.${c.shade ? ` The area between it and the x-axis from x = ${c.shade.from} to x = ${c.shade.to} is shaded.` : ''}`).join(' '),
    m.curves.flatMap(c => [c.yIntercept ? `It crosses the y-axis at ${c.yIntercept.y}.` : '', c.xIntercepts?.length ? `It crosses the x-axis at x = ${c.xIntercepts.map(i => i.x).join(', ')}.` : '']).join(' '),
    m.asymptotes.map(a => `${a.axis === 'x' ? 'Vertical' : 'Horizontal'} asymptote ${a.axis} = ${a.value}.`).join(' ')
  );
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <Defs />
      <Axes m={m} xLabel={xLabel} yLabel={yLabel} />
      {m.asymptotes.map((a, i) => (
        <g key={`as${i}`}><line className="dg-asymptote" x1={a.px[0][0]} y1={a.px[0][1]} x2={a.px[1][0]} y2={a.px[1][1]} />{a.label && <Tex x={a.axis === 'x' ? a.px[0][0] + 4 : a.px[1][0] - 4} y={a.axis === 'x' ? a.px[0][1] + 12 : a.px[0][1] - 12} tex={a.label} w={70} anchor={a.axis === 'x' ? 'start' : 'end'} />}</g>
      ))}
      {m.curves.map(c => c.shade && c.shade.path.length > 0 && <path key={`sh${c.id}`} className="dg-shade" d={`${poly(c.shade.path)} Z`} />)}
      {m.curves.map(c => c.segments.map((seg, k) => <path key={`${c.id}${k}`} className={`dg-curve is-${c.tone}`} d={poly(seg)} />))}
      {!hideIntercepts && m.curves.flatMap(c => [c.yIntercept, ...(c.xIntercepts || [])].filter(Boolean).map((p, i) => <g key={`ic${c.id}${i}`}><circle className="dg-dot" cx={p.px[0]} cy={p.px[1]} r="4" /><Tex x={p.px[0] + 8} y={p.px[1] - 12} tex={`(${p.x},\\,${p.y})`} w={80} anchor="start" /></g>))}
      {m.points.map((p, i) => <g key={`pt${i}`}><circle className="dg-dot is-key" cx={p.px[0]} cy={p.px[1]} r="4.5" />{p.label && <Tex x={p.px[0] + 8} y={p.px[1] - 12} tex={p.label} w={90} anchor="start" />}</g>)}
      {m.curves.map(c => c.label && <Tex key={`lb${c.id}`} x={Math.min(m.frame.right - 40, (c.segments.at(-1)?.at(-1)?.[0] ?? m.frame.right) - 4)} y={(c.segments.at(-1)?.at(-1)?.[1] ?? m.frame.top) - 12} tex={c.label} w={110} anchor="end" className="dg-curve-label" />)}
    </Figure>
  );
}

// ── The unit circle and trig graphs ──────────────────────────────────────────
export function UnitCircle({ deg = 30, showTan = false, title = 'The unit circle', caption = null, overlay = null, svgProps = {} }) {
  const m = unitCircleModel({ deg });
  const p = m.point;
  const desc = `A point on the unit circle at ${p.deg} degrees: cosine ${p.cos}, sine ${p.sin}${p.tan !== null ? `, tangent ${p.tan}` : ', tangent undefined'}. Quadrant ${p.quadrant || 'on an axis'}, reference angle ${p.reference} degrees.`;
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption} className="dg-square" svgProps={svgProps}>
      <Defs />
      <line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.centre[1]} y2={m.centre[1]} markerEnd="url(#dg-arrow)" />
      <line className="dg-axis" x1={m.centre[0]} x2={m.centre[0]} y1={m.frame.bottom} y2={m.frame.top} markerEnd="url(#dg-arrow)" />
      <circle className="dg-curve is-secondary" cx={m.centre[0]} cy={m.centre[1]} r={m.radius} fill="none" />
      {m.ticks.map(t => <g key={t.deg}><circle className="dg-tick-dot" cx={t.on[0]} cy={t.on[1]} r="2.2" /><Tex x={t.px[0]} y={t.px[1]} tex={`${t.deg}^{\\circ}`} w={44} h={18} className="dg-small" /></g>)}
      <path className="dg-arc" d={poly(m.arc)} fill="none" />
      <line className="dg-curve is-primary" x1={m.centre[0]} y1={m.centre[1]} x2={m.px[0]} y2={m.px[1]} />
      <line className="dg-dash is-cos" x1={m.px[0]} y1={m.px[1]} x2={m.foot[0]} y2={m.foot[1]} />
      <line className="dg-dash is-sin" x1={m.centre[0]} y1={m.centre[1]} x2={m.foot[0]} y2={m.foot[1]} />
      <circle className="dg-dot is-key" cx={m.px[0]} cy={m.px[1]} r="5" />
      <Tex x={p.cos >= 0 ? Math.min(m.px[0] + 10, m.frame.width - 128) : Math.max(m.px[0] - 10, 128)} y={m.px[1] + (p.sin >= 0 ? -16 : 16)} tex={`(${p.cos},\\,${p.sin})`} w={120} anchor={p.cos >= 0 ? 'start' : 'end'} />
      <Tex x={m.centre[0] + 36} y={m.centre[1] - 8} tex={`\\theta=${p.deg}^{\\circ}`} w={90} anchor="start" className="dg-small" />
      {showTan && p.tan !== null && <Tex x={m.frame.left + 8} y={m.frame.top + 12} tex={`\\tan\\theta=${p.tan}`} w={150} anchor="start" />}
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
  const piLabel = v => ({ [-6.283]: '-2\\pi', [-3.142]: '-\\pi', 3.142: '\\pi', 6.283: '2\\pi' })[r3(v, 3)] || null;
  return (
    <Figure width={f.width} height={f.height} title={title || `Graph of y = ${a}${fn}(${b}(x - ${c})) + ${d}`} description={`A ${fn} curve with amplitude ${fn === 'tan' ? 'none' : Math.abs(a)}, period ${r3(period, 4)} radians, shifted ${c} right and ${d} up.`} caption={caption}>
      <Defs />
      <g className="dg-axes">
        {m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
        {m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={y0} y2={y0} markerEnd="url(#dg-arrow)" />
        <line className="dg-axis" x1={m.axes.y[0][0]} x2={m.axes.y[0][0]} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" />
        {m.xTicks.map(t => piLabel(t.value) && <Tex key={`lx${t.value}`} x={t.px} y={y0 + 14} tex={piLabel(t.value)} w={44} h={20} />)}
        {m.yTicks.filter(t => t.value !== 0).map(t => <Tex key={`ly${t.value}`} x={m.axes.y[0][0] - 6} y={t.px} tex={String(t.value)} w={40} h={20} anchor="end" />)}
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
  const sideLabel = (k, p, away) => <Tex key={k} x={p[0] + away[0]} y={p[1] + away[1]} tex={String(m.sides[k])} w={46} h={22} className="dg-side" />;
  const cx = (V.A[0] + V.B[0] + V.C[0]) / 3; const cy = (V.A[1] + V.B[1] + V.C[1]) / 3;
  const away = p => { const dx = p[0] - cx; const dy = p[1] - cy; const n = Math.hypot(dx, dy) || 1; return [(dx / n) * 16, (dy / n) * 16]; };
  const corner = (k) => { const p = V[k]; const dx = cx - p[0]; const dy = cy - p[1]; const n = Math.hypot(dx, dy) || 1; return [p[0] + (dx / n) * 46, p[1] + (dy / n) * 46]; };
  const rightMark = m.right ? (() => { const p = V[m.right]; const others = Object.keys(V).filter(k => k !== m.right).map(k => V[k]); const u = others.map(q => { const dx = q[0] - p[0]; const dy = q[1] - p[1]; const n = Math.hypot(dx, dy) || 1; return [dx / n * 14, dy / n * 14]; }); return `M${p[0] + u[0][0]} ${p[1] + u[0][1]} L${p[0] + u[0][0] + u[1][0]} ${p[1] + u[0][1] + u[1][1]} L${p[0] + u[1][0]} ${p[1] + u[1][1]}`; })() : null;
  const desc = `Triangle ABC with sides a = ${m.sides.a}, b = ${m.sides.b}, c = ${m.sides.c}; angles A = ${m.angles.A}°, B = ${m.angles.B}°, C = ${m.angles.C}°${m.right ? `, a right angle at ${m.right}` : ''}; area ${m.area}.`;
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <path className="dg-shape" d={`M${V.A[0]} ${V.A[1]} L${V.B[0]} ${V.B[1]} L${V.C[0]} ${V.C[1]} Z`} />
      {rightMark && <path className="dg-rightmark" d={rightMark} fill="none" />}
      {labels.sides && <>{sideLabel('a', m.midpoints.a, away(m.midpoints.a))}{sideLabel('b', m.midpoints.b, away(m.midpoints.b))}{sideLabel('c', m.midpoints.c, away(m.midpoints.c))}</>}
      {['A', 'B', 'C'].map(k => <Tex key={k} x={V[k][0] + away(V[k])[0] * 1.4} y={V[k][1] + away(V[k])[1] * 1.4} tex={k} w={24} h={22} className="dg-vertex" />)}
      {labels.angles && ['A', 'B', 'C'].filter(k => k !== m.right).map(k => <Tex key={`an${k}`} x={corner(k)[0]} y={corner(k)[1]} tex={`${r3(m.angles[k], 1)}^{\\circ}`} w={60} h={20} className="dg-small" />)}
      {showArea && <Tex x={cx} y={cy} tex={`\\text{area}=${m.area}`} w={110} className="dg-small" />}
    </Figure>
  );
}
export function RegularPolygon({ n = 5, side = 1, title = null, caption = null }) {
  const m = regularPolygonModel({ n, side });
  const cx = m.frame.sx(0); const cy = m.frame.sy(0);
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || `A regular polygon with ${n} sides`} description={`A regular polygon with ${n} sides each of length ${m.side}; each interior angle is ${m.interior}°, each exterior angle ${m.exterior}°, and the interior angles add to ${m.angleSum}°.`} caption={caption}>
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
  const nudge = (name) => { const p = P[name]; const dx = p[0] - m.centre[0]; const dy = p[1] - m.centre[1]; const n = Math.hypot(dx, dy) || 1; return [p[0] + (dx / n) * 16 || p[0] + 16, p[1] + (dy / n) * 16]; };
  const markPos = k => { const v = P[k.at]; const a = P[k.between[0]]; const b = P[k.between[1]]; const mx = (a[0] + b[0]) / 2 - v[0]; const my = (a[1] + b[1]) / 2 - v[1]; const n = Math.hypot(mx, my) || 1; return [v[0] + (mx / n) * 38, v[1] + (my / n) * 38]; };
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title || labelOf} description={desc} caption={caption || labelOf} className="dg-square">
      <circle className="dg-shape" cx={m.centre[0]} cy={m.centre[1]} r={m.radius} />
      {m.lines.map(([p, q], i) => <line key={i} className={`dg-curve is-${theorem === 'tangent' && i === 1 ? 'primary' : 'secondary'}`} x1={P[p][0]} y1={P[p][1]} x2={P[q][0]} y2={P[q][1]} />)}
      {Object.keys(P).map(k => <g key={k}><circle className="dg-dot" cx={P[k][0]} cy={P[k][1]} r={k === 'O' ? 3 : 4} />{!/^E/.test(k) && <Tex x={nudge(k)[0]} y={nudge(k)[1]} tex={k} w={24} h={22} className="dg-vertex" />}</g>)}
      {m.marks.map((k, i) => <Tex key={i} x={markPos(k)[0]} y={markPos(k)[1]} tex={`${k.value}^{\\circ}`} w={58} h={20} className="dg-small is-mark" />)}
    </Figure>
  );
}

// ── Number lines ─────────────────────────────────────────────────────────────
export function NumberLine({ title = 'A number line', caption = null, ...spec }) {
  const m = numberLineModel(spec);
  const desc = sentence(m.points.map(p => `${p.open ? 'Open' : 'Closed'} point at ${p.value}.`).join(' '), m.intervals.map(i => `Shaded from ${i.from === null ? 'the left' : `${i.from}${i.fromOpen ? ' (not included)' : ''}`} to ${i.to === null ? 'the right' : `${i.to}${i.toOpen ? ' (not included)' : ''}`}.`).join(' '));
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc || 'An empty number line.'} caption={caption}>
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
  const desc = `A probability tree. ${m.leaves.map(l => `${l.path.join(' then ')}: ${ftext(l.prob)}`).join('; ')}. The outcomes add to ${ftext(m.total)}.`;
  return (
    <Figure width={m.width} height={m.height} title={title} description={desc} caption={caption}>
      <circle className="dg-dot" cx={m.root.x} cy={m.root.y} r="3" />
      {m.flat.map((n, i) => <g key={i}><line className="dg-curve is-secondary" x1={n.fromX} y1={n.fromY} x2={n.x} y2={n.y} /><Tex x={(n.fromX + n.x) / 2} y={(n.fromY + n.y) / 2 - 11} tex={ftex(n.p)} w={44} h={20} className="dg-small" /><circle className="dg-dot" cx={n.x} cy={n.y} r="3" /><Tex x={n.x + 8} y={n.y - 1} tex={n.label} w={40} h={20} anchor="start" className="dg-vertex" /></g>)}
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
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <g className="dg-axes">
        {m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={36} h={20} anchor="end" /></g>)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} />
        <line className="dg-axis" x1={f.left} x2={f.left} y1={f.sy(0)} y2={f.top} />
      </g>
      {m.bars.map((b, i) => <rect key={i} className="dg-bar" x={b.x1} y={b.y} width={Math.max(0, b.x2 - b.x1 - 1)} height={Math.max(0, b.base - b.y)} />)}
      {m.edges.map((e, i) => <Tex key={`e${i}`} x={f.sx(e)} y={f.sy(0) + 14} tex={String(e)} w={40} h={20} />)}
      {m.bars.map((b, i) => b.count > 0 && <Tex key={`c${i}`} x={(b.x1 + b.x2) / 2} y={b.y - 9} tex={String(b.count)} w={30} h={18} className="dg-small" />)}
      {xLabel && <Tex x={f.right} y={f.height - 6} tex={xLabel} w={140} anchor="end" />}
    </Figure>
  );
}
export function BoxPlot({ title = 'A box plot', caption = null, ...spec }) {
  const m = boxPlotModel(spec);
  const s = m.summary; const px = m.px; const y = m.y; const h = m.h;
  const desc = `A box plot: minimum ${s.min}, lower quartile ${s.q1}, median ${s.median}, upper quartile ${s.q3}, maximum ${s.max}; range ${s.range}, interquartile range ${s.iqr}.`;
  return (
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <g className="dg-axes">{m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.frame.bottom} y2={m.frame.bottom + 5} /><Tex x={t.px} y={m.frame.bottom + 18} tex={String(t.value)} w={40} h={20} /></g>)}<line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.frame.bottom} y2={m.frame.bottom} /></g>
      <line className="dg-curve is-secondary" x1={px.min} y1={y} x2={px.q1} y2={y} /><line className="dg-curve is-secondary" x1={px.q3} y1={y} x2={px.max} y2={y} />
      <line className="dg-curve is-secondary" x1={px.min} y1={y - h / 3} x2={px.min} y2={y + h / 3} /><line className="dg-curve is-secondary" x1={px.max} y1={y - h / 3} x2={px.max} y2={y + h / 3} />
      <rect className="dg-box" x={px.q1} y={y - h / 2} width={px.q3 - px.q1} height={h} />
      <line className="dg-curve is-primary" x1={px.median} y1={y - h / 2} x2={px.median} y2={y + h / 2} />
      {[['min', s.min], ['q1', s.q1], ['median', s.median], ['q3', s.q3], ['max', s.max]].map(([k, v], i) => <Tex key={k} x={px[k]} y={y - h / 2 - (i % 2 ? 22 : 12)} tex={String(v)} w={46} h={20} className="dg-small" />)}
    </Figure>
  );
}
export function NormalCurve({ title = 'The normal distribution', caption = null, ...spec }) {
  const m = normalCurveModel(spec);
  const f = m.frame;
  const desc = `A normal curve with mean ${m.mu} and standard deviation ${m.sigma}. The shaded area from z = ${m.za} (x = ${m.xa}) to z = ${m.zb} (x = ${m.xb}) is ${m.area}, which is ${r3(m.area * 100, 2)}% of the distribution.`;
  return (
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} />
      {m.shade.length > 0 && <path className="dg-shade" d={`${poly(m.shade)} Z`} />}
      <path className="dg-curve is-primary" d={poly(m.curve)} fill="none" />
      {m.xTicks.map(t => <g key={t.z}><line className="dg-tick" x1={t.px} x2={t.px} y1={f.sy(0)} y2={f.sy(0) + 5} /><Tex x={t.px} y={f.sy(0) + 16} tex={m.sigma === 1 && m.mu === 0 ? String(t.z) : String(t.x)} w={44} h={20} /><Tex x={t.px} y={f.sy(0) + 31} tex={`z=${t.z}`} w={44} h={16} className="dg-small" /></g>)}
      <Tex x={(f.sx(m.xa) + f.sx(m.xb)) / 2} y={f.sy(0) - 26} tex={`${r3(m.area * 100, 1)}\\%`} w={80} className="dg-area" />
    </Figure>
  );
}

// ── Vectors, sequences and finance ───────────────────────────────────────────
export function VectorDiagram({ title = 'Vectors', caption = null, ...spec }) {
  const m = vectorModel(spec);
  const f = m.frame; const x0 = m.origin[1]; const y0 = m.origin[0];
  const desc = `${m.vectors.map(v => `Vector ${v.label || ''} = (${v.dx}, ${v.dy}), magnitude ${v.magnitude}, direction ${v.angle}°.`).join(' ')}${m.resultant ? ` Resultant = (${m.resultant.dx}, ${m.resultant.dy}), magnitude ${m.resultant.magnitude}.` : ''}`;
  const arrow = (a, b, cls, key) => <line key={key} className={`dg-vector ${cls}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} markerEnd="url(#dg-arrow)" />;
  return (
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <g className="dg-axes">{m.xTicks.map(t => <line key={`gx${t.value}`} className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} />)}{m.yTicks.map(t => <line key={`gy${t.value}`} className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} />)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={x0} y2={x0} markerEnd="url(#dg-arrow)" /><line className="dg-axis" x1={y0} x2={y0} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" /></g>
      {m.vectors.map((v, i) => <g key={i}>{arrow(v.px[0], v.px[1], 'is-part', `v${i}`)}{v.label && <Tex x={(v.px[0][0] + v.px[1][0]) / 2 + 12} y={(v.px[0][1] + v.px[1][1]) / 2 - 12} tex={v.label} w={60} className="dg-vertex" />}</g>)}
      {m.resultant && <g>{arrow(m.resultant.px[0], m.resultant.px[1], 'is-resultant', 'res')}<Tex x={(m.resultant.px[0][0] + m.resultant.px[1][0]) / 2 - 14} y={(m.resultant.px[0][1] + m.resultant.px[1][1]) / 2 + 14} tex={`\\mathbf{r}=\\begin{pmatrix}${m.resultant.dx}\\\\${m.resultant.dy}\\end{pmatrix}`} w={86} h={44} className="dg-small" /></g>}
    </Figure>
  );
}
// `type` is 'arithmetic' or 'geometric' (the spec's own `kind` names the diagram).
export function SequenceDiagram({ type = 'arithmetic', title = 'A sequence', caption = null, ...spec }) {
  const m = sequenceModel({ ...spec, kind: type }); const f = m.frame;
  const desc = `The first ${m.n} terms of a ${m.kind} sequence starting at ${m.first} with ${m.kind === 'arithmetic' ? 'common difference' : 'common ratio'} ${m.step}: ${m.terms.join(', ')}. Their sum is ${m.total}.`;
  return (
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
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
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
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
    <Figure width={m.frame.width} height={m.frame.height} title={title} description={desc} caption={caption}>
      <Defs />
      <line className="dg-axis" x1={m.frame.left} x2={m.frame.right} y1={m.y} y2={m.y} markerEnd="url(#dg-arrow)" />
      {m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.y - 5} y2={m.y + 5} /><Tex x={t.px} y={m.y + 20} tex={String(t.value)} w={36} h={18} className="dg-small" /></g>)}
      {m.events.map((e, i) => <g key={i}><line className={`dg-vector ${e.up ? 'is-resultant' : 'is-part'}`} x1={e.px[0]} y1={m.y} x2={e.px[0]} y2={e.up ? m.y - 34 : m.y + 34} markerEnd="url(#dg-arrow)" /><Tex x={e.px[0]} y={e.up ? m.y - 48 : m.y + 52} tex={`${e.amount >= 0 ? '+' : '-'}\\$${Math.abs(e.amount)}`} w={80} h={20} className="dg-small" /></g>)}
    </Figure>
  );
}

// ── Tangents, secants and Riemann rectangles ─────────────────────────────────
export function SecantTangent({ title = 'A secant and a tangent', caption = null, ...spec }) {
  const m = secantTangentModel(spec); const f = m.frame;
  const desc = `The curve y = ${m.expr}. The secant through x = ${m.x0} and x = ${r3(m.x0 + m.h, 4)} has gradient ${m.secantSlope}; the tangent at x = ${m.x0} has gradient ${m.tangentSlope}.`;
  return (
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} markerEnd="url(#dg-arrow)" /><line className="dg-axis" x1={f.sx(0)} x2={f.sx(0)} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" />
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
  return (
    <Figure width={f.width} height={f.height} title={title} description={desc} caption={caption}>
      <Defs />
      <g className="dg-axes">{m.xTicks.map(t => <g key={t.value}><line className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} /><Tex x={t.px} y={f.bottom + 14} tex={String(t.value)} w={36} h={20} /></g>)}{m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={40} h={20} anchor="end" /></g>)}
        <line className="dg-axis" x1={f.left} x2={f.right} y1={f.sy(0)} y2={f.sy(0)} markerEnd="url(#dg-arrow)" /><line className="dg-axis" x1={f.left} x2={f.left} y1={f.bottom} y2={f.top} markerEnd="url(#dg-arrow)" /></g>
      {m.rects.map((r, i) => <rect key={i} className="dg-bar" x={r.x1} y={r.y} width={Math.max(0, r.x2 - r.x1)} height={Math.max(0, r.base - r.y)} />)}
      {m.curve.map((s, i) => <path key={i} className="dg-curve is-primary" d={poly(s)} fill="none" />)}
      <Tex x={f.right - 6} y={f.top + 10} tex={`\\text{sum}=${m.sum}`} w={140} anchor="end" className="dg-small" />
      <Tex x={f.right - 6} y={f.top + 30} tex={`\\text{area}=${m.area}`} w={140} anchor="end" className="dg-small" />
    </Figure>
  );
}
