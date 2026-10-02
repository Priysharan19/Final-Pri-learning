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
      if (overlap > 0.2 * Math.min(h, Math.max(1, it.y2 - it.y1)) || (it.cy >= line.y1 - 0.15 * h && it.cy <= line.y2 + 0.15 * h)) {
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
