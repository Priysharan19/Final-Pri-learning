// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Locale, timezone and formatting for a profile.
//
// One place decides what "today" means for a student and how a date, a number
// or a price is written. An Indian profile lives in Asia/Kolkata and reads
// en-IN with the rupee sign; the legacy Australian profiles keep
// Australia/Sydney and en-AU. A profile may carry its own IANA timezone, which
// wins over the course default — a Class 12 student in Dubai is still an
// Indian student, but their day ends when their day ends.
//
// Pure functions only: nothing here touches storage or the network, so the
// local backend, the pages and the Node test suites all share it.
// ─────────────────────────────────────────────────────────────────────────────

export const INDIA_TIMEZONE = 'Asia/Kolkata';
export const AUSTRALIA_TIMEZONE = 'Australia/Sydney';

export const INDIA_LOCALE = 'en-IN';
export const AUSTRALIA_LOCALE = 'en-AU';

const TZ_SHAPE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+){0,3}$/;

const courseOf = p => (typeof p === 'string' ? p : p?.course) || 'nsw';

/** True when the string names a timezone this runtime can actually compute in. */
export function isTimezone(raw) {
  const tz = String(raw || '');
  if (!tz || tz.length > 64 || !TZ_SHAPE.test(tz)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/** A validated timezone, or null when the value is not one. */
export function cleanTimezone(raw) {
  return isTimezone(raw) ? String(raw) : null;
}

/** The timezone a course lives in when the profile has not said otherwise. */
export function defaultTimezone(course) {
  return course === 'in' ? INDIA_TIMEZONE : AUSTRALIA_TIMEZONE;
}

/** The timezone for a profile (or a bare course id): its own if valid, else the course default. */
export function timezoneOf(profileOrCourse) {
  if (profileOrCourse && typeof profileOrCourse === 'object') {
    const own = cleanTimezone(profileOrCourse.timezone);
    if (own) return own;
  }
  return defaultTimezone(courseOf(profileOrCourse));
}

/** The BCP 47 locale a profile reads in. */
export function localeOf(profileOrCourse) {
  return courseOf(profileOrCourse) === 'in' ? INDIA_LOCALE : AUSTRALIA_LOCALE;
}

/** The currency a profile pays in. */
export function currencyOf(profileOrCourse) {
  return courseOf(profileOrCourse) === 'in' ? 'INR' : 'AUD';
}

/**
 * The calendar day an instant falls on in a timezone, as YYYY-MM-DD. This is
 * the key every activity row, streak and daily goal is filed under, so two
 * callers that disagree about the timezone disagree about whether a streak
 * survived the night.
 */
export function dayKey(ms = Date.now(), tz = INDIA_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** The hour of the day (0–23) an instant falls on in a timezone. */
export function hourIn(ms = Date.now(), tz = INDIA_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false }).formatToParts(new Date(ms));
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** A date written the way the profile reads dates: "1 Mar" for en-IN and en-AU alike, in the profile's timezone. */
export function formatDate(value, profileOrCourse, options = { day: 'numeric', month: 'short' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(localeOf(profileOrCourse), { timeZone: timezoneOf(profileOrCourse), ...options }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/** A weekday initial for the week strip, in the profile's timezone and locale. */
export function formatWeekday(value, profileOrCourse, width = 'narrow') {
  return formatDate(value, profileOrCourse, { weekday: width });
}

/** A number grouped the way the profile reads numbers: 12,34,567 for en-IN. */
export function formatNumber(value, profileOrCourse, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat(localeOf(profileOrCourse), options).format(n); }
  catch { return String(n); }
}

/** A price in the profile's currency: ₹499 for India, $499.00 for Australia. */
export function formatCurrency(value, profileOrCourse, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const currency = options.currency || currencyOf(profileOrCourse);
  const fractionDigits = currency === 'INR' && Number.isInteger(n) ? 0 : 2;
  try {
    return new Intl.NumberFormat(localeOf(profileOrCourse), {
      style: 'currency', currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits, ...options
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}
