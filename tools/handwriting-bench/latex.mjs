// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting benchmark · LaTeX → Pri linear form
//
// Mathpix returns LaTeX. Pri's parser, its marker and its ground truth all
// speak the linear dialect in client/src/ink/productionEvidence.js:
// `x^(2)`, `(1)/(2)`, `sqrt(16)`, `x_1`, `<=`, `>=`, `!=`, `pi`, `theta`, `*`.
//
// So a translator sits between them, and it is the single most likely place for
// this benchmark to lie about Mathpix. A sloppy translator makes a correct
// recognition score as a miss; a generous one hides a real error. Two rules:
//
//   1. Convert only what is unambiguous. Anything else is left in place.
//   2. Report the leftovers. `residue` lists every backslash command that
//      survived translation, so a Mathpix miss can always be attributed to the
//      recogniser or to this file — and if the residue list is long, the honest
//      conclusion is that the translator needs work, not that Mathpix is bad.
//
// This is production-adjacent code that is deliberately NOT in production: if
// Mathpix earns a place after measurement, this file is the starting point for
// the real one, not the real one itself.
// ─────────────────────────────────────────────────────────────────────────────

/** Commands mapped to a literal, applied after the structural rewrites. */
const LITERALS = Object.freeze([
  [/\\left\s*/g, ''], [/\\right\s*/g, ''],
  [/\\!|\\,|\;|\\:|\\quad|\\qquad/g, ''],
  [/\\displaystyle|\\textstyle|\\limits/g, ''],
  [/\\mathrm\s*\{([^{}]*)\}/g, '$1'],
  [/\\operatorname\s*\{([^{}]*)\}/g, '$1'],
  [/\\text\s*\{([^{}]*)\}/g, '$1'],
  [/\\leq?\b/g, '<='], [/\\geq?\b/g, '>='], [/\\neq\b/g, '!='], [/\\ne\b/g, '!='],
  [/\\pm\b/g, '±'], [/\\mp\b/g, '∓'],
  [/\\cdot\b|\\times\b/g, '*'], [/\\div\b/g, '/'],
  [/\\pi\b/g, 'pi'], [/\\theta\b/g, 'theta'], [/\\alpha\b/g, 'alpha'],
  [/\\beta\b/g, 'beta'], [/\\lambda\b/g, 'lambda'], [/\\mu\b/g, 'mu'],
  [/\\infty\b/g, 'inf'],
  [/\\int\b/g, '∫'], [/\\sum\b/g, 'sum'],
  [/\\ln\b/g, 'ln'], [/\\log\b/g, 'log'], [/\\exp\b/g, 'exp'],
  [/\\sin\b/g, 'sin'], [/\\cos\b/g, 'cos'], [/\\tan\b/g, 'tan'],
  [/\\sec\b/g, 'sec'], [/\\csc\b/g, 'csc'], [/\\cot\b/g, 'cot'],
  [/\\circ\b/g, '°'], [/\\degree\b/g, '°'], [/\\%/g, '%'],
  [/\\cup\b/g, '∪'], [/\\cap\b/g, '∩'],
  [/\\\\/g, '\n'],
  [/[{}]/g, ''],
  [/\$+/g, '']
]);

/** Find the balanced `{...}` starting at `open`, or -1 if it never closes. */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** Read the argument at `i` — either `{...}` or a single following character. */
function readArg(src, i) {
  while (src[i] === ' ') i++;
  if (src[i] === '{') {
    const close = matchBrace(src, i);
    if (close < 0) return null;
    return { body: src.slice(i + 1, close), next: close + 1 };
  }
  if (i < src.length) return { body: src[i], next: i + 1 };
  return null;
}

/** \frac{a}{b} → (a)/(b), innermost first so nesting survives. */
function rewriteFrac(src) {
  for (let guard = 0; guard < 40; guard++) {
    const at = src.lastIndexOf('\\frac');
    if (at < 0) return src;
    const num = readArg(src, at + 5);
    if (!num) return src;
    const den = readArg(src, num.next);
    if (!den) return src;
    src = `${src.slice(0, at)}(${rewrite(num.body)})/(${rewrite(den.body)})${src.slice(den.next)}`;
  }
  return src;
}

/** \sqrt{x} → sqrt(x); \sqrt[3]{x} → root(3,x), which Pri does not parse and
 *  therefore stays visible as a difference rather than being flattened away. */
function rewriteSqrt(src) {
  for (let guard = 0; guard < 40; guard++) {
    const at = src.lastIndexOf('\\sqrt');
    if (at < 0) return src;
    let i = at + 5;
    let index = null;
    if (src[i] === '[') {
      const close = src.indexOf(']', i);
      if (close < 0) return src;
      index = src.slice(i + 1, close);
      i = close + 1;
    }
    const body = readArg(src, i);
    if (!body) return src;
    const inner = rewrite(body.body);
    const out = index === null ? `sqrt(${inner})` : `root(${index},${inner})`;
    src = src.slice(0, at) + out + src.slice(body.next);
  }
  return src;
}

/** x^{2} → x^(2), x_{1} → x_1. Pri brackets powers and bare-suffixes indices. */
function rewriteScripts(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch !== '^' && ch !== '_') { out += ch; continue; }
    // `\frac` and `\sqrt` rewrite their arguments before this pass runs, so a
    // `^(` here is already-converted output, not LaTeX. Re-reading it would
    // take the bare `(` as the exponent and produce `^(()3)`. Leave it.
    if (ch === '^' && src[i + 1] === '(') { out += ch; continue; }
    const arg = readArg(src, i + 1);
    if (!arg) { out += ch; continue; }
    const inner = rewrite(arg.body);
    out += ch === '^' ? `^(${inner})` : `_${inner}`;
    i = arg.next - 1;
  }
  return out;
}

/** Pri writes function arguments bracketed: `cos(theta)`, not `cos theta`. */
const FUNCTIONS = /\b(sin|cos|tan|sec|csc|cot|ln|log|exp)\s*(?!\()([A-Za-z][A-Za-z0-9]*|[0-9]*\.?[0-9]+)/g;

function rewrite(src) {
  let out = String(src ?? '');
  // `60^{\circ}` is a degree suffix, not an exponent. Fold it before the script
  // pass turns it into `^(°)`, which Pri's parser does not read as degrees.
  out = out.replace(/\^\s*\{\s*\\circ\s*\}/g, '\\circ').replace(/\^\s*\\circ/g, '\\circ');
  out = rewriteFrac(out);
  out = rewriteSqrt(out);
  out = rewriteScripts(out);
  for (const [pattern, replacement] of LITERALS) out = out.replace(pattern, replacement);
  // Runs last, once `\\cos` and `\\theta` are plain words. The negative
  // lookahead on `(` makes it idempotent under the recursive rewrites above.
  out = out.replace(FUNCTIONS, (_, fn, arg) => `${fn}(${arg})`);
  return out;
}

/**
 * Translate one Mathpix line.
 *
 * Returns `{ text, residue }`. `residue` is every LaTeX command that survived,
 * which is the honest signal that this translator — not the recogniser — is the
 * limiting factor on that line.
 */
export function latexToLinear(latex) {
  const source = String(latex ?? '')
    .replace(/^\s*\\\(\s*|\s*\\\)\s*$/g, '')
    .replace(/^\s*\\\[\s*|\s*\\\]\s*$/g, '');
  const text = rewrite(source).replace(/[ \t]+/g, ' ').trim();
  const residue = [...new Set(text.match(/\\[a-zA-Z]+/g) || [])];
  return { text, residue };
}

/** A whole Mathpix `text` field, which may carry several lines. */
export function latexBlockToLines(block) {
  const lines = String(block ?? '')
    .split(/\r?\n|\\\\/)
    .map(line => line.trim())
    .filter(Boolean);
  const out = [];
  const residue = new Set();
  for (const line of lines) {
    const converted = latexToLinear(line);
    if (!converted.text) continue;
    converted.residue.forEach(r => residue.add(r));
    out.push(converted.text);
  }
  return { lines: out, residue: [...residue] };
}
