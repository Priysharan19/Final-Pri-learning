// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what OriginalWork draws, as data (standard #08)
//
// The student's own page is the primary view of marked work: their strokes,
// exactly as kept by the server with the mark (/v1/originals), or their
// photographed page. Boxes and numbered markers sit ON that ink; the typeset
// reading is secondary ("what Pri read"), never the work itself.
//
// Pure: no DOM, no React. Every number here comes from the kept bytes; the
// strokes are drawn through their own samples, straight segments only — no
// smoothing, no beautifying, no reconstruction.
// ─────────────────────────────────────────────────────────────────────────────
import { base64ToBytes, decodeInk, regionBox, sha256Hex } from '../engine/originalInk.js';

/** Statuses a line marker can carry (the annotated-working vocabulary). */
export const MARK_STATUSES = Object.freeze(['checked', 'first-error', 'follows', 'not-verified', 'unread']);

/** One SVG path through a stroke's own samples (M x y L x y …), nothing interpolated. */
export function strokePath(points) {
  if (!points?.length) return '';
  const f = n => Math.round(n * 100) / 100;
  if (points.length === 1) return `M${f(points[0].x)} ${f(points[0].y)}h0.01`;
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');
}

/**
 * Verify and decode a kept original (the /v1/originals view). The bytes are
 * re-hashed here: a page whose bytes do not match the digest the mark names is
 * not shown as the student's work. Returns
 *   { ok: true, kind: 'strokes', page, width, height, sha256 }
 *   { ok: true, kind: 'image', src, sha256 }
 *   { ok: false, reason }
 */
export async function openOriginal(view) {
  if (!view || typeof view !== 'object' || typeof view.sha256 !== 'string') return { ok: false, reason: 'missing' };
  try {
    if (view.kind === 'image') {
      const comma = String(view.data || '').indexOf(',');
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(String(view.data || '')) || comma < 0) return { ok: false, reason: 'format' };
      if (await sha256Hex(base64ToBytes(view.data.slice(comma + 1))) !== view.sha256) return { ok: false, reason: 'digest' };
      return { ok: true, kind: 'image', src: view.data, sha256: view.sha256 };
    }
    if (view.kind !== 'strokes') return { ok: false, reason: 'format' };
    const bytes = base64ToBytes(view.data || '');
    if (await sha256Hex(bytes) !== view.sha256) return { ok: false, reason: 'digest' };
    const page = decodeInk(bytes);
    return { ok: true, kind: 'strokes', page, width: page.width, height: page.height, sha256: view.sha256 };
  } catch { return { ok: false, reason: 'format' }; }
}

/**
 * The boxes to draw on the ink: one per marked line that names strokes on the
 * page. `marks` is [{ line (0-based reading line), status, n (shown number) }].
 * A line without kept strokes gets no box (it is still listed in words by the
 * caller): nothing is guessed.
 */
export function markBoxes(page, lines, marks, { pad = 6 } = {}) {
  if (!page || !Array.isArray(lines) || !Array.isArray(marks)) return [];
  return marks.flatMap(mark => {
    const region = lines[mark?.line];
    const box = region ? regionBox(page.strokes, region.strokes) : null;
    if (!box) return [];
    const status = MARK_STATUSES.includes(mark.status) ? mark.status : 'not-verified';
    return [{ line: mark.line, n: mark.n ?? mark.line + 1, status,
      x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad }];
  });
}

/**
 * The page's timeline for replay: each stroke's start and end (seconds on the
 * page clock), in the order written. A replay draws a stroke up to time `t`.
 */
export function timeline(page) {
  const all = page?.strokes || [];
  let end = 0;
  const spans = all.map(s => {
    const a = s.points[0]?.t ?? 0, b = s.points[s.points.length - 1]?.t ?? a;
    end = Math.max(end, b);
    return { start: a, end: b };
  });
  return { spans, end };
}

/** The samples of a stroke written by time `t` (a replay frame). */
export const pointsUntil = (stroke, t) => stroke.points.filter(p => p.t <= t);

/**
 * Whether a fetched original may be shown as THIS mark's work: only when the
 * mark names a digest and the record carries exactly that digest (the bytes
 * are then re-hashed by openOriginal). No digest named is not shown — a
 * record is never trusted to be the marked page on its own say-so.
 */
export function fetchedPhase(original, markSha256) {
  if (typeof markSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(markSha256)) return 'none';
  if (!original || typeof original !== 'object') return 'none';
  return original.sha256 === markSha256 ? 'ready' : 'mismatch';
}

/** The reading layer, for the small "what Pri read" line. */
export function readingLayer(reading) {
  if (!reading || typeof reading !== 'object') return null;
  const confirmed = typeof reading.confirmed === 'string' ? reading.confirmed : '';
  const read = typeof reading.read === 'string' ? reading.read : null;
  // What Pri read is shown only when the server still had it; a correction
  // without it is not shown as a reading.
  return { read, confirmed, corrected: read !== null && (reading.corrected === true || read !== confirmed),
    edits: Array.isArray(reading.edits) ? reading.edits.length : 0 };
}
