// Pri Learning · the device meets the SERVER's daily marking cap and shows it.
//
// The free/Premium split: practice is unlimited on every plan; what the free
// plan rations is examiner marking — FREE_MARKING_ALLOWANCE.scriptsPerDay
// marked scripts a day per account, counted and refused by the server at
// POST /v1/practice/:id/submit (402 FREE_CAP_REACHED, capability
// unlimited-marking) before the marker runs. A second try on a question
// already counted belongs to the same script and is marked. This suite runs the
// real platform server with the allowance set to THREE by configuration
// (PRI_FREE_MARKED_PER_DAY) and drives it through the product's own dispatcher:
//   · questions keep being issued past the allowance (practice is unlimited);
//   · the server's refusal arrives as the gate error FreeCapNotice explains:
//     402 FREE_CAP_REACHED, capability unlimited-marking, the server's count,
//     limit, reset instant and zone, and the card names it 'free-cap';
//   · nothing is marked for the refused submission and the question row is kept
//     unanswered;
//   · a second try on an already-counted question is still marked;
//   · a second device on the same account is refused although it has marked
//     nothing itself; Rush and Match are unaffected;
//   · Premium on the server lifts the cap; back on free the day's count stands.
//
// Usage: node client/test/server-daily-cap-client-check.mjs

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const SERVER_CAP = 3;
const authority = await startOnlineAuthority({ label: 'server-daily-cap', env: { PRI_FREE_MARKED_PER_DAY: String(SERVER_CAP) } });

const { dispatch } = await import('../src/local/backend.js');
const gate = await import('../src/local/entitlementGate.js');
const { checkRefusal, CHECK_REFUSAL } = await import('../src/components/checkAccess.js');
const { FREE_MARKING_ALLOWANCE } = await import('../src/engine/practiceAllowance.js');
const { practiceDay } = await import('../../server/platform/practiceAllowance.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const POST = (path, body = {}) => dispatch('POST', path, body);
const GET = path => dispatch('GET', path);
const refused = async (name, promise) => {
  try { await promise; ok(name, false, 'the call was allowed'); return null; }
  catch (err) { ok(name, err.status === 402 && err.code === 'FREE_CAP_REACHED', `status ${err.status} code ${err.code}: ${err.message}`); return err; }
};
const questionRows = pid => (rawRows().questions || []).filter(r => r.pid === pid);

const WRONG = '987654321';
const submit = (id, tag = 'cap') => POST(`/practice/${id}/submit`, { answer: WRONG, ms: 900, submissionId: nextSubmissionId(tag) });
const gradeRows = pid => authority.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-grade'", [authority.accountOf(pid).accountId]);

// ── A · practice is issued past the allowance; the (N+1)th marked script is refused ──
same('the device\'s gate: unlimited practice, the shipped marking allowance', [gate.FREE_TIER.practicePerDay, gate.FREE_TIER.markedPerDay], [null, FREE_MARKING_ALLOWANCE.scriptsPerDay]);
const asha = (await POST('/profiles', { name: 'Asha', year: 9, course: 'in' })).user;
await authority.link(asha.id);
same('the profile is linked to a real account on the free plan', (await GET('/me')).user.plan.tier, 'free');

const served = [];
for (let i = 0; i < SERVER_CAP + 2; i++) served.push(await POST('/practice/next', { mode: 'smart' }));
same('the server issues questions past the marking allowance: practice is unlimited', served.map(r => r.question.checkState), Array(SERVER_CAP + 2).fill('issued'));

const marked = [];
for (let i = 0; i < SERVER_CAP; i++) marked.push(await submit(served[i].question.id));
same('the first three scripts are marked by the server', marked.map(r => r?.authoritative === true && typeof r?.correct === 'boolean'), Array(SERVER_CAP).fill(true));
const gradesBefore = authority.traffic.grade;
const gradeRowsBefore = (await gradeRows(asha.id)).n;
const capped = await refused('the fourth script of the day is refused by the SERVER', submit(served[SERVER_CAP].question.id));
same('the refusal is the gate error the paywall explains: capability, count and limit are the server\'s', [capped?.capability, capped?.used, capped?.limit],
  ['unlimited-marking', SERVER_CAP, SERVER_CAP]);
same('it says when the day turns over, in the server\'s calendar', [capped?.resetsAt, capped?.timeZone], [practiceDay(Date.now()).end, 'Asia/Kolkata']);
same('and that the server, not the device, refused it before marking', [capped?.reason, capped?.server, capped?.beforeMarking, capped?.refreshRequired], ['server-refused', true, true, false]);
ok('the refusal is plain copy a student can act on', /free marked answers/.test(capped?.message || '') && /Practice stays unlimited/.test(capped?.message || '') && /midnight/.test(capped?.message || '') && /Premium/.test(capped?.message || ''), capped?.message);
same('nothing was marked for it', [(await gradeRows(asha.id)).n - gradeRowsBefore], [0]);
const kept = questionRows(asha.id).find(r => r.serverQuestionId && r.id === served[SERVER_CAP].question.id);
same('the question row is kept, unanswered, with no try spent', [!!kept, kept?.answered || 0, kept?.tries || 0], [true, 0, 0]);
same('the refusal is one the question card names, so a check cannot be shown as a fault', checkRefusal(capped), CHECK_REFUSAL.FREE_CAP);
await refused('asking again is refused again, by the server', submit(served[SERVER_CAP].question.id));
ok('practice is still issued while marking is capped', (await POST('/practice/next', { mode: 'smart' })).question.checkState === 'issued');

// ── B · a second try on a question already counted is the same script ────────
const firstTry = marked.findIndex(r => r && r.resolved === false);
if (firstTry >= 0) {
  const again = await submit(served[firstTry].question.id, 'second-try');
  ok('a second try on an already-counted question is still marked', again?.authoritative === true && typeof again?.correct === 'boolean', JSON.stringify(again).slice(0, 200));
} else {
  ok('a first wrong try left a second try to take (fixture)', false, JSON.stringify(marked.map(r => r?.resolved)));
}

// ── C · a second device on the same account ──────────────────────────────────
const second = (await POST('/profiles', { name: 'Asha on the iPhone', year: 9, course: 'in' })).user;
await authority.linkExisting(second.id, asha.id);
const onSecond = await POST('/practice/next', { mode: 'smart' });
same('the second device is issued a question', onSecond.question.checkState, 'issued');
await refused('and its first marked answer is refused: the cap is the account\'s, not the device\'s', submit(onSecond.question.id));
const rush = await POST('/rush/start', {});
ok('Rapid Fire still starts for the capped account: games are not counted', Array.isArray(rush?.questions) && rush.questions.length > 0 && rush.questions.every(q => q.id), JSON.stringify(rush).slice(0, 160));

// ── D · Premium on the server lifts it; back on free the count stands ────────
await POST('/profiles/select', { id: asha.id });
await authority.setEntitlement(asha.id, 'premium');
const lifted = await submit(served[SERVER_CAP].question.id, 'premium');
ok('with Premium the refused question is marked', lifted?.authoritative === true && typeof lifted?.correct === 'boolean', JSON.stringify(lifted).slice(0, 200));
const lifted2 = await submit(served[SERVER_CAP + 1].question.id, 'premium');
ok('and another past the allowance', lifted2?.authoritative === true, JSON.stringify(lifted2).slice(0, 200));
await authority.setEntitlement(asha.id, null);
const fresh = await POST('/practice/next', { mode: 'smart' });
await refused('back on the free plan the server\'s count for the day still stands', submit(fresh.question.id));

await authority.close();
console.log(`\nServer daily cap, through the device — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nSERVER DAILY CAP (CLIENT): ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
