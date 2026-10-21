import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/pri-writer-authority.yml','utf8');
const guide=readFileSync('scripts/reliability/PHASE4_ACTIVATION_GATES.md','utf8');
let cases=0;
const check=(condition,message)=>{assert.ok(condition,message);cases++};
for(const variable of ['PRI_SIGNER_APP_ID','PRI_SIGNER_APP_PRIVATE_KEY',
  'PRI_ADMISSION_PRIVATE_KEY','PRI_SIGNER_RUNTIME_CERTIFIED']){
  check(workflow.includes(variable),`workflow missing ${variable}`);
  check(guide.includes(variable),`runbook missing ${variable}`);
}
check(!workflow.includes('PRI_GOVERNOR_APP_ID') &&
  !workflow.includes('PRI_GOVERNOR_APP_PRIVATE_KEY'), 'legacy ambiguous signer identity');
for(const permission of ['permission-contents: write','permission-issues: write',
 'permission-pull-requests: read','permission-administration: read',
 'permission-actions: read']) check(workflow.includes(permission),`missing ${permission}`);
check(workflow.includes('name: pri-writer-admission'),'not independently protected environment');
check(workflow.indexOf('Refuse signer activation without independent certification')<
 workflow.indexOf('Obtain dedicated signer App identity'),'credential minted before stop gate');
check(workflow.includes('approved-external-authority-v1'), 'runtime must fail closed');
check(workflow.includes('persist-credentials: false'),'untrusted checkout retained GitHub token');
check(guide.includes('25542737') && guide.includes('25078652'), 'signing freeze documentation removed');
console.log(`PASS: ${cases} exact signer workflow / documented App privileges / pre-token shutdown checks`);
