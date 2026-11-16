// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what each plan includes, as the Premium screen states it
//
// Owner defaults D19 and D20 (docs/release/V1_DECISIONS_2026-11-01.md), from
// the same definitions the server enforces, so the screen cannot promise a
// figure the server does not keep:
//   Free     — 20 practice questions a day, one timed paper every 30 days,
//              5 reads of your writing and 5 question photos a day, and the
//              mistake notebook;
//   Premium  — unlimited practice questions and timed papers, the JEE
//              Advanced track, 25 reads and 25 photos a day; and, on the
//              server's own entitlement record, where the time went in each
//              section of a timed paper (premium-exams), the estimate from
//              practice and the mistake patterns on Insights
//              (advanced-analytics).
// Every row names the capability the SERVER checks for it, so the screen
// cannot sell something only the device decides (client/test/
// paywall-honesty-check.mjs). Features that ship dark (the parent weekly
// report, "Why this step?") are not listed until they are on.
// Nothing else is claimed: no accuracy, no outcome, no "complete" (D24).
// ─────────────────────────────────────────────────────────────────────────────
import { FREE_PRACTICE_ALLOWANCE, READ_ALLOWANCE } from '../engine/practiceAllowance.js';
import { FREE_EXAM_ALLOWANCE } from '../engine/examAllowance.js';

const plural = n => ({ n, count: n });

export const FREE_ROWS = Object.freeze([
  Object.freeze({ key: 'paywall.free.questions', vars: plural(FREE_PRACTICE_ALLOWANCE.perDay) }),
  Object.freeze({ key: 'paywall.free.papers', vars: { ...plural(FREE_EXAM_ALLOWANCE.examsPerWindow), days: FREE_EXAM_ALLOWANCE.examWindowDays } }),
  Object.freeze({ key: 'paywall.free.reads', vars: plural(READ_ALLOWANCE.free) }),
  Object.freeze({ key: 'paywall.free.notebook' })
]);

export const PREMIUM_ROWS = Object.freeze([
  Object.freeze({ key: 'paywall.premium.questions', capability: 'unlimited-practice' }),
  Object.freeze({ key: 'paywall.premium.papers', capability: 'premium-exams' }),
  Object.freeze({ key: 'paywall.premium.timeReport', capability: 'premium-exams' }),
  Object.freeze({ key: 'paywall.premium.jeeAdvanced', capability: 'jee-advanced-content' }),
  Object.freeze({ key: 'paywall.premium.reads', vars: plural(READ_ALLOWANCE.premium), capability: 'additional-ai-usage' }),
  Object.freeze({ key: 'paywall.premium.forecast', capability: 'advanced-analytics' }),
  Object.freeze({ key: 'paywall.premium.habits', capability: 'advanced-analytics' })
]);

/** Why the student arrived, said first and plainly. Unknown reasons say nothing. */
export const ARRIVAL_KEYS = Object.freeze({
  practice: 'paywall.from.practice',
  exams: 'paywall.from.exams',
  'jee-advanced': 'paywall.from.jeeAdvanced',
  reads: 'paywall.from.reads',
  'time-report': 'paywall.from.timeReport',
  insights: 'paywall.from.insights'
});
