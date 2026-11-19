// Pri Learning · what the question itself says, for the line check
//
// 20 November 2026. The general line check (arithmeticLines.js) knows nothing about the question, so a true line that
// only copies the question (`y = 2x(4 - x)` under "the curve y = 2x(4 - x)") or sets up what it asks for came back a
// note. This reads the question's PROMPT, the text the student was shown, and returns only what the prompt states:
//
//   · definitions      `y = 2x(4 - x)`, `f(x) = x^2 - 4`, and given numbers `a = 3`, `r = 0.05`
//   · equations        `x^2 - 5x + 6 = 0`
//   · integrals        a definite integral written in the prompt
//   · asked expressions the expression after "differentiate", "integrate", "expand", "simplify", "evaluate"
//   · area             the one curve, when the prompt asks for the area bounded by it and the x-axis and says nothing else
//                      about the region
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
const ASK = /\b(differentiate|derivative of|integrate|expand|simplify|evaluate)\b[^.?!]*$/i;
const NAME = /^([A-Za-z])(?:\(([a-z])\))?$/;
const INTEGRAL_FORM = /^∫_\{([^{}]+)\}\^\{([^{}]+)\}(.+?)d([a-z])$/;

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
  const defs = [], equations = [], integrals = [], asks = [];
  const seen = new Set();
  let outside = '', last = 0, spans = 0;
  // a dollar sign for money (\$500) is not a maths delimiter
  const text = prompt.replace(/\\\$/g, '\u0001');
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    const before = text.slice(last, m.index);
    last = m.index + m[0].length;
    outside += `${before} § `;
    if (++spans > MAX_SPANS) break;
    const asking = ASK.test(before.slice(-70));
    for (const tex of topLevelPieces(m[1])) {
      const plain = texToPlain(tex);
      if (!plain || /[<>!≤≥≠≈]/.test(plain) || plain.length > 160) continue;
      const key = plain.replace(/\s+/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const integral = INTEGRAL_FORM.exec(plain);
      if (integral && !plain.includes('=')) {
        integrals.push({ lower: integral[1], upper: integral[2], body: integral[3], variable: integral[4], text: plain });
        if (asking) asks.push({ text: plain });
        continue;
      }
      if (/[∫\]]_/.test(plain)) continue;
      const sides = plain.split('=');
      if (sides.length === 2 && sides[0] && sides[1]) {
        const head = NAME.exec(sides[0].trim());
        if (head) defs.push({ name: head[1], variable: head[2] || null, expr: sides[1].trim(), text: plain });
        else equations.push({ left: sides[0].trim(), right: sides[1].trim(), text: plain });
      } else if (sides.length === 1 && asking) asks.push({ text: plain });
    }
  }
  outside += text.slice(last);
  const words = outside.toLowerCase();
  // The area bounded by the one curve the prompt gives and the x-axis, with no other boundary named.
  let area = null;
  const NOT_NAMED = /\b(?:line|lines|tangent|normal|y[- ]axis|ordinate|chord|shaded|circle|and the curve|rotated|volume)\b/;
  const isNumber = d => /^-?\d+(?:\.\d+)?$/.test(d.expr);
  const curves = defs.filter(d => !isNumber(d) && /[a-z]/i.test(d.expr.replace(/\b(?:sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|pi)\b/gi, '')));
  const extras = defs.filter(d => !curves.includes(d));
  if (/\barea\b/.test(words) && /\bx[- ]axis\b/.test(words) && /\b(?:bounded|enclosed)\b/.test(words)
      && !NOT_NAMED.test(words.replace(/\bx[- ]axis\b/g, ''))
      && (extras.length || !/\b(?:between|from)\b/.test(words))
      && curves.length === 1 && !equations.length && extras.every(d => isNumber(d) && d.variable === null)) {
    area = { name: curves[0].name, limits: extras.map(d => ({ name: d.name, value: d.expr })) };
  }
  if (!defs.length && !equations.length && !integrals.length && !asks.length) return null;
  return { defs, equations, integrals, asks, area };
}
