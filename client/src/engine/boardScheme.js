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
//     working line that stepCheck (checker.js) verifies as `ok`; the final
//     answer only by checkAnswer. No model output — no AI reading, no tutor
//     reply, no cloud transcription verdict — is an input here. Lines are
//     ticked down the page in order, the way an examiner ticks value points.
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

const HALF = x => Math.round(x * 2) === x * 2;
const text = v => String(v ?? '').trim();

/** Problems with a transcribed scheme for a question worth `marks`; [] when it is sound. */
export function boardSchemeProblems(scheme, marks) {
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
 * Marks against the Board's transcribed scheme.
 *
 *   scheme     the record's boardScheme
 *   okLines    how many of the student's working lines stepCheck verified `ok`
 *              (counted from the engine's report — never from a model)
 *   correct    checkAnswer's verdict on the final answer
 *
 * Returns { awarded, total, method, groups: [{ marks, earned, points }] } with
 * whole numbers throughout. `method` is the marks earned before the answer group.
 */
export function awardBoardScheme({ scheme, okLines = 0, correct = false }) {
  const groups = wholeMarkGroups(scheme);
  const workingPoints = scheme.length - 1;
  const ticked = Math.max(0, Math.min(workingPoints, Math.floor(Number(okLines) || 0)));
  const rows = [];
  let method = 0, awarded = 0;
  for (const g of groups) {
    const working = g.points.filter(j => !scheme[j].answer);
    const allTicked = working.every(j => j < ticked);
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
