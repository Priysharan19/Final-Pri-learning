// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Practise this" — photo of a question → fresh practice
//
// A student photographs a question from a textbook or worksheet. The server
// (/v1/question-photo/identify) reads it and proposes an India-syllabus chapter
// and skill. This module turns that into something the page can show and a
// practice link the local engine can serve.
//
//   · The server only proposes. The student confirms or changes the chapter.
//   · Nothing the model said is ever marked. Practice that follows is fresh
//     generated questions of that skill, marked on the device by the
//     deterministic engine — the photographed question itself is never marked.
//   · Every failure has an honest, named state: offline, not signed in, email
//     not verified, not set up here, provider down, allowance used, not a
//     maths question, unreadable. The page maps each to its own copy.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { preparePhoto } from '../ink/photoRaster.js';
import { IN_CHAPTER_BY_ID, IN_CHAPTERS } from '../engine/curriculum-in.js';
import { practiceHref } from './practiceLinks.js';

export const PHOTO_STATES = Object.freeze([
  'ok', 'offline', 'signed-out', 'unverified', 'consent', 'not-configured',
  'provider-down', 'allowance', 'not-maths', 'unreadable', 'no-match', 'bad-photo'
]);

/** Map a transport error onto one of the named states. */
export function stateForError(error, { online = true } = {}) {
  const code = String(error?.code || '');
  const status = Number(error?.status) || 0;
  if (!online) return 'offline';
  if (code === 'CLOUD_DISABLED') return 'not-configured';
  if (status === 401 || code === 'AUTH_REQUIRED') return 'signed-out';
  if (code === 'EMAIL_UNVERIFIED') return 'unverified';
  if (/^GUARDIAN_/.test(code)) return 'consent';
  if (code === 'AI_ALLOWANCE_EXHAUSTED' || code === 'AI_DAILY_BUDGET_EXHAUSTED') return 'allowance';
  if (/NOT_CONFIGURED|CONFIG_INVALID|PAID_CAPACITY_NOT_CONFIGURED/.test(code)) return 'not-configured';
  if (/IMAGE_INVALID|IMAGE_TOO_LARGE/.test(code)) return 'bad-photo';
  if (!status && !code) return 'offline';
  return 'provider-down';
}

/** The chapter a candidate names, from the device's own curriculum. */
export function chapterFor(id) {
  return Object.prototype.hasOwnProperty.call(IN_CHAPTER_BY_ID, id) ? IN_CHAPTER_BY_ID[id] : null;
}

/**
 * Keep only candidates this device's curriculum can actually serve, and
 * resolve their dot point from the device's covers (never trusting the reply).
 */
export function localCandidates(candidates) {
  const out = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const chapter = chapterFor(c?.chapterId);
    const cover = chapter?.covers?.find(cv => cv.gen === c?.skillId);
    if (!chapter || !cover) continue;
    out.push({
      chapterId: chapter.id,
      chapterName: chapter.name,
      grade: chapter.grade ?? null,
      skillId: cover.gen,
      dotpoint: Number.isInteger(cover.dp?.[0]) ? cover.dp[0] : null,
      dotpointText: Number.isInteger(cover.dp?.[0]) ? chapter.dotpoints?.[cover.dp[0]] || null : null,
      confidence: Number.isFinite(Number(c?.confidence)) ? Number(c.confidence) : 0
    });
  }
  return out;
}

/** Every chapter a student may switch to, grouped label first. */
export function chapterChoices() {
  return IN_CHAPTERS.filter(ch => (ch.covers || []).length > 0)
    .map(ch => ({ id: ch.id, name: ch.name, grade: ch.grade ?? null }));
}

/**
 * The practice link for a confirmed chapter. When the student keeps the
 * proposed chapter the skill's dot point is targeted; when they change the
 * chapter the whole chapter is practised.
 */
export function practiseHrefFor({ chapterId, dotpoint = null }) {
  if (!chapterFor(chapterId)) return null;
  return practiceHref({ subtopic: chapterId, dotpoint: Number.isInteger(dotpoint) ? dotpoint : null });
}

/**
 * Read a photo. Resolves to `{ state, questionText, candidates }`; never throws.
 * Every dependency is injectable so the contract is tested with no DOM.
 */
export async function identifyQuestionPhoto(dataUrl, {
  transport = cloud,
  available = cloudAvailable,
  online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  prepare = preparePhoto,
  signal = null
} = {}) {
  const empty = { questionText: '', candidates: [] };
  if (!online()) return { state: 'offline', ...empty };
  let ready = false;
  try { ready = available() === true; } catch { ready = false; }
  if (!ready) return { state: 'not-configured', ...empty };
  let prepared = null;
  try { prepared = await prepare(dataUrl); } catch { prepared = null; }
  if (!prepared?.dataUrl) return { state: 'bad-photo', ...empty };
  let reply;
  try {
    reply = await transport.identifyQuestionPhoto(prepared.dataUrl, { signal });
  } catch (error) {
    return { state: stateForError(error, { online: online() }), code: error?.code || null, ...empty };
  }
  const id = reply?.identification || {};
  if (id.isMathsQuestion !== true) return { state: 'not-maths', ...empty };
  if (id.readable !== true) return { state: 'unreadable', ...empty };
  const candidates = localCandidates(id.candidates);
  const questionText = String(id.questionText || '').slice(0, 1200);
  return { state: candidates.length ? 'ok' : 'no-match', questionText, candidates };
}
