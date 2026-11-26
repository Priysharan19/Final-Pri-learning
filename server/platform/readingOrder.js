// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading order of a two-column page, restored from the reader's own line boxes
//
// 27 Nov 2026 (real reader output for the owner's stationary-points page). The page has a second column beside the working ("d²y/dx² = 24x - 72",
// "At x = 0: d²y/dx² = -72 < 0", "(local maximum)", ...). The reader returned the lines in the order it met them going down the page, one left line then
// one right line, so "(local maximum)" followed "Stationary points when dy/dx = 0:" and lost the line it comments on; two lines became "not checked".
//
// What this does, from the boxes alone (the reader's own, normalised 0 to 1; no prompt change, no key, no model, answer-blind):
//   1. Find a gutter. A candidate x splits the page when the lines at or right of it are a column (three or more lines, three of them at least 0.15 of the
//      page wide, so a few margin words are not a column) and no line on the left reaches within 0.03 of it while sharing a row with the column.
//   2. Only when the reader's order interleaved the two (a right-column line is followed by a left-column line of the same band) is anything moved. A page in
//      one column, a page whose columns the reader already gave one after the other, and a page with no gutter are returned exactly as they came.
//   3. Moved: the lines of the band are read left column first, each column top to bottom, in the places the band's lines already occupied. Every other line
//      keeps its place. A short parenthetical line is the line below its parent in its own column, so it follows the line directly above it there.
//
// The function is idempotent and total: any input it cannot judge comes back untouched.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_LINES = 6;
const MIN_COLUMN_LINES = 3;
const WIDE = 0.15;          // a column has at least three lines this wide (of the page)
const SLACK = 0.015;        // how far left of the gutter a right-column line may start
const GAP = 0.03;           // the left column's lines stop this far short of the gutter, in the band
const MIN_GUTTER = 0.3;     // a right column starts right of 30 % of the page

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function boxOf(line) {
  const b = line?.box;
  if (!b || typeof b !== 'object') return null;
  const x = num(b.x), y = num(b.y), w = num(b.w), h = num(b.h);
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return null;
  return { x, y, w, h, right: x + w, bottom: y + h };
}

/** The gutter x of the page, with its right-column indexes and band, or null. */
export function findGutter(boxes) {
  const starts = [...new Set(boxes.map(b => Math.round(b.x * 1000) / 1000))].filter(x => x >= MIN_GUTTER && x <= 0.8).sort((a, b) => a - b);
  for (const s of starts) {
    const cut = s - SLACK;
    const right = boxes.map((b, i) => (b.x >= cut ? i : -1)).filter(i => i >= 0);
    if (right.length < MIN_COLUMN_LINES || right.filter(i => boxes[i].w >= WIDE).length < MIN_COLUMN_LINES) continue;
    const top = Math.min(...right.map(i => boxes[i].y));
    const bottom = Math.max(...right.map(i => boxes[i].bottom));
    const inBand = i => boxes[i].y < bottom && boxes[i].bottom > top;
    const left = boxes.map((b, i) => (b.x < cut && inBand(i) ? i : -1)).filter(i => i >= 0);
    if (left.length < MIN_COLUMN_LINES) continue;
    if (left.some(i => boxes[i].right > cut - GAP)) continue;      // a line crosses into the column: not two columns
    return { x: s, right, left, top, bottom };
  }
  return null;
}

/**
 * The lines in reading order. `lines` are reader lines ({ text, box: { x, y, w, h } }, boxes as fractions of the page).
 * Returns { lines, reordered }; `lines` is the same array when nothing moved.
 */
export function restoreReadingOrder(lines) {
  if (!Array.isArray(lines) || lines.length < MIN_LINES) return { lines, reordered: false };
  const boxes = lines.map(boxOf);
  if (boxes.some(b => !b)) return { lines, reordered: false };
  const gutter = findGutter(boxes);
  if (!gutter) return { lines, reordered: false };
  const isRight = new Set(gutter.right);
  const isLeft = new Set(gutter.left);
  // Already one column after the other (or the right column first, whole): nothing to restore. Interleaved = a right line has a left line of the band after it.
  let seenRight = false, interleaved = false;
  lines.forEach((_, i) => {
    if (isRight.has(i)) seenRight = true;
    else if (isLeft.has(i) && seenRight) interleaved = true;
  });
  if (!interleaved) return { lines, reordered: false };
  const byRow = (a, b) => boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x || a - b;
  const order = [...gutter.left].sort(byRow).concat([...gutter.right].sort(byRow));
  const slots = [...gutter.left, ...gutter.right].sort((a, b) => a - b);
  const next = lines.slice();
  slots.forEach((slot, k) => { next[slot] = lines[order[k]]; });
  return { lines: next, reordered: next.some((l, i) => l !== lines[i]) };
}
