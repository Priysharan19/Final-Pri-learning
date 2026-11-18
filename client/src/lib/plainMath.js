// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a question's maths as one plain line (the collapsed question bar)
//
// The bar that recalls the question while the student works far down the page
// shows plain text, not typeset maths. It used to delete the TeX markers, so
// "9x^2" read "9x2" and "x^{10}" read "x10" (owner walk-through, 19 Nov 2026).
// This keeps what the markers meant: powers as superscript digits, fractions as
// (a)/(b), roots as √. Display only: nothing here is read by marking.
// ─────────────────────────────────────────────────────────────────────────────
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', x: 'ˣ', i: 'ⁱ' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };

const raise = body => {
  const s = String(body).trim();
  return [...s].every(c => Object.hasOwn(SUP, c)) ? [...s].map(c => SUP[c]).join('') : `^(${s})`;
};
const lower = body => {
  const s = String(body).trim();
  return [...s].every(c => Object.hasOwn(SUB, c)) ? [...s].map(c => SUB[c]).join('') : `_${s}`;
};

/** TeX inside one $…$ span as plain text. */
export function plainMath(tex) {
  let s = String(tex);
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `(${a})/(${b})`);
  }
  return s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\^\s*\{([^{}]*)\}/g, (_, b) => raise(b))
    .replace(/\^\s*([0-9a-zA-Z])/g, (_, b) => raise(b))
    .replace(/_\s*\{([^{}]*)\}/g, (_, b) => lower(b))
    .replace(/_\s*([0-9])/g, (_, b) => lower(b))
    .replace(/\\times|\\cdot/g, '×').replace(/\\div/g, '÷').replace(/\\pm/g, '±').replace(/\\pi/g, 'π')
    .replace(/\\le(?:q)?\b/g, '≤').replace(/\\ge(?:q)?\b/g, '≥').replace(/\\neq?\b/g, '≠')
    .replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle)/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** A prompt with its $…$ spans made plain, on one line. */
export const plainPromptText = prompt => String(prompt || '')
  .replace(/\$\$?([^$]*)\$\$?/g, (_, m) => plainMath(m))
  .replace(/\s+/g, ' ').trim();
