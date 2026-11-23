// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the line report says, as facts for a sentence
//
// The marked page and the "What went wrong" panel say the same thing about a page: where the working is correct up to,
// where the first error is and what the engine says about it. Both read it from the line report (the annotated-working
// model), never from a second opinion. A line the engine did not check is neither right nor wrong here.
// Pure; no marks, no verdicts of its own.
// ─────────────────────────────────────────────────────────────────────────────
import { buildAnnotatedWorking } from './annotatedWorkingModel.js';
import { commentFor } from '../engine/lineCommentary.js';
import { dollarsBalanced } from '../engine/commentTex.js';
import { ruleLabel } from './AnnotatedWorking.jsx';

/** The engine's one sentence about the first error: its first sentence only, so it is one clear line. */
export const firstSentence = text => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^.*?[.!?](?=\s+[A-Z]|$)/);
  const cut = (m ? m[0] : clean).trim();
  return dollarsBalanced(cut) ? cut : clean;
};

/**
 * @returns {null | { right: number, upTo: number|null, first: null | { n: number, comment: string }}}
 *   null when the line report has neither a tick nor a cross. `upTo` is set only when every line above the cross is a tick or a condition.
 */
export function lineReportFacts(input, { language = 'en', t = k => k } = {}) {
  let model = null;
  try { model = input ? buildAnnotatedWorking(input) : null; } catch { model = null; }
  const cards = Array.isArray(model?.cards) ? model.cards : [];
  const right = cards.filter(c => c.status === 'checked').length;
  const first = cards.find(c => c.status === 'first-error') || null;
  if (!right && !first) return null;
  let comment = '';
  if (first) {
    const said = commentFor(first, { language, ruleLabel: r => ruleLabel(r, t) });
    comment = said ? said.text : firstSentence(first.diagnosis?.message || first.diagnosis?.title || first.note || '');
  }
  const clean = first ? cards.filter(c => c.n < first.n).every(c => c.status === 'checked' || c.status === 'condition') : false;
  return { right, upTo: first && first.n > 1 && clean ? first.n - 1 : null, first: first ? { n: first.n, comment } : null };
}
