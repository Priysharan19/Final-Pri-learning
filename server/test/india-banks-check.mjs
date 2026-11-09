// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · D15 — banks outside the India curriculum's covers are refused
//
// Owner default D15 (docs/release/V1_DECISIONS_2026-11-01.md): a question bank
// outside the India curriculum's covers is refused at the server now, and
// deleted after launch. Over real HTTP, on a server where nothing has asked to
// allow them (server/platform/indiaBanks.js):
//
//   · every bank outside the covers — the NSW Year 7–12 and stage banks and the
//     India banks the covers no longer draw on — is refused on issue (422
//     PRACTICE_BANK_OUTSIDE_CURRICULUM) and on prepare, and nothing is written;
//   · the NSW-era practice paper is refused (422 EXAM_KIND_OUTSIDE_CURRICULUM);
//   · a bank the covers do draw on is still issued and prepared;
//   · the test-only allowance is refused under NODE_ENV=production.
//
// india-bank-issue-coverage-check.mjs proves every India bank is issued.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-india-banks-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'b5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;

const { indiaBank, practicePapersAllowed, allowBanksOutsideIndiaForTests, INDIA_BANK_COUNT } = await import('../platform/indiaBanks.js');
const { GENERATORS, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { allGenerators, IN_CHAPTERS } = await import('../../client/src/engine/curriculum-in.js');
const { indiaPyqCells } = await import('../../client/src/engine/indiaExamCells.js');
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
await loadAllBanks();

const c = checks();
const india = new Set(allGenerators());
const pyq = new Set();
for (const track of ['cbse', 'jee-main', 'jee-advanced', 'olympiad']) for (const cells of indiaPyqCells(track, IN_CHAPTERS).values()) for (const cell of cells) pyq.add(cell.generator);
const outside = Object.keys(GENERATORS).filter(id => !india.has(id) && !pyq.has(id)).sort();
c.eq(INDIA_BANK_COUNT, new Set([...india, ...pyq]).size, `the server's India banks are exactly the covers' generators and the India previous-year banks (${india.size} + ${[...pyq].filter(g => !india.has(g)).length})`);
c.ok([...pyq].every(indiaBank), 'every India previous-year bank is issuable (D23, not D15, decides whether students see them)');
c.ok(outside.length > 50, `there are banks outside the covers to refuse (${outside.length})`);
c.ok(outside.every(id => !indiaBank(id)) && [...india].every(indiaBank), 'indiaBank() admits the covers and refuses every other engine bank');
c.ok(['jee-advanced-c11-binomial-theorem', 'jee-main-c12-matrices', 'pyq-jee-advanced-c11-conic-sections', 'pyq-cbse-c10-real-numbers'].every(indiaBank), 'the JEE department catalog and the source-cited CBSE/JEE archive are India banks (#732 asks for them by name)');
c.ok(!indiaBank('xjee-advanced-c11-sets') && !indiaBank('pyq-hsc-ext1-induction') && !indiaBank('jee-advanced-'), 'a name that only looks like a previous-year bank is not one');
c.ok(!indiaBank(undefined) && !indiaBank('') && !indiaBank(['c10-polynomials']), 'and only a name is a bank');
c.eq(practicePapersAllowed(), false, 'and the practice paper is not allowed');

const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'india.banks@example.test', deviceId: 'ipad-india-banks' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const issued = async () => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [a.account.id]))?.n || 0);
  const start = await issued();

  for (const generator of outside) {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator, difficulty: 2, curriculum: 'in' } });
    c.deq([r.status, r.data?.error?.code], [422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'], `issue: ${generator} is outside the India covers and refused`);
  }
  for (const generator of ['y7-equations', 'mex-demoivre', 'c8-squares-roots']) {
    const r = await h.request('/v1/practice/prepare', { method: 'POST', body: { generator, difficulty: 1, curriculum: 'in' } });
    c.deq([r.status, r.data?.error?.code], [422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'], `prepare: ${generator} is refused before anything is sealed`);
  }
  c.eq(await issued(), start, 'no refused bank left a question behind');

  // A bank the covers draw on is unchanged.
  for (const generator of ['c7-finding-unknown-current', 'c10-arithmetic-progressions', 'c11-complex-numbers']) {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator, difficulty: 2, curriculum: 'in' } });
    c.deq([r.status, r.data?.question?.subtopic], [201, generator], `issue: ${generator} is an India bank and is issued`);
    const p = await h.request('/v1/practice/prepare', { method: 'POST', body: { generator, difficulty: 2, curriculum: 'in' } });
    c.eq(p.status, 200, `prepare: ${generator} is prepared`);
  }

  // The NSW practice paper.
  const paper = await h.request('/v1/exams', { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'india-banks-paper' },
    body: { kind: 'practice-paper', paper: { year: 7, minutes: 30 }, slots: [{ generator: 'y7-equations', difficulty: 1 }] } });
  c.deq([paper.status, paper.data?.error?.code], [422, 'EXAM_KIND_OUTSIDE_CURRICULUM'], 'exam: the NSW-era practice paper is refused');
} finally {
  await h.close();
}

// The allowance is a test's, never a production server's.
process.env.NODE_ENV = 'production';
assert.throws(() => allowBanksOutsideIndiaForTests(), { code: 'INDIA_BANKS_CONFIG_INVALID' });
c.ok(true, 'the test-only allowance is refused under NODE_ENV=production');
c.ok(!indiaBank('y7-equations') && !practicePapersAllowed(), 'and refusing it leaves the banks refused');

rmSync(scratch, { recursive: true, force: true });
for (const key of keys) {
  if (before[key] === undefined) delete process.env[key];
  else process.env[key] = before[key];
}
console.log(`engine: ${h.engine}`);
console.log(`INDIA BANKS (D15): PASS — ${c.count()}/${c.count()} checks — ${outside.length} banks outside the India covers refused on issue and ${3} on prepare, the NSW practice paper refused, India banks still issued, and the test allowance refused in production.`);
