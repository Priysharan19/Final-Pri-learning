// Pri Learning · runtime spatial guard for the legacy JS fallback
//
// The v3 recogniser was designed around one main column of written steps. Its
// internal line splitter links any glyphs that share a y-band, even if they are
// hundreds of pixels apart. On an iPad that makes perfectly normal side work —
// factor trees, quick arithmetic, a small sketch — contaminate the equation on
// the left. This guard does not guess maths or change glyph labels. It only
// removes a clearly detached auxiliary lane before the legacy recogniser sees
// the page. Structural V4 already performs locality-aware row partitioning, so
// this exists solely to make the emergency V3 fallback fail less destructively.

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function strokeBox(stroke) {
  const pts = stroke?.points || [];
  if (!pts.length) return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0, cx: 0, cy: 0 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) {
    const x = number(p.x), y = number(p.y);
    x1 = Math.min(x1, x); y1 = Math.min(y1, y);
    x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function unionBox(boxes) {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map(b => b.x1));
  const y1 = Math.min(...boxes.map(b => b.y1));
  const x2 = Math.max(...boxes.map(b => b.x2));
  const y2 = Math.max(...boxes.map(b => b.y2));
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

const median = (values, fallback = 20) => {
  const clean = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  return clean.length ? clean[Math.floor(clean.length / 2)] : fallback;
};

const hGap = (a, b) => Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2);

/** Conservative physical-stroke rows. This mirrors the locality principle used
 * by Structural V4 but stays intentionally simpler: no symbol knowledge and no
 * answer context enter the decision. */
export function spatialRows(strokes) {
  const live = (strokes || []).map((stroke, index) => ({ stroke, index, box: strokeBox(stroke) }))
    .filter(item => (item.stroke?.points || []).length);
  const n = live.length;
  if (!n) return { rows: [], scale: 20 };
  if (n === 1) return { rows: [[live[0].index]], scale: Math.max(8, live[0].box.h || live[0].box.w || 20) };

  const scales = live.map(({ box }) => Math.max(box.h, Math.min(box.w, Math.max(1, box.h * 2.5))));
  const scale = Math.max(8, median(scales, 20));
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    const a = live[i].box;
    for (let j = i + 1; j < n; j++) {
      const b = live[j].box;
      const yOverlap = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      const minH = Math.max(1, Math.min(Math.max(a.h, 0.35 * a.w), Math.max(b.h, 0.35 * b.w)));
      const centreDy = Math.abs(a.cy - b.cy);
      const xGap = hGap(a, b);
      const band = yOverlap > 0.20 * minH || centreDy < 0.72 * scale;
      const nearby = xGap < 1.35 * scale;
      const barBridge = Math.max(a.w, b.w) > 1.4 * scale && centreDy < 1.55 * scale && xGap < 0.45 * scale;
      if ((band && nearby) || barBridge) join(i, j);
    }
  }

  const grouped = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(i);
  }
  let rows = [...grouped.values()];

  // Tiny isolated marks are often exponents, decimal points or primes. Attach
  // them to the nearest substantial row when the geometry is local instead of
  // incorrectly creating a one-dot side lane.
  const substantial = rows.filter(row => row.length > 1 || Math.max(live[row[0]].box.w, live[row[0]].box.h) >= 0.30 * scale);
  for (const row of [...rows]) {
    if (substantial.includes(row) || row.length !== 1) continue;
    const item = live[row[0]], b = item.box;
    let best = null;
    for (const target of substantial) {
      const tb = unionBox(target.map(k => live[k].box));
      const dx = tb.x1 <= b.cx && b.cx <= tb.x2 ? 0 : Math.min(Math.abs(b.cx - tb.x1), Math.abs(b.cx - tb.x2));
      const dy = Math.abs(b.cy - tb.cy);
      const score = dx + 0.7 * dy;
      if (dx < 0.9 * scale && dy < 1.05 * scale && (!best || score < best.score)) best = { score, target };
    }
    if (best) {
      best.target.push(row[0]);
      rows = rows.filter(candidate => candidate !== row);
    }
  }

  const mapped = rows.map(row => row.map(k => live[k].index).sort((a, b) => a - b));
  mapped.sort((a, b) => median(a.map(i => strokeBox(strokes[i]).cy), 0) - median(b.map(i => strokeBox(strokes[i]).cy), 0));
  return { rows: mapped, scale };
}

function chooseMainLane(rows, strokes, scale) {
  if (rows.length <= 1) return { selected: rows, ignored: [] };
  const info = rows.map((indices, i) => ({
    i,
    indices,
    box: unionBox(indices.map(index => strokeBox(strokes[index])))
  }));
  const parent = info.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < info.length; i++) {
    for (let j = i + 1; j < info.length; j++) {
      const a = info[i].box, b = info[j].box;
      const overlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const overlapEnough = overlap > 0.12 * Math.max(1, Math.min(a.w, b.w));
      const leftAligned = Math.abs(a.x1 - b.x1) < 2.8 * scale;
      const centreAligned = Math.abs(a.cx - b.cx) < 4.0 * scale;
      if (overlapEnough || leftAligned || centreAligned) join(i, j);
    }
  }

  const lanes = new Map();
  info.forEach((row, i) => {
    const root = find(i);
    if (!lanes.has(root)) lanes.set(root, []);
    lanes.get(root).push(row);
  });
  if (lanes.size <= 1) return { selected: rows, ignored: [] };

  const ranked = [...lanes.values()].map(lane => {
    const box = unionBox(lane.map(r => r.box));
    const strokeCount = lane.reduce((sum, r) => sum + r.indices.length, 0);
    // A staggered scratch column fragments into many single-stroke rows, so raw
    // row count would let it outvote the real working. Only multi-stroke rows
    // count as written steps; ink mass breaks ties between step-less lanes.
    const stepRows = lane.filter(r => r.indices.length >= 2).length;
    const score = stepRows * 1000 + strokeCount * 25 + Math.min(20, box.w / Math.max(scale, 1));
    return { lane, box, strokeCount, score };
  }).sort((a, b) => b.score - a.score || a.box.x1 - b.box.x1);

  const best = ranked[0];
  const ignored = [];
  const selected = [...best.lane];
  for (const candidate of ranked.slice(1)) {
    const gap = hGap(best.box, candidate.box);
    const clearlyDetached = gap > 3.2 * scale;
    const bestHasStepColumn = best.lane.length >= 2;
    const bestIsSubstantiallyLarger = best.strokeCount >= candidate.strokeCount + 2;
    if (clearlyDetached && (bestHasStepColumn || bestIsSubstantiallyLarger)) ignored.push(...candidate.lane);
    else selected.push(...candidate.lane);
  }

  selected.sort((a, b) =>
    median(a.indices.map(i => strokeBox(strokes[i]).cy), 0) -
    median(b.indices.map(i => strokeBox(strokes[i]).cy), 0)
  );
  return { selected: selected.map(r => r.indices), ignored: ignored.map(r => r.indices) };
}

function externalId(symbol, localToGlobal) {
  const globals = (symbol.strokeIdxs || []).map(i => localToGlobal[i]).filter(i => i !== undefined);
  return `g${globals.join('_')}:${symbol.id}`;
}

function remapResult(result, localToGlobal) {
  const remapSymbol = symbol => ({
    ...symbol,
    id: externalId(symbol, localToGlobal),
    strokeIdxs: (symbol.strokeIdxs || []).map(i => localToGlobal[i]).filter(i => i !== undefined)
  });
  const lines = (result.lines || []).map(line => ({ ...line, symbols: (line.symbols || []).map(remapSymbol) }));
  return {
    ...result,
    lines,
    symbols: (result.symbols || []).map(remapSymbol),
    text: lines.map(line => line.text).join('\n')
  };
}

// A one-symbol answer has no neighbouring glyphs, so the legacy recogniser's
// local s/5, z/2, b/6… context pass cannot fire and its grammar beam deliberately
// exits early. On a question that explicitly asks for an INTEGER we still know
// one answer-blind fact: a lone letter is outside a numeric answer's legal
// single-glyph alphabet. Use that fact only to break a genuine classifier
// near-tie. This never consults ctx.expected, never turns one digit into another,
// and never invents a digit that the glyph classifier itself did not propose.
const SINGLE_GLYPH_DIGIT_TWIN = { s: '5', z: '2', b: '6', u: '4', g: '9', q: '9' };
const SINGLE_GLYPH_NEAR_TIE_SHARE = 0.90;
// A canonical 5 can be visually s-like after pointer filtering. We do NOT
// lower the generic context threshold for that case. Instead, a much weaker
// 5 alternative may be promoted only when the physical trajectory has the
// defining 5 structure: a long top sweep, an early leftmost turn, then a
// lower bowl that exits back to the right. Pri's s templates continue to
// their leftmost endpoint, so they fail this shape test.
const STRUCTURAL_FIVE_ALT_SHARE = 0.35;
const pointXY = p => ({ x: number(p?.x ?? p?.[0]), y: number(p?.y ?? p?.[1]) });
const strokePoints = stroke => (stroke?.points || []).map(pointXY).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

function pathMeasurements(points) {
  if (points.length < 4) return null;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  if (!(total > 0)) return null;
  return { lengths, total };
}

function prefixAtFraction(points, measurements, fraction) {
  const target = measurements.total * fraction;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (measurements.lengths[i] <= target) { out.push(points[i]); continue; }
    const before = measurements.lengths[i - 1];
    const seg = measurements.lengths[i] - before;
    const t = seg > 0 ? Math.max(0, Math.min(1, (target - before) / seg)) : 0;
    out.push({
      x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
      y: points[i - 1].y + t * (points[i].y - points[i - 1].y)
    });
    break;
  }
  return out;
}

function oneStrokeFiveStructure(points, box) {
  const m = pathMeasurements(points);
  if (!m || box.w <= 1e-6 || box.h <= 1e-6) return false;
  let minIndex = 0;
  for (let i = 1; i < points.length; i++) if (points[i].x < points[minIndex].x) minIndex = i;
  const start = points[0], end = points[points.length - 1];
  const startX = (start.x - box.x1) / box.w;
  const startY = (start.y - box.y1) / box.h;
  const endX = (end.x - box.x1) / box.w;
  const endY = (end.y - box.y1) / box.h;
  const minProgress = m.lengths[minIndex] / m.total;
  const rebound = (end.x - points[minIndex].x) / box.w;
  const prefix = prefixAtFraction(points, m, 0.18);
  const prefixYs = prefix.map(p => p.y);
  const prefixXs = prefix.map(p => p.x);
  const topSpan = (Math.max(...prefixYs) - Math.min(...prefixYs)) / box.h;
  const topSweep = (start.x - Math.min(...prefixXs)) / box.w;
  return startX >= 0.65 && startY <= 0.25 &&
    endX >= 0.30 && endY >= 0.65 &&
    minProgress >= 0.22 && minProgress <= 0.72 && rebound >= 0.26 &&
    topSweep >= 0.30 && topSpan <= 0.085;
}

export function hasStructuralFiveEvidence(symbol) {
  const strokes = (symbol?._group?.strokes || []).filter(stroke => (stroke?.points || []).length >= 2);
  if (!strokes.length || strokes.length > 2) return false;
  const boxes = strokes.map(strokeBox);
  const box = unionBox(boxes);
  if (!box || box.w <= 1e-6 || box.h <= 1e-6) return false;
  if (strokes.length === 1) return oneStrokeFiveStructure(strokePoints(strokes[0]), box);

  // The second stock 5 allograph lifts the Pencil after the top bar.
  // Accept that form only when one stroke is a wide, very flat top bar and
  // the other is a lower stem/bowl ending well right of its left edge.
  let topBar = -1;
  for (let i = 0; i < 2; i++) {
    const b = boxes[i];
    const cy = (b.cy - box.y1) / box.h;
    if (b.w >= 0.45 * box.w && b.h <= 0.12 * box.h && cy <= 0.24) topBar = i;
  }
  if (topBar < 0) return false;
  const body = strokePoints(strokes[1 - topBar]);
  const m = pathMeasurements(body);
  if (!m || body.length < 4) return false;
  const bodyBox = strokeBox(strokes[1 - topBar]);
  const end = body[body.length - 1];
  const endX = (end.x - box.x1) / box.w;
  const endY = (end.y - box.y1) / box.h;
  let minIndex = 0;
  for (let i = 1; i < body.length; i++) if (body[i].x < body[minIndex].x) minIndex = i;
  const minProgress = m.lengths[minIndex] / m.total;
  const rebound = (end.x - body[minIndex].x) / box.w;
  return bodyBox.h >= 0.55 * box.h && endX >= 0.30 && endY >= 0.65 && minProgress <= 0.35 && rebound >= 0.24;
}

export function repairSingleGlyphQuestionContext(result, ctx) {
  const answerType = String(ctx?.answerType || '').toLowerCase();
  if (!result || (answerType !== 'numeric' && answerType !== 'integer')) return result;
  // Production numeric questions use a dedicated one-glyph alphabet so this
  // repair cannot leak into the general grammar beam. `alphabet` remains a
  // compatibility path for the older explicit `integer` research context.
  const rawAlphabet = Array.isArray(ctx?.singleGlyphAlphabet)
    ? ctx.singleGlyphAlphabet
    : (answerType === 'integer' && Array.isArray(ctx?.alphabet) ? ctx.alphabet : null);
  const alphabet = rawAlphabet ? new Set(rawAlphabet.map(String)) : null;
  if (!alphabet || !alphabet.size) return result;
  const lines = result.lines || [];
  if (lines.length !== 1) return result;
  const line = lines[0];
  const symbols = line.symbols || [];
  if (symbols.length !== 1) return result;
  const symbol = symbols[0];
  if (!symbol || symbol.composite || /^[0-9]$/.test(symbol.sym)) return result;
  const digit = SINGLE_GLYPH_DIGIT_TWIN[symbol.sym];
  if (!digit || !alphabet.has(digit) || alphabet.has(symbol.sym)) return result;

  const candidates = [{ sym: symbol.sym, conf: number(symbol.conf, 0) }, ...(symbol.alts || [])];
  let top = 0;
  for (const candidate of candidates) top = Math.max(top, number(candidate.conf, 0));
  const alt = candidates
    .filter(candidate => candidate.sym === digit)
    .sort((a, b) => number(b.conf, 0) - number(a.conf, 0))[0];
  const altConf = number(alt?.conf, 0);
  if (!alt || top <= 0) return result;
  const ordinaryNearTie = altConf >= SINGLE_GLYPH_NEAR_TIE_SHARE * top;
  const structuralFive = symbol.sym === 's' && digit === '5' &&
    altConf >= STRUCTURAL_FIVE_ALT_SHARE * top && hasStructuralFiveEvidence(symbol);
  if (!ordinaryNearTie && !structuralFive) return result;

  const repaired = {
    ...symbol,
    sym: digit,
    conf: altConf,
    alts: [
      { sym: digit, conf: altConf },
      ...(symbol.alts || []).filter(candidate => candidate.sym !== digit)
    ].slice(0, 6),
    _singleGlyphContextRepair: true
  };
  const repairedLine = { ...line, text: digit, symbols: [repaired] };
  const topSymbols = (result.symbols || []).map(item => item.id === symbol.id ? repaired : item);
  const rival = (repaired.alts || []).find(candidate => candidate.sym !== repaired.sym);
  return {
    ...result,
    lines: [repairedLine],
    symbols: topSymbols,
    text: digit,
    minConf: altConf,
    margin: Math.max(0, Math.min(1, altConf - number(rival?.conf, 0))),
    weakest: { index: 0, sym: digit, conf: altConf, alts: repaired.alts },
    singleGlyphContextRepair: structuralFive
      ? 'answer-blind-numeric-5-structure-v3'
      : 'answer-blind-numeric-near-tie-v2'
  };
}

/**
 * Run the legacy recogniser unchanged unless a clearly detached side lane was
 * found. In the guarded case only the dominant written-step lane is recognised.
 * User symbol corrections remain stable by mapping external stroke-grounded ids
 * back to the recogniser's local ids before the corrected second pass.
 */
export function recognizeWithoutDetachedSideWork(strokes, overrides, ctx, recognize) {
  if (typeof recognize !== 'function') throw new TypeError('recognize function required');
  const finish = result => repairSingleGlyphQuestionContext(result, ctx);
  if (!Array.isArray(strokes) || strokes.length < 4) return finish(recognize(strokes || [], overrides || {}, ctx));

  const { rows, scale } = spatialRows(strokes);
  const { selected, ignored } = chooseMainLane(rows, strokes, scale);
  if (!ignored.length) return finish(recognize(strokes, overrides || {}, ctx));

  const localToGlobal = [...new Set(selected.flat())].sort((a, b) => a - b);
  const filtered = localToGlobal.map(i => strokes[i]).filter(Boolean);
  let first = recognize(filtered, {}, ctx);

  const requested = overrides || {};
  if (Object.keys(requested).length) {
    const localOverrides = {};
    for (const line of first.lines || []) {
      for (const symbol of line.symbols || []) {
        const id = externalId(symbol, localToGlobal);
        if (Object.prototype.hasOwnProperty.call(requested, id)) localOverrides[symbol.id] = requested[id];
      }
    }
    if (Object.keys(localOverrides).length) first = recognize(filtered, localOverrides, ctx);
  }

  return finish({
    ...remapResult(first, localToGlobal),
    ignoredAuxiliaryStrokeCount: [...new Set(ignored.flat())].length,
    spatialGuard: 'detached-side-work-v1'
  });
}
