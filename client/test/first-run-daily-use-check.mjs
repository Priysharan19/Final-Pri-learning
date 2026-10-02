// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · first run → daily use (V1: India, CBSE Classes 7–12 + JEE)
//
// Deterministic regressions for the path a new student walks:
//   §04  a profile's class and track scope the very first question; changing
//        class later re-scopes practice, and an unfinished question from the
//        old class/track is neither resumed nor offered by Home (it is kept,
//        and comes back if the student changes back);
//   §05  Home's next action: expired papers are not "in progress", a non-student
//        role gets no learning action, cached assignments show offline but are
//        never the primary action, Home's resume link reopens exactly its
//        question, and saved Home filters are per profile and per class;
//   PYQ  "Past papers only" on a chapter with no archive offers the nearest
//        chapters that do have past papers, each of which really serves one —
//        and nothing authored is ever served under the filter.
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();

const { dispatch } = await import('../src/local/backend.js');
const idb = await import('../src/local/idb.js');
const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { indiaPracticeScope, indiaScope, resolveIndiaTarget, indiaPyqAlternatives } = await import('../src/engine/indiaProduct.js');
const { resolveHomeRecommendation, HOME_RECOMMENDATION_POLICY, actionOpenable } = await import('../src/home/recommendation.js');
const { loadSavedFilters, saveFilters, cacheAssignments, cachedAssignments } = await import('../src/home/homeCache.js');
const { loadBanksForPaths, enumeratePaths } = await import('./content-certify.mjs');

await loadAllBanks();
await loadBanksForPaths(enumeratePaths());

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✔ ' + label); } else { failures.push(label); console.log('  ✘ ' + label); } };
const eq = (a, b, label) => ok(a === b, `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const attempt = p => p.catch(error => ({ error }));

async function student(spec) {
  const created = await dispatch('POST', '/profiles', { role: 'student', course: 'in', ...spec });
  const now = Date.now();
  // Premium so a free daily cap never stands in for a scoping failure.
  await idb.put('device', {
    id: cloudLinkRowId(created.user.id), accountId: `acct-${created.user.id}`, role: 'student', emailVerified: true,
    linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * 86400000, offlineUntil: now + 7 * 86400000, issuedAt: now, sourceVersion: 1 }
  });
  return created.user;
}
const scopeIds = (track, year) => { const { own, ahead } = indiaPracticeScope(track, year); return new Set([...own, ...ahead].map(c => c.id)); };
const rowOf = async reply => reply?.question?.id ? idb.get('questions', reply.question.id) : null;

// ── §04 · the first question is scoped by the class and track just chosen ──
{
  const combos = [7, 8, 9, 10, 11, 12].map(year => ({ year, track: 'cbse' }))
    .concat([11, 12].flatMap(year => [{ year, track: 'jee-main' }, { year, track: 'jee-advanced' }]));
  for (const { year, track } of combos) {
    resetStorage();
    const u = await student({ name: `First ${track} ${year}`, year, indiaTrack: track });
    eq(u.indiaTrack, track, `Class ${year} ${track}: the chosen track is stored on the new profile`);
    eq(u.year, year, `Class ${year} ${track}: the chosen class is stored on the new profile`);
    const scope = scopeIds(track, year);
    for (let i = 0; i < 3; i++) {
      const r = await attempt(dispatch('POST', '/practice/next', { mode: 'smart', resume: false }));
      const row = await rowOf(r);
      ok(!!row && scope.has(row.india?.chapterId) && row.india?.track === track,
        `Class ${year} ${track}: smart question ${i + 1} is from the class's own scope (${r?.error ? r.error.code : row?.india?.chapterId})`);
      if (row) await dispatch('POST', `/practice/${row.id}/discard`, {});
    }
    const me = await dispatch('GET', '/me');
    ok(me.user?.year === year && me.user?.indiaTrack === track, `Class ${year} ${track}: a fresh read (reload) returns the same class and track`);
  }
  resetStorage();
  const refused = await attempt(dispatch('POST', '/profiles', { role: 'student', course: 'in', name: 'Too young for JEE', year: 10, indiaTrack: 'jee-main' }));
  eq(refused?.error?.status, 400, 'a JEE track below Class 11 is refused at creation, not silently downgraded');
}

// ── §04 · changing class later re-scopes practice and resume ───────────────
{
  resetStorage();
  await student({ name: 'Mover', year: 12, indiaTrack: 'jee-main' });
  const first = await dispatch('POST', '/practice/next', { mode: 'smart', resume: false });
  const oldRow = await rowOf(first);
  ok(scopeIds('jee-main', 12).has(oldRow?.india?.chapterId), 'the JEE Main Class 12 question is in that scope');
  const resumeBefore = await dispatch('GET', '/practice/resume');
  eq(resumeBefore.resume?.questionId, oldRow.id, 'Home offers to resume the unfinished JEE question');
  ok(/subtopic=/.test(resumeBefore.resume?.destination || '') && resumeBefore.resume.destination.includes(encodeURIComponent(oldRow.india.chapterId)),
    `Home's resume link names the question's own chapter (${resumeBefore.resume?.destination})`);
  const exact = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: oldRow.india.chapterId, track: 'jee-main', resume: true });
  eq(exact.question?.id, oldRow.id, 'following that link resumes exactly that question');

  const moved = await dispatch('PATCH', '/me', { year: 10 });
  eq(moved.user.year, 10, 'the class change is stored');
  eq(moved.user.indiaTrack, 'cbse', 'a JEE track falls back to CBSE when the class moves below 11');
  const resumeAfter = await dispatch('GET', '/practice/resume');
  ok(resumeAfter.resume?.questionId !== oldRow.id, 'Home no longer offers the old class\'s question after a class change');
  const next = await dispatch('POST', '/practice/next', { mode: 'smart', resume: true });
  const nextRow = await rowOf(next);
  ok(nextRow && nextRow.id !== oldRow.id, 'smart practice does not resume the old class\'s question');
  ok(scopeIds('cbse', 10).has(nextRow?.india?.chapterId) && nextRow?.india?.track === 'cbse', `the next question is Class 10 CBSE (${nextRow?.india?.chapterId})`);
  const kept = await idb.get('questions', oldRow.id);
  ok(kept && !kept.discardedAt && !kept.answered, 'the old unfinished question is kept, not discarded');
  await dispatch('POST', `/practice/${nextRow.id}/discard`, {});

  await dispatch('PATCH', '/me', { year: 12, indiaTrack: 'jee-main' });
  const back = await dispatch('POST', '/practice/next', { mode: 'smart', resume: true });
  eq(back.question?.id, oldRow.id, 'changing back to Class 12 JEE Main resumes the kept question');
}

// ── Resume honours "past papers only" ──────────────────────────────────────
{
  resetStorage();
  await student({ name: 'Filter Resume', year: 12, indiaTrack: 'cbse' });
  const authoredChapter = indiaScope('cbse', 12).find(c => resolveIndiaTarget(c, { track: 'cbse', grade: 12, pyqOnly: true, random: () => 0 }));
  // An authored question left unfinished (the chapter mix can draw a past
  // paper; those are skipped until an authored one is left open).
  let anyAuthored = null;
  for (let i = 0; i < 20 && !anyAuthored; i++) {
    const r = await dispatch('POST', '/practice/next', { mode: 'smart', track: 'cbse', resume: false });
    const row = await rowOf(r);
    if (row && !row.payload?.pyq) anyAuthored = row;
    else if (row) await dispatch('POST', `/practice/${row.id}/discard`, {});
  }
  ok(!!anyAuthored, 'an authored question is left unfinished');
  const plainResume = await dispatch('POST', '/practice/next', { mode: 'smart', track: 'cbse', resume: true });
  eq(plainResume.question?.id, anyAuthored?.id, 'without the filter it resumes');
  const pyq = await dispatch('POST', '/practice/next', { mode: 'smart', track: 'cbse', pyqOnly: true, resume: true });
  ok(pyq.pyq === true && pyq.question?.pyq === true && pyq.question?.id !== anyAuthored?.id, 'past papers only never resumes an authored question');
  ok(!!authoredChapter, 'Class 12 CBSE has at least one archived chapter');
}

// ── PYQ empty state: nearest chapters that do have past papers ─────────────
{
  resetStorage();
  await student({ name: 'PYQ Seeker', year: 12, indiaTrack: 'cbse' });
  const servable = c => !!resolveIndiaTarget(c, { track: 'cbse', grade: 12, pyqOnly: true, random: () => 0 });
  const chapters = indiaScope('cbse', 12);
  const bare = chapters.find(c => !servable(c));
  ok(!!bare, 'Class 12 CBSE has a chapter with no past-paper archive (the dead end being fixed)');
  if (bare) {
    const r = await attempt(dispatch('POST', '/practice/next', { mode: 'topic', subtopic: bare.id, track: 'cbse', pyqOnly: true, resume: false }));
    eq(r?.error?.code, 'INDIA_PYQ_UNAVAILABLE', 'a chapter with no archive is refused under the filter, not substituted');
    ok(!r?.question, 'no question at all is served for it under the filter');
    const alts = r?.error?.detail?.alternatives || [];
    ok(alts.length > 0 && alts.length <= 3, `the refusal offers nearest past-paper chapters (${alts.map(a => a.subtopic).join(', ')})`);
    ok(alts.every(a => a.subtopic !== bare.id), 'the refused chapter is not offered as its own alternative');
    ok(alts.every(a => scopeIds('cbse', 12).has(a.subtopic)), 'every alternative is inside the student\'s practice scope');
    for (const alt of alts) {
      const served = await attempt(dispatch('POST', '/practice/next', { mode: 'topic', subtopic: alt.subtopic, track: 'cbse', pyqOnly: true, resume: false }));
      ok(served?.pyq === true && served?.question?.pyq === true, `one tap on ${alt.subtopic} serves a real previous-year question`);
      if (served?.question?.id) await dispatch('POST', `/practice/${served.question.id}/discard`, {});
    }
    const order = chapters.map(c => c.id);
    const gaps = alts.map(a => Math.abs(order.indexOf(a.subtopic) - order.indexOf(bare.id)));
    ok(gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), 'alternatives are ordered nearest first in syllabus order');
  }
  // Every refused chapter in every V1 scope gets only servable suggestions.
  let checked = 0, bad = 0;
  for (const [track, year] of [[ 'cbse', 7 ], ['cbse', 8], ['cbse', 9], ['cbse', 10], ['cbse', 11], ['cbse', 12], ['jee-main', 11], ['jee-main', 12], ['jee-advanced', 11], ['jee-advanced', 12]]) {
    for (const c of indiaScope(track, year)) {
      for (const alt of indiaPyqAlternatives(c, { track, grade: year })) {
        checked++;
        const { own, ahead } = indiaPracticeScope(track, year);
        const real = [...own, ...ahead].find(x => x.id === alt.subtopic);
        const t = resolveIndiaTarget(real, { track, grade: year, pyqOnly: true, random: () => 0.5 });
        if (!t?.pyq) bad++;
      }
    }
  }
  ok(checked > 0 && bad === 0, `every suggested alternative across V1 scopes resolves to a past paper (${checked} checked, ${bad} bad)`);
  resetStorage();
  await student({ name: 'Class Seven', year: 7, indiaTrack: 'cbse' });
  const c7 = indiaScope('cbse', 7)[0];
  const none = await attempt(dispatch('POST', '/practice/next', { mode: 'topic', subtopic: c7.id, track: 'cbse', pyqOnly: true, resume: false }));
  eq(none?.error?.code, 'INDIA_PYQ_UNAVAILABLE', 'a class with no archive still refuses under the filter');
  ok(Array.isArray(none?.error?.detail?.alternatives), 'and says (with an empty list) that no nearby chapter has one either');
}

// ── GET /exams carries the paper's deadline ────────────────────────────────
{
  resetStorage();
  const u = await student({ name: 'Exam Sitter', year: 10, indiaTrack: 'cbse' });
  const now = Date.now();
  await idb.put('exams', { id: 'exam-old', pid: u.id, title: 'Old paper', year: 10, durationMin: 30, createdAt: now - 3 * 3600000, startedAt: now - 3 * 3600000, deadlineAt: now - 2.5 * 3600000, finishedAt: null, questionIds: [] });
  const { exams } = await dispatch('GET', '/exams');
  eq(exams.find(e => e.id === 'exam-old')?.deadline_at, now - 2.5 * 3600000, 'GET /exams reports deadline_at');
  const rec = resolveHomeRecommendation({ user: { id: u.id, role: 'student', course: 'in', year: 10, today: { questions: 0 } }, exams, now });
  ok(rec.primary?.kind !== 'exam', 'an expired unfinished paper is not offered as "exam in progress"');
  ok([rec.primary, ...rec.alternatives].some(x => x?.kind === 'exam-expired'), 'it is offered as a paper whose time ran out');
}

// ── §05 · Home next-action policy ──────────────────────────────────────────
{
  const now = Date.parse('2026-10-01T12:00:00+05:30');
  const learner = { id: 's1', role: 'student', course: 'in', year: 10, dailyGoal: 10, today: { questions: 0 } };
  const base = { user: learner, stats: { totals: { attempts: 3 } }, now };
  const pick = o => resolveHomeRecommendation({ ...base, ...o });

  const live = pick({ exams: [{ id: 'e1', created_at: now - 600000, duration_min: 30, finished_at: null }] });
  eq(live.primary?.kind, 'exam', 'a paper inside its time is the primary action');
  const legacy = pick({ exams: [{ id: 'e2', created_at: now - 5 * 3600000, duration_min: 30, finished_at: null }] });
  eq(legacy.primary?.kind, 'exam-expired', 'a paper with no stored deadline expires by created_at + duration');
  eq(legacy.primary?.priority, HOME_RECOMMENDATION_POLICY.expiredExam, 'expired paper priority is the documented one');
  const resumeWins = pick({ exams: [{ id: 'e3', created_at: now - 5 * 3600000, duration_min: 30, finished_at: null }], resume: { kind: 'practice', questionId: 'q', destination: '/practice' } });
  eq(resumeWins.primary?.kind, 'practice-resume', 'unfinished practice outranks a paper whose time already ran out');
  const ancient = pick({ exams: [{ id: 'e4', created_at: now - 40 * 86400000, duration_min: 30, finished_at: null }] });
  ok(![ancient.primary, ...ancient.alternatives].some(x => x?.kind?.startsWith('exam')), 'an expired paper older than two weeks is history, not a next action');
  const both = pick({ exams: [
    { id: 'old', created_at: now - 5 * 3600000, duration_min: 30, finished_at: null },
    { id: 'new', created_at: now - 60000, deadline_at: now + 1800000, finished_at: null }
  ] });
  eq(both.primary?.id, 'new', 'a live paper is chosen over an expired one');

  for (const role of ['teacher', 'guardian', 'staff', 'admin', 'support', 'parent']) {
    const r = pick({ user: { ...learner, role }, dueCount: 3 });
    ok(r.primary === null && r.alternatives.length === 0, `role "${role}" gets no student next action`);
  }
  ok(pick({ user: { ...learner, role: undefined } }).primary !== null, 'a legacy profile with no role is treated as a student');

  const due = { id: 'a1', classId: 'c1', title: 'Due tomorrow', dueAt: now + 3600000, specification: { questionCount: 5 }, submission: { state: 'not_started' } };
  const offline = pick({ online: false, cloudReady: false, cachedAssignments: [due] });
  ok(offline.primary && offline.primary.kind !== 'assignment', 'a cached assignment is never the primary action while offline');
  const shown = offline.alternatives.find(x => x.kind === 'assignment');
  ok(shown && shown.data.cached === true && shown.offlineCaveat === true, 'it is still shown, marked cached and offline');
  ok(actionOpenable(shown, { online: false }) === false, 'a cached assignment cannot be opened while offline (its button is disabled)');
  ok(actionOpenable(shown, { online: true }) === false, 'a cached copy is never opened even if the connection returns before refresh');
  ok(actionOpenable(onlineLive(), { online: true }) === true, 'a live assignment can be opened online');
  function onlineLive() { return pick({ online: true, cloudReady: true, assignments: [due] }).primary; }
  const onlineNoCache = pick({ online: true, cloudReady: true, assignments: [due], cachedAssignments: [{ ...due, id: 'stale' }] });
  eq(onlineNoCache.primary?.id, 'a1', 'online, the live list is used and the cache ignored');
  ok(!onlineNoCache.alternatives.some(x => x.id === 'stale'), 'the cached copy never duplicates a live row');
}

// ── Home caches: per profile, per class ────────────────────────────────────
{
  const mem = new Map();
  const store = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)) };
  const a = { id: 'pa', course: 'in', year: 10, indiaTrack: 'cbse' };
  const b = { id: 'pb', course: 'in', year: 12, indiaTrack: 'jee-main' };
  saveFilters(a, { year: 10, subtopic: 'c10-polynomials' }, store);
  eq(loadSavedFilters(a, store).subtopic, 'c10-polynomials', 'a profile gets its own saved Home filters back');
  eq(Object.keys(loadSavedFilters(b, store)).length, 0, 'a sibling profile on the same device does not inherit them');
  eq(Object.keys(loadSavedFilters({ ...a, year: 11 }, store)).length, 0, 'after a class change the old class filters are dropped');
  eq(Object.keys(loadSavedFilters({ ...a, indiaTrack: 'olympiad' }, store)).length, 0, 'after a track change the old filters are dropped');
  mem.set('pri-gen-filters', '{not json');
  eq(Object.keys(loadSavedFilters(a, store)).length, 0, 'corrupt storage reads as no filters');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  saveFilters(a, { year: 10 }, broken);
  eq(Object.keys(loadSavedFilters(a, broken)).length, 0, 'blocked storage never throws');

  const t0 = Date.parse('2026-10-01T00:00:00Z');
  cacheAssignments(a, [{ id: 'x', classId: 'c', title: 'T', dueAt: t0, teacherNote: 'private', submission: { state: 'started', responses: ['secret'], summary: { questionsAnswered: 2 } } }], store, t0);
  const cached = cachedAssignments(a, store, t0 + 1000);
  eq(cached.length, 1, 'the last assignment list is cached for this profile');
  ok(!JSON.stringify(cached).includes('secret') && !JSON.stringify(cached).includes('private'), 'the cache keeps no responses or teacher notes');
  eq(cachedAssignments(b, store, t0).length, 0, 'another profile does not see it');
  eq(cachedAssignments(a, store, t0 + 15 * 86400000).length, 0, 'a cache older than two weeks is not shown');
}

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FIRST RUN → DAILY USE: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`FIRST RUN → DAILY USE: PASS — ${pass}/${total} checks`);
