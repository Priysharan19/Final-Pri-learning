// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · README truth gate
//
// This repository's first rule is that every figure is quoted with the command
// that produced it. The failure mode that rule exists to catch is silent: a
// number goes stale when the code moves, and nothing complains. So the figures
// the README states about things this suite can reach are re-derived here and
// compared, and the claims the pivot made false are asserted absent.
//
// It deliberately does not re-run the slow suites. It checks the facts that can
// be read straight off the code: the model, the curriculum, the control plane.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const { CLASSES } = await import(join(ROOT, 'client/src/ink/classes.js'));
ok(readme.includes(`${CLASSES.length} shape classes`),
  `the README states the CNN's class count (${CLASSES.length})`);

const modelBytes = statSync(join(ROOT, 'client/src/ink/model-data.js')).size;
ok(readme.includes(`${modelBytes.toLocaleString('en-US')} bytes`),
  `the README states the model module's size (${modelBytes.toLocaleString('en-US')} bytes)`);

const { IN_CHAPTER_BY_ID } = await import(join(ROOT, 'client/src/engine/curriculum-in.js'));
const dotpoints = Object.values(IN_CHAPTER_BY_ID).reduce((n, c) => n + (c.dotpoints?.length || 0), 0);
ok(readme.includes(`${dotpoints} of ${dotpoints}`) || readme.includes(`${dotpoints}/${dotpoints}`),
  `the README states the India dot-point count (${dotpoints})`);

const platform = readFileSync(join(ROOT, 'server/platform/router.js'), 'utf8');
ok(/\/v1/.test(readme), 'the README mentions the /v1 control plane at all');
ok(platform.length > 0, 'the control plane exists to be described');

// Claims the India pivot and the cloud platform made false. Each one was in the
// README while the opposite was true in the code.
const FALSE_NOW = [
  ['no accounts, no cloud', 'the platform has accounts and a cloud'],
  ['100% locally', 'the cloud half does not run locally'],
  ['No cross-device sync', 'a sync API exists, with its real limits stated instead'],
  ['makes no network call of any kind', 'the client talks to /v1 when an account is linked'],
  ['Leibniz', 'the product is no longer positioned against an Australian platform']
];
for (const [claim, why] of FALSE_NOW) {
  ok(!readme.includes(claim), `the README no longer claims "${claim}" — ${why}`);
}

// The gaps that must stay named while they are still real.
const { plotSpecFor } = await import(join(ROOT, 'client/src/engine/plotSpec.js'));
ok(typeof plotSpecFor === 'function', 'the plotting detector is importable');
const MUST_NAME = [
  ['one real Apple Pencil writer', /one\*{0,2} real\s+Apple Pencil writer|holds \*\*one\*\* real/i],
  ['the empty JEE archive', /0 of 1,968|JEE previous-year archive is empty/i],
  ['unenforced Premium', /Premium buys nothing/i],
  ['no guardian consent', /guardian-consent|guardian consent/i],
  ['nothing deployed', /Nothing is deployed/i]
];
for (const [label, pattern] of MUST_NAME) {
  ok(pattern.test(readme), `the README still names the gap: ${label}`);
}

console.log(failures.length
  ? `README TRUTH: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `README TRUTH: PASS — ${pass}/${pass} checks — the stated model, curriculum and platform facts match the code, and no pre-pivot claim survives.`);
process.exit(failures.length ? 1 : 0);
