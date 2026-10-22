// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent weekly report
//
// A parent (or guardian) who has confirmed their address gets one email a week
// about the work their child did, and the same report can be read in the app.
// Three rules hold everything here:
//
//   · Only recorded facts. Every number comes from the server grader's own
//     'graded-attempt' rows in learning_events — never from a client-written
//     event, never from a model, never extrapolated. Below the evidence floors
//     (MIN_WEEK_ATTEMPTS, MIN_TOPIC_ATTEMPTS) a field says "not enough data"
//     instead of a guess. Nothing predicts a grade or claims improvement the
//     data does not show; "time practised" is a stated lower bound measured
//     between marked answers, because the server does not record time on task.
//   · Only to a confirmed recipient. Every address is double opt-in: the
//     recipient follows an emailed link before anything is sent. For a child
//     account the recipient must be the guardian who confirmed the account
//     (guardian_consents, state 'given'); a withdrawal stops reports at once.
//     Every report carries a one-click unsubscribe that needs no sign-in.
//   · Only for premium. The entitlement is read from entitlement_snapshots on
//     the server ('advanced-analytics'), at read time and again at send time.
//
// The email is minimal: chapter names, counts and percentages. No question
// text, no answers, no handwriting, no photos, no full name of the child.
//
// The weekly job is idempotent: one parent_report_sends row per (account,
// week), claimed with a lease so two replicas never send the same week twice,
// and the provider call carries an idempotency key derived from that row.
// It runs only where PRI_PARENT_REPORT_EMAILS=on and email is configured.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore, assertNoOpenTransaction } from './store.js';
import { opaqueToken, rateLimit, requireSession, requireVerifiedEmail, sha256 } from './security.js';
import { consentState } from './guardianConsent.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { cleanPublicOrigin, postResendEmail } from './authDelivery.js';
import { decryptDeliveryToken, encryptDeliveryToken } from './deliveryCrypto.js';
import { IN_CHAPTER_BY_ID } from './india-syllabus.generated.js';
import { logEvent, safeCode } from './observability.js';

export const PARENT_REPORT_CAPABILITY = 'advanced-analytics';
export const PARENT_REPORT_FORMAT = 'pri-parent-report-v1';
export const MIN_WEEK_ATTEMPTS = 5;
export const MIN_TOPIC_ATTEMPTS = 3;
export const TREND_WEEKS = 4;
export const STRONG_AT = 0.8;
export const WEAK_BELOW = 0.5;
export const TREND_MARGIN = 0.05;
// A gap longer than this between two marked answers ends a sitting.
export const SITTING_GAP_MS = 15 * 60 * 1000;
// How far back a wrong answer can be and still count as "fixed" this week.
export const MISTAKE_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SEND_ATTEMPTS = 5;
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// India Standard Time has no daylight saving: weeks are Monday 00:00 IST.
const IST_OFFSET_MS = 330 * 60 * 1000;
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// ── Weeks ────────────────────────────────────────────────────────────────────

/** Start (UTC ms) of the IST Monday-to-Sunday week containing `at`. */
export function istWeekStart(at) {
  const local = Number(at) + IST_OFFSET_MS;
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  const weekday = (new Date(dayStart).getUTCDay() + 6) % 7; // Monday = 0
  return dayStart - weekday * DAY_MS - IST_OFFSET_MS;
}

/** The last complete week before `now`: the one a weekly email reports. */
export function lastCompleteWeek(now) {
  const end = istWeekStart(now);
  return { weekStart: end - WEEK_MS, weekEnd: end };
}

function istDay(at) {
  return Math.floor((Number(at) + IST_OFFSET_MS) / DAY_MS);
}

// ── The report: a pure function of recorded attempts ─────────────────────────

/**
 * Normalise a 'graded-attempt' row into the few fields a report reads. Rows
 * the grader did not write, or that are malformed, are dropped — never guessed.
 */
export function attemptFromEvent(row) {
  if (!row || row.kind !== 'graded-attempt' || row.device_id !== 'server-grader') return null;
  let payload;
  try { payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json; } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  const at = Number(row.occurred_at);
  const possible = Number(payload.marksPossible);
  const earned = Number(payload.marksEarned);
  if (!Number.isFinite(at) || !Number.isFinite(possible) || possible <= 0 || !Number.isFinite(earned)) return null;
  return {
    at,
    // The stable identity of the question's content (a keyed digest), so a
    // second go at the same question is recognised even when it is reissued.
    item: String(payload.contentId || payload.questionId || row.entity_id || ''),
    topic: typeof payload.subtopic === 'string' ? payload.subtopic : null,
    correct: payload.correct === true && payload.revealed !== true,
    earned: Math.max(0, Math.min(earned, possible)),
    possible
  };
}

function accuracyOf(list) {
  const possible = list.reduce((sum, a) => sum + a.possible, 0);
  if (!possible) return null;
  return Math.round((list.reduce((sum, a) => sum + a.earned, 0) / possible) * 1000) / 1000;
}

function topicName(id) {
  const chapter = id ? IN_CHAPTER_BY_ID[id] : null;
  return chapter?.name ? String(chapter.name) : null;
}

/**
 * The weekly report for one learner. `attempts` are attemptFromEvent() results
 * from at most MISTAKE_LOOKBACK_MS before `weekEnd` up to `weekEnd`. Pure and
 * deterministic: the same attempts give the same report, byte for byte.
 */
export function buildWeeklyReport(attempts, { weekStart, weekEnd }) {
  const all = attempts.filter(a => a && a.at < weekEnd).sort((x, y) => x.at - y.at || x.item.localeCompare(y.item));
  const week = all.filter(a => a.at >= weekStart);
  const enough = week.length >= MIN_WEEK_ATTEMPTS;

  // Time: sittings are runs of marked answers with gaps under SITTING_GAP_MS.
  // The span of each sitting is a LOWER bound on time practised (the time
  // spent on its first question is not recorded), and is reported as such.
  let sittings = 0, spanMs = 0, sittingStart = null, last = null;
  for (const a of week) {
    if (last === null || a.at - last > SITTING_GAP_MS) {
      if (sittingStart !== null) spanMs += last - sittingStart;
      sittings++;
      sittingStart = a.at;
    }
    last = a.at;
  }
  if (sittingStart !== null) spanMs += last - sittingStart;
  const activeDays = new Set(week.map(a => istDay(a.at))).size;

  // Accuracy, this week and the TREND_WEEKS-1 weeks before it.
  const trendWeeks = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = weekStart - i * WEEK_MS;
    const slice = all.filter(a => a.at >= start && a.at < start + WEEK_MS);
    trendWeeks.push({ weekStart: start, attempts: slice.length, accuracy: slice.length >= MIN_WEEK_ATTEMPTS ? accuracyOf(slice) : null });
  }
  const thisAccuracy = enough ? accuracyOf(week) : null;
  const earlier = trendWeeks.slice(0, -1).filter(w => w.accuracy !== null);
  let direction = 'not-enough-data';
  if (thisAccuracy !== null && earlier.length) {
    const before = earlier.reduce((sum, w) => sum + w.accuracy, 0) / earlier.length;
    direction = thisAccuracy >= before + TREND_MARGIN ? 'up' : thisAccuracy <= before - TREND_MARGIN ? 'down' : 'steady';
  }

  // Topics: only chapters the syllabus names, with MIN_TOPIC_ATTEMPTS this week.
  const byTopic = new Map();
  for (const a of week) {
    if (!topicName(a.topic)) continue;
    if (!byTopic.has(a.topic)) byTopic.set(a.topic, []);
    byTopic.get(a.topic).push(a);
  }
  const topics = [...byTopic.entries()]
    .filter(([, list]) => list.length >= MIN_TOPIC_ATTEMPTS)
    .map(([id, list]) => ({ id, name: topicName(id), attempts: list.length, accuracy: accuracyOf(list) }))
    .sort((x, y) => x.id.localeCompare(y.id));
  const strong = topics.filter(t => t.accuracy >= STRONG_AT).sort((x, y) => y.accuracy - x.accuracy || x.id.localeCompare(y.id)).slice(0, 3);
  const weak = topics.filter(t => t.accuracy < WEAK_BELOW).sort((x, y) => x.accuracy - y.accuracy || x.id.localeCompare(y.id)).slice(0, 3);

  // Mistakes fixed: a question answered wrongly before, then right this week.
  // Still open: a question whose most recent answer (to the week's end) was wrong.
  const wrongBefore = new Map();
  const latest = new Map();
  const fixed = new Set();
  for (const a of all) {
    if (!a.item) continue;
    if (a.correct && a.at >= weekStart && wrongBefore.has(a.item) && wrongBefore.get(a.item) < a.at) fixed.add(a.item);
    if (!a.correct && !wrongBefore.has(a.item)) wrongBefore.set(a.item, a.at);
    latest.set(a.item, a.correct);
  }
  const stillOpen = [...latest.values()].filter(correct => !correct).length;

  // Next week: a plan built only from the above. It never promises a result.
  const plan = [];
  if (!enough) {
    plan.push({ kind: 'start-practising', minimumAttempts: MIN_WEEK_ATTEMPTS });
  } else {
    for (const t of weak.slice(0, 2)) plan.push({ kind: 'revisit-topic', topicId: t.id, name: t.name });
    if (stillOpen > 0) plan.push({ kind: 'fix-mistakes', count: Math.min(stillOpen, 10) });
    plan.push({ kind: 'practise-days', days: Math.max(3, Math.min(5, activeDays + 1)) });
  }

  return {
    format: PARENT_REPORT_FORMAT,
    weekStart,
    weekEnd,
    enoughData: enough,
    minimumAttempts: MIN_WEEK_ATTEMPTS,
    practice: {
      questionsAttempted: week.length,
      questionsCorrect: week.filter(a => a.correct).length,
      activeDays,
      sittings,
      // Null below two answers: one answer has no measurable span.
      minutesAtLeast: week.length >= 2 ? Math.floor(spanMs / 60000) : null
    },
    accuracy: { thisWeek: thisAccuracy, direction, weeks: trendWeeks },
    topics: { strong, weak, measured: topics.length },
    mistakes: { fixed: fixed.size, stillOpen },
    plan
  };
}

// Schema: server/platform/db.js (SQLite, v14) and
// supabase/migrations/20261022000000_parent_report.sql (Postgres).

// ── Who may receive, and whether the account has the feature ─────────────────

export function normaliseRecipient(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_SHAPE.test(email) && email.length <= 254 ? email : null;
}

export async function hasParentReport(db, accountId, now = Date.now()) {
  const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  return serverEntitlementCapabilities(snapshot, now).includes(PARENT_REPORT_CAPABILITY);
}

/**
 * Whether `email` may receive this account's report right now. A child's
 * report goes only to the guardian who confirmed the account, while that
 * consent stands; an adult (or pre-age-basis) account may name any address,
 * which still has to confirm before anything is sent.
 */
export async function recipientDecision(db, accountId, email) {
  const consent = await consentState(db, accountId);
  if (consent.required) {
    if (consent.state !== 'given') return { ok: false, code: 'PARENT_REPORT_CONSENT_REQUIRED' };
    if (String(consent.row?.guardian_email || '').trim().toLowerCase() !== email) return { ok: false, code: 'PARENT_REPORT_RECIPIENT_NOT_GUARDIAN' };
    return { ok: true };
  }
  const account = await db.get('SELECT email FROM accounts WHERE id=?', [accountId]);
  if (String(account?.email || '').trim().toLowerCase() === email) return { ok: false, code: 'PARENT_REPORT_RECIPIENT_IS_LEARNER' };
  return { ok: true };
}

export function maskRecipient(value) {
  const text = String(value || '');
  const at = text.indexOf('@');
  if (at < 1) return null;
  return `${text[0]}${'•'.repeat(Math.max(1, at - 1))}${text.slice(at)}`;
}

/** The recorded attempts a report for the week ending `weekEnd` reads. */
export async function readReportAttempts(db, accountId, weekEnd) {
  const rows = await db.all(`SELECT device_id,kind,entity_id,occurred_at,payload_json FROM learning_events
    WHERE account_id=? AND kind='graded-attempt' AND device_id='server-grader' AND occurred_at>=? AND occurred_at<?
    ORDER BY occurred_at`, [accountId, weekEnd - MISTAKE_LOOKBACK_MS, weekEnd]);
  return rows.map(attemptFromEvent).filter(Boolean);
}

// ── Links and email ─────────────────────────────────────────────────────────

const PAGE_PATH = '/parent/report-email';

export function parentReportActionUrl(publicOrigin, action, rawToken) {
  if (!['confirm', 'unsubscribe'].includes(action)) throw new Error('Unsupported parent report action');
  const token = String(rawToken || '');
  if (!token || token.length > 512) throw new Error('Invalid parent report token');
  const url = new URL(PAGE_PATH, cleanPublicOrigin(publicOrigin));
  url.hash = new URLSearchParams({ action, token }).toString();
  return url.toString();
}

/** RFC 8058 one-click target: a mailbox provider POSTs here, with no cookie or Origin. */
export function parentReportOneClickUrl(publicOrigin, rawToken) {
  const url = new URL('/v1/parent-report/unsubscribe/one-click', cleanPublicOrigin(publicOrigin));
  url.searchParams.set('token', String(rawToken));
  return url.toString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

export function parentReportConfirmMessage(actionUrl) {
  const url = String(actionUrl);
  return {
    subject: 'Confirm weekly Pri Learning reports',
    text: `A Pri Learning account asked to send you a weekly report of the maths practice done on it.\n\nIf you want these reports, confirm here:\n\n${url}\n\nEach report shows how many questions were answered, how many marks were earned, which chapters went well or need another look, and a short plan for the next week. It never includes answers, handwriting or photos. Every report has a link to stop them.\n\nThis link works for 7 days. If you do nothing, no report is sent to you.`,
    html: `<p>A Pri Learning account asked to send you a weekly report of the maths practice done on it.</p><p><a href="${escapeHtml(url)}">Confirm weekly reports</a></p><p>Each report shows how many questions were answered, how many marks were earned, which chapters went well or need another look, and a short plan for the next week. It never includes answers, handwriting or photos. Every report has a link to stop them.</p><p>This link works for 7 days. If you do nothing, no report is sent to you.</p>`
  };
}

function weekLabel(weekStart) {
  const fmt = (at) => new Date(at + IST_OFFSET_MS).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(weekStart)} – ${fmt(weekStart + WEEK_MS - DAY_MS)}`;
}

const pct = (value) => `${Math.round(value * 100)}%`;

/** The report as plain lines: facts first, then the plan. Used for text and HTML. */
export function parentReportLines(report) {
  const lines = [];
  const p = report.practice;
  if (!report.enoughData) {
    lines.push(['Not enough data yet', p.questionsAttempted
      ? `${p.questionsAttempted} marked ${p.questionsAttempted === 1 ? 'answer was' : 'answers were'} recorded this week. A report needs at least ${report.minimumAttempts} before it shows accuracy or topics, so we are not drawing conclusions yet.`
      : `No marked answers were recorded this week, so there is nothing to report yet.`]);
  }
  if (p.questionsAttempted) {
    lines.push(['Practice', `${p.questionsAttempted} questions answered and marked, ${p.questionsCorrect} fully right, on ${p.activeDays} ${p.activeDays === 1 ? 'day' : 'days'}.`]);
    lines.push(['Time practised', p.minutesAtLeast === null
      ? 'Not enough answers to measure.'
      : `At least ${p.minutesAtLeast} ${p.minutesAtLeast === 1 ? 'minute' : 'minutes'} over ${p.sittings} ${p.sittings === 1 ? 'sitting' : 'sittings'} (measured from the first to the last marked answer of each sitting, so real time is higher).`]);
  }
  if (report.enoughData) {
    const a = report.accuracy;
    const trend = { up: 'higher than the weeks before', down: 'lower than the weeks before', steady: 'about the same as the weeks before', 'not-enough-data': 'not enough earlier weeks to compare' }[a.direction];
    lines.push(['Marks earned', `${pct(a.thisWeek)} of available marks — ${trend}.`]);
    const t = report.topics;
    lines.push(['Going well', t.strong.length ? t.strong.map(x => `${x.name} (${pct(x.accuracy)})`).join(', ') : 'No chapter had enough answers to say yet.']);
    lines.push(['Needs another look', t.weak.length ? t.weak.map(x => `${x.name} (${pct(x.accuracy)})`).join(', ') : (t.measured ? 'None this week.' : 'No chapter had enough answers to say yet.')]);
    lines.push(['Mistakes fixed', `${report.mistakes.fixed} earlier ${report.mistakes.fixed === 1 ? 'mistake was' : 'mistakes were'} answered correctly this week; ${report.mistakes.stillOpen} still to fix.`]);
  }
  const plan = report.plan.map(step => {
    if (step.kind === 'start-practising') return `Answer at least ${step.minimumAttempts} questions so next week's report has something to show.`;
    if (step.kind === 'revisit-topic') return `Revisit ${step.name}.`;
    if (step.kind === 'fix-mistakes') return `Try again ${step.count} ${step.count === 1 ? 'question' : 'questions'} answered wrongly before (in Review).`;
    if (step.kind === 'practise-days') return `Practise on ${step.days} days.`;
    return null;
  }).filter(Boolean);
  lines.push(['Next week', plan.join(' ')]);
  return lines;
}

export function parentReportEmailMessage(report, { unsubscribeUrl }) {
  const label = weekLabel(report.weekStart);
  const lines = parentReportLines(report);
  const footer = 'This report counts only answers Pri Learning marked. It is not a prediction of exam results.';
  const stop = `Stop these reports: ${unsubscribeUrl}`;
  return {
    subject: `Pri Learning weekly report · ${label}`,
    text: [`Weekly maths report · ${label}`, '', ...lines.map(([h, body]) => `${h}\n${body}\n`), footer, '', stop].join('\n'),
    html: `<h1 style="font-size:18px">Weekly maths report · ${escapeHtml(label)}</h1>${lines.map(([h, body]) => `<h2 style="font-size:15px;margin:16px 0 4px">${escapeHtml(h)}</h2><p style="margin:0">${escapeHtml(body)}</p>`).join('')}<p style="color:#555;margin-top:20px">${escapeHtml(footer)}</p><p><a href="${escapeHtml(unsubscribeUrl)}">Stop these reports</a></p>`
  };
}

// ── Transport ────────────────────────────────────────────────────────────────

/**
 * The same Resend account and sender as the auth email (authDelivery.js).
 * Null when email is not configured; nothing is ever sent from a test.
 */
export function createParentReportTransportFromEnv({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const provider = String(env.PRI_AUTH_EMAIL_PROVIDER || '').trim().toLowerCase();
  const key = String(env.PRI_RESEND_API_KEY || '').trim();
  const from = String(env.PRI_AUTH_EMAIL_FROM || '').trim();
  if (provider !== 'resend' || !key || !from || typeof fetchImpl !== 'function') return null;
  return async ({ to, message, idempotencyKey, headers = {}, category }) => {
    assertNoOpenTransaction('Sending a parent report email');
    const providerMessageId = await postResendEmail({
      key, fetchImpl, idempotencyKey, requireMessageId: true,
      payload: { from, to: [String(to)], subject: message.subject, text: message.text, html: message.html, headers, tags: [{ name: 'category', value: category }] }
    });
    return { providerMessageId };
  };
}

// ── Recipient actions (no session: the token is the authority) ─────────────

async function issueUnsubscribeToken(db, accountId) {
  const raw = opaqueToken();
  await db.run('UPDATE parent_report_links SET unsubscribe_token_hash=?, unsubscribe_token_envelope=? WHERE account_id=?',
    [sha256(raw), encryptDeliveryToken(raw, `parent-report-unsubscribe:${accountId}`), accountId]);
}

/** Stop by unsubscribe token. Permission-reducing only; idempotent. */
export async function unsubscribeByToken(db, rawToken, now = Date.now()) {
  const raw = String(rawToken || '');
  if (!raw || raw.length > 512) return { ok: false };
  const row = await db.get('SELECT account_id,status FROM parent_report_links WHERE unsubscribe_token_hash=?', [sha256(raw)]);
  if (!row) return { ok: false };
  if (row.status !== 'stopped') {
    await db.run("UPDATE parent_report_links SET status='stopped', stopped_at=?, stopped_by='recipient', confirm_token_hash=NULL WHERE account_id=?", [now, row.account_id]);
  }
  return { ok: true };
}

// ── Routes ───────────────────────────────────────────────────────────────────

const reject = (res, status, code, message) => res.status(status).json({ error: { code, message } });

function linkView(row) {
  if (!row) return { state: 'none', recipient: null };
  return { state: row.status, recipient: maskRecipient(row.recipient_email), requestedAt: Number(row.requested_at), confirmedAt: row.confirmed_at ? Number(row.confirmed_at) : null };
}

/**
 * /v1/parent-report — mounted behind requireGuardianConsent (router.js), so a
 * child whose guardian has not confirmed (or has withdrawn) reaches none of the
 * session routes. The recipient routes take no session and act only through
 * their own single-purpose token.
 */
export function createParentReportRouter(db, { transport = createParentReportTransportFromEnv(), publicOrigin = process.env.PRI_PUBLIC_ORIGIN } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  const session = requireSession(db);

  // The report for the last complete week (and the link state), read in the
  // account's own RLS scope.
  router.get('/', session, async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    if (!(await hasParentReport(db, accountId, now))) return reject(res, 403, 'PARENT_REPORT_PREMIUM_REQUIRED', 'Weekly parent reports are part of Premium.');
    const { weekStart, weekEnd } = lastCompleteWeek(now);
    const { attempts, link } = await db.transaction(async () => ({
      attempts: await readReportAttempts(db, accountId, weekEnd),
      link: await db.get('SELECT status,recipient_email,requested_at,confirmed_at FROM parent_report_links WHERE account_id=?', [accountId])
    }), { readOnly: true, accountScope: String(accountId) });
    res.json({ report: buildWeeklyReport(attempts, { weekStart, weekEnd }), link: linkView(link) });
  });

  // Ask to send reports to an address. It receives a confirmation email and
  // nothing else until the recipient confirms.
  router.post('/link', session, requireVerifiedEmail, rateLimit(db, 'parent-report-link', { limit: 5, windowMs: 24 * 60 * 60 * 1000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    if (!(await hasParentReport(db, accountId, now))) return reject(res, 403, 'PARENT_REPORT_PREMIUM_REQUIRED', 'Weekly parent reports are part of Premium.');
    const email = normaliseRecipient(req.body?.email);
    if (!email) return reject(res, 400, 'PARENT_REPORT_EMAIL_INVALID', 'Enter a valid email address.');
    const decision = await recipientDecision(db, accountId, email);
    if (!decision.ok) {
      const message = {
        PARENT_REPORT_CONSENT_REQUIRED: 'A parent or guardian must confirm this account first.',
        PARENT_REPORT_RECIPIENT_NOT_GUARDIAN: 'Reports can go only to the parent or guardian who confirmed this account.',
        PARENT_REPORT_RECIPIENT_IS_LEARNER: 'Use a parent’s address, not this account’s own.'
      }[decision.code];
      return reject(res, 409, decision.code, message);
    }
    if (!transport) return reject(res, 503, 'PARENT_REPORT_EMAIL_UNAVAILABLE', 'Email is not available right now. Try again later.');
    const raw = opaqueToken();
    await db.run(`INSERT INTO parent_report_links(account_id,recipient_email,status,confirm_token_hash,confirm_expires_at,unsubscribe_token_hash,unsubscribe_token_envelope,requested_at,confirmed_at,stopped_at,stopped_by)
      VALUES (?,?,'pending',?,?,NULL,NULL,?,NULL,NULL,NULL)
      ON CONFLICT(account_id) DO UPDATE SET recipient_email=excluded.recipient_email, status='pending',
        confirm_token_hash=excluded.confirm_token_hash, confirm_expires_at=excluded.confirm_expires_at,
        unsubscribe_token_hash=NULL, unsubscribe_token_envelope=NULL, requested_at=excluded.requested_at,
        confirmed_at=NULL, stopped_at=NULL, stopped_by=NULL`, [accountId, email, sha256(raw), now + CONFIRM_TTL_MS, now]);
    try {
      await transport({ to: email, message: parentReportConfirmMessage(parentReportActionUrl(publicOrigin, 'confirm', raw)),
        idempotencyKey: `pri-parent-report-confirm/${sha256(raw)}`, category: 'parent_report_confirm' });
    } catch (error) {
      logEvent('warn', 'parent_report_confirm_send_failed', { code: safeCode(error?.code, 'SEND_FAILED') });
      return reject(res, 503, 'PARENT_REPORT_EMAIL_UNAVAILABLE', 'The confirmation email could not be sent. Try again later.');
    }
    res.status(202).json({ link: { state: 'pending', recipient: maskRecipient(email), requestedAt: now, confirmedAt: null } });
  });

  // The account stops its own reports.
  router.post('/link/stop', session, async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    await db.run("UPDATE parent_report_links SET status='stopped', stopped_at=?, stopped_by='account', confirm_token_hash=NULL WHERE account_id=? AND status!='stopped'", [now, accountId]);
    const row = await db.get('SELECT status,recipient_email,requested_at,confirmed_at FROM parent_report_links WHERE account_id=?', [accountId]);
    res.json({ link: linkView(row) });
  });

  return router;
}

/** Recipient routes: no session, origin-guarded except the RFC 8058 one-click. */
export function createParentReportRecipientRouter(db) {
  db = asStore(db);
  const router = asyncRouter();

  router.post('/confirm', rateLimit(db, 'parent-report-confirm', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const raw = String(req.body?.token || '');
    if (!raw || raw.length > 512) return reject(res, 400, 'PARENT_REPORT_TOKEN_INVALID', 'This link is not valid.');
    const now = Date.now();
    const row = await db.get("SELECT account_id,recipient_email,confirm_expires_at FROM parent_report_links WHERE confirm_token_hash=? AND status='pending'", [sha256(raw)]);
    if (!row || Number(row.confirm_expires_at) < now) return reject(res, 410, 'PARENT_REPORT_TOKEN_EXPIRED', 'This link has expired or was already used.');
    // The rule is re-checked here: consent can be withdrawn while the email waits.
    const decision = await recipientDecision(db, row.account_id, row.recipient_email);
    if (!decision.ok) return reject(res, 409, decision.code, 'Reports cannot be sent to this address now.');
    const done = await db.run("UPDATE parent_report_links SET status='active', confirmed_at=?, confirm_token_hash=NULL, confirm_expires_at=NULL WHERE account_id=? AND confirm_token_hash=? AND status='pending'",
      [now, row.account_id, sha256(raw)]);
    if (!done.changes) return reject(res, 410, 'PARENT_REPORT_TOKEN_EXPIRED', 'This link has expired or was already used.');
    await issueUnsubscribeToken(db, row.account_id);
    res.json({ confirmed: true });
  });

  router.post('/unsubscribe', rateLimit(db, 'parent-report-unsubscribe', { limit: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const result = await unsubscribeByToken(db, req.body?.token);
    if (!result.ok) return reject(res, 400, 'PARENT_REPORT_TOKEN_INVALID', 'This link is not valid.');
    res.json({ unsubscribed: true });
  });

  // RFC 8058: the mailbox provider POSTs "List-Unsubscribe=One-Click" to the
  // URL in the List-Unsubscribe header. It has no Origin and no cookie, so it
  // is exempt from the origin guard (router.js); the token is its only
  // authority and it can only ever stop reports.
  router.post('/unsubscribe/one-click', rateLimit(db, 'parent-report-unsubscribe', { limit: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const result = await unsubscribeByToken(db, req.query?.token);
    if (!result.ok) return reject(res, 400, 'PARENT_REPORT_TOKEN_INVALID', 'This link is not valid.');
    res.json({ unsubscribed: true });
  });

  return router;
}

// ── The weekly job ───────────────────────────────────────────────────────────

/**
 * Queue and send the last complete week's reports. Safe to run as often as
 * you like, from any number of replicas:
 *   · one row per (account, week) — INSERT … ON CONFLICT DO NOTHING;
 *   · a row is sent only by whoever wins its lease (claimed_until);
 *   · a row marked 'sent' or 'skipped' is never sent again;
 *   · the provider call's idempotency key is the row's identity, so a retry
 *     after a lost response is collapsed by the provider.
 * Eligibility is re-checked at send time: premium, an active confirmed link,
 * and (for a child) the guardian's consent still given to the same address.
 */
export async function runParentReportJob(db, { send, publicOrigin = process.env.PRI_PUBLIC_ORIGIN, now = Date.now(), batchSize = 50 } = {}) {
  db = asStore(db);
  const { weekStart, weekEnd } = lastCompleteWeek(now);
  const queued = await db.run(`INSERT INTO parent_report_sends(account_id,week_start,status,attempts,next_attempt_at,created_at,updated_at)
    SELECT account_id, ?, 'pending', 0, ?, ?, ? FROM parent_report_links WHERE status='active' AND confirmed_at < ?
    ON CONFLICT(account_id, week_start) DO NOTHING`, [weekStart, now, now, now, weekEnd]);
  const due = await db.all(`SELECT account_id,week_start,attempts FROM parent_report_sends
    WHERE status IN ('pending','failed') AND attempts < ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      AND (claimed_until IS NULL OR claimed_until < ?)
    ORDER BY week_start, account_id LIMIT ?`, [MAX_SEND_ATTEMPTS, now, now, batchSize]);
  const result = { weekStart, queued: queued.changes || 0, sent: 0, skipped: 0, failed: 0 };
  for (const row of due) {
    const claim = await db.run(`UPDATE parent_report_sends SET claimed_until=?, updated_at=? WHERE account_id=? AND week_start=?
      AND status IN ('pending','failed') AND (claimed_until IS NULL OR claimed_until < ?)`, [now + CLAIM_LEASE_MS, now, row.account_id, row.week_start, now]);
    if (!claim.changes) continue;
    const outcome = await sendOne(db, row, { send, publicOrigin, now });
    result[outcome]++;
  }
  return result;
}

async function finish(db, row, now, fields) {
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  await db.run(`UPDATE parent_report_sends SET ${sets}, claimed_until=NULL, updated_at=? WHERE account_id=? AND week_start=?`,
    [...Object.values(fields), now, row.account_id, row.week_start]);
}

async function sendOne(db, row, { send, publicOrigin, now }) {
  const accountId = row.account_id;
  const weekStart = Number(row.week_start);
  const link = await db.get('SELECT recipient_email,status,unsubscribe_token_envelope FROM parent_report_links WHERE account_id=?', [accountId]);
  let skip = null;
  if (!link || link.status !== 'active' || !link.unsubscribe_token_envelope) skip = 'not-subscribed';
  else if (!(await hasParentReport(db, accountId, now))) skip = 'not-premium';
  else if (!(await recipientDecision(db, accountId, link.recipient_email)).ok) skip = 'consent';
  if (skip) {
    // A guardian's withdrawal (or a changed guardian) ends the link, not just
    // this week: re-confirming is the only way back.
    if (skip === 'consent') await db.run("UPDATE parent_report_links SET status='stopped', stopped_at=?, stopped_by='consent' WHERE account_id=? AND status='active'", [now, accountId]);
    await finish(db, row, now, { status: 'skipped', skip_reason: skip });
    return 'skipped';
  }
  try {
    const raw = decryptDeliveryToken(link.unsubscribe_token_envelope, `parent-report-unsubscribe:${accountId}`);
    const report = buildWeeklyReport(await readReportAttempts(db, accountId, weekStart + WEEK_MS), { weekStart, weekEnd: weekStart + WEEK_MS });
    const unsubscribeUrl = parentReportActionUrl(publicOrigin, 'unsubscribe', raw);
    const message = parentReportEmailMessage(report, { unsubscribeUrl });
    const { providerMessageId } = await send({
      to: link.recipient_email, message, category: 'parent_report',
      idempotencyKey: `pri-parent-report/${accountId}/${weekStart}`,
      headers: { 'List-Unsubscribe': `<${parentReportOneClickUrl(publicOrigin, raw)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    });
    await finish(db, row, now, { status: 'sent', sent_at: now, attempts: Number(row.attempts) + 1, provider_message_id: providerMessageId || null, last_error_code: null });
    return 'sent';
  } catch (error) {
    const attempts = Number(row.attempts) + 1;
    await finish(db, row, now, { status: 'failed', attempts, last_error_code: safeCode(error?.code, 'SEND_FAILED'),
      next_attempt_at: now + Math.min(6 * 60 * 60 * 1000, 15 * 60 * 1000 * 2 ** (attempts - 1)) });
    return 'failed';
  }
}

export const PARENT_REPORT_INTERVAL_MS = 60 * 60 * 1000;

/** Hourly, and only where PRI_PARENT_REPORT_EMAILS=on and email is configured. */
export function startParentReportWorker(db, { env = process.env, send = createParentReportTransportFromEnv({ env }), intervalMs = PARENT_REPORT_INTERVAL_MS } = {}) {
  if (String(env.PRI_PARENT_REPORT_EMAILS || '').trim() !== 'on' || typeof send !== 'function') return { enabled: false, stop() {} };
  let stopped = false, running = false;
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await runParentReportJob(db, { send, publicOrigin: env.PRI_PUBLIC_ORIGIN });
      if (result.failed) logEvent('warn', 'parent_report_failed', { count: result.failed });
    } catch (error) {
      logEvent('error', 'parent_report_worker_error', { code: safeCode(error?.code, 'WORKER_ERROR') });
    } finally { running = false; }
  };
  void run();
  const timer = setInterval(() => { void run(); }, Math.max(60_000, Number(intervalMs) || PARENT_REPORT_INTERVAL_MS));
  timer.unref?.();
  return { enabled: true, stop() { stopped = true; clearInterval(timer); } };
}
