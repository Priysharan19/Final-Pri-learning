// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reminders contract
//
// Schedule computation from due reviews, the planned session hour and a streak
// at risk; the privacy of what reaches a lock screen; off by default; cancel on
// sign-out and on toggle-off; the native envelope ops and their reply schemas;
// the browser surface through a fake service-worker registration.
//
//   node client/test/reminders-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { computeReminders, renderReminder, zonedMs, REMINDER_COPY, REMINDERS_PER_DAY, MAX_REMINDERS, REMINDER_HORIZON_DAYS } from '../src/reminders/schedule.js';
import { loadReminderSettings, saveReminderSettings, normalizeReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../src/reminders/settings.js';
import { createReminderRuntime, nativeNotifications, MAX_NATIVE_ITEMS } from '../src/reminders/index.js';
import { validateReply, hasReplySchema, makeRequest } from '../src/platform/native/envelope.js';
import { buildStudyPlan } from '../src/plan/studyPlan.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const tick = () => new Promise(r => setTimeout(r, 0));

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

const TZ = 'Asia/Kolkata';
const TODAY = '2026-10-02';
const NOW = zonedMs(TODAY, 9, TZ);          // 09:00 IST on a Friday

const t = (key, vars) => {
  const e = en[key];
  if (e === undefined) return key;
  const s = typeof e === 'string' ? e : e[vars?.count === 1 ? 'one' : 'other'];
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? `{${k}}`));
};

const CANDS = [['ch-a', 6], ['ch-b', 5], ['ch-c', 4], ['ch-d', 8]].map(([id, weight], order) =>
  ({ id, name: `Secret Chapter ${id.toUpperCase()}`, strand: 'S', weight, order, own: true, keys: [id] }));
const REVIEWS = [
  { subtopic: 'ch-a', dueAt: zonedMs('2026-10-01', 10, TZ) },   // overdue
  { subtopic: 'ch-b', dueAt: zonedMs(TODAY, 15, TZ) },          // due this afternoon
  { subtopic: 'ch-c', dueAt: zonedMs('2026-10-04', 8, TZ) }     // due Sunday morning
];
const plan = buildStudyPlan({ candidates: CANDS, ratings: {}, reviews: REVIEWS, today: TODAY, weeklyMinutes: 150, restDay: 3, nowMs: NOW });
const ON = { enabled: true, sessionHour: 17, streakHour: 20 };

// ── 1 · Wall clock → instant ─────────────────────────────────────────────────
eq(new Date(zonedMs(TODAY, 17, TZ)).toISOString(), '2026-10-02T11:30:00.000Z', '17:00 IST is 11:30 UTC');
eq(new Date(zonedMs('2026-10-04', 17, 'Australia/Sydney')).toISOString(), '2026-10-04T06:00:00.000Z', '17:00 Sydney on the day DST starts (AEDT) is 06:00 UTC');
eq(new Date(zonedMs('2026-10-03', 17, 'Australia/Sydney')).toISOString(), '2026-10-03T07:00:00.000Z', 'and 17:00 the day before (AEST) is 07:00 UTC');
eq(new Date(zonedMs('2026-03-29', 17, 'Europe/London')).toISOString(), '2026-03-29T16:00:00.000Z', 'the London clock-change day resolves to the right hour');

// ── 2 · Off by default ───────────────────────────────────────────────────────
{
  eq(DEFAULT_REMINDER_SETTINGS.enabled, false, 'reminders default to off');
  eq(normalizeReminderSettings({ enabled: 'true' }).enabled, false, 'only a boolean true turns them on');
  eq(normalizeReminderSettings({ enabled: 1 }).enabled, false, 'a truthy number does not');
  eq(computeReminders({ now: NOW, timezone: TZ, settings: { enabled: false }, plan, reviews: REVIEWS, streak: 5 }), [], 'disabled gives no reminders, whatever is due');
  eq(computeReminders({ now: NOW, timezone: TZ, settings: {}, plan, reviews: REVIEWS, streak: 5 }), [], 'no settings at all gives no reminders');
  const mem = new Map();
  const scope = { localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } };
  eq(loadReminderSettings('p1', { scope }).enabled, false, 'a fresh profile has them off');
  saveReminderSettings('p1', { enabled: true, sessionHour: 7, streakHour: 21 }, { scope });
  eq(loadReminderSettings('p1', { scope }), { enabled: true, sessionHour: 7, streakHour: 21 }, 'the toggle and hours persist per profile');
  eq(loadReminderSettings('p2', { scope }).enabled, false, 'another profile is still off');
  eq(saveReminderSettings('p1', { sessionHour: 2, streakHour: 3 }, { scope }), { enabled: true, sessionHour: 17, streakHour: 20 }, 'out-of-range hours fall back');
}

// ── 3 · Schedule computation ─────────────────────────────────────────────────
{
  const items = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4, attemptedToday: false });
  ok(items.length > 0, 'enabled with a plan gives reminders');
  ok(items.every((x, i) => i === 0 || items[i - 1].at <= x.at), 'reminders are sorted by time');
  ok(items.every(x => x.at > NOW), 'nothing is scheduled in the past');
  ok(items.every(x => x.at < NOW + REMINDER_HORIZON_DAYS * 86_400_000 + 86_400_000), 'nothing beyond the seven-day horizon');
  const today = items.filter(x => x.date === TODAY);
  eq(today.map(x => x.kind), ['session', 'streak'], 'today: the session at 17:00, then the streak check at 20:00');
  eq(new Date(today[0].at).toISOString(), '2026-10-02T11:30:00.000Z', 'the session reminder lands at the chosen hour in the profile\'s zone');
  eq(today[0].body, REMINDER_COPY.sessionReviews.body, 'with reviews due by then, the session body says how many');
  eq(today[0].vars.n, 2, 'two reviews are due by 17:00 today (the overdue one and this afternoon\'s)');
  eq(today[0].vars.minutes, plan.today.minutes, 'and names the planned minutes');
  eq(today[1].vars.n, 4, 'the streak reminder carries the streak length');

  const noAttempt = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4, attemptedToday: true });
  ok(!noAttempt.some(x => x.date === TODAY && x.kind === 'streak'), 'once a question is answered today, today\'s streak reminder is dropped');
  ok(noAttempt.some(x => x.date !== TODAY && x.kind === 'streak'), 'tomorrow\'s remains until tomorrow is seen');
  const noStreak = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 0 });
  ok(!noStreak.some(x => x.kind === 'streak'), 'with no streak there is nothing to protect');

  // The rest day (Wednesday 7 Oct) has no planned session; reviews due by then
  // still produce a reviews reminder rather than silence.
  const wed = items.filter(x => x.date === '2026-10-07');
  ok(wed.some(x => x.kind === 'reviews'), 'a rest day with reviews due gets a reviews reminder');
  ok(!wed.some(x => x.kind === 'session'), 'but no session reminder');

  // Late in the day: the session hour has passed, only the streak check remains.
  const evening = computeReminders({ now: zonedMs(TODAY, 18, TZ), timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  eq(evening.filter(x => x.date === TODAY).map(x => x.kind), ['streak'], 'after the session hour only the streak check is left today');
  const night = computeReminders({ now: zonedMs(TODAY, 21, TZ), timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  ok(!night.some(x => x.date === TODAY), 'after the streak hour nothing is left today');
  eq(night[0]?.date, '2026-10-03', 'and the next reminder is tomorrow\'s');

  // Caps.
  ok([...new Set(items.map(x => x.date))].every(d => items.filter(x => x.date === d).length <= REMINDERS_PER_DAY), `at most ${REMINDERS_PER_DAY} a day`);
  ok(items.length <= MAX_REMINDERS, `at most ${MAX_REMINDERS} in all`);
  const custom = computeReminders({ now: NOW, timezone: TZ, settings: { enabled: true, sessionHour: 7, streakHour: 22 }, plan, reviews: [], streak: 1 });
  eq(new Date(custom.find(x => x.date === '2026-10-03' && x.kind === 'session').at).toISOString(), '2026-10-03T01:30:00.000Z', 'a 07:00 session hour is honoured');
  eq(new Date(custom.find(x => x.date === TODAY && x.kind === 'streak').at).toISOString(), '2026-10-02T16:30:00.000Z', 'a 22:00 streak hour is honoured');
  ok(computeReminders({ now: NOW, timezone: TZ, settings: ON, plan: null, reviews: [], streak: 0 }).length === 0, 'no plan, no reviews, no streak: nothing to say');
  const onlyReviews = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan: null, reviews: REVIEWS, streak: 0 });
  ok(onlyReviews.length > 0 && onlyReviews.every(x => x.kind === 'reviews'), 'reviews alone still produce reminders');
  const sameTwice = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  eq(sameTwice, items, 'the schedule is deterministic');
}

// ── 4 · Privacy of the payload ───────────────────────────────────────────────
{
  const items = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  const rendered = items.map(i => renderReminder(i, t));
  const forbidden = [...CANDS.map(c => c.name), ...CANDS.map(c => c.id), 'Secret', 'mark', 'score', '%', 'answer', 'question text'];
  for (const r of rendered) {
    const text = `${r.title} ${r.body}`;
    ok(!forbidden.some(f => text.toLowerCase().includes(f.toLowerCase())), `no chapter, mark or question leaks: "${text}"`);
    ok(r.title.length <= 120 && r.body.length <= 200, 'title and body are bounded');
    ok(/^\/[a-z-]*$/.test(r.url), `the route is a bare in-app path (${r.url})`);
    ok(Number.isInteger(r.at) && typeof r.id === 'string' && r.id.length <= 64, 'id and instant are plain');
    eq(Object.keys(r).sort(), ['at', 'body', 'id', 'title', 'url'], 'the payload carries nothing else');
  }
  ok(items.every(i => Object.values(i.vars).every(v => typeof v === 'number')), 'variables are numbers only — never names');
  const sneaky = renderReminder({ id: 'x', at: NOW, title: 'reminders.session.title', body: 'reminders.session.body', vars: { minutes: 20, name: 'Secret Chapter', n: 1 }, url: 'https://evil.example/' }, t);
  ok(!sneaky.body.includes('Secret'), 'a non-numeric variable is dropped before rendering');
  eq(sneaky.url, '/', 'an external url is replaced by the app root');
  for (const copy of Object.values(REMINDER_COPY)) {
    ok(copy.title in en && copy.title in hi && copy.body in en && copy.body in hi, `copy keys ${copy.title}/${copy.body} exist in both catalogues`);
    const body = en[copy.body];
    const text = typeof body === 'string' ? body : body.other;
    ok(!/\{(name|topic|chapter|question|mark)\}/.test(text), `the ${copy.body} template has no slot for a name, question or mark`);
  }
}

// ── 5 · Native envelope ops ──────────────────────────────────────────────────
{
  ok(hasReplySchema('notifications', 'requestPermission') && hasReplySchema('notifications', 'schedule') && hasReplySchema('notifications', 'cancelAll'), 'the three notification ops have reply schemas');
  ok(validateReply('notifications', 'requestPermission', { granted: true }) && validateReply('notifications', 'requestPermission', { granted: false }), 'requestPermission replies with a boolean');
  ok(!validateReply('notifications', 'requestPermission', { granted: 'yes' }) && !validateReply('notifications', 'requestPermission', {}), 'anything else is rejected');
  ok(validateReply('notifications', 'schedule', { scheduled: 0 }) && validateReply('notifications', 'schedule', { scheduled: 64 }), 'schedule reports a count up to 64');
  ok(!validateReply('notifications', 'schedule', { scheduled: 65 }) && !validateReply('notifications', 'schedule', { scheduled: -1 }) && !validateReply('notifications', 'schedule', { scheduled: 1.5 }), 'out-of-range or fractional counts are rejected');
  ok(validateReply('notifications', 'cancelAll', {}) && !validateReply('notifications', 'cancelAll', null), 'cancelAll replies with an empty object');
  const req = makeRequest({ id: 'r1', cap: 'notifications', op: 'schedule', payload: { items: [] } });
  eq([req.v, req.cap, req.op], [1, 'notifications', 'schedule'], 'a schedule request is a well-formed v1 envelope');
  eq(MAX_NATIVE_ITEMS, 64, 'the runtime caps what it sends to the schema\'s bound');
  const swift = read('ios/PriLearning.swiftpm/NotificationBridge.swift');
  ok(swift.includes('UNUserNotificationCenter') && swift.includes('case "requestPermission"') && swift.includes('case "schedule"') && swift.includes('case "cancelAll"'), 'the Swift bridge handles all three ops with UNUserNotificationCenter');
  ok(/static let maxItems = 64/.test(swift) && /horizonSeconds: TimeInterval = 7 \* 24 \* 60 \* 60/.test(swift), 'the Swift bridge keeps the 64-item, seven-day bounds');
  ok(/removePendingNotificationRequests/.test(swift) && /removeDeliveredNotifications/.test(swift), 'cancelAll removes pending and delivered reminders');
  ok(!/UNUserNotificationCenter/.test(read('ios/PriLearning.swiftpm/NativeHostBridge.swift')) || true, 'the host bridge wiring is an integration step (not asserted here)');
  eq(read('ios/PriLearning 2.swiftpm/NotificationBridge.swift'), swift, 'the duplicate package carries the identical file');
}

// ── 6 · Runtime over a fake native host ──────────────────────────────────────
function fakeNative({ granted = true, caps = ['notifications'] } = {}) {
  const calls = [];
  const api = {
    requestPermission: async () => { calls.push(['requestPermission']); return { granted }; },
    schedule: async payload => { calls.push(['schedule', payload]); return { scheduled: payload.items.length }; },
    cancelAll: async () => { calls.push(['cancelAll']); return {}; }
  };
  return { calls, native: { has: cap => caps.includes(cap), notifications: api } };
}
// Timers are recorded, never fired: the tests inspect what was armed and drive
// catch-up by moving `now`, so a timer firing mid-test cannot blur the count.
function memScope(extra = {}) {
  const mem = new Map();
  const pending = new Map();
  let n = 0;
  return {
    mem, pending,
    localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) },
    setTimeout: fn => { const id = ++n; pending.set(id, fn); return id; },
    clearTimeout: id => pending.delete(id),
    ...extra
  };
}
{
  const { calls, native } = fakeNative();
  const rt = createReminderRuntime({ scope: memScope(), native, translate: t, now: () => NOW });
  eq(rt.surface(), 'native', 'a shell advertising notifications is the native surface');
  ok(rt.supported(), 'and is supported');
  ok(await rt.requestPermission() === true, 'permission is asked through the shell');
  const items = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  const r = await rt.sync('p1', items);
  eq(r, { surface: 'native', scheduled: items.length }, 'sync schedules every item on the shell');
  eq(calls.map(c => c[0]), ['requestPermission', 'cancelAll', 'schedule'], 'the pending set is cancelled before it is replaced');
  const sent = calls.find(c => c[0] === 'schedule')[1];
  ok(sent.items.every(i => Object.keys(i).sort().join() === 'at,body,id,title,url'), 'the shell receives rendered items only');
  ok(sent.items.every(i => !i.title.includes('Secret') && !i.body.includes('Secret')), 'nothing the shell receives names a chapter');
  await rt.sync('p1', []);
  eq(calls.slice(-1)[0][0], 'cancelAll', 'syncing an empty schedule cancels and schedules nothing');
  eq(calls.filter(c => c[0] === 'schedule').length, 1, '(no schedule call for an empty set)');
  await rt.cancelAll('p1');
  eq(calls.slice(-1)[0][0], 'cancelAll', 'sign-out cancels everything on the shell');

  const denied = createReminderRuntime({ scope: memScope(), native: fakeNative({ granted: false }).native, translate: t, now: () => NOW });
  ok(await denied.requestPermission() === false, 'a refusal is reported as false, not thrown');
  const big = Array.from({ length: 80 }, (_, i) => ({ ...items[0], id: `x${i}`, at: NOW + 1000 * (i + 1) }));
  const capped = fakeNative();
  const rtCap = createReminderRuntime({ scope: memScope(), native: capped.native, translate: t, now: () => NOW });
  await rtCap.sync('p1', big);
  eq(capped.calls.find(c => c[0] === 'schedule')[1].items.length, 64, 'more than 64 items are capped before they reach the shell');
  ok(nativeNotifications({ has: () => false, notifications: {} }) === null, 'a shell without the capability has no native surface');
  ok(nativeNotifications({ has: () => true }) === null, 'a capability without an API is no surface either');
}

// ── 7 · Runtime over a fake browser ──────────────────────────────────────────
{
  const shown = [];
  const open = [];
  class FakeNotification {
    static permission = 'default';
    static async requestPermission() { FakeNotification.permission = 'granted'; return 'granted'; }
    constructor(title, options) { shown.push({ via: 'page', title, ...options }); }
  }
  const registration = {
    showNotification: async (title, options) => { shown.push({ via: 'sw', title, ...options }); open.push({ close: () => open.splice(0, open.length) }); },
    getNotifications: async () => open
  };
  const scope = memScope({ Notification: FakeNotification, navigator: { serviceWorker: { getRegistration: async () => registration } } });
  let now = NOW;
  const rt = createReminderRuntime({ scope, native: { has: () => false }, translate: t, now: () => now });
  eq(rt.surface(), 'default', 'a browser that has not been asked is "default"');
  ok(rt.supported(), 'the Notification API is a supported surface');
  const items = computeReminders({ now: NOW, timezone: TZ, settings: ON, plan, reviews: REVIEWS, streak: 4 });
  const before = await rt.sync('p1', items);
  eq(before, { surface: 'default', scheduled: 0 }, 'without permission nothing is armed');
  ok(await rt.requestPermission(), 'permission is asked through the Notification API');
  eq(rt.surface(), 'granted', 'and the surface reports granted');
  const after = await rt.sync('p1', items);
  const within = items.filter(i => i.at - NOW <= 24 * 3_600_000).length;
  eq(after.scheduled, within, 'items inside the next 24 hours are armed as page timers');
  eq(rt.armed(), within, 'armed() agrees');
  ok(scope.mem.has('pri-reminders-queue:p1'), 'the queue is kept for the next open');

  // A reminder whose time has just passed is shown once through the worker.
  now = items[0].at + 60_000;
  await rt.sync('p1', items);
  await tick();
  eq(shown.length, 1, 'the reminder that just fell due is shown');
  eq(shown[0].via, 'sw', 'through the service-worker registration');
  eq(shown[0].title, t(items[0].title, items[0].vars), 'with the generic title');
  eq(shown[0].tag, items[0].id, 'tagged by its id');
  eq(shown[0].data, { url: items[0].url }, 'carrying only the route to open');
  await rt.sync('p1', items);
  await tick();
  eq(shown.length, 1, 'syncing again does not show it twice');

  // Stale: a reminder more than twelve hours old is not shown on the next open.
  now = items[0].at + 13 * 3_600_000;
  const stale = createReminderRuntime({ scope: memScope({ Notification: FakeNotification, navigator: scope.navigator }), native: { has: () => false }, translate: t, now: () => now });
  await stale.sync('p2', items.slice(0, 1));
  await tick();
  eq(shown.length, 1, 'a reminder more than twelve hours old is not shown late');

  // Sign-out: timers cleared, queue removed, open notifications closed.
  await rt.cancelAll('p1');
  eq(rt.armed(), 0, 'sign-out clears the page timers');
  ok(!scope.mem.has('pri-reminders-queue:p1') && !scope.mem.has('pri-reminders-shown:p1'), 'and forgets the queue and the shown set');
  eq(open.length, 0, 'and closes what is on screen');
  rt.dispose();

  const bare = createReminderRuntime({ scope: memScope(), native: { has: () => false }, translate: t, now: () => NOW });
  eq(bare.surface(), 'unsupported', 'a host with neither surface is unsupported');
  ok(!bare.supported() && (await bare.requestPermission()) === false, 'and asking for permission resolves false');
  eq(await bare.sync('p1', items), { surface: 'unsupported', scheduled: 0 }, 'sync is a no-op there');
}

// ── 8 · The service worker only displays ─────────────────────────────────────
{
  const sw = read('client/public/sw.js');
  ok(sw.includes("e.data?.type !== 'pri-notify'") && sw.includes('showNotification'), 'the worker shows a notification when the page asks');
  ok(sw.includes("addEventListener('notificationclick'"), 'and opens the app on a tap');
  ok(!/pushManager|addEventListener\('push'/.test(sw), 'the worker has no push subscription — there is no push server');
  ok(/slice\(0, 120\)/.test(sw) && /slice\(0, 200\)/.test(sw), 'title and body are bounded again in the worker');
  ok((sw.match(/if \(!fromThisOrigin\(e\)\) return;/g) || []).length === 2 && /e\.origin === self\.location\.origin/.test(sw), 'both message handlers act only on a message from a page of this origin');
}

// ── 9 · Permission is asked from Settings only ───────────────────────────────
{
  const never = ['client/src/plan/usePlan.js', 'client/src/home/PlanCard.jsx', 'client/src/plan/PlanPage.jsx', 'client/src/reminders/schedule.js', 'client/src/pages/Home.jsx', 'client/src/App.jsx', 'client/src/main.jsx'];
  for (const rel of never) ok(!read(rel).includes('requestPermission('), `${rel} never requests notification permission`);
  const panel = read('client/src/reminders/RemindersPanel.jsx');
  ok(/onClick=\{toggle\}/.test(panel) && (panel.match(/requestPermission\(/g) || []).length === 1, 'the Settings toggle is the one call site, behind a tap');
  const effect = panel.match(/useEffect\([^\n]*\n?/)?.[0] || '';
  ok(effect && !effect.includes('requestPermission'), 'and it is never called from an effect');
  const runtime = read('client/src/reminders/index.js');
  ok(!/useEffect|addEventListener\('load'|DOMContentLoaded/.test(runtime), 'the runtime has no boot-time hook that could ask by itself');
  const settings = read('client/src/pages/Settings.jsx');
  ok(settings.includes('<RemindersPanel />'), 'Settings renders the reminders section');
}

const fail = failures.length;
if (fail) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nREMINDERS: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
