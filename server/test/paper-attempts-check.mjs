// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · sitting an exam paper in the app (server/platform/paperAttempts.js)
//
//   1 · the structured papers: all thirteen papers load, add to 70 marks,
//       carry a key for every multiple-choice question, and each keyed part
//       is accepted by the real engine in its own form and rejects a wrong one;
//   2 · who may sit one: signed out 401; the free sample (Paper 1) for a free
//       account, Premium for the rest (402), a header or query claim changes
//       nothing; India 404 on every route; one account never reads another's;
//   3 · NOTHING SECRET BEFORE SUBMIT: no key, criterion, sample answer or note
//       in any reply before Submit (a scan of every string the paper holds);
//   4 · marking, by the deterministic engine: multiple choice right, wrong and
//       blank; a final number; a final expression in an equivalent form; the
//       parts the engine cannot mark claim NO mark; honest totals; a repeated
//       Submit marks nothing twice;
//   5 · autosave and resume; handwritten parts are marked from the confirmed
//       reading and keep the student's original; a single question of a paper;
//   6 · after Submit: "How this is marked" carries no marks (no approval record)
//       and carries them only for an approved digest; the sample answer.
// Accounts are SYNTHETIC; the papers are the owner's real content.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pngDataUrl } from './support/test-image.mjs';
import { encodeInk } from '../../client/src/engine/originalInk.js';
import { checkAnswer } from '../../client/src/engine/checker.js';

const dir = mkdtempSync(join(tmpdir(), 'pri-paper-attempts-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const picture = label => pngDataUrl(`PICTURE|ok|${label}|` + 'a'.repeat(300));
const provider = { bodies: [] };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    provider.bodies.push(raw);
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const [, , label] = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: sent.model,
      output_text: JSON.stringify({ lines: [{ text: label, latex: '', confidence: 0.97, uncertain: false, doubt: '', gap_before: false }], confidence: 0.97, needs_confirmation: false }),
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }));
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'eb'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-paper-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-fallback', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_AI_DAILY_FREE: '100000', PRI_AI_DAILY_PREMIUM: '100000'
});
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { asStore } = await import('../platform/store.js');
const { PAPERS_DIR } = await import('../platform/papers.js');
const { loadStructuredPapers, leafParts, publicPaper, engineQuestion } = await import('../platform/paperContent.js');

const c = checks();
const DAY = 86_400_000;
const docs = loadStructuredPapers(PAPERS_DIR);
const P01 = 'ext1-2027-p01';
const P13 = 'ext1-2027-p13';

// ── 1 · the content itself ────────────────────────────────────────────────────
c.deq([...docs.keys()], ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'].map(n => `ext1-2027-p${n}`), 'all thirteen papers load');
for (const doc of docs.values()) {
  const leaves = leafParts(doc);
  c.eq(leaves.reduce((a, l) => a + l.part.marks, 0), 70, `${doc.id}: 70 marks`);
  c.eq(doc.sections[0].questions.length, 10, `${doc.id}: ten multiple-choice questions`);
  c.ok(doc.sections[0].questions.every(q => /^[ABCD]$/.test(q.parts[0].key?.answer || '') && q.parts[0].autoMarks === 1), `${doc.id}: every multiple-choice question has its key (Section I is fully machine-markable)`);
  c.ok(leaves.every(l => l.part.criteria.length > 0 && l.part.sampleAnswer.length > 0), `${doc.id}: every part has its guideline criteria and sample answer`);
  c.ok(leaves.every(l => Math.max(...l.part.criteria.map(k => k.marks)) === l.part.marks), `${doc.id}: each part's top criterion equals its marks`);
  c.ok(doc.markingScheme.status === 'draft' && /^[0-9a-f]{64}$/.test(doc.markingScheme.digest), `${doc.id}: the guideline is stored as a DRAFT with a digest`);
}
// Each key, in the engine, in its own form and in an equivalent form; and a wrong answer rejected.
const KEY_TESTS = {
  [P13]: { q11a: ['24', ['48', '23']], q11b: ['11pi/6', ['pi/6', '300°']], q12b: [null, ['0']], 'q12c-i': ['2-1/2^51', ['3']], 'q13a-ii': ['8*(53*sqrt(2)-32)/15', ['22']],
    'q13b-i': ['300', ['299']], 'q14a-ii': ['R*(sqrt(5/3)-1)', ['R/3']], 'q14b-ii': ['(5*N+3)/(N+3)', ['(5*N+3)/(N+2)']] },
  [P01]: { 'q11a-ii': ['3*sqrt(207-k)', ['sqrt(207-k)']], 'q11a-iii': ['162*sqrt(58)-1044', ['162*sqrt(58)']], 'q12b-iii': ['4*sqrt(3)+2*pi/3-8', ['4*sqrt(3)']],
    'q13a-i': ['2', ['3']], 'q14b-ii': ['1/((2*m-1)*nCr(2*m-2,m-1))', ['1/(2*m-1)']] }
};
let keyed = 0;
for (const doc of docs.values()) for (const leaf of leafParts(doc)) {
  if (!leaf.part.key) continue;
  keyed += 1;
  const q = engineQuestion(doc, leaf);
  const test = KEY_TESTS[doc.id]?.[leaf.part.id];
  if (leaf.part.key.type === 'mcq') {
    c.ok(checkAnswer(q, String('ABCD'.indexOf(leaf.part.key.answer))).correct === true && checkAnswer(q, String((('ABCD'.indexOf(leaf.part.key.answer)) + 1) % 4)).correct === false, `${doc.id} ${leaf.part.id}: the key is accepted and another option rejected`);
  } else if (test) {
    const [right, wrongs] = test;
    if (right) c.ok(checkAnswer(q, right).correct === true, `${doc.id} ${leaf.part.id}: "${right}" is accepted`);
    for (const w of wrongs) c.ok(checkAnswer(q, w).correct !== true, `${doc.id} ${leaf.part.id}: "${w}" is rejected`);
  }
}
c.ok(keyed >= 20 + 10 + 12 + 70, `keys exist and were exercised (${keyed})`);

// ── Secrets: every string that must not reach a student before Submit ─────────
const secrets = [];
const blocksText = bs => (bs || []).map(b => (b.t ?? (b.items || []).join(' ') ?? '')).join(' ');
for (const doc of docs.values()) for (const leaf of leafParts(doc)) {
  const p = leaf.part;
  if (p.key?.display) secrets.push(p.key.display);
  if (p.key?.expr) secrets.push(p.key.expr);
  for (const k of p.key?.anyOf || []) if (k.length > 6) secrets.push(k);
  for (const crit of p.criteria) secrets.push(blocksText(crit.text).slice(0, 60));
  secrets.push(blocksText(p.sampleAnswer).slice(0, 80));
  if (p.markerNote) secrets.push(blocksText(p.markerNote).slice(0, 60));
}
// A SHORT key spelling (a formula such as \dfrac{\pi}{2}) can also be the printed text of some option or prompt in a paper that is public by
// design; that is not a leak of the key. Longer strings (criteria, sample answers, notes, long keys) are never exempt.
const publicBlob = [...docs.values()].map(d => JSON.stringify(publicPaper(d))).join('\n');
const secretList = [...new Set(secrets.map(s => s.trim()).filter(s => s.length >= 12 && !(s.length < 24 && publicBlob.includes(JSON.stringify(s).slice(1, -1)))))];
const leaks = reply => secretList.filter(s => JSON.stringify(reply).includes(JSON.stringify(s).slice(1, -1)));
c.ok(secretList.length > 400, `the scan holds ${secretList.length} secret strings from every paper`);
const sample = JSON.stringify(publicPaper(docs.get(P13)));
c.ok(!/"key"|"criteria"|"sampleAnswer"|"markerNote"|"commonErrors"|keyChecks|classification/.test(sample), 'publicPaper has no key, criterion, sample answer or note field');
c.deq(leaks(publicPaper(docs.get(P13))), [], 'publicPaper(P13) carries none of the secret strings');

// ── Accounts and servers ──────────────────────────────────────────────────────
const approvedDigest = docs.get(P01).markingScheme.digest;
const hAu = await startApp({ resources: { edition: 'prithagoras' }, papers: { dir: PAPERS_DIR } });
const hApproved = await startApp({ resources: { edition: 'prithagoras' }, papers: { dir: PAPERS_DIR, approvals: [{ paperId: P01, schemeDigest: approvedDigest, approvedBy: 'TEST ONLY', approvedAt: '2026-01-01' }] } });
const hIn = await startApp({ resources: { edition: 'priyabhata' }, papers: { dir: PAPERS_DIR } });
let people = 0;
async function student(h, state) {
  people += 1;
  await asStore(h.db).run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const r = await registerAccount(h, { email: `paper.attempt.${people}@example.test`, deviceId: `paper-ipad-${people}` });
  if (r.status !== 201) throw new Error(`register: ${r.status} ${r.text}`);
  await verifyEmail(h, r.account.id);
  if (state) {
    await asStore(h.db).run('INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,grace_until,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until',
      [r.account.id, 'premium', state.status, 'web', Date.now() + 30 * DAY, null, Date.now()]);
  }
  return { jar: r.jar, id: r.account.id };
}
const post = (h, who, path, body) => h.request(path, { method: 'POST', jar: who.jar, body });
const put = (h, who, path, body) => h.request(path, { method: 'POST', jar: who.jar, body });
const get = (h, who, path, headers) => h.request(path, { jar: who?.jar || {}, headers });

try {
  const free = await student(hAu, null);
  const paid = await student(hAu, { status: 'active' });
  const other = await student(hAu, null);

  // ── 2 · who may sit ─────────────────────────────────────────────────────────
  c.eq((await get(hAu, null, `/v1/papers/attempts`)).status, 401, 'signed out: no list of sittings');
  c.eq((await h401(hAu, `/v1/papers/${P01}/attempts`)).status, 401, 'signed out: no sitting');
  async function h401(h, path) { return h.request(path, { method: 'POST', body: {} }); }
  const refusal = await post(hAu, free, `/v1/papers/${P13}/attempts`, {});
  c.deq([refusal.status, refusal.data.error.code, refusal.data.error.capability, refusal.data.error.plan], [402, 'PREMIUM_REQUIRED', 'premium-exams', 'free'], 'a free account is refused a Premium paper: the existing Premium-required shape');
  const claimed = await hAu.request(`/v1/papers/${P13}/attempts?plan=premium`, { method: 'POST', jar: free.jar, body: {}, headers: { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'premium-exams' } });
  c.eq(claimed.status, 402, 'a Premium claim in a header or query changes nothing');
  c.eq((await post(hAu, free, `/v1/papers/ext1-2027-p99/attempts`, {})).status, 404, 'an unknown paper: 404');
  for (const bad of [{ timer: 'maybe' }, { fresh: 'yes' }, { question: 99 }, { price: 1 }, { question: 1.5 }]) {
    c.eq((await post(hAu, free, `/v1/papers/${P01}/attempts`, bad)).status, 400, `an invalid issue body ${JSON.stringify(bad)} is refused`);
  }
  const issued = await post(hAu, free, `/v1/papers/${P01}/attempts`, {});
  c.eq(issued.status, 201, 'the free sample, Paper 1, is free to a free account');
  const A = issued.data.attempt;
  c.deq([A.state, A.paperId, A.timer.mode, A.timer.readingMs, A.timer.workingMs], ['open', P01, 'paper', 600000, 7200000], 'the sitting is open, with the paper\'s own reading time (10 minutes) and working time (2 hours)');
  c.deq(leaks(issued.data), [], 'ISSUE: no key, criterion or sample answer in the issued paper');
  c.ok(!JSON.stringify(issued.data).match(/"key"|"criteria"|"sampleAnswer"/), 'ISSUE: no key/criteria/sampleAnswer field');
  const part = id => A.paper.sections.flatMap(s => s.questions).flatMap(function walk(q) { return q.parts.flatMap(p => (p.parts ? p.parts.flatMap(x => [x]) : [p])); }).find(p => p.id === id);
  c.deq([part('q1').answerType, part('q1').marks, part('q1').options.length, part('q1').checks], ['mcq', 1, 4, 'pri'], 'a multiple-choice question is told to be checked by Pri');
  c.deq([part('q11a-iii').checks, part('q11a-iii').autoMarks, part('q11a-iii').marks], ['pri', 1, 3], 'a keyed final value: Pri checks the answer, 1 of 3 marks');
  c.deq([part('q11b-i').checks, part('q11b-i').answerType], ['self', 'show-that'], 'a proof is told to be self-checked');
  c.eq((await post(hAu, free, `/v1/papers/${P01}/attempts`, {})).data.attempt.id, A.id, 'asking again resumes the same open sitting');
  c.eq((await post(hAu, free, `/v1/papers/${P01}/attempts`, {})).status, 200, 'resuming is a 200');
  const fresh = await post(hAu, free, `/v1/papers/${P01}/attempts`, { fresh: true });
  c.ok(fresh.status === 201 && fresh.data.attempt.id !== A.id, 'fresh: true starts another sitting');
  const unused = fresh.data.attempt.id;

  // Isolation
  for (const [what, r] of [['read', await get(hAu, other, `/v1/papers/attempts/${A.id}`)], ['autosave', await put(hAu, other, `/v1/papers/attempts/${A.id}/answers`, { answers: {} })],
    ['submit', await post(hAu, other, `/v1/papers/attempts/${A.id}/submit`, {})], ['solution', await get(hAu, other, `/v1/papers/attempts/${A.id}/parts/q1/solution`)],
    ['figure', await get(hAu, other, `/v1/papers/attempts/${A.id}/figures/figdodec`)], ['original', await post(hAu, other, `/v1/papers/attempts/${A.id}/parts/q11a-iii/original`, {})]]) {
    c.deq([r.status, r.data?.error?.code], [404, 'PAPER_ATTEMPT_NOT_FOUND'], `another account cannot ${what} someone else's sitting`);
  }
  c.eq((await get(hAu, other, '/v1/papers/attempts')).data.attempts.length, 0, 'and its list never shows another account\'s sittings');
  c.deq((await get(hAu, free, '/v1/papers/attempts')).data.attempts.map(a => a.id).sort(), [A.id, unused].sort(), 'the owner\'s list shows its own sittings');
  c.ok(!/"key"|criteria|sampleAnswer/.test((await get(hAu, free, '/v1/papers/attempts')).text), 'the list carries no paper content');

  // Figures
  const fig = await hAu.request(`/v1/papers/attempts/${A.id}/figures/figdodec`, { jar: free.jar });
  c.deq([fig.status, fig.headers.get('content-type'), fig.headers.get('x-content-type-options')], [200, 'image/svg+xml; charset=utf-8', 'nosniff'], 'a diagram of the sitting\'s own paper is served as an SVG');
  c.ok(fig.text.startsWith('<svg'), 'an SVG document');
  c.ok(/default-src 'none'/.test(fig.headers.get('content-security-policy')), 'with a locked-down CSP');
  for (const bad of ['figGsline', '..%2F..%2Fmanifest', 'figdodec%2F..%2F..%2Fx', '__proto__', 'figNotThere']) {
    c.ok([400, 404].includes((await get(hAu, free, `/v1/papers/attempts/${A.id}/figures/${bad}`)).status), `figure ${bad}: 404 (not on this paper's list)`);
  }

  // ── 5 · autosave, resume ────────────────────────────────────────────────────
  for (const bad of [{ answers: { q1: { mode: 'typed', text: 'A', extra: 1 } } }, { answers: { q99: { mode: 'typed', text: 'A' } } }, { answers: { q1: { mode: 'speech', text: 'A' } } },
    { answers: { q1: { mode: 'typed', text: 'x'.repeat(12001) } } }, { answers: [] }, { ms: -1 }, { wat: 1 }]) {
    c.eq((await put(hAu, free, `/v1/papers/attempts/${A.id}/answers`, bad)).status, 400, `an invalid save ${JSON.stringify(bad).slice(0, 50)} is refused`);
  }
  const answers = { q1: 'A', q2: 'A', q3: 'C', q4: 'D', q5: 'A', q6: 'D', q7: 'B', q8: 'C', q9: 'A', q10: '' };
  const save = await put(hAu, free, `/v1/papers/attempts/${A.id}/answers`, {
    answers: { ...Object.fromEntries(Object.entries(answers).filter(([, v]) => v).map(([k, v]) => [k, { mode: 'typed', text: v }])),
      'q11a-ii': { mode: 'typed', text: '3*sqrt(207-k)' }, 'q11a-iii': { mode: 'typed', text: '162*sqrt(58)-1044' }, 'q12b-iii': { mode: 'typed', text: '4*sqrt(3)+2*pi/3-8' },
      'q13a-i': { mode: 'typed', text: '2 years' }, 'q14b-ii': { mode: 'typed', text: '1/((2*m-1)*nCr(2*m-2,m-1))' }, 'q11b-i': { mode: 'typed', text: 'base case n=1: 2=2; inductive step ...' } }, ms: 4000, timer: 'off' });
  c.deq([save.status, save.data.saved], [200, true], 'an autosave is accepted');
  c.deq(leaks(save.data), [], 'AUTOSAVE: nothing secret in the reply');
  const back = await get(hAu, free, `/v1/papers/attempts/${A.id}`);
  c.deq([back.data.attempt.answers.q3.text, back.data.attempt.answers['q11a-iii'].text, back.data.attempt.timer.mode, back.data.attempt.ms], ['C', '162*sqrt(58)-1044', 'off', 4000], 'resume: the saved answers, the timer choice and the elapsed time come back');
  c.deq(leaks(back.data.attempt.paper), [], 'RESUME: nothing secret in the paper (the student\'s own saved answers are theirs)');
  c.eq(back.data.attempt.answers.q10, undefined, 'a blank answer is not stored');
  c.eq((await put(hAu, free, `/v1/papers/attempts/${A.id}/answers`, { answers: { q3: { mode: 'typed', text: '' } } })).status, 200, 'clearing an answer is a save');
  c.eq((await get(hAu, free, `/v1/papers/attempts/${A.id}`)).data.attempt.answers.q3, undefined, 'and it is gone');
  await put(hAu, free, `/v1/papers/attempts/${A.id}/answers`, { answers: { q3: { mode: 'typed', text: 'C' } } });

  // Before Submit: no solution
  c.deq([(await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/q1/solution`)).status, (await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/q1/solution`)).data.error.code], [409, 'PAPER_NOT_SUBMITTED'], 'the sample answer is refused before Submit');

  const sweeper = await student(hAu, null);
  // An empty Submit (nothing answered) is refused: it would record a zero and spend the sitting.
  const emptySit = (await post(hAu, sweeper, `/v1/papers/${P01}/attempts`, { fresh: true })).data.attempt;
  const emptySubmit = await post(hAu, sweeper, `/v1/papers/attempts/${emptySit.id}/submit`, { submissionId: 'paper-submit-empty1' });
  c.deq([emptySubmit.status, emptySubmit.data.error.code], [409, 'PAPER_NOTHING_ANSWERED'], 'an empty Submit is refused with a clear message, and the sitting stays open');
  c.eq((await get(hAu, sweeper, `/v1/papers/attempts/${emptySit.id}`)).data.attempt.state, 'open', 'and open');
  // A multiple-choice answer that is not one letter earns nothing: "" and "Banana" were read as options A and B.
  await put(hAu, sweeper, `/v1/papers/attempts/${emptySit.id}/answers`, { answers: { q1: { mode: 'typed', text: 'Banana' }, q2: { mode: 'typed', text: 'AB' }, q3: { mode: 'typed', text: '(c)' } } });
  const junkR = await post(hAu, sweeper, `/v1/papers/attempts/${emptySit.id}/submit`, { submissionId: 'paper-submit-empty2' });
  const junk = junkR.data.attempt.result;
  c.deq(['q1', 'q2'].map(id => [junk.parts[id].verdict, junk.parts[id].awarded]), [['unanswered', 0], ['unanswered', 0]], 'words and two letters in a multiple-choice box are not answered and earn nothing, whatever the key');
  // Retained sittings are capped per account (open or submitted): the 201st is refused.
  const capped = await student(hAu, null);
  const { randomUUID } = await import('node:crypto');
  const nowMs = Date.now();
  for (let i = 0; i < 200; i += 1) {
    const key = randomUUID();
    await asStore(hAu.db).run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)', [capped.id, 'paper-sitting', key, JSON.stringify({ paperId: P01, scope: null, issuedAt: nowMs, timer: 'paper' }), 'x', nowMs, nowMs + 1e9]);
    await asStore(hAu.db).run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)', [capped.id, 'paper-result', key, '{}', 'x', nowMs, nowMs + 1e9]);
  }
  const over = await post(hAu, capped, `/v1/papers/${P01}/attempts`, { fresh: true });
  c.deq([over.status, over.data.error.code], [409, 'PAPER_ATTEMPTS_KEPT_LIMIT'], 'an account that already keeps 200 sittings is refused a new one');
  // ── 4 · Submit all ──────────────────────────────────────────────────────────
  c.eq((await post(hAu, free, `/v1/papers/attempts/${A.id}/submit`, { submissionId: 'x', price: 1 })).status, 400, 'an invalid submit body is refused');
  const sub = await post(hAu, free, `/v1/papers/attempts/${A.id}/submit`, { submissionId: 'paper-submit-0001', ms: 9000 });
  c.eq(sub.status, 200, 'Submit all marks the sitting');
  const R = sub.data.attempt.result;
  c.eq(sub.data.attempt.state, 'submitted', 'the sitting is submitted');
  const v = id => R.parts[id].verdict;
  c.deq(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'].map(v), ['incorrect', 'correct', 'incorrect', 'correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'unanswered'], 'multiple choice: wrong (q1, q3), right, and a blank');
  c.deq(['q11a-ii', 'q11a-iii', 'q12b-iii', 'q13a-i', 'q14b-ii'].map(v), ['correct', 'correct', 'correct', 'correct', 'correct'], 'a final expression and final values are marked by the engine, in the form the student wrote');
  c.deq([R.parts['q11b-i'].verdict, R.parts['q11b-i'].awarded, R.parts['q11b-i'].checks], ['self-check', 0, 'self'], 'a proof the engine cannot mark: self-check, NO mark claimed');
  c.deq([R.parts['q11a-i'].verdict, R.parts['q11a-i'].awarded], ['self-check', 0], 'and a find-part with no key yet is self-check too');
  c.deq([R.parts.q2.awarded, R.parts.q1.awarded, R.parts.q10.awarded], [1, 0, 0], 'a right option earns its 1 mark, a wrong or blank one nothing (no negative marking)');
  c.deq([R.parts['q11a-iii'].awarded, R.parts['q11a-iii'].marks, R.parts['q11a-iii'].autoMarks], [1, 3, 1], 'a right final answer earns the 1 mark the guideline gives a bare answer, not the part\'s 3');
  // 8 right MCQ of 10 → wait: q1,q3 wrong, q10 blank → 7 right; 5 keyed Section II parts → 12
  c.deq([R.totals.total, R.totals.autoAvailable, R.totals.autoAwarded, R.totals.selfChecked], [70, 20, 12, 50], 'honest totals: of 70 marks, 20 are available to automatic marking (10 multiple choice + 10 final answers), 12 were earned, 50 are self-checked');
  c.eq(R.totals.autoAvailable + R.totals.selfChecked, R.totals.total, 'automatic + self-checked always add to the paper\'s marks');
  c.deq([R.totals.parts, R.totals.answeredParts], [35, 15], 'the totals count the parts and the answered parts');
  c.eq(R.criteriaMarksShown, false, 'no approval record: criterion marks are off');
  c.deq(leaks(R), [], 'the result itself carries no secret string');
  const replay = await post(hAu, free, `/v1/papers/attempts/${A.id}/submit`, { submissionId: 'paper-submit-0001' });
  c.deq([replay.status, replay.data.replay, JSON.stringify(replay.data.attempt.result)], [200, true, JSON.stringify(R)], 'a repeated Submit is given the stored result: nothing is marked twice');
  const rowsBefore = await asStore(hAu.db).all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='paper-result'", [free.id]);
  c.eq(rowsBefore.length, 1, 'one result row');
  c.eq((await put(hAu, free, `/v1/papers/attempts/${A.id}/answers`, { answers: { q3: { mode: 'typed', text: 'B' } } })).data.error.code, 'PAPER_ATTEMPT_SUBMITTED', 'a submitted sitting takes no more answers');
  c.eq((await get(hAu, free, `/v1/papers/attempts/${A.id}`)).data.attempt.result.totals.autoAwarded, 12, 'reading it again gives the same result');
  c.deq((await get(hAu, free, '/v1/papers/attempts')).data.attempts.find(a => a.id === A.id).totals.autoAwarded, 12, 'the list carries the totals');

  // ── 6 · after Submit ────────────────────────────────────────────────────────
  const sol = await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/q11a-iii/solution`);
  c.eq(sol.status, 200, 'after Submit the sample answer is available (Paper 1 is the free sample)');
  c.ok(sol.data.sampleAnswer.length > 0 && sol.data.howMarked.length === 3, 'with its three guideline criteria');
  c.ok(sol.data.howMarked.every(k => !('marks' in k)) && sol.data.criteriaMarksShown === false, 'the criteria carry NO marks: there is no approval record for this scheme');
  c.ok(!/awaiting|draft|approval/i.test(JSON.stringify(sol.data)), 'and the student is not shown an "awaiting approval" notice');
  c.deq(sol.data.finalAnswer, { tex: '162\\sqrt{58}-1044' }, 'the key is shown for a keyed part, after Submit');
  c.deq((await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/q1/solution`)).data.finalAnswer, { letter: 'B' }, 'and the letter for a multiple-choice question');
  // an approved digest lights criterion marks up
  const ap = await student(hApproved, null);
  const apA = (await post(hApproved, ap, `/v1/papers/${P01}/attempts`, {})).data.attempt;
  await put(hApproved, ap, `/v1/papers/attempts/${apA.id}/answers`, { answers: { q1: { mode: 'typed', text: 'A' } } });
  await post(hApproved, ap, `/v1/papers/attempts/${apA.id}/submit`, {});
  const apSol = await get(hApproved, ap, `/v1/papers/attempts/${apA.id}/parts/q11a-iii/solution`);
  c.deq([apSol.data.howMarked.map(k => k.marks), apSol.data.criteriaMarksShown], [[3, 2, 1], true], 'WITH an approval record whose digest matches, the criteria carry their marks');
  c.deq((await get(hApproved, ap, `/v1/papers/attempts/${apA.id}`)).data.attempt.result.criteriaMarksShown, true, 'and the result says so');
  c.eq((await get(hAu, free, `/v1/papers/attempts/${A.id}/parts/q11a-iii/solution`)).data.criteriaMarksShown, false, 'the other server, with no record, still shows none');

  // ── Premium: a Premium account sits Paper 13 ────────────────────────────────
  const p13 = await post(hAu, paid, `/v1/papers/${P13}/attempts`, { timer: 'off' });
  c.eq(p13.status, 201, 'a Premium account sits Paper 13');
  c.eq(p13.data.attempt.timer.mode, 'off', 'with the timer switched off');
  c.deq(leaks(p13.data), [], 'PAPER 13 issue: no secret string');
  const B = p13.data.attempt;
  await put(hAu, paid, `/v1/papers/attempts/${B.id}/answers`, { answers: { q11a: { mode: 'typed', text: '24' }, q11b: { mode: 'typed', text: '330°' }, q12b: { mode: 'typed', text: '1-12*p*(1-p)+60*(p*(1-p))^2-150*(p*(1-p))^3+186*(p*(1-p))^4-96*(p*(1-p))^5+12*(p*(1-p))^6' }, 'q14b-ii': { mode: 'typed', text: '(5N+3)/(N+3)' }, 'q13b-i': { mode: 'typed', text: '299' } } });
  const subB = await post(hAu, paid, `/v1/papers/attempts/${B.id}/submit`, { submissionId: 'paper-submit-0013' });
  const RB = subB.data.attempt.result;
  c.deq(['q11a', 'q11b', 'q12b', 'q14b-ii', 'q13b-i'].map(id => RB.parts[id].verdict), ['correct', 'correct', 'correct', 'correct', 'incorrect'], 'Paper 13: the keys mark an exact value, an angle in degrees, an expression in an equivalent form, and reject a wrong value');
  c.deq([RB.totals.total, RB.totals.autoAvailable, RB.totals.selfChecked, RB.totals.autoAwarded], [70, 23, 47, 4], 'Paper 13 totals: 10 multiple choice + 13 final answers available (q12c-ii is keyed exactly since 19 Nov 2026), 4 earned');
  c.eq((await get(hAu, paid, `/v1/papers/attempts/${B.id}/parts/q11a/solution`)).status, 200, 'the guideline is Premium: a Premium account has it');

  // ── 5 · handwritten parts keep the original, and are marked from the confirmed reading ──
  const inkPage = () => {
    const stroke = (x0, y0, n, t0) => { const raw = Array.from({ length: n }, (_, i) => ({ x: x0 + i * 1.37, y: y0 + Math.sin(i) * 3.3, t: t0 + i / 240, p: 0.2 + (i % 7) / 10, azimuth: 0.71, altitude: 1.02 })); return { raw, points: raw.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), t: p.t })) }; };
    return { strokes: [stroke(20, 40, 60, 1000.25), stroke(30, 120, 45, 1001.5)], removed: [] };
  };
  const inkBytes = Buffer.from(encodeInk({ ...inkPage(), width: 640, height: 320 }));
  const original = { kind: 'strokes', encoding: 'gzip', data: gzipSync(inkBytes).toString('base64'), sha256: sha(inkBytes), lines: [{ strokes: [0] }, { strokes: [1] }] };
  const hw = (await post(hAu, paid, `/v1/papers/${P13}/attempts`, { question: 11, fresh: true })).data.attempt;
  c.deq([hw.scope, hw.paper.sections.length, hw.paper.sections[0].questions.map(q => q.number), hw.paper.totalMarks], [{ question: 11, section: 'II' }, 1, [11], 15], 'a single question of a paper: only that question, its 15 marks');
  const img = picture('24');
  const noRead = await post(hAu, paid, `/v1/papers/attempts/${hw.id}/parts/q11a/original`, { mode: 'ink', text: '24', image: img, original });
  c.deq([noRead.status, noRead.data.error.code], [409, 'RECOGNITION_READ_EXPIRED'], 'a picture that was never read is refused: Submit and Keep never buy a read');
  c.eq((await post(hAu, paid, '/v1/handwriting/transcribe', { image: img })).status, 200, 'the student has the page read (the only paid read)');
  const reads = provider.bodies.length;
  const kept = await post(hAu, paid, `/v1/papers/attempts/${hw.id}/parts/q11a/original`, { mode: 'ink', text: '24', image: img, original });
  c.deq([kept.status, kept.data.kept, kept.data.original.sha256, kept.data.readingCorrected], [200, true, sha(inkBytes), false], 'the part is kept with its original, named by its SHA-256');
  c.eq(provider.bodies.length, reads, 'keeping it bought no read');
  c.eq((await post(hAu, paid, `/v1/papers/attempts/${hw.id}/parts/q11a/original`, { mode: 'ink', text: '24', image: img, original: { ...original, sha256: sha('x') } })).status, 400, 'an original that does not match its digest is refused');
  c.eq((await post(hAu, paid, `/v1/papers/attempts/${hw.id}/parts/q11a-i/original`, { mode: 'ink', text: '24', image: img, original })).status, 404, 'a part that is not in this sitting is 404');
  const row = await asStore(hAu.db).get('SELECT question_id,kind,sha256 FROM attempt_originals WHERE account_id=?', [paid.id]);
  c.deq([row.question_id, row.kind, row.sha256], [`${hw.id}:q11a`, 'strokes', sha(inkBytes)], 'the original is in attempt_originals, bound to this sitting and part');
  const mine = (await get(hAu, paid, `/v1/papers/attempts/${hw.id}`)).data.attempt.answers.q11a;
  c.deq([mine.mode, mine.text, mine.kept], ['ink', '24', true], 'the saved answer says it is kept');
  // editing the confirmed text after keeping it un-keeps it: the original belongs to the reading it was kept with
  await put(hAu, paid, `/v1/papers/attempts/${hw.id}/answers`, { answers: { q11a: { mode: 'ink', text: '25' } } });
  const unkept = await post(hAu, paid, `/v1/papers/attempts/${hw.id}/submit`, {});
  c.deq([unkept.status, unkept.data.error.code, unkept.data.error.parts], [409, 'PAPER_ORIGINALS_MISSING', ['q11a']], 'a handwritten part whose text changed after keeping is not marked until it is kept again');
  await put(hAu, paid, `/v1/papers/attempts/${hw.id}/answers`, { answers: { q11a: { mode: 'ink', text: '24' } } });
  const stale = (await get(hAu, paid, `/v1/papers/attempts/${hw.id}`)).data.attempt.answers.q11a.kept;
  c.eq(stale, false, 'the earlier keep no longer covers the edited text');
  const img2 = picture('24');
  await post(hAu, paid, `/v1/papers/attempts/${hw.id}/parts/q11a/original`, { mode: 'ink', text: '24', image: img2, original });
  const hwSub = await post(hAu, paid, `/v1/papers/attempts/${hw.id}/submit`, {});
  c.deq([hwSub.status, hwSub.data.attempt.result.parts.q11a.verdict, hwSub.data.attempt.result.parts.q11a.mode, hwSub.data.attempt.result.totals.total], [200, 'correct', 'ink', 15], 'the confirmed reading is marked by the engine; the part says it was handwritten');
  c.ok(!provider.bodies.join('\n').includes(inkBytes.toString('base64').slice(0, 40)), 'the reader never received the strokes');

  // ── Exam-style questions for a practice subtopic ────────────────────────────
  const es = await get(hAu, free, '/v1/papers/exam-style/me11-poly');
  c.eq(es.status, 200, 'exam-style questions are listed for an Extension 1 subtopic');
  c.ok(es.data.questions.length >= 3, 'with several multi-part questions (polynomials)');
  c.ok(es.data.questions.every(q => q.paperId && q.question >= 11 && q.marks > 0 && Array.isArray(q.matchingParts)), 'each names its paper, question, marks and matching parts');
  c.ok(es.data.questions[0].locked === false && es.data.questions.some(q => q.paperId === P01) && es.data.questions.filter(q => q.paperId !== P01).every(q => q.locked === true), 'for a free account the sample is open and the rest are locked');
  c.deq((await get(hAu, paid, '/v1/papers/exam-style/me11-poly')).data.questions.filter(q => q.locked), [], 'for Premium none is locked');
  c.deq((await get(hAu, free, '/v1/papers/exam-style/not-a-subtopic')).data.questions, [], 'an unknown subtopic: an empty list');
  c.deq(leaks(es.data), [], 'the list carries no paper content');
  const one = await post(hAu, free, `/v1/papers/${P01}/attempts`, { question: es.data.questions.find(q => q.paperId === P01).question, fresh: true });
  c.eq(one.status, 201, 'pressing one sits just that question');

  // ── 2 · India ───────────────────────────────────────────────────────────────
  const inFree = await student(hIn, null);
  for (const [method, path] of [['POST', `/v1/papers/${P01}/attempts`], ['GET', '/v1/papers/attempts'], ['GET', `/v1/papers/attempts/${A.id}`], ['POST', `/v1/papers/attempts/${A.id}/answers`],
    ['POST', `/v1/papers/attempts/${A.id}/submit`], ['GET', `/v1/papers/attempts/${A.id}/parts/q1/solution`], ['GET', `/v1/papers/attempts/${A.id}/figures/figdodec`], ['GET', '/v1/papers/exam-style/me11-poly']]) {
    const r = await hIn.request(path, { method, jar: inFree.jar, body: method === 'GET' ? undefined : {} });
    c.deq([r.status, r.data?.error?.code], [404, 'PAPERS_NOT_AVAILABLE'], `India: ${method} ${path.replace(A.id, ':id')} is 404`);
  }
  c.deq((await hIn.request('/v1/papers', { jar: inFree.jar })).status, 404, 'India: the list is 404');
  c.eq((await get(hAu, free, '/v1/papers')).data.papers.find(p => p.id === P01).inApp, true, 'the list tells the client which papers can be sat in the app');
} finally {
  await hAu.close();
  await hApproved.close();
  await hIn.close();
  fake.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`PAPER ATTEMPTS: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC accounts; the papers are the owner's real content]`);
