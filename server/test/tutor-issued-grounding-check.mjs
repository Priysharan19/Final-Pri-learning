// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor grounded in a SERVER-ISSUED question, over real HTTP
//
// A server-issued practice question (/v1/practice/issue) leaves the device with
// no answer and no solution, so the device cannot describe a "verified
// solution" to /v1/tutor — and must not be believed if it tries. The body names
// the issued question (`serverQuestionId`) and the server grounds the help in
// its own escrowed copy, read for the signed-in account only.
//
// This suite boots the whole shipped /v1 app (SQLite, or Postgres with
// --engine=postgres) and a local fake of the Responses API. It proves:
//
//   1. no session → 401, and nothing reaches the provider;
//   2. another account's issued question id → 404 on /help and /stream, the
//      same as an id that never existed, and nothing reaches the provider;
//   3. the owner gets model help that was grounded on the server: the provider
//      was sent the verified solution, the device sent none;
//   4. a body that names an issued question AND supplies a solution is refused;
//   5. while the question is unresolved, no reply carries the answer or the
//      final solution: a reply that states the root is replaced by the authored
//      hint on /help and on /stream, even when the device claims its own
//      (correct) final line was "verified";
//   6. the walkthrough level, whose captions restate the solution, is refused
//      until the server has resolved the question — and allowed afterwards;
//   7. a device question (no serverQuestionId) is still served as before.
//
// The root is known to the test only by solving the PUBLIC prompt itself.
// No model, no key, no network beyond 127.0.0.1, no spend.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ── A fake Responses API on localhost: JSON, or SSE when asked to stream ─────
const providerCalls = [];
let nextReply = null;
const provider = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    let body = null;
    try { body = JSON.parse(raw); } catch { /* recorded as null */ }
    providerCalls.push({ body });
    const reply = nextReply || { message: 'Decide which side should keep the unknown, and say why.', references_step_index: 0, reveals_answer: false };
    if (body?.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: reply.message })}\n\n`);
      res.end(`data: ${JSON.stringify({ type: 'response.completed' })}\n\n`);
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ output_text: JSON.stringify(reply) }));
  });
});
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));

const names = [
  'NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FEATURE_TUTOR',
  'PRI_HANDWRITING_API_KEY', 'PRI_TUTOR_ENDPOINT', 'PRI_TUTOR_MODEL', 'PRI_PAID_CALLS_PER_HOUR',
  'PRI_PAID_CALLS_PER_DAY', 'PRI_TUTOR_CALLS_PER_ACCOUNT_DAY'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-tutor-issued-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6a'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_FEATURE_TUTOR = '1';
process.env.PRI_HANDWRITING_API_KEY = 'k-issued-grounding-test-only';
process.env.PRI_TUTOR_ENDPOINT = `http://127.0.0.1:${provider.address().port}/v1/responses`;
process.env.PRI_TUTOR_MODEL = 'grounding-model';
process.env.PRI_PAID_CALLS_PER_HOUR = '10000';
process.env.PRI_PAID_CALLS_PER_DAY = '100000';
process.env.PRI_TUTOR_CALLS_PER_ACCOUNT_DAY = '1000';

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');

const c = checks();
const h = await startApp({ engine: requestedEngine() });

const issue = (jar, seed) => h.request('/v1/practice/issue', {
  method: 'POST', jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }
});
const help = (jar, body) => h.request('/v1/tutor/help', { method: 'POST', jar, body });
const stream = (jar, body) => h.request('/v1/tutor/stream', { method: 'POST', jar, headers: { Accept: 'text/event-stream' }, body });
const ask = (serverQuestionId, over = {}) => ({ context: 'practice', level: 'nudge', locale: 'en', serverQuestionId, studentWork: { lines: [] }, ...over });
const sseEvents = text => String(text || '').split(/\n\n/).filter(Boolean).map(block => ({
  event: (block.match(/^event: (.*)$/m) || [])[1],
  data: JSON.parse((block.match(/^data: (.*)$/m) || [null, 'null'])[1])
}));
/** Every key anywhere in a JSON value. */
const keysOf = value => !value || typeof value !== 'object' ? []
  : Array.isArray(value) ? value.flatMap(keysOf)
  : Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
const SOLUTION_KEYS = ['question', 'answer', 'answerText', 'solution', 'solutionText', 'steps', 'criteria', 'expected', 'markScheme'];

try {
  const a = await registerAccount(h, { email: 'tutor.issued.a@example.test', deviceId: 'ipad-issued-a' });
  c.eq(a.status, 201, 'the first student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const b = await registerAccount(h, { email: 'tutor.issued.b@example.test', deviceId: 'ipad-issued-b' });
  c.eq(b.status, 201, 'the second student account exists');
  c.eq((await verifyEmail(h, b.account.id)).status, 200, 'and is verified');

  const issued = await issue(a.jar, 104729);
  c.eq(issued.status, 201, 'the server issues a question to the first account');
  const qid = issued.data.question.id;
  const publicQ = issued.data.question;
  for (const key of ['answer', 'solution', 'steps', 'solutionText']) c.ok(!(key in publicQ), `the issued public question has no ${key}`);
  const { variable, root } = solveLinearPrompt(publicQ.prompt);
  // The root as a reply might state it, in the forms a student would recognise.
  const statesRoot = text => new RegExp(`${variable}\\s*=\\s*\\$?\\s*${String(root).replace('-', '[-−]')}(?![0-9/]|\\.[0-9])`).test(String(text || ''));
  c.ok(statesRoot(`so ${variable} = ${root}.`), 'the test can recognise a stated root');

  // ── 1 · no session ─────────────────────────────────────────────────────────
  c.eq((await help({}, ask(qid))).status, 401, 'help for an issued question needs a session');
  c.eq((await stream({}, ask(qid))).status, 401, 'and so does a stream');
  c.eq(providerCalls.length, 0, 'nothing reached the provider');

  // ── 2 · another account's question ─────────────────────────────────────────
  const foreign = await help(b.jar, ask(qid));
  c.eq(foreign.status, 404, 'a second account cannot ask about the first account\'s issued question');
  c.eq(foreign.data?.error?.code, 'TUTOR_QUESTION_NOT_FOUND', 'coded as not found');
  const never = await help(b.jar, ask(randomUUID()));
  c.eq(never.status, 404, 'exactly as for an id that was never issued');
  c.eq(JSON.stringify(never.data), JSON.stringify(foreign.data), 'with an identical body: existence is not disclosed');
  const foreignStream = await stream(b.jar, ask(qid));
  c.eq(foreignStream.status, 404, 'the stream refuses it too, as JSON before any event');
  c.eq(foreignStream.data?.error?.code, 'TUTOR_QUESTION_NOT_FOUND', 'with the same code');
  c.eq((await help(b.jar, ask(qid, { level: 'walkthrough', captions: [{ id: 'c1', text: 'Collect the terms: $2x = 8$.' }] }))).status, 404,
    'and the walkthrough level does not get past the account check either');
  c.eq(providerCalls.length, 0, 'none of it reached the provider');

  // ── 3 · the owner is helped, grounded on the server ────────────────────────
  const first = await help(a.jar, ask(qid));
  c.eq(first.status, 200, 'the owner gets help for the issued question');
  c.eq(first.data?.tutor?.source, 'model', 'in the model\'s words');
  c.eq(first.data?.tutor?.level, 'nudge', 'at the level asked for');
  c.eq(providerCalls.length, 1, 'which took one provider call');
  const wire = JSON.stringify(providerCalls[0].body);
  c.ok(wire.includes('VERIFIED SOLUTION'), 'the provider request is grounded in a verified solution');
  c.ok(wire.includes('Collect variable terms'), 'that the server read from its own issued question — the device sent none');
  for (const secret of ['tutor.issued.a@example.test', a.account.id, qid]) c.ok(!wire.includes(secret), 'the provider is sent no identifier');
  const leakedKeys = keysOf(first.data).filter(key => SOLUTION_KEYS.includes(key));
  c.eq(leakedKeys.join(','), '', 'the reply carries no question, answer or solution field');
  c.ok(!statesRoot(JSON.stringify(first.data)), 'and does not state the root');
  const again = await help(a.jar, ask(qid));
  c.eq(again.data?.tutor?.cached, true, 'an identical ask is answered from the cache');
  c.eq(providerCalls.length, 1, 'without another provider call');
  c.eq((await help(b.jar, ask(qid))).status, 404, 'and the cached reply is still not served to another account');

  // ── 4 · a device may not describe an issued question's solution ────────────
  const forged = await help(a.jar, ask(qid, { question: { prompt: publicQ.prompt, steps: [{ h: 'Guess', d: `$${variable}=1$` }], answer: '1' } }));
  c.eq(forged.status, 400, 'naming an issued question and supplying a solution is refused');
  c.eq(forged.data?.error?.code, 'TUTOR_BODY_INVALID', 'as an invalid body');
  c.eq((await help(a.jar, ask('not-a-uuid'))).status, 400, 'a malformed issued id is refused');
  c.eq((await help(a.jar, ask(qid, { questionId: 'some-other-question' }))).status, 400, 'as is a second, different question id');
  c.eq((await help(a.jar, ask(qid, { context: 'exam' }))).data?.error?.code, 'TUTOR_EXAM_LOCKED', 'exam context is still refused first');
  c.eq(providerCalls.length, 1, 'none of them reached the provider');

  // ── 5 · unresolved: the answer and final solution never come back ──────────
  nextReply = { message: `Collect the terms and you will find ${variable} = ${root}.`, references_step_index: 2, reveals_answer: false };
  const before5 = providerCalls.length;
  const leak = await help(a.jar, ask(qid, { level: 'socratic' }));
  c.eq(leak.status, 200, 'a reply that states the root is still answered');
  c.eq(leak.data?.tutor?.source, 'fallback', 'but by the fallback, not the model');
  c.eq(leak.data?.tutor?.reason, 'TUTOR_ANSWER_GUARD', 'because the answer guard caught it');
  c.ok(publicQ.hints.includes(leak.data?.tutor?.message), 'with one of the question\'s own public hints');
  c.ok(!statesRoot(JSON.stringify(leak.data)), 'and the root is nowhere in the response');
  c.eq(providerCalls.length, before5 + 2, 'after the one regeneration the guard allows');

  // The device claims the student's own final line — the root — is verified.
  // For a device question that claim excuses the result; for an issued question
  // the server does not take the device's word, so the root is still withheld.
  // (Worded so that only the excuse, not the step-result rule, could let it through.)
  nextReply = { message: `Yes, the value you found, ${root}, is right.`, references_step_index: 3, reveals_answer: false };
  const claimed = await help(a.jar, ask(qid, {
    level: 'socratic', studentWork: { lines: [String(root)], typedAnswer: String(root), verifiedLines: 1, firstBreak: -1 }
  }));
  c.eq(claimed.status, 200, 'an ask that carries the root as "verified" working is answered');
  c.eq(claimed.data?.tutor?.source, 'fallback', 'but a reply confirming the root is replaced');
  c.ok(!/is right/.test(JSON.stringify(claimed.data)), 'so a tutor turn cannot be used to test a guessed answer');
  // Nor does the server's own Step Check excuse it before resolution: a full,
  // genuinely correct working still does not make the tutor say the root.
  const worked = await help(a.jar, ask(qid, {
    level: 'socratic', studentWork: { lines: [publicQ.prompt.replace(/\$/g, ''), `${variable}=${root}`, String(root)] }
  }));
  c.eq(worked.data?.tutor?.source, 'fallback', 'correct working does not unlock the answer from the tutor either');
  c.ok(!/is right/.test(JSON.stringify(worked.data)), 'the mark, not the tutor, is what confirms an answer');

  // The final solution line, verbatim, is a leak as well.
  nextReply = { message: `The last line of the solution is $${variable}=${root}$.`, references_step_index: 3, reveals_answer: false };
  const finalLine = await help(a.jar, ask(qid, { level: 'nudge', studentWork: { lines: ['1=1'] } }));
  c.eq(finalLine.data?.tutor?.source, 'fallback', 'the final solution line is replaced too');
  c.ok(!statesRoot(JSON.stringify(finalLine.data)), 'and never reaches the student');

  // The stream: every released event is guarded the same way.
  nextReply = { message: `Almost there. So ${variable} = ${root}. Well done.` };
  const streamed = await stream(a.jar, ask(qid, { level: 'socratic', studentWork: { lines: ['2=2'] } }));
  c.eq(streamed.status, 200, 'the owner can stream help for the issued question');
  const events = sseEvents(streamed.text);
  c.ok(events.some(e => e.event === 'fallback'), 'a streamed reply that states the root ends in the fallback');
  c.ok(!events.some(e => e.event === 'done'), 'and is never completed as a model reply');
  c.ok(!statesRoot(streamed.text), 'no released event states the root');
  nextReply = { message: 'Which terms would you like on the left, and why?' };
  const clean = sseEvents((await stream(a.jar, ask(qid, { level: 'socratic', studentWork: { lines: ['3=3'] } }))).text);
  c.eq(clean.find(e => e.event === 'done')?.data?.source, 'model', 'a clean streamed reply completes as the model\'s');
  c.eq(keysOf(clean.map(e => e.data)).filter(key => SOLUTION_KEYS.includes(key)).join(','), '', 'and carries no solution field');

  // ── 6 · the walkthrough waits for the server's resolution ──────────────────
  const captions = [{ id: 'c1', text: 'Collect the variable terms on one side.' }];
  const early = await help(a.jar, ask(qid, { level: 'walkthrough', captions }));
  c.eq(early.status, 409, 'walkthrough captions are refused while the question is unresolved');
  c.eq(early.data?.error?.code, 'TUTOR_LEVEL_ORDER', 'coded as out of order');
  const reveal = await h.request(`/v1/practice/${qid}/reveal`, { method: 'POST', jar: a.jar, body: {} });
  c.eq(reveal.status, 200, 'the server resolves the question on reveal');
  c.eq(String(reveal.data?.solution?.answerText), String(root), 'and only now discloses the answer — the root the test solved for');
  nextReply = null;
  const late = await help(a.jar, ask(qid, { level: 'walkthrough', captions }));
  c.eq(late.status, 200, 'after resolution the walkthrough captions are served');
  c.eq(late.data?.tutor?.captions?.length, 1, 'one per caption sent');
  c.eq((await help(b.jar, ask(qid, { level: 'walkthrough', captions }))).status, 404, 'still only to the owner');

  // ── 7 · a device question keeps the older contract ─────────────────────────
  nextReply = null;
  const device = await help(a.jar, {
    context: 'practice', level: 'nudge', locale: 'en', questionId: 'device-q-1', questionVersion: '1',
    question: {
      prompt: 'Solve $2x + 3 = 11$.',
      steps: [{ h: 'Subtract 3 from both sides', d: '$2x = 8$' }, { h: 'Divide both sides by 2', d: '$x = 4$' }],
      answer: '4', hints: ['What undoes adding 3?']
    },
    studentWork: { lines: [] }
  });
  c.eq(device.status, 200, 'a device question with its own verified solution is still helped');
  c.eq(device.data?.tutor?.source, 'model', 'by the model');
  c.eq((await help(a.jar, { context: 'practice', level: 'nudge', locale: 'en', questionId: 'device-q-2', studentWork: { lines: [] } })).status, 400,
    'and one with neither a solution nor an issued id is refused');
} finally {
  await h.close();
  await new Promise(resolve => provider.close(resolve));
  rmSync(scratch, { recursive: true, force: true });
  for (const key of names) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`TUTOR ISSUED GROUNDING: PASS — ${c.count()}/${c.count()} checks — a server-issued question is grounded by the server for its own account only; an unresolved question's answer and final solution never come back on /help or /stream; device questions are served as before.`);
