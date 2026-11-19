// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the generated "Exam-style practice sets", served by the papers router
//   (server/platform/papers.js, paperAttempts.js; content in server/content/papers/nsw-practice/)
//
//   · a FREE account lists them in `practiceSets` (never in `papers`), is offered them by chapter (exam-style),
//     may sit one whole and one question of it, and is marked by the deterministic engine, part by part, on its final answer;
//   · nothing secret before Submit; the sample answer after it (free, as for a free sample); no plan and no re-test;
//   · they are never a PDF download and never a source of re-test parts; Priyabhata (India) is refused all of it.
// Accounts are SYNTHETIC; the questions are generated, not authored papers.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { checks, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { PAPERS_DIR, PRACTICE_DIR } from '../platform/papers.js';
import { loadStructuredPapers, leafParts } from '../platform/paperContent.js';
import { PRACTICE_SET_SUBTOPICS } from '../../client/src/paper/practiceSets.js';

const c = checks();
const docs = loadStructuredPapers(PRACTICE_DIR);
const doc = docs.get('mp-practice-set-2');
const hAu = await startApp({ resources: { edition: 'prithagoras' }, papers: { dir: PAPERS_DIR } });
const hIn = await startApp({ resources: { edition: 'priyabhata' }, papers: { dir: PAPERS_DIR } });
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));
const spell = key => key.type === 'numeric' ? fmt(key.value) : key.type === 'set' ? key.values.map(fmt).join(', ') : key.expr.replace(/\*/g, '');
try {
  const reg = async (h, email) => { const r = await registerAccount(h, { email }); await verifyEmail(h, r.account.id); return { jar: r.jar }; };
  const free = await reg(hAu, 'sets.free@example.test');
  const india = await reg(hIn, 'sets.india@example.test');
  const post = (h, who, path, body) => h.request(path, { method: 'POST', jar: who.jar, body });
  const get = (h, who, path) => h.request(path, { jar: who?.jar || {} });

  c.eq((await get(hAu, null, '/v1/papers')).status, 401, 'signed out: no list');
  const list = await get(hAu, free, '/v1/papers');
  c.deq(list.data.practiceSets.map(s => s.id), [...docs.keys()], 'the practice sets are listed, in order');
  c.ok(list.data.papers.length === 13 && list.data.papers.every(p => !p.id.startsWith('mp-')), 'the authored papers are still thirteen and the sets are not among them');
  c.ok(list.data.practiceSets.every(s => s.sitLocked === false && /^Exam-style practice set \d$/.test(s.title) && s.questions === 8), 'a free account may sit every set; titled as generated practice');
  c.ok(!JSON.stringify(list.data.practiceSets).match(/key|criteria|sampleAnswer|\.pdf/), 'the list holds no key, criterion or file');
  c.eq((await get(hAu, free, `/v1/papers/${doc.id}/paper`)).status, 404, 'a set is not a PDF download');

  // chapters
  for (const [chapter, codes] of Object.entries(PRACTICE_SET_SUBTOPICS)) {
    const r = await get(hAu, free, `/v1/papers/exam-style/${chapter}`);
    const sets = r.data.questions.filter(q => q.generated);
    c.ok(r.status === 200 && sets.length > 0 && sets.length <= 4 && sets.every(q => !q.locked && q.paperId.startsWith('mp-practice-set-') && q.question >= 1 && q.question <= 8), `${chapter}: free generated questions are offered (${sets.length})`);
    for (const q of sets) {
      const d = docs.get(q.paperId);
      const part = leafParts(d).filter(l => q.matchingParts.includes(l.part.id));
      c.ok(part.length > 0 && part.every(l => l.part.classification.outcomes.some(o => codes.includes(o))), `${chapter}: ${q.paperId} Q${q.question} matches by outcome ${codes.join()}`);
    }
  }
  const vect = (await get(hAu, free, '/v1/papers/exam-style/me12-vectors')).data.questions;
  c.ok(vect.some(q => q.generated) && vect.some(q => !q.generated), 'an Extension 1 chapter is offered the generated and the authored questions together');
  c.deq((await get(hAu, free, '/v1/papers/exam-style/y11-rates')).data.questions, [], 'a chapter no set covers is offered nothing');
  c.deq((await get(hAu, free, '/v1/papers/exam-style/me12-calc')).data.questions.filter(q => q.generated), [], 'an Extension 1 chapter no set covers is offered no generated question');

  // one question of a set, then the whole set
  const q3 = doc.sections[0].questions[2];
  const one = await post(hAu, free, `/v1/papers/${doc.id}/attempts`, { question: q3.number });
  c.eq(one.status, 201, 'a free account may sit one question of a set');
  const A = one.data.attempt;
  const shown = JSON.stringify(A.paper);
  c.ok(!/"key"|"criteria"|"sampleAnswer"|classification|provenance/.test(shown) && !/\bundefined\b/.test(shown), 'nothing secret before Submit');
  c.deq(A.paper.sections[0].questions.map(q => q.number), [q3.number], 'only that question is issued');
  c.ok(A.paper.sections[0].questions[0].parts.every(p => p.checks === 'pri' && p.autoMarks === p.marks), 'every part is checked by Pri, for its own marks');
  const parts = leafParts(doc).filter(l => l.question.number === q3.number);
  const answers = Object.fromEntries(parts.map(l => [l.part.id, { mode: 'typed', text: spell(l.part.key) }]));
  c.eq((await post(hAu, free, `/v1/papers/attempts/${A.id}/answers`, { answers })).status, 200, 'answers are saved');
  const done = await post(hAu, free, `/v1/papers/attempts/${A.id}/submit`, { submissionId: 'practice-set-submit-1' });
  c.eq(done.status, 200, 'submit');
  const t = done.data.attempt.result.totals;
  c.deq([t.total, t.autoAvailable, t.autoAwarded, t.selfChecked], [q3.marks, q3.marks, q3.marks, 0], 'every part right: the question\'s full marks, none left to self-check');
  c.ok(parts.every(l => done.data.attempt.result.parts[l.part.id].awarded === l.part.marks && done.data.attempt.result.parts[l.part.id].verdict === 'correct'), 'a mark per part, each its own marks');
  const sol = await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/${parts[0].part.id}/solution`);
  c.ok(sol.status === 200 && sol.data.sampleAnswer.length >= 2 && sol.data.criteriaMarksShown === false && sol.data.howMarked.every(h => h.marks === undefined), 'the sample answer is free after Submit; criterion marks are not shown (no approval)');
  c.deq([(await get(hAu, free, `/v1/papers/attempts/${A.id}/plan`)).status, (await post(hAu, free, `/v1/papers/attempts/${A.id}/retest`, {})).status], [409, 409], 'a practice set has no plan and no re-test');

  // a wrong answer is not marked; the whole set can be sat
  const whole = await post(hAu, free, `/v1/papers/${doc.id}/attempts`, {});
  c.eq(whole.status, 201, 'the whole set can be sat');
  const first = leafParts(doc)[0];
  await post(hAu, free, `/v1/papers/attempts/${whole.data.attempt.id}/answers`, { answers: { [first.part.id]: { mode: 'typed', text: '123456.5' } } });
  const wrong = await post(hAu, free, `/v1/papers/attempts/${whole.data.attempt.id}/submit`, { submissionId: 'practice-set-submit-2' });
  c.deq([wrong.data.attempt.result.parts[first.part.id].verdict, wrong.data.attempt.result.totals.autoAwarded], ['incorrect', 0], 'a wrong final answer earns nothing');
  c.eq((await post(hAu, free, `/v1/papers/mp-practice-set-9/attempts`, {})).status, 404, 'an unknown set is 404');

  // India
  const il = await get(hIn, india, '/v1/papers');
  c.deq([il.status, il.data?.error?.code], [404, 'PAPERS_NOT_AVAILABLE'], 'India: no list');
  c.deq((await post(hIn, india, `/v1/papers/${doc.id}/attempts`, {})).status, 404, 'India: no sitting');
  c.deq((await get(hIn, india, '/v1/papers/exam-style/y12-appdiff')).status, 404, 'India: no exam-style questions');
} finally {
  await hAu.close();
  await hIn.close();
}
console.log(`PRACTICE SETS: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC accounts; generated questions]`);
