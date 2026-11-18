// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the server calls behind sitting a paper in the app
//
// Thin wrappers over the cloud transport (server/platform/paperAttempts.js).
// The server decides everything: who may sit a paper, what is marked, what the
// totals are. Nothing here holds a key, a criterion or a sample answer.
// ─────────────────────────────────────────────────────────────────────────────
import { cloudDownload, cloudRequest } from '../platform/cloudTransport.js';

const ID = /^[0-9a-f-]{36}$/;
const PAPER = /^[a-z0-9-]{3,60}$/;
const PART = /^q\d{1,2}[a-z]?(-[ivx]+)?$/;
const FIG = /^fig[A-Za-z0-9]{1,100}$/;
const need = (ok, what) => { if (!ok) throw new Error(`paper api: bad ${what}`); };

/** Issue a sitting (the server resumes the open one). `question` sits one question of the paper. */
export function startSitting(paperId, { question = null, fresh = false, timer = null } = {}) {
  need(PAPER.test(paperId), 'paper id');
  return cloudRequest(`/v1/papers/${paperId}/attempts`, { method: 'POST', body: { ...(question ? { question } : {}), ...(fresh ? { fresh: true } : {}), ...(timer ? { timer } : {}) } });
}
export function loadSitting(id) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}`); }
export function saveAnswers(id, body) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}/answers`, { method: 'POST', body }); }
export function keepPart(id, partId, body) {
  need(ID.test(id) && PART.test(partId), 'part');
  return cloudRequest(`/v1/papers/attempts/${id}/parts/${partId}/original`, { method: 'POST', body, timeoutMs: 60_000 });
}
export function submitSitting(id, body) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}/submit`, { method: 'POST', body, timeoutMs: 60_000 }); }
export function loadSolution(id, partId) { need(ID.test(id) && PART.test(partId), 'part'); return cloudRequest(`/v1/papers/attempts/${id}/parts/${partId}/solution`); }
export function loadPlan(id) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}/plan`); }
export function startRetest(id) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}/retest`, { method: 'POST', body: {} }); }
export function loadComparison(id) { need(ID.test(id), 'sitting id'); return cloudRequest(`/v1/papers/attempts/${id}/comparison`); }
export function listSittings() { return cloudRequest('/v1/papers/attempts'); }
export function examStyleFor(subtopic) {
  need(/^[a-z0-9-]{3,40}$/.test(subtopic), 'subtopic');
  return cloudRequest(`/v1/papers/exam-style/${subtopic}`);
}

const figureCache = new Map();
/** A diagram as an object URL (the request carries the session, which an <img> cannot). */
export async function figureUrl(id, name) {
  need(ID.test(id) && FIG.test(name), 'figure');
  const key = `${id}/${name}`;
  if (!figureCache.has(key)) {
    figureCache.set(key, cloudDownload(`/v1/papers/attempts/${id}/figures/${name}`, { type: 'image/svg+xml' })
      .then(bytes => URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' })))
      .catch(error => { figureCache.delete(key); throw error; }));
  }
  return figureCache.get(key);
}

/** Why a call failed, as an i18n key a student can act on. */
export function failureKey(error) {
  const code = error?.code;
  if (code === 'PREMIUM_REQUIRED') return 'paper.err.premium';
  if (code === 'PAPERS_NOT_AVAILABLE') return 'paper.err.unavailable';
  if (code === 'PAPER_ORIGINALS_MISSING') return 'paper.err.keep';
  if (code === 'RECOGNITION_READ_EXPIRED') return 'paper.err.readAgain';
  if (code === 'PAPER_ATTEMPT_SUBMITTED') return 'paper.err.submitted';
  if (code === 'MARKING_BUSY' || code === 'MARKING_COOLDOWN') return 'paper.err.busy';
  return 'paper.err.generic';
}
