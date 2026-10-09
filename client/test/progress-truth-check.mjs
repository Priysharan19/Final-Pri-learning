// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · progress truth suite (§14)
//
// Every number a student's Progress, India Progress and Home surfaces show is
// recomputed here INDEPENDENTLY from the raw attempt rows on disk, and the
// routes that feed those surfaces must agree with it to the unit:
//
//   · questions answered, correct, learning-evidence accuracy (and its sample
//     floor), independent vs supported correct            GET /stats, /report
//   · per-chapter attempts / correct / mastery            /stats, /curriculum
//   · the Elo chain: every attempt's ratingBefore is the previous ratingAfter,
//     every step is the engine's update for the help that attempt used, and
//     the chain ends on the stored rating                  ratings store
//   · answers per day in the student's timezone, today's count, the streak,
//     active days                                          activity, /me, /report
//   · the review queue, replayed from the attempts through FSRS
//                                                          /reviews, /stats, /curriculum
//   · exam history                                         /stats.examCount, India /exams
//
// The history is realistic: smart and chosen-chapter practice, clean answers,
// hints, AI-tutor help, second tries, double misses, reveals, a Rapid Fire
// game, a full India exam, answers either side of midnight IST, a day off, a
// second profile on the same device, a low-sample profile, a backup restored
// twice, and a profile that practised offline and then synced (twice), with a
// second device's events pulled twice. Nothing may double-count, and nothing
// may cross profiles.
//
// Randomness is seeded and the clock is a counter, so a failure reproduces.
//
// Usage: node client/test/progress-truth-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const DAY = 86400000;
const MIN = 60000;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261002);
Math.random = () => rng();

// 10:00 IST on 1 Sep 2026.
let clock = Date.UTC(2026, 8, 1, 4, 30, 0);
Date.now = () => clock;
const tick = ms => { clock += ms; };
const setIst = (dayOffset, hh, mm) => { clock = Date.UTC(2026, 8, 1 + dayOffset, hh, mm) - (5 * 60 + 30) * MIN; };

let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; };
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, cond, detail = '') {
  if (cond) { pass++; return true; }
  failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const eq = (name, actual, expected) => ok(name, show(actual) === show(expected), `expected ${show(expected)}, got ${show(actual)}`);

// ── Network ──────────────────────────────────────────────────────────────────
// Marking is online-only and server-authoritative (owner decision 2026-10-10),
// so the real /v1 app runs behind this suite (support/online-authority.mjs) and
// every practice mark below is the server's.
//
// One leg still needs a server that misbehaves on purpose: a sync endpoint
// that replays the same remote events on every pull, including counterfeits.
// The real server cannot be asked to do that, so while `syncStandIn` is on —
// and only then, and only for /v1/sync/* — this stand-in answers instead. It
// never sees a question or an answer and never produces a mark. It is
// installed under the authority's own fetch wrapper, so sign-in, issuing,
// marking and entitlements always reach the real server.
let syncStandIn = false;
const serverEvents = new Map();   // id → event (the server's UNIQUE(account_id, id))
let remoteFeed = [];               // what a pull hands back, every time
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const trueFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(String(url)).pathname;
  if (!syncStandIn || !path.startsWith('/v1/sync/')) return trueFetch(url, options);
  if (path.startsWith('/v1/sync/pull/')) {
    // A replaying server: every pull returns the same remote events.
    return json({ schemaVersion: 1, cursor: 900, hasMore: false, events: remoteFeed, entities: [] });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    const accepted = [];
    for (const e of body.events || []) {
      if (!serverEvents.has(e.id)) serverEvents.set(e.id, e);
      accepted.push({ id: e.id, serverCursor: 1000 + serverEvents.size, replayed: false });
    }
    return json({
      schemaVersion: 1, cursor: 1000 + serverEvents.size, acceptedEvents: accepted,
      acceptedEntities: (body.entities || []).map(x => ({ kind: x.kind, entityId: x.entityId, version: (x.baseVersion || 0) + 1, serverCursor: 1 })),
      fullRescanAccepted: !!body.fullRescan
    });
  }
  return json({ error: { code: 'NOT_FOUND' } }, 404);
};
let online = null;

// ── Answer helpers (canonical forms, as india-adaptive-check derives them) ───
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

async function run() {
  installBrowserEnv();
  resetStorage();
  const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
  online = await startOnlineAuthority({ label: 'progress-truth' });
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const idb = await import(`${SRC}local/idb.js`);
  const { checkAnswer } = await import(`${SRC}engine/checker.js`);
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();
  const A = await import(`${SRC}engine/adaptive.js`);
  const { PROGRESS_THRESHOLDS, accuracyClaim } = await import(`${SRC}engine/progressTruth.js`);
  const { dispatchIndiaExam } = await import(`${SRC}local/indiaExamBackend.js`);
  const { syncNow, remoteLearningSummary } = await import(`${SRC}platform/syncWorker.js`);

  const GET = (path, body) => dispatch('GET', path, body);
  const POST = (path, body) => dispatch('POST', path, body);

  // Each profile signs in to its own verified account; the Premium snapshot on
  // the real link row keeps the free daily cap (not this suite's subject) away.
  const liftFreeCap = pid => online.link(pid, { entitlement: 'premium' });

  // What the test did to each question, so the expected rating step can be
  // computed without reading anything the backend wrote about help.
  const helpLog = new Map(); // questionId → { hints, tutor, tries }

  async function serve(body = {}) {
    const res = await POST('/practice/next', { ...body, resume: false });
    const row = await idb.get('questions', res.question.id);
    // `q` is the test oracle's copy of the question (the device row of a
    // server-issued question holds no answer). It chooses what to type; the
    // server marks.
    return { res, row, q: await online.answerKey(row) };
  }

  /** Play one served question in a given style; returns what happened. */
  async function play(s, style) {
    const { q, row } = s;
    const right = canonicalInput(q);
    const wrong = wrongInput(q);
    const canRight = right !== null && checkAnswer(q, right).correct === true;
    const wc = wrong !== null ? checkAnswer(q, wrong) : null;
    const canWrong = !!wc && !wc.correct && !wc.invalid;
    const help = { hints: 0, tutor: 0, tries: 0 };
    helpLog.set(row.id, help);
    const submit = (answer, ms) => POST(`/practice/${row.id}/submit`, { answer, ms, submissionId: nextSubmissionId('sub_progress') });
    if (style === 'reveal' || (!canRight && style !== 'wrong2') || (!canWrong && (style === 'retry' || style === 'wrong2'))) {
      await POST(`/practice/${row.id}/reveal`, { ms: 20000 });
      return 'reveal';
    }
    if (style === 'hint') {
      const h = await POST(`/practice/${row.id}/hint`, {});
      if (h.level > 0) help.hints = h.level;
    }
    if (style === 'tutor') {
      // The tutor route needs the cloud; its effect on learner state is the
      // level it records on the row, which is what resolve() charges.
      const fresh = await idb.get('questions', row.id);
      await idb.put('questions', { ...fresh, tutorLevel: 2 });
      help.tutor = 2;
    }
    if (style === 'retry' || style === 'wrong2') {
      const r1 = await submit(wrong, 25000);
      if (r1.resolved) return 'wrong-fast';
      help.tries = 1;
      await submit(style === 'retry' ? right : wrong, 20000);
      return style;
    }
    const r = await submit(right, style === 'fast' ? 9000 : 41000);
    return r.correct ? style : 'odd';
  }

  const STYLES = ['clean', 'retry', 'fast', 'hint', 'clean', 'wrong2', 'tutor', 'clean', 'reveal', 'fast', 'retry', 'clean'];
  async function session(n, offset = 0, body = {}) {
    for (let i = 0; i < n; i++) {
      const s = await serve(body);
      await play(s, STYLES[(i + offset) % STYLES.length]);
      tick(2 * MIN);
    }
  }

  // ── Seed: Asha, Class 10 CBSE ──────────────────────────────────────────────
  section('seed');
  const asha = (await POST('/profiles', { name: 'Asha', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
  await liftFreeCap(asha.id);
  setIst(0, 10, 0); await session(12);
  setIst(1, 18, 30); await session(8, 3);
  // A chapter the student chose by name.
  const chosen = (await GET('/curriculum')).years.find(y => y.year === 10).subtopics[2].id;
  await session(3, 5, { subtopic: chosen });
  // Day 2: nothing. Day 3: practice, a game, and a full board paper.
  setIst(3, 16, 0); await session(6, 7);
  const rush = await POST('/rush/start', {});
  let rushCorrect = 0;
  for (const q of rush.questions.slice(0, 6)) {
    const row = await idb.get('questions', q.id);
    const right = canonicalInput(await online.answerKey(row));
    const r = await POST('/rush/answer', { id: q.id, answer: right ?? '0' });
    if (r.correct) rushCorrect++;
    tick(4000);
  }
  await POST('/rush/finish', { correct: rushCorrect, total: 6, bestCombo: 2 });
  const ashaRow = await idb.get('profiles', asha.id);
  const exam = await dispatchIndiaExam(ashaRow, 'POST', '/exams', { seed: 4242 });
  const paper = (await dispatchIndiaExam(ashaRow, 'GET', `/exams/${exam.exam.id}`, {})).exam;
  ok('the board paper was composed', Array.isArray(paper?.questions) && paper.questions.length > 0, show(Object.keys(paper || {})));
  // Answer the first half of the paper with whatever is first offered.
  const answers = {};
  for (const [i, q] of (paper.questions || []).entries()) {
    if (i % 2) continue;
    const row = await idb.get('questions', q.id);
    const right = row?.payload ? canonicalInput(await online.answerKey(row)) : null;
    if (right !== null) answers[q.id] = right;
  }
  tick(30 * MIN);
  await dispatchIndiaExam(ashaRow, 'POST', `/exams/${exam.exam.id}/submit`, { answers, ms: 45 * MIN });
  // Either side of midnight IST.
  setIst(3, 23, 50); await session(2, 2);
  setIst(4, 0, 10); await session(2, 4);
  setIst(4, 9, 0); await session(4, 6);

  // ── A second profile on the same device ────────────────────────────────────
  const kabir = (await POST('/profiles', { name: 'Kabir', year: 11, course: 'in', indiaTrack: 'jee-main' })).user;
  await liftFreeCap(kabir.id);
  setIst(4, 11, 0); await session(10, 1);
  await POST('/profiles/select', { id: asha.id });
  setIst(4, 20, 0);
  const NOW = Date.now();
  ok('the seeded history is substantial', rawRows().attempts.filter(a => a.pid === asha.id).length >= 60, `${rawRows().attempts.filter(a => a.pid === asha.id).length}`);

  // ── Independent expectations, from raw attempt rows ────────────────────────
  const tz = 'Asia/Kolkata';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateOf = ms => fmt.format(new Date(ms));

  function expectedFor(pid) {
    const atts = rawRows().attempts.filter(a => a.pid === pid).sort((a, b) => a.createdAt - b.createdAt || (a.id > b.id ? 1 : -1));
    const isEvidence = a => a.mode !== 'rush' && a.mode !== 'match' && a.subtopic && a.subtopic !== 'custom';
    const ev = atts.filter(isEvidence);
    const byCh = {};
    for (const a of ev) {
      const c = byCh[a.subtopic] || (byCh[a.subtopic] = { attempts: 0, correct: 0, independent: 0, last: 0, rows: [] });
      c.attempts++; if (a.correct) { c.correct++; if (a.support !== 'supported') c.independent++; }
      c.last = Math.max(c.last, a.createdAt); c.rows.push(a);
    }
    const days = {};
    for (const a of atts) { const d = dateOf(a.createdAt); days[d] = (days[d] || 0) + 1; }
    const prev = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - DAY).toISOString().slice(0, 10);
    let cur = dateOf(NOW); if (!days[cur]) cur = prev(cur);
    let streak = 0; while (days[cur]) { streak++; cur = prev(cur); }
    const evCorrect = ev.filter(a => a.correct).length;
    return {
      atts, ev, byCh, days, streak,
      answered: atts.length, correct: atts.filter(a => a.correct).length,
      evidence: { attempts: ev.length, correct: evCorrect, independentCorrect: ev.filter(a => a.correct && a.support !== 'supported').length, supportedCorrect: ev.filter(a => a.correct && a.support === 'supported').length },
      accuracy: ev.length >= PROGRESS_THRESHOLDS.overallAccuracy ? Math.round(1000 * evCorrect / ev.length) / 10 : null,
      today: days[dateOf(NOW)] || 0
    };
  }

  /** FSRS replay: the review rows the attempts imply, built without the backend. */
  function replayReviews(byCh) {
    const out = {};
    for (const [ch, c] of Object.entries(byCh)) {
      let rev = null;
      c.rows.forEach((a, i) => {
        if (!['practice', 'review', 'task'].includes(a.mode)) return;
        const supported = a.support === 'supported';
        const grade = A.gradeFor({ correct: !!a.correct, hintsUsed: supported ? 1 : 0, ms: a.ms || 0, difficulty: a.difficulty || 2 });
        if (rev) rev = A.scheduleReview(rev, grade, a.createdAt);
        else if (i + 1 >= 3) rev = A.scheduleReview(null, grade, a.createdAt);
      });
      if (rev) out[ch] = rev;
    }
    return out;
  }

  const X = expectedFor(asha.id);

  // ── The attempt rows themselves ────────────────────────────────────────────
  section('attempt ledger');
  eq('every attempt row is unique (no double-write)', new Set(X.atts.map(a => a.id)).size, X.atts.length);
  ok('the history mixes every kind of answer', ['practice', 'exam', 'rush'].every(m => X.atts.some(a => a.mode === m)) && X.ev.some(a => a.support === 'supported' && a.correct) && X.ev.some(a => a.support === 'independent' && a.correct) && X.ev.some(a => !a.correct),
    show([...new Set(X.atts.map(a => a.mode))]));
  ok('second tries were exercised', [...helpLog.values()].some(h => h.tries === 1));
  ok('tutor help was exercised', X.ev.some(a => a.tutorLevel === 2));

  // ── The Elo chain (and the second-try weighting fix) ───────────────────────
  section('rating chain');
  const ratingRows = Object.fromEntries(rawRows().ratings.filter(r => r.pid === asha.id).map(r => [r.subtopic, r]));
  let chainBreaks = [];
  let stepBreaks = [];
  // Parts of one exam question resolve in the same millisecond; within such a
  // tie the chain itself says which came first.
  const chained = rows => {
    const out = [];
    let before = A.START_RATING;
    const left = [...rows];
    while (left.length) {
      const t = Math.min(...left.map(a => a.createdAt));
      const tied = left.filter(a => a.createdAt === t);
      const next = tied.find(a => a.ratingBefore === before) || tied[0];
      out.push(next);
      left.splice(left.indexOf(next), 1);
      before = next.ratingAfter;
    }
    return out;
  };
  for (const [ch, c] of Object.entries(X.byCh)) {
    let before = A.START_RATING;
    chained(c.rows).forEach((a, n) => {
      if (a.ratingBefore !== before) chainBreaks.push([ch, n, a.ratingBefore, before]);
      const h = helpLog.get(a.questionId) || { hints: 0, tutor: 0, tries: 0 };
      const want = A.updateRating(a.ratingBefore, n, a.difficulty, !!a.correct, h.hints + h.tutor + h.tries);
      if (a.mode !== 'exam' && a.ratingAfter !== want) stepBreaks.push([ch, n, a.mode, h, a.ratingAfter, want]);
      before = a.ratingAfter;
    });
    if (ratingRows[ch]?.rating !== before) chainBreaks.push([ch, 'end', ratingRows[ch]?.rating, before]);
  }
  eq('every ratingBefore is the previous ratingAfter, ending on the stored rating', chainBreaks, []);
  eq('every rating step charges exactly the help that attempt used — a second try counts as help', stepBreaks.slice(0, 3), []);
  const retried = X.ev.filter(a => helpLog.get(a.questionId)?.tries === 1 && a.correct);
  ok('second-try successes exist in the history', retried.length > 0);
  ok('a second-try success is filed as supported', retried.every(a => a.support === 'supported'));

  // ── Rating rows agree with the attempts ────────────────────────────────────
  section('chapter counters');
  const drift = Object.entries(X.byCh).filter(([ch, c]) => ratingRows[ch]?.attempts !== c.attempts || ratingRows[ch]?.correct !== c.correct)
    .map(([ch, c]) => [ch, ratingRows[ch]?.attempts, c.attempts, ratingRows[ch]?.correct, c.correct]);
  eq('rating-row attempts/correct equal the attempts store per chapter', drift, []);
  const orphan = Object.values(ratingRows).filter(r => (r.attempts || 0) > 0 && !X.byCh[r.subtopic]).map(r => r.subtopic);
  eq('no rating row claims attempts the ledger does not hold', orphan, []);

  // ── GET /stats ─────────────────────────────────────────────────────────────
  section('GET /stats');
  const stats = await GET('/stats');
  eq('questions answered = every attempt row', stats.totals.attempts, X.answered);
  eq('correct = every correct attempt row', stats.totals.correct, X.correct);
  eq('learning evidence (games excluded) matches', stats.totals.evidence, X.evidence);
  eq('accuracy is the evidence ratio', stats.totals.accuracy.value, X.accuracy);
  eq('the accuracy claim is marked as enough evidence', stats.totals.accuracy.enough, true);
  const statsDrift = stats.chapters.filter(c => (X.byCh[c.id]?.attempts || 0) !== c.attempts || (X.byCh[c.id]?.correct || 0) !== c.correct).map(c => c.id);
  eq('every chapter on /stats carries the ledger\'s attempts and correct', statsDrift, []);
  const masteryDrift = stats.chapters.filter(c => X.byCh[c.id]).filter(c => {
    const st = ratingRows[c.id];
    return c.mastery !== Math.round(100 * A.masteryOf(st.rating, X.byCh[c.id].attempts, X.byCh[c.id].last, NOW));
  }).map(c => c.id);
  eq('chapter mastery = masteryOf(chain-end rating, ledger attempts, last ledger answer)', masteryDrift, []);
  ok('an unseen chapter shows no mastery and the unseen band', stats.chapters.filter(c => !X.byCh[c.id]).every(c => c.mastery === 0 && c.band === 'unseen'));
  eq('streak = consecutive IST days with an answer', stats.streak, X.streak);
  const finished = rawRows().exams.filter(e => e.pid === asha.id && e.finishedAt).length;
  eq('exam count = finished exams', stats.examCount, finished);
  ok('one finished exam is in the history', finished === 1);
  eq('recent = the last fifteen attempts, newest first', stats.recent.map(r => [r.subtopic, !!r.correct]), X.atts.slice(-15).reverse().map(a => [a.subtopic, !!a.correct]));
  eq('ink count = attempts answered in ink', stats.inkCount, X.atts.filter(a => a.viaInk).length);
  eq('best Rapid Fire score = the best stored run', stats.bestRush, Math.max(...rawRows().rushRuns.filter(r => r.pid === asha.id).map(r => r.score)));

  // ── Review queue, replayed from the attempts ───────────────────────────────
  section('review queue');
  const replay = replayReviews(X.byCh);
  const stored = Object.fromEntries(rawRows().reviews.filter(r => r.pid === asha.id).map(r => [r.subtopic, r]));
  eq('the chapters with a review row are exactly those the replay schedules', Object.keys(stored).sort(), Object.keys(replay).sort());
  const dueDrift = Object.entries(replay).filter(([ch, r]) => stored[ch]?.dueAt !== r.dueAt || stored[ch]?.lapses !== r.lapses || stored[ch]?.reps !== r.reps).map(([ch]) => ch);
  eq('every stored due date, rep and lapse is what FSRS gives for the attempts', dueDrift, []);
  const expectDue = Object.entries(replay).filter(([, r]) => r.dueAt <= NOW).map(([ch]) => ch).sort();
  const reviews = await GET('/reviews');
  eq('/reviews due = replayed rows due now', reviews.due.map(r => r.subtopic).sort(), expectDue);
  eq('/reviews upcoming = replayed rows due within seven days', reviews.upcoming.map(r => r.subtopic).sort(),
    Object.entries(replay).filter(([, r]) => r.dueAt > NOW && r.dueAt < NOW + 7 * DAY).map(([ch]) => ch).sort());
  eq('/stats reviewsDue = the same count', stats.reviewsDue, expectDue.length);
  eq('/stats chapter due flags = the same chapters', stats.chapters.filter(c => c.due).map(c => c.id).sort(), expectDue.filter(ch => stats.chapters.some(c => c.id === ch)));

  // ── GET /curriculum (the India Progress chapter table) ─────────────────────
  section('GET /curriculum');
  const cur = await GET('/curriculum');
  const yr = cur.years.find(y => y.year === 10);
  const curDrift = yr.subtopics.filter(c => (X.byCh[c.id]?.attempts || 0) !== c.attempts || (X.byCh[c.id]?.correct || 0) !== c.correct).map(c => c.id);
  eq('every chapter row the progress table renders matches the ledger', curDrift, []);
  eq('the table\'s attempts sum to the learning-evidence total', yr.subtopics.reduce((n, c) => n + c.attempts, 0), X.evidence.attempts);
  const dpDrift = yr.subtopics.filter(c => c.attempts && c.dotpoints.reduce((n, d) => n + d.attempts, 0) !== c.attempts).map(c => c.id);
  eq('dot-point attempts add up to their chapter', dpDrift, []);
  eq('due flags match the replay', yr.subtopics.filter(c => c.due).map(c => c.id).sort(), expectDue);

  // ── Home: /me, activity ────────────────────────────────────────────────────
  section('home');
  const me = (await GET('/me')).user;
  eq('today\'s questions = attempts on today\'s IST date', me.today.questions, X.today);
  eq('/me streak = the ledger streak', me.streak, X.streak);
  const activity = Object.fromEntries(rawRows().activity.filter(r => r.pid === asha.id).map(r => [r.date, r.questions]));
  eq('activity rows equal answers per IST day', activity, X.days);
  ok('the answer at 23:50 IST and the one at 00:10 IST land on different days', X.days['2026-09-04'] >= 2 && X.days['2026-09-05'] >= 2, show(X.days));
  eq('the day off is a gap, not a zero row', X.days['2026-09-03'], undefined);

  // ── /report ────────────────────────────────────────────────────────────────
  section('GET /report');
  const report = await GET('/report');
  eq('report totals = ledger', report.totals, { attempts: X.answered, correct: X.correct });
  eq('report streak = ledger', report.streak, X.streak);
  eq('report active days (28) = distinct IST days with an answer', report.activeDays, Object.keys(X.days).length);
  const repDrift = report.chapters.filter(c => (X.byCh[c.id]?.attempts || 0) !== c.attempts).map(c => c.id);
  eq('report chapters = ledger', repDrift, []);

  // ── India exam history ─────────────────────────────────────────────────────
  section('exam history');
  const list = await dispatchIndiaExam(await idb.get('profiles', asha.id), 'GET', '/exams', {});
  const items = list.exams || list.items || [];
  ok('the India exam list holds the finished paper', items.some(e => e.id === exam.exam.id), show(items.map(e => e.id)));
  const examAtts = X.atts.filter(a => a.mode === 'exam');
  ok('the exam wrote one attempt per marked part, each once', examAtts.length > 0 && new Set(examAtts.map(a => a.id)).size === examAtts.length);
  // Replaying the submission must not write a single extra attempt.
  try { await dispatchIndiaExam(await idb.get('profiles', asha.id), 'POST', `/exams/${exam.exam.id}/submit`, { answers, ms: 45 * MIN }); } catch { /* refused is fine */ }
  eq('a replayed exam submission adds no attempt', rawRows().attempts.filter(a => a.pid === asha.id).length, X.answered);

  // ── Profile isolation ──────────────────────────────────────────────────────
  section('profile isolation');
  await POST('/profiles/select', { id: kabir.id });
  const K = expectedFor(kabir.id);
  const kstats = await GET('/stats');
  eq('the second profile counts only its own answers', kstats.totals.attempts, K.answered);
  eq('…and its own evidence', kstats.totals.evidence, K.evidence);
  ok('no chapter of the second profile carries the first one\'s attempts', kstats.chapters.every(c => (K.byCh[c.id]?.attempts || 0) === c.attempts));
  eq('the second profile\'s today', (await GET('/me')).user.today.questions, K.today);
  await POST('/profiles/select', { id: asha.id });
  eq('the first profile is unchanged by the second', (await GET('/stats')).totals.attempts, X.answered);

  // ── Low-sample honesty ─────────────────────────────────────────────────────
  section('low sample');
  const nova = (await POST('/profiles', { name: 'Nova', year: 9, course: 'in', indiaTrack: 'cbse' })).user;
  await online.link(nova.id, { name: 'Nova' });
  let nstats = await GET('/stats');
  eq('a new profile has no accuracy', nstats.totals.accuracy.value, null);
  eq('…and says how many answers it needs', nstats.totals.accuracy.needed, PROGRESS_THRESHOLDS.overallAccuracy);
  ok('a new profile shows no mastery anywhere', nstats.chapters.every(c => c.mastery === 0 && c.band === 'unseen'));
  eq('a new profile has no exam prediction headline', nstats.examPrediction?.show ? 'shown' : 'withheld', 'withheld');
  for (let i = 0; i < 3; i++) { const s = await serve(); await play(s, 'clean'); tick(MIN); }
  nstats = await GET('/stats');
  eq('three clean answers are not "100% accuracy"', nstats.totals.accuracy.value, null);
  eq('…they are three answers, seven short of a claim', [nstats.totals.evidence.correct, nstats.totals.accuracy.needed], [3, PROGRESS_THRESHOLDS.overallAccuracy - 3]);
  ok('one correct answer cannot reach the mastered band', nstats.chapters.every(c => c.band !== 'mastered' && c.band !== 'strong'), show(nstats.chapters.filter(c => c.attempts).map(c => [c.id, c.mastery, c.band])));
  await POST('/profiles/select', { id: asha.id });

  // ── Restore twice: two isolated copies, no double-count ────────────────────
  section('restore replay');
  const backup = await GET('/data/export');
  const r1 = await POST('/data/import', backup);
  const s1 = await GET('/stats');
  const r2 = await POST('/data/import', backup);
  const s2 = await GET('/stats');
  ok('each restore is its own profile', r1.user.id !== r2.user.id && r1.user.id !== asha.id);
  eq('a restored copy carries exactly the original totals', [s1.totals.attempts, s1.totals.evidence], [X.answered, X.evidence]);
  eq('restoring the same backup again does not double-count', [s2.totals.attempts, s2.totals.evidence], [X.answered, X.evidence]);
  eq('…and its streak is the original\'s', s2.streak, X.streak);
  await POST('/profiles/select', { id: asha.id });
  eq('the original is untouched by both restores', (await GET('/stats')).totals.attempts, X.answered);

  // ── Signed out and offline nothing is checked; marked online, then synced
  //    (twice), then another device's events pulled twice ────────────────────
  section('offline then synced');
  const sita = (await POST('/profiles', { name: 'Sita', year: 8, course: 'in', indiaTrack: 'cbse' })).user;
  const sitaLedger = () => show({
    attempts: rawRows().attempts.filter(a => a.pid === sita.id).length,
    ratings: rawRows().ratings.filter(r => r.pid === sita.id).length,
    reviews: rawRows().reviews.filter(r => r.pid === sita.id).length,
    activity: rawRows().activity.filter(r => r.pid === sita.id).length,
    xp: rawRows().profiles.find(r => r.id === sita.id)?.xp || 0
  });
  const emptyLedger = sitaLedger();
  const refusal = fn => fn().then(() => 'checked', err => err?.code || String(err));
  const firstServed = await serve();
  const firstRight = canonicalInput(firstServed.q) ?? '0';
  const gradedBefore = online.traffic.grade;
  // Before signing in: the question can be read, but not checked.
  eq('signed out, an answer is not checked', await refusal(() => POST(`/practice/${firstServed.row.id}/submit`, { answer: firstRight, ms: 9000, submissionId: nextSubmissionId('sub_progress_out') })), 'SIGN_IN_TO_CHECK');
  eq('…and nothing is counted: no attempt, rating, review, activity or XP', sitaLedger(), emptyLedger);
  await online.link(sita.id, { name: 'Sita' });
  // Signed in but with no connection: still nothing is checked.
  await online.offline(async () => {
    eq('offline, an answer is not checked', await refusal(() => POST(`/practice/${firstServed.row.id}/submit`, { answer: firstRight, ms: 9000, submissionId: nextSubmissionId('sub_progress_off') })), 'RECONNECT_TO_CHECK');
    eq('offline, the solution is not shown either', await refusal(() => POST(`/practice/${firstServed.row.id}/reveal`, { ms: 9000 })), 'RECONNECT_TO_CHECK');
    eq('offline practice counts nothing locally', (await GET('/stats')).totals.attempts, 0);
  });
  eq('…no attempt, rating, review, activity or XP was written', sitaLedger(), emptyLedger);
  eq('the server marked nothing while signed out or offline', online.traffic.grade, gradedBefore);
  const kept = await idb.get('questions', firstServed.row.id);
  ok('the refused question is still there, unanswered, with no try spent', !!kept && !kept.answered && (kept.tries || 0) === 0 && kept.payload.prompt === firstServed.q.prompt, show({ answered: kept?.answered, tries: kept?.tries }));
  // Back online, that same question is checked, and five more after it.
  await play(firstServed, STYLES[0]); tick(MIN);
  for (let i = 1; i < 6; i++) { const s = await serve(); await play(s, STYLES[i]); tick(MIN); }
  ok('once reconnected the refused question was marked by the server', (await idb.get('questions', firstServed.row.id))?.serverReceipt?.authoritative === true);
  const offline = await GET('/stats');
  const S = expectedFor(sita.id);
  eq('practice marked online counts locally at once', offline.totals.attempts, S.answered);
  eq('…as six answers', S.answered, 6);
  syncStandIn = true;
  const first = await syncNow(sita.id);
  ok('the first sync published the answers', first.pushedEvents >= S.answered, show(first));
  const practiceEvents = () => [...serverEvents.values()].filter(e => e.kind === 'practice-progress').length;
  eq('the server holds one practice event per local answer', practiceEvents(), S.answered);
  await syncNow(sita.id);
  await syncNow(sita.id);
  eq('syncing again publishes nothing new', practiceEvents(), S.answered);
  const afterSync = await GET('/stats');
  eq('sync does not change local progress', [afterSync.totals, afterSync.streak], [offline.totals, offline.streak]);
  // Another device's answers arrive in every pull — the server is replaying.
  // Two were answered today, two yesterday (the profile's own timezone).
  //
  // Only the canonical event the SERVER GRADER wrote in the same transaction
  // as the mark changes progress here (kind 'graded-attempt', the reserved
  // device identity 'server-grader', event id === payload.attemptId, entity id
  // === payload.questionId — see cloudSyncRestore.js / syncWorker.js). What
  // another device merely *claims* about its own answers is archival.
  const remoteAt = i => Date.now() - i * MIN - (i >= 2 ? DAY : 0);
  const remotePayload = (i, extra = {}) => ({ subtopic: 'in-c8-rational-numbers', difficulty: 2, correct: i % 2 === 0, ms: 20000, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false, ratingBefore: null, ratingAfter: null, createdAt: remoteAt(i), ...extra });
  const gradedFeed = [0, 1, 2, 3].map(i => ({
    id: `evt-other-${i}`, deviceId: 'server-grader', deviceSeq: i + 1, serverCursor: 500 + i, kind: 'graded-attempt',
    entityId: `q-other-${i}`, occurredAt: remoteAt(i),
    payload: remotePayload(i, { attemptId: `evt-other-${i}`, questionId: `q-other-${i}` })
  }));
  // First, the negative: the same four answers as a client-authored
  // 'practice-progress' claim from another device, every one "correct", plus
  // two counterfeits of the canonical kind (one not from the server grader,
  // one whose id is not the attempt it names). None of them is a mark.
  const stats0 = await GET('/stats');
  const rows0 = rawRows().attempts.filter(a => a.pid === sita.id).length;
  const activity0 = JSON.stringify(rawRows().activity.filter(r => r.pid === sita.id));
  const ratings0 = JSON.stringify(rawRows().ratings?.filter(r => r.pid === sita.id) ?? null);
  remoteFeed = [
    ...[0, 1, 2, 3].map(i => ({
      id: `evt-claim-${i}`, deviceId: 'device-other', deviceSeq: i + 1, serverCursor: 400 + i, kind: 'practice-progress',
      entityId: `q-claim-${i}`, occurredAt: remoteAt(i),
      payload: remotePayload(i, { correct: true, marksEarned: 4, marksPossible: 4 })
    })),
    { id: 'evt-forged-device', deviceId: 'device-other', deviceSeq: 5, serverCursor: 404, kind: 'graded-attempt',
      entityId: 'q-forged-device', occurredAt: remoteAt(0),
      payload: remotePayload(0, { attemptId: 'evt-forged-device', questionId: 'q-forged-device' }) },
    { id: 'evt-forged-id', deviceId: 'server-grader', deviceSeq: 99, serverCursor: 405, kind: 'graded-attempt',
      entityId: 'q-forged-id', occurredAt: remoteAt(0),
      payload: remotePayload(0, { attemptId: 'some-other-attempt', questionId: 'q-forged-id' }) }
  ];
  await syncNow(sita.id);
  await syncNow(sita.id);
  const claimed = await remoteLearningSummary(sita.id);
  ok('the client-authored claims were received and archived', claimed.cachedEvents >= 4, show(claimed));
  eq('a client-authored practice-progress event from another device is not counted as marks', [claimed.attempts, claimed.correct], [0, 0]);
  const stats1 = await GET('/stats');
  eq('…and changes no total, accuracy or streak on this device', [stats1.totals, stats1.streak], [stats0.totals, stats0.streak]);
  eq('…and adds no attempt row', rawRows().attempts.filter(a => a.pid === sita.id).length, rows0);
  eq('…and no activity-day count', JSON.stringify(rawRows().activity.filter(r => r.pid === sita.id)), activity0);
  eq('…and no rating', JSON.stringify(rawRows().ratings?.filter(r => r.pid === sita.id) ?? null), ratings0);
  // Now the canonical server-graded events for the same four answers.
  remoteFeed = [...remoteFeed, ...gradedFeed];
  const ashaBefore = rawRows().attempts.filter(a => a.pid === asha.id).length;
  await syncNow(sita.id);
  const once = await remoteLearningSummary(sita.id);
  await syncNow(sita.id);
  const twice = await remoteLearningSummary(sita.id);
  eq('another device\'s events are counted once', [once.attempts, once.correct], [4, 2]);
  eq('pulling the same events again does not double-count', [twice.attempts, twice.correct], [once.attempts, once.correct]);
  // The other device's four answers (two correct, all independent learning
  // evidence, 20 s each) are folded into this device's ledger exactly once —
  // the exact totals object, built the way expectedFor builds its numbers.
  const foldedEvidence = {
    attempts: offline.totals.evidence.attempts + 4, correct: offline.totals.evidence.correct + 2,
    independentCorrect: offline.totals.evidence.independentCorrect + 2, supportedCorrect: offline.totals.evidence.supportedCorrect
  };
  const folded = {
    attempts: offline.totals.attempts + 4, correct: offline.totals.correct + 2, ms: offline.totals.ms + 4 * 20000,
    evidence: foldedEvidence, accuracy: accuracyClaim(foldedEvidence.correct, foldedEvidence.attempts, PROGRESS_THRESHOLDS.overallAccuracy)
  };
  const after2 = await GET('/stats');
  eq('another device\'s events are folded into this device\'s ledger once', after2.totals, folded);
  const S2 = expectedFor(sita.id);
  eq('the folded totals are what the raw attempt rows say', [after2.totals.attempts, after2.totals.correct, after2.totals.evidence], [S2.answered, S2.correct, S2.evidence]);
  await syncNow(sita.id);
  eq('pulling the same events a third time leaves the totals unchanged', (await GET('/stats')).totals, folded);
  const restoredRows = rawRows().attempts.filter(a => a.pid === sita.id && typeof a.remoteEventId === 'string');
  eq('the four restored attempt rows carry the cloud event id they came from', restoredRows.map(a => a.remoteEventId).sort(), ['evt-other-0', 'evt-other-1', 'evt-other-2', 'evt-other-3']);
  ok('every restored row names the server grader that marked it', restoredRows.every(a => a.remoteDeviceId === 'server-grader'));
  eq('no local answer was re-stamped as remote', rawRows().attempts.filter(a => a.pid === sita.id).length - restoredRows.length, S.answered);
  eq('the streak reflects the remote days in the profile\'s timezone', after2.streak, S2.streak);
  eq('…which is yesterday and today', [S2.streak, Object.keys(S2.days).length], [2, 2]);
  eq('today\'s count folds in the two remote answers from today', (await GET('/me')).user.today.questions, S2.today);
  eq('…and today is the six local answers plus two', S2.today, S.today + 2);
  eq('the per-day activity rows equal the ledger\'s per-day counts', Object.fromEntries(rawRows().activity.filter(r => r.pid === sita.id).map(r => [r.date, r.questions])), S2.days);
  eq('another profile on the device gains no rows from this profile\'s pull', rawRows().attempts.filter(a => a.pid === asha.id).length, ashaBefore);
  eq('…and none of its rows is marked remote', rawRows().attempts.filter(a => a.pid === asha.id && a.remoteEventId).length, 0);
  const otherProfile = await remoteLearningSummary(asha.id);
  eq('one profile\'s pulled events are invisible to another', otherProfile.attempts, 0);
  syncStandIn = false;

  // ── Every mark in this history is the server's ─────────────────────────────
  section('server authority');
  // The four profiles that practised on this device (a restored backup copy is
  // history, not a marking: it carries neither a server question nor a receipt).
  const live = new Set([asha.id, kabir.id, nova.id, sita.id]);
  const allPractice = rawRows().questions.filter(r => r.answered && ['practice', 'review', 'task'].includes(r.mode));
  const practiceRows = allPractice.filter(r => live.has(r.pid));
  ok('every practice question resolved on this device carries the server\'s authoritative receipt', practiceRows.length >= 50 && practiceRows.every(r => r.serverQuestionId && r.serverReceipt?.authoritative === true),
    `${practiceRows.filter(r => !r.serverReceipt?.authoritative).length}/${practiceRows.length} without a receipt`);
  ok('no resolved practice question kept an answer on the device', allPractice.every(r => !('answer' in (r.payload || {}))));
  // A real sync with the real server: the server already holds the canonical
  // graded attempt for every answer it marked. Pulling them back must not
  // count any answer a second time.
  await POST('/profiles/select', { id: asha.id });
  const realBefore = [(await GET('/stats')).totals, rawRows().attempts.filter(a => a.pid === asha.id).length];
  const real1 = await syncNow(asha.id).then(r => r, err => ({ threw: err?.code || String(err) }));
  const real2 = await syncNow(asha.id).then(r => r, err => ({ threw: err?.code || String(err) }));
  ok('a sync with the real server completes', !real1?.threw && !real2?.threw, show([real1, real2]));
  eq('syncing with the real server double-counts no server-marked answer', [(await GET('/stats')).totals, rawRows().attempts.filter(a => a.pid === asha.id).length], realBefore);
}

try {
  await run();
} catch (err) {
  failures.push(`${group} · threw: ${err?.stack || err}`);
}
await online?.close().catch(() => {});
if (failures.length) {
  console.error(`PROGRESS TRUTH: FAIL — ${failures.length} failed, ${pass} passed`);
  for (const f of failures) console.error(`  ✘ ${f}`);
  process.exit(1);
}
console.log(`PROGRESS TRUTH: PASS — ${pass}/${pass} checks`);
process.exit(0);
