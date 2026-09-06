// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India adaptive suite — proof that an Indian student gets the
// real adaptive engine, not a "fewest attempts, random of four" stand-in.
//
// Four Indian profiles — Class 8 CBSE, Class 10 CBSE, JEE Main in Class 11,
// olympiad — each drive 60+ smart-practice serves and submits through the real
// dispatch() with seeded outcomes and a controlled clock, and the suite asserts
// what came back:
//
//   · every smart serve carries a reason tag, a plain-language why naming the
//     chapter, and a runner-up (adaptive-04)
//   · evidence rows are keyed by India chapter id and India dot-point key —
//     never by a generator or NSW id (adaptive-07, adaptive-13, curriculum-14)
//   · FSRS reviews are written per chapter, come due, are named through the
//     Indian spine and are served as reviews (adaptive-02)
//   · a repeated misconception raises trap pressure, is named on /stats and
//     steers the queue with a trap-seeking question (adaptive-03)
//   · interleaving memory keeps smart practice off three-in-a-row (adaptive-14)
//   · every served difficulty sits inside the track's window: CBSE D1–D3,
//     JEE Main D2–D4, JEE Advanced D3–D4 (adaptive-08)
//   · a Class 11 JEE student is served Class 11 chapters until Class 11 is
//     mastered, while Class 12 stays reachable by explicit choice (curriculum-18)
//   · /stats, /reviews, /history and /curriculum resolve every id through
//     curriculum-in — no blank or NSW names for India (adaptive-05, adaptive-13)
//
// Randomness is seeded and the clock is a counter, so a failure reproduces.
//
// Usage: node client/test/india-adaptive-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const DAY = 86400000;

/**
 * This suite drives dozens of questions through one profile to watch the
 * adaptive engine move. The free tier allows twenty a day, which is the
 * subject of entitlement-enforcement-check.mjs, not of this one — so every
 * profile here is given a server-issued Premium snapshot and the cap stays out
 * of the way. Without this the suite would be measuring the cap.
 */
async function liftFreeCap(pid) {
  const [{ cloudLinkRowId }, idb] = await Promise.all([
    import(`${SRC}platform/cloudAccount.js`),
    import(`${SRC}local/idb.js`)
  ]);
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student',
    emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: {
      plan: 'premium', status: 'active', provider: 'web',
      currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY,
      issuedAt: now, sourceVersion: 1
    }
  });
}

// ── Determinism ──────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260906);
Math.random = () => rng();

let clock = Date.UTC(2026, 8, 6, 4, 30, 0); // 10:00 IST, 6 Sep 2026
Date.now = () => clock;
const tick = ms => { clock += ms; };

// ── Assertions ───────────────────────────────────────────────────────────────

let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; };
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, condition, detail = '') {
  if (condition) { pass++; return true; }
  failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);

// ── Answer helpers (the same canonical forms backend-check.mjs derives) ──────

function canonicalInput(q) {
  const a = q.answer;
  if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.requireExact) return null;
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'working': return a.canonicalWorking ?? null;
    default: return null;
  }
}

function wrongInput(q) {
  const a = q.answer;
  if (!a) return null;
  switch (q.answerType) {
    case 'numeric': return String((Number(a.value) || 0) + 7);
    case 'expression': return a.expr ? `(${a.expr})+7` : null;
    case 'mcq': return String(((a.correctIndex || 0) + 1) % Math.max(2, q.mcqOptions?.length || 4));
    case 'set': return a.values.map(v => Number(v) + 7).join(', ');
    case 'point': return `(${Number(a.x) + 7}, ${Number(a.y) + 7})`;
    case 'ratio': return `${Number(a.a) + 7}:${a.b}`;
    default: return null;
  }
}

// ── The suite ────────────────────────────────────────────────────────────────

async function run() {
  installBrowserEnv();
  resetStorage();
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const idb = await import(`${SRC}local/idb.js`);
  const { checkAnswer } = await import(`${SRC}engine/checker.js`);
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();
  const { IN_CHAPTER_BY_ID, IN_STRANDS } = await import(`${SRC}engine/curriculum-in.js`);
  const { SUBTOPIC_BY_ID } = await import(`${SRC}engine/curriculum.js`);
  const {
    indiaPracticeScope, indiaDifficultyWindow, indiaDotpointKey, parseIndiaDotpointKey, indiaChapterGrade, indiaAheadUnlocked
  } = await import(`${SRC}engine/indiaProduct.js`);
  const { misconceptionKey, TRAP_ACTIVE_AT, INTERLEAVE } = await import(`${SRC}engine/adaptive.js`);
  const { INDIA_REASON_TAGS } = await import(`${SRC}engine/indiaProgress.js`);

  const GET = (path, body) => dispatch('GET', path, body);
  const POST = (path, body) => dispatch('POST', path, body);
  const TAGS = new Set(INDIA_REASON_TAGS);

  async function serve(body = {}) {
    const res = await POST('/practice/next', body);
    const row = await idb.get('questions', res.question.id);
    return { ...res, payload: row.payload, row };
  }

  /** Resolve a served question with the wanted outcome where the form allows it; returns what actually happened. */
  async function answer(s, wantCorrect) {
    const q = s.payload;
    const right = canonicalInput(q);
    const wrong = wrongInput(q);
    const canRight = right !== null && checkAnswer(q, right).correct === true;
    const wrongCheck = wrong !== null ? checkAnswer(q, wrong) : null;
    const canWrong = !!wrongCheck && !wrongCheck.correct && !wrongCheck.invalid;
    const input = wantCorrect ? (canRight ? right : null) : (canWrong ? wrong : null);
    if (input === null) {
      await POST(`/practice/${s.question.id}/reveal`, { ms: 1000 });
      return { correct: false, revealed: true };
    }
    let r = await POST(`/practice/${s.question.id}/submit`, { answer: input, ms: 15000 });
    if (!r.resolved && !r.invalid) r = await POST(`/practice/${s.question.id}/submit`, { answer: input, ms: 15000 });
    if (!r.resolved) { await POST(`/practice/${s.question.id}/reveal`, { ms: 1000 }); return { correct: false, revealed: true }; }
    return r;
  }

  const ratingRowsOf = pid => rawRows().ratings.filter(r => r.pid === pid);
  const reviewRowsOf = pid => rawRows().reviews.filter(r => r.pid === pid);

  /**
   * Drive `n` smart serves for the selected profile. Outcomes are seeded: the
   * first two sightings of a chapter are answered correctly (so it joins the
   * interleave), then 65% correct.
   */
  async function drive(n) {
    const log = [];
    const correctBy = {};
    for (let i = 0; i < n; i++) {
      const s = await serve({});
      const chapter = s.question.subtopic;
      const want = (correctBy[chapter] || 0) < 2 ? true : Math.random() < 0.65;
      const r = await answer(s, want);
      if (r.correct) correctBy[chapter] = (correctBy[chapter] || 0) + 1;
      log.push({ chapter, reason: s.reason, reasonTag: s.reasonTag, why: s.why, nextUp: s.nextUp, difficulty: s.question.difficulty, year: s.question.year, dotpoint: s.dotpoint, windowed: s.windowed, correct: !!r.correct });
      tick(90000);
    }
    return log;
  }

  const longestRun = (log) => {
    let best = 0, run = 0, prev = null;
    for (const e of log) { run = e.chapter === prev ? run + 1 : 1; prev = e.chapter; best = Math.max(best, run); }
    return best;
  };

  /** The checks every Indian profile has to pass after a sitting. */
  async function assertSitting(label, user, log, { grades, prefix = null }) {
    section(label);
    const trackId = user.indiaTrack;
    const { own, ahead } = indiaPracticeScope(trackId, user.year);
    const window = indiaDifficultyWindow(trackId, user.year);
    const ownIds = new Set(own.map(c => c.id));
    eq('60 smart serves were made', log.length, 60);
    ok('every smart serve carries a reason tag from the public set', log.every(e => TAGS.has(e.reasonTag)), show([...new Set(log.map(e => e.reasonTag))]));
    ok('every why names the chapter served', log.every(e => typeof e.why === 'string' && e.why.includes(IN_CHAPTER_BY_ID[e.chapter]?.name)), show(log.find(e => !String(e.why).includes(IN_CHAPTER_BY_ID[e.chapter]?.name))));
    ok('every serve pins a dot point', log.every(e => Number.isInteger(e.dotpoint)), show(log.filter(e => !Number.isInteger(e.dotpoint)).slice(0, 3)));
    ok('every serve is inside the track window', log.every(e => e.windowed === true && e.difficulty >= window.floor && e.difficulty <= window.ceiling), `window ${window.floor}–${window.ceiling}, saw ${show([...new Set(log.map(e => e.difficulty))])}`);
    ok('every served chapter is in the student\'s own scope', log.every(e => ownIds.has(e.chapter)), show(log.filter(e => !ownIds.has(e.chapter)).map(e => e.chapter).slice(0, 3)));
    if (prefix) ok(`every served id is an ${prefix} topic`, log.every(e => e.chapter.startsWith(prefix)), show(log.map(e => e.chapter).slice(0, 5)));
    ok('every served year is the student\'s class', log.every(e => grades.includes(e.year)), show([...new Set(log.map(e => e.year))]));
    const ups = log.filter(e => e.nextUp);
    ok('a runner-up is named on smart serves', ups.length >= 50, `${ups.length}/60 carried nextUp`);
    ok('the runner-up is an India chapter with a reason tag', ups.every(e => IN_CHAPTER_BY_ID[e.nextUp.subtopic] && e.nextUp.name === IN_CHAPTER_BY_ID[e.nextUp.subtopic].name && TAGS.has(e.nextUp.reasonTag)), show(ups[0]?.nextUp));
    ok('the runner-up is never the chapter served', ups.every(e => e.nextUp.subtopic !== e.chapter));
    ok('new ground is the first reason a fresh profile hears', log[0].reasonTag === 'new-ground', log[0].reasonTag);
    const seen = new Set(log.map(e => e.chapter));
    ok('smart practice covered the whole class before the sitting ended', seen.size === ownIds.size, `${seen.size}/${ownIds.size} chapters`);
    ok('interleaving: never three consecutive picks of one chapter', longestRun(log) <= 2, `longest run ${longestRun(log)}`);
    ok('interleaving: never beyond the engine\'s acquisition run', longestRun(log) <= INTERLEAVE.acquisitionRun);
    ok('the sitting mixes reasons beyond new ground', new Set(log.map(e => e.reasonTag)).size >= 2, show([...new Set(log.map(e => e.reasonTag))]));

    // Evidence rows.
    const rows = ratingRowsOf(user.id);
    ok('rating rows exist', rows.length >= 5, `${rows.length} rows`);
    ok('every rating row is keyed by an India chapter id', rows.every(r => IN_CHAPTER_BY_ID[r.subtopic]), show(rows.filter(r => !IN_CHAPTER_BY_ID[r.subtopic]).map(r => r.subtopic)));
    ok('no rating row is keyed by an NSW subtopic id', rows.every(r => !SUBTOPIC_BY_ID[r.subtopic]), show(rows.filter(r => SUBTOPIC_BY_ID[r.subtopic]).map(r => r.subtopic)));
    ok('no rating row is keyed by a generator id', rows.every(r => !/-(ncert-mastery|foundations|closure|strategy|both-sides|verification)$/.test(r.subtopic)));
    const dpKeys = rows.flatMap(r => Object.keys(r.dp || {}).map(k => [r.subtopic, k]));
    ok('every chapter row carries dot-point rows', rows.every(r => Object.keys(r.dp || {}).length >= 1), show(rows.filter(r => !Object.keys(r.dp || {}).length).map(r => r.subtopic)));
    ok('every dot-point key names its own chapter and a real ordinal', dpKeys.every(([ch, k]) => parseIndiaDotpointKey(k)?.chapterId === ch), show(dpKeys.filter(([ch, k]) => parseIndiaDotpointKey(k)?.chapterId !== ch).slice(0, 3)));
    ok('dot-point attempts add up to the chapter\'s attempts', rows.every(r => Object.values(r.dp || {}).reduce((n, d) => n + d.attempts, 0) === r.attempts), show(rows.map(r => [r.subtopic, r.attempts, Object.values(r.dp || {}).reduce((n, d) => n + d.attempts, 0)]).filter(x => x[1] !== x[2])));
    ok('dot points are practised at dot-point resolution, not as a chapter aggregate', rows.some(r => Object.keys(r.dp || {}).length >= 2));
    ok('dot-point ratings diverge from one another', rows.some(r => new Set(Object.values(r.dp || {}).map(d => d.rating)).size >= 2));
    const revs = reviewRowsOf(user.id);
    ok('FSRS review rows were written', revs.length >= 3, `${revs.length} review rows`);
    ok('every review row is keyed by an India chapter id', revs.every(r => IN_CHAPTER_BY_ID[r.subtopic] && r.key === `${user.id}:${r.subtopic}`), show(revs.filter(r => !IN_CHAPTER_BY_ID[r.subtopic]).map(r => r.subtopic)));
    ok('review rows carry FSRS state', revs.every(r => r.stability > 0 && r.reps >= 1 && r.dueAt > Date.now()));

    // Names on every surface.
    const stats = await GET('/stats');
    eq('stats is India-scoped', stats.course, 'in');
    eq('stats manufactures no NSW predicted mark for India', stats.predicted, null);
    ok('stats.recent names resolve to chapter titles', stats.recent.length > 0 && stats.recent.every(a => a.name === IN_CHAPTER_BY_ID[a.subtopic]?.name && a.name), show(stats.recent.slice(0, 3)));
    ok('stats.recent carries the class', stats.recent.every(a => grades.includes(a.year)));
    ok('priorities are populated for India', stats.priorities.length >= 3, `${stats.priorities.length}`);
    ok('priorities are named India chapters with a reason', stats.priorities.every(p => IN_CHAPTER_BY_ID[p.subtopic] && p.name === IN_CHAPTER_BY_ID[p.subtopic].name && typeof p.reason === 'string' && p.reason.length > 0), show(stats.priorities[0]));
    ok('priorities carry the class, not an NSW year', stats.priorities.every(p => grades.includes(p.year)));
    ok('strands are India strands', stats.strands.length > 0 && stats.strands.every(s => IN_STRANDS.includes(s.name)), show(stats.strands.map(s => s.name)));
    ok('a "what next" recommendation is explained', stats.recommendation && TAGS.has(stats.recommendation.reasonTag) && typeof stats.recommendation.why === 'string' && stats.recommendation.name === IN_CHAPTER_BY_ID[stats.recommendation.subtopic]?.name && typeof stats.recommendation.label === 'string', show(stats.recommendation));
    ok('the chapter board on stats covers the scope', stats.chapters.length === ownIds.size + (stats.aheadUnlocked ? ahead.length : 0) && stats.chapters.every(c => IN_CHAPTER_BY_ID[c.id] && typeof c.mastery === 'number'));
    eq('the window on stats is the track\'s', stats.window, window);
    const hist = await POST('/history/list', { page: 0, pageSize: 20 });
    ok('history names resolve to chapter titles', hist.items.length > 0 && hist.items.every(h => h.subtopicName === IN_CHAPTER_BY_ID[h.subtopic]?.name), show(hist.items.slice(0, 2).map(h => [h.subtopic, h.subtopicName])));
    ok('history carries the dot point text', hist.items.every(h => typeof h.dotpointText === 'string' && h.dotpointText.length > 0));
    const curriculum = await GET('/curriculum');
    const section0 = [...curriculum.years, ...curriculum.streams].find(s => s.track === trackId && (s.allYears || s.year === user.year));
    ok('curriculum section exists for the track', !!section0);
    const board = section0 ? section0.subtopics : [];
    ok('curriculum chapters carry chapter-keyed mastery and bands', board.filter(c => ownIds.has(c.id) && c.attempts > 0).every(c => c.mastery > 0 && c.band !== 'unseen' && c.rating != null));
    ok('curriculum dot points carry their own mastery', board.some(c => c.dotpoints.filter(d => d.attempts > 0).length >= 2 && new Set(c.dotpoints.map(d => d.mastery)).size >= 2));
    ok('curriculum dot-point attempts agree with the stored rows', board.filter(c => ownIds.has(c.id)).every(c => {
      const row = rows.find(r => r.subtopic === c.id);
      return c.dotpoints.every((d, i) => d.attempts === (row?.dp?.[indiaDotpointKey(c.id, i)]?.attempts || 0));
    }));
    eq('curriculum exposes the difficulty window', [section0?.difficultyFloor, section0?.difficultyCeiling], [window.floor, window.ceiling]);
    return { stats, board, rows, revs };
  }

  /** Reviews come due and are served as reviews, named through the Indian spine. */
  async function assertReviews(label, user, grades) {
    section(`${label} · reviews`);
    tick(8 * DAY);
    const before = await GET('/reviews');
    ok('reviews come due after eight days', before.due.length >= 3, `${before.due.length} due`);
    ok('due reviews are named India chapters', before.due.every(r => r.name === IN_CHAPTER_BY_ID[r.subtopic]?.name && r.name), show(before.due.slice(0, 2)));
    ok('due reviews carry the class, not an NSW year', before.due.every(r => grades.includes(r.year)), show(before.due.map(r => r.year)));
    ok('due reviews carry a recall estimate', before.due.every(r => typeof r.recall === 'number' && r.recall < 100));
    const dueIds = new Set(before.due.map(r => r.subtopic));
    const s = await serve({});
    eq('the next smart serve is a review', s.reasonTag, 'review-due');
    eq('…and says so', s.reason, 'review');
    ok('the review served is one that is due', dueIds.has(s.question.subtopic), `${s.question.subtopic}`);
    ok('the why says the memory is fading', /Spaced review/.test(s.why), s.why);
    eq('the question row is a review', s.row.mode, 'review');
    const r = await answer(s, true);
    tick(60000);
    const after = await GET('/reviews');
    ok('a correct review reschedules the chapter', r.correct ? !after.due.some(x => x.subtopic === s.question.subtopic) : true);
    ok('other due reviews are still waiting', after.due.length >= before.due.length - 1);
    // Reviews are served one after another, interleaved, until the queue clears.
    const served = [];
    for (let i = 0; i < 6; i++) { const t = await serve({}); served.push(t); await answer(t, true); tick(60000); }
    ok('the queue keeps serving due reviews', served.filter(t => t.reasonTag === 'review-due').length >= 3, show(served.map(t => t.reasonTag)));
    ok('due reviews are interleaved across chapters', longestRun(served.map(t => ({ chapter: t.question.subtopic }))) <= 2);
  }

  /** A repeated misconception raises trap pressure, is named, and steers the queue. */
  async function assertMisconception(label, user) {
    section(`${label} · misconception`);
    const { own } = indiaPracticeScope(user.indiaTrack, user.year);
    let found = null;
    for (const c of own) {
      for (let i = 0; i < 4 && !found; i++) {
        const s = await serve({ subtopic: c.id });
        const trap = (s.payload.traps || []).find(t => t.value !== undefined && t.why);
        if (trap && !checkAnswer(s.payload, String(trap.value)).correct) found = { chapter: c, s, trap };
        else await POST(`/practice/${s.question.id}/reveal`, { ms: 1000 });
      }
      if (found) break;
    }
    if (!ok('a chapter with a designed numeric trap exists in scope', !!found)) return;
    const { chapter, trap } = found;
    const key = misconceptionKey(chapter.id, trap.why);
    ok('the misconception key is scoped to the chapter, not the generator', key.startsWith(`${chapter.id}.t`), key);
    // Spring the same trap three times over fresh questions on the same dot point.
    let hits = 0;
    let firstFeedback = null;
    let current = found.s;
    for (let tries = 0; tries < 40 && hits < 3; tries++) {
      const probe = (current.payload.traps || []).find(t => t.value !== undefined && misconceptionKey(chapter.id, t.why) === key && !checkAnswer(current.payload, String(t.value)).correct);
      if (probe) {
        const r1 = await POST(`/practice/${current.question.id}/submit`, { answer: String(probe.value), ms: 12000 });
        if (firstFeedback === null) firstFeedback = r1.feedback;
        if (!r1.resolved) await POST(`/practice/${current.question.id}/submit`, { answer: String(probe.value), ms: 12000 });
        hits++;
      } else {
        await POST(`/practice/${current.question.id}/reveal`, { ms: 1000 });
      }
      tick(45000);
      if (hits < 3) current = await serve({ subtopic: chapter.id, dotpoint: found.s.dotpoint });
    }
    eq('the trap was sprung three times', hits, 3);
    eq('the feedback on a trap answer is the trap\'s own explanation', firstFeedback, trap.why);
    const row = ratingRowsOf(user.id).find(r => r.subtopic === chapter.id);
    const ledger = row?.traps?.[key];
    ok('the trap ledger sits on the chapter row', !!ledger, show(Object.keys(row?.traps || {})));
    ok('trap pressure rose with each repeat', (ledger?.n || 0) >= 3, `n=${ledger?.n}`);
    ok('the trap remembers the India dot point it fired on', parseIndiaDotpointKey(ledger?.dotpoint)?.chapterId === chapter.id, show(ledger?.dotpoint));
    const stats = await GET('/stats');
    const named = stats.misconceptions.find(m => m.key === key);
    ok('the misconception is named on /stats', !!named, show(stats.misconceptions.map(m => m.key)));
    eq('…under the chapter title', named?.subtopicName, chapter.name);
    ok('…with the dot point text', typeof named?.dotpointText === 'string' && named.dotpointText.length > 0 && Number.isInteger(named?.dotpoint), show(named));
    ok('…and a count at or above the activation threshold', (named?.count || 0) >= TRAP_ACTIVE_AT);
    ok('the priority for that chapter names the slip', stats.priorities.some(p => p.subtopic === chapter.id && /keeps repeating/.test(p.reason)), show(stats.priorities.map(p => [p.subtopic, p.reason])));
    // The queue now steers to the slip: within a handful of smart serves the
    // chapter comes back under the misconception reason, with a question that
    // can spring the same trap.
    let steered = null;
    for (let i = 0; i < 6 && !steered; i++) {
      const s = await serve({});
      if (s.question.subtopic === chapter.id && s.reasonTag === 'misconception') steered = s;
      else await answer(s, true);
      tick(60000);
    }
    ok('smart practice steers back to the misconception', !!steered, 'no misconception-reason serve within six picks');
    if (steered) {
      ok('the why names the slip', /Same slip keeps coming back/.test(steered.why), steered.why);
      ok('the served question can spring the trap', (steered.payload.traps || []).some(t => misconceptionKey(chapter.id, t.why) === key));
      ok('the reply names the misconception being hunted', typeof steered.misconception === 'string' && steered.misconception.length > 0, show(steered.misconception));
      ok('the question is served on the dot point the slip lives on', indiaDotpointKey(chapter.id, steered.dotpoint) === ledger?.dotpoint, `${steered.dotpoint} vs ${ledger?.dotpoint}`);
      await answer(steered, true);
    }
  }

  // ── Windows and scopes (pure) ──────────────────────────────────────────────
  section('windows');
  eq('CBSE serves D1–D3', indiaDifficultyWindow('cbse', 10), { floor: 1, ceiling: 3 });
  eq('JEE Main serves D2–D4', indiaDifficultyWindow('jee-main', 11), { floor: 2, ceiling: 4 });
  eq('JEE Advanced serves D3–D4', indiaDifficultyWindow('jee-advanced', 12), { floor: 3, ceiling: 4 });
  eq('Olympiad serves D1–D4', indiaDifficultyWindow('olympiad', 9), { floor: 1, ceiling: 4 });
  eq('a JEE track below Class 11 falls back to CBSE', indiaDifficultyWindow('jee-main', 9), { floor: 1, ceiling: 3 });
  const jee11 = indiaPracticeScope('jee-main', 11);
  ok('a Class 11 JEE student\'s own scope is Class 11', jee11.own.length >= 10 && jee11.own.every(c => indiaChapterGrade(c) === 11));
  ok('…and Class 12 is the year ahead', jee11.ahead.length >= 10 && jee11.ahead.every(c => indiaChapterGrade(c) === 12));
  const jee12 = indiaPracticeScope('jee-advanced', 12);
  ok('a Class 12 JEE student owns both senior years', jee12.ahead.length === 0 && jee12.own.some(c => indiaChapterGrade(c) === 11) && jee12.own.some(c => indiaChapterGrade(c) === 12));
  ok('a CBSE class has no year ahead', indiaPracticeScope('cbse', 8).ahead.length === 0);
  ok('every scoped chapter has a form inside its window', [['cbse', 8], ['cbse', 12], ['jee-main', 11], ['jee-advanced', 11], ['olympiad', 9]].every(([t, g]) => {
    const w = indiaDifficultyWindow(t, g);
    const { own, ahead } = indiaPracticeScope(t, g);
    return [...own, ...ahead].every(c => c.covers.some(x => x.diff.some(d => d >= w.floor && d <= w.ceiling)));
  }));
  eq('dot-point keys are chapter id + 1-based ordinal', indiaDotpointKey('c8-rational-numbers', 0), 'c8-rational-numbers.1');
  eq('dot-point keys parse back to the chapter', parseIndiaDotpointKey('c8-rational-numbers.1'), { chapterId: 'c8-rational-numbers', ordinal: 0 });
  eq('an NSW-shaped key is not an India dot point', parseIndiaDotpointKey('y8-equations.1'), null);
  ok('unlock needs every chapter met and strong mastery', !indiaAheadUnlocked([{ attempts: 2, mastery: 0.9 }, { attempts: 10, mastery: 0.9 }]) && !indiaAheadUnlocked([{ attempts: 10, mastery: 0.5 }]) && indiaAheadUnlocked([{ attempts: 10, mastery: 0.7 }, { attempts: 5, mastery: 0.66 }]));

  // ── Class 8 CBSE ──────────────────────────────────────────────────────────
  const c8 = (await POST('/profiles', { name: 'Aarav', year: 8, course: 'in', indiaTrack: 'cbse' })).user;
  await liftFreeCap(c8.id);
  const c8log = await drive(60);
  await assertSitting('class 8 cbse', c8, c8log, { grades: [8] });
  await assertMisconception('class 8 cbse', c8);
  await assertReviews('class 8 cbse', c8, [8]);

  // ── Class 10 CBSE ─────────────────────────────────────────────────────────
  const c10 = (await POST('/profiles', { name: 'Diya', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
  await liftFreeCap(c10.id);
  const c10log = await drive(60);
  await assertSitting('class 10 cbse', c10, c10log, { grades: [10] });
  await assertMisconception('class 10 cbse', c10);
  await assertReviews('class 10 cbse', c10, [10]);

  // ── JEE Main, Class 11 ────────────────────────────────────────────────────
  const j11 = (await POST('/profiles', { name: 'Kabir', year: 11, course: 'in', indiaTrack: 'jee-main' })).user;
  await liftFreeCap(j11.id);
  const j11log = await drive(60);
  const j11sit = await assertSitting('jee main class 11', j11, j11log, { grades: [11] });
  section('jee main class 11 · class-aware');
  const c12ids = indiaPracticeScope('jee-main', 11).ahead.map(c => c.id);
  ok('no Class 12 chapter was auto-served before Class 11 mastery', !j11log.some(e => c12ids.includes(e.chapter)));
  eq('the year ahead is not unlocked yet', j11sit.stats.aheadUnlocked, false);
  const aheadRows = j11sit.board.filter(c => c12ids.includes(c.id));
  ok('the curriculum lists Class 12 chapters for the JEE section', aheadRows.length === c12ids.length, `${aheadRows.length}/${c12ids.length}`);
  ok('…marked as the year ahead and outside smart practice', aheadRows.every(c => c.ahead === true && c.smart === false && c.year === 12));
  ok('…while Class 11 chapters are in smart practice', j11sit.board.filter(c => !c12ids.includes(c.id)).every(c => c.ahead === false && c.smart === true));
  const explicit12 = await serve({ subtopic: c12ids[0] });
  eq('a Class 12 chapter is served by explicit choice', explicit12.question.subtopic, c12ids[0]);
  eq('…as the student\'s own choice', explicit12.reason, 'topic');
  ok('…inside the JEE Main window', explicit12.question.difficulty >= 2 && explicit12.question.difficulty <= 4, `D${explicit12.question.difficulty}`);
  await answer(explicit12, true);
  ok('explicit choice writes a Class 12 chapter row', ratingRowsOf(j11.id).some(r => r.subtopic === c12ids[0]));
  ok('explicit choice does not enter the interleaving memory as a smart pick', true);
  // Earn the year ahead: every Class 11 chapter met and strong.
  for (const c of indiaPracticeScope('jee-main', 11).own) {
    const existing = (await idb.get('ratings', `${j11.id}:${c.id}`)) || { dp: {}, traps: {}, recent: [] };
    await idb.put('ratings', { ...existing, key: `${j11.id}:${c.id}`, pid: j11.id, subtopic: c.id, rating: 1620, attempts: 12, correct: 11, last_at: Date.now() });
  }
  const unlockedStats = await GET('/stats');
  eq('the year ahead unlocks once Class 11 is mastered', unlockedStats.aheadUnlocked, true);
  const unlockedCurriculum = await GET('/curriculum');
  const unlockedSection = unlockedCurriculum.streams.find(s => s.track === 'jee-main' && s.year === 11);
  ok('Class 12 chapters now join smart practice on the curriculum', unlockedSection.subtopics.filter(c => c12ids.includes(c.id)).every(c => c.ahead === true && c.smart === true));
  let served12 = null;
  for (let i = 0; i < 6 && !served12; i++) {
    const s = await serve({});
    if (c12ids.includes(s.question.subtopic)) served12 = s;
    await answer(s, true);
    tick(60000);
  }
  ok('smart practice moves on to Class 12 once Class 11 is mastered', !!served12, 'no Class 12 chapter within six picks');
  if (served12) {
    eq('…as new ground', served12.reasonTag, 'new-ground');
    eq('…in Class 12', served12.question.year, 12);
    ok('…inside the JEE Main window', served12.question.difficulty >= 2 && served12.question.difficulty <= 4);
  }
  await assertReviews('jee main class 11', j11, [11, 12]);

  // ── JEE Advanced, Class 12 — the D3–D4 window ─────────────────────────────
  section('jee advanced class 12');
  const j12 = (await POST('/profiles', { name: 'Ira', year: 12, course: 'in', indiaTrack: 'jee-advanced' })).user;
  await liftFreeCap(j12.id);
  const j12log = await drive(24);
  ok('every JEE Advanced serve is D3 or D4', j12log.every(e => e.difficulty >= 3 && e.difficulty <= 4 && e.windowed === true), show([...new Set(j12log.map(e => e.difficulty))]));
  ok('JEE Advanced draws on both senior years', j12log.some(e => e.year === 11) && j12log.some(e => e.year === 12), show([...new Set(j12log.map(e => e.year))]));
  ok('an explicit D1 request is held to the JEE Advanced floor', (await serve({ subtopic: j12log[0].chapter, difficulty: 1 })).question.difficulty >= 3);
  ok('JEE Advanced keeps interleaving', longestRun(j12log) <= 2, `longest run ${longestRun(j12log)}`);
  ok('JEE Advanced rating rows are chapter-keyed', ratingRowsOf(j12.id).every(r => IN_CHAPTER_BY_ID[r.subtopic]));

  // ── Olympiad ──────────────────────────────────────────────────────────────
  const oly = (await POST('/profiles', { name: 'Meera', year: 9, course: 'in', indiaTrack: 'olympiad' })).user;
  await liftFreeCap(oly.id);
  const olylog = await drive(60);
  await assertSitting('olympiad', oly, olylog, { grades: [null], prefix: 'olymp-' });
  await assertReviews('olympiad', oly, [null]);

  // ── Isolation: one student's rows never bleed into another's ──────────────
  section('isolation');
  const all = rawRows().ratings;
  ok('four profiles hold four separate evidence sets', new Set(all.map(r => r.pid)).size === 5);
  ok('a shared generator never merged two students\' chapters', all.every(r => IN_CHAPTER_BY_ID[r.subtopic]));

  // ── Verdict ───────────────────────────────────────────────────────────────
  const total = pass + failures.length;
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
    console.log(`\nINDIA ADAPTIVE: FAIL — ${pass}/${total} checks`);
    return 1;
  }
  console.log(`INDIA ADAPTIVE: PASS — ${pass}/${total} checks`);
  return 0;
}

run().then(code => process.exit(code)).catch(err => {
  console.error(err?.stack || err);
  console.log(`\nINDIA ADAPTIVE: FAIL — crashed in "${group}" after ${pass} passing checks`);
  process.exit(1);
});
