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
//     it, so a link drawn from dot to dot never crosses its own label.
// Every node's box (ring and both text lines) is checked against every box
// already placed and against the reserved area (the floating card at top
// right); a node that would collide moves down until it is clear.

export const MAP_W = 1200;
const LEFT = 56;
const RIGHT = 36;
const LANE_HEAD = 34;     // the strand's label, above its row
const LANE_GAP = 26;
const ROW = 138;          // dot, two name lines, one status line
const LABEL_CH = 7.4;     // px per character of the 13.5px label (estimated generously)
const LABEL_MAX = 24;     // characters per label line before it wraps
const GAP = 8;

export const radiusFor = mastery => 9 + (Math.max(0, Math.min(100, mastery)) / 100) * 15;

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

/** The box a node takes: its ring, and its name lines and status line centred beneath. */
export function nodeBox(x, y, r, lines) {
  const ring = r + 6;
  const textW = Math.max(...lines.map(l => l.length), 14) * LABEL_CH;
  return { x1: x - Math.max(ring, textW / 2) - GAP, y1: y - ring - GAP, x2: x + Math.max(ring, textW / 2) + GAP, y2: y + ring + 8 + lines.length * 17 + 18 + GAP };
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

/**
 * @param chapters [{ id, name, mastery, strand }] in syllabus order
 * @param prereqOf id → [prerequisite id] (any scope; out-of-scope ids are ignored)
 * @param opts     { width, card: {w, h} | null, top } — the drawing's width in map units
 *                 (less than MAP_W when a floating card takes the right edge) and where
 *                 the first lane starts (below the title, when the title floats over it)
 */
export function layered(chapters, prereqOf, { width = MAP_W, card = null, top: start = 8 } = {}) {
  const order = new Map(chapters.map((c, i) => [c.id, i]));
  const depth = layersOf(chapters, prereqOf);
  const layerCount = Math.max(1, ...chapters.map(c => depth.get(c.id) + 1));
  const lanes = [...new Set(chapters.map(c => c.strand))];
  const colW = (width - LEFT - RIGHT) / layerCount;
  const cell = (lane, layer) => chapters.filter(c => c.strand === lane && depth.get(c.id) === layer).sort((a, b) => order.get(a.id) - order.get(b.id));
  const laneBands = [];
  const placed = [];
  const nodes = [];
  const blocked = card ? [{ x1: MAP_W - card.w, y1: 0, x2: MAP_W + 1, y2: card.h }] : [];
  let top = start;
  for (const lane of lanes) {
    const rows = Math.max(1, ...Array.from({ length: layerCount }, (_, l) => cell(lane, l).length));
    const band = { strand: lane, top, height: LANE_HEAD + rows * ROW };
    for (let layer = 0; layer < layerCount; layer++) {
      cell(lane, layer).forEach((ch, k) => {
        const r = radiusFor(ch.mastery);
        const lines = wrapLabel(ch.name);
        const x = LEFT + layer * colW + colW / 2 - 8;
        let y = top + LANE_HEAD + k * ROW + 26;
        let box = nodeBox(x, y, r, lines);
        for (let guard = 0; guard < 400 && [...placed, ...blocked].some(b => hit(b, box)); guard++) { y += 6; box = nodeBox(x, y, r, lines); }
        placed.push(box);
        nodes.push({ id: ch.id, x, y, r, lines, box, layer, lane });
        band.height = Math.max(band.height, box.y2 - top);
      });
    }
    laneBands.push(band);
    top += band.height + LANE_GAP;
  }
  // A node pushed below its lane by the card never overlaps the next lane's.
  return { nodes, lanes: laneBands, layerCount, colW, height: Math.max(top, card ? card.h : 0) + 52, width };
}

/** True when no two node boxes overlap. */
export function overlaps(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) out.push([i, j]);
  return out;
}
