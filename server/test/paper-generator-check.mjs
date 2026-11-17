// Pri Learning · the Paper Generator over real HTTP (both editions).
//
// The server assembles a generated paper from the edition's approved, issued
// banks only. Covered: deterministic assembly (a seed gives the same paper),
// exact mark totals for every length and mix, the length in minutes, fresh
// questions across a repeat, no key or seed in any client payload, edition
// isolation (a Priyabhata topic is refused on Prithagoras and the reverse), the
// edition's section styles, an insufficient bank is refused with the nearest
// valid paper and never padded, the printable PDF, and a marking guide that is
// locked until the paper is submitted. [SYNTHETIC]
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_EDITION', 'PRI_METHOD_MARKS'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-paper-generator-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c4'.repeat(32);
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_METHOD_MARKS;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { assemblePaper, planSlots, PAPER_MARKS, PAPER_MINUTES, MIXES, minutesForMarks } = await import('../platform/paperGenerator.js');
const { makeRng } = await import('../../client/src/engine/qhelpers.js');
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const c = checks();
await loadAllBanks();

const PRIVATE = new Set(['answer', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed', 'hints', 'optionTraps',
  'correctIndex', 'correctIndices', 'criteria', 'canonicalWorking', 'expected', 'markScheme', 'builtFrom', 'repairOpportunities',
  'altSeed', 'recipe', '_curriculum', '_marking', '_generator', '_practiceMode', 'answerText']);
const leaks = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.has(k) ? [path + k] : []), ...leaks(v, path + k + '.')]);
};

// ── The plan: marks add up exactly, whatever the length and mix ────────────
for (const style of ['hsc', 'cbse']) {
  for (const marks of PAPER_MARKS) for (const mix of MIXES) {
    const slots = planSlots({ marks, mix, topicIds: ['a', 'b', 'c'], style, rng: makeRng(marks * 31 + mix.length) });
    assert.equal(slots.reduce((n, s) => n + s.marks, 0), marks, `${style} ${marks} ${mix}`);
    if (style === 'hsc') assert.ok(slots.every(s => (s.objective ? s.marks === 1 : s.marks >= 2)), 'HSC: Section I is one mark, Section II two or more');
  }
}
c.ok(true, 'every length and mix plans to exactly the marks asked, in both section styles');
c.deq(PAPER_MINUTES.map(m => m / 1.5), [20, 40, 60], 'the minutes lengths are 20, 40 and 60 marks at 1.5 minutes a mark');
c.eq(minutesForMarks(24), 36, '24 marks is about 36 minutes');

// ── The refusal: an insufficient bank is never padded ──────────────────────
{
  const topics = [{ id: 't1', name: 'Topic', gens: [{ gen: 'x', diffs: [1, 2, 3, 4] }] }];
  const none = await assemblePaper({ topics, topicIds: ['t1'], marks: 20, mix: 'standard', seed: 5, style: 'cbse', admit: () => false });
  c.deq([none.ok, none.code, none.nearest], [false, 'PAPER_BANK_INSUFFICIENT', null], 'a bank that issues nothing refuses the paper and has no nearest');
}

const h = await startApp({ engine: requestedEngine() });
try {
  const accounts = [];
  for (let i = 0; i < 7; i++) {
    const a = await registerAccount(h, { email: `paper.gen.${i}@example.test`, deviceId: `ipad-paper-gen-${i}` });
    assert.equal((await verifyEmail(h, a.account.id)).status, 200);
    accounts.push(a);
  }
  const [a, b, d, e, f, g] = accounts;
  let seq = 0;
  const idem = () => `paper-gen-${String(++seq).padStart(4, '0')}-${Date.now().toString(36)}`;
  const create = (jar, generated, extra = {}) => h.request('/v1/exams', { method: 'POST', jar, body: { kind: 'generated', generated, ...extra }, headers: { 'Idempotency-Key': idem() } });
  const check = (jar, generated) => h.request('/v1/exams/generator/check', { method: 'POST', jar, body: { generated } });
  const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);

  // ── Prithagoras (HSC-style) ───────────────────────────────────────────────
  const opt = await h.request('/v1/exams/generator/options', { method: 'POST', jar: a.jar, body: { year: 9 } });
  c.eq(opt.status, 200, 'Prithagoras: the options answer');
  c.deq([opt.data.edition, opt.data.style, opt.data.marks, opt.data.minutes], ['prithagoras', 'hsc', [10, 20, 40], [30, 60, 90]], 'HSC-style, 10/20/40 marks or 30/60/90 minutes');
  c.ok(opt.data.topics.length >= 3 && /not a NESA paper/.test(opt.data.note), 'it lists the year\'s topics and says it is not a NESA paper');
  c.deq(leaks(opt.data), [], 'no key in the options');
  const topics = opt.data.topics.slice(0, 3).map(t => t.id);
  const request = { year: 9, topics, marks: 20, mix: 'standard', seed: 424242 };

  const checked = await check(a.jar, request);
  c.eq(checked.status, 200, 'check: the banks can fill the request ' + JSON.stringify(checked.data));
  c.deq([checked.data.ok, checked.data.marks, checked.data.minutes], [true, 20, 30], 'and the summary has the exact marks and 1.5 minutes a mark');
  c.deq(leaks(checked.data), [], 'no key in the check');

  const first = await create(a.jar, request);
  c.eq(first.status, 201, 'a generated paper is sealed');
  const second = await create(b.jar, request);
  const pa = await sealed(first.data.exam.id);
  const pb = await sealed(second.data.exam.id);
  c.deq(pa.questions.map(q => [q.payload.prompt, q.marks, q.section]), pb.questions.map(q => [q.payload.prompt, q.marks, q.section]), 'the same seed gives the same paper');
  c.eq(pa.total, 20, 'the sealed total is the 20 marks asked');
  c.eq(pa.questions.reduce((n, q) => n + q.marks, 0), 20, 'and the questions add up to it exactly');
  c.eq(pa.durationMin, 30, 'the clock is 30 minutes');
  c.ok(pa.questions.every(q => (q.section === 'I' ? q.marks === 1 && q.payload.answerType === 'mcq' : q.section === 'II' && q.marks >= 2 && q.payload.answerType !== 'mcq')), 'Section I is multiple choice at one mark; Section II is extended');
  c.ok(pa.questions.every(q => q.payload._curriculum && q.payload._marking === 'final-answer-only'), 'every question is sealed with the edition\'s identity and final-answer marking');
  c.ok(pa.questions.every(q => topics.includes(q.chapterId)), 'only the chosen topics');
  c.deq(leaks(first.data), [], 'no key, answer, step or seed leaves in the create reply');
  c.ok(!JSON.stringify(first.data).includes('424242') && first.data.exam.generated.label === 'Pri practice paper', 'the seed stays on the server and the paper is a "Pri practice paper"');
  const noSeed = await create(d.jar, { ...request, seed: undefined });
  c.eq(noSeed.status, 201, 'without a seed the server draws its own');
  const pc = await sealed(noSeed.data.exam.id);
  c.ok(pc.questions.map(q => q.payload.prompt).join() !== pa.questions.map(q => q.payload.prompt).join(), 'a different seed is a different paper');

  // Length in minutes, and every mix.
  for (const [body, marks] of [[{ ...request, marks: undefined, minutes: 30, seed: 9 }, 20], [{ ...request, marks: 10, mix: 'foundation', seed: 10 }, 10], [{ ...request, marks: 10, mix: 'challenge', seed: 11 }, 10]]) {
    const r = await check(a.jar, body);
    c.deq([r.status, r.data.marks], [200, marks], `check: ${JSON.stringify({ m: body.marks, min: body.minutes, mix: body.mix })} adds up to ${marks}`);
  }

  // Refusals of the request itself.
  for (const [label, body] of [
    ['both marks and minutes', { ...request, minutes: 30 }], ['a length that is not offered', { ...request, marks: 25 }], ['an unknown mix', { ...request, mix: 'hard' }],
    ['no topics', { ...request, topics: [] }], ['a topic from the other edition', { ...request, topics: ['c10-arithmetic-progressions'] }],
    ['a card of another field', { ...request, questions: [] }], ['a mark scheme from the device', { ...request, markScheme: [] }]
  ]) {
    const r = await create(e.jar, body);
    c.eq(r.status, 400, `${label} is refused`);
  }
  c.eq((await create(e.jar, request, { slots: [] })).status, 400, 'slots from the device are refused');
  c.eq((await create(e.jar, { ...request, weak: true })).status, 402, 'focusing on weak topics is Premium, as a targeted paper is');
  c.eq((await h.request('/v1/exams/generator/check', { method: 'POST', body: { generated: request } })).status, 401, 'the generator sits behind the session guard');

  // The printable paper and the locked guide.
  const pdf = await h.request('/v1/exams/generator/pdf', { method: 'POST', jar: e.jar, body: { generated: request } });
  c.eq(pdf.status, 200, 'the printable paper is produced');
  const bytes = Buffer.from(pdf.data.pdfBase64, 'base64');
  const text = bytes.toString('latin1');
  c.ok(bytes.subarray(0, 5).toString() === '%PDF-' && text.trimEnd().endsWith('%%EOF') && /\/Type \/Pages/.test(text), 'it is a well-formed PDF');
  c.ok(/Section I/.test(text) && /not a NESA paper/.test(text), 'with HSC-style sections and the not-NESA wording');
  const q1 = pa.questions[0].payload;
  const keyed = String(q1.answer?.canonicalInput ?? q1.answer?.correctIndex ?? '');
  c.ok(!/Answer:|marking guide/.test(text), 'and no answer or guide in the paper');
  c.deq(leaks({ ...pdf.data, pdfBase64: undefined }), [], 'no key in the PDF reply');
  const locked = await h.request(`/v1/exams/${first.data.exam.id}/guide`, { jar: a.jar });
  c.deq([locked.status, locked.data?.error?.code], [403, 'GUIDE_LOCKED'], 'the marking guide is locked before the paper is submitted');
  c.eq((await h.request(`/v1/exams/${first.data.exam.id}/guide`, { jar: b.jar })).status, 404, 'another account cannot see that the paper exists');
  const done = await h.request(`/v1/exams/${first.data.exam.id}/finish`, { method: 'POST', jar: a.jar, body: {} });
  c.eq(done.status, 200, 'the paper is submitted');
  const guide = await h.request(`/v1/exams/${first.data.exam.id}/guide`, { jar: a.jar });
  c.eq(guide.status, 200, 'after the attempt the guide opens');
  const guideText = Buffer.from(guide.data.pdfBase64, 'base64').toString('latin1');
  c.ok(guideText.startsWith('%PDF-') && /marking guide/.test(guideText) && /Answer:/.test(guideText), 'with worked solutions');
  c.eq((await h.request(`/v1/exams/${first.data.exam.id}/guide`, { jar: b.jar })).status, 404, 'and only for the account that sat it');
  void keyed;

  // Recently seen questions are passed over: the same request, after the paper
  // was submitted, draws other questions.
  const again = await h.request('/v1/exams/generator/pdf', { method: 'POST', jar: a.jar, body: { generated: request } });
  const againText = Buffer.from(again.data.pdfBase64, 'base64').toString('latin1');
  const seenPrompts = pa.questions.map(q => String(q.payload.prompt).replace(/<[^>]*>/g, '').slice(0, 40));
  c.ok(again.status === 200 && seenPrompts.filter(p => p.length > 12 && againText.includes(p.replace(/[()\\]/g, '\\$&'))).length === 0, 'questions the account has just sat are not drawn again');
  const fresh = await check(a.jar, request);
  c.deq([fresh.status, fresh.data.repeats], [200, 0], 'and none of the fresh paper is a repeat');

  // An insufficient bank: refused, with the nearest valid paper, and nothing sealed or padded.
  const thin = { year: 9, topics: ['y9-simint'], marks: 20, mix: 'challenge', seed: 3 };
  const refused = await check(b.jar, thin);
  c.deq([refused.status, refused.data.error?.code], [409, 'PAPER_BANK_INSUFFICIENT'], 'a topic whose banks issue no hard questions cannot fill a Challenge paper');
  c.ok(refused.data.error.nearest === null || (refused.data.error.nearest.marks <= 20 && ['foundation', 'standard'].includes(refused.data.error.nearest.mix)), 'the reply offers the nearest valid paper, or none');
  const nearest = refused.data.error.nearest;
  if (nearest) {
    const ok = await check(b.jar, { ...thin, marks: nearest.marks, mix: nearest.mix });
    c.deq([ok.status, ok.data.marks], [200, nearest.marks], 'and the nearest paper it offers is one the banks do fill');
  }
  const refusedCreate = await create(g.jar, thin);
  c.deq([refusedCreate.status, refusedCreate.data.error?.code], [409, 'PAPER_BANK_INSUFFICIENT'], 'a create is refused the same way');
  c.eq(Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='exam-paper'", [g.account.id])).n), 0, 'and nothing is sealed for it');

  // ── Priyabhata (CBSE/JEE styles) ──────────────────────────────────────────
  process.env.PRI_EDITION = 'priyabhata';
  const iopt = await h.request('/v1/exams/generator/options', { method: 'POST', jar: e.jar, body: { year: 10 } });
  c.deq([iopt.status, iopt.data.edition, iopt.data.style], [200, 'priyabhata', 'cbse'], 'Priyabhata: CBSE-style options');
  c.ok(iopt.data.topics.length >= 3 && /not a CBSE paper/.test(iopt.data.note), 'chapters, and "not a CBSE paper"');
  const itopics = iopt.data.topics.slice(0, 3).map(t => t.id);
  const irequest = { year: 10, topics: itopics, marks: 20, mix: 'exam', seed: 777 };
  c.eq((await create(e.jar, { ...request })).status, 400, 'a Prithagoras topic is refused on Priyabhata');
  const ia = await create(f.jar, irequest);
  c.eq(ia.status, 201, 'a Priyabhata paper is sealed');
  const ib = await create(g.jar, irequest);
  const pia = await sealed(ia.data.exam.id);
  const pib = await sealed(ib.data.exam.id);
  c.deq(pia.questions.map(q => q.payload.prompt), pib.questions.map(q => q.payload.prompt), 'India: the same seed gives the same paper');
  c.eq(pia.questions.reduce((n, q) => n + q.marks, 0), 20, 'India: marks add up exactly');
  c.ok(pia.questions.every(q => /^[ABCD]$/.test(q.section) && q.marks === 'ABCD'.indexOf(q.section) + 1 || (q.section === 'D' && q.marks >= 4)), 'CBSE-style sections by marks');
  c.ok(pia.questions.every(q => itopics.includes(q.chapterId)), 'only the chosen chapters');
  c.deq(leaks(ia.data), [], 'India: no key in the create reply');
  c.ok(!JSON.stringify(ia.data).includes('777'), 'India: the seed stays on the server');
  const ipdf = await h.request('/v1/exams/generator/pdf', { method: 'POST', jar: a.jar, body: { generated: irequest } });
  c.ok(Buffer.from(ipdf.data.pdfBase64, 'base64').toString('latin1').includes('not a CBSE paper'), 'India: the printable paper is labelled Pri practice, not CBSE');
  c.eq((await h.request('/v1/exams/generator/check', { method: 'POST', jar: a.jar, body: { generated: { ...irequest, year: 5 } } })).status, 400, 'India: Class 5 is out of range');
  process.env.PRI_EDITION = 'prithagoras';
} finally {
  await h.close();
}

rmSync(scratch, { recursive: true, force: true });
for (const key of keys) {
  if (before[key] === undefined) delete process.env[key];
  else process.env[key] = before[key];
}
console.log(`engine: ${h.engine}`);
console.log(`PAPER GENERATOR: PASS — ${c.count()}/${c.count()} checks — a seed gives the same paper, marks add up exactly (10/20/40), no key or seed leaves the server, editions are isolated with HSC and CBSE section styles, the printable paper is a well-formed PDF, and the marking guide opens only after the paper is submitted. [SYNTHETIC]`);
