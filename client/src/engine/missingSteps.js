// Pri Learning — which steps of the worked solution are not in the working.
//
// Owner, 19 November 2026 (a competitor's marked page says what is missing:
// "the ordinate is missing", "no nature is stated"). Every generated question
// carries its worked solution (`steps`). After a question is resolved and the
// answer is NOT right, this says which steps reach a value that appears
// nowhere in the student's working.
//
// What it claims, exactly: "this value of the worked solution was not found
// on your page". It is not a mark, not a verdict on any line, and not a claim
// that the student's own method is wrong: another method may skip a step.
// It is deliberately lenient: a step counts as found when ANY value it
// reaches appears on ANY side of ANY line (a number equal to it, a decimal
// that rounds to it, or the same expression). A step with no value this can
// read (words only, vectors, sets) is never reported.
import { plainTex } from './checker.js';
import { infoOf, sameAsWritten, cleanStatement } from './arithmeticLines.js';

const TEX_SPAN = /\$([^$]+)\$/g;
const LIMITS = { steps: 12, lines: 40, values: 8 };

function sidesOf(text) {
  // A side is a value when it has a digit in it: a bare letter (the x of `x = 5`) or a word is not one.
  // Each side is also read the other ways a student writes the same value (independent review): with a unit or a
  // note after it (27.2 m, 1215.51 dollars, 1215.51 (2 dp)), with a currency sign in front, and with a constant of
  // integration (+ c). Every reading that parses is kept: finding a step is lenient on purpose.
  const out = [];
  for (const side of String(text).replace(/[≈≃]/g, '=').split('=').map(x => x.trim()).filter(x => x && /\d/.test(x))) {
    const bare = side.replace(/^[$€£]\s*/, '').replace(/\s*\([^()\d]*\d?\s*[A-Za-z. ]+\)\s*$/, '');
    const readings = new Set([side, bare,
      bare.replace(/(\d)\s*(?:[A-Za-z°%]+(?:\s*\/\s*[A-Za-z]+)?(?:\^-?\d)?)(?:\s+[A-Za-z]+)*\s*$/, '$1'),
      bare.replace(/\s*\+\s*[cCkK]\s*$/, '')]);
    for (const r of readings) { if (!r || !/\d/.test(r)) continue; let info = null; try { info = infoOf(r); } catch { info = null; } if (info) out.push(info); }
  }
  return out;
}
/** The values one step of the worked solution reaches (never the bare numbers 0, 1 or -1, which appear everywhere). */
function valuesOfStep(step) {
  const out = [];
  for (const m of String(step?.d ?? '').matchAll(TEX_SPAN)) {
    let plain = '';
    try { plain = plainTex(m[1].replace(/\\approx|\\simeq/g, '=')) || ''; } catch { plain = ''; }
    if (!plain || /[<>≤≥≠,;]|\\/.test(plain)) continue;
    for (const info of sidesOf(plain)) {
      if (info.value !== undefined && [0, 1, -1].includes(info.value)) continue;
      out.push(info);
      if (out.length >= LIMITS.values) return out;
    }
  }
  return out;
}
const decimalsOf = v => { const s = String(Math.abs(v)); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
function matches(a, b) {
  if (a.value !== undefined && b.value !== undefined) {
    if (Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(a.value), Math.abs(b.value))) return true;
    // one is the other rounded (the worked solution prints 27.2; the page has 27.20 or √740)
    const d = Math.min(decimalsOf(a.value), decimalsOf(b.value));
    return d <= 6 && Math.abs(a.value - b.value) <= 0.5 * 10 ** -d + 1e-12 && d > 0;
  }
  try { return sameAsWritten(a, b); } catch { return false; }
}

/**
 * { missing: [{ step, heading }], found, total } for a resolved, not-correct attempt, or null when nothing
 * can be said (no steps, no readable values, no working).
 */
export function missingSteps(q, working) {
  const steps = Array.isArray(q?.steps) ? q.steps.slice(0, LIMITS.steps) : [];
  // (a line longer than the line check itself reads is not read here either)
  const lines = String(working || '').split('\n').map(l => l.trim()).filter(l => l && l.length <= 160).slice(0, LIMITS.lines);
  if (!steps.length || !lines.length) return null;
  const page = [];
  for (const line of lines) {
    let text = line;
    try { text = cleanStatement(line.replace(/^\(?[a-h]\)\s+/i, '')); } catch { /* as written */ }
    for (const info of sidesOf(text)) page.push(info);
  }
  if (!page.length) return null;
  const missing = [];
  let total = 0, found = 0;
  steps.forEach((step, i) => {
    const values = valuesOfStep(step);
    if (!values.length) return;
    total++;
    if (values.some(v => page.some(p => matches(v, p)))) { found++; return; }
    const heading = String(step?.h ?? '').replace(/\$[^$]*\$/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (heading) missing.push({ step: i + 1, heading });
  });
  if (!total || !missing.length) return null;
  return { missing, found, total };
}
