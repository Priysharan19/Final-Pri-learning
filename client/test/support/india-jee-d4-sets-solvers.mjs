// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Sets forms
// (client/src/engine/generators/india-class11-jee-d4-sets.js).
//
// Nothing here imports the generator. Each solver reads the numbers and the
// set-builder definitions back out of the rendered prompt, builds the sets by
// scanning the integers against the stated rule, and counts by brute force:
// every subset X of B (or of U) as a bitmask, every ordered pair (X, Y) of
// subsets, every collection of subsets of A (all 2^(2^n) of them), every
// Venn diagram of whole-number regions consistent with the survey. Where the
// question asks for a least or greatest value, the extreme is taken over every
// feasible diagram, so attainment is checked rather than assumed; where the
// data should fix a value, the solver checks that every consistent diagram
// gives the same one. NEAR_MISS lists answers a student could plausibly write —
// mostly the same brute-force count with one condition of the question
// dropped — that must be marked WRONG.
// ─────────────────────────────────────────────────────────────────────────────

const keyed = q => q.answer.value;
const popcount = m => { let c = 0; for (let v = m; v; v &= v - 1) c++; return c; };

/** Members of a set given in the forms' set-builder notation, by scanning the integers. */
function readSet(tex) {
  const scan = test => { const out = []; for (let x = -300; x <= 300; x++) if (test(x)) out.push(x); return out; };
  let m = tex.match(/^\\\{x \\in \\mathbb\{N\} : x \\text\{ divides \} (\d+)\\\}$/);
  if (m) { const n = Number(m[1]); return scan(x => x >= 1 && n % x === 0); }
  m = tex.match(/^\\\{x \\in \\mathbb\{N\} : x \\le (\d+)\\\}$/);
  if (m) { const n = Number(m[1]); return scan(x => x >= 1 && x <= n); }
  m = tex.match(/^\\\{x \\in \\mathbb\{Z\} : x\^2 (<|\\le) (\d+)\\\}$/);
  if (m) { const c = Number(m[2]); return scan(m[1] === '<' ? x => x * x < c : x => x * x <= c); }
  m = tex.match(/^\\\{x \\in \\mathbb\{Z\} : \|x - (\d+)\| \\le (\d+)\\\}$/);
  if (m) { const h = Number(m[1]), r = Number(m[2]); return scan(x => Math.abs(x - h) <= r); }
  if (tex === '\\{x \\in \\mathbb{Z} : x^3 = x\\}') return scan(x => x * x * x === x);
  return null;
}

const primeTest = x => { if (x < 2) return false; for (let d = 2; d < x; d++) if (x % d === 0) return false; return true; };
const PROPERTY = {
  even: x => x % 2 === 0, odd: x => x % 2 !== 0, prime: primeTest,
  'a multiple of $3$': x => x % 3 === 0, 'multiples of $3$': x => x % 3 === 0,
  negative: x => x < 0, positive: x => x > 0
};
const U_PROPERTY = {
  '\\text{ is even}': x => x % 2 === 0, '\\text{ is odd}': x => x % 2 === 1,
  '\\text{ is a multiple of } 3': x => x % 3 === 0, '\\text{ is a multiple of } 4': x => x % 4 === 0,
  '\\text{ is a multiple of } 6': x => x % 6 === 0, '\\text{ is prime}': primeTest,
  '\\text{ is a perfect square}': x => { for (let r = 0; r * r <= x; r++) if (r * r === x) return true; return false; }
};

/** { value, relaxed } from a brute-force count, or an error string. */
function result(value, relaxed = []) { return { value, relaxed }; }

// ── 0 · Notation, subsets, power sets ────────────────────────────────────────
function analyseNotation(p) {
  let m = p.match(/^Let \$A = ([^$]+)\$ and \$B = ([^$]+)\$\. How many sets \$X\$ satisfy (.+)\?$/);
  if (m) {
    const A = readSet(m[1]), B = readSet(m[2]);
    if (!A || !B) return 'could not read A or B';
    if (!A.every(x => B.includes(x))) return 'A is not a subset of B';
    const n = B.length, maskA = B.reduce((s, x, i) => (A.includes(x) ? s | (1 << i) : s), 0), full = (1 << n) - 1;
    const rest = m[3];
    let cond, relaxedConds = [];
    let c;
    if ((c = rest.match(/^\$A \\subseteq X \\subseteq B\$ and \$n\(X\) = (\d+)\$$/))) {
      const k = Number(c[1]);
      cond = X => popcount(X) === k;
      relaxedConds = [() => true];
      // A k-element subset of B with no A ⊆ X condition.
      let loose = 0; for (let X = 0; X <= full; X++) if (popcount(X) === k) loose++;
      const out = countSandwich(maskA, full, cond, relaxedConds);
      return result(out.value, [...out.relaxed, loose]);
    }
    if ((c = rest.match(/^\$A \\subsetneq X \\subsetneq B\$ \(that is, \$X\$ is different from both \$A\$ and \$B\$\) and have \$n\(X\)\$ (odd|even)$/))) {
      const par = c[1] === 'odd' ? 1 : 0;
      cond = X => X !== maskA && X !== full && popcount(X) % 2 === par;
      relaxedConds = [X => popcount(X) % 2 === par, X => X !== maskA && X !== full];
      return countSandwich(maskA, full, cond, relaxedConds);
    }
    if ((c = rest.match(/^\$A \\subseteq X \\subseteq B\$ and have exactly \$(\d+)\$ elements? that (?:is|are) (.+)$/))) {
      const j = Number(c[1]), test = PROPERTY[c[2]];
      if (!test) return `unknown property ${c[2]}`;
      const has = X => B.filter((x, i) => X & (1 << i)).filter(test).length;
      cond = X => has(X) === j;
      const out = countSandwich(maskA, full, cond, [() => true]);
      let loose = 0; for (let X = 0; X <= full; X++) if (has(X) === j) loose++;
      return result(out.value, [...out.relaxed, loose]);
    }
    return 'could not read the condition on X';
  }
  m = p.match(/^Let \$S = ([^$]+)\$\. How many ordered pairs \$\(X, Y\)\$ of subsets of \$S\$ satisfy (.+)\?$/);
  if (m) {
    const S = readSet(m[1]);
    if (!S) return 'could not read S';
    const n = S.length, full = (1 << n) - 1, rest = m[2];
    const sub = (X, Y) => (X & ~Y) === 0;
    const dis = (X, Y) => (X & Y) === 0;
    let c, cond, loose;
    if ((c = rest.match(/^\$X \\subseteq Y\$ and \$n\(Y\) = (\d+)\$$/))) {
      const k = Number(c[1]);
      cond = (X, Y) => sub(X, Y) && popcount(Y) === k; loose = [(X, Y) => sub(X, Y), (X, Y) => popcount(Y) === k];
    } else if ((c = rest.match(/^\$X \\subseteq Y\$ and \$n\(Y - X\) = (\d+)\$$/))) {
      const k = Number(c[1]);
      cond = (X, Y) => sub(X, Y) && popcount(Y & ~X) === k; loose = [(X, Y) => sub(X, Y), (X, Y) => popcount(Y & ~X) === k];
    } else if (rest === '$X \\cap Y = \\emptyset$, $X \\ne \\emptyset$ and $Y \\ne \\emptyset$') {
      cond = (X, Y) => dis(X, Y) && X && Y; loose = [(X, Y) => dis(X, Y), (X, Y) => dis(X, Y) && (X || Y)];
    } else if (rest === '$X \\subseteq Y$ and $X \\ne Y$') {
      cond = (X, Y) => sub(X, Y) && X !== Y; loose = [(X, Y) => sub(X, Y), (X, Y) => X !== Y];
    } else if ((c = rest.match(/^\$X \\cap Y = \\emptyset\$, \$n\(X \\cup Y\) = (\d+)\$, \$X \\ne \\emptyset\$ and \$Y \\ne \\emptyset\$$/))) {
      const k = Number(c[1]);
      cond = (X, Y) => dis(X, Y) && popcount(X | Y) === k && X && Y;
      loose = [(X, Y) => dis(X, Y) && popcount(X | Y) === k, (X, Y) => dis(X, Y) && popcount(X | Y) === k && (X || Y)];
    } else return 'could not read the condition on (X, Y)';
    const counts = [cond, ...loose].map(() => 0);
    for (let X = 0; X <= full; X++) for (let Y = 0; Y <= full; Y++) [cond, ...loose].forEach((f, i) => { if (f(X, Y)) counts[i]++; });
    return result(counts[0], counts.slice(1));
  }
  m = p.match(/^Let \$A = ([^$]+)\$ and let \$P\(A\)\$ be its power set\. How many sets \$\\mathcal\{S\}\$ with \$\\mathcal\{S\} \\subseteq P\(A\)\$ are there such that (.+)\?$/);
  if (m) {
    const A = readSet(m[1]);
    if (!A) return 'could not read A';
    const n = A.length;
    if (n > 4) return 'A is too large to enumerate every collection';
    const members = 1 << n;                     // member i of P(A) is the subset with bitmask i
    const rest = m[2];
    let c, allowed, cond;
    const inside = (coll, ok) => { for (let i = 0; i < members; i++) if ((coll >> i) & 1 && !ok(i)) return false; return true; };
    if ((c = rest.match(/^\$\\mathcal\{S\} \\ne \\emptyset\$ and every member of \$\\mathcal\{S\}\$ has exactly \$(\d+)\$ elements?$/))) {
      const j = Number(c[1]);
      allowed = i => popcount(i) === j;
      cond = coll => coll !== 0 && inside(coll, allowed);
    } else if ((c = rest.match(/^\$\\mathcal\{S\} \\ne \\emptyset\$ and every member of \$\\mathcal\{S\}\$ contains the element \$(-?\d+)\$$/))) {
      const e = A.indexOf(Number(c[1]));
      if (e < 0) return 'the element named is not in A';
      allowed = i => (i >> e) & 1;
      cond = coll => coll !== 0 && inside(coll, allowed);
    } else if (rest === '$\\emptyset \\in \\mathcal{S}$ and $A \\in \\mathcal{S}$') {
      cond = coll => (coll & 1) && ((coll >> (members - 1)) & 1);
    } else if ((c = rest.match(/^\$\\mathcal\{S\}\$ has exactly \$(\d+)\$ members and \$\\emptyset \\notin \\mathcal\{S\}\$$/))) {
      const k = Number(c[1]);
      cond = coll => popcount(coll) === k && !(coll & 1);
      allowed = () => true;
    } else return 'could not read the condition on the collection';
    let value = 0, withEmpty = 0, anyMember = 0;
    const total = 2 ** members;
    for (let coll = 0; coll < total; coll++) {
      if (cond(coll)) value++;
      if (allowed && inside(coll, allowed)) withEmpty++;
    }
    anyMember = total;
    return result(value, [withEmpty, anyMember, value + 1, value - 1]);
  }
  return 'could not read the prompt';
}

/** Every subset X of B (bitmask over B's members) with A ⊆ X, under cond and relaxed versions. */
function countSandwich(maskA, full, cond, relaxedConds) {
  const counts = [cond, ...relaxedConds].map(() => 0);
  for (let X = 0; X <= full; X++) {
    if ((X & maskA) !== maskA) continue;
    [cond, ...relaxedConds].forEach((f, i) => { if (f(X)) counts[i]++; });
  }
  return result(counts[0], counts.slice(1));
}

// ── 1 · Operations ───────────────────────────────────────────────────────────
function analyseOperations(p) {
  let m = p.match(/^Of the \$(\d+)\$ students in a (?:hostel|school|college) in [A-Z][a-z]+, \$(\d+)\$ play (.+?) and \$(\d+)\$ play (.+?)\. (At least|At most) \$(\d+)\$ students? plays? neither game\. What is the (least|greatest) possible number of students who (.+)\?$/);
  if (m) {
    const u = Number(m[1]), a = Number(m[2]), g1 = m[3], b = Number(m[4]), g2 = m[5];
    const atLeast = m[6] === 'At least', w = Number(m[7]), wantMax = m[8] === 'greatest';
    const targets = {
      'play both games': r => r.both,
      'play exactly one of the two games': r => r.onlyA + r.onlyB,
      [`play ${g1} but not ${g2}`]: r => r.onlyA,
      [`play ${g2} but not ${g1}`]: r => r.onlyB
    };
    const f = targets[m[9]];
    if (!f) return 'could not read what is asked';
    // Every Venn diagram of whole-number regions with the given totals.
    const vals = [], free = [];
    for (let onlyA = 0; onlyA <= u; onlyA++) for (let both = 0; onlyA + both <= u; both++) {
      if (onlyA + both !== a) continue;
      const onlyB = b - both, neither = u - onlyA - both - onlyB;
      if (onlyB < 0 || neither < 0) continue;
      const r = { onlyA, onlyB, both, neither };
      free.push(f(r));
      if (atLeast ? neither >= w : neither <= w) vals.push(f(r));
    }
    if (!vals.length) return 'no Venn diagram fits the data';
    const best = wantMax ? Math.max(...vals) : Math.min(...vals);
    const worst = wantMax ? Math.min(...vals) : Math.max(...vals);
    const loose = wantMax ? Math.max(...free) : Math.min(...free);
    return result(best, [worst, loose, best + (wantMax ? 1 : -1)]);
  }
  m = p.match(/^Let \$U = \\\{x \\in \\mathbb\{N\} : x \\le (\d+)\\\}\$, \$A = \\\{x \\in U : x (.+?)\\\}\$ and \$B = \\\{x \\in U : x (.+?)\\\}\$\. How many subsets \$X\$ of \$U\$ satisfy (.+)\?$/);
  if (m) {
    const N = Number(m[1]), ta = U_PROPERTY[m[2]], tb = U_PROPERTY[m[3]];
    if (!ta || !tb) return 'could not read the properties';
    if (N > 16) return 'U is too large to enumerate';
    let A = 0, B = 0;
    for (let x = 1; x <= N; x++) { if (ta(x)) A |= 1 << (x - 1); if (tb(x)) B |= 1 << (x - 1); }
    const full = (1 << N) - 1, rest = m[4];
    let c, conds;
    if (rest === '$X \\cap A \\ne \\emptyset$ and $X \\cap B = \\emptyset$') conds = [X => (X & A) && !(X & B), X => !(X & B), X => X & A];
    else if (rest === '$X \\cap A = X \\cap B$') conds = [X => (X & A) === (X & B), X => !(X & (A | B)), X => (X & A) === (X & B) && X];
    else if (rest === '$X \\cap A \\ne \\emptyset$ and $X \\cap B \\ne \\emptyset$') conds = [X => (X & A) && (X & B), X => X & (A | B)];
    else if (rest === '$X \\cap A = \\emptyset$ and $X \\cup B = U$') conds = [X => !(X & A) && (X | B) === full, X => !(X & A), X => (X | B) === full];
    else if ((c = rest.match(/^\$X \\cup A = X \\cup B\$ and \$n\(X\) = (\d+)\$$/))) {
      const k = Number(c[1]);
      conds = [X => (X | A) === (X | B) && popcount(X) === k, X => popcount(X) === k, X => (X | A) === (X | B)];
    } else return 'could not read the condition on X';
    const counts = conds.map(() => 0);
    for (let X = 0; X <= full; X++) conds.forEach((f, i) => { if (f(X)) counts[i]++; });
    return result(counts[0], counts.slice(1));
  }
  return 'could not read the prompt';
}

// ── 2 · Inclusion–exclusion ──────────────────────────────────────────────────
/**
 * Every Venn diagram for three sets with the given sizes: t in all three, x,
 * y, z in exactly A∩B, B∩C, A∩C, and the singles forced by the set sizes.
 * Calls visit(r) for each diagram with every region whole and non-negative.
 * zOf, when given, fixes z from (t, x, y); otherwise z is scanned.
 */
function venn(a, b, c, visit, { tFixed = null, zOf = null } = {}) {
  const tMax = Math.min(a, b, c);
  for (let t = tFixed ?? 0; t <= (tFixed ?? tMax); t++) {
    for (let x = 0; x <= Math.min(a, b) - t; x++) for (let y = 0; y <= Math.min(b, c) - t; y++) {
      const zs = zOf ? [zOf(t, x, y)] : Array.from({ length: Math.max(0, Math.min(a, c) - t + 1) }, (_, i) => i);
      for (const z of zs) {
        if (z < 0) continue;
        const oa = a - t - x - z, ob = b - t - x - y, oc = c - t - y - z;
        if (oa < 0 || ob < 0 || oc < 0) continue;
        visit({ t, x, y, z, oa, ob, oc, E1: oa + ob + oc, E2: x + y + z, T: oa + ob + oc + x + y + z + t });
      }
    }
  }
}

function analyseInclusion(p) {
  let m = p.match(/^Of the \$(\d+)\$ students of a college in [A-Z][a-z]+, \$(\d+)\$ are in the \w+ club, \$(\d+)\$ in the \w+ club and \$(\d+)\$ in the \w+ club\. (.+) How many students are in (exactly two of the three clubs|exactly one of the three clubs|none of the three clubs|all three clubs)\?$/);
  if (m) {
    const N = Number(m[1]), a = Number(m[2]), b = Number(m[3]), c = Number(m[4]), facts = m[5], target = m[6];
    const NONE = '(Every student is in at least one of the three clubs|Exactly \\$(\\d+)\\$ students? (?:is|are) in none of the three clubs)';
    let f, known = {};
    if ((f = facts.match(new RegExp(`^${NONE}, and \\$(\\d+)\\$ (?:is|are) in all three\\.$`)))) known = { none: f[2] ? Number(f[2]) : 0, E3: Number(f[3]) };
    else if ((f = facts.match(/^Of these, \$(\d+)\$ are in exactly one club and \$(\d+)\$ in exactly two\.$/))) known = { E1: Number(f[1]), E2: Number(f[2]) };
    else if ((f = facts.match(new RegExp(`^${NONE}, and \\$(\\d+)\\$ are in exactly two of the clubs\\.$`)))) known = { none: f[2] ? Number(f[2]) : 0, E2: Number(f[3]) };
    else return 'could not read the survey facts';
    if (f[1] && f[1].startsWith('Exactly') && known.none === 0) return 'a zero count is written as a number';
    const pick = { 'exactly two of the three clubs': r => r.E2, 'exactly one of the three clubs': r => r.E1, 'none of the three clubs': r => N - r.T, 'all three clubs': r => r.t }[target];
    const seen = new Set(), sloppy = new Set();
    venn(a, b, c, r => {
      const none = N - r.T;
      if (none < 0) return;
      if (known.none !== undefined && none !== known.none) return;
      if (known.E3 !== undefined && r.t !== known.E3) return;
      if (known.E1 !== undefined && r.E1 !== known.E1) return;
      if (known.E2 !== undefined && r.E2 !== known.E2) return;
      seen.add(pick(r));
      sloppy.add(target === 'exactly one of the three clubs' ? r.E1 + r.t : target === 'none of the three clubs' ? none + r.t : r.E2 + 2 * r.t);
    }, {
      tFixed: known.E3 ?? null,
      zOf: known.E2 !== undefined ? (t, x, y) => known.E2 - x - y : null
    });
    if (seen.size !== 1) return `${seen.size} different answers fit the data (${[...seen].slice(0, 4).join(', ')})`;
    return result([...seen][0], [...sloppy]);
  }
  m = p.match(/^Of the \$(\d+)\$ students in a school in [A-Z][a-z]+, \$(\d+)\$ like [\w-]+, \$(\d+)\$ like [\w-]+ and \$(\d+)\$ like [\w-]+\. (?:Every student likes at least one of the three sports\.|Exactly \$(\d+)\$ students? likes? none of the three sports\.) What is the (least possible number of students who like all three sports|greatest possible number of students who like exactly two of the three sports)\?$/);
  if (m) {
    const N = Number(m[1]), a = Number(m[2]), b = Number(m[3]), c = Number(m[4]), w = m[5] ? Number(m[5]) : 0;
    const T = N - w, S = a + b + c, all = m[6].includes('all three');
    // T people in at least one set: x + y + z = S − 2t − T, so z is fixed by (t, x, y).
    const vals = [];
    venn(a, b, c, r => { if (r.T === T) vals.push(all ? r.t : r.E2); }, { zOf: (t, x, y) => S - 2 * t - T - x - y });
    if (!vals.length) return 'no Venn diagram fits the data';
    const best = all ? Math.min(...vals) : Math.max(...vals);
    return result(best, [all ? Math.max(...vals) : Math.min(...vals), S - 2 * N, S - T, Math.min(a, b, c)]);
  }
  m = p.match(/^In a survey of the households of [A-Z][a-z]+, \$(\d+)\\%\$ own [^,]+, \$(\d+)\\%\$ own .+? and \$(\d+)\\%\$ own [^.]+\. What is the least possible percentage of households that own all three\?$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), S = a + b + c;
    // 100 households; the number owning at least one may be anything up to 100.
    let best = Infinity;
    for (let t = 0; t <= Math.min(a, b, c) && t < best; t++) {
      let found = false;
      for (let x = 0; x <= Math.min(a, b) - t && !found; x++) for (let y = 0; y <= Math.min(b, c) - t && !found; y++) {
        if (b - t - x - y < 0) continue;
        const hi = Math.min(a - t - x, c - t - y);
        const lo = Math.max(0, S - 2 * t - 100 - x - y);   // at least one item: S − 2t − (x + y + z) ≤ 100
        if (lo <= hi) found = true;
      }
      if (found) best = t;
    }
    if (!Number.isFinite(best)) return 'no Venn diagram fits the data';
    return result(best, [S - 100, Math.min(a, b, c), Math.max(0, a + b - 100), best + 100]);
  }
  return 'could not read the prompt';
}

// ── Exports ──────────────────────────────────────────────────────────────────
function check(q, analyse) {
  const out = analyse(q.prompt);
  if (typeof out === 'string') return [out];
  if (!Number.isInteger(out.value)) return [`solved value ${out.value} is not whole`];
  return out.value === keyed(q) ? [] : [`brute force ${out.value} vs keyed ${keyed(q)}`];
}
function misses(q, analyse) {
  const out = analyse(q.prompt);
  if (typeof out === 'string') return [];
  const v = keyed(q);
  return [...new Set(out.relaxed.filter(x => Number.isInteger(x) && x >= 0 && x !== v))].slice(0, 5).map(String);
}

export const SOLVE = {
  'c11-set-notation-jee-reasoning'(q) { return check(q, analyseNotation); },
  'c11-set-operations-jee-reasoning'(q) { return check(q, analyseOperations); },
  'c11-inclusion-exclusion-jee-reasoning'(q) { return check(q, analyseInclusion); }
};

export const NEAR_MISS = {
  'c11-set-notation-jee-reasoning'(q) { return misses(q, analyseNotation); },
  'c11-set-operations-jee-reasoning'(q) { return misses(q, analyseOperations); },
  'c11-inclusion-exclusion-jee-reasoning'(q) { return misses(q, analyseInclusion); }
};
