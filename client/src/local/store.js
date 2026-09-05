// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local data helpers (streaks, activity, ratings) over IndexedDB
// ─────────────────────────────────────────────────────────────────────────────
import { get, put, byIndex, dropDataKeys } from './idb.js';
import { dayKey, hourIn, timezoneOf, AUSTRALIA_TIMEZONE } from '../lib/locale.js';

// ── Day boundaries ───────────────────────────────────────────────────────────
// A day ends when the student's day ends: Asia/Kolkata for an Indian profile,
// Australia/Sydney for the legacy NSW profiles, or whatever timezone the
// profile carries. Every helper below takes the timezone explicitly; a caller
// that only has the profile id asks the profile for it.

export { dayKey as localDate, hourIn as localHour };

/** @deprecated legacy NSW helpers — kept for the Australian profiles; India profiles must pass their timezone. */
export function sydneyDate(ms = Date.now()) { return dayKey(ms, AUSTRALIA_TIMEZONE); }
export function sydneyHour(ms = Date.now()) { return hourIn(ms, AUSTRALIA_TIMEZONE); }

/** The timezone a stored profile lives in — its own, or its course's default. */
export async function profileTimezone(pid) {
  const p = pid ? await get('profiles', pid).catch(() => null) : null;
  return timezoneOf(p || 'nsw');
}

export async function activityFor(pid) {
  const rows = await byIndex('activity', 'pid', pid);
  return rows.sort((a, b) => a.date < b.date ? -1 : 1);
}

export async function streakFor(pid, nowMs = Date.now(), tz = null) {
  const zone = tz || await profileTimezone(pid);
  const rows = await byIndex('activity', 'pid', pid);
  const dates = new Set(rows.filter(r => r.questions > 0).map(r => r.date));
  if (!dates.size) return 0;
  let streak = 0;
  let cursor = nowMs;
  if (!dates.has(dayKey(nowMs, zone))) cursor -= 86400000;
  for (; ;) {
    const d = dayKey(cursor, zone);
    if (dates.has(d)) { streak++; cursor -= 86400000; } else break;
  }
  return streak;
}

export async function bumpActivity(pid, { correct, xp, ms }, nowMs = Date.now(), tz = null) {
  const date = dayKey(nowMs, tz || await profileTimezone(pid));
  const key = `${pid}:${date}`;
  const row = (await get('activity', key)) || { key, pid, date, questions: 0, correct: 0, xp: 0, ms: 0, predicted: null };
  row.questions += 1;
  row.correct += correct ? 1 : 0;
  row.xp += xp || 0;
  row.ms += ms || 0;
  await put('activity', row);
}

export async function setPredictedToday(pid, predicted, nowMs = Date.now(), tz = null) {
  const date = dayKey(nowMs, tz || await profileTimezone(pid));
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
