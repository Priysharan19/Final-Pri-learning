// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · typesetting rules for what a student reads
//
// A machine-made line gives itself away: "(x - -5)", "1x + 2y", "6x+0=5x-2".
// None of these is wrong mathematics, and every one tells a student the
// question was not written by a person. These rules run over the $…$ maths of
// a student-read string. The content certifier applies them to what a student
// reads before answering (prompt, stem, options); worked-steps-typesetting-
// check.mjs applies them to what a student reads after it (hints and worked
// steps). One rule set, so the two can never disagree about what a defect is.
// ─────────────────────────────────────────────────────────────────────────────

/** $…$ spans, skipping an escaped \$. */
export const MATH_SPAN = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;

export const TYPESET_RULES = Object.freeze([
  // "- -5", "+-3", "x--2": two signs with nothing but space between them. A
  // sign that follows an opening bracket, a brace, a relation, a comma or an
  // operator-like control sequence is a legitimate leading sign.
  ['double sign', /(?<![{(\[^_=,\\|])[-−+]\s*[-−](?=\s*(?:\d|\\frac|\\dfrac|\\sqrt|\\left|[a-zA-Z(]))/],
  // "1x", "1y^2", "1i": a coefficient of one written out. Digits, a decimal
  // point, a subscript/superscript brace or a preceding letter rule out the
  // tail of a longer number or an index like a_1x.
  ['unit coefficient', /(?<![\d._{^\\a-zA-Z}])1(?=[a-zA-Z](?![a-zA-Z]))/],
  // "0x": a zero coefficient left in.
  ['zero coefficient', /(?<![\d._{^\\a-zA-Z}])0(?=[a-zA-Z](?![a-zA-Z]))/],
  // "+0=", "- 0)", "+0 -": a zero term left in an expression.
  ['+0 term', /[-+]\s*0(?![\d.])(?=\s*(?:[=)\]},;|]|$|\\le|\\ge|\\ne|\\right|<|>|[-+]))/]
]);

// A served question is Pri's own. A textbook exercise, example or Try These
// number on a prompt reproduces the textbook (audit item 6, Nov 2026).
export const TEXTBOOK_NUMBERING = /\bNCERT\s+(?:Exercise|Example|Try These)\b|\bExercise\s+\d+\.\d+\s*Q\s*\d+/i;

function mathSpans(text) {
  if (text == null || text === '') return [];
  const out = [];
  const re = new RegExp(MATH_SPAN.source, 'g');
  let m;
  while ((m = re.exec(String(text)))) out.push(m[1]);
  return out;
}

/** Typesetting defects in the $…$ maths of one student-read string: [{ rule, math }]. */
export function typesettingHits(text) {
  const out = [];
  for (const math of mathSpans(text)) {
    for (const [rule, pattern] of TYPESET_RULES) if (pattern.test(math)) out.push({ rule, math });
  }
  return out;
}

// A worked step may show arithmetic with a zero in it: evaluating at a lower
// limit ("\dfrac{1 - 0}{3}"), summing a list that holds 0 ("16 + 8 + 0 + 8"),
// substituting C = 0. That is working, not a machine-made term. A zero term is
// a defect only inside an algebraic expression, so in hints and steps the +0
// rule looks at one side of a relation at a time and fires only when that side
// has a variable in it ("3x+0=180", "(x + 1)(x - 0)", "x^2 - -4x + 0").
const RELATION = /=|<|>|\\(?:le|ge|leq|geq|ne|neq|approx|to|Rightarrow|implies|iff|quad|qquad)(?![a-zA-Z])|\\[;,]/;
const ZERO_TERM = TYPESET_RULES.find(([rule]) => rule === '+0 term')[1];
function hasVariable(side) {
  const bare = side
    .replace(/\\(?:text|mathrm|operatorname|textbf)\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ');
  return /[a-zA-Z]/.test(bare);
}

/** Typesetting defects in the $…$ maths of one hint or worked step: [{ rule, math }]. */
export function workedStepHits(text) {
  const out = [];
  for (const math of mathSpans(text)) {
    for (const [rule, pattern] of TYPESET_RULES) {
      if (rule === '+0 term') continue;
      if (pattern.test(math)) out.push({ rule, math });
    }
    // Test each side with the relation that ends it, so "x + 0 = 5" still
    // reads as "x + 0" followed by "=".
    const sides = math.split(new RegExp(`(?=${RELATION.source})`));
    if (sides.some(side => hasVariable(side.replace(RELATION, '')) && ZERO_TERM.test(side.replace(RELATION, '') + ' =')))
      out.push({ rule: '+0 term', math });
  }
  return out;
}
