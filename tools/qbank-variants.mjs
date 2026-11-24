// Pri Learning · the natural student pages of an EQUATION-solving author-bank question (a measurement helper; it sets and changes nothing).
//
// The pack's authored working is one writer's page. A student who solves the same equation writes other true pages: the candidates listed one per
// line, the candidates then "reject x = …", the two branches of ±, the solutions listed before they are checked. This builds them from the authored
// page and the key, with this file's own root finder (tools/marking-mutation-harness.mjs rootsOf), never the product engine:
//
//   S   the roots of the original equation (the key's values)
//   E   a root of a DERIVED line of the page (the squared, cleared or combined equation) that is not a root of the original: an extraneous
//       candidate. Only a root with a clean rational value is used (a page is a student's, written by hand).
//
// Every line of every page is TRUE as a statement about the working: a root of the original, or a candidate root of the derived equation, or the
// rejection of a candidate. None may be crossed. `kind` of a page says what its lines are for the oracle:
//   candidate  a line `v = e` for e in E     never crossed, never ticked as a solution (a note that it must be checked in the original)
//   solution   a line `v = s` for s in S     never crossed
//   reject     a line that rejects e         never crossed; ticked when the rejection is of a candidate
import { rootsOf, lettersIn, sidesOf } from './marking-mutation-harness.mjs';

const clean = r => {
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12]) { const n = r * d; if (Math.abs(n - Math.round(n)) < 1e-6 && Math.abs(r) <= 60) return { n: Math.round(n), d }; }
  return null;
};
export const cleanOf = clean;
export const asText = ({ n, d }) => (d === 1 ? String(n) : `(${n}/${d})`);
const shown = r => { const c = clean(r); return c ? asText(c) : null; };
const near = (a, b) => Math.abs(a - b) < 1e-4;

/** { v, S, E, prefix } for a question whose key is a list of numbers, or null. */
export function equationFacts(meta, lines, q = null) {
  let v = meta?.kind === 'equation' ? meta.variable : null;
  let S = meta?.kind === 'equation' && Array.isArray(meta.solutions) ? meta.solutions : null;
  // a question with no step meta (the key alone): the key's numbers and the one letter its derived lines are about
  if (!S && q && (q.answerType === 'numeric' || q.answerType === 'set')) {
    S = q.answerType === 'numeric' ? [q.answer?.value] : q.answer?.values;
    const letters = new Set();
    for (const l of lines) { const sd = sidesOf(l); if (sd.length === 2 && !/,/.test(l)) for (const t of sd) for (const c of lettersIn(t)) letters.add(c); }
    if (letters.size === 1) v = [...letters][0];
  }
  if (!v || !Array.isArray(S) || !S.length || !S.every(Number.isFinite)) return null;
  if (!S.every(s => clean(s))) return null;
  const E = [];
  let keyed = false;   // the key is a set of roots of some line of the page: the question is an equation to solve for the key
  const prefix = [];
  if (lines.some(l => new RegExp(`(?<![A-Za-z])${v}\\(`).test(l))) return null;   // a function value (h(2) = 3), not an equation in h
  for (const l of lines) {
    if (/[,]|\bor\b|\band\b|[<>≤≥≠]/.test(l) || !/=/.test(l)) continue;
    const sides = sidesOf(l);
    if (sides.length !== 2) continue;
    const bare = t => t.replace(/\s+/g, '') === v;
    const isRootStatement = (bare(sides[0]) && !lettersIn(sides[1]).length) || (bare(sides[1]) && !lettersIn(sides[0]).length);
    if (isRootStatement) continue;
    prefix.push(l);
    let r = null; try { r = rootsOf(l); } catch { r = null; }
    if (!r || r.v !== v) continue;
    if (r.roots.length > 6) continue;   // an identity (every x is a root), not an equation
    if (S.every(sv => r.roots.some(x => near(sv, x)))) keyed = true;
    for (const x of r.roots) if (clean(x) && !S.some(s => near(s, x)) && !E.some(e => near(e, x))) E.push(x);
  }
  if (!keyed) return null;
  E.sort((a, b) => a - b);
  return { v, S: [...S].sort((a, b) => a - b), E: E.slice(0, 3), prefix };
}

/** Pages: [{ name, lines: [text], kinds: [kind per line, or null for a prefix line] }]. */
export function variantPages(facts) {
  if (!facts) return [];
  const { v, S, E, prefix } = facts;
  const pre = prefix.slice(0, 8);
  const P = (name, tail) => ({ name, lines: [...pre, ...tail.map(t => t[0])], kinds: [...pre.map(() => null), ...tail.map(t => t[1])] });
  const eq = (r, kind) => [`${v} = ${shown(r)}`, kind];
  const all = [...S.map(s => [s, 'solution']), ...E.map(e => [e, 'candidate'])].sort((a, b) => a[0] - b[0]);
  const pages = [];
  pages.push(P('solutions-one-per-line', S.map(s => eq(s, 'solution'))));
  pages.push(P('solutions-or', [[S.map(s => `${v} = ${shown(s)}`).join(' or '), 'solution']]));
  pages.push(P('solutions-comma', [[`${v} = ${S.map(shown).join(', ')}`, 'solution']]));
  pages.push(P('solutions-then-check', [[S.map(s => `${v} = ${shown(s)}`).join(' or '), 'solution'], ...S.map(s => [`check ${v} = ${shown(s)}: it satisfies the equation`, 'check'])]));
  if (E.length) {
    pages.push(P('candidates-one-per-line', all.map(([r, k]) => eq(r, k))));
    pages.push(P('candidates-or', [[all.map(([r]) => `${v} = ${shown(r)}`).join(' or '), 'candidates']]));
    for (const style of ['reject', 'does-not-satisfy', 'neq', 'not-a-solution', 'extraneous', 'bracket', 'fails']) {
      const rej = e => ({ reject: `reject ${v} = ${shown(e)}`, 'does-not-satisfy': `${v} = ${shown(e)} does not satisfy the equation`, neq: `${v} ≠ ${shown(e)}`, bracket: `${v} = ${shown(e)} (rejected)`, fails: `${v} = ${shown(e)} fails`, 'not-a-solution': `${v} = ${shown(e)} is not a solution`, extraneous: `${v} = ${shown(e)} is extraneous` })[style];
      if (style === 'neq') {
        // the symbol is read only directly after the candidate it names
        pages.push(P(`candidates-then-${style}`, [...all.flatMap(([r, k]) => (k === 'candidate' ? [eq(r, k), [rej(r), 'reject']] : [eq(r, k)]))]));
        pages.push(P(`candidate-reject-${style}`, [...E.flatMap(e => [eq(e, 'candidate'), [rej(e), 'reject']]), ...S.map(s => eq(s, 'solution'))]));
        continue;
      }
      pages.push(P(`candidates-then-${style}`, [...all.map(([r, k]) => eq(r, k)), ...E.map(e => [rej(e), 'reject']), ...S.map(s => eq(s, 'solution'))]));
      pages.push(P(`candidate-reject-${style}`, [...E.map(e => eq(e, 'candidate')), ...E.map(e => [rej(e), 'reject']), ...S.map(s => eq(s, 'solution'))]));
    }
    pages.push(P('reject-only', [...E.map(e => [`reject ${v} = ${shown(e)}`, 'reject']), ...S.map(s => eq(s, 'solution'))]));
  }
  // ± : a line `v^2 = k` of the page, its two branches
  for (const l of pre) {
    const m = /^([a-z])\^\(?2\)?\s*=\s*(\d+)$/.exec(l.replace(/\s+/g, ''));
    if (!m || m[1] !== v) continue;
    const k = Number(m[2]), r = Math.sqrt(k);
    if (!Number.isInteger(r)) continue;
    if (![r, -r].every(x => S.some(s => near(s, x)) || E.some(e => near(e, x)))) continue;
    pages.push(P('branches-pm', [[`${v} = ±${r}`, 'solution']]));
    pages.push(P('branches-two-lines', [[`${v} = ${r}`, S.some(s => near(s, r)) ? 'solution' : 'candidate'], [`${v} = -${r}`, S.some(s => near(s, -r)) ? 'solution' : 'candidate']]));
  }
  return pages;
}
