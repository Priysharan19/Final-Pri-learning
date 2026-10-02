// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where the lines of ink are (geometry only — no recognition)
//
// The server reader returns text without coordinates. To draw ✓/✗ on the
// student's own lines, the page needs to know where each written line sits.
// This groups strokes into lines by vertical overlap and returns one box per
// line, top to bottom. It reads nothing: it never names a symbol.
// ─────────────────────────────────────────────────────────────────────────────
import { inkBounds } from './cloudRaster.js';

/** One { box: {x, y, w, h}, strokeIdxs } per written line, top to bottom. */
export function segmentInkLines(strokes) {
  const items = [];
  (strokes || []).forEach((stroke, i) => {
    const b = inkBounds([stroke]);
    if (b) items.push({ i, x1: b.minX, y1: b.minY, x2: b.maxX, y2: b.maxY, cy: (b.minY + b.maxY) / 2 });
  });
  items.sort((a, b) => a.cy - b.cy);
  const lines = [];
  for (const it of items) {
    const line = lines.at(-1);
    if (line) {
      const h = Math.max(1, line.y2 - line.y1);
      const overlap = Math.min(line.y2, it.y2) - Math.max(line.y1, it.y1);
      // Same line when the stroke overlaps the line vertically, or its centre
      // sits within the line's band (a dot, a minus sign, a short stroke).
      // A flat stroke (a minus sign) can start a line before the digit beside
      // it, so the test runs both ways: either centre inside the other's band.
      const lineCy = (line.y1 + line.y2) / 2;
      const itH = Math.max(1, it.y2 - it.y1);
      if (overlap > 0.2 * Math.min(h, itH)
        || (it.cy >= line.y1 - 0.15 * h && it.cy <= line.y2 + 0.15 * h)
        || (lineCy >= it.y1 - 0.15 * itH && lineCy <= it.y2 + 0.15 * itH)) {
        line.y1 = Math.min(line.y1, it.y1); line.y2 = Math.max(line.y2, it.y2);
        line.x1 = Math.min(line.x1, it.x1); line.x2 = Math.max(line.x2, it.x2);
        line.strokeIdxs.push(it.i);
        continue;
      }
    }
    lines.push({ x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2, strokeIdxs: [it.i] });
  }
  return lines.map(l => ({
    box: { x: l.x1, y: l.y1, w: Math.max(1, l.x2 - l.x1), h: Math.max(1, l.y2 - l.y1) },
    strokeIdxs: l.strokeIdxs.sort((a, b) => a - b)
  }));
}

const tokens = text => String(text || '').replace(/\s+/g, '').length;

/**
 * Whether server line i can honestly be drawn on written line i. The counts
 * must agree, and each line's share of the writing must roughly match its
 * share of the reading: a line read as "x = 4" should not be the widest line
 * on the page when another is read as "2x + 3 = 11". Lines are compared by
 * width relative to the page (ink width per character is the student's own
 * hand, so only proportions are trusted), within a factor of 3.
 */
export function plausibleLineMatch(readLines, segments) {
  const read = Array.isArray(readLines) ? readLines : [];
  const segs = Array.isArray(segments) ? segments : [];
  if (!read.length || read.length !== segs.length) return false;
  if (read.length === 1) return tokens(read[0]?.text) > 0;
  const lens = read.map(l => tokens(l?.text));
  if (lens.some(n => n === 0)) return false;
  const widths = segs.map(sg => Math.max(1, sg.box?.w || 0));
  const totalLen = lens.reduce((a, b) => a + b, 0);
  const totalW = widths.reduce((a, b) => a + b, 0);
  return lens.every((n, i) => {
    const ratio = (widths[i] / totalW) / (n / totalLen);
    return ratio >= 1 / 3 && ratio <= 3;
  });
}
