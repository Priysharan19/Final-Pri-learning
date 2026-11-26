// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author's WORKED-SOLUTION questions (answerType 'manual'), on the COMMITTED pack
//
// About 2,200 of the owner's questions are show-that, prove, explain, sketch and "find" questions that no engine here can mark honestly. They are
// served with no key and no mark:
//
//   · THE PACK      each has no answer and no trap, his steps and criteria, at most three hints, and the hints state no result of his steps;
//   · SEALING       the issue reply carries the prompt, the hints and the figure's description, and none of his steps, criteria or marks;
//   · THE ROUTES    submit, reveal and the ladder's solution rung refuse it (nothing is marked); /solution is the one way to its solution, tied to the
//                   issued question and account, and idempotent;
//   · ACCOUNTING    asking for the solution records the question as completed and SEEN, and records NO attempt, no learning event, no mark;
//   · THE MIX       1 draw in 6 where a pool exists, never two in a row, never in Rush, Match, the placement check or a timed paper.
// SYNTHETIC: the owner's questions run against the server. Not evidence about real students.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR', 'PRI_FEATURE_LINE_CHECK'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-worked-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c6'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_FEATURE_LINE_CHECK = '1';
delete process.env.PRI_QBANK_DIR;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { bankPolicy } = await import('../platform/editionBanks.js');
const { chooseQuestion, ensureBanks } = await import('../platform/practice.js');
const { seenAmong, seenKeysOf } = await import('../platform/contentSeen.js');
const { stepResults, stepResultLeak } = await import('../../tools/qbank-manual.mjs');
const { workedEvidence } = await import('../platform/markerOps.js');
const { authoredLines } = await import('../platform/genericSteps.js');

const c = checks();
await qb.ensureQbank(process.env, { strict: true });
await ensureBanks();
const workedAll = qb.qbankManualEntries();
const markedAll = qb.qbankEntries();

// ── THE PACK ─────────────────────────────────────────────────────────────────
c.ok(workedAll.length > 1500, `the committed pack holds ${workedAll.length} worked-solution questions`);
c.ok(workedAll.every(x => x.entry.answerType === 'manual' && x.entry.answer === undefined && x.entry.traps === undefined && x.place), 'each has no answer and no trap, and is placed in a product subtopic');
c.ok(workedAll.every(x => x.entry.steps.length >= 1 && x.entry.criteria.length >= 1 && x.entry.criteria.reduce((n, k) => n + k.marks, 0) === x.entry.marks), 'each has his steps and his criteria, and the criteria add up to his marks');
// A worked-solution question is looked up by its id alone, and issued in the subtopic and at the dot point of the family that holds it: an id held by two
// families would issue one under the other's place, so ids are unique across families, and every one is issued where its own family places it.
c.ok(new Set(workedAll.map(x => x.entry.id)).size === workedAll.length, 'a worked-solution id is held by exactly one family');
c.ok(workedAll.every(x => { const q = qb.qbankManualQuestion(x.entry.id); return q.subtopic === x.place.subtopic && q.prompt === x.entry.prompt; }), `each of the ${workedAll.length} is issued in its own family's subtopic with its own prompt`);
c.ok(workedAll.every(x => x.entry.hints.length <= 3 && JSON.stringify(Object.values(x.entry.ladder)) === JSON.stringify(x.entry.hints)), 'each ladder is his hints, at most three, in his order');
{
  const leaks = [];
  for (const { entry } of workedAll) { const r = stepResults(entry); for (const h of entry.hints) { const why = stepResultLeak(entry, h, r); if (why) leaks.push(`${entry.id}: ${why}`); } }
  c.deq(leaks, [], 'no hint of any worked-solution question states a result of his worked steps');
}
c.ok(new Set(workedAll.map(x => x.entry.id)).size === workedAll.length && !workedAll.some(x => markedAll.some(m => m.entry.id === x.entry.id)), 'no question is both marked and worked');
{
  const kinds = {}; for (const x of workedAll) kinds[x.entry.kind] = (kinds[x.entry.kind] || 0) + 1;
  const byCourse = {}; for (const x of workedAll) { const k = `${x.family.slice(3, 4).toUpperCase()}${x.family.slice(4, 6)}`; byCourse[k] = (byCourse[k] || 0) + 1; }
  console.log(`  worked-solution questions ${workedAll.length}: by kind ${JSON.stringify(kinds)}; by course ${JSON.stringify(byCourse)}; line feedback allowed on ${workedAll.filter(x => x.entry.lineFeedback).length}; with a figure ${workedAll.filter(x => x.entry.diagram).length}`);
  c.ok(Object.keys(byCourse).length === 4, 'all four courses (Advanced and Extension 1, Years 11 and 12) have some');
}

// ── THE MIX (the seed alone decides; the caller says whether one may be dealt) ───
{
  const policy = bankPolicy('prithagoras');
  const target = workedAll.find(x => x.place.ordinal === null && workedAll.filter(y => y.place.subtopic === x.place.subtopic && y.entry.level === x.entry.level).length >= 5);
  const [sub, level] = [target.place.subtopic, target.entry.level];
  let manual = 0, bank = 0, gen = 0;
  const N = 6000;
  for (let seed = 1; seed <= N; seed++) { const q = qb.qbankDraw(sub, level, seed * 7919, null, null, { manual: true }); if (q?._worked) manual++; else if (q?._bank) bank++; else gen++; }
  c.ok(manual / N > 0.13 && manual / N < 0.2, `with a worked-solution question allowed, about 1 draw in 6 is one (${manual} of ${N}; ${bank} marked, ${gen} for a generator)`);
  let none = 0; for (let seed = 1; seed <= N; seed++) if (qb.qbankDraw(sub, level, seed * 7919, null, null, { manual: false })?._worked) none++;
  c.eq(none, 0, 'and with none allowed (the last question was one; a prepared question; a timed paper) never');
  c.eq(qb.qbankDraw(sub, level, 12345, null, null, { manual: true })?._bank, qb.qbankDraw(sub, level, 12345, null, null, { manual: true })?._bank, 'the same arguments are the same question');
  // Rush, Match, the placement check and a timed paper (bank: false) never draw one, whatever is allowed.
  let shown = 0;
  const lcg = s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) % 0x80000000;
  for (const mode of ['rush', 'match', 'placement']) for (let i = 0; i < 400; i++) { const { q } = chooseQuestion({ generator: sub, difficulty: level, mode, avoid: new Set(), allowManual: true }, null, { draw: lcg(3 + i), banks: policy }); if (q._worked || q._bank) shown++; }
  for (let i = 0; i < 400; i++) { const { q } = chooseQuestion({ generator: sub, difficulty: level, mode: 'practice', bank: false, avoid: new Set(), allowManual: true }, null, { draw: lcg(9 + i), banks: policy }); if (q._worked || q._bank) shown++; }
  c.eq(shown, 0, 'Rush, Match, the placement check and a timed paper never deal a worked-solution (or any authored) question');
  let prepared = 0;
  for (let i = 0; i < 600; i++) { const { q } = chooseQuestion({ generator: sub, difficulty: level, mode: 'practice', avoid: new Set() }, null, { draw: lcg(21 + i), banks: policy }); if (q._worked) prepared++; }
  c.eq(prepared, 0, 'a prepared (signed-out) question is never one: nothing could be bound to it');
}

// ── THE ROUTES ───────────────────────────────────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
try {
  const reg = async n => { const a = await registerAccount(h, { email: `qbank.worked${n}@example.test`, deviceId: `ipad-qbank-worked-${n}` }); await verifyEmail(h, a.account.id); return a; };
  const a = await reg(1), other = await reg(2);
  const post = (acct, p, body = {}, headers = {}) => h.request(`/v1/practice/${p}`, { method: 'POST', jar: acct.jar, headers, body });
  const issue = (acct, body) => post(acct, 'issue', { curriculum: 'nsw', ...body });
  const sealedOf = async (acct, qid) => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [acct.account.id, qid])).response_json);
  const events = async acct => (await h.db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [acct.account.id])).n;
  // A worked-solution question with line feedback allowed and one without, found by asking for its cell with fixed seeds.
  const find = async (acct, want) => {
    for (let seed = 1; seed < 40000; seed += 7) {
      const r = await issue(acct, { generator: want.place.subtopic, difficulty: want.entry.level, seed, worked: true, ...(want.place.ordinal !== null ? { dotpoint: `${want.place.subtopic}.${want.place.ordinal + 1}` } : {}) });
      if (r.status !== 201) continue;
      const s = await sealedOf(acct, r.data.question.id);
      if (s._worked && s._bank === want.entry.id) return { r, sealed: s };
      if (s._worked) { /* another worked question: leave it open, it is not the one asked for */ }
    }
    return null;
  };
  const typedLines = id => authoredLines(qb.qbankManualQuestion(id)).map(l => l.text).slice(0, 4);
  // a question whose own page the step report ticks (so there is a note to check) and one whose gate is closed
  const target = workedAll.find(w => w.entry.lineFeedback && w.place.ordinal !== null && !w.entry.diagram && workedEvidence(qb.qbankManualQuestion(w.entry.id), typedLines(w.entry.id)).verified > 0);
  const closed = workedAll.find(w => !w.entry.lineFeedback && w.place.ordinal !== null && !w.entry.diagram && typedLines(w.entry.id).length > 0);
  c.ok(!!target && !!closed, 'the pack has a question with line feedback allowed and one without');
  const got = await find(a, target);
  c.ok(!!got, `a worked-solution question was issued (${target.entry.id})`);
  const { r, sealed } = got;
  const qid = r.data.question.id;
  const pub = JSON.stringify(r.data);
  c.ok(r.data.question.answerType === 'manual' && r.data.question.worked === true && r.data.question.prompt === target.entry.prompt, 'the issue reply says it is a worked-solution question and carries the prompt');
  c.ok(!('answer' in r.data.question) && !('steps' in r.data.question) && !('criteria' in r.data.question) && !('criteriaCount' in r.data.question) && !('traps' in r.data.question), 'and no answer, step, criterion, mark count or trap');
  c.ok(target.entry.steps.every(s => !pub.includes(s.d) && !pub.includes(s.h)) && target.entry.criteria.every(k => !pub.includes(k.point)), 'none of his steps or criteria is anywhere in the issue reply');
  c.ok(Array.isArray(r.data.question.hints) && JSON.stringify(r.data.question.hints) === JSON.stringify(target.entry.hints), 'it carries his hints');
  c.ok(sealed._worked === target.entry.kind && sealed.criteria.length === target.entry.criteria.length && sealed.answer === undefined, 'the escrow holds the steps and criteria, and no key');

  const eventsBefore = await events(a);
  const nope = [['submit', post(a, `${qid}/submit`, { submissionId: 'worked-sub-1-xxxx', answer: '1', mode: 'typed' }, { 'Idempotency-Key': 'worked-sub-1-xxxx' })], ['reveal', post(a, `${qid}/reveal`)], ['solution rung', post(a, `${qid}/hint`, { rung: 'solution' })]];
  for (const [what, p] of nope) { const x = await p; c.ok(x.status === 409, `${what} is refused (nothing is marked): ${x.status} ${x.data?.error?.code}`); }
  c.eq((await post(a, `${qid}/submit`, { submissionId: 'worked-sub-2-xxxx', answer: '1', mode: 'typed' }, { 'Idempotency-Key': 'worked-sub-2-xxxx' })).data.error.code, 'PRACTICE_NOT_MARKED', 'a submission is refused as "not marked"');
  if (target.entry.hints.length) { const hint = await post(a, `${qid}/hint`, { rung: 'nudge' }); c.ok(hint.status === 200 && hint.data.hint === target.entry.hints[0], 'his first hint is served'); }
  c.eq(await events(a), eventsBefore, 'asking for hints and being refused records nothing');

  c.eq((await issue(a, { generator: target.place.subtopic, difficulty: target.entry.level, worked: true })).status, 400, 'the test flag `worked` is refused without a seed (the server chooses in production)');
  // another account's question id is the same 404 as none
  c.eq((await post(other, `${qid}/solution`)).status, 404, 'another account cannot ask for this question\'s solution');
  c.eq((await post(a, 'not-a-uuid/solution')).status, 404, 'a malformed id is a 404');
  c.eq((await post(a, `${qid}/solution`, { lines: 'x' })).status, 400, 'a malformed body is a 400');
  c.eq((await post(a, `${qid}/solution`, { answer: '5' })).status, 400, 'an answer is not a field: nothing is marked');

  // The solution.
  const lines = typedLines(target.entry.id);
  const expectNote = workedEvidence(qb.qbankManualQuestion(target.entry.id), lines);
  const s1 = await post(a, `${qid}/solution`, { lines });
  c.eq(s1.status, 200, 'the solution is served');
  const d = s1.data;
  c.ok(d.authoritative === true && d.worked === true && d.resolved === true && d.questionId === qid, 'the reply is the server\'s, for this question, and says it is a worked solution');
  c.deq(d.solution.steps, target.entry.steps.map(s => ({ h: s.h, d: s.d })), 'it carries his steps');
  c.deq(d.solution.criteria, target.entry.criteria.map(k => ({ marks: k.marks, point: k.point })), 'and his criteria with his marks, as information (no line of any criterion)');
  c.eq(d.solution.marksAvailable, target.entry.marks, 'and the marks that were available');
  const MARKY = ['correct', 'marksEarned', 'creditedMarks', 'markWeight', 'revealed', 'attemptId', 'xp', 'invalid', 'repeat'];
  c.deq(MARKY.filter(k => k in d), [], 'it carries no verdict, no mark earned or credited, no attempt id and no xp');
  c.deq(d.workNote, { lines: lines.length, verified: expectNote.verified, ...(expectNote.firstBreak >= 0 ? { lookAgain: expectNote.firstBreak + 1 } : {}) }, 'the student\'s own lines get a note: how many hold and, if one does not follow, which to look at again (never a cross, a mark or a value)');
  c.ok(d.workNote.verified > 0 && d.workNote.verified <= lines.length, 'it ticks lines that hold');
  const s2 = await post(a, `${qid}/solution`, { lines: [] });
  c.deq(s2.data, s1.data, 'asking again is the same reply (idempotent)');

  // A question whose gate is closed (its own page is crossed by the report, or there is no report) gives no note, whatever lines are sent.
  {
    const got2 = await find(a, closed);
    c.ok(!!got2, `a worked-solution question with line feedback closed was issued (${closed.entry.id})`);
    const x = await post(a, `${got2.r.data.question.id}/solution`, { lines: typedLines(closed.entry.id) });
    c.ok(x.status === 200 && x.data.workNote === undefined, 'it gives no note on the working');
    // and with no working sent there is none for any question
    const got3 = await find(a, workedAll.find(w => w.entry.lineFeedback && w.place.ordinal !== null && !w.entry.diagram && w.entry.id !== target.entry.id));
    const y = await post(a, `${got3.r.data.question.id}/solution`, {});
    c.ok(y.status === 200 && y.data.workNote === undefined, 'with no working sent there is no note');
  }
  // A worked-solution question with a figure: the same route, the same checks (the figure shows nothing of his steps; the file is the pack's).
  {
    // The worked question with a figure that sits in the smallest pool (same sub-topic, dot point and level), so the seeded search below reaches it
    // within the request limit however many figures the pack holds.
    const poolOf = w => `${w.place.subtopic}|${w.place.ordinal}|${w.entry.level}`;
    const poolSize = new Map(); for (const w of workedAll) poolSize.set(poolOf(w), (poolSize.get(poolOf(w)) || 0) + 1);
    const withFig = workedAll.filter(w => w.entry.diagram && w.place.ordinal !== null).sort((x, y) => poolSize.get(poolOf(x)) - poolSize.get(poolOf(y)) || (x.entry.id < y.entry.id ? -1 : 1))[0];
    const gotF = await find(a, withFig);
    c.ok(!!gotF && gotF.r.data.question.diagram?.alt === withFig.entry.diagram.alt, `a worked-solution question with a figure was issued (${withFig.entry.id})`);
    const fig = await h.request(`/v1/practice/${gotF.r.data.question.id}/figure`, { jar: a.jar });
    c.ok(fig.status === 200, 'its figure is served to the account it was issued to');
    const figOther = await h.request(`/v1/practice/${gotF.r.data.question.id}/figure`, { jar: other.jar });
    c.eq(figOther.status, 404, 'and to no other');
  }
  // Not a counted practice question: no use of the free day's allowance, and a capped account is still dealt one. (No model is called either.)
  {
    const { PRACTICE_DAILY_SCOPE } = await import('../platform/practiceAllowance.js');
    const counter = acct => h.db.all("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=?", [acct.account.id, PRACTICE_DAILY_SCOPE]);
    const acct = await reg(4);
    const t = workedAll.find(w => w.place.ordinal !== null && !w.entry.diagram);
    let markedCount = 0, workedId = null;
    for (let seed = 1; seed < 40000 && !workedId; seed += 7) {
      const r = await issue(acct, { generator: t.place.subtopic, difficulty: t.entry.level, seed, worked: true });
      if (r.status !== 201) continue;
      if ((await sealedOf(acct, r.data.question.id)).answerType === 'manual') workedId = r.data.question.id; else markedCount++;
    }
    c.ok(!!workedId, 'a worked-solution question was issued');
    const used = async () => (await counter(acct)).map(r => JSON.parse(r.response_json).issued).reduce((a, b) => Math.max(a, b), 0);
    c.eq(await used(), markedCount, `the free day's allowance counts the ${markedCount} marked questions issued and not the worked-solution one`);
    const shownOne = await post(acct, `${workedId}/solution`);
    c.ok(shownOne.status === 200 && await used() === markedCount, 'and its solution uses none either');
    // Every issuing path: issue (above), repeat, twin and review use none of the allowance for a worked-solution question.
    {
      const before = await used();
      const rep = await post(acct, `${workedId}/repeat`);
      c.ok(rep.status === 201 && rep.data.repeat === true, 'a repeat of a completed worked-solution question is dealt');
      c.eq((await sealedOf(acct, rep.data.question.id)).answerType, 'manual', 'and it is a worked-solution question');
      c.eq(await used(), before, 'REPEAT: it uses none of the free day\'s allowance');
      // the control: a repeat of a marked question does count one
      let markedId = null;
      for (let seed = 1; seed < 40000 && !markedId; seed += 7) {
        const r = await issue(acct, { generator: t.place.subtopic, difficulty: t.entry.level, seed });
        if (r.status === 201 && (await sealedOf(acct, r.data.question.id)).answerType !== 'manual') markedId = r.data.question.id;
      }
      c.ok(!!markedId, 'a marked question was issued (the control)');
      await post(acct, `${markedId}/reveal`);
      const afterIssue = await used();
      c.eq((await post(acct, `${markedId}/repeat`)).status, 201, 'its repeat is dealt');
      c.eq(await used(), afterIssue + 1, 'and a marked question\'s repeat does use one (the control)');
      // REVIEW and TASK modes never deal a worked-solution question, on the very seeds where plain practice does.
      const seeds = [];
      for (let seed = 1; seed < 4000 && seeds.length < 8; seed += 7) {
        const r = await issue(acct, { generator: t.place.subtopic, difficulty: t.entry.level, seed, worked: true });
        if (r.status === 201 && (await sealedOf(acct, r.data.question.id))._worked) seeds.push(seed);
      }
      c.ok(seeds.length >= 3, `plain practice deals a worked-solution question on ${seeds.length} of the seeds tried`);
      const other = { review: 0, task: 0 };
      for (const mode of Object.keys(other)) for (const seed of seeds) {
        const r = await issue(acct, { generator: t.place.subtopic, difficulty: t.entry.level, seed, worked: true, mode });
        c.eq(r.status, 201, `${mode} mode issues a question on those seeds`);
        if ((await sealedOf(acct, r.data.question.id))._worked) other[mode]++;
      }
      c.deq(other, { review: 0, task: 0 }, 'REVIEW: review and task mode never deal a worked-solution question, on the seeds where plain practice does');
      // the lead-in the server uses for a seeked (unseeded) draw: manualAllowed is false outside plain practice.
      const { manualAllowed } = await import('../platform/practice.js');
      c.deq(['practice', 'review', 'task', 'rush', 'match', 'placement'].map(mode => manualAllowed({ mode, allowManual: true })), [true, false, false, false, false, false], 'only plain practice allows one');
      c.eq(manualAllowed({ mode: 'practice', allowManual: true, bank: false }), false, 'and not a timed paper');
      // TWIN: a wrong answer's twin is a marked question (a twin is review mode, never worked) and counts one.
      let twinChecked = false;
      for (let seed = 5; seed < 40000 && !twinChecked; seed += 11) {
        const r = await issue(acct, { generator: t.place.subtopic, difficulty: t.entry.level, seed });
        if (r.status !== 201) continue;
        const sq = await sealedOf(acct, r.data.question.id);
        if (sq.answerType === 'manual') continue;
        for (const sid of ['twin-wrong-a-' + seed, 'twin-wrong-b-' + seed]) await post(acct, `${r.data.question.id}/submit`, { submissionId: sid, answer: '987654321', mode: 'typed' }, { 'Idempotency-Key': sid });
        const ev = await h.db.get("SELECT id FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind='graded-attempt' ORDER BY rowid DESC LIMIT 1", [acct.account.id]);
        if (!ev) continue;
        const usedBefore = await used();
        const tw = await post(acct, `notebook/${ev.id}/twin`);
        if (tw.status !== 201) continue;
        c.eq((await sealedOf(acct, tw.data.question.id)).answerType === 'manual', false, 'TWIN: a twin is never a worked-solution question');
        c.eq(await used(), usedBefore + 1, 'and, being marked, it counts one');
        twinChecked = true;
      }
      c.ok(twinChecked, 'a twin was drawn and checked');
    }
  }
  // Accounting: completed, seen, nothing else.
  c.eq(await events(a), eventsBefore, 'no learning event, no graded attempt, no mastery, readiness or streak input is recorded');
  c.eq((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope IN ('practice-grade','practice-reveal')", [a.account.id])).n, 0, 'no grade and no reveal record');
  c.ok(!!(await h.db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [a.account.id, qid])), 'the question is completed');
  const known = await seenAmong(h.db, a.account.id, seenKeysOf(sealed), Date.now());
  c.ok(known.size > 0, 'and SEEN, so the no-repeat rule passes over it');
  c.eq((await post(a, `${qid}/hint`, { rung: 'nudge' })).status, 409, 'a completed worked question offers no more');
  c.eq((await post(a, `${qid}/reveal`)).status, 409, 'nor a reveal');
  const tables = await h.db.all("SELECT name FROM sqlite_master WHERE type='table'");
  c.ok(tables.length > 5, 'the store is real');

  // Never twice in a row, and never the same question while a fresh one exists, over the real routes.
  {
    const acct = await reg(3);
    const dealt = [];
    for (let i = 0; i < 200; i++) {
      const x = await issue(acct, { generator: target.place.subtopic, difficulty: target.entry.level });
      if (x.status !== 201) throw new Error(`issue ${i}: ${x.status}`);
      const s = await sealedOf(acct, x.data.question.id);
      dealt.push(s._worked ? s._bank : null);
      if (s._worked) await post(acct, `${x.data.question.id}/solution`);
      else await post(acct, `${x.data.question.id}/reveal`);
    }
    const w = dealt.filter(Boolean);
    c.ok(w.length > 0, `worked-solution questions are dealt (${w.length} of 200)`);
    c.ok(dealt.every((x, i) => !(x && dealt[i - 1])), 'never two in a row');
    c.eq(w.length - new Set(w).size, 0, 'and none twice');
    c.ok(w.length / 200 <= 0.25, `and not more than 1 in 4 (${(w.length / 200 * 100).toFixed(1)} percent)`);
  }
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK WORKED: PASS — ${c.count()}/${c.count()} checks over ${workedAll.length} worked-solution questions`);
process.exit(0);
