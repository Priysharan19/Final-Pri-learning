// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local data helpers (streaks, activity, ratings) over IndexedDB
// ─────────────────────────────────────────────────────────────────────────────
import { get, put, byIndex, dropDataKeys } from './idb.js';

// ── When "today" ends ────────────────────────────────────────────────────────
//
// Streaks, the daily goal and the activity heatmap are all keyed by a date
// string, and that date needs a timezone. It used to be Australia/Sydney for
// everyone, which is correct for an HSC app and wrong the moment the product
// shipped to India: Sydney midnight is 6:30–7:30 pm IST, so an Indian student
// practising after dinner had their work filed under tomorrow. Their streak
// then broke on days they had actually studied, and the daily goal reset while
// they were still working towards it.
//
// The zone is per profile, set once at sign-in from the profile's course, and
// held here as module state for the same reason `currentPid` is — every caller
// wants "this student's today" and none of them should have to pass it.

const DEFAULT_ZONE = 'Australia/Sydney';
const COURSE_ZONE = { in: 'Asia/Kolkata' };

let dayZone = DEFAULT_ZONE;

/** The IANA zone a course's school day runs on. */
export function zoneForCourse(course) {
  return COURSE_ZONE[course] || DEFAULT_ZONE;
}

/**
 * Set the zone every date in this module is computed in. Called when a profile
 * becomes current; safe to call repeatedly with the same value.
 *
 * A zone Intl does not recognise is ignored rather than thrown, because the
 * alternative is that one bad profile field makes the app fail to open.
 */
export function setDayZone(zone) {
  if (!zone || zone === dayZone) return dayZone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    dayZone = zone;
  } catch { /* keep the previous zone */ }
  return dayZone;
}

export const currentDayZone = () => dayZone;

/** YYYY-MM-DD in the profile's own zone. The key every activity row uses. */
export function localDate(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: dayZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Hour of day, 0–23, in the profile's own zone. */
export function localHour(ms = Date.now()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: dayZone, hour: 'numeric', hour12: false }).format(new Date(ms)));
}

/** Narrow weekday letter in the profile's own zone, for the streak strip. */
export function localWeekdayNarrow(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-AU', { timeZone: dayZone, weekday: 'narrow' }).format(new Date(ms));
}

// The old names, kept so nothing that still imports them breaks. They are no
// longer Sydney-specific and new code should use localDate/localHour.
export const sydneyDate = localDate;
export const sydneyHour = localHour;

export async function activityFor(pid) {
  const rows = await byIndex('activity', 'pid', pid);
  return rows.sort((a, b) => a.date < b.date ? -1 : 1);
}

export async function streakFor(pid, nowMs = Date.now()) {
  const rows = await byIndex('activity', 'pid', pid);
  const dates = new Set(rows.filter(r => r.questions > 0).map(r => r.date));
  if (!dates.size) return 0;
  let streak = 0;
  let cursor = nowMs;
  if (!dates.has(sydneyDate(nowMs))) cursor -= 86400000;
  for (; ;) {
    const d = sydneyDate(cursor);
    if (dates.has(d)) { streak++; cursor -= 86400000; } else break;
  }
  return streak;
}

export async function bumpActivity(pid, { correct, xp, ms }, nowMs = Date.now()) {
  const date = sydneyDate(nowMs);
  const key = `${pid}:${date}`;
  const row = (await get('activity', key)) || { key, pid, date, questions: 0, correct: 0, xp: 0, ms: 0, predicted: null };
  row.questions += 1;
  row.correct += correct ? 1 : 0;
  row.xp += xp || 0;
  row.ms += ms || 0;
  await put('activity', row);
}

export async function setPredictedToday(pid, predicted, nowMs = Date.now()) {
  const date = sydneyDate(nowMs);
  const key = `${pid}:${date}`;
  const row = (await get('activity', key)) || { key, pid, date, questions: 0, correct: 0, xp: 0, ms: 0, predicted: null };
  row.predicted = predicted;
  await put('activity', row);
}

export async function ratingsFor(pid) {
  const rows = await byIndex('ratings', 'pid', pid);
  return Object.fromEntries(rows.map(r => [r.subtopic, r]));
}

export async function getRating(pid, subtopic) {
  return get('ratings', `${pid}:${subtopic}`);
}

export async function putRating(pid, subtopic, data) {
  await put('ratings', { key: `${pid}:${subtopic}`, pid, subtopic, ...data });
}

// ── Which profile the UI is showing ──────────────────────────────────────────
// This is a convenience, not a credential: anyone can write the key, so nothing
// that matters may be granted on the strength of it. A protected profile is
// reachable only while its data key is held in memory, and switching away —
// or signing out — gives that key up here, at the one place the selection
// changes. Whoever edits the key afterwards is left holding ciphertext.

export const currentPid = () => localStorage.getItem('pri-current-profile');
export const setCurrentPid = pid => {
  dropDataKeys(pid || null);
  if (pid) localStorage.setItem('pri-current-profile', pid);
  else localStorage.removeItem('pri-current-profile');
};
