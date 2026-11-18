// Pri Learning · a Prithagoras server issues only what Prithagoras offers (owner decision, 19 Nov 2026)
//
// Years 11 and 12, Mathematics Advanced and Extension 1. The student app hides everything else; the server enforces it
// (defence in depth): a request that names a hidden subtopic is refused with COURSE_NOT_OFFERED, before anything is
// issued, escrowed, prepared or counted. The catalogue behind it is still whole and still tested
// (nsw-practice-check.mjs, the CATALOGUE suite, lifts the offering in its own test process).
//
// SYNTHETIC: generated questions and a scripted client.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-nsw-offering-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'b8'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_OFFERING;
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { NSW_BANK_LEDGER } = await import('../platform/nswBanks.js');
const { subtopicOfferedIn } = await import('../../client/src/engine/offeringRules.js');
const { editionOffering } = await import('../platform/edition.js');

const c = checks();
const OFFERING = editionOffering(process.env);
c.deq([OFFERING.years, OFFERING.pathways], [[11, 12], ['advanced', 'ext1']], 'this server offers Years 11 and 12, Advanced and Extension 1');
c.eq(editionOffering({ ...process.env, NODE_ENV: 'production', PRI_OFFERING: 'catalogue' })?.years.join(), '11,12', 'the catalogue override is never honoured outside a test process');
c.eq(editionOffering({ PRI_EDITION: 'priyabhata' }), null, 'India\'s server offers everything');

const issued = NSW_BANK_LEDGER.filter(e => e.issued);
const hidden = issued.filter(e => !subtopicOfferedIn(OFFERING, e.generator));
const shown = issued.filter(e => subtopicOfferedIn(OFFERING, e.generator));
const pick = (list, test) => list.find(test)?.generator;
const YEAR7 = pick(hidden, e => e.generator.startsWith('y7-'));
const YEAR10 = pick(hidden, e => e.generator.startsWith('y10-'));
const STANDARD = pick(hidden, e => e.generator.startsWith('ms'));
const EXT2 = pick(hidden, e => e.generator.startsWith('mex-'));
const YEAR11 = pick(shown, e => e.generator.startsWith('y11-'));
const YEAR12 = pick(shown, e => e.generator.startsWith('y12-'));
const EXT1 = pick(shown, e => e.generator.startsWith('me1'));
c.ok([YEAR7, YEAR10, STANDARD, EXT2, YEAR11, YEAR12, EXT1].every(Boolean), 'the catalogue has a hidden and an offered subtopic of every kind');

const h = await startApp({ engine: requestedEngine() });
try {
  c.eq((await h.request('/v1/health')).data?.edition, 'prithagoras', 'the server is Prithagoras');
  const a = await registerAccount(h, { email: 'nsw.offering@example.test', deviceId: 'ipad-nsw-offering' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a student is verified');
  const escrow = async () => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [a.account.id]))?.n || 0);
  const start = await escrow();
  const issue = generator => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator, difficulty: issued.find(e => e.generator === generator).cells.find(x => x.issued).difficulty, curriculum: 'nsw' } });
  const prepare = generator => h.request('/v1/practice/prepare', { method: 'POST', body: { generator, difficulty: issued.find(e => e.generator === generator).cells.find(x => x.issued).difficulty, curriculum: 'nsw' } });

  for (const [label, id] of [['Year 7', YEAR7], ['Year 10', YEAR10], ['Mathematics Standard', STANDARD], ['Mathematics Extension 2', EXT2]]) {
    const r = await issue(id);
    c.deq([r.status, r.data?.error?.code, r.data?.error?.retryable], [403, 'COURSE_NOT_OFFERED', false], `issue: ${label} (${id}) is refused, by name`);
    const p = await prepare(id);
    c.deq([p.status, p.data?.error?.code], [403, 'COURSE_NOT_OFFERED'], `prepare: ${label} (${id}) is refused, by name`);
  }
  c.eq(await escrow(), start, 'no refusal escrowed a question');
  for (const [label, id] of [['Year 11 Advanced', YEAR11], ['Year 12 Advanced', YEAR12], ['Extension 1', EXT1]]) {
    const r = await issue(id);
    c.deq([r.status, r.data?.question?.subtopic], [201, id], `issue: ${label} (${id}) is issued`);
    const p = await prepare(id);
    c.eq(p.status, 200, `prepare: ${label} (${id}) is prepared`);
  }
  c.ok(typeof (await issue(YEAR12)).data?.question?.id === 'string', 'and an offered question is the server\'s own');
} finally {
  await h.close();
}
console.log(`engine: ${h.engine}`);
console.log(`NSW OFFERING: PASS — ${c.count()}/${c.count()} checks — a Prithagoras server refuses Years 7 to 10, Standard and Extension 2 by name (issue and prepare, COURSE_NOT_OFFERED, nothing escrowed) and issues Years 11 and 12 Advanced and Extension 1. [SYNTHETIC]`);
