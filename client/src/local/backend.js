// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local backend — the entire platform running on this device.
// Implements every API the UI uses against IndexedDB. No network required.
// ─────────────────────────────────────────────────────────────────────────────
import { get, put, del, add, all, byIndex, uuid, wipeProfile, requestPersistentStorage, storageEstimate } from './idb.js';
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
import { hashPassword, verifyPassword } from './auth.js';

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

const DAY = 86400000;

// ── Profile helpers ──────────────────────────────────────────────────────────

async function currentProfile() {
  const pid = currentPid();
  if (!pid) return null;
  return (await get('profiles', pid)) || null;
}

async function requireProfile() {
  const p = await currentProfile();
  if (!p) { const e = new Error('No profile selected'); e.status = 401; throw e; }
  return p;
}

async function publicUser(p, nowMs = Date.now()) {
  const { level, progress, needed } = levelFromXp(p.xp || 0);
  const today = (await get('activity', `${p.id}:${sydneyDate(nowMs)}`)) || { questions: 0, correct: 0, xp: 0 };
  return {
    id: p.id, name: p.name, year: p.year, theme: p.theme || 'dark',
    course: p.course || 'nsw', courseLabel: courseLabel(p.course || 'nsw', p.year, pathwayOf(p)),
    pathway: p.year >= 11 ? pathwayOf(p) : null, pathwayName: p.year >= 11 ? PATHWAYS[pathwayOf(p)].name : null,
    role: p.role || 'student', avatar: p.avatar || '🙂',
    email: p.email || null, provider: p.provider || null, hasPassword: !!p.auth,
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

function sanitize(q, row) {
  if (q.multipart) {
    return {
      id: row.id, multipart: true, title: q.title, stem: q.stem, figure: q.figure || null,
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
    figure: q.figure || null, code: s?.code || null,
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

// ── Route implementations ────────────────────────────────────────────────────

const routes = {

  // ---- profiles / accounts ----
  'GET /profiles': async () => {
    const profiles = (await all('profiles')).sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
    return {
      profiles: profiles.map(p => ({
        id: p.id, name: p.name, year: p.year, avatar: p.avatar, role: p.role || 'student',
        isDemo: !!p.isDemo, xp: p.xp || 0,
        email: p.email || null, provider: p.provider || null, hasPassword: !!p.auth,
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
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('That email doesn’t look right.'), { status: 400 });
      const clash = (await all('profiles')).find(x => x.email === email);
      if (clash) throw Object.assign(new Error(`${email} already belongs to the profile “${clash.name}”. Pick it from the list instead.`), { status: 409 });
      p.email = email;
    }
    if (['apple', 'google', 'email'].includes(body.provider)) p.provider = body.provider;
    if (body.password) {
      const pw = String(body.password);
      if (pw.length < 4) throw Object.assign(new Error('Passwords need at least 4 characters.'), { status: 400 });
      p.auth = await hashPassword(pw);
    }
    p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);
    await put('profiles', p);
    setCurrentPid(p.id);
    return { user: await publicUser(p) };
  },
  'POST /profiles/select': async ({ id, password }) => {
    const p = await get('profiles', id);
    if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 });
    if (p.auth) {
      if (!password) throw Object.assign(new Error('This profile is protected — enter its password.'), { status: 401, needsPassword: true });
      if (!(await verifyPassword(password, p.auth))) throw Object.assign(new Error('Wrong password — try again.'), { status: 401, needsPassword: true });
    }
    p.lastActiveAt = Date.now();
    await put('profiles', p);
    setCurrentPid(id);
    return { user: await publicUser(p) };
  },
  'POST /profiles/delete': async ({ id, password }) => {
    const p = await get('profiles', id);
    if (p?.auth && !(await verifyPassword(password || '', p.auth))) {
      throw Object.assign(new Error('Enter this profile’s password to delete it.'), { status: 401, needsPassword: true });
    }
    await wipeProfile(id);
    if (currentPid() === id) setCurrentPid(null);
    return { ok: true };
  },
  'POST /profiles/password': async (body) => {
    const p = await requireProfile();
    const { current, next } = body || {};
    if (p.auth && !(await verifyPassword(String(current || ''), p.auth))) {
      throw Object.assign(new Error('Your current password didn’t match.'), { status: 401 });
    }
    if (next) {
      const pw = String(next);
      if (pw.length < 4) throw Object.assign(new Error('Passwords need at least 4 characters.'), { status: 400 });
      p.auth = await hashPassword(pw);
    } else {
      delete p.auth;
    }
    await put('profiles', p);
    return { user: await publicUser(p) };
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
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('That email doesn’t look right.'), { status: 400 });
      const clash = email ? (await all('profiles')).find(x => x.email === email && x.id !== p.id) : null;
      if (clash) throw Object.assign(new Error(`${email} already belongs to another profile.`), { status: 409 });
      p.email = email || null;
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
    const scribbleStrokes = Array.isArray(scribble) && scribble.length
      ? scribble.slice(0, 400).map(st => ({ points: (st.points || []).slice(0, 2000).map(pt => ({ x: Math.round(pt.x), y: Math.round(pt.y) })) }))
      : null;
    if ((ink && ink.strokes?.length) || photo || scribbleStrokes) {
      await put('inks', {
        id: row.id, pid: p.id, strokes: ink?.strokes || [], recognized: ink?.recognized || null,
        photo: typeof photo === 'string' && photo.startsWith('data:image/') ? photo.slice(0, 2500000) : null,
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
          multipart: true, stem: q.stem, title: q.title, figure: q.figure || null,
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
        answerType: q.answerType, mcqOptions: q.mcqOptions, figure: q.figure || null,
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
          id: qid, multipart: true, title: q.title, stem: q.stem, figure: q.figure || null,
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
        difficulty: q.difficulty, prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions, figure: q.figure || null,
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
    const c = await get('classes', params.id);
    if (!c) throw Object.assign(new Error('Class not found'), { status: 404 });
    c.studentPids = [...new Set(body.add ? [...c.studentPids, ...body.add] : c.studentPids.filter(id => !body.remove?.includes(id)))];
    await put('classes', c);
    return { class: c };
  },
  'GET /classes/:id/analytics': async (body, params) => {
    const c = await get('classes', params.id);
    if (!c) throw Object.assign(new Error('Class not found'), { status: 404 });
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
  'POST /tasks/:id/delete': async (body, params) => { await del('tasks', params.id); return { ok: true }; },

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
      ink: ink ? { strokes: ink.strokes || [], recognized: ink.recognized, scribble: ink.scribble || null, photo: ink.photo || null } : null
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
      app: 'Pri Learning', profile: p, stores
    };
  },

  'POST /data/import': async (body) => {
    if (!body || body.format !== 'pri-learning-backup' || !body.profile) {
      throw Object.assign(new Error('That file isn’t a Pri Learning backup.'), { status: 400 });
    }
    const src = body.profile;
    const newPid = uuid();
    const existing = await all('profiles');
    const name = existing.some(x => x.name === src.name) ? `${src.name} (restored)` : src.name;
    const prof = { ...src, id: newPid, name, isDemo: false };
    await put('profiles', prof);
    const stores = body.stores || {};
    let rows = 0;
    const rekey = (row) => `${newPid}:${String(row.key || '').split(':').slice(1).join(':')}`;
    for (const st of BACKUP_STORES) {
      for (const row of stores[st] || []) {
        const r = { ...row, pid: newPid };
        if (['ratings', 'reviews', 'badges', 'activity', 'bookmarks'].includes(st)) r.key = rekey(row);
        if (st === 'taskProgress') r.key = `${row.taskId}:${newPid}`;
        try {
          if (['attempts', 'rushRuns', 'matchRuns'].includes(st)) { delete r.id; await add(st, r); }
          else await put(st, r);
          rows++;
        } catch { }
      }
    }
    setCurrentPid(newPid);
    return { user: await publicUser(prof), rows };
  },

  'GET /tasks/:id/pack': async (body, params) => {
    const p = await requireProfile();
    const t = await get('tasks', params.id);
    if (!t) throw Object.assign(new Error('Task not found'), { status: 404 });
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
    const idMap = {};
    for (const cq of body.customQs || []) {
      const nid = uuid();
      if (cq.id) idMap[cq.id] = nid;
      await put('customQs', { ...cq, id: nid, ownerPid: p.id });
    }
    const src = body.task;
    const t = {
      id: uuid(), classId: null, ownerPid: p.id,
      title: String(src.title || 'Imported task').slice(0, 80),
      mode: src.customIds?.length ? 'custom' : 'subtopics',
      subtopics: (src.subtopics || []).filter(s => SUBTOPIC_BY_ID[s]),
      customIds: (src.customIds || []).map(cid => idMap[cid]).filter(Boolean),
      count: Math.min(40, Math.max(1, Number(src.count) || 10)),
      dueAt: src.dueAt ? Number(src.dueAt) : null,
      fromPack: body.teacher || true,
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
    const p = await requireProfile();
    const c = await get('classes', params.id);
    if (!c) throw Object.assign(new Error('Class not found'), { status: 404 });
    if (!body || body.format !== 'pri-progress' || !body.student) {
      throw Object.assign(new Error('That file isn’t a Pri Learning progress file.'), { status: 400 });
    }
    // one row per student name per class — a re-import replaces the old snapshot
    const olds = (await all('progressImports')).filter(r => r.classId === params.id && r.data?.student?.name === body.student.name);
    for (const old of olds) await del('progressImports', old.id);
    const row = { id: uuid(), teacherPid: p.id, classId: params.id, importedAt: Date.now(), data: body };
    await put('progressImports', row);
    return { ok: true, student: body.student.name };
  },

  // ---- custom questions (teacher tool) ----
  'GET /custom-questions': async () => {
    const p = await requireProfile();
    return { questions: await byIndex('customQs', 'ownerPid', p.id) };
  },
  'POST /custom-questions': async (body) => {
    const p = await requireProfile();
    const { prompt, answerType, answer, solutionText, mcqOptions, difficulty } = body;
    if (!prompt || !answerType) throw Object.assign(new Error('A prompt and answer type are required'), { status: 400 });
    const q = {
      subtopic: 'custom', custom: true, customName: body.name || 'Custom question',
      difficulty: Math.min(4, Math.max(1, Number(difficulty) || 2)),
      prompt: String(prompt), answerType,
      answer: answerType === 'mcq' ? { correctIndex: Number(answer?.correctIndex) || 0 } :
        answerType === 'expression' ? { expr: String(answer?.expr || '') } :
          { value: Number(answer?.value) },
      mcqOptions: answerType === 'mcq' ? (mcqOptions || []).slice(0, 4) : undefined,
      steps: [{ h: 'Teacher solution', d: String(solutionText || 'See your teacher for the worked solution.') }],
      hints: body.hint ? [String(body.hint)] : [],
      solutionText: String(solutionText || '')
    };
    const rec = { id: uuid(), ownerPid: p.id, q, difficulty: q.difficulty, name: q.customName, createdAt: Date.now() };
    await put('customQs', rec);
    return { question: rec };
  },
  'POST /custom-questions/:id/delete': async (body, params) => { await del('customQs', params.id); return { ok: true }; },

  // ---- ink archive ----
  'GET /ink/:id': async (body, params) => {
    const row = await get('inks', params.id);
    return { ink: row || null };
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
