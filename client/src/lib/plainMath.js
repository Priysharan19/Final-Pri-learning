// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a question's maths as one plain line (the collapsed question bar)
//
// The bar that recalls the question while the student works far down the page shows plain text. It used to
// delete the TeX markers, so "9x^2" read "9x2" and "x^{10}" read "x10" (owner walk-through, 19 Nov 2026). This
// keeps what the markers meant: powers as superscript digits, fractions as (a)/(b), roots as √. Display only:
// nothing here is read by marking.
// ─────────────────────────────────────────────────────────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP_EXTRA = { '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', x: 'ˣ', i: 'ⁱ' };
const sup = c => (c >= '0' && c <= '9' ? SUP[c] : SUP_EXTRA[c]);

const raise = body => {
  const s = body.trim();
  return [...s].every(c => sup(c)) ? [...s].map(sup).join('') : `^(${s})`;
};

/** TeX inside one $…$ span as plain text. */
export function plainMath(tex) {
  let s = String(tex);
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  }
  return s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\^\s*(?:\{([^{}]*)\}|([0-9a-zA-Z]))/g, (_, a, b) => raise(a ?? b))
    .replace(/_\s*(?:\{([0-9]+)\}|([0-9]))/g, (_, a, b) => [...(a ?? b)].map(c => SUB[c]).join(''))
    .replace(/\\(?:times|cdot)/g, '×').replace(/\\div/g, '÷').replace(/\\pm/g, '±').replace(/\\pi/g, 'π')
    .replace(/\\le(?:q)?\b/g, '≤').replace(/\\ge(?:q)?\b/g, '≥').replace(/\\neq?\b/g, '≠')
    .replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle)/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** A prompt with its $…$ spans made plain, on one line. */
export const plainPromptText = prompt => String(prompt || '')
  .replace(/\$\$?([^$]*)\$\$?/g, (_, m) => plainMath(m))
  .replace(/\s+/g, ' ').trim();
