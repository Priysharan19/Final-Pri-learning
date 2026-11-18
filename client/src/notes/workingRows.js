// Pri Learning · notes — the rows of a worked example's working.
//
// An example's `working` is either the legacy aligned-TeX string
//   '\\begin{aligned}T&=12\\\\&=\\dfrac{1}{2}\\end{aligned}'
// or an array of rows
//   [{ say: 'Period:', tex: 'T&=\\dfrac{2\\pi}{\\pi/6}=12' }, …]
// where `say` is the short reason for the line (plain words, $…$ allowed) and `tex` is one
// line of display maths whose single `&` sits before the relation sign (=, <, ≤ …), so every
// row of the block lines up on its relation in one column. This module is pure data: the
// renderer (nsw/NswParts.jsx) and the content checks (client/test/worked-example-format-check.mjs)
// both read the rows through it, so they cannot disagree about what a row is.

/** One display style throughout a working block: a text-style fraction beside a display-style one is the fault. */
export const normaliseWorkingTex = (tex) => String(tex).replace(/\\[td]?frac(?![a-zA-Z])/g, '\\dfrac');

const ALIGNED = /^\s*\\begin\{aligned\}([\s\S]*)\\end\{aligned\}\s*$/;

/** Split on top-level `\\` (not inside braces), keeping the pieces in order. */
function splitRows(body) {
  const out = []; let depth = 0; let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0 && c === '\\' && body[i + 1] === '\\') { out.push(cur); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** The first `&` outside braces splits a row into the left of the relation and the relation onward. */
export function splitRow(tex) {
  let depth = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '&' && depth === 0 && tex[i - 1] !== '\\') return { lhs: tex.slice(0, i).trim(), rest: tex.slice(i + 1).trim() };
  }
  return { lhs: null, rest: tex.trim() };
}

/** Rows of any accepted `working` shape: [{ say, lhs, rest }]. A string that is not an aligned block is one row. */
export function workingRows(working) {
  if (working == null || working === '') return [];
  let raw;
  if (Array.isArray(working)) raw = working.map(r => (typeof r === 'string' ? { tex: r } : r));
  else {
    const m = ALIGNED.exec(String(working));
    raw = (m ? splitRows(m[1]) : [String(working)]).map(tex => ({ tex }));
  }
  return raw.filter(r => r && String(r.tex ?? '').trim()).map(r => ({ say: r.say || null, ...splitRow(String(r.tex)) }));
}

/** The maths of the whole working as TeX source, for checks that scan every line. */
export const workingTexLines = (working) => workingRows(working).map(r => (r.lhs == null ? r.rest : `${r.lhs}${r.rest}`));

// A function is written with its argument in brackets: sin(πt/6), ln(x+1). Left bare it is only
// allowed before a single symbol (sin x, sin θ, ln x) or a plain number of degrees (sin 30°).
const FN = String.raw`\\(?:arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log|exp)`;
const AFTER_FN = new RegExp(String.raw`(${FN})(?![a-zA-Z])\s*(?:\^\{[^}]*\}|\^[0-9a-zA-Z])?\s*(?:_\{[^}]*\}|_[0-9a-zA-Z])?\s*(.{0,24})`, 'g');
const OPEN = /^(?:\\left\s*[(\[|]|[(\[|]|\\bigl?\(|\\Bigl?\()/;
const SINGLE = /^(?:[a-zA-Z]|\\(?:theta|alpha|beta|gamma|phi|varphi|omega|delta|lambda|pi)(?![a-zA-Z])|[0-9]+(?:\.[0-9]+)?(?:\^\{?\\circ\}?)?)/;
// What may follow that one symbol without the argument really being longer (an implicit product: sin 2x, sin πt).
const CONTINUES = /^\s*(?:[a-zA-Z0-9(]|\\(?:theta|alpha|beta|gamma|phi|varphi|omega|delta|lambda|pi|dfrac|frac|tfrac|sqrt|left)(?![a-zA-Z])|[.^_])/;
/** Applications of a function whose argument is not bracketed and is more than one symbol. [] when none. */
export function unbracketedFunctions(tex) {
  const bad = [];
  for (const m of String(tex).matchAll(AFTER_FN)) {
    const after = m[2];
    if (after === '' || /^\s*;/.test(after)) continue; // a bare function name, the end of a span
    if (OPEN.test(after)) continue;
    const one = SINGLE.exec(after);
    if (one && !CONTINUES.test(after.slice(one[0].length))) continue;
    bad.push(m[0].trim());
  }
  return bad;
}
