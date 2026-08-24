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
    const score = lane.length * 1000 + strokeCount * 25 + Math.min(20, box.w / Math.max(scale, 1));
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

/**
 * Run the legacy recogniser unchanged unless a clearly detached side lane was
 * found. In the guarded case only the dominant written-step lane is recognised.
 * User symbol corrections remain stable by mapping external stroke-grounded ids
 * back to the recogniser's local ids before the corrected second pass.
 */
export function recognizeWithoutDetachedSideWork(strokes, overrides, ctx, recognize) {
  if (typeof recognize !== 'function') throw new TypeError('recognize function required');
  if (!Array.isArray(strokes) || strokes.length < 4) return recognize(strokes || [], overrides || {}, ctx);

  const { rows, scale } = spatialRows(strokes);
  const { selected, ignored } = chooseMainLane(rows, strokes, scale);
  if (!ignored.length) return recognize(strokes, overrides || {}, ctx);

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

  return {
    ...remapResult(first, localToGlobal),
    ignoredAuxiliaryStrokeCount: [...new Set(ignored.flat())].length,
    spatialGuard: 'detached-side-work-v1'
  };
}
