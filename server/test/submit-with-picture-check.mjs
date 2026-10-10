// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one request for a handwritten or photographed answer
// (server/platform/practice.js, POST /v1/practice/:id/submit with `image`)
//
//   node server/test/submit-with-picture-check.mjs                    (SQLite)
//   node server/test/submit-with-picture-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// Submit used to be three requests: /recognize, /recognition/:receipt/confirm
// and /submit. A submission may now carry the picture instead of a receipt.
// This suite holds that one request to everything the three did:
//
//   · no second paid read of a picture this account has just been shown the
//     transcript of, and exactly one read of a picture not read before;
//   · the same receipts, written with the mark: the reader's, and the
//     student's correction when the answer is not the whole transcript or the
//     reader asked for confirmation;
//   · the same refusals, with nothing written and no try spent: a finished
//     question, another account's question, a blank correction, an empty
//     reading, the paid ceiling, the request rate limit;
//   · the same authority where the mark commits: a session revoked or an
//     account that lost its eligibility while the picture was being read is
//     refused, and nothing is written;
//   · idempotency: the same key and bytes replay the committed reply without
//     reading, paying or counting again; the same key with another picture is
//     refused.
//
// Evidence class: a LOCAL, SCRIPTED reader (it answers with the text encoded in
// the picture). Nothing here measures reading accuracy, and nothing is deployed.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pri-submit-picture-'));

// behaviour: ok | unsure | blank | hold
const picture = (lines, behaviour = 'ok', salt = '') =>
  'data:image/png;base64,' + Buffer.from(`SCRIPTED|${JSON.stringify(lines)}|${behaviour}|${salt}|` + 'a'.repeat(300)).toString('base64');
const provider = { calls: 0, held: [], arrivals: [] };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const [, linesJson, behaviour] = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|');
    const lines = JSON.parse(linesJson);
    provider.calls += 1;
    const confidence = behaviour === 'unsure' ? 0.4 : 0.97;
    const reading = behaviour === 'blank'
      ? { lines: [], confidence: 0, needs_confirmation: true }
      : { lines: lines.map(text => ({ text, latex: '', confidence })), confidence, needs_confirmation: behaviour === 'unsure' };
    const answer = () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: sent.model, output_text: JSON.stringify(reading), usage: { input_tokens: 1000, output_tokens: 60, total_tokens: 1060 } }));
    };
    if (behaviour === 'hold') {
      provider.held.push(answer);
      provider.arrivals.splice(0).forEach(resolve => resolve());
      return;
    }
    answer();
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
const arrived = () => new Promise((resolve, reject) => {
  if (provider.held.length) return resolve();
  const timer = setTimeout(() => reject(new Error('the reader never received the held picture')), 8000);
  provider.arrivals.push(() => { clearTimeout(timer); resolve(); });
});
const release = () => provider.held.splice(0).forEach(answer => answer());

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM'];
const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'ec'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-scripted-reader', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'scripted-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'scripted-primary', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
});
for (const name of ['PRI_PUBLIC_ORIGIN', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM']) delete process.env[name];

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');
const { sha256 } = await import('../platform/security.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
console.log(`engine: ${h.engine}`);

let students = 0;
async function student() {
  students += 1;
  await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const account = await registerAccount(h, { email: `submit.picture.${students}@example.test`, deviceId: `picture-ipad-${students}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  const verified = await verifyEmail(h, account.account.id);
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { jar: account.jar, id: account.account.id };
}
let seeds = 9100;
async function issue(s) {
  const response = await h.request('/v1/practice/issue', { method: 'POST', jar: s.jar,
    body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: ++seeds, curriculum: 'in' } });
  if (response.status !== 201) throw new Error(`issue: ${response.status} ${response.text}`);
  const solved = solveLinearPrompt(response.data.question.prompt);
  return { qid: response.data.question.id, answer: `${solved.variable} = ${solved.root}`, wrong: `${solved.variable} = ${solved.root + 1}`, working: `${solved.lhs} = ${solved.rhs}` };
}
const submit = (s, qid, body) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': body.submissionId }, body });
const transcribe = (s, image) => h.request('/v1/handwriting/transcribe', { method: 'POST', jar: s.jar, body: { image } });
const bucket = async name => Number((await h.db.get('SELECT count FROM rate_limits WHERE bucket=?', [name]))?.count ?? 0);
const hash = accountId => sha256(String(accountId)).slice(0, 24);
const paid = async () => [await bucket('paid-provider:hour'), await bucket('paid-provider:day')];
const allowance = accountId => bucket(`ai-daily:handwriting:${hash(accountId)}`);
const readsCounted = accountId => bucket(`practice-recognize:${hash(accountId)}`);
const receiptsOf = async (accountId, qid) => (await h.db.all("SELECT key,response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [accountId]))
  .map(row => ({ key: row.key, ...JSON.parse(row.response_json) })).filter(row => row.questionId === qid);
const rowsOf = async (accountId, scope, key) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, scope, key]))?.n);
const events = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [accountId]))?.n);
const code = response => response.data?.error?.code || null;

try {
  const a = await student();

  // ── 1 · The shape: one source of the reading, and only for a written mode ──
  {
    const q = await issue(a);
    const image = picture([q.answer]);
    const both = await submit(a, q.qid, { submissionId: 'picture-both-0001', answer: q.answer, mode: 'ink', image, transcriptionReceipt: '00000000-0000-4000-8000-000000000000' });
    c.deq([both.status, code(both)], [400, 'PRACTICE_SUBMISSION_INVALID'], 'a receipt and a picture together are refused');
    const typed = await submit(a, q.qid, { submissionId: 'picture-typed-0001', answer: q.answer, mode: 'typed', image });
    c.deq([typed.status, code(typed)], [400, 'PRACTICE_SUBMISSION_INVALID'], 'a typed answer cannot carry a picture');
    const notString = await submit(a, q.qid, { submissionId: 'picture-shape-0001', answer: q.answer, mode: 'ink', image: { data: 'x' } });
    c.deq([notString.status, code(notString)], [400, 'PRACTICE_SUBMISSION_INVALID'], 'the picture is a data URL string');
    const notImage = await submit(a, q.qid, { submissionId: 'picture-shape-0002', answer: q.answer, mode: 'ink', image: 'data:text/html;base64,PGI+' });
    c.ok(notImage.status === 400 && /^HANDWRITING_IMAGE|^RECOGNITION_IMAGE/.test(String(code(notImage))), `anything but a raster image is refused by name (${code(notImage)})`);
    c.eq(provider.calls, 0, 'and none of those reached the reader');
    c.eq(await rowsOf(a.id, 'practice-tries', q.qid), 0, 'or spent a try');
  }

  // ── 2 · The reading is unchanged: one request, no second read, one receipt ──
  {
    const q = await issue(a);
    const image = picture([q.answer], 'ok', q.qid);
    const shown = await transcribe(a, image);
    c.deq([shown.status, shown.data.reused, shown.data.transcription.text], [200, false, q.answer], 'the transcript is shown from one provider read');
    const callsBefore = provider.calls;
    const paidBefore = await paid();
    const allowanceBefore = await allowance(a.id);
    const readsBefore = await readsCounted(a.id);
    const eventsBefore = await events(a.id);
    const body = { submissionId: 'picture-unchanged-01', answer: q.answer, mode: 'ink', image };
    const graded = await submit(a, q.qid, body);
    c.deq([graded.status, graded.data.authoritative, graded.data.correct, graded.data.resolved], [200, true, true, true], 'the one request is marked by the deterministic marker');
    c.eq(provider.calls, callsBefore, 'with NO second read of the picture');
    c.deq(await paid(), paidBefore, 'no deployment paid unit');
    c.eq(await allowance(a.id), allowanceBefore, 'and no AI-allowance unit');
    c.eq(await readsCounted(a.id), readsBefore + 1, 'but it counts against the same request limit as /recognize');
    c.deq([graded.data.reading.reused, graded.data.reading.corrected], [true, false], 'the reply says the read was reused and the reading was not corrected');
    const receipts = await receiptsOf(a.id, q.qid);
    c.eq(receipts.length, 1, 'exactly one receipt was written');
    c.deq([receipts[0].key, receipts[0].mode, receipts[0].text, receipts[0].providerNeedsConfirmation, receipts[0].submissionId, receipts[0].correctedByStudent],
      [graded.data.reading.receipt, 'ink', q.answer, false, body.submissionId, undefined], 'the reader\'s own, bound to this question, mode, transcript and submission');
    c.eq(await events(a.id), eventsBefore + 1, 'and the attempt is one learning event');

    // ── 3 · Idempotency ──────────────────────────────────────────────────────
    const again = await submit(a, q.qid, body);
    c.deq([again.status, again.data.attemptId, again.data.reading.receipt], [200, graded.data.attemptId, graded.data.reading.receipt], 'the same key and bytes replay the committed reply');
    c.eq(provider.calls, callsBefore, 'without reading');
    c.eq(await readsCounted(a.id), readsBefore + 1, 'without counting another read');
    c.eq((await receiptsOf(a.id, q.qid)).length, 1, 'without another receipt');
    c.eq(await events(a.id), eventsBefore + 1, 'and without another attempt');
    const otherPicture = await submit(a, q.qid, { ...body, image: picture([q.answer], 'ok', 'another-picture') });
    c.deq([otherPicture.status, code(otherPicture)], [409, 'IDEMPOTENCY_KEY_REUSED'], 'the same key with a different picture is refused');
    c.eq(provider.calls, callsBefore, 'before that picture is read');

    // A finished question is refused before a NEW picture is read or paid for.
    const late = await submit(a, q.qid, { submissionId: 'picture-late-000001', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', 'late') });
    c.deq([late.status, code(late)], [409, 'QUESTION_ALREADY_GRADED'], 'a finished question refuses a new picture');
    c.eq(provider.calls, callsBefore, 'unread');
    c.deq(await paid(), paidBefore, 'and unpaid');
  }

  // ── 4 · The answer is one line of the page: the correction is recorded ─────
  {
    const q = await issue(a);
    const image = picture([q.working, q.answer], 'ok', q.qid);
    await transcribe(a, image);
    const callsBefore = provider.calls;
    const graded = await submit(a, q.qid, { submissionId: 'picture-corrected-01', answer: q.answer, mode: 'ink', image, steps: q.working });
    c.deq([graded.status, graded.data.correct, graded.data.reading.corrected, graded.data.reading.reused], [200, true, true, true], 'marked in one request, as the student\'s correction of a reused read');
    c.eq(provider.calls, callsBefore, 'with no second read');
    const receipts = await receiptsOf(a.id, q.qid);
    const original = receipts.find(row => !row.correctedByStudent);
    const correction = receipts.find(row => row.correctedByStudent === true);
    c.eq(receipts.length, 2, 'two receipts: the reader\'s and the student\'s');
    c.deq([original.text, original.providerNeedsConfirmation], [`${q.working}\n${q.answer}`, false], 'the reader\'s receipt keeps the whole transcript');
    c.deq([correction.key, correction.text, correction.parentReceipt, correction.mode], [graded.data.reading.receipt, q.answer, original.key, 'ink'],
      'the correction is the submitted answer, on top of the reader\'s receipt — what /confirm records');
  }

  // ── 5 · A reader that asked for confirmation: the Submit is the confirmation ─
  {
    const q = await issue(a);
    const image = picture([q.answer], 'unsure', q.qid);
    const graded = await submit(a, q.qid, { submissionId: 'picture-unsure-0001', answer: q.answer, mode: 'ink', image });
    c.deq([graded.status, graded.data.correct, graded.data.reading.corrected], [200, true, true], 'an unsure read is marked only as the student\'s confirmed text');
    const receipts = await receiptsOf(a.id, q.qid);
    c.deq([receipts.length, receipts.find(row => !row.correctedByStudent).providerNeedsConfirmation, receipts.find(row => row.correctedByStudent)?.text], [2, true, q.answer],
      'the reader\'s doubt is kept on its receipt and the student\'s confirmation is a second one');
  }

  // ── 6 · A photo not read before is read exactly once, inside the request ───
  {
    const q = await issue(a);
    const image = picture([q.answer], 'ok', `photo-${q.qid}`);
    const callsBefore = provider.calls;
    const paidBefore = await paid();
    const graded = await submit(a, q.qid, { submissionId: 'picture-photo-00001', answer: q.answer, mode: 'photo', image });
    c.deq([graded.status, graded.data.correct, graded.data.reading.reused], [200, true, false], 'a photographed answer is read and marked in one request');
    c.eq(provider.calls, callsBefore + 1, 'one read');
    c.deq(await paid(), paidBefore.map(n => n + 1), 'one paid unit in each window');
    c.eq((await receiptsOf(a.id, q.qid))[0].mode, 'photo', 'and its receipt says photo');
  }

  // ── 7 · Refusals: nothing written, no try spent ────────────────────────────
  {
    const q = await issue(a);
    const nothing = async what => {
      c.eq(await rowsOf(a.id, 'practice-tries', q.qid), 0, `${what}: no try spent`);
      c.eq((await receiptsOf(a.id, q.qid)).length, 0, `${what}: no receipt written`);
    };
    // A blank correction (working on the page, no final answer in the field).
    const blankAnswer = await submit(a, q.qid, { submissionId: 'picture-blank-00001', answer: '', mode: 'ink', image: picture([q.working], 'ok', 'blank-answer'), steps: q.working });
    c.deq([blankAnswer.status, code(blankAnswer)], [400, 'RECOGNITION_CORRECTION_INVALID'], 'a blank correction is refused, as /confirm refuses it');
    await nothing('blank correction');
    // Nothing legible on the page.
    const empty = await submit(a, q.qid, { submissionId: 'picture-empty-00001', answer: q.answer, mode: 'ink', image: picture([], 'blank', 'empty') });
    c.deq([empty.status, code(empty)], [422, 'RECOGNITION_EMPTY'], 'an empty reading is refused, as /recognize refuses it');
    await nothing('empty reading');
    // The deployment's paid ceiling.
    const [hourUsed] = await paid();
    process.env.PRI_PAID_CALLS_PER_HOUR = String(hourUsed);
    const callsBefore = provider.calls;
    const capped = await submit(a, q.qid, { submissionId: 'picture-capped-0001', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', 'capped') });
    c.deq([capped.status, code(capped), provider.calls], [503, 'PAID_CAPACITY_REACHED', callsBefore], 'the paid ceiling refuses the read before anything is sent');
    await nothing('paid ceiling');
    process.env.PRI_PAID_CALLS_PER_HOUR = '10000';
    // The request rate limit shared with /recognize.
    const readsBucket = `practice-recognize:${hash(a.id)}`;
    const readsBefore = await readsCounted(a.id);
    await h.db.run('UPDATE rate_limits SET count = 120 WHERE bucket = ?', [readsBucket]);
    const limited = await submit(a, q.qid, { submissionId: 'picture-limited-001', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', 'limited') });
    c.deq([limited.status, code(limited), provider.calls], [429, 'RATE_LIMITED', callsBefore], 'the /recognize request limit applies to a picture submission too');
    const viaRecognize = await h.request(`/v1/practice/${q.qid}/recognize`, { method: 'POST', jar: a.jar, body: { mode: 'ink', image: picture([q.answer], 'ok', 'limited') } });
    c.deq([viaRecognize.status, code(viaRecognize)], [429, 'RATE_LIMITED'], 'because it is the same bucket');
    await nothing('rate limit');
    await h.db.run('UPDATE rate_limits SET count = ? WHERE bucket = ?', [readsBefore, readsBucket]);
    // After every refusal the same question is still open and is marked.
    const graded = await submit(a, q.qid, { submissionId: 'picture-capped-0001', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', 'capped') });
    c.deq([graded.status, graded.data.correct], [200, true], 'the refused key is accepted once capacity returns');
  }

  // ── 8 · Another account's question is not there, and its picture is unread ─
  {
    const b = await student();
    const q = await issue(a);
    const callsBefore = provider.calls;
    const foreign = await submit(b, q.qid, { submissionId: 'picture-foreign-001', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', 'foreign') });
    c.deq([foreign.status, code(foreign), provider.calls], [404, 'QUESTION_NOT_FOUND', callsBefore], 'another account\'s question is not found, before any read');
    c.eq((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [b.id])).n, 0, 'and nothing is written for the caller');
  }

  // ── 9 · A wrong answer spends the first try exactly as the receipt path does ─
  {
    const q = await issue(a);
    const first = await submit(a, q.qid, { submissionId: 'picture-wrong-00001', answer: q.wrong, mode: 'ink', image: picture([q.wrong], 'ok', q.qid) });
    c.deq([first.status, first.data.correct, first.data.resolved, first.data.triesLeft, first.data.solution], [200, false, false, 1, undefined], 'a wrong first try is open, with one try left and no solution');
    c.eq(await rowsOf(a.id, 'practice-tries', q.qid), 1, 'and the try is recorded');
    const second = await submit(a, q.qid, { submissionId: 'picture-wrong-00002', answer: q.answer, mode: 'ink', image: picture([q.answer], 'ok', `second-${q.qid}`) });
    c.deq([second.status, second.data.correct, second.data.resolved], [200, true, true], 'the second try, a new picture, resolves it');
  }

  // ── 10 · Authority where the mark commits ──────────────────────────────────
  {
    // The session is revoked while the picture is being read.
    const s = await student();
    const q = await issue(s);
    const pending = submit(s, q.qid, { submissionId: 'picture-revoked-001', answer: q.answer, mode: 'photo', image: picture([q.answer], 'hold', 'revoked') });
    await arrived();
    await h.db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ?', [Date.now(), s.id]);
    release();
    const refused = await pending;
    c.deq([refused.status, code(refused)], [401, 'AUTH_REQUIRED'], 'a session revoked during the read cannot commit the mark');
    c.deq([await rowsOf(s.id, 'practice-grade', `${q.qid}:picture-revoked-001`), await rowsOf(s.id, 'practice-completion', q.qid), (await receiptsOf(s.id, q.qid)).length, await events(s.id)],
      [0, 0, 0, 0], 'no reply, no completion, no receipt and no attempt were written');
  }
  {
    // The account loses its eligibility (no age on record) while the picture is read.
    const s = await student();
    const q = await issue(s);
    const pending = submit(s, q.qid, { submissionId: 'picture-consent-001', answer: q.answer, mode: 'photo', image: picture([q.answer], 'hold', 'consent') });
    await arrived();
    await h.db.run('UPDATE accounts SET age_basis = NULL WHERE id = ?', [s.id]);
    release();
    const refused = await pending;
    c.deq([refused.status, code(refused)], [403, 'AGE_DECLARATION_REQUIRED'], 'eligibility lost during the read is refused where the mark would commit');
    c.deq([await rowsOf(s.id, 'practice-grade', `${q.qid}:picture-consent-001`), await rowsOf(s.id, 'practice-completion', q.qid), (await receiptsOf(s.id, q.qid)).length, await events(s.id)],
      [0, 0, 0, 0], 'and nothing was written');
  }

  // ── 11 · The reader is sent the picture and nothing else ───────────────────
  {
    const q = await issue(a);
    const seen = [];
    const spy = createServer((req, res) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        seen.push(raw);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ model: 'scripted-primary', output_text: JSON.stringify({ lines: [{ text: q.answer, latex: '', confidence: 0.97 }], confidence: 0.97, needs_confirmation: false }) }));
      });
    });
    await new Promise(resolve => spy.listen(0, '127.0.0.1', resolve));
    const endpoint = process.env.PRI_HANDWRITING_ENDPOINT;
    process.env.PRI_HANDWRITING_ENDPOINT = `http://127.0.0.1:${spy.address().port}/v1/responses`;
    try {
      const marker = 'ANSWER-BLIND-CANARY-7731';
      const graded = await submit(a, q.qid, { submissionId: 'picture-blind-00001', answer: q.answer, mode: 'photo', image: picture(['unused'], 'ok', 'blind'), steps: marker });
      c.eq(graded.status, 200, 'a picture submission with working is marked');
      c.eq(seen.length, 1, 'the reader was called once');
      c.ok(!seen[0].includes(marker) && !seen[0].includes(q.qid) && !seen[0].includes(JSON.stringify(q.answer).slice(1, -1) + '"}') && !/"answer"|"steps"|submissionId/.test(seen[0]),
        'and was sent neither the working, the question id, the submitted answer nor any field of the submission');
    } finally {
      process.env.PRI_HANDWRITING_ENDPOINT = endpoint;
      await new Promise(resolve => spy.close(resolve));
    }
  }

  console.log(`SUBMIT WITH PICTURE: PASS — ${c.count()}/${c.count()} checks — on ${h.engine}, one request reads (never twice), receipts and marks a handwritten or photographed answer under the same refusals, limits, commit-time authority and idempotency as the three it replaces (local scripted reader).`);
} finally {
  release();
  await h.close();
  await new Promise(resolve => fake.close(resolve));
  rmSync(dir, { recursive: true, force: true });
  for (const name of vars) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
}
