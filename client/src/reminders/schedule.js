// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reminder schedule
//
// When to nudge, computed from three things the app already knows: the FSRS
// rows that fall due, the planned session for each day of the study plan, and
// whether today's streak is still unprotected in the evening. One pure
// function, no clock of its own, no network.
//
// Privacy is structural. A reminder carries catalogue keys and counts — "3
// reviews due", "a 25-minute session" — and never a chapter name, a question,
// a mark or a score. The text a student sees on the lock screen says that
// there is work, not what the work is.
// ─────────────────────────────────────────────────────────────────────────────
import { dayKey } from '../lib/locale.js';
import { addDays } from '../plan/studyPlan.js';

export const REMINDER_HORIZON_DAYS = 7;
export const REMINDERS_PER_DAY = 2;
export const MAX_REMINDERS = 14;
export const DEFAULT_STREAK_HOUR = 20;

/** Catalogue keys per kind — a table so the i18n suite sees every key reached. */
export const REMINDER_COPY = Object.freeze({
  session: { title: 'reminders.session.title', body: 'reminders.session.body', url: '/plan' },
  sessionReviews: { title: 'reminders.session.title', body: 'reminders.session.bodyReviews', url: '/plan' },
  reviews: { title: 'reminders.reviews.title', body: 'reminders.reviews.body', url: '/practice' },
  streak: { title: 'reminders.streak.title', body: 'reminders.streak.body', url: '/practice' }
});

// ── Wall clock → instant ─────────────────────────────────────────────────────
// A reminder is "5 pm on Tuesday" in the student's own zone. Intl gives the
// zone's wall clock for an instant; the inverse is found by guessing the UTC
// instant and correcting by the offset the zone reports there, twice, so a
// day on which the clocks change still lands on the right hour.
function offsetMinutes(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(new Date(ms));
  const get = type => Number(parts.find(p => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((wall - ms) / 60_000);
}

export function zonedMs(date, hour, tz) {
  const [y, m, d] = String(date).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  let instant = guess - offsetMinutes(guess, tz) * 60_000;
  instant = guess - offsetMinutes(instant, tz) * 60_000;
  return instant;
}

// ── The schedule ─────────────────────────────────────────────────────────────

/**
 * computeReminders({ now, timezone, settings, plan, reviews, streak, attemptedToday })
 *
 *   settings.enabled      the master switch; off gives [] whatever else is set
 *   settings.sessionHour  the hour the planned session is announced (5–22)
 *   settings.streakHour   the evening hour a streak at risk is announced
 *   plan                  a study plan (its days give the planned minutes)
 *   reviews               FSRS rows [{ dueAt }] (or /reviews rows, due_at)
 *   streak                the current streak; 0 means nothing to protect
 *   attemptedToday        true drops today's streak nudge
 *
 * Returns items sorted by time: { id, kind, date, at, title, body, vars, url }
 * where title/body are catalogue keys and vars holds only counts.
 */
export function computeReminders({
  now = Date.now(), timezone = 'Asia/Kolkata', settings = {}, plan = null, reviews = [],
  streak = 0, attemptedToday = false, horizonDays = REMINDER_HORIZON_DAYS
} = {}) {
  if (settings?.enabled !== true) return [];
  const sessionHour = Number.isInteger(settings.sessionHour) && settings.sessionHour >= 5 && settings.sessionHour <= 22 ? settings.sessionHour : 17;
  const streakHour = Number.isInteger(settings.streakHour) && settings.streakHour >= 12 && settings.streakHour <= 23 ? settings.streakHour : DEFAULT_STREAK_HOUR;
  const today = dayKey(now, timezone);
  const days = new Map((plan?.weeks || []).flatMap(w => w.days || []).map(d => [d.date, d]));
  const dueTimes = (reviews || []).map(r => Number(r?.dueAt ?? r?.due_at)).filter(v => Number.isFinite(v) && v > 0);
  const items = [];

  for (let i = 0; i < Math.max(1, Math.min(horizonDays, REMINDER_HORIZON_DAYS)); i++) {
    const date = addDays(today, i);
    const day = days.get(date) || null;
    const sessionAt = zonedMs(date, sessionHour, timezone);
    const dueCount = dueTimes.filter(t => t <= sessionAt).length;
    const planned = day && !day.rest ? day.sessions?.length || 0 : 0;

    if (sessionAt > now) {
      if (planned) {
        const copy = dueCount ? REMINDER_COPY.sessionReviews : REMINDER_COPY.session;
        items.push({ id: `${date}:session`, kind: 'session', date, at: sessionAt, title: copy.title, body: copy.body, url: copy.url,
          vars: { minutes: day.minutes, n: dueCount, count: dueCount } });
      } else if (dueCount) {
        const copy = REMINDER_COPY.reviews;
        items.push({ id: `${date}:reviews`, kind: 'reviews', date, at: sessionAt, title: copy.title, body: copy.body, url: copy.url,
          vars: { n: dueCount, count: dueCount } });
      }
    }

    // The streak nudge is an evening safety net: only when there is a streak to
    // lose, and never once today's question has been answered. Tomorrow's is
    // scheduled now and withdrawn the moment the app is opened and sees an
    // attempt, which is how a device with no push server stays correct.
    if (streak > 0 && !(i === 0 && attemptedToday)) {
      const at = zonedMs(date, streakHour, timezone);
      if (at > now && at > sessionAt) {
        const copy = REMINDER_COPY.streak;
        items.push({ id: `${date}:streak`, kind: 'streak', date, at, title: copy.title, body: copy.body, url: copy.url,
          vars: { n: streak, count: streak } });
      }
    }
  }

  const perDay = new Map();
  return items
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .filter(item => {
      const n = perDay.get(item.date) || 0;
      if (n >= REMINDERS_PER_DAY) return false;
      perDay.set(item.date, n + 1);
      return true;
    })
    .slice(0, MAX_REMINDERS);
}

/**
 * The payload handed to a notification surface: translated title and body,
 * the instant, and the in-app route to open. `lookup` is the catalogue
 * function; nothing but keys and counts ever reaches it, so the rendered text
 * cannot name a chapter or a mark.
 */
export function renderReminder(item, lookup) {
  const vars = {};
  for (const [k, v] of Object.entries(item?.vars || {})) if (typeof v === 'number' && Number.isFinite(v)) vars[k] = v;
  return {
    id: String(item.id).slice(0, 64),
    at: Math.round(item.at),
    title: String(lookup(item.title, vars)).slice(0, 120),
    body: String(lookup(item.body, vars)).slice(0, 200),
    url: /^\/[a-z-]*$/.test(String(item.url || '')) ? item.url : '/'
  };
}
