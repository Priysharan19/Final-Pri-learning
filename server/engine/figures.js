// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Figure builders
// Parameterized SVG diagrams for questions. Everything draws in currentColor
// (inherits the page ink — dark app, white printed paper) with a fixed blue
// accent, so the same figure works in-app, in solutions and on printed papers.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = '#3987e5';
const WARN = '#f59e0b';
const NUM = v => Math.round(v * 100) / 100;

function svgWrap(inner, w, h, aria) {
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}" style="max-width:${Math.min(440, w)}px;width:100%;height:auto;display:block">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
}
const txt = (x, y, s, opts = {}) =>
  `<text x="${NUM(x)}" y="${NUM(y)}" fill="currentColor" stroke="none" font-size="${opts.size || 13.5}" font-family="Inter, system-ui, sans-serif" text-anchor="${opts.anchor || 'middle'}"${opts.style ? ` font-style="${opts.style}"` : ''}>${s}</text>`;
const line = (x1, y1, x2, y2, opts = {}) =>
  `<line x1="${NUM(x1)}" y1="${NUM(y1)}" x2="${NUM(x2)}" y2="${NUM(y2)}"${opts.stroke ? ` stroke="${opts.stroke}"` : ''}${opts.dash ? ' stroke-dasharray="4 4"' : ''}${opts.w ? ` stroke-width="${opts.w}"` : ''}/>`;
const poly = (pts, opts = {}) =>
  `<polygon points="${pts.map(p => `${NUM(p[0])},${NUM(p[1])}`).join(' ')}"${opts.fill ? ` fill="${opts.fill}" fill-opacity="0.12"` : ''}${opts.stroke ? ` stroke="${opts.stroke}"` : ''}/>`;
const arcPath = (cx, cy, r, a0, a1, opts = {}) => {
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(a1)], p1y = cy + r * Math.sin(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `<path d="M ${NUM(p0[0])} ${NUM(p0[1])} A ${r} ${r} 0 ${large} 1 ${NUM(p1[0])} ${NUM(p1y)}"${opts.stroke ? ` stroke="${opts.stroke}"` : ''}/>`;
};
/** Minor-arc wedge between two direction angles (always the short way round). */
const wedge = (cx, cy, r, a0, a1, opts = {}) => {
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const end = a0 + d;
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(end), cy + r * Math.sin(end)];
  return `<path d="M ${NUM(p0[0])} ${NUM(p0[1])} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${NUM(p1[0])} ${NUM(p1[1])}"${opts.stroke ? ` stroke="${opts.stroke}"` : ''}/>`;
};
const rightMark = (x, y, ux, uy, vx, vy, s = 11) => {
  // small square at corner (x,y) along unit directions u and v
  const p1 = [x + ux * s, y + uy * s];
  const p2 = [x + ux * s + vx * s, y + uy * s + vy * s];
  const p3 = [x + vx * s, y + vy * s];
  return `<polyline points="${NUM(p1[0])},${NUM(p1[1])} ${NUM(p2[0])},${NUM(p2[1])} ${NUM(p3[0])},${NUM(p3[1])}"/>`;
};

// ── Right-angled triangle ────────────────────────────────────────────────────
/**
 * Right angle at bottom-left. labels: {base, height, hyp, angle, anglePos:'base'|'top'}
 * Pass null to omit a label; '?' marks the unknown in accent colour.
 */
export function figRightTriangle({ base, height, hyp, angle, anglePos = 'base' } = {}) {
  const W = 300, H = 210;
  const A = [76, 176], B = [264, 176], C = [76, 40]; // right angle at A
  const lab = (v, x, y, anchor = 'middle') => v == null ? '' :
    `<text x="${NUM(x)}" y="${NUM(y)}" stroke="none" font-size="14" font-weight="600" font-family="Inter, system-ui, sans-serif" text-anchor="${anchor}" fill="${String(v).includes('?') ? ACCENT : 'currentColor'}">${v}</text>`;
  let inner = poly([A, B, C], { fill: ACCENT });
  inner += rightMark(A[0], A[1], 1, 0, 0, -1);
  inner += lab(base, (A[0] + B[0]) / 2, 196);
  inner += lab(height, 68, (A[1] + C[1]) / 2 + 5, 'end');
  inner += lab(hyp, (B[0] + C[0]) / 2 + 16, (B[1] + C[1]) / 2 - 6, 'start');
  if (angle != null) {
    if (anglePos === 'base') {
      // wedge at B between ray B→C and ray B→A (small arc)
      inner += wedge(B[0], B[1], 34, Math.atan2(C[1] - B[1], C[0] - B[0]), Math.PI, { stroke: WARN });
      inner += `<text x="${B[0] - 52}" y="${B[1] - 12}" stroke="none" fill="${WARN}" font-size="13.5" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${angle}</text>`;
    } else {
      // wedge at C between ray C→B and ray C→A (downward vertical)
      inner += wedge(C[0], C[1], 30, Math.atan2(B[1] - C[1], B[0] - C[0]), Math.PI / 2, { stroke: WARN });
      inner += `<text x="${C[0] + 26}" y="${C[1] + 44}" stroke="none" fill="${WARN}" font-size="13.5" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${angle}</text>`;
    }
  }
  return svgWrap(inner, W, H, 'Right-angled triangle');
}

// ── Parallel lines cut by a transversal ─────────────────────────────────────
/** kind: 'alternate' | 'corresponding' | 'co-interior'; given angle string, unknown 'θ' */
export function figParallelLines({ given = '65°', unknown = 'θ', kind = 'alternate' } = {}) {
  const W = 320, H = 220;
  const y1 = 70, y2 = 160;
  const tTop = [200, 30], tBot = [96, 196]; // transversal crossing both
  const cross = yy => {
    const t = (yy - tTop[1]) / (tBot[1] - tTop[1]);
    return [tTop[0] + t * (tBot[0] - tTop[0]), yy];
  };
  const c1 = cross(y1), c2 = cross(y2);
  let inner = line(24, y1, W - 24, y1) + line(24, y2, W - 24, y2) + line(tTop[0] + 18, tTop[1] - 8, tBot[0] - 18, tBot[1] + 8);
  // arrows for parallel
  inner += `<path d="M ${W - 60} ${y1 - 5} l 10 5 l -10 5" /><path d="M ${W - 60} ${y2 - 5} l 10 5 l -10 5" />`;
  const gLab = `<text x="${c1[0] + 26}" y="${y1 + 22}" stroke="none" fill="currentColor" font-size="14" font-family="Inter, system-ui, sans-serif">${given}</text>`;
  let uPos;
  if (kind === 'alternate') uPos = [c2[0] - 46, y2 - 10];          // inside, opposite side
  else if (kind === 'corresponding') uPos = [c2[0] + 26, y2 + 22]; // matching corner
  else uPos = [c2[0] + 26, y2 - 10];                               // co-interior: inside, same side
  const uLab = `<text x="${NUM(uPos[0])}" y="${NUM(uPos[1])}" stroke="none" fill="${ACCENT}" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">${unknown}</text>`;
  return svgWrap(inner + gLab + uLab, W, H, 'Parallel lines cut by a transversal');
}

// ── Angles meeting at a point ────────────────────────────────────────────────
/** angles: array of degree numbers (one may be the string '?') summing to 360 */
export function figAnglesAtPoint(angles) {
  const W = 280, H = 230;
  const cx = 140, cy = 118, R = 86;
  let a = -Math.PI / 2;
  let inner = '';
  const vals = angles.map(v => typeof v === 'number' ? v : null);
  const total = vals.reduce((s, v) => s + (v || 0), 0);
  const missing = 360 - total;
  angles.forEach((v, i) => {
    const deg = typeof v === 'number' ? v : missing;
    const a2 = a + deg * Math.PI / 180;
    inner += line(cx, cy, cx + R * Math.cos(a), cy + R * Math.sin(a));
    const mid = (a + a2) / 2;
    const isUnknown = typeof v !== 'number';
    inner += arcPath(cx, cy, 30 + i * 5, a, a2, { stroke: isUnknown ? ACCENT : undefined });
    inner += `<text x="${NUM(cx + (52 + i * 6) * Math.cos(mid))}" y="${NUM(cy + (52 + i * 6) * Math.sin(mid) + 5)}" stroke="none" font-family="Inter, system-ui, sans-serif" text-anchor="middle" font-size="13.5" ${isUnknown ? `fill="${ACCENT}" font-weight="700"` : 'fill="currentColor"'}>${isUnknown ? v : v + '°'}</text>`;
    a = a2;
  });
  inner += line(cx, cy, cx + R * Math.cos(a), cy + R * Math.sin(a));
  return svgWrap(inner, W, H, 'Angles at a point');
}

// ── Rectangle / composite L-shape ────────────────────────────────────────────
export function figRect({ l = '12 cm', w = '7 cm' } = {}) {
  const W = 300, H = 190;
  let inner = `<rect x="60" y="40" width="182" height="108" fill="${ACCENT}" fill-opacity="0.12" stroke="currentColor"/>`;
  inner += txt(151, 172, l) + txt(42, 100, w, { anchor: 'middle' });
  return svgWrap(inner, W, H, 'Rectangle');
}

export function figLShape({ W1, H1, w2, h2 } = {}) {
  // Big rectangle W1×H1 with top-right w2×h2 bite removed. Labels are strings.
  const W = 330, H = 230;
  const sx = 190 / 100, sy = 130 / 100; // drawing scale on a 100 basis
  const bw = 200, bh = 140, bx = 62, by = 44;
  const cw = bw * 0.42, ch = bh * 0.38;
  const pts = [
    [bx, by], [bx + bw - cw, by], [bx + bw - cw, by + ch], [bx + bw, by + ch],
    [bx + bw, by + bh], [bx, by + bh]
  ];
  let inner = poly(pts, { fill: ACCENT });
  inner += txt(bx + bw / 2, by + bh + 20, W1);                       // bottom width
  inner += txt(bx - 22, by + bh / 2 + 4, H1);                        // left height
  inner += txt(bx + bw - cw / 2, by - 8, w2, { size: 12.5 });        // cut width (above the notch)
  inner += txt(bx + bw + 8, by + ch / 2 + 4, h2, { size: 12.5, anchor: 'start' }); // cut height (right of the step)
  return svgWrap(inner, W, H, 'L-shaped composite figure');
}

// ── Circle ───────────────────────────────────────────────────────────────────
export function figCircle({ label = 'r = 7 cm', diameter = false } = {}) {
  const W = 260, H = 210;
  const cx = 130, cy = 104, R = 74;
  let inner = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${ACCENT}" fill-opacity="0.1" stroke="currentColor"/>`;
  if (diameter) {
    inner += line(cx - R, cy, cx + R, cy) + `<circle cx="${cx}" cy="${cy}" r="2.5" fill="currentColor" stroke="none"/>`;
    inner += txt(cx, cy - 8, label);
  } else {
    inner += line(cx, cy, cx + R * 0.94, cy - R * 0.34) + `<circle cx="${cx}" cy="${cy}" r="2.5" fill="currentColor" stroke="none"/>`;
    inner += txt(cx + 34, cy - 26, label, { size: 13 });
  }
  return svgWrap(inner, W, H, 'Circle');
}

// ── Box plot ─────────────────────────────────────────────────────────────────
export function figBoxPlot({ min, q1, med, q3, max, axisMin, axisMax }) {
  const W = 380, H = 150;
  const lo = axisMin ?? Math.floor(min - (max - min) * 0.12);
  const hi = axisMax ?? Math.ceil(max + (max - min) * 0.12);
  const X = v => 34 + (v - lo) / Math.max(1e-6, hi - lo) * (W - 68);
  const yMid = 62, boxH = 34;
  let inner = '';
  inner += line(X(min), yMid, X(q1), yMid);
  inner += line(X(q3), yMid, X(max), yMid);
  inner += line(X(min), yMid - 12, X(min), yMid + 12);
  inner += line(X(max), yMid - 12, X(max), yMid + 12);
  inner += `<rect x="${NUM(X(q1))}" y="${yMid - boxH / 2}" width="${NUM(X(q3) - X(q1))}" height="${boxH}" fill="${ACCENT}" fill-opacity="0.14" stroke="currentColor"/>`;
  inner += line(X(med), yMid - boxH / 2, X(med), yMid + boxH / 2, { w: 2.4 });
  // axis
  inner += line(30, 116, W - 30, 116);
  const step = Math.max(1, Math.round((hi - lo) / 6));
  for (let v = lo; v <= hi; v += step) {
    inner += line(X(v), 112, X(v), 120) + txt(X(v), 136, v, { size: 11.5 });
  }
  return svgWrap(inner, W, H, 'Box plot');
}

// ── Parabola sketch ──────────────────────────────────────────────────────────
/** y = a(x-h)^2 + k drawn on a small grid; marks vertex and intercepts if provided */
export function figParabola({ a = 1, h = 0, k = 0, xInts = null, showVertex = true } = {}) {
  const W = 300, H = 230;
  const X = x => 150 + x * 22, Y = y => 118 - y * 16;
  let inner = line(20, Y(0), W - 20, Y(0)) + line(X(0), 16, X(0), H - 26); // axes
  inner += `<path d="M ${W - 26} ${Y(0) - 4} l 8 4 l -8 4" /><path d="M ${X(0) - 4} 22 l 4 -8 l 4 8" />`;
  inner += txt(W - 16, Y(0) + 16, 'x', { style: 'italic' }) + txt(X(0) - 14, 24, 'y', { style: 'italic' });
  let d = '';
  for (let px = -5.6; px <= 5.6; px += 0.25) {
    const py = a * (px - h) * (px - h) + k;
    if (Y(py) < 6 || Y(py) > H) { d && (d += ' '); continue; }
    d += (d ? 'L' : 'M') + `${NUM(X(px))} ${NUM(Y(py))} `;
  }
  inner += `<path d="${d.trim()}" stroke="${ACCENT}" stroke-width="2.2"/>`;
  if (showVertex) {
    inner += `<circle cx="${NUM(X(h))}" cy="${NUM(Y(k))}" r="3.5" fill="${ACCENT}" stroke="none"/>`;
  }
  if (xInts) for (const xi of xInts) {
    inner += `<circle cx="${NUM(X(xi))}" cy="${NUM(Y(0))}" r="3.5" fill="currentColor" stroke="none"/>`;
  }
  return svgWrap(inner, W, H, 'Parabola on coordinate axes');
}

// ── Bearings diagram ─────────────────────────────────────────────────────────
/** One leg from O at a true bearing; N arrow, angle arc from north. */
export function figBearing({ bearing = 120, dist = '40 km', to = 'B' } = {}) {
  const W = 280, H = 240;
  const O = [96, 150];
  // unit vector from north, clockwise
  const ux = Math.sin(bearing * Math.PI / 180), uy = -Math.cos(bearing * Math.PI / 180);
  const P = [O[0] + 118 * ux, O[1] + 118 * uy];
  let inner = line(O[0], O[1], O[0], O[1] - 96); // north
  inner += `<path d="M ${O[0] - 5} ${O[1] - 88} l 5 -10 l 5 10" />` + txt(O[0], O[1] - 104, 'N');
  inner += line(O[0], O[1], P[0], P[1], { stroke: ACCENT, w: 2 });
  inner += `<circle cx="${NUM(O[0])}" cy="${NUM(O[1])}" r="3" fill="currentColor" stroke="none"/><circle cx="${NUM(P[0])}" cy="${NUM(P[1])}" r="3" fill="${ACCENT}" stroke="none"/>`;
  inner += arcPath(O[0], O[1], 34, -Math.PI / 2, -Math.PI / 2 + bearing * Math.PI / 180, { stroke: WARN });
  const mid = -Math.PI / 2 + bearing * Math.PI / 180 * 0.55;
  inner += `<text x="${NUM(O[0] + 52 * Math.cos(mid))}" y="${NUM(O[1] + 52 * Math.sin(mid) + 4)}" stroke="none" fill="${WARN}" font-size="13" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${String(bearing).padStart(3, '0')}°</text>`;
  inner += txt(O[0] + 10, O[1] + 18, 'O') + txt(P[0] + 14, P[1] + 2, to);
  inner += `<text x="${NUM((O[0] + P[0]) / 2 + 16)}" y="${NUM((O[1] + P[1]) / 2 - 8)}" stroke="none" fill="currentColor" font-size="12.5" font-family="Inter, system-ui, sans-serif">${dist}</text>`;
  return svgWrap(inner, W, H, 'True bearing diagram');
}

// ── Network graph (Standard pathway) ─────────────────────────────────────────
/** nodes: ['A','B',...]; edges: [[i, j, weight]] — drawn on a preset layout */
export function figNetwork({ nodes, edges }) {
  const W = 340, H = 250;
  const LAYOUTS = {
    4: [[60, 70], [260, 60], [80, 190], [270, 185]],
    5: [[52, 120], [150, 40], [268, 78], [258, 196], [120, 208]],
    6: [[50, 70], [170, 34], [286, 78], [286, 182], [162, 218], [48, 172]]
  };
  const pos = LAYOUTS[nodes.length] || LAYOUTS[5];
  let inner = '';
  for (const [i, j, w] of edges) {
    const [x1, y1] = pos[i], [x2, y2] = pos[j];
    inner += line(x1, y1, x2, y2);
    inner += `<rect x="${NUM((x1 + x2) / 2 - 13)}" y="${NUM((y1 + y2) / 2 - 11)}" width="26" height="18" rx="5" fill="${ACCENT}" fill-opacity="0.16" stroke="none"/>`;
    inner += txt((x1 + x2) / 2, (y1 + y2) / 2 + 3.5, w, { size: 12 });
  }
  nodes.forEach((n, i) => {
    const [x, y] = pos[i];
    inner += `<circle cx="${x}" cy="${y}" r="15" fill="${ACCENT}" fill-opacity="0.18" stroke="currentColor"/>`;
    inner += txt(x, y + 4.5, n, { size: 13 });
  });
  return svgWrap(inner, W, H, 'Weighted network');
}

// ── Angles on a straight line ────────────────────────────────────────────────
export function figStraightLineAngles({ known, unknown = 'θ' }) {
  const W = 300, H = 170;
  const O = [150, 128];
  const a = known * Math.PI / 180;               // ray measured from the RIGHT arm, ccw
  const R = [O[0] + 108 * Math.cos(a), O[1] - 108 * Math.sin(a)];
  let inner = line(24, O[1], W - 24, O[1]);      // the straight line
  inner += line(O[0], O[1], R[0], R[1]);         // the ray
  inner += `<circle cx="${O[0]}" cy="${O[1]}" r="2.5" fill="currentColor" stroke="none"/>`;
  inner += arcPath(O[0], O[1], 32, -a, 0, { stroke: ACCENT });   // unknown: ray → right arm
  inner += arcPath(O[0], O[1], 40, Math.PI, 2 * Math.PI - a, {}); // known: left arm → ray (upper side)
  inner += `<text x="${NUM(O[0] - 70)}" y="${NUM(O[1] - 20)}" stroke="none" fill="currentColor" font-size="13.5" font-family="Inter, system-ui, sans-serif">${known}°</text>`;
  inner += `<text x="${NUM(O[0] + 56)}" y="${NUM(O[1] - 18)}" stroke="none" fill="${ACCENT}" font-weight="700" font-size="14.5" font-family="Inter, system-ui, sans-serif">${unknown}</text>`;
  return svgWrap(inner, W, H, 'Angles on a straight line');
}
