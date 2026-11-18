// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "stats": the components. Kinds, specs and the pure
// models are in ./stats.kinds.js (docs/design/notes-e3-contract.md §2).
//
// Static: barChart, pieChart, pascal, binomial. Interactive (Notes only):
// binomialExplorer (→ binomial), probabilitySim (→ barChart of the theoretical
// probabilities), dataExplorer (→ boxPlot). Every number drawn or said comes from the
// model; every word comes from STATS_TEXT in the reader's language. Colour is never
// the only signal: highlighted bars are hatched, the theoretical probability is a
// dashed line, movable dots are open rings.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useMemo, useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import { Figure, Tex } from '../Diagram.jsx';
import { Slider } from '../Interactive.jsx';
import { useKitText } from '../kitText.js';
import { r3, ftex } from '../geometry.js';
import '../diagrams.css';
import './stats.css';
import {
  STATS_TEXT, barChartModel, pieChartModel, pascalModel, binomialModel, probabilitySimModel, dataExplorerModel, dataStats, changedMeasures,
  experimentOutcomes, simStart, simAdd, plain, highlightSet, eventTex, eventText, SIM_MAX_TRIALS
} from './stats.kinds.js';

// Plain words (a category name) are set through KaTeX too, as \text{…}, so every figure label is typeset the same way.
const texWords = t => (/\$/.test(t) ? t : `$\\text{${String(t).replace(/([\\{}$&#^_%~])/g, '\\$1')}}$`);
/** A label that may mix words and $…$ maths (MathText), placed like Tex. */
function Label({ x, y, text, w = 80, h = 20, anchor = 'middle', className = '' }) {
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return (
    <foreignObject x={r3(left)} y={r3(y - h / 2)} width={w} height={h} className={`dg-tex ${className}`} style={{ overflow: 'visible' }}>
      <div xmlns="http://www.w3.org/1999/xhtml" className={`dg-tex-in is-${anchor}`}><MathText text={texWords(text)} /></div>
    </foreignObject>
  );
}
/** A hatch pattern (the non-colour mark of a highlighted bar) with an id unique to this figure. */
function useHatch() {
  const id = `dgs-h${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const def = <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line className="dgs-hatch-line" x1="0" y1="0" x2="0" y2="6" /></pattern>;
  return [`url(#${id})`, def];
}
/** The interactive shell (as Interactive.jsx's): a titled section, the figure, controls and a polite live region. */
function Shell({ title, children, controls, readout, legend = null, className = '' }) {
  const id = useId();
  return (
    <section className={`dgi ${className}`} aria-labelledby={`${id}-h`} data-diagram-interactive>
      <h4 className="dgi-title" id={`${id}-h`}>{title}</h4>
      {children}
      {legend}
      <div className="dgi-controls">{controls}</div>
      <p className="dgi-readout" role="status" aria-live="polite"><MathText text={readout} /></p>
    </section>
  );
}
const list = items => items.join('; ');

// ── Bar chart ────────────────────────────────────────────────────────────────
export function BarChart({ title = null, caption = null, ...params }) {
  const tk = useKitText(STATS_TEXT);
  const [hatch, hatchDef] = useHatch();
  const m = barChartModel(params);
  const f = m.frame;
  const catLabel = (c, i) => (params.experiment && experimentOutcomes(params)[i].key ? tk(experimentOutcomes(params)[i].key) : c.text);
  const names = m.categories.map((c, i) => plain(catLabel({ text: c }, i)));
  const vt = m.bars.reduce((a, b) => { (a[b.i] ||= [])[b.series] = plain(b.tex); return a; }, []);
  const seriesA = m.label || tk('seriesFirst'); const seriesB = m.dualLabel || tk('seriesSecond');
  const desc = m.theory
    ? tk('theoryDesc', { list: list(names.map((c, i) => `${c} ${vt[i][0]}`)) })
    : m.dual
      ? tk('barDescDual', { n: m.n, a: plain(seriesA), b: plain(seriesB), list: list(names.map((c, i) => `${c} ${vt[i][0]} / ${vt[i][1]}`)) })
      : tk('barDesc', { n: m.n, list: list(names.map((c, i) => `${c} ${vt[i][0]}`)) });
  const H = m.horizontal;
  return (
    <Figure width={f.width} height={f.height} title={title || tk(m.theory ? 'theoryTitle' : 'barTitle')} description={desc} caption={caption}>
      <defs>{hatchDef}</defs>
      <g className="dg-axes">
        {m.ticks.map(t => (H
          ? <g key={t.value}><line className="dg-grid" x1={t.px} x2={t.px} y1={f.top} y2={f.bottom} /><Tex x={t.px} y={f.bottom + 14} tex={String(t.value)} w={44} h={20} /></g>
          : <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={Math.min(48, f.left - 4)} h={20} anchor="end" /></g>))}
      </g>
      {m.bars.map((b, k) => (
        <g key={k}>
          <rect className={`dg-bar${b.series ? ' dgs-bar-2' : ''}`} x={b.x} y={b.y} width={Math.max(0, b.w)} height={Math.max(0, b.h)} />
          {b.series === 1 && <rect className="dgs-hatch" x={b.x} y={b.y} width={Math.max(0, b.w)} height={Math.max(0, b.h)} fill={hatch} />}
        </g>
      ))}
      {H
        ? <line className="dg-axis" x1={m.base} x2={m.base} y1={f.top} y2={f.bottom} />
        : <line className="dg-axis" x1={f.left} x2={f.right} y1={m.base} y2={m.base} />}
      {H ? <line className="dg-axis" x1={f.left} x2={f.right} y1={f.bottom} y2={f.bottom} /> : <line className="dg-axis" x1={f.left} x2={f.left} y1={f.top} y2={f.bottom} />}
      {m.showValues && m.bars.map((b, k) => <Tex key={`v${k}`} x={b.label.x} y={b.label.y} tex={b.tex} w={H ? m.valW : 50} h={18} anchor={H ? b.label.anchor : 'middle'} className="dg-small" />)}
      {m.cats.map((c, i) => c.shown && <Label key={`c${i}`} x={c.x} y={c.y} text={catLabel(c, i)} w={H ? m.catW : Math.max(40, m.slot * (m.axis.mode === 'stagger' ? 2 : m.axis.every) - 4)} h={18} anchor={H ? 'end' : 'middle'} className="dgs-cat" />)}
      {m.yLabel && <Label x={H ? f.right : f.left - 4} y={H ? f.bottom + 30 : f.top - (m.dual ? 34 : 14)} text={!/\$/.test(m.yLabel) && m.yLabel.length <= 2 ? `$${m.yLabel}$` : m.yLabel} w={160} h={18} anchor={H ? 'end' : 'start'} className="dg-small" />}
      {m.xLabel && <Label x={(f.left + f.right) / 2} y={f.height - 9} text={m.xLabel} w={200} h={18} className="dg-small" />}
      {m.dual && (
        <g className="dgs-legend-svg">
          <rect className="dg-bar" x={f.right - 210} y={8} width={14} height={12} />
          <Label x={f.right - 192} y={14} text={seriesA} w={84} h={18} anchor="start" className="dg-small" />
          <rect className="dg-bar dgs-bar-2" x={f.right - 104} y={8} width={14} height={12} /><rect className="dgs-hatch" x={f.right - 104} y={8} width={14} height={12} fill={hatch} />
          <Label x={f.right - 86} y={14} text={seriesB} w={86} h={18} anchor="start" className="dg-small" />
        </g>
      )}
    </Figure>
  );
}

// ── Pie chart ────────────────────────────────────────────────────────────────
export function PieChart({ title = null, caption = null, categories, values }) {
  const tk = useKitText(STATS_TEXT);
  const m = pieChartModel({ categories, values });
  const desc = tk('pieDesc', { n: m.sectors.length, total: r3(m.total, 4), sum: m.angleSum, list: list(m.sectors.map(s => `${plain(s.category)} ${r3(s.value, 4)} (${s.percent}%), ${s.angle}°`)) });
  return (
    <Figure width={m.width} height={m.height} title={title || tk('pieTitle')} description={desc} caption={caption}>
      {m.sectors.map(s => (s.path
        ? <path key={s.i} className={`dgs-sector is-${s.i % 6}`} d={s.path} />
        : <circle key={s.i} className={`dgs-sector is-${s.i % 6}`} cx={m.cx} cy={m.cy} r={m.r} />))}
      {m.sectors.map(s => <path key={`l${s.i}`} className="dgs-leader" d={`M${s.rim[0]} ${s.rim[1]} L${s.elbow[0]} ${s.elbow[1]} L${r3(s.lx + (s.anchor === 'start' ? -4 : 4))} ${s.ly}`} />)}
      {m.sectors.map(s => <Label key={`t${s.i}`} x={s.lx} y={s.ly} text={`${s.text} $\\;${s.angle}^{\\circ}$`} w={110} h={20} anchor={s.anchor} />)}
    </Figure>
  );
}

// ── Pascal's triangle ────────────────────────────────────────────────────────
export function Pascal({ rows = 5, highlight = [], show = 'values', sums = true, title = null, caption = null }) {
  const tk = useKitText(STATS_TEXT);
  const m = pascalModel({ rows, highlight, show, sums });
  const last = m.entries.filter(e => e.n === rows).map(e => e.value).join(', ');
  const desc = [
    tk('pascalDesc', { rows, last }),
    sums ? tk('pascalDescSums', { sums: m.rowSums.map(s => `${s.n}: ${s.value}`).join(', ') }) : '',
    m.highlighted.length ? tk('pascalDescHl', { list: m.highlighted.map(e => `C(${e.n}, ${e.k}) = ${e.value}`).join(', ') }) : ''
  ].filter(Boolean).join(' ');
  return (
    <Figure width={m.width} height={m.height} title={title || tk('pascalTitle')} description={desc} caption={caption}>
      {m.entries.filter(e => e.highlight).map(e => <rect key={`h${e.n}-${e.k}`} className="dgs-hl-box" x={r3(e.x - m.boxW / 2)} y={r3(e.y - m.boxH / 2)} width={m.boxW} height={m.boxH} rx="5" />)}
      {m.entries.map(e => <Tex key={`${e.n}-${e.k}`} x={e.x} y={e.y} tex={e.tex} w={m.cell} h={m.boxH} className={e.highlight ? 'is-mark dgs-hl' : ''} />)}
      {sums && <Label x={m.width - 10} y={14} text={tk('rowSum')} w={90} h={18} anchor="end" className="dg-small" />}
      {sums && m.rowSums.map(s => <Tex key={`s${s.n}`} x={s.x} y={s.y} tex={`2^{${s.n}}=${s.value}`} w={90} h={20} anchor="end" className="dg-small" />)}
    </Figure>
  );
}

// ── The binomial distribution ────────────────────────────────────────────────
export function Binomial({ n = 10, p = 0.5, highlight = null, title = null, caption = null }) {
  const tk = useKitText(STATS_TEXT);
  const [hatch, hatchDef] = useHatch();
  const m = binomialModel({ n, p, highlight });
  const f = m.frame;
  const desc = [
    tk('binomialDesc', { n, p: r3(p, 4), list: m.bars.map(b => b.p4).join(', '), mean: m.mean, var: m.variance }),
    m.event ? tk('binomialDescSet', { event: `P(${eventText(highlight, m.set)})`, pset: m.pSet4 }) : ''
  ].filter(Boolean).join(' ');
  return (
    <Figure width={f.width} height={f.height} title={title || tk('binomialTitle')} description={desc} caption={caption}>
      <defs>{hatchDef}</defs>
      <g className="dg-axes">{m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={Math.min(48, f.left - 4)} h={20} anchor="end" /></g>)}</g>
      {m.bars.map(b => (
        <g key={b.k}>
          <rect className={`dg-bar${b.highlight ? ' dgs-bar-hl' : ''}`} x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} />
          {b.highlight && <rect className="dgs-hatch" x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} fill={hatch} />}
          {b.labelShown && <Tex x={b.cx} y={f.bottom + 13} tex={String(b.k)} w={30} h={18} className="dg-small" />}
          {m.showValues && <Tex x={b.cx} y={b.y - 9} tex={String(b.p4)} w={52} h={18} className="dg-small" />}
        </g>
      ))}
      <line className="dg-axis" x1={f.left} x2={f.right} y1={f.bottom} y2={f.bottom} />
      <line className="dg-axis" x1={f.left} x2={f.left} y1={f.top} y2={f.bottom} />
      <line className="dgs-mean" x1={m.meanLine.x} x2={m.meanLine.x} y1={m.meanLine.y1} y2={m.meanLine.y2} />
      <Tex x={m.meanLine.labelX} y={f.bottom + 34} tex={`E(X)=${m.mean}`} w={92} h={18} className="dg-small" />
      <Tex x={f.right} y={f.bottom + 34} tex="k" w={20} h={18} anchor="end" className="dg-small" />
      <Tex x={f.left - 40} y={14} tex="P(X=k)" w={90} h={20} anchor="start" className="dg-small" />
      {m.event && <Tex x={f.right} y={14} tex={`P(${m.event})=${m.pSet4}`} w={200} h={22} anchor="end" className="is-mark" />}
    </Figure>
  );
}

export function BinomialExplorer({ n: n0 = 10, p: p0 = 0.5, highlight = null, nMax = null, title = null }) {
  const tk = useKitText(STATS_TEXT);
  const [n, setN] = useState(n0);
  const [p, setP] = useState(p0);
  const initialMode = highlight && !Array.isArray(highlight) ? (highlight.atLeast !== undefined ? 'ge' : highlight.atMost !== undefined ? 'le' : 'eq') : 'eq';
  const initialK = highlight == null ? Math.round(n0 * p0) : Array.isArray(highlight) ? highlight[0] : highlight.atLeast ?? highlight.atMost ?? highlight.between?.[0] ?? 0;
  const [mode, setMode] = useState(initialMode);
  const [k, setK] = useState(initialK);
  const kk = Math.min(k, n);
  const hl = mode === 'ge' ? { atLeast: kk } : mode === 'le' ? { atMost: kk } : [kk];
  const m = binomialModel({ n, p, highlight: hl });
  const top = Math.max(nMax ?? 30, n0);
  const fmtP = v => String(r3(v, 2));
  const readout = tk('explorerReadout', { n, p: fmtP(p), event: `P(${eventTex(hl, highlightSet(hl, n))})=${m.pSet4}`, mean: m.mean, var: m.variance });
  return (
    <Shell title={title || tk('explorerTitle')} readout={readout}
      controls={<>
        <Slider label={tk('nLabel')} min={1} max={top} step={1} value={n} onChange={setN} format={v => `n = ${v}`} />
        <Slider label={tk('pLabel')} min={0} max={1} step={0.01} value={p} onChange={setP} format={v => `p = ${fmtP(v)}`} />
        <Slider label={tk('kLabel')} min={0} max={n} step={1} value={kk} onChange={setK} format={v => `k = ${v}`} />
        <div className="dgi-buttons" role="group" aria-label={tk('eventButtons')}>
          {[['eq', 'eqK'], ['le', 'leK'], ['ge', 'geK']].map(([v, key]) => <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}>{tk(key)}</button>)}
        </div>
      </>}>
      <Binomial n={n} p={p} highlight={hl} />
    </Shell>
  );
}

// ── The probability simulator ────────────────────────────────────────────────
const SIM_TITLE = { coin: 'simTitleCoin', die: 'simTitleDie', twoDiceSum: 'simTitleTwoDice', spinner: 'simTitleSpinner', bag: 'simTitleBag' };

function SimChart({ m, tk }) {
  const [hatch, hatchDef] = useHatch();
  const f = m.frame;
  const name = b => (b.key ? tk(b.key) : b.text);
  const desc = m.trials
    ? tk('simDesc', { trials: m.trials, list: list(m.bars.map(b => `${plain(name(b))} ${b.freq3} (${b.ptext})`)) })
    : tk('simDescNone', { list: list(m.bars.map(b => `${plain(name(b))} ${b.ptext}`)) });
  return (
    <Figure width={f.width} height={f.height} title={tk('simFigure')} description={desc}>
      <defs>{hatchDef}</defs>
      <g className="dg-axes">{m.yTicks.map(t => <g key={t.value}><line className="dg-grid" x1={f.left} x2={f.right} y1={t.px} y2={t.px} /><Tex x={f.left - 6} y={t.px} tex={String(t.value)} w={Math.min(48, f.left - 4)} h={20} anchor="end" /></g>)}</g>
      {m.bars.map(b => (
        <g key={b.i}>
          <rect className="dg-bar dgs-freq" x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} />
          {b.inEvent && <rect className="dgs-hatch" x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} fill={hatch} />}
          <line className="dgs-theory" x1={b.theory.x1} x2={b.theory.x2} y1={b.theory.y} y2={b.theory.y} />
          {b.shown && <Label x={b.cx} y={b.catY} text={name(b)} w={Math.max(40, m.slot * (m.axis.mode === 'stagger' ? 2 : m.axis.every) - 4)} h={18} className={`dgs-cat${b.inEvent ? ' is-mark' : ''}`} />}
          {b.shown && <Tex x={b.cx} y={b.probY} tex={b.tex.replace('\\tfrac', '\\dfrac')} w={Math.max(36, m.slot - 2)} h={34} className="dgs-prob" />}
        </g>
      ))}
      <line className="dg-axis" x1={f.left} x2={f.right} y1={f.bottom} y2={f.bottom} />
      <line className="dg-axis" x1={f.left} x2={f.left} y1={f.top} y2={f.bottom} />
      <Tex x={f.left - 8} y={m.bars[0].probY} tex="P" w={20} h={20} anchor="end" className="dgs-prob" />
    </Figure>
  );
}

export function ProbabilitySim({ title = null, ...params }) {
  const tk = useKitText(STATS_TEXT);
  const [sim, setSim] = useState(() => simStart(params));
  const m = probabilitySimModel(params, sim);
  const add = k => setSim(s => simAdd(params, s, k));
  const theory = (frac, p) => (frac ? `${ftex(frac)}\\approx ${r3(p, 3)}` : String(r3(p, 4)));
  let readout;
  if (!m.trials) readout = tk('simNone');
  else if (m.event) readout = `${tk('simEvent', { trials: m.trials, count: m.event.count, freq: m.event.freq3, theory: theory(m.event.frac, m.event.p) })} ${tk('simMore')}`;
  else { const w = m.bars[m.worst]; const o = m.outcomes[m.worst]; readout = `${tk('simWorst', { trials: m.trials, outcome: w.key ? tk(w.key) : w.text, freq: w.freq3, theory: theory(o.frac, o.p) })} ${tk('simMore')}`; }
  if (m.trials >= SIM_MAX_TRIALS) readout += ` ${tk('simCap', { max: SIM_MAX_TRIALS })}`;
  const legend = (
    <ul className="dgs-legend" aria-hidden="true">
      <li><svg viewBox="0 0 16 12" className="dgs-swatch"><rect className="dg-bar" x="1" y="1" width="14" height="10" /></svg>{tk('legendFreq')}</li>
      <li><svg viewBox="0 0 16 12" className="dgs-swatch"><line className="dgs-theory" x1="0" x2="16" y1="6" y2="6" /></svg>{tk('legendTheory')}</li>
      {m.event && <li><svg viewBox="0 0 16 12" className="dgs-swatch"><rect className="dg-bar dgs-bar-hl" x="1" y="1" width="14" height="10" /><path className="dgs-hatch-line" d="M3 11 L9 1 M8 11 L14 1" /></svg>{tk('legendEvent')}</li>}
    </ul>
  );
  const full = m.trials >= SIM_MAX_TRIALS;
  return (
    <Shell title={title || tk(SIM_TITLE[params.experiment] || 'simTitle')} readout={readout} legend={legend}
      controls={
        <div className="dgi-buttons" role="group" aria-label={tk('trialButtons')}>
          {[1, 10, 100, 1000].map(k => <button key={k} type="button" disabled={full} aria-label={k === 1 ? tk('addName1') : tk('addName', { k })} onClick={() => add(k)}>+{k}</button>)}
          <button type="button" onClick={() => setSim(simStart(params))}>{tk('reset')}</button>
        </div>
      }>
      <SimChart m={m} tk={tk} />
    </Shell>
  );
}

// ── The data explorer ────────────────────────────────────────────────────────
const NAME_KEY = { mean: 'nameMean', median: 'nameMedian', mode: 'nameMode', range: 'nameRange', iqr: 'nameIqr', sd: 'nameSd' };
function measureValue(st, k, tk) {
  if (k === 'mode') return st.modes.length ? st.modes.join(', ') : tk('noneMode');
  return String({ mean: st.mean, median: st.median, range: st.range, iqr: st.iqr, sd: st.sd }[k]);
}
function measuresText(st, show, tk) {
  const parts = [];
  if (show.includes('mean')) parts.push(tk('measureMean', { v: st.mean }));
  if (show.includes('median')) parts.push(tk('measureMedian', { v: st.median }));
  if (show.includes('mode')) parts.push(st.modes.length ? tk('measureMode', { v: st.modes.join(', ') }) : tk('measureNoMode'));
  if (show.includes('range')) parts.push(tk('measureRange', { v: st.range }));
  if (show.includes('iqr')) parts.push(tk('measureIqr', { v: st.iqr, q1: st.q1, q3: st.q3 }));
  if (show.includes('sd')) parts.push(tk('measureSd', { v: st.sd }));
  return `${parts.join('; ')}.`;
}

function DotPlot({ m, tk }) {
  const f = m.frame;
  const st = m.stats;
  const markLabel = k => ({ mean: `$${k.tex}$`, median: `${tk('median')} $=${k.tex}$`, mode: `${tk('mode')} $=${k.tex}$` }[k.key]);
  const laneLabel = l => ({ range: `${tk('range')} $=${l.tex}$`, iqr: `${tk('iqr')} $=${l.tex}$`, sd: `$${l.tex}$` }[l.key]);
  const desc = tk('dataDesc', { n: st.n, values: [...m.dots].map(d => d.value).sort((a, b) => a - b).join(', '), measures: measuresText(st, m.show, tk) });
  return (
    <Figure width={m.width} height={m.height} title={tk('dataFigure')} description={desc}>
      <g className="dg-axes">
        <line className="dg-axis" x1={f.left} x2={f.right} y1={m.axisY} y2={m.axisY} />
        {m.ticks.map(t => <g key={t.value}><line className="dg-tick" x1={t.px} x2={t.px} y1={m.axisY} y2={m.axisY + 5} /><Tex x={t.px} y={m.axisY + 16} tex={String(t.value)} w={36} h={18} className="dg-small" /></g>)}
      </g>
      {m.marks.map(k => (
        <g key={k.key}>
          {k.key !== 'mode' && <line className={`dgs-mark is-${k.key}`} x1={k.x} x2={k.x} y1={m.axisY} y2={f.top} />}
          {k.key === 'mode' && k.tri.map((t, i) => <path key={i} className="dgs-mode" d={`M${r3(t.x - 5)} ${r3(t.y - 7)} L${r3(t.x + 5)} ${r3(t.y - 7)} L${t.x} ${t.y} Z`} />)}
          <line className="dgs-leader" x1={k.x} y1={r3(k.ly - 9)} x2={k.x} y2={k.ay} />
          <Label x={k.lx} y={k.ly} text={markLabel(k)} w={k.w} h={20} anchor={k.anchor} className={`dg-small dgs-mark-label is-${k.key}`} />
        </g>
      ))}
      {m.dots.map(d => (d.editable
        ? <circle key={d.i} className="dgs-dot-edit" cx={d.cx} cy={d.cy} r={m.dotR} />
        : <circle key={d.i} className="dg-dot" cx={d.cx} cy={d.cy} r={m.dotR} />))}
      {m.lanes.map(l => (
        <g key={l.key} className={`dgs-lane is-${l.key}`}>
          <line className="dgs-lane-line" x1={l.from} x2={l.to} y1={l.y} y2={l.y} />
          {!l.clippedLeft && <line className="dgs-lane-line" x1={l.from} x2={l.from} y1={l.y - 5} y2={l.y + 5} />}
          {!l.clippedRight && <line className="dgs-lane-line" x1={l.to} x2={l.to} y1={l.y - 5} y2={l.y + 5} />}
          <Label x={r3(Math.min(f.right - 60, Math.max(f.left + 60, l.mid)))} y={l.labelY} text={laneLabel(l)} w={120} h={18} className="dg-small" />
        </g>
      ))}
    </Figure>
  );
}

export function DataExplorer({ data, editable = [], show = ['mean', 'median', 'mode', 'range', 'iqr', 'sd'], min, max, step, title = null }) {
  const tk = useKitText(STATS_TEXT);
  const [values, setValues] = useState(data);
  const start = useMemo(() => dataStats(data), [data]);
  const stackCap = useMemo(() => start.modeCount + editable.length, [start, editable]);
  const m = dataExplorerModel({ data: values, editable, show, min, max, step, stackCap });
  const now = m.stats;
  const changed = changedMeasures(start, now).filter(k => show.includes(k));
  const same = show.filter(k => !changed.includes(k));
  const moved = values.some((v, i) => v !== data[i]);
  const readout = !moved
    ? `${tk('dataStart')}${show.includes('sd') ? ` ${tk('sdNote')}` : ''}`
    : changed.length
      ? `${tk('dataMoved', { changed: changed.map(k => tk('changedItem', { name: tk(NAME_KEY[k]), from: measureValue(start, k, tk), to: measureValue(now, k, tk) })).join('; ') })}${same.length ? ` ${tk('dataSame', { same: same.map(k => `${tk(NAME_KEY[k])} ${measureValue(now, k, tk)}`).join('; ') })}` : ''}`
      : tk('dataNoChange');
  const b = m.bounds;
  return (
    <Shell title={title || tk('dataTitle')} readout={readout}
      controls={<>
        {editable.map(i => <Slider key={i} name={`value-${i}`} label={tk('valueLabel', { k: i + 1 })} min={b.lo} max={b.hi} step={b.step} value={values[i]} format={v => String(r3(v, 4))}
          onChange={v => setValues(vs => vs.map((x, j) => (j === i ? r3(v, 6) : x)))} />)}
        <div className="dgi-buttons"><button type="button" onClick={() => setValues(data)}>{tk('reset')}</button></div>
      </>}>
      <DotPlot m={m} tk={tk} />
    </Shell>
  );
}

export const STATIC_COMPONENTS = Object.freeze({ barChart: BarChart, pieChart: PieChart, pascal: Pascal, binomial: Binomial });
export const INTERACTIVE_COMPONENTS = Object.freeze({ binomialExplorer: BinomialExplorer, probabilitySim: ProbabilitySim, dataExplorer: DataExplorer });
