import { byIndex, get, hasDataKey } from './idb.js';
import { currentPid, sydneyDate } from './store.js';

export const PILOT_SCHEMA = 'pri-pilot-summary-v1';
export const PILOT_ID = 'india-student-impact-2026';
export const DEFAULT_COMPLETION_RULE = Object.freeze({
  minimumActiveDays: 8,
  requireBaseline: true,
  requirePost: true
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PARTICIPANT_RE = /^S\d{3,6}$/;

function assertDate(value, label) {
  if (!DATE_RE.test(String(value || ''))) throw new Error(`${label} must use YYYY-MM-DD.`);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid date.`);
}

function controlledScore(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${label} must be between 0 and 100.`);
  return Math.round(n * 100) / 100;
}

export function assertPilotExportAllowed(profile, unlocked) {
  if (!profile) throw new Error('Open a profile before exporting pilot evidence.');
  if (profile.auth && !unlocked) {
    throw new Error('This protected profile is locked. Sign in before exporting pilot evidence.');
  }
  return true;
}

function attemptDate(row) {
  const at = Number(row?.createdAt);
  return Number.isFinite(at) ? sydneyDate(at) : null;
}

/**
 * One served question can receive more than one submission. The pilot counts
 * the FIRST recorded submission for that question instance. This makes retries
 * deterministic and prevents repeated corrections from inflating attempts or
 * accuracy. A legacy row without questionId falls back to its own attempt id.
 */
export function canonicalAttempts(rows, from, to) {
  const firstByQuestion = new Map();
  for (const row of rows || []) {
    const date = attemptDate(row);
    if (!date || date < from || date > to) continue;
    const key = row?.questionId === null || row?.questionId === undefined || row?.questionId === ''
      ? `attempt:${String(row?.id ?? '')}`
      : `question:${String(row.questionId)}`;
    const previous = firstByQuestion.get(key);
    const createdAt = Number(row?.createdAt) || 0;
    const previousAt = Number(previous?.createdAt) || 0;
    if (!previous || createdAt < previousAt || (createdAt === previousAt && String(row?.id ?? '') < String(previous?.id ?? ''))) {
      firstByQuestion.set(key, row);
    }
  }
  return [...firstByQuestion.values()];
}

export function aggregatePilotSummary({
  participant,
  from,
  to,
  activityRows = [],
  attemptRows = [],
  baseline = null,
  post = null,
  completionRule = DEFAULT_COMPLETION_RULE,
  generatedAt = new Date().toISOString(),
  appCommit = globalThis.__PRI_BUILD_COMMIT__ || null
}) {
  if (!PARTICIPANT_RE.test(String(participant || ''))) {
    throw new Error('Participant ID must be an anonymous code such as S042.');
  }
  assertDate(from, 'Start date');
  assertDate(to, 'End date');
  if (from > to) throw new Error('Start date must not be after end date.');

  const safeBaseline = controlledScore(baseline, 'Baseline score');
  const safePost = controlledScore(post, 'Post score');
  const minDays = Math.max(0, Math.floor(Number(completionRule?.minimumActiveDays) || 0));

  const inPeriodActivity = (activityRows || []).filter(row => {
    const date = String(row?.date || '');
    return DATE_RE.test(date) && date >= from && date <= to && Number(row?.questions) > 0;
  });
  const activeDays = new Set(inPeriodActivity.map(row => row.date)).size;
  const attempts = canonicalAttempts(attemptRows, from, to);
  const questionsAttempted = attempts.length;
  const correctAttempts = attempts.reduce((n, row) => n + (Number(row?.correct) === 1 ? 1 : 0), 0);
  const practiceMs = attempts.reduce((n, row) => n + Math.max(0, Number(row?.ms) || 0), 0);
  const hintsUsed = attempts.reduce((n, row) => n + Math.max(0, Number(row?.hintsUsed) || 0), 0);
  const topicsTouched = new Set(attempts.map(row => String(row?.subtopic || '').trim()).filter(Boolean)).size;
  const accuracy = questionsAttempted ? correctAttempts / questionsAttempted : null;

  const completed = activeDays >= minDays
    && (!completionRule?.requireBaseline || safeBaseline !== null)
    && (!completionRule?.requirePost || safePost !== null);

  return {
    schema: PILOT_SCHEMA,
    pilot: PILOT_ID,
    participant,
    period: { from, to },
    generatedAt,
    appCommit,
    calculationRules: {
      attemptRule: 'first-recorded-submission-per-question-instance',
      activeDayRule: 'activity-row-in-period-with-questions-greater-than-zero',
      practiceTimeRule: 'sum-ms-on-canonical-attempts',
      completion: {
        minimumActiveDays: minDays,
        requireBaseline: !!completionRule?.requireBaseline,
        requirePost: !!completionRule?.requirePost
      }
    },
    activeDays,
    questionsAttempted,
    correctAttempts,
    accuracy,
    practiceMs,
    hintsUsed,
    topicsTouched,
    baseline: safeBaseline,
    post: safePost,
    completed
  };
}

export async function createPilotSummary(options) {
  const pid = currentPid();
  if (!pid) throw new Error('Open a profile before exporting pilot evidence.');
  const profile = await get('profiles', pid);
  assertPilotExportAllowed(profile, hasDataKey(pid));

  const [activityRows, attemptRows] = await Promise.all([
    byIndex('activity', 'pid', pid),
    byIndex('attempts', 'pid', pid)
  ]);

  return aggregatePilotSummary({ ...options, activityRows, attemptRows });
}
