// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · privacy-safe pilot summary (#141)
//
// A study programme (docs/kalp-unsw-2027/pilot-metrics-export-spec.md) needs a
// small, anonymous record of how much a participant practised. This builds it
// from rows already on the device and nothing else: no server, no upload. The
// student (or the person running the programme with them) saves the file and
// hands it over themselves.
//
// What leaves the device is a fixed list of counts. The builder never copies a
// field from a source row into its output; it only counts, sums and measures,
// so a name, an address, a profile id, an answer, handwriting or a photo has
// no path into the file. The participant code is checked against a shape a
// name cannot take (letters then digits, e.g. S042).
//
// Counting rules (pri-pilot-rules-v1), the same ones the progress file and the
// Progress page use (engine/progressTruth.js):
//   · one attempt row is one question sat. Second tries at the same question
//     resolve it once, so they are never a second attempt.
//   · a repeat (content whose solution this account had already seen) is an
//     attempt, never a correct one, and is left out of the accuracy.
//   · accuracy = correct / (attempts − repeats), null when that is zero.
//   · a day is an active day when its activity row records a question.
//   · practice time is the activity rows' answering time, not screen time.
//   · days are the profile's own calendar days (its timezone), inclusive.
// ─────────────────────────────────────────────────────────────────────────────

import { isCreditedCorrect, isRepeat } from '../engine/progressTruth.js';

export const PILOT_SUMMARY_SCHEMA = 'pri-pilot-summary-v2';
export const PILOT_RULES = 'pri-pilot-rules-v1';
export const PARTICIPANT_PATTERN = /^[A-Z]{1,4}-?[0-9]{1,6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

/**
 * The programmes a summary can be made for. A completion rule is part of the
 * programme's design, fixed before anyone is recruited; until it is declared
 * here a summary says `completed: null` rather than inventing one.
 */
export const PILOTS = Object.freeze({
  'india-student-impact-2026': Object.freeze({ completion: null })
});
export const DEFAULT_PILOT = 'india-student-impact-2026';

export const PILOT_LIMITATIONS = Object.freeze([
  'Counts what this device recorded for this profile; practice on another device is included only if it was synced here.',
  'Practice time is time spent answering questions, not time in the app.',
  'This records use and outcomes. It does not show that Pri Learning caused any change in learning.'
]);

function bad(message, code = 'INVALID_FIELD') {
  return Object.assign(new Error(message), { status: 400, code });
}

function validDate(text) {
  if (!DATE.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

const dayNumber = text => Date.UTC(...text.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0))) / 86400000;

function score(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw bad(`${label} must be a percentage from 0 to 100.`);
  return Math.round(n * 100) / 100;
}

/** Check what the person asked for. Throws a 400 the screen can show. */
export function pilotRequest(input = {}) {
  const participant = String(input.participant ?? '').trim().toUpperCase();
  if (!PARTICIPANT_PATTERN.test(participant)) throw bad('Use the participant code the programme gave you, like S042.');
  const pilot = String(input.pilot ?? DEFAULT_PILOT);
  if (!Object.hasOwn(PILOTS, pilot)) throw bad('That programme is not one this app knows.');
  const from = String(input.from ?? '');
  const to = String(input.to ?? '');
  if (!validDate(from) || !validDate(to)) throw bad('Choose a start date and an end date.');
  if (from > to) throw bad('The start date must be on or before the end date.');
  if (dayNumber(to) - dayNumber(from) + 1 > MAX_DAYS) throw bad('Choose a period of a year or less.');
  return { participant, pilot, from, to, baseline: score(input.baseline, 'Baseline'), post: score(input.post, 'Post-test') };
}

const count = value => Math.max(0, Math.min(1e7, Math.trunc(Number(value) || 0)));

/**
 * The summary for one profile. `attempts` and `activity` are that profile's
 * rows; `dayOf(ms)` gives a timestamp's day in the profile's timezone. Reads
 * its inputs and returns a new object: nothing passed in is changed.
 */
export function buildPilotSummary({ request, attempts = [], activity = [], dayOf, now, release = null }) {
  const { participant, pilot, from, to, baseline, post } = pilotRequest(request);
  const inPeriod = day => typeof day === 'string' && day >= from && day <= to;

  let questionsAttempted = 0;
  let repeatAttempts = 0;
  let correctAttempts = 0;
  let hintsUsed = 0;
  const topics = new Set();
  for (const a of attempts) {
    if (!a || !Number.isFinite(Number(a.createdAt)) || !inPeriod(dayOf(Number(a.createdAt)))) continue;
    questionsAttempted += 1;
    if (isRepeat(a)) repeatAttempts += 1;
    if (isCreditedCorrect(a)) correctAttempts += 1;
    hintsUsed += count(a.hintsUsed);
    if (typeof a.subtopic === 'string' && a.subtopic) topics.add(a.subtopic);
  }

  let activeDays = 0;
  let practiceMs = 0;
  const seen = new Set();
  for (const row of activity) {
    if (!row || !inPeriod(row.date) || seen.has(row.date)) continue;
    seen.add(row.date);
    if (count(row.questions) > 0) activeDays += 1;
    practiceMs += count(row.ms);
  }

  const scored = questionsAttempted - repeatAttempts;
  const rule = PILOTS[pilot].completion;
  return {
    schema: PILOT_SUMMARY_SCHEMA,
    rules: PILOT_RULES,
    pilot,
    participant,
    period: { from, to },
    generatedAt: new Date(now).toISOString(),
    app: release && /^[0-9a-f]{40}$/.test(String(release.releaseSha || ''))
      ? { version: String(release.productVersion || '').slice(0, 40) || null, commit: release.releaseSha }
      : null,
    activeDays,
    questionsAttempted,
    repeatAttempts,
    correctAttempts,
    accuracy: scored > 0 ? Math.round((correctAttempts / scored) * 10000) / 10000 : null,
    practiceMs,
    hintsUsed,
    topicsTouched: topics.size,
    baseline,
    post,
    completed: rule ? rule({ activeDays, questionsAttempted, baseline, post }) === true : null,
    limitations: [...PILOT_LIMITATIONS]
  };
}
