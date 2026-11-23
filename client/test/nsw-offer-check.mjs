// Pri Learning · NSW practice offers only what the server can issue (Prithagoras)
//
// A Prithagoras server issues a (subtopic, difficulty) cell only when it passed
// every gate (server/platform/nswBanks.js). The app used to offer every form
// the engine holds, so a student who picked a cell the server does not issue —
// y10-compound, y10-quadratics at D4, y10-similarity at D3 (all since fixed at the source and issued;
// the suite now names cells that are still held back) — was handed a local draft nothing could ever mark. This suite boots the shipped server as
// Prithagoras and drives the product's own dispatcher against it:
//
//   ONE TRUTH    the device's copy of the issued cells equals the server's
//                ledger, and the server's /v1/curriculum publishes the same
//                `requestable` levels per subtopic and dot point;
//   OFFERED ⇒ ISSUED AND MARKED
//                for every profile shape (Years 7–12, every pathway), every
//                subtopic and difficulty the app's curriculum marks selectable
//                is asked for through the product, issued by the server (never
//                a draft), and the server's own stored answer is marked
//                correct by the server;
//   NOT ISSUED ⇒ NEVER OFFERED
//                no curriculum reply lists an unissued cell; asking for one by
//                name is refused with the levels that exist (or "no questions
//                for this topic"), writes no question row, and never becomes a
//                draft; smart practice never lands on one.
//
// SYNTHETIC: generated questions and a scripted student.
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const authority = await startOnlineAuthority({ label: 'nsw-offer', env: { PRI_EDITION: 'prithagoras' } });
// A Node suite's client is the default build (Priyabhata): edition-record.js is
// replaced per edition only by a Vite build. This suite stands in for the
// Prithagoras BUILD by declaring that edition on every request, which is all
// the server reads of it (server/platform/edition.js refuseOtherEdition). The
// course, the curriculum reply, the selectors and the request path under test
// are the product's own and do not depend on the build's edition.
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
const { NSW_ISSUED_CELLS } = await import('../src/engine/nswIssuedCells.js');
const { nswIssuedLevels, nswCellIssued, nswOfferedCell } = await import('../src/engine/nswOffer.js');
// A `-forms` companion is listed under its base: a topic row is an ENTRY whose levels, dot points and questions come
// from every generator behind it (engine/curriculum.js); the cells below are still asked for generator by generator.
const { sidesOf, entryIssuedLevels } = await import('../src/engine/curriculum.js');
const { SUBTOPICS, dotpointsFor } = await import('../src/engine/curriculum.js');
const { selectableDifficulties, topicAvailability, practiceTargetAvailable } = await import('../src/engine/curriculumAvailability.js');
const { pickNext } = await import('../src/engine/adaptive.js');
const { NSW_BANK_LEDGER, nswCell, nswCurriculumResponse } = await import('../../server/platform/nswBanks.js');
const { render } = await import('../../tools/nsw-issued-cells.mjs');
const { readFileSync } = await import('node:fs');
// Owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12, Advanced and Extension 1 only. The whole
// catalogue is still listed, agreed with the server's ledger and kept generable below ("CATALOGUE"); only the
// OFFERED part is asked for through the product, and a Prithagoras server refuses the hidden part by name.
const { editionOf } = await import('../edition.config.mjs');
const { subtopicOfferedIn } = await import('../src/engine/offeringRules.js');
const OFFERING = editionOf('prithagoras').offering;
const offeredNow = id => subtopicOfferedIn(OFFERING, id);
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const POST = (path, body = {}) => dispatch('POST', path, body);
const GET = path => dispatch('GET', path);
const LEVELS = [1, 2, 3, 4];
const refusal = async fn => { try { await fn(); return null; } catch (error) { return error; } };
const keyOf = q => { const a = q.answer || {}; switch (q.answerType) {
  case 'mcq': return String(a.correctIndex);
  case 'numeric': return a.canonicalInput || (a.surdForm ? `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})` : a.simplestFraction && a.simplestFraction.d !== 1 ? `${a.simplestFraction.n}/${a.simplestFraction.d}` : String(a.value));
  case 'expression': return a.expr;
  case 'point': return `(${a.x}, ${a.y})`;
  case 'set': return a.values.join(', ');
  case 'ratio': return `${a.a}:${a.b}`;
  default: return null; } };

let offeredCells = 0, marked = 0, unissuedAsked = 0, hiddenRefused = 0, catalogueGenerated = 0;
try {
  // ── ONE TRUTH ──────────────────────────────────────────────────────────────
  const ledger = Object.fromEntries(NSW_BANK_LEDGER.filter(e => e.issued).map(e => [e.generator, e.cells.filter(c => c.issued).map(c => c.difficulty)]));
  same('the device copy of the issued cells equals the server ledger', NSW_ISSUED_CELLS, ledger);
  ok('and is the generated file, byte for byte', readFileSync(new URL('../src/engine/nswIssuedCells.js', import.meta.url), 'utf8') === render(), 'run node tools/nsw-issued-cells.mjs');
  const served = nswCurriculumResponse().subtopics;
  same('the server publishes exactly those levels as each subtopic\'s requestable', Object.fromEntries(Object.entries(served).map(([id, s]) => [id, s.requestable])), ledger);
  const allNsw = SUBTOPICS.map(s => s.id);
  ok('every NSW subtopic and level agrees between device and server', allNsw.every(id => LEVELS.every(d => nswCellIssued(id, d) === nswCell(id, d))));
  ok('and every dot point\'s requestable is its own forms the server issues',
    Object.entries(served).every(([id, s]) => dotpointsFor(id).every(dp => JSON.stringify(s.dotpoints[dp.id].requestable) === JSON.stringify(dp.forms.filter(d => nswCell(id, d))))));
  const unissued = allNsw.flatMap(id => LEVELS.filter(d => !nswCell(id, d)).map(d => ({ id, d })));
  // 69 chapter cells were held back when this was written (> 30); fixing the tolerance and wording defects behind
  // the quality-gate exclusions issued most of them, so the bar is the count that remains plus a margin, not a
  // lower aim: the suite still asks for every one of them and needs real ones to ask for.
  ok(`there are unissued cells to keep out (${unissued.length})`, unissued.length >= 2);
  for (const [id, d] of [['y8-equations', 1], ['y8-linear', 4]]) ok(`${id} D${d} is not issued`, !nswCell(id, d) && !nswCellIssued(id, d));

  // ── The cell a request may name (pure) ─────────────────────────────────────
  ok('a request never names an unissued cell', allNsw.every(id => LEVELS.every(d => { const c = nswOfferedCell({ generator: id, difficulty: d }); return c === null ? nswIssuedLevels(id).length === 0 : nswCell(id, c.difficulty); })));
  ok('with a dot point either', allNsw.every(id => dotpointsFor(id).every(dp => LEVELS.every(d => { const c = nswOfferedCell({ generator: id, difficulty: d, dotpoint: dp.id, dotpointForms: dp.forms }); return c === null || (nswCell(id, c.difficulty) && (c.dotpoint === null || dp.forms.includes(c.difficulty))); }))));
  same('an issued cell is left as asked', nswOfferedCell({ generator: 'y8-linear', difficulty: 2 }), { difficulty: 2, dotpoint: null, moved: false });
  same('an unissued level moves to the nearest issued one', nswOfferedCell({ generator: 'y8-linear', difficulty: 4 }), { difficulty: 3, dotpoint: null, moved: true });
  same('a generator the server issues nothing from has no cell', nswOfferedCell({ generator: 'y8-not-a-chapter', difficulty: 2 }), null);
  for (const [year, pathway] of [[7], [8], [9], [10], [11, 'standard'], [11, 'advanced'], [11, 'ext1'], [12, 'standard'], [12, 'advanced'], [12, 'ext1'], [12, 'ext2']]) {
    for (let i = 0; i < 60; i++) {
      const pick = pickNext({ ratings: {}, reviewsDue: [], year, pathway, rand: (i + 0.5) / 60, recent: [], offered: id => nswIssuedLevels(id).length > 0 });
      if (pick && !nswIssuedLevels(pick.subtopic).length) { failures.push(`smart practice picked unissued ${pick.subtopic} for Year ${year} ${pathway || ''}`); break; }
    }
  }
  ok('smart practice picks only among issued subtopics', true);

  // ── Through the product, against a Prithagoras server ──────────────────────
  const SHAPES = [[7], [8], [9], [10], [11, 'standard'], [11, 'advanced'], [11, 'ext1'], [12, 'standard'], [12, 'advanced'], [12, 'ext1'], [12, 'ext2']];
  const done = new Set();
  for (const [year, pathway] of SHAPES) {
    const tag = `Year ${year}${pathway ? ` ${pathway}` : ''}`;
    const student = (await POST('/profiles', { name: `S${year}${pathway || ''}`, year, course: 'nsw', ...(pathway ? { pathway } : {}) })).user;
    await POST('/profiles/select', { id: student.id });
    await authority.link(student.id, { entitlement: 'premium' });   // past the free daily cap: this suite asks for every cell
    const curriculum = await GET('/curriculum');
    const subtopics = [...curriculum.years, ...(curriculum.streams || [])].flatMap(section => section.subtopics);
    ok(`${tag}: the curriculum lists subtopics`, subtopics.length > 0);
    let agree = true, offeredUnissued = [];
    for (const s of subtopics) {
      const issued = entryIssuedLevels(s.id);
      const servedUnion = [...new Set(sidesOf(s.id).flatMap(g => served[g]?.requestable || []))].sort((a, b) => a - b);
      if (JSON.stringify(s.requestable) !== JSON.stringify(issued) || JSON.stringify(s.requestable) !== JSON.stringify(servedUnion)) agree = false;
      if (JSON.stringify(selectableDifficulties(LEVELS, s)) !== JSON.stringify(issued)) agree = false;
      if (topicAvailability(s).selectable !== s.dotpoints.some(dp => dp.requestable.length > 0)) agree = false;
      for (const [i, dp] of s.dotpoints.entries()) {
        if (dp.generated !== dp.requestable.length > 0 || JSON.stringify(dp.difficulties) !== JSON.stringify(dp.requestable)) agree = false;
        if (practiceTargetAvailable(s, i) !== dp.generated) agree = false;
        for (const d of [...dp.requestable, ...dp.difficulties, ...selectableDifficulties(LEVELS, dp)]) if (!nswCell(dp.id.slice(0, dp.id.lastIndexOf('.')), d)) offeredUnissued.push(`${dp.id} D${d}`);
      }
      for (const d of s.requestable) if (!sidesOf(s.id).some(g => nswCell(g, d))) offeredUnissued.push(`${s.id} D${d}`);
    }
    ok(`${tag}: every subtopic's and dot point's selectable levels are exactly the server's`, agree);
    same(`${tag}: no unissued cell is offered`, offeredUnissued, []);

    // OFFERED ⇒ ISSUED AND MARKED: every selectable cell, once across the suite.
    // Every GENERATOR cell, as before: a topic with a companion is asked for until the draw lands on the generator
    // under test (bounded: each side has at least one authored form, so a miss ten times running is a defect).
    for (const s of subtopics) for (const g of sidesOf(s.id)) for (const d of nswIssuedLevels(g)) {
      if (!offeredNow(s.id)) continue;          // hidden: see HIDDEN ⇒ REFUSED
      if (done.has(`${g}|${d}`)) continue;
      done.add(`${g}|${d}`);
      offeredCells++;
      authority.resetRateLimits?.();
      let got = null, row = null, sealed = null;
      const failed = await refusal(async () => {
        // A form answered by its working is passed over by the server; ask again if a seed lands oddly.
        for (let tries = 0; tries < 40; tries++) {
          got = await POST('/practice/next', { mode: 'topic', subtopic: s.id, difficulty: d });
          row = await idb.get('questions', got.question.id);
          sealed = await authority.sealedQuestion(row.serverQuestionId);
          if (sealed.subtopic === g) break;
          await POST(`/practice/${got.question.id}/discard`, {}).catch(() => {});
        }
      });
      if (failed || got.question.checkState !== 'issued' || row.draftOnly || sealed.subtopic !== g || sealed.difficulty !== d) {
        failures.push(`${s.id} D${d} is offered but was not issued as asked: ${failed ? `${failed.code || ''} ${failed.message}` : `${got.question.checkState} ${sealed?.subtopic} D${sealed?.difficulty}`}`);
        continue;
      }
      const key = keyOf(sealed);
      const res = key == null ? null : await refusal(async () => { sealed.res = await POST(`/practice/${got.question.id}/submit`, { answer: key, submissionId: nextSubmissionId('nsw_offer') }); });
      if (key == null || res || sealed.res?.correct !== true) failures.push(`${s.id} D${d}: the issued question is not marked correct on its stored answer ${JSON.stringify(key)}: ${res ? res.message : JSON.stringify({ correct: sealed.res?.correct, feedback: sealed.res?.feedback })}`);
      else marked++;
    }

    // HIDDEN ⇒ REFUSED (owner decision, 19 Nov 2026): a Prithagoras server refuses a subtopic of a year or course it does
    // not offer, by name, with a clear code, before anything is issued, escrowed or counted.
    for (const s of subtopics) for (const d of s.requestable) {
      if (offeredNow(s.id) || done.has(`h${s.id}|${d}`)) continue;
      done.add(`h${s.id}|${d}`);
      hiddenRefused++;
      authority.resetRateLimits?.();
      const before = (await idb.all('questions')).length;
      const error = await refusal(() => POST('/practice/next', { mode: 'topic', subtopic: s.id, difficulty: d }));
      if (error?.code !== 'COURSE_NOT_OFFERED') failures.push(`${s.id} D${d} is hidden but asking for it gave ${error ? error.code : 'a question'}, not COURSE_NOT_OFFERED`);
      if ((await idb.all('questions')).length !== before) failures.push(`${s.id} D${d}: a refused hidden request left a question row`);
    }

    // NOT ISSUED ⇒ NEVER SERVED: asking by name is refused and leaves nothing behind.
    for (const s of subtopics) for (const d of LEVELS) {
      if (nswCell(s.id, d) || done.has(`x${s.id}|${d}`)) continue;
      done.add(`x${s.id}|${d}`);
      unissuedAsked++;
      authority.resetRateLimits?.();
      const before = (await idb.all('questions')).length;
      const issuesBefore = authority.traffic.issue + authority.traffic.prepare;
      const error = await refusal(() => POST('/practice/next', { mode: 'topic', subtopic: s.id, difficulty: d }));
      const expected = nswIssuedLevels(s.id).length ? 'DIFFICULTY_UNAVAILABLE' : 'PRACTICE_NOT_OFFERED';
      if (error?.code !== expected) failures.push(`${s.id} D${d} is not issued but asking for it gave ${error ? error.code : 'a question'}, not ${expected}`);
      else if (expected === 'DIFFICULTY_UNAVAILABLE' && JSON.stringify(error.detail.available.map(a => a.difficulty)) !== JSON.stringify(nswIssuedLevels(s.id).filter(x => x !== d))) failures.push(`${s.id} D${d}: the refusal does not list the issued levels`);
      if ((await idb.all('questions')).length !== before) failures.push(`${s.id} D${d}: a refused request left a question row (a draft)`);
      if (authority.traffic.issue + authority.traffic.prepare !== issuesBefore) failures.push(`${s.id} D${d}: a refused request still reached the server`);
    }

    // Smart practice, and a topic with no level named, only ever issue.
    authority.resetRateLimits?.();
    // (Only where every subtopic in scope is offered: this Node suite's client is the default build, which does not
    // hide a year the way a Prithagoras build does, so the revision year below Year 11 would name a hidden subtopic.)
    if (year === 12 && pathway && OFFERING.pathways.includes(pathway)) {
      const smart = [];
      for (let i = 0; i < 6; i++) smart.push((await POST('/practice/next', { mode: 'smart' })).question);
      ok(`${tag}: smart practice is always issued, never a draft`, smart.every(q => q.checkState === 'issued' && nswCell(q.subtopic, q.difficulty)), smart.map(q => `${q.subtopic} D${q.difficulty} ${q.checkState}`).join(', '));
    }
  }
  ok(`every OFFERED cell was asked for (${offeredCells}) and they are all the server's cells`, offeredCells === Object.entries(ledger).filter(([id]) => offeredNow(id)).reduce((n, [, l]) => n + l.length, 0), `${offeredCells}`);
  ok(`every HIDDEN cell, asked for by name, was refused with COURSE_NOT_OFFERED (${hiddenRefused})`, hiddenRefused === Object.entries(ledger).filter(([id]) => !offeredNow(id)).reduce((n, [, l]) => n + l.length, 0), `${hiddenRefused}`);

  // ── CATALOGUE: hidden content stays whole (it is hidden, not deleted) ──────
  // Every issued cell of the catalogue, offered or hidden, still generates a question with an answer key, so hidden
  // content cannot rot while it waits to be offered. (Not "offered": nothing here is shown to a student.)
  const { generateQuestion } = await import('../src/engine/generators/index.js');
  for (const [id, levels] of Object.entries(ledger)) for (const d of levels) {
    const q = generateQuestion(id, d, 7);
    if (!q || !q.answer || !q.prompt) failures.push(`catalogue: ${id} D${d} no longer generates a question with an answer`);
    else catalogueGenerated++;
  }
  ok(`catalogue: every issued cell generates, hidden ones included (${catalogueGenerated})`, catalogueGenerated === Object.values(ledger).reduce((n, l) => n + l.length, 0));
  ok('catalogue: the hidden part is real (Years 7 to 10, Standard and Extension 2 still hold issued cells)', Object.keys(ledger).some(id => !offeredNow(id)));
  ok(`every one was issued and marked correct on its stored answer (${marked})`, marked === offeredCells);
  ok(`every unissued cell in scope was asked for and refused (${unissuedAsked})`, unissuedAsked >= 2);

  // An unlevelled request on a topic whose aimed level is not issued is moved, not drafted.
  const y11 = (await POST('/profiles', { name: 'Moved', year: 11, course: 'nsw', pathway: 'ext1' })).user;
  await POST('/profiles/select', { id: y11.id });
  await authority.link(y11.id);
  // Every NSW chapter now serves a question at some level, so there may be no chapter the server
  // issues nothing from; when one exists again (a chapter whose cells are all held back) it must be
  // refused even with no level named. Until then the rule has nothing to refuse and says so.
  const emptyTopic = allNsw.find(id => nswIssuedLevels(id).length === 0);
  if (emptyTopic) {
    const noTopic = await refusal(() => POST('/practice/next', { mode: 'topic', subtopic: emptyTopic }));
    same('a topic the server issues nothing from is refused even with no level named', noTopic?.code, 'PRACTICE_NOT_OFFERED');
  } else ok('no NSW chapter is without an issued level, so there is none to refuse', true);
} catch (err) {
  failures.push(`the suite stopped: ${err.stack || err.message}`);
} finally {
  await authority.close();
}

const total = pass + failures.length;
if (failures.length) {
  console.log(`NSW OFFER: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`);
  process.exit(1);
}
console.log(`NSW OFFER: PASS — ${pass}/${total} checks — ${offeredCells} offered cells issued and marked by a Prithagoras server, ${hiddenRefused} hidden cells refused, ${catalogueGenerated} catalogue cells generated, ${unissuedAsked} unissued cells refused with no draft; the app offers exactly the server's issued cells. [SYNTHETIC]`);
