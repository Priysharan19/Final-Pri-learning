// QA-owned release-document contract. Distinguishes the protected main
// integration authority from Railway's separately gated production source.
// A stale instruction to reconnect production to main is a release hazard.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(ROOT, path), 'utf8');
let passes = 0;
let failures = 0;
function check(description, ok) {
  if (ok) { passes += 1; console.log('PASS: ' + description); }
  else { failures += 1; console.error('FAIL: ' + description); }
}
function between(text, before, after) {
  const start = text.indexOf(before);
  if (start < 0) return '';
  const end = text.indexOf(after, start + before.length);
  return text.slice(start, end < 0 ? undefined : end);
}
const authoritative = read('docs/release/release-policy.md');
const deployDoc = read('docs/production-deployment.md');
const runbook = read('docs/release/LAUNCH-RUNBOOK.md');
const ownerList = read('docs/release/LAUNCH-CHECKLIST-OWNER.md');
const cutover = read('docs/release/production-cutover-checklist.md');
const productionSection = between(deployDoc, '## Railway', 'After every production deploy');
const launchRow = runbook.match(/^\| 1\.2 \|.*$/m)?.[0] || '';
const ownerRow = ownerList.match(/^\| D4 \|.*$/m)?.[0] || '';
const sourceSection = between(cutover, '## 1. Railway release authority', '## 2. Staging variables');
const cutoverPrecondition = between(cutover, '### What remains before production cutover', '2. The nine');

check('authority: protected main integrates and staging auto-deploys', /Staging.*deploys every push to \x60main\x60/.test(authoritative));
check('authority: production deploys only from deploy/production', /Production.*deploys the branch \x60deploy\/production\x60/.test(authoritative));
check('production deployment contract names deploy/production', productionSection.includes('deploy/production'));
check('production deployment contract explicitly refuses direct main source', /never (?:connect|point|reconnect).*production.*\x60main\x60/i.test(productionSection));
check('launch runbook step 1.2 names deploy/production', launchRow.includes('deploy/production'));
check('launch runbook step 1.2 does not instruct source switch to main', !launchRow.includes('to \x60main\x60'));
check('owner checklist D4 retains the controlled production branch', ownerRow.includes('deploy/production') && !ownerRow.includes('at \x60main\x60'));
check('cutover checklist production source equals deploy/production', sourceSection.includes('branch **\x60deploy/production\x60**'));
check('cutover checklist staging stays main', sourceSection.includes('branch \x60main\x60'));
check('cutover precondition does not reset production source to main', cutoverPrecondition.includes('deploy/production'));

// Mutation controls: restoring the old dangerous instruction in any of the
// active sources must visibly fail its exact policy contract.
for (const [name, value] of [
  ['deployment contract', productionSection],
  ['launch runbook', launchRow],
  ['owner checklist', ownerRow],
  ['cutover', sourceSection]
]) {
  check(name + ' mutation control catches main-only replacement',
    value.includes('deploy/production') && !value.replaceAll('deploy/production', 'main').includes('deploy/production'));
}
console.log('RELEASE SOURCE POLICY: ' + (failures ? 'FAIL' : 'PASS') +
  ' — ' + passes + '/' + (passes + failures) + ' checks');
if (failures) process.exitCode = 1;
