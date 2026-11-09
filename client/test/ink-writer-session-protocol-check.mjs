// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Gate C writer-session protocol says only what is true
//
// handwriting/v12/WRITER_SESSION_PROTOCOL.md is how a real-writer session is
// run (consent, the D17 prompt, /practice?inkEvidence=1, the export and commit
// path, the 24 test writers). This keeps it honest against the code:
//   · its writer table is exactly the test split of PHYSICAL_STUDY_PLAN.json;
//   · the study route, the two export file names and every path and command
//     it names exist;
//   · the consent names OpenAI and the participant answers the D17 prompt;
//   · the Gate C floors it repeats are the gate's own.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const doc = read('handwriting/v12/WRITER_SESSION_PROTOCOL.md');
const plan = JSON.parse(read('handwriting/v12/PHYSICAL_STUDY_PLAN.json'));
const testWriters = plan.participants.filter(p => p.split === 'test');

export function writerTable(writers) {
  return ['| Code | Device slot |', '|---|---|', ...writers.map(p => `| \`${p.writerId}\` | ${p.deviceSlot} |`)].join('\n');
}
const block = doc.split('<!-- writer-session-test-writers:start -->')[1]?.split('<!-- writer-session-test-writers:end -->')[0]?.trim();
ok(block === writerTable(testWriters), 'the writer table is exactly the test split of PHYSICAL_STUDY_PLAN.json, in plan order');
ok(testWriters.length === plan.minimums.testWriters && testWriters.length === 24, 'there are 24 test writers, the plan\'s own minimum');
ok(new Set(testWriters.map(p => p.deviceSlot)).size === 2, 'the test writers cover both device slots');
ok(/## 5\. The 24 test writers/.test(doc), 'the doc says how many test writers there are');

// The route and the two exports are the ones the app has.
ok(doc.includes('/practice?inkEvidence=1'), 'the doc names the study route');
const routes = read('client/src/pages/PracticeBase.jsx') + read('client/src/pages/Practice.jsx') + read('client/src/components/InkPhysicalEvidenceSession.jsx');
ok(/inkEvidence/.test(routes), 'the study route exists in the app');
const session = read('client/src/components/InkPhysicalEvidenceSession.jsx');
ok(/`pri-physical-evidence-\$\{/.test(session) && doc.includes('pri-physical-evidence-<code>-<run>.json'), 'the evidence export file name is the one the session screen writes');
ok(/`pri-real-ink-\$\{/.test(session) && doc.includes('pri-real-ink-<code>-<run>.json'), 'the corpus export file name is the one the session screen writes');
ok(/setup\.consent/.test(session) && /consent box/.test(doc), 'the session screen refuses to start without the consent box, as the doc says');

// Every path and command it names exists.
for (const rel of ['handwriting/v12/evidence/physical', 'client/test/ink-corpus', 'tools/ink-cloud-reader-eval.mjs', 'client/test/ink-release-evidence-gate.mjs',
  'scripts/ink-physical-study-status.mjs', 'client/test/ink-physical-release-evidence.mjs', 'client/test/ink-corpus-audit.mjs', 'tools/ink-photo-reader-eval.mjs',
  'handwriting/v12/PHYSICAL_STUDY_RUNBOOK.md', 'docs/release/device-matrix.md']) {
  ok(existsSync(join(ROOT, rel)) && doc.includes(rel.split('/').pop()), `${rel} is named and exists`);
}

// Consent and D17.
ok(/OpenAI, an AI\s+> company/.test(doc) || /OpenAI, an AI company/.test(doc.replace(/\n> /g, ' ')), 'the consent read to the participant names OpenAI');
ok(/Send it to be read/.test(doc) && /\(D17\)/.test(doc) && /\*\*participant\*\* reads it/.test(doc), 'the participant answers the D17 prompt themselves');
ok(/never in\s+the app, never in the repository/.test(doc), 'consent is kept by the owner, never in the app or the repository');

// The floors are the gate's own and are not moved.
const gate = read('client/test/ink-release-evidence-gate.mjs');
for (const [said, inGate] of [['exact 98%', /98(\.0)?\b/], ['characters 99.5%', /99\.5/], ['worst writer 90%', /\b90(\.0)?\b/], ['safe-auto 99.9%', /99\.9/]]) {
  ok(doc.includes(said) && inGate.test(gate), `the doc's "${said}" is a floor the gate enforces`);
}
ok(/do not move to fit a result/.test(doc), 'the doc says the floors do not move');
ok(/NOT MEASURED/.test(doc) && /0 of 24 test writers/.test(doc), 'the doc says Gate C is not measured yet');

if (failures.length) {
  console.error(`WRITER SESSION PROTOCOL: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`WRITER SESSION PROTOCOL: PASS — ${pass}/${pass} checks — the 24 test writers are the plan's, the route, exports, paths and floors are the code's.`);
