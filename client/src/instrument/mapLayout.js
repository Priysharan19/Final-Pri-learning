// Pri Learning · v1.1 instrument — the syllabus map's constellation layout.
//
// Pure and deterministic (no randomness, no clock): the same chapters and
// prerequisite edges always give the same picture. A chapter's column is its
// prerequisite depth inside this syllabus (the longest chain of in-scope
// chapters it builds on); within a depth, chapters keep syllabus order, and a
// crowded depth is split over several columns. Alternate columns are offset by
// half a row and each node gets a small fixed nudge from its syllabus index,
// so the drawing reads as a constellation rather than a grid. Labels sit to the
// right of the node, as the design draws them. Every node's box (dot, ring and
// both label lines) is then checked against every box already placed and
// against the reserved areas (the title at top left, the floating card at top
// right, the legend at bottom left); a colliding node moves down until it is
// clear, so no two labels or nodes overlap.

export const MAP_W = 1200;
const LEFT = 70;
const TOP = 130;          // under the title
const ROW = 118;
const PER_COL = 3;
const LABEL_CH = 7.4;     // px per character of the 13.5px label (estimated generously)
const LABEL_MAX = 24;     // characters per label line before it wraps
const GAP = 10;

export const radiusFor = mastery => 10 + (Math.max(0, Math.min(100, mastery)) / 100) * 18;

/** A chapter name in at most two lines of LABEL_MAX characters. */
export function wrapLabel(name, max = LABEL_MAX) {
  const words = String(name).split(/\s+/).filter(Boolean);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > max && lines.length < 2) lines.push(w);
    else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  if (lines[1] && lines[1].length > max + 2) lines[1] = lines[1].slice(0, max).trimEnd() + '…';
  return lines;
}

const hit = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** The box a node takes: its ring and its label lines to the right. */
export function nodeBox(x, y, r, lines) {
  const ring = r + 7;
  const textW = Math.max(...lines.map(l => l.length), 8) * LABEL_CH;
  const textTop = y - 12;
  const textBottom = y + 3 + (lines.length - 1) * 17 + 22;
  return { x1: x - ring - GAP, y1: Math.min(y - ring, textTop) - GAP, x2: x + r + 14 + textW + GAP, y2: Math.max(y + ring, textBottom) + GAP };
}

/**
 * @param chapters [{ id, name, mastery }] in syllabus order
 * @param prereqOf id → [prerequisite id] (any scope; out-of-scope ids are ignored)
 * @param reserve  { card: {w, h} | null } — the card's area at the top right, in map units
 */
export function constellation(chapters, prereqOf, reserve = {}) {
  const ids = new Set(chapters.map(c => c.id));
  const order = new Map(chapters.map((c, i) => [c.id, i]));
  const depth = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0;            // a cycle in authored edges never loops
    seen.add(id);
    const pre = (prereqOf(id) || []).filter(p => ids.has(p) && p !== id);
    const d = pre.length ? 1 + Math.max(...pre.map(p => depthOf(p, seen))) : 0;
    depth.set(id, d);
    return d;
  };
  chapters.forEach(c => depthOf(c.id));
  const levels = [...new Set(chapters.map(c => depth.get(c.id)))].sort((a, b) => a - b);
  const columns = [];
  for (const lv of levels) {
    const members = chapters.filter(c => depth.get(c.id) === lv).sort((a, b) => order.get(a.id) - order.get(b.id));
    const count = Math.ceil(members.length / PER_COL);
    const size = Math.ceil(members.length / count);
    for (let k = 0; k < count; k++) columns.push(members.slice(k * size, (k + 1) * size));
  }
  const longest = Math.max(8, ...chapters.map(c => Math.max(...wrapLabel(c.name).map(l => l.length))));
  const lastW = 28 + 14 + longest * LABEL_CH + 20;
  // Columns always fit MAP_W: the last column keeps room for its label.
  const colW = columns.length > 1 ? Math.max(0, (MAP_W - LEFT - lastW) / (columns.length - 1)) : 0;
  const blocked = [];
  if (reserve.card) blocked.push({ x1: MAP_W - reserve.card.w, y1: 0, x2: MAP_W + 1, y2: reserve.card.h });
  blocked.push({ x1: 0, y1: 0, x2: 560, y2: TOP - 40 });   // the title
  const placed = [];
  const nodes = [];
  columns.forEach((col, c) => {
    col.forEach((ch, k) => {
      const i = order.get(ch.id);
      const r = radiusFor(ch.mastery);
      const lines = wrapLabel(ch.name);
      const x = LEFT + c * colW + ((i * 37) % 5 - 2) * 6;
      let y = TOP + (c % 2) * (ROW / 2) + k * ROW + ((i * 53) % 7 - 3) * 4;
      let box = nodeBox(x, y, r, lines);
      for (let guard = 0; guard < 400 && [...placed, ...blocked].some(b => hit(b, box)); guard++) {
        y += 8; box = nodeBox(x, y, r, lines);
      }
      placed.push(box);
      nodes.push({ id: ch.id, x, y, r, lines, box, depth: depth.get(ch.id) });
    });
  });
  const height = Math.max(TOP + ROW * 2, ...placed.map(b => b.y2)) + 56;   // room for the legend
  return { nodes, height, width: MAP_W };
}

/** True when no two node boxes overlap (the probe and the unit check use it). */
export function overlaps(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) out.push([i, j]);
  return out;
}

// ── Strand register (luxury direction C) ────────────────────────────────────
// One column per strand (Number · Algebra · Geometry · Coordinates ·
// Trigonometry · Calculus · Data, only those present), chapters in syllabus
// order down each column, every node the same size (mastery is an arc, not a
// radius). Laid out in real pixels so the type is drawn at its true size. All
// columns sit in one row when they fit at MIN_COL px; otherwise they wrap into
// rows of `perRow` with a routing gutter between rows. Prerequisite links are
// drawn as orthogonal elbows that leave a node to the left, run in the clear
// gutter beside its column, cross between columns only in a channel above a
// row of nodes, and enter the other node from the left, so a line never
// crosses a label. Pure and deterministic; only the chapters' own strand and
// order, and the given links, are used.
export const STRAND_ORDER = ['number', 'algebra', 'geometry', 'coord', 'trig', 'calculus', 'data'];
export const NODE_R = 12;
const PAD_L = 34;          // room for the first column's gutter
const MIN_COL = 168;       // narrowest column that keeps 14px names readable
const ROW_TOP = 150;       // first row's nodes, under the title and headings
const HEAD_ABOVE = 40;     // strand heading baseline above a row's first node
const CHANNEL_ABOVE = 22;  // routing channel above a row's first node
const ROW_GAP = 96;        // between rows (headings, channel, gutter)
const NAME_CH = 7.6;       // px per character of the 14px STIX name
const GUTTER = 20;         // vertical lanes run this far left of a node

/** A name in up to `most` lines of `max` characters. */
function wrapLines(name, max, most) {
  const lines = [''];
  for (const w of String(name).split(/\s+/).filter(Boolean)) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > max && lines.length < most) lines.push(w);
    else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  return lines;
}

/**
 * @param chapters [{ id, name, strand }] in syllabus order
 * @param opts { width: px, reserveRight: px kept clear at the right }
 * @returns { nodes: [{ id, x, y, r, lines, col, band }], columns: [{ strand, x, headY, band }], rows: [{ top }], height, width }
 */
export function strandRegister(chapters, { width = MAP_W, reserveRight = 0, top: firstTop = ROW_TOP } = {}) {
  const present = new Set(chapters.map(c => c.strand));
  const strands = [...STRAND_ORDER.filter(s => present.has(s)), ...[...present].filter(s => !STRAND_ORDER.includes(s))];
  const usable = Math.max(MIN_COL, width - reserveRight - PAD_L);
  const perRow = Math.max(1, Math.min(strands.length, Math.floor(usable / MIN_COL)));
  const rowsOf = Math.ceil(strands.length / perRow);
  const balanced = Math.ceil(strands.length / rowsOf);   // 6 → 3 + 3, not 4 + 2
  const colW = usable / balanced;
  const maxCh = Math.max(9, Math.floor((colW - NODE_R * 2 - 26) / NAME_CH));
  const nodes = [];
  const columns = [];
  const rows = [];
  let top = firstTop;
  for (let r = 0; r < rowsOf; r++) {
    rows.push({ top });
    let bottom = top;
    strands.slice(r * balanced, (r + 1) * balanced).forEach((strand, ci) => {
      const x = PAD_L + NODE_R + ci * colW;
      columns.push({ strand, x, headY: top - HEAD_ABOVE, band: r });
      let y = top;
      for (const c of chapters.filter(ch => ch.strand === strand)) {
        const lines = wrapLines(c.name, maxCh, 3);
        nodes.push({ id: c.id, x, y, r: NODE_R, lines, col: columns.length - 1, band: r });
        y += Math.max(64, 30 + lines.length * 18 + 20);
      }
      bottom = Math.max(bottom, y);
    });
    top = bottom + ROW_GAP;
  }
  return { nodes, columns, rows, height: top - ROW_GAP + 70, width };
}

/**
 * An orthogonal elbow from node a to node b (1px lines, radius-4 joins):
 * left out of a into its gutter, along the routing channel above the row
 * (or the gutter between rows), down the gutter beside b, and right into b.
 * `lane` (0, 1, 2 …) separates links that share a channel.
 */
export function elbowPath(a, b, rows, lane = 0) {
  const R = 4;
  const ga = a.x - GUTTER - (lane % 4) * 3;
  const gb = b.x - GUTTER - (lane % 4) * 3;
  if (a.col === b.col) {
    // Same column: down (or up) the gutter beside it.
    const dir = b.y > a.y ? 1 : -1;
    return `M${a.x - a.r} ${a.y} L ${ga + R} ${a.y} A${R} ${R} 0 0 ${dir > 0 ? 0 : 1} ${ga} ${a.y + dir * R} L ${ga} ${b.y - dir * R} A${R} ${R} 0 0 ${dir > 0 ? 0 : 1} ${ga + R} ${b.y} L ${b.x - b.r} ${b.y}`;
  }
  const upper = Math.min(a.band, b.band);
  const lower = Math.max(a.band, b.band);
  const cy = (a.band === b.band ? rows[upper].top - CHANNEL_ABOVE : rows[lower].top - ROW_GAP / 2 - 8) - (lane % 4) * 3;
  const sx = gb > ga ? 1 : -1;
  // a → its gutter → up/down to the channel → across → down/up to b → into b.
  const v1 = cy < a.y ? -1 : 1;
  const v2 = b.y > cy ? 1 : -1;
  return [
    `M${a.x - a.r} ${a.y} L ${ga + R} ${a.y}`,
    `A${R} ${R} 0 0 ${v1 < 0 ? 1 : 0} ${ga} ${a.y + v1 * R}`,
    `L ${ga} ${cy - v1 * R}`,
    `A${R} ${R} 0 0 ${(v1 < 0) === (sx > 0) ? 1 : 0} ${ga + sx * R} ${cy}`,
    `L ${gb - sx * R} ${cy}`,
    `A${R} ${R} 0 0 ${(v2 > 0) === (sx > 0) ? 1 : 0} ${gb} ${cy + v2 * R}`,
    `L ${gb} ${b.y - v2 * R}`,
    `A${R} ${R} 0 0 ${v2 > 0 ? 0 : 1} ${gb + R} ${b.y}`,
    `L ${b.x - b.r} ${b.y}`
  ].join(' ');
}
