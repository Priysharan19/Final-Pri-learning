// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the local backend's route for a student's own tutor question
//
//   POST /practice/:id/tutor/ask   { message, history?, locale?, work?, turnId? }
//
// The local practice route decides everything that matters, as it does for the
// three levels: the row must be a practice row (an exam row is refused here
// and never reaches the network), the student must have opened level 1 first
// (that is where help is charged like a hint; a conversation costs no further
// credit), and the verified solution is added here — the UI never supplies it
// and never receives it. Only then is the server asked, streamed where it can
// be (conversation.js), and each released sentence is published to the panel
// as a `pri:tutor-delta` window event carrying the caller's `turnId`.
//
// The reply is { message, source: 'tutor' | 'deterministic', code, history }:
// when the server cannot help — offline, refused, guarded, broken — the
// message is the question's own authored hint for this turn, and `code` says
// why, so the panel can name it. Nothing here ever shows the answer.
//
// Built with its dependencies injected so backend.js registers it in one line
// and this file is tested on its own (client/test/tutor-ui-check.mjs).
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_TURN_CHARS, cleanTurnText, streamTutorTurn, trimHistory } from './conversation.js';
import { tutorDisabledError, tutorFeatureEnabled } from './flag.js';

export const TUTOR_DELTA_EVENT = 'pri:tutor-delta';

const fail = (message, status, code, extra = {}) => Object.assign(new Error(message), { status, code, ...extra });

function publishDelta(turnId, text) {
  if (!turnId || typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  try { globalThis.dispatchEvent(new CustomEvent(TUTOR_DELTA_EVENT, { detail: { turnId, text } })); }
  catch { /* the final message still arrives in the response */ }
}

/** The authored hint for this turn of the exchange, then the last; or null. */
export function authoredTurnHint(q, history) {
  const hints = Array.isArray(q?.hints) ? q.hints.filter(h => typeof h === 'string' && h.trim()) : [];
  if (!hints.length) return null;
  const turn = (history || []).filter(t => t.role === 'tutor').length;
  return hints[Math.min(turn, hints.length - 1)];
}

/**
 * @param deps the backend's own helpers: requireProfile(), get(store, id),
 *   assertPracticeRow(row), tutorRequest(p, row, q, solution, opts),
 *   tutorWork(q, raw), displayAnswer(q), sanitizeText(value, max); plus, for
 *   tests, streamTurn (conversation.js streamTutorTurn), emit (publishDelta)
 *   and enabled (the feature flag).
 */
export function createTutorAskRoute({
  requireProfile, get, assertPracticeRow, tutorRequest, tutorWork, displayAnswer, sanitizeText,
  streamTurn = streamTutorTurn, emit = publishDelta, enabled = tutorFeatureEnabled
}) {
  return async function tutorAsk(body, params) {
    if (!enabled()) throw tutorDisabledError();
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw fail('Question not found', 404);
    assertPracticeRow(row);
    if (row.discardedAt) throw fail('Question was skipped', 409, 'QUESTION_DISCARDED');
    if (row.answered) throw fail('Already answered', 409, 'ALREADY_RESOLVED');
    const used = Math.max(0, Math.min(3, Number(row.tutorLevel) || 0));
    if (used < 1) throw fail('Open the first level of help before asking your own question.', 409, 'TUTOR_LEVEL_ORDER', { next: 1 });
    if (used >= 3) throw fail('The walkthrough has shown the whole solution.', 409, 'ALREADY_RESOLVED');

    const message = cleanTurnText(body?.message);
    if (!message) throw fail(`Type a question of up to ${MAX_TURN_CHARS} characters.`, 400, 'TUTOR_MESSAGE_INVALID');
    const history = trimHistory(body?.history);
    const turnId = typeof body?.turnId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(body.turnId) ? body.turnId : null;

    const q = row.payload;
    const solution = { steps: q.steps || [], answerText: displayAnswer(q), solutionText: q.solutionText };
    const work = tutorWork(q, body?.work);
    const base = tutorRequest(p, row, q, solution, { level: 'ask', locale: body?.locale, work });
    const authored = authoredTurnHint(q, history);
    if (!base) {
      return { message: authored, source: 'deterministic', code: 'TUTOR_UNGROUNDED', history: nextHistory(history, message, authored) };
    }
    const request = { ...base, message, history };

    const outcome = await streamTurn(request, { onDelta: text => emit(turnId, text) });
    const reply = typeof outcome?.tutor?.message === 'string' ? sanitizeText(outcome.tutor.message, 900) : '';
    const fromModel = outcome?.tutor?.source === 'model' && reply.trim().length > 0;
    const text = fromModel ? reply : (reply || authored);
    return {
      message: text,
      source: fromModel ? 'tutor' : 'deterministic',
      streamed: !!outcome?.streamed,
      // Why the deterministic text is showing, as a code the UI can name.
      code: fromModel ? null : (outcome?.error?.code || outcome?.tutor?.reason || null),
      history: nextHistory(history, message, text)
    };
  };
}

/** The history the panel sends next time: this exchange appended, trimmed. */
export function nextHistory(history, studentText, tutorText) {
  return trimHistory([...(history || []), { role: 'student', text: studentText }, ...(tutorText ? [{ role: 'tutor', text: tutorText }] : [])]);
}
