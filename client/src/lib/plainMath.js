// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a question's maths as one plain line (the collapsed question bar)
//
// The bar that recalls the question while the student works far down the page shows plain text. It used to
// delete the TeX markers, so "9x^2" read "9x2" and "x^{10}" read "x10" (owner walk-through, 19 Nov 2026). This
// keeps a power a power (digits as superscripts, anything else as ^(…)), a fraction as (a)/(b) and a root as √.
// Display only: nothing here is read by marking.
// ─────────────────────────────────────────────────────────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** TeX inside one $…$ span as plain text. */
export function plainMath(tex) {
  let s = String(tex);
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  }
  return s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\^\s*(?:\{([^{}]*)\}|(\w))/g, (_, a, b) => { const p = (a ?? b).trim(); return /^\d+$/.test(p) ? p.replace(/\d/g, d => SUP[d]) : `^(${p})`; })
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}_]/g, '').replace(/\s+/g, ' ').trim();
}

/** A prompt with its $…$ spans made plain, on one line. */
export const plainPromptText = prompt => String(prompt || '')
  .replace(/\$\$?([^$]*)\$\$?/g, (_, m) => plainMath(m))
  .replace(/\s+/g, ' ').trim();
