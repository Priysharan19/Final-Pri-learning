// Pri Learning · test support — read a line of worked-example TeX as an engine expression, and check
// that the equalities the line asserts really hold. This is a CHECK, not a marker: it never decides a
// student's mark. It reads only constant arithmetic/trigonometry; anything else (a symbol, text, an
// inequality, a list) is reported as skipped, never as passed.
import { evalNumeric } from '../../src/engine/expr.js';

const FNS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'ln', 'log', 'exp', 'sqrt'];

/** TeX -> engine expression text, or null when the TeX holds anything this reader does not model. */
export function texToExpr(tex) {
  let s = String(tex).trim();
  if (/\\(text|mathrm|quad|qquad|pm|mp|le|ge|leq|geq|neq|lt|gt|in|cup|cap|infty|therefore|Rightarrow|Leftrightarrow|to|rightarrow|vec|overline|binom|sum|int|lim|angle|triangle|perp|parallel|dots|ldots|cdots|mid|sec|csc|cot|operatorname|lfloor|rfloor|bar|hat)(?![a-zA-Z])|[<>,;:%$|!]|\\\$|\\%/.test(s)) return null;
  s = s.replace(/\\(left|right|bigl|bigr|Bigl|Bigr)\s*/g, '').replace(/\\[,;!]|\\ /g, ' ');
  s = s.replace(/\\[td]?frac\s*\{/g, 'FRAC{').replace(/\\sqrt\s*\[([^\]]+)\]\s*\{/g, 'NROOT[$1]{');
  // braces: FRAC{a}{b} -> ((a)/(b)) ; NROOT[n]{x} -> ((x)^(1/(n))) ; \sqrt{x} -> sqrt(x)
  const take = (str, i) => { let d = 0; for (let j = i; j < str.length; j++) { if (str[j] === '{') d++; else if (str[j] === '}') { d--; if (d === 0) return j; } } return -1; };
  for (let guard = 0; guard < 200 && /FRAC\{|NROOT\[/.test(s); guard++) {
    const f = s.indexOf('FRAC{'); const r = s.indexOf('NROOT[');
    if (f >= 0 && (r < 0 || f < r)) {
      const a = f + 4; const ae = take(s, a); if (ae < 0) return null;
      if (s[ae + 1] !== '{') return null; const be = take(s, ae + 1); if (be < 0) return null;
      s = `${s.slice(0, f)}((${s.slice(a + 1, ae)})/(${s.slice(ae + 2, be)}))${s.slice(be + 1)}`;
    } else {
      const m = /NROOT\[([^\]]+)\]\{/.exec(s); const a = m.index + m[0].length - 1; const ae = take(s, a); if (ae < 0) return null;
      s = `${s.slice(0, m.index)}((${s.slice(a + 1, ae)})^(1/(${m[1]})))${s.slice(ae + 1)}`;
    }
  }
  s = s.replace(/\\frac(\d)(\d)/g, '(($1)/($2))').replace(/\\[td]frac(\d)(\d)/g, '(($1)/($2))');
  s = s.replace(/\\sqrt\s*\{/g, 'sqrt{').replace(/\\sqrt\s*(\d+)/g, 'sqrt($1)');
  for (const f of FNS) s = s.split(`\\${f}`).join(f);
  s = s.replace(/\\pi(?![a-zA-Z])/g, 'pi').replace(/\\times|\\cdot/g, '*').replace(/\\div/g, '/');
  if (/\^\s*\{?\\circ/.test(s)) { if (!/\b(?:sin|cos|tan)\b/.test(s)) return null; s = s.replace(/(\d+(?:\.\d+)?|pi)\s*\^\s*\{?\\circ\}?/g, '(($1)*pi/180)'); }
  s = s.replace(/\^\s*\{/g, '^{').replace(/\{/g, '(').replace(/\}/g, ')');
  s = s.replace(/\^\s*(-?[0-9a-zA-Z])/g, '^($1)');
  if (/\\/.test(s)) return null;
  // sin (x) and sin x forms: the engine reads sin(…) ; a bare `sin 30` is not modelled
  if (/\b(?:arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|ln|log|exp|sqrt)\b(?!\s*\()/.test(s)) return null;
  return s.replace(/\s+/g, ' ').trim();
}

const topLevelSplit = (s, ch) => { const out = []; let d = 0; let cur = ''; for (const c of s) { if (c === '(') d++; else if (c === ')') d--; if (d === 0 && c === ch) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const near = (a, b, rel) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

function value(piece) {
  const e = texToExpr(piece); if (e === null || e === '') return { skip: true };
  if (/[a-zA-Z]/.test(e.replace(/\b(?:pi|arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|ln|log|exp|sqrt|e)\b/g, ''))) return { skip: true };
  try { const v = evalNumeric(e); return Number.isFinite(v) ? { v } : { skip: true }; } catch { return { skip: true }; }
}

/**
 * Check the equalities asserted by the rows of one working block (rows from workingRows()).
 * Returns { checked, skipped, errors:[…] }. A row whose first piece is blank continues the previous row's value.
 */
export function checkWorkingEqualities(rows) {
  const errors = []; let checked = 0; let skipped = 0; let prev = null;
  rows.forEach((r, n) => {
    const whole = r.lhs == null ? r.rest : `${r.lhs}${r.rest}`;
    // A row may hold several statements (a, \quad b, \Rightarrow c): each is its own chain of equalities.
    const statements = whole.split(/\\Rightarrow|\\qquad|\\quad|;|,\s*(?=[A-Za-z\\])/).map(x => x.trim()).filter(Boolean);
    const full = statements[statements.length - 1];
    const approx = /\\approx/.test(whole);
    let known = []; let lastV = null;
    for (const [si, st] of statements.entries()) {
      const parts = topLevelSplit(st.replace(/\\approx/g, '='), '=').map(p => p.trim());
      const vals = parts.map(p => (p === '' ? { blank: true } : value(p)));
      const ks = []; if (si === 0 && prev !== null && parts[0] === '') ks.push(prev);
      const rounded = [];
      vals.forEach((x, k) => { if (x.v !== undefined) { ks.push(x.v); rounded.push(/^-?\d+\.\d+$/.test(parts[k]) ? 0.5 * 10 ** -(parts[k].split('.')[1].length) : 0); } });
      const lastPart = [...vals].reverse().find(x => !x.blank); lastV = lastPart && lastPart.v !== undefined ? lastPart.v : null;
      if (ks.length >= 2) {
        checked++;
        for (let k = 1; k < ks.length; k++) {
          const tol = Math.max(rounded[k] || 0, rounded[0] || 0, approx ? 0.02 * Math.max(1, Math.abs(ks[0])) : 1e-9 * Math.max(1, Math.abs(ks[0])));
          if (!(Math.abs(ks[0] - ks[k]) <= tol * 1.000001)) { errors.push(`row ${n + 1}: ${ks[0]} != ${ks[k]} in "${st}"`); break; }
        }
      } else skipped++;
    }
    prev = /,/.test(whole) ? null : lastV;
    void full; void known;
    return;
    if (known.length < 2) { skipped++; return; }
    checked++;
    for (let k = 1; k < known.length; k++) if (!near(known[0], known[k], approx ? 0.02 : 1e-9)) { errors.push(`row ${n + 1}: ${known[0]} != ${known[k]} in "${full}"`); break; }
    void any;
  });
  return { checked, skipped, errors };
}

/** Every constant value a piece of prose-with-maths states: each $…$ span split at =, commas, "or"/"and". */
export function statedValues(text) {
  const out = [];
  for (const m of String(text).matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) {
    const span = m[1].replace(/\\text\{\s*(?:or|and)\s*\}/g, ',').replace(/\\text\{[^}]*\}(?:\^\{?\d\}?)?/g, ' ').replace(/\\[$%]|\\,|\^\s*\{?\\circ\}?/g, ' ').replace(/(\d) +(?=\d{3}\b)/g, '$1');
    for (const piece of span.split(/=|\\approx|,|;|\\quad|\\ /)) { const p = piece.replace(/^\s*[A-Za-z]+(?:_\{?[A-Za-z0-9]+\}?)?\s*$/, ''); for (const q of /\\pm/.test(p) ? [p.replace('\\pm', '+'), p.replace('\\pm', '-')] : [p]) { const v = value(q); if (v.v !== undefined) out.push(v.v); } }
  }
  return out;
}
export const nearValue = (a, b, rel = 0.006) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1e-9, rel * Math.max(Math.abs(a), Math.abs(b)));
