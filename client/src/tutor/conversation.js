// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one conversational turn with the tutor, streamed when it can be
//
// The student types a question in their own words; the server answers it under
// the same rules as every other tutor reply — grounded in the verified
// solution, Socratic, never the answer — and releases the words one guarded
// sentence at a time (server/platform/tutor.js, POST /v1/tutor/stream).
//
// This module is the device's side of that turn:
//
//   · it streams when it can (browser, server with /v1/tutor/stream) and calls
//     onDelta for every released sentence;
//   · it falls back to the request/response route /v1/tutor/help when it
//     cannot — inside a native shell, or when an older server answers 404 —
//     so a shell in the compatibility window (release-policy CP-11) still
//     converses, just without the progressive text;
//   · it never throws: offline, disabled, refused or broken all resolve to
//     { error: { code } }, and the local route serves the authored hint.
//
// What it sends is exactly the grounded request the local backend built
// (backend.js tutorRequest + askRoute.js): the student's own words and work,
// never a name, email or profile id.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { tutorFeatureEnabled } from './flag.js';

export const MAX_TURN_CHARS = 600;
export const MAX_HISTORY_TURNS = 6;
const STREAM_TIMEOUT_MS = 45_000;
const HELP_TIMEOUT_MS = 25_000;
// C0/C1 control characters and DEL; tab and newline collapse with the rest of the whitespace.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

let override = null;

/** Tests replace the transport ({ tutorStream, tutorHelp }); production never calls this. */
export function setConversationTransportForTests(transport) {
  override = transport && typeof transport === 'object' ? transport : null;
}

/** A student's typed question as the server will accept it: clean, single-spaced, bounded. */
export function cleanTurnText(text) {
  return String(text ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TURN_CHARS);
}

/** The exchange the next turn carries: the last MAX_HISTORY_TURNS turns, cleaned. */
export function trimHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter(turn => turn && (turn.role === 'student' || turn.role === 'tutor'))
    .map(turn => ({ role: turn.role, text: cleanTurnText(turn.text) }))
    .filter(turn => turn.text)
    .slice(-MAX_HISTORY_TURNS);
}

const FALLBACK_TO_HELP = new Set(['TUTOR_STREAM_UNSUPPORTED']);

function failure(error) {
  const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
  return { error: { code: timedOut ? 'TUTOR_TIMEOUT' : String(error?.code || 'TUTOR_FAILED').slice(0, 60), status: Number(error?.status) || null } };
}

/**
 * Ask the server one turn. Resolves to { tutor, streamed } — `tutor` is the
 * server's reply object (message, source 'model' | 'fallback', reason, cached)
 * — or { error: { code } }. `onDelta(text)` receives each released sentence of
 * a streamed reply, in order; a fallback or error after some text means the
 * caller shows the final `tutor.message` instead of what streamed.
 */
export async function streamTutorTurn(request, { onDelta = null, signal = null } = {}) {
  if (!tutorFeatureEnabled()) return { error: { code: 'TUTOR_DISABLED' } };
  const transport = override || cloud;
  try {
    if (!override && !cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    let streamed = await streamOnce(transport, request, { onDelta, signal });
    if (streamed) return streamed;
    const response = await transport.tutorHelp(request, { signal, timeoutMs: HELP_TIMEOUT_MS });
    if (!response?.tutor || typeof response.tutor.message !== 'string') return { error: { code: 'TUTOR_MALFORMED' } };
    return { tutor: response.tutor, streamed: false };
  } catch (error) {
    return failure(error);
  }
}

/** The streamed attempt: a result, or null when this transport/server cannot stream. */
async function streamOnce(transport, request, { onDelta, signal }) {
  if (typeof transport.tutorStream !== 'function') return null;
  let done = null;
  let fallback = null;
  let failed = null;
  let released = '';
  try {
    await transport.tutorStream(request, {
      signal,
      timeoutMs: STREAM_TIMEOUT_MS,
      onEvent: ({ event, data }) => {
        if (done || fallback || failed) return;
        if (event === 'delta' && typeof data?.text === 'string') {
          released += data.text;
          onDelta?.(data.text);
        } else if (event === 'done' && typeof data?.message === 'string') {
          done = data;
        } else if (event === 'fallback' && typeof data?.message === 'string') {
          fallback = data;
        } else if (event === 'error') {
          failed = { code: String(data?.code || 'TUTOR_FAILED').slice(0, 60), retryable: !!data?.retryable };
        }
      }
    });
  } catch (error) {
    if (FALLBACK_TO_HELP.has(error?.code)) return null;
    throw error;
  }
  if (done) return { tutor: done, streamed: true };
  if (fallback) return { tutor: fallback, streamed: true };
  if (failed) return { error: failed };
  // The stream closed without a verdict: a partial reply is not shown as whole.
  return { error: { code: released ? 'TUTOR_STREAM_INCOMPLETE' : 'TUTOR_EMPTY' } };
}
