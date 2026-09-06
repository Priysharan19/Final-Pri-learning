// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · animated graph
//
// Draws what engine/plot.js computed. The curve is revealed along its own
// length, so a student sees the graph being drawn rather than appearing: the
// same thing a teacher does at a board, at a speed they can follow.
//
// `progress` between 0 and 1 drives the reveal, so the explain player can scrub
// it, hold it still, or hand it 1 for a finished graph. Under Reduce Motion the
// graph is drawn complete and nothing moves.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { buildPlot } from '../engine/plot.js';

const SERIES = ['var(--plot-a, #7aa2f7)', 'var(--plot-b, #e0af68)', 'var(--plot-c, #9ece6a)'];

function fmt(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** How much of a path to reveal, as a stroke dash pair. */
function dash(length, revealed) {
  const shown = Math.max(0, Math.min(length, revealed));
  return { strokeDasharray: `${length} ${length}`, strokeDashoffset: length - shown };
}

export default function PriPlot({ spec, progress = 1, reduceMotion = false, title, describedBy }) {
  const plot = useMemo(() => {
    try { return buildPlot(spec); } catch (error) { return { error: error?.message || 'This graph could not be drawn.' }; }
  }, [spec]);

  if (plot.error) {
    // Never a blank pair of axes: a student must not read "no graph" as "no
    // solution". Say what happened instead.
    return <p className="muted" role="note">{plot.error}</p>;
  }

  const shown = reduceMotion ? 1 : Math.max(0, Math.min(1, progress));
  const { box, axes, xTicks, yTicks, curves, tangent, area, points, features, window: win } = plot;
  const total = plot.drawLength || 1;
  const revealedTotal = total * shown;

  // The description is what a screen reader gets, and it says the same things
  // the picture does: the function, the window, and the features on it.
  const description = [
    curves.map(c => c.label).join(' and '),
    `over ${plot.xLabel} from ${fmt(win.xMin)} to ${fmt(win.xMax)}`,
    features.roots.length ? `crossing the ${plot.xLabel}-axis at ${features.roots.map(fmt).join(', ')}` : null,
    features.yIntercept !== null ? `and the ${plot.yLabel}-axis at ${fmt(features.yIntercept)}` : null,
    features.turningPoints.length
      ? features.turningPoints.map(t => `a ${t.kind} at (${fmt(t.x)}, ${fmt(t.y)})`).join(' and ')
      : null,
    tangent ? `with the tangent at ${plot.xLabel} = ${fmt(tangent.at.x)}, gradient ${fmt(tangent.gradient)}` : null,
    area ? `and the region from ${fmt(area.from)} to ${fmt(area.to)} shaded, area ${fmt(area.value)}` : null
  ].filter(Boolean).join(', ');

  let used = 0;
  return (
    <figure className="pri-plot" style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        width="100%"
        role="img"
        aria-label={title || description}
        aria-describedby={describedBy}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        <g className="pri-plot-grid" stroke="var(--plot-grid, rgba(255,255,255,0.08))" strokeWidth="1">
          {xTicks.map(t => <line key={`gx${t.value}`} x1={t.x} y1={box.pad.top} x2={t.x} y2={box.height - box.pad.bottom} />)}
          {yTicks.map(t => <line key={`gy${t.value}`} x1={box.pad.left} y1={t.y} x2={box.width - box.pad.right} y2={t.y} />)}
        </g>

        <g className="pri-plot-axes" stroke="var(--plot-axis, rgba(255,255,255,0.45))" strokeWidth="1.5">
          {axes.x.visible && <line x1={box.pad.left} y1={axes.x.y} x2={box.width - box.pad.right} y2={axes.x.y} />}
          {axes.y.visible && <line x1={axes.y.x} y1={box.pad.top} x2={axes.y.x} y2={box.height - box.pad.bottom} />}
        </g>

        <g className="pri-plot-ticks" fill="var(--plot-label, rgba(255,255,255,0.6))" fontSize="11" textAnchor="middle">
          {xTicks.filter(t => t.value !== 0).map(t => (
            <text key={`tx${t.value}`} x={t.x} y={(axes.x.visible ? axes.x.y : box.height - box.pad.bottom) + 14}>{fmt(t.value)}</text>
          ))}
          {yTicks.filter(t => t.value !== 0).map(t => (
            <text key={`ty${t.value}`} x={(axes.y.visible ? axes.y.x : box.pad.left) - 8} y={t.y + 4} textAnchor="end">{fmt(t.value)}</text>
          ))}
        </g>

        {area && (
          <path
            d={area.d}
            fill="var(--plot-area, rgba(122,162,247,0.22))"
            stroke="none"
            style={{ opacity: shown >= 0.75 ? 1 : Math.max(0, (shown - 0.4) / 0.35) }}
          />
        )}

        <g className="pri-plot-curves" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {curves.map(curve => curve.paths.map((path, i) => {
            const before = used;
            used += path.length;
            const revealed = Math.max(0, Math.min(path.length, revealedTotal - before));
            return (
              <path
                key={`${curve.id}-${i}`}
                d={path.d}
                stroke={SERIES[curve.series % SERIES.length]}
                style={reduceMotion ? undefined : dash(path.length, revealed)}
              />
            );
          }))}
        </g>

        {tangent && (
          <path
            d={tangent.d}
            fill="none"
            stroke="var(--plot-tangent, #f7768e)"
            strokeWidth="2"
            strokeDasharray="6 5"
            style={{ opacity: shown >= 0.85 ? 1 : Math.max(0, (shown - 0.55) / 0.3) }}
          />
        )}

        <g className="pri-plot-points">
          {points.map((p, i) => (
            <g key={`p${i}`} style={{ opacity: shown >= 0.9 ? 1 : Math.max(0, (shown - 0.6) / 0.3) }}>
              <circle cx={p.cx} cy={p.cy} r="4.5" fill="var(--plot-point, #e0af68)" />
              {p.label && <text x={p.cx + 8} y={p.cy - 8} fontSize="12" fill="var(--plot-label, rgba(255,255,255,0.8))">{p.label}</text>}
            </g>
          ))}
        </g>

        <text x={box.width - box.pad.right} y={box.height - 8} textAnchor="end" fontSize="12" fill="var(--plot-label, rgba(255,255,255,0.6))">
          {plot.xLabel}
        </text>
        <text x={12} y={box.pad.top - 8} fontSize="12" fill="var(--plot-label, rgba(255,255,255,0.6))">{plot.yLabel}</text>
      </svg>

      <figcaption className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {curves.map(c => c.label).join(' · ')}
        {tangent ? ` · tangent gradient ${fmt(tangent.gradient)}` : ''}
        {area ? ` · area ${fmt(area.value)}` : ''}
      </figcaption>
    </figure>
  );
}
