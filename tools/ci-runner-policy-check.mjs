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

// CI fans its two slowest gates out across runners (suites by
// tools/ci-suite-shard.mjs, browser suites by flow group and engine). The
// branch-protection check names must stay on aggregate jobs that run always(),
// fail unless every shard succeeded, and then run the invariant blocks against
// the combined shard logs, so a skipped or cancelled shard can never read as a
// passed required check.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
function job(id) {
  const m = ci.match(new RegExp(`\\n  ${id}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9-]*:\\n|$)`));
  assert.ok(m, `CI must keep the ${id} job`);
  return m[1];
}
for (const [id, name] of [
  ['suites', 'Suites, coverage and accuracy gates'],
  ['browser', 'Browser suites (end-to-end and accessibility)'],
  ['build', 'Client build and offline-first boundary'],
  ['platform', 'Production account, sync and commercial schema']
]) {
  assert.equal(ci.split(`\n    name: ${name}\n`).length - 1, 1, `exactly one CI job is the required check "${name}"`);
  assert.match(job(id), new RegExp(`^    name: ${name.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}\\n`), `the ${id} job carries the required check name "${name}"`);
}
for (const [id, shards] of [['suites', ['suites-shard', 'suites-contracts']], ['browser', ['browser-shard']]]) {
  const body = job(id);
  assert.match(body, new RegExp(`\\n    needs: \\[${shards.join(', ')}\\]\\n`), `${id} must need ${shards.join(', ')}`);
  assert.match(body, /\n    if: always\(\)\n/, `${id} must run always() so a failed or skipped shard fails the required check`);
  for (const shard of shards) {
    const env = shard.toUpperCase().replace(/-/g, '_') + '_RESULT';
    assert.ok(body.includes(`${env}: \${{ needs.${shard}.result }}`) && body.includes(`test "$${env}" = success`),
      `${id} must fail unless ${shard} succeeded`);
  }
}
const suiteShards = job('suites-shard');
assert.match(suiteShards, /shard: \[1, 2, 3, 4\]/, 'the suite matrix is shards 1..4');
assert.match(suiteShards, /node tools\/ci-suite-shard\.mjs --of=4 --shard=\$\{\{ matrix\.shard \}\} --manifest=suite-shard\.json 2>&1 \| tee suites\.log/,
  'each suite shard runs its share of npm test and writes a manifest');
assert.match(job('suites'), /test "\$\(ls -d suite-shards\/suites-shard-\* \| wc -l\)" -eq 4\n\s+node tools\/ci-suite-shard\.mjs --verify --of=4 /,
  'the suites gate proves all four manifests together completed every npm test suite exactly once');
assert.match(job('suites'), /- name: Exact coverage invariants\n/, 'the suites gate keeps the exact coverage invariants');
assert.match(job('browser'), /- name: Browser coverage invariants\n/, 'the browser gate keeps the browser coverage invariants');
// Every command of npm run test:e2e runs, in its order, in the browser groups.
const e2eChain = pkg.scripts['test:e2e'].split('&&').map(s => s.trim());
const browserCommands = [...job('browser-shard').matchAll(/^\s+((?:node|npm run) \S.*?) 2>&1 \| tee -a browser\.log$/gm)].map(m => m[1]);
const at = browserCommands.indexOf(e2eChain[0]);
assert.ok(at >= 0 && e2eChain.every((cmd, i) => browserCommands[at + i] === cmd),
  'the browser groups must run every command of npm run test:e2e, in order (update ci.yml when test:e2e changes)');
// The tours CI adds beyond test:e2e (both engines, the photo page, ink canvas
// loss, and the platform tours repeated on tour-ai-tutor.js's build).
for (const cmd of [
  'npm run test:a11y', 'npm run test:boot',
  'node client/test/tour-cloud-platform.js --no-build',
  'node client/test/tour-admin-cms-platform.js --no-build',
  'node client/test/tour-admin-independent-review.js --no-build',
  'node client/test/tour-responsive-matrix.js --no-build',
  'node client/test/tour-responsive-matrix.js --no-build --browser=webkit',
  'node client/test/tour-iphone-layout.js --no-build',
  'node client/test/tour-iphone-layout.js --no-build --browser=webkit',
  'node client/test/tour-activation-gate.js --no-build --browser=webkit',
  'node client/test/tour-photo-answer.js --no-build',
  'node client/test/ink-canvas-loss-browser-check.mjs'
]) {
  const expected = e2eChain.filter(c => c === cmd).length + 1;
  assert.equal(browserCommands.filter(c => c === cmd).length,
    cmd.startsWith('npm run') ? 1 : expected, `the browser groups must run ${cmd} as the single job did`);
}
const groups = (job('browser-shard').match(/group: \[([^\]]+)\]/) || [])[1]?.split(',').map(s => s.trim()) || [];
assert.ok(groups.length >= 2, 'the browser matrix names its groups');
for (const g of groups) {
  assert.ok(job('browser-shard').includes(`\n            ${g})\n`), `browser group ${g} has commands`);
}
assert.match(job('browser'), new RegExp(`for group in ${groups.join(' ')}; do[\\s\\S]*?-eq ${groups.length}\\n`),
  'the browser gate combines exactly one log from every group');

console.log('PASS — release workflows keep only authoritative heads, avoid duplicate feature-branch push runs (the macOS lane included), never cancel main\'s health evidence, key Build Ink V3 by ref, and scope Ink Hybrid to handwriting changes; the sharded suites and browser gates keep their required check names, fail on any unsuccessful shard and run every npm test and test:e2e suite.');
