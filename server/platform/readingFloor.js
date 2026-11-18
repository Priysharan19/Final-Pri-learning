// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the reading floor: which read lines the engine may judge
//
// Owner decision, 19 Nov 2026: the student no longer confirms the reading before marking. In its
// place, ONE rule (ADR-0001 amendment of 19 Nov 2026): a line the reader was not sure of, read below
// the existing confidence floor (PRI_HANDWRITING_CONFIDENCE_FLOOR, never lowered), is NEVER judged:
// it earns no tick and no cross, and it never feeds the final answer. A final answer that is below
// the floor, or absent, is not marked wrong; the student is told Pri could not read it.
//
// Pure: no I/O, no clock. The server will call this on the kept read of the submitted picture; a line
// the student has edited is their own text and is no longer a read line, so it is judged as typed.
// STATUS: this module and its test are the decided rule. Wiring it into the submit route, the marked
// page and the removal of the confirm step are NOT done in this commit (see the ADR amendment).
// ─────────────────────────────────────────────────────────────────────────────

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/** A line is judgeable only when the reader gave a confidence at or above the floor and the line is not blank. */
export const lineJudgeable = (line, floor) => {
  const c = Number(line?.confidence);
  return norm(line?.text) !== '' && Number.isFinite(c) && Number.isFinite(Number(floor)) && c >= Number(floor) && line?.uncertain !== true;
};

/**
 * @param readLines  the kept read: [{ text, confidence, uncertain }] in page order
 * @param floor      the reader's confidence floor for that read
 * @param steps      the working lines the student submitted (strings), in page order
 * @param answer     the final-answer line the submission names (string), or ''
 * @returns {{ judged: string[], excluded: number[], answer: string, answerUnreadable: boolean, unconfirmed: true }}
 *   `judged`   the submitted lines the engine may judge (a submitted line equal to a below-floor read line is dropped)
 *   `excluded` 0-based indexes, in the submitted working, of the lines dropped
 *   `answerUnreadable`  true when the final answer is the text of a below-floor read line, or is absent
 *   `unconfirmed`  always true: nothing here was confirmed by the student; the attempt records it
 */
export function applyReadingFloor({ readLines, floor, steps, answer }) {
  const read = Array.isArray(readLines) ? readLines : [];
  const lines = (Array.isArray(steps) ? steps : []).map(norm);
  const below = new Set(read.filter(l => !lineJudgeable(l, floor)).map(l => norm(l?.text)).filter(Boolean));
  const above = new Set(read.filter(l => lineJudgeable(l, floor)).map(l => norm(l.text)));
  const judged = [], excluded = [];
  lines.forEach((text, i) => {
    // A text the reader also returned at or above the floor is judgeable; a text only ever read below it is not.
    if (text && below.has(text) && !above.has(text)) excluded.push(i);
    else if (text) judged.push(text);
  });
  const given = norm(answer);
  const answerUnreadable = given === '' || (below.has(given) && !above.has(given));
  return { judged, excluded, answer: answerUnreadable ? '' : given, answerUnreadable, unconfirmed: true };
}
