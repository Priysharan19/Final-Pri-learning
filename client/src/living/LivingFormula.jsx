// Pri Learning · a living formula
//
// A typeset formula whose named parameters are underlined and can be dragged sideways (mouse, finger or
// Apple Pencil), each with a plain-language note and a native slider for keyboards and screen readers.
// Beside it a graph redraws as the values change, the starting curve stays as a dashed grey line, and the
// graph's key features are stated in words. Learning only: nothing here marks, hints, records an attempt
// or reads anything about the learner, and nothing leaves the device.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderMath, useMathLocale } from '../lib/latex.jsx';
import { speakMath } from '../lib/mathSpeech.js';
import { useT } from '../i18n/index.js';
import { curvePaths, projector, ticksFor } from '../engine/plot.js';
import { defaultsOf, indexOf, stopsOf, valueAt } from './specs.js';
import { featureVars, fmtParam, featureRounded } from './format.js';
import { FEATURE, NOTE, TITLE } from './keys.js';
import { GLYPHS, KIND_ICON } from './icons.js';
import './living.css';

const BOX = { width: 320, height: 240, pad: { left: 34, right: 10, top: 10, bottom: 22 } };

/** The fixed window: where `equal` is set the y-range is derived so one unit is as long on both axes. */
export function windowOf(spec) {
  const w = spec.window;
  if (!w.equal) return w;
  const innerW = BOX.width - BOX.pad.left - BOX.pad.right;
  const innerH = BOX.height - BOX.pad.top - BOX.pad.bottom;
  const half = ((w.xMax - w.xMin) * innerH) / innerW / 2;
  return { ...w, yMin: -half, yMax: half };
}

function curveOf(spec, values, win, project) {
  if (spec.fn) return curvePaths(spec.fn(values), win, project, { samples: 320 }).paths.map(p => p.d);
  return spec.polylines(values).map(pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${project.x(x)} ${project.y(y)}`).join(' '));
}

/** The row's glyph: decorative, one family (icons.js). The row's words are the accessible content. */
function FeatureIcon({ kind }) {
  return (
    <svg className="lf-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[KIND_ICON[kind] || 'line'].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function Mark({ m, project, win, hot }) {
  const h = hot ? ' is-hot' : '';
  if (m.shape === 'vline') return <path className={`lf-guide${h}`} d={`M${project.x(m.x)} ${project.y(win.yMin)}V${project.y(win.yMax)}`} />;
  if (m.shape === 'hline') return <path className={`lf-guide${h}`} d={`M${project.x(win.xMin)} ${project.y(m.y)}H${project.x(win.xMax)}`} />;
  const x = project.x(m.x), y = project.y(m.y);
  if (m.shape === 'ring') return <circle className={`lf-mark lf-m-ring${h}`} cx={x} cy={y} r={hot ? 6.4 : 4.6} />;
  if (m.shape === 'diamond') return <path className={`lf-mark lf-m-diamond${h}`} d={`M${x} ${y - 5.2}L${x + 5.2} ${y}L${x} ${y + 5.2}L${x - 5.2} ${y}Z`} />;
  return <circle className={`lf-mark lf-m-dot${h}`} cx={x} cy={y} r={hot ? 6 : 4} />;
}

export default function LivingFormula({ spec }) {
  const t = useT();
  const locale = useMathLocale();
  const uid = useId();
  const [values, setValues] = useState(() => defaultsOf(spec));
  const [active, setActive] = useState(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const [rowKind, setRowKind] = useState(null);   // the feature row under the pointer: its mark on the graph lights too
  const [pinned, setPinned] = useState(false);       // a touch or pen tap keeps its symbol lit until the next tap elsewhere
  const [dismissed, setDismissed] = useState(false); // Escape closes the note; moving to another symbol brings it back
  const [pop, setPop] = useState(null);
  const formulaRef = useRef(null);
  const tipId = `${uid}-tip`;
  const win = useMemo(() => windowOf(spec), [spec]);
  const project = useMemo(() => projector(win, BOX), [win]);
  const base = useMemo(() => curveOf(spec, defaultsOf(spec), win, project), [spec, win, project]);
  const now = useMemo(() => curveOf(spec, values, win, project), [spec, values, win, project]);
  const features = useMemo(() => spec.features(values), [spec, values]);
  const title = t(TITLE[spec.id]);
  const sentences = features.map(f => t(FEATURE[f.kind], featureVars(f.kind, f.facts)));
  const paramById = useMemo(() => Object.fromEntries(spec.params.map(p => [p.id, p])), [spec]);
  const symbolOf = id => paramById[id].symbol;
  // The symbols lit now: the one hovered, focused or dragged, and while dragging the ones that act with it.
  const group = (spec.together || []).find(g => active && g.includes(active)) || (active ? [active] : []);
  const lit = dragging ? group : (active ? [active] : []);
  const hotKinds = new Set(lit.flatMap(id => spec.emphasis?.[id] || []));
  if (rowKind) hotKinds.add(rowKind);
  const isHot = f => hotKinds.has(f.kind);
  const isDefault = spec.params.every(p => values[p.id] === p.def);

  useEffect(() => { setDismissed(false); }, [active]);
  useEffect(() => {
    if (!pinned) return undefined;
    const away = e => { if (!e.target.closest?.('.lf-slot')) { setPinned(false); setActive(null); } };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [pinned]);
  const showTip = !!active && !dismissed;
  useEffect(() => {
    if (!showTip) return undefined;
    const onKey = e => { if (e.key === 'Escape') setDismissed(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showTip]);
  useLayoutEffect(() => {
    const box = formulaRef.current;
    const el = showTip && box ? box.querySelector(`[data-param="${active}"]`) : null;
    if (!el) { setPop(null); return; }
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    const left = Math.round(Math.min(Math.max(r.left - b.left + r.width / 2, 120), Math.max(120, b.width - 120)));
    const top = Math.round(r.bottom - b.top + 8);
    setPop(p => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [showTip, active, values]);

  const set = (id, v) => setValues(prev => (prev[id] === v ? prev : { ...prev, [id]: v }));

  // What a screen reader is told after the values settle: only the sentences that changed.
  const [status, setStatus] = useState('');
  const spoken = useRef(sentences);
  useEffect(() => {
    if (dragging) return undefined;
    const id = setTimeout(() => {
      const before = spoken.current;
      const changed = sentences.filter(s => !before.includes(s)).map(s => { const [l, v, n] = s.split('|'); return `${l}: ${v}, ${n}`; });
      spoken.current = sentences;
      if (changed.length) setStatus(changed.join('. '));
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences.join('|'), dragging]);

  // ── drag a number in the formula ────────────────────────────────────────────
  const onDown = (e, p) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* a synthetic or already-ended pointer: the drag still follows move events */ }
    const stops = stopsOf(p);
    drag.current = { id: p.id, x: e.clientX, i: indexOf(p, values[p.id]), stops, px: Math.min(14, Math.max(5, 160 / stops)) };
    setDragging(true);
    setPinned(false);
    setActive(p.id);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const i = Math.min(d.stops, Math.max(0, d.i + Math.round((e.clientX - d.x) / d.px)));
    set(d.id, valueAt(paramById[d.id], i));
  };
  const onUp = (e) => {
    if (!drag.current) return;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    const touch = e.pointerType !== 'mouse';
    drag.current = null;
    setDragging(false);
    if (touch) setPinned(true); else setActive(null);
  };

  const slot = (id, key, extra = null, size = false) => {
    const p = paramById[id];
    return (
      <span key={key} className={`lf-slot${lit.includes(id) ? ' is-active' : ''}${dragging && lit.includes(id) ? ' is-dragging' : ''}`}
        aria-hidden="true" data-param={id}
        onPointerDown={e => onDown(e, p)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerEnter={e => { if (!dragging && e.pointerType === 'mouse') setActive(id); }} onPointerLeave={e => { if (!dragging && e.pointerType === 'mouse' && !pinned) setActive(null); }}>
        {fmtParam(size ? Math.abs(values[id]) : values[id])}{extra}
      </span>
    );
  };
  const tex = (s, key) => <span key={key} className="lf-tex" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderMath(s, false, locale) }} />;
  const renderToken = (tok, i) => {
    if (tok.tex) return tex(tok.tex, i);
    if (tok.p) return slot(tok.p, i, tok.square ? <sup className="lf-sq">2</sup> : null);
    if (tok.sup) return <sup key={i} className="lf-sup">{slot(tok.sup, i)}</sup>;
    if (tok.supOf) return <sup key={i} className="lf-sup">{tok.supOf.map((s, j) => renderToken(s, `${i}.${j}`))}</sup>;
    const v = values[tok.sp];
    const minus = tok.neg ? v >= 0 : v < 0;
    return (
      <span key={i} className="lf-signed">
        <span className="lf-op" aria-hidden="true">{minus ? '−' : '+'}</span>
        {slot(tok.sp, `${i}s`, null, true)}
      </span>
    );
  };
  const view = spec.formula.map(renderToken);

  const spokenFormula = t('living.ui.formula', { tex: speakMath(spec.tex(values), locale) });
  const clip = `${uid}-clip`;
  const xT = ticksFor(win.xMin, win.xMax, 8), yT = ticksFor(win.yMin, win.yMax, 6);
  const axisX = Math.min(win.yMax, Math.max(win.yMin, 0));
  const axisY = Math.min(win.xMax, Math.max(win.xMin, 0));
  const inner = { x0: BOX.pad.left, x1: BOX.width - BOX.pad.right, y0: BOX.pad.top, y1: BOX.height - BOX.pad.bottom };

  return (
    <figure className="lf" aria-labelledby={`${uid}-t`} data-living-formula={spec.id}>
      <figcaption><h3 className="lf-title" id={`${uid}-t`}>{title}</h3></figcaption>
      <div className="lf-grid">
        <div className="lf-side">
          <div className="lf-formula-card" ref={formulaRef}>
            <div className="lf-formula" role="group" aria-label={spokenFormula}>{view}</div>
            {showTip && pop && (
              <div className="lf-pop" role="tooltip" id={tipId} style={{ left: pop.left, top: pop.top }}>
                <p className="lf-pop-what"><span className="lf-sym">{symbolOf(active)}</span> {t(NOTE[spec.id][active])}</p>
                <p className="lf-pop-now">{t('living.ui.popValue', { symbol: symbolOf(active), value: fmtParam(values[active]) })}</p>
              </div>
            )}
          </div>
          <ul className="lf-params">
            {spec.params.map(p => (
              <li key={p.id} className={`lf-param${lit.includes(p.id) ? ' is-active' : ''}`}>
                <label htmlFor={`${uid}-${p.id}`} className="lf-note"><span className="lf-sym">{p.symbol}</span> {t(NOTE[spec.id][p.id])}</label>
                <div className="lf-ctl">
                  <input id={`${uid}-${p.id}`} type="range" min={p.min} max={p.max} step={p.step} value={values[p.id]}
                    aria-describedby={showTip && active === p.id && pop ? tipId : undefined}
                    aria-valuetext={`${p.symbol} = ${fmtParam(values[p.id])}`}
                    onChange={e => set(p.id, Number(e.target.value))}
                    onFocus={() => setActive(p.id)} onBlur={() => { if (!drag.current) setActive(a => (a === p.id ? null : a)); }}
                    onPointerEnter={() => !dragging && setActive(p.id)} onPointerLeave={() => !dragging && setActive(a => (a === p.id ? null : a))} />
                  <output htmlFor={`${uid}-${p.id}`} className="lf-val" aria-hidden="true">{fmtParam(values[p.id])}</output>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary lf-reset" disabled={isDefault} onClick={() => setValues(defaultsOf(spec))} aria-label={t('living.ui.resetLabel', { title })}>
            {t('living.ui.reset')}
          </button>
        </div>
        <div className="lf-graph">
          <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={t('living.ui.graph', { title })} className="lf-svg">
            <defs><clipPath id={clip}><rect x={inner.x0} y={inner.y0} width={inner.x1 - inner.x0} height={inner.y1 - inner.y0} /></clipPath></defs>
            <g className="lf-grid-lines" aria-hidden="true">
              {xT.map(v => <path key={`x${v}`} d={`M${project.x(v)} ${inner.y0}V${inner.y1}`} />)}
              {yT.map(v => <path key={`y${v}`} d={`M${inner.x0} ${project.y(v)}H${inner.x1}`} />)}
            </g>
            <g className="lf-ticks" aria-hidden="true">
              {xT.map(v => <text key={`xt${v}`} x={project.x(v)} y={inner.y1 + 13} textAnchor="middle">{fmtParam(v)}</text>)}
              {yT.map(v => <text key={`yt${v}`} x={inner.x0 - 5} y={project.y(v) + 3.5} textAnchor="end">{fmtParam(v)}</text>)}
            </g>
            <g className="lf-axes" aria-hidden="true">
              <path d={`M${inner.x0} ${project.y(axisX)}H${inner.x1}`} />
              {!spec.window.noYAxis && <path d={`M${project.x(axisY)} ${inner.y0}V${inner.y1}`} />}
            </g>
            <g clipPath={`url(#${clip})`}>
              {base.map((d, i) => <path key={`b${i}`} d={d} className="lf-curve lf-base" />)}
              {features.flatMap((f, i) => f.marks.filter(m => m.shape === 'vline' || m.shape === 'hline').map((m, j) => <Mark key={`g${i}.${j}`} m={m} project={project} win={win} hot={isHot(f)} />))}
              {now.map((d, i) => <path key={`n${i}`} d={d} className="lf-curve lf-now" />)}
              {features.flatMap((f, i) => f.marks.filter(m => m.shape !== 'vline' && m.shape !== 'hline').map((m, j) => <Mark key={`m${i}.${j}`} m={m} project={project} win={win} hot={isHot(f)} />))}
            </g>
          </svg>
          <div className="lf-key" aria-hidden="true">
            <span><svg viewBox="0 0 28 8" className="lf-swatch"><path d="M1 4H27" className="lf-curve lf-base" /></svg>{t('living.ui.start')}</span>
            <span><svg viewBox="0 0 28 8" className="lf-swatch"><path d="M1 4H27" className="lf-curve lf-now" /></svg>{t('living.ui.now')}</span>
          </div>
          <p className="lf-caption">{t('living.ui.original')}</p>
        </div>
      </div>
      <p className="lf-readout" aria-label={t('living.ui.readout')}>{spec.params.map(p => `${p.symbol} = ${fmtParam(values[p.id])}`).join(', ')}</p>
      <div className="lf-feats">
        <p className="lf-sub">{t('living.ui.features')}</p>
        <ul className="lf-list">
          {features.map((f, i) => {
            const [label, value, note] = sentences[i].split('|');
            return (
              <li key={`${f.kind}${i}`} className={`lf-row${isHot(f) ? ' is-hot' : ''}`}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setRowKind(f.kind); }} onPointerLeave={e => { if (e.pointerType === 'mouse') setRowKind(null); }}
                onPointerDown={e => { if (e.pointerType !== 'mouse') setRowKind(k => (k === f.kind ? null : f.kind)); }}>
                <FeatureIcon kind={f.kind} />
                <span className="lf-row-label">{label}</span>
                <span className="lf-row-val">{value}</span>
                <span className="lf-row-note">{note}</span>
              </li>
            );
          })}
        </ul>
        {features.some(f => featureRounded(f.kind, f.facts)) && <p className="lf-legend">{t('living.ui.rounded')}</p>}
      </div>
      <p className="lf-status" role="status" aria-live="polite">{status}</p>
    </figure>
  );
}
