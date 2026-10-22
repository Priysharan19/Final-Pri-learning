// Pri Luxury · pressure ink outline (presentation only).
//
// Ported from the v3 spec's craft JS (`outline()` / `fillPoly()`): a stroke is
// drawn as a filled polygon whose half-width follows each point's ink width,
// tapered over the first and last six points, and closed with midpoint
// quadratics so the edge stays smooth. The point's width `w` is the one the
// canvas already shapes from pressure (pen) or speed (mouse, finger), so the
// stored stroke data, recognition and marking see exactly what they saw before:
// this file only changes how existing points are painted.

const TAPER = 6;

/**
 * Outline polygon of a stroke.
 * @param {Array<{x:number,y:number,w?:number}>} pts
 * @param {{scale?:number, base?:number, taperEnd?:boolean}} [o]
 *   scale widens every point (the wet-ink swell); taperEnd=false leaves the
 *   tip blunt while the pen is still down, so the nib never looks like it lifts.
 * @returns {number[]|null} flat [x0,y0,x1,y1,…] left edge then right edge reversed
 */
export function outline(pts, o = {}) {
  const n = pts?.length || 0;
  if (n < 2) return null;
  const scale = o.scale || 1;
  const base = o.base || 3.05;
  const taperEnd = o.taperEnd !== false;
  const out = new Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = pts[i > 0 ? i - 1 : 0];
    const b = pts[i < n - 1 ? i + 1 : n - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let w = ((pts[i].w || base) * scale) / 2;
    const fromEnd = taperEnd ? n - 1 - i : Infinity;
    const t = Math.min(1, Math.min(i, fromEnd) / TAPER);
    w *= 0.35 + 0.65 * t;
    const nx = (-dy / len) * w, ny = (dx / len) * w;
    // left edge forward, right edge backward: one closed loop
    out[i * 2] = pts[i].x + nx; out[i * 2 + 1] = pts[i].y + ny;
    const r = (2 * n - 1 - i) * 2;
    out[r] = pts[i].x - nx; out[r + 1] = pts[i].y - ny;
  }
  return out;
}

/** Fill an outline with midpoint quadratics (the spec's fillPoly). */
export function fillOutline(ctx, poly) {
  if (!ctx || !poly || poly.length < 6) return;
  ctx.beginPath();
  ctx.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) {
    const ax = poly[i - 2], ay = poly[i - 1], bx = poly[i], by = poly[i + 1];
    ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

/** A single dot (a tap) in outline style. */
export function fillDot(ctx, p, base = 3.05, scale = 1) {
  if (!ctx || !p) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(1.4, ((p.w || base) * scale) / 2), 0, Math.PI * 2);
  ctx.fill();
}

/** Paint a whole stroke as outline ink. */
export function paintOutlineStroke(ctx, pts, color, { alpha = 1, scale = 1, base, taperEnd } = {}) {
  if (!ctx || !pts?.length) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (pts.length === 1) fillDot(ctx, pts[0], base, scale);
  else fillOutline(ctx, outline(pts, { scale, base, taperEnd }));
  ctx.globalAlpha = 1;
}

/** `#rrggbb` (or `#rgb`, or rgb()) multiplied toward black by `k` (0.88 = 12% darker). */
export function darken(color, k) {
  const s = String(color || '').trim();
  let r, g, b;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
    if (!m) return s;
    r = +m[1]; g = +m[2]; b = +m[3];
  }
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

/** Wet-ink state of a stroke `age` ms after it was lifted: settles over 400ms. */
export const WET_MS = 400;
export function wetness(age) {
  if (!(age >= 0) || age >= WET_MS) return 0;
  const x = age / WET_MS;
  return 1 - x * x * (3 - 2 * x);   // smoothstep, no overshoot: ink never bounces
}
