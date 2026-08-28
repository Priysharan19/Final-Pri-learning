// Pri Explain V6 · presentation-only mathematical choreography.
//
// This module never derives new mathematics. It receives token diffs and SVG
// figures that have already crossed the verified storyboard/sanitization
// boundary, then computes motion geometry for rendering only.

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const PATH_TAG = /(<path\b[^>]*\bd\s*=\s*)(["'])(.*?)(\2)/gi;
const PRIMITIVE = /<(line|path|polyline|polygon|circle|ellipse|rect|text|tspan)\b([^>]*)>/gi;

export const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function tokenPosition(index, count) {
  if (count <= 1) return 50;
  return 6 + (88 * index) / (count - 1);
}

export function equationTravelPlan(diff) {
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

  const waiting = new Map();
  for (const token of after) {
    if (!token.changed) continue;
    const bucket = waiting.get(token.text) || [];
    bucket.push(token.index);
    waiting.set(token.text, bucket);
  }

  const travels = [];
  for (const token of before) {
    if (!token.changed) continue;
    const bucket = waiting.get(token.text);
    if (!bucket?.length) continue;
    const afterIndex = bucket.shift();
    const target = after[afterIndex];
    token.state = 'moving';
    target.state = 'moving';
    const key = `${token.text}-${token.index}-${afterIndex}`;
    token.motionKey = key;
    target.motionKey = key;
    travels.push({
      key,
      text: token.text,
      beforeIndex: token.index,
      afterIndex,
      from: tokenPosition(token.index, before.length),
      to: tokenPosition(afterIndex, after.length),
    });
  }

  return { before, after, travels };
}

function mergeAttribute(attrs, name, value, separator = ' ') {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = attrs.match(pattern);
  if (!match) return `${attrs} ${name}="${value}"`;
  const merged = [match[2], value].filter(Boolean).join(separator);
  return attrs.replace(pattern, ` ${name}=${match[1]}${merged}${match[1]}`);
}

function primitiveRole(tag, mode) {
  const t = String(tag || '').toLowerCase();
  if (t === 'text' || t === 'tspan') return { role: 'label', stage: 3 };

  if (mode === 'graph' || mode === 'calculus' || mode === 'statistics') {
    if (t === 'line' || t === 'rect') return { role: 'scaffold', stage: 0 };
    if (t === 'path' || t === 'polyline' || t === 'polygon') return { role: 'structure', stage: 1 };
    if (t === 'circle' || t === 'ellipse') return { role: 'anchor', stage: 2 };
  }

  if (mode === 'geometry') {
    if (t === 'circle' || t === 'ellipse' || t === 'rect') return { role: 'anchor', stage: 0 };
    if (t === 'line' || t === 'polyline' || t === 'polygon') return { role: 'structure', stage: 1 };
    if (t === 'path') return { role: 'detail', stage: 2 };
  }

  if (t === 'line' || t === 'rect') return { role: 'scaffold', stage: 0 };
  if (t === 'path' || t === 'polyline' || t === 'polygon') return { role: 'structure', stage: 1 };
  if (t === 'circle' || t === 'ellipse') return { role: 'anchor', stage: 2 };
  return { role: 'detail', stage: 2 };
}

export function instrumentFigureSvg(svg, mode = 'figure') {
  let order = 0;
  return String(svg || '').replace(PRIMITIVE, (full, tag, rawAttrs = '') => {
    const selfClosing = /\/\s*$/.test(rawAttrs);
    let attrs = selfClosing ? rawAttrs.replace(/\/\s*$/, '') : rawAttrs;
    const { role, stage } = primitiveRole(tag, mode);
    const delay = stage * 250 + Math.min(order, 20) * 28;
    attrs = mergeAttribute(attrs, 'class', `pri-v-primitive pri-v-role-${role}`);
    attrs = mergeAttribute(attrs, 'style', `--pri-order:${order};--pri-delay:${delay}ms`, ';');
    order += 1;
    return `<${tag}${attrs}${selfClosing ? ' /' : ''}>`;
  });
}

function pathData(svg) {
  const out = [];
  const source = String(svg || '');
  PATH_TAG.lastIndex = 0;
  let match;
  while ((match = PATH_TAG.exec(source))) out.push(match[3]);
  return out;
}

function pathSkeleton(d) {
  return String(d || '').replace(NUMBER, '#').replace(/\s+/g, ' ').trim();
}

export function canMorphFigureSvg(fromSvg, toSvg) {
  const from = pathData(fromSvg);
  const to = pathData(toSvg);
  if (!from.length || from.length !== to.length) return false;
  return from.every((d, index) => pathSkeleton(d) === pathSkeleton(to[index]));
}

export function interpolatePathData(fromD, toD, progress) {
  const p = clamp01(progress);
  if (pathSkeleton(fromD) !== pathSkeleton(toD)) return p < 0.5 ? String(fromD || '') : String(toD || '');
  const fromNumbers = String(fromD || '').match(NUMBER)?.map(Number) || [];
  const toNumbers = String(toD || '').match(NUMBER)?.map(Number) || [];
  if (fromNumbers.length !== toNumbers.length) return p < 0.5 ? String(fromD || '') : String(toD || '');
  let index = 0;
  return String(fromD || '').replace(NUMBER, () => {
    const value = fromNumbers[index] + (toNumbers[index] - fromNumbers[index]) * p;
    index += 1;
    return Number(value.toFixed(3)).toString();
  });
}

export function morphFigureSvg(fromSvg, toSvg, progress) {
  const p = clamp01(progress);
  if (!canMorphFigureSvg(fromSvg, toSvg)) return p < 0.5 ? String(fromSvg || '') : String(toSvg || '');
  const targets = pathData(toSvg);
  let pathIndex = 0;
  return String(fromSvg || '').replace(PATH_TAG, (full, prefix, quote, d) => {
    const next = targets[pathIndex++] || d;
    return `${prefix}${quote}${interpolatePathData(d, next, p)}${quote}`;
  });
}
