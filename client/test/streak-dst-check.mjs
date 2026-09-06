// Pri Learning · a streak counts calendar days, not 24-hour blocks.
//
// store.js's streakFor() walked backwards in fixed 86,400,000 ms steps. A day is
// not always that long: in Australia/Sydney — the default calendar for every
// shipped Australian course, and available to any profile through its timezone
// — it is 23 hours the morning daylight saving starts and 25 hours the morning
// it ends. Each fixed step across one of those boundaries lands on the wrong
// date: in October the walk skips a day the student did practise and the streak
// resets to 1, and in April it visits the same day twice and the streak is
// inflated. Asia/Kolkata has no daylight saving, so mainstream India was never
// affected — which is exactly why this went unnoticed.
//
// Proves, against the real IndexedDB-backed activity rows:
//   · an unbroken run across the October transition counts every day
//   · an unbroken run across the April transition counts no day twice
//   · a genuine gap still ends the streak on both sides of a transition
//   · a day with a row but no questions does not count
//   · Asia/Kolkata is unchanged, and month, year and leap-day boundaries hold
//
// Usage: node client/test/streak-dst-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const { put } = await import('../src/local/idb.js');
const { streakFor } = await import('../src/local/store.js');
const { dayKey } = await import('../src/lib/locale.js');

const SYDNEY = 'Australia/Sydney';
const KOLKATA = 'Asia/Kolkata';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) => ok(name, actual === expected, `expected ${expected}, got ${actual}`);

let profileSeq = 0;
/** A profile id with one activity row per date given, each with real questions. */
async function seeded(dates, blank = []) {
  const pid = `streak-${++profileSeq}`;
  for (const date of dates) {
    await put('activity', { key: `${pid}:${date}`, pid, date, questions: 4, correct: 3, xp: 20, ms: 60000, predicted: null });
  }
  for (const date of blank) {
    await put('activity', { key: `${pid}:${date}`, pid, date, questions: 0, correct: 0, xp: 0, ms: 0, predicted: null });
  }
  return pid;
}

// ── Australia/Sydney, daylight saving starting (2026-10-04, clocks forward) ──

// 2026-10-04T13:30Z is 2026-10-05 00:30 in Sydney, the day after the transition.
const octNow = Date.UTC(2026, 9, 4, 13, 30);
eq('the October reference instant really is 5 October in Sydney', dayKey(octNow, SYDNEY), '2026-10-05');

const octRun = await seeded(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
eq('a five-day run across the spring-forward transition counts five', await streakFor(octRun, octNow, SYDNEY), 5);

const octGap = await seeded(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05']);
eq('a real gap before the transition still ends the streak', await streakFor(octGap, octNow, SYDNEY), 3);

const octOnly = await seeded(['2026-10-04', '2026-10-05']);
eq('the transition day itself is one day, not two', await streakFor(octOnly, octNow, SYDNEY), 2);

// ── Australia/Sydney, daylight saving ending (2026-04-05, clocks back) ───────

const aprNow = Date.UTC(2026, 3, 5, 13, 30);
eq('the April reference instant really is 5 April in Sydney', dayKey(aprNow, SYDNEY), '2026-04-05');

const aprPair = await seeded(['2026-04-04', '2026-04-05']);
eq('two days across the fall-back transition count two, not three', await streakFor(aprPair, aprNow, SYDNEY), 2);

const aprRun = await seeded(['2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']);
eq('a four-day run across the fall-back transition counts four', await streakFor(aprRun, aprNow, SYDNEY), 4);

const aprLone = await seeded(['2026-04-05']);
eq('one day across the fall-back transition is not counted twice', await streakFor(aprLone, aprNow, SYDNEY), 1);

// ── Nothing today: the walk starts from yesterday ────────────────────────────

const yesterdayOnly = await seeded(['2026-10-03', '2026-10-04']);
eq('a streak that ended yesterday still counts, across the transition', await streakFor(yesterdayOnly, octNow, SYDNEY), 2);

const staleRun = await seeded(['2026-09-20', '2026-09-21']);
eq('a run that ended days ago counts nothing', await streakFor(staleRun, octNow, SYDNEY), 0);

// ── A row with no questions on it is not a day of practice ───────────────────

const withBlank = await seeded(['2026-10-03', '2026-10-05'], ['2026-10-04']);
eq('a day the student opened the app but answered nothing breaks the streak', await streakFor(withBlank, octNow, SYDNEY), 1);

const empty = await seeded([]);
eq('a profile that has never practised has no streak', await streakFor(empty, octNow, SYDNEY), 0);

// ── The control: India has no daylight saving and must be unchanged ──────────

const kolkataNow = Date.UTC(2026, 9, 4, 18, 30);   // 2026-10-05 00:00 in Kolkata
eq('the reference instant really is 5 October in Kolkata', dayKey(kolkataNow, KOLKATA), '2026-10-05');
const kolkata = await seeded(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
eq('an Indian profile counts five days as it always did', await streakFor(kolkata, kolkataNow, KOLKATA), 5);

// ── Calendar arithmetic: month, year and leap-day boundaries ─────────────────

const monthEnd = await seeded(['2026-09-29', '2026-09-30', '2026-10-01']);
eq('a streak walks back over the end of a month', await streakFor(monthEnd, Date.UTC(2026, 8, 30, 14, 0), SYDNEY), 3);

const yearEnd = await seeded(['2025-12-30', '2025-12-31', '2026-01-01']);
eq('a streak walks back over the end of a year', await streakFor(yearEnd, Date.UTC(2025, 11, 31, 14, 0), SYDNEY), 3);

const leap = await seeded(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
eq('a streak walks back over a leap day', await streakFor(leap, Date.UTC(2028, 2, 1, 1, 0), SYDNEY), 4);

const nonLeap = await seeded(['2027-02-27', '2027-02-28', '2027-03-01']);
eq('a streak walks back over the end of a non-leap February', await streakFor(nonLeap, Date.UTC(2027, 2, 1, 1, 0), SYDNEY), 3);

// ── A long run over both transitions in one year ─────────────────────────────

const wholeYear = [];
for (let day = Date.UTC(2026, 0, 1); day <= Date.UTC(2026, 11, 31); day += 86400000) {
  wholeYear.push(new Date(day).toISOString().slice(0, 10));
}
const marathon = await seeded(wholeYear);
eq('365 consecutive days in a DST timezone count 365', await streakFor(marathon, Date.UTC(2026, 11, 31, 5, 0), SYDNEY), 365);

console.log(`\nStreak calendar — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nSTREAK CALENDAR: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
