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
const PER_COL = 4;
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
  const colW = columns.length > 1 ? Math.max(120, (MAP_W - LEFT - lastW) / (columns.length - 1)) : 0;
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
