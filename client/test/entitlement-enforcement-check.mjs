// Pri Learning · free tier and Premium enforcement in the local backend.
//
// Drives the real dispatcher (client/src/local/backend.js) and the India exam
// module over the in-memory IndexedDB that backend-check.mjs stands up. Proves:
//   · 20 practice questions a day on the free plan, counted per profile
//   · the day resets on the PROFILE's calendar (Asia/Kolkata for India profiles,
//     Australia/Sydney otherwise) — the same instant is a new day in one and
//     not the other
//   · a server-issued Premium snapshot lifts the cap; a forged plan label does not
//   · the 7-day offline window is honoured (expired → free; valid → premium)
//   · one exam simulation per 30 days, in both the HSC paper builder and the
//     India exam module, lifted by premium-exams
//   · the JEE Advanced track needs jee-advanced-content
//   · every declared capability has a named enforcement point
//   · retries from History count toward the same cap (no loophole)
//   · usage rows carry no personal data
//
// Usage: node client/test/entitlement-enforcement-check.mjs

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

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

async function link(pid, entitlement) {
  await idb.put('device', { id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student', emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null, entitlement });
}
async function unlink(pid) { await idb.del('device', cloudLinkRowId(pid)); }

// ── A · the calendar and the enforcement map ─────────────────────────────────
same('a UTC evening is still 5 Sep in Asia/Kolkata', gate.dayKey(T0, 'Asia/Kolkata'), '2026-09-05');
same('the same instant is already 6 Sep in Australia/Sydney', gate.dayKey(T0, 'Australia/Sydney'), '2026-09-06');
same('the next Kolkata day starts at 18:30Z', gate.nextDayStart(T0, 'Asia/Kolkata'), Date.UTC(2026, 8, 5, 18, 30));
same('the next Sydney day starts at 14:00Z on the 6th', gate.nextDayStart(T0, 'Australia/Sydney'), Date.UTC(2026, 8, 6, 14, 0));
same('India profiles live in Asia/Kolkata', gate.profileTimeZone({ course: 'in' }), 'Asia/Kolkata');
same('Australian profiles keep Australia/Sydney', gate.profileTimeZone({ course: 'nsw' }), 'Australia/Sydney');
same('an explicit profile timezone wins', gate.profileTimeZone({ course: 'in', timezone: 'Europe/London' }), 'Europe/London');
same('an invalid profile timezone falls back to the course default', gate.profileTimeZone({ course: 'in', timezone: 'Mars/Olympus' }), 'Asia/Kolkata');
same('the free tier is 20 questions a day and one exam per 30 days', [gate.FREE_TIER.practicePerDay, gate.FREE_TIER.examsPerWindow, gate.FREE_TIER.examWindowDays], [20, 1, 30]);
for (const capability of Object.values(ENTITLEMENTS)) {
  ok(`${capability} has a named enforcement point`, typeof gate.CAPABILITY_ENFORCEMENT[capability] === 'string' && gate.CAPABILITY_ENFORCEMENT[capability].length > 10);
}
ok('additional-ai-usage is declared reserved (no-op)', /reserved/.test(gate.CAPABILITY_ENFORCEMENT[ENTITLEMENTS.EXTRA_AI]));

// ── B · India profile: 20 a day, reset on the Kolkata calendar ───────────────
const asha = (await POST('/profiles', { name: 'Asha', year: 9, course: 'in' })).user;
same('a fresh profile is on the free plan', asha.plan.tier, 'free');
same('the free practice allowance is 20 with none used', [asha.usage.practice.used, asha.usage.practice.limit], [0, 20]);
same('the allowance is kept on the profile calendar', asha.usage.practice.timeZone, 'Asia/Kolkata');
same('the allowance says when it resets', asha.usage.practice.resetsAt, Date.UTC(2026, 8, 5, 18, 30));

let lastQuestion = null;
let usedSequence = [];
for (let i = 0; i < 20; i++) {
  const served = await POST('/practice/next', { mode: 'smart' });
  lastQuestion = served.question;
  usedSequence.push(served.allowance.used);
}
same('every served question reports the running count', usedSequence, Array.from({ length: 20 }, (_, i) => i + 1));
const capped = await gated('the 21st question of the day is refused on the free plan', POST('/practice/next', { mode: 'smart' }),
  { code: 'FREE_CAP_REACHED', capability: ENTITLEMENTS.UNLIMITED_PRACTICE });
same('the refusal names the reset instant', capped?.resetsAt, Date.UTC(2026, 8, 5, 18, 30));
same('the refusal reports 20 of 20 used', [capped?.used, capped?.limit], [20, 20]);
ok('the refusal is plain copy a student can act on', /20 free practice questions/.test(capped?.message || '') && /midnight/.test(capped?.message || ''), capped?.message);
await gated('a fresh variant from History counts toward the same cap', POST(`/history/${lastQuestion.id}/retry`, { variant: 'fresh' }),
  { code: 'FREE_CAP_REACHED', capability: ENTITLEMENTS.UNLIMITED_PRACTICE });
same('/me reports the exhausted allowance', (await GET('/me')).user.usage.practice.used, 20);

now = T0 + 31 * MIN; // 00:01 on 6 Sep in Kolkata; still 04:31 on 6 Sep in Sydney
const fresh = await POST('/practice/next', { mode: 'smart' });
same('one minute past Kolkata midnight the India profile starts a new day', [fresh.allowance.used, fresh.allowance.day], [1, '2026-09-06']);

// ── C · Australian profile: the same instants on the Sydney calendar ─────────
now = T0;
const ned = (await POST('/profiles', { name: 'Ned', year: 9 })).user;
same('an Australian profile counts on the Sydney calendar', ned.usage.practice.timeZone, 'Australia/Sydney');
for (let i = 0; i < 20; i++) await POST('/practice/next', { mode: 'smart' });
await gated('Ned hits the same 20-a-day cap', POST('/practice/next', { mode: 'smart' }), { code: 'FREE_CAP_REACHED' });
now = T0 + 31 * MIN;
await gated('Kolkata midnight is not a new day in Sydney — Ned stays capped', POST('/practice/next', { mode: 'smart' }), { code: 'FREE_CAP_REACHED' });
now = Date.UTC(2026, 8, 6, 14, 0); // 00:00 on 7 Sep in Sydney
same('Sydney midnight resets Ned', (await POST('/practice/next', { mode: 'smart' })).allowance.used, 1);

// ── D · Premium lifts the cap; a forged label does not ───────────────────────
// Ned has used one of today's twenty on the Sydney calendar; spend the rest so
// he is capped again at the current instant. The clock is never rewound: the
// counter holds one day, because no student travels backwards through midnight.
for (let i = 0; i < 19; i++) await POST('/practice/next', { mode: 'smart' });
await gated('spending the rest of the day caps Ned again', POST('/practice/next', { mode: 'smart' }), { code: 'FREE_CAP_REACHED' });
await link(ned.id, { plan: 'premium', status: 'active', provider: 'web' });
await gated('a plan label with no server window is not Premium', POST('/practice/next', { mode: 'smart' }), { code: 'FREE_CAP_REACHED' });
await link(ned.id, premiumSnapshot());
const lifted = await POST('/practice/next', { mode: 'smart' });
same('a server-issued Premium snapshot lifts the daily cap', [lifted.allowance.allowed, lifted.allowance.unlimited, lifted.allowance.plan], [true, true, 'premium']);
const nedMe = (await GET('/me')).user;
same('/me reports Premium with no practice limit', [nedMe.plan.tier, nedMe.usage.practice.limit, nedMe.usage.exams.limit], ['premium', null, null]);
ok('/me exposes the six Premium capabilities', Object.values(ENTITLEMENTS).every(c => nedMe.plan.capabilities.includes(c)), JSON.stringify(nedMe.plan.capabilities));

// ── E · the 7-day offline window ─────────────────────────────────────────────
await link(ned.id, premiumSnapshot({ offlineUntil: now - 1 }));
online = false;
const offlineExpired = await gated('offline past the 7-day window, Premium falls back to the free cap', POST('/practice/next', { mode: 'smart' }),
  { code: 'FREE_CAP_REACHED', reason: 'offline-entitlement-expired' });
ok('the refusal asks the student to reconnect', offlineExpired?.refreshRequired === true && /reconnect/.test(offlineExpired?.message || ''), offlineExpired?.message);
online = true;
await gated('online with an expired offline window the server snapshot must be refreshed first', POST('/practice/next', { mode: 'smart' }),
  { code: 'FREE_CAP_REACHED', reason: 'not-entitled' });
await link(ned.id, premiumSnapshot({ offlineUntil: now + 6 * DAY }));
online = false;
const offlineValid = await POST('/practice/next', { mode: 'smart' });
same('inside the offline window Premium keeps working without a network', [offlineValid.allowance.unlimited, offlineValid.allowance.reason], [true, 'offline-cache-valid']);
online = true;

// ── F · one exam simulation per 30 days (HSC paper builder) ──────────────────
await unlink(ned.id);
now = T0;
const firstPaper = await POST('/exams', { length: 10 });
same('the first exam simulation is free', [firstPaper.allowance.used, firstPaper.allowance.limit], [1, 1]);
const nedAfterExam = (await GET('/me')).user;
same('/me reports the exam allowance and when the next one unlocks', [nedAfterExam.usage.exams.used, nedAfterExam.usage.exams.nextAt], [1, T0 + 30 * DAY]);
const examCapped = await gated('a second simulation inside 30 days is refused on the free plan', POST('/exams', { length: 10 }),
  { code: 'FREE_CAP_REACHED', capability: ENTITLEMENTS.PREMIUM_EXAMS });
same('the refusal says when the next free simulation unlocks', examCapped?.nextAt, T0 + 30 * DAY);
now = T0 + 30 * DAY + MIN;
same('30 days later a simulation is free again', (await POST('/exams', { length: 10 })).allowance.used, 1);
await link(ned.id, premiumSnapshot());
const premiumPapers = [await POST('/exams', { length: 10 }), await POST('/exams', { length: 10 })];
ok('premium-exams lifts the 30-day cap', premiumPapers.every(r => r.allowance.unlimited === true && r.exam?.id));
await unlink(ned.id);

// ── G · the India exam module shares the same rule and counter ───────────────
now = T0;
const jai = (await POST('/profiles', { name: 'Jai', year: 12, course: 'in', indiaTrack: 'jee-main' })).user;
const jeeSection = await dispatchIndiaExam(jai, 'POST', '/exams', {});
ok('a JEE Main mathematics section is built for a free Class 12 profile', jeeSection.exam?.indiaExam?.track === 'jee-main' && jeeSection.allowance?.used === 1,
  JSON.stringify({ track: jeeSection.exam?.indiaExam?.track, allowance: jeeSection.allowance }));
await gated('a second JEE section inside 30 days is refused on the free plan', dispatchIndiaExam(jai, 'POST', '/exams', {}),
  { code: 'FREE_CAP_REACHED', capability: ENTITLEMENTS.PREMIUM_EXAMS });
await link(jai.id, premiumSnapshot());
ok('premium-exams lifts the India exam cap too', (await dispatchIndiaExam(jai, 'POST', '/exams', {})).allowance.unlimited === true);
await unlink(jai.id);

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
await unlink(vik.id);

// ── I · nothing personal in the counter ──────────────────────────────────────
const deviceRows = rawRows().device || [];
const usageRows = deviceRows.filter(r => String(r.id).startsWith('pri-free-usage-v1:'));
ok('usage is kept per profile in device rows', usageRows.length === 4, `${usageRows.length} usage rows`);
const usageDisk = JSON.stringify(usageRows);
ok('usage rows carry no name or email', !/Asha|Ned|Jai|Vik|@/.test(usageDisk), usageDisk.slice(0, 200));
ok('usage rows never carry a plan flag a client could forge', !/premium|plan|entitlement/i.test(usageDisk), usageDisk.slice(0, 200));

console.log(`\nEntitlement enforcement — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nENTITLEMENT ENFORCEMENT: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
