// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a question's maths as one plain line (the collapsed question bar)
//
// The bar that recalls the question while the student works far down the page shows plain text. It used to
// delete the TeX markers, so "9x^2" read "9x2" and "x^{10}" read "x10" (owner walk-through, 19 Nov 2026). This
// keeps a power a power (digits as superscripts, anything else as ^(…)), a fraction as (a)/(b) and a root as √.
// It also reads the escapes a question is written with as the characters they stand for: \% is %, \$ is a dollar,
// \{ \} are braces, \cdots is an ellipsis, \left and \right are dropped without eating the bracket after them.
// Display only: nothing here is read by marking.
// ─────────────────────────────────────────────────────────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SYMBOL = {
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', omega: 'ω', phi: 'φ', varphi: 'φ', varepsilon: 'ε', epsilon: 'ε',
  Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Gamma: 'Γ', Lambda: 'Λ', Theta: 'Θ', Phi: 'Φ',
  times: '×', cdot: '·', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', infty: '∞', pm: '±', mp: '∓', approx: '≈',
  to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', leftrightarrow: '↔', iff: '⇔', degree: '°', circ: '°', mid: '|',
  angle: '∠', triangle: '△', parallel: '∥', perp: '⊥', cong: '≅', equiv: '≡', sim: '∼', propto: '∝', in: '∈', notin: '∉', cup: '∪', cap: '∩',
  subset: '⊂', subseteq: '⊆', therefore: '∴', sum: '∑', prod: '∏', quad: ' ', qquad: ' '
};
const SYMBOL_RE = new RegExp(`\\\\(${Object.keys(SYMBOL).join('|')})(?![a-zA-Z])`, 'g');
// Private-use stand-ins so an escaped brace survives the pass that strips grouping braces.
const OPEN = '';
const CLOSE = '';

/** TeX inside one $…$ span as plain text. */
export function plainMath(tex) {
  let s = String(tex);
  // An aligned block is its rows, one after another; a root with a simple radicand is settled before fractions so
  // that \frac{\sqrt{2}}{2} reads (√(2))/(2) and not "√(2)2" (independent review, 20 November 2026).
  s = s.replace(/\\(?:begin|end)\s*\{[a-zA-Z*]+\}/g, ' ').replace(/\\\\/g, '; ').replace(/&/g, ' ');
  // \left and \right only size a bracket: they go, the bracket after them stays (\left. and \right. are no bracket).
  s = s.replace(/\\(?:left|right)(?![a-zA-Z])\s*\./g, '').replace(/\\(?:left|right)(?![a-zA-Z])\s*/g, '');
  // An ellipsis reads as an ellipsis, never as nothing (an induction prompt read "5 + + (2n - 1)"), and an escaped
  // character reads as itself.
  s = s.replace(/\\(?:cdots|ldots|dotsc|dotsb|dotsm|dots|vdots|ddots)(?![a-zA-Z])/g, '…')
    .replace(/\\\{|\\lbrace(?![a-zA-Z])/g, OPEN).replace(/\\\}|\\rbrace(?![a-zA-Z])/g, CLOSE)
    .replace(/\\%/g, '%').replace(/\\\$/g, '$').replace(/\\#/g, '#').replace(/\\_/g, '_')
    .replace(/\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1 choose $2)');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  }
  return s
    // An integral keeps its sign and limits; thin spaces are spaces; named functions and symbols keep their names
    // (the bar used to show "0¹ (x² - 2x)\\,dx" for a definite integral and drop sin, ln and π: live site, 20 Nov 2026).
    .replace(/\\int\s*_\s*(?:\{([^{}]*)\}|(-?\w))\s*\^\s*(?:\{([^{}]*)\}|(-?\w))/g, (_, a1, a2, b1, b2) => `∫ from ${(a1 ?? a2).trim()} to ${(b1 ?? b2).trim()} of `)
    .replace(/\\int(?![a-zA-Z])/g, '∫ ')
    .replace(/\^\s*(?:\{\s*\\circ\s*\}|\\circ(?![a-zA-Z]))/g, '°')
    .replace(/\\log\s*_\s*(?:\{(\d+)\}|(\d))/g, (_, a1, a2) => `log${(a1 ?? a2).replace(/\d/g, d => SUB[d])} `)
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\(sin|cos|tan|sec|cosec|csc|cot|ln|log|exp|lim|arcsin|arccos|arctan)(?![a-zA-Z])/g, '$1 ')
    .replace(SYMBOL_RE, (_, k) => SYMBOL[k])
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\^\s*(?:\{([^{}]*)\}|(\w))/g, (_, a, b) => { const p = (a ?? b).trim(); return /^\d+$/.test(p) ? p.replace(/\d/g, d => SUP[d]) : `^(${p})`; })
    // \text{…}, \mathrm{…} and the like keep their content: only the command and the grouping braces go.
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}_]/g, '')
    .replace(new RegExp(OPEN, 'g'), '{').replace(new RegExp(CLOSE, 'g'), '}')
    .replace(/\s+/g, ' ').trim();
}

/** A prompt with its $…$ spans made plain, on one line. */
export const plainPromptText = prompt => String(prompt || '')
  // The same split the rendered question uses: an escaped dollar (\$4,000) is an amount in the prose, never the edge
  // of a formula, so it neither opens a span nor swallows the sentence up to the next real one.
  .split(/(?<!\\)\$\$?((?:\\\$|[^$])+?)(?<!\\)\$\$?/g)
  .map((part, i) => (i % 2 === 1 ? plainMath(part) : part.replace(/\\\$/g, '$').replace(/\\%/g, '%').replace(/\\,/g, ' ').replace(/\*\*([^*]+)\*\*/g, '$1')))
  .join('')
  .replace(/\s+/g, ' ').trim();
