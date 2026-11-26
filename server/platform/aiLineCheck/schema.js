// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI line check · the closed answer schema and its strict parser
//
// The model answers in this schema and no other. `parseResponse` keeps an item
// only when every field is exactly the right type and the item has no key
// outside the schema; anything else is DISCARDED (the line then shows what it
// shows today). Nothing here is trusted as a verdict: the parsed items are
// proposals for display, and the engine veto (veto.js) runs before any is shown.
// ─────────────────────────────────────────────────────────────────────────────
import { CLAIM_SCHEMA, guardClaim, isVerbatim, unparseable } from '../lineInterpreter/claims.js';

export const VERDICTS = Object.freeze(['correct', 'incorrect', 'cannot_tell']);
export const MAX_LINES = 40;
export const MAX_COMMENT_CHARS = 200;
export const MAX_SPAN_CHARS = 80;

const ITEM_KEYS = Object.freeze(['index', 'verdict', 'comment', 'wrong_span', 'corrected_rhs', 'claim']);

export const RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: {
      type: 'array', maxItems: MAX_LINES,
      items: {
        type: 'object', additionalProperties: false, required: [...ITEM_KEYS],
        properties: {
          index: { type: 'integer', minimum: 0, maximum: MAX_LINES - 1 },
          verdict: { type: 'string', enum: [...VERDICTS] },
          comment: { type: 'string', maxLength: MAX_COMMENT_CHARS },
          wrong_span: { type: 'string', maxLength: MAX_SPAN_CHARS },
          corrected_rhs: { type: 'string', maxLength: MAX_SPAN_CHARS },
          claim: CLAIM_SCHEMA
        }
      }
    }
  }
});

const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Parse the model's JSON text against the schema. `asked` is the set of line
 * indices the server asked about; `lines` the working's lines (for the verbatim
 * guard). Returns Map(index -> { verdict, comment, wrongSpan, correctedRhs, claim }).
 * Never throws. An item that is not exactly the schema, names a line that was not
 * asked, repeats a line, or has an unknown verdict is dropped whole.
 */
export function parseResponse(text, { asked, lines }) {
  const out = new Map();
  let parsed;
  try { parsed = JSON.parse(String(text ?? '')); } catch { return out; }
  if (!isObject(parsed) || !Array.isArray(parsed.lines) || Object.keys(parsed).length !== 1) return out;
  const allowed = new Set(asked);
  for (const item of parsed.lines.slice(0, MAX_LINES)) {
    if (!isObject(item)) continue;
    const keys = Object.keys(item);
    if (keys.length !== ITEM_KEYS.length || !ITEM_KEYS.every(k => keys.includes(k))) continue;
    if (!Number.isInteger(item.index) || !allowed.has(item.index) || out.has(item.index)) continue;
    if (!VERDICTS.includes(item.verdict)) continue;
    if (typeof item.comment !== 'string' || typeof item.wrong_span !== 'string' || typeof item.corrected_rhs !== 'string') continue;
    const lineText = String(lines[item.index] ?? '');
    const wrongSpan = item.verdict === 'incorrect' && item.wrong_span && item.wrong_span.length <= MAX_SPAN_CHARS && isVerbatim(item.wrong_span, lineText) ? item.wrong_span : '';
    const correctedRhs = item.verdict === 'incorrect' && item.corrected_rhs.length <= MAX_SPAN_CHARS ? item.corrected_rhs.trim() : '';
    // The restated claim goes through the interpreter's own guard (verbatim tokens, whole-line coverage); a refused one is `unparseable`.
    const claim = isObject(item.claim) ? guardClaim(item.claim, lineText) : unparseable('not-an-object');
    out.set(item.index, { verdict: item.verdict, comment: item.comment, wrongSpan, correctedRhs, claim });
  }
  return out;
}
