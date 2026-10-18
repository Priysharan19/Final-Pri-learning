import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

const ci = read('ci.yml');
const person2 = read('person2-india-platform.yml');
const durability = read('data-durability.yml');
const person1 = read('person1-intelligence.yml');
const jee = read('jee-question-department.yml');
const hybrid = read('ink-hybrid.yml');
const nativeInk = read('native-ink.yml');
const buildInk = read('build-ink-v3-test-model.yml');
const appHealth = read('app-health-agent.yml');

function bounded(name, source, group) {
  assert.match(source, new RegExp(`group:\\s*${group}-\\$\\{\\{ github\\.ref \\}\\}`),
    `${name} must group superseded runs by the PR/branch ref`);
  assert.match(source, /cancel-in-progress:\s*true/,
    `${name} must cancel older heads because only the latest head can merge`);
}

bounded('CI', ci, 'ci');
bounded('Person 2', person2, 'person2-india-platform');
bounded('Data Durability', durability, 'data-durability');
bounded('Person 1', person1, 'person1-intelligence');
bounded('JEE Question Department', jee, 'jee-question-department');
bounded('Ink Hybrid', hybrid, 'ink-hybrid');
bounded('Native Ink', nativeInk, 'native-ink');
// One repository-wide group let two Dependabot PRs rebased in the same minute
// cancel each other's run (#462 was cancelled ten times); the key carries the ref.
bounded('Build Ink V3 Test Model', buildInk, 'ink-v3-test-model');

for (const [name, source] of [['CI', ci], ['Person 2', person2], ['Ink Hybrid', hybrid], ['Native Ink', nativeInk]]) {
  assert.match(source, /workflow_dispatch:/, `${name} must retain an explicit manual validation path`);
  assert.match(source, /push:\s*\n\s+branches:\s*\[main\]/,
    `${name} feature branches must validate through pull_request instead of a duplicate push run`);
}

// Native Ink is the one macOS lane (3-core hosted runners, 60-minute jobs). A
// push + pull_request pair cost two macOS jobs per PR commit and saturated the
// queue on 2026-10-17, starving Pri App Health's macOS job on main.
assert.doesNotMatch(nativeInk, /push:\s*\n\s+paths:/,
  'Native Ink must never return to an unfiltered feature-branch push run');

// Main's own health evidence is never dropped: seven consecutive main runs were
// cancelled by the next merge while the macOS job waited for a runner, and the
// consolidated report then failed with no native artifact. A newer head still
// supersedes a pull-request run.
assert.match(appHealth, /group:\s*pri-app-health-\$\{\{ github\.ref \}\}/,
  'Pri App Health Agent must group runs by ref');
assert.match(appHealth, /cancel-in-progress:\s*\$\{\{ github\.ref != 'refs\/heads\/main' \}\}/,
  'Pri App Health Agent must not cancel an in-progress run on main');

assert.match(hybrid, /pull_request:\s*\n\s+paths:/,
  'Ink Hybrid must be path-scoped on pull requests');
assert.match(hybrid, /'client\/src\/ink\/\*\*'/,
  'Ink Hybrid must cover all handwriting runtime modules');
for (const test of [
  'ink-personal-metric-check.mjs',
  'ink-hybrid-check.mjs',
  'ink-trig-context.mjs',
  'inkcheck-context.mjs'
]) {
  assert.ok(hybrid.includes(test), `Ink Hybrid path scope/invocation lost ${test}`);
}
assert.doesNotMatch(hybrid, /run:\s*npm run/,
  'Ink Hybrid must invoke its four owned tests directly so unrelated package.json metadata cannot trigger it');

// Full CI and Person 2 were the largest queue multipliers: every feature branch
// push used to create a push run in addition to the PR run, and neither workflow
// cancelled superseded PR heads. Keep the production rule explicit.
assert.doesNotMatch(ci, /push:\s*\n\s+pull_request:/,
  'CI must never return to unfiltered feature-branch push execution');
assert.doesNotMatch(person2, /-\s+'india\/\*\*'/,
  'Person 2 push branches must not duplicate India feature-branch PR validation');

console.log('PASS — release workflows keep only authoritative heads, avoid duplicate feature-branch push runs (the macOS lane included), never cancel main\'s health evidence, key Build Ink V3 by ref, and scope Ink Hybrid to handwriting changes.');
