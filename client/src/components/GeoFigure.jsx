// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a constructed figure in a worked solution
//
// Draws what engine/figureSpec.js constructed: inline SVG, theme tokens only,
// no images. Loaded on demand (React.lazy in QuestionCard) so the main bundle
// does not carry it. The figure is described in words for a screen reader and
// the same words sit visibly in the caption.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId } from 'react';
import { figureAlt, figureGeometry } from '../engine/figureSpec.js';
import { useT } from '../i18n/index.js';

const INK = 'var(--ink, currentColor)';
const MUTED = 'var(--muted, currentColor)';

export default function GeoFigure({ spec }) {
  const t = useT();
  const id = useId();
  const g = figureGeometry(spec);
  if (!g) return null;
  const alt = figureAlt(spec, t);
  return (
    <figure className="geo-figure" data-geo-figure={spec.kind} style={{ margin: '4px 0 14px' }}>
      <svg viewBox={`0 0 ${g.size} ${g.size}`} width="100%" role="img" aria-labelledby={`${id}-t`}
        style={{ display: 'block', maxWidth: 280 }}>
        <title id={`${id}-t`}>{alt}</title>
        {g.circle ? (
          <g fill="none" stroke={INK} strokeWidth="1.5">
            <circle cx={g.circle.cx} cy={g.circle.cy} r={g.circle.r} />
            <line x1={g.circle.cx} y1={g.circle.cy} x2={g.circle.cx + g.circle.r} y2={g.circle.cy} strokeDasharray="4 3" />
            <circle cx={g.circle.cx} cy={g.circle.cy} r="2" fill={INK} />
            <text x={g.circle.cx + g.circle.r / 2} y={g.circle.cy - 6} textAnchor="middle" fill={MUTED} stroke="none" fontSize="12">{g.label}</text>
          </g>
        ) : (
          <g>
            <polygon points={['A', 'B', 'C'].map(k => g.points[k].join(',')).join(' ')} fill="none" stroke={INK} strokeWidth="1.5" />
            {g.edges.map(e => (
              <text key={e.from + e.to} x={e.at[0]} y={e.at[1]} dy={e.from === 'A' ? 16 : -4} textAnchor="middle" fill={MUTED} fontSize="12">{e.label}</text>
            ))}
            {Object.entries(g.points).map(([k, [x, y]]) => (
              <text key={k} x={x} y={y} dy={k === 'C' ? -6 : 14} dx={k === 'A' ? -8 : k === 'B' ? 8 : 0} textAnchor="middle" fill={INK} fontSize="13">{k}</text>
            ))}
          </g>
        )}
      </svg>
      <figcaption className="muted" style={{ fontSize: 13 }}>{alt}</figcaption>
    </figure>
  );
}
