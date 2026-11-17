// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the public landing's live demo
//
// A scripted student works one question: use u = tan x to show that
//
//     ∫₀^{π/4} tan²x sec²x / (5 − sec²x) dx = ln 3 − 1.
//
// The STUDENT is scripted: the five lines they "wrote" are fixed below. The
// VERDICTS are not. Every status the page shows is what the real Step Check
// (engine/checker.js) returns for that line's claims when the page runs, and
// See why is the real mistakeView (engine/mistakeView.js) on the same two
// lines Step Check compared. Nothing here says "checked" or "first error" by
// itself; client/test/landing-home-check.mjs proves it by breaking a line and
// watching the status follow.
//
// What a line claims. A line of working is several mathematical claims (line 3
// changes the integrand AND the limits). Each line lists its claims as Step
// Check input: the meta a question would carry and the working to check. The
// substitution the question sets (u = tan x) is applied to a claim's text by
// one rule, `inX`, so the engine compares like with like in x. That rule is
// the only thing the script does to the mathematics.
//
// The reading. Line 2's last symbol is the one Pri is unsure of (u or v).
// Its claim is built from the glyph the visitor confirms, so nothing is
// checked until the reading is confirmed, and the confirmed reading is what
// is checked.
//
// No visitor input is ever checked: this module takes no text from the page.
// Signed out, nothing a visitor writes is marked (AGENTS.md, ADR-0001
// amendment 2026-10-10); this is a fixed demonstration of the engine.
// ─────────────────────────────────────────────────────────────────────────────
import { stepCheck } from '../engine/checker.js';
import { mistakeView } from '../engine/mistakeView.js';

/** The question, as KaTeX source. */
export const DEMO_QUESTION_TEX = 'Use $u = \\tan x$ to show that $\\displaystyle\\int_0^{\\pi/4} \\frac{\\tan^2 x\\,\\sec^2 x}{5 - \\sec^2 x}\\,dx = \\ln 3 - 1$.';

/** The glyph Pri is unsure of on line 2, and what it might be instead. */
export const UNSURE = Object.freeze({ line: 2, read: 'u', alternative: 'v' });

/** u = tan x: a claim written with u is checked in x. */
export const inX = text => String(text).replace(/\bu\b/g, '(tan(x))');

/**
 * The scripted working. `ink` is what the student wrote (shown in a
 * handwriting face), `tex` the reading Pri shows under it, `rule` the kind of
 * step (a label, never a verdict). `claims(glyph)` returns the Step Check
 * inputs for the line, given the glyph the visitor confirmed on line 2.
 */
export const DEMO_LINES = Object.freeze([
  {
    n: 1,
    ink: 'u = tan x,  du = sec²x dx',
    tex: 'u = \\tan x,\\quad du = \\sec^2 x\\,dx',
    rule: 'substitution',
    claims: () => [
      // du/dx = sec²x: a derivative of tan x.
      { meta: { kind: 'derivative', source: 'tan(x)', variable: 'x' }, working: 'du/dx = sec(x)^2' }
    ]
  },
  {
    n: 2,
    ink: 'sec²x = 1 + tan²x = 1 + u²',
    tex: '\\sec^2 x = 1 + \\tan^2 x = 1 + {GLYPH}^2',
    rule: 'identity',
    claims: glyph => [
      { meta: { kind: 'expression', canonical: 'sec(x)^2' }, working: `sec(x)^2\n= 1 + tan(x)^2\n= ${inX(`1 + ${glyph}^2`)}` }
    ]
  },
  {
    n: 3,
    ink: 'I = ∫₀¹ u²/(4 − u²) du',
    tex: 'I = \\int_0^1 \\frac{u^2}{4 - u^2}\\,du',
    rule: 'changeOfVariable',
    claims: () => [
      // The integrand: tan²x sec²x/(5 − sec²x) dx = u²/(4 − u²) · sec²x dx.
      { meta: { kind: 'expression', canonical: 'tan(x)^2*sec(x)^2/(5-sec(x)^2)' }, working: `tan(x)^2*sec(x)^2/(5-sec(x)^2)\n= ${inX('u^2/(4-u^2)')}*sec(x)^2` },
      // The limits: x = 0 gives u = 0, x = π/4 gives u = 1.
      { meta: { kind: 'expression', canonical: 'tan(0)' }, working: 'tan(0) = 0' },
      { meta: { kind: 'expression', canonical: 'tan(pi/4)' }, working: 'tan(pi/4) = 1' }
    ]
  },
  {
    n: 4,
    ink: 'u²/(4 − u²) = 1 − 4/(4 − u²)',
    tex: '\\frac{u^2}{4 - u^2} = 1 - \\frac{4}{4 - u^2}',
    rule: 'algebraicDivision',
    // Line 4 continues from line 3's integrand (see CHAIN).
    chain: 1
  },
  {
    n: 5,
    ink: 'I = 1 − ln 3',
    tex: 'I = 1 - \\ln 3',
    rule: 'integration',
    // A definite integral's value is outside the engine's vocabulary: no
    // claim it can check, so the line is Not verified — or, after a first
    // error, follows from it, as every later line does in Step Check.
    claims: () => []
  }
]);

/**
 * Line 4 continues from line 3's integrand: the student divides. Step Check
 * reads the two as a chain of equals, as it reads a page.
 */
export const CHAIN = Object.freeze({
  meta: { kind: 'expression', canonical: 'u^2/(4-u^2)' },
  lines: ['u^2/(4-u^2)', '= 1 - 4/(4-u^2)']
});

/** The correct form of line 4, shown only when the engine verifies it. */
export const CORRECT_LINE4 = Object.freeze({
  tex: '\\frac{u^2}{4 - u^2} = \\underline{-1 + \\frac{4}{4 - u^2}}',
  working: '= -1 + 4/(4-u^2)'
});

/** Line statuses the page can show. Each has a shape and a word (Landing.jsx). */
export const STATUS = Object.freeze({ CHECKED: 'checked', ERROR: 'error', FOLLOWS: 'follows', UNVERIFIED: 'unverified' });

const stripLead = s => String(s).replace(/^\s*=\s*/, '');

/**
 * Run the engine over the scripted working.
 *
 * `glyph` is the symbol the visitor confirmed on line 2 (null: not yet
 * confirmed, so nothing is checked and null is returned). `lines` and `chain`
 * default to the script; the check passes altered copies to prove the
 * statuses are the engine's.
 *
 * Returns { lines: [{ n, status, engine: [raw Step Check rows] }], firstError,
 *           seeWhy: mistakeView | null, correct: boolean }.
 */
export function runDemo({ glyph = null, lines = DEMO_LINES, chain = CHAIN, correct = CORRECT_LINE4 } = {}) {
  if (glyph == null) return null;
  const chainReport = stepCheck(chain.meta, chain.lines.join('\n'));
  const chainRows = chainReport.lines || [];
  const chainBreak = chainRows.findIndex(r => r.status === 'break');

  const out = lines.map(line => {
    if (Number.isInteger(line.chain)) {
      const row = chainRows[line.chain] || null;
      let status = STATUS.UNVERIFIED;
      if (row?.status === 'ok') status = STATUS.CHECKED;
      else if (row?.status === 'break' && line.chain === chainBreak) status = STATUS.ERROR;
      else if (chainBreak >= 0 && line.chain > chainBreak) status = STATUS.FOLLOWS;
      return { n: line.n, status, engine: row ? [row] : [] };
    }
    const rows = line.claims(glyph).map(c => stepCheck(c.meta, c.working).lines || []);
    const flat = rows.flat();
    let status = STATUS.UNVERIFIED;
    if (flat.some(r => r.status === 'break')) status = STATUS.ERROR;
    else if (flat.length && flat.every(r => r.status === 'ok')) status = STATUS.CHECKED;
    return { n: line.n, status, engine: flat };
  });

  // Only the FIRST error is one. As in Step Check, every later line the
  // engine did not verify follows from it.
  const firstIdx = out.findIndex(l => l.status === STATUS.ERROR);
  for (let i = firstIdx + 1; firstIdx >= 0 && i < out.length; i++) {
    if (out[i].status !== STATUS.CHECKED) out[i] = { ...out[i], status: STATUS.FOLLOWS };
  }
  const firstError = firstIdx >= 0 ? out[firstIdx].n : null;

  // See why: the same rule QuestionCard's StepReport uses — the line directly
  // above the break, only when Step Check called it ok.
  let seeWhy = null;
  if (chainBreak > 0 && firstError === lines.find(l => l.chain === chainBreak)?.n) {
    const above = chainRows[chainBreak - 1];
    if (above?.status === 'ok' && above.check !== true && above.branch !== true) {
      seeWhy = mistakeView({ prevText: stripLead(above.text), brokenText: stripLead(chainRows[chainBreak].text) });
    }
  }

  // The correct form is offered only when the engine accepts it in place.
  let correctOk = false;
  if (correct && chainBreak > 0) {
    const fixed = [...chain.lines.slice(0, chainBreak), correct.working];
    const rows = stepCheck(chain.meta, fixed.join('\n')).lines || [];
    correctOk = rows.length === fixed.length && rows.every(r => r.status === 'ok');
  }

  return { lines: out, firstError, seeWhy, correct: correctOk };
}
