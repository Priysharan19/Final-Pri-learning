// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · study-plan settings
//
// Three choices the student makes (weekly minutes, exam date, rest day) and
// the hour a session reminder lands, kept per profile on this device. The plan
// itself is never stored: it is recomputed from the adaptive model each time,
// so a chapter practised an hour ago is already reflected.
//
// The one thing kept besides the settings is today's pin: the sessions the
// planner chose for today, so a re-plan after a practise keeps today's list in
// place instead of swapping the chapter under the student. It is keyed by
// date and ignored tomorrow.
//
// Storage is the same per-profile localStorage convention Home uses for its
// filter memory (`pri-gen-filters`). The local profile row is written only
// through PATCH /me, whose field list is deliberately closed; moving these
// fields onto the row is a one-line backend change (see docs/product/
// study-plan.md) and this module's read/write pair is the only place to update.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizePlanSettings } from './studyPlan.js';

const KEY = pid => `pri-plan:${pid}`;
const PIN_KEY = pid => `pri-plan-today:${pid}`;

function storage(scope) {
  try { return (scope || globalThis).localStorage || null; } catch { return null; }
}

export const DEFAULT_PLAN_SETTINGS = Object.freeze({ weeklyMinutes: 150, examDate: null, restDay: null, sessionHour: 17 });

export function loadPlanSettings(pid, { scope = null, today = null } = {}) {
  const store = storage(scope);
  if (!pid || !store) return { ...DEFAULT_PLAN_SETTINGS };
  try {
    const raw = JSON.parse(store.getItem(KEY(pid)) || 'null');
    return normalizePlanSettings({ ...DEFAULT_PLAN_SETTINGS, ...(raw || {}) }, today);
  } catch {
    return { ...DEFAULT_PLAN_SETTINGS };
  }
}

export function savePlanSettings(pid, patch, { scope = null } = {}) {
  const next = normalizePlanSettings({ ...loadPlanSettings(pid, { scope }), ...(patch || {}) });
  const store = storage(scope);
  if (pid && store) {
    try { store.setItem(KEY(pid), JSON.stringify(next)); } catch { /* private mode: the choice lasts the session */ }
  }
  return next;
}

/** Today's pinned sessions, or null when none were pinned for this date. */
export function loadTodayPin(pid, today, { scope = null } = {}) {
  const store = storage(scope);
  if (!pid || !store) return null;
  try {
    const raw = JSON.parse(store.getItem(PIN_KEY(pid)) || 'null');
    if (!raw || raw.date !== today || !Array.isArray(raw.sessions)) return null;
    return { today: { date: raw.date, sessions: raw.sessions } };
  } catch { return null; }
}

export function saveTodayPin(pid, plan, { scope = null } = {}) {
  const store = storage(scope);
  const day = plan?.today;
  if (!pid || !store || !day) return;
  const sessions = day.sessions.map(s => ({ id: s.id, type: s.type, subtopic: s.subtopic }));
  try { store.setItem(PIN_KEY(pid), JSON.stringify({ date: day.date, sessions })); } catch { /* best effort */ }
}

export function clearPlanData(pid, { scope = null } = {}) {
  const store = storage(scope);
  if (!pid || !store) return;
  try { store.removeItem(PIN_KEY(pid)); } catch { /* nothing to clear */ }
}
