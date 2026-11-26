// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the AI line check over the real submit path (R4), with a FAKE provider
//
// Boots the shipped /v1 app as Prithagoras, issues real generated questions, submits real pages, and compares each reply with the layer OFF and ON:
//   · the marks are IDENTICAL on and off, for every page (correct, resolved, marksEarned, marksPossible, partial, method criteria, credited marks)
//   · every line the engine judged is byte-identical on and off; a line the layer added is an engine tick or carries `ai` on a `note` line
//   · the reply is stored with the AI lines, and replaying the same request returns the same bytes without a second provider call
//   · Rush (a sealed context) never reaches the provider; the layer off never reaches it
//   · a provider failure leaves exactly the report of the layer off
//
//   node server/test/ai-line-check-http-check.mjs
// SYNTHETIC: generated questions, a scripted client and a scripted provider. Not evidence about real students or about the real model.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR', 'PRI_FEATURE_AI_LINE_CHECK',
  'PRI_HANDWRITING_API_KEY', 'PRI_HANDWRITING_ENDPOINT', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_LINE_CHECK_PER_USER_DAILY', 'PRI_AI_LINE_CHECK_GLOBAL_DAILY'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-ai-line-http-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'd5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_QBANK_DIR = 'off';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const G = await import('../../client/src/engine/generators/index.js');
const { authoredLines } = await import('../platform/genericSteps.js');
await G.loadAllBanks();

const c = checks();
const realFetch = globalThis.fetch;
const provider = { calls: 0, mode: 'mixed', bodies: [] };
globalThis.fetch = (url, init) => {
  if (!String(url).startsWith('https://provider.test/')) return realFetch(url, init);
  provider.calls++;
  const body = JSON.parse(init.body);
  provider.bodies.push(body);
  if (provider.mode === 'fail') return Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
  const data = JSON.parse(body.input[1].content[0].text.split('Data (JSON):\n')[1]);
  const claim = { kind: 'unparseable', quantity: 'none', subject: '', label: '', at: '', parts: [] };
  // a scripted model that is deliberately unreliable: it ticks, doubts and abstains in turn, and tries to speak for lines it was not asked about
  const items = data.check.map((index, k) => ({ index, verdict: ['correct', 'incorrect', 'cannot_tell'][(index + k) % 3], comment: 'Consistent with the line above.', wrong_span: '', corrected_rhs: '', claim }));
  items.push({ index: 0, verdict: 'correct', comment: 'extra', wrong_span: '', corrected_rhs: '', claim });
  return Promise.resolve({ ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ lines: items }), usage: { input_tokens: 800, output_tokens: 120 } }), text: async () => '' });
};

const studentPage = q => ['Let k = 7, m = 3', ...authoredLines(q).map(l => l.text), 'At x = 2: k + m = 10 so the working holds'];
const FORMS = [['y12-appdiff', 3, 1], ['y12-appdiff', 3, 2], ['y12-appdiff', 2, 3], ['y11-linear', 2, 4], ['y12-integration', 3, 5], ['y11-trig-ratios', 2, 6], ['y12-exp', 3, 7], ['y11-quadratics', 3, 8]];
const available = FORMS.filter(([g, d, s]) => { try { return authoredLines(G.generateQuestion(g, d, s)).length >= 2; } catch { return false; } });
c.ok(available.length >= 4, `at least four forms have an authored page to submit (${available.length})`);

const h = await startApp({ engine: requestedEngine() });
try {
  // the provider and its limits are set after boot (the server reads them per request)
  const setLayer = on => {
    process.env.PRI_HANDWRITING_API_KEY = 'k'.repeat(32);
    process.env.PRI_HANDWRITING_ENDPOINT = 'https://provider.test/v1/responses';
    process.env.PRI_PAID_CALLS_PER_HOUR = '100000'; process.env.PRI_PAID_CALLS_PER_DAY = '100000';
    process.env.PRI_AI_LINE_CHECK_PER_USER_DAILY = '1000'; process.env.PRI_AI_LINE_CHECK_GLOBAL_DAILY = '100000';
    if (on) process.env.PRI_FEATURE_AI_LINE_CHECK = '1'; else delete process.env.PRI_FEATURE_AI_LINE_CHECK;
  };
  const a = await registerAccount(h, { email: 'ai.line.http@example.test', deviceId: 'ipad-ai-line' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer, steps) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps } });
  const marksOf = r => JSON.stringify({ correct: r.correct, resolved: r.resolved, marksEarned: r.marksEarned, marksPossible: r.marksPossible, creditedMarks: r.creditedMarks, partial: r.partial, methodCriteria: r.methodCriteria ?? null, methodScheme: r.methodScheme ?? null, markRows: r.markRows ? { ...r.markRows, identity: null } : null, feedback: r.feedback, trapWhy: r.trapWhy });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);

  let pages = 0, withAi = 0, withEngine = 0, tag = 0;
  const everyReply = [];
  for (const [g, d, s] of available) {
    const q0 = G.generateQuestion(g, d, s);
    // a student's page: the authored lines, with the words a student writes around them (lines the engine leaves open)
    const lines = studentPage(q0);
    const key = String(q0.answer?.value ?? '');
    // a true page, and the same page with a wrong middle line and a wrong final answer
    const variants = [['true', lines, key], ['wrong', lines.map((l, i) => (i === Math.floor(lines.length / 2) ? l.replace(/\d+/, n => String(Number(n) + 1)) : l)), key === '' ? '99991' : '99991']];
    for (const [name, page, answer] of variants) {
      const once = async on => {
        setLayer(on);
        const r = await issue({ generator: g, difficulty: d, seed: s });
        if (r.status !== 201) return null;
        const qid = r.data.question.id;
        const calls0 = provider.calls;
        tag++;
        let id = `ailine-p${tag}-1`;
        let reply = await submit(qid, id, answer, page.join('\n'));
        if (!reply.data.resolved) { id = `ailine-p${tag}-2`; reply = await submit(qid, id, answer, page.join('\n')); }
        return { qid, reply, replyData: reply.data, called: provider.calls - calls0, id };
      };
      const off = await once(false);
      const on = await once(true);
      if (!off || !on) continue;
      pages++;
      const label = `${g} d${d} s${s} ${name}`;
      c.eq(off.called, 0, `${label}: the layer off never reaches the provider`);
      c.eq(marksOf(on.replyData), marksOf(off.replyData), `${label}: marks, partial, criteria and feedback are IDENTICAL with the layer on and off`);
      const offLines = off.replyData.stepReport?.lines || [], onLines = on.replyData.stepReport?.lines || [];
      if (on.called > 0) {
        c.ok(on.called === 1, `${label}: one provider call for the page`);
        c.ok(onLines.length >= offLines.length, `${label}: the page keeps every line`);
        const changed = onLines.filter((l, i) => JSON.stringify(l) !== JSON.stringify(offLines[i]));
        c.ok(changed.every((l, i) => l.ai || l.fromAiLayer), `${label}: a line differs only if the layer spoke on it`);
        c.ok(onLines.every((l, i) => !(offLines[i]?.status === 'ok' || offLines[i]?.status === 'break') || JSON.stringify(l) === JSON.stringify(offLines[i])), `${label}: every engine tick and cross is byte-identical`);
        c.ok(onLines.every((l, i) => !l.ai || (l.status === 'note' && offLines[i]?.status === 'note')), `${label}: an AI line is a note line, never a tick or a cross`);
        c.ok(on.replyData.stepReport?.firstBreak === off.replyData.stepReport?.firstBreak, `${label}: the first break is the engine's`);
        if (onLines.some(l => l.ai)) withAi++;
        if (onLines.some(l => l.fromAiLayer)) withEngine++;
        // the reply is stored with the AI lines, and a replay is the same bytes with no second call
        const stored = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-grade' AND key=?", [a.account.id, `${on.qid}:${on.id}`]))?.response_json || 'null');
        c.ok(stored && JSON.stringify(stored.stepReport) === JSON.stringify(on.replyData.stepReport), `${label}: the stored reply carries the same page`);
        const calls1 = provider.calls;
        const replay = await submit(on.qid, on.id, answer, page.join('\n'));
        c.eq(JSON.stringify(replay.data), JSON.stringify(on.replyData), `${label}: a replay is byte-identical`);
        c.eq(provider.calls, calls1, `${label}: a replay makes no provider call`);
      } else {
        c.eq(JSON.stringify(on.replyData.stepReport ?? null), JSON.stringify(off.replyData.stepReport ?? null), `${label}: no line open for the layer: the page is exactly as before`);
      }
      everyReply.push(on.replyData);
    }
  }
  c.ok(pages >= 8, `at least eight pages were compared (${pages})`);
  c.ok(withAi + withEngine > 0, `the layer spoke on at least one page (${withAi} with AI lines, ${withEngine} with engine proofs)`);
  c.ok(!everyReply.some(r => JSON.stringify(r).includes('extra')), 'the model\'s attempt to speak for a line it was not asked about reached no page');

  // a failing provider leaves exactly the layer-off page
  provider.mode = 'fail';
  {
    const [g, d, s] = available[0];
    const q0 = G.generateQuestion(g, d, s);
    const page = studentPage(q0);
    setLayer(false);
    const r0 = await issue({ generator: g, difficulty: d, seed: s });
    let off = await submit(r0.data.question.id, 'ailine-f-off', String(q0.answer?.value ?? ''), page.join('\n'));
    if (!off.data.resolved) off = await submit(r0.data.question.id, 'ailine-f-off-2', String(q0.answer?.value ?? ''), page.join('\n'));
    setLayer(true);
    const r1 = await issue({ generator: g, difficulty: d, seed: s });
    const calls0 = provider.calls;
    let on = await submit(r1.data.question.id, 'ailine-f-on', String(q0.answer?.value ?? ''), page.join('\n'));
    if (!on.data.resolved) on = await submit(r1.data.question.id, 'ailine-f-on-2', String(q0.answer?.value ?? ''), page.join('\n'));
    c.ok(provider.calls > calls0, 'the failing provider was asked');
    c.eq(JSON.stringify(on.data.stepReport ?? null), JSON.stringify(off.data.stepReport ?? null), 'a provider failure: the page is exactly what it is with the layer off');
    c.eq(marksOf(on.data), marksOf(off.data), 'and so are the marks');
  }
  provider.mode = 'mixed';

  // a sealed context: Rush never reaches the provider
  {
    setLayer(true);
    const [g, d, s] = available[0];
    const q0 = G.generateQuestion(g, d, s);
    const page = studentPage(q0);
    const r = await issue({ generator: g, difficulty: d, seed: s, mode: 'rush' });
    if (r.status === 201) {
      const calls0 = provider.calls;
      const reply = await submit(r.data.question.id, 'ailine-rush-1', String(q0.answer?.value ?? ''), page.join('\n'));
      c.eq(provider.calls, calls0, 'Rush is sealed: no provider call');
      c.ok(!JSON.stringify(reply.data).includes('"ai"') && !JSON.stringify(reply.data).includes('fromAiLayer'), 'and no AI line on its page');
    } else c.ok(true, `Rush is not issued here (${r.status}); the static check pins the mode list`);
  }
} finally {
  globalThis.fetch = realFetch;
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
}
console.log(`engine: ${h.engine}`);
console.log(`AI LINE CHECK OVER HTTP: PASS — ${c.count()}/${c.count()} checks — marks identical on and off, engine lines untouched, replay stable, Rush sealed, failure shows today's page`);
