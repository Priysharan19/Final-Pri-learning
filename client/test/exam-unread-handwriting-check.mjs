// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · unread exam handwriting, as the device holds it
//
//   node client/test/exam-unread-handwriting-check.mjs
//
// The server decides everything about a page of handwriting that was not read
// when a paper closed (server/test/exam-handwriting-check.mjs proves that side
// over HTTP). This suite proves the device's half, with no browser: the page is
// frozen as a picture and a digest the server will agree with; the digest —
// never the picture — is what a checkpoint and a submit carry; nothing that
// arrives after the deadline joins the frozen set; a pending answer is shown
// as pending and never as blank or wrong; and when a page is read later, only
// the lines that were pending on this device can change.
//
// SYNTHETIC: the "picture" is a fixed byte string from a stand-in rasteriser,
// and the server's replies are scripted. No reader, no handwriting, no device.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex, pictureDigest, freezePage, unreadInkKeys, pendingSummary, dataUrlBytes } from '../src/local/examPages.js';
import { saveExamResponses, examMarkingInputs, cleanPages } from '../src/local/examSession.js';
import { markPendingLines, applyHandwritingAmendment, keepFrozenPages, resolveFrozenHandwriting, recoverHandwriting } from '../src/local/serverExam.js';

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };
const clone = value => JSON.parse(JSON.stringify(value));

// ── The digest is the server's digest ────────────────────────────────────────
for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 4096, 700001]) {
  const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
  eq(sha256Hex(bytes), createHash('sha256').update(bytes).digest('hex'), `SHA-256 of ${n} bytes is the standard digest`);
}
const png = label => 'data:image/png;base64,' + Buffer.from('PAGE|' + label + '|' + 'z'.repeat(500)).toString('base64');
const serverDigest = image => createHash('sha256').update(Buffer.from(image.split(',')[1], 'base64')).digest('hex');
eq(pictureDigest(png('a')), serverDigest(png('a')), 'the digest of a picture is the SHA-256 of its decoded bytes — what the server computes');
eq([pictureDigest('data:text/html;base64,AAAA'), pictureDigest('not a data url'), dataUrlBytes(null)], [null, null, null], 'something that is not a picture has no digest');
ok(pictureDigest(png('a')) !== pictureDigest(png('b')), 'one changed stroke is a different picture and a different digest');

const strokes = [{ points: [[1, 1], [9, 9]] }];
const rasterize = s => ({ dataUrl: png(JSON.stringify(s)) });
const frozen = freezePage(strokes, rasterize);
eq([frozen.image, frozen.digest], [png(JSON.stringify(strokes)), serverDigest(png(JSON.stringify(strokes)))], 'a page is frozen as its picture and that picture\'s digest');
eq([freezePage([], rasterize), freezePage(strokes, () => null), freezePage(strokes, () => { throw new Error('no canvas'); }), freezePage(strokes, null)],
  [null, null, null, null], 'no ink, or no picture, freezes nothing — and never throws');
eq(unreadInkKeys({ a: { strokes }, b: { strokes }, c: { strokes: [] }, d: { strokes } }, { b: '42', d: '   ' }), ['a', 'd'],
  'unread handwriting is ink on the page with no answer read from it');

// ── What the paper keeps, and when ───────────────────────────────────────────
const exam = () => ({ id: 'e1', questionIds: ['q1', 'q2', 'q3'], startedAt: 1_000_000, deadlineAt: 1_000_000 + 30 * 60000, latestSeenAt: 1_000_000, durationMin: 30 });
const allowed = new Set(['q1', 'q2', 'q3']);
const page = label => ({ digest: pictureDigest(png(label)), image: png(label) });
eq(Object.keys(cleanPages({ q1: page('one'), q9: page('nine'), q2: { digest: 'short', image: png('x') }, q3: { digest: page('t').digest, image: 'javascript:alert(1)' } }, allowed)), ['q1'],
  'only a well-formed picture and digest for a question of this paper is kept');
{
  const e = exam();
  saveExamResponses(e, { answers: {}, unread: ['q1', 'q2'], pages: { q1: page('one'), q2: page('two') } }, 1_000_100);
  eq(Object.keys(e.responses.pages).sort(), ['q1', 'q2'], 'a save keeps the picture of each unread page with the paper');
  saveExamResponses(e, { answers: {}, unread: ['q1', 'q2'], pages: {} }, 1_000_200);
  eq(e.responses.pages.q1, page('one'), 'a later save that sends no picture again keeps the one it has');
  saveExamResponses(e, { answers: {}, unread: ['q1', 'q2'], pages: { q1: page('one more stroke') } }, 1_000_300);
  eq([e.responses.pages.q1.digest, e.responses.pages.q2.digest], [page('one more stroke').digest, page('two').digest], 'new strokes replace that page\'s picture; the other page is untouched');
  saveExamResponses(e, { answers: { q2: '17' }, unread: ['q1'] }, 1_000_400);
  eq(Object.keys(e.responses.pages), ['q1'], 'a page that has been read is no longer an unread page');
  saveExamResponses(e, { answers: { q2: '17' } }, 1_000_500);
  eq(Object.keys(e.responses.pages), ['q1'], 'a save that says nothing about handwriting leaves the frozen pages as they were');

  // Submit inside the deadline: what the submit names.
  const inTime = examMarkingInputs(clone(e), { answers: { q2: '17' }, unread: ['q1', 'q3'], pages: { q3: page('three') }, reason: 'student' }, 1_000_600);
  eq([Object.keys(inTime.pages).sort(), inTime.late], [['q1', 'q3'], false], 'a submit inside the deadline freezes the unread pages it names');
  const readNow = examMarkingInputs(clone(e), { answers: { q1: '5', q2: '17' }, unread: ['q1'], pages: {} }, 1_000_600);
  eq(Object.keys(readNow.pages), [], 'an answer that was read is marked on its transcript, not left pending on its picture');

  // After the deadline: only what was saved before it.
  const afterBell = e.deadlineAt + 10 * 60000;
  const late = examMarkingInputs(clone(e), { answers: { q1: '5', q3: '9' }, unread: ['q1', 'q3'], pages: { q1: page('rewritten after the bell'), q3: page('new after the bell') }, reason: 'deadline' }, afterBell);
  eq([late.late, Object.keys(late.pages), late.pages.q1.digest, late.answers],
    [true, ['q1'], page('one more stroke').digest, { q2: '17' }],
    'after the deadline neither a new answer, nor new strokes, nor a new page joins the submission: only the autosave before the bell');
  const e2 = clone(e);
  e2.latestSeenAt = afterBell;
  assert.throws(() => saveExamResponses(e2, { answers: {}, unread: ['q1'], pages: { q1: page('after') } }, afterBell), /Time is up/);
  count++;
  eq(e2.responses.pages.q1.digest, page('one more stroke').digest, 'and nothing can be saved to the paper after it: the frozen page is what it was');
}

// ── A pending answer on the device's own result ──────────────────────────────
const serverLine = (id, extra = {}) => ({ id, serverQuestionId: id, marks: 2, awarded: 0, correct: false, unanswered: true, given: '', feedback: '', markingScheme: 'final-answer', outcome: 'unanswered', ...extra });
const pendingLine = id => serverLine(id, { pending: true, outcome: 'pending', feedback: 'not read yet' });
const pages = states => ({ handwriting: { pages: Object.fromEntries(Object.entries(states).map(([key, [state, reason]]) => [key, { digest: 'd'.repeat(64), state, reason, attempts: 0, nextAttemptAt: 0 }])) } });
{
  const result = {
    ...pages({ s2: ['awaiting-reading', 'not-read'], s3: ['needs-review', 'uncertain'], 's4::b': ['awaiting-reading', 'not-read'] }),
    detail: [
      serverLine('s1', { awarded: 2, correct: true, unanswered: false, given: '7', outcome: 'correct' }), pendingLine('s2'), pendingLine('s3'),
      { id: 's4', serverQuestionId: 's4', multipart: true, marks: 4, awarded: 2, correct: false, unanswered: false, pending: true,
        parts: [{ key: 'a', marks: 2, awarded: 2, correct: true, unanswered: false, given: '3' }, { key: 'b', marks: 2, awarded: 0, correct: false, unanswered: true, given: '', pending: true }] },
      serverLine('s5')
    ]
  };
  const detail = markPendingLines(result, clone(result.detail).map(d => ({ ...d })));
  eq(detail.map(d => [d.id, d.pending, d.pendingState, d.pendingReason]),
    [['s1', undefined, undefined, undefined], ['s2', true, 'awaiting-reading', 'not-read'], ['s3', true, 'needs-review', 'uncertain'], ['s4', true, undefined, undefined], ['s5', undefined, undefined, undefined]],
    'each pending answer says on its own line that it is pending and why; a blank answer is simply unanswered');
  eq(detail[3].parts.map(p => [p.key, p.pending, p.pendingState]), [['a', undefined, undefined], ['b', true, 'awaiting-reading']], 'and so does a pending part of a structured question');
  eq(pendingSummary(detail), { marks: 6, awaiting: 2, review: 1, any: true }, 'the page can say how many marks are undecided and whether any page can still be read');
  eq(pendingSummary([serverLine('s1'), serverLine('s5')]), { marks: 0, awaiting: 0, review: 0, any: false }, 'a result with no pending answer has nothing provisional about it');

  // A page is read later: only what was pending here may change.
  const held = { id: 'e1', questionIds: ['s1', 's2', 's3', 's4', 's5'], server: { examId: 'x', questionIds: ['s1', 's2', 's3', 's4', 's5'], handwriting: { pages: { s2: png('s2'), 's4::b': png('s4b') } } }, finishedAt: 5, score: 4, total: 12, detail: clone(detail) };
  const before = clone(held.detail);
  const amended = clone(result);
  amended.score = 9;
  amended.total = 12;
  amended.detail[0] = serverLine('s1', { awarded: 0, correct: false, unanswered: false, given: 'TAMPERED', outcome: 'wrong' });      // a line that was NOT pending
  amended.detail[1] = serverLine('s2', { awarded: 2, correct: true, unanswered: false, given: '12', outcome: 'correct', readAfterClose: true });
  amended.detail[3] = { ...amended.detail[3], awarded: 4, correct: true, pending: undefined,
    parts: [{ key: 'a', marks: 2, awarded: 0, correct: false, unanswered: false, given: 'TAMPERED' }, { key: 'b', marks: 2, awarded: 2, correct: true, unanswered: false, given: '8', readAfterClose: true }] };
  amended.handwriting.pages.s2.state = 'resolved';
  amended.handwriting.pages['s4::b'].state = 'resolved';
  applyHandwritingAmendment(held, amended);
  eq([held.detail[1].given, held.detail[1].correct, held.detail[1].awarded, held.detail[1].pending, held.detail[1].readAfterClose, held.score],
    ['12', true, 2, undefined, true, 9], 'the answer that was pending takes the server\'s mark and stops being pending; the score is the server\'s');
  eq([held.detail[0], held.detail[4]], [before[0], before[4]], 'a line that was not pending is never touched, whatever arrives for it');
  eq([held.detail[3].parts[0], held.detail[3].parts[1].given, held.detail[3].parts[1].correct, held.detail[3].parts[1].pending, held.detail[3].pending],
    [before[3].parts[0], '8', true, undefined, undefined], 'in a structured question only the pending part changes; its sibling is exactly what it was');
  eq([held.detail[2].pending, held.detail[2].pendingState, held.detail[2].given], [true, 'needs-review', ''], 'an answer the reader was unsure of stays pending and preserved');
  keepFrozenPages(held, amended, held.server.handwriting.pages);
  eq(held.server.handwriting, undefined, 'the pictures of pages that are settled are forgotten');
}

// ── Presenting frozen pages: once each, only while waiting, and bounded ──────
{
  const result = { authoritative: true, detail: [], ...pages({ a: ['awaiting-reading', 'not-read'], b: ['needs-review', 'uncertain'], c: ['awaiting-reading', 'reader-unavailable'], d: ['awaiting-reading', 'not-read'], e: ['resolved', null] }) };
  result.handwriting.pages.c.nextAttemptAt = 10_000_000;                 // inside its backoff
  const images = { a: png('a'), b: png('b'), c: png('c'), e: png('e') };  // no picture held for d
  const asked = [];
  const transport = { resolveExamHandwriting: async (examId, body) => { asked.push([examId, body.key, body.image]); const next = clone(result); next.handwriting.pages[body.key].state = 'resolved'; return { result: next, attempted: true }; } };
  const settled = await resolveFrozenHandwriting('exam-1', result, images, { now: 1_000, transport });
  eq(asked, [['exam-1', 'a', png('a')]], 'only a page that is waiting, outside its backoff, and whose frozen picture this device holds is presented — once');
  eq(settled.handwriting.pages.a.state, 'resolved', 'and the server\'s reply is the result');
  const many = { authoritative: true, detail: [], ...pages(Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['k' + i, ['awaiting-reading', 'not-read']]))) };
  let sent = 0;
  await resolveFrozenHandwriting('exam-1', many, Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['k' + i, png('k' + i)])), { now: 1_000, transport: { resolveExamHandwriting: async () => { sent++; return { result: many }; } } });
  eq(sent, 6, 'however many pages wait, a fixed number are presented while the student waits on the submit');
  let tries = 0;
  const offline = await resolveFrozenHandwriting('exam-1', many, { k0: png('k0'), k1: png('k1') }, { now: 1_000, transport: { resolveExamHandwriting: async () => { tries++; throw Object.assign(new Error('offline'), { status: 0, code: 'NETWORK_ERROR' }); } } });
  ok(tries <= 2 && offline === many, 'with no connection nothing is settled and nothing loops: the pages stay frozen and pending');
  const refusedImages = { k0: png('not the frozen page'), k1: png('k1') };
  let presented = 0;
  await resolveFrozenHandwriting('exam-1', many, refusedImages, { now: 1_000, transport: { resolveExamHandwriting: async (id, body) => { presented++; if (body.key === 'k0') throw Object.assign(new Error('changed'), { status: 409, code: 'EXAM_HANDWRITING_CHANGED' }); return { result: many }; } } });
  eq([presented, Object.keys(refusedImages)], [2, ['k1']], 'a picture the server says is not the frozen page is dropped, so it is never sent again; the other pages are still presented');

  // A later visit: the server is asked how each page stands, then the same bounded presentation.
  const exam2 = { id: 'e-late', questionIds: ['a'], server: { examId: 'x', questionIds: ['a'], handwriting: { pages: { a: png('a') } } }, finishedAt: 5, score: 0, total: 2,
    detail: markPendingLines({ ...pages({ a: ['awaiting-reading', 'not-read'] }), detail: [pendingLine('a')] }, [pendingLine('a')]) };
  const remote = { authoritative: true, score: 0, total: 2, detail: [pendingLine('a')], ...pages({ a: ['awaiting-reading', 'not-read'] }) };
  const done = { authoritative: true, score: 2, total: 2, detail: [serverLine('a', { awarded: 2, correct: true, unanswered: false, given: '4', outcome: 'correct' })], ...pages({ a: ['resolved', null] }) };
  let gets = 0, posts = 0;
  const visit = { getExam: async () => { gets++; return { state: 'finished', result: remote }; }, resolveExamHandwriting: async () => { posts++; return { result: done }; } };
  eq([await recoverHandwriting(exam2, { transport: visit }), exam2.score, exam2.detail[0].correct, exam2.detail[0].pending, exam2.server.handwriting, gets, posts],
    [true, 2, true, undefined, undefined, 1, 1], 'on a later visit the frozen page is presented once, the pending line is marked, and its picture is forgotten');
  eq([await recoverHandwriting(exam2, { transport: visit, force: true }), gets, posts], [false, 1, 1], 'a paper with nothing waiting asks the server nothing');
}

console.log(`EXAM UNREAD HANDWRITING (DEVICE): PASS — ${count}/${count} checks — a page is frozen by the server's own digest, only digests travel, nothing joins after the deadline, and only pending lines ever change. Synthetic pictures and scripted replies.`);
