// Pri Learning · the syllabus map's layered layout.
//
// Pure and deterministic (no randomness, no clock): the same chapters and
// prerequisite edges always give the same picture.
//   · A chapter's LAYER (its column, left to right) is its prerequisite depth
//     inside this syllabus: the longest chain of in-scope chapters it builds
//     on. Layer 0 builds on nothing here.
//   · A chapter's LANE (its row band) is its strand. Lanes keep the order the
//     strands first appear in the syllabus; chapters in one lane and layer
//     stack in syllabus order.
//   · Each node is a dot, with its name and a plain status line centred under
//     it. A lane's chapters in one layer are stacked and centred on the lane's
//     middle, so a lane reads as a balanced band, not a ragged column.
// Every node's box (ring and name and status lines) is checked against every
// box already placed; a node that would collide moves down until it is clear.
//
// LINKS are routed, not ruled: each prerequisite link leaves its chapter's dot
// on the right, runs on an 8 px grid in horizontal and vertical segments only,
// and enters the dependent chapter's dot on the left. The route is the cheapest
// path (few bends, few shared tracks) that stays out of every other chapter's
// box, label included, and out of every strand heading, so a link never runs
// through a name and a long link goes round instead of across. Pure, so the
// same chapters give the same routes (client/test/map-layout-check.mjs proves
// no route meets a label for every course of both editions).

export const MAP_W = 1200;
const LEFT = 56;
const RIGHT = 28;
const LANE_HEAD = 40;     // the strand's label, above its row
const LANE_GAP = 24;
const STACK_GAP = 14;     // between two chapters of one layer in one lane
const LABEL_CH = 7.4;     // px per character of the 13.5px label (estimated generously)
const LABEL_MAX = 24;     // characters per label line before it wraps
const GAP = 8;
const GRID = 8;           // the links' track spacing; dots sit on it vertically
const MARGIN = 4;         // clearance kept between a link and any box
const CORNER = 6;         // radius of a link's corners
const HEAD_BOX = { w: 210, h: 34 };   // a strand's heading, top left of its lane

export const radiusFor = mastery => 13 + (Math.max(0, Math.min(100, mastery)) / 100) * 13;   // room for the chapter's glyph at every level

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
const textWidth = lines => Math.max(...lines.map(l => l.length), 14) * LABEL_CH;

/** The box a node takes: its ring, and its name lines and status line centred beneath. */
export function nodeBox(x, y, r, lines) {
  const ring = r + 6;
  const textW = textWidth(lines);
  return { x1: x - Math.max(ring, textW / 2) - GAP, y1: y - ring - GAP, x2: x + Math.max(ring, textW / 2) + GAP, y2: y + ring + 8 + lines.length * 17 + 18 + GAP };
}

/** Just the name and status lines of a node: what a link must never cross, even its own chapter's. */
export function labelBox(x, y, r, lines) {
  const textW = textWidth(lines);
  return { x1: x - textW / 2 - 2, y1: y + r + 8, x2: x + textW / 2 + 2, y2: nodeBox(x, y, r, lines).y2 - GAP };
}

/** Each chapter's layer: the longest chain of in-scope prerequisites under it. */
export function layersOf(chapters, prereqOf) {
  const ids = new Set(chapters.map(c => c.id));
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
  return depth;
}

// ── Link routing ────────────────────────────────────────────────────────────

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const TURN = 6;          // a bend costs as much as six cells of straight run
const SHARED = 4;        // a cell another chapter's link already uses

/** The grid cells a rectangle covers, grown by `grow` px. */
function cellsOf(rect, grow, cols, rows) {
  const out = [];
  const x1 = Math.max(0, Math.ceil((rect.x1 - grow) / GRID)), x2 = Math.min(cols - 1, Math.floor((rect.x2 + grow) / GRID));
  const y1 = Math.max(0, Math.ceil((rect.y1 - grow) / GRID)), y2 = Math.min(rows - 1, Math.floor((rect.y2 + grow) / GRID));
  for (let cy = y1; cy <= y2; cy++) for (let cx = x1; cx <= x2; cx++) out.push(cy * cols + cx);
  return out;
}

/** Drop interior points that sit on a straight run. */
function simplify(points) {
  const out = [];
  for (const p of points) {
    const n = out.length;
    if (n && out[n - 1].x === p.x && out[n - 1].y === p.y) continue;
    if (n >= 2) {
      const a = out[n - 2], b = out[n - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[n - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

/** A polyline as an SVG path with softly rounded corners. */
export function pathOf(points) {
  if (points.length < 2) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], p = points[i], b = points[i + 1];
    const l1 = Math.hypot(p.x - a.x, p.y - a.y), l2 = Math.hypot(b.x - p.x, b.y - p.y);
    const r1 = Math.min(CORNER, l1 / 2), r2 = Math.min(CORNER, l2 / 2);
    d += ` L${p.x - ((p.x - a.x) / l1) * r1} ${p.y - ((p.y - a.y) / l1) * r1}`;
    d += ` Q${p.x} ${p.y} ${p.x + ((b.x - p.x) / l2) * r2} ${p.y + ((b.y - p.y) / l2) * r2}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

/**
 * Route every link. `nodes` carry { id, x, y, r, box, lines }; `links` are
 * [{ from, to }] chapter ids, in a fixed order. A link goes from the right of
 * its prerequisite's dot to the left of its dependent's dot over the cheapest
 * orthogonal path that clears every other chapter's box, both ends' own name
 * and status lines, and every strand heading. Returns [{ from, to, points, d }].
 */
export function routeLinks(nodes, links, { width, height, lanes = [] }) {
  const cols = Math.ceil(width / GRID) + 1, rows = Math.ceil(height / GRID) + 1;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const base = new Uint8Array(cols * rows);
  for (const n of nodes) for (const c of cellsOf(n.box, MARGIN, cols, rows)) base[c] = 1;
  for (const lane of lanes) for (const c of cellsOf({ x1: 0, y1: lane.top, x2: HEAD_BOX.w, y2: lane.top + HEAD_BOX.h }, MARGIN, cols, rows)) base[c] = 1;
  const used = new Map();     // cell → [[from, to]] of links already routed through it
  const out = [];
  const states = cols * rows * 4;
  const best = new Float32Array(states);
  const prev = new Int32Array(states);
  for (const link of links) {
    const a = byId.get(link.from), b = byId.get(link.to);
    if (!a || !b) continue;
    const blocked = base.slice();
    // Its own two chapters are open to the link, except their name and status lines.
    for (const n of [a, b]) {
      for (const c of cellsOf(n.box, MARGIN, cols, rows)) blocked[c] = 0;
    }
    for (const n of [a, b]) for (const c of cellsOf(labelBox(n.x, n.y, n.r, n.lines), MARGIN, cols, rows)) blocked[c] = 1;
    // Other chapters' boxes stay blocked where they overlap the two open boxes.
    for (const n of nodes) if (n !== a && n !== b) for (const c of cellsOf(n.box, MARGIN, cols, rows)) blocked[c] = 1;
    const sx = Math.ceil((a.x + a.r + 6) / GRID), sy = Math.round(a.y / GRID);
    const ex = Math.floor((b.x - b.r - 6) / GRID), ey = Math.round(b.y / GRID);
    let found = null;
    if (sx <= ex && !blocked[sy * cols + sx] && !blocked[ey * cols + ex]) {
      best.fill(Infinity);
      const heap = new MinHeap();
      const s0 = (sy * cols + sx) * 4;
      best[s0] = 0; prev[s0] = -1;
      heap.push([Math.abs(ex - sx) + Math.abs(ey - sy), 0, s0]);
      while (heap.size) {
        const [, g, s] = heap.pop();
        if (g > best[s]) continue;
        const dir = s & 3, cell = s >> 2, cx = cell % cols, cy = (cell - cx) / cols;
        if (cx === ex && cy === ey && dir === 0) { found = s; break; }
        for (let nd = 0; nd < 4; nd++) {
          if (nd === ((dir + 2) & 3)) continue;
          const nx = cx + DX[nd], ny = cy + DY[nd];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const nc = ny * cols + nx;
          if (blocked[nc]) continue;
          let cost = 1 + (nd === dir ? 0 : TURN);
          const owners = used.get(nc);
          if (owners && owners.some(o => o[0] !== link.from && o[1] !== link.to)) cost += SHARED;
          const ng = g + cost, ns = nc * 4 + nd;
          if (ng < best[ns]) { best[ns] = ng; prev[ns] = s; heap.push([ng + Math.abs(ex - nx) + Math.abs(ey - ny), ng, ns]); }
        }
      }
    }
    let points;
    if (found !== null) {
      const cells = [];
      for (let s = found; s !== -1; s = prev[s]) { const c = s >> 2; cells.push({ x: (c % cols) * GRID, y: Math.floor(c / cols) * GRID }); }
      cells.reverse();
      points = simplify([{ x: a.x + a.r + 6, y: a.y }, ...cells, { x: b.x - b.r - 6, y: b.y }]);
      for (const p of cells) { const c = (p.y / GRID) * cols + p.x / GRID; (used.get(c) || used.set(c, []).get(c)).push([link.from, link.to]); }
    } else {
      // Nothing clear exists on the grid (only possible on a map far too narrow to draw): a plain elbow.
      const mx = (a.x + a.r + 6 + b.x - b.r - 6) / 2;
      points = simplify([{ x: a.x + a.r + 6, y: a.y }, { x: mx, y: a.y }, { x: mx, y: b.y }, { x: b.x - b.r - 6, y: b.y }]);
    }
    out.push({ from: link.from, to: link.to, points, d: pathOf(points), routed: found !== null });
  }
  return out;
}

/**
 * @param chapters [{ id, name, mastery, strand }] in syllabus order
 * @param prereqOf id → [prerequisite id] (any scope; out-of-scope ids are ignored)
 * @param opts     { width, top } — the drawing's width in map units, and where the
 *                 first lane starts (below the title, when the title floats over it)
 */
export function layered(chapters, prereqOf, { width = MAP_W, top: start = 8 } = {}) {
  const order = new Map(chapters.map((c, i) => [c.id, i]));
  const depth = layersOf(chapters, prereqOf);
  const layerCount = Math.max(1, ...chapters.map(c => depth.get(c.id) + 1));
  const lanes = [...new Set(chapters.map(c => c.strand))];
  const colW = (width - LEFT - RIGHT) / layerCount;
  const cell = (lane, layer) => chapters.filter(c => c.strand === lane && depth.get(c.id) === layer).sort((a, b) => order.get(a.id) - order.get(b.id));
  const sizeOf = ch => { const lines = wrapLabel(ch.name); const r = radiusFor(ch.mastery); const b = nodeBox(0, 0, r, lines); return { lines, r, h: b.y2 - b.y1 }; };
  const laneBands = [];
  const placed = [];
  const nodes = [];
  let top = start;
  for (const lane of lanes) {
    const stacks = Array.from({ length: layerCount }, (_, l) => cell(lane, l).map(sizeOf));
    const stackH = s => s.reduce((a, n) => a + n.h, 0) + Math.max(0, s.length - 1) * STACK_GAP;
    const inner = Math.max(...stacks.map(stackH), 0);
    const band = { strand: lane, top, height: LANE_HEAD + inner + 8 };
    for (let layer = 0; layer < layerCount; layer++) {
      const members = cell(lane, layer);
      let cursor = top + LANE_HEAD + (inner - stackH(stacks[layer])) / 2;
      members.forEach((ch, k) => {
        const { r, lines } = stacks[layer][k];
        const x = Math.round(LEFT + layer * colW + colW / 2);
        let y = Math.ceil((cursor + r + 6 + GAP) / GRID) * GRID;     // dots sit on the link grid
        let box = nodeBox(x, y, r, lines);
        for (let guard = 0; guard < 400 && placed.some(b => hit(b, box)); guard++) { y += GRID; box = nodeBox(x, y, r, lines); }
        placed.push(box);
        nodes.push({ id: ch.id, x, y, r, lines, box, layer, lane });
        cursor = box.y2 + STACK_GAP;
        band.height = Math.max(band.height, box.y2 - top + 8);
      });
    }
    laneBands.push(band);
    top += band.height + LANE_GAP;
  }
  const height = top + 36;
  const ids = new Set(chapters.map(c => c.id));
  const links = [];
  for (const c of chapters) for (const p of prereqOf(c.id) || []) if (ids.has(p) && p !== c.id) links.push({ from: p, to: c.id });
  const edges = routeLinks(nodes, links, { width, height, lanes: laneBands });
  return { nodes, edges, lanes: laneBands, layerCount, colW, height, width };
}

/** True when no two node boxes overlap. */
export function overlaps(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) out.push([i, j]);
  return out;
}

/** Every link segment that meets a chapter's box (or its own ends' name lines), or a strand heading. Empty is the contract. */
export function linkFaults(layout) {
  const faults = [];
  const byId = new Map(layout.nodes.map(n => [n.id, n]));
  for (const e of layout.edges) {
    const own = new Set([e.from, e.to]);
    for (let i = 0; i + 1 < e.points.length; i++) {
      const p = e.points[i], q = e.points[i + 1];
      const seg = { x1: Math.min(p.x, q.x), y1: Math.min(p.y, q.y), x2: Math.max(p.x, q.x), y2: Math.max(p.y, q.y) };
      const touches = r => seg.x1 <= r.x2 && r.x1 <= seg.x2 && seg.y1 <= r.y2 && r.y1 <= seg.y2;
      if (p.x !== q.x && p.y !== q.y) faults.push(`${e.from}→${e.to}: a diagonal segment`);
      for (const n of layout.nodes) {
        if (own.has(n.id) ? touches(labelBox(n.x, n.y, n.r, n.lines)) : touches(n.box)) faults.push(`${e.from}→${e.to}: runs through ${n.id}`);
      }
      for (const lane of layout.lanes) if (touches({ x1: 0, y1: lane.top, x2: HEAD_BOX.w, y2: lane.top + HEAD_BOX.h })) faults.push(`${e.from}→${e.to}: runs through the ${lane.strand} heading`);
      if (seg.x1 < 0 || seg.y1 < 0 || seg.x2 > layout.width || seg.y2 > layout.height) faults.push(`${e.from}→${e.to}: leaves the map`);
    }
    if (!e.routed) faults.push(`${e.from}→${e.to}: no clear route`);
    if (!byId.has(e.from) || !byId.has(e.to)) faults.push(`${e.from}→${e.to}: unknown chapter`);
  }
  return [...new Set(faults)];
}
