// Pri Learning · F7: practice official JEE questions by length-of-working band.
//
// Over real HTTP, on either engine:
//   · the band is computed only from what a record carries — its chapter and
//     the number of steps in its recorded solution — and says so (`basis`);
//     the catalog's counts add up to the archive's JEE records exactly, and
//     nothing in it is a rank, a percentile or a predicted score;
//   · issuing by band is Premium, decided from the server's own entitlement
//     record before anything is drawn, escrowed or counted; a lapsed period and
//     a claimed plan in a header are free;
//   · Premium is issued official questions of that chapter in that band only,
//     every time, and they are marked by the server like any question;
//   · a band for a non-JEE generator, an unknown band, a band with a dot point
//     or a trap, and a band the chapter has nothing in are refused.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-jee-band-'));
process.env.NODE_ENV = 'test';
delete process.env.PRI_FREE_PRACTICE_PER_DAY;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5d'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { PYQ_RECORDS } = await import('../../client/src/engine/pyq/pyqArchive.js');
const { JEE_BANDS, JEE_BAND_IDS, jeeBandOf, jeeBandCatalog, jeeBandRecords } = await import('../../client/src/engine/pyq/jeeBands.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const get = (path, jar = {}) => h.request(path, { method: 'GET', jar });
const issue = (jar, generator, extra = {}, headers = {}) => post('/v1/practice/issue', { generator, difficulty: 3, curriculum: 'in', mode: 'practice', ...extra }, jar, headers);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const escrowed = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [accountId])).n);
let sub = 0;
const grade = (jar, id, answer) => { const sid = `jee-band-${String(++sub).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };
const premiumRefusal = r => r.status === 402 && r.data?.error?.code === 'PREMIUM_REQUIRED' && r.data.error.capability === 'premium-exams';

try {
  // ── the band rule ──────────────────────────────────────────────────────────
  const steps = n => ({ track: 'jee-main', steps: Array.from({ length: n }, () => ({ h: 'h', d: 'd' })) });
  c.deq([1, 2, 3, 4, 5, 6, 9].map(n => jeeBandOf(steps(n))), ['short', 'short', 'short', 'standard', 'long', 'long', 'long'], 'bands are cut by recorded step count: ≤3 short, 4 standard, ≥5 long');
  c.eq(jeeBandOf(steps(0)), null, 'a record with no recorded steps has no band');
  c.eq(jeeBandOf({ track: 'cbse', steps: steps(4).steps }), null, 'a CBSE record has no JEE band');
  for (const track of ['jee-main', 'jee-advanced']) {
    const cat = jeeBandCatalog(PYQ_RECORDS, track);
    const total = cat.chapters.reduce((s, ch) => s + JEE_BAND_IDS.reduce((t, id) => t + ch.counts[id], 0), 0);
    c.eq(total, PYQ_RECORDS.filter(r => r.track === track).length, `${track}: the catalog counts every archived record exactly once (${total})`);
    c.eq(cat.basis, 'recorded-steps', `${track}: the catalog names its basis`);
    c.ok(!/rank|percentile|predict|score/i.test(JSON.stringify(cat)), `${track}: the catalog says nothing about rank, percentile, prediction or score`);
  }
  c.eq(jeeBandCatalog(PYQ_RECORDS, 'cbse'), null, 'there is no band catalog for CBSE');
  c.ok(JEE_BANDS.every(b => /recorded steps/.test(b.rule)), 'each band\'s rule is stated as a recorded-step count');

  // A JEE Main chapter with at least two bands, and one band it has nothing in.
  const main = jeeBandCatalog(PYQ_RECORDS, 'jee-main').chapters
    .map(ch => ({ ...ch, filled: JEE_BAND_IDS.filter(id => ch.counts[id] > 0), empty: JEE_BAND_IDS.filter(id => ch.counts[id] === 0) }))
    .find(ch => ch.filled.length >= 1 && ch.empty.length >= 1);
  c.ok(!!main, `a JEE Main chapter with a filled and an empty band: ${main?.generator}`);
  const BAND = main.filled[0], EMPTY = main.empty[0], GEN = main.generator;

  // ── accounts ───────────────────────────────────────────────────────────────
  const free = await registerAccount(h, { email: 'band.free@example.test', deviceId: 'ipad-band-free' });
  const premium = await registerAccount(h, { email: 'band.premium@example.test', deviceId: 'ipad-band-premium' });
  const lapsed = await registerAccount(h, { email: 'band.lapsed@example.test', deviceId: 'ipad-band-lapsed' });
  for (const who of [free, premium, lapsed]) c.eq((await verifyEmail(h, who.account.id)).status, 200, `${who.account.email || who.account.id} is verified`);
  const paid = (accountId, periodEnd) => h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [accountId, 'premium', 'active', 'apple', 'com.prilearning.app.premium.monthly', periodEnd, Date.now()]);
  await paid(premium.account.id, Date.now() + 30 * DAY);
  await paid(lapsed.account.id, Date.now() - DAY);

  // ── the catalog over HTTP ──────────────────────────────────────────────────
  const freeCat = await get('/v1/practice/bands?track=jee-main', free.jar);
  c.deq([freeCat.status, freeCat.data?.premium, freeCat.data?.capability], [200, false, 'premium-exams'], 'a free account reads the catalog, told it is not Premium');
  c.deq(freeCat.data?.chapters, JSON.parse(JSON.stringify(jeeBandCatalog(PYQ_RECORDS, 'jee-main').chapters)), 'the catalog over HTTP is the archive\'s own counts');
  c.eq((await get('/v1/practice/bands?track=jee-main', premium.jar)).data?.premium, true, 'Premium is told it is Premium');
  c.eq((await get('/v1/practice/bands?track=cbse', free.jar)).status, 400, 'a non-JEE track has no catalog');
  c.eq((await get('/v1/practice/bands?track=jee-main', {})).status, 401, 'signed out, nothing');

  // ── issuing by band is Premium ─────────────────────────────────────────────
  c.ok(premiumRefusal(await issue(free.jar, GEN, { band: BAND })), 'a free account asking for a band is refused: 402 PREMIUM_REQUIRED, premium-exams');
  c.eq(await escrowed(free.account.id), 0, 'and nothing was escrowed');
  c.ok(premiumRefusal(await issue(lapsed.jar, GEN, { band: BAND })), 'a lapsed period is free: refused');
  c.ok(premiumRefusal(await issue(free.jar, GEN, { band: BAND }, { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'premium-exams' })), 'a Premium claim in a header changes nothing');

  // ── Premium gets that band, only ───────────────────────────────────────────
  const inBand = new Set(jeeBandRecords(PYQ_RECORDS, GEN, BAND).map(r => r.id));
  let allIn = true, first = null;
  for (let i = 0; i < 12; i++) {
    const r = await issue(premium.jar, GEN, { band: BAND });
    if (r.status !== 201) { allIn = false; break; }
    const q = await sealed(r.data.question.id);
    first ??= { id: r.data.question.id, q };
    if (!inBand.has(q.pyqId) || jeeBandOf({ track: 'jee-main', steps: q.steps }) !== BAND) allIn = false;
  }
  c.ok(allIn, `twelve Premium issues in band "${BAND}" are all official ${GEN} records in that band (${inBand.size} in it)`);
  const right = first.q.answerType === 'mcq' ? first.q.mcqOptions[first.q.answer.correctIndex] : first.q.answer.value;
  const marked = await grade(premium.jar, first.id, first.q.answerType === 'mcq' ? String(first.q.answer.correctIndex) : right);
  c.deq([marked.status, marked.data?.correct], [200, true], `a band question is marked by the server like any other: its official key is credited (${marked.status} ${JSON.stringify(marked.data?.correct)})`);

  // ── a thin band runs out: the repeat is served and labelled, never refused ─
  const thin = jeeBandCatalog(PYQ_RECORDS, 'jee-main').chapters.find(ch => ch.counts.short === 1);
  c.ok(!!thin, `a JEE Main chapter whose short band holds one record: ${thin?.generator}`);
  const fresh = await registerAccount(h, { email: 'band.thin@example.test', deviceId: 'ipad-band-thin' });
  await verifyEmail(h, fresh.account.id);
  await paid(fresh.account.id, Date.now() + 30 * DAY);
  const once = await issue(fresh.jar, thin.generator, { band: 'short' });
  c.deq([once.status, once.data?.repeat ?? false], [201, false], 'its one record is issued fresh the first time');
  const avoided = await issue(fresh.jar, thin.generator, { band: 'short', avoid: [once.data.question.contentHash] });
  c.deq([avoided.status, avoided.data?.repeat, avoided.data?.question?.contentHash], [201, true, once.data.question.contentHash],
    'with that record on the device\'s avoid list and nothing else in the band, it is issued again and labelled repeat: true');
  const q1 = await sealed(once.data.question.id);
  await grade(fresh.jar, once.data.question.id, q1.answerType === 'mcq' ? String(q1.answer.correctIndex) : q1.answer.value);
  const resolved = await issue(fresh.jar, thin.generator, { band: 'short' });
  c.deq([resolved.status, resolved.data?.repeat], [201, true], 'once the account has resolved it, an empty avoid list still gets it back labelled repeat: true');

  // ── refusals ───────────────────────────────────────────────────────────────
  const code = r => `${r.status} ${r.data?.error?.code}`;
  c.eq(code(await issue(premium.jar, GEN, { band: EMPTY })), '422 PRACTICE_BAND_EMPTY', `a band the chapter has nothing in ("${EMPTY}") is refused`);
  c.eq(code(await issue(premium.jar, GEN, { band: 'hard' })), '400 PRACTICE_BAND_INVALID', 'an unknown band is refused');
  c.eq(code(await issue(premium.jar, GEN, { band: 7 })), '400 PRACTICE_BAND_INVALID', 'a band that is not a name is refused');
  c.eq(code(await issue(premium.jar, 'pyq-cbse-c10-real-numbers', { band: BAND })), '400 PRACTICE_BAND_INVALID', 'a band on a CBSE chapter is refused');
  c.eq(code(await issue(premium.jar, 'c11-binomial-theorem', { band: BAND })), '400 PRACTICE_BAND_INVALID', 'a band on a generated chapter is refused');
  c.eq(code(await issue(premium.jar, GEN, { band: BAND, dotpoint: 'x' })), '400 PRACTICE_BAND_INVALID', 'a band with a dot point is refused');

  console.log(`engine: ${h.engine}`);
  console.log(`JEE BAND PRACTICE: PASS — ${c.count()}/${c.count()} checks — official JEE questions banded by recorded working length only (no rank, percentile or score), issued by band to Premium only, from that chapter and band only.`);
} catch (error) {
  console.error(error);
  console.log('JEE BAND PRACTICE: FAIL');
  process.exitCode = 1;
} finally {
  await h.close();
}
