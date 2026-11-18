// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the paid workflow after a paper sitting (server/platform/paperPlan.js)
//
//   1 · the practice-subtopic map is the catalogue's own (each subtopic exists and
//       its crosswalk row carries the outcome), and the cross-paper index of
//       outcomes covers the papers (printed as a table);
//   2 · feedback on a sitting: per-criterion status (the final answer is the only
//       thing the engine verifies), per-line verdicts on written working, no mark
//       from working, no criterion mark;
//   3 · "What to practise next": Premium only (402 for a free account, even on the
//       free Paper 01 sitting), computed from the engine-marked parts, biggest
//       loss first, 3 questions per topic;
//   4 · the unseen re-test: Premium, parts of papers the account has never sat,
//       never the same question, standalone parts only, resumable, and the
//       before/after in plain words, no predicted mark;
//   5 · nothing secret in any of these replies.
// Accounts are SYNTHETIC; the papers are the owner's real content.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pri-paper-plan-'));
Object.assign(process.env, { NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'eb'.repeat(32),
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000' });
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { asStore } = await import('../platform/store.js');
const { PAPERS_DIR } = await import('../platform/papers.js');
const { loadStructuredPapers, leafParts, validateStructured } = await import('../platform/paperContent.js');
const P = await import('../platform/paperPlan.js');
const { NSW_CROSSWALK, EXT1 } = await import('../../client/src/engine/curriculum-nsw/crosswalk.js');

const c = checks();
const DAY = 86_400_000;
const docs = loadStructuredPapers(PAPERS_DIR);
const P01 = 'ext1-2027-p01';

// ── 1 · the map and the index ────────────────────────────────────────────────
const curriculum = readFileSync(new URL('../../client/src/engine/curriculum.js', import.meta.url), 'utf8');
for (const [subtopic, outcomes] of Object.entries(P.SUBTOPIC_OUTCOMES)) {
  c.ok(curriculum.includes(`T('${subtopic}'`), `${subtopic} is a practice subtopic of the catalogue`);
  const row = NSW_CROSSWALK.find(r => r.subtopicId === subtopic);
  c.ok(row && row.syllabus === EXT1 && outcomes.every(o => row.dotpoints.flat().includes(o)), `${subtopic}: its crosswalk row (Extension 1) carries ${outcomes.join()}`);
}
const index = P.outcomeIndex(docs);
const table = [...index].sort(([a], [b]) => a.localeCompare(b)).map(([o, rows]) => {
  const usable = rows.filter(r => r.keyed && r.standalone);
  return { outcome: o, parts: rows.length, keyed: rows.filter(r => r.keyed).length, usable: usable.length, papers: new Set(usable.map(r => r.paperNumber)).size, subtopics: P.subtopicsFor(o).join('/') || '-' };
});
console.log('RE-TEST COVERAGE (outcome, parts, engine-marked parts, usable stand-alone parts, papers they come from, practice subtopics)');
for (const r of table) console.log(`  ${r.outcome}  ${String(r.parts).padStart(3)}  ${String(r.keyed).padStart(3)}  ${String(r.usable).padStart(3)}  ${String(r.papers).padStart(2)}  ${r.subtopics}`);
c.ok(table.every(r => /^ME1-1[12]-\d\d$/.test(r.outcome)), 'every outcome tag is a clean ME1 code (the converter normalises "11-03" and "; MA-C3")');
c.ok(table.filter(r => /^ME1-1[12]-0[1-6]$/.test(r.outcome)).every(r => r.usable >= 3), 'each of the twelve Extension 1 outcomes has at least three usable unseen parts across the papers');

// ── The app ──────────────────────────────────────────────────────────────────
const h = await startApp({ resources: { edition: 'prithagoras' }, papers: { dir: PAPERS_DIR } });
let people = 0;
async function student(premium) {
  people += 1;
  await asStore(h.db).run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const r = await registerAccount(h, { email: `paper.plan.${people}@example.test`, deviceId: `paper-plan-${people}` });
  await verifyEmail(h, r.account.id);
  if (premium) await asStore(h.db).run('INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,grace_until,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end',
    [r.account.id, 'premium', 'active', 'web', Date.now() + 30 * DAY, null, Date.now()]);
  return { jar: r.jar, id: r.account.id };
}
const post = (who, path, body) => h.request(path, { method: 'POST', jar: who.jar, body });
const get = (who, path) => h.request(path, { jar: who?.jar || {} });
const secrets = [];
for (const doc of docs.values()) for (const l of leafParts(doc)) {
  for (const k of l.part.criteria) { const t = (k.text || []).map(b => b.t || '').join(' ').trim().slice(0, 60); if (t.length >= 20) secrets.push(t); }
  const t = (l.part.sampleAnswer || []).map(b => b.t || '').join(' ').trim().slice(0, 80); if (t.length >= 20) secrets.push(t);
}
const leaks = reply => secrets.filter(s => JSON.stringify(reply).includes(JSON.stringify(s).slice(1, -1)));

try {
  const free = await student(false);
  const paid = await student(true);

  // A sitting of Paper 01: wrong multiple choice, one right and one wrong keyed answer, written working on a keyed expression part.
  async function sit(who, answers, submissionId) {
    const issued = await post(who, `/v1/papers/${P01}/attempts`, { fresh: true });
    const id = issued.data.attempt.id;
    await post(who, `/v1/papers/attempts/${id}/answers`, { answers });
    const sub = await post(who, `/v1/papers/attempts/${id}/submit`, { submissionId });
    return { id, sub };
  }
  const answers = { ...Object.fromEntries(['q1', 'q2', 'q3'].map(q => [q, { mode: 'typed', text: 'D' }])),
    'q11a-ii': { mode: 'typed', text: '3*sqrt(207-k)', working: '(2*sqrt(207-k))*(3/2)\n3*sqrt(207-k)' },
    'q11a-iii': { mode: 'typed', text: '5' }, 'q14b-ii': { mode: 'typed', text: '1/(2*m-1)' } };
  const A = await sit(free, answers, 'paper-plan-0001');
  c.eq(A.sub.status, 200, 'a free account sits and submits the free sample');
  const R = A.sub.data.attempt.result;

  // ── 2 · criteria and working ──────────────────────────────────────────────
  const row = R.parts['q11a-iii'];
  c.deq(row.criteria.map(k => k.status), ['not-verified', 'self-check', 'self-check'], 'a wrong final answer: the top criterion is "not verified", the others are the student\'s to check');
  c.deq(R.parts['q11a-ii'].criteria.map(k => [k.engine, k.status])[0], ['final-answer', 'verified'], 'a right final answer: that criterion is verified by the engine');
  c.deq(R.parts['q11b-i'].criteria.map(k => k.status).every(s => s === 'self-check'), true, 'a proof: every criterion is self-check');
  c.ok(R.parts['q11a-ii'].working && Array.isArray(R.parts['q11a-ii'].working.lines) && R.parts['q11a-ii'].working.lines.length === 2, 'written working on a keyed part gets a verdict per line');
  c.ok(R.parts['q11a-ii'].working.lines.every(l => ['ok', 'unsure', 'break'].includes(l)), 'each line is ok, unsure or break: never a mark');
  c.ok(!JSON.stringify(R).includes('"marks":') || R.criteriaMarksShown === false, 'no criterion mark is shown (no author-approved scheme)');
  c.eq(R.parts['q11a-ii'].awarded, 1, 'working changes no mark: a right final answer earns its 1');
  c.deq(leaks(A.sub.data), [], 'the result carries no criterion or sample-answer text');

  // ── 3 · the plan: Premium only ────────────────────────────────────────────
  const refused = await get(free, `/v1/papers/attempts/${A.id}/plan`);
  c.deq([refused.status, refused.data.error.code, refused.data.error.capability], [402, 'PREMIUM_REQUIRED', 'premium-exams'], 'a free account is refused the plan, even for the free sample sitting');
  c.eq((await post(free, `/v1/papers/attempts/${A.id}/retest`, {})).status, 402, 'and the re-test');
  const B = await sit(paid, answers, 'paper-plan-0002');
  const plan = await get(paid, `/v1/papers/attempts/${B.id}/plan`);
  c.eq(plan.status, 200, 'Premium reads the plan');
  const items = plan.data.items;
  c.ok(items.length >= 1 && items.every((i, n) => n === 0 || items[n - 1].lost >= i.lost), 'topics are listed biggest loss first');
  c.ok(items.every(i => i.questions === 3 && /^ME1-1[12]-\d\d$/.test(i.outcome) && i.partIds.length >= 1), 'three questions per weak topic, each tied to an outcome and the parts lost');
  c.ok(items.some(i => i.subtopics.length), 'topics carry the practice subtopics to start in one press');
  c.ok(plan.data.items.every(i => i.partIds.every(id => R.parts[id].checks === 'pri')), 'only parts the engine marked are counted weak');
  c.eq(plan.data.selfChecked > 0, true, 'the plan says how many parts are the student\'s own to check');
  const { limits, note, ...planBody } = plan.data;
  c.ok(!/predict|band|ATAR|you will score/i.test(JSON.stringify(planBody)) && /not a prediction/.test(limits), 'no predicted mark, band or ATAR (the one mention is the disclaimer)');
  c.deq(leaks(plan.data), [], 'the plan carries no secret');
  const open = await post(paid, `/v1/papers/${P01}/attempts`, { fresh: true });
  c.eq((await get(paid, `/v1/papers/attempts/${open.data.attempt.id}/plan`)).data.error.code, 'PAPER_NOT_SUBMITTED', 'a sitting not yet submitted has no plan');
  c.eq((await get(free, `/v1/papers/attempts/${B.id}/plan`)).data.error.code, 'PAPER_ATTEMPT_NOT_FOUND', 'another account cannot read the plan');

  // ── 4 · the re-test ───────────────────────────────────────────────────────
  const rt = await post(paid, `/v1/papers/attempts/${B.id}/retest`, {});
  c.eq(rt.status, 201, 'Premium makes a re-test');
  const T = rt.data.attempt;
  c.eq(T.paperId, 'ext1-retest', 'it is a sitting of its own');
  const composition = JSON.parse((await asStore(h.db).get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='paper-sitting' AND key=?", [paid.id, T.id])).response_json).retest;
  c.ok(composition.parts.length >= 1 && composition.parts.every(p => p.paperId !== P01), 'every part comes from a paper the student has not sat; never the same questions');
  c.ok(composition.parts.every(p => items.some(i => i.outcome === p.outcome)), 'and each part is on a weak topic');
  c.ok(new Set(composition.parts.map(p => `${p.paperId}:${p.partId}`)).size === composition.parts.length, 'no part twice');
  const doc = P.retestDoc(docs, composition);
  validateStructured(doc);
  c.eq(T.paper.totalMarks, doc.totalMarks, 'the re-test is a valid paper of the chosen parts\' marks');
  c.deq(leaks(rt.data), [], 'the issued re-test carries no key, criterion or sample answer');
  c.eq((await post(paid, `/v1/papers/attempts/${B.id}/retest`, {})).data.attempt.id, T.id, 'asking again resumes the same re-test');
  c.eq((await post(paid, `/v1/papers/attempts/${T.id}/retest`, {})).status, 409, 'a re-test cannot be made from a re-test');
  const comparisonEarly = await get(paid, `/v1/papers/attempts/${T.id}/comparison`);
  c.eq(comparisonEarly.data.error.code, 'PAPER_NOT_SUBMITTED', 'no comparison before the re-test is submitted');
  // answer every part of the re-test correctly, using the keys the server holds
  const right = {};
  composition.parts.forEach((p, n) => {
    const k = docs.get(p.paperId).sections.flatMap(s => s.questions).flatMap(function walk(q) { return q.parts.flatMap(x => (x.parts ? x.parts.flatMap(y => [y]) : [x])); }).find(x => x.id === p.partId).key;
    const text = k.type === 'mcq' ? k.answer : k.type === 'numeric' ? String(k.value) : k.type === 'expression' ? k.expr : k.type === 'exact' ? `${k.n}/${k.d}` : k.type === 'interval' ? k.region : k.type === 'point' ? `(${k.x}, ${k.y})` : k.type === 'set' ? k.values.join(', ') : `${k.lhs} = ${k.rhs}`;
    right[`q${n + 1}`] = { mode: 'typed', text };
  });
  await post(paid, `/v1/papers/attempts/${T.id}/answers`, { answers: right });
  const sub = await post(paid, `/v1/papers/attempts/${T.id}/submit`, { submissionId: 'paper-plan-retest-1' });
  c.eq(sub.status, 200, 'the re-test is submitted and marked');
  const cmp = await get(paid, `/v1/papers/attempts/${T.id}/comparison`);
  c.eq(cmp.status, 200, 'the comparison is read');
  c.ok(cmp.data.outcomes.length >= 1 && cmp.data.outcomes.every(o => /^First sitting \d+ of \d+; re-test \d+ of \d+\.$/.test(o.words)), 'before and after, per topic, in plain words');
  c.ok(cmp.data.outcomes.every(o => o.after.awarded === o.after.available && o.before.awarded <= o.before.available), 'the re-test marks are the engine\'s on the parts answered');
  c.ok(!/learn|improv|predict|band|ATAR/i.test(JSON.stringify(cmp.data.outcomes)) && /not a measure of learning/.test(cmp.data.note), 'no claim of learning gain and no predicted mark');
  c.eq((await get(free, `/v1/papers/attempts/${T.id}/comparison`)).data.error.code, 'PAPER_ATTEMPT_NOT_FOUND', 'another account cannot read the comparison');
  // a second re-test avoids the papers already used
  const C2 = await sit(paid, answers, 'paper-plan-0003');
  const rt2 = await post(paid, `/v1/papers/attempts/${C2.id}/retest`, {});
  const comp2 = JSON.parse((await asStore(h.db).get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='paper-sitting' AND key=?", [paid.id, rt2.data.attempt.id])).response_json).retest;
  const used = new Set(composition.parts.map(p => p.paperId));
  c.ok(comp2.parts.every(p => !used.has(p.paperId) && p.paperId !== P01), 'a second re-test uses only papers not yet seen (including those of the first re-test)');
} finally {
  await h.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`PAPER PLAN: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC accounts; the papers are the owner's real content]`);
