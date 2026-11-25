// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the hint ladder (ledger §6.5)
//
// Four rungs, always in this order, each costing mark weight:
//
//   nudge     a pointer at the idea, no method              −10 %
//   method    the method named, no numbers worked           −20 %
//   worked    the first step actually worked                −30 %
//   solution  the whole solution — this ends the question   → 0 %
//
// The weight left after a rung is the share of the engine's mark a correct
// answer is credited with for THIS question. One table, read by the server's
// hint route and submission commit (server/platform/practice.js — the only
// place a rung is served or charged), and by the question card's chip, so the
// number on screen is the number the server charged. The deterministic marker
// is untouched: a hint never changes what counts as correct, only how much of
// the mark is credited.
//
// Research boundary (docs/research/PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL.md): the
// weights are a PRODUCT CREDIT POLICY, not an estimate of how much a rung
// contaminates the evidence. Mastery evidence keeps the rung provenance
// (`hintLevel`, `hintRungs`) separately and treats any rung as supported
// performance; nothing here is a measured evidence weight.
//
// Text comes from what the generator authored, in order of fidelity: a bank's
// `hints` array is read as nudge → method, its solution `steps` give the first
// worked step, and `solutionText` / the steps give the full solution. A bank
// that authored only one hint gets the method rung from its first step
// heading, so every question has four rungs — and a rung whose text would be
// empty is marked `thin` rather than inventing prose.
//
// Reaching for the solution rung is a reveal: the server resolves the question
// as `revealed`, never correct, exactly like Show solution, so a student cannot
// read the answer and then type it in for the remaining 40 %. The rung texts
// are built from the server's escrowed question, never from a device payload:
// the worked step and the step headings are not public before resolution.
// ─────────────────────────────────────────────────────────────────────────────

import { rungStatesAnswer } from './rungStatements.js';
import { evalNumeric, normalize } from './expr.js';

export const HINT_RUNGS = Object.freeze(['nudge', 'method', 'worked', 'solution']);

/** The weight each rung takes off, as a fraction of the question's marks. */
export const RUNG_COST = Object.freeze({ nudge: 0.10, method: 0.20, worked: 0.30, solution: 1.00 });

/**
 * Help units a rung level is worth to the adaptive model — the same scale the
 * old hint bulbs and the tutor levels charge (updateRating takes 15 % a unit
 * under its own floor). nudge 1, method 2, worked 3; the solution rung ends the
 * question and is not a success, so it never reaches updateRating as help.
 */
export const RUNG_HELP_UNITS = Object.freeze({ nudge: 1, method: 2, worked: 3, solution: 3 });

const clamp01 = v => Math.max(0, Math.min(1, v));
const round2 = v => Math.round(v * 100) / 100;

/** Rungs opened so far, as a validated level 0–4. */
export function rungLevelOf(level) {
  const n = Number(level);
  return Number.isInteger(n) ? Math.max(0, Math.min(HINT_RUNGS.length, n)) : 0;
}

/** The rung name at a 1-based level, or null. */
export const rungAt = level => HINT_RUNGS[rungLevelOf(level) - 1] || null;

/** Mark weight (0–1) still available after `level` rungs have been opened. */
export function markWeightAfter(level, free = false) {
  const n = rungLevelOf(level);
  // Free hints (owner decision, 19 Nov 2026, Prithagoras): nudge, method and worked step
  // take nothing off; the full solution still ends the question with no credit.
  if (free) return n >= HINT_RUNGS.length ? 0 : 1;
  let weight = 1;
  for (let i = 0; i < n; i++) weight -= RUNG_COST[HINT_RUNGS[i]];
  return round2(clamp01(weight));
}

/** Help units the adaptive model charges for `level` opened rungs. */
export function helpUnitsAfter(level) {
  const n = rungLevelOf(level);
  return n ? RUNG_HELP_UNITS[HINT_RUNGS[n - 1]] : 0;
}

/** The next rung a student may open after `level`, or null when the ladder is spent. */
export const nextRungAfter = level => (rungLevelOf(level) >= HINT_RUNGS.length ? null : rungAt(rungLevelOf(level) + 1));

const text = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const stepText = s => text(s?.d) || text(s?.h);

/** The answer's numeric values: the key, its simplest fraction, its canonical input, a set's values. */
function answerNumbers(q) {
  const a = q?.answer || {};
  const out = [];
  if (Number.isFinite(a.value)) out.push(a.value);
  if (a.simplestFraction && Number(a.simplestFraction.d)) out.push(Number(a.simplestFraction.n) / Number(a.simplestFraction.d));
  if (Array.isArray(a.values)) for (const v of a.values) if (Number.isFinite(v)) out.push(v);
  for (const t of [a.canonicalInput]) { try { if (typeof t === 'string') out.push(evalNumeric(normalize(t))); } catch { /* not a number */ } }
  return out.filter(Number.isFinite);
}

/** TeX reduced to what the expression engine reads. */
function texToPlain(tex) {
  let s = String(tex);
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*(\{[^{}]*\}|[0-9a-zA-Z])\s*(\{[^{}]*\}|[0-9a-zA-Z])/g, (_, x, y) => `((${x.replace(/^\{|\}$/g, '')})/(${y.replace(/^\{|\}$/g, '')}))`);
  }
  return s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)').replace(/\\(times|cdot)/g, '*').replace(/\\div/g, '/')
    .replace(/\\(left|right|,|;|!|quad|qquad|displaystyle)/g, '').replace(/\\pi/g, 'pi').replace(/[{}]/g, '');
}

/**
 * Does a rung's text state a number equal to the answer, in any form? Every
 * closed numeric side of every `$…$` span is evaluated (2/7, \dfrac{6}{21},
 * \dfrac{2/20}{7/20}, 12/6), and every bare number in the prose is read with
 * a full stop, comma or bracket after it as the end of the number.
 */
export function statesAnswerValue(rung, values) {
  if (!values.length) return false;
  const hit = n => Number.isFinite(n) && values.some(v => Math.abs(n - v) <= 1e-9 * Math.max(1, Math.abs(v)));
  const text = String(rung ?? '');
  for (const m of text.matchAll(/\$([^$]+)\$/g)) {
    for (const side of texToPlain(m[1]).split(/=|<|>|\\le|\\ge|≤|≥|\\Rightarrow|\\to|,|;/)) {
      const t = side.trim();
      if (!t || /[a-zA-Z]/.test(t.replace(/sqrt|pi/g, ''))) continue;   // a side with a letter is not a closed value
      try { if (hit(evalNumeric(normalize(t)))) return true; } catch { /* not a closed value */ }
    }
  }
  for (const m of text.replace(/\$[^$]*\$/g, ' ').matchAll(/(?<![\d.])-?\d+(?:\.\d+)?(?:\/\d+)?(?!\d|\.\d)/g)) {
    const [p, q] = m[0].split('/');
    if (hit(q ? Number(p) / Number(q) : Number(p))) return true;
  }
  return false;
}

/** How closely a closed number in a rung must match the key to be "the answer": the key's own tolerance, or the rounding the prompt asks for. */
function keySlack(q, v) {
  const a = q?.answer || {};
  let slack = Math.max(1e-9 * Math.max(1, Math.abs(v)), Number.isFinite(a.tol) ? Math.abs(a.tol) : 0);
  const prompt = String(q?.prompt || '');
  const dp = prompt.match(/(\d+)\s*decimal\s*places?/i) || prompt.match(/\b(one|two|three|four)\s*decimal\s*places?/i);
  if (dp) slack = Math.max(slack, 0.5 * 10 ** -(Number(dp[1]) || { one: 1, two: 2, three: 3, four: 4 }[dp[1].toLowerCase()]));
  const sf = prompt.match(/(\d+)\s*significant\s*figures?/i);
  if (sf && v) slack = Math.max(slack, 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(v))) + 1 - Number(sf[1])));
  return slack;
}

/**
 * Does a rung before the solution hand the student the final answer? (launch QA 26 Nov 2026: on several topics the worked step
 * was the whole computation, "E(X) = np = 4 × 0.7 = 2.8".) It does when
 *   · it is a result: the last side of a `$a = b = key$` chain, or a closed sum, product or fraction that evaluates to the key
 *     (the one trivial step), allowing the rounding the question asks for;
 *   · it says "the answer / result / gives / equals / so / is" and then the key;
 *   · it quotes a key that is not a small whole number, a number the question does not itself print, as bare prose; or
 *   · for a multiple-choice, expression or other written key, it contains the key's text.
 * A number the question itself prints is never "the answer"; a small whole key (|k| <= 10) counts only in a result position,
 * because it turns up in hints by coincidence as often as by leak.
 */
export function rungGivesAnswer(q, rung) {
  const body = String(rung ?? '');
  if (!body.trim()) return false;
  // The marker's own reading first: a point, pair, complex number, set, interval or expression the rung states, and a number the prompt also prints.
  if (rungStatesAnswer(q, body)) return true;
  const prompt = String(q?.prompt || '').replace(/\$/g, ' ');
  const quoted = n => new RegExp(`(?<![\\d.])${String(n).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(?!\\d|\\.\\d)`).test(prompt);
  const values = answerNumbers(q).filter(v => !quoted(v));
  const hits = (n, v) => Number.isFinite(n) && Math.abs(n - v) <= keySlack(q, v);
  const small = v => Number.isInteger(v) && Math.abs(v) <= 10;
  const closed = t => { const u = t.replace(/\^?\\circ|°|\\%|%|\\text\{[^{}]*\}|\\mathrm\{[^{}]*\}/g, '').replace(/\\ /g, ' ').trim(); if (!u || /[a-zA-Z]/.test(u.replace(/sqrt|pi/g, ''))) return null; try { const n = evalNumeric(normalize(u)); return Number.isFinite(n) ? n : null; } catch { return null; } };
  let leaked = false;
  if (values.length) {
    for (const m of body.matchAll(/\$([^$]+)\$/g)) {
      const sides = texToPlain(m[1].replace(/\\approx|≈/g, '=')).split('=').map(x => x.trim());
      sides.forEach((side, i) => {
        if (leaked) return;
        const n = closed(side);
        if (n === null) return;
        const operation = /[+\-*/^]|sqrt/.test(side.replace(/^-/, '')) && /\d/.test(side);
        const result = i === sides.length - 1 && sides.length > 1;
        for (const v of values) if (hits(n, v) && (small(v) ? (result || (operation && /\d\s*[+\-*/^)]\s*[\d(]|sqrt|\)\s*[+\-*/^]/.test(side))) : (result || operation || sides.length === 1))) leaked = true;
      });
      if (leaked) return true;
    }
    const prose = body.replace(/\$[^$]*\$/g, ' ');
    const spoken = body.replace(/\$/g, ' ').replace(/\\(?:left|right|,|;|!|quad|displaystyle)/g, '');
    for (const v of values) {
      const word = new RegExp(`(?:\\b(?:answer|result|gives|equals|therefore|hence|so|is)\\b[^.\\n=]{0,24}?|(?:^|\\s)=\\s*)(?<![\\d.])${String(v).replace(/[.\-]/g, '\\$&')}(?!\\d|\\.\\d)(?!\\s*[+\\-*/^×(\\\\=])`, 'i');
      if (word.test(spoken)) return true;
    }
    if (!values.every(small) && statesAnswerValue(prose, values.filter(v => !small(v)))) return true;
  }
  return answerTexts(q).some(t => { const a = plain(t); return a.length >= 4 && !/^-?\d+(\.\d+)?$/.test(a) && !plain(prompt).includes(a) && containsAnswer(body, t); });
}

/** The answer as text, in the forms a rung could state it. */
function answerTexts(q) {
  const a = q?.answer || {};
  const out = [];
  const num = v => (Number.isFinite(v) ? String(Number.isInteger(v) ? v : Number(v.toPrecision(12))) : null);
  if (q?.answerType === 'mcq' && Array.isArray(q.mcqOptions)) {
    const o = q.mcqOptions[a.correctIndex];
    out.push(typeof o === 'string' ? o : o?.text);
  }
  out.push(num(a.value), a.canonicalInput, a.expr, ...(Array.isArray(a.values) ? a.values.map(num) : []));
  if (a.simplestFraction) out.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
  return out.filter(v => typeof v === 'string' && v.trim());
}
/** Does a rung's text state this answer? A number as a whole token; other forms by plain containment. */
export function containsAnswer(rung, answer) {
  const r = plain(rung), a = plain(answer);
  if (!a) return false;
  if (/^-?\d+(\.\d+)?$/.test(a)) return new RegExp(`(?<![\\d.])${a.replace(/[.\-]/g, m => `\\${m}`)}(?!\\d|\\.\\d)`).test(r);
  return r.includes(a);
}

/** Text reduced to what a student reads: no TeX markup, spacing or case. */
const plain = t => String(t).replace(/\\(left|right|,|;|!|quad|displaystyle)/g, '').replace(/\\(cdot|times)/g, '*')
  .replace(/[$\\{}\s]/g, '').replace(/²/g, '^2').replace(/³/g, '^3').toLowerCase();
/** Does `b` repeat `a`? One contains the other, or they share a run of at least 70% of the shorter. */
export function repeats(a, b) {
  const x = plain(a), y = plain(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length < 6) return false;
  let best = 0;
  const prev = new Array(l.length + 1).fill(0);
  for (let i = 1; i <= s.length; i += 1) {
    let diag = 0;
    for (let j = 1; j <= l.length; j += 1) {
      const keep = prev[j];
      prev[j] = s[i - 1] === l[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = keep;
    }
  }
  return best >= 0.7 * s.length;
}

/**
 * The four rungs for one question payload. Each rung carries `text` (or null
 * when nothing authored reaches it — `thin`), its cost and the weight left.
 * `withholdAnswer` drops any rung before the solution that states the final answer (see rungGivesAnswer).
 * The solution rung carries no text of its own: the backend serves the
 * verified solution object when it is opened, the same object Reveal serves.
 */
export function buildHintLadder(q, { withholdAnswer = false } = {}) {
  const hints = Array.isArray(q?.hints) ? q.hints.map(text).filter(Boolean) : [];
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  // A bank with no authored hints still has its solution's step headings,
  // which are "what to do first" pointers: step 1's heading is the nudge,
  // step 2's the method. Nothing is invented; a rung with no text is thin.
  // Each rung must add something: a candidate that repeats an earlier rung
  // (the method line and the worked line are often the same sum) is skipped
  // for the next authored text (audit #7). Nothing is invented.
  const shown = [];
  const answers = answerTexts(q);
  const values = answerNumbers(q);
  const final = stepText(steps[steps.length - 1]);
  // A fall-through candidate (beyond the text the rung used before) must not
  // be the final step, must not contain the answer, and is never taken on an
  // MCQ, where a later step can be the keyed option. If no such candidate
  // adds anything, the rung keeps its old text: a rung the student pays for
  // is never emptied by this rule.
  const safe = c => c && !answers.some(a => containsAnswer(c, a)) && !statesAnswerValue(c, values) && !(final && steps.length > 1 && repeats(c, final));
  // A rung that states the final answer, or gives it by one trivial step, is never served (launch QA 26 Nov 2026): the next
  // authored text that does not is taken instead, and with none the rung is thin. It is the worked step that mostly does it,
  // when a one-step question's first step is the whole computation.
  // Opt-in (the Prithagoras server passes it); the other edition's ladders are served exactly as before.
  const gives = c => withholdAnswer && rungGivesAnswer(q, c);
  const pick = (original, fallThrough) => {
    const first = original.find(c => c && !gives(c)) || null;
    if (first && !shown.some(t => repeats(t, first))) { shown.push(first); return first; }
    if (q?.answerType !== 'mcq') {
      for (const c of fallThrough) if (safe(c) && !gives(c) && !shown.some(t => repeats(t, c))) { shown.push(c); return c; }
    }
    if (first) shown.push(first);
    return first;
  };
  const middle = steps.slice(1, -1).map(stepText);
  const nudge = pick([hints[0], text(steps[0]?.h)], []);
  const method = pick([hints[1], text(steps[1]?.h), hints[0] ? text(steps[0]?.h) : null], [text(steps[2]?.h)]);
  const worked = pick([stepText(steps[0]), hints[2]], [hints[2], ...middle, ...hints.slice(3)]);
  // An author-bank question carries the rungs its importer chose (tools/qbank-leak.mjs bankLadder: none states the answer, the worked
  // rung is never the last step). They are used as they are; a rung it has no text for is thin. Generators never set `ladder`.
  const own = q?.ladder && typeof q.ladder === 'object' ? q.ladder : null;
  const texts = own
    ? { nudge: text(own.nudge), method: text(own.method), worked: text(own.worked), solution: null }
    : { nudge, method, worked, solution: null };
  return HINT_RUNGS.map((rung, i) => ({
    rung, level: i + 1, text: texts[rung], thin: rung !== 'solution' && !texts[rung],
    cost: RUNG_COST[rung], weightAfter: markWeightAfter(i + 1), helpUnits: RUNG_HELP_UNITS[rung],
    endsQuestion: rung === 'solution'
  }));
}

/**
 * Whether a payload can offer the ladder at all. A question with no authored
 * hints and no steps has nothing to put on any rung; an exam item never offers
 * one (the exam room refuses the route before this is consulted).
 */
export function ladderAvailable(q) {
  if (!q || q.multipart || q.placement || q.custom) return false;
  // An author-bank question carries the rungs its importer chose, and only those (tools/qbank-leak.mjs bankLadder): with none, no hint is offered
  // (the solution is still there to be revealed). Its steps never stand in for a rung.
  if (q.ladder && typeof q.ladder === 'object') return !!(text(q.ladder.nudge) || text(q.ladder.method) || text(q.ladder.worked));
  return (Array.isArray(q.hints) && q.hints.length > 0) || (Array.isArray(q.steps) && q.steps.length > 0);
}

/**
 * What an attempt row records about the ladder, for the mastery model: the
 * level reached, the rung names, the weight that was left and the help units
 * charged. `null` fields when no rung was opened keep old rows readable.
 */
export function ladderEvidence(level, free = false) {
  const n = rungLevelOf(level);
  return {
    hintLevel: n,
    hintRungs: HINT_RUNGS.slice(0, n),
    markWeight: markWeightAfter(n, free),
    hintHelpUnits: helpUnitsAfter(n)
  };
}

/**
 * A first rung built from the student's own working (audit #13): how many of
 * their lines check out, which line first breaks, and the diagnoser's general
 * fix for that kind of slip. No value of the answer or of the right line is
 * named: the fix text is the rule, not the result. Null when the report has
 * no break to point at (the authored rung is then used, as before).
 */
export function workingHint(report) {
  const lines = Array.isArray(report?.lines) ? report.lines : [];
  const at = Number.isInteger(report?.firstBreak) ? report.firstBreak : -1;
  if (at < 0 || at >= lines.length) return null;
  const good = lines.slice(0, at).filter(l => l?.status === 'ok').length;
  const fix = text(lines[at]?.diagnosis?.fix);
  const lead = good === 0 ? '' : good === 1 ? 'Your first line checks out. ' : `Your first ${good} lines check out. `;
  return `${lead}Look again at line ${at + 1}${fix ? `: ${fix}` : ': compare it carefully with the line above.'}`;
}
