// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading order of a two-column page, restored from the reader's own line boxes
//
// 27 Nov 2026 (real reader output for the owner's stationary-points page). The page has a second column beside the working ("d²y/dx² = 24x - 72",
// "At x = 0: d²y/dx² = -72 < 0", "(local maximum)", ...). The reader returned the lines in the order it met them going down the page, one left line then
// one right line, so "(local maximum)" followed "Stationary points when dy/dx = 0:" and lost the line it comments on; two lines became "not checked".
//
// Conservative by design (independent review of PR #1140): the reader's order is changed ONLY when all of these hold, from the reader's own boxes
// (normalised 0 to 1; no prompt change, no key, no model, answer-blind):
//   1. exactly two columns: lines at or right of a gutter x are a column of three or more lines (three of them at least 0.15 of the page wide), the left
//      column has three or more lines in the same band, and the left-edges of the band's lines make exactly two clusters of three or more lines
//      (a three-column table is not two columns);
//   2. a clear gap for the whole shared height: no line of the band reaches within 0.03 of the gutter;
//   3. it is not a table: fewer than 60 % of the left lines have a right line on the same baseline (a table's rows align pairwise, row after row; the
//      reader already reads a table row by row);
//   4. the reader's order is demonstrably interleaved: inside the band it alternates between the columns at least twice.
// Otherwise the input is returned as it came (the same array).
//
// When applied the result is a complete partition of the band. Lines that reach across the gutter stay where their position puts them and split the page
// into bands, top to bottom; the band that holds the two columns is read as every left-column line (top to bottom) and then every right-column line, in the
// places those lines already held. No line is left between the other column's lines. A short parenthetical line is the line below its parent in its own
// column, so it follows the line directly above it there. Idempotent and total: any input it cannot judge comes back untouched.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_LINES = 6;
const MIN_COLUMN_LINES = 3;
const WIDE = 0.15;          // a column has at least three lines this wide (of the page)
const SLACK = 0.015;        // how far left of the gutter a right-column line may start
const GAP = 0.03;           // the left column's lines stop this far short of the gutter, in the band
const MIN_GUTTER = 0.3;     // a right column starts right of 30 % of the page
const CLUSTER = 0.04;       // left edges closer than this are one column
const TABLE_SHARE = 0.6;    // this share of left lines with a right line on the same baseline: a table
const BASELINE = 0.25;      // same baseline: centres within this fraction of the shorter box's height

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function boxOf(line) {
  const b = line?.box;
  if (!b || typeof b !== 'object') return null;
  const x = num(b.x), y = num(b.y), w = num(b.w), h = num(b.h);
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return null;
  return { x, y, w, h, right: x + w, bottom: y + h, cy: y + h / 2 };
}

/** Clusters of left edges (a run of sorted edges, each within CLUSTER of the one before it) with at least `min` members. */
function wideClusters(edges, min) {
  const sorted = [...edges].sort((a, b) => a - b);
  let runs = 0, size = 0, last = null;
  for (const e of sorted) {
    if (last !== null && e - last <= CLUSTER) size += 1;
    else { if (size >= min) runs += 1; size = 1; }
    last = e;
  }
  if (size >= min) runs += 1;
  return runs;
}

/** The gutter x of the page, with its right-column indexes, the band's left indexes and the band, or null. */
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
    // exactly two columns: the band's left edges make two clusters of three or more lines, no more
    if (wideClusters([...left, ...right].map(i => boxes[i].x), MIN_COLUMN_LINES) !== 2) continue;
    return { x: s, cut, right, left, top, bottom };
  }
  return null;
}

/** Do at least TABLE_SHARE of the left lines have a right line on the same baseline? */
function isTable(boxes, left, right) {
  const aligned = left.filter(i => right.some(j => Math.abs(boxes[i].cy - boxes[j].cy) <= BASELINE * Math.min(boxes[i].h, boxes[j].h)));
  return aligned.length >= TABLE_SHARE * left.length;
}

/** The reordering of one region of the page (indexes into `lines`), as a list of [slot, index], or null when it must be left as it is. */
function regionOrder(boxes, idx) {
  if (idx.length < MIN_LINES) return null;
  const sub = idx.map(i => boxes[i]);
  const g = findGutter(sub);
  if (!g) return null;
  const isRight = new Set(g.right.map(k => idx[k]));
  const left = g.left.map(k => idx[k]);
  const reach = i => boxes[i].x < g.cut && boxes[i].right > g.cut - GAP;          // a line that runs to or across the gutter
  // The band of the two columns: from the last line that reaches the gutter above it to the first below it.
  let segTop = -Infinity, segBottom = Infinity;
  for (const i of idx) {
    const b = boxes[i];
    if (isRight.has(i) || !reach(i)) continue;
    if (b.bottom <= g.top + 1e-9) segTop = Math.max(segTop, b.bottom);
    else if (b.y >= g.bottom - 1e-9) segBottom = Math.min(segBottom, b.y);
  }
  const members = idx.filter(i => !reach(i) && boxes[i].bottom > segTop + 1e-9 && boxes[i].y < segBottom - 1e-9 && (isRight.has(i) || boxes[i].x < g.cut));
  const leftAll = members.filter(i => !isRight.has(i));
  if (leftAll.length < MIN_COLUMN_LINES) return null;
  if (isTable(boxes, left, [...isRight])) return null;
  // interleaved: in the reader's order the band alternates between the columns at least twice
  let switches = 0, prev = null;
  for (const i of members) {
    const side = isRight.has(i) ? 'R' : 'L';
    if (prev !== null && side !== prev) switches += 1;
    prev = side;
  }
  if (switches < 2) return null;
  const byRow = (a, b) => boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x || a - b;
  const order = [...leftAll].sort(byRow).concat([...isRight].sort(byRow));
  const slots = [...members].sort((a, b) => a - b);
  if (order.length !== slots.length) return null;
  return slots.map((slot, k) => [slot, order[k]]);
}

/**
 * The lines in reading order. `lines` are reader lines ({ text, box: { x, y, w, h } }, boxes as fractions of the page).
 * Lines wider than half the page split the page into bands (top to bottom); each band is judged on its own.
 * Returns { lines, reordered }; `lines` is the same array when nothing moved.
 */
export function restoreReadingOrder(lines) {
  const same = { lines, reordered: false };
  if (!Array.isArray(lines) || lines.length < MIN_LINES) return same;
  const boxes = lines.map(boxOf);
  if (boxes.some(b => !b)) return same;
  const wide = boxes.map((b, i) => (b.w >= 0.5 ? i : -1)).filter(i => i >= 0).sort((a, b) => boxes[a].y - boxes[b].y);
  const regions = [];
  let from = -Infinity;
  for (const w of [...wide, null]) {
    const to = w === null ? Infinity : boxes[w].y;
    regions.push(boxes.map((_, i) => i).filter(i => i !== w && !wide.includes(i) && boxes[i].cy > from && boxes[i].cy < to));
    if (w !== null) from = boxes[w].bottom;
  }
  // a wide line that is itself in a region of its own is also part of the whole-page pass below
  const next = lines.slice();
  for (const idx of [boxes.map((_, i) => i), ...regions]) {
    const plan = regionOrder(boxes, idx);
    if (plan && idx.length === boxes.length) { plan.forEach(([slot, k]) => { next[slot] = lines[k]; }); break; }
    if (plan) plan.forEach(([slot, k]) => { next[slot] = lines[k]; });
  }
  return next.some((l, i) => l !== lines[i]) ? { lines: next, reordered: true } : same;
}
