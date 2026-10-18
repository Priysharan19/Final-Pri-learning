// Pri Learning · the device meets the SERVER's daily cap and shows it (#537).
//
// The device's own gate (local/entitlementGate.js) is a courtesy pre-check; the
// cap is the server's, per account. This suite puts the real local backend in
// exactly the situation the device gate cannot see — the account's questions
// were used on another device, or the device's counter is behind — by running
// the real platform server with the cap set to THREE by configuration while the
// device still believes twenty. (The shipped default of twenty is proved by
// server/test/practice-daily-cap-check.mjs and, in a browser, by
// client/test/tour-free-cap.js.) Through the product's own dispatcher:
//   · the server's refusal arrives as the gate error FreeCapNotice explains:
//     402 FREE_CAP_REACHED, the server's count, limit, reset instant and zone;
//   · the device does not work around it with a prepared question or a draft,
//     and stores no question for it;
//   · a prepared question (opened signed out) cannot be bound and marked by a
//     capped account: the check is refused as the free cap, nothing is marked,
//     the row stays unbound, and the card names the refusal as 'free-cap';
//   · a second device on the same account is refused although its own counter
//     is at zero; Rush and Match questions are still served;
//   · Premium on the server lifts the cap for the same profile; back on free
//     the server's count still stands.
//
// Usage: node client/test/server-daily-cap-client-check.mjs

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const SERVER_CAP = 3;
const authority = await startOnlineAuthority({ label: 'server-daily-cap', env: { PRI_FREE_PRACTICE_PER_DAY: String(SERVER_CAP) } });

const { dispatch } = await import('../src/local/backend.js');
const gate = await import('../src/local/entitlementGate.js');
const { checkRefusal, CHECK_REFUSAL } = await import('../src/components/checkAccess.js');
const { FREE_PRACTICE_ALLOWANCE } = await import('../src/engine/practiceAllowance.js');
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

// ── A · the device still believes twenty; the server says three ──────────────
same('the device\'s own gate states the shipped cap', gate.FREE_TIER.practicePerDay, FREE_PRACTICE_ALLOWANCE.perDay);
const asha = (await POST('/profiles', { name: 'Asha', year: 9, course: 'in' })).user;
await authority.link(asha.id);
same('the profile is linked to a real account on the free plan', (await GET('/me')).user.plan.tier, 'free');

const served = [];
for (let i = 0; i < SERVER_CAP; i++) served.push(await POST('/practice/next', { mode: 'smart' }));
same('the server issues the account its questions', served.map(r => r.question.checkState), Array(SERVER_CAP).fill('issued'));
same('the device counts what it was served', (await GET('/me')).user.usage.practice.used, SERVER_CAP);
const issuesBefore = authority.traffic.issue;
const preparesBefore = authority.traffic.prepare;
const rowsBefore = questionRows(asha.id).length;

const capped = await refused('the next question is refused by the SERVER although the device gate still allows it', POST('/practice/next', { mode: 'smart' }));
same('the refusal is the gate error the paywall explains: capability, count and limit are the server\'s', [capped?.capability, capped?.used, capped?.limit, capped?.plan],
  ['unlimited-practice', SERVER_CAP, SERVER_CAP, undefined]);
same('it says when the day turns over, in the server\'s calendar', [capped?.resetsAt, capped?.timeZone], [practiceDay(Date.now()).end, 'Asia/Kolkata']);
same('and that the server, not the device, refused it', [capped?.reason, capped?.server, capped?.refreshRequired], ['server-refused', true, false]);
ok('the refusal is plain copy a student can act on', /free practice questions/.test(capped?.message || '') && /midnight/.test(capped?.message || '') && /Premium/.test(capped?.message || ''), capped?.message);
same('the device asked the server once and did not fall back to a prepared question', [authority.traffic.issue - issuesBefore, authority.traffic.prepare - preparesBefore], [1, 0]);
same('and stored no question for the refusal', questionRows(asha.id).length, rowsBefore);
same('the device\'s own count did not move on a refusal', (await GET('/me')).user.usage.practice.used, SERVER_CAP);
await refused('asking again is refused again, by the server', POST('/practice/next', { mode: 'smart' }));
same('the refusal is one the question card names, so a check cannot be shown as a fault', checkRefusal(capped), CHECK_REFUSAL.FREE_CAP);

// ── B · a prepared question cannot be bound and marked by a capped account ───
const prepared = await authority.signedOut(() => POST('/practice/next', { mode: 'smart' }));
same('signed out, the device shows a prepared question to work on', prepared.question.checkState, 'prepared');
const gradesBefore = authority.traffic.grade;
const bindRefused = await refused('submitting it under the capped account is refused: binding would make it a creditable question',
  POST(`/practice/${prepared.question.id}/submit`, { answer: '987654321', submissionId: nextSubmissionId('cap') }));
same('the refusal proves nothing was marked', [bindRefused?.beforeMarking, bindRefused?.code, authority.traffic.grade - gradesBefore], [true, 'FREE_CAP_REACHED', 0]);
const row = questionRows(asha.id).find(r => r.id === prepared.question.id);
same('the row is still the prepared question, unbound, unanswered and kept', [!!row, !!row?.prepared, !!row?.serverQuestionId, row?.answered || 0, row?.tries || 0], [true, true, false, 0, 0]);
same('the card names it as the free cap, with Premium as the way through', checkRefusal(bindRefused), CHECK_REFUSAL.FREE_CAP);
same('nothing was marked on the server for this account', (await authority.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-grade'", [authority.accountOf(asha.id).accountId])).n, 0);

// ── C · a second device on the same account ──────────────────────────────────
const second = (await POST('/profiles', { name: 'Asha on the iPhone', year: 9, course: 'in' })).user;
await authority.linkExisting(second.id, asha.id);
same('the second device has used nothing of its own', (await GET('/me')).user.usage.practice.used, 0);
await refused('and is still refused: the cap is the account\'s, not the device\'s', POST('/practice/next', { mode: 'smart' }));
same('the second device stored no question either', questionRows(second.id).length, 0);
const rush = await POST('/rush/start', {});
ok('Rapid Fire still starts for the capped account: games are "everything else", unlimited', Array.isArray(rush?.questions) && rush.questions.length > 0 && rush.questions.every(q => q.id), JSON.stringify(rush).slice(0, 160));

// ── D · Premium on the server lifts it; back on free the count stands ────────
await POST('/profiles/select', { id: asha.id });
await authority.setEntitlement(asha.id, 'premium');
same('with Premium the same profile is issued questions past the cap', (await POST('/practice/next', { mode: 'smart' })).question.checkState, 'issued');
same('and another', (await POST('/practice/next', { mode: 'smart' })).question.checkState, 'issued');
await authority.setEntitlement(asha.id, null);
await refused('back on the free plan the server\'s count for the day still stands', POST('/practice/next', { mode: 'smart' }));

await authority.close();
console.log(`\nServer daily cap, through the device — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nSERVER DAILY CAP (CLIENT): ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
