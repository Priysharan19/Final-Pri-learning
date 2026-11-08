// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the native staging journey is what it says it is
//
// scripts/iphone-journey.mjs --staging runs a DEBUG simulator build against the
// deployed staging service with the real reader and a real emailed code
// (scripts/journey-staging.mjs, JourneySelfCheck.swift `--journey-staging`).
// This holds its contract without a simulator or a network:
//   · it may name only staging or the public origin that fronts it;
//   · with no inbox module or no usable inbox it is NOT MEASURED and records
//     why, never a pass;
//   · its record is SIMULATOR + DEPLOYED, says what it is not evidence for,
//     and passes only when every step reported ok;
//   · the in-app leg meets the D17 prompt, reads, is marked by the server,
//     finds History and deletes the test account, in both package mirrors;
//   · the code helper never prints the inbox settings; the nightly runner
//     goes through the heavy-job limiter, one family at a time, outside the repo.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGING_ORIGIN, STAGING_STEPS, TIER, inboxPurpose, openInbox, stagingEvidence, stagingOriginProblem } from '../../scripts/journey-staging.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── the origin ───────────────────────────────────────────────────────────────
eq(stagingOriginProblem(STAGING_ORIGIN), null, 'the staging service itself is a staging origin');
eq(stagingOriginProblem('https://app.prilearning.com'), null, 'so is the public origin, which fronts staging until GO');
for (const bad of ['https://final-pri-learning-production.up.railway.app', 'http://pri-learning-staging-staging.up.railway.app', 'https://app.prilearning.com/v1', 'https://example.com', 'not a url']) {
  ok(stagingOriginProblem(bad), `a staging run refuses ${bad}`);
}

// ── the inbox ───────────────────────────────────────────────────────────────
eq(['reauth', 'delete', 'guardian', undefined, 'sign-in'].map(inboxPurpose), ['delete', 'delete', 'guardian', 'sign-in', 'sign-in'], 'a page\'s code request maps to the inbox\'s purposes');
const scratch = mkdtempSync(join(tmpdir(), 'pri-staging-check-'));
try {
  const missing = await openInbox({ modulePath: join(scratch, 'nope.mjs') });
  ok(!missing.ok && /PR #746/.test(missing.reason), 'without tools/staging-inbox.mjs the run is not measured, and says where it comes from');
  const fake = join(scratch, 'staging-inbox.mjs');
  writeFileSync(fake, "export function loadInbox() { return { ok: false, reason: 'the inbox file does not exist' }; }\n");
  const absent = await openInbox({ modulePath: fake });
  ok(!absent.ok && /not usable: the inbox file does not exist/.test(absent.reason), 'without the owner\'s inbox file it is not measured either');
  const good = join(scratch, 'good.mjs');
  writeFileSync(good, "export function loadInbox() { return { ok: true, config: { PRI_STAGING_INBOX_ADDRESS: 'x@example.test' } }; }\nexport const tagAddress = (a, r, n) => a;\n");
  const opened = await openInbox({ modulePath: good });
  ok(opened.ok && opened.config.PRI_STAGING_INBOX_ADDRESS && typeof opened.inbox.tagAddress === 'function', 'with both, the inbox opens');
} finally { rmSync(scratch, { recursive: true, force: true }); }

// ── the record ──────────────────────────────────────────────────────────────
const stamp = { now: () => '2026-11-09T00:00:00.000Z' };
const notMeasured = stagingEvidence({ sim: { name: 'Pri iPhone 16' }, origin: STAGING_ORIGIN, notMeasured: 'the test inbox is not usable', ...stamp });
ok(notMeasured.result === 'NOT MEASURED' && notMeasured.notMeasured && Object.keys(notMeasured.steps).length === 0, 'a run that could not start is NOT MEASURED, with its reason, and no steps');
ok(notMeasured.evidenceClass === 'SIMULATOR_DEPLOYED' && TIER === 'SIMULATOR + DEPLOYED' && notMeasured.physicalDevice === false, 'the record is SIMULATOR + DEPLOYED, never device evidence');
ok(['reading accuracy (the strokes are synthetic)', 'that any answer is right (staging has no answer oracle)', 'production'].every(x => notMeasured.notEvidenceFor.includes(x)),
  'it says it is no evidence of reading accuracy, of right answers or of production');
const all = Object.fromEntries(STAGING_STEPS.map(n => [n, { ok: true, detail: '' }]));
eq(stagingEvidence({ steps: all, origin: STAGING_ORIGIN, ...stamp }).result, 'PASS', 'every step ok is a pass');
eq(stagingEvidence({ steps: { ...all, stagingHistory: { ok: false, detail: 'not reported' } }, origin: STAGING_ORIGIN, ...stamp }).result, 'FAIL', 'one step not ok is a fail');
eq(stagingEvidence({ steps: {}, origin: STAGING_ORIGIN, ...stamp }).result, 'FAIL', 'no steps at all is a fail, never a pass');
eq(STAGING_STEPS, ['stagingCardOnboarding', 'stagingInkRead', 'stagingConfirmedMarked', 'stagingHistory', 'stagingDeleteAccount'], 'five steps, from the card to deleting the test account');

// ── the in-app leg ──────────────────────────────────────────────────────────
const swift = read('ios/PriLearning.swiftpm/JourneySelfCheck.swift');
ok(swift === read('ios/PriLearning 2.swiftpm/JourneySelfCheck.swift'), 'both package mirrors carry the same journey');
ok(/args\.contains\("--journey-staging"\) \{ return "staging" \}/.test(swift) && /case "staging": script = staging/.test(swift), 'the app runs the staging leg on --journey-staging');
const leg = swift.slice(swift.indexOf('private static let staging = '), swift.indexOf('private static let markingRelaunch = '));
for (const name of STAGING_STEPS) ok(leg.includes(`await step('${name}'`), `the in-app leg reports ${name}`);
ok(/data-reader-permission-sheet="ink"/.test(leg) && /OpenAI/.test(leg) && /data-reader-permission="accept"/.test(leg) && /read while the permission prompt was open/.test(leg),
  'it meets the D17 prompt, checks it names OpenAI and that nothing is read before accepting');
ok(/cloud-delete-with-code/.test(leg) && /purpose: 'reauth'/.test(leg), 'it deletes the test account it made, with an emailed code');
const journey = read('scripts/iphone-journey.mjs');
ok(journey.indexOf("process.argv.includes('--staging')") > 0 && journey.indexOf("process.argv.includes('--staging')") < journey.indexOf("console.log('Leg 1 · no server"),
  'iphone-journey.mjs runs the staging leg instead of the local legs');

// ── the helpers ─────────────────────────────────────────────────────────────
const helper = read('scripts/staging-inbox-code.mjs');
ok(!/console\.log/.test(helper) && !/loaded\.config\)/.test(helper.replace('imapMailbox(loaded.config)', '')), 'the code helper prints one JSON line and never the inbox settings');
const nightly = read('scripts/journey-staging-nightly.sh');
ok(/heavy-slot\.sh/.test(nightly) && /for family in iphone ipad/.test(nightly) && /--staging --family "\$family"/.test(nightly), 'the nightly runner takes both families through the heavy-job limiter, one at a time');
ok(/mktemp -d/.test(nightly) && /rm -rf "\$BUILT"/.test(nightly) && /\/tmp\/pri-staging-journey/.test(nightly), 'it builds and writes evidence outside the repository and removes its build');

if (failures.length) {
  console.error(`NATIVE STAGING JOURNEY: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`NATIVE STAGING JOURNEY: PASS — ${pass}/${pass} checks — staging or its public origin only, NOT MEASURED without an inbox, SIMULATOR + DEPLOYED, D17 to deletion in both mirrors.`);
