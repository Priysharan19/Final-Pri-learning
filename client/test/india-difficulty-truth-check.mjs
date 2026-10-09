// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India difficulty truth (issue #408)
//
// A student who names a difficulty must never be handed a lower-level question
// presented as that level. This suite drives the real POST /practice/next for
// EVERY India chapter × track × dot point (and the chapter as a whole) × every
// difficulty D1–D4 — the buttons the picker offers and the levels only a typed
// or stale link could carry — and asserts, per serve:
//
//   · the question's labelled difficulty is the difficulty its generator really
//     ran at: regenerating (generator, labelled difficulty, seed) reproduces the
//     served prompt, and the label text is the label of that level;
//   · the reply names the level asked for and the level served, so whenever
//     they differ the reply says so explicitly;
//   · a level the picker OFFERS for the selection (`requestable` on
//     GET /curriculum) is always served exactly, and a level it does not offer
//     is never served under that number.
//
// The owner's case is a named regression: Class 12, JEE Advanced, Complex
// Numbers, hardest. Seed 56 at D3 is "principal argument of z = -5 + 5i".
//
// Usage: node client/test/india-difficulty-truth-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

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
  const { dispatch, difficultyDisclosure } = await import(`${SRC}local/backend.js`);
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

  const counts = { cells: 0, selections: 0, serves: 0, offered: 0, notOffered: 0, substituted: 0, refused: 0, ungenerated: 0, outsideWindow: 0 };

  /** Every claim a serve has to satisfy for a request that named `asked`. */
  async function assertServe(label, { res, row }, asked, requestable, window = null) {
    const q = res.question;
    const served = q.difficulty;
    counts.serves++;
    ok(`${label}: the label is the label of the served level`, q.diffLabel === DIFF_LABELS[served], `${show(q.diffLabel)} for difficulty ${show(served)}`);
    ok(`${label}: the stored row agrees with the label`, Number(row.difficulty) === served && (!row.issue || row.issue.difficulty === served), show({ row: row.difficulty, issue: row.issue?.difficulty, served }));
    const again = await regenerated(row, served);
    ok(`${label}: the labelled level is the level the generator ran at`, again.difficulty === served && again.prompt === q.prompt,
      `regenerating at D${served} gave D${again.difficulty} ${show(String(again.prompt).slice(0, 80))}, served ${show(String(q.prompt).slice(0, 80))}`);
    eq(`${label}: the reply names the level asked for`, res.difficultyRequested, asked);
    eq(`${label}: the reply names the level served`, res.difficultyServed, served);
    eq(`${label}: the reply says whether the request was honoured`, res.difficultyHonoured, asked === served);
    if (served !== asked) counts.substituted++;
    if (requestable) {
      if (requestable.includes(asked)) {
        counts.offered++;
        ok(`${label}: a level the picker offers is served exactly`, served === asked, `asked D${asked}, served D${served}`);
      } else {
        counts.notOffered++;
        // The one honest way an un-offered level is served under its own
        // number: the dot point is authored only OUTSIDE the track's window,
        // the student asked for exactly that level, and the reply discloses
        // that the track's depth was not met (`windowed: false`). It is never
        // a level inside the window that the picker merely failed to offer.
        const outside = window && (asked < window.floor || asked > window.ceiling) && res.windowed === false;
        if (served === asked && outside) counts.outsideWindow++;
        ok(`${label}: a level the picker does not offer is never served under that number`, served !== asked || outside, `D${asked} is not requestable yet was served (windowed ${show(res.windowed)})`);
      }
    }
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

    // A stale or typed link can still ask for it: the reply must say so.
    const link = practiceHref({ subtopic: chapter.id, dotpoint: argument, difficulty: 4, track: 'jee-advanced' });
    const body = practiceRequestFromQuery(new URLSearchParams(link.split('?')[1]));
    for (let i = 0; i < 12; i++) {
      const s = await serve(body);
      if (!ok('the hardest request for the argument dot point is answered', !s.error, s.error?.message)) break;
      eq('it is served at D3, the only authored level', s.res.question.difficulty, 3);
      eq('its label is the D3 label, never the D4 label', s.res.question.diffLabel, DIFF_LABELS[3]);
      ok('nothing on the card calls it D4', !/D4|Extension/.test(s.res.question.diffLabel));
      eq('the reply says D4 was asked for', s.res.difficultyRequested, 4);
      eq('the reply says D3 was served', s.res.difficultyServed, 3);
      eq('the reply says the request was not honoured', s.res.difficultyHonoured, false);
      await assertServe('owner link', s, 4, chapter.dotpoints[argument].requestable, { floor: 3, ceiling: 4 });
    }
    // Every dot point and the chapter itself, at the hardest level.
    for (const dp of [null, ...chapter.dotpoints.map((_, i) => i)]) {
      const requestable = dp == null ? chapter.requestable : chapter.dotpoints[dp].requestable;
      const s = await serve({ mode: 'topic', subtopic: chapter.id, track: 'jee-advanced', dotpoint: dp ?? undefined, difficulty: 4 });
      if (ok(`hardest at ${dp == null ? 'chapter level' : `dot point ${dp}`} is answered`, !s.error, s.error?.message)) {
        await assertServe(`hardest · ${dp == null ? 'chapter' : `dp${dp}`}`, s, 4, requestable, { floor: 3, ceiling: 4 });
      }
    }
  }

  // ── The page and the strings that say it ──────────────────────────────────
  section('surface');
  {
    const read = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
    const practice = read('pages/PracticeBase.jsx');
    ok('Practice renders the substitution notice', practice.includes('data-difficulty-substituted') && practice.includes('practice.difficultySubstituted'));
    ok('the notice is rendered before the question card', practice.indexOf('data-difficulty-substituted') < practice.indexOf('<QuestionCard') && practice.indexOf('data-difficulty-substituted') > 0);
    const home = read('pages/Home.jsx');
    ok('Home narrows the difficulty buttons to authored levels', home.includes('selectableDifficulties(trackDifficulties'));
    for (const lang of ['en', 'hi']) {
      const strings = read(`i18n/strings.${lang}.js`);
      for (const key of ['practice.difficultySubstituted', 'practice.difficultySubstitutedDotpoint', 'home.difficultyMissingTopic', 'home.difficultyMissingDotpoint']) {
        ok(`${lang} has ${key}`, strings.includes(`'${key}'`));
      }
    }
    eq('the picker keeps the track levels when a selection publishes none', selectableDifficulties([1, 2, 3], { text: 'x' }), [1, 2, 3]);
    eq('the picker narrows to the published levels', selectableDifficulties([2, 3, 4], { requestable: [3] }), [3]);
    eq('no difficulty asked means nothing disclosed', difficultyDisclosure(null, 3), {});
    eq('an honoured request says so', difficultyDisclosure(3, 3), { difficultyRequested: 3, difficultyServed: 3, difficultyHonoured: true });
    eq('a substituted request says so', difficultyDisclosure('4', 3), { difficultyRequested: 4, difficultyServed: 3, difficultyHonoured: false });
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
          const s = await serve({ mode: 'topic', subtopic: chapter.id, track: spec.indiaTrack, dotpoint: sel.dp ?? undefined, difficulty: asked });
          if (s.error) {
            counts.refused++;
            // An honest refusal is allowed only where nothing is authored at
            // all — and then no level may have been offered for it.
            ok(`${where} D${asked}: a refusal is the honest "nothing authored" one`, s.error.code === 'INDIA_TARGET_UNCOVERED' && !sel.generated && sel.requestable.length === 0,
              `${s.error.code || ''} ${s.error.message}`);
            if (!sel.generated) counts.ungenerated++;
            continue;
          }
          await assertServe(`${where} D${asked}`, s, asked, sel.requestable, window);
        }
      }
    }
    // Adaptive practice that named no difficulty keeps its reply unchanged.
    for (let i = 0; i < 4; i++) {
      const s = await serve({ mode: 'smart' });
      if (ok('smart practice serves', !s.error, s.error?.message)) {
        ok('smart practice with no difficulty carries no requested/served fields',
          !('difficultyRequested' in s.res) && !('difficultyServed' in s.res) && !('difficultyHonoured' in s.res), show(Object.keys(s.res)));
        eq('and its label is still the served level', s.res.question.diffLabel, DIFF_LABELS[s.res.question.difficulty]);
      }
    }
  }

  // ── The NSW path snaps a requested dot point to an authored form too ──────
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
        const s = await serve({ mode: 'topic', subtopic: s9.id, dotpoint: dp.ordinal, difficulty: asked });
        if (s.error) continue;
        checked++;
        eq(`${dp.id} D${asked}: the reply names the level asked for`, s.res.difficultyRequested, asked);
        eq(`${dp.id} D${asked}: the reply names the level served`, s.res.difficultyServed, s.res.question.difficulty);
        eq(`${dp.id} D${asked}: the label is the served level`, s.res.question.diffLabel, DIFF_LABELS[s.res.question.difficulty]);
        eq(`${dp.id} D${asked}: honoured only when the levels agree`, s.res.difficultyHonoured, asked === s.res.question.difficulty);
      }
    }
    ok('NSW dot points with a missing level were exercised', checked > 0, `checked ${checked}`);
  }

  // ── Not vacuous ───────────────────────────────────────────────────────────
  section('coverage');
  ok('the sweep covered every track', counts.cells >= 150, show(counts));
  ok('thousands of serves were examined', counts.serves >= 3000, show(counts));
  ok('offered levels were exercised', counts.offered >= 1000, show(counts));
  ok('levels that are not offered were exercised', counts.notOffered >= 500, show(counts));
  ok('substitutions were actually observed and disclosed', counts.substituted >= 500, show(counts));

  const total = pass + failures.length;
  console.log(`chapter×track cells ${counts.cells} · selections ${counts.selections} · serves examined ${counts.serves} · offered-level serves ${counts.offered} · not-offered-level serves ${counts.notOffered} · disclosed substitutions ${counts.substituted} · out-of-window dot points served at their own disclosed level ${counts.outsideWindow} · honest refusals ${counts.refused}`);
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
