// Pri Explain V6/V7 · presentation-only choreography helpers.
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

const VISUAL_WEIGHTS = {
  attempt: 0.75,
  focus: 0.8,
  transform: 1.35,
  ink: 1.45,
  statistics: 1.55,
  figure: 1.7,
  graph: 2,
  geometry: 2,
  calculus: 2,
};

function visualWeight(visual) {
  const kind = visual?.kind === 'figure' ? (visual?.mode || 'figure') : visual?.kind;
  return VISUAL_WEIGHTS[kind] || 1;
}

// V7 conductor: assign presentation windows across authored reasoning beats.
// This is deliberately content-agnostic. It schedules existing verified visuals;
// it does not infer that a visual proves or corresponds to a particular sentence.
export function visualCuePlan(visuals = [], lineCount = 0) {
  const beats = Math.max(1, Number(lineCount) || 1);
  const plan = Array.from({ length: visuals.length }, () => null);
  const drawable = visuals
    .map((visual, index) => ({ visual, index, weight: visualWeight(visual) }))
    .filter(item => item.visual?.kind !== 'checkpoint');
  const totalWeight = drawable.reduce((sum, item) => sum + item.weight, 0) || 1;
  let cursor = 0;

  for (const item of drawable) {
    const startRatio = cursor / totalWeight;
    cursor += item.weight;
    const endRatio = cursor / totalWeight;
    const startBeat = Math.min(beats - 1, Math.floor(startRatio * beats));
    const endBeat = Math.max(startBeat + 1, Math.min(beats, Math.ceil(endRatio * beats)));
    plan[item.index] = {
      visualIndex: item.index,
      kind: item.visual?.kind || 'visual',
      startBeat,
      endBeat,
      weight: item.weight,
    };
  }

  visuals.forEach((visual, index) => {
    if (visual?.kind !== 'checkpoint') return;
    plan[index] = {
      visualIndex: index,
      kind: 'checkpoint',
      startBeat: beats,
      endBeat: beats,
      weight: 0,
    };
  });

  return plan;
}

export function visualProgressForCue(cue, beat, reduceMotion = false) {
  if (reduceMotion) return 1;
  if (!cue) return 0;
  const currentBeat = Math.max(0, Number(beat) || 0);
  if (cue.kind === 'checkpoint') return currentBeat >= cue.startBeat ? 1 : 0;
  if (currentBeat <= cue.startBeat) return 0;
  if (currentBeat >= cue.endBeat) return 1;
  return clamp01((currentBeat - cue.startBeat) / Math.max(1, cue.endBeat - cue.startBeat));
}

export function visualCueState(cue, beat, reduceMotion = false) {
  if (reduceMotion) return 'done';
  if (!cue) return 'pending';
  const currentBeat = Math.max(0, Number(beat) || 0);
  if (cue.kind === 'checkpoint') return currentBeat >= cue.startBeat ? 'active' : 'pending';
  if (currentBeat < cue.startBeat) return 'pending';
  if (currentBeat >= cue.endBeat) return 'done';
  return 'active';
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
