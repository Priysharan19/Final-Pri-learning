// Independent solvers for the Class VII Part I hardest-level (D3) forms
// (client/src/engine/generators/india-class7-hardest.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and re-solves by a different route — digit-by-digit
// carrying, scanning every whole number, enumerating every choice, brute-force
// search over digits or magic squares, Gaussian elimination, coordinates —
// checks that the answer is unique where uniqueness matters, and compares the
// result with the key. A solver returns a list of problems; [] means verified.
//
// NEAR_MISS lists, per form, answers a student could plausibly write that must
// be marked WRONG (the generic ±1 / ×10 / ÷10 probes are run by the harness).

const num = s => Number(String(s).replace(/\{,\}/g, '').replace(/,/g, ''));
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const keyed = q => (q.answerType === 'numeric' ? q.answer.value : null);
const same = (q, got, what) => {
  if (got == null || Number.isNaN(got)) return [`${what}: could not re-derive`];
  return close(got, keyed(q)) ? [] : [`${what}: re-derived ${got}, keyed ${keyed(q)}`];
};
const unread = what => [`could not read the ${what} prompt`];
const gcdN = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const gcdB = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const others = (q, list) => [...new Set(list.filter(v => Number.isFinite(v) && !close(v, keyed(q))).map(v => String(Number(v.toFixed(6)))))];

/** "3x - 12", "x + 5", "-x", "2x" → [coefficient, constant] */
function linear(s) {
  const m = s.replace(/\s+/g, '').match(/^(-?\d*)x([+-]\d+)?$/);
  if (!m) return null;
  const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  return [a, m[2] ? Number(m[2]) : 0];
}
const at = ([a, b], x) => a * x + b;
/** Every whole x in 1..300 satisfying pred. */
const xs = pred => { const out = []; for (let x = 1; x <= 300; x++) if (pred(x)) out.push(x); return out; };

/** A tex arithmetic string (digits, + - \times, brackets) evaluated as JS. */
const evalTex = s => Function(`"use strict"; return (${s.replace(/\\times/g, '*').replace(/\{,\}/g, '')});`)();

// ── 1 · Large numbers ───────────────────────────────────────────────────────
const PV = { crores: 7, 'ten-lakhs': 6, lakhs: 5, 'ten-thousands': 4, thousands: 3, hundreds: 2, tens: 1 };
function placeValueSum(p) {
  const parts = [...p.matchAll(/\$(\d+)\$ (crores|ten-lakhs|lakhs|ten-thousands|thousands|hundreds|tens)\b/g)];
  if (parts.length < 2) return null;
  const digits = Array(14).fill(0);
  for (const [, c, place] of parts) {
    let carry = Number(c), i = PV[place];
    while (carry) { const s = digits[i] + carry; digits[i] = s % 10; carry = Math.floor(s / 10); i++; }
  }
  return Number(digits.slice().reverse().join(''));
}
function placeValue(q) {
  const p = q.prompt;
  if (/made up of/.test(p)) {
    const N = placeValueSum(p);
    if (N == null) return unread('place-value');
    if (/in figures/.test(p)) return same(q, N, 'number in figures');
    if (/How many millions/.test(p)) {
      const groups = N.toLocaleString('en-US').split(',');
      return same(q, groups.length > 2 ? Number(groups.slice(0, -2).join('')) : 0, 'millions');
    }
    return unread('place-value ask');
  }
  let m;
  if ((m = p.match(/₹\$(\d+)\$ crore \$(\d+)\$ lakh/))) return same(q, (Number(m[1]) * 1e7 + Number(m[2]) * 1e5) / 1e6, 'crore-lakh in millions');
  if ((m = p.match(/₹\$(\d+)\$ million at the box office/))) return same(q, (Number(m[1]) * 1e6) / 1e7, 'millions in crores');
  if ((m = p.match(/₹\$(\d+)\$ lakh for flood relief/))) return same(q, (Number(m[1]) * 1e5) / 1e6, 'lakhs in millions');
  return unread('place-value');
}
function placeValueMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/₹\$(\d+)\$ crore \$(\d+)\$ lakh/))) return others(q, [100 * m[1] + Number(m[2]), Number(m[1]) + m[2] / 100]);
  if ((m = p.match(/₹\$(\d+)\$ million/))) return others(q, [m[1] * 10, m[1] / 100]);
  if ((m = p.match(/₹\$(\d+)\$ lakh/))) return others(q, [m[1] * 10, m[1] / 100]);
  if (/How many millions/.test(p)) { const N = placeValueSum(p); return others(q, [Math.floor(N / 1e5), Math.floor(N / 1e7)]); }
  return [];
}

// ── Rounding ────────────────────────────────────────────────────────────────
const UNIT = { hundred: 100, thousand: 1000, 'ten thousand': 10000, lakh: 100000 };
const roundTo = (n, U) => Math.floor((n + U / 2) / U) * U;      // halfway rounds up
function roundRange(R, U, extra = () => true) {
  let lo = null, hi = null;
  for (let n = Math.max(0, R - U); n <= R + U; n++) if (roundTo(n, U) === R && extra(n)) { if (lo == null) lo = n; hi = n; }
  return [lo, hi];
}
function rounding(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/rounded to the nearest (ten thousand|hundred|thousand|lakh), is \$([\d{},]+)\$\. The same number, rounded to the nearest (ten thousand|hundred|thousand|lakh), is \$([\d{},]+)\$\..*What is the (smallest|largest)/))) {
    const U = UNIT[m[1]], R = num(m[2]), u = UNIT[m[3]], t = num(m[4]);
    const [lo, hi] = roundRange(R, U, n => roundTo(n, u) === t);
    if (lo == null) return ['no whole number fits both roundings'];
    if (m[5] === 'smallest' && lo === t) return ['the smallest number is the rounded value itself (degenerate)'];
    return same(q, m[5] === 'smallest' ? lo : hi, 'number rounded two ways');
  }
  const unitM = p.match(/nearest (ten thousand|hundred|thousand|lakh)/);
  const vals = [...p.matchAll(/\$([\d{},]+)\$/g)].map(x => num(x[1]));
  const askM = p.match(/What is the (greatest|smallest) possible (difference between|total of)/);
  if (!unitM || vals.length < 2 || !askM) return unread('rounding');
  const U = UNIT[unitM[1]];
  const [lo1, hi1] = roundRange(vals[0], U), [lo2, hi2] = roundRange(vals[1], U);
  let got;
  if (askM[2] === 'total of') got = askM[1] === 'greatest' ? hi1 + hi2 : lo1 + lo2;
  else got = askM[1] === 'greatest' ? Math.max(hi1 - lo2, hi2 - lo1) : Math.max(0, lo1 - hi2, lo2 - hi1);
  return same(q, got, 'rounded pair');
}
function roundingMiss(q) {
  const p = q.prompt;
  if (/The same number/.test(p)) return [];
  const vals = [...p.matchAll(/\$([\d{},]+)\$/g)].map(x => num(x[1]));
  return others(q, [/difference/.test(p) ? vals[0] - vals[1] : vals[0] + vals[1]]);
}

// ── Factor and regroup ──────────────────────────────────────────────────────
function factorRegroup(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/end of the product \$([\d \\times]+)\$/))) {
    const prod = m[1].split('\\times').map(s => BigInt(s.trim())).reduce((a, b) => a * b, 1n);
    return same(q, String(prod).match(/0*$/)[0].length, 'trailing zeros');
  }
  if ((m = p.match(/goes in the box: \$(.+?) = ([\d{},]+)\$/))) {
    const fs = m[1].split('\\times').map(s => s.trim());
    if (fs.filter(f => f === '\\square').length !== 1) return ['expected exactly one box'];
    const known = fs.filter(f => f !== '\\square').reduce((a, f) => a * Number(f), 1);
    const P = num(m[2]);
    if (P % known) return ['the box is not a whole number'];
    return same(q, P / known, 'missing factor');
  }
  return unread('factor');
}
function factorMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/end of the product \$([\d \\times]+)\$/))) return others(q, [m[1].split('\\times').reduce((s, f) => s + (f.trim().match(/0*$/)[0].length), 0)]);
  if ((m = p.match(/goes in the box: \$(.+?) = ([\d{},]+)\$/))) { const k = m[1].split('\\times').map(s => s.trim()).filter(f => f !== '\\square'); return others(q, [num(m[2]) / Number(k[0])]); }
  return [];
}

// ── 2 · Arithmetic expressions ──────────────────────────────────────────────
function exprComparison(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/Let \$P = ([\d +-]+)\$ and \$Q = ([\d +-]+)\$/))) return same(q, evalTex(m[1]) - evalTex(m[2]), 'P - Q');
  if ((m = p.match(/equal: \$(\d+) \+ (\d+) - (\d+) = (\d+) \+ \\square - (\d+)\$/))) {
    const [a, b, c, a2, c2] = m.slice(1).map(Number);
    const hits = [];
    for (let box = -20000; box <= 20000; box++) if (a + b - c === a2 + box - c2) hits.push(box);
    return hits.length === 1 ? same(q, hits[0], 'box') : [`${hits.length} values fit the box`];
  }
  return unread('comparison');
}
function exprComparisonMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/equal: \$(\d+) \+ (\d+) - (\d+) = (\d+) \+ \\square - (\d+)\$/))) {
    const [a, b, c, a2, c2] = m.slice(1).map(Number);
    return others(q, [b + (a2 - a) - (c2 - c), b - (a2 - a) - (c2 - c)]);
  }
  return others(q, [-keyed(q)]);
}

function bracketValues(p) {
  const m = p.match(/brackets into \$(.+?)\$, so that/);
  if (!m) return null;
  const toks = m[1].replace(/\\times/g, '*').split(/\s+/);
  const nums = toks.filter((_, i) => i % 2 === 0), ops = toks.filter((_, i) => i % 2 === 1);
  const vals = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const s = nums.map((n, t) => `${t ? ops[t - 1] : ''}${t === i ? '(' : ''}${n}${t === j ? ')' : ''}`).join('');
      vals.push(Function(`return ${s}`)());
    }
  }
  const plain = Function(`return ${nums.map((n, t) => `${t ? ops[t - 1] : ''}${n}`).join('')}`)();
  return { vals, plain };
}
function bracket(q) {
  const r = bracketValues(q.prompt);
  const ask = q.prompt.match(/What is the (largest|smallest) value/);
  if (!r || !ask) return unread('bracket');
  return same(q, ask[1] === 'largest' ? Math.max(...r.vals) : Math.min(...r.vals), 'bracket placement');
}
function bracketMiss(q) {
  const r = bracketValues(q.prompt);
  if (!r) return [];
  return others(q, [r.plain, /largest/.test(q.prompt) ? Math.min(...r.vals) : Math.max(...r.vals)]);
}

function propertyRewrite(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/told that \$(\d+) \\times (\d+) = ([\d{},]+)\$.*to find \$(.+?)\$\.$/))) {
    if (Number(m[1]) * Number(m[2]) !== num(m[3])) return ['the given product is wrong'];
    return same(q, evalTex(m[4]), 'known-product expression');
  }
  if ((m = p.match(/to find \$(.+?)\$ without/))) return same(q, evalTex(m[1]), 'common-factor expression');
  return unread('property');
}
function propertyMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/told that \$(\d+) \\times (\d+)/))) return others(q, [m[1] * m[2]]);
  if ((m = p.match(/to find \$(.+?)\$ without/))) {
    const terms = m[1].split(/ [+-] /).map(t => t.split('\\times').map(x => Number(x)));
    const k = terms[0].find(x => terms.every(t => t.includes(x)));
    const rest = terms.map(t => (t[0] === k ? t[1] : t[0]));
    return others(q, [rest[0] + rest[1] - rest[2], k * (rest[0] + rest[1] + rest[2])]);
  }
  return [];
}

// ── 3 · Decimals ────────────────────────────────────────────────────────────
const thou = s => { const [w, f = ''] = s.split('.'); return Number(w) * 1000 + Number((f + '000').slice(0, 3)); };
const PLACE_K = { tenths: 100, hundredths: 10, thousandths: 1 };
function decimalPlace(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/\$(\d+)\$ ones, \$(\d+)\$ tenths, \$(\d+)\$ hundredths and \$(\d+)\$ thousandths/))) {
    const t = 1000 * m[1] + 100 * m[2] + 10 * m[3] + Number(m[4]);
    return close(Math.round(keyed(q) * 1000), t) ? [] : [`regrouped ${t / 1000}, keyed ${keyed(q)}`];
  }
  if ((m = p.match(/How many (tenths|hundredths|thousandths) must be added to \$([\d.]+)\$ to make \$([\d.]+)\$/))) {
    let count = 0, x = thou(m[2]);
    const y = thou(m[3]);
    while (x < y) { x += PLACE_K[m[1]]; count++; }
    return x === y ? same(q, count, 'count of places') : ['the gap is not a whole number of that place'];
  }
  return unread('decimal place');
}
function decimalPlaceMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/\$(\d+)\$ ones, \$(\d+)\$ tenths, \$(\d+)\$ hundredths and \$(\d+)\$ thousandths/))) return others(q, [Number(m[1]) + (m[2] % 10) / 10 + (m[3] % 10) / 100 + (m[4] % 10) / 1000]);
  if ((m = p.match(/added to \$([\d.]+)\$ to make \$([\d.]+)\$/))) { const g = thou(m[2]) - thou(m[1]); return others(q, [g, g / 1000]); }
  return [];
}

function decimalOrdering(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/from (smallest to largest|largest to smallest): (.+?)\. Which number is (\d+)(?:st|nd|rd|th)/))) {
    const vals = [...m[2].matchAll(/\$([\d.]+)\$/g)].map(x => x[1]);
    if (new Set(vals.map(thou)).size !== vals.length) return ['two numbers are equal'];
    const sorted = [...vals].sort((a, b) => thou(a) - thou(b));
    if (m[1] === 'largest to smallest') sorted.reverse();
    return same(q, Number(sorted[Number(m[3]) - 1]), 'ordered decimal');
  }
  if ((m = p.match(/points \$([\d.]+)\$ and \$([\d.]+)\$ are marked\. The gap between them is divided into \$(\d+)\$ equal parts.*the (\d+)(?:st|nd|rd|th) mark/))) {
    const A = thou(m[1]), B = thou(m[2]), n = Number(m[3]), k = Number(m[4]);
    if ((B - A) % n) return ['parts are not whole thousandths'];
    return same(q, (A + ((B - A) / n) * k) / 1000, 'number-line mark');
  }
  return unread('ordering');
}
function decimalOrderingMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/from (smallest to largest|largest to smallest): (.+?)\. Which number is (\d+)/))) {
    const vals = [...m[2].matchAll(/\$([\d.]+)\$/g)].map(x => x[1]);
    const wrong = [...vals].sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
    if (m[1] === 'largest to smallest') wrong.reverse();
    return others(q, [Number(wrong[Number(m[3]) - 1])]);
  }
  if ((m = p.match(/points \$([\d.]+)\$ and \$([\d.]+)\$ are marked\. The gap between them is divided into \$(\d+)\$ equal parts.*the (\d+)(?:st|nd|rd|th) mark/))) {
    const A = thou(m[1]), B = thou(m[2]), n = Number(m[3]), k = Number(m[4]);
    return others(q, [(B - ((B - A) / n) * k) / 1000]);
  }
  return [];
}

// ── 4 · Letter-numbers ──────────────────────────────────────────────────────
function patternTerms(p) {
  const m = p.match(/Step 1 uses \$(\d+)\$ .*?, step 2 uses \$(\d+)\$ and step 3 uses \$(\d+)\$/);
  if (!m) return null;
  const [s1, s2, s3] = m.slice(1).map(Number);
  return s2 - s1 === s3 - s2 ? { s1, d: s2 - s1 } : null;
}
function letterPattern(q) {
  const p = q.prompt;
  let m;
  const t = patternTerms(p);
  if (t) {
    if ((m = p.match(/how many .+? step \$(\d+)\$ uses/))) {
      let v = t.s1;
      for (let s = 2; s <= Number(m[1]); s++) v += t.d;
      return same(q, v, 'pattern count');
    }
    if ((m = p.match(/which step uses exactly \$(\d+)\$/))) {
      const T = Number(m[1]);
      let v = t.s1, s = 1;
      while (v < T) { v += t.d; s++; }
      return v === T ? same(q, s, 'pattern step') : ['no step uses exactly that many'];
    }
  }
  if ((m = p.match(/a (\d) × \d square of dates.*add up to \$(\d+)\$\. What is (.+)\?$/))) {
    const size = Number(m[1]), S = Number(m[2]);
    const hits = [];
    for (let top = 1; top <= 31; top++) {
      const cells = [];
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push(top + 7 * r + c);
      if (Math.max(...cells) > 31) continue;
      if (cells.reduce((a, b) => a + b, 0) === S) hits.push(cells);
    }
    if (hits.length !== 1) return [`${hits.length} calendar squares fit`];
    const cells = hits[0];
    const got = /top-left/.test(m[3]) ? cells[0] : /centre/.test(m[3]) ? cells[(cells.length - 1) / 2] : /largest/.test(m[3]) ? Math.max(...cells) : null;
    return same(q, got, 'calendar date');
  }
  return unread('letter pattern');
}
function letterPatternMiss(q) {
  const p = q.prompt;
  const t = patternTerms(p);
  let m;
  if (t && (m = p.match(/step \$(\d+)\$ uses/))) return others(q, [t.d * m[1], t.s1 + t.d * m[1]]);
  if (t && (m = p.match(/exactly \$(\d+)\$/))) return others(q, [Math.round(m[1] / t.d)]);
  if ((m = p.match(/a (\d) × \d square of dates.*add up to \$(\d+)\$/))) return others(q, [Math.round(m[2] / (m[1] * m[1]))]);
  return [];
}

function runTrick(sentences, x) {
  let v = x;
  for (const s of sentences) {
    let m;
    if ((m = s.match(/^Multiply (?:it|the result) by \$(\d+)\$\.$/))) v *= Number(m[1]);
    else if ((m = s.match(/^Add \$(\d+)\$\.$/))) v += Number(m[1]);
    else if ((m = s.match(/^Subtract \$(\d+)\$ times the number you first thought of\.$/))) v -= Number(m[1]) * x;
    else if (/^Subtract the number you first thought of\.$/.test(s)) v -= x;
    else if ((m = s.match(/^Subtract \$(\d+)\$\.$/))) v -= Number(m[1]);
    else if ((m = s.match(/^Divide the result by \$(\d+)\$\.$/))) v /= Number(m[1]);
    else return null;
  }
  return v;
}
const TIMES = w => (w === 'twice' ? 2 : w === 'three times' ? 3 : Number(w.split(' ')[0]));
function translation(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/Think of any number\. (.+?) Everyone ends up/))) {
    const sentences = m[1].split(/(?<=\.)\s+/);
    const outs = [7, 13, 60, 121].map(x => runTrick(sentences, x));
    if (outs.some(o => o == null)) return ['could not read an instruction'];
    if (!outs.every(o => close(o, outs[0]))) return ['the trick does not end on the same number'];
    return same(q, outs[0], 'number trick');
  }
  const rel = [...p.matchAll(/has ₹\$(\d+)\$ (more|less) than (twice|three times|\d+ times) what/g)];
  const x0 = p.match(/when \S+ has ₹\$(\d+)\$/);
  if (rel.length === 2 && x0) {
    let v = Number(x0[1]);
    for (const [, k, dir, t] of rel) v = TIMES(t) * v + (dir === 'more' ? 1 : -1) * Number(k);
    return same(q, v, 'relation chain');
  }
  return unread('translation');
}
function translationMiss(q) {
  const p = q.prompt;
  const rel = [...p.matchAll(/has ₹\$(\d+)\$ (more|less) than (twice|three times|\d+ times) what/g)];
  const x0 = p.match(/when \S+ has ₹\$(\d+)\$/);
  if (rel.length !== 2 || !x0) return [];
  const sg = r => (r[2] === 'more' ? 1 : -1) * Number(r[1]);
  const x = Number(x0[1]);
  const b = TIMES(rel[0][3]) * x + sg(rel[0]);
  return others(q, [b, TIMES(rel[0][3]) * TIMES(rel[1][3]) * x + sg(rel[0]) + sg(rel[1])]);
}

function formula(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/value of \$(.+?)\$ when \$a = (-?\d+)\$ and \$b = (-?\d+)\$/))) {
    const js = m[1].replace(/(\d)\(/g, '$1*(').replace(/(\d)([ab])/g, '$1*$2').replace(/a/g, `(${m[2]})`).replace(/b/g, `(${m[3]})`);
    return same(q, Function(`return ${js}`)(), 'formula value');
  }
  if ((m = p.match(/is \$C = (\d+) \+ (\d+)n\$\. The school has ₹\$([\d{},]+)\$/))) {
    const F = Number(m[1]), r = Number(m[2]), B = num(m[3]);
    let n = 0;
    while (F + r * (n + 1) <= B) n++;
    return same(q, n, 'copies');
  }
  if ((m = p.match(/charges ₹\$(\d+)\$ for the first \$(\d+)\$ km and ₹\$(\d+)\$ for every further whole kilometre.*with ₹\$(\d+)\$\?/))) {
    const [base, free, r, B] = m.slice(1).map(Number);
    let d = free;
    if (base > B) return ['cannot even pay the base fare'];
    while (base + r * (d + 1 - free) <= B) d++;
    return same(q, d, 'kilometres');
  }
  return unread('formula');
}
function formulaMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/is \$C = (\d+) \+ (\d+)n\$\. The school has ₹\$([\d{},]+)\$/))) return others(q, [Math.floor(num(m[3]) / Number(m[2]))]);
  if ((m = p.match(/for the first \$(\d+)\$ km/))) return others(q, [keyed(q) - Number(m[1])]);
  return [];
}

// ── 5 · Lines and angles ────────────────────────────────────────────────────
function anglePair(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/\\angle AOC = \((.+?)\)\^\\circ\$ and \$\\angle (BOD|BOC) = \((.+?)\)\^\\circ\$\. Find \$\\angle (\w+)\$/))) {
    const e1 = linear(m[1]), e2 = linear(m[3]);
    if (!e1 || !e2) return unread('crossing-lines');
    const sols = xs(x => (m[2] === 'BOD' ? at(e1, x) === at(e2, x) : at(e1, x) + at(e2, x) === 180) && at(e1, x) > 0 && at(e2, x) > 0);
    if (sols.length !== 1) return [`${sols.length} values of x fit`];
    const aoc = at(e1, sols[0]);
    const angle = { AOC: aoc, BOD: aoc, AOD: 180 - aoc, BOC: 180 - aoc }[m[4]];
    return same(q, angle, 'angle at O');
  }
  if ((m = p.match(/ratio \$(\d+) : (\d+) : (\d+)\$\. What is the (largest|smallest)/))) {
    const r = m.slice(1, 4).map(Number);
    const units = xs(u => r.reduce((s, v) => s + v * u, 0) === 180);
    if (units.length !== 1) return ['the ratio does not share 180 in whole degrees'];
    const angles = r.map(v => v * units[0]);
    return same(q, m[4] === 'largest' ? Math.max(...angles) : Math.min(...angles), 'three lines');
  }
  return unread('angle pair');
}
function anglePairMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/ratio \$(\d+) : (\d+) : (\d+)\$\. What is the (largest|smallest)/))) {
    const r = m.slice(1, 4).map(Number), s = r[0] + r[1] + r[2];
    return others(q, [(360 / s) * (m[4] === 'largest' ? Math.max(...r) : Math.min(...r))]);
  }
  return others(q, [180 - keyed(q)]);
}

/** Angle AEC from coordinates: AB on y = 1, CD on y = 0, E at height 1/2. */
function bentAngle(a, c) {
  const rad = d => (d * Math.PI) / 180;
  const E = [0.5 / Math.tan(rad(a)), 0.5];
  const A = [0, 1], C = [E[0] - 0.5 / Math.tan(rad(c)), 0];
  const u = [A[0] - E[0], A[1] - E[1]], v = [C[0] - E[0], C[1] - E[1]];
  return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
}
function transversal(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/If \$\\angle BAE = (\d+)\^\\circ\$ and \$\\angle DCE = (\d+)\^\\circ\$, find \$\\angle AEC\$/))) return same(q, Math.round(bentAngle(Number(m[1]), Number(m[2])) * 1e6) / 1e6, 'angle AEC');
  if ((m = p.match(/If \$\\angle AEC = (\d+)\^\\circ\$ and \$\\angle BAE = (\d+)\^\\circ\$, find \$\\angle DCE\$/))) {
    const hits = xs(c => c + Number(m[2]) < 180 && close(bentAngle(Number(m[2]), c), Number(m[1]), 1e-6));
    return hits.length === 1 ? same(q, hits[0], 'angle DCE') : [`${hits.length} angles fit`];
  }
  if ((m = p.match(/A pair of (alternate interior|corresponding) angles measure \$\((.+?)\)\^\\circ\$ and \$\((.+?)\)\^\\circ\$\. Find (.+)\.$/))) {
    const e1 = linear(m[2]), e2 = linear(m[3]);
    const sols = xs(x => at(e1, x) === at(e2, x) && at(e1, x) > 0 && at(e1, x) < 180);
    if (sols.length !== 1) return [`${sols.length} values of x fit`];
    if (!/linear pair|other pair of alternate interior/.test(m[4])) return unread('transversal ask');
    return same(q, 180 - at(e1, sols[0]), 'supplementary angle');
  }
  return unread('transversal');
}
function transversalMiss(q) {
  const p = q.prompt;
  if (/find \$\\angle AEC\$/.test(p)) return others(q, [180 - keyed(q), 360 - keyed(q)]);
  if (/find \$\\angle DCE\$/.test(p)) { const m = p.match(/AEC = (\d+)/); return others(q, [180 - Number(m[1])]); }
  return others(q, [180 - keyed(q)]);
}

// ── 6 · Number play ─────────────────────────────────────────────────────────
function combos(arr, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out); acc.pop(); }
  return out;
}
const parityJs = tex => tex.replace(/\\times/g, '*').replace(/ab/g, 'a*b').replace(/(\d)([ab])/g, '$1*$2');
function parity(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/cards carry the numbers (.+?)\. In how many different ways can you choose (two|three) cards whose numbers (add up to|multiply to) an (odd|even) number/))) {
    const nums = [...m[1].matchAll(/\$(\d+)\$/g)].map(x => Number(x[1]));
    const k = m[2] === 'two' ? 2 : 3;
    const want = m[4] === 'odd' ? 1 : 0;
    const got = combos(nums, k).filter(c => (m[3] === 'add up to' ? c.reduce((a, b) => a + b, 0) : c.reduce((a, b) => a * b, 1)) % 2 === want).length;
    return same(q, got, 'card choices');
  }
  if ((m = p.match(/\$a\$ is (odd|even) and the whole number \$b\$ is (odd|even)\. How many of these are always (odd|even)\? (.+)$/))) {
    const items = m[4].split(/\$,\s*\$/).map(s => s.replace(/\$/g, '').trim());
    const as = m[1] === 'odd' ? [1, 3, 5, 7, 11] : [0, 2, 4, 6, 10];
    const bs = m[2] === 'odd' ? [1, 3, 9, 15] : [0, 2, 8, 12];
    const want = m[3] === 'odd' ? 1 : 0;
    let count = 0;
    for (const it of items) {
      const f = Function('a', 'b', `return ${parityJs(it)}`);
      if (as.every(a => bs.every(b => Math.abs(f(a, b)) % 2 === want))) count++;
    }
    return same(q, count, 'always-parity count');
  }
  return unread('parity');
}
function parityMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/(Six|Seven) cards/))) {
    const n = m[1] === 'Six' ? 6 : 7;
    const total = /three cards/.test(p) ? (n * (n - 1) * (n - 2)) / 6 : (n * (n - 1)) / 2;
    return others(q, [total, total - keyed(q)]);
  }
  return others(q, [6 - keyed(q)]);
}

/** Gaussian elimination: the value of one unknown if the system fixes it. */
function solveFor(rows, nVars, target) {
  const A = rows.map(r => [...r]);
  const piv = [];
  let row = 0;
  for (let col = 0; col < nVars && row < A.length; col++) {
    let best = row;
    for (let r = row; r < A.length; r++) if (Math.abs(A[r][col]) > Math.abs(A[best][col])) best = r;
    if (Math.abs(A[best][col]) < 1e-9) continue;
    [A[row], A[best]] = [A[best], A[row]];
    const pv = A[row][col];
    for (let c = 0; c <= nVars; c++) A[row][c] /= pv;
    for (let r = 0; r < A.length; r++) {
      if (r !== row && Math.abs(A[r][col]) > 1e-12) { const f = A[r][col]; for (let c = 0; c <= nVars; c++) A[r][c] -= f * A[row][c]; }
    }
    piv.push(col);
    row++;
  }
  for (let r = row; r < A.length; r++) if (Math.abs(A[r][nVars]) > 1e-7) return { inconsistent: true };
  const pr = piv.indexOf(target);
  if (pr < 0) return { free: true };
  for (let c = 0; c < nVars; c++) if (c !== target && Math.abs(A[pr][c]) > 1e-9) return { free: true };
  return { value: A[pr][nVars] };
}
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function magicSearch(nums) {
  const S = nums.reduce((a, b) => a + b, 0) / 3;
  const out = [], grid = [], used = Array(9).fill(false);
  const lineOk = () => LINES.every(l => l.some(i => i >= grid.length) || l.reduce((s, i) => s + grid[i], 0) === S);
  const rec = () => {
    if (grid.length === 9) { out.push([...grid]); return; }
    for (let i = 0; i < 9; i++) {
      if (used[i]) continue;
      used[i] = true; grid.push(nums[i]);
      if (lineOk()) rec();
      grid.pop(); used[i] = false;
    }
  };
  rec();
  return out;
}
function magic(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/\\begin\{array\}\{\|c\|c\|c\|\}\\hline (.+?) \\\\ \\hline\\end\{array\}/))) {
    const cells = m[1].split(/\\\\ \\hline/).flatMap(r => r.split('&').map(s => s.trim()));
    if (cells.length !== 9) return ['could not read the square'];
    const xi = cells.indexOf('x');
    const rows = LINES.map(l => { const r = Array(11).fill(0); l.forEach(i => { r[i] = 1; }); r[9] = -1; return r; });
    cells.forEach((c, i) => { if (/^-?\d+$/.test(c)) { const r = Array(11).fill(0); r[i] = 1; r[10] = Number(c); rows.push(r); } });
    const sol = solveFor(rows, 10, xi);
    if (sol.inconsistent) return ['the square cannot be completed'];
    if (sol.free) return ['x is not fixed by the given entries'];
    return same(q, Math.round(sol.value * 1e6) / 1e6, 'magic square cell');
  }
  if ((m = p.match(/The nine numbers (.+?) are placed in a 3 × 3 grid.*?(What number must go in the centre square|What must the common sum of each line be|What is the total of the four numbers in the corner squares)\?/))) {
    const nums = [...m[1].matchAll(/\$(\d+)\$/g)].map(x => Number(x[1]));
    const sqs = magicSearch(nums);
    if (!sqs.length) return ['no magic square uses these numbers'];
    const val = g => (/centre/.test(m[2]) ? g[4] : /common sum/.test(m[2]) ? g[0] + g[1] + g[2] : g[0] + g[2] + g[6] + g[8]);
    const vals = new Set(sqs.map(val));
    return vals.size === 1 ? same(q, [...vals][0], 'magic square from nine') : ['the answer differs between magic squares'];
  }
  return unread('magic square');
}
function magicMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/The nine numbers (.+?) are placed/))) { const nums = [...m[1].matchAll(/\$(\d+)\$/g)].map(x => Number(x[1])); return others(q, [nums.reduce((a, b) => a + b, 0)]); }
  return [];
}

function cryptSolutions(puzzle) {
  const letters = [...new Set(puzzle.replace(/[^A-Z]/g, ''))];
  const [lhs, rhs] = puzzle.split('=');
  const words = puzzle.match(/[A-Z]+/g);
  const leading = new Set(words.filter(w => w.length > 1).map(w => w[0]));
  const sols = [];
  const assign = {};
  const val = w => [...w].reduce((v, ch) => v * 10 + assign[ch], 0);
  const sideVal = s => s.split('+').map(t => t.split('*').map(val).reduce((a, b) => a * b, 1)).reduce((a, b) => a + b, 0);
  const go = (i, used) => {
    if (i === letters.length) { if (sideVal(lhs) === sideVal(rhs)) sols.push({ ...assign }); return; }
    for (let d = 0; d <= 9; d++) {
      if (used & (1 << d) || (d === 0 && leading.has(letters[i]))) continue;
      assign[letters[i]] = d; go(i + 1, used | (1 << d));
    }
  };
  go(0, 0);
  return sols;
}
function crypt(q) {
  const p = q.prompt;
  const m = p.match(/In the puzzle \$(.+?)\$, each letter/);
  if (!m) return unread('cryptarithm');
  const puzzle = m[1].replace(/\\times/g, '*').replace(/\s+/g, '');
  const sols = cryptSolutions(puzzle);
  if (sols.length !== 1) return [`${sols.length} solutions to the puzzle`];
  const s = sols[0];
  let a;
  if ((a = p.match(/What number is \$([A-Z]+)\$\?$/))) return same(q, Number([...a[1]].map(ch => s[ch]).join('')), 'cryptarithm word');
  if ((a = p.match(/What is \$([A-Z +]+)\$\?$/))) return same(q, a[1].split('+').map(x => s[x.trim()]).reduce((x, y) => x + y, 0), 'cryptarithm letter sum');
  return unread('cryptarithm ask');
}

// ── 7 · Triangles ───────────────────────────────────────────────────────────
function angleSum(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/\\angle ACD = (\d+)\^\\circ\$ and \$\\angle A : \\angle B = (\d+) : (\d+)\$\. Find \$\\angle ([AB])\$/))) {
    const [e, pa, pb] = m.slice(1, 4).map(Number);
    const hits = [];
    for (let A = 1; A < 180; A++) for (let B = 1; A + B < 180; B++) if (A + B + (180 - e) === 180 && A * pb === B * pa) hits.push([A, B]);
    if (hits.length !== 1) return [`${hits.length} triangles fit`];
    return same(q, m[4] === 'A' ? hits[0][0] : hits[0][1], 'triangle angle');
  }
  if ((m = p.match(/\\angle P = \((.+?)\)\^\\circ\$, \$\\angle Q = \((.+?)\)\^\\circ\$ and \$\\angle R = \((.+?)\)\^\\circ\$\. Classify/))) {
    const es = m.slice(1, 4).map(linear);
    if (es.some(e => !e)) return unread('classify');
    const sols = xs(x => es.reduce((s, e) => s + at(e, x), 0) === 180);
    if (sols.length !== 1) return [`${sols.length} values of x fit`];
    const angles = es.map(e => at(e, sols[0]));
    if (angles.some(a => a <= 0)) return ['an angle is not positive'];
    const big = Math.max(...angles);
    const kind = big > 90 ? 'Obtuse-angled' : big === 90 ? 'Right-angled' : 'Acute-angled';
    const keyedOpt = q.mcqOptions?.[q.answer.correctIndex];
    if (q.mcqOptions.filter(o => o === kind).length !== 1) return ['the right class is not exactly one option'];
    return keyedOpt === kind ? [] : [`classified ${kind}, keyed ${keyedOpt}`];
  }
  return unread('angle sum');
}
function angleSumMiss(q) {
  const m = q.prompt.match(/\\angle ACD = (\d+)\^\\circ\$ and \$\\angle A : \\angle B = (\d+) : (\d+)\$\. Find \$\\angle ([AB])\$/);
  if (!m) return [];
  const [e, pa, pb] = m.slice(1, 4).map(Number);
  return others(q, [e - keyed(q), ((180 - e) / (pa + pb)) * (m[4] === 'A' ? pa : pb)]);
}

const isTri = (x, y, z) => { const s = [x, y, z].sort((a, b) => a - b); return s[0] > 0 && s[0] + s[1] > s[2]; };
function triIneq(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/Two sides of a triangle are \$(\d+)\$ cm and \$(\d+)\$ cm long\. The third side is a whole number of centimetres (.+?)\. How many/))) {
    const a = Number(m[1]), b = Number(m[2]), cond = m[3];
    const k = cond.match(/multiple of \$(\d+)\$/);
    const test = c => (/even number/.test(cond) ? c % 2 === 0 : /odd number/.test(cond) ? c % 2 === 1 : /scalene/.test(cond) ? c !== a && c !== b
      : /longest side/.test(cond) ? c > a && c > b : k ? (a + b + c) % Number(k[1]) === 0 : null);
    if (test(1) === null) return unread('third-side condition');
    let count = 0;
    for (let c = 1; c <= 100; c++) if (isTri(a, b, c) && test(c)) count++;
    return same(q, count, 'third-side count');
  }
  if ((m = p.match(/isosceles triangle has a perimeter of \$(\d+)\$ cm/))) {
    const P = Number(m[1]);
    const seen = new Set();
    for (let x = 1; x < P; x++) for (let y = 1; x + y < P; y++) {
      const z = P - x - y;
      if ((x === y || y === z || x === z) && isTri(x, y, z)) seen.add([x, y, z].sort((s, t) => s - t).join(','));
    }
    return same(q, seen.size, 'isosceles count');
  }
  if ((m = p.match(/A stick \$(\d+)\$ cm long is cut into three pieces/))) {
    const L = Number(m[1]);
    let best = 0;
    for (let x = 1; x < L; x++) for (let y = 1; x + y < L; y++) { const z = L - x - y; if (isTri(x, y, z)) best = Math.max(best, x, y, z); }
    return same(q, best, 'longest piece');
  }
  return unread('triangle inequality');
}
function triIneqMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/Two sides of a triangle are \$(\d+)\$ cm and \$(\d+)\$ cm/))) { const a = Number(m[1]), b = Number(m[2]); return others(q, [a + b - 1 - Math.abs(a - b)]); }
  if ((m = p.match(/perimeter of \$(\d+)\$ cm/))) return others(q, [Math.floor((m[1] - 1) / 2)]);
  if ((m = p.match(/A stick \$(\d+)\$ cm/))) return others(q, [Math.floor(m[1] / 2), m[1] - 2]);
  return [];
}

/** How many triangles a set of measurements gives: 0, 1, 2 or Infinity. */
function triangleCount(text) {
  const sides = {}, angles = {};
  for (const [, s, v] of text.matchAll(/\$(PQ|QR|RP) = (\d+)\$ cm/g)) sides[s] = Number(v);
  for (const [, a, v] of text.matchAll(/\$\\angle ([PQR]) = (\d+)\^\\circ\$/g)) angles[a] = Number(v);
  const S = Object.keys(sides), A = Object.keys(angles);
  if (S.length + A.length !== 3) return null;
  if (S.length === 3) return isTri(sides.PQ, sides.QR, sides.RP) ? 1 : 0;
  if (A.length === 3) return A.reduce((s, k) => s + angles[k], 0) === 180 ? Infinity : 0;
  if (A.length === 2) return A.reduce((s, k) => s + angles[k], 0) < 180 ? 1 : 0;
  const V = A[0], ang = angles[V];
  if (S.every(s => s.includes(V))) return ang < 180 ? 1 : 0;     // included angle
  const adj = sides[S.find(s => s.includes(V))], opp = sides[S.find(s => !s.includes(V))];
  if (ang >= 90) return opp > adj ? 1 : 0;
  const h = adj * Math.sin((ang * Math.PI) / 180);
  if (opp < h - 1e-9) return 0;
  if (Math.abs(opp - h) < 1e-9 || opp >= adj) return 1;
  return 2;
}
function construction(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/draws \$QR = (\d+)\$ cm and then, with a compass, an arc of radius \$(\d+)\$ cm centred at \$Q\$.*whole number of centimetres( and the triangle is to be scalene| and \$PR\$ is to be longer than \$PQ\$)?\. How many/))) {
    const d = Number(m[1]), r1 = Number(m[2]);
    let count = 0;
    for (let r = 1; r <= 60; r++) {
      if (!isTri(d, r1, r)) continue;
      if (m[3] && /scalene/.test(m[3]) && (r === d || r === r1 || d === r1)) continue;
      if (m[3] && /longer/.test(m[3]) && !(r > r1)) continue;
      count++;
    }
    return same(q, count, 'second-arc radii');
  }
  if (/fixes exactly one triangle/.test(p) && q.answerType === 'mcq') {
    const counts = q.mcqOptions.map(triangleCount);
    if (counts.some(c => c == null)) return ['could not read an option'];
    const ones = counts.map((c, i) => (c === 1 ? i : -1)).filter(i => i >= 0);
    if (ones.length !== 1) return [`${ones.length} options fix exactly one triangle: ${JSON.stringify(counts)}`];
    return ones[0] === q.answer.correctIndex ? [] : [`option ${ones[0]} fixes one triangle, keyed ${q.answer.correctIndex}`];
  }
  return unread('construction');
}
function constructionMiss(q) {
  const m = q.prompt.match(/draws \$QR = (\d+)\$ cm and then, with a compass, an arc of radius \$(\d+)\$ cm/);
  if (!m) return [];
  const d = Number(m[1]), r1 = Number(m[2]);
  return others(q, [d + r1 - Math.abs(d - r1) + 1, d + r1 - 1 - Math.abs(d - r1)]);
}

// ── 8 · Fractions ───────────────────────────────────────────────────────────
function fracKey(q, n, d, what) {
  const g = gcdB(n, d);
  n /= g; d /= g;
  const sf = q.answer.simplestFraction;
  if (!sf) return [`${what}: no fraction keyed`];
  if (BigInt(sf.n) !== n || BigInt(sf.d) !== d) return [`${what}: re-derived ${n}/${d}, keyed ${sf.n}/${sf.d}`];
  return close(q.answer.value, Number(n) / Number(d)) ? [] : [`${what}: value ${q.answer.value} does not match ${n}/${d}`];
}
function fractionProduct(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/the denominators go up by one from \$(\d+)\$ to \$(\d+)\$/))) {
    const minus = /\\left\(1 - \\dfrac/.test(p), plus = /\\left\(1 \+ \\dfrac/.test(p);
    if (minus === plus) return unread('telescoping sign');
    let n = 1n, d = 1n;
    for (let k = Number(m[1]); k <= Number(m[2]); k++) { n *= BigInt(minus ? k - 1 : k + 1); d *= BigInt(k); }
    return fracKey(q, n, d, 'telescoping product');
  }
  if ((m = p.match(/^Find \$(.+?)\$\. Cancel common factors/))) {
    const fs = [...m[1].matchAll(/\\dfrac\{(\d+)\}\{(\d+)\}/g)];
    if (fs.length !== 3) return unread('fraction product');
    return fracKey(q, fs.reduce((a, f) => a * BigInt(f[1]), 1n), fs.reduce((a, f) => a * BigInt(f[2]), 1n), 'fraction product');
  }
  return unread('fraction product');
}
function fractionProductMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/the denominators go up by one from \$(\d+)\$ to \$(\d+)\$/))) {
    const k = Number(m[1]), n = Number(m[2]);
    const cand = /1 - \\dfrac/.test(p) ? [`1/${n}`, `${k}/${n}`] : [`${n}/${k}`, `${n + 1}/${k + 1}`];
    return cand.filter(s => { const [a, b] = s.split('/').map(Number); return !close(a / b, q.answer.value); });
  }
  if ((m = p.match(/^Find \$(.+?)\$\. Cancel/))) {
    const fs = [...m[1].matchAll(/\\dfrac\{(\d+)\}\{(\d+)\}/g)].map(f => [Number(f[1]), Number(f[2])]);
    const n = fs[0][0] * fs[1][0], d = fs[0][1] * fs[1][1], g = gcdN(n, d);
    return close(n / d, q.answer.value) ? [] : [`${n / g}/${d / g}`];
  }
  return [];
}

function fractionMagnitude(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/how many of these products are (greater|less) than \$(\d+)\$: (.+)\.$/))) {
    const N = BigInt(m[2]);
    const items = m[3].split(/\$,\s*\$/);
    if (items.length !== 6) return unread('magnitude items');
    let count = 0;
    for (const it of items) {
      const fs = [...it.matchAll(/\\dfrac\{(\d+)\}\{(\d+)\}/g)];
      const top = fs.reduce((a, f) => a * BigInt(f[1]), N), bottom = fs.reduce((a, f) => a * BigInt(f[2]), 1n);
      // product = top / bottom; compare with N
      if (m[1] === 'greater' ? top > N * bottom : top < N * bottom) count++;
    }
    return same(q, count, 'magnitude count');
  }
  if ((m = p.match(/multiplies it by \$\\dfrac\{(\d+)\}\{(\d+)\}\$, and then multiplies the result by \$\\dfrac\{k\}\{(\d+)\}\$.*What is the (smallest|greatest) whole number \$k\$/))) {
    const [a, b, r] = m.slice(1, 4).map(Number);
    const start = 7 * b * r;   // any positive start; kept whole so the test is exact
    const ks = [];
    for (let k = 0; k <= 1000; k++) {
      const fin = (start * a * k) / (b * r);
      if (m[4] === 'smallest' ? fin > start : fin < start) ks.push(k);
    }
    if (!ks.length) return ['no k works'];
    return same(q, m[4] === 'smallest' ? Math.min(...ks) : Math.max(...ks), 'multiplier k');
  }
  return unread('magnitude');
}
function fractionMagnitudeMiss(q) {
  const m = q.prompt.match(/multiplies it by \$\\dfrac\{(\d+)\}\{(\d+)\}\$, and then multiplies the result by \$\\dfrac\{k\}\{(\d+)\}\$/);
  if (!m) return [];
  const [a, b, r] = m.slice(1, 4).map(Number);
  return others(q, [(b * r) / a, r]);
}

function fractionContext(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/spent \$\\dfrac\{(\d+)\}\{(\d+)\}\$ of a sum of savings on .+?, and then \$\\dfrac\{(\d+)\}\{(\d+)\}\$ of what was left on .+?\. After that, ₹\$(\d+)\$ of the savings was left/))) {
    const [p1, q1, p2, q2, left] = m.slice(1).map(Number);
    const hits = [];
    for (let M = 1; M <= 50000; M++) {
      if ((M * p1) % q1) continue;
      const after1 = M - (M * p1) / q1;
      if ((after1 * p2) % q2) continue;
      if (after1 - (after1 * p2) / q2 === left) hits.push(M);
    }
    return hits.length === 1 ? same(q, hits[0], 'starting savings') : [`${hits.length} starting amounts fit`];
  }
  if ((m = p.match(/\$\\dfrac\{(\d+)\}\{(\d+)\}\$ of the Class VII students are girls.*\$\\dfrac\{(\d+)\}\{(\d+)\}\$ of the girls and \$\\dfrac\{(\d+)\}\{(\d+)\}\$ of the boys signed up\. If \$(\d+)\$ girls signed up, how many (boys signed up|students signed up altogether)/))) {
    const [g1, g2, a1, a2, b1, b2, gGo] = m.slice(1, 8).map(Number);
    const hits = [];
    for (let N = 1; N <= 5000; N++) {
      if ((N * g1) % g2) continue;
      const girls = (N * g1) / g2, boys = N - girls;
      if ((girls * a1) % a2 || (boys * b1) % b2) continue;
      if ((girls * a1) / a2 === gGo) hits.push((boys * b1) / b2);
    }
    const uniq = [...new Set(hits)];
    if (uniq.length !== 1) return [`${uniq.length} answers fit the class`];
    return same(q, m[8].startsWith('boys') ? uniq[0] : uniq[0] + gGo, 'trip sign-ups');
  }
  return unread('fraction context');
}
function fractionContextMiss(q) {
  const p = q.prompt;
  let m;
  if ((m = p.match(/spent \$\\dfrac\{(\d+)\}\{(\d+)\}\$ of a sum/))) return others(q, [keyed(q) - (keyed(q) * m[1]) / m[2]]);
  if ((m = p.match(/If \$(\d+)\$ girls signed up, how many students/))) return others(q, [keyed(q) - Number(m[1])]);
  return [];
}

export const SOLVE = {
  'c7-place-value-systems-reasoning': placeValue,
  'c7-rounding-bounds-reasoning': rounding,
  'c7-factor-regroup-reasoning': factorRegroup,
  'c7-expression-comparison-reasoning': exprComparison,
  'c7-bracket-placement-reasoning': bracket,
  'c7-property-rewrite-reasoning': propertyRewrite,
  'c7-decimal-place-value-reasoning': decimalPlace,
  'c7-decimal-ordering-reasoning': decimalOrdering,
  'c7-letter-pattern-reasoning': letterPattern,
  'c7-expression-translation-reasoning': translation,
  'c7-formula-evaluation-reasoning': formula,
  'c7-angle-pair-reasoning': anglePair,
  'c7-transversal-reasoning': transversal,
  'c7-parity-reasoning': parity,
  'c7-magic-square-reasoning': magic,
  'c7-cryptarithm-reasoning': crypt,
  'c7-angle-sum-reasoning': angleSum,
  'c7-triangle-inequality-reasoning': triIneq,
  'c7-triangle-construction-reasoning': construction,
  'c7-fraction-product-reasoning': fractionProduct,
  'c7-fraction-magnitude-reasoning': fractionMagnitude,
  'c7-fraction-context-reasoning': fractionContext
};

export const NEAR_MISS = {
  'c7-place-value-systems-reasoning': placeValueMiss,
  'c7-rounding-bounds-reasoning': roundingMiss,
  'c7-factor-regroup-reasoning': factorMiss,
  'c7-expression-comparison-reasoning': exprComparisonMiss,
  'c7-bracket-placement-reasoning': bracketMiss,
  'c7-property-rewrite-reasoning': propertyMiss,
  'c7-decimal-place-value-reasoning': decimalPlaceMiss,
  'c7-decimal-ordering-reasoning': decimalOrderingMiss,
  'c7-letter-pattern-reasoning': letterPatternMiss,
  'c7-expression-translation-reasoning': translationMiss,
  'c7-formula-evaluation-reasoning': formulaMiss,
  'c7-angle-pair-reasoning': anglePairMiss,
  'c7-transversal-reasoning': transversalMiss,
  'c7-parity-reasoning': parityMiss,
  'c7-magic-square-reasoning': magicMiss,
  'c7-cryptarithm-reasoning': () => [],
  'c7-angle-sum-reasoning': angleSumMiss,
  'c7-triangle-inequality-reasoning': triIneqMiss,
  'c7-triangle-construction-reasoning': constructionMiss,
  'c7-fraction-product-reasoning': fractionProductMiss,
  'c7-fraction-magnitude-reasoning': fractionMagnitudeMiss,
  'c7-fraction-context-reasoning': fractionContextMiss
};
