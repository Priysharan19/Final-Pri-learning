// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reminder settings — off until the student turns them on.
//
// Per profile, on this device. `enabled` defaults to false and is only ever set
// true by the Settings toggle after the platform permission was granted; no
// code path turns it on by itself. The hours are the student's wall clock in
// the profile's own timezone.
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULT_STREAK_HOUR } from './schedule.js';

const KEY = pid => `pri-reminders:${pid}`;

function storage(scope) {
  try { return (scope || globalThis).localStorage || null; } catch { return null; }
}

export const DEFAULT_REMINDER_SETTINGS = Object.freeze({ enabled: false, sessionHour: 17, streakHour: DEFAULT_STREAK_HOUR });

export function normalizeReminderSettings(raw = {}) {
  const session = Number(raw?.sessionHour);
  const streak = Number(raw?.streakHour);
  return {
    enabled: raw?.enabled === true,
    sessionHour: Number.isInteger(session) && session >= 5 && session <= 22 ? session : DEFAULT_REMINDER_SETTINGS.sessionHour,
    streakHour: Number.isInteger(streak) && streak >= 12 && streak <= 23 ? streak : DEFAULT_REMINDER_SETTINGS.streakHour
  };
}

export function loadReminderSettings(pid, { scope = null } = {}) {
  const store = storage(scope);
  if (!pid || !store) return { ...DEFAULT_REMINDER_SETTINGS };
  try { return normalizeReminderSettings(JSON.parse(store.getItem(KEY(pid)) || 'null') || {}); }
  catch { return { ...DEFAULT_REMINDER_SETTINGS }; }
}

export function saveReminderSettings(pid, patch, { scope = null } = {}) {
  const next = normalizeReminderSettings({ ...loadReminderSettings(pid, { scope }), ...(patch || {}) });
  const store = storage(scope);
  if (pid && store) {
    try { store.setItem(KEY(pid), JSON.stringify(next)); } catch { /* private mode */ }
  }
  return next;
}
