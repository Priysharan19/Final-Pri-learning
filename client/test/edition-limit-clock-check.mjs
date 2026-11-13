// Pri Learning · a limit names when it lifts in the student's own clock, and the
// device and the server agree on the student's day, in both editions (plan H7).
//
//   1. lib/locale.js limitClock: an NSW profile (Prithagoras) gets its own
//      locale and timezone; an India profile and no profile get null, so their
//      messages are written exactly as before.
//   2. ink/readerFailure.js retryClock: the time a reading limit lifts, for an
//      NSW profile, is the Sydney wall clock in en-AU; for an India profile,
//      for Hindi and for no profile it is the string main wrote (en-IN or
//      hi-IN, on the device's clock), compared over a year of instants.
//   3. Every place that shows a reading-limit or daily-cap time passes the
//      signed-in profile (source pins on the four call sites).
//   4. The device's daily gate (local/entitlementGate.js) and the server's
//      practice day (server/platform/practiceAllowance.js) give the same day
//      key and the same reset instant for the same instant: an India profile
//      against Priyabhata, an NSW profile against Prithagoras, across both
//      Sydney daylight-saving changes.
//
// Usage: node client/test/edition-limit-clock-check.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The device's own clock for this run: neither India nor Sydney, so a time
// written on the device's clock and one written in the profile's are told apart.
process.env.TZ = 'UTC';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = path => readFileSync(join(ROOT, path), 'utf8');
const { limitClock, timezoneOf } = await import('../src/lib/locale.js');
const { retryClock } = await import('../src/ink/readerFailure.js');
const gate = await import('../src/local/entitlementGate.js');
const { practiceDay } = await import('../../server/platform/practiceAllowance.js');

let pass = 0;
const failures = [];
const ok = (label, cond, detail = '') => { if (cond) pass++; else failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const same = (label, actual, expected) => ok(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// main's retryClock, verbatim (origin/main d1448d6a3), for the comparison.
function mainRetryClock(retryAt, language = 'en') {
  if (retryAt === null || retryAt === undefined || !Number.isFinite(Number(retryAt)) || Number(retryAt) <= 0) return '';
  try {
    return new Intl.DateTimeFormat(String(language || 'en').toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(Number(retryAt)));
  } catch { return ''; }
}

const NSW = { course: 'nsw' };
const INDIA = { course: 'in' };

// ── 1 · limitClock ───────────────────────────────────────────────────────────
same('an NSW profile writes limits in en-AU on the Sydney clock', limitClock(NSW), { locale: 'en-AU', timeZone: 'Australia/Sydney' });
same('an NSW profile with its own zone uses that zone', limitClock({ course: 'nsw', timezone: 'Australia/Perth' }), { locale: 'en-AU', timeZone: 'Australia/Perth' });
same('an India profile is unchanged (no regional clock)', limitClock(INDIA), null);
same('an India profile with its own zone is unchanged too', limitClock({ course: 'in', timezone: 'Asia/Dubai' }), null);
same('no profile is unchanged', [limitClock(null), limitClock(undefined), limitClock('nsw'), limitClock({})], [null, null, null, null]);

// ── 2 · retryClock ───────────────────────────────────────────────────────────
const sydneyMidnight = Date.UTC(2026, 9, 4, 13, 0, 0); // 00:00 AEDT, 13:00 UTC
same('an NSW student is told the Sydney midnight a limit lifts at', retryClock(sydneyMidnight, 'en', NSW), new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' }).format(new Date(sydneyMidnight)));
ok('which reads as midnight, not the device\'s 1 pm', /^12:00\s?am$/i.test(retryClock(sydneyMidnight, 'en', NSW)), retryClock(sydneyMidnight, 'en', NSW));
ok('a Perth student reads the same instant on the Perth clock', /^9:00\s?pm$/i.test(retryClock(sydneyMidnight, 'en', { course: 'nsw', timezone: 'Australia/Perth' })), retryClock(sydneyMidnight, 'en', { course: 'nsw', timezone: 'Australia/Perth' }));
same('nothing to say is still nothing', [retryClock(null, 'en', NSW), retryClock(0, 'en', NSW), retryClock('soon', 'en', NSW)], ['', '', '']);
{
  let sampled = 0;
  let differ = null;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 97 * 60 * 1000 + 3_001) {
    for (const [language, profile] of [['en', INDIA], ['hi', INDIA], ['en', null], ['hi', null], ['hi', NSW], ['en', { course: 'in', timezone: 'Asia/Dubai' }]]) {
      sampled += 1;
      if (retryClock(ms, language, profile) !== mainRetryClock(ms, language) && differ === null) differ = `${new Date(ms).toISOString()} ${language} ${JSON.stringify(profile)}`;
    }
  }
  ok(`India profiles, Hindi and no profile read exactly what main wrote (${sampled} instant/profile pairs over 2026)`, differ === null, differ || '');
}

// ── 3 · the call sites pass the profile ──────────────────────────────────────
const ink = src('client/src/ink/InkAnswer.jsx');
same('the ink surface passes the signed-in profile to both reading-limit times', (ink.match(/retryClock\(shownStatus\.block\?\.retryAt, language, user\)/g) || []).length, 2);
same('it reads no time without it', (ink.match(/retryClock\(/g) || []).length, 2);
const card = src('client/src/components/QuestionCard.jsx');
ok('the photo reading limit passes the profile', /retryClock\(photoOCR\.block\?\.retryAt, language, user\)/.test(card));
ok('the submitted-page reading limit passes the profile', /retryClock\(state\.res\.readerBlock\.retryAt, language, user\)/.test(card));
same('and the card reads no time without it', (card.match(/retryClock\(/g) || []).length, 2);
const notice = src('client/src/components/FreeCapNotice.jsx');
ok('the daily-cap notice writes its reset in the profile\'s clock', /limitClock\(profile\) \|\| \{ locale: 'en-IN', timeZone: gateTimeZone \|\| null \}/.test(notice) && /export default function FreeCapNotice\(\{ gate, onRetry, profile = null \}\)/.test(notice));
ok('practice gives it the signed-in profile', /<FreeCapNotice gate=\{capped\} onRetry=\{load\} profile=\{user\} \/>/.test(src('client/src/pages/PracticeBase.jsx')));

// ── 4 · the device's day and the server's day agree, per edition ─────────────
{
  const pairs = [['priyabhata', INDIA], ['prithagoras', NSW]];
  const instants = [
    Date.UTC(2026, 9, 2, 14, 0, 0), Date.UTC(2026, 9, 3, 13, 59, 59, 999), Date.UTC(2026, 9, 3, 14, 0, 0), Date.UTC(2026, 9, 3, 16, 30, 0),
    Date.UTC(2026, 9, 4, 12, 59, 59, 999), Date.UTC(2026, 9, 4, 13, 0, 0), Date.UTC(2027, 3, 3, 13, 0, 0), Date.UTC(2027, 3, 3, 16, 30, 0),
    Date.UTC(2027, 3, 4, 13, 59, 59, 999), Date.UTC(2027, 3, 4, 14, 0, 0), Date.UTC(2026, 8, 5, 18, 29, 59, 999), Date.UTC(2026, 8, 5, 18, 30, 0)
  ];
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 3, 30); ms += 6 * 60 * 60 * 1000 + 17 * 60 * 1000) instants.push(ms);
  for (const [edition, profile] of pairs) {
    const zone = gate.profileTimeZone(profile);
    same(`${edition}: the device's default calendar for its profile is the edition's (${zone})`, zone, practiceDay(0, edition).timeZone);
    same(`${edition}: and lib/locale.js agrees`, timezoneOf(profile), zone);
    let mismatch = null;
    for (const ms of instants) {
      const server = practiceDay(ms, edition);
      const device = { key: gate.dayKey(ms, zone), end: gate.nextDayStart(ms, zone) };
      if ((device.key !== server.key || device.end !== server.end) && mismatch === null) mismatch = `${new Date(ms).toISOString()}: device ${JSON.stringify(device)} server ${JSON.stringify({ key: server.key, end: server.end })}`;
    }
    ok(`${edition}: device and server give the same day and the same reset instant at ${instants.length} instants, both sides of daylight saving`, mismatch === null, mismatch || '');
  }
}

console.log(`Edition limit clock — ${pass}/${pass + failures.length} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nEDITION LIMIT CLOCK (H7): ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
process.exit(failures.length ? 1 : 0);
