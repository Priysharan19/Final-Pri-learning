// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent weekly report
//
// What this suite holds (deterministic: fixed clocks, an in-memory transport,
// nothing leaves the process):
//
//   1 · the report is a pure function of the grader's own recorded attempts:
//       client-written events and malformed rows are ignored; below the
//       evidence floors it says "not enough data" instead of guessing; time is
//       a stated lower bound; the same input gives the same output;
//   2 · weeks are IST Monday-to-Sunday, and the email reports the last
//       complete one;
//   3 · server authorization: premium is checked on the server; a child's
//       report can go only to the guardian whose consent is given; a pending
//       guardian blocks the routes; one account never sees another's report;
//   4 · double opt-in: nothing but a confirmation email is sent until the
//       recipient confirms; the token is single-use and expires;
//   5 · the weekly job is idempotent (one send per account and week, however
//       often and from however many runs), carries RFC 8058 unsubscribe
//       headers, and re-checks premium and consent at send time;
//   6 · unsubscribe works from the page and as a one-click POST with no
//       Origin or cookie, and can only ever stop reports;
//   7 · the email carries no question ids, answers, ink or the child's name;
//   8 · deleting the account deletes its link and send ledger.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import {
  MIN_WEEK_ATTEMPTS, attemptFromEvent, buildWeeklyReport, istWeekStart, lastCompleteWeek,
  parentReportEmailMessage, parentReportLines, runParentReportJob
} from '../platform/parentReport.js';
import { CONSENT_NOTICE_VERSION } from '../platform/guardianConsent.js';
import { checks, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const WEEK = 7 * DAY;

// ── 2 · Weeks ────────────────────────────────────────────────────────────────
// 2026-10-19 is a Monday. 00:00 IST that day is 2026-10-18T18:30Z.
const MONDAY = Date.parse('2026-10-18T18:30:00Z');
c.eq(istWeekStart(MONDAY), MONDAY, 'Monday 00:00 IST starts its own week');
c.eq(istWeekStart(MONDAY - 1), MONDAY - WEEK, 'one millisecond earlier is the previous week (Sunday 23:59 IST)');
c.eq(istWeekStart(MONDAY + 3 * DAY + 5 * 60 * MIN), MONDAY, 'Thursday belongs to the week that started on Monday');
c.deq(lastCompleteWeek(MONDAY + 2 * DAY), { weekStart: MONDAY - WEEK, weekEnd: MONDAY }, 'the email reports the last complete week');

// ── 1 · The report ───────────────────────────────────────────────────────────
const TOPIC_A = 'c10-arithmetic-progressions';
const TOPIC_B = 'c10-circles';
const row = (at, payload, extra = {}) => ({ kind: 'graded-attempt', device_id: 'server-grader', entity_id: payload.questionId || 'q', occurred_at: at, payload_json: JSON.stringify(payload), ...extra });
const attempt = (at, { item, topic = TOPIC_A, correct, earned, possible = 2, revealed = false }) =>
  row(at, { questionId: `q-${item}-${at}`, contentId: item, subtopic: topic, correct, marksEarned: earned ?? (correct ? possible : 0), marksPossible: possible, ...(revealed ? { revealed: true } : {}) });

c.eq(attemptFromEvent(row(1, { correct: true, marksEarned: 1, marksPossible: 1 }, { device_id: 'ipad-1' })), null, 'a client-written event is never read as a mark');
c.eq(attemptFromEvent(row(1, { correct: true, marksEarned: 1, marksPossible: 1 }, { kind: 'practice-attempt' })), null, 'nor is any kind but graded-attempt');
c.eq(attemptFromEvent({ kind: 'graded-attempt', device_id: 'server-grader', occurred_at: 1, payload_json: '{not json' }), null, 'a malformed row is dropped, not guessed');
c.eq(attemptFromEvent(row(1, { correct: true, marksEarned: 1, marksPossible: 0 })), null, 'a row with no possible marks is dropped');
c.eq(attemptFromEvent(row(1, { correct: true, revealed: true, marksEarned: 0, marksPossible: 2 })).correct, false, 'a revealed answer is never counted as right');

const W = { weekStart: MONDAY, weekEnd: MONDAY + WEEK };
const empty = buildWeeklyReport([], W);
c.eq(empty.enoughData, false, 'no attempts: not enough data');
c.deq([empty.practice.questionsAttempted, empty.practice.minutesAtLeast, empty.accuracy.thisWeek, empty.accuracy.direction], [0, null, null, 'not-enough-data'], 'and every measure says so rather than showing a zero rate');
c.deq(empty.plan, [{ kind: 'start-practising', minimumAttempts: MIN_WEEK_ATTEMPTS }], 'the plan asks for practice, and promises nothing');
c.ok(parentReportLines(empty).some(([h]) => h === 'Not enough data yet'), 'the email states "not enough data yet" honestly');

const few = buildWeeklyReport([attempt(MONDAY + 10 * MIN, { item: 'x', correct: true }), attempt(MONDAY + 12 * MIN, { item: 'y', correct: true })].map(attemptFromEvent), W);
c.deq([few.enoughData, few.accuracy.thisWeek, few.topics.strong], [false, null, []], 'two right answers are not "100% accuracy": below the floor nothing is concluded');
c.eq(few.practice.minutesAtLeast, 2, 'but the recorded practice is still shown');

// A real week: 3 earlier weeks for the trend, a mistake fixed, two topics.
const events = [];
for (let w = 1; w <= 3; w++) {
  for (let i = 0; i < 5; i++) events.push(attempt(MONDAY - w * WEEK + DAY + i * MIN, { item: `old-${w}-${i}`, correct: i < 2 }));
}
events.push(attempt(MONDAY - 2 * WEEK + 2 * DAY, { item: 'fix-me', correct: false }));
// This week: Monday sitting (10 min), Wednesday sitting (6 min).
const mon = MONDAY + 9 * 60 * MIN;
events.push(attempt(mon, { item: 'a1', correct: true }));
events.push(attempt(mon + 4 * MIN, { item: 'a2', correct: true }));
events.push(attempt(mon + 8 * MIN, { item: 'fix-me', correct: true }));
events.push(attempt(mon + 10 * MIN, { item: 'a3', correct: true }));
const wed = MONDAY + 2 * DAY + 18 * 60 * MIN;
events.push(attempt(wed, { item: 'b1', topic: TOPIC_B, correct: false }));
events.push(attempt(wed + 3 * MIN, { item: 'b2', topic: TOPIC_B, correct: false, earned: 1 }));
events.push(attempt(wed + 6 * MIN, { item: 'b3', topic: TOPIC_B, correct: false }));
events.push(attempt(wed + 7 * MIN, { item: 'z', topic: 'not-a-real-chapter', correct: true }));
events.push(attempt(MONDAY + WEEK + MIN, { item: 'next-week', correct: false }));
events.push(row(mon + MIN, { correct: true, marksEarned: 50, marksPossible: 50, subtopic: TOPIC_B }, { device_id: 'ipad-forged' }));
const parsed = events.map(attemptFromEvent).filter(Boolean);
const report = buildWeeklyReport(parsed, W);
c.eq(report.enoughData, true, 'eight graded answers this week is enough');
c.deq([report.practice.questionsAttempted, report.practice.questionsCorrect, report.practice.activeDays, report.practice.sittings], [8, 5, 2, 2], 'counts come only from this week\'s graded rows (the forged client row and next week\'s are ignored)');
c.eq(report.practice.minutesAtLeast, 17, 'time is the sum of sitting spans (10 + 7 min): a stated lower bound');
c.eq(report.accuracy.thisWeek, 0.688, 'accuracy is marks earned over marks possible (11 / 16)');
c.deq(report.accuracy.weeks.map(w => w.accuracy), [0.4, 0.333, 0.4, 0.688], 'the trend reads each recorded week (week -2 has its sixth, wrong answer)');
c.eq(report.accuracy.direction, 'up', 'and is called up only by the stated margin over the earlier weeks');
c.deq(report.topics.strong.map(t => [t.id, t.accuracy]), [[TOPIC_A, 1]], 'a topic is strong with ≥3 answers at ≥80%');
c.deq(report.topics.weak.map(t => [t.id, t.name, t.accuracy]), [[TOPIC_B, 'Circles', 0.167]], 'a topic is weak below 50%, named from the syllabus');
c.ok(!JSON.stringify(report).includes('not-a-real-chapter'), 'an unknown chapter id is never shown');
c.deq(report.mistakes, { fixed: 1, stillOpen: 12 }, 'a question wrong before and right this week is one mistake fixed; still-open counts each question whose latest answer was wrong');
c.deq(report.plan, [
  { kind: 'revisit-topic', topicId: TOPIC_B, name: 'Circles' },
  { kind: 'fix-mistakes', count: 10 },
  { kind: 'practise-days', days: 3 }
], 'the plan is built only from the week\'s facts');
c.eq(JSON.stringify(buildWeeklyReport([...parsed].reverse(), W)), JSON.stringify(report), 'deterministic: input order does not change a byte');

// A fix undone later in the week is not a fix; a mistake made this week and
// put right this week is not an "earlier" mistake.
const undone = buildWeeklyReport([
  attempt(MONDAY - DAY, { item: 'u', correct: false }), attempt(MONDAY + MIN, { item: 'u', correct: true }), attempt(MONDAY + 2 * MIN, { item: 'u', correct: false }),
  attempt(MONDAY + 3 * MIN, { item: 'v', correct: false }), attempt(MONDAY + 4 * MIN, { item: 'v', correct: true }),
  ...['w1', 'w2', 'w3'].map((item, i) => attempt(MONDAY + (5 + i) * MIN, { item, correct: true }))
].map(attemptFromEvent), W);
c.deq(undone.mistakes, { fixed: 0, stillOpen: 1 }, 'a fix undone later in the week, or a same-week slip put right, is not counted as an earlier mistake fixed');

// Chapters measured, none strong: the email must not say "not enough answers".
const middling = buildWeeklyReport(['m1', 'm2', 'm3', 'm4', 'm5'].map((item, i) => attemptFromEvent(attempt(MONDAY + i * MIN, { item, correct: i < 3 }))), W);
c.ok(parentReportLines(middling).some(([h, body]) => h === 'Going well' && body === 'No chapter reached 80% this week.'), 'measured chapters that fell short are described as such, not as missing data');

const flat = buildWeeklyReport([...Array(6)].map((_, i) => attemptFromEvent(attempt(MONDAY + DAY + i * MIN, { item: `f${i}`, correct: i < 3 }))), W);
c.eq(flat.accuracy.direction, 'not-enough-data', 'with no earlier week on record there is no trend to claim');

const mail = parentReportEmailMessage(report, { unsubscribeUrl: 'https://pri.example.test/parent/report-email#action=unsubscribe&token=T' });
c.match(mail.subject, /^Pri Learning weekly report · 19 Oct – 25 Oct$/, 'the subject names the IST week');
c.ok(mail.text.includes('At least 17 minutes') && mail.text.includes('real time is higher'), 'the email states time as a lower bound');
c.ok(mail.text.includes('not a prediction of exam results'), 'and says what it is not');
c.ok(!/q-a1|fix-me|a1|server-grader/.test(mail.text + mail.html), 'no question or content id reaches the email');

// ── 3–8 · Over HTTP and through the job ──────────────────────────────────────
const sent = [];
let failNext = false;
const transport = async (message) => {
  if (failNext) { failNext = false; throw Object.assign(new Error('down'), { code: 'RESEND_UNAVAILABLE' }); }
  sent.push(message);
  return { providerMessageId: `msg-${sent.length}` };
};
const ORIGIN = 'https://pri.example.test';
const h = await startApp({ engine: requestedEngine(), parentReport: { transport, publicOrigin: ORIGIN } });
const db = asStore(h.db);
const post = (path, body, jar) => h.request(path, { method: 'POST', body, jar, headers: { Origin: ORIGIN } });
const tokenFrom = (url) => new URLSearchParams(new URL(url).hash.slice(1)).get('token');
const linkOf = (message) => message.message.text.match(/https:\/\/\S+/)[0];

try {
  const now = Date.now();
  async function student(email, { child = false, premium = true, guardian = 'parent@example.test', consent = 'given' } = {}) {
    const r = await registerAccount(h, { email, name: 'Asha Verma' });
    const id = r.account.id;
    await verifyEmail(h, id);
    if (child) {
      await db.run("UPDATE accounts SET age_basis='child' WHERE id=?", [id]);
      await db.run('INSERT INTO guardian_consents(account_id,guardian_name,guardian_email,notice_version,requested_at,confirmed_at,method) VALUES (?,?,?,?,?,?,?)',
        [id, 'Parent', guardian, CONSENT_NOTICE_VERSION, now, consent === 'given' ? now : null, 'guardian-email-confirmation']);
    }
    if (premium) await db.run("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,'premium','active','web',?,?) ON CONFLICT(account_id) DO UPDATE SET plan='premium',status='active',current_period_end=excluded.current_period_end",
      [id, now + 30 * DAY, now]);
    return { id, jar: r.jar };
  }

  // Premium is the server's decision.
  const free = await student('free@example.test', { premium: false });
  c.eq((await h.request('/v1/parent-report', { jar: free.jar })).data?.error?.code, 'PARENT_REPORT_PREMIUM_REQUIRED', 'a free account cannot read the report');
  c.eq((await post('/v1/parent-report/link', { email: 'p@example.test' }, free.jar)).data?.error?.code, 'PARENT_REPORT_PREMIUM_REQUIRED', 'nor link a parent');
  c.eq((await h.request('/v1/parent-report')).status, 401, 'no session, no report');

  // A child whose guardian has not confirmed reaches none of it.
  const pending = await student('pending@example.test', { child: true, consent: 'pending' });
  c.eq((await h.request('/v1/parent-report', { jar: pending.jar })).data?.error?.code, 'GUARDIAN_CONSENT_PENDING', 'a child without guardian consent is stopped at the guardian gate');

  // A child with consent: only the consenting guardian may receive.
  const kid = await student('kid@example.test', { child: true, guardian: 'parent@example.test' });
  c.eq((await post('/v1/parent-report/link', { email: 'stranger@example.test' }, kid.jar)).data?.error?.code, 'PARENT_REPORT_RECIPIENT_NOT_GUARDIAN', 'a child cannot send their report to anyone but their guardian');
  c.eq((await post('/v1/parent-report/link', { email: 'nope' }, kid.jar)).data?.error?.code, 'PARENT_REPORT_EMAIL_INVALID', 'an invalid address is refused');
  c.eq(sent.length, 0, 'nothing was emailed for a refused link');
  const linked = await post('/v1/parent-report/link', { email: ' Parent@Example.test ' }, kid.jar);
  c.deq([linked.status, linked.data.link.state, linked.data.link.recipient], [202, 'pending', 'p•••••@example.test'], 'the guardian is asked, and the address comes back masked');
  c.deq([sent.length, sent[0].to, sent[0].category], [1, 'parent@example.test', 'parent_report_confirm'], 'exactly one confirmation email goes to the guardian');
  const confirmToken = tokenFrom(linkOf(sent[0]));
  c.ok(linkOf(sent[0]).startsWith(`${ORIGIN}/parent/report-email#`), 'the token travels in the URL fragment');
  c.eq((await db.get('SELECT confirm_token_hash FROM parent_report_links WHERE account_id=?', [kid.id])).confirm_token_hash === confirmToken, false, 'only the token\'s hash is stored');

  // An adult names any address except their own.
  const adult = await student('adult@example.test');
  c.eq((await post('/v1/parent-report/link', { email: 'adult@example.test' }, adult.jar)).data?.error?.code, 'PARENT_REPORT_RECIPIENT_IS_LEARNER', 'a learner cannot be their own parent recipient');

  // Before confirming, the job sends nothing.
  const NEXT = istWeekStart(now) + WEEK + DAY;
  c.eq((await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT })).queued, 0, 'an unconfirmed link queues no report');

  // Confirm.
  c.eq((await post('/v1/parent-report/confirm', { token: 'wrong' })).status, 410, 'a wrong token confirms nothing');
  c.eq((await post('/v1/parent-report/confirm', { token: confirmToken })).data?.confirmed, true, 'the guardian confirms from their own device, with no session');
  c.eq((await post('/v1/parent-report/confirm', { token: confirmToken })).status, 410, 'the confirmation link is single-use');

  c.ok(!!(await db.get('SELECT unsubscribe_token_envelope FROM parent_report_links WHERE account_id=?', [kid.id])).unsubscribe_token_envelope, 'confirmation writes the stop link in the same update: an active link always has one');

  // Some graded work this week.
  for (let i = 0; i < 6; i++) {
    await db.run(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
      VALUES (?,?,?,'server-grader',?,'graded-attempt',?,?,?,?)`, [100 + i, `ev-${i}`, kid.id, i + 1, `q-${i}`, now - i * MIN,
      JSON.stringify({ questionId: `q-${i}`, contentId: `c-${i}`, subtopic: TOPIC_A, correct: i % 2 === 0, marksEarned: i % 2 === 0 ? 2 : 0, marksPossible: 2 }), now]);
  }
  const view = await h.request('/v1/parent-report', { jar: kid.jar });
  c.deq([view.status, view.data.link.state, view.data.report.format], [200, 'active', 'pri-parent-report-v1'], 'the account reads its own report and link state');
  c.eq((await h.request('/v1/parent-report', { jar: adult.jar })).data.report.practice.questionsAttempted, 0, 'another account sees none of it');

  // The job: once per account and week, with unsubscribe headers.
  const first = await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT });
  c.deq([first.queued, first.sent], [1, 1], 'the job queues and sends the confirmed link\'s report');
  const weekly = sent.at(-1);
  c.deq([weekly.to, weekly.category, weekly.idempotencyKey], ['parent@example.test', 'parent_report', `pri-parent-report/${kid.id}/${istWeekStart(now)}`], 'to the guardian, keyed by account and week');
  c.match(weekly.headers['List-Unsubscribe'], /^<https:\/\/pri\.example\.test\/v1\/parent-report\/unsubscribe\/one-click\?token=[A-Za-z0-9_-]+>$/, 'with a one-click List-Unsubscribe URL');
  c.eq(weekly.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click', 'and the RFC 8058 marker');
  c.ok(weekly.message.text.includes('6 answers marked'), 'the email carries the recorded counts');
  c.ok(!/Asha|Verma|kid@example|q-0|c-0/.test(weekly.message.text + weekly.message.html), 'and not the child\'s name, address or any question id');
  const again = await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + 2 * 60 * MIN });
  c.deq([again.queued, again.sent, sent.filter(m => m.category === 'parent_report').length], [0, 0, 1], 'running again sends nothing more: idempotent');

  // A failed send retries with backoff and still sends once.
  const kid2 = await student('kid2@example.test', { child: true, guardian: 'mum@example.test' });
  await post('/v1/parent-report/link', { email: 'mum@example.test' }, kid2.jar);
  await post('/v1/parent-report/confirm', { token: tokenFrom(linkOf(sent.at(-1))) });
  failNext = true;
  const failing = await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT });
  c.deq([failing.sent, failing.failed], [0, 1], 'a provider failure is recorded, not lost');
  c.eq((await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + MIN })).sent, 0, 'and is not retried before its backoff');
  c.eq((await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + 20 * MIN })).sent, 1, 'then is sent once');

  // Consent withdrawn: skipped at send time, and the link ends.
  await db.run('UPDATE guardian_consents SET withdrawn_at=? WHERE account_id=?', [now, kid2.id]);
  const after = await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + WEEK });
  const kid2Row = await db.get('SELECT status,skip_reason FROM parent_report_sends WHERE account_id=? AND week_start=?', [kid2.id, istWeekStart(now) + WEEK]);
  c.deq([kid2Row.status, kid2Row.skip_reason], ['skipped', 'consent'], 'a withdrawn guardian is never emailed again');
  c.eq((await db.get('SELECT stopped_by FROM parent_report_links WHERE account_id=?', [kid2.id])).stopped_by, 'consent', 'and the link is stopped, not paused');

  // Premium lapses: skipped.
  await db.run("UPDATE entitlement_snapshots SET status='expired' WHERE account_id=?", [kid.id]);
  const lapsed = await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + 2 * WEEK });
  c.eq((await db.get('SELECT skip_reason FROM parent_report_sends WHERE account_id=? AND week_start=?', [kid.id, istWeekStart(now) + 2 * WEEK])).skip_reason, 'not-premium', 'premium is re-checked at send time');
  c.eq(after.sent + lapsed.sent, 1, 'only kid\'s second week (still premium) was sent');
  await db.run("UPDATE entitlement_snapshots SET status='active' WHERE account_id=?", [kid.id]);

  // One-click unsubscribe: no Origin, no cookie — with the origin policy ON.
  process.env.PRI_PUBLIC_ORIGIN = ORIGIN;
  const oneClick = new URL(weekly.headers['List-Unsubscribe'].slice(1, -1));
  const bad = await h.request(`/v1/parent-report/unsubscribe/one-click?token=forged`, { method: 'POST', body: { 'List-Unsubscribe': 'One-Click' } });
  c.eq(bad.status, 400, 'a forged one-click token stops nothing');
  let limited = 0;
  for (let i = 0; i < 40; i++) if ((await h.request('/v1/parent-report/unsubscribe/one-click?token=forged', { method: 'POST', body: {} })).status === 429) limited++;
  c.eq(limited, 0, 'one-click has its own wide bucket: a mailbox provider sending many from one address is not refused');
  const stop = await h.request(`${oneClick.pathname}${oneClick.search}`, { method: 'POST', body: { 'List-Unsubscribe': 'One-Click' } });
  c.deq([stop.status, stop.data?.unsubscribed], [200, true], 'the mailbox provider\'s one-click POST unsubscribes with no Origin or cookie');
  c.eq((await h.request('/v1/parent-report/unsubscribe', { method: 'POST', body: { token: oneClick.searchParams.get('token') } })).status, 403, 'the page route still requires the product origin');
  c.deq((await db.get('SELECT status,stopped_by FROM parent_report_links WHERE account_id=?', [kid.id])), { status: 'stopped', stopped_by: 'recipient' }, 'the link is stopped by the recipient');
  c.eq((await runParentReportJob(db, { send: transport, publicOrigin: ORIGIN, now: NEXT + 3 * WEEK })).queued, 0, 'an unsubscribed parent gets nothing more');
  c.eq((await post('/v1/parent-report/unsubscribe', { token: oneClick.searchParams.get('token') })).data?.unsubscribed, true, 'unsubscribing twice is harmless');

  delete process.env.PRI_PUBLIC_ORIGIN;

  // A run whose lease ran out cannot overwrite the outcome of the run that took over.
  const fenced = await student('fenced@example.test', { child: true, guardian: 'fence@example.test' });
  await post('/v1/parent-report/link', { email: 'fence@example.test' }, fenced.jar);
  await post('/v1/parent-report/confirm', { token: tokenFrom(linkOf(sent.at(-1))) });
  const slowNow = NEXT + 5 * WEEK;
  await db.run('UPDATE entitlement_snapshots SET current_period_end=? WHERE account_id=?', [slowNow + WEEK, fenced.id]);
  const slow = async (message) => { await db.run('UPDATE parent_report_sends SET claimed_until=? WHERE account_id=?', [slowNow + 999, fenced.id]); return transport(message); };
  await runParentReportJob(db, { send: slow, publicOrigin: ORIGIN, now: slowNow });
  c.deq(await db.get('SELECT status,claimed_until FROM parent_report_sends WHERE account_id=? AND week_start=?', [fenced.id, istWeekStart(slowNow) - WEEK]),
    { status: 'pending', claimed_until: slowNow + 999 }, 'a stale lease holder\'s finish is fenced out (the newer claim stands)');

  // The account stops its own link.
  const adultLink = await post('/v1/parent-report/link', { email: 'dad@example.test' }, adult.jar);
  c.eq(adultLink.status, 202, 'an adult links a parent');
  c.eq((await post('/v1/parent-report/link/stop', {}, adult.jar)).data.link.state, 'stopped', 'and can stop it');
  c.eq((await post('/v1/parent-report/confirm', { token: tokenFrom(linkOf(sent.at(-1))) })).status, 410, 'a stopped link\'s confirmation no longer works');

  // Expired confirmation.
  const late = await student('late@example.test');
  await post('/v1/parent-report/link', { email: 'late.parent@example.test' }, late.jar);
  await db.run('UPDATE parent_report_links SET confirm_expires_at=? WHERE account_id=?', [now - 1, late.id]);
  c.eq((await post('/v1/parent-report/confirm', { token: tokenFrom(linkOf(sent.at(-1))) })).status, 410, 'an expired confirmation link confirms nothing');

  // Deletion cascades.
  await db.run('DELETE FROM accounts WHERE id=?', [kid.id]);
  c.deq([(await db.get('SELECT COUNT(*) AS n FROM parent_report_links WHERE account_id=?', [kid.id])).n, (await db.get('SELECT COUNT(*) AS n FROM parent_report_sends WHERE account_id=?', [kid.id])).n].map(Number), [0, 0], 'deleting the account deletes its link and send ledger');

  console.log(`engine: ${h.engine}`);
  console.log(`parent-report-check (${h.engine}): ${c.count()} checks passed`);
} finally {
  await h.close();
}
