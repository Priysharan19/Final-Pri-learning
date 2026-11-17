// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · every Priyabhata question and attempt carries its curriculum identity
//
// The teacher board needs server records that say WHERE in the India curriculum an
// answer was: board, class, chapter and learning outcome. Before this, an India
// attempt carried none. Now:
//
//   · every India bank, at every difficulty it issues, seals an identity from the
//     server's own question (indiaIdentity.js), and every coded outcome resolves to a
//     dot point the curriculum states (nothing is invented; no board outcome code is
//     claimed — `basis` says the code is the product curriculum's dot point);
//   · the syllabus year is named only for classes the repository has a 2026-27
//     source for (7, 9, 10), the board only where a class is, the NCERT source only
//     for NCERT chapters;
//   · over real HTTP, a graded attempt AND a revealed attempt record the identity the
//     server sealed — a forged `curriculum` / identity in the submit body changes
//     nothing — and the device is never sent it.
// SYNTHETIC: generated questions and a test account.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { bankPolicy, sealForEdition } = await import('../platform/editionBanks.js');
const { indiaBank } = await import('../platform/indiaBanks.js');
const { INDIA_SYLLABUS_VERSION, INDIA_VERSIONED_CLASSES, OUTCOME_BASIS } = await import('../platform/indiaIdentity.js');
const { IN_CHAPTERS } = await import('../../client/src/engine/curriculum-in.js');
const { GENERATORS, generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();
delete process.env.PRI_EDITION;
const c = checks();
const chapterById = new Map(IN_CHAPTERS.map(ch => [ch.id, ch]));
const india = bankPolicy('priyabhata');

// ── Every bank, every difficulty it issues ──────────────────────────────────
let items = 0, withOutcome = 0, bad = [];
for (const g of Object.keys(GENERATORS).filter(indiaBank)) {
  for (let d = 1; d <= 4; d++) {
    let q;
    try { q = generateQuestion(g, d, 5); } catch { continue; }
    if (!q) continue;
    q._generator = g;
    items++;
    if (!sealForEdition(q, india, g)) { bad.push(`${g} D${d}: not sealed`); continue; }
    const id = q._curriculum;
    const ch = chapterById.get(id.chapterId);
    if (!ch) { bad.push(`${g}: chapter ${id.chapterId} is not in the curriculum`); continue; }
    if (id.jurisdiction !== 'IN' || id.generator !== g) bad.push(`${g}: wrong jurisdiction or generator`);
    if (Number.isInteger(ch.grade)) {
      if (id.board !== 'CBSE' || id.class !== ch.grade || id.syllabus !== `cbse-mathematics-class-${ch.grade}`) bad.push(`${g}: board, class or syllabus does not follow the chapter`);
      if (id.syllabusVersion !== (INDIA_VERSIONED_CLASSES.includes(ch.grade) ? INDIA_SYLLABUS_VERSION : null)) bad.push(`${g}: a syllabus year is named for class ${ch.grade} without a source`);
    } else if (id.board !== null || id.class !== null || id.syllabusVersion !== null) bad.push(`${g}: an ungraded (Olympiad) chapter claims a board, class or year`);
    if (id.source === 'NCERT' && !/^c\d+-/.test(ch.id)) bad.push(`${g}: NCERT claimed for a non-NCERT chapter`);
    if (!Array.isArray(id.outcomes) || !id.outcomes.length) bad.push(`${g} D${d}: no learning outcome on a chapter practice question`);
    for (const o of id.outcomes || []) {
      const m = /^(.+)#(\d+)$/.exec(o.code);
      if (!m || m[1] !== ch.id || ch.dotpoints?.[Number(m[2]) - 1] !== o.text || o.basis !== OUTCOME_BASIS) bad.push(`${g}: outcome ${o.code} does not resolve to the chapter's own dot point`);
    }
    if (id.outcomes?.length) withOutcome++;
    if (JSON.stringify(JSON.parse(JSON.stringify(id))) !== JSON.stringify(id)) bad.push(`${g}: identity is not plain JSON`);
  }
}
c.ok(items > 400, `${items} India items checked`);
c.deq(bad.slice(0, 12), [], `every India item seals a curriculum identity with sourced outcomes (${withOutcome} of ${items} carry outcomes)`);

// ── Over HTTP: the attempt records the server's own identity ────────────────
const h = await startApp({ engine: process.argv.includes('--engine=postgres') ? 'postgres' : 'sqlite' });
try {
  const a = await registerAccount(h, { email: 'in.outcome@example.test', deviceId: 'ipad-in-outcome' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified Priyabhata student');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const eventsOf = async (qid, kind) => (await h.db.all('SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind=?', [a.account.id, qid, kind])).map(r => JSON.parse(r.payload_json));
  const keysOf = v => (!v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(keysOf) : Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]));

  const r = await issue({ generator: 'c10-arithmetic-progressions', difficulty: 2, curriculum: 'in' });
  c.eq(r.status, 201, 'an India question is issued ' + JSON.stringify(r.data?.error || null));
  const sealed = await sealedOf(r.data.question.id);
  c.ok(sealed._curriculum?.board === 'CBSE' && sealed._curriculum.class === 10 && sealed._curriculum.chapterId === 'c10-arithmetic-progressions' && sealed._curriculum.syllabusVersion === 'CBSE-2026-27' && sealed._curriculum.outcomes.length >= 1, 'it is sealed with board, class, chapter, outcome and the class-10 syllabus year');
  c.ok(!keysOf(r.data).some(k => ['_curriculum', 'curriculum', 'outcomes', 'chapterId', 'syllabusVersion'].includes(k)), 'and the device is not sent the identity');
  const rightAnswer = sq => (sq.answerType === 'mcq' ? String(sq.answer.correctIndex)
    : sq.answerType === 'numeric' ? (sq.answer.canonicalInput || String(sq.answer.value))
      : sq.answerType === 'expression' ? sq.answer.expr
        : sq.answerType === 'point' ? `(${sq.answer.x}, ${sq.answer.y})`
          : sq.answerType === 'set' ? sq.answer.values.join(', ') : `${sq.answer.a}:${sq.answer.b}`);
  // A forged identity in the submit body is refused outright and records nothing.
  const forged = await h.request(`/v1/practice/${r.data.question.id}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'in-outcome-forged' },
    body: { submissionId: 'in-outcome-forged', answer: '999999', mode: 'typed', curriculum: { board: 'FORGED', class: 1, chapterId: 'forged' }, chapterId: 'forged', outcomes: [{ code: 'forged#1' }] } });
  c.eq(forged.status, 400, 'a submit that carries an identity of its own is refused');
  c.deq(await eventsOf(r.data.question.id, 'graded-attempt'), [], 'and records no attempt');
  // A valid submit records the identity the SERVER sealed.
  const sub = await h.request(`/v1/practice/${r.data.question.id}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'in-outcome-sub-1' },
    body: { submissionId: 'in-outcome-sub-1', answer: rightAnswer(sealed), mode: 'typed' } });
  c.eq(sub.status, 200, 'a valid submit is graded');
  const graded = await eventsOf(r.data.question.id, 'graded-attempt');
  c.eq(graded.length, 1, 'one graded attempt is recorded (the right answer resolves it)');
  c.deq(graded[0].curriculum, sealed._curriculum, 'the graded attempt records exactly the identity the SERVER sealed');

  let r2 = { status: 0 };
  for (const ch of IN_CHAPTERS.filter(x => x.grade === 9)) for (const cv of ch.covers) {
    if (r2.status === 201) break;
    r2 = await issue({ generator: cv.gen, difficulty: cv.diff[0], curriculum: 'in' });
  }
  if (r2.status === 201) {
    const s2 = await sealedOf(r2.data.question.id);
    const reveal = await h.request(`/v1/practice/${r2.data.question.id}/reveal`, { method: 'POST', jar: a.jar, body: {} });
    c.eq(reveal.status, 200, 'revealing a question works');
    const revealed = await eventsOf(r2.data.question.id, 'graded-attempt');
    c.deq(revealed[0]?.curriculum, s2._curriculum, 'a revealed attempt records the sealed identity too');
    c.ok(s2._curriculum.class === 9 && s2._curriculum.syllabusVersion === 'CBSE-2026-27', 'a class-9 identity names the class and its 2026-27 syllabus');
  } else c.ok(false, `a class 9 bank is issued (${r2.status})`);
} finally {
  await h.close();
}
console.log(`IN OUTCOME IDENTITY: PASS — ${c.count()}/${c.count()} checks — every India bank issues with a sourced curriculum identity (board, class, chapter, outcomes; a syllabus year only for classes 7, 9, 10), and graded and revealed attempts record the server's own identity, never a forged one. [SYNTHETIC]`);
