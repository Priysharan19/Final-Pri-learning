// Pri Learning · the JEE Advanced paywall is decided by the RESOLVED target.
//
// jee-advanced-content used to be required on exactly one route, POST
// /practice/next, and only when the request carried no taskId. The exemption
// assumed a task is something a teacher set; the shipped Tasks page lets a
// student set their own, so "put a taskId on it" was a way to buy the track for
// nothing. Two more routes reached the same content without asking at all:
// /history/:id/retry, which is counted against the daily cap but never checked
// for the capability, so a lapsed subscriber could keep re-drawing the JEE
// Advanced questions their subscription had served them; and the India exam
// module's POST /exams, which checked the free simulation window and not the
// track it was about to compose a whole paper from.
//
// Proves, on a free profile with no cloud entitlement:
//   · smart practice on the track is refused (the declared gate, unchanged)
//   · practice against a task whose targets name the track is refused
//   · a retry of a JEE Advanced question is refused after Premium lapses
//   · a JEE Advanced exam simulation is refused, and says the track is the
//     reason rather than spending the profile's one free simulation
// and, so the gate is not simply refusing everything:
//   · the same four routes work on the JEE Main and CBSE tracks
//   · they all work again once the account holds a server-issued Premium snapshot
//   · CAPABILITY_ENFORCEMENT names all four sites
//
// Usage: node client/test/jee-advanced-gate-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

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
const { loadAllBanks, loadBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

const DAY = 86_400_000;

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};

/**
 * dispatch() is the backend, which sits BELOW the layer that owns lazy question
 * banks. When a target resolves into the previous-year archive — a chapter that
 * has a real past paper behind it — the bank is a separate chunk and the
 * backend throws `bankMissing` rather than reaching for it. api.js catches
 * exactly that and retries after loading (see its MAX_BANK_FAULTS loop), so a
 * student never sees it; a suite calling dispatch() directly would.
 *
 * Mirrored here rather than routed through api.js, because what this suite is
 * about is the entitlement gate, and api.js would drag a request pipeline,
 * profile mutation recording and the sync outbox into a test about who may
 * practise what.
 */
const withBanks = async (run) => {
  for (let faults = 0; ; faults += 1) {
    try { return await run(); }
    catch (err) {
      if (!err?.bankMissing || faults >= 4) throw err;
      await loadBanks([err.bank]);
    }
  }
};
const POST = (path, body = {}) => withBanks(() => dispatch('POST', path, body));
const GET = path => withBanks(() => dispatch('GET', path));

/** The call must come back as the Premium paywall for this exact capability. */
async function refused(name, promise) {
  try {
    await promise;
    ok(name, false, 'the call was allowed');
    return null;
  } catch (err) {
    ok(name, err.status === 402 && err.code === 'PREMIUM_REQUIRED' && err.capability === ENTITLEMENTS.JEE_ADVANCED,
      `status ${err.status} code ${err.code} capability ${err.capability}: ${err.message}`);
    return err;
  }
}

/** The call must go through and produce something. */
async function allowed(name, promise, check = value => !!value) {
  try {
    const value = await promise;
    ok(name, check(value), JSON.stringify(value)?.slice(0, 200));
    return value;
  } catch (err) {
    ok(name, false, `refused ${err.status} ${err.code}: ${err.message}`);
    return null;
  }
}

async function grantPremium(pid) {
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student', emailVerified: true,
    linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: {
      plan: 'premium', status: 'active', provider: 'web',
      currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY, issuedAt: now, sourceVersion: 3
    }
  });
}
const revokePremium = pid => idb.del('device', cloudLinkRowId(pid));

// ── A free profile on the JEE Advanced track ─────────────────────────────────

const vik = (await POST('/profiles', { name: 'Vik', year: 12, course: 'in', indiaTrack: 'jee-advanced' })).user;
ok('the profile starts on the free plan', (await GET('/me')).user.plan.tier === 'free', (await GET('/me')).user.plan.tier);

/** A Class 12 chapter id, so a task target names something the resolver knows. */
const curriculum = await GET('/curriculum');
const class12Chapter = [...(curriculum.years || []), ...(curriculum.streams || [])]
  .flatMap(section => section.subtopics || []).find(chapter => chapter.year === 12)?.id;
ok('the suite found a Class 12 chapter to target', !!class12Chapter, String(class12Chapter));

await refused('smart practice on jee-advanced is refused', POST('/practice/next', { mode: 'smart' }));
await refused('practice with an explicit jee-advanced track is refused', POST('/practice/next', { mode: 'smart', track: 'jee-advanced' }));

const selfSet = (await POST('/tasks', {
  title: 'My own goal', count: 10,
  targets: [{ chapterId: class12Chapter, track: 'jee-advanced', difficulty: 4 }]
})).task;
ok('the student could set the task itself', selfSet.targets[0]?.track === 'jee-advanced', JSON.stringify(selfSet.targets));
await refused('practice against a self-set jee-advanced task is refused', POST('/practice/next', { taskId: selfSet.id }));

const mixed = (await POST('/tasks', {
  title: 'Mixed goal', count: 10,
  targets: [
    { chapterId: class12Chapter, track: 'jee-main', difficulty: 3 },
    { chapterId: class12Chapter, track: 'jee-advanced', difficulty: 4 }
  ]
})).task;
await refused('a task that merely contains a jee-advanced target is refused', POST('/practice/next', { taskId: mixed.id }));

await refused('a jee-advanced exam simulation is refused', dispatchIndiaExam((await GET('/me')).user, 'POST', '/exams', {}));

// The refusal must not have spent the one free simulation the plan includes.
ok('the refused simulation did not spend the free exam window',
  (await GET('/me')).user.usage.exams.used === 0, JSON.stringify((await GET('/me')).user.usage.exams));

// ── The retry route, after a real subscription lapses ────────────────────────

await grantPremium(vik.id);
const served = await allowed('Premium serves jee-advanced smart practice',
  POST('/practice/next', { mode: 'smart' }), value => value?.question?.indiaTrack === 'jee-advanced');
await POST(`/practice/${served.question.id}/reveal`, { ms: 1000 });

await revokePremium(vik.id);
ok('the profile is back on the free plan', (await GET('/me')).user.plan.tier === 'free', (await GET('/me')).user.plan.tier);
await refused('retrying a jee-advanced question after Premium lapses is refused',
  POST(`/history/${served.question.id}/retry`, { variant: 'fresh' }));

// ── The same routes on the free tracks, so the gate is not blanket ───────────

const asha = (await POST('/profiles', { name: 'Asha', year: 12, course: 'in', indiaTrack: 'jee-main' })).user;
await allowed('smart practice on jee-main is allowed on the free plan',
  POST('/practice/next', { mode: 'smart' }), value => value?.question?.indiaTrack === 'jee-main');

const mainTask = (await POST('/tasks', {
  title: 'JEE Main goal', count: 10,
  targets: [{ chapterId: class12Chapter, track: 'jee-main', difficulty: 3 }]
})).task;
const viaMainTask = await allowed('practice against a jee-main task is allowed on the free plan',
  POST('/practice/next', { taskId: mainTask.id }), value => value?.question?.indiaTrack === 'jee-main');
await POST(`/practice/${viaMainTask.question.id}/reveal`, { ms: 1000 });
await allowed('retrying a jee-main question is allowed on the free plan',
  POST(`/history/${viaMainTask.question.id}/retry`, { variant: 'fresh' }),
  value => value?.question?.indiaTrack === 'jee-main');
await allowed('a jee-main exam simulation is allowed on the free plan',
  dispatchIndiaExam((await GET('/me')).user, 'POST', '/exams', {}), value => value?.exam?.questions?.length > 0);

const ravi = (await POST('/profiles', { name: 'Ravi', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
await allowed('smart practice on cbse is allowed on the free plan',
  POST('/practice/next', { mode: 'smart' }), value => !!value?.question?.id);
ok('a free CBSE profile is still on the free plan', (await GET('/me')).user.plan.tier === 'free', String(ravi.id));

// ── Premium buys every one of the four sites ─────────────────────────────────

await POST('/profiles/select', { id: vik.id });
await grantPremium(vik.id);
await allowed('Premium allows smart practice on jee-advanced',
  POST('/practice/next', { mode: 'smart' }), value => value?.question?.indiaTrack === 'jee-advanced');
const viaTask = await allowed('Premium allows a jee-advanced task',
  POST('/practice/next', { taskId: selfSet.id }), value => value?.question?.indiaTrack === 'jee-advanced');
await POST(`/practice/${viaTask.question.id}/reveal`, { ms: 1000 });
await allowed('Premium allows retrying a jee-advanced question',
  POST(`/history/${viaTask.question.id}/retry`, { variant: 'fresh' }),
  value => value?.question?.indiaTrack === 'jee-advanced');
await allowed('Premium allows a jee-advanced exam simulation',
  dispatchIndiaExam((await GET('/me')).user, 'POST', '/exams', {}),
  value => value?.exam?.indiaExam?.track === 'jee-advanced');

// ── The declaration has to name where the rule actually lives ────────────────

const declared = gate.CAPABILITY_ENFORCEMENT[ENTITLEMENTS.JEE_ADVANCED];
ok('the enforcement note names smart practice', /practice\/next/.test(declared), declared);
ok('the enforcement note names the task route', /task/i.test(declared), declared);
ok('the enforcement note names the retry route', /history\/:id\/retry/.test(declared), declared);
ok('the enforcement note names the India exam route', /\/exams/.test(declared), declared);
ok('the enforcement note says the resolved track is what decides', /resolved/i.test(declared), declared);

console.log(`\nJEE Advanced gate — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nJEE ADVANCED GATE: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
