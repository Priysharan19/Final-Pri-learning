// Pri Learning · one entry per syllabus topic (Prithagoras)
//
// A `<id>-forms` generator holds extra question forms for the same syllabus topic as `<id>`. The student sees ONE topic:
//
//   NAMES      no catalogue name carries "Original Forms"; a companion reads as its base;
//   ONE ENTRY  every chooser list a Prithagoras student reaches (Years 11 and 12, Advanced and Extension 1) names a topic
//              once; no two entries share a display name;
//   MIX        practising an entry draws BOTH generators, in proportion to their authored forms, and nothing outside
//              the pair, from a seed (2,400+ draws per entry and level);
//   DOT POINTS the entry lists the base's dot points then the companion's, each under its own id; a named dot point
//              is issued by its own generator; an old link naming the companion lands on the same dot point;
//   OLD ROWS   attempts and ratings recorded under the companion count under the entry, at read time, nothing migrated;
//   SERVER     the server is asked for the generator as before and refuses what it refuses (nsw-offer-check.mjs).
//
// SYNTHETIC: generated questions and a scripted student.
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const authority = await startOnlineAuthority({ label: 'topic-entries', env: { PRI_EDITION: 'prithagoras' } });
{
  const send = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const headers = { ...(init.headers || {}) };
    if ('X-Pri-Edition' in headers) headers['X-Pri-Edition'] = 'prithagoras';
    return send(input, { ...init, headers });
  };
}

const { dispatch } = await import('../src/local/backend.js');
const idb = await import('../src/local/idb.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { SUBTOPICS, SUBTOPIC_BY_ID, scopeForYear, dotpointsFor } = await import('../src/engine/curriculum.js');
const { nswIssuedLevels, nswExactLevels } = await import('../src/engine/nswOffer.js');
const T = await import('../src/engine/curriculum.js');
const { editionOf } = await import('../edition.config.mjs');
const { subtopicOfferedIn } = await import('../src/engine/offeringRules.js');
await loadAllBanks();

const OFFERING = editionOf('prithagoras').offering;
const FORBIDDEN = /original\s+forms/i;
let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const POST = (path, body = {}) => dispatch('POST', path, body);
const GET = path => dispatch('GET', path);
const refusal = async fn => { try { await fn(); return null; } catch (error) { return error; } };
const keyOf = q => { const a = q.answer || {}; switch (q.answerType) {
  case 'mcq': return String(a.correctIndex);
  case 'numeric': return a.canonicalInput || (a.surdForm ? `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})` : a.simplestFraction && a.simplestFraction.d !== 1 ? `${a.simplestFraction.n}/${a.simplestFraction.d}` : String(a.value));
  case 'expression': return a.expr;
  case 'point': return `(${a.x}, ${a.y})`;
  case 'set': return a.values.join(', ');
  case 'ratio': return `${a.a}:${a.b}`;
  default: return null; } };

const PAIRS = T.entryPairs();
let listed = 0, draws = 0, fromBoth = 0;
try {
  // ── PAIRS ────────────────────────────────────────────────────────────────
  ok(`the catalogue has companion pairs (${PAIRS.length})`, PAIRS.length >= 4);
  for (const { base, companion } of PAIRS) {
    ok(`${companion} reads as ${base}`, T.entryIdOf(companion) === base && T.entryIdOf(base) === base && T.companionOf(base) === companion);
    ok(`${companion} shows its base's name`, SUBTOPIC_BY_ID[companion].name === SUBTOPIC_BY_ID[base].name, SUBTOPIC_BY_ID[companion].name);
    ok(`${base} has issued levels behind it`, T.entryIssuedLevels(base).length > 0);
  }

  // ── NAMES AND ONE ENTRY: every list a Prithagoras student reaches ───────────
  ok('no subtopic name in the catalogue says "Original Forms"', SUBTOPICS.every(s => !FORBIDDEN.test(s.name)), SUBTOPICS.filter(s => FORBIDDEN.test(s.name)).map(s => s.name).join(', '));
  const listing = [];
  for (const year of OFFERING.years) for (const pathway of OFFERING.pathways) {
    const scope = scopeForYear(year, pathway);
    const entries = T.collapseList([...scope.own, ...scope.revision].filter(x => subtopicOfferedIn(OFFERING, x.id)));
    listed += entries.length;
    ok(`Year ${year} ${pathway}: no companion id is listed beside its base`, entries.every(s => !(T.baseOfCompanion(s.id) && entries.some(e => e.id === T.baseOfCompanion(s.id)))));
    ok(`Year ${year} ${pathway}: each entry is listed once`, new Set(entries.map(s => s.id)).size === entries.length);
    ok(`Year ${year} ${pathway}: no two entries share a display name`, new Set(entries.map(s => s.name)).size === entries.length, entries.map(s => s.name).filter((n, i, a) => a.indexOf(n) !== i).join(', '));
    ok(`Year ${year} ${pathway}: no entry name says "Original Forms"`, entries.every(s => !FORBIDDEN.test(s.name)));
    for (const { base, companion } of PAIRS) {
      const here = entries.filter(s => s.id === base || s.id === companion);
      if (SUBTOPIC_BY_ID[base].year === year || scope.revision.some(s => s.id === base)) ok(`Year ${year} ${pathway}: ${base} appears once, under ${SUBTOPIC_BY_ID[base].name}`, here.length <= 1 && (here.length === 0 || (here[0].id === base && here[0].name === SUBTOPIC_BY_ID[base].name)));
    }
    for (const e of entries) listing.push({ year, pathway, id: e.id, name: e.name });
  }
  if (process.argv.includes('--list')) console.log(listing.map(e => `Y${e.year} ${e.pathway}\t${e.id}\t${e.name}`).join('\n'));
  ok('the Prithagoras chooser lists the paired topics (Extension 1, Year 12)', PAIRS.every(({ base }) => listing.some(e => e.id === base && e.pathway === 'ext1' && e.year === 12)));
  ok('a companion with no base keeps its own entry and loses the label', (() => {
    const lone = T.collapseList([{ id: 'me12-solo-forms', name: 'Solo', weight: 1 }]);
    return lone.length === 1 && lone[0].id === 'me12-solo-forms';
  })());

  // ── MIX: seeded draws, both sides, nothing else ─────────────────────────────
  for (const { base, companion } of PAIRS) {
    for (const d of [null, ...T.entryIssuedLevels(base)]) {
      const counts = { [base]: 0, [companion]: 0 }, other = [];
      for (let i = 0; i < 2400; i++) {
        const r = T.resolveSide(base, { difficulty: d, seed: (i + 0.5) / 2400 });
        if (r.subtopic in counts) counts[r.subtopic]++; else other.push(r.subtopic);
        draws++;
      }
      ok(`${base} D${d ?? '*'}: 2,400 seeded draws, only the pair`, other.length === 0, other.slice(0, 3).join(','));
      ok(`${base} D${d ?? '*'}: both sides drawn (${counts[base]} / ${counts[companion]})`, counts[base] > 0 && counts[companion] > 0);
      if (counts[base] > 0 && counts[companion] > 0) fromBoth++;
      const lv = d === null ? nswIssuedLevels(base) : [d];
      const w = id => Math.max(1, lv.reduce((n, l) => n + T.formDotpointOrdinals(id, l).length, 0));
      const share = w(companion) / (w(base) + w(companion)), got = counts[companion] / 2400, sigma = Math.sqrt(share * (1 - share) / 2400);
      ok(`${base} D${d ?? '*'}: the mix follows the authored forms (${(got * 100).toFixed(1)}% vs ${(share * 100).toFixed(1)}%)`, Math.abs(got - share) <= 5 * sigma + 0.01);
      const again = Array.from({ length: 50 }, (_, i) => T.resolveSide(base, { difficulty: d, seed: (i + 0.5) / 2400 }).subtopic);
      ok(`${base} D${d ?? '*'}: the same seed draws the same side`, again.every((g, i) => g === T.resolveSide(base, { difficulty: d, seed: (i + 0.5) / 2400 }).subtopic));
    }
  }

  // ── DOT POINTS: ordinals, ids, old links ────────────────────────────────────
  for (const { base, companion } of PAIRS) {
    const list = T.entryDotpoints(base), nb = dotpointsFor(base).length, nc = dotpointsFor(companion).length;
    ok(`${base}: the entry lists the base's dot points then the companion's (${nb}+${nc})`, list.length === nb + nc && list.slice(0, nb).every(dp => dp.subtopic === base) && list.slice(nb).every(dp => dp.subtopic === companion));
    ok(`${base}: every dot point round-trips through its ordinal`, list.every((dp, i) => T.requestOnEntry(base, dp.id).dotpoint === i && T.dotpointOfEntry(base, i) === dp && T.dotpointOfEntry(base, dp.id) === dp));
    ok(`${base}: a named dot point fixes its generator and its own ordinal`, list.every((dp, i) => { const r = T.resolveSide(base, { dotpoint: i, difficulty: 2, seed: 0.5 }); return r.subtopic === dp.subtopic && r.dotpoint === dp.ordinal; }));
    ok(`${base}: an old link (${companion}, ordinal k) lands on the merged ordinal`, dotpointsFor(companion).every((dp, k) => { const r = T.requestOnEntry(companion, k); return r.subtopic === base && r.dotpoint === nb + k && T.dotpointOfEntry(companion, k) === dp; }));
    ok(`${base}: a link naming the base is unchanged`, dotpointsFor(base).every((dp, k) => { const r = T.requestOnEntry(base, k); return r.subtopic === base && r.dotpoint === k; }));
  }
  ok('an entry without a companion is untouched', (() => { const id = 'me12-calc'; return T.entryDotpoints(id).length === dotpointsFor(id).length && T.resolveSide(id, { seed: 0.25 }).subtopic === id && T.requestOnEntry(id, 2).dotpoint === 2; })());

  // ── DIFFERENTIAL: every computation reads each generator exactly as origin/main 4251130bc did ──────────────
  // Scripted learners (base only, companion only, both sides, neither) with ratings, dot point states, live slips, due
  // reviews on the companion generator and attempts. The golden file is this same collection run on 4251130bc.
  {
    const { collect, withoutNames } = await import('./support/topic-entries-differential.mjs');
    const golden = JSON.parse(readFileSync(new URL('./fixtures/topic-entries-main-golden.json', import.meta.url), 'utf8'));
    const now = withoutNames(await collect());
    for (const label of Object.keys(golden)) for (const key of Object.keys(golden[label])) {
      ok(`${label}: ${key} is identical to origin/main`, JSON.stringify(now[label][key]) === JSON.stringify(golden[label][key]));
    }
    ok('the differential is not vacuous: the companion-only learner is dealt reviews on the companion generator', now['companion only'].draws.some(([id, , reason]) => id.endsWith('-forms') && reason === 'review'));
    ok('and the both-sides learner has live slips, due reviews and priorities on both generators', now['both sides'].misconceptions.length >= 4 && now['both sides'].reviewsDue.some(([id]) => id.endsWith('-forms')) && now['both sides'].reviewsDue.some(([id]) => !id.endsWith('-forms')));
    ok('and a paired learner\'s predicted mark differs from an unpaired learner\'s (the evidence is read)', now['both sides'].predicted.mark !== now['neither'].predicted.mark || now['both sides'].predicted.coverage !== now['neither'].predicted.coverage);
    ok('the planner still names the companion generator\'s topic once it is due (plan sessions identical, names aside)', JSON.stringify(now['companion only'].plan) === JSON.stringify(golden['companion only'].plan));
    const names = JSON.stringify(await collect());
    ok('no display name in what the engine returns says "Original Forms"', !/original\s+forms/i.test(names));
  }

  // ── PRESENTATION HELPERS ────────────────────────────────────────────────────
  {
    const { base, companion } = PAIRS[0];
    const opts = T.groupOptionTopics([{ id: base, name: 'A' }, { id: 'y12-diff', name: 'B' }, { id: companion, name: 'A' }]);
    ok('the paper generator lists a pair as one option that selects both generators', opts.length === 2 && JSON.stringify(opts[0].ids) === JSON.stringify([base, companion]));
    ok('a topic with no companion is its own option', opts[1].id === 'y12-diff' && opts[1].ids.length === 1);
    const sessions = [{ id: 1, name: 'A', type: 'review', minutes: 10, done: true }, { id: 2, name: 'A', type: 'review', minutes: 5, done: false }, { id: 3, name: 'A', type: 'learn', minutes: 7 }];
    const one = T.oneSessionPerTopic(sessions);
    ok('one plan session per topic and type, minutes added, done only when both are', one.length === 2 && one[0].minutes === 15 && one[0].done === false);
    ok('a raw generator id is shown as its topic name', T.displayName(companion) === SUBTOPIC_BY_ID[base].name && T.displayName('Plain text') === 'Plain text');
    const grouped = T.mergeRows([{ id: base, name: 'A', attempts: 2, correct: 1, mastery: 40, band: 'x' }, { id: companion, name: 'A', attempts: 6, correct: 5, mastery: 80, band: 'y' }, { id: 'y12-diff', name: 'B', attempts: 1, correct: 1, mastery: 10, band: 'z' }], m => `band${m}`);
    ok('report rows of one name are grouped: counts added, mastery attempt-weighted', grouped.length === 2 && grouped[0].attempts === 8 && grouped[0].correct === 6 && grouped[0].mastery === 70 && grouped[1].band === 'z');
    const { curriculumRows, hscPractiseNext } = await import('../src/engine/hsc/hscPractice.js');
    const row = { id: base, name: 'A', requestable: [1, 2], attempts: 5, correct: 3, evidence: { attempts: 5, correct: 3, independentCorrect: 2 } };
    const rows = curriculumRows({ streams: [{ subtopics: [row] }] });
    const next = hscPractiseNext([{ code: 'ME1-12-01', rank: 1, expected: 0.1, styles: [] }], rows)[0];
    ok('they count its evidence once and name the topic once', next.links.length === 1 && next.evidence.answers === 5 && next.evidence.right === 3);
  }

  // ── THROUGH THE PRODUCT: a Year 12 Extension 1 student on a Prithagoras server ──
  const student = (await POST('/profiles', { name: 'Entries', year: 12, course: 'nsw', pathway: 'ext1' })).user;
  await POST('/profiles/select', { id: student.id });
  await authority.link(student.id, { entitlement: 'premium' });
  const rowsOf = c => [...c.years, ...(c.streams || [])].flatMap(section => section.subtopics);
  const generatorOf = async (got) => (await authority.sealedQuestion((await idb.get('questions', got.question.id)).serverQuestionId)).subtopic;
  const finish = async got => { await POST(`/practice/${got.question.id}/discard`, {}); };

  let curriculum = await GET('/curriculum');
  const rows = rowsOf(curriculum);
  ok('the curriculum reply lists no companion id', rows.every(r => !T.baseOfCompanion(r.id)), rows.filter(r => T.baseOfCompanion(r.id)).map(r => r.id).join(','));
  ok('the curriculum reply lists each id once', new Set(rows.map(r => r.id)).size === rows.length);
  ok('the curriculum reply has no "Original Forms" name', rows.every(r => !FORBIDDEN.test(r.name)));
  // (Per chooser section: Year 11 Advanced and Year 11 Extension 1 each hold their own "Polynomials" and "Rates of Change",
  // two courses' topics, which are not companions and are not this change's to merge.)
  for (const section of [...curriculum.years, ...(curriculum.streams || [])]) {
    const names = section.subtopics.map(r => r.name);
    ok(`${section.title}: no two entries of one name`, new Set(names).size === names.length, names.filter((n, i, a) => a.indexOf(n) !== i).join(', '));
  }
  for (const { base, companion } of PAIRS) {
    const row = rows.find(r => r.id === base);
    ok(`${base}: listed once, with the dot points of both generators`, !!row && row.dotpoints.length === dotpointsFor(base).length + dotpointsFor(companion).length && row.dotpoints.every((dp, i) => dp.id === T.entryDotpoints(base)[i].id));
    ok(`${base}: requestable is what the server issues for either`, JSON.stringify(row?.requestable) === JSON.stringify(T.entryIssuedLevels(base)));
  }

  const asked = new Map();
  for (const { base, companion } of PAIRS) {
    const seen = new Set();
    for (let i = 0; i < 24 && seen.size < 2; i++) {
      authority.resetRateLimits?.();
      const got = await POST('/practice/next', { mode: 'topic', subtopic: base, difficulty: 2 });
      const generator = await generatorOf(got);
      ok(`${base}: a question for the entry comes from the pair (${generator})`, generator === base || generator === companion);
      ok(`${base}: the card names the entry, not the generator`, got.question.subtopic === base && !FORBIDDEN.test(got.question.subtopicName) && got.question.subtopicName === SUBTOPIC_BY_ID[base].name);
      seen.add(generator);
      await finish(got);
    }
    ok(`${base}: practising the entry served both generators through the server`, seen.size === 2, [...seen].join(','));
    asked.set(base, seen);

    // A named dot point is issued by its own generator, whichever side holds it.
    for (const [i, dp] of T.entryDotpoints(base).entries()) {
      const levels = nswExactLevels(dp.subtopic, dp.id).filter(d => nswIssuedLevels(dp.subtopic).includes(d));
      if (!levels.length) continue;
      authority.resetRateLimits?.();
      const got = await POST('/practice/next', { mode: 'topic', subtopic: base, dotpoint: i, difficulty: levels[0] });
      const generator = await generatorOf(got);
      ok(`${base}: dot point ${i} (${dp.id}) is issued by ${dp.subtopic}`, generator === dp.subtopic, generator);
      await finish(got);
    }

    // An old link naming the companion, with the companion's own ordinal, lands on the same dot point.
    authority.resetRateLimits?.();
    const dpC0 = dotpointsFor(companion).find(dp => nswExactLevels(companion, dp.id).some(d => nswIssuedLevels(companion).includes(d)));
    // (A companion none of whose dot points has a level of its own questions has no dot point to link to: nothing to check.)
    if (dpC0) {
      const dpC = dotpointsFor(companion).find(dp => nswExactLevels(companion, dp.id).some(d => nswIssuedLevels(companion).includes(d)));
      const viaOld = await POST('/practice/next', { mode: 'topic', subtopic: companion, dotpoint: dpC.ordinal, difficulty: nswExactLevels(companion, dpC.id).find(d => nswIssuedLevels(companion).includes(d)) });
      ok(`${companion}: an old link (dot point ${dpC.ordinal}) is issued by the companion and shown under ${base}`, await generatorOf(viaOld) === companion && viaOld.question.subtopic === base);
      await finish(viaOld);
    }
  }

  // ── OLD ROWS: attempts recorded under the companion count under the entry ───────
  {
    const { base, companion } = PAIRS[1];
    let got = null, generator = null;
    for (let i = 0; i < 60 && generator !== companion; i++) {
      authority.resetRateLimits?.();
      if (got) await finish(got);
      got = await POST('/practice/next', { mode: 'topic', subtopic: base, difficulty: 2 });
      generator = await generatorOf(got);
    }
    ok(`${base}: a question from the companion generator was drawn`, generator === companion);
    const sealed = await authority.sealedQuestion((await idb.get('questions', got.question.id)).serverQuestionId);
    const key = keyOf(sealed);
    let res = null;
    if (key != null) await refusal(async () => { res = await POST(`/practice/${got.question.id}/submit`, { answer: key, submissionId: nextSubmissionId('topic_entries') }); });
    ok(`${base}: the companion's question was answered and marked by the server`, res?.correct === true);
    const stored = (await idb.all('attempts')).filter(a => a.questionId === got.question.id);
    ok(`${base}: the attempt is stored under the companion id, as before`, stored.length === 1 && stored[0].subtopic === companion, stored.map(a => a.subtopic).join(','));
    const ratingRows = (await idb.all('ratings')).filter(r => r.pid === student.id);
    ok(`${base}: the rating row is stored under the companion id, as before`, ratingRows.some(r => r.subtopic === companion) && !ratingRows.some(r => r.subtopic === base && r.attempts));

    curriculum = await GET('/curriculum');
    const row = rowsOf(curriculum).find(r => r.id === base);
    ok(`${base}: the entry's row counts the companion's attempt`, row.attempts === 1 && row.correct === 1 && row.evidence.attempts === 1, JSON.stringify({ a: row.attempts, c: row.correct, e: row.evidence }));
    const dpRow = row.dotpoints.find(dp => dp.attempts > 0);
    ok(`${base}: and the dot point it credited, under the companion's dot point id`, !!dpRow && dpRow.id.startsWith(`${companion}.`), JSON.stringify(row.dotpoints.map(d => [d.id, d.attempts])));

    const evidence = await GET('/progress/evidence');
    const topicIds = (evidence.topics || []).map(t => t.id);
    ok(`${base}: progress evidence reads the attempt under the entry`, topicIds.includes(base) && !topicIds.includes(companion), topicIds.join(','));

    const hist = await POST('/history/list', { filter: 'all' });
    const item = hist.items.find(x => x.id === got.question.id);
    ok(`${base}: history lists the question under the entry, named without "Original Forms"`, item?.subtopic === base && item.subtopicName === SUBTOPIC_BY_ID[base].name);
    const byBase = await POST('/history/list', { filter: 'all', subtopic: base }), byOld = await POST('/history/list', { filter: 'all', subtopic: companion });
    ok(`${base}: the history topic filter finds it by either id`, byBase.items.some(x => x.id === got.question.id) && byOld.items.some(x => x.id === got.question.id));

    const stats = await GET('/stats');
    ok(`${base}: recent attempts name the entry`, stats.recent.some(r => T.entryIdOf(r.subtopic) === base && r.name === SUBTOPIC_BY_ID[base].name) && stats.recent.every(r => !FORBIDDEN.test(r.name)));
    const report = await GET('/report');
    const names = report.subtopics.map(r => r.name);
    ok('the report lists each topic once and never "Original Forms"', new Set(names).size === names.length && names.every(n => !FORBIDDEN.test(n)), names.filter((n, i, a) => a.indexOf(n) !== i).join(','));
    ok(`${base}: the report row counts the companion's attempt`, report.subtopics.find(r => r.name === SUBTOPIC_BY_ID[base].name)?.attempts === 1);
    const prio = stats.priorities.map(p => p.name || p.subtopic);
    ok('the priorities never name a topic twice', new Set(stats.priorities.map(p => p.subtopic)).size === stats.priorities.length, prio.join(','));
  }

  // Smart practice names a topic once and the server issues from one of its generators.
  {
    const kinds = new Set();
    for (let i = 0; i < 8; i++) {
      authority.resetRateLimits?.();
      const got = await POST('/practice/next', { mode: 'smart' });
      kinds.add(got.question.subtopic);
      ok('smart practice: the card never names a companion id', !T.baseOfCompanion(got.question.subtopic));
      await finish(got);
    }
    ok('smart practice served something', kinds.size > 0);
  }
} catch (err) {
  failures.push(`the suite stopped: ${err.stack || err.message}`);
} finally {
  await authority.close();
}

const total = pass + failures.length;
if (failures.length) {
  console.log(`TOPIC ENTRIES: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`);
  process.exit(1);
}
console.log(`TOPIC ENTRIES: PASS — ${pass}/${total} checks — ${PAIRS.length} paired topics each listed once under the base name across ${listed} chooser entries; ${draws} seeded draws (${fromBoth} entry-level mixes drew both sides, none drew outside the pair); old companion rows count under the entry. [SYNTHETIC]`);
