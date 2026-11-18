// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the PUBLIC description of a question
//
// What the interpreter may be told about a question, and what the verifier
// computes its truths from. Built ONLY from the question's public fields
// (client/src/engine/publicQuestion.js: the prompt and its figure/labels). No
// answer, solution step, mark, trap, step-check plan or seed is read here, so
// nothing derived from them can reach the interpreter. A test pins this: the
// description is identical for two questions that differ only in hidden fields.
// ─────────────────────────────────────────────────────────────────────────────
import { publicQuestionFields } from '../../../client/src/engine/publicQuestion.js';
import { foldText } from './claims.js';

const SYMBOLS = {
  times: '×', cdot: '×', div: '÷', pi: 'π', theta: 'θ', alpha: 'α', beta: 'β',
  le: '≤', leq: '≤', leqslant: '≤', ge: '≥', geq: '≥', geqslant: '≥', ne: '≠', neq: '≠', approx: '≈',
  pm: '±', circ: '°', sin: 'sin', cos: 'cos', tan: 'tan', ln: 'ln', log: 'log', cot: 'cot', sec: 'sec', csc: 'csc',
  max: 'max', min: 'min', exp: 'exp'
};

function braced(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
  }
  return [s.slice(i + 1), s.length];
}

function convert(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|[\s\S])/.exec(s.slice(i)) || [s[i], ' '];
      const name = m[1];
      i += m[0].length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        while (s[i] === ' ') i++;
        let a, b;
        if (s[i] === '{') [a, i] = braced(s, i); else { a = s[i]; i++; }
        while (s[i] === ' ') i++;
        if (s[i] === '{') [b, i] = braced(s, i); else { b = s[i]; i++; }
        const A = convert(a), B = convert(b);
        if (A === null || B === null) return null;
        out += `(${A})/(${B})`;
      } else if (name === 'sqrt') {
        while (s[i] === ' ') i++;
        if (s[i] === '{') { let a; [a, i] = braced(s, i); const A = convert(a); if (A === null) return null; out += `√(${A})`; } else out += '√';
      } else if (name === 'left' || name === 'right' || name === 'displaystyle') { /* dropped */ }
      else if (name === ',' || name === ';' || name === ' ' || name === 'quad' || name === ':') out += ' ';
      else if (name === 'text' || name === 'mathrm') {
        while (s[i] === ' ') i++;
        let a = ''; if (s[i] === '{') [a, i] = braced(s, i);
        out += a;
      } else if (Object.hasOwn(SYMBOLS, name)) out += SYMBOLS[name];
      else return null;
    } else if (c === '^' || c === '_') {
      i++;
      let a;
      if (s[i] === '{') [a, i] = braced(s, i);
      else if (s[i] === '\\') { const mm = /^\\([a-zA-Z]+|[\s\S])/.exec(s.slice(i)) || [s[i]]; a = mm[0]; i += mm[0].length; }
      else { a = s[i] ?? ''; i++; }
      a = convert(a);
      if (a === null) return null;
      if (c === '^') out += a === '°' ? '°' : `^(${a})`;
      else out += `_${a}`;
    } else if (c === '{' || c === '}') { i++; }
    else { out += c; i++; }
  }
  return out;
}

/** One tex span as the plain linear maths a student would write; null when it cannot be read. */
export function texToPlain(tex) {
  const r = convert(String(tex).trim());
  if (r === null) return null;
  return r.replace(/\s+/g, ' ').trim() || null;
}

const SPAN = /\$([^$]+)\$/g;

const CONCEPTS = [
  ['maximum', /\bmaxim/i], ['minimum', /\bminim/i], ['amplitude', /\bamplitude/i], ['period', /\bperiod\b/i],
  ['midline', /\bmidline|\bequilibrium|\bmean level/i],
  ['stationary', /\bstationary|\bturning point|\bcritical point/i], ['derivative', /\bderivative|\bdifferentiate|\bgradient function/i],
  ['gradient', /\bgradient|\bslope/i], ['x-intercept', /\bx-?intercept|\bzeros?\b|\broots?\b/i], ['y-intercept', /\by-?intercept/i],
  ['area', /\barea\b/i], ['perimeter', /\bperimeter/i], ['volume', /\bvolume/i], ['mean', /\bmean\b|\baverage\b/i],
  ['median', /\bmedian/i], ['discriminant', /\bdiscriminant/i]
];

/**
 * The public structured description. `source` may be a whole question object
 * (only its public fields are read) or an object holding a prompt.
 */
export function publicDescription(source) {
  const pub = publicQuestionFields(source || {});
  const prompt = String(pub.prompt || '');
  const spans = [];
  let m;
  SPAN.lastIndex = 0;
  while ((m = SPAN.exec(prompt))) { const p = texToPlain(m[1]); if (p) spans.push(p); }
  const functions = [], equations = [], inequalities = [];
  const seen = new Set();
  for (const span of spans) {
    for (const piece of span.split(/\s*(?:;|,\s*(?=[A-Za-z]\s*(?:\([A-Za-z]\))?\s*=)|\s+and\s+)\s*/)) {
      const text = foldText(piece).trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      if (/[≤≥<>]/.test(text)) { inequalities.push(text); continue; }
      const fn = /^([A-Za-z])\(([A-Za-z])\)\s*=\s*([^=]+)$/.exec(text);
      if (fn) { functions.push({ name: fn[1], variable: fn[2], rhs: fn[3].trim() }); continue; }
      const eq = /^([^=]+)=([^=]+)$/.exec(text);
      if (eq) {
        const lhs = eq[1].trim(), rhs = eq[2].trim();
        // "y = 3x^2 + 6x" defines y as a function of x; any other relation is an equation.
        if (/^[A-Za-z]$/.test(lhs)) {
          const vars = [...new Set((rhs.replace(/\b(sin|cos|tan|ln|log|exp|sqrt|cot|sec|csc|max|min)\b/g, '').match(/[A-Za-z]/g) || []))].filter(v => v !== lhs);
          if (vars.length === 1) { functions.push({ name: lhs, variable: vars[0], rhs, implicit: true }); continue; }
        }
        equations.push({ lhs, rhs, text });
      }
    }
  }
  const bare = prompt.replace(SPAN, (_, tex) => ` ${texToPlain(tex) || ''} `);
  const sentences = bare.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
  const ask = sentences[sentences.length - 1] || '';
  const asked = CONCEPTS.filter(([, re]) => re.test(ask)).map(([k]) => k);
  const cues = CONCEPTS.filter(([, re]) => re.test(bare)).map(([k]) => k);
  const restricted = inequalities.length > 0 || /\b(for|when|between|domain|interval|over|where)\b[^.]*\d/i.test(bare) && /\b(≤|≥|<|>|between|domain|interval|first|within)\b/i.test(prompt + ' ' + spans.join(' '));
  const pieces = [...seen];
  const out = {
    pieces,
    prompt: bare.replace(/\s+/g, ' ').trim(),
    spans,
    functions, equations, inequalities,
    asked, cues,
    restricted: !!restricted,
    variables: [...new Set(functions.map(f => f.variable))]
  };
  return Object.freeze(out);
}

/** The text sent to a model interpreter about the question, from the public description only. */
export function interpreterQuestionView(description) {
  return {
    question: String(description.prompt || '').slice(0, 1200),
    given_functions: description.functions.map(f => ({ name: f.name, variable: f.variable, rule: f.rhs })),
    given_equations: description.equations.map(e => e.text)
  };
}
