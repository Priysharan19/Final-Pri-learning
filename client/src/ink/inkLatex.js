// Pri Learning · a read line of maths as LaTeX for a KaTeX preview.
// No dependencies, so any surface can show a reading without loading a reader.

/** Convert a recognized expr string into LaTeX for a KaTeX preview. */
export function exprToLatex(s) {
  if (!s) return '';
  let t = String(s);
  for (; ;) {
    const i = t.indexOf('sqrt(');
    if (i === -1) break;
    let depth = 0, j = i + 4;
    for (; j < t.length; j++) {
      if (t[j] === '(') depth++;
      else if (t[j] === ')') { depth--; if (depth === 0) break; }
    }
    const inner = t.slice(i + 5, j);
    t = t.slice(0, i) + `\\sqrt{${inner}}` + t.slice(j + 1);
  }
  t = t.replace(/\(([^()]*)\)\/\(([^()]*)\)/g, '\\frac{$1}{$2}');
  t = t.replace(/\^\(([^()]*)\)/g, '^{$1}');
  t = t.replace(/\b(sin|cos|tan|sec|csc|cot|ln|log)\b/g, '\\$1 ');
  t = t.replace(/\bLHS\b/g, '\\mathrm{LHS}').replace(/\bRHS\b/g, '\\mathrm{RHS}');
  t = t.replace(/\blet\b/g, '\\mathrm{let}\\;');
  t = t.replace(/∫/g, '\\int ');
  t = t.replace(/Σ/g, '\\sum ').replace(/∞/g, '\\infty ').replace(/≡/g, ' \\equiv ');
  t = t.replace(/theta/g, '\\theta ').replace(/pi/g, '\\pi ');
  t = t.replace(/<=/g, ' \\le ').replace(/>=/g, ' \\ge ').replace(/!=/g, ' \\ne ');
  t = t.replace(/±/g, ' \\pm ').replace(/°/g, '^{\\circ}');
  t = t.replace(/\*/g, '\\times ');
  t = t.replace(/%/g, '\\%');
  return t;
}
