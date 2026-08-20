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
  sydneyDate, streakFor, bumpActivity, setPredictedToday,
  ratingsFor, getRating, putRating, currentPid, setCurrentPid, activityFor
} from './store.js';
import { CURRICULUM, STREAM_CURRICULUM, PATHWAYS, streamSubtopics, SUBTOPIC_BY_ID, subtopicsForYear, scopeForYear, DIFF_LABELS } from '../engine/curriculum.js';
import { generateQuestion } from '../engine/generators/index.js';
import { multipartForYear, generateMultipart } from '../engine/generators/multipart.js';
import { checkAnswer, stepCheck } from '../engine/checker.js';
import {
  START_RATING, updateRating, masteryOf, masteryBand, pickDifficulty, pickNext,
  nextReview, predictMark, priorities, xpFor, levelFromXp, bandFor
} from '../engine/adaptive.js';
import { BADGES, checkBadges } from './badges.js';
import {
  hashPassword, verifyPassword, needsRehash,
  createVault, openVault, rewrapVault, blindHash
} from './auth.js';
import { sanitizeFigure, sanitizeText } from '../lib/sanitize.js';

export const COURSES = {
  nsw: { name: 'NSW · HSC', junior: y => `Year ${y} · Stage ${y <= 8 ? 4 : 5}`, senior: y => y === 11 ? 'Year 11 · Mathematics Advanced' : 'Year 12 · Mathematics Advanced (HSC)' },
  vic: { name: 'VIC · VCE', junior: y => `Year ${y} · Victorian Curriculum`, senior: y => `Year ${y} · VCE Mathematical Methods` },
  qld: { name: 'QLD · QCE', junior: y => `Year ${y} · Australian Curriculum`, senior: y => `Year ${y} · QCE Mathematical Methods` },
  wa: { name: 'WA · WACE', junior: y => `Year ${y} · WA Curriculum`, senior: y => `Year ${y} · WACE Mathematics Methods` },
  sa: { name: 'SA · SACE', junior: y => `Year ${y} · Australian Curriculum`, senior: y => `Year ${y} · SACE Mathematical Methods` },
  ib: { name: 'IB', junior: y => `MYP Year ${y - 6}`, senior: () => 'IB DP · Mathematics AA' }
};
export const courseLabel = (course, year, pathway) => {
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

// Dot point ↔ difficulty mapping (each subtopic has 3 dot points)
const DP_DIFFS = [[1, 2], [2, 3], [3, 4]];

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
  .map(st => ({ points: (Array.isArray(st?.points) ? st.points : []).slice(0, 4000).map(pt => ({ x: safeNum(pt?.x), y: safeNum(pt?.y) })) }));

/** A photo is only ever a base64 raster: no svg, no scheme games, no markup. */
const safePhoto = (v) => {
  if (typeof v !== 'string' || v.length > MAX_PHOTO || !PHOTO_RE.test(v)) return null;
  return /[^A-Za-z0-9+/=]/.test(v.slice(v.indexOf(',') + 1)) ? null : v;
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

/**
 * What the picker may show of an address: enough to recognise your own account,
 * never enough to confirm someone else's to whoever is holding the iPad.
 */
function maskAddress(email) {
  const at = String(email || '').indexOf('@');
  return at < 1 ? null : `${email[0]}•••${email.slice(at)}`;
}
const maskedEmail = p => p.emailMask || maskAddress(p.email);

/**
 * Store an address on a profile: sealed under the profile's own key when it has
 * one, with a mask for the picker and a blind index so two profiles can be told
 * apart without either address being readable.
 */
async function setProfileEmail(p, email) {
  delete p.email; delete p.emailSealed; delete p.emailHash; delete p.emailMask;
  if (!email) return;
  p.emailHash = await blindHash(email);
  p.emailMask = maskAddress(email);
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

/** Seal any of a profile's private rows that are still lying about in the clear. */
async function encryptRows(pid) {
  for (const st of ENCRYPTED_STORES) {
    const raw = await rawByIndex(st, 'pid', pid).catch(() => []);
    if (!raw.length || raw.every(r => !!r.sealed)) continue;
    for (const row of await byIndex(st, 'pid', pid).catch(() => [])) await put(st, row);
  }
}

/** Give a profile's rows back in the clear, then give up the key. Order matters. */
async function decryptRows(pid) {
  const snapshot = [];
  for (const st of ENCRYPTED_STORES) snapshot.push([st, await byIndex(st, 'pid', pid).catch(() => [])]);
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
  const today = (await get('activity', `${p.id}:${sydneyDate(nowMs)}`)) || { questions: 0, correct: 0, xp: 0 };
  return {
    id: p.id, name: p.name, year: p.year, theme: p.theme || 'dark',
    course: p.course || 'nsw', courseLabel: courseLabel(p.course || 'nsw', p.year, pathwayOf(p)),
    pathway: p.year >= 11 ? pathwayOf(p) : null, pathwayName: p.year >= 11 ? PATHWAYS[pathwayOf(p)].name : null,
    role: p.role || 'student', avatar: p.avatar || '🙂',
    email: await profileEmail(p), provider: p.provider || null, hasPassword: !!p.auth,
    dailyGoal: p.dailyGoal || 10, xp: p.xp || 0, level, levelProgress: progress, levelNeeded: needed,
    streak: await streakFor(p.id, nowMs),
    today: { questions: today.questions, correct: today.correct, xp: today.xp },
    isDemo: !!p.isDemo, handwriting: p.handwriting !== false
  };
}

// ── Question serving ─────────────────────────────────────────────────────────

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
  return {
    id: row.id, subtopic: q.subtopic, subtopicName: q.custom ? q.customName || 'Custom question' : (s?.name || q.subtopic),
    year: s?.year, strand: s?.strand,
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

async function createQuestion(pid, subtopic, difficulty, mode, examId = null, taskId = null, customQ = null) {
  const q = customQ ? { ...customQ, custom: true } : generateQuestion(subtopic, difficulty);
  const row = { id: uuid(), pid, subtopic: q.subtopic || 'custom', difficulty: q.difficulty || 2, payload: q, mode, examId, taskId, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now() };
  await put('questions', row);
  return { row, payload: q };
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
    default: return '';
  }
}

async function resolve(profile, row, q, correct, answerGiven, ms, mode, viaInk = false) {
  const pid = profile.id;
  const now = Date.now();
  const st = (await getRating(pid, q.subtopic)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
  const effHints = (row.hintsUsed || 0) + Math.max(0, (row.tries || 0) - (correct ? 1 : 0));
  let ratingAfter = st.rating;
  const isRush = mode === 'rush' || mode === 'match';
  const isCustom = q.custom;

  if (!isRush && !isCustom) {
    ratingAfter = updateRating(st.rating, st.attempts, q.difficulty, correct, effHints);
    await putRating(pid, q.subtopic, {
      rating: ratingAfter, attempts: st.attempts + 1, correct: st.correct + (correct ? 1 : 0), last_at: now
    });
  }

  if ((mode === 'practice' || mode === 'review' || mode === 'task') && !isCustom) {
    const key = `${pid}:${q.subtopic}`;
    const rev = await get('reviews', key);
    if (rev) {
      const days = nextReview(rev.intervalDays, correct, q.difficulty);
      await put('reviews', { ...rev, dueAt: now + days * DAY, intervalDays: days });
    } else if (st.attempts + 1 >= 3) {
      const days = correct ? 2 : 1;
      await put('reviews', { key, pid, subtopic: q.subtopic, dueAt: now + days * DAY, intervalDays: days });
    }
  }

  const xp = isRush ? (correct ? 6 : 0) : xpFor(q.difficulty, correct, 0, effHints);
  profile.xp = (profile.xp || 0) + xp;
  await put('profiles', profile);
  await bumpActivity(pid, { correct, xp, ms }, now);

  await add('attempts', {
    pid, questionId: row.id, subtopic: q.subtopic, difficulty: q.difficulty || 2,
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

  const newBadges = await checkBadges(pid, { type: 'attempt', difficulty: q.difficulty, correct, hintsUsed: row.hintsUsed, year: profile.year, xp: profile.xp }, now);

  const ratings = await ratingsFor(pid);
  const pred = predictMark(ratings, profile.year, now, pathwayOf(profile));
  await setPredictedToday(pid, pred.mark, now);

  const stNew = ratings[q.subtopic];
  const mastery = stNew ? Math.round(masteryOf(stNew.rating, stNew.attempts, stNew.last_at, now) * 100) : 0;

  return {
    xp, totalXp: profile.xp, level: levelFromXp(profile.xp),
    ratingDelta: ratingAfter - st.rating, mastery, band: masteryBand(mastery / 100),
    predicted: pred, streak: await streakFor(pid, now), newBadges
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
  name: p.name, year: p.year, course: p.course || 'nsw', role: p.role || 'student',
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
    role: src.role === 'teacher' ? 'teacher' : 'student',
    avatar: safeLabel(src.avatar, 4) || '🙂',
    theme: src.theme === 'light' ? 'light' : 'dark',
    dailyGoal: safeInt(src.dailyGoal, 3, 60, 10),
    xp: safeInt(src.xp, 0, 1e9, 0),
    pathway: cleanPathway(src.pathway, year) || (year >= 11 ? 'advanced' : null),
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
      correct: safeInt(r.correct, 0, 1e7, 0), last_at: safeTime(r.last_at)
    };
  },
  reviews: (r, pid) => {
    const subtopic = safeId(r.subtopic);
    return subtopic && {
      key: `${pid}:${subtopic}`, pid, subtopic,
      dueAt: safeTime(r.dueAt) || Date.now(), intervalDays: safeInt(r.intervalDays, 0, 3650, 1)
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
      score: r.score == null ? null : safeInt(r.score, 0, 999, 0),
      total: r.total == null ? null : safeInt(r.total, 0, 999, 0),
      detail: safeExamDetail(r.detail)
    };
  }
};

/** A teacher's copy of someone else's progress, rebuilt from the file. */
function importProgress(src) {
  const st = src.student && typeof src.student === 'object' ? src.student : {};
  const year = safeInt(st.year, 7, 12, 9);
  const pred = src.predicted && typeof src.predicted === 'object' ? src.predicted : null;
  const band = pred?.band && typeof pred.band === 'object' ? pred.band : null;
  const ratings = Object.create(null);
  for (const [k, v] of Object.entries(src.ratings && typeof src.ratings === 'object' ? src.ratings : {})) {
    const id = safeId(k);
    if (!id || !SUBTOPIC_BY_ID[id] || !v || typeof v !== 'object') continue;
    ratings[id] = {
      rating: safeNum(v.rating, START_RATING), attempts: safeInt(v.attempts, 0, 1e7, 0),
      correct: safeInt(v.correct, 0, 1e7, 0), last_at: safeTime(v.last_at)
    };
  }
  return {
    format: 'pri-progress', version: 1, exportedAt: safeTime(src.exportedAt) || Date.now(),
    student: {
      name: safeLabel(st.name, 40), year, avatar: safeLabel(st.avatar, 4) || '🙂',
      pathway: cleanPathway(st.pathway, year)
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
        isDemo: !!p.isDemo, xp: p.xp || 0,
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
    p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
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
  'POST /profiles/delete': async (body) => {
    const { id, password, confirm } = body || {};
    const p = await get('profiles', id);
    if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 });
    if (p.auth) {
      if (!password) throw Object.assign(new Error('Enter this profile’s password to delete it.'), { status: 401, needsPassword: true });
      await withPassword(id, password, null);
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
  'POST /profiles/demo': async () => {
    let demo = (await all('profiles')).find(p => p.isDemo);
    if (!demo) {
      const { seedDemo } = await import('./demoSeed.js');
      demo = await seedDemo();
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
    if (body.pathway !== undefined) p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
    if (body.year !== undefined && body.pathway === undefined) p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
    if (body.theme !== undefined && ['dark', 'light'].includes(body.theme)) p.theme = body.theme;
    if (body.dailyGoal !== undefined) p.dailyGoal = Math.min(60, Math.max(3, Number(body.dailyGoal) || p.dailyGoal));
    if (body.course !== undefined && COURSES[body.course]) p.course = body.course;
    if (body.avatar !== undefined) p.avatar = String(body.avatar).slice(0, 4);
    if (body.handwriting !== undefined) p.handwriting = !!body.handwriting;
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
    const years = CURRICULUM.map(y => ({
      year: y.year, title: y.title, caption: y.caption,
      courseLabel: courseLabel(p.course || 'nsw', y.year),
      subtopics: y.subtopics.map(s => {
        const st = ratings[s.id];
        const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
        return {
          id: s.id, name: s.name, strand: s.strand, weight: s.weight, code: s.code || null,
          dotpoints: s.dotpoints.map((dp, i) => ({ text: dp, difficulties: DP_DIFFS[i] || [2, 3] })),
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
            dotpoints: s2.dotpoints.map((dp, i) => ({ text: dp, difficulties: DP_DIFFS[i] || [2, 3] })),
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
    const { mode = 'smart', subtopic, difficulty, dotpoint, taskId } = body || {};
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
      const sub = task.subtopics[done % task.subtopics.length];
      const st = await getRating(p.id, sub);
      const d = pickDifficulty(st?.rating ?? START_RATING, st?.attempts ?? 0);
      const { row, payload } = await createQuestion(p.id, sub, d, 'task', null, taskId);
      return { question: sanitize(payload, row), reason: 'task', why: `Task: ${task.title} — question ${done + 1} of ${task.count}.` };
    }
    let choice;
    if (mode === 'topic' && subtopic && SUBTOPIC_BY_ID[subtopic]) {
      const st = await getRating(p.id, subtopic);
      let d;
      if (dotpoint !== undefined && dotpoint !== null && DP_DIFFS[dotpoint]) {
        const opts = DP_DIFFS[dotpoint];
        const pref = pickDifficulty(st?.rating ?? START_RATING, st?.attempts ?? 0);
        d = opts.includes(pref) ? pref : opts[Math.random() < 0.5 ? 0 : opts.length - 1];
      } else {
        d = difficulty ? Math.min(4, Math.max(1, Number(difficulty))) : pickDifficulty(st?.rating ?? START_RATING, st?.attempts ?? 0);
      }
      choice = { subtopic, difficulty: d, reason: 'topic', why: dotpoint != null ? `Focused on dot point ${dotpoint + 1} of this subtopic.` : 'Focused practice on your chosen topic.' };
    } else {
      const ratings = await ratingsFor(p.id);
      const reviews = await byIndex('reviews', 'pid', p.id);
      const reviewsDue = reviews.filter(r => r.dueAt <= Date.now()).sort((a, b) => a.dueAt - b.dueAt).map(r => ({ subtopic: r.subtopic }));
      choice = pickNext({ ratings, reviewsDue, year: p.year, pathway: pathwayOf(p), rand: Math.random() });
      if (difficulty) choice = { ...choice, difficulty: Math.min(4, Math.max(1, Number(difficulty))) };
    }
    const { row, payload } = await createQuestion(p.id, choice.subtopic, choice.difficulty, choice.reason === 'review' ? 'review' : 'practice');
    return { question: sanitize(payload, row), reason: choice.reason, why: choice.why };
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
    const isFast = row.mode === 'rush' || row.mode === 'match';
    if (!result.correct && !result.invalid && !isFast && (row.tries || 0) < 1) {
      row.tries = (row.tries || 0) + 1;
      await put('questions', row);
      return { correct: false, resolved: false, triesLeft: 1, feedback: feedback || 'Not quite — check your working and try once more.', stepReport };
    }
    if (result.invalid && !isFast) {
      return { correct: false, resolved: false, triesLeft: Math.max(0, 1 - (row.tries || 0)), invalid: true, feedback, stepReport };
    }
    const scribbleStrokes = Array.isArray(scribble) && scribble.length ? safeStrokes(scribble, 400) : null;
    if ((ink && ink.strokes?.length) || photo || scribbleStrokes) {
      await put('inks', {
        id: row.id, pid: p.id, strokes: safeStrokes(ink?.strokes, 4000), recognized: sanitizeText(ink?.recognized, 500) || null,
        photo: safePhoto(photo),
        scribble: scribbleStrokes,
        createdAt: Date.now()
      });
    }
    const meta = await resolve(p, row, q, result.correct, answer, ms, row.mode, !!viaInk);
    return {
      correct: result.correct, resolved: true, feedback, stepReport,
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
    const decorate = r => ({ subtopic: r.subtopic, due_at: r.dueAt, interval_days: r.intervalDays, name: SUBTOPIC_BY_ID[r.subtopic]?.name, year: SUBTOPIC_BY_ID[r.subtopic]?.year, strand: SUBTOPIC_BY_ID[r.subtopic]?.strand });
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
          await bumpActivity(p.id, { correct: allCorrect, xp, ms: Math.round(totalMs / nQ) }, now);
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
        try {
          const rep = stepCheck(metaQ, String(wk));
          const okLines = (rep?.lines || []).filter(l => l.status === 'ok').length;
          if (okLines > 0) {
            awarded = Math.min(qMarks - 1, okLines);
            partial = { okLines, awarded, note: `${awarded} mark${awarded === 1 ? '' : 's'} for correct working — the final answer was wrong, but ${okLines} line${okLines === 1 ? '' : 's'} of your working checked out.` };
          }
        } catch { }
      }
      totalMarks += qMarks; marksAwarded += awarded;
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
    const newBadges = await checkBadges(p.id, { type: 'exam', pct }, now);
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
    const newBadges = await checkBadges(p.id, { type: 'rush', score }, now);
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
    const newBadges = await checkBadges(p.id, { type: 'match', won }, now);
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
    const pred = predictMark(ratings, p.year, now, pathwayOf(p));
    const prio = priorities(ratings, p.year, now, 5, pathwayOf(p));
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
      predicted: pred, trajectory, priorities: prio, strands,
      activity: days.slice(-120), totals, byDiff, bestRush,
      matchWins: matchRuns.filter(r => r.won).length, matchPlayed: matchRuns.length,
      examCount: exams.filter(e => e.finishedAt).length, inkCount, recent,
      streak: await streakFor(pid, now)
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
      strengths: [...rows].filter(r => r.attempts >= 3).sort((a, b) => b.mastery - a.mastery).slice(0, 3),
      focus: [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, 3),
      weekly: acts.slice(-28),
      totals: { attempts: attempts.length, correct: attempts.filter(a => a.correct).length },
      streak: await streakFor(p.id, now)
    };
  },

  // ---- classes & tasks (teacher mode, local profiles) ----
  'GET /classes': async () => {
    const p = await requireProfile();
    const classes = (await all('classes')).filter(c => c.teacherPid === p.id);
    const profiles = await all('profiles');
    const out = [];
    for (const c of classes) {
      const students = profiles.filter(x => c.studentPids.includes(x.id)).map(x => ({ id: x.id, name: x.name, year: x.year, avatar: x.avatar }));
      out.push({ ...c, students });
    }
    return { classes: out, allProfiles: profiles.filter(x => (x.role || 'student') === 'student').map(x => ({ id: x.id, name: x.name, year: x.year, avatar: x.avatar })) };
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
    return { class: c };
  },
  'GET /classes/:id/analytics': async (body, params) => {
    const c = await requireClass(params.id);
    const now = Date.now();
    const students = [];
    for (const pid of c.studentPids) {
      const prof = await get('profiles', pid);
      if (!prof) continue;
      const ratings = await ratingsFor(pid);
      const attempts = await byIndex('attempts', 'pid', pid);
      const pred = predictMark(ratings, prof.year, now, pathwayOf(prof));
      students.push({
        id: pid, name: prof.name, avatar: prof.avatar, year: prof.year,
        attempts: attempts.length, correct: attempts.filter(a => a.correct).length,
        predicted: pred.mark, streak: await streakFor(pid, now),
        weakest: priorities(ratings, prof.year, now, 1, pathwayOf(prof))[0]?.name || '—'
      });
    }
    // Progress files imported from other devices join the class analytics
    const imports = (await all('progressImports')).filter(r => r.classId === params.id);
    for (const imp of imports) {
      const d = imp.data || {};
      const st = d.student || {};
      let weakest = '—';
      try { weakest = priorities(d.ratings || {}, st.year || 9, Date.now(), 1, st.pathway || 'advanced')[0]?.name || '—'; } catch { }
      students.push({
        id: `import-${imp.id}`, name: st.name || 'Imported student', avatar: st.avatar || '📄', year: st.year,
        attempts: d.totals?.attempts || 0, correct: d.totals?.correct || 0,
        predicted: d.predicted?.mark ?? null, streak: d.streak || 0,
        weakest, imported: true, importedAt: imp.importedAt
      });
    }
    const tasks = await byIndex('tasks', 'classId', params.id);
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
      taskRows.push({ ...t, progress });
    }
    return { class: c, students, tasks: taskRows };
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
    const t = {
      id: uuid(), classId: body.classId || null, ownerPid: p.id,
      title: String(body.title || 'Practice task').slice(0, 80),
      mode: body.customIds?.length ? 'custom' : 'subtopics',
      subtopics: (body.subtopics || []).filter(s => SUBTOPIC_BY_ID[s]),
      customIds: body.customIds || [],
      count: Math.min(40, Math.max(1, Number(body.count) || 10)),
      dueAt: body.dueAt ? Number(body.dueAt) : null,
      createdAt: Date.now()
    };
    if (!t.subtopics.length && !t.customIds.length) throw Object.assign(new Error('Pick at least one topic or custom question'), { status: 400 });
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
      return {
        id: r.id, subtopic: r.subtopic,
        subtopicName: q.multipart ? q.title : (q.custom ? q.customName || 'Custom question' : (SUBTOPIC_BY_ID[r.subtopic]?.name || r.subtopic)),
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
    const newRow = { id: uuid(), pid: p.id, subtopic: row.subtopic, difficulty: row.difficulty, payload, mode: 'practice', examId: null, taskId: null, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now() };
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
    return { user: await publicUser(prof), rows };
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
      task: { title: t.title, mode: t.mode, subtopics: t.subtopics, customIds: t.customIds, count: t.count, dueAt: t.dueAt },
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
    const t = {
      id: uuid(), classId: null, ownerPid: p.id,
      title: safeLabel(src.title, 80) || 'Imported task',
      mode: customIds.length ? 'custom' : 'subtopics',
      subtopics: (Array.isArray(src.subtopics) ? src.subtopics : []).slice(0, 100).filter(s => SUBTOPIC_BY_ID[s]),
      customIds,
      count: safeInt(src.count, 1, 40, 10),
      dueAt: safeTime(src.dueAt),
      fromPack: safeLabel(body.teacher, 40) || true,
      createdAt: Date.now()
    };
    if (!t.subtopics.length && !t.customIds.length) throw Object.assign(new Error('This pack has no usable content.'), { status: 400 });
    await put('tasks', t);
    return { task: t };
  },

  'GET /data/progress-file': async () => {
    const p = await requireProfile();
    const now = Date.now();
    const ratings = await ratingsFor(p.id);
    const attempts = await byIndex('attempts', 'pid', p.id);
    const tps = await byIndex('taskProgress', 'pid', p.id);
    return {
      format: 'pri-progress', version: 1, exportedAt: now,
      student: { name: p.name, year: p.year, avatar: p.avatar || '🙂', pathway: p.year >= 11 ? pathwayOf(p) : null },
      predicted: predictMark(ratings, p.year, now, pathwayOf(p)),
      streak: await streakFor(p.id, now),
      totals: { attempts: attempts.length, correct: attempts.filter(a => a.correct).length },
      ratings: Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k, { rating: v.rating, attempts: v.attempts, correct: v.correct, last_at: v.last_at }])),
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

export async function dispatch(method, path, body) {
  // exact match first
  const exact = routes[`${method} ${path}`];
  if (exact) return exact(body, {});
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
    if (ok) return routes[key](body, params);
  }
  throw Object.assign(new Error(`No local route for ${method} ${path}`), { status: 404 });
}
