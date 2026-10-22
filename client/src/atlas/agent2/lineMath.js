// PRI ATLAS prototype · pure geometry, never grading or learner-state authority.
// ax + by = c. The control surface accepts small INTEGER coefficients,
// allowing exact determinant comparisons, including degenerate equations.
const assertLine = line => {
  if (!line || !['a', 'b', 'c'].every(key => Number.isSafeInteger(line[key]))) {
    throw new TypeError('Line coefficients must be safe integers');
  }
  return line;
};

export function equationText(line) {
  const { a, b, c } = assertLine(line);
  const terms = [];
  if (a !== 0) terms.push((a < 0 ? '-' : '') + (Math.abs(a) === 1 ? '' : Math.abs(a)) + 'x');
  if (b !== 0) {
    const part = (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'y';
    terms.push(terms.length ? (b < 0 ? '− ' : '+ ') + part : (b < 0 ? '−' : '') + part);
  }
  return (terms.join(' ') || '0') + ' = ' + c;
}

export const lineNature = line => {
  const { a, b, c } = assertLine(line);
  return a || b ? 'line' : c === 0 ? 'plane' : 'empty';
};

export function classifySystem(first, second) {
  const p = assertLine(first);
  const q = assertLine(second);
  const nature1 = lineNature(p);
  const nature2 = lineNature(q);
  if (nature1 === 'empty' || nature2 === 'empty') return { kind: 'inconsistent', point: null, description: 'No point satisfies both equations.' };
  if (nature1 === 'plane' && nature2 === 'plane') return { kind: 'all-plane', point: null, description: 'Every point in the plane satisfies both equations.' };
  if (nature1 === 'plane' || nature2 === 'plane') return { kind: 'unconstrained', point: null, description: 'Infinitely many solutions along the non-degenerate line.' };
  const det = p.a * q.b - q.a * p.b;
  const detX = p.c * q.b - q.c * p.b;
  const detY = p.a * q.c - q.a * p.c;
  if (det !== 0) {
    return { kind: 'unique', point: { x: detX / det, y: detY / det },
      description: 'The lines intersect at exactly one point.' };
  }
  if (detX === 0 && detY === 0) {
    return { kind: 'coincident', point: null, description: 'Both equations describe the same line: infinitely many solutions.' };
  }
  return { kind: 'parallel', point: null, description: 'The distinct parallel lines do not intersect.' };
}

/** Exact line clipping to the square viewport. Null for empty/tautological equations. */
export function clipLine(line, bound = 8) {
  if (lineNature(line) !== 'line') return null;
  if (!Number.isFinite(bound) || bound <= 0) throw new RangeError('Invalid viewport bound');
  const { a, b, c } = line;
  const points = [];
  const push = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > bound + 1e-10 || Math.abs(y) > bound + 1e-10) return;
    if (!points.some(p => Math.abs(p.x - x) < 1e-10 && Math.abs(p.y - y) < 1e-10)) points.push({ x, y });
  };
  if (b !== 0) { push(-bound, (c + a * bound) / b); push(bound, (c - a * bound) / b); }
  if (a !== 0) { push((c + b * bound) / a, -bound); push((c - b * bound) / a, bound); }
  return points.length >= 2 ? [points[0], points[1]] : null;
}

export const DEFAULT_LINES = Object.freeze({
  first: Object.freeze({ a: 1, b: 1, c: 4 }),
  second: Object.freeze({ a: 1, b: -1, c: 0 })
});

export const LINE_PRESETS = Object.freeze({
  unique: [DEFAULT_LINES.first, DEFAULT_LINES.second],
  parallel: [{ a: 1, b: 1, c: 4 }, { a: 2, b: 2, c: 2 }],
  coincident: [{ a: 1, b: 1, c: 4 }, { a: 2, b: 2, c: 8 }],
  degenerate: [{ a: 0, b: 0, c: 1 }, { a: 1, b: -1, c: 0 }]
});
