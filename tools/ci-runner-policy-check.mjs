import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

const ci = read('ci.yml');
const person2 = read('person2-india-platform.yml');
const durability = read('data-durability.yml');
const person1 = read('person1-intelligence.yml');
const jee = read('jee-question-department.yml');
const hybrid = read('ink-hybrid.yml');

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

for (const [name, source] of [['CI', ci], ['Person 2', person2], ['Ink Hybrid', hybrid]]) {
  assert.match(source, /workflow_dispatch:/, `${name} must retain an explicit manual validation path`);
  assert.match(source, /push:\s*\n\s+branches:\s*\[main\]/,
    `${name} feature branches must validate through pull_request instead of a duplicate push run`);
}

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

console.log('PASS — release workflows keep only authoritative heads, avoid duplicate feature-branch push runs, and scope Ink Hybrid to handwriting changes.');
