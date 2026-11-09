// PRI ATLAS · local, synthetic-only geometry. No marking authority.
//
// ax + by = c, with integral coefficients in the finite laboratory domain
// [-6, 6]. Bounded products/determinants are exact IEEE-754 integers:
// |a*b| <= 36 and |a*b - a*b| <= 72. Arbitrary safe integers are NOT accepted.
export const MAX_ABS_COEFFICIENT = 6;
const assertLine = line => {
  if (!line || !['a', 'b', 'c'].every(key => Number.isSafeInteger(line[key]))) {
    throw new TypeError('Line coefficients must be safe integers');
  }
  if (['a', 'b', 'c'].some(key => Math.abs(line[key]) > MAX_ABS_COEFFICIENT)) {
    throw new RangeError('Line coefficients must be in [-6, 6]; arbitrary safe integers are not an exact determinant domain');
  }
  return line;
};
const gcd = (a, b) => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};
export function rational(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) throw new RangeError('Invalid rational');
  const sign = denominator < 0 ? -1 : 1;
  const g = gcd(numerator, denominator);
  const n = sign * numerator / g, d = sign * denominator / g;
  return Object.freeze({ numerator: n, denominator: d, text: d === 1 ? String(n) : n + '/' + d });
}
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
export function determinants(first, second) {
  const p = assertLine(first), q = assertLine(second);
  return Object.freeze({
    D: p.a * q.b - q.a * p.b,
    Dx: p.c * q.b - q.c * p.b,
    Dy: p.a * q.c - q.a * p.c
  });
}
export function classifySystem(first, second) {
  const p = assertLine(first);
  const q = assertLine(second);
  const nature1 = lineNature(p);
  const nature2 = lineNature(q);
  const delta = determinants(p, q);
  if (nature1 === 'empty' || nature2 === 'empty') return {
    kind: 'inconsistent', point: null, exactPoint: null, determinants: delta,
    description: 'No point satisfies both equations.'
  };
  if (nature1 === 'plane' && nature2 === 'plane') return {
    kind: 'all-plane', point: null, exactPoint: null, determinants: delta,
    description: 'Every point in the plane satisfies both equations.'
  };
  if (nature1 === 'plane' || nature2 === 'plane') return {
    kind: 'unconstrained', point: null, exactPoint: null, determinants: delta,
    description: 'Infinitely many solutions along the non-degenerate line.'
  };
  if (delta.D !== 0) {
    const x = rational(delta.Dx, delta.D), y = rational(delta.Dy, delta.D);
    return { kind: 'unique', point: { x: x.numerator / x.denominator, y: y.numerator / y.denominator },
      exactPoint: Object.freeze({ x, y }), determinants: delta,
      description: 'The lines intersect at exactly one point.' };
  }
  if (delta.Dx === 0 && delta.Dy === 0) return {
    kind: 'coincident', point: null, exactPoint: null, determinants: delta,
    description: 'Both equations describe the same line: infinitely many solutions.'
  };
  return { kind: 'parallel', point: null, exactPoint: null, determinants: delta,
    description: 'The distinct parallel lines do not intersect.' };
}
/** Segments clipped into [-bound,bound]^2; do not draw degenerate equations. */
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
  coincident: [{ a: 1, b: 1, c: 3 }, { a: 2, b: 2, c: 6 }],
  degenerate: [{ a: 0, b: 0, c: 1 }, { a: 1, b: -1, c: 0 }]
});
