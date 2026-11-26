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

/** `value` stands in `text` as a whole token, not inside a longer number or word: "= 12 m/s" has 12; "= 120", "x12" and "1.12" do not. */
const statesValue = (text, value) => {
  const t = String(text);
  for (let i = t.indexOf(value); i >= 0; i = t.indexOf(value, i + 1)) {
    const before = t[i - 1] ?? ' ', after = t.slice(i + value.length, i + value.length + 2);
    if (/[\p{L}\p{N}._]/u.test(before) || /^\p{N}|^[.,]\p{N}/u.test(after)) continue;
    return true;
  }
  return false;
};

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
 * @param answerTyped true when the student typed that final answer themselves (never read from the page)
 * @returns {{ judged: string[], excluded: number[], answer: string, answerUnreadable: boolean, unconfirmed: true }}
 *   `judged`   the submitted lines the engine may judge (a submitted line equal to a below-floor read line is dropped)
 *   `excluded` 0-based indexes, in the submitted working, of the lines dropped
 *   `answerUnreadable`  true when the final answer is the text of a below-floor read line, or is absent
 *   `unconfirmed`  always true: nothing here was confirmed by the student; the attempt records it
 */
export function applyReadingFloor({ readLines, floor, steps, answer, answerTyped = false }) {
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
  // `answerTyped`: the student typed the final answer themselves (the box that asks for it when Pri could not read
  // the line). It is their own text even when it equals the text of a below-floor line; it is never read from the page.
  // An absent answer is unreadable either way.
  // A number that is also the text of an unrelated doubtful line (a tick mark "12" on a graph, read below the floor) is still
  // the answer when a line the reader WAS sure of states it as a value of its own ("The maximum velocity is 12 m/s"). The
  // answer is unreadable only when nothing the reader was sure of says it.
  const statedAbove = [...above].some(text => text !== given && statesValue(text, given));
  const answerUnreadable = given === '' || (answerTyped !== true && below.has(given) && !above.has(given) && !statedAbove);
  return { judged, excluded, answer: answerUnreadable ? '' : given, answerUnreadable, unconfirmed: true };
}
