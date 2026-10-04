// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the plan on screen
//
// One hook that reads the evidence the planner needs — the profile's rating
// rows and FSRS review rows, straight from the local store the practice engine
// writes — builds the plan, pins today's sessions so a re-plan keeps them, and
// hands the reminders runtime the schedule that follows from it. Home's card
// and the Plan page both read from here, so they can never disagree.
//
// Nothing is fetched from a network and nothing is written but the student's
// settings, today's pin and (browser only) the queued reminders.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ratingsFor } from '../local/store.js';
import { byIndex } from '../local/idb.js';
import { dayKey } from '../lib/locale.js';
import { buildStudyPlan, todayProgress } from './studyPlan.js';
import { loadPlanSettings, savePlanSettings, loadTodayPin, saveTodayPin } from './settings.js';
import { computeReminders, zonedMs } from '../reminders/schedule.js';
import { loadReminderSettings } from '../reminders/settings.js';
import { reminderRuntime } from '../reminders/index.js';

/** Minutes practised today from the activity rows GET /stats returns. */
function minutesToday(activity, today) {
  const row = (activity || []).find(a => a?.date === today);
  return row ? Math.round((Number(row.ms) || 0) / 60_000) : 0;
}

export function usePlan(user, { stats = null, now = null } = {}) {
  const pid = user?.id || null;
  const tz = user?.timezone || 'Asia/Kolkata';
  // The instant the plan is measured at is fixed per load of the evidence, not
  // per render: a re-render must not re-plan, re-pin and re-sync by itself.
  const [nowMs, setNowMs] = useState(() => now ?? Date.now());
  const today = dayKey(nowMs, tz);
  const [evidence, setEvidence] = useState(null);
  useEffect(() => { if (evidence) setNowMs(now ?? Date.now()); }, [evidence, now]);
  const [settings, setSettings] = useState(() => loadPlanSettings(pid, { today }));

  useEffect(() => { setSettings(loadPlanSettings(pid, { today })); }, [pid, today]);

  const reload = useCallback(async () => {
    if (!pid) { setEvidence({ ratings: {}, reviews: [] }); return; }
    try {
      const [ratings, reviews] = await Promise.all([ratingsFor(pid), byIndex('reviews', 'pid', pid)]);
      setEvidence({ ratings: ratings || {}, reviews: reviews || [] });
    } catch {
      setEvidence({ ratings: {}, reviews: [] });
    }
  }, [pid]);

  useEffect(() => { let live = true; reload().then(() => { if (!live) return; }); return () => { live = false; }; }, [reload]);

  const plan = useMemo(() => {
    if (!evidence || !user || user.role === 'teacher') return null;
    const previous = loadTodayPin(pid, today);
    const built = buildStudyPlan({
      profile: user, ratings: evidence.ratings, reviews: evidence.reviews,
      examDate: settings.examDate, weeklyMinutes: settings.weeklyMinutes, restDay: settings.restDay,
      today, previous, nowMs
    });
    saveTodayPin(pid, built);
    return built;
  }, [evidence, user, pid, today, settings.examDate, settings.weeklyMinutes, settings.restDay, nowMs]);

  const progress = useMemo(() => {
    if (!plan || !evidence) return null;
    const dayStart = zonedMs(today, 0, tz);
    const attempts = Object.entries(evidence.ratings)
      .filter(([, r]) => Number(r?.last_at) >= dayStart)
      .map(([subtopic]) => ({ subtopic }));
    return todayProgress(plan, { attempts, minutesSpent: minutesToday(stats?.activity, today) });
  }, [plan, evidence, stats, today, tz]);

  // Reminders follow the plan. Off by default: with the toggle off this
  // computes an empty schedule, and an empty schedule is still synced so a
  // device that had reminders pending is left with none.
  useEffect(() => {
    if (!plan || !pid) return;
    const rs = loadReminderSettings(pid);
    const items = computeReminders({
      now: nowMs, timezone: tz, settings: { ...rs, sessionHour: settings.sessionHour },
      plan, reviews: evidence?.reviews || [], streak: Number(user?.streak) || 0,
      attemptedToday: Number(user?.today?.questions) > 0
    });
    if (!rs.enabled && !reminderRuntime().supported()) return;
    reminderRuntime().sync(pid, items).catch(() => {});
  }, [plan, pid, tz, nowMs, settings.sessionHour, evidence, user?.streak, user?.today?.questions]);

  const update = useCallback(patch => {
    const next = savePlanSettings(pid, patch);
    setSettings(next);
    return next;
  }, [pid]);

  return { plan, progress, settings, update, reload, today, loading: evidence === null };
}
