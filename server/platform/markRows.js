// Pri Learning — step-mark rows for a resolved practice reply (display only).
//
// The deterministic engine has already decided `marksEarned` out of
// `marksPossible` (server/platform/practice.js, markerOps.js). These rows only
// SAY that decision in the shape of a CBSE marking scheme — one row per
// authored key step of the question, the last row the final answer — so the
// student can see which part of the question the marks sit on. They never
// decide, raise or lower a mark:
//
//   · the rows are built from the same facts the mark came from (the
//     question's key steps, `marksPossible`, `marksEarned`, `correct`) and
//     their earned column sums to `marksEarned` by construction — the reply
//     is refused rows if it would not (fail closed);
//   · method credit is shown in the order an examiner reads down the page:
//     the first `marksEarned` working rows, never the answer row, for a wrong
//     answer (the server caps a wrong answer at marksPossible − 1);
//   · authored step headings label the rows ONLY when the answer is correct
//     (every row earned, so naming them claims nothing). For a wrong answer
//     the engine's method credit counts verified lines without matching them
//     to authored steps, so the rows are neutral numbered method marks — a
//     row never says which named step the student did or missed. Headings
//     are engine content (English by policy, like the question and solution);
//     a heading that names nothing ("Step 2") becomes a numbered row.
//
import { isSchemeStep } from './markerOps.js';

// Research decision D-R4-CBSE-STEP-MARKS-01 (issue #178, accepted): a generic
// split is Pri practice feedback, not an official CBSE scheme, and is labelled
// so (`scheme: 'pri-practice-cbse-style'`). Whole marks only: the engine has
// no half-mark rubric, so this never shows ½. Pure: no store, clock or secret.

const NAMELESS = /^\s*(step\s*\d*|working|\d+)\s*[.:)]?\s*$/i;

const heading = step => String(step?.h ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

export function markRowsFor(q, { marksEarned, marksPossible, correct, creditedMarks = null }) {
  const possible = Number(marksPossible);
  const earned = Number(marksEarned);
  if (!Number.isInteger(possible) || possible < 1 || !Number.isInteger(earned) || earned < 0 || earned > possible) return null;
  if (!correct && earned > possible - 1) return null;

  const keySteps = (q?.steps || []).filter(isSchemeStep);
  // One row per mark. The final answer is always the last row and worth one
  // mark; the working steps before it share the rest, earlier ones grouped
  // when there are more steps than marks.
  const working = keySteps.slice(0, -1).map((s, i) => ({ label: NAMELESS.test(heading(s)) || !heading(s) ? null : heading(s), n: i + 1 }));
  const rowsWanted = possible - 1;
  const rows = [];
  if (rowsWanted > 0) {
    const per = Math.max(1, Math.ceil(working.length / rowsWanted));
    for (let i = 0; i < rowsWanted; i += 1) {
      const group = working.slice(i * per, (i + 1) * per);
      const named = group.map(g => g.label).filter(Boolean);
      rows.push({ kind: 'working', label: correct && named.length ? named.join(', ') : null, step: i + 1, outOf: 1 });
    }
  }
  rows.push({ kind: 'answer', label: null, step: possible, outOf: 1 });

  // Credit, in reading order.
  let budget = correct ? possible : earned;
  for (const row of rows) {
    if (row.kind === 'answer') { row.earned = correct ? 1 : 0; continue; }
    row.earned = correct || budget > 0 ? 1 : 0;
    if (!correct) budget -= row.earned;
  }
  const sum = rows.reduce((s, r) => s + r.earned, 0);
  const total = rows.reduce((s, r) => s + r.outOf, 0);
  if (sum !== earned || total !== possible) return null; // never contradict the mark
  // The rows are the engine's mark before any hint charge; when hints lowered
  // what was credited, the reply says so beside them.
  const credited = Number(creditedMarks);
  const charged = Number.isFinite(credited) && credited >= 0 && credited < earned;
  return { scheme: 'pri-practice-cbse-style', rows, ...(charged ? { creditedAfterHints: credited } : {}) };
}
