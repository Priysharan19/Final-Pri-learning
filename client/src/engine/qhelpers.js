// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Generator toolkit
// Seeded RNG, exact fractions, surd simplification, LaTeX formatting and MCQ
// assembly used by every question generator.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic RNG (mulberry32) so a seed reproduces a question exactly. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const rc = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function rs(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** Non-zero integer in [a, b]. */
export function nz(rng, a, b) { let v = 0; while (v === 0) v = ri(rng, a, b); return v; }
/** Pick n distinct values via generator fn, comparing by String. */
export function distinct(rng, n, fn, guard = 200) {
  const seen = new Set(); const out = [];
  while (out.length < n && guard--) {
    const v = fn();
    const k = String(v);
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

export const r1 = v => Math.round(v * 10) / 10;
export const r2 = v => Math.round(v * 100) / 100;
export const r3 = v => Math.round(v * 1000) / 1000;

export function money(v) {
  const neg = v < 0 ? '−' : '';
  return `${neg}\\$${Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function moneyPlain(v) {
  // Escaped dollar so prompts don't collide with $…$ math delimiters
  return `\\$${Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export const num = v => Number.isInteger(v) ? String(v) : String(r3(v));

// ── Fractions ────────────────────────────────────────────────────────────────

export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('zero denominator');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g; this.d = d / g;
  }
  static of(n, d) { return new Frac(n, d); }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { return new Frac(this.n * o.d, this.d * o.n); }
  get value() { return this.n / this.d; }
  get isInt() { return this.d === 1; }
  latex() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? '-' : '';
    return `${sign}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
  str() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
  mixedLatex() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? '-' : '';
    const whole = Math.floor(Math.abs(this.n) / this.d);
    const rem = Math.abs(this.n) % this.d;
    if (whole === 0) return this.latex();
    return `${sign}${whole}\\frac{${rem}}{${this.d}}`;
  }
}

// ── Surds ────────────────────────────────────────────────────────────────────

/** sqrt(n) = k √r with r square-free. */
export function surdSimp(n) {
  let k = 1, r = n;
  for (let p = 2; p * p <= r; p++) {
    while (r % (p * p) === 0) { r /= p * p; k *= p; }
  }
  return { k, r };
}
export function surdLatex(k, r) {
  if (r === 1) return String(k);
  if (k === 1) return `\\sqrt{${r}}`;
  if (k === -1) return `-\\sqrt{${r}}`;
  return `${k}\\sqrt{${r}}`;
}
export function surdStr(k, r) {
  if (r === 1) return String(k);
  if (k === 1) return `sqrt(${r})`;
  return `${k}sqrt(${r})`;
}

// ── Algebra formatting ───────────────────────────────────────────────────────

/** Coefficient + variable: 1→"x", -1→"-x", 0→"", 3→"3x". pow adds ^2 etc. */
export function term(c, v = 'x', pow = 1) {
  if (c === 0) return '';
  const vp = pow === 0 ? '' : pow === 1 ? v : `${v}^${pow > 9 ? `{${pow}}` : pow}`;
  if (!vp) return String(c);
  if (c === 1) return vp;
  if (c === -1) return `-${vp}`;
  return `${c}${vp}`;
}

/** Join terms with correct signs: poly([2,-3,4]) (powers desc) → "2x^2 - 3x + 4". */
export function poly(coeffs, v = 'x') {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const t = term(Math.abs(c), v, n - i);
    if (!out) out = (c < 0 ? '-' : '') + t;
    else out += c < 0 ? ` - ${t}` : ` + ${t}`;
  });
  return out || '0';
}

/** "x + 3" / "x - 3" for binomials. */
export const bin = (v, k) => k === 0 ? v : k > 0 ? `${v} + ${k}` : `${v} - ${Math.abs(k)}`;
/** signed constant for appending: "+ 5" / "- 5". */
export const sgn = k => k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`;

// ── MCQ assembly ─────────────────────────────────────────────────────────────

/**
 * Build a shuffled MCQ from a correct option and trap distractors.
 * Each option: { text } — traps may carry { why } for targeted feedback.
 * Returns { options: [text], correctIndex, optionTraps: {index: why} }
 */
export function mcq(rng, correct, distractors) {
  const seen = new Set([String(correct)]);
  const ds = [];
  for (const d of distractors) {
    const text = typeof d === 'string' ? d : d.text;
    if (seen.has(String(text))) continue;
    seen.add(String(text));
    ds.push(typeof d === 'string' ? { text } : d);
    if (ds.length === 3) break;
  }
  // pad if duplicates collapsed the pool
  let pad = 1;
  while (ds.length < 3) { ds.push({ text: `${correct} ${' '.repeat(pad)}` }); pad++; }
  const all = rs(rng, [{ text: correct, ok: true }, ...ds]);
  const correctIndex = all.findIndex(o => o.ok);
  const optionTraps = {};
  all.forEach((o, i) => { if (o.why) optionTraps[i] = o.why; });
  return { options: all.map(o => o.text), correctIndex, optionTraps };
}

/** Degrees → radians. */
export const rad = d => d * Math.PI / 180;

export const NAMES = ['Aria', 'Blake', 'Chen', 'Dev', 'Elif', 'Finn', 'Grace', 'Hana', 'Ivy', 'Jonah', 'Kiri', 'Leo', 'Mia', 'Noah', 'Ollie', 'Priya', 'Quinn', 'Ruby', 'Sam', 'Tara', 'Uma', 'Vik', 'Willa', 'Xavier', 'Yusuf', 'Zoe'];
export const ITEMS = [
  { name: 'a skateboard', price: [80, 320] },
  { name: 'a pair of sneakers', price: [60, 240] },
  { name: 'a gaming headset', price: [45, 180] },
  { name: 'a cricket bat', price: [70, 400] },
  { name: 'a graphics tablet', price: [90, 450] },
  { name: 'a mountain bike', price: [300, 1400] },
  { name: 'a surfboard', price: [250, 900] },
  { name: 'a phone', price: [350, 1600] }
];
