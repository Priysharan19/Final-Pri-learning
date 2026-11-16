// Pri Learning · NSW practice offers only what the server can issue (Prithagoras)
//
// A Prithagoras server issues a (subtopic, difficulty) cell only when it passed
// every gate (server/platform/nswBanks.js). The app used to offer every form
// the engine holds, so a student who picked a cell the server does not issue —
// y10-compound, y10-quadratics at D4, y10-similarity at D3 — was handed a local
// draft nothing could ever mark. This suite boots the shipped server as
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
const { SUBTOPICS, dotpointsFor } = await import('../src/engine/curriculum.js');
const { selectableDifficulties, topicAvailability, practiceTargetAvailable } = await import('../src/engine/curriculumAvailability.js');
const { pickNext } = await import('../src/engine/adaptive.js');
const { NSW_BANK_LEDGER, nswCell, nswCurriculumResponse } = await import('../../server/platform/nswBanks.js');
const { render } = await import('../../tools/nsw-issued-cells.mjs');
const { readFileSync } = await import('node:fs');
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

let offeredCells = 0, marked = 0, unissuedAsked = 0;
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
  ok(`there are unissued cells to keep out (${unissued.length})`, unissued.length > 30);
  for (const [id, d] of [['y10-compound', 1], ['y10-compound', 4], ['y10-quadratics', 4], ['y10-similarity', 3]]) ok(`${id} D${d} is not issued`, !nswCell(id, d) && !nswCellIssued(id, d));

  // ── The cell a request may name (pure) ─────────────────────────────────────
  ok('a request never names an unissued cell', allNsw.every(id => LEVELS.every(d => { const c = nswOfferedCell({ generator: id, difficulty: d }); return c === null ? nswIssuedLevels(id).length === 0 : nswCell(id, c.difficulty); })));
  ok('with a dot point either', allNsw.every(id => dotpointsFor(id).every(dp => LEVELS.every(d => { const c = nswOfferedCell({ generator: id, difficulty: d, dotpoint: dp.id, dotpointForms: dp.forms }); return c === null || (nswCell(id, c.difficulty) && (c.dotpoint === null || dp.forms.includes(c.difficulty))); }))));
  same('an issued cell is left as asked', nswOfferedCell({ generator: 'y10-quadratics', difficulty: 2 }), { difficulty: 2, dotpoint: null, moved: false });
  same('an unissued level moves to the nearest issued one', nswOfferedCell({ generator: 'y10-quadratics', difficulty: 4 }), { difficulty: 3, dotpoint: null, moved: true });
  same('a generator the server issues nothing from has no cell', nswOfferedCell({ generator: 'y10-compound', difficulty: 2 }), null);
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
      const issued = [...nswIssuedLevels(s.id)];
      if (JSON.stringify(s.requestable) !== JSON.stringify(issued) || JSON.stringify(s.requestable) !== JSON.stringify(served[s.id]?.requestable || [])) agree = false;
      if (JSON.stringify(selectableDifficulties(LEVELS, s)) !== JSON.stringify(issued)) agree = false;
      if (topicAvailability(s).selectable !== s.dotpoints.some(dp => dp.requestable.length > 0)) agree = false;
      for (const [i, dp] of s.dotpoints.entries()) {
        if (dp.generated !== dp.requestable.length > 0 || JSON.stringify(dp.difficulties) !== JSON.stringify(dp.requestable)) agree = false;
        if (practiceTargetAvailable(s, i) !== dp.generated) agree = false;
        for (const d of [...dp.requestable, ...dp.difficulties, ...selectableDifficulties(LEVELS, dp)]) if (!nswCell(s.id, d)) offeredUnissued.push(`${dp.id} D${d}`);
      }
      for (const d of s.requestable) if (!nswCell(s.id, d)) offeredUnissued.push(`${s.id} D${d}`);
    }
    ok(`${tag}: every subtopic's and dot point's selectable levels are exactly the server's`, agree);
    same(`${tag}: no unissued cell is offered`, offeredUnissued, []);

    // OFFERED ⇒ ISSUED AND MARKED: every selectable cell, once across the suite.
    for (const s of subtopics) for (const d of s.requestable) {
      if (done.has(`${s.id}|${d}`)) continue;
      done.add(`${s.id}|${d}`);
      offeredCells++;
      authority.resetRateLimits?.();
      let got = null, row = null, sealed = null;
      const failed = await refusal(async () => {
        // A form answered by its working is passed over by the server; ask again if a seed lands oddly.
        got = await POST('/practice/next', { mode: 'topic', subtopic: s.id, difficulty: d });
        row = await idb.get('questions', got.question.id);
        sealed = await authority.sealedQuestion(row.serverQuestionId);
      });
      if (failed || got.question.checkState !== 'issued' || row.draftOnly || sealed.subtopic !== s.id || sealed.difficulty !== d) {
        failures.push(`${s.id} D${d} is offered but was not issued as asked: ${failed ? `${failed.code || ''} ${failed.message}` : `${got.question.checkState} ${sealed?.subtopic} D${sealed?.difficulty}`}`);
        continue;
      }
      const key = keyOf(sealed);
      const res = key == null ? null : await refusal(async () => { sealed.res = await POST(`/practice/${got.question.id}/submit`, { answer: key, submissionId: nextSubmissionId('nsw_offer') }); });
      if (key == null || res || sealed.res?.correct !== true) failures.push(`${s.id} D${d}: the issued question is not marked correct on its stored answer ${JSON.stringify(key)}: ${res ? res.message : JSON.stringify({ correct: sealed.res?.correct, feedback: sealed.res?.feedback })}`);
      else marked++;
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
    const smart = [];
    for (let i = 0; i < 6; i++) smart.push((await POST('/practice/next', { mode: 'smart' })).question);
    ok(`${tag}: smart practice is always issued, never a draft`, smart.every(q => q.checkState === 'issued' && nswCell(q.subtopic, q.difficulty)), smart.map(q => `${q.subtopic} D${q.difficulty} ${q.checkState}`).join(', '));
  }
  ok(`every offered cell was asked for (${offeredCells}) and they are all the server's cells`, offeredCells === Object.values(ledger).reduce((n, l) => n + l.length, 0), `${offeredCells}`);
  ok(`every one was issued and marked correct on its stored answer (${marked})`, marked === offeredCells);
  ok(`every unissued cell in scope was asked for and refused (${unissuedAsked})`, unissuedAsked > 30);

  // An unlevelled request on a topic whose aimed level is not issued is moved, not drafted.
  const y10 = (await POST('/profiles', { name: 'Moved', year: 10, course: 'nsw' })).user;
  await POST('/profiles/select', { id: y10.id });
  await authority.link(y10.id);
  const noTopic = await refusal(() => POST('/practice/next', { mode: 'topic', subtopic: 'y10-compound' }));
  same('a topic the server issues nothing from is refused even with no level named', noTopic?.code, 'PRACTICE_NOT_OFFERED');
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
console.log(`NSW OFFER: PASS — ${pass}/${total} checks — ${offeredCells} offered cells issued and marked by a Prithagoras server, ${unissuedAsked} unissued cells refused with no draft; the app offers exactly the server's issued cells. [SYNTHETIC]`);
