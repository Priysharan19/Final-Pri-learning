// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India difficulty truth (issue #408)
//
// A student who names a difficulty is served at exactly that level or not at
// all. This suite drives the real POST /practice/next for EVERY India chapter ×
// track × dot point (and the chapter as a whole) × every difficulty D1–D4 — the
// buttons the picker offers and the levels only a typed or stale link could
// carry — and asserts, per request:
//
//   · served ⇒ requested === served === the level the generator really ran at
//     (regenerating (generator, level, seed) reproduces the served prompt) and
//     the label text is the label of that level;
//   · a level the picker OFFERS for the selection (`requestable` on
//     GET /curriculum) is always served;
//   · any other level is REFUSED with DIFFICULTY_UNAVAILABLE carrying the level
//     asked for and exactly the levels that exist for that selection — no
//     question row is written and no practice allowance is spent. Nothing is
//     ever substituted, with or without a notice.
//
// The owner's case is a named regression: Class 12, JEE Advanced, Complex
// Numbers, hardest. Seed 56 at D3 is "principal argument of z = -5 + 5i".
//
// Usage: node client/test/india-difficulty-truth-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const DAY = 86400000;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261010);
Math.random = () => rng();

let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; };
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, condition, detail = '') {
  if (condition) { pass++; return true; }
  if (failures.length < 60) failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  else if (failures.length === 60) failures.push('… further failures suppressed');
  return false;
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);

async function run() {
  installBrowserEnv();
  resetStorage();
  const { dispatch, namedDifficultyOf, difficultyUnavailable } = await import(`${SRC}local/backend.js`);
  const idb = await import(`${SRC}local/idb.js`);
  const { cloudLinkRowId } = await import(`${SRC}platform/cloudAccount.js`);
  const { loadAllBanks, loadBanksFor, generateQuestion } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();
  const { DIFF_LABELS, CURRICULUM, dotpointsFor } = await import(`${SRC}engine/curriculum.js`);
  const { IN_CHAPTER_BY_ID } = await import(`${SRC}engine/curriculum-in.js`);
  const { indiaRequestableDifficulties, indiaDifficultyWindow } = await import(`${SRC}engine/indiaProduct.js`);
  const { practiceDifficulties, practiceHref, practiceRequestFromQuery } = await import(`${SRC}lib/practiceLinks.js`);
  const { selectableDifficulties } = await import(`${SRC}engine/curriculumAvailability.js`);

  const GET = (path, body) => dispatch('GET', path, body);
  const POST = (path, body) => dispatch('POST', path, body);

  // The free tier's daily cap and the Premium JEE Advanced gate are other
  // suites' subjects; a Premium snapshot keeps them out of this sweep.
  async function premium(pid) {
    const now = Date.now();
    await idb.put('device', {
      id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student',
      emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
      entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY, issuedAt: now, sourceVersion: 1 }
    });
  }

  /** One serve, with the stored row behind it. A refusal comes back as { error }. */
  async function serve(body) {
    try {
      const res = await POST('/practice/next', body);
      const row = await idb.get('questions', res.question.id);
      return { res, row };
    } catch (error) {
      return { error };
    }
  }

  /** Regenerate the served question from what the row says produced it. */
  async function regenerated(row, difficulty) {
    const generator = row.issue?.generator || row.generator || row.payload?.subtopic;
    const seed = row.issue?.seed ?? row.payload?.seed;
    await loadBanksFor([generator]);
    return generateQuestion(generator, difficulty, seed);
  }

  const counts = { cells: 0, selections: 0, requests: 0, serves: 0, refusals: 0, alternativesFollowed: 0, noAlternative: 0 };
  const questionRows = async () => rawRows().questions.length;

  /** A served question is exactly the level asked for, and labelled as it. */
  async function assertServed(label, { res, row }, asked) {
    const q = res.question;
    counts.serves++;
    eq(`${label}: served at the level asked for`, q.difficulty, asked);
    ok(`${label}: the label is the label of that level`, q.diffLabel === DIFF_LABELS[asked], show(q.diffLabel));
    ok(`${label}: the stored row agrees`, Number(row.difficulty) === asked && (!row.issue || row.issue.difficulty === asked), show({ row: row.difficulty, issue: row.issue?.difficulty }));
    const again = await regenerated(row, asked);
    ok(`${label}: that is the level the generator ran at`, again.difficulty === asked && again.prompt === q.prompt,
      `regenerating at D${asked} gave D${again.difficulty} ${show(String(again.prompt).slice(0, 80))}, served ${show(String(q.prompt).slice(0, 80))}`);
    eq(`${label}: the reply names the level asked for`, res.difficultyRequested, asked);
    eq(`${label}: the reply names the same level as served`, res.difficultyServed, asked);
  }

  /** A refusal names the level asked for and exactly the levels that exist. */
  function assertRefused(label, error, asked, requestable) {
    counts.refusals++;
    if (!ok(`${label}: refused with DIFFICULTY_UNAVAILABLE`, error?.code === 'DIFFICULTY_UNAVAILABLE' && error.status === 409, `${error?.code || ''} ${error?.message || ''}`)) return false;
    eq(`${label}: the refusal names the level asked for`, error.detail.difficultyRequested, asked);
    eq(`${label}: the refusal lists exactly the levels that exist`, error.detail.available.map(a => a.difficulty), requestable.filter(d => d !== asked));
    ok(`${label}: each alternative carries its own label`, error.detail.available.every(a => a.label === DIFF_LABELS[a.difficulty]), show(error.detail.available));
    ok(`${label}: the level asked for is not among the alternatives`, !error.detail.available.some(a => a.difficulty === asked));
    if (!error.detail.available.length) counts.noAlternative++;
    return true;
  }

  /**
   * One request that names `asked` for a selection: served exactly when the
   * picker offers the level, refused otherwise — and a refusal writes nothing.
   */
  async function assertRequest(label, body, asked, requestable) {
    counts.requests++;
    const before = await questionRows();
    const s = await serve(body);
    if (requestable.includes(asked)) {
      if (ok(`${label}: a level the picker offers is served`, !s.error, `${s.error?.code || ''} ${s.error?.message || ''}`)) await assertServed(label, s, asked);
      return s;
    }
    ok(`${label}: a level with no authored form is not served`, !!s.error, s.error ? '' : `served D${s.res?.question?.difficulty}`);
    if (s.error) assertRefused(label, s.error, asked, requestable);
    eq(`${label}: a refusal writes no question row`, await questionRows(), before);
    return s;
  }

  // ── The owner's case ──────────────────────────────────────────────────────
  section('owner case: Class 12 · JEE Advanced · Complex Numbers · hardest');
  const owner = (await POST('/profiles', { name: 'Owner', year: 12, course: 'in', indiaTrack: 'jee-advanced' })).user;
  await premium(owner.id);
  {
    const seed56 = generateQuestion('c11-complex-numbers', 3, 56);
    ok('seed 56 at D3 is the principal argument of -5 + 5i', /principal argument/i.test(seed56.prompt) && /-5\s*\+\s*5i/.test(seed56.prompt), show(seed56.prompt));
    eq('that question is a D3 question', seed56.difficulty, 3);

    const curriculum = await GET('/curriculum');
    const stream = curriculum.streams.find(s => s.track === 'jee-advanced' && s.year === 12);
    const chapter = stream.subtopics.find(s => s.id === 'c11-complex-numbers');
    const argument = chapter.dotpoints.findIndex(d => /argument/i.test(d.text));
    ok('the chapter has a polar-form / argument dot point', argument >= 0);
    const track = practiceDifficulties({ course: 'in', track: 'jee-advanced', grade: 12, ceiling: stream.difficultyCeiling });
    ok('JEE Advanced allows the hardest level, D4', track.includes(4), show(track));
    const buttons = selectableDifficulties(track, chapter.dotpoints[argument]);
    ok('the picker does not offer D4 for the argument dot point', !buttons.includes(4), show(buttons));
    eq('the argument dot point is requestable at D3 only', chapter.dotpoints[argument].requestable, [3]);

    // A stale or typed link can still ask for it: it is refused, and nothing
    // — least of all the D3 argument question — is served in its place.
    const link = practiceHref({ subtopic: chapter.id, dotpoint: argument, difficulty: 4, track: 'jee-advanced' });
    const body = practiceRequestFromQuery(new URLSearchParams(link.split('?')[1]));
    for (let i = 0; i < 12; i++) {
      const before = await questionRows();
      const s = await serve(body);
      if (!ok('hardest on the argument dot point serves no question', !!s.error, s.error ? '' : show(s.res?.question?.prompt))) break;
      eq('it is refused as DIFFICULTY_UNAVAILABLE', s.error.code, 'DIFFICULTY_UNAVAILABLE');
      eq('the refusal names D4', s.error.detail.difficultyRequested, 4);
      eq('the only alternative offered is D3 · Advanced', s.error.detail.available, [{ difficulty: 3, label: DIFF_LABELS[3] }]);
      eq('no question row was written', await questionRows(), before);
    }
    // The student presses "Practise at D3 · Advanced": only now is D3 served.
    const chosen = await serve({ ...body, difficulty: 3 });
    if (ok('the level the student then chooses is served', !chosen.error, chosen.error?.message)) {
      await assertServed('owner choice D3', chosen, 3);
      eq('and it is labelled D3, never D4', chosen.res.question.diffLabel, DIFF_LABELS[3]);
    }
    // Every dot point and the chapter itself, at the hardest level.
    for (const dp of [null, ...chapter.dotpoints.map((_, i) => i)]) {
      const requestable = dp == null ? chapter.requestable : chapter.dotpoints[dp].requestable;
      await assertRequest(`hardest · ${dp == null ? 'chapter' : `dp${dp}`}`, { mode: 'topic', subtopic: chapter.id, track: 'jee-advanced', dotpoint: dp ?? undefined, difficulty: 4 }, 4, requestable);
    }
    eq('the modulus dot point (authored D1–D2 only) has no JEE Advanced level', chapter.dotpoints[0].requestable, []);
    const below = await serve({ mode: 'topic', subtopic: chapter.id, track: 'jee-advanced', dotpoint: 0, difficulty: 2 });
    ok('asking for its own D2 on JEE Advanced is refused too — D2 is not a level of that track', below.error?.code === 'DIFFICULTY_UNAVAILABLE' && below.error.detail.available.length === 0, show(below.error?.detail || below.res?.question?.difficulty));
  }

  // ── A refusal spends no allowance ─────────────────────────────────────────
  section('allowance');
  {
    const free = (await POST('/profiles', { name: 'Free', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
    const curriculum = await GET('/curriculum');
    const sec = curriculum.years.find(y => y.year === 10);
    const gap = sec.subtopics.flatMap(c => c.dotpoints.map((d, i) => ({ c, i, d }))).find(x => x.d.generated && x.d.requestable.length && x.d.requestable.length < 3);
    ok('a free Class 10 profile has a dot point with a missing level', !!gap);
    const missing = [1, 2, 3].find(d => !gap.d.requestable.includes(d));
    const first = await serve({ mode: 'topic', subtopic: gap.c.id, track: 'cbse', dotpoint: gap.i, difficulty: gap.d.requestable[0] });
    ok('the free profile is served a level that exists', !first.error, first.error?.message);
    const allowance = first.res?.allowance;
    for (let i = 0; i < 30; i++) {
      const r = await serve({ mode: 'topic', subtopic: gap.c.id, track: 'cbse', dotpoint: gap.i, difficulty: missing });
      if (!ok('every request for the missing level is refused', r.error?.code === 'DIFFICULTY_UNAVAILABLE', r.error?.code || 'served')) break;
    }
    const after = await serve({ mode: 'topic', subtopic: gap.c.id, track: 'cbse', dotpoint: gap.i, difficulty: gap.d.requestable[0] });
    ok('thirty refusals (more than the daily free cap) spent no allowance', !after.error, `${after.error?.code || ''} ${after.error?.message || ''}`);
    ok('the allowance moved by exactly the one question served', allowance && after.res?.allowance
      && JSON.stringify({ ...allowance, used: undefined, remaining: undefined }) === JSON.stringify({ ...after.res.allowance, used: undefined, remaining: undefined })
      && (after.res.allowance.used ?? 0) - (allowance.used ?? 0) === 1, show({ allowance, after: after.res?.allowance }));
    void free;
  }

  // ── The page and the strings that say it ──────────────────────────────────
  section('surface');
  {
    const read = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
    const practice = read('pages/PracticeBase.jsx');
    ok('Practice renders the unavailable-level chooser', practice.includes('data-difficulty-unavailable') && practice.includes('data-difficulty-choice') && practice.includes('practice.levelPractiseAt'));
    ok('the chooser clears whatever question was on screen', /DIFFICULTY_UNAVAILABLE'\) \{[^}]*setServe\(null\)/s.test(practice));
    ok('no auto-substitution notice remains', !practice.includes('difficulty-substituted') && !practice.includes('difficultySubstituted') && !practice.includes('difficultyHonoured'));
    const home = read('pages/Home.jsx');
    ok('Home narrows the difficulty buttons to authored levels', home.includes('selectableDifficulties(trackDifficulties'));
    for (const lang of ['en', 'hi']) {
      const strings = read(`i18n/strings.${lang}.js`);
      for (const key of ['practice.levelUnavailableTopic', 'practice.levelUnavailableDotpoint', 'practice.levelUnavailableChoose', 'practice.levelUnavailableNone', 'practice.levelPractiseAt', 'practice.levelLetPriChoose', 'home.difficultyMissingTopic', 'home.difficultyMissingDotpoint']) {
        ok(`${lang} has ${key}`, strings.includes(`'${key}'`));
      }
      ok(`${lang} has no substitution string left`, !strings.includes('difficultySubstituted'));
    }
    eq('the picker keeps the track levels when a selection publishes none', selectableDifficulties([1, 2, 3], { text: 'x' }), [1, 2, 3]);
    eq('the picker narrows to the published levels', selectableDifficulties([2, 3, 4], { requestable: [3] }), [3]);
    eq('no difficulty named means none', namedDifficultyOf(''), null);
    eq('a named difficulty is a whole level', namedDifficultyOf('4'), 4);
    const refusal = difficultyUnavailable(4, [3, 4, 3], { subtopic: 'c', dotpoint: 1 });
    eq('the refusal is a 409 the page can act on', [refusal.status, refusal.code], [409, 'DIFFICULTY_UNAVAILABLE']);
    eq('its alternatives never include the level refused', refusal.detail.available, [{ difficulty: 3, label: DIFF_LABELS[3] }]);
  }

  // ── Every chapter × track × selection × difficulty ────────────────────────
  const profiles = [
    ...[7, 8, 9, 10, 11, 12].map(year => ({ year, indiaTrack: 'cbse' })),
    ...[11, 12].flatMap(year => [{ year, indiaTrack: 'jee-main' }, { year, indiaTrack: 'jee-advanced' }]),
    { year: 9, indiaTrack: 'olympiad' }
  ];
  const gaps = [];
  for (const spec of profiles) {
    section(`sweep · class ${spec.year} · ${spec.indiaTrack}`);
    const user = (await POST('/profiles', { name: `S${spec.year}${spec.indiaTrack}`, year: spec.year, course: 'in', indiaTrack: spec.indiaTrack })).user;
    await premium(user.id);
    const curriculum = await GET('/curriculum');
    const sections = [...curriculum.years, ...curriculum.streams].filter(s => s.track === spec.indiaTrack && (s.allYears || s.year === spec.year));
    eq('the profile has exactly one section on its own track and class', sections.length, 1);
    const sec = sections[0];
    const window = indiaDifficultyWindow(spec.indiaTrack, spec.year);
    const buttons = practiceDifficulties({ course: 'in', track: spec.indiaTrack, grade: spec.year, ceiling: sec.difficultyCeiling });
    for (const chapter of sec.subtopics) {
      counts.cells++;
      const engineChapter = IN_CHAPTER_BY_ID[chapter.id] || (await import(`${SRC}engine/indiaProduct.js`)).indiaChapter(chapter.id);
      eq(`${chapter.id}: the curriculum response publishes the engine's requestable levels`, chapter.requestable,
        indiaRequestableDifficulties(engineChapter, { track: spec.indiaTrack, grade: spec.year }));
      ok(`${chapter.id}: requestable levels sit inside the track window`, chapter.requestable.every(d => d >= window.floor && d <= window.ceiling), show(chapter.requestable));
      if (!chapter.requestable.includes(window.ceiling)) gaps.push(`${chapter.id}@${spec.indiaTrack}/${spec.year}`);
      const selections = [{ dp: null, requestable: chapter.requestable, generated: chapter.dotpoints.some(d => d.generated) || !chapter.dotpoints.length }];
      chapter.dotpoints.forEach((d, i) => selections.push({ dp: i, requestable: d.requestable, generated: d.generated }));
      for (const sel of selections) {
        counts.selections++;
        const where = `${chapter.id}${sel.dp == null ? '' : `#${sel.dp}`}`;
        ok(`${where}: the picker's buttons are a subset of what is requestable`, selectableDifficulties(buttons, sel).every(d => sel.requestable.includes(d)));
        for (const asked of [1, 2, 3, 4]) {
          const body = { mode: 'topic', subtopic: chapter.id, track: spec.indiaTrack, dotpoint: sel.dp ?? undefined, difficulty: asked };
          const s = await assertRequest(`${where} D${asked}`, body, asked, sel.requestable);
          // The student presses one of the buttons the refusal offered: that
          // level, and only that level, is then served.
          if (s.error?.code === 'DIFFICULTY_UNAVAILABLE' && asked === 4 && s.error.detail.available.length) {
            const pick = s.error.detail.available[0].difficulty;
            const followed = await serve({ ...body, difficulty: pick });
            counts.alternativesFollowed++;
            if (ok(`${where} D${asked}→D${pick}: an offered alternative is served`, !followed.error, followed.error?.message)) await assertServed(`${where} D${asked}→D${pick}`, followed, pick);
          }
        }
      }
    }
    // Adaptive practice that named no difficulty keeps its reply unchanged.
    for (let i = 0; i < 4; i++) {
      const s = await serve({ mode: 'smart' });
      if (ok('smart practice serves', !s.error, s.error?.message)) {
        ok('smart practice with no difficulty carries no requested/served fields',
          !('difficultyRequested' in s.res) && !('difficultyServed' in s.res), show(Object.keys(s.res)));
        eq('and its label is still the served level', s.res.question.diffLabel, DIFF_LABELS[s.res.question.difficulty]);
      }
    }
  }

  // ── Smart practice that names a level, a task that names one, a resume ────
  section('smart, task and resume');
  {
    const user = (await POST('/profiles', { name: 'Smart', year: 12, course: 'in', indiaTrack: 'jee-advanced' })).user;
    await premium(user.id);
    for (const d of [3, 4]) for (let i = 0; i < 20; i++) {
      const s = await serve({ mode: 'smart', difficulty: d });
      if (ok(`smart practice at D${d} serves`, !s.error, s.error?.message)) await assertServed(`smart D${d}`, s, d);
    }
    for (const d of [1, 2]) {
      const before = await questionRows();
      const s = await serve({ mode: 'smart', difficulty: d });
      ok(`smart practice at D${d} is refused on JEE Advanced`, s.error?.code === 'DIFFICULTY_UNAVAILABLE', s.error?.code || `served D${s.res?.question?.difficulty}`);
      eq(`its alternatives are the track's own levels`, s.error?.detail?.available.map(a => a.difficulty), [3, 4]);
      eq('and nothing was written', await questionRows(), before);
    }
    // An unfinished D3 question is not handed back as the answer to "D4".
    const open = await serve({ mode: 'topic', subtopic: 'c11-complex-numbers', track: 'jee-advanced', dotpoint: 1, difficulty: 3 });
    const resumeSame = await serve({ mode: 'topic', subtopic: 'c11-complex-numbers', track: 'jee-advanced', dotpoint: 1, difficulty: 3, resume: true });
    eq('a resume at the same level returns the unfinished question', resumeSame.res?.question?.id, open.res?.question?.id);
    const resumeOther = await serve({ mode: 'topic', subtopic: 'c11-complex-numbers', track: 'jee-advanced', dotpoint: 1, difficulty: 4, resume: true });
    ok('a resume that names another level is refused, not answered with the D3 question', resumeOther.error?.code === 'DIFFICULTY_UNAVAILABLE', resumeOther.error?.code || resumeOther.res?.question?.id);
    const smartResume = await serve({ mode: 'smart', difficulty: 4, resume: true });
    ok('smart resume at D4 does not return the unfinished D3 question', !smartResume.error && smartResume.res.question.id !== open.res.question.id && smartResume.res.question.difficulty === 4, show(smartResume.error?.code || smartResume.res?.question?.difficulty));
    // A task that names a level the dot point lacks.
    const made = await POST('/tasks', { title: 'Argument at D4', count: 3, targets: [{ chapterId: 'c11-complex-numbers', dotpoint: 1, track: 'jee-advanced', difficulty: 4 }] });
    const taskId = made.task?.id || made.id;
    const before = await questionRows();
    const task = await serve({ taskId });
    ok('a task naming a missing level is refused', task.error?.code === 'DIFFICULTY_UNAVAILABLE', task.error?.code || `served D${task.res?.question?.difficulty}`);
    eq('with the level that exists', task.error?.detail?.available.map(a => a.difficulty), [3]);
    eq('and no row', await questionRows(), before);
    const taskChosen = await serve({ taskId, difficulty: 3 });
    if (ok('the task serves the level the student then chooses', !taskChosen.error, taskChosen.error?.message)) await assertServed('task choice D3', taskChosen, 3);
  }

  // ── The NSW path refuses a requested dot point to an authored form too ──────
  section('nsw dot point');
  {
    const user = (await POST('/profiles', { name: 'Nsw', year: 9 })).user;
    await premium(user.id);
    let checked = 0;
    for (const s9 of CURRICULUM.find(y => y.year === 9).subtopics) {
      for (const dp of dotpointsFor(s9.id)) {
        const missing = [1, 2, 3, 4].filter(d => dp.forms.length && !dp.forms.includes(d));
        if (!missing.length || checked >= 12) continue;
        const asked = missing[0];
        const before = await questionRows();
        const s = await serve({ mode: 'topic', subtopic: s9.id, dotpoint: dp.ordinal, difficulty: asked });
        checked++;
        ok(`${dp.id} D${asked}: refused, not snapped to another level`, s.error?.code === 'DIFFICULTY_UNAVAILABLE', s.error?.code || `served D${s.res?.question?.difficulty}`);
        eq(`${dp.id} D${asked}: the alternatives are the dot point's own forms`, s.error?.detail?.available.map(a => a.difficulty), [...dp.forms].sort((a, b) => a - b));
        eq(`${dp.id} D${asked}: nothing written`, await questionRows(), before);
        const pick = dp.forms[0];
        const followed = await serve({ mode: 'topic', subtopic: s9.id, dotpoint: dp.ordinal, difficulty: pick });
        ok(`${dp.id} D${pick}: a level it has is served at that level`, !followed.error && followed.res.question.difficulty === pick && followed.res.question.diffLabel === DIFF_LABELS[pick], show(followed.error?.code || followed.res?.question?.difficulty));
      }
    }
    ok('NSW dot points with a missing level were exercised', checked > 0, `checked ${checked}`);
  }

  // ── Not vacuous ───────────────────────────────────────────────────────────
  section('coverage');
  ok('the sweep covered every track', counts.cells >= 150, show(counts));
  ok('thousands of requests were examined', counts.requests >= 3000, show(counts));
  ok('served levels were exercised', counts.serves >= 1500, show(counts));
  ok('refusals were exercised', counts.refusals >= 1000, show(counts));
  ok('offered alternatives were followed', counts.alternativesFollowed >= 100, show(counts));

  const total = pass + failures.length;
  console.log(`chapter×track cells ${counts.cells} · selections ${counts.selections} · requests ${counts.requests} · served at the level asked ${counts.serves} · refused as unavailable ${counts.refusals} (of which ${counts.noAlternative} had no other level) · alternatives followed ${counts.alternativesFollowed} · substitutions 0`);
  console.log(`chapter×track cells with no authored form at the track's hardest level: ${gaps.length}/${counts.cells}`);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
    console.log(`\nINDIA DIFFICULTY TRUTH: FAIL — ${pass}/${total} checks`);
    return 1;
  }
  console.log(`INDIA DIFFICULTY TRUTH: PASS — ${pass}/${total} checks`);
  return 0;
}

run().then(code => process.exit(code)).catch(err => {
  console.error(err?.stack || err);
  console.log(`\nINDIA DIFFICULTY TRUTH: FAIL — crashed in "${group}" after ${pass} passing checks`);
  process.exit(1);
});
