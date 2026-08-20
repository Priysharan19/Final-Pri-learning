// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Auxiliary geometric feature vector (v6)
//
// WHY THIS EXISTS
// The CNN ensemble only ever sees what raster.js produces: a deskewed,
// bbox-normalised, aspect-preserved 28²/32² render. Three steps in that
// pipeline each throw away information that is *definitional* for some symbols:
//
//   (1) DESKEW SHEAR  x' = x − a·(y − ȳ),  a = cov(x,y)/var(y) clamped ±0.42.
//       The glyph's net tilt is deliberately destroyed — that is the point for
//       an italic "3", and a disaster for "/". raster.js guards the obvious case
//       (`isBareLine`: a single stroke whose chord/path > 0.93 is exempt), but a
//       slash written with any bow, entry hook or exit tail fails that test and
//       IS sheared upright, landing on top of "1", "l", "(" and ")".
//
//   (2) BBOX NORMALISATION  the ink is translated to its own bbox and scaled by
//       content/max(w,h). This destroys absolute size (a "." and an "o" and a
//       "0" render identically), and absolute position on the line (baseline vs
//       superscript). The recogniser patches this outside the net with medianH
//       and sizePrior(); the net itself is blind to it.
//
//   (3) FIT INTO THE CONTENT BOX  scale = content/max(w,h), content = 22 px at
//       size 28. A tall-thin glyph therefore gets 22·(w/h) px of HORIZONTAL
//       resolution for its entire shape: ≈1.3 px for an aspect-0.06 stroke,
//       against a brush of radius 1.15 px that splats ink ~2–3 px wide. Every
//       tall-thin symbol is rendered as the same 3-px-wide vertical smear.
//       Which side the stroke bows to, and how deeply, is quantised out of
//       existence — the exact signal that separates ( ) 1 l /.
//       The raster is also a max-composite of ink: stroke count, pen order,
//       retracing, and whether two strokes cross or merely touch are all gone.
//
// This module recovers that information from the raw strokes as a compact
// vector meant to be concatenated into the classifier head (or used as a
// re-ranking side-channel). It is pure arithmetic — no Canvas, no randomness,
// no platform APIs — so training in Node and inference in the iPad WKWebView
// compute bit-identical values, exactly like raster.js does.
//
// LAYOUT — 37 floats, all finite, all roughly in [-1, 1]:
//
//   idx  name            meaning
//   ───  ──────────────  ──────────────────────────────────────────────────────
//    0   aspect          tanh(½·ln(w/h))        <0 tall, >0 wide
//    1   relSize         tanh(ln(max(w,h)/medianH))   0 when medianH unknown
//    2   pathOverDiag    tanh(ln(pathLen/bboxDiag))
//    3   anisotropy      (λ₁−λ₂)/(λ₁+λ₂) of the point covariance
//    4   tiltMoment      tanh(cov(x,y)/var(y))  ← the quantity deskew deletes
//    5   axisSin         sin(2θ), θ = principal axis
//    6   axisCos         cos(2θ)
//    7   bowMean         mean signed offset from the top→bottom chord / |chord|
//    8   bowRight        max positive offset / |chord|   (right of the chord)
//    9   bowLeft         min signed offset / |chord|     (≤0, left of the chord)
//   10   bowRms          rms offset / |chord|
//   11   bowPurity       (Σ⁺ − Σ⁻)/(Σ⁺ + Σ⁻) ∈ [−1,1]: is the bow one-sided?
//   12   bowPeakT        where along the chord |offset| peaks, centred to ±1
//   13   nStrokes        (min(strokes,6) − 1)/5
//   14   closedSpine     chord/path of the dominant stroke (0 loop … 1 straight)
//   15   closedAll       Σchord/Σpath over every stroke
//   16   lineDev         max |offset| / |chord| (unsigned bow depth)
//   17   endTopX         upper endpoint x, relative to bbox centre / max(w,h)
//   18   endTopY         upper endpoint y,  ″
//   19   endBotX         lower endpoint x,  ″
//   20   endBotY         lower endpoint y,  ″
//   21   endDX           (lower−upper).x / max(w,h)   ← chord tilt, survives deskew
//   22   endDY           (lower−upper).y / max(w,h)
//   23   turnSigned      Σ turning angle / 2π, clamped ±1.5, rescaled
//   24   turnAbs         Σ |turning| / 2π, clamped 0..2, rescaled
//   25   turnPurity      |Σθ| / Σ|θ|: monotone bend (arc) vs reversing (s, 3)
//   26   turnMax         sharpest single vertex turn / π  (corner detector)
//   27   loopArea        |shoelace area of spine+chord| / (w·h), clamped
//   28   crossings       min(self/mutual intersections, 4)/4
//   29…36 dirHist[8]     arc-length-weighted histogram of segment direction
//                        mod π (pen-direction invariant), 8 bins, sums to 1
//
// Orientation convention: the "top→bottom chord" is the endpoint chord of the
// dominant (longest) stroke, oriented so it runs downward whenever the stroke
// is steeper than ~31° (|dy| ≥ 0.6·|dx|), and rightward otherwise. That makes
// every feature invariant to which end the pen started at — a "(" drawn upward
// and one drawn downward give the same vector — while keeping the orientation
// rule far away from both the vertical population (1 l ( ) /) and the
// horizontal one (− =), so it never flips inside a class.
// Positive offset = right of the travel direction.
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_NAMES = [
  'aspect', 'relSize', 'pathOverDiag', 'anisotropy',
  'tiltMoment', 'axisSin', 'axisCos',
  'bowMean', 'bowRight', 'bowLeft', 'bowRms', 'bowPurity', 'bowPeakT',
  'nStrokes', 'closedSpine', 'closedAll', 'lineDev',
  'endTopX', 'endTopY', 'endBotX', 'endBotY', 'endDX', 'endDY',
  'turnSigned', 'turnAbs', 'turnPurity', 'turnMax',
  'loopArea', 'crossings',
  'dir0', 'dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7',
];

export const N_FEATURES = FEATURE_NAMES.length;   // 37

const DIR_BINS = 8;
const SPINE_PTS = 32;         // resample budget for the dominant stroke
const CLOUD_PTS = 48;         // resample budget shared across all strokes
const EPS = 1e-9;

// ── input normalisation ──────────────────────────────────────────────────────
// Accepts the two shapes used in the codebase: raw [[x,y],…] polylines (raster.js,
// templates.js, aug.js) and the {points:[{x,y},…]} stroke records the canvas and
// recognizer pass around. Degenerate/empty strokes are dropped.
function toPolylines(strokes) {
  const out = [];
  if (!strokes) return out;
  for (const st of strokes) {
    const raw = Array.isArray(st) ? st : (st && st.points) || [];
    const pts = [];
    for (const p of raw) {
      const x = Array.isArray(p) ? p[0] : p?.x;
      const y = Array.isArray(p) ? p[1] : p?.y;
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
    }
    if (pts.length) out.push(pts);
  }
  return out;
}

const pathLen = (pts) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
};

/** Uniform arc-length resample to exactly n points (n ≥ 2). */
function resample(pts, n) {
  if (pts.length === 1) return Array.from({ length: n }, () => pts[0].slice());
  const total = pathLen(pts);
  if (total < EPS) return Array.from({ length: n }, () => pts[0].slice());
  const step = total / (n - 1);
  const out = [pts[0].slice()];
  let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    let seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + seg >= step && seg > EPS && out.length < n) {
      const t = (step - acc) / seg;
      prev = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(prev.slice());
      seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      acc = 0;
    }
    acc += seg;
    prev = cur;
  }
  const last = pts[pts.length - 1];
  while (out.length < n) out.push(last.slice());
  return out.slice(0, n);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const tanh = Math.tanh || ((x) => { const e = Math.exp(2 * x); return (e - 1) / (e + 1); });

/** Proper intersection test for open segments (shared endpoints do not count). */
function segmentsCross(a, b, c, d) {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
  const d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/**
 * Geometric side-channel for one segmented glyph.
 * @param {Array} strokes  [[ [x,y], … ], …]  or  [{points:[{x,y},…]}, …]
 * @param {Object} [opts]
 * @param {number} [opts.medianH]  median glyph size of the line, in the same
 *        units as the strokes. Omit and feature 1 is 0 (= "same as median").
 * @returns {Float32Array} N_FEATURES finite floats, mostly within [-1, 1].
 */
export function geomFeatures(strokes, opts = {}) {
  const f = new Float32Array(N_FEATURES);
  const polys = toPolylines(strokes);
  if (!polys.length) return f;

  // ── bbox over the raw ink ──────────────────────────────────────────────────
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of polys) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  const w = Math.max(x2 - x1, EPS), h = Math.max(y2 - y1, EPS);
  const S = Math.max(w, h);                      // the scale raster.js normalises out
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const diag = Math.hypot(w, h);

  const lens = polys.map(pathLen);
  const totalLen = lens.reduce((a, b) => a + b, 0);

  // ── (0–2) size / extent ────────────────────────────────────────────────────
  f[0] = tanh(0.5 * Math.log(w / h));
  const medianH = opts.medianH;
  f[1] = (Number.isFinite(medianH) && medianH > EPS) ? tanh(Math.log(S / medianH)) : 0;
  f[2] = tanh(Math.log(Math.max(totalLen, EPS) / diag));

  // ── arc-length-uniform cloud: moments must not be biased by pen speed ──────
  const cloud = [];
  for (let i = 0; i < polys.length; i++) {
    const share = totalLen > EPS
      ? Math.max(3, Math.round(CLOUD_PTS * lens[i] / totalLen))
      : 3;
    for (const p of resample(polys[i], share)) cloud.push(p);
  }
  let mx = 0, my = 0;
  for (const p of cloud) { mx += p[0]; my += p[1]; }
  mx /= cloud.length; my /= cloud.length;
  let vxx = 0, vyy = 0, vxy = 0;
  for (const p of cloud) {
    const dx = p[0] - mx, dy = p[1] - my;
    vxx += dx * dx; vyy += dy * dy; vxy += dx * dy;
  }
  vxx /= cloud.length; vyy /= cloud.length; vxy /= cloud.length;

  // ── (3) anisotropy, (5–6) principal axis as sin/cos 2θ (no wrap seam) ──────
  const tr = vxx + vyy;
  const disc = Math.sqrt(Math.max(0, (vxx - vyy) * (vxx - vyy) + 4 * vxy * vxy));
  f[3] = tr > EPS ? clamp(disc / tr, 0, 1) : 0;
  const n2 = Math.hypot(vxx - vyy, 2 * vxy);
  f[5] = n2 > EPS ? (2 * vxy) / n2 : 0;
  f[6] = n2 > EPS ? (vxx - vyy) / n2 : 0;

  // ── (4) the deskew parameter itself ────────────────────────────────────────
  // raster.js computes exactly cov(x,y)/var(y), clamps it to ±0.42 and shears it
  // away. We keep it (unclamped, then squashed) so the net can see the tilt the
  // render no longer has.
  f[4] = vyy > EPS ? tanh(vxy / vyy) : 0;

  // ── dominant stroke ("spine") and its oriented chord ───────────────────────
  let si = 0;
  for (let i = 1; i < polys.length; i++) if (lens[i] > lens[si]) si = i;
  let spine = resample(polys[si], SPINE_PTS);
  {
    const a = spine[0], b = spine[spine.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    // steeper than ~31° → order top-to-bottom; flatter → order left-to-right.
    const flip = (Math.abs(dy) >= 0.6 * Math.abs(dx)) ? (dy < 0) : (dx < 0);
    if (flip) spine = spine.slice().reverse();
  }
  const A = spine[0], B = spine[spine.length - 1];
  const vx = B[0] - A[0], vy = B[1] - A[1];
  const chord = Math.hypot(vx, vy);
  const spineLen = lens[si];

  // ── (7–12, 16) signed bow about the chord ──────────────────────────────────
  // offset(p) = ((p−A) × direction) with the sign fixed so + is to the RIGHT of
  // travel. Normalised by |chord| when there is one; a near-closed stroke has no
  // usable chord, so fall back to the stroke's own path length.
  const norm = chord > 0.05 * spineLen ? chord : Math.max(spineLen, EPS);
  if (chord > EPS) {
    const ux = vx / chord, uy = vy / chord;
    let sum = 0, sumSq = 0, pos = 0, neg = 0, maxAbs = 0, peakT = 0;
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i < spine.length; i++) {
      const p = spine[i];
      const o = (p[0] - A[0]) * uy - (p[1] - A[1]) * ux;   // + = right of travel
      sum += o; sumSq += o * o;
      if (o > 0) pos += o; else neg -= o;
      if (o > hi) hi = o;
      if (o < lo) lo = o;
      if (Math.abs(o) > maxAbs) { maxAbs = Math.abs(o); peakT = i / (spine.length - 1); }
    }
    const n = spine.length;
    f[7] = clamp((sum / n) / norm, -2, 2);
    f[8] = clamp(hi / norm, -2, 2);
    f[9] = clamp(lo / norm, -2, 2);
    f[10] = clamp(Math.sqrt(sumSq / n) / norm, 0, 2);
    f[11] = (pos + neg) > EPS ? (pos - neg) / (pos + neg) : 0;
    f[12] = 2 * peakT - 1;
    f[16] = clamp(maxAbs / norm, 0, 2);
  }

  // ── (13–15) stroke count, closedness ───────────────────────────────────────
  f[13] = (Math.min(polys.length, 6) - 1) / 5;
  f[14] = spineLen > EPS ? clamp(chord / spineLen, 0, 1) : 0;
  let chordSum = 0;
  for (const st of polys) chordSum += Math.hypot(st[st.length - 1][0] - st[0][0], st[st.length - 1][1] - st[0][1]);
  f[15] = totalLen > EPS ? clamp(chordSum / totalLen, 0, 1) : 0;

  // ── (17–22) endpoints relative to the bbox ─────────────────────────────────
  // Normalised by max(w,h) rather than by w: for a tall-thin glyph w → 0 and a
  // w-relative coordinate would blow pen wobble up into a ±1 swing.
  f[17] = clamp((A[0] - cx) / S, -1.5, 1.5);
  f[18] = clamp((A[1] - cy) / S, -1.5, 1.5);
  f[19] = clamp((B[0] - cx) / S, -1.5, 1.5);
  f[20] = clamp((B[1] - cy) / S, -1.5, 1.5);
  f[21] = clamp(vx / S, -1.5, 1.5);
  f[22] = clamp(vy / S, -1.5, 1.5);

  // ── (23–26) turning statistics over every stroke ───────────────────────────
  let turnSum = 0, turnAbsSum = 0, turnMax = 0;
  for (let i = 0; i < polys.length; i++) {
    const n = Math.max(4, Math.min(SPINE_PTS, Math.round(SPINE_PTS * lens[i] / Math.max(totalLen, EPS)) + 3));
    const rs = resample(polys[i], n);
    for (let j = 1; j + 1 < rs.length; j++) {
      const ax = rs[j][0] - rs[j - 1][0], ay = rs[j][1] - rs[j - 1][1];
      const bx = rs[j + 1][0] - rs[j][0], by = rs[j + 1][1] - rs[j][1];
      if (Math.hypot(ax, ay) < EPS || Math.hypot(bx, by) < EPS) continue;
      const ang = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      turnSum += ang;
      turnAbsSum += Math.abs(ang);
      if (Math.abs(ang) > turnMax) turnMax = Math.abs(ang);
    }
  }
  const TAU = Math.PI * 2;
  f[23] = clamp(turnSum / TAU, -1.5, 1.5) / 1.5;
  f[24] = clamp(turnAbsSum / TAU, 0, 2) / 2;
  f[25] = turnAbsSum > EPS ? clamp(Math.abs(turnSum) / turnAbsSum, 0, 1) : 0;
  f[26] = clamp(turnMax / Math.PI, 0, 1);

  // ── (27) enclosed area of the spine, closed by its chord ───────────────────
  let area2 = 0;
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i], q = spine[(i + 1) % spine.length];
    area2 += p[0] * q[1] - q[0] * p[1];
  }
  f[27] = clamp(Math.abs(area2) / 2 / (w * h), 0, 1);

  // ── (28) crossings: proper intersections of non-adjacent segments ──────────
  // Invisible in the raster, which max-composites ink: an "x" of two crossing
  // strokes and a ">"+"<" that merely touch are the same pixels.
  const segs = [];
  for (let i = 0; i < polys.length; i++) {
    const n = Math.max(4, Math.min(24, Math.round(24 * lens[i] / Math.max(totalLen, EPS)) + 2));
    const rs = resample(polys[i], n);
    for (let j = 1; j < rs.length; j++) segs.push([rs[j - 1], rs[j], i, j]);
  }
  let cross = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i], b = segs[j];
      if (a[2] === b[2] && b[3] - a[3] < 2) continue;      // adjacent within a stroke
      if (segmentsCross(a[0], a[1], b[0], b[1])) cross++;
    }
  }
  f[28] = Math.min(cross, 4) / 4;

  // ── (29–36) direction histogram, θ mod π, arc-length weighted ──────────────
  // Soft-binned (linear split between neighbouring bins) so a hair of rotation
  // moves the vector smoothly instead of jumping a bin.
  const hist = new Float64Array(DIR_BINS);
  let wsum = 0;
  for (const st of polys) {
    for (let i = 1; i < st.length; i++) {
      const dx = st[i][0] - st[i - 1][0], dy = st[i][1] - st[i - 1][1];
      const len = Math.hypot(dx, dy);
      if (len < EPS) continue;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI;                 // fold to [0, π): pen-direction invariant
      if (a >= Math.PI) a -= Math.PI;
      const pos = a / Math.PI * DIR_BINS - 0.5;
      const b0 = Math.floor(pos);
      const t = pos - b0;
      hist[((b0 % DIR_BINS) + DIR_BINS) % DIR_BINS] += len * (1 - t);
      hist[((b0 + 1) % DIR_BINS + DIR_BINS) % DIR_BINS] += len * t;
      wsum += len;
    }
  }
  if (wsum > EPS) for (let i = 0; i < DIR_BINS; i++) f[29 + i] = hist[i] / wsum;

  // ── safety: the head must never be fed a NaN ───────────────────────────────
  for (let i = 0; i < f.length; i++) {
    if (!Number.isFinite(f[i])) f[i] = 0;
    else f[i] = clamp(f[i], -4, 4);
  }
  return f;
}

export default geomFeatures;
