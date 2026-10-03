// Pri Learning · what Practice does when a path has nothing to serve
//
// A practice request can legitimately come back empty: a chapter or dot point
// with no authored form at this track, a track scope with nothing in it, or a
// reply that arrives without a question. Before this, each of those reached the
// student as a raw backend sentence above a "Try again" button that re-sent the
// identical request and got the identical refusal — a loop — and a reply with
// no question crashed the card on `serve.question.pyq`. These helpers turn all
// of them into one deliberate empty state the page renders, with a structured,
// privacy-safe signal for operations.

/** Backend refusals that mean "this path has no content", not "something broke". */
export const CONTENT_EMPTY_CODES = Object.freeze([
  'INDIA_TARGET_UNCOVERED',
  'INDIA_TRACK_UNCOVERED',
  'INDIA_TOPIC_NOT_FOUND',
  'CONTENT_EMPTY'
]);

export function isContentEmpty(code) {
  return CONTENT_EMPTY_CODES.includes(String(code || ''));
}

/** A /practice/next reply the card can render: it has a question with an id. */
export function servable(reply) {
  const q = reply?.question;
  return !!(q && typeof q === 'object' && q.id && (q.prompt || q.stem || (Array.isArray(q.parts) && q.parts.length)));
}

/**
 * The telemetry event for an empty path. Low-cardinality fields only — the
 * code, the surface, the track and class — never a chapter name or prompt.
 */
export function contentEmptySignal({ code, track = null, grade = null, surface = 'practice' } = {}) {
  return {
    type: 'api-failure',
    options: {
      surface,
      metadata: {
        code: isContentEmpty(code) ? String(code) : 'CONTENT_EMPTY',
        scope: 'content-empty',
        track: track ? String(track).slice(0, 30) : null,
        grade: Number.isFinite(Number(grade)) ? Number(grade) : null
      }
    }
  };
}
