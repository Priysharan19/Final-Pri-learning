// Pri Explain V6 · presentation-only choreography helpers.
// These functions can classify and schedule already-verified presentation data,
// but they never create mathematical states, equations, figures or annotations.

export const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function tokenMotionPlan(diff) {
  const before = (diff?.before || []).map((token, index) => ({
    ...token,
    index,
    state: token.changed ? 'leaving' : 'stable',
  }));
  const after = (diff?.after || []).map((token, index) => ({
    ...token,
    index,
    state: token.changed ? 'entering' : 'stable',
  }));
  const waitingAfter = new Map();
  const pairs = [];

  for (const token of after) {
    if (!token.changed) continue;
    const bucket = waitingAfter.get(token.text) || [];
    bucket.push(token.index);
    waitingAfter.set(token.text, bucket);
  }

  for (const token of before) {
    if (!token.changed) continue;
    const bucket = waitingAfter.get(token.text);
    if (!bucket?.length) continue;
    const afterIndex = bucket.shift();
    token.state = 'moving';
    after[afterIndex].state = 'moving';
    const key = `${token.text}-${token.index}-${afterIndex}`;
    token.motionKey = key;
    after[afterIndex].motionKey = key;
    pairs.push({ key, text: token.text, beforeIndex: token.index, afterIndex });
  }

  return { before, after, pairs };
}

const PRIORITY = {
  geometry: { circle: 0, ellipse: 0, line: 1, polyline: 2, polygon: 2, path: 3, rect: 3, text: 4 },
  graph: { line: 0, path: 1, polyline: 1, polygon: 1, circle: 2, ellipse: 2, rect: 2, text: 3 },
  calculus: { line: 0, path: 1, polygon: 2, rect: 2, polyline: 2, circle: 3, ellipse: 3, text: 4 },
  statistics: { line: 0, rect: 1, path: 1, polygon: 1, polyline: 1, circle: 2, ellipse: 2, text: 3 },
  figure: { line: 0, path: 1, polyline: 1, polygon: 1, rect: 1, circle: 2, ellipse: 2, text: 3 },
};

export function figurePrimitivePriority(mode, tagName) {
  const table = PRIORITY[mode] || PRIORITY.figure;
  const tag = String(tagName || '').toLowerCase();
  return Number.isFinite(table[tag]) ? table[tag] : 2;
}

export function figureRevealSchedule(mode, primitives = []) {
  const ranked = primitives.map((primitive, sourceIndex) => ({
    sourceIndex,
    priority: figurePrimitivePriority(mode, primitive?.tagName || primitive?.tag || ''),
  }));
  ranked.sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex);
  const orderBySource = new Map(ranked.map((item, order) => [item.sourceIndex, order]));
  return primitives.map((primitive, sourceIndex) => ({
    ...primitive,
    sourceIndex,
    order: orderBySource.get(sourceIndex) ?? sourceIndex,
    priority: figurePrimitivePriority(mode, primitive?.tagName || primitive?.tag || ''),
  }));
}

export function primitiveReveal(progress, order, total) {
  const p = clamp01(progress);
  const count = Math.max(1, Number(total) || 1);
  const position = Math.max(0, Number(order) || 0) / count;
  const start = 0.08 + position * 0.68;
  const end = Math.min(1, start + Math.max(0.16, 0.34 - count * 0.004));
  if (p <= start) return 0;
  if (p >= end) return 1;
  return clamp01((p - start) / Math.max(0.01, end - start));
}
