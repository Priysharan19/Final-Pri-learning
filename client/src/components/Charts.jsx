// ─────────────────────────────────────────────────────────────────────────────
// Hand-rolled SVG charts following the dataviz method:
// thin marks, hairline solid grids, sequential single-hue ramps, tooltips,
// text in ink tokens (never series color), 4px rounded data ends.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';

const SEQ = ['var(--seq-100)', 'var(--seq-200)', 'var(--seq-300)', 'var(--seq-400)', 'var(--seq-500)', 'var(--seq-600)', 'var(--seq-700)'];

function niceTicks(min, max, n = 4) {
  if (max <= min) max = min + 1;
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = span / n / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = step * mult;
  const lo = Math.floor(min / s) * s;
  const hi = Math.ceil(max / s) * s;
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += s) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Single-series line with area wash, crosshair tooltip, end-dot + end label. */
export function LineChart({ data, height = 210, yLabel = '', band = null, valueFmt = v => v }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const W = 640, H = height, padL = 34, padR = 46, padT = 14, padB = 26;
  if (!data || data.length < 2) return <div className="muted" style={{ padding: 20 }}>Not enough history yet — keep practising and your trend will appear here.</div>;

  const ys = data.map(d => d.value);
  const yMinRaw = Math.min(...ys, band ? band.low : Infinity);
  const yMaxRaw = Math.max(...ys, band ? band.high : -Infinity);
  const ticks = niceTicks(Math.max(0, yMinRaw - 4), Math.min(100, yMaxRaw + 4));
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const x = i => padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);

  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1).toFixed(1)},${y(yMin)} L${x(0).toFixed(1)},${y(yMin)} Z`;
  const last = data[data.length - 1];

  const onMove = e => {
    const rect = wrapRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const xi = Math.round(((frac * W) - padL) / (W - padL - padR) * (data.length - 1));
    if (xi >= 0 && xi < data.length) setHover(xi);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={yLabel}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" className="axis-text">{t}</text>
          </g>
        ))}
        {band && (
          <rect x={padL} width={W - padL - padR} y={y(band.high)} height={Math.max(0, y(band.low) - y(band.high))}
            fill="var(--series-1)" opacity="0.07" rx="3" />
        )}
        <path d={area} fill="var(--series-1)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--axis)" strokeWidth="1" />
        )}
        {hover != null && (
          <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
        )}
        <circle cx={x(data.length - 1)} cy={y(last.value)} r="4.5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
        <text x={x(data.length - 1) + 9} y={y(last.value) + 4} className="bar-label" style={{ fontWeight: 700 }}>{valueFmt(last.value)}</text>
        <text x={padL} y={H - 7} className="axis-text">{data[0].label}</text>
        <text x={W - padR} y={H - 7} textAnchor="end" className="axis-text">{last.label}</text>
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <div className="tip-label">{data[hover].label}</div>
          <div className="tip-value">{valueFmt(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars — one series, one hue; value at the bar tip in ink. */
export function HBars({ data, max = 100, valueFmt = v => `${v}%` }) {
  const [hover, setHover] = useState(null);
  const rowH = 34, barH = 12, labelW = 170, W = 640, padR = 52;
  const H = data.length * rowH + 6;
  const x = v => labelW + (v / max) * (W - labelW - padR);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {data.map((d, i) => {
          const cy = i * rowH + rowH / 2;
          const w = Math.max(2, x(d.value) - labelW);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x="0" y={cy - rowH / 2} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 12} y={cy + 4} textAnchor="end" className="bar-label" style={{ fontWeight: 550, fill: 'var(--ink-2)' }}>{d.label}</text>
              <rect x={labelW} y={cy - barH / 2} width={W - labelW - padR} height={barH} rx="4" fill="var(--surface-3)" />
              <path d={`M${labelW},${cy - barH / 2} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h-${Math.max(0, w - 4)} z`}
                fill="var(--series-1)" opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={labelW + w + 8} y={cy + 4} className="bar-label">{valueFmt(d.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** GitHub-style activity heatmap — sequential single hue. */
export function Calendar({ days, weeks = 17 }) {
  const [tip, setTip] = useState(null);
  const cell = 13, gap = 3;
  const byDate = Object.fromEntries((days || []).map(d => [d.date, d]));
  const today = new Date();
  const cols = [];
  // Build columns of 7 days ending today
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
  for (let w = 0; w < weeks + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      if (dt > today) break;
      const key = dt.toISOString().slice(0, 10);
      col.push({ key, data: byDate[key] });
    }
    cols.push(col);
  }
  const level = q => !q ? 0 : q <= 3 ? 1 : q <= 7 ? 2 : q <= 12 ? 3 : 4;
  const fills = ['var(--surface-3)', SEQ[1], SEQ[2], SEQ[3], SEQ[5]];
  const W = cols.length * (cell + gap), H = 7 * (cell + gap);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 560, display: 'block' }}>
        {cols.map((col, ci) => col.map((c, ri) => (
          <rect key={c.key} x={ci * (cell + gap)} y={ri * (cell + gap)} width={cell} height={cell} rx="3.5"
            fill={fills[level(c.data?.questions)]}
            onMouseEnter={e => setTip({ x: ci * (cell + gap) / W, y: ri * (cell + gap) / H, c })}
            onMouseLeave={() => setTip(null)} />
        )))}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}>
          <div className="tip-label">{tip.c.key}</div>
          <div className="tip-value">{tip.c.data ? `${tip.c.data.questions} questions · ${tip.c.data.correct} correct` : 'No practice'}</div>
        </div>
      )}
      <div className="row" style={{ gap: 5, marginTop: 8, justifyContent: 'flex-end' }}>
        <span className="muted" style={{ fontSize: 11 }}>Less</span>
        {fills.map((f, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: f, display: 'inline-block' }} />)}
        <span className="muted" style={{ fontSize: 11 }}>More</span>
      </div>
    </div>
  );
}

/** Daily-goal ring. */
export function Ring({ value, max, size = 108, children }) {
  const r = (size - 14) / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.min(1, max ? value / max : 0);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.2,0.9,0.3,1)' }} />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-bright)" /><stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/** 12-point sparkline for stat tiles. */
export function Sparkline({ points, width = 88, height = 28 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const x = i => (i / (points.length - 1)) * (width - 6) + 3;
  const y = v => max === min ? height / 2 : 3 + (1 - (v - min) / (max - min)) * (height - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="3" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

export function StatTile({ label, value, delta, deltaGood, spark, suffix }) {
  return (
    <div className="card">
      <div className="spread">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}{suffix && <span style={{ fontSize: 15, color: 'var(--ink-3)', fontWeight: 600 }}> {suffix}</span>}</div>
          {delta != null && <div className={`stat-delta ${deltaGood ? 'delta-up' : 'delta-down'}`}>{delta}</div>}
        </div>
        {spark && <Sparkline points={spark} />}
      </div>
    </div>
  );
}

export const MASTERY_FILLS = {
  unseen: 'var(--surface-3)',
  emerging: 'var(--m1)',
  developing: 'var(--m2)',
  strong: 'var(--m4)',
  mastered: 'var(--m5)'
};
