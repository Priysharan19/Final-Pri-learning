// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · maths inside an engine comment
//
// The line-marking engines write English sentences about a student's working
// ("Worked out, each side comes to 64/3."). The client typesets any `$…$` span
// of such a sentence, so the engines mark their maths with these helpers: the
// sentence stays prose and only the maths becomes TeX.
//
// Presentation only: nothing here decides a verdict, and a fragment that the
// plain-to-TeX converter (answerTex.js) cannot read stays exactly as the
// student wrote it, never broken TeX. Pure: no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { answerToTex, expressionTex } from './answerTex.js';

const SPAN = /^\$(.+)\$$/s;

/** TeX (without the dollars) for one expression the student wrote, or null when it cannot be read as one. */
export function fragmentTex(text) {
  const raw = String(text ?? '').trim().replace(/[−–]/g, '-');
  if (!raw || raw.includes('$')) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return raw;
  // Arithmetic on numbers alone: answerToTex leaves such text for a list of numbers, this is one expression.
  if (/^[\d\s.+\-*/^()]+$/.test(raw)) return /\d\s+\d/.test(raw) ? null : expressionTex(raw);
  const out = answerToTex(raw);
  const m = out !== raw ? SPAN.exec(out) : null;
  return m ? m[1] : null;
}

/** TeX for a line or an equation: each side of every `=` set as maths, or null when any side cannot be. */
export function lineTex(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.includes('$')) return null;
  // A continuation line starts with the sign: "= 2[32 - 64/3]".
  const lead = /^[=≈]\s*/.exec(raw);
  if (lead && raw.length > lead[0].length) { const rest = lineTex(raw.slice(lead[0].length)); return rest === null ? null : `${lead[0].trim() === '≈' ? '\\approx' : '='} ${rest}`; }
  const sides = raw.split(/(?<![<>!=≤≥≠])=(?!=)/).map(s => s.trim());
  if (sides.some(s => !s)) return null;
  const tex = sides.map(fragmentTex);
  return tex.every(x => x !== null) ? tex.join(' = ') : null;
}

/** Text that stays plain inside a sentence: a literal dollar is escaped and `*` (italics in the renderer) becomes ×. */
const plainText = s => String(s ?? '').replace(/\*/g, '×').replace(/\$/g, '\\$');

/** A student's expression or equation as a `$…$` span for a comment, or as plain text when it cannot be set. */
export function mathSpan(text) {
  const tex = lineTex(text);
  return tex === null ? plainText(String(text ?? '').trim()) : `$${tex}$`;
}

/** `name = expr` as one span: the name is a letter or a short call, the expression is the student's. */
export function assignSpan(name, expr) {
  return mathSpan(`${name} = ${expr}`);
}

/** TeX the engines build themselves (a value, a vector) as a span. */
export const texSpan = tex => `$${tex}$`;

/**
 * An engine comment as plain text, for a tooltip, a title or a spoken label: the dollars go and
 * the TeX is turned back into the notation a student writes.
 */
export function plainComment(text) {
  let s = String(text ?? '');
  if (!s.includes('$')) return s;
  s = s.replace(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g, (_, tex) => {
    const unit = x => (/^[\w.√π]+(?:\([^()]*\))?$/.test(x) ? x : `(${x})`);
    let t = tex.replace(/\\[ ,;]/g, ' ').replace(/\\(?:left|right)/g, '').replace(/\\operatorname\{([a-z]+)\}/g, '$1')
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => (/^[\w.]+$/.test(x) ? `√${x}` : `√(${x})`))
      .replace(/\\pi\s*/g, 'π').replace(/\\times\s*/g, '×').replace(/\\cdot\s*/g, '·').replace(/\\(?!frac)([a-z]+)\s*/gi, '$1');
    for (let i = 0; i < 6; i++) t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (__, a, b) => `${unit(a)}/${unit(b)}`);
    t = t.replace(/\^\{([^{}]*)\}/g, (_, e) => (/^(?:[\d.]+|[A-Za-z])$/.test(e) ? `^${e}` : `^(${e})`))
      .replace(/(^|[(,=\s])-(?=[\d√π(])/g, '$1−');   // a sign, not a subtraction
    return t.trim();
  });
  return s.replace(/\\\$/g, '$');
}

/** True when a sentence's dollars pair up (an escaped `\$` is a literal dollar, not a delimiter). */
export const dollarsBalanced = text => (String(text ?? '').replace(/\\\$/g, '').match(/\$/g) || []).length % 2 === 0;
