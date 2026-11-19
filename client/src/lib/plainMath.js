// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a question's maths as one plain line (the collapsed question bar)
//
// The bar that recalls the question while the student works far down the page shows plain text. It used to
// delete the TeX markers, so "9x^2" read "9x2" and "x^{10}" read "x10" (owner walk-through, 19 Nov 2026). This
// keeps a power a power (digits as superscripts, anything else as ^(…)), a fraction as (a)/(b) and a root as √.
// Display only: nothing here is read by marking.
// ─────────────────────────────────────────────────────────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SYMBOL = { pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', times: '×', cdot: '·', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', infty: '∞', pm: '±', approx: '≈', to: '→', rightarrow: '→', degree: '°', circ: '°' };

/** TeX inside one $…$ span as plain text. */
export function plainMath(tex) {
  let s = String(tex);
  // An aligned block is its rows, one after another; a root with a simple radicand is settled before fractions so
  // that \frac{\sqrt{2}}{2} reads (√(2))/(2) and not "√(2)2" (independent review, 20 November 2026).
  s = s.replace(/\\(?:begin|end)\s*\{[a-zA-Z*]+\}/g, ' ').replace(/\\\\/g, '; ').replace(/&/g, ' ');
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
    .replace(/\\(pi|theta|alpha|beta|times|cdot|div|le|leq|ge|geq|ne|neq|infty|pm|approx|to|rightarrow|degree|circ)(?![a-zA-Z])/g, (_, k) => SYMBOL[k])
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\^\s*(?:\{([^{}]*)\}|(\w))/g, (_, a, b) => { const p = (a ?? b).trim(); return /^\d+$/.test(p) ? p.replace(/\d/g, d => SUP[d]) : `^(${p})`; })
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}_]/g, '').replace(/\s+/g, ' ').trim();
}

/** A prompt with its $…$ spans made plain, on one line. */
export const plainPromptText = prompt => String(prompt || '')
  .replace(/\$\$?([^$]*)\$\$?/g, (_, m) => plainMath(m))
  .replace(/\s+/g, ' ').trim();
