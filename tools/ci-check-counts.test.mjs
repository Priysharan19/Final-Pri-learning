#!/usr/bin/env node
// CI CHECK COUNTS self-test. The guarantee the old inline greps gave — a suite
// that runs one check fewer, or does not run at all, fails CI — must hold for
// the manifest: each negative case below runs the real command line CI runs
// (`node tools/ci-check-counts.mjs verify <group>`) and requires a failure.
// Hermetic: temporary files only, no network, no git.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadManifest, manifestProblems, verifyGroup, regen, regenPin, unannouncedRemovals, merge3, serialize, shapeOf, pinHolds
} from './ci-check-counts.mjs';

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ci-check-counts.mjs');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const scratch = mkdtempSync(path.join(tmpdir(), 'pri-check-counts-'));
const file = (name, text) => { const p = path.join(scratch, name); writeFileSync(p, text); return p; };
const cli = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', cwd: scratch });

// A fixture manifest shaped like ci.yml's: two suites pinned by count, a verdict-only
// pin, a regex pin, a count pin and a pin whose 0 is the invariant.
const fixture = {
  version: 1,
  groups: {
    'platform/edition.log': { job: 'platform', log: 'edition.log', pins: [
      { has: 'EDITION AGREEMENT (E2): PASS — 155/155 checks' },
      { has: 'BILLING PER EDITION: PASS — 123/123 checks —' },
      { has: 'SQLITE TO POSTGRES EXPORT: PASS' },
      { re: 'E2E SUITE.*25/25.*1 flows' },
      { has: 'Responsive matrix · 6 viewports', count: 2, op: 'ge' },
      { has: 'FALSE-POSITIVE SWEEP: PASS — 0 of 422837 wrong answers marked correct across 19248 questions' }
    ] }
  },
  retired: []
};
const GOOD = [
  'EDITION AGREEMENT (E2): PASS — 155/155 checks',
  'BILLING PER EDITION: PASS — 123/123 checks — both editions',
  'SQLITE TO POSTGRES EXPORT: PASS',
  '✔ E2E SUITE PASSED — 25/25 checks across 1 flows',
  'Responsive matrix · 6 viewports, critical routes (chromium)',
  'Responsive matrix · 6 viewports, critical routes (webkit)',
  'FALSE-POSITIVE SWEEP: PASS — 0 of 422837 wrong answers marked correct across 19248 questions'
].join('\n') + '\n';
ok(manifestProblems(fixture).length === 0, 'the fixture manifest is well formed');
const manifestPath = file('check-counts.json', serialize(fixture));
const verify = log => cli('verify', 'platform/edition.log', '--manifest', manifestPath, '--log', file('edition.log', log));

// ── the control: every suite ran every check ────────────────────────────────
{
  const r = verify(GOOD);
  ok(r.status === 0 && /CHECK COUNTS: PASS — platform\/edition\.log: 6\/6 pins/.test(r.stdout), `the full log passes (exit ${r.status}) ${r.stderr}`);
}
// ── a dropped check fails CI ──────────────────────────────────────────────────
for (const [what, log] of [
  ['one check fewer (154/154)', GOOD.replace('155/155', '154/154')],
  ['one check failed (154/155)', GOOD.replace('155/155', '154/155')],
  ['one check more is a different suite too (156/156)', GOOD.replace('155/155', '156/156')],
  ['a tour that ran one check fewer (24/24)', GOOD.replace('25/25', '24/24')],
  ['a sweep that now credits a wrong answer (1 of …)', GOOD.replace('PASS — 0 of', 'PASS — 1 of')],
  ['a tour that ran in one engine only (count floor 2)', GOOD.replace(/Responsive matrix[^\n]*\(webkit\)\n/, '')]
]) {
  const r = verify(log);
  ok(r.status === 1 && /CHECK COUNTS: FAIL/.test(r.stderr), `a dropped check fails: ${what} (exit ${r.status})`);
}
{
  const r = verify(GOOD.replace('155/155', '154/154'));
  ok(/this run printed: EDITION AGREEMENT \(E2\): PASS — 154\/154 checks/.test(r.stderr), 'the failure shows what the suite printed instead');
}
// ── a dropped suite fails CI ──────────────────────────────────────────────────
for (const [what, log] of [
  ['the billing suite did not run', GOOD.replace(/BILLING PER EDITION[^\n]*\n/, '')],
  ['the export suite (verdict only) did not run', GOOD.replace(/SQLITE TO POSTGRES EXPORT: PASS\n/, '')],
  ['the tour did not run', GOOD.replace(/✔ E2E SUITE[^\n]*\n/, '')],
  ['nothing ran (empty log)', '']
]) {
  const r = verify(log);
  ok(r.status === 1 && /CHECK COUNTS: FAIL/.test(r.stderr), `a dropped suite fails: ${what} (exit ${r.status})`);
}
{
  const r = cli('verify', 'platform/edition.log', '--manifest', manifestPath, '--log', path.join(scratch, 'never-written.log'));
  ok(r.status === 1 && /does not exist/.test(r.stderr), 'a log the step never wrote fails');
  const unknown = cli('verify', 'platform/no-such.log', '--manifest', manifestPath);
  ok(unknown.status === 2, 'an unknown group is an error, never a pass');
}
// ── a dropped pin or group fails the retire check ────────────────────────────
{
  const head = JSON.parse(JSON.stringify(fixture));
  head.groups['platform/edition.log'].pins.splice(1, 1); // drop BILLING
  const missing = unannouncedRemovals(fixture, head);
  ok(missing.length === 1 && missing[0].shape === shapeOf({ has: 'BILLING PER EDITION: PASS — 123/123 checks —' }), 'removing a pin from the manifest is an unannounced removal');
  const r = cli('retire-check', '--manifest', file('head.json', serialize(head)), '--base-file', manifestPath);
  ok(r.status === 1 && /CHECK COUNTS RETIRE: FAIL/.test(r.stderr), 'and the retire check fails CI');
  head.retired.push({ group: 'platform/edition.log', shape: missing[0].shape, reason: 'the billing suite moved to platform/billing.log (#900)' });
  ok(unannouncedRemovals(fixture, head).length === 0, 'a retired record with a reason announces it');
  const r2 = cli('retire-check', '--manifest', file('head2.json', serialize(head)), '--base-file', manifestPath);
  ok(r2.status === 0, `and the retire check passes (exit ${r2.status})`);
  const later = JSON.parse(JSON.stringify(head)); later.retired = [];
  ok(unannouncedRemovals(head, later).some(m => m.retiredRecord), 'a retired record cannot be deleted later');
  ok(manifestProblems({ ...head, retired: [{ group: 'platform/edition.log', shape: missing[0].shape, reason: '' }] }).length > 0, 'a retired record needs a reason');
}
{
  const head = JSON.parse(JSON.stringify(fixture)); delete head.groups['platform/edition.log'];
  ok(unannouncedRemovals(fixture, { ...head, groups: {} }).length === 6, 'dropping a whole group is six unannounced removals');
}
{
  // Two pins of one shape (one "E2E SUITE …" per tour): dropping one is still caught.
  const two = { version: 1, groups: { 'browser/browser.log': { job: 'browser', log: 'browser.log', pins: [{ re: 'E2E SUITE.*25/25.*1 flows' }, { re: 'E2E SUITE.*13/13.*1 flows' }] } }, retired: [] };
  const one = JSON.parse(JSON.stringify(two)); one.groups['browser/browser.log'].pins.pop();
  ok(unannouncedRemovals(two, one).length === 1, 'pins sharing a shape are counted, so dropping one of them is caught');
}
{
  // A count change is not a removal.
  const bumped = JSON.parse(JSON.stringify(fixture));
  bumped.groups['platform/edition.log'].pins[0].has = 'EDITION AGREEMENT (E2): PASS — 160/160 checks';
  ok(unannouncedRemovals(fixture, bumped).length === 0, 'a changed count keeps the pin (same shape)');
}
// ── regen re-reads numbers, and only numbers ──────────────────────────────────
{
  const up = GOOD.replace('155/155', '160/160').replace('25/25', '26/26');
  const r = regen(fixture, up);
  ok(r.errors.length === 0 && r.changes.length === 2, `regen adopts two raised counts (${r.errors.join('; ')})`);
  ok(verifyGroup(r.manifest, 'platform/edition.log', up).ok, 'and the regenerated manifest verifies against that log');
  ok(r.manifest.groups['platform/edition.log'].pins.length === 6, 'regen never adds or drops a pin');
}
{
  const r = regen(fixture, GOOD.replace('155/155', '154/154'));
  ok(r.errors.length === 1 && /lowers 155 to 154/.test(r.errors[0]), 'regen refuses to lower a count (a dropped check) without --allow-decrease');
  ok(regen(fixture, GOOD.replace('155/155', '154/154'), { allowDecrease: true }).errors.length === 0, 'and accepts it when the reviewer passes --allow-decrease');
}
{
  const r = regen(fixture, GOOD.replace('155/155', '154/155'));
  ok(r.errors.length === 1 && /no line of the log has the shape/.test(r.errors[0]), 'regen keeps N/N an equal pair: a partial pass is never adopted');
}
{
  const r = regen(fixture, GOOD.replace('PASS — 0 of', 'PASS — 3 of'));
  ok(r.errors.length === 1, 'regen never changes a literal 0 (0 wrong answers credited is the invariant)');
}
{
  const r = regen(fixture, GOOD.replace(/BILLING PER EDITION[^\n]*\n/, ''));
  ok(r.errors.length === 1 && /did not run/.test(r.errors[0]), 'regen cannot adopt a suite that did not run');
}
{
  const r = cli('regen', '--manifest', manifestPath, '--log', file('down.log', GOOD.replace('155/155', '150/150')));
  ok(r.status === 1 && readFileSync(manifestPath, 'utf8') === serialize(fixture), 'a failed regen writes nothing');
}
{
  // Several suites print one shape: the one after the previous pin's line is taken.
  const pins = [{ has: 'Cloud admin · CMS lifecycle' }, { re: 'E2E SUITE.*25/25.*1 flows' }, { has: 'AI tutor · three levels' }, { re: 'E2E SUITE.*33/33.*2 flows' }];
  const log = ['Cloud admin · CMS lifecycle', 'E2E SUITE PASSED — 26/26 checks across 1 flows', 'AI tutor · three levels', 'E2E SUITE PASSED — 34/34 checks across 2 flows'].join('\n');
  const m = { version: 1, groups: { 'browser/browser.log': { job: 'browser', log: 'browser.log', pins } }, retired: [] };
  const r = regen(m, log);
  ok(r.errors.length === 0 && r.manifest.groups['browser/browser.log'].pins[1].re === 'E2E SUITE.*26/26.*1 flows' && r.manifest.groups['browser/browser.log'].pins[3].re === 'E2E SUITE.*34/34.*2 flows', `same-shape tours are told apart by position (${r.errors.join('; ')})`);
}
{
  const r = regenPin({ has: 'DISTINCT QUESTIONS: Class 7 ≥ 2.98×10^8 — 6/6 classes at the 10^8 target' }, 'DISTINCT QUESTIONS: Class 7 ≥ 3.01×10^8 — 6/6 classes at the 10^8 target');
  ok(!r.error && r.pin.has.includes('3.01×10^8') && r.pin.has.includes('the 10^8 target'), 'a decimal measurement is re-read; the 10^8 target is not a measurement');
}
// ── count pins keep grep -c semantics ─────────────────────────────────────────
ok(pinHolds({ has: 'x', count: 1, op: 'eq' }, 'a x\nb') && !pinHolds({ has: 'x', count: 1, op: 'eq' }, 'x\nx x'), 'eq counts lines, as grep -c does');
ok(pinHolds({ re: 'E2E SUITE PASSED.*65/65.*1 flows', count: 2, op: 'ge' }, 'E2E SUITE PASSED — 65/65 checks across 1 flows\nE2E SUITE PASSED — 65/65 checks across 1 flows'), 'ge is a floor');
// ── the merge driver resolves neighbouring count changes, one pin at a time ───
{
  const ours = JSON.parse(JSON.stringify(fixture)); ours.groups['platform/edition.log'].pins[0].has = 'EDITION AGREEMENT (E2): PASS — 156/156 checks';
  const theirs = JSON.parse(JSON.stringify(fixture)); theirs.groups['platform/edition.log'].pins[1].has = 'BILLING PER EDITION: PASS — 130/130 checks —';
  theirs.groups['platform/edition.log'].pins.push({ has: 'DESK ISOLATION: PASS — 39/39 checks' });
  const { manifest, conflicts } = merge3(fixture, ours, theirs);
  const pins = manifest.groups['platform/edition.log'].pins.map(p => p.has ?? p.re);
  ok(conflicts.length === 0 && pins[0].includes('156/156') && pins[1].includes('130/130') && pins.at(-1).includes('DESK ISOLATION'), 'adjacent changes from two lanes merge cleanly, with the new pin');
  const a = file('O.json', serialize(fixture)); const b = file('A.json', serialize(ours)); const c = file('B.json', serialize(theirs));
  const r = cli('merge', a, b, c);
  ok(r.status === 0 && JSON.parse(readFileSync(b, 'utf8')).groups['platform/edition.log'].pins.length === 7, 'the git merge driver writes the merged manifest and exits 0');
}
{
  const ours = JSON.parse(JSON.stringify(fixture)); ours.groups['platform/edition.log'].pins[0].has = 'EDITION AGREEMENT (E2): PASS — 156/156 checks';
  const theirs = JSON.parse(JSON.stringify(fixture)); theirs.groups['platform/edition.log'].pins[0].has = 'EDITION AGREEMENT (E2): PASS — 158/158 checks';
  ok(merge3(fixture, ours, theirs).conflicts.length === 1, 'two lanes changing the same count is a conflict (regenerate on the merged tree)');
  const r = cli('merge', file('O2.json', serialize(fixture)), file('A2.json', serialize(ours)), file('B2.json', serialize(theirs)));
  ok(r.status === 1, 'and the driver reports it to git');
}
{
  const theirs = JSON.parse(JSON.stringify(fixture)); theirs.groups['platform/edition.log'].pins.splice(2, 1);
  ok(merge3(fixture, fixture, theirs).manifest.groups['platform/edition.log'].pins.length === 5, 'a pin one side removed stays removed (and the retire check then asks why)');
}
// ── the committed manifest ────────────────────────────────────────────────────
{
  const m = loadManifest();
  const pins = Object.values(m.groups).reduce((n, g) => n + g.pins.length, 0);
  ok(pins >= 340 && Object.keys(m.groups).length >= 40, `the committed manifest carries the ci.yml pins (${pins} in ${Object.keys(m.groups).length} groups)`);
  ok(serialize(m) === readFileSync(path.join(path.dirname(TOOL), '..', 'ci', 'check-counts.json'), 'utf8'), 'the committed manifest is in canonical form (one pin per line), so regen and merge produce minimal diffs');
}

rmSync(scratch, { recursive: true, force: true });
console.log(`CI CHECK COUNTS: PASS — ${count}/${count} checks — a dropped check, a dropped suite, a missing log and an unannounced manifest removal each fail; regen only re-reads numbers and never lowers one silently; the merge driver resolves neighbouring count changes`);
