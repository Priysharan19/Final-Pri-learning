// Pri Learning · diagram pack "plane": kind names and pure spec validators (no React).
// See docs/design/notes-e3-contract.md §2 for every kind's spec. validate(params) returns a
// list of problems (empty when the spec is good); model(params) is the pure geometry the
// component draws, so tests can check the numbers without a browser.
//
// Every number a label or a description states (an angle in degrees, a segment length, an
// area, a ratio) is computed here from the spec and rounded with r3, never typed by a
// writer. Geometry is drawn with ONE scale on both axes unless a spec says otherwise, the
// axes pass through the true origin whenever 0 is in range, and every label is placed by
// one collision-avoiding placer (placeLabels) inside the viewBox.
import { makeFrame, niceTicks, compile, sampleSegments, r3, circleTheoremModel } from '../geometry.js';
import { evalNumeric } from '../../engine/expr.js';

// ── Small pure helpers ───────────────────────────────────────────────────────
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isPt = p => Array.isArray(p) && p.length === 2 && p.every(isNum);
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mod360 = d => ((d % 360) + 360) % 360;
const fmtPt = p => `(${r3(p[0], 3)}, ${r3(p[1], 3)})`;
/** True when rounding to `digits` places changed the number (so a readout writes ≈, not =). */
const inexact = (x, digits) => Math.abs(r3(x, digits) - x) > 1e-9;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/** The interior angle (degrees, 0–180) at `at` between the rays to `from` and to `to`. */
export function angleBetween(at, from, to) {
  const a1 = Math.atan2(from[1] - at[1], from[0] - at[0]);
  const a2 = Math.atan2(to[1] - at[1], to[0] - at[0]);
  let d = Math.abs(toDeg(a1 - a2)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Shoelace area (always positive) and perimeter of a polygon. */
export function polygonMeasures(pts) {
  let s = 0; let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1; per += Math.hypot(x2 - x1, y2 - y1);
  }
  return { area: Math.abs(s) / 2, perimeter: per };
}

/** A rough width (px) of a KaTeX label at 14 px, for placement. */
export function texWidth(tex, size = 14) {
  const s = String(tex).replace(/\\(?:tfrac|frac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, '$1').replace(/\\[a-zA-Z]+/g, 'm').replace(/[{}^_]|\\[,;!]/g, '');
  return Math.max(18, Math.round(s.length * size * 0.56 + 10));
}

// ── Label placement ──────────────────────────────────────────────────────────
const DIRS = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
export const POSITIONS = Object.freeze(Object.keys(DIRS));
const RING = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const boxAt = (cx, cy, w, h) => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });

/** Candidate label centres round an anchor, the preferred compass position first, then its neighbours. */
export function compassCandidates(x, y, w, h, pos = 'ne', gap = 7) {
  const i = Math.max(0, RING.indexOf(pos));
  const order = [0, 1, -1, 2, -2, 3, -3, 4].map(k => RING[(i + k + 8) % 8]);
  const out = [];
  for (const g of [gap, gap + 10]) for (const p of order) { const [dx, dy] = DIRS[p]; out.push([x + dx * (g + w / 2), y + dy * (g + h / 2), p]); }
  return out;
}

/**
 * Place labels one by one so that none overlaps another, a reserved box (dots, tick
 * labels) or the edge of the viewBox: each label takes its first candidate centre that
 * is clear; when none is, the one that overlaps least. Pure; returns { cx, cy, w, h }.
 */
export function placeLabels(items, { width, height, reserved = [] }) {
  const placed = reserved.map(r => ({ ...r }));
  return items.map(it => {
    let best = null; let bestScore = Infinity;
    for (const [cx0, cy0, pos] of it.candidates) {
      const cx = clamp(cx0, it.w / 2 + 1, width - it.w / 2 - 1); const cy = clamp(cy0, it.h / 2 + 1, height - it.h / 2 - 1);
      const b = boxAt(cx, cy, it.w, it.h);
      let score = placed.reduce((s, q) => s + overlapArea(b, q) * (q.weight ?? 1), 0);
      if (cx !== cx0 || cy !== cy0) score += 0.5; // a clamped spot is a little worse than a free one
      if (score < bestScore) { best = { cx: r3(cx, 2), cy: r3(cy, 2), w: it.w, h: it.h, pos: pos || null }; bestScore = score; }
      if (score === 0) break;
    }
    placed.push(boxAt(best.cx, best.cy, best.w, best.h));
    return { ...best, tex: it.tex, cls: it.cls || '', overlap: r3(bestScore, 2) };
  });
}

// pixel-space arc (angles in the usual mathematical sense, y up) as a polyline
function pxArc(c, r, a0, a1, n = 24) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = toRad(a0 + ((a1 - a0) * k) / n); out.push([r3(c[0] + r * Math.cos(t), 2), r3(c[1] - r * Math.sin(t), 2)]); }
  return out;
}
const pxDir = (from, to) => toDeg(Math.atan2(-(to[1] - from[1]), to[0] - from[0])); // screen y is down
/** The arc, right-angle mark and label candidates for the interior angle at `at` (pixel coordinates). */
function angleMark(at, p, q, { radius = 20, right = false, labelW = 40, labelH = 20 } = {}) {
  const d1 = pxDir(at, p); const d2 = pxDir(at, q);
  let sweep = mod360(d2 - d1); let start = d1;
  if (sweep > 180) { start = d2; sweep = 360 - sweep; }
  const mid = start + sweep / 2;
  const out = { arc: right ? null : pxArc(at, radius, start, start + sweep), square: null, candidates: [] };
  if (right) {
    const u = [Math.cos(toRad(d1)), -Math.sin(toRad(d1))]; const v = [Math.cos(toRad(d2)), -Math.sin(toRad(d2))]; const s = 12;
    out.square = [[at[0] + u[0] * s, at[1] + u[1] * s], [at[0] + (u[0] + v[0]) * s, at[1] + (u[1] + v[1]) * s], [at[0] + v[0] * s, at[1] + v[1] * s]].map(([x, y]) => [r3(x, 2), r3(y, 2)]);
  }
  const half = Math.max(Math.sin(toRad(sweep / 2)), 0.12);
  const base = clamp((Math.max(labelW, labelH) / 2 + 4) / half, radius + 14, 90);
  for (const extra of [0, 12, 24, 40]) for (const turn of [0, -0.18, 0.18, -0.4, 0.4]) {
    const t = toRad(mid + turn * sweep); const rr = base + extra;
    out.candidates.push([at[0] + rr * Math.cos(t), at[1] - rr * Math.sin(t)]);
  }
  return out;
}

// ── Validation helpers ───────────────────────────────────────────────────────
function unknownKeys(obj, allowed, where, errs) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { errs.push(`${where} must be an object`); return false; }
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errs.push(`${where}: unknown param "${k}" (allowed: ${allowed.join(', ')})`);
  return true;
}
function needNum(obj, key, where, errs, { min = -Infinity, max = Infinity, int = false, optional = false, step = null } = {}) {
  const v = obj[key];
  if (v === undefined) { if (!optional) errs.push(`${where}: ${key} is required`); return false; }
  if (!isNum(v)) { errs.push(`${where}: ${key} must be a number (got ${JSON.stringify(v)})`); return false; }
  if (int && !Number.isInteger(v)) { errs.push(`${where}: ${key} must be a whole number (got ${v})`); return false; }
  if (v < min || v > max) { errs.push(`${where}: ${key} = ${v} is outside ${min} to ${max}`); return false; }
  if (step && Math.abs(v / step - Math.round(v / step)) > 1e-9) { errs.push(`${where}: ${key} = ${v} must be a multiple of ${step} (the slider's step)`); return false; }
  return true;
}
const isText = v => typeof v === 'string' || isNum(v);
function optText(obj, key, where, errs) { if (obj[key] !== undefined && !isText(obj[key])) errs.push(`${where}: ${key} must be text (KaTeX)`); }
function optBool(obj, key, where, errs) { if (obj[key] !== undefined && typeof obj[key] !== 'boolean') errs.push(`${where}: ${key} must be true or false`); }
const COMMON = ['title', 'caption'];

// ═════════════════════════════════════════════════════════════════════════════
// plane — the general figure on a coordinate plane
// ═════════════════════════════════════════════════════════════════════════════
const PLANE_KEYS = ['xmin', 'xmax', 'ymin', 'ymax', 'axes', 'grid', 'equal', 'points', 'segments', 'lines', 'polygons', 'circles', 'arcs', 'angles', 'curves', 'param', 'xLabel', 'yLabel', ...COMMON];
const LIST_KEYS = {
  points: ['x', 'y', 'label', 'pos'],
  segments: ['from', 'to', 'label', 'dashed', 'ticks', 'arrow', 'pos'],
  lines: ['through', 'label', 'dashed'],
  polygons: ['points', 'label', 'shade', 'dashed'],
  circles: ['cx', 'cy', 'r', 'label', 'dashed'],
  arcs: ['cx', 'cy', 'r', 'from', 'to', 'label'],
  angles: ['at', 'from', 'to', 'label', 'right'],
  curves: ['expr', 'label', 'domain'],
  param: ['x', 'y', 't', 'label']
};

function paramFns(p) {
  const fx = t => { try { const v = evalNumeric(String(p.x), { t }); return isNum(v) ? v : NaN; } catch { return NaN; } };
  const fy = t => { try { const v = evalNumeric(String(p.y), { t }); return isNum(v) ? v : NaN; } catch { return NaN; } };
  return [fx, fy];
}

function validatePlane(params) {
  const errs = [];
  if (!unknownKeys(params, PLANE_KEYS, 'plane', errs)) return errs;
  const okRange = ['xmin', 'xmax', 'ymin', 'ymax'].map(k => needNum(params, k, 'plane', errs)).every(Boolean);
  if (okRange && !(params.xmin < params.xmax)) errs.push(`plane: xmin (${params.xmin}) must be less than xmax (${params.xmax})`);
  if (okRange && !(params.ymin < params.ymax)) errs.push(`plane: ymin (${params.ymin}) must be less than ymax (${params.ymax})`);
  for (const k of ['axes', 'grid', 'equal']) optBool(params, k, 'plane', errs);
  for (const k of ['xLabel', 'yLabel', ...COMMON]) optText(params, k, 'plane', errs);
  if (errs.length) return errs;
  const { xmin, xmax, ymin, ymax } = params;
  const inside = ([x, y]) => x >= xmin - 1e-9 && x <= xmax + 1e-9 && y >= ymin - 1e-9 && y <= ymax + 1e-9;
  const where = (list, i) => `plane: ${list}[${i}]`;
  const out = (w, p) => errs.push(`${w}: ${fmtPt(p)} is outside the frame x ${xmin} to ${xmax}, y ${ymin} to ${ymax}; widen the range`);
  const needPt = (o, key, w) => { if (!isPt(o[key])) { errs.push(`${w}: ${key} must be a point [x, y] of two numbers`); return false; } if (!inside(o[key])) { out(`${w} ${key}`, o[key]); return false; } return true; };
  for (const list of Object.keys(LIST_KEYS)) {
    const v = params[list];
    if (v === undefined) continue;
    if (!Array.isArray(v)) { errs.push(`plane: ${list} must be a list`); continue; }
    v.forEach((item, i) => {
      const w = where(list, i);
      if (!unknownKeys(item, LIST_KEYS[list], w, errs)) return;
      if ('label' in item && list !== 'angles' && list !== 'segments') optText(item, 'label', w, errs);
      if ('dashed' in item) optBool(item, 'dashed', w, errs);
      if (list === 'points') {
        if (needNum(item, 'x', w, errs) && needNum(item, 'y', w, errs) && !inside([item.x, item.y])) out(w, [item.x, item.y]);
        if (item.pos !== undefined && !POSITIONS.includes(item.pos)) errs.push(`${w}: pos must be one of ${POSITIONS.join(', ')}`);
      } else if (list === 'segments') {
        const a = needPt(item, 'from', w); const b = needPt(item, 'to', w);
        if (a && b && item.from[0] === item.to[0] && item.from[1] === item.to[1]) errs.push(`${w}: from and to are the same point, so there is no segment`);
        optText(item, 'label', w, errs);
        if (item.ticks !== undefined) needNum(item, 'ticks', w, errs, { min: 1, max: 3, int: true });
        optBool(item, 'arrow', w, errs);
        if (item.pos !== undefined && !POSITIONS.includes(item.pos)) errs.push(`${w}: pos must be one of ${POSITIONS.join(', ')}`);
      } else if (list === 'lines') {
        const t = item.through;
        if (!Array.isArray(t) || t.length !== 2 || !t.every(isPt)) { errs.push(`${w}: through must be two points [[x, y], [x, y]]`); return; }
        if (t[0][0] === t[1][0] && t[0][1] === t[1][1]) { errs.push(`${w}: the two points are the same, so they do not fix a line`); return; }
        if (!clipLine(t[0], t[1], { xmin, xmax, ymin, ymax })) errs.push(`${w}: the line does not cross the frame`);
      } else if (list === 'polygons') {
        const ps = item.points;
        if (!Array.isArray(ps) || ps.length < 3 || !ps.every(isPt)) { errs.push(`${w}: points must be at least three points [x, y]`); return; }
        ps.forEach((p, j) => { if (!inside(p)) out(`${w} points[${j}]`, p); });
        if (polygonMeasures(ps).area < 1e-9) errs.push(`${w}: the points are collinear, so the polygon has no area`);
        optBool(item, 'shade', w, errs);
      } else if (list === 'circles') {
        if (needNum(item, 'cx', w, errs) & needNum(item, 'cy', w, errs) & needNum(item, 'r', w, errs, { min: 1e-9 })) {
          if (item.cx - item.r < xmin - 1e-9 || item.cx + item.r > xmax + 1e-9 || item.cy - item.r < ymin - 1e-9 || item.cy + item.r > ymax + 1e-9) errs.push(`${w}: the circle (centre ${fmtPt([item.cx, item.cy])}, radius ${item.r}) leaves the frame; widen the range`);
        }
      } else if (list === 'arcs') {
        if (needNum(item, 'cx', w, errs) & needNum(item, 'cy', w, errs) & needNum(item, 'r', w, errs, { min: 1e-9 }) & needNum(item, 'from', w, errs) & needNum(item, 'to', w, errs)) {
          if (item.from === item.to) errs.push(`${w}: from and to are equal, so the arc is empty`);
          else for (const p of arcPoints(item, 24)) if (!inside(p)) { out(w, p); break; }
        }
      } else if (list === 'angles') {
        const ok = needPt(item, 'at', w) & needPt(item, 'from', w) & needPt(item, 'to', w);
        if (ok) {
          const same = (p, q) => p[0] === q[0] && p[1] === q[1];
          if (same(item.at, item.from) || same(item.at, item.to)) errs.push(`${w}: from and to must differ from the vertex at`);
          else {
            const deg = angleBetween(item.at, item.from, item.to);
            if (deg < 1e-6 || deg > 180 - 1e-6) errs.push(`${w}: the rays are in line (${r3(deg, 1)}°), so there is no angle to mark`);
            if (item.right === true && Math.abs(deg - 90) > 1e-6) errs.push(`${w}: marked as a right angle but the points make ${r3(deg, 2)}°`);
          }
        }
        if (item.label !== undefined && !isText(item.label)) errs.push(`${w}: label must be KaTeX text or 'auto'`);
        optBool(item, 'right', w, errs);
      } else if (list === 'curves') {
        if (typeof item.expr !== 'string' || !item.expr.trim()) { errs.push(`${w}: expr must be an expression in x, e.g. 'x^2-4'`); return; }
        let lo = xmin; let hi = xmax;
        if (item.domain !== undefined) {
          if (!Array.isArray(item.domain) || item.domain.length !== 2 || !item.domain.every(isNum) || !(item.domain[0] < item.domain[1])) { errs.push(`${w}: domain must be [a, b] with a < b`); return; }
          [lo, hi] = item.domain;
          if (hi < xmin || lo > xmax) errs.push(`${w}: domain [${lo}, ${hi}] lies outside the frame`);
        }
        const f = compile(item.expr);
        let seen = 0;
        for (let k = 0; k <= 60; k++) { const y = f(lo + ((hi - lo) * k) / 60); if (isNum(y) && y >= ymin && y <= ymax) seen++; }
        if (!seen) errs.push(`${w}: y = ${item.expr} has no point inside the frame (check the expression uses only x, and the y range)`);
      } else if (list === 'param') {
        if (typeof item.x !== 'string' || typeof item.y !== 'string') { errs.push(`${w}: x and y must be expressions in t, e.g. '3*cos(t)'`); return; }
        if (!Array.isArray(item.t) || item.t.length !== 2 || !item.t.every(isNum) || !(item.t[0] < item.t[1])) { errs.push(`${w}: t must be [a, b] with a < b`); return; }
        const [fx, fy] = paramFns(item);
        let seen = 0;
        for (let k = 0; k <= 60; k++) { const t = item.t[0] + ((item.t[1] - item.t[0]) * k) / 60; const p = [fx(t), fy(t)]; if (p.every(isNum) && inside(p)) seen++; }
        if (!seen) errs.push(`${w}: the curve has no point inside the frame (check the expressions use only t)`);
      }
    });
  }
  return errs;
}

function arcPoints({ cx, cy, r, from, to }, n = 60) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = toRad(from + ((to - from) * k) / n); out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return out;
}

/** The part of the infinite line through p and q inside the box (Liang–Barsky), or null. */
export function clipLine(p, q, { xmin, xmax, ymin, ymax }) {
  const dx = q[0] - p[0]; const dy = q[1] - p[1];
  let t0 = -Infinity; let t1 = Infinity;
  for (const [pk, qk] of [[-dx, p[0] - xmin], [dx, xmax - p[0]], [-dy, p[1] - ymin], [dy, ymax - p[1]]]) {
    if (pk === 0) { if (qk < 0) return null; continue; }
    const t = qk / pk;
    if (pk < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  if (t0 > t1 + 1e-12) return null;
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
}

/** Width and height of a figure whose inner plot keeps the aspect of the ranges (equal scale). */
function equalSize(xr, yr, pad, width = 480) {
  const inner = width - pad.l - pad.r;
  return { width, height: Math.round(clamp(inner * (yr / xr), 160, 480) + pad.t + pad.b) };
}

export function planeModel(params) {
  const { xmin, xmax, ymin, ymax, axes = true, equal = true } = params;
  const grid = params.grid ?? axes;
  const pad = axes ? { l: 30, r: 18, t: 18, b: 26 } : { l: 18, r: 18, t: 18, b: 18 };
  const size = equal ? equalSize(xmax - xmin, ymax - ymin, pad) : { width: 480, height: 320 };
  const frame = makeFrame({ xmin, xmax, ymin, ymax, ...size, pad, equal });
  const P = ([x, y]) => [frame.sx(x), frame.sy(y)];
  const unit = frame.sx(1) - frame.sx(0);
  const reserved = []; const items = [];
  const box = (c, w, h) => boxAt(c[0], c[1], w, h);

  // axes through the true origin (at the edge when 0 is out of range)
  let axesModel = null; const tickLabels = [];
  if (axes) {
    const ax = clamp(0, frame.ymin, frame.ymax); const ay = clamp(0, frame.xmin, frame.xmax);
    const xTicks = niceTicks(frame.xmin, frame.xmax, 8);
    const yTicks = niceTicks(frame.ymin, frame.ymax, 6);
    axesModel = {
      throughOrigin: { x: ax === 0, y: ay === 0 },
      x: [[frame.left, frame.sy(ax)], [frame.right, frame.sy(ax)]], y: [[frame.sx(ay), frame.bottom], [frame.sx(ay), frame.top]],
      xTicks: xTicks.map(v => ({ value: v, px: frame.sx(v) })), yTicks: yTicks.map(v => ({ value: v, px: frame.sy(v) }))
    };
    for (const t of axesModel.xTicks) if (t.value !== 0 && t.px > frame.left + 8 && t.px < frame.right - 14) { const c = [t.px, frame.sy(ax) + 12]; tickLabels.push({ cx: c[0], cy: c[1], w: texWidth(t.value, 12), h: 16, tex: String(t.value), cls: 'dg-small' }); }
    for (const t of axesModel.yTicks) if (t.value !== 0 && t.px > frame.top + 14 && t.px < frame.bottom - 8) { const w = texWidth(t.value, 12); const c = [frame.sx(ay) - 5 - w / 2, t.px]; tickLabels.push({ cx: c[0], cy: c[1], w, h: 16, tex: String(t.value), cls: 'dg-small' }); }
    tickLabels.forEach(t => reserved.push(boxAt(t.cx, t.cy, t.w, t.h)));
    if (params.xLabel !== '') items.push({ tex: String(params.xLabel ?? 'x'), w: 22, h: 20, candidates: [[frame.right - 10, frame.sy(ax) - 13], [frame.right - 10, frame.sy(ax) + 13]] });
    if (params.yLabel !== '') items.push({ tex: String(params.yLabel ?? 'y'), w: 22, h: 20, candidates: [[frame.sx(ay) + 14, frame.top + 8], [frame.sx(ay) - 14, frame.top + 8]] });
  }

  const points = (params.points || []).map(p => ({ x: p.x, y: p.y, label: p.label ?? null, px: P([p.x, p.y]) }));
  points.forEach(p => reserved.push(box(p.px, 9, 9)));

  const segments = (params.segments || []).map(s => {
    const a = P(s.from); const b = P(s.to);
    const length = r3(Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]), 3);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; const nrm = [-u[1], u[0]];
    const n = s.ticks || 0;
    const ticks = Array.from({ length: n }, (_, i) => { const o = (i - (n - 1) / 2) * 5; const c = [mid[0] + u[0] * o, mid[1] + u[1] * o]; return [[r3(c[0] + nrm[0] * 6, 2), r3(c[1] + nrm[1] * 6, 2)], [r3(c[0] - nrm[0] * 6, 2), r3(c[1] - nrm[1] * 6, 2)]]; });
    const tex = s.label === 'auto' ? String(r3(length, 2)) : s.label != null ? String(s.label) : null;
    if (tex) {
      const w = texWidth(tex); const h = 20; const cand = [];
      const pref = s.pos && DIRS[s.pos] ? DIRS[s.pos] : null;
      const sides = pref && (pref[0] * nrm[0] + pref[1] * nrm[1]) < 0 ? [-1, 1] : [1, -1];
      for (const along of [0, 0.22, -0.22]) for (const side of sides) for (const g of [6, 14]) {
        const d = g + Math.abs(nrm[0]) * w / 2 + Math.abs(nrm[1]) * h / 2;
        cand.push([mid[0] + u[0] * L * along + side * nrm[0] * d, mid[1] + u[1] * L * along + side * nrm[1] * d]);
      }
      items.push({ tex, w, h, candidates: cand });
    }
    return { from: s.from, to: s.to, length, label: tex, px: [a, b], dashed: !!s.dashed, arrow: !!s.arrow, ticks };
  });

  const lines = (params.lines || []).map(l => {
    const [p, q] = l.through;
    const seg = clipLine(p, q, frame);
    const vertical = Math.abs(q[0] - p[0]) < 1e-12;
    const gradient = vertical ? null : r3((q[1] - p[1]) / (q[0] - p[0]), 4);
    const intercept = vertical ? null : r3(p[1] - ((q[1] - p[1]) / (q[0] - p[0])) * p[0], 4);
    const px = seg.map(P);
    if (l.label != null) {
      const tex = String(l.label); const w = texWidth(tex); const h = 20;
      const L = Math.hypot(px[1][0] - px[0][0], px[1][1] - px[0][1]) || 1; const u = [(px[1][0] - px[0][0]) / L, (px[1][1] - px[0][1]) / L]; const nrm = [-u[1], u[0]];
      const cand = [];
      for (const end of [1, 0]) for (const side of [1, -1]) { const e = px[end]; const back = end ? -1 : 1; const d = 10 + Math.abs(nrm[0]) * w / 2 + Math.abs(nrm[1]) * h / 2; cand.push([e[0] + back * u[0] * (w / 2 + 22) + side * nrm[0] * d, e[1] + back * u[1] * (w / 2 + 22) + side * nrm[1] * d]); }
      items.push({ tex, w, h, candidates: cand });
    }
    return { through: l.through, gradient, intercept, vertical, x: vertical ? p[0] : null, label: l.label ?? null, px, dashed: !!l.dashed };
  });

  const polygons = (params.polygons || []).map(g => {
    const { area, perimeter } = polygonMeasures(g.points);
    const px = g.points.map(P);
    const centroid = [px.reduce((s, p) => s + p[0], 0) / px.length, px.reduce((s, p) => s + p[1], 0) / px.length];
    if (g.label != null) { const tex = String(g.label); const w = texWidth(tex); items.push({ tex, w, h: 20, candidates: [centroid, [centroid[0], centroid[1] - 14], [centroid[0], centroid[1] + 14], [centroid[0] - 16, centroid[1]], [centroid[0] + 16, centroid[1]]] }); }
    return { points: g.points, n: g.points.length, area: r3(area, 3), perimeter: r3(perimeter, 3), px, label: g.label ?? null, shade: g.shade !== false, dashed: !!g.dashed };
  });

  const circles = (params.circles || []).map(c => {
    const centre = P([c.cx, c.cy]);
    const rx = r3(frame.sx(c.cx + c.r) - centre[0], 2); const ry = r3(centre[1] - frame.sy(c.cy + c.r), 2);
    if (c.label != null) { const tex = String(c.label); const w = texWidth(tex); const cand = [45, 135, 315, 225, 90, 0].map(a => { const t = toRad(a); return [centre[0] + Math.cos(t) * (rx + 6 + w / 2), centre[1] - Math.sin(t) * (ry + 12)]; }); items.push({ tex, w, h: 20, candidates: cand }); }
    return { cx: c.cx, cy: c.cy, r: c.r, area: r3(Math.PI * c.r * c.r, 3), circumference: r3(2 * Math.PI * c.r, 3), centre, rx, ry, label: c.label ?? null, dashed: !!c.dashed };
  });

  const arcs = (params.arcs || []).map(a => {
    const px = arcPoints(a, 48).map(P);
    if (a.label != null) { const tex = String(a.label); const w = texWidth(tex); const m = arcPoints({ ...a, from: (a.from + a.to) / 2, to: (a.from + a.to) / 2 }, 1)[0]; const c = P(m); const ctr = P([a.cx, a.cy]); const d = Math.hypot(c[0] - ctr[0], c[1] - ctr[1]) || 1; items.push({ tex, w, h: 20, candidates: [[c[0] + (c[0] - ctr[0]) / d * (w / 2 + 6), c[1] + (c[1] - ctr[1]) / d * 14], [c[0] - (c[0] - ctr[0]) / d * (w / 2 + 6), c[1] - (c[1] - ctr[1]) / d * 14]] }); }
    return { ...a, length: r3(Math.abs(toRad(a.to - a.from)) * a.r, 3), px, label: a.label ?? null };
  });

  const angles = (params.angles || []).map(g => {
    const value = r3(angleBetween(g.at, g.from, g.to), 3);
    const right = g.right ?? Math.abs(value - 90) < 1e-6;
    const tex = g.label === 'auto' ? `${r3(value, 1)}^{\\circ}` : g.label != null ? String(g.label) : null;
    const at = P(g.at);
    const mark = angleMark(at, P(g.from), P(g.to), { right, labelW: tex ? texWidth(tex) : 30 });
    if (tex) items.push({ tex, w: texWidth(tex), h: 20, candidates: mark.candidates, cls: 'dg-small is-mark' });
    return { at: g.at, from: g.from, to: g.to, value, display: r3(value, 1), right, label: tex, arc: mark.arc, square: mark.square };
  });

  const curves = (params.curves || []).map(c => {
    const f = compile(c.expr);
    const lo = Math.max(frame.xmin, c.domain ? c.domain[0] : frame.xmin); const hi = Math.min(frame.xmax, c.domain ? c.domain[1] : frame.xmax);
    const segs = sampleSegments(f, lo, hi, { ymin: frame.ymin, ymax: frame.ymax }).map(s => s.map(P));
    if (c.label != null && segs.length) {
      const tex = String(c.label); const w = texWidth(tex); const seg = segs.at(-1); const cand = [];
      for (const frac of [0.97, 0.88, 0.78, 0.66, 0.5]) { const q = seg[Math.min(seg.length - 1, Math.floor(seg.length * frac))]; for (const [sx, sy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) cand.push([q[0] + sx * (w / 2 + 8), q[1] + sy * 14]); }
      items.push({ tex, w, h: 20, candidates: cand });
    }
    return { expr: c.expr, label: c.label ?? null, domain: [r3(lo, 4), r3(hi, 4)], segments: segs };
  });

  const param = (params.param || []).map(c => {
    const [fx, fy] = paramFns(c);
    const segs = []; let cur = [];
    const n = 240;
    for (let k = 0; k <= n; k++) {
      const t = c.t[0] + ((c.t[1] - c.t[0]) * k) / n; const x = fx(t); const y = fy(t);
      if (isNum(x) && isNum(y) && x >= frame.xmin && x <= frame.xmax && y >= frame.ymin && y <= frame.ymax) cur.push(P([x, y]));
      else { if (cur.length > 1) segs.push(cur); cur = []; }
    }
    if (cur.length > 1) segs.push(cur);
    if (c.label != null && segs.length) { const tex = String(c.label); const w = texWidth(tex); const p = segs[0][Math.floor(segs[0].length / 8)]; items.push({ tex, w, h: 20, candidates: compassCandidates(p[0], p[1], w, 20, 'ne', 8) }); }
    return { x: c.x, y: c.y, t: c.t, label: c.label ?? null, segments: segs };
  });

  // point labels go last among the free labels but are placed first (a point's name matters most)
  // labels keep off the drawn strokes too: every few pixels of every line, curve and edge is a small reserved box
  const strokes = [];
  const trace = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (let k = 0; k <= n; k++) strokes.push(boxAt(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 3, 3)); };
  const tracePath = pts => pts.forEach((q, i) => i && trace(pts[i - 1], q));
  segments.forEach(sg => trace(sg.px[0], sg.px[1])); lines.forEach(l => trace(l.px[0], l.px[1]));
  polygons.forEach(g => tracePath([...g.px, g.px[0]])); curves.forEach(c => c.segments.forEach(tracePath)); param.forEach(c => c.segments.forEach(tracePath)); arcs.forEach(a => tracePath(a.px));
  circles.forEach(c => tracePath(Array.from({ length: 49 }, (_, k) => [c.centre[0] + c.rx * Math.cos((k / 48) * 2 * Math.PI), c.centre[1] - c.ry * Math.sin((k / 48) * 2 * Math.PI)])));
  // a label crossing a stroke counts for little against one covering another label, but a clear spot wins
  reserved.push(...strokes.map(b => ({ ...b, weight: 0.3 })));
  const pointItems = points.filter(p => p.label != null).map(p => { const tex = String(p.label); const w = texWidth(tex); return { tex, w, h: 20, candidates: compassCandidates(p.px[0], p.px[1], w, 20, (params.points.find(q => q.x === p.x && q.y === p.y && String(q.label) === tex) || {}).pos || 'ne'), cls: 'dg-vertex' }; });
  const labels = [...tickLabels.map(t => ({ ...t, overlap: 0, fixed: true })), ...placeLabels([...pointItems, ...items], { width: frame.width, height: frame.height, reserved })];
  return { frame: { width: frame.width, height: frame.height, left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom, xmin: r3(frame.xmin, 3), xmax: r3(frame.xmax, 3), ymin: r3(frame.ymin, 3), ymax: r3(frame.ymax, 3) }, unit: r3(unit, 3), equal, grid, axes: axesModel, points, segments, lines, polygons, circles, arcs, angles, curves, param, labels };
}

// ═════════════════════════════════════════════════════════════════════════════
// parallelLines — two parallel lines cut by a transversal
// ═════════════════════════════════════════════════════════════════════════════
// Letters by position: at the upper crossing a (above, right of the transversal), b (above,
// left), c (below, left), d (below, right); at the lower crossing e, f, g, h in the same places.
// With the transversal at θ to the lines (anticlockwise from the right-hand direction),
// a = c = e = g = θ and b = d = f = h = 180° − θ.
export const PL_LETTERS = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
export const PL_PAIRS = Object.freeze({ corresponding: ['a', 'e'], alternate: ['c', 'e'], coInterior: ['c', 'f'], vertical: ['a', 'c'] });
const PL_SPOT = { a: 0, b: 1, c: 2, d: 3, e: 0, f: 1, g: 2, h: 3 };
const PL_UPPER = l => 'abcd'.includes(l);
const PL_INTERIOR = 'cdef'; // between the parallel lines
const PL_LEFT = 'bcfg'; // left of the transversal
/** What two of the eight angles are to each other ('none' when they have no named relation). */
export function classifyPair(p, q) {
  if (p === q) return null;
  if (PL_UPPER(p) === PL_UPPER(q)) return Math.abs(PL_SPOT[p] - PL_SPOT[q]) === 2 ? 'vertical' : 'adjacent';
  if (PL_SPOT[p] === PL_SPOT[q]) return 'corresponding';
  const inP = PL_INTERIOR.includes(p); const inQ = PL_INTERIOR.includes(q);
  const sameSide = PL_LEFT.includes(p) === PL_LEFT.includes(q);
  if (inP && inQ) return sameSide ? 'coInterior' : 'alternate';
  if (!inP && !inQ) return sameSide ? 'coExterior' : 'alternateExterior';
  return 'none';
}

function validateParallel(params) {
  const errs = [];
  if (!unknownKeys(params, ['angle', 'mark', 'values', ...COMMON], 'parallelLines', errs)) return errs;
  needNum(params, 'angle', 'parallelLines', errs, { min: 20, max: 160 });
  if (params.angle === 90) errs.push('parallelLines: angle 90 makes every angle a right angle; choose an angle other than 90 so the pairs differ');
  const m = params.mark;
  if (m !== undefined) {
    if (typeof m === 'string') { if (!Object.hasOwn(PL_PAIRS, m)) errs.push(`parallelLines: mark must be a list of letters a–h or one of ${Object.keys(PL_PAIRS).join(', ')}`); }
    else if (Array.isArray(m)) {
      if (!m.length) errs.push('parallelLines: mark is an empty list');
      m.forEach(l => { if (!PL_LETTERS.includes(l)) errs.push(`parallelLines: mark has "${l}"; use letters a to h`); });
      if (new Set(m).size !== m.length) errs.push('parallelLines: mark repeats a letter');
    } else errs.push('parallelLines: mark must be a list of letters or a relationship name');
  }
  optBool(params, 'values', 'parallelLines', errs);
  for (const k of COMMON) optText(params, k, 'parallelLines', errs);
  return errs;
}

export function parallelLinesModel({ angle = 60, mark = 'corresponding', values = true } = {}) {
  const th = angle; const sup = 180 - th;
  const vals = Object.fromEntries(PL_LETTERS.map(l => [l, r3(PL_SPOT[l] % 2 === 0 ? th : sup, 3)]));
  const marked = typeof mark === 'string' ? [...PL_PAIRS[mark]] : [...(mark || [])];
  const width = 480; const height = 300;
  const frame = makeFrame({ xmin: -4.6, xmax: 4.6, ymin: -2.6, ymax: 2.6, width, height, pad: { l: 12, r: 12, t: 12, b: 12 }, equal: true });
  const P = ([x, y]) => [frame.sx(x), frame.sy(y)];
  const cot = Math.cos(toRad(th)) / Math.sin(toRad(th));
  const U = [cot, 1]; const L = [-cot, -1]; // the crossings
  const dir = [Math.cos(toRad(th)), Math.sin(toRad(th))];
  const trans = clipLine([0, 0], dir, { xmin: frame.xmin + 0.15, xmax: frame.xmax - 0.15, ymin: frame.ymin + 0.1, ymax: frame.ymax - 0.1 });
  const lineY = [1, -1];
  const parallels = lineY.map(y => [P([frame.xmin + 0.2, y]), P([frame.xmax - 0.2, y])]);
  // chevrons ("these lines are parallel") near the left end of each line
  const chevrons = lineY.map(y => { const c = P([frame.xmin + 0.9, y]); return [[c[0] - 5, c[1] - 5], [c[0] + 2, c[1]], [c[0] - 5, c[1] + 5]].map(([x, yy]) => [r3(x, 2), r3(yy, 2)]); });
  // bisector of each of the four angles at a crossing (math degrees)
  const bis = [th / 2, (th + 180) / 2, 180 + th / 2, (180 + th + 360) / 2];
  const bounds = [[0, th], [th, 180], [180, 180 + th], [180 + th, 360]];
  const items = []; const arcs = {};
  for (const l of PL_LETTERS) {
    const c = P(PL_UPPER(l) ? U : L); const s = PL_SPOT[l];
    const isMarked = marked.includes(l);
    const tex = isMarked && values ? `${l}=${r3(vals[l], 1)}^{\\circ}` : l;
    const w = texWidth(tex); const half = toRad((bounds[s][1] - bounds[s][0]) / 2);
    const base = clamp((Math.max(w, 20) / 2 + 3) / Math.max(Math.sin(half), 0.15), 20, 78);
    const cand = [];
    for (const extra of [0, 10, 20]) for (const turn of [0, -0.15, 0.15]) { const t = toRad(bis[s] + turn * (bounds[s][1] - bounds[s][0])); cand.push([c[0] + (base + extra) * Math.cos(t), c[1] - (base + extra) * Math.sin(t)]); }
    items.push({ tex, w, h: 20, candidates: cand, cls: isMarked ? 'is-mark' : 'dg-small' });
    if (isMarked) arcs[l] = pxArc(c, s % 2 ? 20 : 15, bounds[s][0] + 4, bounds[s][1] - 4); // a gap at each ray so neighbouring marks read as separate angles
  }
  const reserved = [P(U), P(L)].map(c => boxAt(c[0], c[1], 8, 8));
  const labels = placeLabels(items, { width, height, reserved });
  let relation = null;
  if (marked.length === 2) {
    const kind = classifyPair(marked[0], marked[1]);
    const v1 = vals[marked[0]]; const v2 = vals[marked[1]];
    relation = { kind, pair: marked, values: [v1, v2], equal: Math.abs(v1 - v2) < 1e-9, sum: r3(v1 + v2, 3) };
  }
  return { frame: { width, height }, angle: th, supplement: r3(sup, 3), values: vals, marked, showValues: values, relation, crossings: { upper: P(U), lower: P(L) }, parallels, chevrons, transversal: trans.map(P), arcs, labels };
}

// ═════════════════════════════════════════════════════════════════════════════
// areaModel — a rectangle split into a grid of labelled parts
// ═════════════════════════════════════════════════════════════════════════════
const numeric = v => isNum(v) || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()));
const asNum = v => (isNum(v) ? v : Number(String(v).trim()));
const isSymbol = v => typeof v === 'string' && /^[a-zA-Z]$/.test(v.trim());
/** The KaTeX for the product of two side labels, simplified the way a teacher writes it (3x, x^2, ab). */
export function productTex(r, c) {
  if (numeric(r) && numeric(c)) return String(r3(asNum(r) * asNum(c), 6));
  if (numeric(r) || numeric(c)) {
    const n = asNum(numeric(r) ? r : c); const s = String(numeric(r) ? c : r).trim();
    if (n === 0) return '0';
    const coef = n === 1 ? '' : n === -1 ? '-' : String(r3(n, 6));
    return isSymbol(s) || /^[a-zA-Z]\^\{?\d+\}?$/.test(s) ? `${coef}${s}` : `${coef === '' ? '' : coef === '-' ? '-' : `${coef}`}\\left(${s}\\right)`;
  }
  const a = String(r).trim(); const b = String(c).trim();
  if (isSymbol(a) && a === b) return `${a}^2`;
  if (isSymbol(a) && isSymbol(b)) return [a, b].sort().join('');
  return `${a}\\cdot ${b}`;
}

function validateArea(params) {
  const errs = [];
  if (!unknownKeys(params, ['rows', 'cols', 'cells', ...COMMON], 'areaModel', errs)) return errs;
  for (const side of ['rows', 'cols']) {
    const v = params[side];
    if (!Array.isArray(v) || v.length < 1 || v.length > 6) { errs.push(`areaModel: ${side} must be a list of 1 to 6 parts { size, label }`); continue; }
    v.forEach((p, i) => {
      const w = `areaModel: ${side}[${i}]`;
      if (!unknownKeys(p, ['size', 'label'], w, errs)) return;
      needNum(p, 'size', w, errs, { min: 1e-9 });
      if (p.label === undefined || !isText(p.label) || String(p.label).trim() === '') errs.push(`${w}: label is required (KaTeX or a number)`);
    });
  }
  if (params.cells !== undefined && Array.isArray(params.rows) && Array.isArray(params.cols)) {
    const c = params.cells;
    if (!Array.isArray(c) || c.length !== params.rows.length || !c.every(r => Array.isArray(r) && r.length === params.cols.length)) errs.push(`areaModel: cells must be ${params.rows.length} rows of ${params.cols.length} entries, one per part`);
    else c.forEach((r, i) => r.forEach((t, j) => { if (!isText(t)) errs.push(`areaModel: cells[${i}][${j}] must be KaTeX text or a number`); }));
  }
  for (const k of COMMON) optText(params, k, 'areaModel', errs);
  return errs;
}

export function areaModelModel({ rows, cols, cells = null } = {}) {
  const W = cols.reduce((s, c) => s + c.size, 0); const H = rows.reduce((s, r) => s + r.size, 0);
  // one width for every area model (480, like the rest of the kit), so labels are the same size in each
  const width = 480; const top = 40; const bottom = 18;
  const scale = Math.min(390 / W, 280 / H);
  const left = Math.round(64 + (390 - W * scale) / 2); const height = Math.round(top + H * scale + bottom);
  const xs = [left]; cols.forEach(c => xs.push(xs.at(-1) + c.size * scale));
  const ys = [top]; rows.forEach(r => ys.push(ys.at(-1) + r.size * scale));
  const allNumeric = [...rows, ...cols].every(p => numeric(p.label));
  const out = [];
  rows.forEach((r, i) => cols.forEach((c, j) => {
    const tex = cells ? String(cells[i][j]) : productTex(r.label, c.label);
    const w = xs[j + 1] - xs[j]; const h = ys[i + 1] - ys[i];
    out.push({ row: i, col: j, tex, value: allNumeric ? r3(asNum(r.label) * asNum(c.label), 6) : null, area: r3(r.size * c.size, 6), x: r3(xs[j], 2), y: r3(ys[i], 2), w: r3(w, 2), h: r3(h, 2), cx: r3(xs[j] + w / 2, 2), cy: r3(ys[i] + h / 2, 2), fits: texWidth(tex) <= w - 4 && h >= 18 });
  }));
  const rowLabels = rows.map((r, i) => ({ tex: String(r.label), cx: r3(left - 8 - texWidth(r.label) / 2, 2), cy: r3((ys[i] + ys[i + 1]) / 2, 2), w: texWidth(r.label) }));
  const colLabels = cols.map((c, j) => ({ tex: String(c.label), cx: r3((xs[j] + xs[j + 1]) / 2, 2), cy: r3(top - 14, 2), w: texWidth(c.label) }));
  const rowSum = allNumeric ? r3(rows.reduce((s, r) => s + asNum(r.label), 0), 6) : null;
  const colSum = allNumeric ? r3(cols.reduce((s, c) => s + asNum(c.label), 0), 6) : null;
  const total = allNumeric ? r3(out.reduce((s, c) => s + c.value, 0), 6) : null;
  return { frame: { width, height }, xs: xs.map(v => r3(v, 2)), ys: ys.map(v => r3(v, 2)), cells: out, rowLabels, colLabels, rowSum, colSum, total, numeric: allNumeric, totalArea: r3(W * H, 6) };
}

// ═════════════════════════════════════════════════════════════════════════════
// fractionBar — one bar per fraction, all the same width
// ═════════════════════════════════════════════════════════════════════════════
function validateFractionBar(params) {
  const errs = [];
  if (!unknownKeys(params, ['bars', ...COMMON], 'fractionBar', errs)) return errs;
  const b = params.bars;
  if (!Array.isArray(b) || b.length < 1 || b.length > 8) { errs.push('fractionBar: bars must be a list of 1 to 8 bars { parts, shaded, label? }'); return errs; }
  b.forEach((bar, i) => {
    const w = `fractionBar: bars[${i}]`;
    if (!unknownKeys(bar, ['parts', 'shaded', 'label'], w, errs)) return;
    const okP = needNum(bar, 'parts', w, errs, { min: 1, max: 48, int: true });
    if (needNum(bar, 'shaded', w, errs, { min: 0, int: true }) && okP && bar.shaded > bar.parts) errs.push(`${w}: shaded (${bar.shaded}) cannot be more than parts (${bar.parts})`);
    optText(bar, 'label', w, errs);
  });
  for (const k of COMMON) optText(params, k, 'fractionBar', errs);
  return errs;
}

export function fractionBarModel({ bars = [] } = {}) {
  const left = 16; const labelW = 70; const barW = 360; const barH = 34; const gap = 16; const top = 14;
  const width = left + barW + 12 + labelW; const height = top + bars.length * (barH + gap) - gap + 14;
  const out = bars.map((b, i) => {
    const g = gcd(b.shaded, b.parts) || 1; const n = b.shaded / g; const d = b.parts / g;
    const y = top + i * (barH + gap);
    const cells = Array.from({ length: b.parts }, (_, k) => ({ x: r3(left + (barW * k) / b.parts, 2), w: r3(barW / b.parts, 2), shaded: k < b.shaded }));
    const tex = b.label != null ? String(b.label) : `\\dfrac{${b.shaded}}{${b.parts}}`;
    return { parts: b.parts, shaded: b.shaded, simplest: { n, d }, value: r3(b.shaded / b.parts, 4), y: r3(y, 2), h: barH, cells, tex, labelAt: [r3(left + barW + 12, 2), r3(y + barH / 2, 2)] };
  });
  const groups = [];
  out.forEach((b, i) => { const g = groups.find(x => out[x[0]].simplest.n === b.simplest.n && out[x[0]].simplest.d === b.simplest.d); if (g) g.push(i); else groups.push([i]); });
  return { frame: { width, height }, left, barW, bars: out, equalGroups: groups.filter(g => g.length > 1) };
}

// ═════════════════════════════════════════════════════════════════════════════
// triangleExplorer — sliders change a triangle; the readout keeps the invariant
// ═════════════════════════════════════════════════════════════════════════════
// Each slider: its range and step (null = a fixed value that is not a slider).
export const TRIANGLE_SLIDERS = Object.freeze({
  A: { min: 10, max: 150, step: 1 }, B: { min: 10, max: 150, step: 1 },
  a: { min: 1, max: 12, step: 0.5 }, b: { min: 1, max: 12, step: 0.5 }, c: { min: 1, max: 12, step: null },
  C: { min: 5, max: 175, step: 1 }, angle: { min: 5, max: 85, step: 1 }, hyp: { min: 2, max: 12, step: 0.5 },
  k: { min: 0.25, max: 3, step: 0.25 }
});
// The shapes `initial` may take in each mode (the first is the default), with their default values.
// pythagoras: legs { a, b } (right angle at C), or SAS { a, b, C }: away from 90 degrees the readout
// shows the cosine rule's correction; trigRatios: { angle, hyp }, legs { a, b }, or { a, b, C } with C = 90.
export const TRIANGLE_MODES = Object.freeze({
  angleSum: [{ A: 50, B: 60 }],
  pythagoras: [{ a: 3, b: 4 }, { a: 3, b: 4, C: 90 }],
  trigRatios: [{ angle: 30, hyp: 10 }, { a: 3, b: 4 }, { a: 3, b: 4, C: 90 }],
  similar: [{ a: 3, b: 4, c: 5, k: 2 }],
  area: [{ a: 6, b: 5, C: 60 }]
});
const FIXED = { similar: ['a', 'b', 'c'], trigRatios: ['C'] }; // shown, not slid
const ANGLE_SUM_MAX = 170; // A + B <= 170 keeps C >= 10 degrees

/** The accepted keys of a mode, all shapes together. */
export const triangleKeys = mode => [...new Set(TRIANGLE_MODES[mode].flatMap(Object.keys))];
/** Which shape an `initial` takes: the one with the fewest keys holding every key given. */
export function triangleShape(mode, initial = {}) {
  const given = Object.keys(initial);
  return TRIANGLE_MODES[mode].filter(sh => given.every(k => k in sh)).sort((x, y) => Object.keys(x).length - Object.keys(y).length)[0] || null;
}
/** The keys a student can slide in this mode and shape. */
export function triangleSliders(mode, values) {
  return Object.keys(values).filter(k => !(FIXED[mode] || []).includes(k));
}

function validateTriangleExplorer(params) {
  const errs = [];
  if (!unknownKeys(params, ['mode', 'initial', ...COMMON], 'triangleExplorer', errs)) return errs;
  const mode = params.mode;
  if (!Object.hasOwn(TRIANGLE_MODES, mode)) { errs.push(`triangleExplorer: mode must be one of ${Object.keys(TRIANGLE_MODES).join(', ')}`); return errs; }
  const init = params.initial ?? {};
  const w = `triangleExplorer (${mode}) initial`;
  if (!unknownKeys(init, triangleKeys(mode), w, errs) || errs.length) return errs;
  const shape = triangleShape(mode, init);
  if (!shape) { errs.push(`${w}: give one of ${TRIANGLE_MODES[mode].map(sh => `{ ${Object.keys(sh).join(', ')} }`).join(' or ')}, not a mix`); return errs; }
  for (const k of Object.keys(shape)) { const s = TRIANGLE_SLIDERS[k]; needNum(init, k, w, errs, { min: s.min, max: s.max, step: (FIXED[mode] || []).includes(k) ? null : s.step, optional: true }); }
  if (errs.length) return errs;
  const v = triangleValues(mode, init);
  if (mode === 'angleSum' && v.A + v.B > ANGLE_SUM_MAX) errs.push(`triangleExplorer: A + B = ${v.A + v.B}° leaves C = ${180 - v.A - v.B}°; keep A + B at most ${ANGLE_SUM_MAX}° (a triangle needs C > 0)`);
  if (mode === 'similar' && (v.a + v.b <= v.c || v.a + v.c <= v.b || v.b + v.c <= v.a)) errs.push(`triangleExplorer: sides ${v.a}, ${v.b}, ${v.c} do not make a triangle (each side must be shorter than the other two together)`);
  if (mode === 'trigRatios' && 'C' in v && v.C !== 90) errs.push(`triangleExplorer: trigRatios needs a right-angled triangle, so C must be 90 (got ${v.C}); use mode 'area' for other angles`);
  for (const k of COMMON) optText(params, k, 'triangleExplorer', errs);
  return errs;
}

/** The starting values for a mode: the shape `initial` takes, defaults filled in. */
export function triangleValues(mode, initial = {}) {
  const shape = triangleShape(mode, initial) || TRIANGLE_MODES[mode][0];
  return Object.fromEntries(Object.entries(shape).map(([k, d]) => [k, isNum(initial[k]) ? initial[k] : d]));
}

/**
 * Every number the explorer shows for one state, and its drawing. Vertices are in maths
 * units; `draw` holds the pixel coordinates in one equal-scale frame.
 */
export function triangleExplorerModel({ mode = 'angleSum', values = null, initial = {}, names = { hyp: 'hyp', opp: 'opp', adj: 'adj' } } = {}) {
  const v = values || triangleValues(mode, initial);
  let shapes = []; const numbers = {}; const marks = []; const sides = []; const extra = {};
  const tri = (A, B, C) => ({ A, B, C });
  if (mode === 'angleSum') {
    const A = v.A; const B = v.B; const C = 180 - A - B; const c = 6;
    const a = (c * Math.sin(toRad(A))) / Math.sin(toRad(C)); const b = (c * Math.sin(toRad(B))) / Math.sin(toRad(C));
    const T = tri([0, 0], [c, 0], [b * Math.cos(toRad(A)), b * Math.sin(toRad(A))]);
    shapes = [T];
    Object.assign(numbers, { A: r3(A, 3), B: r3(B, 3), C: r3(C, 3), sum: r3(A + B + C, 6), a: r3(a, 3), b: r3(b, 3), c });
    // the angles measured from the drawn vertices, so the picture cannot disagree with the readout
    numbers.measured = { A: r3(angleBetween(T.A, T.B, T.C), 3), B: r3(angleBetween(T.B, T.A, T.C), 3), C: r3(angleBetween(T.C, T.A, T.B), 3) };
    marks.push(['A', 'A'], ['B', 'B'], ['C', 'C']);
  } else if (mode === 'pythagoras') {
    const { a, b } = v; const Cdeg = isNum(v.C) ? v.C : 90; const t = toRad(Cdeg);
    const c = Math.sqrt(Math.max(0, a * a + b * b - 2 * a * b * Math.cos(t)));
    const T = tri([b * Math.cos(t), b * Math.sin(t)], [a, 0], [0, 0]); // C at the origin, a = CB along x, b = CA at angle C
    shapes = [T];
    const cen = [(T.A[0] + T.B[0] + T.C[0]) / 3, (T.A[1] + T.B[1] + T.C[1]) / 3];
    const sq = (p, q) => { const d = [q[0] - p[0], q[1] - p[1]]; let n = [d[1], -d[0]]; const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if ((m[0] - cen[0]) * n[0] + (m[1] - cen[1]) * n[1] < 0) n = [-n[0], -n[1]]; return [p, q, [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]]; };
    extra.squares = [sq(T.C, T.B), sq(T.A, T.C), sq(T.B, T.A)]; // each square outside the triangle
    const cross = 2 * a * b * Math.cos(t);
    Object.assign(numbers, { a: r3(a, 3), b: r3(b, 3), C: Cdeg, c: r3(c, 4), a2: r3(a * a, 4), b2: r3(b * b, 4), sumSquares: r3(a * a + b * b, 4), c2: r3(c * c, 4), correction: r3(cross, 4), residual: r3(a * a + b * b - cross - c * c, 9), right: Math.abs(Cdeg - 90) < 1e-9, exact: Number.isInteger(r3(c, 9)) });
    numbers.measuredC = r3(angleBetween(T.C, T.A, T.B), 6);
    sides.push(['B', 'C', 'a'], ['C', 'A', 'b'], ['A', 'B', 'c']);
    marks.push(['C', Math.abs(Cdeg - 90) < 1e-9 ? 'right' : 'C']);
  } else if (mode === 'trigRatios') {
    const legs = !isNum(v.angle);
    const t = legs ? Math.atan2(v.a, v.b) : toRad(v.angle); const h = legs ? Math.hypot(v.a, v.b) : v.hyp;
    const opp = h * Math.sin(t); const adj = h * Math.cos(t);
    const T = tri([0, 0], [adj, opp], [adj, 0]); // θ at A, right angle at C
    shapes = [T];
    Object.assign(numbers, { angle: r3(toDeg(t), 2), hyp: r3(h, 3), opp: r3(opp, 3), adj: r3(adj, 3), sin: r3(Math.sin(t), 4), cos: r3(Math.cos(t), 4), tan: r3(Math.tan(t), 4) });
    numbers.fromSides = { sin: r3(opp / h, 4), cos: r3(adj / h, 4), tan: r3(opp / adj, 4) };
    numbers.approx = { sin: inexact(Math.sin(t), 4), cos: inexact(Math.cos(t), 4), tan: inexact(Math.tan(t), 4) }; // '≈' rather than '=' in the readout
    sides.push(['A', 'B', 'hyp'], ['B', 'C', 'opp'], ['A', 'C', 'adj']);
    marks.push(['A', 'theta'], ['C', 'right']);
  } else if (mode === 'similar') {
    const { a, b, c, k } = v;
    const cosB = (a * a + c * c - b * b) / (2 * a * c);
    const apex = s => [s * c * cosB, s * c * Math.sqrt(Math.max(0, 1 - cosB * cosB))];
    const T1 = tri(apex(1), [0, 0], [a, 0]);
    const off = Math.max(a, apex(1)[0]) - Math.min(0, apex(1)[0]) + 1.2 - Math.min(0, apex(k)[0]);
    const T2 = tri([apex(k)[0] + off, apex(k)[1]], [off, 0], [k * a + off, 0]);
    shapes = [T1, T2];
    const s = (a + b + c) / 2; const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    Object.assign(numbers, { k, a: r3(a, 3), b: r3(b, 3), c: r3(c, 3), a2: r3(k * a, 3), b2: r3(k * b, 3), c2: r3(k * c, 3), area1: r3(area, 3), area2: r3(area * k * k, 3), k2: r3(k * k, 4), areaRatio: r3((area * k * k) / area, 4), perimeterRatio: r3((k * (a + b + c)) / (a + b + c), 4) });
    numbers.anglesEqual = ['A', 'B', 'C'].every(n => { const o = { A: ['B', 'C'], B: ['A', 'C'], C: ['A', 'B'] }[n]; return Math.abs(angleBetween(T1[n], T1[o[0]], T1[o[1]]) - angleBetween(T2[n], T2[o[0]], T2[o[1]])) < 1e-6; });
    sides.push(['B', 'C', 'a'], ['C', 'A', 'b'], ['A', 'B', 'c']);
  } else if (mode === 'area') {
    const { a, b, C } = v; const t = toRad(C);
    const T = tri([b * Math.cos(t), b * Math.sin(t)], [a, 0], [0, 0]); // C at the origin, CB along x, CA at angle C
    shapes = [T];
    const h = b * Math.sin(t);
    extra.foot = [b * Math.cos(t), 0];
    Object.assign(numbers, { a: r3(a, 3), b: r3(b, 3), C, area: r3(0.5 * a * b * Math.sin(t), 3), h: r3(h, 3), sin: r3(Math.sin(t), 4), baseHeight: r3(0.5 * a * h, 3) });
    numbers.approx = { area: inexact(0.5 * a * b * Math.sin(t), 3), h: inexact(h, 3) };
    sides.push(['B', 'C', 'a'], ['C', 'A', 'b']);
    marks.push(['C', 'C']);
  }
  // the drawing: one equal-scale frame round every vertex (and the squares)
  const all = [...shapes.flatMap(T => [T.A, T.B, T.C]), ...(extra.squares || []).flat(), ...(extra.foot ? [extra.foot] : [])];
  const xs = all.map(p => p[0]); const ys = all.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const m = span * 0.12;
  const width = 420; const xr = Math.max(...xs) - Math.min(...xs) + 2 * m; const yr = Math.max(...ys) - Math.min(...ys) + 2 * m;
  const pad = { l: 26, r: 26, t: 26, b: 26 };
  const height = Math.round(clamp((width - pad.l - pad.r) * (yr / xr), 180, 360) + pad.t + pad.b);
  const frame = makeFrame({ xmin: Math.min(...xs) - m, xmax: Math.max(...xs) + m, ymin: Math.min(...ys) - m, ymax: Math.max(...ys) + m, width, height, pad, equal: true });
  const P = p => [frame.sx(p[0]), frame.sy(p[1])];
  const drawn = shapes.map(T => ({ A: P(T.A), B: P(T.B), C: P(T.C) }));
  const items = []; const reserved = [];
  const fmt = n => String(r3(n, 2));
  drawn.forEach((D, i) => {
    const g = [(D.A[0] + D.B[0] + D.C[0]) / 3, (D.A[1] + D.B[1] + D.C[1]) / 3];
    for (const k of ['A', 'B', 'C']) {
      const p = D[k]; const dx = p[0] - g[0]; const dy = p[1] - g[1]; const n = Math.hypot(dx, dy) || 1;
      const name = i ? `${k}'` : k;
      items.push({ tex: name, w: 24, h: 20, cls: 'dg-vertex', candidates: [[p[0] + (dx / n) * 16, p[1] + (dy / n) * 16], [p[0] + (dx / n) * 24, p[1] + (dy / n) * 24], ...compassCandidates(p[0], p[1], 24, 20, dy < 0 ? 'n' : 's', 4)] });
      reserved.push(boxAt(p[0], p[1], 6, 6));
    }
    for (const [p, q, key] of sides) {
      const mid = [(D[p][0] + D[q][0]) / 2, (D[p][1] + D[q][1]) / 2]; const dx = mid[0] - g[0]; const dy = mid[1] - g[1]; const n = Math.hypot(dx, dy) || 1;
      const val = mode === 'similar' && i === 1 ? numbers[`${key}2`] : numbers[key];
      const tex = mode === 'trigRatios' ? `\\text{${names[key]}}=${fmt(val)}` : `${i ? `${key}'` : key}=${fmt(val)}`;
      const w = texWidth(tex);
      items.push({ tex, w, h: 20, cls: 'dg-small', candidates: [[mid[0] + (dx / n) * (10 + w / 2 * Math.abs(dx / n) + 10 * Math.abs(dy / n)), mid[1] + (dy / n) * (12 + 10 * Math.abs(dy / n))], [mid[0] + (dx / n) * (w / 2 + 16), mid[1] + (dy / n) * 22], [mid[0] - (dx / n) * (w / 2 + 6), mid[1] - (dy / n) * 14]] });
    }
  });
  const angleMarks = []; const D = drawn[0];
  const other = { A: ['B', 'C'], B: ['A', 'C'], C: ['A', 'B'] };
  for (const [k, kind] of marks) {
    const right = kind === 'right';
    const tex = right ? null : kind === 'theta' ? `\\theta=${r3(numbers.angle, 1)}^{\\circ}` : `${k}=${r3(numbers[k], 1)}^{\\circ}`;
    const mk = angleMark(D[k], D[other[k][0]], D[other[k][1]], { right, labelW: tex ? texWidth(tex) : 30, radius: 18 });
    angleMarks.push({ at: k, right, arc: mk.arc, square: mk.square });
    if (tex) items.push({ tex, w: texWidth(tex), h: 20, cls: 'dg-small is-mark', candidates: mk.candidates });
  }
  const labels = placeLabels(items, { width: frame.width, height: frame.height, reserved });
  const draw = { frame: { width: frame.width, height: frame.height }, triangles: drawn, squares: (extra.squares || []).map(s => s.map(P)), foot: extra.foot ? P(extra.foot) : null, angleMarks, labels };
  return { mode, values: { ...v }, numbers, vertices: shapes, draw };
}

// ═════════════════════════════════════════════════════════════════════════════
// circleExplorer — a point moved round a circle; the readout keeps the theorem
// ═════════════════════════════════════════════════════════════════════════════
// Initial positions are angles in degrees anticlockwise from the +x axis and use the SAME
// names as the static circleTheorem's params, so a question's counterpart draws the same picture.
export const CIRCLE_THEOREMS = Object.freeze({
  centre: { moving: 'r', keys: ['a', 'b', 'r'], initial: { a: 20, b: 140, r: 250 }, point: 'R' },
  segment: { moving: 'r2', keys: ['a', 'b', 'r1', 'r2'], initial: { a: 30, b: 150, r1: 240, r2: 300 }, point: 'S' },
  semicircle: { moving: 'r', keys: ['r'], initial: { r: 70 }, point: 'R' },
  cyclic: { moving: 'd', keys: ['a', 'b', 'c', 'd'], initial: { a: 20, b: 100, c: 200, d: 290 }, point: 'D' },
  tangent: { moving: 'a', keys: ['a'], initial: { a: 40 }, point: 'T' },
  chords: { moving: 'c', keys: ['a', 'b', 'c', 'd'], initial: { a: 200, b: 340, c: 270, d: 60 }, point: 'C' }
});
const GAP = 10; // the moving point keeps at least 10° from any fixed point
const rel = (x, a) => mod360(x - a);

/** The slider range for the moving point, in unwrapped degrees (lo ≤ value ≤ hi), and the value now. */
export function circleRange(theorem, values) {
  const v = values;
  switch (theorem) {
    case 'centre': case 'segment': { const b = v.a + rel(v.b, v.a); return { lo: b + GAP, hi: v.a + 360 - GAP, base: v.a }; }
    case 'semicircle': return { lo: GAP, hi: 180 - GAP, base: 0 };
    case 'cyclic': { const c = v.a + rel(v.c, v.a); return { lo: c + GAP, hi: v.a + 360 - GAP, base: v.a }; }
    case 'tangent': return { lo: 0, hi: 359, base: 0 };
    case 'chords': { const b = v.a + rel(v.b, v.a); return { lo: v.a + GAP, hi: b - GAP, base: v.a }; }
    default: throw new TypeError(`unknown circle theorem ${theorem}`);
  }
}
/** A raw angle (any turn) as an unwrapped value in the moving point's range, clamped to the nearer end. */
export function snapToRange(theorem, values, deg) {
  const { lo, hi, base } = circleRange(theorem, values);
  if (theorem === 'tangent') return Math.round(mod360(deg)) % 360;
  let x = base + rel(deg, base);
  if (x < lo - 1e-9 && x + 360 <= hi) x += 360;
  if (x >= lo && x <= hi) return Math.round(x);
  const dist = y => Math.min(rel(y, x), rel(x, y));
  return dist(lo) <= dist(hi) ? lo : hi;
}

function validateCircleExplorer(params) {
  const errs = [];
  if (!unknownKeys(params, ['theorem', 'initial', 'radius', ...COMMON], 'circleExplorer', errs)) return errs;
  const th = params.theorem;
  if (!Object.hasOwn(CIRCLE_THEOREMS, th)) { errs.push(`circleExplorer: theorem must be one of ${Object.keys(CIRCLE_THEOREMS).join(', ')}`); return errs; }
  needNum(params, 'radius', 'circleExplorer', errs, { min: 0.1, max: 100, optional: true });
  const T = CIRCLE_THEOREMS[th]; const init = params.initial ?? {};
  const w = `circleExplorer (${th}) initial`;
  if (!unknownKeys(init, T.keys, w, errs)) return errs;
  for (const k of T.keys) needNum(init, k, w, errs, { min: -360, max: 720, optional: true });
  if (errs.length) return errs;
  const v = { ...T.initial, ...init };
  const r = k => rel(v[k], v.a);
  if (th === 'centre' || th === 'segment') {
    if (r('b') < 20 || r('b') > 160) errs.push(`${w}: the arc from a = ${v.a}° to b = ${v.b}° must be a minor arc of 20° to 160° (it is ${r3(r('b'), 2)}°)`);
    const movers = th === 'centre' ? ['r'] : ['r1', 'r2'];
    for (const k of movers) if (r(k) < r('b') + GAP || r(k) > 360 - GAP) errs.push(`${w}: ${k} = ${v[k]}° must lie on the major arc, at least ${GAP}° from A and B (between ${mod360(v.a + r('b') + GAP)}° and ${mod360(v.a - GAP)}°)`);
  } else if (th === 'semicircle') {
    if (v.r < GAP || v.r > 180 - GAP) errs.push(`${w}: r = ${v.r}° must be between ${GAP}° and ${180 - GAP}° (on the upper semicircle, away from A and B)`);
  } else if (th === 'cyclic') {
    if (!(r('b') >= GAP && r('c') >= r('b') + GAP && r('d') >= r('c') + GAP && r('d') <= 360 - GAP)) errs.push(`${w}: a, b, c, d must go round the circle in order, at least ${GAP}° apart`);
  } else if (th === 'chords') {
    if (!(r('c') >= GAP && r('b') >= r('c') + GAP && r('d') >= r('b') + GAP && r('d') <= 360 - GAP)) errs.push(`${w}: going round from A the order must be A, C, B, D, at least ${GAP}° apart, so that chords AB and CD cross`);
  }
  for (const k of COMMON) optText(params, k, 'circleExplorer', errs);
  return errs;
}

export function circleExplorerModel({ theorem = 'centre', values = null, initial = {}, radius = 5 } = {}) {
  const T = CIRCLE_THEOREMS[theorem];
  const v = values || { ...T.initial, ...initial };
  const numbers = {};
  let m;
  if (theorem === 'chords') {
    const frame = makeFrame({ xmin: -1.35, xmax: 1.35, ymin: -1.35, ymax: 1.35, width: 380, height: 380, pad: { l: 16, r: 16, t: 16, b: 16 }, equal: true });
    const at = d => [Math.cos(toRad(d)), Math.sin(toRad(d))];
    const [A, B, C, D] = [v.a, v.b, v.c, v.d].map(at);
    // P = AB ∩ CD
    const den = (A[0] - B[0]) * (C[1] - D[1]) - (A[1] - B[1]) * (C[0] - D[0]);
    const t = ((A[0] - C[0]) * (C[1] - D[1]) - (A[1] - C[1]) * (C[0] - D[0])) / den;
    const Pp = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])];
    const P = u => [frame.sx(u[0]), frame.sy(u[1])];
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) * radius;
    const ap = d(A, Pp); const pb = d(Pp, B); const cp = d(C, Pp); const pd = d(Pp, D);
    m = { frame, centre: P([0, 0]), radius: r3(frame.sx(1) - frame.sx(0)), points: { A: P(A), B: P(B), C: P(C), D: P(D), P: P(Pp) }, lines: [['A', 'B'], ['C', 'D']], marks: [] };
    Object.assign(numbers, { radius, ap: r3(ap, 3), pb: r3(pb, 3), cp: r3(cp, 3), pd: r3(pd, 3), product1: r3(ap * pb, 3), product2: r3(cp * pd, 3), residual: r3(ap * pb - cp * pd, 9) });
  } else {
    m = circleTheoremModel({ theorem, params: v });
    const mk = m.marks.map(k => k.value);
    if (theorem === 'centre') Object.assign(numbers, { centre: r3(mk[0], 3), circumference: r3(mk[1], 3), ratio: r3(mk[0] / mk[1], 6) });
    if (theorem === 'segment') Object.assign(numbers, { atR: r3(mk[0], 3), atS: r3(mk[1], 3), difference: r3(mk[0] - mk[1], 6) });
    if (theorem === 'semicircle') Object.assign(numbers, { atR: r3(mk[0], 3) });
    if (theorem === 'cyclic') Object.assign(numbers, { A: r3(mk[0], 3), B: r3(mk[1], 3), C: r3(mk[2], 3), D: r3(mk[3], 3), sumAC: r3(mk[0] + mk[2], 3), sumBD: r3(mk[1] + mk[3], 3) });
    if (theorem === 'tangent') Object.assign(numbers, { atT: r3(mk[0], 3) });
  }
  // labels: point names outward from the centre, angle values inside their angle
  const items = []; const reserved = [];
  for (const [k, p] of Object.entries(m.points)) {
    const ring = k === T.point; // the moving point carries a 22 px handle ring; its name sits clear of it
    reserved.push(boxAt(p[0], p[1], ring ? 26 : 8, ring ? 26 : 8));
    if (/^E/.test(k)) continue;
    const dx = p[0] - m.centre[0]; const dy = p[1] - m.centre[1]; const n = Math.hypot(dx, dy);
    const d0 = ring ? 26 : 16;
    const cands = n < 1 ? compassCandidates(p[0], p[1], 22, 20, 'sw', 4) : [[p[0] + (dx / n) * d0, p[1] + (dy / n) * d0], [p[0] + (dx / n) * (d0 + 8), p[1] + (dy / n) * (d0 + 8)], ...compassCandidates(p[0], p[1], 22, 20, 'ne', ring ? 14 : 6)];
    if (theorem === 'chords' && k === 'P') cands.unshift(...compassCandidates(p[0], p[1], 22, 20, 'e', 6));
    items.push({ tex: k, w: 22, h: 20, cls: 'dg-vertex', candidates: cands });
  }
  for (const [p, q] of m.lines) { const a = m.points[p]; const b = m.points[q]; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6); for (let k = 1; k < n; k++) reserved.push({ ...boxAt(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 3, 3), weight: 0.3 }); }
  const angleMarks = [];
  for (const k of m.marks) {
    const at = m.points[k.at];
    const q = typeof k.between[1] === 'string' ? m.points[k.between[1]] : null;
    const right = Math.abs(k.value - 90) < 1e-6;
    const tex = `${r3(k.value, 1)}^{\\circ}`;
    const mk = angleMark(at, m.points[k.between[0]], q || m.points.E2, { right, labelW: texWidth(tex), radius: 16 });
    angleMarks.push({ at: k.at, value: r3(k.value, 3), right, arc: mk.arc, square: mk.square });
    items.push({ tex, w: texWidth(tex), h: 20, cls: 'dg-small is-mark', candidates: mk.candidates });
  }
  const labels = placeLabels(items, { width: m.frame.width, height: m.frame.height, reserved });
  const range = circleRange(theorem, v);
  const movingPx = m.points[T.point];
  return { theorem, values: { ...v }, moving: T.moving, point: T.point, range, numbers, draw: { frame: { width: m.frame.width, height: m.frame.height }, centre: m.centre, radius: m.radius, points: m.points, lines: m.lines, angleMarks, labels, handle: movingPx } };
}

// ── Static counterparts' params ──────────────────────────────────────────────
/**
 * The params a question (or a print) passes to the static counterpart of an interactive
 * kind, so it draws the explorer's starting picture: triangle wants { a, b, c } or
 * { a, b, C }; circleTheorem wants { theorem, params }. (DiagramFromSpec passes an
 * interactive spec's params straight through; this is the mapping it can apply.)
 */
export function counterpartParams(kind, params = {}) {
  if (kind === 'triangleExplorer') {
    const m = triangleExplorerModel({ mode: params.mode, initial: params.initial || {} }); const n = m.numbers;
    const base = { title: params.title, caption: params.caption };
    if (params.mode === 'angleSum') return { ...base, a: n.a, b: n.b, c: n.c };
    if (params.mode === 'pythagoras') return { ...base, a: n.a, b: n.b, C: n.C };
    if (params.mode === 'trigRatios') return { ...base, a: n.opp, b: n.adj, C: 90 };
    if (params.mode === 'similar') return { ...base, a: n.a, b: n.b, c: n.c };
    return { ...base, a: n.a, b: n.b, C: n.C, showArea: true };
  }
  if (kind === 'circleExplorer') {
    if (params.theorem === 'chords') return null; // circleTheorem has no intersecting-chords figure
    return { theorem: params.theorem, params: { ...CIRCLE_THEOREMS[params.theorem].initial, ...(params.initial || {}) }, title: params.title, caption: params.caption };
  }
  return params;
}

// ── The pack's registry ──────────────────────────────────────────────────────
const safe = (validate, model) => ({ validate: p => { try { return validate(p ?? {}); } catch (e) { return [`invalid spec: ${e.message}`]; } }, model });

export const STATIC = Object.freeze({
  plane: safe(validatePlane, planeModel),
  parallelLines: safe(validateParallel, parallelLinesModel),
  areaModel: safe(validateArea, areaModelModel),
  fractionBar: safe(validateFractionBar, fractionBarModel)
});
export const PARALLEL_SLIDER = Object.freeze({ min: 20, max: 160, step: 5 });
function validateParallelExplorer(params) {
  const errs = validateParallel(params).map(e => e.replace(/^parallelLines/, 'parallelLinesExplorer'));
  if (isNum(params.angle) && params.angle >= 20 && params.angle <= 160 && Math.abs(params.angle / 5 - Math.round(params.angle / 5)) > 1e-9) errs.push(`parallelLinesExplorer: angle = ${params.angle} must be a multiple of 5 (the slider's step)`);
  return errs;
}

export const INTERACTIVE = Object.freeze({
  parallelLinesExplorer: safe(validateParallelExplorer, parallelLinesModel),
  triangleExplorer: safe(validateTriangleExplorer, p => triangleExplorerModel({ mode: p.mode, initial: p.initial || {} })),
  circleExplorer: safe(validateCircleExplorer, p => circleExplorerModel({ theorem: p.theorem, initial: p.initial || {}, radius: p.radius ?? 5 }))
});
// interactive kind -> static kind a question (or a print) shows instead
// (a function maps the explorer's params to the static spec of its starting picture; see counterpartParams)
export const COUNTERPART = Object.freeze({
  parallelLinesExplorer: 'parallelLines',
  triangleExplorer: p => ({ kind: 'triangle', ...counterpartParams('triangleExplorer', p) }),
  circleExplorer: p => { const c = counterpartParams('circleExplorer', p); return c ? { kind: 'circleTheorem', ...c } : null; }
});

// ── Words ────────────────────────────────────────────────────────────────────
// The pack's words in English (en-AU) and Hindi; plane.jsx reads them through useKitText.
// Mathematics stays KaTeX ($…$) in both; {slots} are filled with numbers the models computed.
export const PLANE_TEXT = Object.freeze({
  en: {
    planeTitle: 'A figure on the coordinate plane',
    planeAxes: 'Axes: x from {xmin} to {xmax}, y from {ymin} to {ymax}.',
    planeNoAxes: 'The figure spans x from {xmin} to {xmax} and y from {ymin} to {ymax}.',
    planePoint: 'Point {name} at ({x}, {y}).',
    planePointBare: 'A point at ({x}, {y}).',
    planeSegment: 'Segment from ({x1}, {y1}) to ({x2}, {y2}), length {len}.',
    planeTicks: 'Segments with the same number of small marks are equal in length.',
    planeLine: 'A line through ({x1}, {y1}) and ({x2}, {y2}) with gradient {m} and y-intercept {c}.',
    planeLineVertical: 'A vertical line, x = {x}.',
    planePolygon: 'A polygon with {n} vertices {list}: area {area}, perimeter {perimeter}.',
    planeCircle: 'A circle with centre ({cx}, {cy}) and radius {r}.',
    planeArc: 'An arc of radius {r} about ({cx}, {cy}) from {from}° to {to}°, length {len}.',
    planeAngle: 'The angle at ({x}, {y}) is {deg}°.',
    planeRight: 'A right angle at ({x}, {y}).',
    planeCurve: 'The curve y = {expr}.',
    planeParam: 'The curve x = {x}, y = {y} for t from {t0} to {t1}.',

    plTitle: 'Two parallel lines cut by a transversal',
    plDesc: 'The transversal makes {deg}° with the parallel lines. Angles a, c, e and g are {deg}°; angles b, d, f and h are {sup}°.',
    plMarked: 'Marked angles: {list}.',
    plRel_corresponding: 'Corresponding angles {p} and {q} are equal: both are {v1}°.',
    plRel_alternate: 'Alternate angles {p} and {q} are equal: both are {v1}°.',
    plRel_alternateExterior: 'Alternate exterior angles {p} and {q} are equal: both are {v1}°.',
    plRel_vertical: 'Vertically opposite angles {p} and {q} are equal: both are {v1}°.',
    plRel_coInterior: 'Co-interior angles {p} and {q} add to 180°: {v1}° + {v2}° = {sum}°.',
    plRel_coExterior: 'Angles {p} and {q} add to 180°: {v1}° + {v2}° = {sum}°.',
    plRel_adjacent: 'Angles {p} and {q} make a straight angle: {v1}° + {v2}° = {sum}°.',
    plRel_none: 'Angles {p} and {q} are {v1}° and {v2}°.',

    amTitle: 'An area model',
    amDesc: 'A rectangle with sides {rows} and {cols}, split into {n} parts: {cells}.',
    amTotal: 'The parts add to {total}, which is {rowSum} × {colSum}.',

    fbTitle: 'Fraction bars of equal length',
    fbBar: 'Bar {i}: {shaded} of {parts} equal parts shaded, which is {n}/{d} or {value}.',
    fbEqual: 'Bars {list} have the same amount shaded.',

    reset: 'Reset',
    ple_title: 'Turn the transversal',
    ple_slider: 'Angle of the transversal (degrees)',
    ple_read_equal: 'Transversal at ${deg}^\\circ$: the {name} ${p}$ and ${q}$ are both ${v1}^\\circ$, and they stay equal as it turns.',
    ple_read_sum: 'Transversal at ${deg}^\\circ$: the {name} ${p}$ and ${q}$ are ${v1}^\\circ$ and ${v2}^\\circ$, and they always add to ${sum}^\\circ$.',
    ple_read_plain: 'Transversal at ${deg}^\\circ$: angles $a$, $c$, $e$ and $g$ are ${deg}^\\circ$; angles $b$, $d$, $f$ and $h$ are ${sup}^\\circ$.',
    ple_name_corresponding: 'corresponding angles', ple_name_alternate: 'alternate angles', ple_name_alternateExterior: 'alternate exterior angles',
    ple_name_vertical: 'vertically opposite angles', ple_name_coInterior: 'co-interior angles', ple_name_coExterior: 'exterior angles on the same side',
    ple_name_adjacent: 'angles on a straight line', ple_name_none: 'angles',
    te_read_cosine: '$a^2+b^2={a2}+{b2}={s}$, but $c^2={c2}$: with $C={C}^\\circ$, $c^2=a^2+b^2-2ab\\cos C={s}{op}{corrAbs}$. Only when $C=90^\\circ$ is $c^2=a^2+b^2$.',
    te_desc_cosine: 'A triangle with sides a = {a} and b = {b} and the angle C = {C}° between them, with a square on each side: c = {c}; the squares on a and b add to {s}, and the square on c is {c2}.',
    te_title_angleSum: 'Change two angles of a triangle',
    te_title_pythagoras: 'Change the two shorter sides of a right-angled triangle',
    te_title_trigRatios: 'Change the angle and the size of a right-angled triangle',
    te_title_similar: 'Scale a triangle by a factor k',
    te_title_area: 'Change two sides and the angle between them',
    te_A: 'Angle A (degrees)', te_B: 'Angle B (degrees)', te_C: 'Angle C (degrees)', te_a: 'Side a', te_b: 'Side b',
    te_angle: 'Angle θ (degrees)', te_hyp: 'Hypotenuse', te_k: 'Scale factor k',
    hyp: 'hyp', opp: 'opp', adj: 'adj',
    te_read_angleSum: '$A={A}^\\circ$ and $B={B}^\\circ$, so $C=180^\\circ-{A}^\\circ-{B}^\\circ={C}^\\circ$. However the triangle changes, $A+B+C={sum}^\\circ$.',
    te_desc_angleSum: 'A triangle with angles A = {A}°, B = {B}° and C = {C}°, adding to {sum}°.',
    te_read_pythagoras: '$a^2+b^2={a}^2+{b}^2={a2}+{b2}={c2}$, and the hypotenuse is $c={cTex}$, so $c^2={c2}$. The square on the hypotenuse has the same area as the other two squares together.',
    te_desc_pythagoras: 'A right-angled triangle with shorter sides a = {a} and b = {b} and hypotenuse c = {c}, with a square on each side: the areas {a2} and {b2} add to {c2}, the area of the square on c.',
    te_read_trigRatios: '$\\theta={angle}^\\circ$, hypotenuse ${hyp}$, opposite ${opp}$, adjacent ${adj}$: $\\sin\\theta=\\tfrac{{opp}}{{hyp}}{eqS}{sin}$, $\\cos\\theta=\\tfrac{{adj}}{{hyp}}{eqC}{cos}$, $\\tan\\theta=\\tfrac{{opp}}{{adj}}{eqT}{tan}$. A larger triangle with the same angle has the same ratios.',
    te_desc_trigRatios: 'A right-angled triangle with angle θ = {angle}° at A: hypotenuse {hyp}, opposite side {opp}, adjacent side {adj}; sin θ = {sin}, cos θ = {cos}, tan θ = {tan}.',
    te_read_similar: 'Scale factor $k={k}$: sides ${a}$, ${b}$, ${c}$ become ${a2}$, ${b2}$, ${c2}$, and the angles stay the same. Area ${area1}$ becomes ${area2}$: the areas are in the ratio $k^2={k2}$.',
    te_desc_similar: "Triangle ABC with sides {a}, {b}, {c} and area {area1}, and its image A'B'C' scaled by k = {k}: sides {a2}, {b2}, {c2}, area {area2}, area ratio {k2}.",
    te_read_area: 'Area $=\\tfrac12 ab\\sin C=\\tfrac12\\times{a}\\times{b}\\times\\sin{C}^\\circ{eq}{area}$. The height from $A$ to $BC$ is $b\\sin C{eqh}{h}$, and half the base times the height gives the same area.',
    te_desc_area: 'A triangle with sides a = {a} and b = {b} and the angle C = {C}° between them: height {h}, area {area}.',

    ce_title_centre: 'Angle at the centre and angle at the circumference',
    ce_title_segment: 'Angles in the same segment',
    ce_title_semicircle: 'The angle in a semicircle',
    ce_title_cyclic: 'Opposite angles of a cyclic quadrilateral',
    ce_title_tangent: 'A tangent and the radius',
    ce_title_chords: 'Two chords that cross',
    ce_slider: 'Position of {name} (degrees round the circle)',
    ce_handle: 'Point {name} on the circle',
    ce_valuetext: '{name} at {deg} degrees',
    ce_read_centre: '$\\angle AOB={centre}^\\circ$ and $\\angle ARB={circ}^\\circ$: wherever $R$ is on the major arc, the angle at the centre is twice the angle at the circumference.',
    ce_read_segment: '$\\angle ARB={r}^\\circ$ and $\\angle ASB={s}^\\circ$: angles in the same segment are equal.',
    ce_read_semicircle: '$\\angle ARB={r}^\\circ$: wherever $R$ is, the angle in a semicircle is a right angle.',
    ce_read_cyclic: '$\\angle A+\\angle C={A}^\\circ+{C}^\\circ={sAC}^\\circ$ and $\\angle B+\\angle D={B}^\\circ+{D}^\\circ={sBD}^\\circ$: opposite angles of a cyclic quadrilateral add to $180^\\circ$.',
    ce_read_tangent: 'The radius $OT$ meets the tangent at $T$ at ${t}^\\circ$: a tangent is perpendicular to the radius at the point of contact.',
    ce_read_chords: 'In a circle of radius ${radius}$: $AP\\times PB={ap}\\times{pb}\\approx{p1}$ and $CP\\times PD={cp}\\times{pd}\\approx{p2}$. However the chords cross, the two products are equal.',
    ce_desc_centre: 'A circle with centre O, points A and B, and R on the major arc: angle AOB = {centre}°, angle ARB = {circ}°.',
    ce_desc_segment: 'A circle with chord AB and points R and S in the same segment: angle ARB = {r}°, angle ASB = {s}°.',
    ce_desc_semicircle: 'A circle with diameter AB and R on the circle: angle ARB = {r}°.',
    ce_desc_cyclic: 'A cyclic quadrilateral ABCD: angles A = {A}°, B = {B}°, C = {C}°, D = {D}°; A + C = {sAC}°, B + D = {sBD}°.',
    ce_desc_tangent: 'A circle with centre O and the tangent at T: the radius OT meets the tangent at {t}°.',
    ce_desc_chords: 'Chords AB and CD of a circle of radius {radius} cross at P: AP = {ap}, PB = {pb}, CP = {cp}, PD = {pd}; AP × PB = {p1} and CP × PD = {p2}.'
  },
  hi: {
    planeTitle: 'निर्देशांक तल पर एक आकृति',
    planeAxes: 'अक्ष: x का मान {xmin} से {xmax} तक और y का मान {ymin} से {ymax} तक।',
    planeNoAxes: 'आकृति x = {xmin} से {xmax} तक और y = {ymin} से {ymax} तक फैली है।',
    planePoint: 'बिंदु {name}, ({x}, {y}) पर।',
    planePointBare: '({x}, {y}) पर एक बिंदु।',
    planeSegment: '({x1}, {y1}) से ({x2}, {y2}) तक रेखाखंड, लंबाई {len}।',
    planeTicks: 'जिन रेखाखंडों पर छोटे निशानों की संख्या समान है, उनकी लंबाई बराबर है।',
    planeLine: '({x1}, {y1}) और ({x2}, {y2}) से होकर जाने वाली रेखा, जिसकी प्रवणता {m} और y-अंतःखंड {c} है।',
    planeLineVertical: 'एक ऊर्ध्वाधर रेखा, x = {x}।',
    planePolygon: '{n} शीर्षों {list} वाला बहुभुज: क्षेत्रफल {area}, परिमाप {perimeter}।',
    planeCircle: 'केंद्र ({cx}, {cy}) और त्रिज्या {r} वाला वृत्त।',
    planeArc: '({cx}, {cy}) को केंद्र मानकर त्रिज्या {r} का चाप, {from}° से {to}° तक, लंबाई {len}।',
    planeAngle: '({x}, {y}) पर कोण {deg}° है।',
    planeRight: '({x}, {y}) पर समकोण।',
    planeCurve: 'वक्र y = {expr}।',
    planeParam: 'वक्र x = {x}, y = {y}, जहाँ t का मान {t0} से {t1} तक है।',

    plTitle: 'एक तिर्यक रेखा द्वारा काटी गई दो समांतर रेखाएँ',
    plDesc: 'तिर्यक रेखा समांतर रेखाओं से {deg}° का कोण बनाती है। कोण a, c, e और g {deg}° के हैं; कोण b, d, f और h {sup}° के हैं।',
    plMarked: 'चिह्नित कोण: {list}।',
    plRel_corresponding: 'संगत कोण {p} और {q} बराबर हैं: दोनों {v1}° के हैं।',
    plRel_alternate: 'एकांतर कोण {p} और {q} बराबर हैं: दोनों {v1}° के हैं।',
    plRel_alternateExterior: 'बाह्य एकांतर कोण {p} और {q} बराबर हैं: दोनों {v1}° के हैं।',
    plRel_vertical: 'शीर्षाभिमुख कोण {p} और {q} बराबर हैं: दोनों {v1}° के हैं।',
    plRel_coInterior: 'तिर्यक रेखा के एक ही ओर के अंतः कोण {p} और {q} का योग 180° है: {v1}° + {v2}° = {sum}°।',
    plRel_coExterior: 'कोण {p} और {q} का योग 180° है: {v1}° + {v2}° = {sum}°।',
    plRel_adjacent: 'कोण {p} और {q} मिलकर एक ऋजु कोण बनाते हैं: {v1}° + {v2}° = {sum}°।',
    plRel_none: 'कोण {p} और {q} क्रमशः {v1}° और {v2}° के हैं।',

    amTitle: 'क्षेत्रफल मॉडल',
    amDesc: '{rows} और {cols} भुजाओं वाला आयत, {n} भागों में बँटा: {cells}।',
    amTotal: 'सभी भागों का योग {total} है, जो {rowSum} × {colSum} के बराबर है।',

    fbTitle: 'बराबर लंबाई की भिन्न-पट्टियाँ',
    fbBar: 'पट्टी {i}: {parts} बराबर भागों में से {shaded} छायांकित, यानी {n}/{d} या {value}।',
    fbEqual: 'पट्टियों {list} में छायांकित भाग बराबर है।',

    reset: 'फिर से शुरू करें',
    ple_title: 'तिर्यक रेखा को घुमाइए',
    ple_slider: 'तिर्यक रेखा का कोण (अंश)',
    ple_read_equal: 'तिर्यक रेखा ${deg}^\\circ$ पर: {name} ${p}$ और ${q}$ दोनों ${v1}^\\circ$ के हैं, और रेखा घुमाने पर भी बराबर रहते हैं।',
    ple_read_sum: 'तिर्यक रेखा ${deg}^\\circ$ पर: {name} ${p}$ और ${q}$ क्रमशः ${v1}^\\circ$ और ${v2}^\\circ$ के हैं, और उनका योग सदा ${sum}^\\circ$ रहता है।',
    ple_read_plain: 'तिर्यक रेखा ${deg}^\\circ$ पर: कोण $a$, $c$, $e$ और $g$ ${deg}^\\circ$ के हैं; कोण $b$, $d$, $f$ और $h$ ${sup}^\\circ$ के हैं।',
    ple_name_corresponding: 'संगत कोण', ple_name_alternate: 'एकांतर कोण', ple_name_alternateExterior: 'बाह्य एकांतर कोण',
    ple_name_vertical: 'शीर्षाभिमुख कोण', ple_name_coInterior: 'एक ही ओर के अंतः कोण', ple_name_coExterior: 'एक ही ओर के बाह्य कोण',
    ple_name_adjacent: 'एक सरल रेखा पर बने कोण', ple_name_none: 'कोण',
    te_read_cosine: '$a^2+b^2={a2}+{b2}={s}$, पर $c^2={c2}$: $C={C}^\\circ$ होने पर $c^2=a^2+b^2-2ab\\cos C={s}{op}{corrAbs}$। केवल $C=90^\\circ$ होने पर ही $c^2=a^2+b^2$ होता है।',
    te_desc_cosine: 'भुजाओं a = {a} और b = {b} तथा उनके बीच के कोण C = {C}° वाला त्रिभुज, हर भुजा पर एक वर्ग: c = {c}; a और b पर बने वर्गों का योग {s} है, और c पर बने वर्ग का क्षेत्रफल {c2} है।',
    te_title_angleSum: 'त्रिभुज के दो कोण बदलिए',
    te_title_pythagoras: 'समकोण त्रिभुज की दो छोटी भुजाएँ बदलिए',
    te_title_trigRatios: 'समकोण त्रिभुज का कोण और आकार बदलिए',
    te_title_similar: 'त्रिभुज को स्केल गुणक k से बड़ा या छोटा कीजिए',
    te_title_area: 'दो भुजाएँ और उनके बीच का कोण बदलिए',
    te_A: 'कोण A (अंश)', te_B: 'कोण B (अंश)', te_C: 'कोण C (अंश)', te_a: 'भुजा a', te_b: 'भुजा b',
    te_angle: 'कोण θ (अंश)', te_hyp: 'कर्ण', te_k: 'स्केल गुणक k',
    hyp: 'कर्ण', opp: 'लंब', adj: 'आधार',
    te_read_angleSum: '$A={A}^\\circ$ और $B={B}^\\circ$, इसलिए $C=180^\\circ-{A}^\\circ-{B}^\\circ={C}^\\circ$। त्रिभुज कैसा भी हो, $A+B+C={sum}^\\circ$।',
    te_desc_angleSum: 'एक त्रिभुज जिसके कोण A = {A}°, B = {B}° और C = {C}° हैं, जिनका योग {sum}° है।',
    te_read_pythagoras: '$a^2+b^2={a}^2+{b}^2={a2}+{b2}={c2}$, और कर्ण $c={cTex}$ है, इसलिए $c^2={c2}$। कर्ण पर बने वर्ग का क्षेत्रफल बाकी दोनों वर्गों के क्षेत्रफलों के योग के बराबर है।',
    te_desc_pythagoras: 'एक समकोण त्रिभुज जिसकी छोटी भुजाएँ a = {a} और b = {b} तथा कर्ण c = {c} है; हर भुजा पर एक वर्ग बना है: क्षेत्रफल {a2} और {b2} का योग {c2} है, जो c पर बने वर्ग का क्षेत्रफल है।',
    te_read_trigRatios: '$\\theta={angle}^\\circ$, कर्ण ${hyp}$, लंब ${opp}$, आधार ${adj}$: $\\sin\\theta=\\tfrac{{opp}}{{hyp}}{eqS}{sin}$, $\\cos\\theta=\\tfrac{{adj}}{{hyp}}{eqC}{cos}$, $\\tan\\theta=\\tfrac{{opp}}{{adj}}{eqT}{tan}$। उसी कोण वाले बड़े त्रिभुज में भी ये अनुपात वही रहते हैं।',
    te_desc_trigRatios: 'A पर कोण θ = {angle}° वाला समकोण त्रिभुज: कर्ण {hyp}, लंब {opp}, आधार {adj}; sin θ = {sin}, cos θ = {cos}, tan θ = {tan}।',
    te_read_similar: 'स्केल गुणक $k={k}$: भुजाएँ ${a}$, ${b}$, ${c}$ बदलकर ${a2}$, ${b2}$, ${c2}$ हो जाती हैं और कोण वही रहते हैं। क्षेत्रफल ${area1}$ से ${area2}$ हो जाता है: क्षेत्रफलों का अनुपात $k^2={k2}$ है।',
    te_desc_similar: "भुजाओं {a}, {b}, {c} और क्षेत्रफल {area1} वाला त्रिभुज ABC, और k = {k} से स्केल किया गया त्रिभुज A'B'C': भुजाएँ {a2}, {b2}, {c2}, क्षेत्रफल {area2}, क्षेत्रफलों का अनुपात {k2}।",
    te_read_area: 'क्षेत्रफल $=\\tfrac12 ab\\sin C=\\tfrac12\\times{a}\\times{b}\\times\\sin{C}^\\circ{eq}{area}$। $A$ से $BC$ पर ऊँचाई $b\\sin C{eqh}{h}$ है, और आधार और ऊँचाई के गुणनफल का आधा भी यही क्षेत्रफल देता है।',
    te_desc_area: 'भुजाओं a = {a} और b = {b} तथा उनके बीच के कोण C = {C}° वाला त्रिभुज: ऊँचाई {h}, क्षेत्रफल {area}।',

    ce_title_centre: 'केंद्र पर कोण और परिधि पर कोण',
    ce_title_segment: 'एक ही वृत्तखंड में बने कोण',
    ce_title_semicircle: 'अर्धवृत्त में बना कोण',
    ce_title_cyclic: 'चक्रीय चतुर्भुज के सम्मुख कोण',
    ce_title_tangent: 'स्पर्श रेखा और त्रिज्या',
    ce_title_chords: 'एक-दूसरे को काटने वाली दो जीवाएँ',
    ce_slider: 'वृत्त पर {name} की स्थिति (अंश)',
    ce_handle: 'वृत्त पर बिंदु {name}',
    ce_valuetext: '{name}, {deg} अंश पर',
    ce_read_centre: '$\\angle AOB={centre}^\\circ$ और $\\angle ARB={circ}^\\circ$: दीर्घ चाप पर $R$ कहीं भी हो, केंद्र पर बना कोण परिधि पर बने कोण का दोगुना होता है।',
    ce_read_segment: '$\\angle ARB={r}^\\circ$ और $\\angle ASB={s}^\\circ$: एक ही वृत्तखंड में बने कोण बराबर होते हैं।',
    ce_read_semicircle: '$\\angle ARB={r}^\\circ$: $R$ कहीं भी हो, अर्धवृत्त में बना कोण समकोण होता है।',
    ce_read_cyclic: '$\\angle A+\\angle C={A}^\\circ+{C}^\\circ={sAC}^\\circ$ और $\\angle B+\\angle D={B}^\\circ+{D}^\\circ={sBD}^\\circ$: चक्रीय चतुर्भुज के सम्मुख कोणों का योग $180^\\circ$ होता है।',
    ce_read_tangent: 'त्रिज्या $OT$ बिंदु $T$ पर स्पर्श रेखा से ${t}^\\circ$ का कोण बनाती है: स्पर्श रेखा स्पर्श बिंदु पर त्रिज्या पर लंब होती है।',
    ce_read_chords: 'त्रिज्या ${radius}$ वाले वृत्त में: $AP\\times PB={ap}\\times{pb}\\approx{p1}$ और $CP\\times PD={cp}\\times{pd}\\approx{p2}$। जीवाएँ कैसे भी काटें, दोनों गुणनफल बराबर रहते हैं।',
    ce_desc_centre: 'केंद्र O वाला वृत्त, बिंदु A और B, तथा दीर्घ चाप पर बिंदु R: कोण AOB = {centre}°, कोण ARB = {circ}°।',
    ce_desc_segment: 'जीवा AB वाला वृत्त और एक ही वृत्तखंड में बिंदु R और S: कोण ARB = {r}°, कोण ASB = {s}°।',
    ce_desc_semicircle: 'व्यास AB वाला वृत्त और वृत्त पर बिंदु R: कोण ARB = {r}°।',
    ce_desc_cyclic: 'चक्रीय चतुर्भुज ABCD: कोण A = {A}°, B = {B}°, C = {C}°, D = {D}°; A + C = {sAC}°, B + D = {sBD}°।',
    ce_desc_tangent: 'केंद्र O वाला वृत्त और T पर स्पर्श रेखा: त्रिज्या OT स्पर्श रेखा से {t}° पर मिलती है।',
    ce_desc_chords: 'त्रिज्या {radius} वाले वृत्त की जीवाएँ AB और CD बिंदु P पर काटती हैं: AP = {ap}, PB = {pb}, CP = {cp}, PD = {pd}; AP × PB = {p1} और CP × PD = {p2}।'
  }
});
