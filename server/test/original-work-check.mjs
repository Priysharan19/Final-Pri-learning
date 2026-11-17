// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's original work is kept with the mark (#08)
//
//   node server/test/original-work-check.mjs                    (SQLite)
//   node server/test/original-work-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// Owner rule: the final marking checks the human's handwriting, not the
// computer's. Proven here, over the shipped app (server/app.js → /v1) on a real
// loopback socket, with the real reader adapter pointed at a local scripted
// provider that records every request it receives:
//
//   1  round trip: the strokes the device captured come back byte-identical
//      (same SHA-256), every point equal to its float32 capture;
//   2  the receipt (grade reply) and the graded-attempt event name the digest;
//   3  no reconstruction replaces the original: insert-once, a replay finds the
//      same row, another original under the key is 409, the reading layer sits
//      beside the bytes and never in them, and nothing in the server updates
//      the table;
//   4  answer-blind: the reader received the picture alone — never the strokes,
//      the original or the answer;
//   5  authorization and isolation: another student, a teacher of no class of
//      theirs, a removed member and a role mismatch are refused; their teacher
//      is served;
//   6  limits: a wrong digest, a typed answer, an oversized page, a bad line
//      region are refused before anything is marked; over quota the mark still
//      commits and the reply says the server did not keep the page;
//   7  photos: the photographed page is kept as its own bytes;
//   8  retention: housekeeping expires an original past its retention;
//   9  account deletion removes every original.
//
// Evidence class: scripted provider and synthetic strokes. Nothing here is a
// real student's handwriting or a physical device.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pngDataUrl, jpegDataUrl } from './support/test-image.mjs';
import { decodeInk, encodeDecoded, encodeInk } from '../../client/src/engine/originalInk.js';

const dir = mkdtempSync(join(tmpdir(), 'pri-original-work-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const picture = label => pngDataUrl(`PICTURE|ok|${label}|` + 'a'.repeat(300));

// ── The scripted reader: answers the label in the picture, records each body ──
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
  PRI_HANDWRITING_API_KEY: 'local-original-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-fallback', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_AI_DAILY_FREE: '100000', PRI_AI_DAILY_PREMIUM: '100000'
});
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, promoteRole, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { runHousekeeping } = await import('../platform/housekeeping.js');
const { ORIGINAL_QUOTA, MAX_STROKES_WIRE_CHARS } = await import('../platform/originalWork.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
let people = 0;
async function person(role = 'student') {
  people += 1;
  await db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const email = `original.${people}@example.test`;
  const account = await registerAccount(h, { email, deviceId: `orig-ipad-${people}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  const verified = await verifyEmail(h, account.account.id);
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  if (role !== 'student') await promoteRole(h, account.jar, account.account.id, role);
  return { jar: account.jar, id: account.account.id };
}
const issue = async (jar, seed = 104729) => {
  const r = await h.request('/v1/practice/issue', { method: 'POST', jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`issue: ${r.status} ${r.text}`);
  return r.data.question.id;
};
const readFirst = (jar, image) => h.request('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image } });
const submit = (jar, qid, key, body) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': key }, body: { submissionId: key, ...body } });

// A page as InkCanvas captures it: raw pen samples (seconds on the event
// clock, pressure, tilt) beside the 1€ display points.
function capturedPage(shift = 0) {
  const stroke = (x0, y0, n, t0) => {
    const raw = Array.from({ length: n }, (_, i) => ({ x: x0 + i * 1.37 + shift, y: y0 + Math.sin(i) * 3.3, t: t0 + i / 240, p: 0.2 + (i % 7) / 10, azimuth: 0.71, altitude: 1.02 }));
    return { raw, points: raw.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), t: p.t })) };
  };
  return { strokes: [stroke(20, 40, 60, 1000.25), stroke(30, 120, 45, 1001.5), stroke(25, 200, 80, 1003)], removed: [{ ...stroke(200, 40, 20, 1000.9), removedAt: 1001.2 }] };
}
async function inkOriginal(page, extra = {}) {
  const bytes = Buffer.from(encodeInk({ ...page, width: 640, height: 320 }));
  return { bytes, original: { kind: 'strokes', encoding: 'gzip', data: gzipSync(bytes).toString('base64'), sha256: sha(bytes),
    lines: [{ strokes: [0] }, { strokes: [1] }, { strokes: [2] }], ...extra } };
}
const originalsOf = async accountId => db.all('SELECT * FROM attempt_originals WHERE account_id=? ORDER BY created_at', [accountId]);
const graded = async (accountId, qid) => (await db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [accountId]))
  .map(r => JSON.parse(r.payload_json)).find(p => p.questionId === qid);

try {
  const alice = await person();
  const bob = await person();
  const carol = await person('teacher');
  const dave = await person('teacher');

  // ══ 1 · Round trip ═════════════════════════════════════════════════════════
  const page = capturedPage();
  const { bytes, original } = await inkOriginal(page, { edits: [{ text: '9', at: Date.now() }] });
  const qid = await issue(alice.jar);
  const image = picture('9');
  c.eq((await readFirst(alice.jar, image)).status, 200, 'the student had the page read (the only paid read)');
  const bodiesAfterRead = provider.bodies.length;
  const first = await submit(alice.jar, qid, 'orig-first', { answer: '9', mode: 'ink', image, original });
  c.eq(first.status, 200, 'a handwritten answer submitted with its original is marked');
  c.eq(first.data.correct, true, 'by the deterministic engine, on the confirmed reading');
  c.deq([first.data.original?.saved, first.data.original?.sha256, first.data.original?.kind], [true, sha(bytes), 'strokes'], 'the reply (the receipt) names the original by its SHA-256');
  const event = await graded(alice.id, qid);
  c.deq([event?.original?.sha256, event?.original?.id], [sha(bytes), first.data.original.id], 'the graded-attempt event is bound to the same digest');
  const got = await h.request(`/v1/originals?attemptId=${first.data.attemptId}`, { jar: alice.jar });
  c.eq(got.status, 200, 'the student reads back the original behind the mark');
  const back = Buffer.from(got.data.original.data, 'base64');
  c.eq(sha(back), sha(bytes), 'round trip: stored strokes are byte-identical to the captured strokes (same SHA-256)');
  c.ok(back.equals(bytes), 'and equal byte for byte');
  const decoded = decodeInk(new Uint8Array(back));
  c.eq(decoded.strokes.length, 3, 'every stroke on the page is kept');
  c.eq(decoded.removed.length, 1, 'and the erased stroke is kept as a correction, not discarded');
  const every = page.strokes.every((s, i) => s.raw.every((p, j) => {
    const q = decoded.strokes[i].points[j];
    return q.x === Math.fround(p.x) && q.y === Math.fround(p.y) && Math.abs(q.p - p.p) <= 1 / 65535 && q.azimuth === Math.fround(p.azimuth);
  }));
  c.ok(every, 'every raw pen sample comes back at its float32 capture: not smoothed, not rounded to the display points');
  c.ok(decoded.strokes.every(s => s.conditioned === false), 'the strokes are the raw samples, not the canvas’s smoothed display points');
  c.ok(Buffer.from(encodeDecoded(decoded)).equals(bytes), 'the format is canonical: re-encoding the decoded page gives the same bytes');
  c.deq(got.data.original.lines, original.lines, 'each reading line names the strokes it came from');
  c.deq([got.data.original.reading.read, got.data.original.reading.confirmed, got.data.original.reading.corrected], ['9', '9', false], 'the reading layer: what Pri read and what the student confirmed');
  c.deq(got.data.original.reading.edits, original.edits, 'with the student\'s edits');

  // ══ 3 · No reconstruction replaces the original ═══════════════════════════
  const rowBefore = (await originalsOf(alice.id))[0];
  const replay = await submit(alice.jar, qid, 'orig-first', { answer: '9', mode: 'ink', image, original });
  c.eq(replay.status, 200, 'a retry under the same key is answered');
  c.deq(replay.data.original, first.data.original, 'with the very same original');
  const rows = await originalsOf(alice.id);
  c.eq(rows.length, 1, 'and no second row');
  c.ok(Buffer.from(rows[0].content).equals(Buffer.from(rowBefore.content)) && rows[0].sha256 === rowBefore.sha256, 'the kept bytes are untouched');
  const other = await inkOriginal(capturedPage(5));
  const swapped = await submit(alice.jar, qid, 'orig-first', { answer: '9', mode: 'ink', image, original: other.original });
  c.deq([swapped.status, swapped.data?.error?.code], [409, 'IDEMPOTENCY_KEY_REUSED'], 'another original under the same key is refused: a mark is never re-pointed at other writing');
  c.ok(!Buffer.from(rows[0].content).includes(Buffer.from('9')) || gzipSync(bytes).equals(Buffer.from(rows[0].content)), 'the bytes kept are the device\'s own (its gzip of the canonical strokes), no text added');
  const sources = readdirSync(new URL('../platform/', import.meta.url)).filter(f => f.endsWith('.js'))
    .map(f => readFileSync(new URL(`../platform/${f}`, import.meta.url), 'utf8')).join('\n');
  c.ok(!/UPDATE\s+attempt_originals/i.test(sources), 'nothing in the server ever updates an original (insert-once)');
  c.ok(!/attempt_originals/.test(readFileSync(new URL('../platform/handwritingProvider.js', import.meta.url), 'utf8')), 'the reader adapter never touches originals');

  // ══ 4 · Answer-blind ═══════════════════════════════════════════════════════
  const sentToReader = provider.bodies.join('\n');
  c.eq(provider.bodies.length, bodiesAfterRead, 'submitting the original bought no read');
  c.ok(!sentToReader.includes(original.data.slice(0, 60)) && !sentToReader.includes('pri-ink') && !sentToReader.includes('"original"'), 'the reader never received the strokes or the original');
  c.ok(provider.bodies.every(b => (JSON.parse(b).input[1].content.filter(p => p.type === 'input_image')).length === 1), 'it received one picture per read, and nothing of the answer');

  // ══ 2b · Corrections: what Pri read and what the student confirmed differ ═
  {
    const q2 = await issue(alice.jar, 104730);
    const img2 = picture('x = 9');
    await readFirst(alice.jar, img2);
    const o2 = await inkOriginal(capturedPage(1), { edits: [{ text: 'x = 9', at: 1 }, { text: '9', at: 2 }] });
    const r2 = await submit(alice.jar, q2, 'orig-corrected', { answer: '9', mode: 'ink', image: img2, original: o2.original });
    c.eq(r2.status, 200, 'a corrected reading is marked');
    const view = await h.request(`/v1/originals/${r2.data.original.id}`, { jar: alice.jar });
    c.deq([view.data.original.reading.read, view.data.original.reading.confirmed, view.data.original.reading.corrected], ['x = 9', '9', true],
      'both are kept: what Pri read and the corrected text the mark was given');
    c.eq(view.data.original.reading.edits.length, 2, 'with the edit history');
    c.eq(sha(Buffer.from(view.data.original.data, 'base64')), o2.original.sha256, 'and the ink itself unchanged by the correction');
  }

  // ══ 5 · Authorization and isolation ═══════════════════════════════════════
  const id = first.data.original.id;
  const bobRead = await h.request(`/v1/originals/${id}`, { jar: bob.jar });
  c.deq([bobRead.status, bobRead.data?.error?.code], [404, 'ORIGINAL_NOT_FOUND'], 'another student cannot read it by id');
  c.eq((await h.request(`/v1/originals?attemptId=${first.data.attemptId}`, { jar: bob.jar })).status, 404, 'nor by attempt');
  c.eq((await h.request(`/v1/originals?questionId=${qid}&submissionId=orig-first`, { jar: bob.jar })).status, 404, 'nor by question and submission');
  c.eq((await h.request(`/v1/originals/${id}`)).status, 401, 'signed out: refused');
  const teacherPath = (cls, student = alice.id) => `/v1/originals/class/${cls}/student/${student}/${id}`;
  const now = Date.now();
  await db.run('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)', ['orig-class', carol.id, 'Year 8', 'orig-join-hash', now]);
  await db.run('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)', ['dave-class', dave.id, 'Year 8 B', 'dave-join-hash', now]);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'a teacher whose class the student is not in is refused');
  // Joined AFTER the work was done: joining opens none of it.
  await db.run('INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES (?,?,?)', ['orig-class', alice.id, now]);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'work done before the student joined the class is not opened to the teacher');
  await db.run('UPDATE class_members SET joined_at=? WHERE class_id=? AND student_account_id=?', [now - 3600_000, 'orig-class', alice.id]);
  const served = await h.request(teacherPath('orig-class'), { jar: carol.jar });
  c.deq([served.status, served.data?.original?.sha256], [200, sha(bytes)], 'their teacher sees the student\'s own ink, by the same digest');
  c.eq((await h.request(teacherPath('dave-class'), { jar: dave.jar })).status, 404, 'another teacher, through their own class, is refused');
  c.eq((await h.request(teacherPath('orig-class'), { jar: dave.jar })).status, 404, 'and through a class they do not teach');
  c.eq((await h.request(teacherPath('orig-class', bob.id), { jar: carol.jar })).status, 404, 'a teacher cannot reach it under another student');
  c.eq((await h.request(teacherPath('orig-class'), { jar: bob.jar })).status, 403, 'a student cannot use the teacher route');
  c.eq((await h.request(`/v1/originals/${id}`, { jar: carol.jar })).status, 403, 'a teacher cannot use the student route');
  // A child whose guardian consent is blocked shares nothing, with their teacher included.
  await db.run("UPDATE accounts SET age_basis='child' WHERE id=?", [alice.id]);
  await db.run("INSERT INTO guardian_consents(account_id,guardian_name,guardian_email,notice_version,requested_at,withdrawn_at,method) VALUES (?,?,?,?,?,?,?)", [alice.id, 'Parent', 'parent@example.test', '2026-10', now, now, 'email-link']);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'a withdrawn guardian consent closes the teacher route');
  await db.run('DELETE FROM guardian_consents WHERE account_id=?', [alice.id]);
  await db.run("UPDATE accounts SET age_basis='adult' WHERE id=?", [alice.id]);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 200, 'and it reopens only with consent in place');
  await db.run('UPDATE class_members SET removed_at=? WHERE class_id=? AND student_account_id=?', [now, 'orig-class', alice.id]);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'after the student leaves the class, the teacher is refused');
  await db.run('UPDATE class_members SET removed_at=NULL WHERE class_id=? AND student_account_id=?', ['orig-class', alice.id]);
  await db.run('UPDATE classes SET archived_at=? WHERE id=?', [now, 'orig-class']);
  c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'an archived class grants nothing');

  // ══ 6 · Limits, refused before anything is marked ══════════════════════════
  {
    const q3 = await issue(bob.jar, 104731);
    const img3 = picture('9');
    await readFirst(bob.jar, img3);
    const o3 = await inkOriginal(capturedPage(2));
    const graded3 = async () => Number((await db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-grade'", [bob.id])).n);
    const before = await graded3();
    const wrong = await submit(bob.jar, q3, 'orig-bad-digest', { answer: '9', mode: 'ink', image: img3, original: { ...o3.original, sha256: 'f'.repeat(64) } });
    c.deq([wrong.status, wrong.data?.error?.code], [400, 'ORIGINAL_DIGEST_MISMATCH'], 'strokes that do not match their digest are refused');
    const typed = await submit(bob.jar, q3, 'orig-typed', { answer: '9', original: o3.original });
    c.deq([typed.status, typed.data?.error?.code], [400, 'PRACTICE_SUBMISSION_INVALID'], 'a typed answer carries no handwriting');
    const huge = await submit(bob.jar, q3, 'orig-huge', { answer: '9', mode: 'ink', image: img3, original: { ...o3.original, encoding: 'identity', data: 'A'.repeat(MAX_STROKES_WIRE_CHARS + 4) } });
    c.deq([huge.status, huge.data?.error?.code], [413, 'ORIGINAL_TOO_LARGE'], 'a page larger than the limit is refused, never cut');
    const bomb = gzipSync(Buffer.alloc(4 * 1024 * 1024));
    const zipBomb = await submit(bob.jar, q3, 'orig-bomb', { answer: '9', mode: 'ink', image: img3, original: { ...o3.original, data: bomb.toString('base64') } });
    c.deq([zipBomb.status, zipBomb.data?.error?.code], [400, 'ORIGINAL_INVALID'], 'a compressed page that expands past the limit is refused without expanding it');
    const badLine = await submit(bob.jar, q3, 'orig-bad-line', { answer: '9', mode: 'ink', image: img3, original: { ...o3.original, lines: [{ strokes: [99] }] } });
    c.deq([badLine.status, badLine.data?.error?.code], [400, 'ORIGINAL_INVALID'], 'a line naming a stroke not on the page is refused');
    const junk = Buffer.from('not ink at all');
    const notInk = await submit(bob.jar, q3, 'orig-not-ink', { answer: '9', mode: 'ink', image: img3, original: { kind: 'strokes', encoding: 'identity', data: junk.toString('base64'), sha256: sha(junk) } });
    c.deq([notInk.status, notInk.data?.error?.code], [400, 'ORIGINAL_INVALID'], 'bytes that are not a pri-ink page are refused');
    const extra = await submit(bob.jar, q3, 'orig-extra', { answer: '9', mode: 'ink', image: img3, original: { ...o3.original, expected: '9' } });
    c.deq([extra.status, extra.data?.error?.code], [400, 'ORIGINAL_INVALID'], 'an unknown field on the original is refused');
    c.eq(await graded3(), before, 'none of these was marked or recorded');
    c.eq((await originalsOf(bob.id)).length, 0, 'and nothing was kept');

    // Over quota: the mark commits; the server says it did not keep the page.
    for (let i = 0; i * 1048576 < ORIGINAL_QUOTA.strokesBytes; i++) {
      await db.run(`INSERT INTO attempt_originals(id,account_id,edition,question_id,submission_id,attempt_id,kind,origin,format,encoding,sha256,byte_length,canonical_bytes,content,lines_json,reading_json,created_at,expires_at)
        VALUES (?,?,'priyabhata',?,?,?,'strokes','ink','pri-ink-v1','identity',?,1048576,1048576,?, '[]','{}',?,?)`,
      [`00000000-0000-4000-9000-${String(i).padStart(12, '0')}`, bob.id, `filler-${i}`, `filler-${i}`, `filler-${i}`, 'e'.repeat(64), Buffer.from('x'), now, now + 1e10]);
    }
    const full = await submit(bob.jar, q3, 'orig-quota', { answer: '9', mode: 'ink', image: img3, original: o3.original });
    c.eq(full.status, 200, 'over quota, the answer is still marked');
    c.deq([full.data.original?.saved, full.data.original?.reason, full.data.original?.sha256], [false, 'quota', o3.original.sha256], 'and the reply says the server did not keep this page (the device keeps it)');
    c.ok(!(await graded(bob.id, q3))?.original, 'the event claims no kept original');
    await db.run("DELETE FROM attempt_originals WHERE account_id=? AND question_id LIKE 'filler-%'", [bob.id]);
  }

  // ══ 7 · A photographed page is kept as its own bytes ══════════════════════
  {
    const q4 = await issue(bob.jar, 104732);
    const photo = jpegDataUrl('PICTURE|ok|9|' + 'p'.repeat(400));
    c.eq((await readFirst(bob.jar, photo)).status, 200, 'the photo was read when the student asked');
    const photoBytes = Buffer.from(photo.split(',')[1], 'base64');
    const r4 = await submit(bob.jar, q4, 'orig-photo', { answer: '9', mode: 'photo', image: photo, original: { kind: 'image', origin: 'photo', samePicture: true, sha256: sha(photoBytes) } });
    c.deq([r4.status, r4.data.original?.saved, r4.data.original?.kind], [200, true, 'image'], 'a photographed answer keeps its photograph with the mark');
    const v4 = await h.request(`/v1/originals/${r4.data.original.id}`, { jar: bob.jar });
    c.eq(v4.data.original.data, photo, 'and serves the very photograph back');
    const mismatched = await submit(bob.jar, await issue(bob.jar, 104733), 'orig-photo-2', { answer: '9', mode: 'photo', image: photo, original: { kind: 'image', origin: 'photo', samePicture: true, sha256: 'a'.repeat(64) } });
    c.eq(mismatched.data?.error?.code, 'ORIGINAL_DIGEST_MISMATCH', 'a photograph whose digest does not match is refused');
    const otherImage = jpegDataUrl('a different picture, never read');
    const unread = await submit(bob.jar, await issue(bob.jar, 104734), 'orig-photo-3', { answer: '9', mode: 'photo', image: photo,
      original: { kind: 'image', origin: 'photo', data: otherImage, sha256: sha(Buffer.from(otherImage.split(',')[1], 'base64')) } });
    c.eq(unread.data?.error?.code, 'ORIGINAL_INVALID', 'a photo original that is not the picture that was read is refused');
  }

  // ══ 9 · Account deletion removes the ink ══════════════════════════════════
  {
    c.ok((await originalsOf(alice.id)).length >= 2, 'Alice has kept originals before deleting her account');
    const gone = await h.request('/v1/account', { method: 'DELETE', jar: alice.jar, body: { password: 'correct-horse-battery', accountId: alice.id } });
    c.ok(gone.status === 200 || gone.status === 204, `the account is deleted (${gone.status})`);
    c.eq((await originalsOf(alice.id)).length, 0, 'every one of her originals is deleted with it');
    c.eq((await h.request(teacherPath('orig-class'), { jar: carol.jar })).status, 404, 'and nobody can read them any more');
  }

  // ══ 8 · Retention ══════════════════════════════════════════════════════════
  {
    const before = (await originalsOf(bob.id)).length;
    const row = (await originalsOf(bob.id))[0];
    await runHousekeeping(db, Number(row.expires_at) - 1);
    c.eq((await originalsOf(bob.id)).length, before, 'an original inside its retention is kept by housekeeping');
    const record = await runHousekeeping(db, Number(row.expires_at) + 1);
    c.ok(record.originals >= 1 && (await originalsOf(bob.id)).length === before - 1, 'past the edition\'s retention, housekeeping deletes it');
  }

  console.log(`engine: ${h.engine}`);
  console.log(`original-work-check (${h.engine}): ${c.count()} checks passed`);
} finally {
  await h.close();
  fake.close();
  rmSync(dir, { recursive: true, force: true });
}
