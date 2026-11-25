// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · is this reader TeX safe to keep, and to typeset?
//
// The handwriting reader returns, beside each line's plain `text`, a `latex`
// reading of the same line. It is model output: a string of unknown shape that
// ends up in a TeX renderer. This is the one gate it passes before it is kept
// on a transcript, read by the line checker or set on the marked page.
//
// It fails closed. Only a short allow-list of mathematical commands is
// accepted; any other backslash command (\href, \url, \includegraphics,
// \input, \write, \def, \newcommand, \catcode, \html…) fails, and so do raw
// angle brackets, `$`, `%`, `#`, `javascript:` and unbalanced or deeply nested
// braces. A TeX that fails is DROPPED by the caller and the line keeps its
// text exactly as before; nothing here ever repairs or rewrites the TeX.
//
// Display and reading only: a validated TeX never decides a mark. Pure.
// ─────────────────────────────────────────────────────────────────────────────

/** The most code points one line's TeX may hold (the reader's schema states the same). */
export const MAX_LATEX_CHARS = 600;
const MAX_DEPTH = 8;

const COMMANDS = new Set((
  'frac dfrac tfrac sqrt left right cdot times div pm mp ' +
  'sin cos tan sec csc cosec cot ln log exp arcsin arccos arctan sinh cosh tanh ' +
  'pi theta alpha beta gamma delta lambda mu sigma omega phi varphi epsilon varepsilon rho tau Delta Sigma Omega ' +
  'int sum prod lim infty to le leq ge geq ne neq lt gt approx equiv ' +
  'rightarrow Rightarrow Leftrightarrow implies therefore because ldots cdots dots ' +
  'text mathrm mathbf operatorname displaystyle quad qquad ' +
  'lvert rvert vert angle triangle circ degree bar hat vec overline binom partial perp parallel ' +
  'in cap cup subset prime lbrace rbrace dot ddot'
).split(/\s+/));

/** The reader's lines with each `latex` run through the gate: a TeX that fails is null, nothing else about a line changes. */
export function safeLatexLines(lines, max = MAX_LATEX_CHARS) {
  if (!Array.isArray(lines)) return lines;
  return lines.map(line => (line && typeof line === 'object' && 'latex' in line ? { ...line, latex: cleanLatex(line.latex, max) } : line));
}

/** One line's TeX, or null when it is not a string, is empty, is too long or is not plausibly plain maths. */
export function cleanLatex(raw, max = MAX_LATEX_CHARS) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || [...s].length > max) return null;
  if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(s)) return null;
  if (/[<>$%#&~`]|\\\\/.test(s)) return null;            // HTML, TeX mode switches, comments, alignment, line breaks
  if (/javascript\s*:|data\s*:|vbscript\s*:/i.test(s)) return null;
  // Every backslash is a command from the allow-list or one escaped symbol/space.
  for (const m of s.matchAll(/\\([A-Za-z]+|.)/gs)) {
    const name = m[1];
    if (/^[A-Za-z]+$/.test(name)) { if (!COMMANDS.has(name)) return null; }
    else if (!/^[,;:! {}|]$/.test(name)) return null;
  }
  if (/\\$/.test(s)) return null;
  // Braces balance and do not nest past a sane depth (an escaped brace is a symbol, not a group).
  let depth = 0;
  const bare = s.replace(/\\[{}]/g, '');
  for (const ch of bare) {
    if (ch === '{') { depth += 1; if (depth > MAX_DEPTH) return null; }
    else if (ch === '}') { depth -= 1; if (depth < 0) return null; }
  }
  if (depth !== 0) return null;
  return s;
}
