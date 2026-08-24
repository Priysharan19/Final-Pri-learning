// Pri Learning · stroke-grounded feedback geometry
//
// Marking feedback must point at the ink that produced a recognised step, not
// at one giant bounding rectangle. A written line can contain detached side
// working at the same y-position (for example a factor tree drawn on the right
// of an equation). Legacy line grouping may temporarily put both regions in one
// recognised line; painting line.box then highlights the empty space between
// them and can make the side working look like the marked algebra.
//
// This helper keeps feedback trace-addressable to recognised glyph boxes. It
// also chooses the dominant horizontally-connected component when a line has a
// truly detached region. The recognition result itself is not rewritten here:
// this is deliberately a presentation-safety boundary, not an OCR heuristic.

const finite = value => Number.isFinite(value) ? value : 0;

function symbolBox(symbol) {
  const b = symbol?.box;
  if (!b) return null;
  const x1 = finite(b.x1 ?? b.x);
  const y1 = finite(b.y1 ?? b.y);
  const x2 = finite(b.x2 ?? (x1 + finite(b.w)));
  const y2 = finite(b.y2 ?? (y1 + finite(b.h)));
  const w = x2 - x1;
  const h = y2 - y1;
  if (!(w >= 0) || !(h >= 0)) return null;
  return { x: x1, y: y1, w, h, x1, y1, x2, y2 };
}

function lineBox(line) {
  const b = line?.box;
  if (!b) return null;
  const x = finite(b.x ?? b.x1);
  const y = finite(b.y ?? b.y1);
  const w = finite(b.w ?? ((b.x2 ?? x) - x));
  const h = finite(b.h ?? ((b.y2 ?? y) - y));
  if (w < 0 || h < 0) return null;
  return { x, y, w, h, x1: x, y1: y, x2: x + w, y2: y + h };
}

const median = values => {
  const clean = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  return clean.length ? clean[Math.floor(clean.length / 2)] : 20;
};

function union(boxes) {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map(b => b.x1));
  const y1 = Math.min(...boxes.map(b => b.y1));
  const x2 = Math.max(...boxes.map(b => b.x2));
  const y2 = Math.max(...boxes.map(b => b.y2));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, x1, y1, x2, y2 };
}

/**
 * Return the exact glyph boxes that should receive a line verdict plus one
 * tight anchor box for the tick/cross and teacher note.
 *
 * Connectivity is intentionally conservative: ordinary spaces can be several
 * glyph heights wide and still remain one component. Only a gap > 3.2 median
 * glyph heights is treated as detached side work. When that happens the
 * component containing the most recognised glyphs wins; width then left-most
 * position break ties. That matches written-step geometry without using the
 * mathematical answer as a hint.
 */
export function feedbackGeometry(line) {
  const glyphs = (line?.symbols || [])
    .map((symbol, index) => ({ index, box: symbolBox(symbol) }))
    .filter(item => item.box)
    .sort((a, b) => a.box.x1 - b.box.x1 || a.box.y1 - b.box.y1);

  if (!glyphs.length) {
    const fallback = lineBox(line);
    return { boxes: fallback ? [fallback] : [], anchor: fallback, detached: false };
  }

  const medH = Math.max(8, median(glyphs.map(item => Math.max(item.box.h, Math.min(item.box.w, item.box.h * 2.5)))));
  const detachGap = Math.max(48, 3.2 * medH);
  const components = [];
  let current = [glyphs[0]];
  let right = glyphs[0].box.x2;

  for (let i = 1; i < glyphs.length; i++) {
    const item = glyphs[i];
    const gap = item.box.x1 - right;
    if (gap > detachGap) {
      components.push(current);
      current = [item];
      right = item.box.x2;
    } else {
      current.push(item);
      right = Math.max(right, item.box.x2);
    }
  }
  components.push(current);

  const ranked = components.map(items => {
    const boxes = items.map(item => item.box);
    const anchor = union(boxes);
    return { items, boxes, anchor };
  }).sort((a, b) =>
    b.items.length - a.items.length ||
    (b.anchor?.w || 0) - (a.anchor?.w || 0) ||
    (a.anchor?.x || 0) - (b.anchor?.x || 0)
  );

  const primary = ranked[0];
  return {
    boxes: primary?.boxes || [],
    anchor: primary?.anchor || lineBox(line),
    detached: ranked.length > 1,
    detachedCount: Math.max(0, ranked.length - 1)
  };
}
