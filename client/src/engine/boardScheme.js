// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Board's own marking scheme, carried with a past question
//
// A CBSE Section B–E question is marked per value point: the official Marking
// Scheme prints each point beside its marks (½, 1, ½ …). A past-paper record of
// such a question carries those points as `boardScheme`, transcribed from the
// Board's document, and this module is the ONLY thing that turns them into
// marks. The rules are the contract:
//
//   · The deterministic engine decides every mark. A point is earned only by a
//     working line that stepCheck (checker.js) verifies as `ok` AND that is
//     that point's own line as written (writtenAsLine); the final answer only
//     by checkAnswer. No model output — no AI reading, no tutor reply, no
//     cloud transcription verdict — is an input here.
//
//   · Lines and points match one-to-one and in order (matchBoardPoints): each
//     line earns at most one point, each point is earned by at most one line,
//     and a point is matched only by a line below the line that matched the
//     point before it. Counting verified lines is NOT matching them: `x = 3`
//     written four times verifies four times and is still one line, and it is
//     not the Board's working (D25 review of #844). A line that only states the
//     final value never earns a working point, and a scheme may not name one.
//
//   · Every non-answer point must carry the line that earns it, and the record
//     is refused unless that line verifies under the record's own `stepcheck`
//     metadata (india-board-scheme-check.mjs proves it for every record). A
//     point the engine cannot verify — "∠OAP = 90° (tangent ⟂ radius)", a
//     reason in words, a construction — cannot be carried: the record stays out
//     of the archive rather than be marked by a rule other than the Board's.
//
//   · Marks are whole numbers everywhere else in Pri (attempt rows, exam
//     totals). The Board's ½ points are therefore grouped, in order, into
//     whole-mark groups: a group is earned only when EVERY point in it is. A
//     student can lose a ½ against the Board, never gain one. The transcribed
//     points, with their ½s, are still what the card shows.
//
//   · The last group holds the final answer and is earned only when checkAnswer
//     credits the final answer.
// ─────────────────────────────────────────────────────────────────────────────

import { writtenAsLine, statesOnlyFinalAnswer } from './checker.js';

const HALF = x => Math.round(x * 2) === x * 2;
const text = v => String(v ?? '').trim();

/** Problems with a transcribed scheme for a question worth `marks`; [] when it is sound. */
export function boardSchemeProblems(scheme, marks, meta = null) {
  const out = [];
  if (!Number.isInteger(marks) || marks < 2 || marks > 6) out.push(`marks ${JSON.stringify(marks)} is not a whole number from 2 to 6`);
  if (!Array.isArray(scheme) || scheme.length < 2) { out.push('the scheme needs at least one working point and the answer point'); return out; }
  scheme.forEach((p, i) => {
    if (!(Number(p?.marks) > 0) || !HALF(Number(p.marks))) out.push(`point ${i + 1} carries ${JSON.stringify(p?.marks)}, not a positive multiple of ½`);
    if (!text(p?.point)) out.push(`point ${i + 1} has no transcribed value point`);
    const last = i === scheme.length - 1;
    if (last && p?.answer !== true) out.push('the last point must be the final answer (answer: true)');
    if (!last && p?.answer === true) out.push(`point ${i + 1} is marked as the answer but is not last`);
    if (!last && !text(p?.line)) out.push(`point ${i + 1} has no line the deterministic checker can verify`);
    if (!last && meta && text(p?.line) && statesOnlyFinalAnswer(p.line, meta)) out.push(`point ${i + 1}'s line only states the final value, which is the answer point's to earn`);
  });
  // Two working points with the same line would let one written line stand for
  // both, or two copies of it earn twice: refused.
  scheme.forEach((p, i) => {
    if (p?.answer === true || !text(p?.line)) return;
    for (let j = 0; j < i; j++) {
      const o = scheme[j];
      if (o?.answer !== true && text(o?.line) && (text(o.line) === text(p.line) || writtenAsLine(p.line, o.line))) out.push(`points ${j + 1} and ${i + 1} share the line ${JSON.stringify(text(p.line))}`);
    }
  });
  const total = scheme.reduce((s, p) => s + Number(p?.marks || 0), 0);
  if (Math.abs(total - marks) > 1e-9) out.push(`the points add to ${total}, not ${marks}`);
  return out;
}

/**
 * The scheme in whole-mark groups, in order. A group closes as soon as the
 * running total is a whole number, so ½ + ½ is one group and 1 is its own.
 */
export function wholeMarkGroups(scheme) {
  const groups = [];
  let current = [], sum = 0;
  scheme.forEach((p, i) => {
    current.push(i); sum += Number(p.marks);
    if (Number.isInteger(Math.round(sum * 2) / 2) && Math.abs(sum - Math.round(sum)) < 1e-9) {
      groups.push(Object.freeze({ points: Object.freeze(current), marks: Math.round(sum), answer: current.some(j => scheme[j].answer === true) }));
      current = []; sum = 0;
    }
  });
  return Object.freeze(groups);
}

/**
 * Which working points the student's lines earn, matched one-to-one and in order.
 *
 *   scheme   the record's boardScheme
 *   lines    the engine's step report lines, [{ status, text }], in page order
 *   meta     the record's stepcheck metadata
 *
 * Returns a boolean per scheme point (the answer point is always false here:
 * checkAnswer decides it). A line is considered only when its status is exactly
 * `ok`; it then ticks the first not-yet-ticked working point, below the last
 * one ticked, whose line it is as written. It is used up either way.
 */
export function matchBoardPoints({ scheme, lines = [], meta = null }) {
  const ticked = scheme.map(() => false);
  let next = 0;
  for (const l of Array.isArray(lines) ? lines : []) {
    if (l?.status !== 'ok') continue;
    const written = text(l.text);
    if (!written || (meta && statesOnlyFinalAnswer(written, meta))) continue;
    for (let j = next; j < scheme.length; j++) {
      if (scheme[j].answer === true) break;
      if (writtenAsLine(written, scheme[j].line)) { ticked[j] = true; next = j + 1; break; }
    }
  }
  return Object.freeze(ticked);
}

/**
 * Marks against the Board's transcribed scheme.
 *
 *   scheme     the record's boardScheme
 *   ticked     matchBoardPoints' verdict per point (never a count of lines)
 *   correct    checkAnswer's verdict on the final answer
 *
 * Returns { awarded, total, method, groups: [{ marks, earned, points }] } with
 * whole numbers throughout. `method` is the marks earned before the answer group.
 */
export function awardBoardScheme({ scheme, ticked, correct = false, ...rest }) {
  if ('okLines' in rest) throw new TypeError('awardBoardScheme takes the points matchBoardPoints ticked, not a count of verified lines');
  if (!Array.isArray(ticked) || ticked.length !== scheme.length) throw new TypeError('awardBoardScheme needs one ticked verdict per scheme point');
  const groups = wholeMarkGroups(scheme);
  const rows = [];
  let method = 0, awarded = 0;
  for (const g of groups) {
    const working = g.points.filter(j => !scheme[j].answer);
    const allTicked = working.every(j => ticked[j] === true);
    const earned = g.answer ? (correct && allTicked ? g.marks : 0) : (allTicked ? g.marks : 0);
    if (!g.answer) method += earned;
    awarded += earned;
    rows.push(Object.freeze({ marks: g.marks, earned, points: g.points.map(j => text(scheme[j].point)) }));
  }
  // A correct final answer earns the answer group even when the working shown
  // does not reach it: the Board gives the answer mark for a correct answer.
  // It never lifts a working group the engine did not verify.
  if (correct) {
    const last = rows[rows.length - 1];
    if (last.earned === 0) {
      const g = groups[groups.length - 1];
      const answerOnly = g.points.filter(j => scheme[j].answer).reduce((s, j) => s + Number(scheme[j].marks), 0);
      if (Number.isInteger(answerOnly)) { rows[rows.length - 1] = Object.freeze({ ...last, earned: answerOnly }); awarded += answerOnly; }
    }
  }
  const total = groups.reduce((s, g) => s + g.marks, 0);
  return Object.freeze({ awarded, total, method, groups: Object.freeze(rows) });
}
