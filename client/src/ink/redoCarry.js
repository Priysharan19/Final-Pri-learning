// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · correcting a line on the marked page, then marking again
//
// Owner decision, 19 Nov 2026: the reading is on demand on the marked page, and correcting a line marks the work
// again. A marked question is finished (one authoritative attempt), so "mark again" is the existing Redo: the same
// question issued again by the server. This module carries the student's own page and its corrected reading into
// that new question exactly as an unsent draft would be restored (the ink draft, or the sealed photo draft), and
// remembers that the page is to be marked on arrival. It sends nothing and decides nothing: the new question is
// marked by the server like any other, the page read again only if the server no longer holds the read (same
// picture, no further reading unit), and the corrected line is judged as typed.
// ─────────────────────────────────────────────────────────────────────────────
import { saveInkDraft, flushInkDrafts } from '../local/inkDrafts.js';
import { savePhotoDraft, flushPhotoDrafts } from '../local/photoDrafts.js';

const arrivals = new Set();

/** Put the corrected page where the new question's card restores it from, and mark it to be marked on arrival. */
export async function carryPageIntoQuestion(newQuestionId, { ink = null, photo = null, label = '' } = {}) {
  const id = String(newQuestionId || '');
  if (!id) return false;
  let kept = false;
  if (ink?.strokes?.length) {
    kept = saveInkDraft(id, ink.strokes, { label, ...(ink.reading ? { reading: ink.reading } : {}), ...(typeof ink.answer === 'string' ? { answer: ink.answer } : {}) });
    await flushInkDrafts();
  } else if (photo?.state) {
    kept = savePhotoDraft(id, photo.state, { label });
    await flushPhotoDrafts();
  }
  if (kept) arrivals.add(id);
  return kept;
}

/** Whether a corrected page was carried into this question and is still to be marked. */
export function markOnArrivalPending(questionId) {
  return arrivals.has(String(questionId || ''));
}

/** The page carried into this question is being marked: it is never marked a second time on arrival. */
export function clearMarkOnArrival(questionId) {
  arrivals.delete(String(questionId || ''));
}
