// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the reading floor on the submit route (owner decision 19 Nov 2026)
//
//   node server/test/reading-floor-http-check.mjs                    (SQLite)
//   node server/test/reading-floor-http-check.mjs --engine=postgres
//
// The student no longer confirms the reading before marking (ADR-0001 amendment 19 Nov 2026). Proven
// over the shipped app on a loopback socket, with the real reader adapter pointed at a scripted provider:
//
//   1  a line read below the floor, flagged uncertain or blank is never judged: sweep of confidences
//      around the floor, for a working line and for the final answer; never a verdict, never the answer;
//   2  an unreadable or absent final answer replies 200 FINAL_ANSWER_UNREADABLE and records NOTHING:
//      no attempt, no try spent, no receipt; the same question is still fully open;
//   3  excluded line indexes and the reading used are recorded (reply, receipt row, kept original) and
//      appear in the account export; studentConfirmed is false;
//   4  a line the student corrected (not a read line) is judged as typed;
//   5  re-marking the same picture costs no further reading unit and no further provider call;
//   6  the reader still receives the picture alone (answer-blind).
// Evidence class: scripted provider, synthetic pictures. Not a real student's handwriting.
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

const dir = mkdtempSync(join(tmpdir(), 'pri-reading-floor-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// A picture's label is its reading: "text@confidence" lines joined by ';', a trailing "!" marks the line uncertain.
const picture = (label, salt = '') => pngDataUrl(`PICTURE|ok|${label}|${salt}` + 'a'.repeat(300));

const provider = { bodies: [] };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    provider.bodies.push(raw);
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const [, , label] = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|');
    const lines = label.split(';').filter(Boolean).map(entry => {
      const uncertain = entry.endsWith('!');
      const [text, conf] = entry.replace(/!$/, '').split('@');
      return { text, latex: '', confidence: Number(conf), uncertain, doubt: uncertain ? 'unclear' : '', gap_before: false };
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: sent.model, output_text: JSON.stringify({ lines, confidence: 0.99, needs_confirmation: false }),
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }));
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'ec'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-floor-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-primary', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_AI_DAILY_FREE: '100000', PRI_AI_DAILY_PREMIUM: '100000', PRI_FREE_PRACTICE_PER_DAY: '100000'
});
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_HANDWRITING_CONFIDENCE_FLOOR; // the shipped floor, 0.82

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const FLOOR = 0.82;
const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
let people = 0;
async function person() {
  people += 1;
  await db.run("DELETE FROM rate_limits WHERE bucket NOT LIKE 'ai-daily:%' AND bucket NOT LIKE 'hw-answer:%'");
  const account = await registerAccount(h, { email: `floor.${people}@example.test`, deviceId: `floor-ipad-${people}` });
  if (account.status !== 201) throw new Error(`register: ${account.status}`);
  const v = await verifyEmail(h, account.account.id);
  if (v.status !== 200) throw new Error(`verify: ${v.status}`);
  return { jar: account.jar, id: account.account.id };
}
const seed = 104729; // this seed's answer is 9; every question below is issued to its own account
const issue = async jar => {
  const r = await h.request('/v1/practice/issue', { method: 'POST', jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`issue: ${r.status} ${r.text}`);
  return r.data.question.id;
};
const read = (jar, image) => h.request('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image } });
const submit = (jar, qid, key, body) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': key }, body: { submissionId: key, mode: 'ink', ...body } });
const rows = async (accountId, qid) => ({
  grades: (await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-grade' AND key LIKE ?", [accountId, `${qid}:%`])).length,
  tries: (await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-tries' AND key=?", [accountId, qid])).length,
  done: (await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid])).length,
  recognitions: (await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [accountId])).length,
  events: (await db.all("SELECT id FROM learning_events WHERE account_id=? AND kind='graded-attempt' AND entity_id=?", [accountId, qid])).length
});
const aiUsed = async accountId => {
  const r = await db.get("SELECT COALESCE(SUM(count),0) AS n FROM rate_limits WHERE bucket LIKE 'ai-daily:handwriting:%'");
  return Number(r?.n || 0);
};
const page = async (shift = 0) => {
  const raw = Array.from({ length: 40 }, (_, i) => ({ x: 20 + i * 1.3 + shift, y: 40 + Math.sin(i) * 3, t: 1000 + i / 240, p: 0.5, azimuth: 0.7, altitude: 1 }));
  const bytes = Buffer.from(encodeInk({ strokes: [{ raw, points: raw.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), t: p.t })) }], removed: [], width: 640, height: 320 }));
  return { bytes, original: { kind: 'strokes', encoding: 'gzip', data: gzipSync(bytes).toString('base64'), sha256: sha(bytes), lines: [{ strokes: [0] }] } };
};

try {
  const alice = await person();

  // ══ 1 · A page read above the floor is marked as before; nothing is confirmed by the student ═════════
  {
    const qid = await issue(alice.jar);
    const img = picture('x = 9@0.97;9@0.95', 'a1');
    await read(alice.jar, img);
    const ok = await submit(alice.jar, qid, 'floor-clear', { answer: '9', steps: ['x = 9', '9'], image: img });
    c.eq(ok.status, 200, 'a page read above the floor is marked');
    c.eq(ok.data.correct, true, 'the engine marks the answer');
    c.deq([ok.data.reading?.studentConfirmed, ok.data.reading?.excludedLines], [false, []], 'the receipt says nothing was student-confirmed and no line was excluded');
  }

  // ══ 2 · Sweep: a below-floor final answer is never a verdict (right or wrong) and never an attempt ═══════
  const sweep = [0, 0.3, 0.5, 0.8, 0.81, 0.8199];
  let leaked = 0, spent = 0;
  for (const conf of sweep) {
    for (const answer of ['9', '4']) { // the right answer and a wrong one: neither is judged below the floor
      const alice2 = await person();
      const qid = await issue(alice2.jar);
      const img = picture(`2x = 18@0.95;${answer}@${conf}`, `s${conf}${answer}`);
      await read(alice2.jar, img);
      const r = await submit(alice2.jar, qid, `floor-sweep-${String(conf).replace('.', 'p')}-${answer}`, { answer, steps: ['2x = 18', answer], image: img });
      if (r.status !== 200 || r.data.code !== 'FINAL_ANSWER_UNREADABLE' || 'correct' in r.data || r.data.resolved !== false) leaked += 1;
      const rw = await rows(alice2.id, qid);
      if (rw.grades || rw.tries || rw.done || rw.events || rw.recognitions) spent += 1;
      c.deq(r.data.excludedLines, [1], `confidence ${conf}, answer ${answer}: the final-answer line is named as not read`);
    }
  }
  c.eq(leaked, 0, 'sweep: no confidence below the floor yields a verdict or an answer');
  c.eq(spent, 0, 'sweep: an unreadable final answer records no attempt, no receipt and spends no try');
  // at the floor and above it IS judged; an uncertain line never is, however confident
  for (const [label, expectJudged] of [[`9@${FLOOR}`, true], ['9@0.99', true], ['9@0.99!', false], ['9@1', true]]) {
    const p = await person();
    const qid = await issue(p.jar);
    const img = picture(`2x = 18@0.95;${label}`, `edge${label}`);
    await read(p.jar, img);
    const r = await submit(p.jar, qid, 'floor-edge', { answer: '9', steps: ['2x = 18', '9'], image: img });
    c.eq(r.data.code === 'FINAL_ANSWER_UNREADABLE', !expectJudged, `edge ${label}: ${expectJudged ? 'judged' : 'not judged'}`);
  }

  // ══ 3 · Unreadable final answer keeps everything: the question is still open and the page can be re-marked ═════
  const bob = await person();
  {
    const qid = await issue(bob.jar);
    const img = picture('2x = 18@0.95;9@0.4', 'b1');
    await read(bob.jar, img);
    const calls = provider.bodies.length;
    const none = await submit(bob.jar, qid, 'floor-none', { answer: '', steps: ['2x = 18'], image: img });
    c.eq(none.data.code, 'FINAL_ANSWER_UNREADABLE', 'an absent final answer is unreadable, not wrong');
    const blank = await submit(bob.jar, qid, 'floor-blank', { answer: '9', steps: ['2x = 18', '9'], image: img });
    c.eq(blank.data.code, 'FINAL_ANSWER_UNREADABLE', 'a final answer read below the floor is unreadable');
    c.deq(await rows(bob.id, qid), { grades: 0, tries: 0, done: 0, recognitions: 0, events: 0 }, 'nothing was recorded');
    c.eq(provider.bodies.length, calls, 'and the picture was not read again (the kept read is reused, free)');
    // The student's own text is judged as typed. (a) they rewrite the line, so the picture is read again and the
    // new page reads the answer above the floor (a different picture, a different read); (b) they type it, which
    // is a typed submission: no reading is involved. Both are the FIRST try of a question that still has both.
    const typed = await submit(bob.jar, qid, 'floor-typed', { answer: '9', steps: ['2x = 18'], mode: 'typed' });
    c.eq(typed.data.code, undefined, 'the typed final answer is judged');
    c.eq(typed.data.correct, true, 'by the engine');
    c.eq(typed.data.triesLeft, 0, 'on a question that still had both tries');
  }
  {
    const p = await person();
    const qid = await issue(p.jar);
    const img = picture('2x = 18@0.95;x = 9@0.4', 'b2');
    await read(p.jar, img);
    const edited = await submit(p.jar, qid, 'floor-edited', { answer: 'x = 9 ', steps: ['2x = 18', 'x = 9 '], image: img });
    c.eq(edited.data.code, 'FINAL_ANSWER_UNREADABLE', 'the same text as a below-floor line, even re-spaced, is still the unread line');
    const rewritten = await submit(p.jar, qid, 'floor-edited-2', { answer: '9', steps: ['2x = 18', '9'], image: img });
    c.eq(rewritten.data.correct, true, 'a line the student corrected (text the reader never gave) is judged as typed');
    c.deq(rewritten.data.reading?.lineStates, ['judged', 'judged'], 'and is not excluded');
  }

  {
    const p = await person();
    const qid = await issue(p.jar);
    const img = picture('2x = 18@0.95;x = 9@0.4', 'b3');
    await read(p.jar, img);
    const p2 = p;
    const bad = await submit(p2.jar, qid, 'floor-bad-flag', { answer: '9', steps: ['2x = 18', '9'], image: img, answerTyped: 'yes' });
    c.eq(bad.status, 400, 'answerTyped is only ever true');
    const typedSame = await submit(p2.jar, qid, 'floor-typed-same', { answer: 'x = 9', steps: ['2x = 18', 'x = 9'], image: img, answerTyped: true });
    c.eq(typedSame.data.code, undefined, 'a final answer the student typed is theirs, even when it equals the unread line');
    c.eq(typedSame.data.correct, true, 'and is marked by the engine');
    c.deq(typedSame.data.reading?.lineStates, ['judged', 'not-read'], 'while the unread working line is still not checked');
  }

  // ══ 4 · A below-floor working line is excluded: not checked, never the answer; recorded; exported ═════════
  const carol = await person();
  {
    const qid = await issue(carol.jar);
    const img = picture('2x = 18@0.95;x - 3 = 99@0.41;9@0.96', 'c1');
    await read(carol.jar, img);
    const o = await page(); 
    const r = await submit(carol.jar, qid, 'floor-excluded', { answer: '9', steps: ['2x = 18', 'x - 3 = 99', '9'], image: img, original: o.original });
    c.eq(r.status, 200, 'a page with one unreadable working line is marked');
    c.deq(r.data.reading?.excludedLines, [1], 'the unreadable working line is named by its index');
    c.deq(r.data.reading?.lineStates, ['judged', 'not-read', 'judged'], 'and comes back as not read');
    c.eq(r.data.reading?.studentConfirmed, false, 'the reply records that the reading was not student-confirmed');
    const ev = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition' AND key=?", [carol.id, r.data.reading.receipt]);
    const proof = JSON.parse(ev.response_json);
    c.ok(proof.studentConfirmed === false || proof.parentReceipt, 'the reading receipt records studentConfirmed false');
    const orig = await db.get('SELECT reading_json FROM attempt_originals WHERE account_id=? AND question_id=?', [carol.id, qid]);
    const rj = JSON.parse(orig.reading_json);
    c.deq([rj.studentConfirmed, rj.excludedLines], [false, [1]], 'the kept original records not student-confirmed and the excluded lines');
    c.ok(Array.isArray(rj.readLines) && rj.readLines.length === 3 && rj.readLines[1].confidence === 0.41, 'and the reading used, with its confidences');
    // a doubtful line cannot cause a wrong cross: the page is marked as if the line were absent
    c.ok(!JSON.stringify(r.data.stepReport || {}).includes('x - 3 = 99'), 'the excluded text never reached the step check');
    // export
    const ex = await h.request('/v1/account/export', { jar: carol.jar });
    c.eq(ex.status, 200, 'the account exports');
    const t = JSON.stringify(ex.data);
    c.ok(t.includes('excludedLines') && t.includes('studentConfirmed') && t.includes('readLines'), 'the export shows the excluded lines, studentConfirmed and the reading used');
  }

  // ══ 4b · The card sends the working as one string; the floor reads it line by line (26 Nov 2026) ═════════════
  const stella = await person();
  {
    const qid = await issue(stella.jar);
    const img = picture('2x = 18@0.95;x - 3 = 99@0.41;9@0.96', 's1');
    await read(stella.jar, img);
    const r = await submit(stella.jar, qid, 'floor-string-steps', { answer: '9', steps: '2x = 18\nx - 3 = 99\n9', image: img });
    c.eq(r.status, 200, 'a page whose working arrives as one string is marked');
    c.deq(r.data.reading?.excludedLines, [1], 'the unreadable working line is named by its index, as for a list');
    c.deq(r.data.reading?.lineStates, ['judged', 'not-read', 'judged'], 'and comes back as not read');
    c.ok(!JSON.stringify(r.data.stepReport || {}).includes('x - 3 = 99'), 'the excluded text never reached the step check');
  }

  // ══ 5 · A wrong, doubtful line is never a cross: only the engine decides, and only on judged lines ════════
  const dave = await person();
  {
    const qid = await issue(dave.jar);
    const img = picture('2x = 18@0.95;2x = 17@0.3;x = 9@0.95;9@0.95', 'd1');
    await read(dave.jar, img);
    const r = await submit(dave.jar, qid, 'floor-nocross', { answer: '9', steps: ['2x = 18', '2x = 17', 'x = 9', '9'], image: img });
    c.deq(r.data.reading?.lineStates, ['judged', 'not-read', 'judged', 'judged'], 'the false line is not read');
    const lines = r.data.stepReport?.lines || [];
    c.ok(!lines.some(l => l.status === 'break' && /17/.test(String(l.text || ''))), 'and it is never crossed');
  }

  // ══ 6 · Re-marking the same picture after a correction: free read, same issued question, replaced verdict ═══
  const erin = await person();
  {
    const qid = await issue(erin.jar);
    const img = picture('2x = 18@0.95;4@0.97', 'e1');
    await read(erin.jar, img);
    const unitsBefore = await aiUsed(erin.id), calls = provider.bodies.length;
    const first = await submit(erin.jar, qid, 'floor-remark-1', { answer: '4', steps: ['2x = 18', '4'], image: img });
    c.eq(first.data.correct, false, 'a wrong final answer read confidently is the engine\'s to mark wrong');
    // CTO ruling 19 Nov 2026: written working is ONE authoritative attempt. The first submit RESOLVES the question and
    // returns the full marked page (per-line states, first-error reason, mark); a correction is a Redo (a new copy
    // with no new credit), never a second credited try on the same issued question.
    c.eq(first.data.resolved, true, 'written working resolves on the first submit, wrong or right');
    c.eq(first.data.triesLeft, 0, 'there is no second credited try for written working');
    c.ok(first.data.stepReport && Array.isArray(first.data.stepReport.lines), 'the full marked page (per-line report) comes back');
    c.deq(await rows(erin.id, qid), { grades: 1, tries: 0, done: 1, recognitions: 2, events: 1 }, 'one attempt, one completion and one learning event (the reading receipt is the read plus the submit)');
    const second = await submit(erin.jar, qid, 'floor-remark-2', { answer: '9', steps: ['2x = 18', '9'], image: img });
    c.eq(second.status, 409, 'a corrected re-submit on the resolved question is refused');
    c.eq(second.data.error?.code, 'QUESTION_ALREADY_GRADED', 'as already graded: it earns nothing and never overturns the verdict');
    c.deq(await rows(erin.id, qid), { grades: 1, tries: 0, done: 1, recognitions: 2, events: 1 }, 'and records nothing more');
    c.eq(await aiUsed(erin.id), unitsBefore, 'neither submission buys a read: no reading unit is spent');
    c.eq(provider.bodies.length, calls, 'and the provider is not called again for the same picture');
  }

  // ══ 6a · The one-attempt rule is the SERVER's, decided from what the request carries ══════════════════════
  {
    const p = await person();
    const qid = await issue(p.jar);
    const img = picture('2x = 18@0.95;4@0.97', 'f1');
    await read(p.jar, img);
    // a wrong ink answer carrying a client claim that it is still open still resolves: nothing the client says buys a try
    const w = await submit(p.jar, qid, 'floor-one-1', { answer: '4', steps: ['2x = 18', '4'], image: img, resolved: false, triesLeft: 1 });
    c.eq(w.status, 400, 'a client claim about tries or resolution is refused outright: the body has no such field');
    const w2 = await submit(p.jar, qid, 'floor-one-2', { answer: '4', steps: ['2x = 18', '4'], image: img });
    c.eq(w2.data.resolved, true, 'the server alone resolves written working, from the picture it carries');
    // typed answers keep both tries: a wrong first try is open and says nothing per line, no key, no solution
    const t = await person();
    const tq = await issue(t.jar);
    const wrong = await submit(t.jar, tq, 'floor-typed-1', { answer: '4', steps: ['2x = 18', '4'], mode: 'typed' });
    c.eq(wrong.data.resolved, false, 'a typed wrong first try is still open');
    c.eq(wrong.data.triesLeft, 1, 'with one try left');
    c.ok(!wrong.data.stepReport && !wrong.data.lineStates && !wrong.data.solution, 'and no reply before resolution carries a per-line verdict, key or solution');
  }

  // ══ 6b · A question answered BY its working: the lines are the answer, and the floor applies to each of them ═════
  const gail = await person();
  {
    let qid = null, lines = null;
    for (const difficulty of [4, 5, 3]) for (let sd = 1; sd < 60 && !lines; sd++) {
      const r = await h.request('/v1/practice/issue', { method: 'POST', jar: gail.jar, body: { generator: 'c10-trigonometry-current', difficulty, seed: sd, curriculum: 'in' } });
      if (r.status !== 201 && r.status !== 200) continue;
      const row = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [gail.id, r.data.question.id]);
      const q = JSON.parse(row.response_json);
      if (q.answerType === 'working' && typeof q.answer?.canonicalWorking === 'string' && q.answer.canonicalWorking.split('\n').length >= 4) { qid = r.data.question.id; lines = q.answer.canonicalWorking.split('\n'); }
    }
    c.ok(!!qid, 'found a working-type item (a "Prove that" proof) to issue');
    if (qid) {
      const four = [lines[0], lines[1], lines[2], lines[lines.length - 1]];
      // line 2 is a false statement read below the floor: it must be left out, not judged
      const img = picture(`${four[0]}@0.97;${four[1].replace(/[;@!]/g, '')}x@0.35;${four[2]}@0.96;${four[3]}@0.95`, 'w1');
      await read(gail.jar, img);
      const wrote = [four[0], `${four[1].replace(/[;@!]/g, '')}x`, four[2], four[3]];
      const r = await submit(gail.jar, qid, 'floor-working', { answer: wrote.join('\n'), image: img });
      c.eq(r.status, 200, 'a working-type page with one unreadable line is marked');
      c.deq(r.data.reading?.excludedLines, [1], 'the unreadable line of the proof is left out');
      c.deq(r.data.reading?.lineStates, ['judged', 'not-read', 'judged', 'judged'], 'and named as not read');
      c.ok(!JSON.stringify(r.data.stepReport || {}).includes(wrote[1]), 'its text never reached the step check');
    }
  }
  {
    const p2 = await person();
    let qid = null;
    for (const difficulty of [4, 5, 3]) for (let sd = 1; sd < 60 && !qid; sd++) {
      const r = await h.request('/v1/practice/issue', { method: 'POST', jar: p2.jar, body: { generator: 'c10-trigonometry-current', difficulty, seed: sd, curriculum: 'in' } });
      if (r.status !== 201 && r.status !== 200) continue;
      const row = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [p2.id, r.data.question.id]);
      if (JSON.parse(row.response_json).answerType === 'working') qid = r.data.question.id;
    }
    if (qid) {
      const img = picture('x + 1@0.3;x + 2@0.2', 'w2');
      await read(p2.jar, img);
      const r = await submit(p2.jar, qid, 'floor-working-none', { answer: 'x + 1\nx + 2', image: img });
      c.eq(r.data.code, 'FINAL_ANSWER_UNREADABLE', 'a working-type page with no judged line is unreadable, not marked');
      c.deq(await rows(p2.id, qid), { grades: 0, tries: 0, done: 0, recognitions: 0, events: 0 }, 'and records nothing');
    }
  }

  // ══ 7 · Answer-blind, unchanged ═══════════════════════════════════════════════════════════════════════════
  c.ok(provider.bodies.every(b => (JSON.parse(b).input[1].content.filter(p => p.type === 'input_image')).length === 1), 'the reader received one picture per read');
  c.ok(provider.bodies.every(b => !/"?answer"?\s*:|expected|solution|\bkey\b/i.test(JSON.parse(b).input[1].content.filter(p => p.type !== 'input_image').map(p => p.text || '').join(' '))), 'and nothing of the answer, the steps or the key');
  console.log(`engine: ${h.engine}`);
  console.log(`READING FLOOR HTTP (${h.engine}): PASS: ${c.count()} checks`);
} finally {
  await h.close();
  fake.close();
  rmSync(dir, { recursive: true, force: true });
}
