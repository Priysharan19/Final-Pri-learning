// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting recognition engine v3
// Fully on-device. Pipeline:
//   strokes → symbol segmentation → THREE-WAY classification
//     (structural detectors ∘ int8 CNN ENSEMBLE (28²+32², deskewed, trained on
//      142k samples) ∘ $P point-cloud matching vs stock + YOUR OWN templates)
//   → segmentation self-repair (low-confidence merge AND split retries)
//   → math-language decode (function names sin/cos/tan/sec/csc/cot/ln/log,
//     LHS/RHS, digit↔letter context, lookalike re-rank)
//   → grammar beam: uncertain lines re-decoded over per-glyph candidates
//     against a maths-syntax prior (balanced brackets, operator placement…)
//   → 2D layout (lines, fractions, roots, exponents) → maths string
// The output feeds the same parser, marker and Step Check as typed answers.
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from './templates.js';
import { nnClassify, NN_CLASSES } from './nn.js';
import { geomRerank } from './rerank.js';
import { classOfSymbol, defaultSymbol, symbolsOfClass, CLASS_INDEX } from './classes.js';
import { getPersonalBank } from './personal.js';
import { slantOf } from './raster.js';

// ── Geometry helpers ─────────────────────────────────────────────────────────

const bbox = pts => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); }
  return { x1, y1, x2, y2, w: Math.max(1e-6, x2 - x1), h: Math.max(1e-6, y2 - y1), cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
};
const strokePts = s => s.points.map(p => [p.x, p.y]);
const pathLen = pts => { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d; };

function resample(pts, n) {
  if (pts.length < 2) return Array.from({ length: n }, () => pts[0] || [0, 0]);
  const total = pathLen(pts);
  if (total === 0) return Array.from({ length: n }, () => pts[0]);
  const step = total / (n - 1);
  const out = [pts[0].slice()];
  let dAcc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i];
    let seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (dAcc + seg >= step && seg > 0) {
      const t = (step - dAcc) / seg;
      const nx = prev[0] + t * (cur[0] - prev[0]);
      const ny = prev[1] + t * (cur[1] - prev[1]);
      out.push([nx, ny]);
      prev = [nx, ny];
      seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      dAcc = 0;
    }
    dAcc += seg;
    prev = cur;
  }
  while (out.length < n) out.push(pts[pts.length - 1].slice());
  return out.slice(0, n);
}

/** Normalize a point cloud: centroid → origin, uniform scale by larger extent. */
function normalizeCloud(pts) {
  const b = bbox(pts);
  const scale = Math.max(b.w, b.h);
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(p => [(p[0] - cx) / scale, (p[1] - cy) / scale]);
}

const N_PTS = 40;

/** Build a matchable cloud from a list of strokes (arrays of [x,y]). */
function cloudOf(strokes) {
  const total = strokes.reduce((s, st) => s + Math.max(1, pathLen(st)), 0);
  let pts = [];
  for (const st of strokes) {
    const share = Math.max(4, Math.round(N_PTS * Math.max(1, pathLen(st)) / total));
    pts = pts.concat(resample(st, share));
  }
  return normalizeCloud(resample(pts, N_PTS));
}

/** Greedy cloud match ($P style) — order-free, direction-free. */
function cloudDistance(a, b) {
  const n = a.length;
  let best = Infinity;
  const starts = 8;
  for (let s = 0; s < starts; s++) {
    const start = Math.floor(s * n / starts);
    let matched = new Array(n).fill(false);
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      let min = Infinity, mi = -1;
      for (let j = 0; j < n; j++) {
        if (matched[j]) continue;
        const d = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]);
        if (d < min) { min = d; mi = j; }
      }
      matched[mi] = true;
      const weight = 1 - k / n * 0.5;
      sum += min * weight;
    }
    if (sum < best) best = sum;
  }
  return best / n;
}

// Precompute template clouds (with aspect for a cheap gate)
const TEMPLATE_CLOUDS = [];
for (const [sym, variants] of Object.entries(TEMPLATES)) {
  for (const strokes of variants) {
    const flat = strokes.map(st => st.map(p => p.slice()));
    const allPts = flat.flat();
    const b = bbox(allPts);
    TEMPLATE_CLOUDS.push({ sym, cloud: cloudOf(flat), aspect: b.w / b.h, nStrokes: strokes.length });
  }
}

// ── Hand-slant normalisation ─────────────────────────────────────────────────
// A writer has ONE hand: their italic lean is consistent down the page. For a
// single near-straight stroke that lean is indistinguishable from identity —
// an upright hand's '/' and a right-leaning hand's '1' can produce the same
// ink — which is why the rasteriser deskews every glyph EXCEPT bare lines
// (raster.js). That exception leaves the stick family (1 l / ( ) …) judged by
// ABSOLUTE slope, so a consistently slanted hand walks every stick it writes
// across the class boundaries. The lean is, however, measurable from the
// glyphs that do carry it — curved and multi-stroke glyphs, whose slantOf
// tracks the hand — and shearing the whole page upright before segmentation
// moves any writer back onto the upright distribution the engine was built
// for. Absolute-angle tests become hand-relative for free, which is how a
// human reads a slanted "1": against the writing around it, not the vertical.
//
// Lean is not the hand's only page-wide constant — aspect, x-height and
// inter-glyph spacing are too — but it is the only one worth cancelling here,
// which was settled by measurement rather than assumed. Removing a writer's
// aspect EXACTLY is worth about a point of line accuracy (measured against a
// simulator with the aspect switched off), yet the estimate has to come from
// the handful of glyphs one answer contains, whose symbol MIX moves the median
// further than any hand does: aspect has no natural zero to be measured
// against, the way slant has upright and spacing has the writer's own glyph
// width. Estimated rather than given, it costs more than it returns. Feeding a
// measured inter-glyph spacing into the segmenter's gap thresholds was built
// and measured the same way and moved nothing: those thresholds are already
// spacing-robust across the range a hand varies over.

const nearStraight = (pts) => {
  if (pts.length < 2) return true;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
  return chord / Math.max(len, 1e-6) > 0.9;
};

/** Does this glyph's slant say anything about the hand? Dots and small marks
 *  are noise, bars are horizontal by identity, bare straight strokes ARE their
 *  slant. Everything else votes. */
const slantBearing = (strokes, box, medianH) => {
  if (Math.max(box.w, box.h) < 0.45 * medianH) return false;
  if (box.h < 0.6 * box.w) return false;
  if (strokes.length === 1 && nearStraight(strokes[0])) return false;
  return true;
};

// The estimator's zero point: the template library's own median slant under
// the same gates. An estimator that returns this value on unslanted writing is
// unbiased once it is subtracted — measured from the templates themselves, not
// tuned to any suite.
const TEMPLATE_SLANT_BIAS = (() => {
  const votes = [];
  for (const variants of Object.values(TEMPLATES)) {
    for (const strokes of variants) {
      const flat = strokes.map(st => st.map(p => p.slice()));
      const b = bbox(flat.flat());
      if (!slantBearing(flat, b, Math.max(b.w, b.h))) continue;
      votes.push(slantOf(flat));
    }
  }
  votes.sort((a, b) => a - b);
  return votes.length ? votes[Math.floor(votes.length / 2)] : 0;
})();

/** Median hand slant over the slant-bearing groups of a page. Damped toward 0
 *  when few glyphs vote, quantised so the classify cache stays stable across
 *  debounce re-runs, and ignored entirely below the estimator's noise floor. */
function handSlantOf(groups, medianH) {
  const votes = [];
  for (const g of groups) {
    const strokes = g.strokes.map(strokePts);
    if (!slantBearing(strokes, g.box, medianH)) continue;
    votes.push(slantOf(strokes));
  }
  if (votes.length < 2) return 0;
  votes.sort((a, b) => a - b);
  const med = votes[Math.floor(votes.length / 2)] - TEMPLATE_SLANT_BIAS;
  const damped = med * votes.length / (votes.length + 1.5);
  if (Math.abs(damped) < 0.05) return 0;
  return Math.round(Math.max(-0.32, Math.min(0.32, damped)) * 50) / 50;
}

// Personal templates — rebuilt whenever the learned bank grows.
let personalClouds = [];
let personalStamp = -1;
function getPersonalClouds() {
  const bank = getPersonalBank();
  if (bank.length !== personalStamp) {
    personalStamp = bank.length;
    personalClouds = bank.map(t => {
      const flat = t.strokes.map(st => st.map(p => p.slice()));
      const b = bbox(flat.flat());
      return { sym: t.sym, cloud: cloudOf(flat), aspect: b.w / b.h, nStrokes: flat.length };
    });
  }
  return personalClouds;
}

// ── Structural classifiers (fast, high-precision special cases) ──────────────

const flatness = pts => { const b = bbox(pts); return b.h / Math.max(b.w, 1e-6); };
const verticalness = pts => { const b = bbox(pts); return b.w / Math.max(b.h, 1e-6); };

function lineFitDeviation(pts) {
  const [a, b2] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1e-6;
  let max = 0;
  for (const p of pts) {
    const d = Math.abs((b2[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b2[1] - a[1])) / len;
    max = Math.max(max, d);
  }
  return max / len; // relative deviation
}

function structural(group, medianH) {
  const strokes = group.strokes.map(strokePts);
  const b = group.box;
  const size = Math.max(b.w, b.h);

  // dot
  if (size < 0.22 * medianH) return { sym: '.', conf: 0.95 };

  // colon: two tiny marks stacked vertically
  if (strokes.length === 2) {
    const bA = bbox(strokes[0]), bB = bbox(strokes[1]);
    const tiny = s => Math.max(s.w, s.h) < 0.22 * medianH;
    if (tiny(bA) && tiny(bB) && Math.abs(bA.cx - bB.cx) < 0.25 * medianH && Math.abs(bA.cy - bB.cy) > 0.15 * medianH) {
      return { sym: ':', conf: 0.93 };
    }
  }

  // degree mark: a single small closed loop (bigger than a dot, smaller than a digit)
  if (strokes.length === 1) {
    const pts0 = resample(strokes[0], 20);
    const pb0 = bbox(pts0);
    const chord0 = Math.hypot(pts0[pts0.length - 1][0] - pts0[0][0], pts0[pts0.length - 1][1] - pts0[0][1]);
    if (size >= 0.22 * medianH && size < 0.42 * medianH && chord0 < 0.4 * size && pb0.h > 0.55 * pb0.w && pb0.w > 0.55 * pb0.h) {
      let mx = 0, my = 0;
      for (const pt of pts0) { mx += pt[0]; my += pt[1]; }
      mx /= pts0.length; my /= pts0.length;
      const radii = pts0.map(pt => Math.hypot(pt[0] - mx, pt[1] - my));
      const meanR = radii.reduce((t2, r2) => t2 + r2, 0) / radii.length;
      const maxDev = Math.max(...radii.map(r2 => Math.abs(r2 - meanR)));
      if (meanR > 1e-6 && maxDev < 0.35 * meanR) return { sym: 'deg', conf: 0.9 };
    }
  }

  if (strokes.length === 3) {
    const boxes = strokes.map(st => bbox(st));
    const tiny3 = bx => Math.max(bx.w, bx.h) < 0.3 * medianH;
    const dots = boxes.filter(tiny3);
    const bigs = strokes.map((st, i) => ({ pts: resample(st, 20), box: boxes[i] })).filter(x => !tiny3(x.box));

    // ÷ : one horizontal bar with a dot above and a dot below
    if (dots.length === 2 && bigs.length === 1) {
      const bar = bigs[0];
      const flatBar = flatness(bar.pts) < 0.35 && lineFitDeviation(bar.pts) < 0.14;
      const oneAbove = dots.some(d2 => d2.cy < bar.box.cy - 0.1 * medianH);
      const oneBelow = dots.some(d2 => d2.cy > bar.box.cy + 0.1 * medianH);
      if (flatBar && oneAbove && oneBelow) return { sym: 'div', conf: 0.95 };
    }

    if (bigs.length === 3) {
      const flat = bigs.filter(x => flatness(x.pts) < 0.4 && lineFitDeviation(x.pts) < 0.14);
      const vert = bigs.filter(x => verticalness(x.pts) < 0.45 && lineFitDeviation(x.pts) < 0.14);
      const diag = bigs.filter(x => !flat.includes(x) && !vert.includes(x));

      // ± : vertical + crossbar through it + a separate bar underneath
      if (flat.length === 2 && vert.length === 1) {
        const v = vert[0];
        const [fA, fB] = flat.sort((a2, b2) => a2.box.cy - b2.box.cy);
        const crosses = fA.box.cy > v.box.y1 && fA.box.cy < v.box.y2;
        const under = fB.box.cy > v.box.y2 - 0.15 * medianH;
        if (crosses && under) return { sym: 'pm', conf: 0.94 };
      }

      // ≠ : two stacked bars crossed by a steep diagonal
      if (flat.length === 2 && diag.length === 1) {
        const [fA, fB] = flat.sort((a2, b2) => a2.box.cy - b2.box.cy);
        const gap = fB.box.cy - fA.box.cy;
        const dg = diag[0];
        const crossesBoth = dg.box.y1 < fA.box.cy && dg.box.y2 > fB.box.cy;
        if (gap > 0.12 * medianH && gap < 1.2 * medianH && crossesBoth) return { sym: '!=', conf: 0.94 };
      }
    }
  }

  if (strokes.length === 1) {
    const pts = resample(strokes[0], 24);
    const dev = lineFitDeviation(pts);
    const pb = bbox(pts);
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    // A genuine straight line's endpoints span its extent — closed loops (0, 8, θ)
    // have a near-zero chord and must never pass this test.
    if (chord > 0.75 * Math.max(pb.w, pb.h) && dev < 0.09) { // straight line
      const dx = pts[pts.length - 1][0] - pts[0][0];
      const dy = pts[pts.length - 1][1] - pts[0][1];
      const ang = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI);
      if (ang < 22) return { sym: '-', conf: 0.92 };
      if (ang > 72) return { sym: '1', conf: 0.85 };
      if ((dx > 0 && dy < 0) || (dx < 0 && dy > 0)) return { sym: '/', conf: 0.85 };
    }
    // A radical has to be big enough to have something under it. segment()
    // already size-gates its radical test; this one did not, so any small
    // tick with a flat top-right could be promoted to a root sign — and a
    // phantom sqrt is expensive, because assembleLine then swallows the rest
    // of the line into its argument.
    if (Math.max(b.w, b.h) > 0.9 * medianH && isRadicalStroke(strokes[0])) {
      return { sym: 'sqrt', conf: 0.9 };
    }
  }

  if (strokes.length === 2) {
    const p1 = resample(strokes[0], 20), p2 = resample(strokes[1], 20);
    const f1 = flatness(p1) < 0.35 && lineFitDeviation(p1) < 0.12;
    const f2 = flatness(p2) < 0.35 && lineFitDeviation(p2) < 0.12;
    if (f1 && f2) {
      const b1 = bbox(p1), b2 = bbox(p2);
      const vGap = Math.abs(b1.cy - b2.cy);
      if (vGap > 0.12 * medianH && vGap < 1.2 * medianH) return { sym: '=', conf: 0.93 };
    }
    // ≤ / ≥ : a chevron (corner stroke) with a flat bar underneath
    const chevronOf = (pts) => {
      const bb = bbox(pts);
      if (bb.w < 0.3 * medianH || bb.h < 0.3 * medianH) return null;
      const first = pts[0], last = pts[pts.length - 1];
      let apex = pts[0];
      for (const pt of pts) if (Math.abs(pt[0] - (first[0] + last[0]) / 2) > Math.abs(apex[0] - (first[0] + last[0]) / 2)) apex = pt;
      const endsRight = first[0] > bb.cx && last[0] > bb.cx;
      const endsLeft = first[0] < bb.cx && last[0] < bb.cx;
      const dev = lineFitDeviation(pts);
      if (dev < 0.14) return null;
      if (endsRight && apex[0] < bb.cx) return '<';
      if (endsLeft && apex[0] > bb.cx) return '>';
      return null;
    };
    if (f1 || f2) {
      const flatP = f1 ? p1 : f2 ? p2 : null;
      const otherP = f1 ? p2 : p1;
      if (flatP && flatP !== otherP) {
        const bf2 = bbox(flatP), bo2 = bbox(otherP);
        if (bf2.cy > bo2.y2 - 0.15 * medianH) {
          const chev = chevronOf(otherP);
          if (chev === '<') return { sym: '<=', conf: 0.93 };
          if (chev === '>') return { sym: '>=', conf: 0.93 };
        }
      }
    }
    const v1 = verticalness(p1) < 0.45 && lineFitDeviation(p1) < 0.14;
    const v2 = verticalness(p2) < 0.45 && lineFitDeviation(p2) < 0.14;
    if ((f1 && v2) || (f2 && v1)) {
      const flat = f1 ? p1 : p2;
      const vert = f1 ? p2 : p1;
      const bf = bbox(flat), bv = bbox(vert);
      if (Math.abs(bf.cx - bv.cx) < 0.45 * size) {
        // Crossbar height along the stem separates '+' from 't'. It used to be
        // split at a single line, which made every glyph near that line a coin
        // flip decided by a HARD verdict that skipped the net entirely — and
        // the net is right about these: measured likelihood ratios of 1.2 and
        // 88 in the two directions, with this override throwing that away.
        // Only the clear cases are decided here now; the ambiguous middle falls
        // through to the classifier and the geometry re-ranker.
        // Where the bar crosses is only half the story. A plus is a cross of
        // two equal arms — its bar is about as long as its stem is tall —
        // while a t's bar is a stub around 0.6 of the stem. Judging crossing
        // height alone leaves the two populations' tails on top of each other
        // (94% separable); adding the bar-to-stem ratio pulls them apart to
        // 98% on two held-out seeds, because a bar that has drifted high on a
        // '+' is still a long bar.
        const rel = (bf.cy - bv.y1) / Math.max(bv.h, 1e-6);
        const barOverStem = bf.w / Math.max(bv.h, 1e-6);
        if (rel <= 0.64) {
          return rel + 0.15 * barOverStem < 0.5
            ? { sym: 't', conf: 0.9 }
            : { sym: '+', conf: 0.93 };
        }
      }
    }
  }
  return null;
}

/** Radical signature: long flat top tail on the right, hook/valley on the left. */
function isRadicalStroke(ptsIn) {
  const pts = resample(ptsIn, 32);
  const b = bbox(pts);
  if (b.h < 0.22 * b.w) return false;
  if (b.w < 0.75 * b.h) return false;
  if (b.h < 1e-3) return false;
  const right = pts.filter(p => p[0] > b.x1 + 0.6 * b.w);
  if (right.length < 4) return false;
  const rb = bbox(right);
  if (rb.h > 0.25 * b.h) return false;
  if ((rb.cy - b.y1) > 0.3 * b.h) return false;
  let lowest = pts[0];
  for (const p of pts) if (p[1] > lowest[1]) lowest = p;
  if ((lowest[0] - b.x1) > 0.45 * b.w) return false;
  // The valley must be INTERIOR to the stroke. A radical is written as a dive
  // and a climb: the pen enters above the valley and leaves above it again. An
  // r, a c, a '<' or a slash all bottom out *at* one of their two endpoints —
  // the deskewed raster cannot see which pixel the pen visited first, so this
  // is exactly the evidence the CNN is missing. Without it the tests above let
  // r through 27% of the time and a steep slash 9% of the time, and a spurious
  // sqrt swallows the rest of the line into sqrt(…).
  const e0 = pts[0], e1 = pts[pts.length - 1];
  const endRise = Math.min(lowest[1] - e0[1], lowest[1] - e1[1]) / b.h;
  if (endRise < 0.14) return false;
  // …and a radical is a bent stroke, never a straight one ('/' and '-').
  if (lineFitDeviation(pts) < 0.18) return false;
  return true;
}

// ── Symbol segmentation ──────────────────────────────────────────────────────

function overlap1D(a1, a2, b1, b2) {
  const inter = Math.min(a2, b2) - Math.max(a1, b1);
  return inter / Math.max(1e-6, Math.min(a2 - a1, b2 - b1));
}

/**
 * Group strokes into symbols. Strokes belong together when they overlap
 * horizontally (x, ×, =, 4, 5, π, θ, t, %) — with special care that a tall
 * fraction bar doesn't swallow its numerator/denominator (bars group alone).
 */
export function segment(strokesIn) {
  // Point arrays are rebuilt constantly by the shape tests and the regrouping
  // below; on a full page that allocation dominated the whole recogniser. Each
  // wrapper caches its own, and the wrappers are private to this call.
  const strokes = strokesIn.map((s, i) => {
    const pts = s.points.map(p => [p.x, p.y]);
    return { ...s, idx: i, _pts: pts, box: bbox(pts) };
  }).filter(s => s.points.length > 0);
  if (!strokes.length) return [];
  const ptsOf = s => s._pts || (s._pts = s.points.map(p => [p.x, p.y]));
  const used = new Array(strokes.length).fill(false);
  const groups = [];
  const heights = strokes.map(s => Math.max(s.box.w, s.box.h)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 20;

  const isBarLike = s => s.box.h < 0.3 * Math.max(s.box.w, 1) && s.box.w > 1.5 * medianH;
  const isRadical = s => isRadicalStroke(ptsOf(s)) && Math.max(s.box.w, s.box.h) > 0.8 * medianH;
  const standalone = strokes.map(s => isBarLike(s) || isRadical(s));
  const tinyMark = s => Math.max(s.box.w, s.box.h) < 0.3 * Math.max(medianH, 8);
  const barish = s => s.box.h < 0.3 * Math.max(s.box.w, 1) && s.box.w > 1.1 * medianH;

  // Obelus (÷) pre-pass
  for (let bi = 0; bi < strokes.length; bi++) {
    if (used[bi]) continue;
    const bar = strokes[bi];
    // A fast hand thickens the bar, so the flatness gate is loose. The dot-size
    // gate below stays tight: a fraction with a small numerator and denominator
    // overlaps ÷ on every size and proportion test there is, and mis-reading
    // "3 over 4" as "3÷4" changes the maths.
    if (!(bar.box.h < 0.55 * Math.max(bar.box.w, 1))) continue;
    const dotsAbove = [], dotsBelow = [];
    for (let di = 0; di < strokes.length; di++) {
      if (di === bi || used[di]) continue;
      const d = strokes[di].box;
      const dotSize = Math.max(d.w, d.h);
      if (dotSize > 0.28 * Math.max(bar.box.w, 1)) continue;
      const inSpan = d.cx > bar.box.x1 - 2 && d.cx < bar.box.x2 + 2;
      const vDist = Math.abs(d.cy - bar.box.cy);
      if (!inSpan || vDist > 0.9 * Math.max(bar.box.w, medianH)) continue;
      (d.cy < bar.box.cy ? dotsAbove : dotsBelow).push(di);
    }
    if (dotsAbove.length === 1 && dotsBelow.length === 1) {
      const g = [bar, strokes[dotsAbove[0]], strokes[dotsBelow[0]]];
      used[bi] = used[dotsAbove[0]] = used[dotsBelow[0]] = true;
      groups.push({ strokes: g, box: bbox(g.flatMap(st => ptsOf(st))), strokeIdxs: g.map(st => st.idx) });
    }
  }

  // Percent (%) pre-pass: a steep, roughly straight slash carrying a small
  // round mark on either side of it. The marks sit on the slash's ANTI-diagonal
  // — top-left and bottom-right of a "/" — so they are never near its
  // endpoints, and endpoint proximity is the wrong test entirely. What does
  // identify them: each is markedly smaller than the slash, hugs its body, and
  // the two lie on OPPOSITE SIDES of the slash line. A neighbouring digit
  // fails all three.
  const straightish = (s) => {
    const pts = ptsOf(s);
    if (pts.length < 2) return false;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    return chord / Math.max(len, 1e-6) > 0.72;
  };
  for (let si = 0; si < strokes.length; si++) {
    if (used[si]) continue;
    const slash = strokes[si];
    const sLen = Math.max(slash.box.w, slash.box.h);
    if (slash.box.h < 0.6 * slash.box.w) continue;          // steep — never a ÷ bar
    if (sLen < 0.8 * medianH || !straightish(slash)) continue;
    const sp = ptsOf(slash);
    const p0 = sp[0], p1 = sp[sp.length - 1];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    if (Math.hypot(dx, dy) < 1e-6) continue;
    const pad = 0.4 * sLen;
    const marks = [];
    for (let mi = 0; mi < strokes.length; mi++) {
      if (mi === si || used[mi]) continue;
      const m = strokes[mi].box;
      if (Math.max(m.w, m.h) > 0.62 * sLen) continue;       // markedly smaller
      if (m.cx < slash.box.x1 - pad || m.cx > slash.box.x2 + pad) continue;
      if (m.cy < slash.box.y1 - pad || m.cy > slash.box.y2 + pad) continue;
      const side = (m.cx - p0[0]) * dy - (m.cy - p0[1]) * dx;
      marks.push({ mi, side, above: m.cy < slash.box.cy });
    }
    const left = marks.filter(m => m.side < 0), right = marks.filter(m => m.side > 0);
    if (left.length === 1 && right.length === 1 && left[0].above !== right[0].above) {
      const g = [slash, strokes[left[0].mi], strokes[right[0].mi]];
      used[si] = used[left[0].mi] = used[right[0].mi] = true;
      groups.push({ strokes: g, box: bbox(g.flatMap(st => ptsOf(st))), strokeIdxs: g.map(st => st.idx) });
    }
  }

  // Colon (:) pre-pass — ratios are everyday Year 7-9 material and "3:4" was
  // reading as "3..4" half the time.
  //
  // The general grouper joins strokes by bounding-box RANGE overlap, which is
  // the wrong test for two marks a few pixels across: a colon whose dots sit
  // 4px apart horizontally has boxes that barely intersect, giving an overlap
  // ratio near zero even though the dots are plainly in the same column. For
  // tiny marks it is the distance between CENTRES that means anything.
  for (let ai = 0; ai < strokes.length; ai++) {
    if (used[ai] || !tinyMark(strokes[ai])) continue;
    const A = strokes[ai].box;
    let partner = -1, bestDy = Infinity;
    for (let bi2 = 0; bi2 < strokes.length; bi2++) {
      if (bi2 === ai || used[bi2] || !tinyMark(strokes[bi2])) continue;
      const B = strokes[bi2].box;
      const dx = Math.abs(A.cx - B.cx), dy = Math.abs(A.cy - B.cy);
      if (dx > 0.35 * medianH) continue;          // same column
      if (dy < 0.15 * medianH || dy > 1.1 * medianH) continue;  // stacked, not merged, not a line apart
      if (dy < bestDy) { bestDy = dy; partner = bi2; }
    }
    if (partner === -1) continue;
    // mutual nearest, so a stray third mark cannot capture one of the pair
    let backDy = Infinity, back = -1;
    for (let ci = 0; ci < strokes.length; ci++) {
      if (ci === partner || used[ci] || !tinyMark(strokes[ci])) continue;
      const C = strokes[ci].box, P = strokes[partner].box;
      const dx = Math.abs(P.cx - C.cx), dy = Math.abs(P.cy - C.cy);
      if (dx > 0.35 * medianH) continue;
      if (dy < 0.15 * medianH || dy > 1.1 * medianH) continue;
      if (dy < backDy) { backDy = dy; back = ci; }
    }
    if (back !== ai) continue;
    const g = [strokes[ai], strokes[partner]];
    used[ai] = used[partner] = true;
    groups.push({ strokes: g, box: bbox(g.flatMap(st => ptsOf(st))), strokeIdxs: g.map(st => st.idx) });
  }

  // i-dot pre-pass: a tiny mark hovering just above a non-bar stroke joins it
  // (the dot of an 'i'). Decimal points sit at the baseline, so requiring the
  // dot to be ABOVE the body's top keeps 3.5 and 2:3 untouched.
  for (let di = 0; di < strokes.length; di++) {
    if (used[di] || !tinyMark(strokes[di])) continue;
    const dot = strokes[di];
    let bodyIdx = -1;
    for (let si = 0; si < strokes.length; si++) {
      if (si === di || used[si] || tinyMark(strokes[si]) || standalone[si]) continue;
      const b = strokes[si].box;
      const aboveTop = dot.box.cy < b.y1 + 0.15 * Math.max(b.h, 1);
      const gap = b.y1 - dot.box.y2;
      // Alignment is judged against the body's x-RANGE, not its centre. An
      // i-dot hovers over the stem LINE, and writers drop it beside the stem
      // as often as on it; for a narrow stem a centre-distance test conflates
      // stem width with dot placement and rejects dots a reader attaches
      // without thinking. Distance-to-range also subsumes the old 0.8·w
      // centre allowance for wide bodies (inside the range it is zero), so
      // one tolerance serves every body width.
      const alignedX = Math.max(b.x1 - dot.box.cx, dot.box.cx - b.x2, 0) < 0.35 * medianH;
      if (aboveTop && gap > -0.1 * medianH && gap < 0.55 * medianH && alignedX) {
        if (bodyIdx !== -1) { bodyIdx = -1; break; }   // ambiguous — leave alone
        bodyIdx = si;
      }
    }
    if (bodyIdx !== -1) {
      // never steal the dot from a ':' partner (another tiny mark stacked with it)
      const colonPartner = strokes.some((o, oi) => oi !== di && !used[oi] && tinyMark(o) &&
        Math.abs(o.box.cx - dot.box.cx) < 0.25 * medianH && Math.abs(o.box.cy - dot.box.cy) > 0.15 * medianH);
      if (!colonPartner) {
        const g = [strokes[bodyIdx], dot];
        used[bodyIdx] = used[di] = true;
        groups.push({ strokes: g, box: bbox(g.flatMap(st => ptsOf(st))), strokeIdxs: g.map(st => st.idx) });
      }
    }
  }

  for (let i = 0; i < strokes.length; i++) {
    if (used[i]) continue;
    const g = [strokes[i]];
    used[i] = true;
    if (!standalone[i]) {
      const barBetween = (A, B) => strokes.some((k, ki) =>
        ((standalone[ki] && isBarLike(k)) || barish(k)) &&
        overlap1D(k.box.x1, k.box.x2, A.x1, A.x2) > 0.3 &&
        overlap1D(k.box.x1, k.box.x2, B.x1, B.x2) > 0.3 &&
        k.box.cy > Math.min(A.y2, B.y2) - 1 && k.box.cy < Math.max(A.y1, B.y1) + 1);
      let changed = true;
      while (changed) {
        changed = false;
        const gb = bbox(g.flatMap(s => ptsOf(s)));
        for (let j = 0; j < strokes.length; j++) {
          if (used[j] || standalone[j]) continue;
          const sb = strokes[j].box;
          const xo = overlap1D(gb.x1, gb.x2, sb.x1, sb.x2);
          const yo = overlap1D(gb.y1, gb.y2, sb.y1, sb.y2);
          const vgap = Math.max(gb.y1, sb.y1) - Math.min(gb.y2, sb.y2);
          const close = Math.abs(sb.cx - gb.cx) < 0.7 * Math.max(gb.w, sb.w, 0.4 * medianH);
          const wants = (xo > 0.42 && yo > -0.6) || (close && xo > 0.15 && vgap < 0.75 * medianH);
          const barClash = (() => {
            const sim = [...g, strokes[j]];
            for (const st of sim) {
              if (!barish(st)) continue;
              const above = sim.some(o2 => o2 !== st && !tinyMark(o2) && o2.box.cy < st.box.cy - 0.15 * medianH && o2.box.y2 < st.box.cy + 0.1 * medianH);
              const below = sim.some(o2 => o2 !== st && !tinyMark(o2) && o2.box.cy > st.box.cy + 0.15 * medianH && o2.box.y1 > st.box.cy - 0.1 * medianH);
              if (above && below) return true;
            }
            return false;
          })();
          if (wants && !barClash && !barBetween(gb, sb)) {
            g.push(strokes[j]);
            used[j] = true;
            changed = true;
          }
        }
      }
    }
    groups.push({ strokes: g, box: bbox(g.flatMap(s => ptsOf(s))), strokeIdxs: g.map(s => s.idx) });
  }

  // ── Consolidation rescues: strokes that drifted out of the main grouping ──
  // tolerances (fast, sloppy hands) get re-attached by shape-specific rules.
  const reGroup = (a, b) => {
    const st = [...a.strokes, ...b.strokes];
    return { strokes: st, box: bbox(st.flatMap(s => ptsOf(s))), strokeIdxs: st.map(s => s.idx) };
  };
  const thinbar = (grp) => grp.strokes.length === 1 && grp.box.h < 0.38 * Math.max(grp.box.w, 1);
  const allBarish = (grp) => grp.strokes.every(s => s.box.h < 0.38 * Math.max(s.box.w, 1));
  const tinyGrp = (grp) => Math.max(grp.box.w, grp.box.h) < 0.3 * Math.max(medianH, 8);
  const fracWide = (grp) => grp.box.w > 1.5 * medianH;
  const linear = (s) => {
    const pts = ptsOf(s);
    if (pts.length < 2) return false;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    return chord / Math.max(len, 1e-6) > 0.93;
  };

  // layout operators (fraction bars, radicals) NEVER consolidate — they
  // legitimately contain/span their operands
  const hasLayoutStroke = (grp) => grp.strokes.some(s => isBarLike(s) || isRadical(s));

  // Every consolidation rule below needs the two groups to be near each other —
  // the loosest reaches about half a glyph beyond the boxes. Pairs further
  // apart than this can never merge under any of them, so rejecting them up
  // front costs one subtraction and skips the expensive shape and ink-proximity
  // tests. On a page of working almost every pair is on a different line, and
  // this is what keeps recognition from crawling as the page fills.
  const farApart = (A, B) => {
    const lim = Math.max(2.5 * medianH,
      0.6 * Math.max(A.box.w, A.box.h, B.box.w, B.box.h));
    return (Math.max(A.box.x1, B.box.x1) - Math.min(A.box.x2, B.box.x2)) > lim ||
           (Math.max(A.box.y1, B.box.y1) - Math.min(A.box.y2, B.box.y2)) > lim;
  };

  let changed2 = true;
  let guard = 24;
  while (changed2 && guard--) {
    changed2 = false;
    outer:
    for (let i = 0; i < groups.length; i++) {
      for (let j = 0; j < groups.length; j++) {
        if (i === j) continue;
        const A = groups[i], B = groups[j];
        if (farApart(A, B)) continue;
        if (allBarish(A) && allBarish(B)) continue;            // never build '='
        if (tinyGrp(A) && tinyGrp(B)) continue;                // never build ':'
        let merge = false;

        // A · contained/touching bar: a lone bar whose centre line runs through
        // the body of a taller glyph (θ, t, f, H crossbars) — endpoints touch
        // or overlap the body's box.
        if (!merge && thinbar(A) && !fracWide(A) && !allBarish(B)) {
          const bandTop = B.box.y1 + 0.1 * B.box.h, bandBot = B.box.y2 - 0.1 * B.box.h;
          if (A.box.cy > bandTop && A.box.cy < bandBot && B.box.h > 1.5 * A.box.h) {
            const xo = Math.min(A.box.x2, B.box.x2) - Math.max(A.box.x1, B.box.x1);
            const endTouch = Math.min(
              Math.abs(A.box.x1 - B.box.x2), Math.abs(B.box.x1 - A.box.x2),
              Math.abs(A.box.x1 - B.box.x1), Math.abs(A.box.x2 - B.box.x2)
            ) < 0.18 * medianH;
            if (xo > 0.25 * Math.min(A.box.w, B.box.w) || endTouch) merge = true;
          }
        }

        // B · containment: the smaller box sits inside the larger in both axes
        // (drifted second stroke of k, y, R, x…). Layout operators (radicals,
        // fraction bars) legitimately contain their operands — exempt.
        if (!merge && !hasLayoutStroke(A) && !hasLayoutStroke(B)) {
          const xo = overlap1D(A.box.x1, A.box.x2, B.box.x1, B.box.x2);
          const yo = overlap1D(A.box.y1, A.box.y2, B.box.y1, B.box.y2);
          if (xo > 0.65 && yo > 0.42 && !fracWide(A) && !fracWide(B)) merge = true;
        }

        // C · underside legs: strokes hanging directly off a short bar's belly
        // (π, T) — tight gap, centred within the bar's span.
        // π's bar is wider than the glyphs around it, so a width cap tuned to
        // spare fraction bars blocks it too. What really separates the two is
        // what sits ABOVE: a fraction bar carries a numerator, π carries
        // nothing. Testing that directly lets the cap open up.
        const nothingAbove = () => !groups.some((C, ci) => ci !== i && ci !== j &&
          C.box.cy < A.box.cy - 0.2 * medianH &&
          overlap1D(A.box.x1, A.box.x2, C.box.x1, C.box.x2) > 0.25);
        if (!merge && thinbar(A) && A.box.w <= 2.0 * medianH && !allBarish(B) && nothingAbove()) {
          const gapV = B.box.y1 - A.box.cy;
          const inSpan = B.box.cx > A.box.x1 - 0.1 * medianH && B.box.cx < A.box.x2 + 0.1 * medianH;
          if (inSpan && gapV > -0.15 * medianH && gapV < 0.3 * medianH) merge = true;
        }

        // D · percent: a long slash-ish stroke with a small round mark near
        // each end, one above centre and one below. All sizes are relative to
        // the SLASH (medianH is per-stroke and lies for 3-stroke glyphs like
        // %). A heavily warped slash bends, so straightness is judged loosely.
        const linearLoose = (s) => {
          const pts = ptsOf(s);
          if (pts.length < 2) return false;
          let len = 0;
          for (let i2 = 1; i2 < pts.length; i2++) len += Math.hypot(pts[i2][0] - pts[i2 - 1][0], pts[i2][1] - pts[i2 - 1][1]);
          const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
          return chord / Math.max(len, 1e-6) > 0.78;
        };
        if (!merge && A.strokes.length <= 2) {
          // the slash is the longest loosely-straight stroke in A
          const cand2 = [...A.strokes].sort((s1, s2) =>
            Math.max(s2.box.w, s2.box.h) - Math.max(s1.box.w, s1.box.h))[0];
          if (cand2 && linearLoose(cand2)) {
            const slashLen = Math.max(cand2.box.w, cand2.box.h);
            const small = (G) => Math.max(G.box.w, G.box.h) < 0.55 * slashLen;
            if (slashLen > 0.9 * medianH && small(B)) {
              const pts = ptsOf(cand2);
              const p0 = pts[0], p1 = pts[pts.length - 1];
              const nearPt = (G, p) => Math.hypot(G.box.cx - p[0], G.box.cy - p[1]) < 0.5 * slashLen;
              if (nearPt(B, p0) || nearPt(B, p1)) {
                // evidence for the OTHER end: a second mark elsewhere, or one
                // already merged into A
                const other = A.strokes.length === 2 || groups.some((C2, ci) => ci !== i && ci !== j && small(C2) &&
                  (nearPt(B, p0) ? nearPt(C2, p1) : nearPt(C2, p0)));
                if (other) merge = true;
              }
            }
          }
        }

        // E · touch-merge: two groups whose ink physically touches are one
        // glyph (H, k, y, R drawn in drifting pieces). Real neighbouring
        // glyphs keep air between them — and if this ever over-merges,
        // splitRetry undoes it with classifier evidence.
        if (!merge && !hasLayoutStroke(A) && !hasLayoutStroke(B)) {
          const W = Math.max(A.box.w, A.box.h, B.box.w, B.box.h);
          if (W < 1.9 * medianH) {
            const gx = Math.max(A.box.x1, B.box.x1) - Math.min(A.box.x2, B.box.x2);
            const gy = Math.max(A.box.y1, B.box.y1) - Math.min(A.box.y2, B.box.y2);
            if (gx < 0.16 * medianH && gy < 0.16 * medianH) {
              // box proximity passed — confirm actual ink proximity
              const ptsA = A.strokes.flatMap(s => ptsOf(s)).filter((_, k2) => k2 % 2 === 0);
              const ptsB = B.strokes.flatMap(s => ptsOf(s)).filter((_, k2) => k2 % 2 === 0);
              const lim = 0.16 * medianH;
              let touch = false;
              for (let a2 = 0; a2 < ptsA.length && !touch; a2++) {
                for (let b2 = 0; b2 < ptsB.length; b2++) {
                  if (Math.abs(ptsA[a2][0] - ptsB[b2][0]) > lim) continue;
                  if (Math.abs(ptsA[a2][1] - ptsB[b2][1]) > lim) continue;
                  touch = true; break;
                }
              }
              if (touch) merge = true;
            }
          }
        }

        if (merge) {
          groups.splice(Math.max(i, j), 1);
          groups.splice(Math.min(i, j), 1, reGroup(A, B));
          changed2 = true;
          break outer;
        }
      }
    }
  }

  return groups.sort((a, b) => a.box.x1 - b.box.x1);
}

// ── Classification: structural ∘ CNN ∘ $P (stock + personal) ────────────────

/** Priors that resolve size-degenerate shapes the CNN can't see (it normalises
 *  scale away): dots, degree marks and full-height circles look identical at
 *  28×28 — relative size on the page tells them apart. */
function sizePrior(sym, relSize) {
  // These were step functions, and the steps were the problem. A degree mark
  // sitting at relSize 0.52 fell off a 30x cliff (1.8 -> 0.06) and lost to '0'
  // even though the net preferred 'deg' — and ordinary glyph-size variation is
  // easily wide enough to walk a symbol across a boundary like that. Ramping
  // between the same anchor values keeps the prior's opinion while making it
  // degrade gracefully instead of falling off an edge.
  const ramp = (v, lo, hi, a, b) =>
    v <= lo ? a : v >= hi ? b : a + (b - a) * ((v - lo) / (hi - lo));
  if (sym === '.') {
    if (relSize < 0.20) return 2.4;
    if (relSize < 0.34) return ramp(relSize, 0.20, 0.34, 2.4, 0.5);
    return ramp(relSize, 0.34, 0.52, 0.5, 0.04);
  }
  if (sym === 'deg') {
    if (relSize < 0.18) return ramp(relSize, 0.10, 0.18, 0.25, 0.4);
    if (relSize < 0.30) return ramp(relSize, 0.18, 0.30, 0.4, 1.8);
    // The plateau must end well before x-height or the 'o' in "cos" is read as
    // a degree mark; the ramp then carries it down instead of a cliff edge.
    if (relSize < 0.42) return 1.8;
    return ramp(relSize, 0.42, 0.62, 1.8, 0.06);
  }
  if (sym === ':') return ramp(relSize, 0.55, 0.72, 1.2, 0.25);
  if (/^[0-9a-zA-Z]$|^pi$|^theta$/.test(sym)) return ramp(relSize, 0.22, 0.34, 0.25, 1);
  return 1;
}

// ── Confidence calibration ───────────────────────────────────────────────────
// The blended score is not a probability — it is a geometric mix of a CNN
// softmax with a template distance — so reporting min(0.99, score·1.35) pinned
// 91% of glyphs at 0.99. That number was honest on average yet nearly useless
// per glyph: it ranked a correct read above a wrong one only 79% of the time.
// Both consumers suffer for it, since the grammar beam decides whether to
// re-decode a line from this value and the UI paints "shaky" glyphs by it.
//
// Two fixes: score SHARE rather than height (a candidate's fraction of the
// leading scores encodes the margin to its rivals, which is what tracks
// correctness), collapsing symbols that share a CNN class first — a '0' whose
// runner-up is its own twin 'o' is not an uncertain glyph, it is a certain
// shape with two readings, and the decoder settles that later — then Platt-
// scale that share back onto the probability axis.
// Measured out of sample: AUROC 0.89 -> 0.94, Brier 0.027 -> 0.023. In practice
// highlighting the least-confident 3% of glyphs now catches half of all
// misreads instead of a third. The distribution barely moves (91% still report
// >= 0.9), so thresholds tuned on the old scale keep their meaning.
const CAL_B = 0.679, CAL_A = 2.259, CAL_K = 3;
function calibrate(q) {
  if (!(q > 1e-6)) return 0.01;
  if (q >= 1 - 1e-6) return 0.99;
  return Math.max(0.01, Math.min(0.99,
    1 / (1 + Math.exp(-(CAL_B + CAL_A * Math.log(q / (1 - q)))))));
}

/** Total score mass among the leading CANDIDATES, merging those that are the
 *  same CNN class (twins are not competitors — a '0' whose runner-up is 'o' is
 *  a certain shape with two readings). Each candidate's confidence is then its
 *  own share of that mass, so the alternatives keep the relative ordering the
 *  beam needs; handing every alternative the leader's share would tell the
 *  decoder they are all equally likely. */
function scoreMass(cand) {
  if (!cand.length) return 0;
  const byClass = new Map();
  for (const c of cand) {
    const k = classOfSymbol(c.sym);
    if (!byClass.has(k)) byClass.set(k, c.score);
  }
  const tops = [...byClass.values()].sort((a, b) => b - a).slice(0, CAL_K);
  return tops.reduce((a, b) => a + b, 0);
}

/** Soft prior over the {k, x} pair alone — every other symbol stays at 1.0.
 *
 *  Both are two-stroke glyphs of the same aspect and ink density, and the
 *  rasteriser deskews away the slant that would otherwise mark the k's stem,
 *  so at 28x28 they are close neighbours. What still separates them is where
 *  the two strokes SIT relative to each other: an x is two diagonals stacked
 *  on the same centre, a k is a stem hard left with its arm off to the right.
 *  Over 1800 held-out samples per symbol the centre offset splits them at
 *  98.4% / 98.9% precision inside the confident bands below; the gap between
 *  the bands is left alone so genuinely ambiguous ink is decided by the ink.
 */
function kxCentreOffset(strokes) {
  if (strokes.length !== 2) return null;
  const b1 = bbox(strokes[0]), b2 = bbox(strokes[1]);
  const all = bbox(strokes.flat());
  if (all.w < 1e-6) return null;
  const pair = [{ box: b1, pts: strokes[0] }, { box: b2, pts: strokes[1] }]
    .sort((a, b) => a.box.cx - b.box.cx);
  const leftStem = pair[0].box.h > 0.78 * all.h &&
    pair[0].box.w / Math.max(pair[0].box.h, 1e-6) < 0.36 &&
    pair[1].box.cx - pair[0].box.cx > 0.25 * all.w;
  if (leftStem) return { k: 2.05, x: 0.58 };
  const d = Math.abs(b1.cx - b2.cx) / all.w;
  if (d >= 0.34) return { k: 1.3, x: 0.75 };
  if (d <= 0.14) return { k: 0.75, x: 1.3 };
  return null;
}

export function classify(group, medianH) {
  const s = structural(group, medianH);
  const strokes = group.strokes.map(strokePts);
  const relSize = Math.max(group.box.w, group.box.h) / Math.max(medianH, 1e-6);
  const kx = kxCentreOffset(strokes);

  // ① neural ensemble on the rendered glyph (28² + 32² votes, deskewed), then
  // corrected by the geometry that render throws away — bow direction and depth
  // for the tall-thin family, absolute size for the o/0/degree/dot family.
  const probs = geomRerank(nnClassify(strokes), strokes, medianH);

  // ② $P against stock + personal templates
  const cloud = cloudOf(strokes);
  const aspect = group.box.w / group.box.h;
  const bestBySym = new Map();
  const consider = (t, discount) => {
    let d = cloudDistance(cloud, t.cloud) * discount;
    const aspLog = Math.abs(Math.log((aspect + 0.05) / (t.aspect + 0.05)));
    d += 0.06 * Math.min(2.2, aspLog);
    if (t.nStrokes !== strokes.length) d += 0.035;
    const cur = bestBySym.get(t.sym);
    if (cur === undefined || d < cur.d) bestBySym.set(t.sym, { d, personal: discount < 1 });
  };
  for (const t of TEMPLATE_CLOUDS) consider(t, 1);
  for (const t of getPersonalClouds()) consider(t, 0.75);   // your handwriting outranks stock

  // ③ blend into per-symbol scores
  const blend = (P) => {
    const out = [];
    for (const [sym, { d, personal }] of bestBySym) {
      const cls = classOfSymbol(sym);
      const ci = CLASS_INDEX[cls];
      const cnnP = ci !== undefined ? P[ci] : 0.001;
      const tmpl = 1 / (1 + 8 * d);
      let score = Math.pow(cnnP + 0.015, 0.62) * Math.pow(tmpl + 0.02, 0.38) * sizePrior(sym, relSize);
      if (kx && (sym === 'k' || sym === 'x')) score *= kx[sym];
      if (personal && d < 0.3) score *= 1.6;               // strong learned match
      out.push({ sym, score, cnnP, tmpl, d });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };
  const cand = blend(probs);

  // ④ NO test-time augmentation — measured, not assumed, and measured twice.
  // A rotation vote used to run for glyphs scoring under 0.35. Two things were
  // wrong with it. The trigger fired on 0.5% of glyphs, because this classifier
  // is confidently wrong far more often than it is unsure (a wrong glyph's
  // median top score is 0.67), so it was very nearly dead code. And the
  // augmentation does not work: across held-out glyphs rendered 16 ways —
  // rotations, aspect stretches, brush weights, shears — no fusion beat plain
  // inference by more than noise, and the shipped rot±0.07 vote scored BELOW
  // plain. The cause is that the nets were trained through this same deskewing
  // rasteriser on style-varied renders, so these are the very axes training
  // already made them invariant to; averaging over an invariance only adds
  // variance.
  //
  // The obvious repair — keep the averaging but spend it only where the
  // ensemble is unsure — was built and measured here: five aug.js views at
  // strength 0.35, log-averaged with the plain pass, re-ranked on the raw ink,
  // fired on the least-confident glyphs by calibrated share. It is genuinely
  // better AT CLASSIFYING. Gated to the least-confident ~4%, heavily distorted
  // symbols go 96.3% -> 96.5% (96.6% if the average is only accepted when it
  // sharpens the decision) and the messy scenes 14/15 -> 15/15, for ~77ms on
  // each glyph that trips the gate and nothing on the rest.
  //
  // It still does not ship, because the LINE suite pays for it: 93.3% -> 92.9%
  // exact and 97.9% -> 97.4% chars, at every gate loose enough to fire on more
  // than half a per cent of glyphs. Confidence is not only an answer here — it
  // drives mergeRetry, splitRetry and the beam's candidate lists — so a
  // classifier that is better in isolation and reports different confidence is
  // not automatically a better RECOGNISER. Isolated-glyph accuracy is the
  // metric that does not matter; the line is what the student sees.

  // symbol-level alts, class members expanded with the maths-prior first
  const mass = scoreMass(cand);
  const alts = [];
  const seen = new Set();
  for (const c of cand) {
    const members = symbolsOfClass(classOfSymbol(c.sym));
    const ordered = members[0] === c.sym ? members : [c.sym, ...members.filter(m => m !== c.sym)];
    for (const m of ordered) {
      const display = m === defaultSymbol(classOfSymbol(m)) || members.length === 1 ? m : m;
      if (seen.has(display)) continue;
      seen.add(display);
      alts.push({ sym: display, conf: Math.round(100 * calibrate(mass > 1e-9 ? c.score / mass : 0)) / 100 });
      if (alts.length >= 6) break;
    }
    if (alts.length >= 6) break;
  }

  if (s) {
    return { sym: s.sym, conf: s.conf, alts: [{ sym: s.sym, conf: s.conf }, ...alts.filter(a => a.sym !== s.sym)].slice(0, 5) };
  }
  const primary = alts[0] || { sym: '?', conf: 0.01 };
  return { sym: primary.sym, conf: primary.conf, alts: alts.slice(0, 5) };
}

// ── Layout: lines, fractions, roots, exponents ───────────────────────────────

function splitLines(symbols) {
  if (!symbols.length) return [];
  const n = symbols.length;
  const medianH = median(symbols.map(s => Math.max(s.box.h, s.box.w * 0.5))) || 20;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a, b) => { parent[find(a)] = find(b); };

  const yOver = (A, B) => Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1);
  const xGap = (A, B) => Math.max(A.x1, B.x1) - Math.min(A.x2, B.x2);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = symbols[i].box, B = symbols[j].box;
      const yo = yOver(A, B);
      const bandOverlap = yo > 0.3 * Math.min(A.h, B.h) || yo > 0.35 * medianH;
      const adjacent = xGap(A, B) < 1.1 * medianH && Math.min(Math.abs(A.y1 - B.y2), Math.abs(B.y1 - A.y2)) < 0.5 * medianH;
      if (bandOverlap || (adjacent && yo > -0.5 * medianH)) union(i, j);
    }
  }

  for (let i = 0; i < n; i++) {
    const s = symbols[i];
    if (s.sym !== '-' || s.box.w < 1.35 * medianH) continue;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const o = symbols[j];
      const xo = overlap1D(s.box.x1, s.box.x2, o.box.x1, o.box.x2);
      const vDist = Math.abs(o.box.cy - s.box.cy);
      if (xo > 0.4 && vDist < 2.4 * medianH) union(i, j);
    }
  }
  for (let i = 0; i < n; i++) {
    const s = symbols[i];
    if (s.sym !== 'sqrt') continue;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const o = symbols[j];
      if (o.box.cx > s.box.x1 && o.box.cx < s.box.x2 + 0.4 * medianH && o.box.cy > s.box.y1 - 0.4 * medianH && o.box.y1 < s.box.y2 + 0.8 * medianH) union(i, j);
    }
  }

  const byRoot = new Map();
  symbols.forEach((s, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(s);
  });
  return [...byRoot.values()]
    .sort((a, b) => median(a.map(s => s.box.cy)) - median(b.map(s => s.box.cy)))
    .map(l => l.sort((a, b) => a.box.x1 - b.box.x1));
}

const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const OUT = { pi: 'pi', theta: 'theta', sqrt: 'sqrt', percent: '%', div: '/', pm: '±', deg: '°' };
const printable = sym => OUT[sym] || sym;

const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cosec', 'cot', 'ln', 'log', 'LHS', 'RHS']);

/** Assemble one line of symbols (already x-sorted) into a maths string. */
function assembleLine(syms) {
  const medH = median(syms.map(s => s.box.h)) || 20;

  const isFracBar = (s, all) => {
    if (s.sym !== '-') return false;
    if (s.box.w < 1.35 * medH) return false;
    const above = all.some(o => o !== s && o.box.cy < s.box.cy - 2 && overlap1D(s.box.x1, s.box.x2, o.box.x1, o.box.x2) > 0.5);
    const below = all.some(o => o !== s && o.box.cy > s.box.cy + 2 && overlap1D(s.box.x1, s.box.x2, o.box.x1, o.box.x2) > 0.5);
    return above && below;
  };

  const bars = syms.filter(s => isFracBar(s, syms)).sort((a, b) => b.box.w - a.box.w);
  if (bars.length) {
    const bar = bars[0];
    const inSpan = o => overlap1D(bar.box.x1, bar.box.x2, o.box.x1, o.box.x2) > 0.35 ||
      (o.box.cx > bar.box.x1 - 0.2 * medH && o.box.cx < bar.box.x2 + 0.2 * medH);
    const above = syms.filter(o => o !== bar && inSpan(o) && o.box.cy < bar.box.cy);
    const below = syms.filter(o => o !== bar && inSpan(o) && o.box.cy > bar.box.cy);
    const left = syms.filter(o => o !== bar && !above.includes(o) && !below.includes(o) && o.box.cx <= bar.box.x1);
    const right = syms.filter(o => o !== bar && !above.includes(o) && !below.includes(o) && o.box.cx >= bar.box.x2);
    if (above.length && below.length) {
      const num = assembleLine(above);
      const den = assembleLine(below);
      return `${left.length ? assembleLine(left) + ' ' : ''}(${num})/(${den})${right.length ? ' ' + assembleLine(right) : ''}`.trim();
    }
  }

  const rad = syms.find(s => s.sym === 'sqrt');
  if (rad) {
    const inside = syms.filter(o => o !== rad && o.box.cx > rad.box.x1 + 0.15 * rad.box.w && o.box.cx < rad.box.x2 + 0.15 * medH && o.box.cy > rad.box.y1 - 0.3 * medH);
    const rest = syms.filter(o => o !== rad && !inside.includes(o));
    const before = rest.filter(o => o.box.cx < rad.box.cx);
    const after = rest.filter(o => o.box.cx >= rad.box.cx);
    const innerStr = inside.length ? assembleLine(inside) : '';
    return `${before.length ? assembleLine(before) + ' ' : ''}sqrt(${innerStr || '?'})${after.length ? ' ' + assembleLine(after) : ''}`.trim();
  }

  let out = '';
  let prev = null;
  // A decimal point sits on the baseline with almost no height, which makes it
  // a hopeless reference for "is the next glyph raised?" — every digit after
  // one measured as a superscript, turning 68.6 into 68.^(6). Rises are judged
  // against the last full-height glyph instead.
  let baseRef = null;
  let expRun = [];
  let funcClose = 0;      // pending ')' after a function name
  let argEmitted = false; // has the function received its argument yet?
  const flushExp = () => {
    if (expRun.length) {
      const inner = expRun.map(e => printable(e.sym)).join('');
      out += `^(${inner})`;
      expRun = [];
    }
  };
  for (let i = 0; i < syms.length; i++) {
    const s = syms[i];
    const ref = baseRef || prev;
    const small = ref && Math.max(s.box.h, s.box.w) < 0.75 * Math.max(ref.box.h, ref.box.w);
    const raised = ref && s.box.cy < ref.box.cy - 0.3 * ref.box.h && s.box.y2 < ref.box.cy + 0.15 * ref.box.h;
    const isDigitOrVar = /^[0-9xyabcdekmnrstuvzoglihfwpq]$|^pi$|^theta$/.test(s.sym);
    const prevCat = prev ? catOf(prev.sym) : null;
    const prevCanHaveExponent = prevCat === 'd' || prevCat === 'v' || prevCat === 'c' || prevCat === ')' || prevCat === 'p';
    if (prevCanHaveExponent && prev.sym !== '.' && raised && (small || isDigitOrVar) && s.sym !== '-' && s.sym !== '.' && s.sym !== 'deg' && !RELATIONAL.has(s.sym) && !FUNC_NAMES.has(s.sym)) {
      expRun.push(s);
      continue;
    }
    flushExp();
    // the function argument (plus its exponent run) is complete — close it
    if (funcClose > 0 && argEmitted) { out += ')'.repeat(funcClose); funcClose = 0; argEmitted = false; }

    if (FUNC_NAMES.has(s.sym)) {
      out += s.sym === 'cosec' ? 'csc' : s.sym;
      if (s.sym !== 'LHS' && s.sym !== 'RHS') {
        const next = syms[i + 1];
        if (next && next.sym !== '(') { out += '('; funcClose++; argEmitted = false; }
      }
      prev = s;
      continue;
    }

    let ch = printable(s.sym);
    if (s.sym === 'x') {
      const prevCh = prev?.sym, nextCh = syms[i + 1]?.sym;
      if (/^[0-9.]$/.test(prevCh || '') && /^[0-9.]$/.test(nextCh || '')) ch = '*';
    }
    out += ch;
    if (funcClose > 0) argEmitted = true;
    prev = s;
    if (s.box.h >= 0.45 * medH) baseRef = s;   // full-height glyphs set the baseline
  }
  flushExp();
  if (funcClose > 0) out += ')'.repeat(funcClose);
  return out;
}

// ── Math-language decode ─────────────────────────────────────────────────────

// Words the decoder can lock (longest first). Lowercase; caps resolved after.
const FUNC_WORDS = ['cosec', 'sec', 'csc', 'sin', 'cos', 'tan', 'cot', 'log', 'lhs', 'rhs', 'ln'];

/** The only digits that may stand in for a letter of a function name — they are
 *  the genuine pixel-identical class twins. */
const LETTER_TWIN = { l: '1', o: '0' };

/** Relations and operators. Nothing here can be a function's argument or sit in
 *  an exponent: "ln(=)1" and "a^(=)3.6" are not readings a student ever meant,
 *  they are a construct swallowing the operator that was supposed to end it. */
const RELATIONAL = new Set(['=', '+', '<', '>', '<=', '>=', '!=', 'div', '/', ':',
  'percent', '%', 'pm', ')']);

/** Whether a glyph may fill the slot for `want` in a function name.
 *  Alternatives alone are far too permissive: a bracket and a 3 both reach 'l'
 *  through the 1l class, and one real letter beside them was enough to anchor a
 *  whole name — turning the very common "3(n-5)" into "3ln(-)5)" and "3n+23"
 *  into "ln(+)23". The glyph's PRIMARY reading must itself be a letter (a real
 *  letter-for-letter confusion) or that letter's exact twin. The degree mark
 *  counts as o's twin too: deg, o and 0 are the size-degenerate triple the
 *  degree machinery itself documents as "the same picture", and a cos whose o
 *  sat slightly high was read c°s — un-lockable under the letter-only rule. */
const canFillLetter = (primSym, want) =>
  /^[a-zA-Z]$/.test(primSym) || LETTER_TWIN[want] === primSym ||
  (want === 'o' && primSym === 'deg');

/** All letters a symbol could plausibly be (primary + alts + class twins). */
function letterCandidates(sym) {
  const set = new Map();
  const add = (ch, conf) => {
    const lc = ch.toLowerCase();
    if (!/^[a-z]$/.test(lc)) return;
    if (!set.has(lc) || set.get(lc) < conf) set.set(lc, conf);
  };
  add(sym.sym, sym.conf);
  for (const m of symbolsOfClass(classOfSymbol(sym.sym))) add(m, sym.conf * 0.92);
  for (const a of sym.alts || []) {
    add(a.sym, a.conf);
    for (const m of symbolsOfClass(classOfSymbol(a.sym))) add(m, a.conf * 0.92);
  }
  return set;
}

/** Lock function names / LHS / RHS across a line of symbols. */
function decodeFunctions(line, medianH) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    let bestWord = null, bestScore = 0, bestLen = 0;
    const cands = [];
    // gather per-position letter candidate maps for a window
    for (let k = 0; k < 5 && i + k < line.length; k++) {
      const s = line[i + k];
      // function letters sit on the baseline together — reject raised/sunken or distant glyphs
      if (k > 0) {
        const p = line[i + k - 1];
        const gap = s.box.x1 - p.box.x2;
        if (gap > 1.45 * medianH) break;
        if (Math.abs(s.box.cy - p.box.cy) > 0.6 * medianH) break;
      }
      cands.push(letterCandidates(s));
    }
    for (const word of FUNC_WORDS) {
      if (word.length > cands.length) continue;
      // an "anchor" is a position whose PRIMARY reading already is this
      // letter — digits reachable only via class twins (1→l, 0→o) never
      // anchor, so "10" can't become "ln". Anchors are counted up front:
      // they are the licence for the concessions below.
      let exactLetters = 0;
      for (let k = 0; k < word.length; k++) {
        const prim = line[i + k].sym;
        if (/^[a-zA-Z]$/.test(prim) && prim.toLowerCase() === word[k]) exactLetters++;
      }
      let score = 0, ok = true, loose = 0;
      for (let k = 0; k < word.length; k++) {
        const conf = cands[k].get(word[k]);
        if (conf === undefined) { ok = false; break; }
        const s = line[i + k];
        if (!canFillLetter(s.sym, word[k])) {
          // One stand-in slot is tolerated when at least TWO other positions
          // spell the word exactly — the neighbours have already done the
          // spelling, and the slot itself must be the classifier's real
          // second reading of the ink (its own alts list, not a class-twin
          // expansion). A wobbled cos whose s came back '/' carries s at
          // 0.13 there; junk tail entries sit at 0.01, and the 0.06 floor is
          // the same "considerable alternative" cutoff the grammar beam
          // uses. Words a single letter anchors — the "3(n-5)"→"3ln(-)5)"
          // family — never qualify this way.
          const alt = (s.alts || []).find(a => a.sym.toLowerCase() === word[k]);
          const considerable = alt && alt.conf >= 0.06;
          // Second licence, for 'l' only: a bare '(' is the one bracket
          // reading that is pixel-close to the l-stick (the twin table
          // cannot carry it because a REAL bracket must stay a bracket).
          // What separates the two is structural, not shape: a real bracket
          // has a mate. Consuming this '(' into a word is allowed only when
          // no ')' in the line is left stranded by it — "3(n-5)" keeps its
          // bracket, a slanted "ln x" gets its word.
          const bracketFree = s.sym === '(' && word[k] === 'l' &&
            line.filter(o => o.sym === '(').length - 1 >= line.filter(o => o.sym === ')').length;
          if (loose === 0 && considerable && (exactLetters >= 2 || bracketFree)) { loose = 1; }
          else { ok = false; break; }
        }
        score += conf;
      }
      if (!ok || exactLetters === 0) continue;
      score /= word.length;
      const exactEnough = exactLetters >= Math.ceil(word.length / 2);
      if (exactEnough || score >= 0.45) {
        if (word.length > bestLen || (word.length === bestLen && score > bestScore)) {
          bestWord = word; bestScore = score; bestLen = word.length;
        }
      }
    }
    // A function needs something it can actually take as an argument. If the
    // next glyph is a relation or operator this was never a function name —
    // "1n=…" locking as "ln" then wrapping "=" gave "ln(=)1±1".
    if (bestWord && bestWord !== 'lhs' && bestWord !== 'rhs') {
      const next = line[i + bestWord.length];
      if (!next || RELATIONAL.has(next.sym)) bestWord = null;
      // A coefficient-variable term like "1n-8" is common school algebra.
      // If the leading stick's primary reading is the digit 1, and the would-be
      // function is followed by a subtraction operator, do not promote it to
      // ln(-8). Actual ln(-8) still carries an explicit '(' after the name.
      if (bestWord === 'ln' && next?.sym === '-') {
        bestWord = null;
      }
    }
    if (bestWord) {
      const parts = line.slice(i, i + bestWord.length);
      const boxes = parts.map(p => p.box);
      const name = bestWord === 'lhs' ? 'LHS' : bestWord === 'rhs' ? 'RHS' : bestWord;
      out.push({
        id: parts[0].id,
        sym: name, conf: Math.min(0.99, bestScore + 0.2),
        alts: [{ sym: name, conf: Math.min(0.99, bestScore + 0.2) }],
        composite: parts.map(p => ({ sym: p.sym, id: p.id })),
        box: {
          x1: Math.min(...boxes.map(b => b.x1)), y1: Math.min(...boxes.map(b => b.y1)),
          x2: Math.max(...boxes.map(b => b.x2)), y2: Math.max(...boxes.map(b => b.y2)),
          get w() { return this.x2 - this.x1; }, get h() { return this.y2 - this.y1; },
          get cx() { return (this.x1 + this.x2) / 2; }, get cy() { return (this.y1 + this.y2) / 2; }
        },
        strokeIdxs: parts.flatMap(p => p.strokeIdxs)
      });
      i += bestWord.length;
    } else {
      out.push(line[i]);
      i++;
    }
  }
  return out;
}

/** Degree mark: a small closed loop RIDING HIGH over the line, after a value.
 *
 *  The rasteriser normalises scale and position away, so at 28×28 a degree
 *  mark, a letter o and a zero are the same picture — the classifier is being
 *  asked a question its input cannot answer. What separates them is where the
 *  glyph sits in the line: a degree mark's *bottom* is up near the middle of
 *  the x-height band, while an o or a 0 (or a decimal point) rests on the
 *  baseline. Measured over ~7 200 glyphs of held-out lines the two populations
 *  do not overlap — the bottom of a degree mark reaches at most 52% of the way
 *  down the cap-to-baseline band, and the 2nd percentile for o / 0 / '.' is
 *  66%. At the 58% cut the rule fired 111 times, every one of them a real
 *  degree mark, and caught 87% of them.
 */
function degreeMarkPass(line, medianH) {
  if (line.length < 2) return line;
  const full = line.filter(s => s.box.h >= 0.55 * medianH);
  if (!full.length) return line;
  const top = median(full.map(s => s.box.y1));
  const base = median(full.map(s => s.box.y2));
  const band = base - top;
  if (band < 1e-6) return line;

  for (let i = 0; i < line.length; i++) {
    const s = line[i];
    if (s.composite) continue;
    // …and the same measurement run backwards. A ring resting ON the baseline
    // is not a degree mark whatever its size says — over 600 real degree marks
    // the lowest any of them reached was 0.67 of the band, while the o in a
    // small "cos" reaches 0.92. Without this the size-only degree rule turns
    // cos into c°s and the function-name decoder loses the word.
    if (s.sym === 'deg') {
      if ((s.box.y2 - top) / band > 0.72) {
        const alt = (s.alts || []).find(a => a.sym !== 'deg');
        s.sym = alt ? alt.sym : '0';
        s.conf = alt ? alt.conf : 0.3;
        s.alts = (s.alts || []).filter(a => a.sym !== 'deg');
      }
      continue;
    }
    const g = s._group;
    if (!g || g.strokes.length !== 1) continue;
    const b = s.box;
    const size = Math.max(b.w, b.h);
    const rel = size / medianH;
    // The window is only a coarse pre-filter — the band test below is the
    // measured discriminator — so it must exclude only what could never be a
    // ring. Measured over 176 dev-writer degree marks the ring spans
    // 0.19–0.72 of medianH (p98 0.70); the competing populations are held
    // out by the other gates, not by size: decimal dots top out at 0.18 AND
    // sit at ≥0.72 of the band, digit 0s start at 0.79 AND sit at ≥0.62.
    // The old [0.2, 0.62] cut off both tails of the deg population itself —
    // a large-ringed hand at 0.65 read "86°" as "860", a small-ringed one
    // at 0.19 read "38°" as "38.".
    if (rel < 0.15 || rel > 0.72) continue;              // speck, or digit-sized
    if ((b.y2 - top) / band > 0.58) continue;            // sits on the baseline
    if (b.h < 0.5 * b.w || b.w < 0.5 * b.h) continue;    // must be roundish
    const pts = strokePts(g.strokes[0]);
    if (pts.length < 5) continue;
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    // must come back on itself — a loop, not a tick. Fast writers rarely
    // close the ring exactly, so the endpoint gap is generous and the real
    // work of rejecting open arcs is done by the path-length test.
    if (chord > 0.72 * size) continue;
    if (pathLen(pts) < 1.6 * size) continue;

    // A degree mark measures something to its left, and carries nothing under
    // it — that rules out a stacked fraction's numerator and a dotted i whose
    // stem drifted into its own group.
    let anchored = false, clear = true;
    for (let j = 0; j < line.length && clear; j++) {
      if (j === i) continue;
      const o = line[j].box;
      if (o.x2 <= b.x1 + 0.25 * medianH && o.h >= 0.55 * medianH) anchored = true;
      const xo = Math.min(o.x2, b.x2) - Math.max(o.x1, b.x1);
      if (xo > 0.4 * Math.min(o.w, b.w) && o.y1 > b.y2 - 0.1 * medianH) clear = false;
      // Range overlap is meaningless for marks a few pixels wide (the colon
      // pre-pass lesson): the lower dot of an ungrouped ':' sits plainly in
      // the upper dot's column while their boxes barely intersect. Centre
      // distance is the test that means something at that size — without it
      // the widened window would promote the top dot of a failed ':'.
      if (Math.abs(o.cx - b.cx) < 0.35 * medianH && o.cy > b.cy + 0.15 * medianH) clear = false;
    }
    if (!anchored || !clear) continue;

    s.sym = 'deg';
    s.conf = Math.max(s.conf, 0.9);
    s.alts = [{ sym: 'deg', conf: 0.9 }, ...(s.alts || []).filter(a => a.sym !== 'deg')].slice(0, 5);
  }
  return line;
}

/** Last look at line context that is stronger than any single glyph:
 *  - a leading slash before a value has no left operand, so in school algebra
 *    it is a slanted coefficient 1;
 *  - a small high ring after a number is a degree mark even when the class
 *    decoder kept the size-degenerate 0/o reading.
 */
function mathContextPass(line, medianH) {
  if (!line.length) return line;
  const valueAfter = s => s && (/^[0-9a-zA-Z]$/.test(s.sym) || s.sym === '(' || FUNC_NAMES.has(s.sym));
  const canStartValue = (prev) => !prev || catOf(prev.sym) === 'o' || catOf(prev.sym) === 'r' || prev.sym === '(';
  for (let i = 0; i < line.length; i++) {
    const s = line[i];
    if (s.composite) continue;
    if (s.sym === '/' && canStartValue(line[i - 1]) && valueAfter(line[i + 1])) {
      const oneAlt = (s.alts || []).find(a => a.sym === '1' || a.sym === 'l');
      s.sym = '1';
      s.conf = Math.max(oneAlt?.conf || 0.55, Math.min(s.conf, 0.82));
      s.alts = [{ sym: '1', conf: s.conf }, ...(s.alts || []).filter(a => a.sym !== '1')].slice(0, 5);
    }
  }

  if (line.length < 2) return line;
  const full = line.filter(s => s.box.h >= 0.55 * medianH);
  if (!full.length) return line;
  const top = median(full.map(s => s.box.y1));
  const base = median(full.map(s => s.box.y2));
  const band = base - top;
  if (band < 1e-6) return line;
  for (let i = 1; i < line.length; i++) {
    const s = line[i], prev = line[i - 1];
    if (s.composite || !/^[0-9]$/.test(prev.sym)) continue;
    const degAlt = (s.alts || []).find(a => a.sym === 'deg');
    if (!(s.sym === '0' || s.sym === 'o' || s.sym === 'deg' || degAlt)) continue;
    const b = s.box;
    const size = Math.max(b.w, b.h);
    if (size > 0.78 * medianH) continue;
    const strongDegAlt = degAlt && degAlt.conf >= 0.10 && i === line.length - 1;
    if ((b.y2 - top) / band > (strongDegAlt ? 0.82 : 0.70)) continue;
    if (b.h < 0.45 * b.w || b.w < 0.45 * b.h) continue;
    const g = s._group;
    if (!g || g.strokes.length !== 1) continue;
    const pts = strokePts(g.strokes[0]);
    if (pts.length < 5) continue;
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    if (chord > (strongDegAlt ? 1.05 : 0.86) * size) continue;
    if (pathLen(pts) < (strongDegAlt ? 1.10 : 1.35) * size) continue;
    s.sym = 'deg';
    s.conf = Math.max(s.conf, 0.9);
    s.alts = [{ sym: 'deg', conf: 0.9 }, ...(s.alts || []).filter(a => a.sym !== 'deg')].slice(0, 5);
  }
  return line;
}

/** After a relation, many generated school answers are numeric. If the whole
 *  right-hand side is already digit-like except for one classic letter-shaped
 *  digit, let the candidate list settle it locally. This deliberately excludes
 *  free-standing expression variables: "x-h" can really be a variable, while a
 *  fully numeric answer like "...=6h" with h's own 6 alternative is almost
 *  always a wobbled 66.
 */
function rhsNumericPass(line) {
  const rel = line.findIndex(s => catOf(s.sym) === 'r');
  if (rel < 0 || rel >= line.length - 1) return line;
  const rhs = line.slice(rel + 1);
  const digitTwin = { c: '6', h: '6', z: '2' };
  const threshold = { c: 0.15, h: 0.015, z: 0.08 };
  const isNumericLike = s => /^[0-9]$/.test(s.sym) || ['.', '/', '-', 'pm', '±'].includes(s.sym) ||
    (digitTwin[s.sym] && (s.alts || []).some(a => a.sym === digitTwin[s.sym] && a.conf >= threshold[s.sym]));
  if (!rhs.every(isNumericLike)) return line;
  for (let i = rel + 1; i < line.length; i++) {
    const s = line[i];
    const twin = digitTwin[s.sym];
    if (!twin || s.composite) continue;
    const alt = (s.alts || []).find(a => a.sym === twin);
    if (!alt || alt.conf < threshold[s.sym]) continue;
    const prev = line[i - 1]?.sym, next = line[i + 1]?.sym;
    if (!(/^[0-9/]$/.test(prev || '') || /^[0-9/]$/.test(next || ''))) continue;
    s.sym = twin;
    s.conf = Math.max(s.conf, alt.conf);
    s.alts = [{ sym: twin, conf: s.conf }, ...(s.alts || []).filter(a => a.sym !== twin)].slice(0, 5);
  }
  return line;
}

/** Inside a recovered arithmetic factor, a single looped 6 can look like h.
 *  Only make the rewrite when the expression slot is numeric and the glyph
 *  itself keeps 6 in close contention.
 */
function parenthesizedDigitPass(line) {
  for (let i = 1; i < line.length - 1; i++) {
    const s = line[i];
    if (s.sym !== 'h' || s.composite) continue;
    if (catOf(line[i - 1].sym) !== 'o' || line[i + 1].sym !== ')') continue;
    let open = -1;
    for (let j = i - 2; j >= 0; j--) {
      if (line[j].sym === ')') break;
      if (line[j].sym === '(') { open = j; break; }
    }
    if (open < 0) continue;
    const alt = (s.alts || []).find(a => a.sym === '6');
    if (!alt || alt.conf < 0.45) continue;
    s.sym = '6';
    s.conf = Math.max(s.conf, alt.conf);
    s.alts = [{ sym: '6', conf: s.conf }, ...(s.alts || []).filter(a => a.sym !== '6')].slice(0, 5);
  }
  return line;
}

/** Percent can miss the early three-stroke grouping and surface as °/0. The
 *  shape is still unambiguous when it sits immediately after a number: a small
 *  upper ring, a steep slash, and a small lower ring in one compact cluster.
 */
function percentContextPass(line, medianH) {
  if (line.length < 4) return line;
  const out = [...line];
  const ring = s => s && !s.composite && ['deg', '0', 'o'].includes(s.sym) &&
    Math.max(s.box.w, s.box.h) < 0.64 * medianH;
  const slash = s => s && !s.composite && s.sym === '/' && s._group && s._group.strokes.length === 1 &&
    s.box.h > 0.85 * Math.max(s.box.w, 1e-6);
  for (let i = 1; i < out.length - 2; i++) {
    const prev = out[i - 1], top = out[i], mid = out[i + 1], bot = out[i + 2];
    if (!/^[0-9]$/.test(prev.sym) || !ring(top) || !slash(mid) || !ring(bot)) continue;
    if (bot.box.cy - top.box.cy < 0.35 * medianH) continue;
    const clusterW = Math.max(top.box.x2, mid.box.x2, bot.box.x2) - Math.min(top.box.x1, mid.box.x1, bot.box.x1);
    const clusterH = Math.max(top.box.y2, mid.box.y2, bot.box.y2) - Math.min(top.box.y1, mid.box.y1, bot.box.y1);
    if (clusterW > 1.8 * medianH || clusterH > 1.8 * medianH) continue;
    if (top.box.cx > bot.box.cx + 0.25 * medianH) continue;
    const strokes = [...top._group.strokes, ...mid._group.strokes, ...bot._group.strokes];
    const merged = { strokes, box: bbox(strokes.flatMap(strokePts)), strokeIdxs: [...top.strokeIdxs, ...mid.strokeIdxs, ...bot.strokeIdxs] };
    out.splice(i, 3, {
      id: top.id, sym: 'percent', conf: 0.94,
      alts: [{ sym: 'percent', conf: 0.94 }, { sym: 'deg', conf: 0.2 }],
      box: merged.box, strokeIdxs: merged.strokeIdxs, _group: merged, _geo: true
    });
    break;
  }
  return out;
}

/** A pair of parentheses is often more legible from the line than from either
 *  stroke alone: a thin "(" can classify as 1/c/<, and a thin ")" as 1 or /.
 *  Only rewrite a matched pair around a small additive group, with visible air
 *  on both sides, so ordinary inequalities and coefficient-variable terms keep
 *  their literal reading.
 */
function bracketContextPass(line, medianH) {
  if (line.length < 4) return line;
  const out = [...line];
  const altConf = (s, sym) => (s.alts || []).find(a => a.sym === sym)?.conf || 0;
  const valueish = s => s && (/^[0-9a-zA-Z]$/.test(s.sym) || FUNC_NAMES.has(s.sym));
  const boundaryAfter = s => !s || s.sym === '(' || catOf(s.sym) === 'o' || catOf(s.sym) === 'r' || catOf(s.sym) === 'p';
  const narrowCurve = (s) => {
    if (s.composite || !s._group || s._group.strokes.length !== 1) return false;
    const asp = s.box.w / Math.max(s.box.h, 1e-6);
    if (asp > 0.75) return false;
    const pts = strokePts(s._group.strokes[0]);
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    return lineFitDeviation(pts) > 0.10 || chord / Math.max(pathLen(pts), 1e-6) < 0.92;
  };
  const openScore = s => {
    if (!s || s.composite) return 0;
    if (s.sym === '(') return 1;
    const alt = altConf(s, '(');
    if (altConf(s, ')') >= 0.20 && alt < altConf(s, ')')) return 0;
    if (alt >= 0.06) return alt;
    return (['1', 'l', 'c'].includes(s.sym) && narrowCurve(s)) ? 0.12 : 0;
  };
  const closeScore = s => {
    if (!s || s.composite) return 0;
    if (s.sym === ')') return 1;
    const alt = altConf(s, ')');
    if (alt >= 0.06) return alt;
    return (['1', 'l', '/', '>'].includes(s.sym) && narrowCurve(s)) ? 0.10 : 0;
  };
  const airBefore = i => i <= 0 || closeScore(out[i - 1]) >= 0.08 || out[i].box.x1 - out[i - 1].box.x2 > 0.32 * medianH;
  const airAfter = i => i >= out.length - 1 || openScore(out[i + 1]) >= 0.06 || out[i + 1].box.x1 - out[i].box.x2 > 0.32 * medianH;
  const setSym = (s, sym, conf) => {
    if (s.sym === sym) return;
    s.sym = sym;
    s.conf = Math.max(conf, 0.86);
    s.alts = [{ sym, conf: s.conf }, ...(s.alts || []).filter(a => a.sym !== sym)].slice(0, 5);
    s._geo = true;
  };
  const hookedSeven = (s) => {
    const alt = altConf(s, '7');
    if (!alt || alt < 0.45 * (s.conf || 1)) return false;
    if (!s._group || s._group.strokes.length !== 1) return false;
    const pts = strokePts(s._group.strokes[0]);
    return lineFitDeviation(pts) > 0.22 || Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) / Math.max(pathLen(pts), 1e-6) < 0.72;
  };

  let best = null;
  for (let i = 0; i < out.length - 3; i++) {
    const os = openScore(out[i]);
    if (os < 0.06 || !airBefore(i) || !valueish(out[i + 1])) continue;
    for (let k = i + 3; k < out.length; k++) {
      const cs = closeScore(out[k]);
      if (cs < 0.08 || !airAfter(k) || !boundaryAfter(out[k + 1])) continue;
      if (out[i].sym === '(' && out[k].sym === ')') continue;
      const inside = out.slice(i + 1, k);
      if (inside.some(s => catOf(s.sym) === 'r')) continue;
      if (inside.some(s => s.sym === '(' || s.sym === ')')) continue;
      const op = inside.findIndex((s, j) => (s.sym === '+' || s.sym === '-') && j > 0 && j < inside.length - 1);
      if (op < 0 || !valueish(inside[op - 1]) || !valueish(inside[op + 1])) continue;
      if (os + cs < 0.30) continue;
      const score = os + cs + (i > 0 && /^[0-9)]$/.test(out[i - 1].sym) ? 0.12 : 0);
      if (!best || score > best.score) best = { i, k, os, cs, score };
    }
  }
  if (best) {
    setSym(out[best.i], '(', best.os);
    setSym(out[best.k], ')', best.cs);
    if (best.i > 0 && out[best.i - 1].sym === '1' && hookedSeven(out[best.i - 1])) {
      setSym(out[best.i - 1], '7', altConf(out[best.i - 1], '7'));
    }
    return out;
  }
  return out;
}

/** Segmentation self-repair for ':' — the pre-pass in segment() judges the two
 *  dots against the median of PER-STROKE sizes, and on a short ratio line
 *  ("7:6" is five strokes once the 7 is crossed) the two dots plus the
 *  crossbar hold the median down to a sub-glyph stroke, shrinking every gate
 *  below the colon's real geometry. By the time symbols exist the median over
 *  GROUPS is a reliable glyph height, so the same stacked-in-column test —
 *  same constants as the pre-pass and structural() — is re-run here against
 *  the scale segment() didn't have yet. Nothing else ever reconsiders two
 *  adjacent '.' reads, and '..' is never a reading a student meant. */
function colonRetry(line, medianH) {
  if (line.length < 2) return line;
  const out = [...line];
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1];
    if (a.sym !== '.' || b.sym !== '.') continue;
    if (a.composite || b.composite || !a._group || !b._group) continue;
    const szA = Math.max(a.box.w, a.box.h), szB = Math.max(b.box.w, b.box.h);
    if (szA >= 0.3 * medianH || szB >= 0.3 * medianH) continue;   // dot-sized, as tinyMark
    const dx = Math.abs(a.box.cx - b.box.cx), dy = Math.abs(a.box.cy - b.box.cy);
    if (dx > 0.35 * medianH) continue;                            // same column
    if (dy < 0.15 * medianH || dy > 1.1 * medianH) continue;      // stacked, not merged
    const strokes = [...a._group.strokes, ...b._group.strokes];
    const merged = { strokes, box: bbox(strokes.flatMap(strokePts)), strokeIdxs: [...a.strokeIdxs, ...b.strokeIdxs] };
    out.splice(i, 2, {
      id: a.id, sym: ':', conf: 0.93,
      alts: [{ sym: ':', conf: 0.93 }, { sym: '.', conf: 0.3 }],
      box: merged.box, strokeIdxs: merged.strokeIdxs, _group: merged
    });
  }
  return out;
}

/** Segmentation self-repair for '='. A fast PencilKit pass can leave the two
 *  bars as separate, high-confidence '-' glyphs; confidence-based merge repair
 *  will never touch them because each bar is individually obvious. Geometry is
 *  decisive here: two flat bars, vertically stacked, sharing the same x-span.
 */
function equalsRetry(line, medianH) {
  if (line.length < 2) return line;
  const out = [...line];
  const flatBar = (s) => {
    if (s.sym !== '-' || s.composite || !s._group || s._group.strokes.length !== 1) return false;
    const pts = strokePts(s._group.strokes[0]);
    return flatness(pts) < 0.38 && lineFitDeviation(pts) < 0.14;
  };
  const spansFraction = (a, b) => {
    const bx = {
      x1: Math.min(a.box.x1, b.box.x1), x2: Math.max(a.box.x2, b.box.x2),
      cy: (a.box.cy + b.box.cy) / 2
    };
    const wide = Math.max(a.box.w, b.box.w) > 1.35 * medianH;
    if (!wide) return false;
    const above = out.some(o => o !== a && o !== b && o.box.cy < bx.cy - 0.2 * medianH &&
      overlap1D(bx.x1, bx.x2, o.box.x1, o.box.x2) > 0.35);
    const below = out.some(o => o !== a && o !== b && o.box.cy > bx.cy + 0.2 * medianH &&
      overlap1D(bx.x1, bx.x2, o.box.x1, o.box.x2) > 0.35);
    return above && below;
  };
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1];
    if (!flatBar(a) || !flatBar(b)) continue;
    const xOverlap = overlap1D(a.box.x1, a.box.x2, b.box.x1, b.box.x2);
    const dx = Math.abs(a.box.cx - b.box.cx);
    const dy = Math.abs(a.box.cy - b.box.cy);
    const similarWidth = Math.min(a.box.w, b.box.w) / Math.max(a.box.w, b.box.w, 1e-6);
    if (xOverlap < 0.55 || dx > 0.35 * medianH) continue;
    if (dy < 0.12 * medianH || dy > 0.85 * medianH) continue;
    if (similarWidth < 0.55 || spansFraction(a, b)) continue;
    const strokes = [...a._group.strokes, ...b._group.strokes];
    const merged = { strokes, box: bbox(strokes.flatMap(strokePts)), strokeIdxs: [...a.strokeIdxs, ...b.strokeIdxs] };
    out.splice(i, 2, {
      id: a.id, sym: '=', conf: 0.93,
      alts: [{ sym: '=', conf: 0.93 }, { sym: '-', conf: 0.3 }],
      box: merged.box, strokeIdxs: merged.strokeIdxs, _group: merged
    });
  }
  return out;
}

/** Segmentation self-repair: a low-confidence pair that reads far better as
 *  ONE glyph gets re-merged (broken x, split 5, k drawn in pieces…). */
function mergeRetry(line, medianH) {
  if (line.length < 2) return line;
  const out = [...line];
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1];
    if (a.composite || b.composite) continue;
    const weak = Math.min(a.conf, b.conf) < 0.42;
    const gap = b.box.x1 - a.box.x2;
    if (!weak || gap > 0.22 * medianH) continue;
    const strokes = [...a._group.strokes, ...b._group.strokes];
    const merged = { strokes, box: bbox(strokes.flatMap(strokePts)), strokeIdxs: [...a.strokeIdxs, ...b.strokeIdxs] };
    const cls = classifyCached(merged, medianH);
    if (cls.conf > 1.3 * Math.max(a.conf, b.conf) && cls.conf > 0.5) {
      out.splice(i, 2, {
        id: a.id, sym: cls.sym, conf: cls.conf, alts: cls.alts,
        box: merged.box, strokeIdxs: merged.strokeIdxs, _group: merged
      });
      i--;
    }
  }
  return out;
}

/** Segmentation self-repair, other direction: a wide low-confidence blob that
 *  reads far better as TWO glyphs gets split at its widest internal gap
 *  (touching "12", an x written into a y's tail…). */
function splitRetry(line, medianH) {
  const out = [...line];
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (s.composite || s.conf >= 0.4 || !s._group || s._group.strokes.length < 2) continue;
    if (s.box.w < 0.9 * medianH) continue;
    const ordered = [...s._group.strokes].sort((a, b) => a.box.cx - b.box.cx);
    let cut = -1, widest = -Infinity;
    for (let k = 0; k < ordered.length - 1; k++) {
      const leftMax = Math.max(...ordered.slice(0, k + 1).map(st => st.box.x2));
      const gap = ordered[k + 1].box.x1 - leftMax;
      if (gap > widest) { widest = gap; cut = k; }
    }
    if (cut < 0 || widest < -0.12 * medianH) continue;
    const A = ordered.slice(0, cut + 1), B = ordered.slice(cut + 1);
    const gA = { strokes: A, box: bbox(A.flatMap(strokePts)), strokeIdxs: A.map(st => st.idx) };
    const gB = { strokes: B, box: bbox(B.flatMap(strokePts)), strokeIdxs: B.map(st => st.idx) };
    if (Math.max(gA.box.w, gA.box.h) < 0.16 * medianH || Math.max(gB.box.w, gB.box.h) < 0.16 * medianH) continue;
    const cA = classifyCached(gA, medianH), cB = classifyCached(gB, medianH);
    const pairConf = Math.min(cA.conf, cB.conf);
    if (pairConf > 1.25 * s.conf && pairConf > 0.45) {
      out.splice(i, 1,
        { id: s.id + 'a', sym: cA.sym, conf: cA.conf, alts: cA.alts, box: gA.box, strokeIdxs: gA.strokeIdxs, _group: gA },
        { id: s.id + 'b', sym: cB.sym, conf: cB.conf, alts: cB.alts, box: gB.box, strokeIdxs: gB.strokeIdxs, _group: gB });
      i++;
    }
  }
  return out;
}

/** A tight value followed by a '+' can occasionally segment as one confident
 *  four-stroke glyph — most visibly y+ as H. Confidence then prevents the
 *  ordinary split retry from touching it. Only split when the two halves are
 *  themselves strong, and the merged glyph sits exactly where an operator is
 *  expected: value [value+] value.
 */
function operatorSplitPass(line, medianH) {
  if (line.length < 3) return line;
  const out = [...line];
  const valueish = s => s && (/^[0-9a-zA-Z]$/.test(s.sym) || s.sym === ')' || s.sym === 'deg' || FUNC_NAMES.has(s.sym));
  for (let i = 1; i < out.length - 1; i++) {
    const s = out[i];
    if (s.composite || !s._group || s._group.strokes.length < 3 || s._group.strokes.length > 5) continue;
    if (!valueish(out[i - 1]) || !valueish(out[i + 1])) continue;
    if (!['H', 'R', '4', 'percent'].includes(s.sym) && s.conf < 0.88) continue;
    const ordered = [...s._group.strokes].sort((a, b) => a.box.cx - b.box.cx);
    let best = null;
    for (let cut = 0; cut < ordered.length - 1; cut++) {
      const A = ordered.slice(0, cut + 1), B = ordered.slice(cut + 1);
      const gA = { strokes: A, box: bbox(A.flatMap(strokePts)), strokeIdxs: A.map(st => st.idx) };
      const gB = { strokes: B, box: bbox(B.flatMap(strokePts)), strokeIdxs: B.map(st => st.idx) };
      if (Math.max(gA.box.w, gA.box.h) < 0.25 * medianH || Math.max(gB.box.w, gB.box.h) < 0.25 * medianH) continue;
      const cA = classifyCached(gA, medianH), cB = classifyCached(gB, medianH);
      if (cB.sym !== '+' || cB.conf < 0.72) continue;
      if (!/^[0-9a-zA-Z]$/.test(cA.sym) || cA.conf < 0.72) continue;
      const score = cA.conf + cB.conf;
      if (!best || score > best.score) best = { gA, gB, cA, cB, score };
    }
    if (!best || best.score < 1.58) continue;
    out.splice(i, 1,
      { id: s.id + 'a', sym: best.cA.sym, conf: best.cA.conf, alts: best.cA.alts, box: best.gA.box, strokeIdxs: best.gA.strokeIdxs, _group: best.gA, _geo: true },
      { id: s.id + 'b', sym: '+', conf: best.cB.conf, alts: best.cB.alts, box: best.gB.box, strokeIdxs: best.gB.strokeIdxs, _group: best.gB, _geo: true });
    i++;
  }
  return out;
}

/** A handwritten + can be drawn with a tall down-stroke and read as t. When
 *  that leaves the line as an invalid run like 5nt2t=67, the surrounding
 *  coefficient-variable terms provide stronger evidence than the isolated
 *  glyph.
 */
function operatorContextPass(line) {
  if (line.length < 6) return line;
  const isDigit = s => s && /^[0-9]$/.test(s.sym);
  const isVar = s => s && /^[a-zA-Z]$/.test(s.sym);
  for (let i = 2; i < line.length - 3; i++) {
    const s = line[i];
    if (s.sym !== 't' || s.composite || !s._group || s._group.strokes.length !== 2) continue;
    if (!isDigit(line[i - 2]) || !isVar(line[i - 1]) || !isDigit(line[i + 1]) || !isVar(line[i + 2])) continue;
    if (catOf(line[i + 3].sym) !== 'r') continue;
    const plusAlt = (s.alts || []).find(a => a.sym === '+');
    if (!plusAlt || plusAlt.conf < 0.01) continue;
    s.sym = '+';
    s.conf = Math.max(0.72, plusAlt.conf);
    s.alts = [{ sym: '+', conf: s.conf }, ...(s.alts || []).filter(a => a.sym !== '+')].slice(0, 5);
  }
  return line;
}

// ── Grammar beam: maths-syntax prior over per-glyph candidates ───────────────
// When a line is uncertain, the top-1 greedy reading is often ALMOST right —
// one glyph off. Searching the cross-product of each glyph's top candidates
// against a soft grammar of written maths picks the reading that both the ink
// and the language agree on.

const BINOP = new Set(['+', '*', '/', '=', '<', '>', '±', ':']);
const VALUEISH = /^[0-9a-zA-Z)]$|^pi$|^theta$|^deg$|^%$/;

function mathGrammarScore(symsList) {
  let sc = 0, depth = 0;
  const n = symsList.length;
  let digits = 0, letters = 0;
  for (const s of symsList) {
    if (/^[0-9]$/.test(s)) digits++;
    else if (/^[a-zA-Z]$/.test(s)) letters++;
  }
  for (let i = 0; i < n; i++) {
    const s = symsList[i], prev = symsList[i - 1], next = symsList[i + 1];
    if (s === '(') depth++;
    else if (s === ')') { depth--; if (depth < 0) { sc -= 0.8; depth = 0; } }
    if (BINOP.has(s)) {
      const lOk = prev !== undefined && (VALUEISH.test(prev) || prev === '.');
      const rOk = next !== undefined && (VALUEISH.test(next) || next === '(' || next === '-' || next === '.' || next === 'sqrt' || FUNC_NAMES.has(next));
      if (lOk) sc += 0.15; else sc -= i === 0 ? 0.5 : 0.3;
      if (rOk) sc += 0.15; else sc -= i === n - 1 ? 0.5 : 0.3;
      if (prev !== undefined && BINOP.has(prev)) sc -= 0.6;
    }
    if (s === '.' && /^[0-9]$/.test(prev || '') && /^[0-9]$/.test(next || '')) sc += 0.12;
    // classic misread letters sitting inside a digit run
    if (/^[a-zA-Z]$/.test(s) && !/^[xy]$/i.test(s) && digits >= 2 && letters === 1) {
      if (/^[0-9]$/.test(prev || '') || /^[0-9]$/.test(next || '')) sc -= 0.35;
    }
  }
  sc -= 0.55 * depth;   // unclosed brackets
  const eqCount = symsList.filter(s => s === '=').length;
  if (eqCount > 1) sc -= 0.2 * (eqCount - 1);
  return sc;
}


// categories: d digit · v variable · c constant/term · . decimal · o operator
//             r relation · ( open · ) close · p postfix · f function/radical
const CAT = new Map();
for (let i = 0; i <= 9; i++) CAT.set(String(i), 'd');
for (const ch of 'abcdefghijklmnopqrstuvwxyz') { CAT.set(ch, 'v'); CAT.set(ch.toUpperCase(), 'v'); }
for (const s of ['pi', 'theta', 'LHS', 'RHS']) CAT.set(s, 'c');
CAT.set('.', '.');
CAT.set('(', '(');
CAT.set(')', ')');
for (const s of ['=', '<', '>', '<=', '>=', '!=']) CAT.set(s, 'r');
for (const s of ['+', '-', '*', '/', ':', '±', 'pm', 'div']) CAT.set(s, 'o');
for (const s of ['%', 'percent', 'deg', '°']) CAT.set(s, 'p');
for (const s of ['sqrt', 'sin', 'cos', 'tan', 'sec', 'csc', 'cosec', 'cot', 'ln', 'log']) CAT.set(s, 'f');

const catOf = sym => CAT.get(sym) || 'v';

/** log P(next category | previous category). '^' is line start, '$' line end. */
const BIGRAM = {
  '^': { d:  0.25, v:  0.18, c:  0.10, '.': -2.20, o: -1.30, r: -2.00, '(':  0.15, ')': -2.60, p: -2.40, f:  0.10, $: -1.00 },
  d:   { d:  0.35, v:  0.15, c:  0.05, '.':  0.25, o:  0.30, r:  0.30, '(':  0.15, ')':  0.20, p:  0.35, f: -0.25, $:  0.30 },
  v:   { d: -0.85, v: -0.45, c: -0.25, '.': -1.30, o:  0.30, r:  0.35, '(':  0.05, ')':  0.25, p:  0.10, f: -0.50, $:  0.30 },
  c:   { d: -0.60, v: -0.20, c: -0.30, '.': -1.30, o:  0.30, r:  0.35, '(':  0.05, ')':  0.25, p:  0.10, f: -0.50, $:  0.30 },
  '.': { d:  0.80, v: -2.40, c: -2.20, '.': -2.60, o: -1.90, r: -1.90, '(': -2.20, ')': -1.90, p: -2.00, f: -2.20, $: -2.40 },
  o:   { d:  0.35, v:  0.30, c:  0.20, '.': -1.60, o: -1.20, r: -1.60, '(':  0.30, ')': -1.90, p: -1.90, f:  0.25, $: -2.20 },
  r:   { d:  0.35, v:  0.30, c:  0.20, '.': -1.60, o: -1.10, r: -1.60, '(':  0.30, ')': -1.90, p: -1.80, f:  0.25, $: -2.20 },
  '(': { d:  0.30, v:  0.30, c:  0.20, '.': -1.80, o: -1.10, r: -1.70, '(':  0.00, ')': -1.80, p: -1.80, f:  0.20, $: -2.40 },
  ')': { d: -0.20, v:  0.05, c:  0.00, '.': -1.60, o:  0.35, r:  0.35, '(':  0.00, ')':  0.30, p:  0.30, f: -0.40, $:  0.35 },
  p:   { d: -1.20, v: -1.00, c: -0.90, '.': -1.50, o:  0.30, r:  0.30, '(': -0.90, ')':  0.30, p: -1.00, f: -1.00, $:  0.35 },
  f:   { d:  0.10, v:  0.35, c:  0.35, '.': -1.80, o: -1.00, r: -1.50, '(':  0.45, ')': -1.80, p: -1.60, f:  0.00, $: -1.80 }
};

/** Symbol-level frequency prior. 'l' and 'o' carry no shape evidence of their
 *  own — they are the SAME CNN class as '1' and '0' — and a student writing
 *  maths essentially never uses either as a variable, so the digit reading is
 *  the default and the letter has to be earned from context (a function name,
 *  which the decoder locks before the beam ever runs). */
const UNIGRAM = { l: -1.15, o: -1.15, ':': -0.45, '!=': -0.55, div: -0.30 };

/** Unary sign: after a relation, an operator, an open bracket or line start a
 *  '-' (or '+') is a sign, not a dangling operator. */
const isSign = sym => sym === '-' || sym === '+';

function bigramScore(prevCat, sym, cat) {
  if (isSign(sym) && (prevCat === '^' || prevCat === 'o' || prevCat === 'r' || prevCat === '(')) {
    return prevCat === 'o' ? -0.55 : 0.05;
  }
  const row = BIGRAM[prevCat];
  const v = row ? row[cat] : undefined;
  return v === undefined ? 0 : v;
}

/** Does the reading parse as an expression or equation? A recursive-descent
 *  pass over the same grammar the answer engine consumes — a real parse is much
 *  harder evidence than any amount of local smoothing. */
function parseOk(syms) {
  let i = 0;
  const at = () => (i < syms.length ? catOf(syms[i]) : null);
  const atom = () => {
    const c = at();
    if (c === null) return false;
    if (c === 'd') {
      while (at() === 'd') i++;
      if (syms[i] === '.') { i++; if (at() !== 'd') return false; while (at() === 'd') i++; }
      return true;
    }
    if (c === 'v' || c === 'c') { i++; return true; }
    if (c === '(') { i++; if (!expr()) return false; if (syms[i] !== ')') return false; i++; return true; }
    if (c === 'f') { i++; return factor(); }
    return false;
  };
  const post = () => { while (at() === 'p') i++; };
  function factor() {
    while (isSign(syms[i])) i++;
    if (!atom()) return false;
    post();
    // implicit multiplication: 2x, 3(x+4), x sin(t)
    let guard = syms.length;
    while (guard-- > 0) {
      const c = at();
      if (c !== 'v' && c !== 'c' && c !== '(' && c !== 'f') break;
      if (!atom()) return false;
      post();
    }
    return true;
  }
  function term() {
    if (!factor()) return false;
    let guard = syms.length;
    while (at() === 'o' && guard-- > 0) { i++; if (!factor()) return false; }
    return true;
  }
  function expr() {
    if (!term()) return false;
    let guard = syms.length;
    while (at() === 'r' && guard-- > 0) { i++; if (!term()) return false; }
    return true;
  }
  return expr() && i === syms.length;
}

/** Whole-line terms the incremental bigram can't see: bracket balance, how many
 *  relations the line carries, and whether the whole thing parses. */
function lineFormScore(syms) {
  let sc = 0, depth = 0, stray = 0, pairs = 0, opened = [];
  for (const s of syms) {
    if (s === '(') { depth++; opened.push(0); }
    else if (s === ')') {
      if (depth > 0) { depth--; if (opened.pop() > 0) pairs++; }
      else stray++;
    } else if (opened.length) opened[opened.length - 1]++;
  }
  sc -= 1.10 * depth + 1.30 * stray;
  // A matched, non-empty bracket pair is positive evidence, not merely the
  // absence of a penalty. "9(t-2)" and "91t-21" are equally well-formed to a
  // local model, and the digit run wins on bigrams alone; a bracketed group is
  // the reading a student far more often meant.
  sc += 0.45 * pairs;
  let rel = 0;
  for (const s of syms) if (catOf(s) === 'r') rel++;
  if (rel > 1) sc -= 0.50 * (rel - 1);
  if (parseOk(syms)) sc += 0.50;
  return sc;
}

// ── Question context ─────────────────────────────────────────────────────────
// Every general handwriting engine — MyScript, Apple's, any server LLM — reads
// ink in a vacuum. This app does not have to: it set the question, so it knows
// which symbols the topic can even contain, what shape the answer takes, and
// what the correct answer is. Three priors no general recogniser can have.
//
// THE DANGER, and the reason all of it is capped: a prior strong enough to turn
// a WRONG answer into the expected one destroys the product. Equivalence
// marking, misconception tagging and Step Check all read the recognised string,
// so an engine that quietly repairs 7/8 into 3/4 because 3/4 was the answer
// tells a student they were right when they were not, and the tagging that
// would have caught the misconception never fires. Misreading is a bug; lying
// to a student about their own working is worse than a bug.
//
// The context is therefore worth exactly one thing: breaking ties the ink could
// not settle. It enters as a single additive term on a COMPLETED hypothesis,
// clamped to CTX_CAP the way rerank.js clamps the geometry correction, and the
// expected answer is offered as ONE more candidate path which must be spellable
// entirely out of readings the ink itself proposed — never out of a symbol the
// classifier never saw. client/test/inkcheck-context.mjs renders deliberately
// wrong-but-plausible answers, recognises them with ctx.expected set to the
// CORRECT answer, and fails if any reading becomes the expected answer, drifts
// toward it, or ends up less faithful to the ink than it was without the
// context. That suite is the licence for this feature.

// How much a completed reading can gain or lose from everything the question
// knows. Beam scores are log-likelihood plus GRAMMAR_WEIGHT × grammar, in which
// one confidently misread glyph is worth upwards of a nat — so these can decide
// a coin flip and can decide nothing else.
//
// The two halves of the context are not equally dangerous and do not share a
// leash. The alphabet and the answer's shape are ANSWER-BLIND: they say what
// the topic can contain, not what this student should have written, so pushing
// a reading toward them can never manufacture agreement with the mark scheme —
// a wrong answer in the right alphabet stays wrong. Those two get the larger
// budget between them. The expected answer gets its own, much smaller one.
const CTX_CAP = 0.40;        // the two answer-blind terms together
const CTX_ALPHABET = 0.22;   // per glyph outside the topic's symbol set
const CTX_TYPE = 0.30;       // the reading has the shape the generator asked for
// The expected answer is worth a fraction of what one confidently misread
// glyph costs. inkcheck-context.mjs locates that edge rather than guessing at
// it: the suite is clean here and at 0.18, and at 0.30 it catches the prior
// turning a student's "0.15" into the "0.75" it was told to expect — the 1/7
// near-tie this classifier is worst at, which is exactly where a stronger
// prior does its damage.
const CTX_EXPECT = 0.15;     // the reading IS the expected answer

// The cap alone is not enough of a leash for the expected answer, because a
// scalar cannot tell a near-tie from a confident misread — and it is only over
// near-ties that the question has any business speaking. So the expected
// reading has to clear a structural gate as well: at every glyph, the symbol it
// asks for must already be worth at least this share of that glyph's leading
// candidate. Where the ink is confident the share is nowhere near met and the
// expected answer is not offered at all, whatever the cap says. Measured
// against inkcheck-context.mjs: at a share of 0.70 the suite still catches the
// prior rewriting wrong answers, and at 0.90 — where the expected symbol has to
// sit within a tenth of the leader, a genuine coin flip — it is clean.
const CTX_EXPECT_SHARE = 0.90;

/** Callers write maths; the beam speaks recogniser symbols. */
const CTX_ALIAS = { '%': 'percent', '°': 'deg', '±': 'pm', '÷': 'div', '×': '*', '−': '-' };
const ctxSym = (t) => CTX_ALIAS[t] || t;

// Longest-first, so 'cosec' beats 'cos', 'theta' beats 't' and '<=' beats '<'.
const CTX_WORDS = ['cosec', 'theta', 'sqrt', 'sec', 'csc', 'cot', 'sin', 'cos', 'tan',
  'log', 'LHS', 'RHS', 'ln', 'pi', '<=', '>=', '!='];

/** Split an expected answer into the symbols a line of glyphs would carry. A
 *  function's brackets go first: the decoder locks "sin" as one glyph and the
 *  student never drew the parentheses assembleLine prints around its argument. */
function ctxTokens(text) {
  const t = String(text).replace(/\s+/g, '')
    .replace(/(sin|cos|tan|sec|csc|cosec|cot|ln|log)\(([^()]*)\)/g, '$1$2');
  const out = [];
  let i = 0;
  while (i < t.length) {
    const word = CTX_WORDS.find(w => t.startsWith(w, i));
    if (word) { out.push(word); i += word.length; continue; }
    out.push(ctxSym(t[i]));
    i++;
  }
  return out;
}

/** Does a reading have the shape this question's generator produces? The names
 *  are the generator's own. 'set' is matched only on the weaker property its
 *  members share — the alphabet carries no separator glyph, so by symbols alone
 *  a set is indistinguishable from a run of values. */
const CTX_SHAPE = {
  integer: t => /^-?[0-9]+$/.test(t),
  fraction: t => /^-?[0-9]+\/-?[0-9]+$/.test(t),
  decimal: t => /^-?[0-9]+\.[0-9]+$/.test(t),
  ratio: t => /^[0-9]+(:[0-9]+)+$/.test(t),
  point: t => /^\(.*\)$/.test(t),
  percent: t => /^-?[0-9]+(\.[0-9]+)?%$/.test(t),
  expression: t => /[a-zA-Z]/.test(t) || /[+\-*/^]/.test(t),
  equation: t => t.includes('='),
  set: t => /^[0-9.\-]+$/.test(t)
};

/** Everything the question knows, folded into one capped term over a completed
 *  reading. Returns a scorer, or null when there is no usable context. */
function ctxScorer(ctx, candLists) {
  if (!ctx) return null;
  const alphabet = Array.isArray(ctx.alphabet) && ctx.alphabet.length
    ? new Set(ctx.alphabet.map(ctxSym)) : null;
  const shape = CTX_SHAPE[String(ctx.answerType || '').toLowerCase()] || null;
  let expect = ctx.expected ? ctxTokens(ctx.expected) : null;
  // near-tie gate: every glyph the expected answer needs must already be a
  // live reading of that glyph's own ink, not merely a symbol in the alphabet
  if (expect && (expect.length !== candLists.length || !expect.every((t, i) => {
    const c = candLists[i].find(x => x.sym === t);
    if (!c) return false;
    let top = 0;
    for (const x of candLists[i]) if (x.conf > top) top = x.conf;
    return c.conf >= CTX_EXPECT_SHARE * top;
  }))) expect = null;
  if (!alphabet && !shape && !expect) return null;
  // A locked glyph reads the same in every hypothesis, so charging it for
  // sitting outside the alphabet spends the cap without separating anything.
  const free = candLists.map(l => l.length > 1);
  const want = expect ? expect.join(' ') : null;
  return {
    tokens: expect,
    score(syms) {
      let v = 0;
      if (alphabet) {
        for (let i = 0; i < syms.length; i++) {
          if (free[i] && !alphabet.has(syms[i])) v -= CTX_ALPHABET;
        }
      }
      if (shape && shape(syms.map(printable).join(''))) v += CTX_TYPE;
      v = Math.max(-CTX_CAP, Math.min(CTX_CAP, v));
      if (want && syms.join(' ') === want) v += CTX_EXPECT;
      return v;
    }
  };
}

const GRAMMAR_WEIGHT = 1.20;
const BEAM_WIDTH = 40;
const MAX_CANDS = 5;

/** Re-decode a line over each symbol's candidate list. Locked symbols
 *  (overrides, composites/function names) keep a single candidate. */
function beamRepair(line, overrides, medianH, ctx = null) {
  if (line.length < 2) return line;

  // Transitions INTO a raised glyph are exponents, not baseline text: x^2 is a
  // perfectly good letter-then-digit pair and must not be taxed as one.
  const raised = line.map((s, i) => {
    if (i === 0) return false;
    const p = line[i - 1];
    return s.box.cy < p.box.cy - 0.28 * p.box.h && s.box.y2 < p.box.cy + 0.15 * p.box.h;
  });

  // A small mark raised at the very end of a written quantity is a unit mark —
  // degrees or percent — not an exponent digit. Shape alone cannot separate a
  // ring from a zero at that size; where it sits can. Only the final glyph
  // qualifies, so "x^(2)+1" and "5^(2)=25" are untouched.
  const medBox = median(line.map(x => Math.max(x.box.w, x.box.h))) || 1;
  const unitSlot = line.map((s, i) => {
    if (i !== line.length - 1 || i === 0) return false;
    const p = line[i - 1];
    return Math.max(s.box.w, s.box.h) < 0.62 * medBox &&
      s.box.y2 < p.box.y2 - 0.22 * p.box.h;      // clear of the baseline
  });

  // The stick family is shape-degenerate: 1 l / ( ) differ by slope and a bow
  // the render barely resolves, so for a bare near-straight stroke every one
  // of them is a live reading whether or not it survived the 5-slot alts list.
  // Injecting the missing members at a floor keeps them available to the
  // bracket-balance and grammar terms — which is the only evidence that can
  // settle a stick — while the floor keeps them losing to any confident ink.
  // The stick family is shape-degenerate: 1 l / ( ) differ by slope and a bow
  // the render barely resolves, so for a bare near-straight stroke every one
  // of them is a live reading whether or not it survived the 5-slot alts list.
  // Injecting the missing members keeps them available to the bracket-balance
  // and grammar terms — which is the only evidence that can settle a stick.
  const STICK_FAMILY = ['1', 'l', '/', '(', ')'];
  const stickish = (s) => {
    const cls = classOfSymbol(s.sym);
    if (cls === '1l' || cls === '/' || cls === '(' || cls === ')' || cls === '<' || cls === '>') {
      const g = s._group;
      if (g && g.strokes.length === 1) return nearStraight(strokePts(g.strokes[0]));
    }
    return false;
  };

  // How much bracket-vs-stick evidence the ink can even carry scales with the
  // glyph's width: at aspect 0.15 the render allots a bow ~2px against a
  // 2-3px brush (see the minAspect discussion in raster.js) — the bow is
  // quantised out and ( ) 1 l are one picture. There, the classifier's
  // preference is worth little and context should decide, so bracket
  // candidates are floored at up to half the leading score, fading to nothing
  // by aspect 0.42 where the bow is genuinely visible. Only lines that show
  // real bracket evidence get the floor at all — a line of plain digits and
  // letters must never have brackets dreamt into it.
  const bracketEvidence = line.some(s =>
    (s.sym === '(' || s.sym === ')') && s.conf >= 0.6 && !s.composite);
  const bracketFloor = (s, top) => {
    if (!bracketEvidence) return 0;
    const asp = s.box.w / Math.max(s.box.h, 1e-6);
    if (asp >= 0.42) return 0;
    const f = 0.5 * Math.min(1, (0.42 - asp) / 0.27);
    return f * top;
  };

  const candLists = line.map(s => {
    if (overrides[s.id] || s.composite || s._geo) return [{ sym: s.sym, conf: Math.max(s.conf, 0.9) }];
    const seen = new Set([s.sym]);
    const list = [{ sym: s.sym, conf: Math.max(0.02, s.conf) }];
    for (const a of s.alts || []) {
      if (seen.has(a.sym) || a.conf < 0.06) continue;
      seen.add(a.sym);
      list.push({ sym: a.sym, conf: a.conf });
      if (list.length >= MAX_CANDS) break;
    }
    if (stickish(s)) {
      const top = Math.max(...list.map(c => c.conf), ...(s.alts || []).map(a => a.conf));
      const floor = bracketFloor(s, top);
      for (const m of STICK_FAMILY) {
        const known = (s.alts || []).find(a => a.sym === m)?.conf ?? 0;
        // the floor works both directions: a thin true '1' misread as a
        // bracket is the same degeneracy as a thin '(' misread as a stick
        const conf = Math.max(known, m !== '/' ? floor : 0, 0.04);
        const have = list.find(c => c.sym === m);
        if (have) { if (conf > have.conf) have.conf = conf; }
        else list.push({ sym: m, conf });
        seen.add(m);
      }
    }
    return list;
  });
  // Merge arcs: the beam may also read two adjacent glyphs as ONE symbol,
  // scored by re-classifying their joined ink. mergeRetry above only fires on
  // low confidence, but this engine is confidently wrong more often than it is
  // unsure — a y or k drawn in drifting pieces reads as two confident sticks.
  // Here the merged reading competes in the same search as everything else, so
  // ink and grammar settle segmentation together. The 0.8 prior keeps merging
  // from ever being free.
  // Light, deliberately: the positive bigram rows already tax a merge ~0.3 per
  // saved symbol (fewer transitions collect less reward — the usual insertion
  // artifact), so all this prior adds is a tiebreak toward the segmentation
  // the segmenter actually produced.
  const MERGE_PRIOR = 0.92;
  const mergeArcs = new Array(line.length).fill(null);
  const medBoxH = median(line.map(x => Math.max(x.box.w, x.box.h))) || 20;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    if (a.composite || b.composite || overrides[a.id] || overrides[b.id]) continue;
    if (!a._group || !b._group) continue;
    // glyphs students draw in pieces are 2-3 strokes total (y k 4 % ÷ :) — a
    // merge that would build a 4-stroke glyph is swallowing a neighbour, not
    // repairing a split (a % once ate the misread stick beside it this way)
    if (a._group.strokes.length + b._group.strokes.length > 3) continue;
    // two certain glyphs are left alone — except a '.' pair, which is next to
    // impossible as written maths ('.'→'.' carries the harshest bigram in the
    // table) yet exactly what a colon whose dots segmented apart reads as
    if (Math.min(a.conf, b.conf) >= 0.9 && !(a.sym === '.' && b.sym === '.')) continue;
    const gap = b.box.x1 - a.box.x2;
    if (gap > 0.3 * medianH) continue;
    const w = Math.max(a.box.x2, b.box.x2) - Math.min(a.box.x1, b.box.x1);
    if (w > 2.3 * medBoxH) continue;
    const strokes = [...a._group.strokes, ...b._group.strokes];
    const g = { strokes, box: bbox(strokes.flatMap(strokePts)), strokeIdxs: [...a.strokeIdxs, ...b.strokeIdxs] };
    const cls = classifyCached(g, medianH);
    const cands = [{ sym: cls.sym, conf: cls.conf }, ...(cls.alts || []).filter(x => x.sym !== cls.sym)]
      .filter(c => c.conf >= 0.15).slice(0, 3);
    if (process.env.INK_DEBUG) console.error('MERGEARC', i, a.sym, b.sym, '→', cls.sym, cls.conf, JSON.stringify(cands));
    if (cands.length) mergeArcs[i] = { group: g, cls, cands };
  }

  if (candLists.every(l => l.length === 1) && !mergeArcs.some(Boolean)) return line;

  // positional DP: states that have consumed exactly i glyphs
  const arcScore = (b, sym, conf, i) => {
    const cat = catOf(sym);
    let g = bigramScore(b.prevCat, sym, cat) + (UNIGRAM[sym] || 0);
    // superscript — baseline rules don't apply. Only to readings that can BE
    // an exponent, though: no maths raises a dot or an operator, and exempting
    // them here let a colon's upper dot dodge the '.'→'.' penalty as a
    // "superscript" and priced the ':' merge out of the beam.
    if (raised[i] && g < 0 && (cat === 'd' || cat === 'v' || cat === 'c' || cat === '(' || cat === ')')) g = 0;
    if (unitSlot[i]) g += cat === 'p' ? 0.55 : (cat === 'd' || cat === 'v') ? -0.30 : 0;
    return { cat, delta: Math.log(conf) + GRAMMAR_WEIGHT * g };
  };
  const qctx = ctxScorer(ctx, candLists);
  let beamsAt = Array.from({ length: line.length + 1 }, () => []);
  beamsAt[0].push({ syms: [], arcs: [], score: 0, prevCat: '^' });
  for (let i = 0; i < line.length; i++) {
    beamsAt[i].sort((a, b) => b.score - a.score);
    const cur = beamsAt[i].slice(0, BEAM_WIDTH);
    for (const b of cur) {
      for (const c of candLists[i]) {
        const { cat, delta } = arcScore(b, c.sym, c.conf, i);
        beamsAt[i + 1].push({ syms: [...b.syms, c.sym], arcs: [...b.arcs, { i, n: 1, sym: c.sym, conf: c.conf }], score: b.score + delta, prevCat: cat });
      }
      const m = mergeArcs[i];
      if (m) {
        for (const c of m.cands) {
          const { cat, delta } = arcScore(b, c.sym, c.conf * MERGE_PRIOR, i);
          beamsAt[i + 2].push({ syms: [...b.syms, c.sym], arcs: [...b.arcs, { i, n: 2, sym: c.sym, conf: c.conf, m }], score: b.score + delta, prevCat: cat });
        }
      }
    }
  }
  // The expected answer as ONE more path. It is built out of the candidate
  // lists the ink produced and scored by exactly the same arcs as every other
  // hypothesis — the question's only privilege is the capped bonus below. A
  // student who wrote something else has a glyph somewhere whose ink never
  // proposed the symbol this path needs, and the path simply does not exist.
  if (qctx && qctx.tokens) {
    let score = 0, prevCat = '^';
    const arcs = [];
    for (let i = 0; i < line.length; i++) {
      const c = candLists[i].find(x => x.sym === qctx.tokens[i]);
      const r = arcScore({ prevCat }, c.sym, c.conf, i);
      score += r.delta;
      prevCat = r.cat;
      arcs.push({ i, n: 1, sym: c.sym, conf: c.conf });
    }
    beamsAt[line.length].push({ syms: qctx.tokens.slice(), arcs, score, prevCat });
  }

  let best = null, bestTotal = -Infinity;
  for (const b of beamsAt[line.length]) {
    const total = b.score + GRAMMAR_WEIGHT * (bigramScore(b.prevCat, '$', '$') + lineFormScore(b.syms)) +
      (qctx ? qctx.score(b.syms) : 0);
    if (total > bestTotal) { bestTotal = total; best = b; }
  }
  if (!best) return line;
  if (best.arcs.every(a => a.n === 1)) {
    return line.map((s, i) => {
      if (best.syms[i] === s.sym) return s;
      const alt = (s.alts || []).find(a => a.sym === best.syms[i]);
      return { ...s, sym: best.syms[i], conf: alt?.conf ?? s.conf, _beamFlipped: true };
    });
  }
  const out = [];
  for (const arc of best.arcs) {
    const s = line[arc.i];
    if (arc.n === 2) {
      out.push({
        id: s.id, sym: arc.sym, conf: arc.conf, alts: arc.m.cls.alts,
        box: arc.m.group.box, strokeIdxs: arc.m.group.strokeIdxs, _group: arc.m.group, _latticeMerged: true
      });
    } else if (arc.sym === s.sym) {
      out.push(s);
    } else {
      const alt = (s.alts || []).find(a => a.sym === arc.sym);
      out.push({ ...s, sym: arc.sym, conf: alt?.conf ?? s.conf, _beamFlipped: true });
    }
  }
  return out;
}


// ── Classification cache ─────────────────────────────────────────────────────
// Writing appends strokes; existing symbol groups don't change. Caching by
// group signature means each debounce re-run only classifies what's new —
// recognition stays instant however full the page gets.
let clsCache = new Map();
function classifyCached(group, medianH) {
  const nPts = group.strokes.reduce((s, st) => s + st.points.length, 0);
  const b = group.box;
  // stroke indices + counts + box are not unique across pages — two answers
  // both starting at the canvas origin can produce colliding keys for
  // different ink. A sample of actual ink coordinates (first and last point)
  // pins the key to the strokes themselves at no per-glyph cost.
  const p0 = group.strokes[0]?.points[0], pn = group.strokes[group.strokes.length - 1]?.points.at(-1);
  const salt = p0 && pn ? `${Math.round(p0.x)},${Math.round(p0.y)},${Math.round(pn.x)},${Math.round(pn.y)}` : '';
  const key = `${group.strokeIdxs.join(',')}|${nPts}|${salt}|${Math.round(b.x1)},${Math.round(b.y1)},${Math.round(b.x2)},${Math.round(b.y2)}|${Math.round(medianH)}|${getPersonalBank().length}`;
  const hit = clsCache.get(key);
  if (hit) return hit;
  const res = classify(group, medianH);
  // A full page of working plus the trial groups the merge/split retries make
  // ran past the old 600-entry cap, and clearing the whole map on overflow
  // meant every glyph on the page was re-run through the CNN on every
  // keystroke. Keep far more, and when it does fill, drop only the oldest half
  // so the ink still on screen stays cached.
  if (clsCache.size >= 4000) {
    const keep = [...clsCache.entries()].slice(clsCache.size >> 1);
    clsCache = new Map(keep);
  }
  clsCache.set(key, res);
  return res;
}

// ── Confidence summary ───────────────────────────────────────────────────────
// Three numbers a marking gate needs and could not previously get from a
// reading: how weak its weakest glyph is, how close its closest call was, and
// which glyph to put in front of the student when it wants to ask.
//
// The margin deliberately ignores CNN class twins. A '0' whose runner-up is
// 'o' is not a coin flip — it is a certain shape with two readings, settled
// later by the language decoder (the same reasoning scoreMass() is built on).
// Counting twins would report every round glyph on the page as a tie and the
// margin would carry no information at all.
//
// A reading can leave a glyph whose primary symbol scores BELOW one of its own
// alternatives: the grammar beam overrode the ink. That is a genuine zero
// margin, so the gap is clamped at 0 rather than allowed to go negative.
function confidenceSummary(lines) {
  let minConf = 1, margin = 1, weakest = null, index = 0;
  for (const ls of lines) {
    for (const s of ls) {
      const cls = classOfSymbol(s.sym);
      let runnerUp = 0;
      for (const a of s.alts || []) {
        if (classOfSymbol(a.sym) === cls) continue;
        if (a.conf > runnerUp) runnerUp = a.conf;
      }
      const gap = Math.max(0, Math.min(1, s.conf - runnerUp));
      if (gap < margin) margin = gap;
      if (s.conf < minConf) {
        minConf = s.conf;
        weakest = { index, sym: s.sym, conf: s.conf, alts: s.alts || [] };
      }
      index++;
    }
  }
  return { minConf, margin, weakest };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Recognize handwriting.
 * strokes: [{points: [{x, y, p, t}]}]
 * overrides: {symbolId: sym} — user corrections applied before assembly
 * ctx: optional question context — see the QUESTION CONTEXT section above
 * Returns { lines: [{text, symbols, box}], text, symbols,
 *           minConf, margin, weakest }
 *   minConf  lowest per-glyph confidence in the reading (1 when there is none)
 *   margin   smallest top-1 minus top-2 gap, twins excluded (1 when there is none)
 *   weakest  { index, sym, conf, alts } for the least-confident glyph, or null.
 *            index counts glyphs across the whole reading, in reading order.
 */
export function recognize(strokes, overrides = {}, ctx = null) {
  let groups = segment(strokes);
  if (!groups.length) return { lines: [], text: '', symbols: [], minConf: 1, margin: 1, weakest: null };
  let heights = groups.map(g => Math.max(g.box.w, g.box.h)).sort((a, b) => a - b);
  let medianH = heights[Math.floor(heights.length / 2)] || 20;

  // Hand-slant normalisation: measure the writer's lean, shear the page
  // upright, and run the whole pipeline in that frame. Slant breaks more than
  // classification — the x-overlap tests that group a y's or k's strokes fail
  // once the glyph leans — so the de-shear must come BEFORE segmentation.
  // Output boxes are sheared back at the end so the UI overlay still lands on
  // the ink the user actually drew.
  const hand = handSlantOf(groups, medianH);
  let shearMidY = 0;
  if (hand !== 0) {
    let ys = 0, n = 0;
    for (const s of strokes) for (const p of s.points) { ys += p.y; n++; }
    shearMidY = ys / n;
    const upright = strokes.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: p.x - hand * (p.y - shearMidY) }))
    }));
    groups = segment(upright);
    heights = groups.map(g => Math.max(g.box.w, g.box.h)).sort((a, b) => a - b);
    medianH = heights[Math.floor(heights.length / 2)] || 20;
  }

  const symbols = groups.map((g, i) => {
    const cls = classifyCached(g, medianH);
    const id = 's' + i;
    const sym = overrides[id] || cls.sym;
    return { id, sym, conf: overrides[id] ? 1 : cls.conf, alts: cls.alts, box: g.box, strokeIdxs: g.strokeIdxs, _group: g };
  });

  // Context re-rank: letter/digit lookalikes settle by their neighbours.
  const LOOKALIKE = { s: '5', z: '2', b: '6', u: '4', d: 'a', g: '9', q: '9', o: '0', l: '1' };
  let linesPre = splitLines(symbols);

  // segmentation self-repair (colon, merge, then split), then function-name locking
  linesPre = linesPre.map(ls => colonRetry(ls, medianH));
  linesPre = linesPre.map(ls => equalsRetry(ls, medianH));
  linesPre = linesPre.map(ls => mergeRetry(ls, medianH));
  linesPre = linesPre.map(ls => splitRetry(ls, medianH));
  linesPre = linesPre.map(ls => operatorSplitPass(ls, medianH));
  linesPre = linesPre.map(operatorContextPass);
  linesPre = linesPre.map(ls => decodeFunctions(ls, medianH));
  linesPre = linesPre.map(ls => degreeMarkPass(ls, medianH));
  linesPre = linesPre.map(ls => mathContextPass(ls, medianH));
  linesPre = linesPre.map(rhsNumericPass);
  linesPre = linesPre.map(ls => percentContextPass(ls, medianH));
  linesPre = linesPre.map(ls => bracketContextPass(ls, medianH));
  linesPre = linesPre.map(parenthesizedDigitPass);

  for (const ls of linesPre) {
    for (let i = 0; i < ls.length; i++) {
      const sym = ls[i];
      if (overrides[sym.id] || sym.composite) continue;
      const digitTwin = LOOKALIKE[sym.sym];
      if (!digitTwin || !/^[0-9]$/.test(digitTwin)) continue;
      const prevS = ls[i - 1]?.sym, nextS = ls[i + 1]?.sym;
      const identical = ['o', 'l'].includes(sym.sym);
      const digitish = v => v !== undefined && (/^[0-9.]$/.test(v) || (identical && v === '/'));
      const leftOk = prevS === undefined ? false : digitish(prevS);
      const rightOk = nextS === undefined ? false : digitish(nextS);
      const restNumeric = ls.every((o2, j) => j === i || /^[0-9.+\-*/=:°]$|^div$/.test(o2.sym));
      // shape-identical twins (l/1, o/0) flip beside ANY digit — they carry no
      // shape evidence of their own, so context decides outright.
      const identicalTwin = ['o', 'l'].includes(sym.sym);
      if ((leftOk && rightOk) || ((leftOk || rightOk) && (identicalTwin || (restNumeric && ls.length > 1)))) {
        const alt = sym.alts?.find(a => a.sym === digitTwin);
        if ((alt && alt.conf > 0.25 * (sym.conf || 1)) || ['o', 'l', 'g', 'q'].includes(sym.sym)) {
          sym.sym = digitTwin;
          sym.conf = Math.max(sym.conf, alt?.conf || sym.conf);
        }
      }
    }
  }

  // slash-between-digits: a steep straight stroke flanked by digits whose own
  // classifier scores put '/' in close contention reads as a fraction slash —
  // 1 and / are shape-degenerate for slanted hands and only context settles it.
  const slashBetweenDigits = (ls) => {
    for (let i = 1; i < ls.length - 1; i++) {
      const s = ls[i];
      if (overrides[s.id] || s.composite || !['1', 'l'].includes(s.sym)) continue;
      if (!/^[0-9]$/.test(ls[i - 1].sym) || !/^[0-9]$/.test(ls[i + 1].sym)) continue;
      const g = s._group;
      if (!g || g.strokes.length !== 1) continue;
      const pts = strokePts(g.strokes[0]);
      if (pts.length < 2) continue;
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const dx = pts[pts.length - 1][0] - pts[0][0], dy = pts[pts.length - 1][1] - pts[0][1];
      const chord = Math.hypot(dx, dy);
      const slant = Math.abs(dx) / Math.max(Math.abs(dy), 1e-6);
      const slashAlt = (s.alts || []).find(a => a.sym === '/');
      const slashShare = slashAlt ? slashAlt.conf / Math.max(s.conf || 1, 1e-6) : 0;
      const strongAlt = slashAlt && slashShare >= 0.35;
      // A wobbling hand bows the stroke (measured 0.82 chord/len at wobble
      // 1.3), but a bowed slash is still a slash — its identity is the
      // chord's slant, which survives the bow. The strict gate stays for
      // marginal alts; a strong '/' alternative earns the same looseness the
      // % pre-pass already extends to heavily-warped slashes.
      const ratio = chord / Math.max(len, 1e-6);
      const straight = ratio > 0.93 || (ratio > 0.80 && strongAlt && slant >= 0.2);
      const gapL = s.box.x1 - ls[i - 1].box.x2;
      const gapR = ls[i + 1].box.x1 - s.box.x2;
      const spacedFraction = slashAlt && slashAlt.conf >= 0.08 && ratio > 0.86 && slant >= 0.10 &&
        s.box.w < 0.35 * medianH && Math.min(gapL, gapR) > 0.35 * medianH;
      const okFlip = (slant >= 0.34 && slashAlt && slashShare >= 0.35) ||
        (slant >= 0.15 && strongAlt) || spacedFraction;
      if ((straight || spacedFraction) && okFlip) {
        s.sym = '/';
        s.conf = Math.max(s.conf, slashAlt.conf);
      }
    }
  };
  linesPre.forEach(slashBetweenDigits);

  // grammar beam: uncertain lines re-decoded against the maths-syntax prior
  linesPre = linesPre.map(ls => beamRepair(ls, overrides, medianH, ctx));

  // the beam can turn a misread bracket back into the digit it was, putting a
  // slash between digits for the first time — the geometry test above then has
  // the context it needed, so it runs once more on the repaired line
  linesPre.forEach(slashBetweenDigits);
  linesPre = linesPre.map(ls => mathContextPass(ls, medianH));
  linesPre = linesPre.map(rhsNumericPass);
  linesPre = linesPre.map(ls => percentContextPass(ls, medianH));
  linesPre = linesPre.map(ls => bracketContextPass(ls, medianH));
  linesPre = linesPre.map(parenthesizedDigitPass);

  // user corrections always win — including on symbols created by split/merge
  // repair, whose ids ('s3a'…) don't exist at the initial group mapping
  for (const ls of linesPre) {
    for (const s of ls) {
      if (overrides[s.id] && s.sym !== overrides[s.id]) { s.sym = overrides[s.id]; s.conf = 1; }
    }
  }

  // 2D layout reads x-overlaps, so text is assembled in the upright frame…
  const texts = linesPre.map(ls => assembleLine(ls));

  // …and only then are boxes sheared back into the frame of the ink the user
  // drew, so the UI overlay lands on it (dedupe by identity — top-level
  // symbols and line symbols share objects, and repair passes introduce new
  // ones that exist only in the lines)
  if (hand !== 0) {
    const done = new Set();
    const back = (s) => {
      if (!s.box || done.has(s)) return;
      done.add(s);
      const b = s.box;
      const xa = b.x1 + hand * (b.y1 - shearMidY), xb = b.x1 + hand * (b.y2 - shearMidY);
      const xc = b.x2 + hand * (b.y1 - shearMidY), xd = b.x2 + hand * (b.y2 - shearMidY);
      const x1 = Math.min(xa, xb, xc, xd), x2 = Math.max(xa, xb, xc, xd);
      s.box = { ...b, x1, x2, w: x2 - x1, cx: (x1 + x2) / 2 };
    };
    for (const s of symbols) back(s);
    for (const ls of linesPre) for (const s of ls) back(s);
  }

  const lines = linesPre.map((ls, i) => {
    // symbol boxes are bbox() results: {x1, y1, x2, y2, …} in canvas pixels
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const s of ls) {
      left = Math.min(left, s.box.x1); top = Math.min(top, s.box.y1);
      right = Math.max(right, s.box.x2); bottom = Math.max(bottom, s.box.y2);
    }
    return {
      text: texts[i],
      symbols: ls,
      box: { x: left, y: top, w: right - left, h: bottom - top }
    };
  });

  return {
    lines, text: lines.map(l => l.text).join('\n'), symbols,
    ...confidenceSummary(linesPre)
  };
}

/** Convert a recognized expr string into LaTeX for a KaTeX preview. */
export function exprToLatex(s) {
  if (!s) return '';
  let t = String(s);
  for (; ;) {
    const i = t.indexOf('sqrt(');
    if (i === -1) break;
    let depth = 0, j = i + 4;
    for (; j < t.length; j++) {
      if (t[j] === '(') depth++;
      else if (t[j] === ')') { depth--; if (depth === 0) break; }
    }
    const inner = t.slice(i + 5, j);
    t = t.slice(0, i) + `\\sqrt{${inner}}` + t.slice(j + 1);
  }
  t = t.replace(/\(([^()]*)\)\/\(([^()]*)\)/g, '\\frac{$1}{$2}');
  t = t.replace(/\^\(([^()]*)\)/g, '^{$1}');
  t = t.replace(/\b(sin|cos|tan|sec|csc|cot|ln|log)\b/g, '\\$1 ');
  t = t.replace(/\bLHS\b/g, '\\mathrm{LHS}').replace(/\bRHS\b/g, '\\mathrm{RHS}');
  t = t.replace(/theta/g, '\\theta ').replace(/pi/g, '\\pi ');
  t = t.replace(/<=/g, ' \\le ').replace(/>=/g, ' \\ge ').replace(/!=/g, ' \\ne ');
  t = t.replace(/±/g, ' \\pm ').replace(/°/g, '^{\\circ}');
  t = t.replace(/\*/g, '\\times ');
  t = t.replace(/%/g, '\\%');
  return t;
}
