// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI line check · what a model comment must be before a student sees it
//
// A comment is shown only if it is plain text with inline maths, at most 200
// characters, and passes every rule below. A comment that fails ANY rule is
// replaced by a fixed generic sentence: nothing is repaired and nothing partial is shown.
//
//   · no links, markup, backslashes, code, emoji, or control characters;
//   · no instruction to the student, no praise, no mention of marks or grades;
//   · ANTI-HALLUCINATION: every number and every relation (= < > ≤ ≥ ≠ ≈) in the
//     comment must already appear in this line, the line above it, the question
//     or the worked solution (or be "line N" for a real line). A comment that
//     introduces a number or relation of its own is dropped.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_COMMENT_CHARS } from './schema.js';

export const GENERIC = Object.freeze({
  correct: 'Consistent with the working.',
  incorrect: 'This line may not follow from the working.'
});

const fold = s => String(s ?? '').replace(/[−‒–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/ /g, ' ');

const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]');
const MARKUP = /<[^>]*>|`|\*\*|__|\\|\[[^\]]*\]\([^)]*\)|^\s*[#>*-]\s|\{|\}|\$/;
const LINK = /https?:|www\.|ftp:|mailto:|\b[a-z0-9-]+\.(?:com|org|net|io|au|edu|gov|ai|app|dev|co)\b|@\w/i;
const EMOJI = /\p{Extended_Pictographic}|[\u{1F000}-\u{1FFFF}]/u;
const PRAISE = /\b(great|good job|good work|well done|excellent|nice|perfect|perfectly|brilliant|awesome|fantastic|amazing|congrat\w*|bravo|impressive|superb|wonderful|clever|smart|spot on|nailed|keep it up|proud)\b/i;
const MARKS = /\b(marks?|marking|marked|scores?|scored|grades?|graded|points? (?:awarded|lost|deducted)|full credit|credit|deduct\w*)\b/i;
const INSTRUCTION = /\b(ignore|disregard|forget|you (?:must|should|need|have to|ought)|must|should|need to|needs to|please|make sure|be sure|remember|don'?t forget|try to|try again|try using|you can|you could|let'?s|let us)\b|^\s*(?:check|try|use|remember|ensure|make|write|add|subtract|multiply|divide|substitute|expand|simplify|redo|recompute|recalculate|rewrite|consider|note|look|go|see|read|ignore|apply|find|solve|compute|calculate|replace|change|correct|fix|review|revisit)\b/i;
const NUMBER = /\d+(?:\.\d+)?/g;
const RELATION = /[=<>≤≥≠≈]|!=|<=|>=/g;

const numbersOf = text => (fold(text).match(NUMBER) || []).map(Number);
const relationsOf = text => new Set((fold(text).replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠').match(RELATION) || []).map(r => (r === '=' ? '=' : r)));

/**
 * Return the comment if it may be shown, else null.
 * @param {string} comment  the model's text
 * @param {{ line: string, above?: string, prompt?: string, solution?: string, lineCount?: number }} ctx
 */
export function sanitiseComment(comment, ctx) {
  if (typeof comment !== 'string') return null;
  const text = comment.replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_COMMENT_CHARS) return null;
  if (CONTROL.test(comment) || MARKUP.test(text) || LINK.test(text) || EMOJI.test(text)) return null;
  if (PRAISE.test(text) || MARKS.test(text) || INSTRUCTION.test(text)) return null;
  if (/[^\p{L}\p{N}\s.,;:'"()\[\]^_+\-*/=<>≤≥≠≈√πθ°′²³×÷−→⇒%!?…]/u.test(text)) return null;
  // The anti-hallucination guard.
  const known = [ctx.line, ctx.above, ctx.prompt, ctx.solution].map(fold).join('\n');
  const knownNums = new Set(numbersOf(known));
  const withoutLineRefs = text.replace(/\blines?\s+(\d+)(?:\s*(?:,|and|to|-)\s*(\d+))*/gi, (m) => {
    for (const n of (m.match(/\d+/g) || [])) if (!(Number(n) >= 1 && Number(n) <= (ctx.lineCount || 0))) return `#BAD${n}#`;
    return ' ';
  });
  if (/#BAD/.test(withoutLineRefs)) return null;
  for (const n of numbersOf(withoutLineRefs)) if (!knownNums.has(n)) return null;
  const knownRel = relationsOf(known);
  for (const r of relationsOf(withoutLineRefs)) if (!knownRel.has(r)) return null;
  return text;
}

/** The comment a student sees, and whether it is the model's own words or the fixed generic one. */
export function commentFor(verdict, comment, ctx) {
  const clean = sanitiseComment(comment, ctx);
  return clean ? { text: clean, generic: false } : { text: GENERIC[verdict === 'incorrect' ? 'incorrect' : 'correct'], generic: true };
}
