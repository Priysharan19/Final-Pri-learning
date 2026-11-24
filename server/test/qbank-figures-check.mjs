// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagrams of the author question bank, over the real routes
//
// A bank question with a figure carries { alt, w, h } in the question the account is issued and nothing else about the file. The file is
// served to that account alone (GET /v1/practice/:id/figure, and /figure/data as JSON for the native bridge): signed out is refused, an id
// that was never issued, another account's question, a malformed id and a question with no diagram are all the same 404, the bytes are
// the committed file and match the sha256 the pack names, the headers keep the SVG inert, and a file that is not the one the pack names is
// never sent. Over the committed pack: every figure has its file, no figure shows an answer, no alt text states one.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-figures-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c6'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
delete process.env.PRI_QBANK_DIR;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { readBankFigure, figureOfBankEntry } = await import('../platform/qbankFigures.js');
const { productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { dotpointById } = await import('../../client/src/engine/curriculum.js');
const { statesAnswer, checkFiguresDir, verifyFigure } = await import('../../tools/qbank-diagrams.mjs');

const c = checks();
const pack = await qb.ensureQbank(process.env, { strict: true });
c.ok(pack && pack.questionCount > 1500, 'the committed pack loads');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const entries = qb.qbankEntries().map(e => ({ ...e.entry, family: e.family }));
const withFigure = entries.filter(e => e.diagram);
c.ok(withFigure.length > 150, `the pack holds ${withFigure.length} parts that have a figure`);
{ const { HELD_BY_EYE } = await import('../../tools/qbank-figure-risk.mjs'); c.deq(withFigure.filter(e => HELD_BY_EYE[e.group]).map(e => e.id), [], 'no packed question has a figure that was held after looking at it'); }

// ── the committed files, against the pack and the sanitiser ─────────────────
const dir = path.join(qb.DEFAULT_PACK_DIR, 'figures');
const checked = checkFiguresDir(dir);
c.deq(checked.problems, [], 'every committed figure matches the figures manifest and passes the sanitiser');
const questionIds = new Set(withFigure.map(e => e.group));
c.eq(checked.count, questionIds.size, 'the figures directory holds exactly the figures of the packed questions');
let hashOk = 0, altShown = 0, altLeaks = [], neutral = 0, generated = 0;
for (const e of withFigure) {
  const buf = fs.readFileSync(path.join(dir, `${e.group}.svg`));
  if (buf.length === e.diagram.bytes && sha(buf) === e.diagram.sha256) hashOk++;
  if (verifyFigure(buf.toString('utf8')).length === 0) altShown++;
  if (e.diagram.alt.startsWith('Diagram for this question')) neutral++; else generated++;
  // The same leak test the hints use, on the text alternative: it states no part of the key that the question does not state.
  if (statesAnswer({ prompt: e.prompt, answerType: e.answerType, answer: e.answer, difficulty: e.level }, e.diagram.alt)) altLeaks.push(e.id);
}
c.eq(hashOk, withFigure.length, 'every pack entry names the sha256 and length of the file it has');
c.eq(altShown, withFigure.length, 'every figure of the pack verifies');
c.deq(altLeaks, [], 'no text alternative states an answer the question does not state');
c.ok(generated > neutral, `text alternatives: ${generated} built from the figure, ${neutral} neutral`);
c.ok(withFigure.every(e => e.diagram.alt.length <= 500 && !/[—–]/.test(e.diagram.alt)), 'every text alternative is short plain text');
const figureDirNames = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
c.eq(figureDirNames.length, questionIds.size, 'no stray figure file');

// ── the figure of a question is only for the account it was issued to ───────
const h = await startApp({ engine: requestedEngine() });
try {
  let acct = 0, a = null, used = 0;
  const fresh = async () => { acct++; a = await registerAccount(h, { email: `qbank.figures${acct}@example.test`, deviceId: `ipad-qbank-figures-${acct}` }); await verifyEmail(h, a.account.id); used = 0; return a; };
  await fresh();
  const issue = async (body) => { if (used >= 80) await fresh(); used++; return h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body }); };
  // Draw bank questions until one with a figure is issued, then one without.
  const target = withFigure.filter(e => productPlaceOf(e.family, e.dp));
  let figured = null, plain = null, seed = 9000;
  for (let i = 0; i < 400 && (!figured || !plain); i++) {
    const pick = (figured ? entries.filter(e => !e.diagram) : target)[(i * 31) % (figured ? entries.filter(e => !e.diagram).length : target.length)];
    const place = productPlaceOf(pick.family, pick.dp);
    const dp = place.ordinal === null ? null : dotpointById(`${place.subtopic}.${place.ordinal + 1}`);
    const asked = dp && dp.forms.includes(pick.level) ? { dotpoint: dp.id } : {};
    for (let k = 0; k < 6; k++) {
      const r = await issue({ curriculum: 'nsw', generator: place.subtopic, difficulty: pick.level, ...asked, seed: (seed += 7919) % 0x7fffffff });
      if (r.status !== 201) break;
      const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, r.data.question.id]);
      const sealed = JSON.parse(row.response_json);
      if (sealed.diagram && !figured) figured = { id: r.data.question.id, sealed, issued: r.data.question, jar: a.jar, account: a.account.id };
      else if (!sealed.diagram && sealed._bank && !plain) plain = { id: r.data.question.id, bank: sealed._bank, jar: a.jar };
      if (figured && plain) break;
    }
  }
  c.ok(figured, 'a bank question with a figure was issued through the real route');
  c.ok(plain, 'a bank question without one was issued too');

  // What the issued question says about the figure: its text alternative and size, nothing else.
  c.deq(Object.keys(figured.issued.diagram).sort(), ['alt', 'h', 'w'], 'the issued question carries the figure\'s alt, width and height only');
  const entry = entries.find(e => e.id === figured.sealed._bank);
  c.eq(figured.issued.diagram.alt, entry.diagram.alt, 'the alt text is the pack\'s');
  c.ok(!JSON.stringify(figured.issued).includes(entry.diagram.sha256), 'the issued question does not carry the file\'s hash');
  c.ok(!('_bank' in figured.issued) && !('answer' in figured.issued), 'and no private field');

  const get = (p, jar) => h.request(p, { method: 'GET', jar: jar ?? a.jar, headers: { Accept: 'image/svg+xml, application/json' } });
  const own = await get(`/v1/practice/${figured.id}/figure`, figured.jar);
  c.eq(own.status, 200, 'the issued account is sent its figure');
  const want = fs.readFileSync(path.join(dir, `${entry.group}.svg`));
  c.eq(own.text, want.toString('utf8'), 'the bytes are the committed file');
  c.eq(sha(Buffer.from(own.text)), entry.diagram.sha256, 'and the sha256 the pack names');
  c.match(own.headers.get('content-type'), /^image\/svg\+xml/, 'content type is image/svg+xml');
  c.eq(own.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  c.match(own.headers.get('content-security-policy'), /default-src 'none'.*sandbox/, 'a locked-down content security policy: nothing loads, nothing runs');
  c.match(own.headers.get('cache-control'), /^private, max-age=\d+$/, 'cacheable by the account\'s own browser only');
  c.eq(own.headers.get('etag'), `"${entry.diagram.sha256}"`, 'ETag is the file\'s hash');
  const again = await h.request(`/v1/practice/${figured.id}/figure`, { method: 'GET', jar: figured.jar, headers: { 'If-None-Match': own.headers.get('etag') } });
  c.eq(again.status, 304, 'a repeat with the ETag is 304');
  const asJson = await get(`/v1/practice/${figured.id}/figure/data`, figured.jar);
  c.eq(asJson.status, 200, 'the JSON twin (native bridge) answers');
  c.deq({ sha256: asJson.data?.sha256, svg: asJson.data?.svg }, { sha256: entry.diagram.sha256, svg: want.toString('utf8') }, 'with the same bytes and hash');

  // Refusals: every one is the same 404, none says whether the question exists.
  const refused = [];
  const noSession = await h.request(`/v1/practice/${figured.id}/figure`, { method: 'GET', jar: {} });
  c.ok([401, 403].includes(noSession.status), `signed out is refused (${noSession.status})`);
  const unknown = await get(`/v1/practice/${crypto.randomUUID()}/figure`, figured.jar);
  const malformed = await get('/v1/practice/not-a-question/figure', figured.jar);
  const noDiagram = await get(`/v1/practice/${plain.id}/figure`, plain.jar);
  refused.push(unknown, malformed, noDiagram);
  c.deq(refused.map(r => r.status), [404, 404, 404], 'an id never issued, a malformed id and a question with no diagram are 404');
  c.deq(refused.map(r => r.data?.error?.code), ['QUESTION_NOT_FOUND', 'QUESTION_NOT_FOUND', 'QUESTION_NOT_FOUND'], 'with one code');
  c.ok(refused.every(r => !r.text.includes('<svg')), 'and no figure');
  // Another account holding no such question.
  const other = await registerAccount(h, { email: 'qbank.figures.other@example.test', deviceId: 'ipad-qbank-figures-other' });
  await verifyEmail(h, other.account.id);
  const theirs = await h.request(`/v1/practice/${figured.id}/figure`, { method: 'GET', jar: other.jar });
  c.eq(theirs.status, 404, 'another account asking for this account\'s question gets 404');
  c.ok(!theirs.text.includes('<svg'), 'and no figure');
  const theirsJson = await h.request(`/v1/practice/${figured.id}/figure/data`, { method: 'GET', jar: other.jar });
  c.eq(theirsJson.status, 404, 'the JSON twin refuses it too');

  // A file that is not the one the pack names is never sent.
  const copy = path.join(scratch, 'pack-copy');
  fs.cpSync(qb.DEFAULT_PACK_DIR, copy, { recursive: true });
  const env = { PRI_EDITION: 'prithagoras', PRI_QBANK_DIR: copy };
  const good = await readBankFigure(entry.id, env);
  c.ok(good && sha(good.bytes) === entry.diagram.sha256, 'a copy of the pack serves its figure');
  fs.appendFileSync(path.join(copy, 'figures', `${entry.group}.svg`), ' ');
  c.eq(await readBankFigure(entry.id, env), null, 'a figure file with a changed byte is not served');
  fs.rmSync(path.join(copy, 'figures', `${entry.group}.svg`));
  c.eq(await readBankFigure(entry.id, env), null, 'a missing figure file is not served');
  c.eq(await readBankFigure(entry.id, { PRI_EDITION: 'prithagoras', PRI_QBANK_DIR: 'off' }), null, 'with the bank off there is no figure');
  c.eq(await readBankFigure(entry.id, { PRI_EDITION: 'priyabhata' }), null, 'on another edition there is no figure');
  c.eq(figureOfBankEntry('../../etc/passwd'), null, 'a name that is not a bank entry names no file');
  c.eq(figureOfBankEntry(plain.bank), null, 'a question with no diagram has no figure');
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK FIGURES: PASS — ${c.count()}/${c.count()} checks over ${withFigure.length} parts with a figure`);
process.exit(0);
