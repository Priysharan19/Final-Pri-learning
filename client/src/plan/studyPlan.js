// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the study planner
//
// A multi-week plan over the adaptive model, built by one pure function. No
// model call, no network, no stored output: the plan is derived from the same
// evidence the adaptive engine already keeps (Elo ratings, FSRS review rows,
// exam weights) plus three settings the student chose (weekly minutes, exam
// date, rest day). Run it twice on the same inputs and it returns the same
// plan; that is what makes it testable and what lets the Home card and the
// Plan page agree without a shared cache.
//
// Ordering rules, in priority order:
//   1. FSRS reviews that are due are scheduled before anything else that day,
//      earliest due first; what does not fit is carried to the next day.
//   2. Remaining minutes go to exam weight × weakness × syllabus order, where
//      weakness is the gap below the engine's mastery ceiling and syllabus
//      order favours the chapter a class reaches first. A never-attempted
//      chapter is a `learn` session; one with history is `practise`.
//   3. Sessions interleave: the same chapter is damped for two days after it
//      was planned and a second session from the same strand on one day is
//      damped, so a plan reads as a rotation rather than a block.
//   4. Daily minutes are capped. The cap is the weekly budget spread over the
//      active days, never above DAILY_CAP, never below one short session.
//   5. In the fortnight before an exam, one `mock` session a week is planned.
//
// Re-planning is incremental. A session id is `<date>:<type>:<subtopic>`, so a
// re-plan that reaches the same decision keeps the same id, and today's
// sessions can be pinned from the previous plan so a practise that just
// changed a rating does not swap the chapter under the student mid-day.
//
// Every "why" is a catalogue key with its variables, never English, so the
// Hindi reader gets the reason in Hindi.
// ─────────────────────────────────────────────────────────────────────────────
import { HIGH_EXAM_SHARE, examShares } from '../engine/adaptive.js';
import { candidatesForProfile, candidateState, candidateIndex } from './candidates.js';

const DAY = 86_400_000;

export const PLAN_LIMITS = Object.freeze({
  minWeeklyMinutes: 30, maxWeeklyMinutes: 1200, dailyCap: 120, minSession: 10,
  defaultWeeks: 4, maxWeeks: 12, mockWindowDays: 14, masteredAt: 0.88
});

export const SESSION_MINUTES = Object.freeze({ review: 10, learn: 20, practise: 15, mock: 30 });
export const SESSION_TYPES = Object.freeze(['review', 'learn', 'practise', 'mock']);

// Keys live in a table so the catalogue suite can see them reached.
export const REASON_KEYS = Object.freeze({
  due: 'plan.reason.due', overdue: 'plan.reason.overdue', weak: 'plan.reason.weak',
  heavy: 'plan.reason.heavy', newGround: 'plan.reason.newGround', rotation: 'plan.reason.rotation',
  mock: 'plan.reason.mock', pinned: 'plan.reason.pinned'
});

// ── Calendar arithmetic ──────────────────────────────────────────────────────
// Dates are `YYYY-MM-DD` strings and the arithmetic is done in UTC, which has
// no daylight saving: stepping a day is pure calendar arithmetic and never
// depends on the student's timezone. The caller hands in `today` already keyed
// in the profile's own timezone (lib/locale dayKey), which is the one place a
// timezone belongs.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDateKey(value) {
  if (typeof value === 'string' && DATE_RE.test(value)) return value;
  const ms = Number(value);
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString().slice(0, 10);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

const utcOf = date => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (date, n) => new Date(utcOf(date) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (from, to) => Math.round((utcOf(to) - utcOf(from)) / DAY);
/** 0 Sunday … 6 Saturday, the same numbering as Date#getDay. */
export const weekdayOf = date => new Date(utcOf(date)).getUTCDay();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const byId = (a, b) => a.id.localeCompare(b.id);

// ── Settings ─────────────────────────────────────────────────────────────────

/** Clean settings for the planner: out-of-range values fall back, never throw. */
export function normalizePlanSettings(raw = {}, today = null) {
  const weekly = Number(raw?.weeklyMinutes);
  const weeklyMinutes = Number.isFinite(weekly)
    ? clamp(Math.round(weekly), PLAN_LIMITS.minWeeklyMinutes, PLAN_LIMITS.maxWeeklyMinutes)
    : 150;
  let examDate = toDateKey(raw?.examDate);
  // An exam that has passed is no longer a target; the plan returns to the
  // steady four-week rotation rather than counting down to a negative number.
  if (examDate && today && diffDays(today, examDate) < 0) examDate = null;
  // null/'' mean "no rest day"; Number(null) is 0, which would be Sunday.
  const rest = raw?.restDay == null || raw.restDay === '' ? null : Number(raw.restDay);
  const restDay = Number.isInteger(rest) && rest >= 0 && rest <= 6 ? rest : null;
  const hour = Number(raw?.sessionHour);
  const sessionHour = Number.isInteger(hour) && hour >= 5 && hour <= 22 ? hour : 17;
  return { weeklyMinutes, examDate, restDay, sessionHour };
}

/** The minutes one active day may hold. */
export function dailyBudgetOf(weeklyMinutes, restDay = null) {
  const active = restDay == null ? 7 : 6;
  return clamp(Math.round(weeklyMinutes / active), PLAN_LIMITS.minSession, PLAN_LIMITS.dailyCap);
}

// ── Reviews ──────────────────────────────────────────────────────────────────

/**
 * Due reviews grouped per candidate: one review session covers every due row a
 * chapter has. A row whose key is outside the candidate list (revision kept
 * from an earlier class) is still honoured under its own id — a due review is
 * due whatever scope it sits in.
 */
function pendingReviews(reviews, index, today) {
  const groups = new Map();
  for (const row of reviews || []) {
    const key = row?.subtopic;
    if (typeof key !== 'string' || !key) continue;
    const dueAt = Number(row.dueAt ?? row.due_at);
    if (!Number.isFinite(dueAt) || dueAt <= 0) continue;
    const dueDate = toDateKey(dueAt);
    const candidate = index.get(key) || { id: key, name: row.name || key, strand: row.strand || '', keys: [key], order: Infinity, own: false };
    const g = groups.get(candidate.id) || { candidate, dueDate, count: 0 };
    g.count += 1;
    if (dueDate < g.dueDate) g.dueDate = dueDate;
    groups.set(candidate.id, g);
  }
  return [...groups.values()]
    .map(g => ({ ...g, dueDate: g.dueDate < today ? today : g.dueDate, overdue: g.dueDate < today }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.candidate.id.localeCompare(b.candidate.id));
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreCandidates(candidates, ratings, nowMs, examDate, today) {
  const { share } = examShares(candidates);
  const daysToExam = examDate ? diffDays(today, examDate) : null;
  // Closer to the paper, the paper's weighting matters more than it did.
  const examPull = daysToExam == null ? 1 : daysToExam <= 30 ? 1.5 : 1.2;
  const n = Math.max(1, candidates.length - 1);
  return candidates.map(c => {
    const st = candidateState(c, ratings, nowMs);
    const examShare = share(c);
    const gap = Math.max(0, 0.92 - st.mastery);
    const days = st.last_at ? (nowMs - st.last_at) / DAY : 0;
    const urgency = st.attempts ? Math.min(2, 1 + days / 21) : 1.25;
    // Syllabus order: a class reaches the first chapter first, and that pull is
    // strongest on ground not yet met, where there is no evidence to rank by.
    const orderBoost = 1 + (st.attempts === 0 ? 0.6 : 0.25) * (1 - Math.min(c.order, n) / n);
    const score = Math.pow(examShare, examPull) * gap * urgency * orderBoost;
    const type = st.attempts === 0 ? 'learn' : 'practise';
    const reason = type === 'learn' ? 'newGround'
      : st.mastery < 0.45 ? 'weak'
        : c.own && examShare >= HIGH_EXAM_SHARE ? 'heavy'
          : 'rotation';
    return { candidate: c, state: st, examShare, score, type, reason, mastered: st.mastery >= PLAN_LIMITS.masteredAt };
  });
}

const sessionId = (date, type, subtopic) => `${date}:${type}:${subtopic || 'paper'}`;

function session(date, type, candidate, minutes, reasonKey, vars = {}) {
  return {
    id: sessionId(date, type, candidate?.id),
    date, type, minutes,
    subtopic: candidate?.id || null,
    name: candidate?.name || null,
    strand: candidate?.strand || null,
    keys: candidate ? [...(candidate.keys || [candidate.id])] : [],
    reason: { key: REASON_KEYS[reasonKey], vars }
  };
}

// ── The planner ──────────────────────────────────────────────────────────────

/**
 * buildStudyPlan({ profile, ratings, reviews, examDate, weeklyMinutes, today,
 *                  restDay, candidates, previous, nowMs })
 *
 *   profile        the local profile (course, year, pathway, indiaTrack)
 *   ratings        { key: { rating, attempts, correct, last_at } } as stored
 *   reviews        FSRS rows [{ subtopic, dueAt }] (or /reviews rows, due_at)
 *   examDate       'YYYY-MM-DD' or null
 *   weeklyMinutes  the student's weekly budget
 *   today          'YYYY-MM-DD' in the profile's timezone, or a timestamp
 *   restDay        0–6 or null
 *   candidates     override the derived candidate list (tests, previews)
 *   previous       the last plan, to pin today's sessions on a re-plan
 *   nowMs          the instant mastery is measured at (defaults to today, noon UTC)
 *
 * Returns { generatedFor, settings, weeks, today, summary }.
 */
export function buildStudyPlan({
  profile = {}, ratings = {}, reviews = [], examDate = null, weeklyMinutes = 150,
  today = Date.now(), restDay = null, candidates = null, previous = null, nowMs = null
} = {}) {
  const start = toDateKey(today) || toDateKey(Date.now());
  const settings = normalizePlanSettings({ weeklyMinutes, examDate, restDay }, start);
  const measuredAt = Number.isFinite(nowMs) ? nowMs : utcOf(start) + DAY / 2;
  const list = (Array.isArray(candidates) ? candidates : candidatesForProfile(profile))
    .filter(c => c && typeof c.id === 'string')
    .map((c, i) => ({ ...c, order: Number.isFinite(c.order) ? c.order : i, keys: c.keys || [c.id] }));
  const index = candidateIndex(list);
  const budget = dailyBudgetOf(settings.weeklyMinutes, settings.restDay);
  const daysToExam = settings.examDate ? diffDays(start, settings.examDate) : null;
  const weeksCount = daysToExam == null
    ? PLAN_LIMITS.defaultWeeks
    : clamp(Math.ceil((daysToExam + 1) / 7), 1, PLAN_LIMITS.maxWeeks);

  const scored = scoreCandidates(list, ratings, measuredAt, settings.examDate, start).sort((a, b) => b.score - a.score || byId(a.candidate, b.candidate));
  const pending = pendingReviews(reviews, index, start);
  const lastPlanned = new Map();   // candidate id → day index it was last planned
  const timesPlanned = new Map();  // candidate id → sessions planned so far (fairness)
  const pinnedToday = previous?.today?.date === start ? previous.today.sessions || [] : [];

  const weeks = [];
  let mockThisWeek = false;
  let counts = { review: 0, learn: 0, practise: 0, mock: 0 };

  for (let d = 0; d < weeksCount * 7; d++) {
    const date = addDays(start, d);
    const weekday = weekdayOf(date);
    if (d % 7 === 0) {
      mockThisWeek = false;
      weeks.push({ id: `w${weeks.length}`, index: weeks.length, start: date, end: addDays(date, 6), days: [], minutes: 0 });
    }
    const week = weeks[weeks.length - 1];
    const examDay = settings.examDate === date;
    // The exam day and anything after it carry no sessions: the plan ends at
    // the paper, and a day past it is shown, not filled.
    const afterExam = settings.examDate != null && date >= settings.examDate;
    const rest = (settings.restDay != null && weekday === settings.restDay) || afterExam;
    const sessions = [];
    let remaining = rest ? 0 : budget;
    const strandsToday = new Set();
    const usedToday = new Set();

    const place = s => {
      sessions.push(s);
      remaining -= s.minutes;
      if (s.subtopic) {
        usedToday.add(s.subtopic);
        lastPlanned.set(s.subtopic, d);
        timesPlanned.set(s.subtopic, (timesPlanned.get(s.subtopic) || 0) + 1);
      }
      if (s.strand) strandsToday.add(s.strand);
      counts[s.type] += 1;
    };

    // 0 · Today's sessions from the previous plan stay where they were, as
    //     long as they are still true: a review session whose rows are no
    //     longer due, or a chapter no longer in scope, is dropped.
    if (d === 0 && !rest) {
      for (const prev of pinnedToday) {
        if (!SESSION_TYPES.includes(prev?.type) || remaining < PLAN_LIMITS.minSession) continue;
        if (prev.type === 'mock') {
          if (!settings.examDate) continue;
          place(session(date, 'mock', null, Math.min(SESSION_MINUTES.mock, remaining), 'mock', { date: settings.examDate }));
          mockThisWeek = true;
          continue;
        }
        const candidate = index.get(prev.subtopic) || pending.find(g => g.candidate.id === prev.subtopic)?.candidate;
        if (!candidate || usedToday.has(candidate.id)) continue;
        if (prev.type === 'review') {
          const at = pending.findIndex(g => g.candidate.id === candidate.id && g.dueDate <= date);
          if (at < 0) continue;
          const g = pending.splice(at, 1)[0];
          place(session(date, 'review', candidate, Math.min(SESSION_MINUTES.review, remaining), g.overdue ? 'overdue' : 'due', { n: g.count, count: g.count }));
        } else {
          place(session(date, prev.type, candidate, Math.min(SESSION_MINUTES[prev.type], remaining), 'pinned'));
        }
      }
    }

    // 1 · Due reviews first, earliest due first; the rest carry over.
    if (!rest) {
      for (let i = 0; i < pending.length && remaining >= PLAN_LIMITS.minSession;) {
        const g = pending[i];
        if (g.dueDate > date) { i++; continue; }
        if (usedToday.has(g.candidate.id)) { i++; continue; }
        pending.splice(i, 1);
        place(session(date, 'review', g.candidate, Math.min(SESSION_MINUTES.review, remaining), g.overdue || g.dueDate < date ? 'overdue' : 'due', { n: g.count, count: g.count }));
      }
    }

    // 2 · One mock a week inside the exam fortnight, towards the end of the
    //     week, on the first of those days with room for it. A short daily
    //     budget gives the mock the whole day rather than skipping it.
    if (!rest && !mockThisWeek && daysToExam != null && daysToExam - d <= PLAN_LIMITS.mockWindowDays && d < daysToExam) {
      const mockMinutes = Math.min(SESSION_MINUTES.mock, budget);
      const lateInWeek = d % 7 >= 4 || d === daysToExam - 1;
      if (lateInWeek && remaining >= mockMinutes) {
        place(session(date, 'mock', null, mockMinutes, 'mock', { date: settings.examDate }));
        mockThisWeek = true;
      }
    }

    // 3 · Exam weight × weakness × syllabus order, interleaved.
    if (!rest) {
      while (remaining >= PLAN_LIMITS.minSession) {
        let best = null, bestScore = -1;
        for (const row of scored) {
          if (row.mastered || usedToday.has(row.candidate.id)) continue;
          const last = lastPlanned.get(row.candidate.id);
          const recency = last == null ? 1 : d - last <= 1 ? 0.35 : d - last === 2 ? 0.7 : 1;
          const strand = strandsToday.has(row.candidate.strand) ? 0.6 : 1;
          // Fairness: every session a chapter already holds makes the next one
          // cost more, so the heaviest chapter cannot own the whole plan and a
          // light one is still met before the paper.
          const fairness = 1 / (1 + (timesPlanned.get(row.candidate.id) || 0));
          const eff = row.score * recency * strand * fairness;
          if (eff > bestScore || (eff === bestScore && best && byId(row.candidate, best.candidate) < 0)) { best = row; bestScore = eff; }
        }
        if (!best || bestScore <= 0) break;
        const vars = best.reason === 'weak' ? { mastery: Math.round(best.state.mastery * 100) }
          : best.reason === 'heavy' ? { share: Math.round(best.examShare * 100) / 100 } : {};
        place(session(date, best.type, best.candidate, Math.min(SESSION_MINUTES[best.type], remaining), best.reason, vars));
      }
    }

    const minutes = sessions.reduce((n, s) => n + s.minutes, 0);
    week.days.push({ date, weekday, rest: rest && !afterExam, examDay, afterExam: afterExam && !examDay, minutes, budget: rest ? 0 : budget, sessions });
    week.minutes += minutes;
  }

  const todayRow = weeks[0].days[0];
  const totalMinutes = weeks.reduce((n, w) => n + w.minutes, 0);
  return {
    generatedFor: start,
    settings: { ...settings, dailyBudget: budget, weeks: weeksCount },
    weeks,
    today: todayRow,
    summary: {
      candidates: list.length,
      empty: list.length === 0 && pending.length === 0 && totalMinutes === 0,
      totalMinutes, dailyBudget: budget, weeks: weeksCount,
      daysToExam, examDate: settings.examDate,
      sessions: counts,
      carriedReviews: pending.reduce((n, g) => n + g.count, 0)
    }
  };
}

// ── Progress against today ───────────────────────────────────────────────────

/**
 * Today's sessions marked done from the attempts made today. A session counts
 * as done once any attempt landed on one of its rating keys; the minutes are
 * whatever the activity row says was spent, capped at the day's plan.
 */
export function todayProgress(plan, { attempts = [], minutesSpent = 0 } = {}) {
  const day = plan?.today;
  if (!day) return { sessions: [], done: 0, total: 0, minutesDone: 0, minutesPlanned: 0, fraction: 0 };
  const touched = new Set((attempts || []).map(a => a?.subtopic).filter(Boolean));
  const sessions = day.sessions.map(s => ({ ...s, done: s.type === 'mock' ? false : s.keys.some(k => touched.has(k)) }));
  const done = sessions.filter(s => s.done).length;
  const minutesDone = Math.min(day.minutes, Math.max(0, Math.round(Number(minutesSpent) || 0)));
  const fraction = day.minutes ? Math.min(1, Math.max(minutesDone / day.minutes, sessions.length ? done / sessions.length : 0)) : 0;
  return { sessions, done, total: sessions.length, minutesDone, minutesPlanned: day.minutes, fraction };
}

/** The first unfinished session today, which is what the Home card offers. */
export function nextSession(progress) {
  return (progress?.sessions || []).find(s => !s.done) || null;
}
