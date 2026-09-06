// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local backend — the entire platform running on this device.
// Implements every API the UI uses against IndexedDB. No network required.
// ─────────────────────────────────────────────────────────────────────────────
import {
  get, put, del, add, all, byIndex, rawByIndex, uuid, wipeProfile,
  requestPersistentStorage, storageEstimate,
  ENCRYPTED_STORES, setDataKey, dataKeyFor, hasDataKey, dropDataKeys, sealField, openField
} from './idb.js';
import {
  streakFor, bumpActivity, setPredictedToday,
  ratingsFor, getRating, putRating, currentPid, setCurrentPid, activityFor
} from './store.js';
import { cleanTimezone, dayKey, defaultTimezone, timezoneOf, localeOf } from '../lib/locale.js';
import {
  CURRICULUM, STREAM_CURRICULUM, PATHWAYS, streamSubtopics, SUBTOPIC_BY_ID, subtopicsForYear,
  scopeForYear, DIFF_LABELS, dotpointsFor, dotpointById, dotpointAt
} from '../engine/curriculum.js';
import {
  cleanIndiaTrack, indiaTrack, indiaCourseLabel, indiaScope, indiaChapter,
  indiaChapterGrade, indiaDotpointIndex, resolveIndiaTarget, indiaProductSections,
  indiaDotpointKey, indiaNameOf, indiaDifficultyWindow, clampToIndiaWindow,
  indiaPracticeScope, indiaAheadUnlocked, indiaDotpointsInWindow
} from '../engine/indiaProduct.js';
import { indiaReasonLabel } from '../engine/indiaProgress.js';
import { IN_CHAPTERS, OLYMPIAD_TOPICS } from '../engine/curriculum-in.js';
import { generateQuestion } from '../engine/generators/index.js';
import { checkAnswer, stepCheck, methodMarks } from '../engine/checker.js';
import { authoredRegion, formatRegion, formatMatrix, formatVector } from '../engine/answer-forms.js';
import { stepTrapKey } from '../engine/diagnose.js';
import {
  START_RATING, updateRating, masteryOf, masteryBand, pickDifficulty, pickNext, pickNextAmong,
  predictMark, priorities, prioritiesAmong, xpFor, levelFromXp, bandFor,
  pickDotpoint, scheduleReview, migrateReview, gradeFor,
  retrievability, misconceptionKey, misconceptionLabel, activeTraps, trapPressureOf,
  TRAP_ACTIVE_AT, TRAP_CREDIT_FORGET
} from '../engine/adaptive.js';
import { BADGES, checkBadges } from './badges.js';
import {
  hashPassword, verifyPassword, needsRehash,
  createVault, openVault, rewrapVault, blindHash, sealValue, openValue
} from './auth.js';
import { sanitizeFigure, sanitizeText } from '../lib/sanitize.js';
import {
  assertExamAllowed, assertPracticeAllowed, examAllowance, practiceAllowance,
  planView, recordExamSimulation, recordPracticeServed, requireCapability, usageView
} from './entitlementGate.js';
import { ENTITLEMENTS } from '../platform/entitlements.js';

export const COURSES = {
  nsw: { name: 'NSW · HSC', junior: y => `Year ${y} · Stage ${y <= 8 ? 4 : 5}`, senior: y => y === 11 ? 'Year 11 · Mathematics Advanced' : 'Year 12 · Mathematics Advanced (HSC)' },
  vic: { name: 'VIC · VCE', junior: y => `Year ${y} · Victorian Curriculum`, senior: y => `Year ${y} · VCE Mathematical Methods` },
  qld: { name: 'QLD · QCE', junior: y => `Year ${y} · Australian Curriculum`, senior: y => `Year ${y} · QCE Mathematical Methods` },
  wa: { name: 'WA · WACE', junior: y => `Year ${y} · WA Curriculum`, senior: y => `Year ${y} · WACE Mathematics Methods` },
  sa: { name: 'SA · SACE', junior: y => `Year ${y} · Australian Curriculum`, senior: y => `Year ${y} · SACE Mathematical Methods` },
  ib: { name: 'IB', junior: y => `MYP Year ${y - 6}`, senior: () => 'IB DP · Mathematics AA' },
  in: { name: 'India · CBSE / JEE', junior: y => `Class ${y} · CBSE / NCERT`, senior: y => `Class ${y} · CBSE / NCERT` }
};
export const courseLabel = (course, year, pathway, indiaTrackId = 'cbse') => {
  if (course === 'in') return indiaCourseLabel(year, indiaTrackId);
  const c = COURSES[course] || COURSES.nsw;
  if (year >= 11 && (course || 'nsw') === 'nsw' && pathway && PATHWAYS[pathway]) {
    return `Year ${year} · ${PATHWAYS[pathway].name}${year === 12 ? ' (HSC)' : ''}`;
  }
  return year >= 11 ? c.senior(year) : c.junior(year);
};

/** Validated pathway for a profile: only meaningful in Years 11–12. */
export function pathwayOf(p) {
  if (!p || p.year < 11) return 'advanced';
  const pw = p.pathway;
  if (!PATHWAYS[pw]) return 'advanced';
  if (!PATHWAYS[pw].years.includes(p.year)) return pw === 'ext2' ? 'ext1' : 'advanced';
  return pw;
}
const cleanPathway = (raw, year) => {
  if (year < 11 || !PATHWAYS[raw]) return null;
  if (!PATHWAYS[raw].years.includes(year)) return raw === 'ext2' ? 'ext1' : null;
  return raw;
};

// ── Syllabus dot points ──────────────────────────────────────────────────────
// A subtopic is three syllabus dot points, and they are not one skill: "find
// the gradient through two points" and "sketch from an equation" live under one
// heading and fail for different reasons. Progress is therefore tracked at
// dot-point resolution and the next question is chosen there.
//
// curriculum.js owns the identities — `dotpointsFor`, `dotpointById`, and
// `difficultiesForDotpoint`, which lists the difficulties whose authored form
// actually exercises a dot point and returns [] when nothing does. The
// generator bank takes `generateQuestion(subtopicId, difficulty, seed,
// dotpointId)` and answers with `dotpoints` (every dot point the question
// exercises), `dotpoint` (the one id when the question pins to exactly one),
// and `dotpointExact` (whether a requested one was delivered).
//
// That last flag is why nothing here has to guess. A dot point with no form
// behind it is never offered as a dot point: the request is served at subtopic
// level and the reply says so, rather than telling a student they are drilling
// something the bank cannot produce.

/** Is there an authored form that actually exercises this dot point? */
const dotpointIsGeneratable = (dp) => !!dp && (dp.forms || []).length > 0;

/**
 * The dot points one generated question counts towards. `dotpoints` is the
 * bank's own list; `dotpoint` is its single-id form. Anything the curriculum
 * does not recognise is dropped rather than stored under a name nothing owns.
 */
function dotpointsCredited(q) {
  const raw = Array.isArray(q?.dotpoints) && q.dotpoints.length ? q.dotpoints : (q?.dotpoint ? [q.dotpoint] : []);
  return [...new Set(raw.map(id => dotpointOf(q.subtopic, id)?.id).filter(Boolean))];
}

/** The dot points of a subtopic that a generator can really deliver. */
const generatableDotpoints = (subtopicId) => dotpointsFor(subtopicId).filter(dotpointIsGeneratable);

// How far the difficulty may be dragged from the success target to reach a dot
// point: one rung. Two is the difference between "a stretch" and "a wall".
const DOTPOINT_DRIFT = 1;

/** The difficulty closest to `want` among those that deliver a dot point. */
const nearestForm = (forms, want) => (forms || []).length
  ? forms.reduce((best, f) => (Math.abs(f - want) < Math.abs(best - want) ? f : best))
  : want;

/**
 * Pick the dot point of a subtopic that most needs work, and the difficulty to
 * ask it at. `fixed` is a difficulty the caller has already committed to — the
 * pool is then limited to dot points an authored form delivers at exactly that
 * difficulty, because a dot point that cannot be reached there is not a choice,
 * it is a promise that would be broken on the next line.
 */
function chooseDotpoint(subtopicId, ratingRow, { fixed = null, want = 2, prefer = null, nowMs = Date.now() } = {}) {
  let pool = generatableDotpointStates(subtopicId, ratingRow);
  // A dot point is only reachable through the difficulties whose authored form
  // exercises it, and some are reachable at one rung only. That constraint is
  // not allowed to overrule the success target: a dot point whose only form is
  // two rungs above what this student should be seeing is dropped from the
  // pool, and the question is served at subtopic level instead. Aiming at the
  // finer target is worth nothing if the price is a wall of D4.
  pool = fixed
    ? pool.filter(dp => dp.forms.includes(fixed))
    : pool.filter(dp => Math.abs(nearestForm(dp.forms, want) - want) <= DOTPOINT_DRIFT);
  // A misconception lives on a dot point. When one is being hunted, that dot
  // point is the place to hunt it, not wherever the ranking would have gone.
  const preferred = prefer ? pool.find(dp => dp.id === prefer) : null;
  const dp = preferred || pickDotpoint(pool, { rand: Math.random(), nowMs });
  if (!dp) return { dp: null, difficulty: fixed || want };
  if (fixed) return { dp, difficulty: fixed };
  const aimed = dp.attempts ? pickDifficulty(dp.rating, dp.attempts, { state: dp, nowMs }) : want;
  const d = nearestForm(dp.forms, aimed);
  return { dp, difficulty: Math.abs(d - want) <= DOTPOINT_DRIFT ? d : nearestForm(dp.forms, want) };
}

/** The dot point of `subtopicId` named by an id, a slug key, or an ordinal. */
function dotpointOf(subtopicId, ref) {
  if (ref === undefined || ref === null || ref === '') return null;
  const dp = (typeof ref === 'number' || /^\d+$/.test(String(ref)))
    ? dotpointAt(subtopicId, Number(ref))
    : dotpointById(String(ref));
  return dp && dp.subtopic === subtopicId ? dp : null;
}

// ── Interleaving memory ──────────────────────────────────────────────────────
// What Smart Practice has served this session, newest first, so the picker can
// refuse to serve the same subtopic five times in a row. It is deliberately not
// stored: interleaving is a property of a sitting, and a student who closes the
// app and comes back tomorrow is starting a new one. Kept per profile and
// bounded, so a long-lived tab cannot grow it.

const SERVED_WINDOW = 8;
const SERVED_PROFILES = 6;
const servedByPid = new Map();
// The dot points served this sitting, kept apart from the subtopic list so the
// dot-point picker's recency penalty has something real to read.
const servedDpByPid = new Map();

const recentlyServed = pid => servedByPid.get(pid) || [];
const recentlyServedDotpoints = pid => servedDpByPid.get(pid) || [];

function remember(map, pid, id) {
  const list = [id, ...(map.get(pid) || [])].slice(0, SERVED_WINDOW);
  map.set(pid, list);
  while (map.size > SERVED_PROFILES) map.delete(map.keys().next().value);
}

const noteServed = (pid, subtopicId) => remember(servedByPid, pid, subtopicId);
const noteServedDotpoint = (pid, dotpointKey) => { if (dotpointKey) remember(servedDpByPid, pid, dotpointKey); };

// ── Indian evidence keys ─────────────────────────────────────────────────────
// An Indian question row carries `india: { chapterId, track, dotpointIndex }`.
// Its evidence — rating, dot points, traps, review, attempt — is keyed by that
// chapter id, never by `q.subtopic`: that is the generator which authored the
// question and, for 36 of the generators the Indian spine reaches, an NSW
// subtopic id. The dot point hangs off the chapter row under the chapter's own
// dot-point key, so two chapters that borrow one generator keep separate books.

/** The rating-row id a question's evidence lands on. */
const evidenceKeyOf = (row, q) => row?.india?.chapterId || q?.subtopic;

/** The stored dot-point key of an Indian question, or null at chapter level. */
const indiaDpKeyOf = row => (row?.india ? indiaDotpointKey(row.india.chapterId, row.india.dotpointIndex) : null);

// ── Dot-point and misconception state ────────────────────────────────────────
// Both hang off the subtopic's existing rating row rather than a new store, so
// a device that already holds a year of work keeps it: a row written before any
// of this existed simply has no `dp` and no `traps`, and reads as an empty one.

// How many recent outcomes a rating row remembers, and how many of them the
// success target looks at when deciding whether a student is wobbling.
const RECENT_WINDOW = 8;
const RECENT_LOOKBACK = 3;

const EMPTY_DP = () => ({ rating: START_RATING, attempts: 0, correct: 0, last_at: null });

/** How many of the last few attempts in a subtopic went wrong. */
const recentWrongOf = (st) =>
  (Array.isArray(st?.recent) ? st.recent : []).slice(0, RECENT_LOOKBACK).filter(v => !v).length;

const dpStateOf = (ratingRow, dotpointId) =>
  (ratingRow?.dp && ratingRow.dp[dotpointId]) || EMPTY_DP();

/** Dot-point rows in the shape the picker ranks, restricted to what can be generated. */
function generatableDotpointStates(subtopicId, ratingRow) {
  return generatableDotpoints(subtopicId)
    .map(dp => ({
      id: dp.id, index: dp.ordinal, text: dp.text, forms: dp.forms,
      ...dpStateOf(ratingRow, dp.id), traps: trapsForDotpoint(ratingRow?.traps, dp.id)
    }));
}

const trapsForDotpoint = (traps, dotpointId) => Object.fromEntries(
  Object.entries(traps || {}).filter(([, t]) => t && t.dotpoint === dotpointId)
);

// A misconception ledger is capped so it cannot grow without bound on a device
// that never syncs anywhere; the least recently seen slip is the one that goes.
const MAX_TRAPS_PER_SUBTOPIC = 8;

function trimTraps(traps) {
  const keys = Object.keys(traps);
  if (keys.length <= MAX_TRAPS_PER_SUBTOPIC) return traps;
  const keep = keys
    .sort((a, b) => (traps[b].lastAt || 0) - (traps[a].lastAt || 0))
    .slice(0, MAX_TRAPS_PER_SUBTOPIC);
  return Object.fromEntries(keep.map(k => [k, traps[k]]));
}

/** The trap whose explanation the marker just handed back, if it was one. */
function trapHitBy(q, feedback) {
  if (!feedback) return null;
  const text = String(feedback);
  const pool = [
    ...(Array.isArray(q?.traps) ? q.traps : []),
    ...Object.values(q?.answer?.optionTraps || {}).map(why => ({ why }))
  ];
  const hit = pool.find(t => t && String(t.why) === text);
  return hit ? { why: String(hit.why) } : null;
}

/**
 * Record one wrong answer against the misconception it encodes. Counted once
 * per question, so answering the same question wrongly twice is one slip.
 * Rush and Match are 90-second games: a wrong answer there is usually the clock
 * rather than a wrong idea, and counting it would name a weakness the student
 * does not have.
 */
async function recordTrap(pid, row, q, feedback) {
  if (row.trapKey || q.custom || !q.subtopic) return null;
  if (row.mode === 'rush' || row.mode === 'match') return null;
  const hit = trapHitBy(q, feedback);
  if (!hit) return null;
  const owner = evidenceKeyOf(row, q);
  const key = misconceptionKey(owner, hit.why);
  if (!key) return null;
  const now = Date.now();
  const st = (await getRating(pid, owner)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
  const traps = { ...(st.traps || {}) };
  const prev = traps[key] || { n: 0, credit: 0, firstAt: now };
  traps[key] = {
    n: Math.min(9, (prev.n || 0) + 1), credit: 0, firstAt: prev.firstAt || now, lastAt: now,
    label: safeLabel(misconceptionLabel(hit.why), 140),
    dotpoint: indiaDpKeyOf(row) || (row.india ? null : q.dotpoint) || prev.dotpoint || null
  };
  await putRating(pid, owner, { ...st, traps: trimTraps(traps) });
  row.trapKey = key;
  return key;
}

/**
 * A misstep Step Check could name is the same kind of evidence a designed
 * distractor is, and often better: the student showed their working, so the
 * mistake was watched happening rather than inferred from a final answer. Only
 * confidently named missteps are counted — a bare counterexample says the line
 * is false without saying what was done, which is not a pattern to schedule
 * against. The code carries no numbers, so the same slip in two questions lands
 * on one key.
 */
async function recordStepTrap(pid, row, q, diagnosis) {
  if (!diagnosis || row.trapKey || q.custom || !q.subtopic) return null;
  if (row.mode === 'rush' || row.mode === 'match') return null;
  if (diagnosis.confidence !== 'high' || diagnosis.code === 'counterexample') return null;
  const owner = evidenceKeyOf(row, q);
  const key = stepTrapKey(owner, diagnosis.code);
  if (!key) return null;
  const now = Date.now();
  const st = (await getRating(pid, owner)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
  const traps = { ...(st.traps || {}) };
  const prev = traps[key] || { n: 0, credit: 0, firstAt: now };
  traps[key] = {
    n: Math.min(9, (prev.n || 0) + 1), credit: 0, firstAt: prev.firstAt || now, lastAt: now,
    label: safeLabel(diagnosis.title, 140),
    dotpoint: indiaDpKeyOf(row) || (row.india ? null : q.dotpoint) || prev.dotpoint || null
  };
  await putRating(pid, owner, { ...st, traps: trimTraps(traps) });
  row.trapKey = key;
  return key;
}

/**
 * The named weakness to tell the student about, once a slip has happened often
 * enough to be a pattern. A first occurrence gets the question's own feedback
 * and nothing more — being told you "keep" doing something you did once is
 * both wrong and discouraging.
 */
async function namedTrap(pid, subtopicId, key) {
  if (!key || !subtopicId) return null;
  const st = await getRating(pid, subtopicId);
  const t = st?.traps?.[key];
  if (!t || t.n < TRAP_ACTIVE_AT) return null;
  return { key, label: t.label, count: t.n };
}

/**
 * A clean, unaided correct answer is evidence the slip is receding, so every
 * trap in that subtopic banks a credit. Two credits stop it being surfaced or
 * steering the queue; four and it is forgotten. A hinted or second-try answer
 * banks nothing — it is not evidence the student can do it unaided.
 */
function decayTraps(traps) {
  const out = {};
  for (const [key, t] of Object.entries(traps || {})) {
    const credit = (Number(t?.credit) || 0) + 1;
    if (credit < TRAP_CREDIT_FORGET) out[key] = { ...t, credit };
  }
  return out;
}

/**
 * Every live misconception across the syllabus, worst first — a weakness with
 * a name on it. "You keep reading the vertex off with the sign of the bracket"
 * is something a student can fix this afternoon; "Quadratics · 41%" is not.
 */
function namedWeaknesses(ratings, nowMs = Date.now(), limit = 6, { india = false, grade = null } = {}) {
  const out = [];
  for (const [subtopic, st] of Object.entries(ratings || {})) {
    // An Indian profile names its rows through the Indian spine — a chapter id,
    // or a generator id from before evidence was keyed by chapter — and never
    // through the NSW table, which would label a Class 7 chapter "Year 7".
    const named = india ? indiaNameOf(subtopic, { grade }) : null;
    const sub = india ? null : SUBTOPIC_BY_ID[subtopic];
    if (!named && !sub) continue;
    for (const t of activeTraps(st.traps, nowMs)) {
      const dp = named ? indiaNameOf(t.dotpoint) : dotpointOf(subtopic, t.dotpoint);
      out.push({
        key: t.key, subtopic, subtopicName: named ? named.name : sub.name, strand: named ? named.strand : sub.strand,
        year: named ? named.year : sub.year,
        label: t.label, count: t.n, lastAt: t.lastAt,
        dotpoint: named ? (dp && dp.dotpoint != null ? dp.dotpoint : null) : (dp ? dp.id : null),
        dotpointText: named ? (dp?.dotpointText || null) : (dp ? dp.text : null)
      });
    }
  }
  return out.sort((a, b) => b.count - a.count || b.lastAt - a.lastAt).slice(0, limit);
}

// Every per-profile store included in a full backup file
const BACKUP_STORES = ['ratings', 'attempts', 'questions', 'reviews', 'exams', 'badges', 'activity', 'rushRuns', 'matchRuns', 'inks', 'taskProgress', 'bookmarks'];

// Stores whose keys the database hands out, so a restored row must not carry one
const AUTO_ID_STORES = ['attempts', 'rushRuns', 'matchRuns'];

const DAY = 86400000;
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Untrusted file input ─────────────────────────────────────────────────────
// Backups, task packs and progress files are AirDropped between people who have
// never met, so an untrusted file is the designed input, not the edge case.
// Nothing from one is ever spread into a record: every value below is rebuilt
// field by field from a whitelist, and a row that does not match the shape of
// the store it claims is dropped rather than repaired.

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const MAX_PHOTO = 2500000;

const safeId = (v) => {
  const s = sanitizeText(v, 80);
  return ID_RE.test(s) && !RESERVED_KEYS.has(s) ? s : null;
};
const safeNum = (v, dflt = 0) => { const n = Number(v); return Number.isFinite(n) ? n : dflt; };
const safeInt = (v, lo, hi, dflt = lo) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const safeTime = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, 4102444800000) : null; };
const safeFigure = (v) => sanitizeFigure(typeof v === 'string' ? v : '') || null;

// Names, titles and provenance labels are never mathematical, so anything
// tag-shaped in one came from a file rather than from a person and goes. Maths
// text is left exactly as written — `x < 5` is a question, not an attack — and
// is escaped by the renderer that shows it.
const safeLabel = (v, max) => sanitizeText(String(v ?? '').replace(/<[^>]*>?/g, ' ').replace(/\s+/g, ' '), max);
const safeSteps = (v) => (Array.isArray(v) ? v : []).slice(0, 40)
  .map(s => ({ h: sanitizeText(s?.h, 200), d: sanitizeText(s?.d, 2000) }));
const safeOptions = (v) => (Array.isArray(v) ? v : []).slice(0, 6).map(o => sanitizeText(o, 200));
const safeStrokes = (v, max) => (Array.isArray(v) ? v : []).slice(0, max)
  .map(st => ({ points: (Array.isArray(st?.points) ? st.points : []).slice(0, 4000).map(pt => ({
    x: safeNum(Array.isArray(pt) ? pt[0] : pt?.x),
    y: safeNum(Array.isArray(pt) ? pt[1] : pt?.y)
  })) }));

/** A photo is only ever a base64 raster: no svg, no scheme games, no markup. */
const safePhoto = (v) => {
  if (typeof v !== 'string' || v.length > MAX_PHOTO || !PHOTO_RE.test(v)) return null;
  return /[^A-Za-z0-9+/=]/.test(v.slice(v.indexOf(',') + 1)) ? null : v;
};

/** A modelled quantity: in range, or absent so the model derives it again. */
const safeSpan = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

// Dot-point ids and misconception keys become object keys, so both maps are
// rebuilt key by key through the id allowlist — a file cannot name `__proto__`
// as a dot point — and both are capped so one cannot be used to grow a row.
const MAX_DP_ROWS = 12;

const safeDotpointStats = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [rawKey, s] of Object.entries(v).slice(0, MAX_DP_ROWS)) {
    const key = safeId(rawKey);
    if (!key || !s || typeof s !== 'object') continue;
    out[key] = {
      rating: safeNum(s.rating, START_RATING), attempts: safeInt(s.attempts, 0, 1e7, 0),
      correct: safeInt(s.correct, 0, 1e7, 0), last_at: safeTime(s.last_at)
    };
  }
  return out;
};

const safeTrapLedger = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [rawKey, t] of Object.entries(v).slice(0, MAX_TRAPS_PER_SUBTOPIC)) {
    const key = safeId(rawKey);
    if (!key || !t || typeof t !== 'object') continue;
    out[key] = {
      n: safeInt(t.n, 0, 9, 0), credit: safeInt(t.credit, 0, 9, 0),
      firstAt: safeTime(t.firstAt), lastAt: safeTime(t.lastAt),
      label: safeLabel(t.label, 140), dotpoint: safeId(t.dotpoint)
    };
  }
  return out;
};

// ── Profile helpers ──────────────────────────────────────────────────────────

async function currentProfile() {
  const pid = currentPid();
  if (!pid) return null;
  return (await get('profiles', pid)) || null;
}

/**
 * The selected profile, and proof that it was actually opened. A protected
 * profile is only usable while its data key is held in memory: writing the
 * selection key by hand names a profile but unlocks nothing.
 */
async function requireProfile() {
  const p = await currentProfile();
  if (!p) { const e = new Error('No profile selected'); e.status = 401; throw e; }
  if (p.auth && !hasDataKey(p.id)) {
    throw Object.assign(new Error('This profile is protected — enter its password.'), { status: 401, needsPassword: true, profileId: p.id });
  }
  return p;
}

// ── What the picker may say about an address ─────────────────────────────────
// The picker is drawn before anybody proves who they are, so every field it
// reads is a field a stranger holding the iPad is shown. It used to be handed
// `m•••@example.com`, stored in the clear on the profile row, and that one
// string undid the keyed index sitting next to it: the audit needed no key, no
// crypto and no password — it masked a five-entry guess list by the same rule,
// exactly one entry came out `m•••@example.com`, and the address was named.
// A masking rule is a hash with a tiny output and no key, and a hash with no key
// over a guessable value confirms guesses. That is all it ever was.
//
// So nothing derived from an address is stored any more. What the picker gets
// depends on what the row is already giving away, and on nothing else:
//
//   · A profile with no password has its address in the clear on its row, along
//     with its name, its year and everything else it owns, because that is what
//     having no password means. Masking it for the picker withholds nothing
//     from a dump — the address is right there — but it does keep the whole
//     thing off a screen in a classroom, so the mask is computed at render time
//     from the address itself and never written down.
//
//   · A protected profile's address is sealed. The picker gets one bit —
//     "this account has an email on it" — drawn as a placeholder that is
//     identical for every such profile. One bit cannot be run against a guess
//     list. What it buys is real and small: somebody who has an account with an
//     address and one without can tell which row is which.
//
// Two protected profiles with the same name, the same avatar and both carrying
// addresses are therefore not told apart by this line, and that is the deliberate
// cost. The distinguishing the picker does is by name and avatar, both of which
// the owner chooses; anything more would have to be a stable function of the
// address on a row anyone can read, which is the thing that was wrong.

const SEALED_MARK = '•••';

/** A mask for an address that is already legible on the row it sits on. */
function maskAddress(email) {
  const at = String(email || '').indexOf('@');
  return at < 1 ? null : `${email[0]}•••${email.slice(at)}`;
}

const maskedEmail = p => maskAddress(p.email) || (p.emailSealed || p.emailHash ? SEALED_MARK : null);

/**
 * Store an address on a profile: sealed under the profile's own key when it has
 * one, and a blind index either way so two profiles can be told apart without
 * either address being readable.
 */
async function setProfileEmail(p, email) {
  delete p.email; delete p.emailSealed; delete p.emailHash; delete p.emailMask;
  if (!email) return;
  p.emailHash = await blindHash(email);
  if (p.auth && hasDataKey(p.id)) p.emailSealed = await sealField(p.id, email);
  else p.email = email;
}

/** The full address — for the profile's own owner and nobody else. */
async function profileEmail(p) {
  if (p.emailSealed) return (await openField(p.id, p.emailSealed)) ?? null;
  return p.email || null;
}

/** True when some other profile already answers to this address. */
async function emailTaken(email, exceptId = null) {
  const hash = await blindHash(email);
  return (await all('profiles')).some(x => x.id !== exceptId && (x.emailHash ? x.emailHash === hash : x.email === email));
}

// ── Password gate ────────────────────────────────────────────────────────────
// Every password check in the app comes through this one door, and only one
// guess at a time per profile: the count is read, incremented and written
// inside the same link of a promise chain. Guesses fired all at once are spent
// one after another, so they reach the lockout instead of slipping past it
// while the count sits unwritten.

const MAX_FAILS = 5;
const LOCK_STEP = 30000;
const LOCK_MAX = 15 * 60000;
const gate = new Map();

function serialize(id, job) {
  const next = (gate.get(id) || Promise.resolve()).then(job, job);
  gate.set(id, next.then(() => { }, () => { }));
  return next;
}

const lockedFor = (p, now) => Math.max(0, (p?.lockedUntil || 0) - now);

function lockedError(ms) {
  const secs = Math.ceil(ms / 1000);
  const when = secs > 90 ? `${Math.ceil(secs / 60)} minutes` : `${secs} seconds`;
  return Object.assign(new Error(`Too many wrong passwords — try again in ${when}.`), { status: 429, locked: true, retryAfterMs: ms });
}

/**
 * Spend one guess against a profile. On success the record is brought up to the
 * current hashing cost and `after` runs while the chain still holds the lock,
 * so nothing can slip between the check and what it authorises.
 */
async function withPassword(pid, password, after) {
  return serialize(pid, async () => {
    const p = await get('profiles', pid);
    if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 });
    const now = Date.now();
    const waiting = lockedFor(p, now);
    if (waiting) throw lockedError(waiting);

    if (!p.auth || !(await verifyPassword(String(password ?? ''), p.auth))) {
      p.failCount = (p.failCount || 0) + 1;
      p.lockedUntil = p.failCount >= MAX_FAILS
        ? now + Math.min(LOCK_MAX, LOCK_STEP * 2 ** (p.failCount - MAX_FAILS))
        : null;
      await put('profiles', p);
      const left = lockedFor(p, now);
      if (left) throw lockedError(left);
      throw Object.assign(new Error('Wrong password — try again.'), { status: 401, needsPassword: true, triesLeft: MAX_FAILS - p.failCount });
    }

    p.failCount = 0;
    p.lockedUntil = null;
    const pw = String(password);
    if (needsRehash(p.auth)) p.auth = await hashPassword(pw);
    if (after) await after(p, pw);
    await put('profiles', p);
    return p;
  });
}

/**
 * Bring a protected profile's data key into memory, minting the vault the first
 * time, then bring anything it wrote before the vault existed under the key.
 * Runs inside the gate, so it never races another attempt.
 */
async function openProfileData(p, password) {
  if (p.vault) {
    const key = await openVault(password, p.vault);
    if (!key) throw Object.assign(new Error('This profile’s data can’t be unlocked on this device.'), { status: 500 });
    setDataKey(p.id, key);
    if (needsRehash(p.vault)) p.vault = await rewrapVault(key, password);
  } else {
    const made = await createVault(password);
    p.vault = made.vault;
    setDataKey(p.id, made.key);
  }
  await encryptRows(p.id);
  if (p.email) await setProfileEmail(p, p.email);
}

/**
 * Bring a profile's data key into memory and do nothing else with it.
 * `openProfileData` above does the housekeeping a sign-in wants — minting a
 * vault the first time, sweeping rows that predate it, re-indexing an address —
 * and a delete wants none of that. It needs the key for one reason: the classes
 * and tasks this profile owns say so only inside their sealed bodies now, so
 * they cannot be found, and therefore cannot be deleted, without it.
 */
async function takeDataKey(p, password) {
  if (!p.vault) return;
  const key = await openVault(password, p.vault);
  if (key) setDataKey(p.id, key);
}

/** Seal any of a profile's private rows that are still lying about in the clear. */
async function encryptRows(pid) {
  for (const [st, owner] of ENCRYPTED_STORES) {
    const raw = await rawByIndex(st, owner, pid).catch(() => []);
    if (!raw.length || raw.every(r => !!r.sealed)) continue;
    for (const row of await byIndex(st, owner, pid).catch(() => [])) await put(st, row);
  }
}

/** Give a profile's rows back in the clear, then give up the key. Order matters. */
async function decryptRows(pid) {
  const snapshot = [];
  for (const [st, owner] of ENCRYPTED_STORES) snapshot.push([st, await byIndex(st, owner, pid).catch(() => [])]);
  dropDataKeys();
  for (const [st, rows] of snapshot) for (const row of rows) await put(st, row);
}

// ── Ownership ────────────────────────────────────────────────────────────────

/** A class the signed-in teacher actually runs. Anyone else gets a 404. */
async function requireClass(id) {
  const p = await requireProfile();
  const c = await get('classes', id);
  if (!c || c.teacherPid !== p.id) throw Object.assign(new Error('Class not found'), { status: 404 });
  return c;
}

/** A task this profile set, or one belonging to a class it runs. */
async function requireTask(id) {
  const p = await requireProfile();
  const t = await get('tasks', id);
  if (!t) throw Object.assign(new Error('Task not found'), { status: 404 });
  const c = t.classId ? await get('classes', t.classId) : null;
  if (t.ownerPid !== p.id && c?.teacherPid !== p.id) {
    throw Object.assign(new Error('That task isn’t yours.'), { status: 403 });
  }
  return t;
}

async function publicUser(p, nowMs = Date.now()) {
  const { level, progress, needed } = levelFromXp(p.xp || 0);
  // "Today" is the student's today: an Indian profile's day turns over at
  // midnight in Kolkata, not in Sydney.
  const tz = timezoneOf(p);
  const today = (await get('activity', `${p.id}:${dayKey(nowMs, tz)}`)) || { questions: 0, correct: 0, xp: 0 };
  return {
    id: p.id, name: p.name, year: p.year, theme: p.theme || 'dark',
    course: p.course || 'nsw', timezone: tz, locale: localeOf(p),
    courseLabel: courseLabel(p.course || 'nsw', p.year, pathwayOf(p), cleanIndiaTrack(p.indiaTrack, p.year)),
    pathway: p.course === 'nsw' && p.year >= 11 ? pathwayOf(p) : null,
    pathwayName: p.course === 'nsw' && p.year >= 11 ? PATHWAYS[pathwayOf(p)].name : null,
    indiaTrack: p.course === 'in' ? cleanIndiaTrack(p.indiaTrack, p.year) : null,
    indiaTrackName: p.course === 'in' ? indiaTrack(p.indiaTrack, p.year).name : null,
    role: p.role || 'student', avatar: p.avatar || '🙂',
    email: await profileEmail(p), provider: p.provider || null, hasPassword: !!p.auth,
    dailyGoal: p.dailyGoal || 10, xp: p.xp || 0, level, levelProgress: progress, levelNeeded: needed,
    streak: await streakFor(p.id, nowMs, tz),
    today: { questions: today.questions, correct: today.correct, xp: today.xp },
    isDemo: !!p.isDemo, handwriting: p.handwriting !== false,
    // Default false, and false for every profile that predates the setting.
    cloudHandwriting: p.cloudHandwriting === true,
    cloudMarking: p.cloudMarking === true,
    // Plan and free-tier usage are read from device rows: the entitlement is the
    // server-issued snapshot (or 'free'), the usage is the local counter.
    // The free-tier counter keeps its own clock (entitlementGate's), so the
    // allowance a student is shown and the allowance the gate enforces can
    // never disagree about when the day turns over.
    plan: await planView(p),
    usage: await usageView(p)
  };
}

// ── Question serving ─────────────────────────────────────────────────────────

// The structured Section II bank is 26 kB of question text that only a practice
// paper ever reaches, so — like the year and stream banks behind
// engine/generators/index.js — it is a dynamic chunk rather than freight in the
// entry bundle. A chunk that could not be fetched is not remembered as loaded,
// so one unreachable fetch costs one paper rather than every paper after it.
let multipartBank = null;

function loadMultipart() {
  if (!multipartBank) {
    multipartBank = import('../engine/generators/multipart.js')
      .catch(err => { multipartBank = null; throw err; });
  }
  return multipartBank;
}

const indiaGeneratorIds = chapter => [...new Set((chapter?.covers || []).map(c => c.gen))];

/** Attempt-weighted aggregate of rating rows — the legacy, generator-keyed reading of a chapter. */
function aggregateRows(rows, now) {
  const attempts = rows.reduce((n, st) => n + (st.attempts || 0), 0);
  const correct = rows.reduce((n, st) => n + (st.correct || 0), 0);
  const weights = rows.reduce((n, st) => n + Math.max(1, st.attempts || 0), 0);
  const rating = rows.reduce((n, st) => n + (st.rating || START_RATING) * Math.max(1, st.attempts || 0), 0) / Math.max(1, weights);
  const mastery = rows.reduce((n, st) => n + masteryOf(st.rating, st.attempts, st.last_at, now) * Math.max(1, st.attempts || 0), 0) / Math.max(1, weights);
  const last_at = rows.reduce((n, st) => Math.max(n, st.last_at || 0), 0) || null;
  return { attempts, correct, rating, mastery, last_at };
}

/**
 * The evidence on an Indian chapter, in the shape the picker ranks: the
 * chapter's own rating row — with its dot points, traps and recent outcomes —
 * or, on a device whose rows predate chapter keying, the aggregate of the
 * generator rows its covers name, which carries none of those.
 */
function indiaState(chapter, ratings, now = Date.now()) {
  const own = chapter?.id ? ratings[chapter.id] : null;
  if (own) {
    return {
      ...own, rating: own.rating || START_RATING, attempts: own.attempts || 0, correct: own.correct || 0,
      mastery: masteryOf(own.rating, own.attempts, own.last_at, now), legacy: false
    };
  }
  const rows = indiaGeneratorIds(chapter).map(id => ratings[id]).filter(Boolean);
  if (!rows.length) return { attempts: 0, correct: 0, rating: START_RATING, mastery: 0, last_at: null, legacy: false };
  return { ...aggregateRows(rows, now), legacy: true };
}

/** The rating state of one Indian dot point: its own row under the chapter, or the legacy generator aggregate. */
function indiaDotpointState(chapter, ordinal, chapterRow, ratings, now = Date.now()) {
  if (chapterRow) return dpStateOf(chapterRow, indiaDotpointKey(chapter.id, ordinal));
  const ids = [...new Set((chapter.covers || []).filter(c => c.dp.includes(ordinal)).map(c => c.gen))];
  const rows = ids.map(id => ratings[id]).filter(Boolean);
  if (!rows.length) return EMPTY_DP();
  const { rating, attempts, correct, last_at } = aggregateRows(rows, now);
  return { rating, attempts, correct, last_at };
}

/**
 * The dot points of an Indian chapter in the shape the dot-point picker ranks,
 * limited to the ones an authored form reaches inside the track's window.
 */
function indiaDotpointStates(chapter, chapterRow, trackId, grade, ratings, now = Date.now()) {
  return indiaDotpointsInWindow(chapter, trackId, grade).map(ordinal => {
    const key = indiaDotpointKey(chapter.id, ordinal);
    return {
      id: key, index: ordinal, text: chapter.dotpoints[ordinal],
      ...indiaDotpointState(chapter, ordinal, chapterRow, ratings, now),
      traps: trapsForDotpoint(chapterRow?.traps, key)
    };
  });
}

/**
 * Generate an Indian question at a resolved target. When a misconception is
 * being hunted the bank is asked up to TRAP_SEEK_TRIES times for a form that
 * carries that trap, and `trapKey` in the reply says whether one was found —
 * the same honesty the NSW path keeps, so a "same slip" question is one that
 * can actually spring the slip.
 */
async function createIndiaQuestion(pid, chapter, target, mode, trackId, examId = null, taskId = null, trapKey = null) {
  if (!chapter || !target) throw Object.assign(new Error('That India syllabus target has no authored question form yet.'), { status: 409, code: 'INDIA_TARGET_UNCOVERED' });
  let q = null;
  let delivered = null;
  for (let i = 0; i < (trapKey ? TRAP_SEEK_TRIES : 1); i++) {
    const cand = generateQuestion(target.generator, target.difficulty);
    if (!q) q = cand;
    if (!trapKey) break;
    const probes = (Array.isArray(cand.traps) ? cand.traps : [])
      .concat(Object.values(cand.answer?.optionTraps || {}).map(why => ({ why })));
    if (probes.some(t => misconceptionKey(chapter.id, t.why) === trapKey)) { q = cand; delivered = trapKey; break; }
  }
  const row = {
    id: uuid(), pid, subtopic: q.subtopic, difficulty: q.difficulty || target.difficulty, payload: q,
    india: { chapterId: chapter.id, track: trackId, dotpointIndex: target.dotpointIndex },
    mode, examId, taskId, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now()
  };
  await put('questions', row);
  return { row, payload: q, trapKey: delivered };
}

// ── Indian smart practice ────────────────────────────────────────────────────
// The same four axes NSW smart practice runs on — retrieval urgency from the
// FSRS rows, weakness weighted by chapter weight, misconception pressure, and
// coverage of the student's own class — scored over the chapters of the
// profile's track at the track's difficulty window, then narrowed to one dot
// point by the same dot-point picker. Nothing here is a second engine: it is
// pickNextAmong and pickDotpoint over Indian ids.

const INDIA_WHY = {
  review: c => `Spaced review — your memory of ${c.name} is due to fade.`,
  'weak-spot': c => `Targeting your weakest chapter — ${c.name} has the most room to grow.`,
  misconception: (c, trap) => (trap ? `Same slip keeps coming back in ${c.name}: ${trap.label}` : `Working on a mistake that keeps repeating in ${c.name}.`),
  'new-ground': c => `New ground — ${c.name} has not been practised yet.`,
  rotation: (c, _t, track) => `Keeping your practice balanced across ${track} — ${c.name} is up.`,
  topic: (c, _t, track) => `${track} · focused practice on ${c.name}.`
};

/**
 * The chapters smart practice may draw on right now — the student's own class,
 * plus the year ahead once it has been earned — with every chapter's state.
 * `aheadIds` is what the picker's coverage axis treats as revision rather than
 * own ground; a Class 11 JEE student's Class 12 chapters stay reachable by
 * explicit choice whether or not they are in the pool.
 */
function indiaPool(trackId, grade, ratings, now) {
  const { own, ahead } = indiaPracticeScope(trackId, grade);
  const states = Object.fromEntries([...own, ...ahead].map(c => [c.id, indiaState(c, ratings, now)]));
  const aheadUnlocked = ahead.length > 0 && indiaAheadUnlocked(own.map(c => states[c.id]));
  return { own, ahead, states, aheadUnlocked, pool: aheadUnlocked ? [...own, ...ahead] : own, aheadIds: new Set(ahead.map(c => c.id)) };
}

/**
 * What to serve an Indian profile next, and why. With `chapter` the choice is
 * the student's (reason 'topic'); without it the optimiser chooses, and the
 * reply carries the reason tag, the plain-language why and the runner-up. The
 * result is a resolved target — chapter, dot point, generator, difficulty in
 * the track's window — and nothing is written, so GET /stats can ask the same
 * question for its "what next" strip.
 */
function indiaPick(p, trackId, ratings, reviews, now, { chapter = null, dotpoint = null, difficulty = null, rand = Math.random() } = {}) {
  const grade = p.year;
  const trackName = indiaTrack(trackId, grade).name;
  const { pool, states, aheadIds, aheadUnlocked } = indiaPool(trackId, grade, ratings, now);
  let choice;
  if (chapter) {
    const st = states[chapter.id] || indiaState(chapter, ratings, now);
    choice = { chapter, st, reason: 'topic', reasonTag: null, trap: activeTraps(st.traps, now)[0] || null, target: null, difficulty: null, nextUp: null, explicit: true };
  } else {
    if (!pool.length) throw Object.assign(new Error('No generated questions are available for this India track yet.'), { status: 409, code: 'INDIA_TRACK_UNCOVERED' });
    const poolIds = new Set(pool.map(c => c.id));
    const reviewsDue = reviews.filter(r => r.dueAt <= now && poolIds.has(r.subtopic)).sort((a, b) => a.dueAt - b.dueAt);
    const picked = pickNextAmong({
      candidates: pool.map(c => ({ id: c.id, weight: c.weight, own: !aheadIds.has(c.id) })),
      ratings: states, reviewsDue, rand, recent: recentlyServed(p.id), nowMs: now
    });
    const c = indiaChapter(picked.subtopic);
    const up = picked.nextUp ? indiaChapter(picked.nextUp.subtopic) : null;
    choice = {
      chapter: c, st: states[c.id] || indiaState(c, ratings, now), reason: picked.reason, reasonTag: picked.reasonTag,
      trap: picked.trap, target: picked.target, difficulty: picked.difficulty, explicit: false,
      nextUp: up ? { subtopic: up.id, name: up.name, year: indiaChapterGrade(up), reasonTag: picked.nextUp.reasonTag, label: indiaReasonLabel(picked.nextUp.reasonTag) } : null
    };
  }
  const { chapter: c, st } = choice;
  const chapterRow = ratings[c.id] || null;
  const asked = indiaDotpointIndex(c, dotpoint);
  let dp = null;
  if (asked == null) {
    const dpPool = indiaDotpointStates(c, chapterRow, trackId, grade, ratings, now);
    // A misconception lives on a dot point: when one is being hunted, that dot
    // point is the place to hunt it.
    const preferred = choice.trap?.dotpoint ? dpPool.find(d => d.id === choice.trap.dotpoint) : null;
    dp = preferred || pickDotpoint(dpPool, { rand, nowMs: now, recent: recentlyServedDotpoints(p.id) });
  }
  const ordinal = asked != null ? asked : (dp ? dp.index : null);
  // Difficulty is read off whichever rating describes what is about to be
  // asked — the dot point's own once it has evidence, the chapter's otherwise
  // — then held inside the track's window.
  const basis = dp && dp.attempts ? dp : { rating: st.rating ?? START_RATING, attempts: st.attempts || 0, correct: st.correct || 0, last_at: st.last_at || 0 };
  let want;
  if (difficulty != null && difficulty !== '') want = Number(difficulty);
  else if (choice.explicit || !dp || dp.attempts) {
    want = pickDifficulty(basis.rating, basis.attempts, {
      state: { ...basis, trapPressure: trapPressureOf(st.traps, now), recentWrong: recentWrongOf(st) }, nowMs: now, rand
    });
  } else want = choice.difficulty;
  want = clampToIndiaWindow(want, trackId, grade);
  const target = resolveIndiaTarget(c, { dotpoint: ordinal, difficulty: want, track: trackId, grade });
  if (!target) {
    throw Object.assign(new Error(`That India ${ordinal != null ? 'dot point' : 'chapter'} has no authored question form at this track yet.`), { status: 409, code: 'INDIA_TARGET_UNCOVERED' });
  }
  let why = INDIA_WHY[choice.reason](c, choice.trap, trackName);
  if (target.dotpointIndex != null) why += ` Dot point: ${c.dotpoints[target.dotpointIndex]}`;
  if (target.windowed === false) why += ` (Served at D${target.difficulty} — this dot point has no authored form at ${trackName} depth yet.)`;
  return {
    chapter: c, target, dotpointKey: target.dotpointIndex != null ? indiaDotpointKey(c.id, target.dotpointIndex) : null,
    reason: choice.reason, reasonTag: choice.reasonTag, why, nextUp: choice.nextUp, trap: choice.trap,
    successTarget: choice.target, mastery: st.mastery || 0, explicit: choice.explicit, aheadUnlocked
  };
}

/** GET /stats for an Indian profile: every surface named through the Indian spine. */
async function indiaStats(p, ratings, now) {
  const pid = p.id;
  const trackId = cleanIndiaTrack(p.indiaTrack, p.year);
  const { pool, states, aheadIds, aheadUnlocked } = indiaPool(trackId, p.year, ratings, now);
  const reviews = await byIndex('reviews', 'pid', pid);
  const due = new Set(reviews.filter(r => r.dueAt <= now).map(r => r.subtopic));
  const misconceptions = namedWeaknesses(ratings, now, 6, { india: true, grade: p.year });
  const notes = Object.fromEntries(misconceptions.map(m => [m.subtopic, `keeps repeating: ${m.label}`]));
  const prio = prioritiesAmong(
    pool.map(c => ({ id: c.id, name: c.name, year: indiaChapterGrade(c), strand: c.strand, weight: c.weight, rev: aheadIds.has(c.id) })),
    states, now, 5, notes
  ).map(row => ({ ...row, due: due.has(row.subtopic) }));
  const strandAgg = {};
  for (const c of pool) {
    const m = states[c.id]?.attempts ? states[c.id].mastery : 0;
    strandAgg[c.strand] = strandAgg[c.strand] || { sum: 0, n: 0 };
    strandAgg[c.strand].sum += m; strandAgg[c.strand].n++;
  }
  const strands = Object.entries(strandAgg).map(([name, v]) => ({ name, mastery: Math.round(100 * v.sum / v.n) }));
  const chapters = pool.map(c => {
    const st = states[c.id];
    const m = st.attempts ? st.mastery : 0;
    return {
      id: c.id, name: c.name, year: indiaChapterGrade(c), strand: c.strand, weight: c.weight,
      mastery: Math.round(m * 100), band: st.attempts ? masteryBand(m) : 'unseen',
      attempts: st.attempts, correct: st.correct, due: due.has(c.id), ahead: aheadIds.has(c.id)
    };
  });
  // The "what next" strip: the picker's answer right now, with a fixed jitter
  // seed so the strip does not change on every refresh. The next real serve
  // draws its own randomness, so it can differ — this is a preview, not a lock.
  let recommendation = null;
  try {
    const pick = indiaPick(p, trackId, ratings, reviews, now, { rand: 0.5 });
    recommendation = {
      subtopic: pick.chapter.id, name: pick.chapter.name, year: indiaChapterGrade(pick.chapter), strand: pick.chapter.strand,
      reason: pick.reason, reasonTag: pick.reasonTag, label: indiaReasonLabel(pick.reasonTag), why: pick.why,
      dotpoint: pick.target.dotpointIndex,
      dotpointText: pick.target.dotpointIndex != null ? pick.chapter.dotpoints[pick.target.dotpointIndex] : null,
      difficulty: pick.target.difficulty, misconception: pick.trap?.label || null, nextUp: pick.nextUp
    };
  } catch { recommendation = null; }
  const days = await activityFor(pid);
  const attempts = await byIndex('attempts', 'pid', pid);
  const totals = { attempts: attempts.length, correct: attempts.filter(a => a.correct).length, ms: attempts.reduce((s, a) => s + (a.ms || 0), 0) };
  const byDiff = [1, 2, 3, 4].map(d => {
    const rows = attempts.filter(a => a.difficulty === d);
    return { difficulty: d, n: rows.length, c: rows.filter(a => a.correct).length };
  }).filter(r => r.n);
  const rushRuns = await byIndex('rushRuns', 'pid', pid);
  const matchRuns = await byIndex('matchRuns', 'pid', pid);
  const exams = await byIndex('exams', 'pid', pid);
  const recent = attempts.slice(-15).reverse().map(a => {
    const named = indiaNameOf(a.subtopic, { grade: p.year });
    return {
      subtopic: a.subtopic, difficulty: a.difficulty, correct: a.correct, created_at: a.createdAt, mode: a.mode,
      name: named ? named.name : (a.subtopic === 'custom' ? 'Custom question' : a.subtopic), year: named ? named.year : null
    };
  });
  return {
    course: 'in', indiaTrack: trackId, window: indiaDifficultyWindow(trackId, p.year), aheadUnlocked,
    // No NSW-scaled mark for an Indian student: the India progress page says
    // so in words, and the number is not manufactured here either.
    predicted: null, trajectory: [],
    priorities: prio, strands, misconceptions, recommendation, chapters, reviewsDue: due.size,
    activity: days.slice(-120), totals, byDiff,
    bestRush: rushRuns.length ? Math.max(...rushRuns.map(r => r.score)) : 0,
    matchWins: matchRuns.filter(r => r.won).length, matchPlayed: matchRuns.length,
    examCount: exams.filter(e => e.finishedAt).length, inkCount: attempts.filter(a => a.viaInk).length, recent,
    streak: await streakFor(pid, now)
  };
}

// ── India teacher model ──────────────────────────────────────────────────────
// A teacher of an India class sees the evidence the India student product
// shows — chapters started, attempts, demonstrated accuracy, chapter mastery —
// and never an HSC-scaled predicted mark or band. Everything here is computed
// from the same ratings the practice engine writes, keyed by generator id, so
// a chapter covered by a shared generator (an NSW-era bank reused as an asset)
// is still credited to the NCERT chapter the student was actually working on.

/** generator id → the India chapter/topic ids whose covers name it */
const INDIA_CHAPTER_IDS_BY_GEN = (() => {
  const map = Object.create(null);
  for (const ch of [...IN_CHAPTERS, ...OLYMPIAD_TOPICS]) {
    for (const gen of indiaGeneratorIds(ch)) (map[gen] ||= []).push(ch.id);
  }
  return map;
})();

const isIndiaGenerator = id => !!INDIA_CHAPTER_IDS_BY_GEN[id];

/** One evidence row per chapter in the profile's India scope. */
function indiaChapterRows(trackId, year, ratings, now = Date.now()) {
  return indiaScope(trackId, year).map(ch => {
    const st = indiaState(ch, ratings, now);
    return {
      id: ch.id, name: ch.name, strand: ch.strand,
      attempts: st.attempts, correct: st.correct,
      accuracy: st.attempts ? Math.round(100 * st.correct / st.attempts) : null,
      mastery: Math.round(100 * st.mastery),
      band: st.attempts ? masteryBand(st.mastery) : 'unseen'
    };
  });
}

/** Chapter coverage summary — the India product's own numbers, no prediction. */
function indiaEvidence(rows) {
  const started = rows.filter(r => r.attempts > 0);
  return {
    chaptersStarted: started.length, chaptersTotal: rows.length,
    chaptersPractised: rows.filter(r => r.attempts >= 5).length,
    mastery: started.length ? Math.round(started.reduce((n, r) => n + r.mastery, 0) / started.length) : null,
    weakest: [...started].sort((a, b) => a.mastery - b.mastery || (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.attempts - a.attempts).slice(0, 3)
      .map(r => ({ id: r.id, name: r.name, mastery: r.mastery, accuracy: r.accuracy, attempts: r.attempts }))
  };
}

/** Repeated misconceptions for an India profile, named by NCERT chapter. */
function indiaWeaknesses(ratings, nowMs = Date.now(), limit = 6) {
  const out = [];
  for (const [gen, st] of Object.entries(ratings || {})) {
    const ids = INDIA_CHAPTER_IDS_BY_GEN[gen];
    if (!ids) continue;
    const ch = indiaChapter(ids[0]);
    for (const t of activeTraps(st.traps, nowMs)) {
      out.push({
        key: t.key, subtopic: gen, subtopicName: ch?.name || gen, strand: ch?.strand || null, chapterId: ch?.id || null,
        label: t.label, count: t.n, lastAt: t.lastAt, dotpoint: null, dotpointText: null
      });
    }
  }
  return out.sort((a, b) => b.count - a.count || b.lastAt - a.lastAt).slice(0, limit);
}

/**
 * Distinct days with at least one answered question inside the window, counted
 * in the student's own timezone. A day boundary fixed to one country would
 * start and end an Indian student's day in the middle of their evening.
 */
function activeDaysIn(days, nowMs, windowDays = 28, timezone = defaultTimezone()) {
  const cutoff = dayKey(nowMs - windowDays * 86400000, timezone);
  return days.filter(d => d.questions > 0 && d.date >= cutoff).length;
}

// Intervention thresholds. Each flag carries the plain-language reason a
// teacher would say out loud, so the chip in the class table is explainable.
const INACTIVE_DAYS = 7;
const DROP_WINDOW = 20;
const DROP_POINTS = 15;

function interventionFlags({ attempts, lastActiveAt, sinceMs, overdueTasks, weaknesses, nowMs }) {
  const flags = [];
  const anchor = lastActiveAt || sinceMs || null;
  const idle = anchor ? Math.floor((nowMs - anchor) / 86400000) : null;
  if (!attempts.length) {
    if (idle == null || idle >= INACTIVE_DAYS) {
      flags.push({ code: 'inactive', label: 'Not started', reason: idle == null ? 'No practice recorded yet.' : `No practice recorded in the ${idle} days since joining.` });
    }
  } else if (idle != null && idle >= INACTIVE_DAYS) {
    flags.push({ code: 'inactive', label: `Inactive ${idle}d`, reason: `Last answered a question ${idle} days ago.` });
  }
  if (overdueTasks.length) {
    flags.push({
      code: 'overdue', label: `${overdueTasks.length} overdue`,
      reason: `Past due and unfinished: ${overdueTasks.map(t => `${t.title} (${t.done}/${t.count})`).join(', ')}.`
    });
  }
  const recent = attempts.slice(-DROP_WINDOW);
  if (recent.length >= DROP_WINDOW) {
    const half = DROP_WINDOW / 2;
    const acc = rows => Math.round(100 * rows.filter(a => a.correct).length / rows.length);
    const before = acc(recent.slice(0, half));
    const after = acc(recent.slice(half));
    if (before - after >= DROP_POINTS) {
      flags.push({ code: 'accuracy-drop', label: `Accuracy −${before - after}`, reason: `Accuracy fell from ${before}% to ${after}% across the last ${DROP_WINDOW} questions.` });
    }
  }
  const repeated = (weaknesses || []).filter(w => w.count >= TRAP_ACTIVE_AT);
  if (repeated.length) {
    const w = repeated[0];
    flags.push({ code: 'misconception', label: 'Repeated mistake', reason: `${w.label} — seen ${w.count} times in ${w.subtopicName}.` });
  }
  return flags;
}

/** The class-analytics row for one on-device student. */
async function studentAnalyticsRow(prof, classTasks, now) {
  const pid = prof.id;
  const ratings = await ratingsFor(pid);
  const attempts = (await byIndex('attempts', 'pid', pid)).sort((a, b) => a.createdAt - b.createdAt);
  const days = await activityFor(pid);
  const lastActiveAt = attempts.length ? attempts[attempts.length - 1].createdAt : null;
  const overdue = [];
  for (const t of classTasks) {
    if (!t.dueAt || t.dueAt > now) continue;
    const tp = await get('taskProgress', `${t.id}:${pid}`);
    if (!tp?.finishedAt) overdue.push({ id: t.id, title: t.title, done: tp?.done || 0, count: t.count });
  }
  const india = (prof.course || 'nsw') === 'in';
  const trackId = india ? cleanIndiaTrack(prof.indiaTrack, prof.year) : null;
  const weaknesses = india ? indiaWeaknesses(ratings, now) : namedWeaknesses(ratings, now);
  const correct = attempts.filter(a => a.correct).length;
  const base = {
    id: pid, name: prof.name, avatar: prof.avatar, year: prof.year,
    course: prof.course || 'nsw', indiaTrack: trackId,
    courseLabel: courseLabel(prof.course || 'nsw', prof.year, pathwayOf(prof), trackId || 'cbse'),
    attempts: attempts.length, correct,
    accuracy: attempts.length ? Math.round(100 * correct / attempts.length) : null,
    streak: await streakFor(pid, now, timezoneOf(prof)), activeDays: activeDaysIn(days, now, 28, timezoneOf(prof)), lastActiveAt,
    misconceptions: weaknesses.slice(0, 3),
    flags: interventionFlags({ attempts, lastActiveAt, sinceMs: prof.createdAt || null, overdueTasks: overdue, weaknesses, nowMs: now })
  };
  if (india) {
    const chapters = indiaChapterRows(trackId, prof.year, ratings, now);
    const evidence = indiaEvidence(chapters);
    return { ...base, predicted: null, evidence, chapters, weakest: evidence.weakest[0]?.name || '—', weakestChapters: evidence.weakest };
  }
  const pred = predictMark(ratings, prof.year, now, pathwayOf(prof));
  return {
    ...base, predicted: pred.mark, evidence: null, chapters: null,
    weakest: priorities(ratings, prof.year, now, 1, pathwayOf(prof))[0]?.name || '—', weakestChapters: []
  };
}

/** The class-analytics row for a progress file imported from another device. */
function importedAnalyticsRow(imp, now) {
  const d = imp.data || {};
  const st = d.student || {};
  const india = st.course === 'in';
  const ratings = d.ratings || {};
  const lastActiveAt = Object.values(ratings).reduce((m, r) => Math.max(m, r?.last_at || 0), 0) || null;
  const attempts = d.totals?.attempts || 0;
  const correct = d.totals?.correct || 0;
  const weaknesses = india ? indiaWeaknesses(ratings, now) : [];
  const base = {
    id: `import-${imp.id}`, name: st.name || 'Imported student', avatar: st.avatar || '📄', year: st.year,
    course: india ? 'in' : 'nsw', indiaTrack: india ? cleanIndiaTrack(st.indiaTrack, st.year || 9) : null,
    courseLabel: india ? courseLabel('in', st.year || 9, null, cleanIndiaTrack(st.indiaTrack, st.year || 9)) : (st.year ? `Year ${st.year}` : '—'),
    attempts, correct, accuracy: attempts ? Math.round(100 * correct / attempts) : null,
    streak: d.streak || 0, activeDays: null, lastActiveAt,
    misconceptions: weaknesses.slice(0, 3),
    // A file carries totals, not the attempt log, so only the flags a snapshot
    // can justify are raised: inactivity from the last rating timestamp and a
    // repeated misconception from the trap ledger.
    flags: [
      ...(attempts === 0 ? [{ code: 'inactive', label: 'Not started', reason: 'The imported progress file records no practice yet.' }]
        : lastActiveAt && now - lastActiveAt >= INACTIVE_DAYS * 86400000
          ? [{ code: 'inactive', label: `Inactive ${Math.floor((now - lastActiveAt) / 86400000)}d`, reason: `Last answered a question ${Math.floor((now - lastActiveAt) / 86400000)} days ago (from the imported file).` }]
          : []),
      ...interventionFlags({ attempts: [], lastActiveAt: now, sinceMs: now, overdueTasks: [], weaknesses, nowMs: now }).filter(f => f.code === 'misconception')
    ],
    imported: true, importedAt: imp.importedAt
  };
  if (india) {
    const chapters = indiaChapterRows(base.indiaTrack, st.year || 9, ratings, now);
    const evidence = indiaEvidence(chapters);
    return { ...base, predicted: null, evidence, chapters, weakest: evidence.weakest[0]?.name || '—', weakestChapters: evidence.weakest };
  }
  let weakest = '—';
  try { weakest = priorities(ratings, st.year || 9, now, 1, st.pathway || 'advanced')[0]?.name || '—'; } catch { }
  return { ...base, predicted: d.predicted?.mark ?? null, evidence: null, chapters: null, weakest, weakestChapters: [] };
}

/** Class-level chapter table: which NCERT chapters this class finds hardest. */
function classChapterRows(students) {
  const agg = Object.create(null);
  for (const s of students) {
    for (const r of s.chapters || []) {
      if (!r.attempts) continue;
      const a = agg[r.id] ||= { id: r.id, name: r.name, strand: r.strand, students: 0, attempts: 0, correct: 0, masterySum: 0 };
      a.students++; a.attempts += r.attempts; a.correct += r.correct; a.masterySum += r.mastery;
    }
  }
  return Object.values(agg)
    .map(a => ({
      id: a.id, name: a.name, strand: a.strand, students: a.students, attempts: a.attempts, correct: a.correct,
      accuracy: Math.round(100 * a.correct / a.attempts), mastery: Math.round(a.masterySum / a.students)
    }))
    .sort((a, b) => a.mastery - b.mastery || a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/**
 * India targets for a task: {chapterId, dotpoint, track, difficulty}. Accepts
 * explicit target objects and, for the student's own Tasks page, chapter ids or
 * `chapter#dotpoint` refs in the same `subtopics` list the NSW picker uses.
 */
function indiaTargetsFrom(rawTargets, rawSubtopics, rawTrack = null, rawDifficulty = null) {
  const out = [];
  const push = (chapterId, dotpoint, track, difficulty) => {
    if (out.length >= 40) return;
    const chapter = indiaChapter(safeId(chapterId));
    if (!chapter) return;
    const grade = indiaChapterGrade(chapter) || 12;
    const trackId = cleanIndiaTrack(track, grade);
    const ceiling = indiaTrack(trackId, grade).difficultyCeiling || 4;
    const dp = indiaDotpointIndex(chapter, dotpoint);
    const d = difficulty === null || difficulty === undefined || difficulty === '' ? null : Math.min(ceiling, safeInt(difficulty, 1, 4, 2));
    if (out.some(t => t.chapterId === chapter.id && t.dotpoint === dp && t.track === trackId && t.difficulty === d)) return;
    out.push({ chapterId: chapter.id, dotpoint: dp, track: trackId, difficulty: d });
  };
  for (const t of (Array.isArray(rawTargets) ? rawTargets : []).slice(0, 100)) {
    if (!t || typeof t !== 'object') continue;
    push(t.chapterId, t.dotpoint ?? t.dotpointIndex ?? null, t.track ?? rawTrack, t.difficulty ?? rawDifficulty);
  }
  for (const s of (Array.isArray(rawSubtopics) ? rawSubtopics : []).slice(0, 100)) {
    const [chapterId, dp] = String(s || '').split('#');
    if (!SUBTOPIC_BY_ID[chapterId]) push(chapterId, dp === undefined ? null : dp, rawTrack, rawDifficulty);
  }
  return out;
}

function criteriaFor(q) {
  const steps = q.steps || [];
  const marks = Math.min(4, Math.max(1, q.difficulty));
  const keySteps = steps.filter(s => !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  if (!keySteps.length) return [{ mark: 1, text: 'Correct final answer' }];
  return keySteps.map((s, i) => ({
    mark: 1,
    text: i === keySteps.length - 1 ? `${s.h} — leading to the correct answer` : s.h
  }));
}

/**
 * Step Check meta for a question: the authored one, or one derived from the
 * answer itself (an expression's canonical form; an equation pinned by its
 * solution). This is what lets ANY question accept marked working.
 */
function stepMetaFor(q) {
  if (q.stepcheck) return q.stepcheck;
  const a = q.answer;
  if (!a) return null;
  if (q.answerType === 'expression' && a.expr) return { kind: 'expression', canonical: a.expr };
  if (q.answerType === 'numeric' && a.value !== undefined) {
    const m = (q.answerPrefix || '').match(/^([a-z])\s*=$/i);
    if (m) return { kind: 'equation', variable: m[1].toLowerCase(), solutions: [a.value] };
  }
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    return { kind: 'equation', variable: 'x', solutions: a.values };
  }
  return null;
}

// Figures render as raw markup, so every one is put back through the allowlist
// on the way out as well as on the way in: a device may already be holding a
// row that was stored before the import boundary was closed.
function sanitize(q, row) {
  if (q.multipart) {
    return {
      id: row.id, multipart: true, title: q.title, stem: q.stem, figure: safeFigure(q.figure),
      subtopicName: q.title, difficulty: q.difficulty, diffLabel: 'Structured question',
      marks: q.totalMarks,
      parts: q.parts.map(pt => ({
        key: pt.key, prompt: pt.prompt, answerType: pt.answerType, mcqOptions: pt.mcqOptions,
        inputHint: pt.inputHint, answerPrefix: pt.answerPrefix, answerSuffix: pt.answerSuffix, marks: pt.marks
      })),
      taskId: row.taskId || null
    };
  }
  const s = SUBTOPIC_BY_ID[q.subtopic];
  const dp = s ? dotpointOf(q.subtopic, q.dotpoint) : null;
  const inChapter = row.india ? indiaChapter(row.india.chapterId) : null;
  const inDp = inChapter && Number.isInteger(row.india?.dotpointIndex) ? row.india.dotpointIndex : null;
  return {
    id: row.id, subtopic: inChapter?.id || q.subtopic,
    subtopicName: inChapter?.name || (q.custom ? q.customName || 'Custom question' : (s?.name || q.subtopic)),
    year: inChapter ? indiaChapterGrade(inChapter) : s?.year, strand: inChapter?.strand || s?.strand,
    indiaTrack: row.india?.track || null,
    dotpoint: inChapter ? inDp : (dp ? dp.id : null),
    dotpointText: inChapter && inDp != null ? inChapter.dotpoints[inDp] : (dp ? dp.text : null),
    dotpointIndex: inChapter ? inDp : (dp ? dp.ordinal : null),
    difficulty: q.difficulty, diffLabel: DIFF_LABELS[q.difficulty] || 'Custom',
    prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions,
    figure: safeFigure(q.figure), code: s?.code || null,
    inputHint: q.inputHint, answerPrefix: q.answerPrefix, answerSuffix: q.answerSuffix,
    hintsAvailable: (q.hints || []).length, hintsUsed: row.hintsUsed || 0,
    triesLeft: 2 - (row.tries || 0),
    supportsSteps: !!stepMetaFor(q),
    criteria: criteriaFor(q),
    taskId: row.taskId || null
  };
}

// How many seeds to look through when a specific misconception is being
// hunted. Generation is a few hundred microseconds of local arithmetic and
// nothing is written until one is chosen, so this costs a student nothing —
// but it is bounded, because a trap the bank cannot produce must not spin.
const TRAP_SEEK_TRIES = 12;

/**
 * Generate a question, optionally aimed at one dot point and one misconception.
 * Returns the payload and an honest account of what was actually honoured, so
 * a caller never claims a focus the generator did not deliver.
 */
function generateFocused(subtopic, difficulty, { dotpointId = null, trapKey = null } = {}) {
  const want = dotpointIsGeneratable(dotpointOf(subtopic, dotpointId)) ? dotpointId : null;
  // `dotpointExact` is the bank's own word for whether the question it just
  // built really exercises what was asked for. It is the only thing allowed to
  // decide that a dot point was practised.
  const delivered = q => (want && q?.dotpointExact ? want : null);
  const gen = () => generateQuestion(subtopic, difficulty, undefined, want || undefined);
  if (!trapKey) {
    const q = gen();
    return { q, dotpoint: delivered(q), trapKey: null };
  }
  let first = null;
  for (let i = 0; i < TRAP_SEEK_TRIES; i++) {
    const q = gen();
    if (!first) first = q;
    const probes = (Array.isArray(q.traps) ? q.traps : [])
      .concat(Object.values(q.answer?.optionTraps || {}).map(why => ({ why })));
    if (probes.some(t => misconceptionKey(subtopic, t.why) === trapKey)) {
      return { q, dotpoint: delivered(q), trapKey };
    }
  }
  return { q: first, dotpoint: delivered(first), trapKey: null };
}

async function createQuestion(pid, subtopic, difficulty, mode, examId = null, taskId = null, customQ = null, focus = null) {
  const made = customQ ? null : generateFocused(subtopic, difficulty, focus || {});
  const q = customQ ? { ...customQ, custom: true } : made.q;
  const row = {
    id: uuid(), pid, subtopic: q.subtopic || 'custom', difficulty: q.difficulty || 2, payload: q,
    mode, examId, taskId, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now()
  };
  await put('questions', row);
  return { row, payload: q, dotpoint: made?.dotpoint || null, trapKey: made?.trapKey || null };
}

function displayAnswer(q) {
  const a = q.answer;
  switch (q.answerType) {
    case 'mcq': return q.mcqOptions?.[a.correctIndex] ?? '';
    case 'numeric': {
      if (a.canonicalInput) return a.canonicalInput;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}√${a.surdForm.r}`;
      return `${q.answerPrefix ? q.answerPrefix + ' ' : ''}${a.value}${q.answerSuffix ? ' ' + q.answerSuffix : ''}`;
    }
    case 'expression': return a.expr;
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a} : ${a.b}`;
    case 'working': return a.canonicalWorking || '';
    case 'interval': {
      const region = authoredRegion(a);
      return region ? formatRegion(region, a.variable || 'x') : (a.region || '');
    }
    case 'matrix': return Array.isArray(a.rows) ? formatMatrix(a.rows) : '';
    case 'vector': return Array.isArray(a.components) ? formatVector(a.components) : '';
    default: return '';
  }
}

async function resolve(profile, row, q, correct, answerGiven, ms, mode, viaInk = false) {
  const pid = profile.id;
  const now = Date.now();
  // Evidence lands on the chapter for an Indian question, on the subtopic for
  // an NSW one — never on the generator that happened to author the form.
  const owner = evidenceKeyOf(row, q);
  const st = (await getRating(pid, owner)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
  const effHints = (row.hintsUsed || 0) + Math.max(0, (row.tries || 0) - (correct ? 1 : 0));
  let ratingAfter = st.rating;
  const isRush = mode === 'rush' || mode === 'match';
  const isCustom = q.custom;

  if (!isRush && !isCustom) {
    ratingAfter = updateRating(st.rating, st.attempts, q.difficulty, correct, effHints);

    // Dot-point resolution. The bank says which dot points a question actually
    // exercises; each of them takes the result. A question that spans two of
    // them is evidence about both — we cannot say which one a wrong answer
    // came from, and pretending we can would put a made-up number on a screen.
    // A question that names none moves only the subtopic, exactly as before.
    const dp = { ...(st.dp || {}) };
    const credited = row.india ? [indiaDpKeyOf(row)].filter(Boolean) : dotpointsCredited(q);
    for (const dpId of credited) {
      const prev = dpStateOf(st, dpId);
      dp[dpId] = {
        rating: updateRating(prev.rating, prev.attempts, q.difficulty, correct, effHints),
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        last_at: now
      };
    }

    // A clean correct answer walks every live misconception in this subtopic
    // back one step; a hinted or second-try one leaves the ledger alone.
    const clean = correct && !(row.hintsUsed || 0) && !(row.tries || 0);
    const traps = clean ? decayTraps(st.traps) : (st.traps || {});

    // The last few outcomes, newest first. Long-run mastery is an average, and
    // an average cannot tell "steady at 60%" from "was fine, just missed the
    // last three" — which are different students needing different questions.
    const recent = [correct ? 1 : 0, ...(Array.isArray(st.recent) ? st.recent : [])].slice(0, RECENT_WINDOW);

    await putRating(pid, owner, {
      rating: ratingAfter, attempts: st.attempts + 1, correct: st.correct + (correct ? 1 : 0), last_at: now,
      dp, traps, recent
    });
  }

  if ((mode === 'practice' || mode === 'review' || mode === 'task') && !isCustom) {
    // Spaced review, FSRS-5. The grade carries more than right/wrong: a correct
    // answer that needed a hint or a second try is Hard, and a clean fast one is
    // Easy, so two students who both "got it" are not scheduled the same.
    const key = `${pid}:${owner}`;
    const rev = await get('reviews', key);
    const grade = gradeFor({
      correct, hintsUsed: row.hintsUsed || 0, tries: row.tries || 0,
      ms: ms || 0, difficulty: q.difficulty || 2
    });
    if (rev) {
      await put('reviews', { ...rev, subtopic: owner, ...scheduleReview(rev, grade, now) });
    } else if (st.attempts + 1 >= 3) {
      await put('reviews', { key, pid, subtopic: owner, ...scheduleReview(null, grade, now) });
    }
  }

  const xp = isRush ? (correct ? 6 : 0) : xpFor(q.difficulty, correct, 0, effHints);
  profile.xp = (profile.xp || 0) + xp;
  await put('profiles', profile);
  const tz = timezoneOf(profile);
  await bumpActivity(pid, { correct, xp, ms }, now, tz);

  await add('attempts', {
    pid, questionId: row.id, subtopic: owner, generator: q.subtopic, difficulty: q.difficulty || 2,
    correct: correct ? 1 : 0, answerGiven: String(answerGiven ?? '').slice(0, 300),
    ms: ms || 0, hintsUsed: row.hintsUsed || 0, mode, viaInk,
    ratingBefore: st.rating, ratingAfter, createdAt: now
  });
  row.answered = 1;
  await put('questions', row);

  // Task progress
  if (row.taskId) {
    const key = `${row.taskId}:${pid}`;
    const task = await get('tasks', row.taskId);
    const tp = (await get('taskProgress', key)) || { key, taskId: row.taskId, pid, done: 0, correct: 0, finishedAt: null };
    tp.done += 1; tp.correct += correct ? 1 : 0;
    if (task && tp.done >= task.count && !tp.finishedAt) tp.finishedAt = now;
    await put('taskProgress', tp);
  }

  const newBadges = await checkBadges(pid, { type: 'attempt', difficulty: q.difficulty, correct, hintsUsed: row.hintsUsed, year: profile.year, xp: profile.xp }, now, tz);

  const ratings = await ratingsFor(pid);
  const pred = predictMark(ratings, profile.year, now, pathwayOf(profile));
  await setPredictedToday(pid, pred.mark, now, tz);

  const stNew = ratings[owner];
  const mastery = stNew ? Math.round(masteryOf(stNew.rating, stNew.attempts, stNew.last_at, now) * 100) : 0;

  return {
    xp, totalXp: profile.xp, level: levelFromXp(profile.xp),
    ratingDelta: ratingAfter - st.rating, mastery, band: masteryBand(mastery / 100),
    // The NSW-scaled mark is not a number an Indian student is ever shown, and
    // the streak is counted in the student's own timezone.
    predicted: profile.course === 'in' ? null : pred, streak: await streakFor(pid, now, tz), newBadges
  };
}

// ── Record builders for file-sourced data ────────────────────────────────────
// One builder per record shape, and every route that accepts that shape uses
// it. The teacher tool and the task-pack importer share the question builder on
// purpose: two copies would drift, and the copy that drifted would be the one
// reading a file written by a stranger.

const CUSTOM_ANSWER_TYPES = new Set(['numeric', 'expression', 'mcq']);

/** The one shape a custom question may take, wherever it came from. */
function buildCustomQuestion(src, ownerPid, strict = false) {
  const raw = src && typeof src === 'object' ? src : {};
  const prompt = sanitizeText(raw.prompt, 4000);
  const answerType = CUSTOM_ANSWER_TYPES.has(raw.answerType) ? raw.answerType : null;
  if (!prompt || !answerType) {
    if (strict) throw Object.assign(new Error('A prompt and answer type are required'), { status: 400 });
    return null;
  }
  const a = raw.answer && typeof raw.answer === 'object' ? raw.answer : {};
  const name = safeLabel(raw.name, 60) || 'Custom question';
  const difficulty = safeInt(raw.difficulty, 1, 4, 2);
  const solutionText = sanitizeText(raw.solutionText, 2000);
  const hint = sanitizeText(raw.hint, 500);
  const q = {
    subtopic: 'custom', custom: true, customName: name, difficulty,
    prompt, answerType,
    answer: answerType === 'mcq' ? { correctIndex: safeInt(a.correctIndex, 0, 3, 0) }
      : answerType === 'expression' ? { expr: sanitizeText(a.expr, 200) }
        : { value: safeNum(a.value) },
    mcqOptions: answerType === 'mcq' ? safeOptions(raw.mcqOptions).slice(0, 4) : undefined,
    figure: safeFigure(raw.figure),
    steps: [{ h: 'Teacher solution', d: solutionText || 'See your teacher for the worked solution.' }],
    hints: hint ? [hint] : [],
    solutionText
  };
  return { id: uuid(), ownerPid, q, difficulty: q.difficulty, name: q.customName, createdAt: Date.now() };
}

/** Flatten one packed question record into the builder's vocabulary. */
function packQuestion(cq) {
  const rec = cq && typeof cq === 'object' ? cq : {};
  const q = rec.q && typeof rec.q === 'object' ? rec.q : {};
  return {
    prompt: q.prompt, answerType: q.answerType, answer: q.answer, mcqOptions: q.mcqOptions,
    figure: q.figure, solutionText: q.solutionText ?? (Array.isArray(q.steps) ? q.steps[0]?.d : undefined),
    hint: Array.isArray(q.hints) ? q.hints[0] : undefined,
    name: q.customName ?? rec.name, difficulty: q.difficulty ?? rec.difficulty
  };
}

/**
 * A backup is a file people hand around — Settings offers it for sharing. It
 * carries the work and none of the keys: no password record, no vault, no
 * address, no lockout state. A restored profile comes back unprotected.
 */
const exportProfile = p => ({
  name: p.name, year: p.year, course: p.course || 'nsw', indiaTrack: p.indiaTrack || null, role: p.role || 'student',
  timezone: timezoneOf(p),
  avatar: p.avatar || '🙂', theme: p.theme || 'dark', dailyGoal: p.dailyGoal || 10,
  xp: p.xp || 0, pathway: p.pathway ?? null, provider: p.provider || null,
  handwriting: p.handwriting !== false, isDemo: false,
  createdAt: p.createdAt || null
});

function importProfile(src, id) {
  const year = safeInt(src.year, 7, 12, 9);
  return {
    id, name: safeLabel(src.name, 40) || 'Student', year,
    course: COURSES[src.course] ? src.course : 'nsw',
    indiaTrack: (COURSES[src.course] ? src.course : 'nsw') === 'in' ? cleanIndiaTrack(src.indiaTrack, year) : null,
    timezone: cleanTimezone(src.timezone) || defaultTimezone(COURSES[src.course] ? src.course : 'nsw'),
    role: src.role === 'teacher' ? 'teacher' : 'student',
    avatar: safeLabel(src.avatar, 4) || '🙂',
    theme: src.theme === 'light' ? 'light' : 'dark',
    dailyGoal: safeInt(src.dailyGoal, 3, 60, 10),
    xp: safeInt(src.xp, 0, 1e9, 0),
    pathway: (COURSES[src.course] ? src.course : 'nsw') === 'nsw' ? (cleanPathway(src.pathway, year) || (year >= 11 ? 'advanced' : null)) : null,
    provider: ['apple', 'google', 'email'].includes(src.provider) ? src.provider : null,
    handwriting: src.handwriting !== false,
    isDemo: false,
    createdAt: safeTime(src.createdAt) || Date.now(),
    lastActiveAt: Date.now()
  };
}

// Question payloads are read back by the checker and the step marker, so their
// own vocabulary is kept — but only that vocabulary, and every figure in it is
// rebuilt from the allowlist first.
const PAYLOAD_KEYS = ['subtopic', 'custom', 'multipart', 'multipartId', 'answerType', 'answer',
  'inputHint', 'answerPrefix', 'answerSuffix', 'stepcheck', 'seed', 'totalMarks'];
const PART_KEYS = ['key', 'answerType', 'answer', 'inputHint', 'answerPrefix', 'answerSuffix', 'traps'];

function safePayload(src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
  const out = {};
  for (const k of PAYLOAD_KEYS) if (src[k] !== undefined) out[k] = src[k];
  out.dotpoint = safeId(src.dotpoint) || undefined;
  out.customName = safeLabel(src.customName, 60) || undefined;
  out.title = safeLabel(src.title, 200) || undefined;
  out.stem = sanitizeText(src.stem, 4000) || undefined;
  out.prompt = sanitizeText(src.prompt, 4000) || undefined;
  out.difficulty = safeInt(src.difficulty, 1, 4, 2);
  out.figure = safeFigure(src.figure);
  out.mcqOptions = src.mcqOptions === undefined ? undefined : safeOptions(src.mcqOptions);
  out.steps = safeSteps(src.steps);
  out.hints = (Array.isArray(src.hints) ? src.hints : []).slice(0, 8).map(h => sanitizeText(h, 500));
  out.solutionText = sanitizeText(src.solutionText, 4000) || undefined;
  if (Array.isArray(src.parts)) {
    out.parts = src.parts.slice(0, 20).map(pt => {
      const part = {};
      const raw = pt && typeof pt === 'object' ? pt : {};
      for (const k of PART_KEYS) if (raw[k] !== undefined) part[k] = raw[k];
      part.prompt = sanitizeText(raw.prompt, 4000);
      part.marks = safeInt(raw.marks, 0, 20, 1);
      part.mcqOptions = raw.mcqOptions === undefined ? undefined : safeOptions(raw.mcqOptions);
      part.steps = safeSteps(raw.steps);
      part.figure = safeFigure(raw.figure);
      return part;
    });
  }
  return out.prompt || out.stem ? out : null;
}

const safeSolution = (s) => ({
  steps: safeSteps(s?.steps),
  answerText: sanitizeText(s?.answerText, 300),
  criteria: (Array.isArray(s?.criteria) ? s.criteria : []).slice(0, 12)
    .map(c => ({ mark: safeInt(c?.mark, 0, 20, 1), text: sanitizeText(c?.text, 300) })),
  solutionText: sanitizeText(s?.solutionText, 4000) || undefined
});

function safeExamDetail(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.slice(0, 60).map(src => {
    const d = src && typeof src === 'object' ? src : {};
    const out = {
      id: safeId(d.id), difficulty: safeInt(d.difficulty, 1, 4, 2),
      subtopicName: safeLabel(d.subtopicName, 120), figure: safeFigure(d.figure),
      correct: !!d.correct, marks: safeInt(d.marks, 0, 40, 0), awarded: safeInt(d.awarded, 0, 40, 0)
    };
    if (d.multipart) {
      out.multipart = true;
      out.title = safeLabel(d.title, 200);
      out.stem = sanitizeText(d.stem, 4000);
      out.parts = (Array.isArray(d.parts) ? d.parts : []).slice(0, 20).map(p => ({
        key: sanitizeText(p?.key, 8), prompt: sanitizeText(p?.prompt, 4000),
        answerType: sanitizeText(p?.answerType, 20), mcqOptions: safeOptions(p?.mcqOptions),
        given: sanitizeText(p?.given, 300), correct: !!p?.correct,
        marks: safeInt(p?.marks, 0, 20, 0), awarded: safeInt(p?.awarded, 0, 20, 0),
        feedback: sanitizeText(p?.feedback, 600), answerText: sanitizeText(p?.answerText, 300),
        steps: safeSteps(p?.steps)
      }));
      return out;
    }
    return Object.assign(out, {
      subtopic: safeId(d.subtopic), prompt: sanitizeText(d.prompt, 4000),
      answerType: sanitizeText(d.answerType, 20), mcqOptions: safeOptions(d.mcqOptions),
      given: sanitizeText(d.given, 300), feedback: sanitizeText(d.feedback, 600),
      partial: d.partial && typeof d.partial === 'object'
        ? { okLines: safeInt(d.partial.okLines, 0, 40, 0), awarded: safeInt(d.partial.awarded, 0, 40, 0), note: sanitizeText(d.partial.note, 300) }
        : null,
      working: d.working == null ? null : sanitizeText(d.working, 4000),
      solution: safeSolution(d.solution)
    });
  });
}

/**
 * The shape each backup store accepts. Keys are re-derived from the values that
 * survived sanitising rather than carried over from the file, so a crafted row
 * cannot choose which profile — or which other row — it lands on.
 */
const IMPORT_ROWS = {
  ratings: (r, pid) => {
    const subtopic = safeId(r.subtopic);
    return subtopic && {
      key: `${pid}:${subtopic}`, pid, subtopic,
      rating: safeNum(r.rating, START_RATING), attempts: safeInt(r.attempts, 0, 1e7, 0),
      correct: safeInt(r.correct, 0, 1e7, 0), last_at: safeTime(r.last_at),
      dp: safeDotpointStats(r.dp), traps: safeTrapLedger(r.traps),
      recent: (Array.isArray(r.recent) ? r.recent : []).slice(0, RECENT_WINDOW).map(v => (v ? 1 : 0))
    };
  },
  reviews: (r, pid) => {
    const subtopic = safeId(r.subtopic);
    // The FSRS state is the student's memory model for this idea. A restore
    // that dropped it would silently reset every interval to day one, so it
    // comes across with the row — rebuilt field by field like everything else,
    // and derived from `intervalDays` when the file predates the model.
    return subtopic && {
      key: `${pid}:${subtopic}`, pid, subtopic,
      dueAt: safeTime(r.dueAt) || Date.now(), intervalDays: safeInt(r.intervalDays, 0, 3650, 1),
      stability: safeSpan(r.stability, 0.1, 3650),
      fsrsDifficulty: safeSpan(r.fsrsDifficulty, 1, 10),
      // A file that predates the memory model has no `reps`. Defaulting it to 0
      // is what tells scheduleReview this is a brand-new item, which throws away
      // the schedule the row's own intervalDays describes — so a restore would
      // quietly reset a year of revision to day one. An interval on the row is
      // itself evidence the student has seen this idea at least once.
      reps: Number.isFinite(r?.reps) ? safeInt(r.reps, 0, 1e6, 0) : (safeInt(r.intervalDays, 0, 3650, 1) > 0 ? 1 : 0),
      lapses: safeInt(r.lapses, 0, 1e6, 0),
      lastAt: safeTime(r.lastAt)
    };
  },
  badges: (r, pid) => {
    const badgeId = safeId(r.badgeId);
    return badgeId && { key: `${pid}:${badgeId}`, pid, badgeId, earnedAt: safeTime(r.earnedAt) || Date.now() };
  },
  activity: (r, pid) => {
    const date = DATE_RE.test(String(r.date || '')) ? String(r.date) : null;
    return date && {
      key: `${pid}:${date}`, pid, date,
      questions: safeInt(r.questions, 0, 1e6, 0), correct: safeInt(r.correct, 0, 1e6, 0),
      xp: safeInt(r.xp, 0, 1e9, 0), ms: safeInt(r.ms, 0, 1e11, 0),
      predicted: r.predicted == null ? null : safeInt(r.predicted, 0, 100, 0)
    };
  },
  bookmarks: (r, pid) => {
    const questionId = safeId(r.questionId);
    return questionId && { key: `${pid}:${questionId}`, pid, questionId, createdAt: safeTime(r.createdAt) || Date.now() };
  },
  taskProgress: (r, pid) => {
    const taskId = safeId(r.taskId);
    return taskId && {
      key: `${taskId}:${pid}`, taskId, pid,
      done: safeInt(r.done, 0, 1e5, 0), correct: safeInt(r.correct, 0, 1e5, 0), finishedAt: safeTime(r.finishedAt)
    };
  },
  attempts: (r, pid) => ({
    pid, questionId: safeId(r.questionId), subtopic: safeId(r.subtopic) || 'custom',
    difficulty: safeInt(r.difficulty, 1, 4, 2), correct: r.correct ? 1 : 0,
    answerGiven: sanitizeText(r.answerGiven, 300), ms: safeInt(r.ms, 0, 1e9, 0),
    hintsUsed: safeInt(r.hintsUsed, 0, 20, 0), mode: sanitizeText(r.mode, 20) || 'practice',
    viaInk: !!r.viaInk, ratingBefore: safeNum(r.ratingBefore, 0), ratingAfter: safeNum(r.ratingAfter, 0),
    createdAt: safeTime(r.createdAt) || Date.now()
  }),
  rushRuns: (r, pid) => ({
    pid, score: safeInt(r.score, 0, 100, 0), correct: safeInt(r.correct, 0, 100, 0),
    total: safeInt(r.total, 0, 100, 0), bestCombo: safeInt(r.bestCombo, 0, 100, 0),
    createdAt: safeTime(r.createdAt) || Date.now()
  }),
  matchRuns: (r, pid) => ({
    pid, won: !!r.won, playerScore: safeInt(r.playerScore, 0, 100, 0),
    rivalScore: safeInt(r.rivalScore, 0, 100, 0), rival: safeLabel(r.rival, 40),
    ms: safeInt(r.ms, 0, 1e9, 0), createdAt: safeTime(r.createdAt) || Date.now()
  }),
  inks: (r, pid) => {
    const id = safeId(r.id);
    return id && {
      id, pid, strokes: safeStrokes(r.strokes, 4000),
      recognized: sanitizeText(r.recognized, 500) || null, photo: safePhoto(r.photo),
      scribble: r.scribble == null ? null : safeStrokes(r.scribble, 400),
      createdAt: safeTime(r.createdAt) || Date.now()
    };
  },
  questions: (r, pid) => {
    const id = safeId(r.id);
    const payload = safePayload(r.payload);
    return id && payload && {
      id, pid, subtopic: safeId(r.subtopic) || 'custom', difficulty: safeInt(r.difficulty, 1, 4, 2),
      payload, mode: sanitizeText(r.mode, 20) || 'practice',
      examId: safeId(r.examId), taskId: safeId(r.taskId),
      answered: r.answered ? 1 : 0, tries: safeInt(r.tries, 0, 9, 0), hintsUsed: safeInt(r.hintsUsed, 0, 20, 0),
      createdAt: safeTime(r.createdAt) || Date.now()
    };
  },
  exams: (r, pid) => {
    const id = safeId(r.id);
    return id && {
      id, pid, year: safeInt(r.year, 7, 12, 9), pathway: PATHWAYS[r.pathway] ? r.pathway : null,
      title: safeLabel(r.title, 80) || 'Practice paper', durationMin: safeInt(r.durationMin, 5, 240, 30),
      questionIds: (Array.isArray(r.questionIds) ? r.questionIds : []).slice(0, 80).map(safeId).filter(Boolean),
      createdAt: safeTime(r.createdAt) || Date.now(), finishedAt: safeTime(r.finishedAt),
      score: r.score == null ? null : safeInt(r.score, -999, 999, 0),
      total: r.total == null ? null : safeInt(r.total, 0, 999, 0),
      detail: safeExamDetail(r.detail),
      // WP india-exams: an India paper is only listed and reviewed while it
      // carries its blueprint; a restore that dropped this would make every
      // sat CBSE/JEE/IOQM paper vanish from the India exams page.
      ...(r.indiaExam && typeof r.indiaExam === 'object' ? { indiaExam: safeIndiaExamMeta(r.indiaExam), summary: safeIndiaExamSummary(r.summary) } : {})
    };
  }
};

function safeIndiaExamMeta(m) {
  const out = {
    blueprintId: safeId(m.blueprintId) || null, track: sanitizeText(m.track, 20) || 'cbse', variant: sanitizeText(m.variant, 20) || null,
    authenticity: sanitizeText(m.authenticity, 60) || null, sourceSession: sanitizeText(m.sourceSession, 20) || null,
    fullPaper: !!m.fullPaper, sectionTimerOfficial: !!m.sectionTimerOfficial, seed: safeInt(m.seed, 0, 0x7fffffff, 0),
    reducedPattern: (Array.isArray(m.reducedPattern) ? m.reducedPattern : []).slice(0, 20).map(t => sanitizeText(t, 300)),
    sections: (Array.isArray(m.sections) ? m.sections : []).slice(0, 10).map(x => ({
      id: sanitizeText(x?.id, 8), label: sanitizeText(x?.label, 80), questions: safeInt(x?.questions, 0, 80, 0), marks: safeInt(x?.marks, 0, 200, 0),
      marksEach: safeInt(x?.marksEach, 0, 20, 1), negative: safeInt(x?.negative, 0, 20, 0), partialPerOption: x?.partialPerOption == null ? null : safeInt(x.partialPerOption, 0, 20, 0)
    }))
  };
  if (Number.isFinite(Number(m.fullPaperDurationMinutes))) out.fullPaperDurationMinutes = safeInt(m.fullPaperDurationMinutes, 5, 600, 180);
  return out;
}

function safeIndiaExamSummary(s) {
  if (!s || typeof s !== 'object') return null;
  const row = x => ({
    id: sanitizeText(x?.id, 80), label: sanitizeText(x?.label, 120), questions: safeInt(x?.questions, 0, 80, 0), attempted: safeInt(x?.attempted, 0, 80, 0),
    correct: safeInt(x?.correct, 0, 80, 0), incorrect: safeInt(x?.incorrect, 0, 80, 0), partial: safeInt(x?.partial, 0, 80, 0), unanswered: safeInt(x?.unanswered, 0, 80, 0),
    marks: safeInt(x?.marks, 0, 200, 0), awarded: safeInt(x?.awarded, -200, 200, 0), negative: safeInt(x?.negative, 0, 200, 0), ms: safeInt(x?.ms, 0, 1e8, 0)
  });
  return {
    sections: (Array.isArray(s.sections) ? s.sections : []).slice(0, 10).map(row),
    chapters: (Array.isArray(s.chapters) ? s.chapters : []).slice(0, 40).map(row),
    negativeMarks: safeInt(s.negativeMarks, 0, 200, 0), totalMs: safeInt(s.totalMs, 0, 1e8, 0),
    markingSchemes: s.markingSchemes && typeof s.markingSchemes === 'object'
      ? Object.fromEntries(Object.entries(s.markingSchemes).slice(0, 6).map(([k, v]) => [sanitizeText(k, 30), safeInt(v, 0, 80, 0)])) : {}
  };
}

/** A teacher's copy of someone else's progress, rebuilt from the file. */
function importProgress(src) {
  const st = src.student && typeof src.student === 'object' ? src.student : {};
  const year = safeInt(st.year, 7, 12, 9);
  const pred = src.predicted && typeof src.predicted === 'object' ? src.predicted : null;
  const band = pred?.band && typeof pred.band === 'object' ? pred.band : null;
  const ratings = Object.create(null);
  for (const [k, v] of Object.entries(src.ratings && typeof src.ratings === 'object' ? src.ratings : {})) {
    const id = safeId(k);
    if (!id || !(SUBTOPIC_BY_ID[id] || isIndiaGenerator(id)) || !v || typeof v !== 'object') continue;
    ratings[id] = {
      rating: safeNum(v.rating, START_RATING), attempts: safeInt(v.attempts, 0, 1e7, 0),
      correct: safeInt(v.correct, 0, 1e7, 0), last_at: safeTime(v.last_at),
      traps: safeTrapLedger(v.traps)
    };
  }
  const india = st.course === 'in';
  return {
    format: 'pri-progress', version: 1, exportedAt: safeTime(src.exportedAt) || Date.now(),
    student: {
      name: safeLabel(st.name, 40), year, avatar: safeLabel(st.avatar, 4) || '🙂',
      course: india ? 'in' : 'nsw',
      indiaTrack: india ? cleanIndiaTrack(st.indiaTrack, year) : null,
      pathway: india ? null : cleanPathway(st.pathway, year)
    },
    predicted: pred ? {
      mark: safeInt(pred.mark, 0, 100, 0), low: safeInt(pred.low, 0, 100, 0), high: safeInt(pred.high, 0, 100, 0),
      coverage: safeInt(pred.coverage, 0, 100, 0), attempts: safeInt(pred.attempts, 0, 1e7, 0),
      band: band ? { scale: safeLabel(band.scale, 20), label: safeLabel(band.label, 20), desc: safeLabel(band.desc, 200) } : null
    } : null,
    streak: safeInt(src.streak, 0, 100000, 0),
    totals: { attempts: safeInt(src.totals?.attempts, 0, 1e7, 0), correct: safeInt(src.totals?.correct, 0, 1e7, 0) },
    ratings,
    taskProgress: (Array.isArray(src.taskProgress) ? src.taskProgress : []).slice(0, 500)
      .map(t => {
        const taskId = safeId(t?.taskId);
        return taskId ? { taskId, done: safeInt(t.done, 0, 1e5, 0), correct: safeInt(t.correct, 0, 1e5, 0), finished: !!t.finished } : null;
      }).filter(Boolean)
  };
}

// ── Route implementations ────────────────────────────────────────────────────

const routes = {

  // ---- profiles / accounts ----
  'GET /profiles': async () => {
    const profiles = (await all('profiles')).sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
    return {
      profiles: profiles.map(p => ({
        id: p.id, name: p.name, year: p.year, avatar: p.avatar, role: p.role || 'student',
        course: p.course || 'nsw', isDemo: !!p.isDemo, xp: p.xp || 0,
        email: maskedEmail(p), provider: p.provider || null, hasPassword: !!p.auth,
        lastActiveAt: p.lastActiveAt || null
      })), currentId: currentPid()
    };
  },
  'POST /profiles': async (body) => {
    const p = {
      id: uuid(), name: String(body.name || 'Student').trim().slice(0, 40) || 'Student',
      year: Math.min(12, Math.max(7, Number(body.year) || 9)),
      course: COURSES[body.course] ? body.course : 'nsw',
      role: body.role === 'teacher' ? 'teacher' : 'student',
      avatar: body.avatar || '🙂', theme: 'dark', dailyGoal: 10, xp: 0,
      createdAt: Date.now(), lastActiveAt: Date.now()
    };
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    if (email && !EMAIL_RE.test(email)) throw Object.assign(new Error('That email doesn’t look right.'), { status: 400 });
    // Nobody signing up gets told whose account an address belongs to, or even
    // that the address they typed is the one that clashed.
    if (email && await emailTaken(email)) {
      throw Object.assign(new Error('That email can’t be used for a new profile. If the account is yours, pick it from the list.'), { status: 409 });
    }
    if (['apple', 'google', 'email'].includes(body.provider)) p.provider = body.provider;
    // An empty password is a mistake, not a choice: it would hand back a profile
    // the owner believes is protected and isn't. Leave the field out to opt out.
    if (body.password !== undefined && body.password !== null) {
      const pw = String(body.password);
      if (pw.length < MIN_PASSWORD) throw Object.assign(new Error(`Passwords need at least ${MIN_PASSWORD} characters.`), { status: 400 });
      p.auth = await hashPassword(pw);
      const made = await createVault(pw);
      p.vault = made.vault;
      setDataKey(p.id, made.key);
    }
    p.pathway = p.course === 'nsw' ? (cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null)) : null;
    p.indiaTrack = p.course === 'in' ? cleanIndiaTrack(body.indiaTrack, p.year) : null;
    // The day boundary for streaks and daily goals: the profile's own IANA
    // timezone if it named a real one, else the course's home (Asia/Kolkata
    // for India, Australia/Sydney for the Australian syllabuses).
    p.timezone = cleanTimezone(body.timezone) || defaultTimezone(p.course);
    await setProfileEmail(p, email);
    await put('profiles', p);
    setCurrentPid(p.id);
    return { user: await publicUser(p) };
  },
  'POST /profiles/select': async ({ id, password }) => {
    const p = await get('profiles', id);
    if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 });
    if (!p.auth) {
      p.lastActiveAt = Date.now();
      await put('profiles', p);
      setCurrentPid(id);
      return { user: await publicUser(p) };
    }
    if (!password) throw Object.assign(new Error('This profile is protected — enter its password.'), { status: 401, needsPassword: true });
    const opened = await withPassword(id, password, openProfileData);
    setCurrentPid(id);
    opened.lastActiveAt = Date.now();
    await put('profiles', opened);
    return { user: await publicUser(opened) };
  },
  // Deleting a profile is final, so it always costs something: the password on a
  // protected profile, an explicit confirmation on one without. The two refusals
  // carry different shapes so the UI knows which to ask for.
  //
  // The password is spent on the key as well as on the check. A teacher's
  // classes and tasks carry nothing in the clear that says whose they are, so
  // the wipe has to open them to take them, and only this password opens them.
  'POST /profiles/delete': async (body) => {
    const { id, password, confirm } = body || {};
    const p = await get('profiles', id);
    if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 });
    if (p.auth) {
      if (!password) throw Object.assign(new Error('Enter this profile’s password to delete it.'), { status: 401, needsPassword: true });
      await withPassword(id, password, takeDataKey);
    } else if (confirm !== true) {
      throw Object.assign(new Error('Deleting this profile erases its work for good.'), { status: 400, needsConfirm: true });
    }
    await wipeProfile(id);
    if (currentPid() === id) setCurrentPid(null);
    return { ok: true };
  },
  'POST /profiles/password': async (body) => {
    const p = await requireProfile();
    const { current, next, confirm } = body || {};
    const wanted = next !== undefined && next !== null && String(next) !== '';
    if (wanted && String(next).length < MIN_PASSWORD) {
      throw Object.assign(new Error(`Passwords need at least ${MIN_PASSWORD} characters.`), { status: 400 });
    }

    if (p.auth) {
      if (!current) throw Object.assign(new Error('Enter your current password.'), { status: 401, needsPassword: true });
      const fresh = await withPassword(p.id, current, async (row) => {
        if (wanted) {
          const pw = String(next);
          row.auth = await hashPassword(pw);
          row.vault = await rewrapVault(dataKeyFor(row.id), pw);
          return;
        }
        const address = await profileEmail(row);
        await decryptRows(row.id);
        delete row.auth;
        delete row.vault;
        await setProfileEmail(row, address);
      });
      return { user: await publicUser(fresh) };
    }

    if (!wanted) return { user: await publicUser(p) };
    // Putting a first password on an open profile is a one-way door — there is
    // nothing on this device that could reset it — so it is never silent.
    if (confirm !== true) {
      throw Object.assign(new Error('A password can’t be reset if it’s forgotten — this profile’s work would be gone for good.'), { status: 400, needsConfirm: true });
    }
    return serialize(p.id, async () => {
      const pw = String(next);
      const address = await profileEmail(p);
      p.auth = await hashPassword(pw);
      const made = await createVault(pw);
      p.vault = made.vault;
      setDataKey(p.id, made.key);
      await encryptRows(p.id);
      await setProfileEmail(p, address);
      await put('profiles', p);
      return { user: await publicUser(p) };
    });
  },
  // The account-less demo is an Indian Class 10 student. The legacy NSW demo
  // is still there for the Australian flows — ask for it by course.
  'POST /profiles/demo': async (body) => {
    const course = body?.course === 'nsw' ? 'nsw' : 'in';
    let demo = (await all('profiles')).find(p => p.isDemo && (p.course || 'nsw') === course);
    if (!demo) {
      const { seedDemo } = await import('./demoSeed.js');
      demo = await seedDemo({ course });
    }
    setCurrentPid(demo.id);
    return { user: await publicUser(demo) };
  },
  'POST /auth/logout': async () => { setCurrentPid(null); return { ok: true }; },

  // ---- me ----
  'GET /me': async () => ({ user: await publicUser(await requireProfile()) }),
  'PATCH /me': async (body) => {
    const p = await requireProfile();
    if (body.name !== undefined) p.name = String(body.name).trim().slice(0, 40) || p.name;
    if (body.year !== undefined) p.year = Math.min(12, Math.max(7, Number(body.year) || p.year));
    if (body.pathway !== undefined && p.course === 'nsw') p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
    if (body.year !== undefined && body.pathway === undefined && p.course === 'nsw') p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
    if (body.theme !== undefined && ['dark', 'light'].includes(body.theme)) p.theme = body.theme;
    if (body.dailyGoal !== undefined) p.dailyGoal = Math.min(60, Math.max(3, Number(body.dailyGoal) || p.dailyGoal));
    const courseBefore = p.course || 'nsw';
    if (body.course !== undefined && COURSES[body.course]) p.course = body.course;
    // A profile that never chose its own timezone follows its course when the
    // course changes; one that named a timezone keeps it.
    if (body.timezone !== undefined) p.timezone = cleanTimezone(body.timezone) || defaultTimezone(p.course);
    else if (!cleanTimezone(p.timezone) || (p.course !== courseBefore && p.timezone === defaultTimezone(courseBefore))) p.timezone = defaultTimezone(p.course);
    if (p.course === 'in') {
      p.pathway = null;
      p.indiaTrack = cleanIndiaTrack(body.indiaTrack !== undefined ? body.indiaTrack : p.indiaTrack, p.year);
    } else {
      p.indiaTrack = null;
      if (p.course === 'nsw') p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
      else p.pathway = null;
    }
    if (body.avatar !== undefined) p.avatar = String(body.avatar).slice(0, 4);
    if (body.handwriting !== undefined) p.handwriting = !!body.handwriting;
    // Server-side handwriting reading is off unless the student turns it on:
    // it is the one setting that sends their work off the device.
    if (body.cloudHandwriting !== undefined) p.cloudHandwriting = body.cloudHandwriting === true;
    if (body.cloudMarking !== undefined) p.cloudMarking = body.cloudMarking === true;
    if (body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
      if (email && !EMAIL_RE.test(email)) throw Object.assign(new Error('That email doesn’t look right.'), { status: 400 });
      if (email && await emailTaken(email, p.id)) {
        throw Object.assign(new Error('That email can’t be used on this device.'), { status: 409 });
      }
      await setProfileEmail(p, email);
    }
    await put('profiles', p);
    return { user: await publicUser(p) };
  },

  // ---- curriculum ----
  'GET /curriculum': async () => {
    const p = await requireProfile();
    const ratings = await ratingsFor(p.id);
    const reviews = await byIndex('reviews', 'pid', p.id);
    const due = new Set(reviews.filter(r => r.dueAt <= Date.now()).map(r => r.subtopic));
    const now = Date.now();
    if (p.course === 'in') {
      const product = indiaProductSections();
      const trackId = cleanIndiaTrack(p.indiaTrack, p.year);
      const { own, aheadIds, aheadUnlocked } = indiaPool(trackId, p.year, ratings, now);
      const ownIds = new Set(own.map(c => c.id));
      const decorate = chapter => {
        const state = indiaState(chapter, ratings, now);
        const chapterRow = ratings[chapter.id] || null;
        const dotpoints = chapter.dotpoints.map((text, ordinal) => {
          const covers = (chapter.covers || []).filter(c => c.dp.includes(ordinal));
          const forms = [...new Set(covers.flatMap(c => c.diff || []))].sort((a, b) => a - b);
          const d = indiaDotpointState(chapter, ordinal, chapterRow, ratings, now);
          const m = d.attempts ? masteryOf(d.rating, d.attempts, d.last_at, now) : 0;
          return { id: `${chapter.id}#${ordinal}`, key: String(ordinal), text, difficulties: forms, mastery: Math.round(m * 100), band: d.attempts ? masteryBand(m) : 'unseen', attempts: d.attempts, correct: d.correct, generated: forms.length > 0 };
        });
        const ahead = aheadIds.has(chapter.id);
        return {
          id: chapter.id, name: chapter.name, strand: chapter.strand, weight: chapter.weight, code: null, dotpoints,
          year: indiaChapterGrade(chapter),
          mastery: Math.round(state.mastery * 100), band: state.attempts ? masteryBand(state.mastery) : 'unseen',
          attempts: state.attempts, correct: state.correct,
          due: due.has(chapter.id) || (state.legacy && indiaGeneratorIds(chapter).some(id => due.has(id))),
          rating: state.attempts ? Math.round(state.rating) : null,
          // `ahead` is the year ahead of the student's class on a JEE track;
          // `smart` says whether smart practice draws on it yet. Explicit
          // choice is never gated.
          ahead, smart: ownIds.has(chapter.id) || (ahead && aheadUnlocked)
        };
      };
      const years = product.years.map(section => ({
        year: section.year, key: section.key, track: section.track, title: section.title, caption: section.caption,
        courseLabel: section.label, difficultyFloor: section.difficultyFloor, difficultyCeiling: section.difficultyCeiling, subtopics: section.chapters.map(decorate)
      }));
      const streams = product.streams.map(section => ({
        year: section.year, allYears: !!section.allYears, key: section.key, track: section.track, title: section.title, caption: section.caption,
        courseLabel: section.label, difficultyFloor: section.difficultyFloor, difficultyCeiling: section.difficultyCeiling, subtopics: section.chapters.map(decorate)
      }));
      return { country: 'in', years, streams, userYear: p.year, pathway: null, course: 'in', indiaTrack: trackId, aheadUnlocked, window: indiaDifficultyWindow(trackId, p.year) };
    }
    /** Dot points with their own mastery, and an honest `generated` flag. */
    const dotpointRows = (s, st) => dotpointsFor(s.id).map(dp => {
      const d = dpStateOf(st, dp.id);
      const m = d.attempts ? masteryOf(d.rating, d.attempts, d.last_at, now) : 0;
      return {
        id: dp.id, key: dp.key, text: dp.text, difficulties: dp.forms,
        mastery: Math.round(m * 100), band: d.attempts ? masteryBand(m) : 'unseen',
        attempts: d.attempts, correct: d.correct,
        generated: dotpointIsGeneratable(dp)
      };
    });
    const years = CURRICULUM.map(y => ({
      year: y.year, title: y.title, caption: y.caption,
      courseLabel: courseLabel(p.course || 'nsw', y.year),
      subtopics: y.subtopics.map(s => {
        const st = ratings[s.id];
        const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
        return {
          id: s.id, name: s.name, strand: s.strand, weight: s.weight, code: s.code || null,
          dotpoints: dotpointRows(s, st),
          mastery: Math.round(m * 100), band: st ? masteryBand(m) : 'unseen',
          attempts: st?.attempts || 0, correct: st?.correct || 0,
          due: due.has(s.id), rating: st?.rating || null
        };
      })
    }));
    // Senior pathway streams: appended as extra sections for Years 11–12
    const pw = pathwayOf(p);
    const streamKeys = p.year >= 11
      ? (pw === 'standard' ? ['standard-11', 'standard-12']
        : pw === 'ext1' ? ['ext1-11', 'ext1-12']
        : pw === 'ext2' ? ['ext1-11', 'ext1-12', 'ext2-12'] : [])
      : [];
    const streams = streamKeys.map(key => {
      const grp = STREAM_CURRICULUM[key];
      const yr = Number(key.split('-')[1]);
      return {
        year: yr, key, stream: true, title: grp.title, caption: grp.caption,
        courseLabel: PATHWAYS[pw]?.name || '',
        subtopics: streamSubtopics(key).map(s2 => {
          const st = ratings[s2.id];
          const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
          return {
            id: s2.id, name: s2.name, strand: s2.strand, weight: s2.weight, code: s2.code,
            dotpoints: dotpointRows(s2, st),
            mastery: Math.round(m * 100), band: st ? masteryBand(m) : 'unseen',
            attempts: st?.attempts || 0, correct: st?.correct || 0,
            due: due.has(s2.id), rating: st?.rating || null
          };
        })
      };
    });
    return { years, streams, userYear: p.year, pathway: p.year >= 11 ? pw : null, course: p.course || 'nsw' };
  },

  // ---- practice ----
  'POST /practice/next': async (body) => {
    const p = await requireProfile();
    const { mode = 'smart', subtopic, difficulty, dotpoint, taskId, track } = body || {};
    // Task-driven question
    if (taskId) {
      const task = await get('tasks', taskId);
      if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });
      const tp = await get('taskProgress', `${taskId}:${p.id}`);
      const done = tp?.done || 0;
      if (task.mode === 'custom' && task.customIds?.length) {
        const cq = await get('customQs', task.customIds[done % task.customIds.length]);
        if (cq) {
          const { row, payload } = await createQuestion(p.id, 'custom', cq.difficulty || 2, 'task', null, taskId, cq.q);
          return { question: sanitize(payload, row), reason: 'task', why: `Task: ${task.title} — question ${done + 1} of ${task.count}.` };
        }
      }
      // An India-targeted task (NCERT chapter / dot point / track) is served
      // through the same resolver as India practice, so the question carries
      // the chapter it was set for rather than an NSW subtopic name.
      if (Array.isArray(task.targets) && task.targets.length) {
        const nowMs = Date.now();
        const target = task.targets[done % task.targets.length];
        const chapter = indiaChapter(target.chapterId);
        if (!chapter) throw Object.assign(new Error('That task targets an India chapter this app no longer knows.'), { status: 409, code: 'INDIA_TARGET_UNCOVERED' });
        const grade = indiaChapterGrade(chapter) || p.year;
        const trackId = cleanIndiaTrack(target.track || p.indiaTrack, grade);
        const ratings = await ratingsFor(p.id);
        const state = indiaState(chapter, ratings, nowMs);
        const want = target.difficulty != null ? Number(target.difficulty) : pickDifficulty(state.rating, state.attempts, { state, nowMs });
        const resolved = resolveIndiaTarget(chapter, { dotpoint: target.dotpoint, difficulty: want, track: trackId, grade });
        const { row, payload } = await createIndiaQuestion(p.id, chapter, resolved, 'task', trackId, null, taskId);
        return {
          question: sanitize(payload, row), reason: 'task',
          why: `Task: ${task.title} — question ${done + 1} of ${task.count}.`,
          dotpoint: resolved.dotpointIndex, target: state.mastery, misconception: null
        };
      }
      if (!task.subtopics?.length) throw Object.assign(new Error('That task has no topics to practise.'), { status: 409 });
      const sub = task.subtopics[done % task.subtopics.length];
      const st = await getRating(p.id, sub);
      const aim = pickDifficulty(st?.rating ?? START_RATING, st?.attempts ?? 0, { state: st || {}, nowMs: Date.now() });
      const { dp, difficulty: d } = chooseDotpoint(sub, st, { want: aim });
      const { row, payload } = await createQuestion(p.id, sub, d, 'task', null, taskId, null, { dotpointId: dp?.id || null });
      return { question: sanitize(payload, row), reason: 'task', why: `Task: ${task.title} — question ${done + 1} of ${task.count}.` };
    }
    const now = Date.now();
    if (p.course === 'in' && !taskId) {
      const trackId = cleanIndiaTrack(track || p.indiaTrack, p.year);
      const ratings = await ratingsFor(p.id);
      const chapter = subtopic ? indiaChapter(subtopic) : null;
      if (subtopic && !chapter) throw Object.assign(new Error('That topic is not part of the India syllabus.'), { status: 404, code: 'INDIA_TOPIC_NOT_FOUND' });
      const reviews = await byIndex('reviews', 'pid', p.id);
      const pick = indiaPick(p, trackId, ratings, reviews, now, {
        chapter, dotpoint, difficulty: difficulty != null && difficulty !== '' ? difficulty : null, rand: Math.random()
      });
      const { row, payload, trapKey } = await createIndiaQuestion(
        p.id, pick.chapter, pick.target, pick.reason === 'review' ? 'review' : 'practice', trackId, null, null, pick.trap?.key || null
      );
      // Only what the optimiser chose feeds the interleaving memory: a chapter
      // the student asked for by name is their sitting, not the picker's.
      if (!pick.explicit) { noteServed(p.id, pick.chapter.id); noteServedDotpoint(p.id, pick.dotpointKey); }
      return {
        question: sanitize(payload, row), reason: pick.reason, reasonTag: pick.reasonTag, why: pick.why, nextUp: pick.nextUp,
        dotpoint: pick.target.dotpointIndex, target: pick.successTarget ?? null,
        misconception: trapKey ? pick.trap?.label || null : null,
        windowed: pick.target.windowed !== false, aheadUnlocked: pick.aheadUnlocked
      };
    }
    let choice;
    if (mode === 'topic' && subtopic && SUBTOPIC_BY_ID[subtopic]) {
      const sub = SUBTOPIC_BY_ID[subtopic];
      const st = await getRating(p.id, subtopic);
      const asked = dotpointOf(subtopic, dotpoint);
      const real = dotpointIsGeneratable(asked);
      const dpState = asked ? dpStateOf(st, asked.id) : null;
      // Difficulty is read off whichever rating actually describes what is
      // about to be asked: the dot point's own when one is in play, the
      // subtopic's otherwise.
      const basis = dpState && dpState.attempts ? dpState
        : { rating: st?.rating ?? START_RATING, attempts: st?.attempts ?? 0, correct: st?.correct ?? 0, last_at: st?.last_at ?? 0 };
      let d = difficulty
        ? Math.min(4, Math.max(1, Number(difficulty)))
        : pickDifficulty(basis.rating, basis.attempts, {
          state: { ...basis, trapPressure: trapPressureOf(st?.traps, now), recentWrong: recentWrongOf(st) }, nowMs: now
        });
      // Only the difficulties whose authored form exercises this dot point can
      // deliver it, so the choice is snapped into that set rather than sent as
      // a wish the generator has to talk itself out of.
      if (real && !difficulty) d = nearestForm(asked.forms, d);
      // "Practise this topic" with no dot point named still gets practised at
      // dot-point resolution: the one inside it with the least behind it wins.
      let auto = null;
      if (!asked) {
        const chosen = chooseDotpoint(subtopic, st, {
          fixed: difficulty ? d : null, want: d, prefer: activeTraps(st?.traps, now)[0]?.dotpoint || null, nowMs: now
        });
        auto = chosen.dp;
        d = chosen.difficulty;
      }
      // Two explanations, and which one is sent is decided after the question
      // exists — because until the bank has built it, whether it really lands
      // on that dot point is a guess. Where no authored form exercises the
      // requested dot point at all, the reply says the topic is the target.
      // Claiming otherwise would be worse than not having the feature.
      const whyPlain = asked && !real
        ? `Focused practice on ${sub.name} — no question form covers this dot point on its own yet.`
        : `Focused practice on ${sub.name}.`;
      choice = {
        subtopic, difficulty: d, reason: 'topic', dotpoint: real ? asked.id : (auto?.id || null),
        trap: activeTraps(st?.traps, now)[0] || null,
        whyPlain,
        why: real ? `Focused on this dot point: ${asked.text}`
          : auto ? `Focused practice on ${sub.name}. Dot point: ${auto.text}`
            : whyPlain
      };
    } else {
      const ratings = await ratingsFor(p.id);
      const reviews = await byIndex('reviews', 'pid', p.id);
      const reviewsDue = reviews.filter(r => r.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
      choice = pickNext({
        ratings, reviewsDue, year: p.year, pathway: pathwayOf(p),
        rand: Math.random(), recent: recentlyServed(p.id), nowMs: now
      });
      if (difficulty) choice = { ...choice, difficulty: Math.min(4, Math.max(1, Number(difficulty))) };
      // Within the chosen subtopic, aim at the dot point that needs it most —
      // but only ever at one the bank can really produce.
      const chosen = chooseDotpoint(choice.subtopic, ratings[choice.subtopic], {
        fixed: difficulty ? choice.difficulty : null, want: choice.difficulty,
        prefer: choice.trap?.dotpoint || null, nowMs: now
      });
      choice.whyPlain = choice.why;
      if (chosen.dp) {
        choice = { ...choice, dotpoint: chosen.dp.id, difficulty: chosen.difficulty, why: `${choice.why} Dot point: ${chosen.dp.text}` };
      }
      noteServed(p.id, choice.subtopic);
    }
    const focus = { dotpointId: choice.dotpoint || null, trapKey: choice.trap?.key || null };
    const { row, payload, dotpoint: served, trapKey } = await createQuestion(
      p.id, choice.subtopic, choice.difficulty, choice.reason === 'review' ? 'review' : 'practice', null, null, null, focus
    );
    return {
      question: sanitize(payload, row), reason: choice.reason,
      why: served || !choice.dotpoint ? choice.why : choice.whyPlain,
      dotpoint: served, target: choice.target ?? null,
      misconception: trapKey ? choice.trap?.label || null : null
    };
  },

  'POST /practice/:id/hint': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    const q = row.payload;
    const hints = q.hints || [];
    if (!hints.length) return { hint: 'No hints for this one — trust your instincts!', level: 0, remaining: 0 };
    const used = Math.min((row.hintsUsed || 0) + 1, hints.length);
    row.hintsUsed = used;
    await put('questions', row);
    return { hint: hints[used - 1], level: used, remaining: hints.length - used };
  },

  'POST /practice/:id/submit': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    if (row.answered) throw Object.assign(new Error('Already answered'), { status: 409 });
    const q = row.payload;
    const { answer, ms, steps, viaInk, ink, photo, scribble } = body || {};

    const result = checkAnswer(q, answer);
    let feedback = result.feedback;
    if (!result.correct && q.answerType === 'mcq' && q.answer.optionTraps) {
      feedback = q.answer.optionTraps[Number(answer)] || feedback;
    }
    let stepReport = null;
    const meta0 = stepMetaFor(q);
    if (steps && meta0) {
      try { stepReport = stepCheck(meta0, steps); } catch { stepReport = null; }
    }
    // Working-type questions mark every submitted line — surface that report
    if (!stepReport && result.stepReport) stepReport = result.stepReport;
    // Method marks under the exam rule: a wrong answer with working that moves
    // the solution on earns marks for those lines; restating the question does
    // not. Practice and exams share methodMarks() so the two never disagree.
    let partial = null;
    if (!result.correct && !result.invalid && steps && String(steps).trim() && meta0) {
      try {
        const mm = methodMarks({ meta: meta0, working: String(steps), marks: criteriaFor(q).length, prompt: q.prompt, report: stepReport });
        if (mm) partial = { okLines: mm.okLines, awarded: mm.awarded, note: mm.note };
      } catch { partial = null; }
    }
    // A wrong answer that landed on a designed distractor is not a random miss:
    // the trap names the misconception behind it. Counted here, before the
    // two-try branch below, because the first attempt is the honest evidence.
    // Where the working itself names the misstep, that is counted instead — the
    // distractor infers the mistake, the working shows it.
    let trapHit = null;
    if (!result.correct && !result.invalid) {
      trapHit = await recordTrap(p.id, row, q, feedback);
      if (!trapHit) trapHit = await recordStepTrap(p.id, row, q, stepReport?.diagnosis);
    }
    // The student's own work is stored before any early return below. A first
    // wrong answer sends them back for another try, and losing the ink at that
    // point would mean their handwriting could never be replayed in History and
    // the marker would have nothing to draw its per-line ticks on — the attempt
    // they most want to look back at is the one they got wrong.
    const scribbleStrokes = Array.isArray(scribble) && scribble.length ? safeStrokes(scribble, 400) : null;
    if ((ink && ink.strokes?.length) || photo || scribbleStrokes) {
      await put('inks', {
        id: row.id, pid: p.id, strokes: safeStrokes(ink?.strokes, 4000), recognized: sanitizeText(ink?.recognized, 500) || null,
        photo: safePhoto(photo),
        scribble: scribbleStrokes,
        createdAt: Date.now()
      });
    }

    const isFast = row.mode === 'rush' || row.mode === 'match';
    if (!result.correct && !result.invalid && !isFast && (row.tries || 0) < 1) {
      row.tries = (row.tries || 0) + 1;
      await put('questions', row);
      return { correct: false, resolved: false, triesLeft: 1, feedback: feedback || 'Not quite — check your working and try once more.', stepReport, partial, diagnosis: stepReport?.diagnosis || null, misconception: await namedTrap(p.id, evidenceKeyOf(row, q), trapHit) };
    }
    if (result.invalid && !isFast) {
      return { correct: false, resolved: false, triesLeft: Math.max(0, 1 - (row.tries || 0)), invalid: true, feedback, stepReport };
    }
    const meta = await resolve(p, row, q, result.correct, answer, ms, row.mode, !!viaInk);
    return {
      correct: result.correct, resolved: true, feedback, stepReport, partial,
      diagnosis: stepReport?.diagnosis || null,
      misconception: await namedTrap(p.id, evidenceKeyOf(row, q), trapHit),
      solution: { steps: q.steps, answerText: displayAnswer(q), criteria: criteriaFor(q), solutionText: q.solutionText },
      ...meta
    };
  },

  'POST /practice/:id/reveal': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    if (row.answered) throw Object.assign(new Error('Already answered'), { status: 409 });
    const q = row.payload;
    const meta = await resolve(p, row, q, false, 'revealed', body?.ms || 0, row.mode);
    return { correct: false, resolved: true, revealed: true, solution: { steps: q.steps, answerText: displayAnswer(q), criteria: criteriaFor(q), solutionText: q.solutionText }, ...meta };
  },

  // ---- reviews ----
  'GET /reviews': async () => {
    const p = await requireProfile();
    const now = Date.now();
    const rows = (await byIndex('reviews', 'pid', p.id)).sort((a, b) => a.dueAt - b.dueAt);
    // `recall` is the model's estimate of how much of this is still there right
    // now, which is the thing a student can act on — an interval is only the
    // bookkeeping behind it.
    const decorate = r => {
      const st = migrateReview(r, now);
      // An Indian profile's rows are named through the Indian spine — the
      // chapter, or the generator a row written before chapter keying carries —
      // and never through the NSW table.
      const named = p.course === 'in' ? indiaNameOf(r.subtopic, { grade: p.year }) : null;
      const sub = p.course === 'in' ? null : SUBTOPIC_BY_ID[r.subtopic];
      return {
        subtopic: r.subtopic, due_at: r.dueAt, interval_days: r.intervalDays,
        recall: Math.round(100 * retrievability(Math.max(0, (now - st.lastAt) / DAY), st.stability)),
        stability_days: Math.round(st.stability * 10) / 10, lapses: st.lapses, reps: st.reps,
        name: named ? named.name : (p.course === 'in' ? r.subtopic : sub?.name),
        year: named ? named.year : (p.course === 'in' ? null : sub?.year),
        strand: named ? named.strand : (p.course === 'in' ? null : sub?.strand)
      };
    };
    return {
      due: rows.filter(r => r.dueAt <= now).map(decorate),
      upcoming: rows.filter(r => r.dueAt > now && r.dueAt < now + 7 * DAY).map(decorate)
    };
  },

  // ---- exams ----
  'POST /exams': async (body) => {
    const p = await requireProfile();
    const length = [10, 15, 20].includes(Number(body?.length)) ? Number(body.length) : 10;
    const minutes = Math.min(90, Math.max(10, Number(body?.minutes) || (length * 3)));
    const year = Math.min(12, Math.max(7, Number(body?.year) || p.year));
    const examPw = year >= 11 ? (cleanPathway(p.pathway, year) || 'advanced') : null;
    const subtopics = examPw ? scopeForYear(year, examPw).own : subtopicsForYear(year);
    const diffs = [];
    for (let i = 0; i < length; i++) { const t = i / length; diffs.push(t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4); }
    const bag = [];
    for (const s of subtopics) for (let i = 0; i < Math.max(1, Math.round(s.weight / 3)); i++) bag.push(s.id);
    const examId = uuid();
    const qids = [];
    let lastPick = null;
    for (let i = 0; i < length; i++) {
      let pick = bag[Math.floor(Math.random() * bag.length)];
      let guard = 20;
      while (pick === lastPick && guard--) pick = bag[Math.floor(Math.random() * bag.length)];
      lastPick = pick;
      const { row } = await createQuestion(p.id, pick, diffs[i], 'exam', examId);
      qids.push(row.id);
    }
    // Section II: one structured multipart question, HSC-style
    const { multipartForYear, generateMultipart } = await loadMultipart();
    const mpIds = multipartForYear(year, examPw || 'advanced');
    if (mpIds.length) {
      const mpId = mpIds[Math.floor(Math.random() * mpIds.length)];
      const mp = generateMultipart(mpId);
      const mpRow = { id: uuid(), pid: p.id, subtopic: mpId, difficulty: 3, payload: mp, mode: 'exam', examId, taskId: null, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now() };
      await put('questions', mpRow);
      qids.push(mpRow.id);
    }
    const count = (await byIndex('exams', 'pid', p.id)).length;
    const pwLabel = examPw && examPw !== 'advanced' ? ` ${PATHWAYS[examPw].short}` : '';
    const exam = { id: examId, pid: p.id, year, pathway: examPw, title: `Year ${year}${pwLabel} Practice Paper ${count + 1}`, durationMin: minutes, questionIds: qids, createdAt: Date.now(), finishedAt: null, score: null, total: null, detail: null };
    await put('exams', exam);
    return { exam: await examFor(p.id, examId) };
  },
  'GET /exams': async () => {
    const p = await requireProfile();
    const rows = (await byIndex('exams', 'pid', p.id)).sort((a, b) => b.createdAt - a.createdAt);
    return { exams: rows.map(e => ({ id: e.id, title: e.title, year: e.year, duration_min: e.durationMin, created_at: e.createdAt, finished_at: e.finishedAt, score: e.score, total: e.total })) };
  },
  'GET /exams/:id': async (body, params) => {
    const p = await requireProfile();
    const exam = await examFor(p.id, params.id);
    if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
    return { exam };
  },
  'GET /exams/:id/paper': async (body, params) => {
    const p = await requireProfile();
    const e = await get('exams', params.id);
    if (!e || e.pid !== p.id) throw Object.assign(new Error('Exam not found'), { status: 404 });
    const questions = [];
    for (const qid of e.questionIds) {
      const row = await get('questions', qid);
      const q = row.payload;
      if (q.multipart) {
        questions.push({
          multipart: true, stem: q.stem, title: q.title, figure: safeFigure(q.figure),
          subtopicName: q.title, difficulty: q.difficulty,
          parts: q.parts.map(pt => ({
            key: pt.key, prompt: pt.prompt, marks: pt.marks, answerType: pt.answerType, mcqOptions: pt.mcqOptions,
            answerText: displayAnswer({ answerType: pt.answerType, answer: pt.answer, mcqOptions: pt.mcqOptions, answerPrefix: pt.answerPrefix, answerSuffix: pt.answerSuffix }),
            steps: pt.steps
          })),
          criteria: q.parts.map(pt => ({ mark: pt.marks, text: `Part (${pt.key})` }))
        });
        continue;
      }
      questions.push({
        prompt: q.prompt, difficulty: q.difficulty, subtopicName: SUBTOPIC_BY_ID[q.subtopic]?.name,
        answerType: q.answerType, mcqOptions: q.mcqOptions, figure: safeFigure(q.figure),
        answerText: displayAnswer(q), steps: q.steps, criteria: criteriaFor(q)
      });
    }
    return { title: e.title, year: e.year, durationMin: e.durationMin, course: courseLabel(p.course || 'nsw', e.year, e.pathway), questions };
  },
  'POST /exams/:id/submit': async (body, params) => {
    const p = await requireProfile();
    const e = await get('exams', params.id);
    if (!e || e.pid !== p.id) throw Object.assign(new Error('Exam not found'), { status: 404 });
    if (e.finishedAt) throw Object.assign(new Error('Exam already submitted'), { status: 409 });
    const answers = body?.answers || {};
    const workings = body?.workings || {};
    const totalMs = Number(body?.ms) || 0;
    const now = Date.now();
    const nQ = e.questionIds.length;
    let marksAwarded = 0, totalMarks = 0;
    const detail = [];
    for (const qid of e.questionIds) {
      const row = await get('questions', qid);
      const q = row.payload;

      // ── Structured multipart question: mark each part on its own marks ──
      if (q.multipart) {
        const partsOut = [];
        let qMarks = 0, qAwarded = 0, allCorrect = true;
        for (const part of q.parts) {
          const given = answers[`${qid}::${part.key}`];
          const synth = { answerType: part.answerType, answer: part.answer, mcqOptions: part.mcqOptions, traps: part.traps };
          const result = given === undefined || given === null || given === '' ? { correct: false } : checkAnswer(synth, given);
          const awarded = result.correct ? part.marks : 0;
          qMarks += part.marks; qAwarded += awarded;
          if (!result.correct) allCorrect = false;
          partsOut.push({
            key: part.key, prompt: part.prompt, answerType: part.answerType, mcqOptions: part.mcqOptions,
            given: given ?? '', correct: !!result.correct, marks: part.marks, awarded, feedback: result.feedback,
            answerText: displayAnswer({ answerType: part.answerType, answer: part.answer, mcqOptions: part.mcqOptions, answerPrefix: part.answerPrefix, answerSuffix: part.answerSuffix }),
            steps: part.steps
          });
        }
        totalMarks += qMarks; marksAwarded += qAwarded;
        if (!row.answered) {
          row.answered = 1;
          await put('questions', row);
          const xp = qAwarded * 6;
          p.xp = (p.xp || 0) + xp;
          await put('profiles', p);
          await bumpActivity(p.id, { correct: allCorrect, xp, ms: Math.round(totalMs / nQ) }, now, timezoneOf(p));
          await add('attempts', {
            pid: p.id, questionId: row.id, subtopic: q.multipartId, difficulty: 3,
            correct: allCorrect ? 1 : 0, answerGiven: `${qAwarded}/${qMarks} marks`, ms: Math.round(totalMs / nQ),
            hintsUsed: 0, mode: 'exam', viaInk: false, ratingBefore: 0, ratingAfter: 0, createdAt: now
          });
        }
        detail.push({
          id: qid, multipart: true, title: q.title, stem: q.stem, figure: safeFigure(q.figure),
          subtopicName: q.title, difficulty: q.difficulty,
          marks: qMarks, awarded: qAwarded, correct: allCorrect, parts: partsOut
        });
        continue;
      }

      // ── Single question: full marks when correct, partial credit from working ──
      const crit = criteriaFor(q);
      const qMarks = crit.length;
      const given = answers[qid];
      const result = given === undefined || given === null || given === '' ? { correct: false } : checkAnswer(q, given);
      let awarded = result.correct ? qMarks : 0;
      let partial = null;
      const wk = workings[qid];
      const metaQ = stepMetaFor(q);
      if (!result.correct && wk && String(wk).trim() && metaQ) {
        // The same rule Practice applies: restating the question earns
        // nothing; each verified line that moves the solution on earns one
        // mark, capped one below the question's marks.
        try {
          const mm = methodMarks({ meta: metaQ, working: String(wk), marks: qMarks, prompt: q.prompt });
          if (mm) {
            awarded = mm.awarded;
            partial = { okLines: mm.okLines, awarded: mm.awarded, note: mm.note };
          }
        } catch { }
      }
      totalMarks += qMarks; marksAwarded += awarded;
      // An exam answer that landed on a designed distractor is the same
      // evidence a practice one is, and under exam conditions it is better
      // evidence — so it is counted here too.
      if (!row.answered && !result.correct) await recordTrap(p.id, row, q, result.feedback);
      if (!row.answered) await resolve(p, row, q, !!result.correct, given ?? '', Math.round(totalMs / nQ), 'exam');
      detail.push({
        id: qid, subtopic: q.subtopic, subtopicName: SUBTOPIC_BY_ID[q.subtopic]?.name,
        difficulty: q.difficulty, prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions, figure: safeFigure(q.figure),
        given: given ?? '', correct: !!result.correct, feedback: result.feedback,
        marks: qMarks, awarded, partial, working: wk ? String(wk) : null,
        solution: { steps: q.steps, answerText: displayAnswer(q), criteria: crit }
      });
    }
    const pct = Math.round(100 * marksAwarded / Math.max(1, totalMarks));
    Object.assign(e, { finishedAt: now, score: marksAwarded, total: totalMarks, detail });
    await put('exams', e);
    const newBadges = await checkBadges(p.id, { type: 'exam', pct }, now, timezoneOf(p));
    return { score: marksAwarded, total: totalMarks, pct, detail, newBadges };
  },

  // ---- rush ----
  'POST /rush/start': async () => {
    const p = await requireProfile();
    const { own, revision } = scopeForYear(p.year, pathwayOf(p));
    const pool = [...own, ...revision];
    const questions = [];
    for (let i = 0; i < 20; i++) {
      const s = pool[Math.floor(Math.random() * pool.length)];
      const d = Math.random() < 0.7 ? 1 : 2;
      const { row, payload } = await createQuestion(p.id, s.id, d, 'rush');
      questions.push(sanitize(payload, row));
    }
    return { questions, seconds: 90 };
  },
  'POST /rush/answer': async (body) => {
    const p = await requireProfile();
    const row = await get('questions', body.id);
    if (!row || row.pid !== p.id || row.mode !== 'rush' && row.mode !== 'match') throw Object.assign(new Error('Question not found'), { status: 404 });
    if (row.answered) throw Object.assign(new Error('Already answered'), { status: 409 });
    const q = row.payload;
    const result = checkAnswer(q, body.answer);
    await resolve(p, row, q, result.correct, body.answer, 0, row.mode);
    return { correct: result.correct, answerText: displayAnswer(q) };
  },
  'POST /rush/finish': async (body) => {
    const p = await requireProfile();
    const score = Math.max(0, Math.min(20, Number(body.correct) || 0));
    const now = Date.now();
    await add('rushRuns', { pid: p.id, score, correct: score, total: Math.max(score, Number(body.total) || 0), bestCombo: Number(body.bestCombo) || 0, createdAt: now });
    const runs = await byIndex('rushRuns', 'pid', p.id);
    const best = Math.max(...runs.map(r => r.score));
    const newBadges = await checkBadges(p.id, { type: 'rush', score }, now, timezoneOf(p));
    return { score, best, newBadges };
  },

  // ---- match mode ----
  'POST /match/start': async (body) => {
    const p = await requireProfile();
    const rivals = {
      rookie: { name: 'Robo-Rookie', avatar: '🤖', secPerQ: 22, accuracy: 0.62 },
      pro: { name: 'Captain Cosine', avatar: '🦾', secPerQ: 14, accuracy: 0.78 },
      legend: { name: 'The Integrator', avatar: '👾', secPerQ: 9, accuracy: 0.9 }
    };
    const rival = rivals[body?.rival] || rivals.rookie;
    const strandPick = body?.strand; // 'Algebra' | 'Calculus' | 'Statistics & Probability' | undefined
    const { own, revision } = scopeForYear(p.year, pathwayOf(p));
    let pool = [...own, ...revision];
    if (strandPick) {
      const filtered = pool.filter(s => strandPick === 'Calculus' ? s.strand === 'Calculus' : s.strand === strandPick);
      if (filtered.length) pool = filtered;
    }
    const questions = [];
    for (let i = 0; i < 10; i++) {
      const s = pool[Math.floor(Math.random() * pool.length)];
      const d = Math.random() < 0.6 ? 1 : 2;
      const { row, payload } = await createQuestion(p.id, s.id, d, 'match');
      questions.push(sanitize(payload, row));
    }
    return { questions, rival, total: 10 };
  },
  'POST /match/finish': async (body) => {
    const p = await requireProfile();
    const now = Date.now();
    const won = !!body.won;
    await add('matchRuns', { pid: p.id, won, playerScore: Number(body.playerScore) || 0, rivalScore: Number(body.rivalScore) || 0, rival: String(body.rival || ''), ms: Number(body.ms) || 0, createdAt: now });
    const runs = await byIndex('matchRuns', 'pid', p.id);
    const newBadges = await checkBadges(p.id, { type: 'match', won }, now, timezoneOf(p));
    return { won, wins: runs.filter(r => r.won).length, played: runs.length, newBadges };
  },
  'GET /match/history': async () => {
    const p = await requireProfile();
    const runs = (await byIndex('matchRuns', 'pid', p.id)).sort((a, b) => b.createdAt - a.createdAt);
    return {
      played: runs.length, wins: runs.filter(r => r.won).length,
      recent: runs.slice(0, 8).map(r => ({ won: r.won, playerScore: r.playerScore, rivalScore: r.rivalScore, rival: r.rival, at: r.createdAt }))
    };
  },

  // ---- stats / badges / report ----
  'GET /stats': async () => {
    const p = await requireProfile();
    const now = Date.now();
    const pid = p.id;
    const ratings = await ratingsFor(pid);
    if (p.course === 'in') return indiaStats(p, ratings, now);
    const pred = predictMark(ratings, p.year, now, pathwayOf(p));
    const misconceptions = namedWeaknesses(ratings, now);
    const notes = Object.fromEntries(misconceptions.map(m => [m.subtopic, `keeps repeating: ${m.label}`]));
    const prio = priorities(ratings, p.year, now, 5, pathwayOf(p), notes);
    const days = await activityFor(pid);
    let lastPred = null;
    const trajectory = days.map(d => { if (d.predicted != null) lastPred = d.predicted; return { date: d.date, predicted: lastPred }; }).filter(d => d.predicted != null);
    const { own, revision } = scopeForYear(p.year, pathwayOf(p));
    const strandAgg = {};
    for (const s of [...own, ...revision]) {
      const st = ratings[s.id];
      const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
      strandAgg[s.strand] = strandAgg[s.strand] || { sum: 0, n: 0 };
      strandAgg[s.strand].sum += m; strandAgg[s.strand].n++;
    }
    const strands = Object.entries(strandAgg).map(([name, v]) => ({ name, mastery: Math.round(100 * v.sum / v.n) }));
    const attempts = await byIndex('attempts', 'pid', pid);
    const totals = { attempts: attempts.length, correct: attempts.filter(a => a.correct).length, ms: attempts.reduce((s, a) => s + (a.ms || 0), 0) };
    const byDiff = [1, 2, 3, 4].map(d => {
      const rows = attempts.filter(a => a.difficulty === d);
      return { difficulty: d, n: rows.length, c: rows.filter(a => a.correct).length };
    }).filter(r => r.n);
    const rushRuns = await byIndex('rushRuns', 'pid', pid);
    const bestRush = rushRuns.length ? Math.max(...rushRuns.map(r => r.score)) : 0;
    const matchRuns = await byIndex('matchRuns', 'pid', pid);
    const exams = await byIndex('exams', 'pid', pid);
    const inkCount = attempts.filter(a => a.viaInk).length;
    const recent = attempts.slice(-15).reverse().map(a => ({ subtopic: a.subtopic, difficulty: a.difficulty, correct: a.correct, created_at: a.createdAt, mode: a.mode, name: SUBTOPIC_BY_ID[a.subtopic]?.name || 'Custom question' }));
    return {
      predicted: pred, trajectory, priorities: prio, strands, misconceptions,
      activity: days.slice(-120), totals, byDiff, bestRush,
      matchWins: matchRuns.filter(r => r.won).length, matchPlayed: matchRuns.length,
      examCount: exams.filter(e => e.finishedAt).length, inkCount, recent,
      streak: await streakFor(pid, now, timezoneOf(p))
    };
  },
  'GET /badges': async () => {
    const p = await requireProfile();
    const earned = await byIndex('badges', 'pid', p.id);
    const map = Object.fromEntries(earned.map(b => [b.badgeId, b.earnedAt]));
    return { badges: BADGES.map(b => ({ ...b, earnedAt: map[b.id] || null })), earnedCount: earned.length, total: BADGES.length };
  },
  'GET /report': async () => {
    const p = await requireProfile();
    const now = Date.now();
    const ratings = await ratingsFor(p.id);
    if (p.course === 'in') {
      // The India report is the India product's own evidence: chapter coverage,
      // attempts, accuracy and mastery. No predicted board/JEE score exists,
      // so none is reported — the same rule the student progress page keeps.
      const trackId = cleanIndiaTrack(p.indiaTrack, p.year);
      const rows = indiaChapterRows(trackId, p.year, ratings, now);
      const evidence = indiaEvidence(rows);
      const attempts = (await byIndex('attempts', 'pid', p.id)).sort((a, b) => a.createdAt - b.createdAt);
      const acts = await activityFor(p.id);
      const weaknesses = indiaWeaknesses(ratings, now);
      return {
        student: {
          name: p.name, year: p.year, course: courseLabel('in', p.year, null, trackId),
          country: 'in', track: trackId, trackName: indiaTrack(trackId, p.year).name
        },
        generatedAt: now, predicted: null, evidence, chapters: rows,
        misconceptions: weaknesses,
        strengths: [...rows].filter(r => r.attempts >= 3).sort((a, b) => b.mastery - a.mastery).slice(0, 3),
        focus: evidence.weakest,
        weekly: acts.slice(-28),
        totals: { attempts: attempts.length, correct: attempts.filter(a => a.correct).length },
        streak: await streakFor(p.id, now, timezoneOf(p)),
        activeDays: activeDaysIn(acts, now, 28, timezoneOf(p)),
        flags: interventionFlags({
          attempts, lastActiveAt: attempts.length ? attempts[attempts.length - 1].createdAt : null,
          sinceMs: p.createdAt || null, overdueTasks: [], weaknesses, nowMs: now
        })
      };
    }
    const pred = predictMark(ratings, p.year, now, pathwayOf(p));
    const { own } = scopeForYear(p.year, pathwayOf(p));
    const rows = own.map(s => {
      const st = ratings[s.id];
      const m = st ? Math.round(100 * masteryOf(st.rating, st.attempts, st.last_at, now)) : 0;
      return { name: s.name, strand: s.strand, mastery: m, attempts: st?.attempts || 0, correct: st?.correct || 0, band: st ? masteryBand(m / 100) : 'unseen' };
    });
    const attempts = await byIndex('attempts', 'pid', p.id);
    const acts = await activityFor(p.id);
    return {
      student: { name: p.name, year: p.year, course: courseLabel(p.course || 'nsw', p.year, pathwayOf(p)) },
      generatedAt: now, predicted: pred, subtopics: rows,
      misconceptions: namedWeaknesses(ratings, now, 6, { india: p.course === 'in', grade: p.year }),
      strengths: [...rows].filter(r => r.attempts >= 3).sort((a, b) => b.mastery - a.mastery).slice(0, 3),
      focus: [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, 3),
      weekly: acts.slice(-28),
      totals: { attempts: attempts.length, correct: attempts.filter(a => a.correct).length },
      streak: await streakFor(p.id, now, timezoneOf(p))
    };
  },

  // ---- classes & tasks (teacher mode, local profiles) ----
  'GET /classes': async () => {
    const p = await requireProfile();
    const classes = (await all('classes')).filter(c => c.teacherPid === p.id);
    const profiles = await all('profiles');
    const out = [];
    const brief = x => ({
      id: x.id, name: x.name, year: x.year, avatar: x.avatar,
      course: x.course || 'nsw', indiaTrack: x.course === 'in' ? cleanIndiaTrack(x.indiaTrack, x.year) : null
    });
    for (const c of classes) {
      const students = profiles.filter(x => c.studentPids.includes(x.id)).map(brief);
      out.push({ ...c, students });
    }
    return { classes: out, allProfiles: profiles.filter(x => (x.role || 'student') === 'student').map(brief) };
  },
  'POST /classes': async (body) => {
    const p = await requireProfile();
    const c = { id: uuid(), name: String(body.name || 'My class').slice(0, 60), teacherPid: p.id, studentPids: [], createdAt: Date.now() };
    await put('classes', c);
    return { class: c };
  },
  'POST /classes/:id/students': async (body, params) => {
    const c = await requireClass(params.id);
    const idList = v => (Array.isArray(v) ? v : []).slice(0, 200).map(safeId).filter(Boolean);
    const joining = idList(body?.add);
    const leaving = new Set(idList(body?.remove));
    const known = new Set((await all('profiles')).map(x => x.id));
    const staying = (c.studentPids || []).filter(id => !leaving.has(id));
    c.studentPids = [...new Set([...staying, ...joining.filter(id => known.has(id))])];
    await put('classes', c);
    // Re-sealing the class alone leaves the homework hanging off it sealed to
    // the OLD roll, so a student enrolled mid-term cannot open a task that
    // already exists — their task list looks empty and starting one 404s. The
    // background repair only runs on the teacher's next password sign-in, which
    // is typically after they have handed the iPad over. Re-seal here, while the
    // teacher's key is in hand and the roll is what they just set.
    for (const t of await all('tasks')) {
      if (t.classId === c.id) await put('tasks', t);
    }
    return { class: c };
  },
  // Bulk roster: a pasted/CSV list of names. A name that matches a student
  // profile already on this device joins the class; any other name becomes a
  // new password-free student profile (India syllabus unless the row says
  // otherwise) and joins. The teacher stays signed in throughout.
  'POST /classes/:id/roster': async (body, params) => {
    const teacher = await requireProfile();
    const c = await requireClass(params.id);
    const rows = (Array.isArray(body?.rows) ? body.rows : []).slice(0, 200);
    const profiles = await all('profiles');
    const byName = new Map(profiles.filter(x => (x.role || 'student') === 'student').map(x => [String(x.name || '').trim().toLowerCase(), x]));
    const matched = [];
    const created = [];
    let skipped = 0;
    const now = Date.now();
    // India first: a row's own `course` wins, a row naming an India track is
    // India, and otherwise a new student follows the class it is joining — the
    // syllabus most of its current students use, or India when it is empty and
    // the teacher has not chosen an Australian syllabus for themselves.
    const current = profiles.filter(x => (c.studentPids || []).includes(x.id));
    const nswMajority = current.length > 0 && current.filter(x => (x.course || 'nsw') !== 'in').length > current.length / 2;
    const defaultCourse = teacher.course === 'in' ? 'in' : nswMajority ? 'nsw' : 'in';
    for (const raw of rows) {
      const name = safeLabel(raw && typeof raw === 'object' ? raw.name : raw, 40);
      if (!name) { skipped++; continue; }
      let prof = byName.get(name.toLowerCase());
      if (!prof) {
        const year = safeInt(raw?.year ?? raw?.class, 7, 12, safeInt(teacher.year, 7, 12, 9));
        const rowTrack = raw?.track ?? raw?.indiaTrack;
        const course = COURSES[raw?.course] ? raw.course : rowTrack ? 'in' : defaultCourse;
        prof = {
          id: uuid(), name, year, course, role: 'student',
          avatar: safeLabel(raw?.avatar, 4) || '🙂', theme: 'dark', dailyGoal: 10, xp: 0,
          pathway: course === 'nsw' ? (year >= 11 ? 'advanced' : null) : null,
          indiaTrack: course === 'in' ? cleanIndiaTrack(raw?.track ?? raw?.indiaTrack, year) : null,
          rosteredBy: teacher.id, createdAt: now, lastActiveAt: now
        };
        await put('profiles', prof);
        byName.set(name.toLowerCase(), prof);
        created.push({ id: prof.id, name: prof.name });
      } else if (!matched.some(m => m.id === prof.id) && !created.some(m => m.id === prof.id)) {
        matched.push({ id: prof.id, name: prof.name });
      }
    }
    const ids = [...matched, ...created].map(x => x.id);
    c.studentPids = [...new Set([...(c.studentPids || []), ...ids])];
    await put('classes', c);
    for (const t of await all('tasks')) {
      if (t.classId === c.id) await put('tasks', t);
    }
    return { class: c, matched: matched.length, created: created.length, skipped, students: ids };
  },
  'GET /classes/:id/analytics': async (body, params) => {
    const c = await requireClass(params.id);
    const now = Date.now();
    // Which class a task belongs to is inside the task's sealed body, so this
    // is a scan and a filter rather than an index lookup. The store holds the
    // tasks one teacher typed out by hand, and only the ones this profile can
    // open come back at all.
    const tasks = (await all('tasks')).filter(t => t.classId === params.id);
    const students = [];
    for (const pid of c.studentPids) {
      const prof = await get('profiles', pid);
      if (!prof) continue;
      students.push(await studentAnalyticsRow(prof, tasks, now));
    }
    // Progress files imported from other devices join the class analytics
    const imports = (await all('progressImports')).filter(r => r.classId === params.id);
    for (const imp of imports) students.push(importedAnalyticsRow(imp, now));
    const taskRows = [];
    for (const t of tasks) {
      const progress = [];
      for (const pid of c.studentPids) {
        const tp = await get('taskProgress', `${t.id}:${pid}`);
        const prof = await get('profiles', pid);
        progress.push({ pid, name: prof?.name || '?', done: tp?.done || 0, correct: tp?.correct || 0, finished: !!tp?.finishedAt });
      }
      // imported progress files may reference this task id from the pack's origin device
      for (const imp of imports) {
        const tp = (imp.data?.taskProgress || []).find(x => x.taskId === t.id);
        if (tp) progress.push({ pid: `import-${imp.id}`, name: `${imp.data?.student?.name || '?'} (file)`, done: tp.done, correct: tp.correct, finished: tp.finished });
      }
      taskRows.push({ ...t, overdue: !!t.dueAt && t.dueAt < now, progress });
    }
    const chapters = classChapterRows(students);
    const courses = new Set(students.map(s => s.course));
    const syllabus = courses.size === 0 ? null : courses.size > 1 ? 'mixed' : [...courses][0];
    const attention = students.filter(s => s.flags.length).map(s => ({ id: s.id, name: s.name, flags: s.flags }));
    return {
      class: c, generatedAt: now, syllabus, students, tasks: taskRows,
      chapters, weakestChapters: chapters.slice(0, 3), attention
    };
  },
  'GET /tasks': async () => {
    const p = await requireProfile();
    const classes = (await all('classes')).filter(c => c.studentPids.includes(p.id));
    const classIds = classes.map(c => c.id);
    const allTasks = await all('tasks');
    const mine = allTasks.filter(t => classIds.includes(t.classId) || t.ownerPid === p.id);
    const out = [];
    for (const t of mine) {
      const tp = await get('taskProgress', `${t.id}:${p.id}`);
      out.push({ ...t, className: classes.find(c => c.id === t.classId)?.name, done: tp?.done || 0, correctCount: tp?.correct || 0, finished: !!tp?.finishedAt });
    }
    return { tasks: out.sort((a, b) => (a.finished - b.finished) || (a.dueAt || 9e15) - (b.dueAt || 9e15)) };
  },
  'POST /tasks': async (body) => {
    const p = await requireProfile();
    const targets = indiaTargetsFrom(body.targets, body.subtopics, body.track, body.difficulty);
    const t = {
      id: uuid(), classId: body.classId || null, ownerPid: p.id,
      title: String(body.title || 'Practice task').slice(0, 80),
      mode: body.customIds?.length ? 'custom' : targets.length ? 'india' : 'subtopics',
      subtopics: (Array.isArray(body.subtopics) ? body.subtopics : []).filter(s => SUBTOPIC_BY_ID[s]),
      targets,
      customIds: body.customIds || [],
      count: Math.min(40, Math.max(1, Number(body.count) || 10)),
      dueAt: body.dueAt ? Number(body.dueAt) : null,
      createdAt: Date.now()
    };
    if (!t.subtopics.length && !t.targets.length && !t.customIds.length) throw Object.assign(new Error('Pick at least one topic or custom question'), { status: 400 });
    await put('tasks', t);
    return { task: t };
  },
  'POST /tasks/:id/delete': async (body, params) => {
    await requireTask(params.id);
    await del('tasks', params.id);
    return { ok: true };
  },

  // ---- history: every answered question, revisitable ----
  'POST /history/list': async (body) => {
    const p = await requireProfile();
    const { filter = 'all', page = 0, pageSize = 20 } = body || {};
    const rows = (await byIndex('questions', 'pid', p.id)).filter(r => r.answered);
    const attempts = await byIndex('attempts', 'pid', p.id);
    const attemptByQ = {};
    for (const a of attempts) attemptByQ[a.questionId] = a;   // latest wins (insertion order)
    const marks = await byIndex('bookmarks', 'pid', p.id);
    const marked = new Set(marks.map(b => b.key.split(':').slice(1).join(':')));
    const inkRows = await byIndex('inks', 'pid', p.id);
    const inkById = Object.fromEntries(inkRows.map(r => [r.id, r]));

    let list = rows.map(r => {
      const q = r.payload;
      const a = attemptByQ[r.id];
      const ink = inkById[r.id];
      // An India row is filed under its NCERT chapter, not the generator that
      // happened to draw it: a student practising Coordinate Geometry from a
      // reused NSW bank must still see "Coordinate Geometry" in History, and
      // the row must carry the chapter id the practice route understands.
      const inChapter = r.india ? indiaChapter(r.india.chapterId) : null;
      return {
        id: r.id, subtopic: inChapter ? inChapter.id : r.subtopic,
        subtopicName: q.multipart ? q.title : (inChapter?.name || (q.custom ? q.customName || 'Custom question' : (SUBTOPIC_BY_ID[r.subtopic]?.name || r.subtopic))),
        year: inChapter ? indiaChapterGrade(inChapter) : undefined,
        dotpointText: inChapter && Number.isInteger(r.india?.dotpointIndex) ? inChapter.dotpoints[r.india.dotpointIndex] : undefined,
        multipart: !!q.multipart,
        prompt: q.multipart ? q.stem : q.prompt,
        difficulty: r.difficulty, mode: r.mode,
        correct: a ? !!a.correct : null, answerGiven: a?.answerGiven ?? '',
        viaInk: !!a?.viaInk, hasInk: !!(ink && ink.strokes?.length), hasPhoto: !!ink?.photo, hasScribble: !!(ink?.scribble?.length),
        bookmarked: marked.has(r.id),
        canRetry: !q.custom && !q.multipart,
        answeredAt: a?.createdAt || r.createdAt
      };
    }).sort((a, b) => b.answeredAt - a.answeredAt);

    if (filter === 'wrong') list = list.filter(x => x.correct === false);
    if (filter === 'correct') list = list.filter(x => x.correct === true);
    if (filter === 'bookmarked') list = list.filter(x => x.bookmarked);
    if (filter === 'ink') list = list.filter(x => x.hasInk || x.hasScribble || x.hasPhoto);

    const start = page * pageSize;
    return { total: list.length, page, pageSize, items: list.slice(start, start + pageSize) };
  },

  'POST /history/:id/bookmark': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    const key = `${p.id}:${params.id}`;
    const existing = await get('bookmarks', key);
    if (existing) { await del('bookmarks', key); return { bookmarked: false }; }
    await put('bookmarks', { key, pid: p.id, questionId: params.id, createdAt: Date.now() });
    return { bookmarked: true };
  },

  'POST /history/:id/retry': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    const q = row.payload;
    if (q.custom) throw Object.assign(new Error('Custom questions can’t be regenerated'), { status: 400 });
    if (q.multipart) throw Object.assign(new Error('Structured exam questions live in exam review'), { status: 400 });
    const same = (body?.variant || 'same') === 'same';
    const payload = generateQuestion(row.subtopic, row.difficulty, same ? q.seed : undefined);
    // A retried Indian question keeps its chapter, or its evidence would fall
    // onto the generator id instead of the chapter the student is working on.
    const newRow = { id: uuid(), pid: p.id, subtopic: row.subtopic, difficulty: row.difficulty, payload, india: row.india || undefined, mode: 'practice', examId: null, taskId: null, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now() };
    await put('questions', newRow);
    return { question: sanitize(payload, newRow), variant: same ? 'same' : 'fresh' };
  },

  'GET /history/:id/detail': async (body, params) => {
    const p = await requireProfile();
    const row = await get('questions', params.id);
    if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    const q = row.payload;
    const ink = await get('inks', params.id);
    return {
      question: sanitize(q, row),
      solution: q.multipart
        ? { parts: q.parts.map(pt => ({ key: pt.key, answerText: displayAnswer({ answerType: pt.answerType, answer: pt.answer, mcqOptions: pt.mcqOptions }), steps: pt.steps })) }
        : { steps: q.steps, answerText: displayAnswer(q), criteria: criteriaFor(q) },
      ink: ink ? { strokes: ink.strokes || [], recognized: ink.recognized, scribble: ink.scribble || null, photo: safePhoto(ink.photo) } : null
    };
  },

  // ---- data safety: backup, restore, task packs, progress files ----
  'GET /data/storage': async () => {
    const est = await storageEstimate();
    if (typeof window !== 'undefined' && window.__PRI_NATIVE__) {
      // Native app: data lives in the app's own sandbox — nothing can evict it.
      return { supported: true, persisted: true, native: true, usage: est?.usage || 0, quota: est?.quota || 0 };
    }
    const persist = await requestPersistentStorage();
    return { ...persist, native: false, usage: est?.usage || 0, quota: est?.quota || 0 };
  },

  'GET /data/export': async () => {
    const p = await requireProfile();
    const stores = {};
    for (const st of BACKUP_STORES) stores[st] = await byIndex(st, 'pid', p.id).catch(() => []);
    return {
      format: 'pri-learning-backup', version: 2, exportedAt: Date.now(),
      app: 'Pri Learning', profile: exportProfile(p), stores
    };
  },

  'POST /data/import': async (body) => {
    if (!body || body.format !== 'pri-learning-backup' || !body.profile || typeof body.profile !== 'object') {
      throw Object.assign(new Error('That file isn’t a Pri Learning backup.'), { status: 400 });
    }
    const newPid = uuid();
    const prof = importProfile(body.profile, newPid);
    const existing = await all('profiles');
    if (existing.some(x => x.name === prof.name)) prof.name = sanitizeText(`${prof.name} (restored)`, 60);
    await put('profiles', prof);

    const stores = body.stores && typeof body.stores === 'object' ? body.stores : {};
    let rows = 0;
    for (const st of BACKUP_STORES) {
      const shape = IMPORT_ROWS[st];
      const src = Array.isArray(stores[st]) ? stores[st] : [];
      for (const raw of src) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        let row = null;
        try { row = shape(raw, newPid); } catch { row = null; }
        if (!row) continue;
        try {
          if (AUTO_ID_STORES.includes(st)) await add(st, row);
          else await put(st, row);
          rows++;
        } catch { }
      }
    }
    setCurrentPid(newPid);
    // The caller needs to know protection was dropped, not just that rows landed.
    return { user: await publicUser(prof), rows, unprotected: true };
  },

  'GET /tasks/:id/pack': async (body, params) => {
    const p = await requireProfile();
    const t = await requireTask(params.id);
    const customQs = [];
    for (const cid of t.customIds || []) {
      const cq = await get('customQs', cid);
      if (cq) customQs.push(cq);
    }
    return {
      format: 'pri-task-pack', version: 1, exportedAt: Date.now(), teacher: p.name,
      task: { title: t.title, mode: t.mode, subtopics: t.subtopics, targets: t.targets || [], customIds: t.customIds, count: t.count, dueAt: t.dueAt },
      customQs
    };
  },

  'POST /tasks/import-pack': async (body) => {
    const p = await requireProfile();
    if (!body || body.format !== 'pri-task-pack' || !body.task) {
      throw Object.assign(new Error('That file isn’t a Pri Learning task pack.'), { status: 400 });
    }
    // The pack chooses none of this: each question is rebuilt by the same
    // whitelist the teacher tool uses, and the new ids are ours.
    const idMap = Object.create(null);
    for (const cq of Array.isArray(body.customQs) ? body.customQs : []) {
      const rec = buildCustomQuestion(packQuestion(cq), p.id);
      if (!rec) continue;
      const from = safeId(cq?.id);
      if (from) idMap[from] = rec.id;
      await put('customQs', rec);
    }
    const src = body.task && typeof body.task === 'object' ? body.task : {};
    const customIds = (Array.isArray(src.customIds) ? src.customIds : [])
      .slice(0, 100).map(cid => idMap[safeId(cid)]).filter(Boolean);
    const targets = indiaTargetsFrom(src.targets, src.subtopics);
    const t = {
      id: uuid(), classId: null, ownerPid: p.id,
      title: safeLabel(src.title, 80) || 'Imported task',
      mode: customIds.length ? 'custom' : targets.length ? 'india' : 'subtopics',
      subtopics: (Array.isArray(src.subtopics) ? src.subtopics : []).slice(0, 100).filter(s => SUBTOPIC_BY_ID[s]),
      targets,
      customIds,
      count: safeInt(src.count, 1, 40, 10),
      dueAt: safeTime(src.dueAt),
      fromPack: safeLabel(body.teacher, 40) || true,
      createdAt: Date.now()
    };
    if (!t.subtopics.length && !t.targets.length && !t.customIds.length) throw Object.assign(new Error('This pack has no usable content.'), { status: 400 });
    await put('tasks', t);
    return { task: t };
  },

  'GET /data/progress-file': async () => {
    const p = await requireProfile();
    const now = Date.now();
    const ratings = await ratingsFor(p.id);
    const attempts = await byIndex('attempts', 'pid', p.id);
    const tps = await byIndex('taskProgress', 'pid', p.id);
    const india = p.course === 'in';
    const trackId = india ? cleanIndiaTrack(p.indiaTrack, p.year) : null;
    return {
      format: 'pri-progress', version: 1, exportedAt: now,
      student: {
        name: p.name, year: p.year, avatar: p.avatar || '🙂',
        course: india ? 'in' : 'nsw', indiaTrack: trackId,
        pathway: !india && p.year >= 11 ? pathwayOf(p) : null
      },
      // India profiles export the evidence the India product shows; there is
      // no predicted mark to export because none exists for them.
      predicted: india ? null : predictMark(ratings, p.year, now, pathwayOf(p)),
      evidence: india ? indiaEvidence(indiaChapterRows(trackId, p.year, ratings, now)) : null,
      streak: await streakFor(p.id, now, timezoneOf(p)),
      totals: { attempts: attempts.length, correct: attempts.filter(a => a.correct).length },
      ratings: Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k, { rating: v.rating, attempts: v.attempts, correct: v.correct, last_at: v.last_at, traps: trimTraps(v.traps || {}) }])),
      taskProgress: tps.map(tp => ({ taskId: tp.taskId, done: tp.done, correct: tp.correct, finished: !!tp.finishedAt }))
    };
  },

  'POST /classes/:id/import-progress': async (body, params) => {
    const c = await requireClass(params.id);
    if (!body || body.format !== 'pri-progress' || !body.student || typeof body.student !== 'object') {
      throw Object.assign(new Error('That file isn’t a Pri Learning progress file.'), { status: 400 });
    }
    const data = importProgress(body);
    if (!data.student.name) throw Object.assign(new Error('That progress file has no student on it.'), { status: 400 });
    // one row per student name per class — a re-import replaces the old snapshot
    const olds = (await all('progressImports')).filter(r => r.classId === c.id && r.data?.student?.name === data.student.name);
    for (const old of olds) await del('progressImports', old.id);
    await put('progressImports', { id: uuid(), teacherPid: c.teacherPid, classId: c.id, importedAt: Date.now(), data });
    return { ok: true, student: data.student.name };
  },

  // ---- custom questions (teacher tool) ----
  'GET /custom-questions': async () => {
    const p = await requireProfile();
    return { questions: await byIndex('customQs', 'ownerPid', p.id) };
  },
  'POST /custom-questions': async (body) => {
    const p = await requireProfile();
    const rec = buildCustomQuestion(body || {}, p.id, true);
    await put('customQs', rec);
    return { question: rec };
  },
  'POST /custom-questions/:id/delete': async (body, params) => {
    const p = await requireProfile();
    const rec = await get('customQs', params.id);
    if (!rec || rec.ownerPid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
    await del('customQs', params.id);
    return { ok: true };
  },

  // ---- ink archive ----
  'GET /ink/:id': async (body, params) => {
    const p = await requireProfile();
    const row = await get('inks', params.id);
    if (!row || row.pid !== p.id) return { ink: null };
    return {
      ink: {
        id: row.id, pid: row.pid, strokes: row.strokes || [], recognized: row.recognized || null,
        scribble: row.scribble || null, photo: safePhoto(row.photo), createdAt: row.createdAt
      }
    };
  }
};

async function examFor(pid, examId) {
  const e = await get('exams', examId);
  if (!e || e.pid !== pid) return null;
  const questions = [];
  for (const qid of e.questionIds) {
    const row = await get('questions', qid);
    if (!row) continue;
    questions.push(sanitize(row.payload, row));
  }
  return { id: e.id, title: e.title, year: e.year, durationMin: e.durationMin, createdAt: e.createdAt, finishedAt: e.finishedAt, score: e.score, total: e.total, questions, detail: e.detail || null };
}

// ── Dispatcher (same contract as the old fetch layer) ────────────────────────

// ── WP india-exams: evidence from India exam simulations ─────────────────────
// local/indiaExamBackend.js composes and marks CBSE/JEE/IOQM papers, but the
// evidence a sat paper produces — ratings, traps, activity, XP, the attempt
// row — is recorded through exactly the path every practice answer takes, so
// progress and the adaptive engine read exam outcomes without a second system.
export function examStepMeta(q) { return stepMetaFor(q); }

export async function recordIndiaExamEvidence(row, q, { correct, given, ms, feedback } = {}) {
  const p = await requireProfile();
  if (!correct) await recordTrap(p.id, row, q, feedback);
  return resolve(p, row, q, !!correct, given ?? '', Math.max(0, Number(ms) || 0), 'exam');
}

export async function finishIndiaExamEvidence(pct) {
  const p = await requireProfile();
  return checkBadges(p.id, { type: 'exam', pct: Number(pct) || 0 }, Date.now());
}

// ── Entitlement gates ────────────────────────────────────────────────────────
// The free tier (20 practice questions a day, one exam simulation per 30 days)
// and the Premium-only JEE Advanced track are enforced at the dispatcher, so a
// smart-practice call, a retry from History and a teacher task all meet the same
// rule on the same device-local counter. The route bodies stay pure builders.
// Nothing is counted until the route has actually produced a question or paper.
async function entitlementGate(method, pattern, body) {
  const key = `${method} ${pattern}`;
  if (key === 'POST /practice/next' || key === 'POST /history/:id/retry') {
    const p = await requireProfile();
    await assertPracticeAllowed(p);
    if (key === 'POST /practice/next' && p.course === 'in' && !body?.taskId &&
      cleanIndiaTrack(body?.track || p.indiaTrack, p.year) === 'jee-advanced') {
      await requireCapability(p, ENTITLEMENTS.JEE_ADVANCED);
    }
    return async result => {
      await recordPracticeServed(p);
      return { ...result, allowance: await practiceAllowance(p) };
    };
  }
  if (key === 'POST /exams') {
    const p = await requireProfile();
    await assertExamAllowed(p);
    return async result => {
      await recordExamSimulation(p);
      return { ...result, allowance: await examAllowance(p) };
    };
  }
  return null;
}

async function runGated(method, pattern, handler, body, params) {
  const settle = await entitlementGate(method, pattern, body);
  const result = await handler(body, params);
  return settle ? settle(result) : result;
}

export async function dispatch(method, path, body) {
  // exact match first
  const exact = routes[`${method} ${path}`];
  if (exact) return runGated(method, path, exact, body, {});
  // parameterised match
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method || !pattern.includes(':')) continue;
    const pp = pattern.split('/');
    const aa = path.split('/');
    if (pp.length !== aa.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = aa[i];
      else if (pp[i] !== aa[i]) { ok = false; break; }
    }
    if (ok) return runGated(method, pattern, routes[key], body, params);
  }
  throw Object.assign(new Error(`No local route for ${method} ${path}`), { status: 404 });
}
