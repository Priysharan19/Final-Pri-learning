// Pri Learning · what the question itself says, for the line check
//
// 20 November 2026. The general line check (arithmeticLines.js) knows nothing about the question, so a true line that
// only copies the question (`y = 2x(4 - x)` under "the curve y = 2x(4 - x)") or sets up what it asks for came back a
// note. This reads the question's PROMPT, the text the student was shown, and returns only what the prompt states:
//
//   · definitions      `y = 2x(4 - x)`, `f(x) = x^2 - 4`, and a number introduced with let / where / given / with
//   · area             the one curve, only when the WHOLE prompt is one of a few plain sentences asking for the area
//                      bounded by it and the x-axis (a whitelist: a restriction, a second span or another sentence = none)
//
// NOT facts (reviewed 20 November 2026): an equation or identity the prompt states (it may be false: "Prove or disprove",
// "A student writes", "Verify that x = 2 is a root of …"), a bare expression, an integral. A prompt can state a false
// line, so only a DEFINITION is a fact. A definition under show / prove / verify / test / check / whether / explain /
// claim is dropped, and so is a number that also appears in an equation of the prompt.
//
// ANSWER SAFETY. Nothing is read from the question but `prompt`: not the answer, the solution steps, the traps, the
// hints or the step-check plan. The test (client/test/question-facts-check.mjs) hands this a question whose every other
// property throws when it is read. The facts are what the student could copy from the screen.
//
// Anything texToPlain cannot convert is dropped; no facts at all returns null, and the line check then behaves exactly
// as it did before. Pure: no clock, no randomness, no network.
import { texToPlain } from './texToPlain.js';

const MAX_PROMPT = 2000;
const MAX_SPANS = 12;
const NAME = /^([A-Za-z])(?:\(([a-z])\))?$/;
// A sentence that puts a statement to the test is not giving a fact.
const CLAIM = /\b(?:show|prove|verify|test|check|whether|disprove|explain|claim|claims|student writes|is it true|if possible|not an identity|justify|true or false|identity|error|mistake|correct)\b/i;
const INTRODUCES = /\b(?:let|where|given|with|when|suppose|assume|take)\b/i;
const CURVE = '(?:(?:the )?(?:curve|parabola|graph of|graph) )?';
const FIND = '(?:find|calculate|determine|evaluate)';
// The whole prompt, the one maths span written §, must be one of these and nothing else.
const AREA_SHAPES = [
  new RegExp(`^${FIND} the (?:exact )?area (?:bounded|enclosed) by ${CURVE}§ and the x-axis$`),
  new RegExp(`^${FIND} the (?:exact )?area (?:bounded|enclosed) between ${CURVE}§ and the x-axis$`),
  new RegExp(`^${FIND} the (?:exact )?area (?:bounded|enclosed) by the x-axis and ${CURVE}§$`),
  new RegExp(`^${FIND} the (?:exact )?area between ${CURVE}§ and the x-axis$`),
  new RegExp(`^the (?:curve|parabola|graph) § ${FIND} the (?:exact )?area (?:bounded|enclosed) by the (?:curve|parabola|graph) and the x-axis$`),
  new RegExp(`^the (?:curve|parabola|graph) § ${FIND} the (?:exact )?area (?:bounded|enclosed) between the (?:curve|parabola|graph) and the x-axis$`),
  new RegExp(`^the (?:curve|parabola|graph) § and the x-axis (?:bound|enclose) a region ${FIND} its area$`)
];
const FORM = /[.,]?\s*(?:give|leave) your answer (?:as an exact value|in exact form|as a fraction|in square units|exactly)$/;


/** The top-level pieces of a TeX span, split at commas and semicolons outside any bracket or brace. */
function topLevelPieces(tex) {
  const pieces = [];
  let depth = 0, cur = '';
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '\\' && i + 1 < tex.length) { cur += ch + tex[i + 1]; i += 1; continue; }
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    if (ch === '}' || ch === ')' || ch === ']') depth -= 1;
    if (depth === 0 && (ch === ',' || ch === ';')) { pieces.push(cur); cur = ''; continue; }
    cur += ch;
  }
  pieces.push(cur);
  return pieces.map(p => p.trim()).filter(Boolean);
}

/** The facts the prompt states, or null when it states none this module can read. `q` is read for `prompt` only. */
export function questionFacts(q) {
  const prompt = q && typeof q === 'object' ? q.prompt : null;
  if (typeof prompt !== 'string' || !prompt || prompt.length > MAX_PROMPT) return null;
  // A piecewise definition (cases, or the same name defined twice, each with its condition) gives no facts at all.
  if (/\\begin\{(?:cases|array|aligned|align)\*?\}|\\left\\\{/.test(prompt)) return null;
  const defs = [], equationLetters = new Set();
  const found = [];
  const seen = new Set();
  let outside = '', last = 0, spans = 0;
  // a dollar sign for money (\$500) is not a maths delimiter
  const text = prompt.replace(/\\\$/g, '\u0001');
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    const before = text.slice(last, m.index);
    last = m.index + m[0].length;
    outside += `${before} § `;
    if (++spans > MAX_SPANS) break;
    const sentence = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('?'), before.lastIndexOf('!')) + 1);
    const claimed = CLAIM.test(sentence);
    for (const tex of topLevelPieces(m[1])) {
      const plain = texToPlain(tex);
      if (!plain || /[<>!≤≥≠≈]/.test(plain) || plain.length > 160) continue;
      const key = plain.replace(/\s+/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      if (/[∫\]]_/.test(plain)) continue;
      const sides = plain.split('=');
      if (sides.length !== 2 || !sides[0] || !sides[1]) continue;
      const head = NAME.exec(sides[0].trim());
      if (!head) { for (const c of plain.match(/[A-Za-z]/g) || []) equationLetters.add(c); continue; }
      const def = { name: head[1], variable: head[2] || null, expr: sides[1].trim(), text: plain };
      const number = /^-?\d+(?:\.\d+)?$/.test(def.expr);
      // a number is a given only when the sentence introduces it
      if (claimed || (number && !INTRODUCES.test(sentence) && !(!before.trim() && !text.slice(last).replace(/[\s.]/g, '')))) continue;
      found.push(def);
    }
  }
  outside += text.slice(last);
  // a letter that an equation of the prompt is about (Verify that x = 2 is a root of x^2 - 4x + 3 = 0) is not given
  for (const d of found) if (!(equationLetters.has(d.name) || (d.variable && equationLetters.has(d.variable)))) defs.push(d);
  // The area form: a whitelist of whole prompts (see AREA_SHAPES), one span, which is the one curve.
  let area = null;
  const words = outside.toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.$/, '').replace(FORM, '').replace(/[.,]\s*(?=find|calculate|determine|evaluate)/g, ' ').replace(/\s+/g, ' ').trim();
  if (spans === 1 && defs.length === 1 && found.length === 1 && defs[0].variable === null && /[a-z]/i.test(defs[0].expr.replace(/\b(?:sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|pi)\b/gi, ''))
      && AREA_SHAPES.some(r => r.test(words))) {
    area = { name: defs[0].name };
  }
  if (!defs.length || new Set(found.map(d => d.name)).size !== found.length) return null;
  return { defs, area };
}
