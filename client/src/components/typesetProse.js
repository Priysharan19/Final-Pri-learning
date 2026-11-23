// Pri Learning · engine sentences with their maths typeset (display only; pure, no I/O)
import { lineTex } from '../engine/commentTex.js';

/**
 * An engine sentence with its maths typeset. A sentence the engine already marked with `$…$` is left exactly as it is. Otherwise each
 * run of maths-looking words ("-2x", "2x^2 + x^2", "x = 1") that reads as an expression is wrapped in `$…$`; a run of plain numbers, or one
 * that does not read as maths, stays prose. Display only: nothing here changes what a sentence says.
 */
export function typesetProse(text) {
  const raw = String(text ?? '');
  if (!raw || raw.includes('$')) return raw;
  const tokens = raw.split(/(\s+)/);
  const space = w => /^\s+$/.test(w);
  const OP = /^[-+=*/]$/;
  const WORD = /^[-+=]?[0-9xyuvt()^.]+[.,;:]?$/;
  const mathy = w => OP.test(w) || (WORD.test(w) && /[0-9xyuvt^]/.test(w.replace(/[.,;:]$/, '')));
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    if (space(tokens[i]) || !mathy(tokens[i])) { out += tokens[i]; continue; }
    let j = i; let end = i;
    while (j < tokens.length && (space(tokens[j]) || mathy(tokens[j]))) { if (!space(tokens[j])) end = j; j += 1; }
    const run = tokens.slice(i, end + 1).join('');
    const tail = (run.match(/[.,;:]$/) || [''])[0];
    const body = tail ? run.slice(0, -tail.length) : run;
    const plain = /^[\d\s.,]+$/.test(body) || OP.test(body.trim());
    const tex = plain ? null : lineTex(body);
    out += tex === null ? run : `$${tex}$${tail}`;
    i = end;
  }
  return out;
}
