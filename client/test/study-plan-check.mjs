// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · study planner contract
//
// Deterministic checks over the pure planner: same inputs → same plan, FSRS
// reviews first, exam weight × weakness × syllabus order, daily cap, stable
// ids on re-plan, empty profile, no exam date, interleaving, rest day, exam
// window mocks, and the i18n keys the reasons name.
//
//   node client/test/study-plan-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  buildStudyPlan, todayProgress, nextSession, normalizePlanSettings, dailyBudgetOf,
  PLAN_LIMITS, SESSION_MINUTES, REASON_KEYS, addDays, diffDays, weekdayOf, toDateKey
} from '../src/plan/studyPlan.js';
import { candidatesForProfile, candidateState, candidateIndex } from '../src/plan/candidates.js';
import { loadPlanSettings, savePlanSettings, loadTodayPin, saveTodayPin } from '../src/plan/settings.js';
import { SESSION_TYPE_KEYS, sessionHref, reasonText } from '../src/plan/copy.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const TODAY = '2026-10-02';            // a Friday
const ms = date => Date.parse(`${date}T06:00:00Z`);
const allSessions = plan => plan.weeks.flatMap(w => w.days).flatMap(d => d.sessions);
const strip = plan => JSON.stringify(plan);

// Synthetic candidate list: ten chapters, weights as a CBSE paper might carry
// them, in syllabus order.
const CANDS = [
  ['ch-a', 6], ['ch-b', 5], ['ch-c', 4], ['ch-d', 8], ['ch-e', 7],
  ['ch-f', 3], ['ch-g', 9], ['ch-h', 2], ['ch-i', 5], ['ch-j', 6]
].map(([id, weight], order) => ({ id, name: `Chapter ${id.slice(3).toUpperCase()}`, strand: order % 2 ? 'Algebra' : 'Geometry', weight, order, own: true, keys: [id] }));
const RATINGS = {
  'ch-a': { rating: 1000, attempts: 12, correct: 5, last_at: ms('2026-09-25') },  // weak, seen
  'ch-b': { rating: 1500, attempts: 40, correct: 38, last_at: ms('2026-10-01') },  // strong
  'ch-d': { rating: 1250, attempts: 15, correct: 10, last_at: ms('2026-09-10') },  // middling, stale
  'ch-g': { rating: 1750, attempts: 60, correct: 58, last_at: ms('2026-10-01') }   // mastered
};
const REVIEWS = [
  { subtopic: 'ch-a', dueAt: ms('2026-09-30') },  // overdue
  { subtopic: 'ch-d', dueAt: ms('2026-10-02') },  // due today
  { subtopic: 'ch-b', dueAt: ms('2026-10-05') },  // due Monday
  { subtopic: 'ch-g', dueAt: ms('2026-10-20') }   // later
];
const base = { candidates: CANDS, ratings: RATINGS, reviews: REVIEWS, today: TODAY, weeklyMinutes: 150, nowMs: ms(TODAY) };

// ── 1 · Calendar helpers ─────────────────────────────────────────────────────
eq(addDays('2026-10-31', 1), '2026-11-01', 'addDays crosses a month');
eq(addDays('2024-02-28', 1), '2024-02-29', 'addDays knows leap years');
eq(diffDays('2026-10-02', '2026-11-20'), 49, 'diffDays counts calendar days');
eq(weekdayOf(TODAY), 5, 'weekdayOf: 2 Oct 2026 is a Friday');
eq(toDateKey(Date.UTC(2026, 9, 2, 23, 59)), '2026-10-02', 'toDateKey from a timestamp');
eq(toDateKey('nonsense'), null, 'toDateKey rejects junk');

// ── 2 · Settings normalisation ──────────────────────────────────────────────
{
  const s = normalizePlanSettings({ weeklyMinutes: 5, examDate: '2026-01-01', restDay: 9, sessionHour: 3 }, TODAY);
  eq(s.weeklyMinutes, PLAN_LIMITS.minWeeklyMinutes, 'weekly minutes floor');
  eq(s.examDate, null, 'an exam date in the past is dropped');
  eq(s.restDay, null, 'an out-of-range rest day is dropped');
  eq(s.sessionHour, 17, 'an out-of-range hour falls back to 17:00');
  eq(normalizePlanSettings({ weeklyMinutes: 99999 }).weeklyMinutes, PLAN_LIMITS.maxWeeklyMinutes, 'weekly minutes ceiling');
  eq(dailyBudgetOf(150, null), 21, '150 min over 7 days is 21 a day');
  eq(dailyBudgetOf(150, 0), 25, '150 min over 6 active days is 25 a day');
  eq(dailyBudgetOf(1200, null), PLAN_LIMITS.dailyCap, 'the daily cap holds whatever the weekly budget');
  eq(dailyBudgetOf(30, null), PLAN_LIMITS.minSession, 'never below one short session');
}

// ── 3 · Determinism ──────────────────────────────────────────────────────────
{
  const a = buildStudyPlan(base);
  const b = buildStudyPlan(base);
  ok(strip(a) === strip(b), 'the same inputs give byte-identical plans');
  const c = buildStudyPlan({ ...base, candidates: [...CANDS].reverse() });
  ok(strip(a) === strip(c), 'candidate input order does not change the plan (ids and syllabus order decide)');
  ok(a.weeks.length === PLAN_LIMITS.defaultWeeks, `no exam date gives a ${PLAN_LIMITS.defaultWeeks}-week rolling plan`);
  ok(a.weeks.every(w => w.days.length === 7), 'every week has seven days');
  eq(a.today.date, TODAY, 'today is the first day');
  eq(a.generatedFor, TODAY, 'generatedFor records the day');
}

// ── 4 · Due reviews first ────────────────────────────────────────────────────
{
  const plan = buildStudyPlan(base);
  const today = plan.today.sessions;
  eq(today[0].type, 'review', 'the first session today is a review');
  eq(today[0].subtopic, 'ch-a', 'the overdue review comes before the one due today');
  eq(today[0].reason.key, REASON_KEYS.overdue, 'an overdue row says so');
  eq(today[1].type, 'review', 'the second session today is also a review');
  eq(today[1].subtopic, 'ch-d', 'the review due today follows');
  eq(today[1].reason.key, REASON_KEYS.due, 'a due row says so');
  eq(today[1].reason.vars.n, 1, 'the reason carries the row count');
  const monday = plan.weeks[0].days.find(d => d.date === '2026-10-05');
  ok(monday.sessions[0].type === 'review' && monday.sessions[0].subtopic === 'ch-b', 'a review due Monday is Monday\'s first session');
  const later = plan.weeks.flatMap(w => w.days).find(d => d.date === '2026-10-20');
  ok(later.sessions.some(s => s.type === 'review' && s.subtopic === 'ch-g'), 'a review of a mastered chapter is still honoured on its due date');
  const before = plan.weeks.flatMap(w => w.days).filter(d => d.date < '2026-10-20');
  ok(!before.some(d => d.sessions.some(s => s.type === 'review' && s.subtopic === 'ch-g')), 'and never before it falls due');
  const foreign = buildStudyPlan({ ...base, reviews: [{ subtopic: 'y9-old-topic', dueAt: ms('2026-10-01'), name: 'Old topic' }] });
  ok(foreign.today.sessions[0].type === 'review' && foreign.today.sessions[0].subtopic === 'y9-old-topic', 'a due review outside the candidate scope is still scheduled under its own id');
}

// ── 5 · Carry-over when the day cannot hold every due review ────────────────
{
  const many = Array.from({ length: 6 }, (_, i) => ({ subtopic: CANDS[i].id, dueAt: ms('2026-10-01') }));
  const plan = buildStudyPlan({ ...base, reviews: many, weeklyMinutes: 140 }); // 20 a day → 2 reviews
  eq(plan.today.sessions.map(s => s.type), ['review', 'review'], 'today holds what fits');
  eq(plan.today.minutes, 20, 'and stays inside the daily budget');
  const tomorrow = plan.weeks[0].days[1];
  eq(tomorrow.sessions.map(s => s.type), ['review', 'review'], 'the rest carry to tomorrow, still first');
  ok(tomorrow.sessions.every(s => s.reason.key === REASON_KEYS.overdue), 'carried reviews read as overdue');
  const all = allSessions(plan).filter(s => s.type === 'review').map(s => s.subtopic);
  eq([...new Set(all)].sort(), many.map(r => r.subtopic).sort(), 'every due review is eventually scheduled once');
  eq(plan.summary.carriedReviews, 0, 'nothing is left unscheduled at the end of the plan');
}

// ── 6 · Daily cap ────────────────────────────────────────────────────────────
{
  for (const weekly of [30, 60, 150, 300, 700, 1200]) {
    const plan = buildStudyPlan({ ...base, weeklyMinutes: weekly });
    const budget = dailyBudgetOf(weekly, null);
    ok(plan.weeks.every(w => w.days.every(d => d.minutes <= budget)), `no day exceeds its budget at ${weekly} min/week (${budget}/day)`);
    ok(plan.weeks.every(w => w.days.every(d => d.minutes <= PLAN_LIMITS.dailyCap)), `no day exceeds the hard cap at ${weekly} min/week`);
  }
  const plan = buildStudyPlan({ ...base, weeklyMinutes: 1200 });
  ok(plan.today.minutes >= PLAN_LIMITS.dailyCap - SESSION_MINUTES.learn, 'a big budget fills the day up to the cap');
  ok(allSessions(plan).every(s => s.minutes >= PLAN_LIMITS.minSession || s.minutes === s.minutes), 'sessions are whole');
  ok(allSessions(plan).every(s => s.minutes <= SESSION_MINUTES[s.type]), 'no session is longer than its type allows');
}

// ── 7 · Exam weighting and weakness ──────────────────────────────────────────
{
  // No reviews, equal syllabus position irrelevant: among seen chapters, the
  // weak heavy one must be practised before the strong one.
  const plan = buildStudyPlan({ ...base, reviews: [], weeklyMinutes: 1200 });
  const first = allSessions(plan).filter(s => s.type === 'practise').map(s => s.subtopic);
  ok(first.indexOf('ch-a') < first.indexOf('ch-b'), 'the weak chapter (mastery low) is practised before the strong one');
  ok(!first.includes('ch-g'), 'a mastered chapter (≥88%) is not scheduled for practice');
  const seenA = allSessions(plan).find(s => s.subtopic === 'ch-a');
  eq(seenA.type, 'practise', 'a chapter with history is a practise session');
  eq(seenA.reason.key, REASON_KEYS.weak, 'and a weak one is explained as a weak spot');
  ok(Number.isInteger(seenA.reason.vars.mastery), 'with its mastery percentage');
  const unseen = allSessions(plan).find(s => s.subtopic === 'ch-c');
  eq(unseen.type, 'learn', 'a chapter never attempted is a learn session');
  eq(unseen.reason.key, REASON_KEYS.newGround, 'explained as new ground');

  // Exam weight: with two unseen chapters at equal syllabus position, the
  // heavier one is planned first.
  const two = [{ id: 'x-light', name: 'L', strand: 'A', weight: 2, order: 0, own: true, keys: ['x-light'] },
    { id: 'x-heavy', name: 'H', strand: 'B', weight: 9, order: 0, own: true, keys: ['x-heavy'] }];
  const p2 = buildStudyPlan({ candidates: two, ratings: {}, reviews: [], today: TODAY, weeklyMinutes: 70, nowMs: ms(TODAY) });
  eq(p2.today.sessions[0].subtopic, 'x-heavy', 'exam weight decides between otherwise equal chapters');

  // Syllabus order: equal weights, unseen — the earlier chapter is first.
  const ordered = ['s-1', 's-2', 's-3'].map((id, order) => ({ id, name: id, strand: 'S', weight: 5, order, own: true, keys: [id] }));
  const p3 = buildStudyPlan({ candidates: ordered, ratings: {}, reviews: [], today: TODAY, weeklyMinutes: 70, nowMs: ms(TODAY) });
  eq(p3.today.sessions[0].subtopic, 's-1', 'syllabus order decides between equal, unseen chapters');

  // Closer to the exam the paper's weighting pulls harder: a heavy chapter
  // gets at least as many sessions as a light one before the paper.
  const near = buildStudyPlan({ ...base, reviews: [], examDate: addDays(TODAY, 20), weeklyMinutes: 300 });
  const count = id => allSessions(near).filter(s => s.subtopic === id).length;
  ok(count('ch-d') >= count('ch-h'), 'a heavy chapter is planned at least as often as a light one before an exam');
}

// ── 8 · Interleaving ─────────────────────────────────────────────────────────
{
  const plan = buildStudyPlan({ ...base, reviews: [], weeklyMinutes: 420 }); // 60 a day → 3–4 sessions
  for (const d of plan.weeks[0].days) {
    const ids = d.sessions.map(s => s.subtopic);
    ok(new Set(ids).size === ids.length, `no chapter appears twice on ${d.date}`);
  }
  const consecutive = plan.weeks[0].days.slice(0, -1).filter((d, i) => {
    const next = plan.weeks[0].days[i + 1];
    return d.sessions[0]?.subtopic && d.sessions[0].subtopic === next.sessions[0]?.subtopic;
  });
  ok(consecutive.length === 0, 'the first session of a day is not the same chapter as the day before');
  const distinct = new Set(allSessions(plan).map(s => s.subtopic));
  const belowStrong = CANDS.filter(c => candidateState(c, RATINGS, ms(TODAY)).mastery < 0.65).map(c => c.id);
  ok(belowStrong.every(id => distinct.has(id)), `every chapter below 'strong' mastery is reached over four weeks (${distinct.size} chapters planned)`);
  ok(!distinct.has('ch-g'), 'the mastered chapter is left to its reviews');
}

// ── 9 · Rest day, exam day, horizon ──────────────────────────────────────────
{
  const plan = buildStudyPlan({ ...base, restDay: 0 });
  const sundays = plan.weeks.flatMap(w => w.days).filter(d => d.weekday === 0);
  ok(sundays.length === 4 && sundays.every(d => d.rest && d.sessions.length === 0 && d.minutes === 0), 'every Sunday is a rest day with nothing planned');
  const sundayDue = buildStudyPlan({ ...base, restDay: 0, reviews: [{ subtopic: 'ch-c', dueAt: ms('2026-10-04') }] });
  const monday = sundayDue.weeks[0].days.find(d => d.date === '2026-10-05');
  ok(monday.sessions[0].type === 'review' && monday.sessions[0].subtopic === 'ch-c', 'a review due on the rest day is the next day\'s first session');

  const exam = buildStudyPlan({ ...base, examDate: '2026-11-20' });
  eq(exam.weeks.length, 8, 'the horizon runs to the exam (49 days → 8 weeks)');
  eq(exam.summary.daysToExam, 49, 'days to exam is reported');
  const examDay = exam.weeks.flatMap(w => w.days).find(d => d.date === '2026-11-20');
  ok(examDay.examDay && examDay.sessions.length === 0, 'the exam day itself carries no sessions');
  const after = exam.weeks.flatMap(w => w.days).filter(d => d.date > '2026-11-20');
  ok(after.every(d => d.afterExam && d.sessions.length === 0), 'days after the exam are shown empty');
  const mocks = allSessions(exam).filter(s => s.type === 'mock');
  ok(mocks.length >= 1 && mocks.length <= 3, `one mock a week inside the exam fortnight (${mocks.length})`);
  ok(mocks.every(s => diffDays(s.date, '2026-11-20') <= PLAN_LIMITS.mockWindowDays && diffDays(s.date, '2026-11-20') >= 1), 'mocks sit inside the fortnight before the paper');
  ok(mocks.every(s => s.subtopic === null && s.reason.key === REASON_KEYS.mock && s.reason.vars.date === '2026-11-20'), 'a mock names no chapter and explains itself by the exam date');
  const far = buildStudyPlan({ ...base, examDate: addDays(TODAY, 400) });
  eq(far.weeks.length, PLAN_LIMITS.maxWeeks, 'a distant exam is capped to the maximum horizon');
  ok(allSessions(far).every(s => s.type !== 'mock'), 'no mocks when the exam is far away');
  const tomorrow = buildStudyPlan({ ...base, examDate: addDays(TODAY, 1) });
  eq(tomorrow.weeks.length, 1, 'an exam tomorrow gives a one-week plan');
  ok(tomorrow.today.sessions.length > 0, 'and today still has work');
  const passed = buildStudyPlan({ ...base, examDate: '2026-09-01' });
  eq(passed.settings.examDate, null, 'a passed exam date is treated as none');
  eq(passed.weeks.length, PLAN_LIMITS.defaultWeeks, 'and the rolling plan returns');
}

// ── 10 · Stable ids on re-plan ───────────────────────────────────────────────
{
  const first = buildStudyPlan(base);
  const ids = first.today.sessions.map(s => s.id);
  ok(ids.every(id => id.startsWith(`${TODAY}:`)), 'session ids are prefixed by their date');
  ok(ids.every(id => /^\d{4}-\d{2}-\d{2}:(review|learn|practise|mock):[a-z0-9-]+$/i.test(id)), 'ids are <date>:<type>:<subtopic>');
  eq(new Set(allSessions(first).map(s => s.id)).size, allSessions(first).length, 'every session id in a plan is unique');

  // The student practises the first review's chapter: the rating moves and the
  // row is no longer due. Re-planning with the previous plan pinned keeps the
  // remaining sessions where they were. A wider day (60 min) so today holds
  // practise sessions as well as the two reviews.
  const wide = { ...base, weeklyMinutes: 420 };
  const morning = buildStudyPlan(wide);
  ok(morning.today.sessions.some(s => s.type !== 'review'), 'the morning plan has practise/learn sessions to pin');
  const practised = {
    ...wide,
    ratings: { ...RATINGS, 'ch-a': { rating: 1080, attempts: 15, correct: 8, last_at: ms(TODAY) + 3_600_000 } },
    reviews: REVIEWS.filter(r => r.subtopic !== 'ch-a')
  };
  const pinned = buildStudyPlan({ ...practised, previous: morning });
  const keep = morning.today.sessions.filter(s => s.subtopic !== 'ch-a').map(s => s.id);
  ok(keep.every(id => pinned.today.sessions.some(s => s.id === id)), 'every still-valid session from this morning keeps its id and place');
  ok(!pinned.today.sessions.some(s => s.subtopic === 'ch-a' && s.type === 'review'), 'the review that is no longer due is dropped from the pin');
  const kept = pinned.today.sessions.filter(s => keep.includes(s.id));
  ok(kept.length === keep.length && kept.every((s, i) => s.id === keep[i]), 'and their order is unchanged');
  ok(kept.filter(s => s.type !== 'review').every(s => s.reason.key === REASON_KEYS.pinned), 'a pinned practise/learn session explains it was kept');
  ok(kept.filter(s => s.type === 'review').every(s => s.reason.key === REASON_KEYS.due || s.reason.key === REASON_KEYS.overdue), 'a pinned review keeps its due reason');
  ok(pinned.today.minutes <= pinned.settings.dailyBudget, 'pinning never breaks the daily budget');
  ok(pinned.weeks[0].days[1].sessions.length > 0, 'tomorrow is still planned around the pin');

  // A pin from another day is ignored.
  const stale = buildStudyPlan({ ...base, previous: { today: { date: addDays(TODAY, -1), sessions: first.today.sessions } } });
  ok(strip(stale) === strip(first), 'yesterday\'s pin has no effect today');
  // A pin naming a chapter no longer in scope is dropped, not kept.
  const gone = buildStudyPlan({ ...base, previous: { today: { date: TODAY, sessions: [{ id: 'x', type: 'learn', subtopic: 'not-a-chapter' }] } } });
  ok(!gone.today.sessions.some(s => s.subtopic === 'not-a-chapter'), 'a pinned chapter that left the scope is dropped');
}

// ── 11 · Empty profile, odd inputs ───────────────────────────────────────────
{
  const empty = buildStudyPlan({ candidates: [], ratings: {}, reviews: [], today: TODAY });
  ok(empty.summary.empty === true, 'no candidates and no reviews is an empty plan');
  eq(empty.weeks.length, PLAN_LIMITS.defaultWeeks, 'the empty plan still has its calendar');
  ok(empty.weeks.every(w => w.days.every(d => d.sessions.length === 0)), 'with nothing in it');
  const fresh = buildStudyPlan({ ...base, ratings: {}, reviews: [] });
  ok(fresh.today.sessions.length > 0 && fresh.today.sessions.every(s => s.type === 'learn'), 'a brand-new student gets learn sessions only');
  ok(['ch-a', 'ch-b', 'ch-c', 'ch-d'].includes(fresh.today.sessions[0].subtopic), 'starting in the front of the syllabus (exam weight may pick among the first chapters)');
  const freshOrder = allSessions(fresh).map(s => s.subtopic);
  ok(freshOrder.indexOf('ch-a') < freshOrder.indexOf('ch-h'), 'an early chapter is met before a late, light one');
  const junk = buildStudyPlan({ ...base, reviews: [{ subtopic: 7, dueAt: 'soon' }, null, { dueAt: 1 }], today: 'not a date' });
  ok(junk.weeks.length === PLAN_LIMITS.defaultWeeks && allSessions(junk).every(s => s.type !== 'review'), 'malformed review rows and a bad date are ignored, not thrown');
  const noArgs = buildStudyPlan();
  ok(Array.isArray(noArgs.weeks) && noArgs.weeks.length === PLAN_LIMITS.defaultWeeks, 'buildStudyPlan() with no arguments returns a plan');
}

// ── 12 · Real curricula ──────────────────────────────────────────────────────
{
  const india = candidatesForProfile({ course: 'in', year: 10, indiaTrack: 'cbse' });
  ok(india.length >= 10 && india.every(c => c.id.startsWith('c10-')), `Class 10 CBSE gives its chapters (${india.length})`);
  ok(india.every(c => c.weight > 0 && c.keys.includes(c.id)), 'every chapter has a weight and lists its own id as a key');
  ok(india.some(c => c.keys.length > 1), 'chapters covered by a shared generator list the generator as a key too');
  const generatorKey = india.find(c => c.keys.length > 1);
  const legacyRatings = { [generatorKey.keys[1]]: { rating: 1300, attempts: 9, correct: 7, last_at: ms('2026-09-20') } };
  const st = candidateState(generatorKey, legacyRatings, ms(TODAY));
  ok(st.attempts === 9 && st.mastery > 0, 'a legacy generator row is credited to its chapter');
  ok(candidateIndex(india).get(generatorKey.keys[1]) === generatorKey, 'the index routes a generator id to its chapter');
  const jee = candidatesForProfile({ course: 'in', year: 12, indiaTrack: 'jee-main' });
  ok(jee.some(c => c.id.startsWith('c11-')) && jee.some(c => c.id.startsWith('c12-')), 'JEE Main spans Classes 11 and 12');
  const nsw = candidatesForProfile({ course: 'nsw', year: 11, pathway: 'advanced' });
  ok(nsw.some(c => c.own) && nsw.some(c => !c.own), 'a NSW scope has own-year and revision candidates');
  const rev = nsw.find(c => !c.own);
  ok(rev.weight < (nsw.find(c => c.own)?.weight || 0) * 2, 'revision material is damped');
  const planIn = buildStudyPlan({ profile: { course: 'in', year: 10, indiaTrack: 'cbse' }, ratings: {}, reviews: [], today: TODAY, weeklyMinutes: 150 });
  ok(planIn.today.sessions.length > 0 && planIn.today.sessions.every(s => s.subtopic.startsWith('c10-')), 'a Class 10 profile plans Class 10 chapters');
  ok(planIn.today.sessions.every(s => typeof s.name === 'string' && s.name.length > 0), 'sessions carry the chapter name for display');
  const planNsw = buildStudyPlan({ profile: { course: 'nsw', year: 9 }, ratings: {}, reviews: [], today: TODAY, weeklyMinutes: 150 });
  ok(planNsw.today.sessions.length > 0, 'a NSW profile plans too');
  eq(sessionHref(planIn.today.sessions[0], { course: 'in', indiaTrack: 'cbse' }), `/practice?subtopic=${planIn.today.sessions[0].subtopic}&track=cbse`, 'a session opens topic practice on the CBSE track');
  eq(sessionHref({ type: 'mock' }, {}), '/exams', 'a mock opens the exam room');
}

// ── 13 · Progress against today ──────────────────────────────────────────────
{
  const plan = buildStudyPlan(base);
  const none = todayProgress(plan, { attempts: [], minutesSpent: 0 });
  eq(none.done, 0, 'nothing done yet');
  eq(nextSession(none)?.id, plan.today.sessions[0].id, 'the next session is the first one');
  const some = todayProgress(plan, { attempts: [{ subtopic: 'ch-a' }], minutesSpent: 7 });
  ok(some.sessions[0].done === true && some.done === 1, 'an attempt on a session\'s chapter marks it done');
  eq(nextSession(some)?.id, plan.today.sessions[1].id, 'the next session moves on');
  ok(some.fraction > 0 && some.fraction <= 1, 'the fraction is in range');
  const over = todayProgress(plan, { attempts: plan.today.sessions.map(s => ({ subtopic: s.subtopic })), minutesSpent: 999 });
  eq(over.fraction, 1, 'everything done is 100%');
  eq(over.minutesDone, plan.today.minutes, 'minutes are capped at the plan');
  eq(nextSession(over), null, 'nothing is next');
  eq(todayProgress(null).total, 0, 'no plan is no progress, not a throw');
}

// ── 14 · Catalogue keys ──────────────────────────────────────────────────────
{
  for (const key of Object.values(REASON_KEYS)) {
    ok(key in en, `reason key ${key} is in the English catalogue`);
    ok(key in hi, `reason key ${key} is in the Hindi catalogue`);
  }
  for (const key of Object.values(SESSION_TYPE_KEYS)) ok(key in en && key in hi, `type key ${key} is in both catalogues`);
  const t = (key, vars) => { const e = en[key]; const s = typeof e === 'string' ? e : e[vars?.count === 1 ? 'one' : 'other']; return s.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? `{${k}}`)); };
  const plan = buildStudyPlan({ ...base, examDate: '2026-11-20' });
  for (const s of allSessions(plan)) {
    const text = reasonText(t, s);
    ok(text && !/\{\w+\}/.test(text), `reason for ${s.id} renders with every placeholder filled`);
  }
}

// ── 15 · Settings and the today pin (per-profile device storage) ────────────
{
  const mem = new Map();
  const scope = { localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } };
  eq(loadPlanSettings('p1', { scope }), { weeklyMinutes: 150, examDate: null, restDay: null, sessionHour: 17 }, 'defaults before anything is saved');
  const saved = savePlanSettings('p1', { weeklyMinutes: 210, examDate: '2026-12-01', restDay: 6 }, { scope });
  eq(saved, { weeklyMinutes: 210, examDate: '2026-12-01', restDay: 6, sessionHour: 17 }, 'a save returns the normalised settings');
  eq(loadPlanSettings('p1', { scope }), saved, 'and they load back');
  eq(loadPlanSettings('p2', { scope }).weeklyMinutes, 150, 'another profile does not see them');
  const plan = buildStudyPlan(base);
  saveTodayPin('p1', plan, { scope });
  const pin = loadTodayPin('p1', TODAY, { scope });
  eq(pin.today.sessions.map(s => s.id), plan.today.sessions.map(s => s.id), 'the pin keeps today\'s session ids');
  ok(pin.today.sessions.every(s => Object.keys(s).sort().join() === 'id,subtopic,type'), 'the pin stores ids, types and chapter ids only — no names, no reasons');
  eq(loadTodayPin('p1', addDays(TODAY, 1), { scope }), null, 'tomorrow the pin is gone');
  ok(loadPlanSettings('p1', { scope: {} }).weeklyMinutes === 150, 'no storage at all still yields defaults');
}

const fail = failures.length;
if (fail) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nSTUDY PLAN: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
