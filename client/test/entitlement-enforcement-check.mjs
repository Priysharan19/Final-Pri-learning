// Pri Learning · free tier and Premium enforcement in the local backend.
//
// Drives the real dispatcher (client/src/local/backend.js) and the India exam
// module over the in-memory IndexedDB that backend-check.mjs stands up. Proves:
//   · practice is unlimited on every plan (the free/Premium split): the free
//     plan's daily allowance is examiner marking (5 marked scripts a day),
//     which the SERVER counts and refuses (server-daily-cap-client-check.mjs);
//     the device still counts served questions per profile on the PROFILE's
//     calendar (Asia/Kolkata for India profiles, Australia/Sydney otherwise)
//   · a server-issued Premium snapshot is Premium; a forged plan label is not
//   · the 7-day offline window is honoured (expired → free; valid → premium)
//   · mock papers are Premium: no free exam allowance, in both the HSC paper
//     builder and the India exam module, lifted by premium-exams
//   · the JEE Advanced track needs jee-advanced-content
//   · every declared capability has a named enforcement point
//   · retries from History are counted like any served question
//   · usage rows carry no personal data
//
// Usage: node client/test/entitlement-enforcement-check.mjs

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
// Online-only grading (owner decision 2026-10-10): an exam starts, and an
// India question is issued, only for a real signed-in account. The gates
// below are still decided on the device from the entitlement snapshot on the
// cloud link row, so every linked profile here is a real verified account
// (never a made-up accountId) whose snapshot the suite then sets.
const { startOnlineAuthority } = await import('./support/online-authority.mjs');
const authority = await startOnlineAuthority({ label: 'entitlement-enforcement' });

const { dispatch } = await import('../src/local/backend.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
const gate = await import('../src/local/entitlementGate.js');
const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
const { ENTITLEMENTS } = await import('../src/platform/entitlements.js');
const idb = await import('../src/local/idb.js');
// This suite talks to dispatch() directly, so it loads the question banks the
// way src/api.js does before a request reaches the backend.
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

const DAY = 86_400_000;
const MIN = 60_000;
// 2026-09-05T18:00Z is 23:30 on 5 Sep in Asia/Kolkata and 04:00 on 6 Sep in Australia/Sydney.
const T0 = Date.UTC(2026, 8, 5, 18, 0, 0);
let now = T0;
let online = true;
gate.configureEntitlementGate({ now: () => now, online: () => online });

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

async function gated(name, promise, { code, capability, reason } = {}) {
  try {
    await promise;
    ok(name, false, 'the call was allowed');
    return null;
  } catch (err) {
    ok(name, err.status === 402 && err.code === code && (!capability || err.capability === capability) && (!reason || err.reason === reason),
      `status ${err.status} code ${err.code} capability ${err.capability} reason ${err.reason}: ${err.message}`);
    return err;
  }
}

function premiumSnapshot(overrides = {}) {
  return {
    plan: 'premium', status: 'active', provider: 'web',
    currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY,
    issuedAt: now, sourceVersion: 3, ...overrides
  };
}

// A real account for the profile. What the server filed on the link row at
// sign-in is the account's own free snapshot; it is kept so a profile can be
// put back on the free plan without ever being signed out.
const serverFree = new Map();
async function signIn(pid) {
  if (serverFree.has(pid)) return;
  await authority.link(pid);
  const row = await idb.get('device', cloudLinkRowId(pid));
  if (!row?.accountId || row.accountId !== authority.accountOf(pid).accountId) throw new Error('the profile is not linked to its real account');
  serverFree.set(pid, row.entitlement ?? null);
}
async function link(pid, entitlement) {
  await signIn(pid);
  await authority.setEntitlement(pid, entitlement);
}
// Formerly "unlink": the profile stays signed in and goes back to the free
// snapshot the server issued for its account.
async function backToFree(pid) {
  await signIn(pid);
  await authority.setEntitlement(pid, serverFree.get(pid));
}

// ── A · the calendar and the enforcement map ─────────────────────────────────
same('a UTC evening is still 5 Sep in Asia/Kolkata', gate.dayKey(T0, 'Asia/Kolkata'), '2026-09-05');
same('the same instant is already 6 Sep in Australia/Sydney', gate.dayKey(T0, 'Australia/Sydney'), '2026-09-06');
same('the next Kolkata day starts at 18:30Z', gate.nextDayStart(T0, 'Asia/Kolkata'), Date.UTC(2026, 8, 5, 18, 30));
same('the next Sydney day starts at 14:00Z on the 6th', gate.nextDayStart(T0, 'Australia/Sydney'), Date.UTC(2026, 8, 6, 14, 0));
same('India profiles live in Asia/Kolkata', gate.profileTimeZone({ course: 'in' }), 'Asia/Kolkata');
same('Australian profiles keep Australia/Sydney', gate.profileTimeZone({ course: 'nsw' }), 'Australia/Sydney');
same('an explicit profile timezone wins', gate.profileTimeZone({ course: 'in', timezone: 'Europe/London' }), 'Europe/London');
same('an invalid profile timezone falls back to the course default', gate.profileTimeZone({ course: 'in', timezone: 'Mars/Olympus' }), 'Asia/Kolkata');
same('the free tier is unlimited practice, 5 marked answers a day and no exam allowance', [gate.FREE_TIER.practicePerDay, gate.FREE_TIER.markedPerDay, gate.FREE_TIER.examsPerWindow, gate.FREE_TIER.examWindowDays], [null, 5, 0, 30]);
for (const capability of Object.values(ENTITLEMENTS)) {
  ok(`${capability} has a named enforcement point`, typeof gate.CAPABILITY_ENFORCEMENT[capability] === 'string' && gate.CAPABILITY_ENFORCEMENT[capability].length > 10);
}
{
  // SEC-COMM-01: the one capability that protects server spend is enforced on
  // the server, from the server's own entitlement record.
  const { readFileSync } = await import('node:fs');
  const src = rel => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
  ok('additional-ai-usage is enforced on the server (aiAllowance), not on the device',
    /^server · .*aiAllowance\.js/.test(gate.CAPABILITY_ENFORCEMENT[ENTITLEMENTS.EXTRA_AI]) &&
    // Handwriting reads go through one paid path (recognitionOps.js), given the
    // session's own account by the route: the allowance is consumed there, and
    // a read served from a kept reading costs none.
    /recognitionOpsFor\(db\)\.read\(\{\s*db, accountId: req\.platformSession\.account_id,/.test(src('server/platform/handwriting.js')) &&
    /consumeAiAllowance\(db, \{ accountId, kind: 'handwriting'/.test(src('server/platform/recognitionOps.js')) &&
    !/accountId: req\.body/.test(src('server/platform/handwriting.js')) &&
    /consumeAiAllowance\(db, \{ accountId: req\.platformSession\.account_id, kind: 'working'/.test(src('server/platform/working.js')));
}

// ── B · India profile: unlimited practice, counted on the Kolkata calendar ──
const asha = (await POST('/profiles', { name: 'Asha', year: 9, course: 'in' })).user;
same('a fresh profile is on the free plan', asha.plan.tier, 'free');
same('free practice has no limit and none used', [asha.usage.practice.used, asha.usage.practice.limit, asha.usage.practice.unlimited], [0, null, true]);
same('the count is kept on the profile calendar', asha.usage.practice.timeZone, 'Asia/Kolkata');
same('the count says when its day ends', asha.usage.practice.resetsAt, Date.UTC(2026, 8, 5, 18, 30));

let lastQuestion = null;
let usedSequence = [];
// Past the old twenty-a-day cap: practice is never refused on the free plan.
for (let i = 0; i < 25; i++) {
  const served = await POST('/practice/next', { mode: 'smart' });
  lastQuestion = served.question;
  usedSequence.push([served.allowance.used, served.allowance.allowed, served.allowance.limit, served.allowance.plan]);
}
same('every served question reports the running count, allowed, with no limit, on the free plan', usedSequence, Array.from({ length: 25 }, (_, i) => [i + 1, true, null, 'free']));
const retried = await POST(`/history/${lastQuestion.id}/retry`, { variant: 'fresh' });
ok('a fresh variant from History is served on the free plan', !!retried?.question?.id, JSON.stringify(retried).slice(0, 200));
same('/me reports every question served, with no limit', [(await GET('/me')).user.usage.practice.used, (await GET('/me')).user.usage.practice.limit], [26, null]);

now = T0 + 31 * MIN; // 00:01 on 6 Sep in Kolkata; still 04:31 on 6 Sep in Sydney
const fresh = await POST('/practice/next', { mode: 'smart' });
same('one minute past Kolkata midnight the India profile starts a new day', [fresh.allowance.used, fresh.allowance.day], [1, '2026-09-06']);

// ── C · Australian profile: the same instants on the Sydney calendar ─────────
now = T0;
let ned = (await POST('/profiles', { name: 'Ned', year: 9 })).user;
// Asha above has no account at all; Ned is a signed-in account on the free
// plan. Practice is unlimited for both.
await signIn(ned.id);
ned = (await GET('/me')).user;
same('an Australian profile counts on the Sydney calendar', ned.usage.practice.timeZone, 'Australia/Sydney');
for (let i = 0; i < 25; i++) await POST('/practice/next', { mode: 'smart' });
const ned26 = await POST('/practice/next', { mode: 'smart' });
same('Ned is served a 26th question on the free plan', [ned26.allowance.used, ned26.allowance.allowed, ned26.allowance.plan], [26, true, 'free']);
now = T0 + 31 * MIN;
same('Kolkata midnight is not a new day in Sydney', (await POST('/practice/next', { mode: 'smart' })).allowance.used, 27);
now = Date.UTC(2026, 8, 6, 14, 0); // 00:00 on 7 Sep in Sydney
same('Sydney midnight starts Ned\'s new day', (await POST('/practice/next', { mode: 'smart' })).allowance.used, 1);

// ── D · a server snapshot is Premium; a forged label is not ──────────────────
await link(ned.id, { plan: 'premium', status: 'active', provider: 'web' });
same('a plan label with no server window is not Premium', (await POST('/practice/next', { mode: 'smart' })).allowance.plan, 'free');
same('and /me still says free', (await GET('/me')).user.plan.tier, 'free');
await link(ned.id, premiumSnapshot());
const lifted = await POST('/practice/next', { mode: 'smart' });
same('a server-issued Premium snapshot is Premium', [lifted.allowance.allowed, lifted.allowance.unlimited, lifted.allowance.plan], [true, true, 'premium']);
const nedMe = (await GET('/me')).user;
same('/me reports Premium with no practice or exam limit', [nedMe.plan.tier, nedMe.usage.practice.limit, nedMe.usage.exams.limit], ['premium', null, null]);
ok('/me exposes every Premium capability', Object.values(ENTITLEMENTS).every(c => nedMe.plan.capabilities.includes(c)), JSON.stringify(nedMe.plan.capabilities));

// ── E · the 7-day offline window ─────────────────────────────────────────────
await link(ned.id, premiumSnapshot({ offlineUntil: now - 1 }));
online = false;
const offlineExpired = await POST('/practice/next', { mode: 'smart' });
same('offline past the 7-day window, Premium falls back to the free plan (practice still served)', [offlineExpired.allowance.plan, offlineExpired.allowance.reason, offlineExpired.allowance.refreshRequired, offlineExpired.allowance.allowed], ['free', 'offline-entitlement-expired', true, true]);
await gated('offline past the window, a mock paper is refused and asks to reconnect', POST('/exams', { length: 10 }),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.PREMIUM_EXAMS, reason: 'offline-entitlement-expired' });
online = true;
same('online with an expired offline window the server snapshot must be refreshed first', (await POST('/practice/next', { mode: 'smart' })).allowance.reason, 'not-entitled');
await link(ned.id, premiumSnapshot({ offlineUntil: now + 6 * DAY }));
online = false;
const offlineValid = await POST('/practice/next', { mode: 'smart' });
same('inside the offline window Premium keeps working without a network', [offlineValid.allowance.plan, offlineValid.allowance.reason], ['premium', 'offline-cache-valid']);
online = true;

// ── F · mock papers are Premium (HSC paper builder) ──────────────────────────
await backToFree(ned.id);
now = T0;
const examRefused = await gated('a free account\'s first mock paper is refused', POST('/exams', { length: 10 }),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.PREMIUM_EXAMS });
same('the refusal says plainly that mock papers are Premium, with no unlock date to wait for', [examRefused?.message, examRefused?.nextAt ?? null], ['Mock papers are part of Pri Learning Premium.', null]);
same('/me reports a zero exam allowance on the free plan', [(await GET('/me')).user.usage.exams.used, (await GET('/me')).user.usage.exams.limit], [0, 0]);
now = T0 + 30 * DAY + MIN;
await gated('thirty days later it is still refused: there is no free window to wait for', POST('/exams', { length: 10 }),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.PREMIUM_EXAMS });
same('a refused paper is not counted on the device', (await gate.examAllowance(ned)).used, 0);
await link(ned.id, premiumSnapshot());
const premiumPapers = [await POST('/exams', { length: 10 }), await POST('/exams', { length: 10 })];
ok('premium-exams builds mock papers', premiumPapers.every(r => r.allowance.unlimited === true && r.exam?.id));
await backToFree(ned.id);

// ── G · the India exam module shares the same rule ───────────────────────────
now = T0;
const jai = (await POST('/profiles', { name: 'Jai', year: 12, course: 'in', indiaTrack: 'jee-main' })).user;
{
  let refusal = null;
  try { await dispatchIndiaExam(jai, 'POST', '/exams', {}); } catch (err) { refusal = err; }
  same('an India profile that has never signed in cannot start a paper', [refusal?.status, refusal?.code], [401, 'SIGN_IN_TO_CHECK']);
  same('a refused start is not counted as a simulation', (await gate.examAllowance(jai)).used, 0);
}
await backToFree(jai.id);   // signed in to a real account, on the free plan
await gated('a JEE Main section is refused on the free plan', dispatchIndiaExam(jai, 'POST', '/exams', {}),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.PREMIUM_EXAMS });
await link(jai.id, premiumSnapshot());
const jeeSection = await dispatchIndiaExam(jai, 'POST', '/exams', {});
ok('with premium-exams a JEE Main mathematics section is built for a Class 12 profile', jeeSection.exam?.indiaExam?.track === 'jee-main' && jeeSection.allowance?.unlimited === true,
  JSON.stringify({ track: jeeSection.exam?.indiaExam?.track, allowance: jeeSection.allowance }));
await backToFree(jai.id);

// ── H · JEE Advanced is Premium content ──────────────────────────────────────
await gated('a JEE Main profile asking for the JEE Advanced track is refused', POST('/practice/next', { mode: 'smart', track: 'jee-advanced' }),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.JEE_ADVANCED });
same('JEE Main practice stays free', (await POST('/practice/next', { mode: 'smart' })).question.indiaTrack, 'jee-main');
const vik = (await POST('/profiles', { name: 'Vik', year: 12, course: 'in', indiaTrack: 'jee-advanced' })).user;
const advancedGate = await gated('a JEE Advanced profile cannot practise without Premium', POST('/practice/next', { mode: 'smart' }),
  { code: 'PREMIUM_REQUIRED', capability: ENTITLEMENTS.JEE_ADVANCED });
ok('the refusal names the track and what stays free', /JEE Advanced/.test(advancedGate?.message || '') && /JEE Main/.test(advancedGate?.message || ''), advancedGate?.message);
same('JEE Advanced practice is not counted when it is refused', (await GET('/me')).user.usage.practice.used, 0);
await link(vik.id, premiumSnapshot());
const advanced = await POST('/practice/next', { mode: 'smart' });
same('with Premium the JEE Advanced track serves its own questions', advanced.question.indiaTrack, 'jee-advanced');
await backToFree(vik.id);

// ── I · nothing personal in the counter ──────────────────────────────────────
const deviceRows = rawRows().device || [];
const usageRows = deviceRows.filter(r => String(r.id).startsWith('pri-free-usage-v1:'));
ok('usage is kept per profile in device rows', usageRows.length === 4, `${usageRows.length} usage rows`);
const usageDisk = JSON.stringify(usageRows);
ok('usage rows carry no name or email', !/Asha|Ned|Jai|Vik|@/.test(usageDisk), usageDisk.slice(0, 200));
ok('usage rows never carry a plan flag a client could forge', !/premium|plan|entitlement/i.test(usageDisk), usageDisk.slice(0, 200));

await authority.close();
console.log(`\nEntitlement enforcement — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nENTITLEMENT ENFORCEMENT: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
