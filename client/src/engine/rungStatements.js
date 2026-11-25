// Pri Learning · does a hint rung STATE the answer? Asked of the real marker (launch QA 26 Nov 2026, review of #1122).
// A rung before the solution must not say what the question asks for. The older rule (hintLadder.js rungGivesAnswer) reads numbers; it
// cannot read a point, a pair, a complex number, a set, an interval or an expression, and it let a number through when the prompt
// also printed it. This asks the engine's own marker instead: every result a rung states (the right of an equality or an arrow,
// a bracketed list, a whole computation, a number said after "gives / is / equals / answer") is given to checkAnswer as if the
// student had typed it, and a rung is a leak when the marker would accept it. Pure; no I/O.
import { checkAnswer } from './checker.js';
import { texToPlain } from './texToPlain.js';
import { evalNumeric, normalize } from './expr.js';

const SKIP_TYPES = new Set(['mcq', 'working', 'graph-sketch', 'proof', 'manual', 'geometry']);
const NAMES = /\\?(?:sqrt|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|ln|log|exp|pi|min|max|abs|frac|dfrac|cdot|times|text|mathrm|circ|theta|infty)/g;
const tidy = s => String(s).replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle)/g, ' ').replace(/\\text\{[^{}]*\}|\\mathrm\{[^{}]*\}/g, ' ').replace(/−/g, '-').trim();
const asInput = s => { try { return texToPlain(tidy(s)).replace(/\s+/g, ' ').trim(); } catch { return tidy(s); } };
const isNumber = s => /^[-+]?\d+(?:\.\d+)?$/.test(s);
// A letter that names an unknown (not a function, not the imaginary unit or e) makes it an expression in a variable.
const hasUnknown = s => /[A-Za-z]/.test(s.replace(NAMES, '').replace(/\\[a-z]+/g, '').replace(/(?<![A-Za-z])[ie](?![A-Za-z])/g, ''));

/** The inputs a rung's text states as results, each as the marker would be typed it. */
export function statedResults(text) {
  const found = [];
  const push = (raw, atResult) => { const s = asInput(raw); if (s) found.push({ s, atResult }); };
  for (const m of String(text).matchAll(/\$\$?([^$]+)\$\$?/g)) {
    const math = m[1];
    for (const [k, part] of math.split(/\\Rightarrow|\\implies|\\Longrightarrow|\\rightarrow|\\to\b|→|\\therefore/).map(x => x.trim()).filter(Boolean).entries()) {
      const sides = part.split(/(?<![<>!])=|\\approx|≈/).map(x => x.trim()).filter(Boolean);
      const head = asInput(sides[0] || '');
      const assigned = !hasUnknown(head) || /^[A-Za-z][A-Za-z0-9]*(?:\([^()]*\))?$/.test(head);
      sides.forEach((side, i) => {
        if (sides.length > 1 && i === 0 && hasUnknown(head)) return;
        push(side, (i > 0 && (assigned || hasUnknown(asInput(side)))) || (sides.length === 1 && k > 0));
      });
    }
    for (const b of math.matchAll(/[(\[]\s*[^()\[\]{}]*?,[^()\[\]{}]*?[)\]]/g)) push(b[0], true);
    for (const b of math.matchAll(/\\\{([^{}]*)\\\}/g)) push(`{${b[1]}}`, true);
  }
  const prose = String(text).replace(/\$\$?[^$]*\$\$?/g, ' ');
  for (const w of prose.matchAll(/\b(?:answer|result|gives|give|equals|is|so|therefore|hence)\s+(?:about |approximately |equal to |now )?(-?\d+(?:\.\d+)?(?:\/\d+)?)(?![\d.]\d)/gi)) push(w[1], true);
  return found;
}

const num = n => Number(Number(n).toPrecision(12));
/** The value of a closed computation ("6 + 8", "-4 + -3", "3 \\times 0.7"), or null when it is not one. A bare number is not a computation. */
function computed(s) {
  if (hasUnknown(s) || isNumber(s) || !/\d\s*[-+*/^]\s*[-(\d]|sqrt|\)\s*[-+*/^]|\d\s*\(/.test(s)) return null;
  try { const v = evalNumeric(normalize(s)); return Number.isFinite(v) ? num(v) : null; } catch { return null; }
}

/** True when the marker would accept something this rung states as the answer to `q`. */
export function rungStatesAnswer(q, text) {
  if (!q || SKIP_TYPES.has(q.answerType) || q.multipart || q.placement || q.custom || !q.answer) return false;
  const tried = new Set();
  const asked = [];
  const accepted = input => { try { const r = checkAnswer(q, input); return !!r && r.correct === true; } catch { return false; } };
  for (const { s, atResult } of statedResults(text)) {
    if (tried.has(s)) continue; tried.add(s);
    // A computation the rung sets out, with no arithmetic left for the student, states its value even if the prompt prints that number.
    const v = computed(s);
    if (v !== null) { asked.push(v); if (accepted(String(v))) return true; }
    const parts = /^[(\[](.*)[)\]]$/.exec(s)?.[1]?.split(',').map(x => x.trim());
    if (parts && parts.length > 1) { const vs = parts.map(x => (isNumber(x) ? Number(x) : computed(x))); if (vs.every(x => x !== null) && vs.some((x, i) => String(x) !== parts[i]) && accepted(`(${vs.join(', ')})`)) return true; }
    if (isNumber(s) && !atResult) continue;                              // a lone number counts only where a result is stated
    if (!atResult && hasUnknown(s) && !s.includes(',')) continue;       // a step in a variable is a step; the marker accepts equivalent forms
    if (accepted(s)) return true;
  }
  // The values of consecutive computations read together as the pair or triple they make ("Re: -4 + -3; Im: -4 + -5").
  for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= asked.length; i++) {
    if (accepted(`(${asked.slice(i, i + n).join(', ')})`)) return true;
  }
  return false;
}
