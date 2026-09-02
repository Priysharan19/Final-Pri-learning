// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local-first API — every call is served on-device from IndexedDB.
// Same interface as a network client, zero network. Your data never leaves the iPad.
//
// The Years 7–12 question bank ships as one lazy chunk per year and stream, and
// this layer is the only place that sees a request before the backend runs it,
// so it is where those banks get pulled in. Three sources cover every route that
// can generate: the signed-in profile's scope (learned from the /me and profile
// responses), the subtopic or year named in the request, and — for the rare task
// or retry that points outside both — the bank the engine reports missing.
//
// It is also the production boundary for the in-process API. Every call is
// validated and measured by local/gateway.js before backend.js sees it. The
// diagnostics are deliberately payload-free: timings/statuses are useful for
// support, while names, answers, emails, passwords and handwriting never belong
// in an operational log.
//
// Successful sync-relevant mutations are marked dirty in local/outbox.js. The
// outbox stores only entity ids + operation metadata, never the request/response
// payload. A future authenticated cloud adapter can therefore re-read the
// encrypted current state without this app creating a second plaintext copy.
// ─────────────────────────────────────────────────────────────────────────────
import { dispatch } from './local/backend.js';
import {
  beginRequest, finishRequest, normalizeApiError, validateRequest
} from './local/gateway.js';
import { recordMutation } from './local/outbox.js';
import { restoreBackupSafely } from './local/restoreGuard.js';
import { scopeForYear } from './engine/curriculum.js';
import { indiaGeneratorsForScope, indiaChapter, cleanIndiaTrack } from './engine/indiaProduct.js';
import { loadBanks, loadBanksFor, loadAllBanks } from './engine/generators/index.js';

// ── Bank preloading ──────────────────────────────────────────────────────────

const GENERATING = new Set(['/practice/next', '/exams', '/rush/start', '/match/start']);
const RETRY_PATH = /^\/history\/[^/]+\/retry$/;
const SOLUTION_PATH = /^\/practice\/([^/]+)\/(submit|reveal)$/;
const MAX_BANK_FAULTS = 4;

let scopeReady = Promise.resolve();
let pathway = 'advanced';
let course = 'nsw';
let indiaTrackId = 'cbse';

/** Pull in what a profile practises from. India and Australia have separate scopes. */
function warmScope(year, pw, selectedCourse = course, selectedIndiaTrack = indiaTrackId) {
  const y = Number(year);
  if (!y) return;
  const ids = selectedCourse === 'in'
    ? indiaGeneratorsForScope(cleanIndiaTrack(selectedIndiaTrack, y), y)
    : (() => { const { own, revision } = scopeForYear(y, y >= 11 ? (pw || 'advanced') : 'advanced'); return [...own, ...revision].map(s => s.id); })();
  const job = loadBanksFor(ids);
  scopeReady = Promise.all([scopeReady, job]).then(() => { }, () => { });
}

/** Profile responses carry the year and pathway, so the scope is known from sign-in on. */
function noteUser(result) {
  const u = result?.user;
  if (!u?.year) return;
  pathway = u.pathway || 'advanced';
  course = u.course || 'nsw';
  indiaTrackId = u.indiaTrack || 'cbse';
  warmScope(u.year, pathway, course, indiaTrackId);
}

function teachingSubmission(body) {
  if (!body) return null;
  return {
    answer: body.answer == null ? '' : String(body.answer),
    steps: body.steps == null ? '' : String(body.steps),
    viaInk: Boolean(body.viaInk),
    ink: body.ink ? {
      recognized: body.ink.recognized || body.ink.text || '',
      strokes: Array.isArray(body.ink.strokes) ? body.ink.strokes : [],
    } : null,
    scribble: Array.isArray(body.scribble) ? body.scribble : [],
  };
}

/**
 * Pri Explain stays downstream of marking. The first event carries the student's
 * own attempt so V2 can replay the exact line/strokes that led to a mistake.
 * The second is only emitted once the verified solution exists. Neither event
 * mutates a result, rating, answer or stored ink; both are browser-local only.
 */
function publishTeachingEvidence(path, result, body) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  const match = SOLUTION_PATH.exec(path);
  if (!match) return;
  const questionId = match[1];
  const submission = match[2] === 'submit' ? teachingSubmission(body) : null;

  if (submission) {
    window.dispatchEvent(new CustomEvent('pri:attempt-feedback', {
      detail: {
        questionId,
        submission,
        correct: result?.correct,
        resolved: Boolean(result?.resolved),
        feedback: result?.feedback || '',
        stepReport: result?.stepReport || null,
        diagnosis: result?.diagnosis || result?.stepReport?.diagnosis || null,
        misconception: result?.misconception || null,
      }
    }));
  }

  if (!result?.solution) return;
  window.dispatchEvent(new CustomEvent('pri:worked-solution', {
    detail: {
      questionId,
      solution: result.solution,
      correct: result.correct,
      feedback: result.feedback || '',
      revealed: Boolean(result.revealed),
      stepReport: result.stepReport || null,
      diagnosis: result.diagnosis || result.stepReport?.diagnosis || null,
      misconception: result.misconception || null,
      submission,
    }
  }));
}

function generates(method, path) {
  return method === 'POST' && (GENERATING.has(path) || path === '/profiles/demo' || RETRY_PATH.test(path));
}

async function preload(method, path, body) {
  if (!generates(method, path)) return;
  // The demo seeds a whole fictional history at a fixed year of its own choosing.
  if (path === '/profiles/demo') return loadAllBanks();
  if (body?.subtopic) {
    const chapter = indiaChapter(body.subtopic);
    await loadBanksFor(chapter ? [...new Set((chapter.covers || []).map(c => c.gen))] : [body.subtopic]);
  }
  if (path === '/exams' && body?.year) warmScope(body.year, pathway, course, indiaTrackId);
  await scopeReady;
}

// ── Calls ────────────────────────────────────────────────────────────────────

async function call(method, path, body) {
  const request = beginRequest(method, path);
  try {
    const checked = validateRequest(method, path, body);
    await preload(checked.method, checked.path, checked.body);

    for (let faults = 0; ; faults++) {
      try {
        const result = checked.method === 'POST' && checked.path === '/data/import'
          ? await restoreBackupSafely(dispatch, checked.body)
          : await dispatch(checked.method, checked.path, checked.body);
        if (checked.path === '/me' || checked.path.startsWith('/profiles')) noteUser(result);
        publishTeachingEvidence(checked.path, result, checked.body);

        // The local write has already committed at this point. A damaged/full
        // outbox must never turn that successful write into an API error (and
        // tempt the UI to repeat a non-idempotent action), so queue failure is a
        // diagnostic warning rather than a rejected request.
        let syncWarning = null;
        try { await recordMutation(checked.method, checked.path, result, checked.body); }
        catch { syncWarning = 'SYNC_QUEUE_FAILED'; }

        finishRequest(request, 200, syncWarning);
        return result;
      } catch (err) {
        if (!err?.bankMissing || faults >= MAX_BANK_FAULTS) throw err;
        await loadBanks([err.bank]);
      }
    }
  } catch (error) {
    const err = normalizeApiError(error, request.id);
    finishRequest(request, err.status, err.code);
    throw err;
  }
}

export const api = {
  get: p => call('GET', p),
  post: (p, b = {}) => call('POST', p, b),
  patch: (p, b = {}) => call('PATCH', p, b)
};
