#!/usr/bin/env node
// Static regression contract for the release boundary. No network or secrets.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fleet = read('.github/workflows/pri-agent-governance.yml');
const staging = read('.github/workflows/release-staging-proof.yml');
const nomination = read('scripts/release-nominate.mjs');

assert.match(fleet, /github\.base_ref == 'deploy\/production'/,
  'production-targeted PR requires a separate explicit guard');
assert.match(fleet, /github\.base_ref != 'deploy\/production'/,
  'release pointer must not be mistaken for an autonomous mission');
assert.match(fleet, /Block production-pointer PR merges[\s\S]*?exit 1/,
  'the release pointer PR guard must fail closed');
assert.match(fleet, /Verify active writer lease[\s\S]*?validate-ledger/,
  'autonomous mission leases cannot be removed');
assert.match(fleet, /HEAD_REF.*agent\/mission/,
  'ordinary agent/mission branch identity guard cannot be removed');
assert.match(staging, /workflows: \["Main Integrity"\]/,
  'staging proof must follow main integrity, not an untrusted PR workflow');
assert.match(staging, /head_branch == 'main'/,
  'only main branch may trigger staging proof');
assert.match(staging, /head_repository\.full_name == github\.repository/,
  'workflow_run must reject fork origins');
assert.match(staging, /persist-credentials: false/,
  'staging proof cannot preserve any git write credentials');
assert.match(staging, /contents: read/,
  'staging proof must be read-only');
assert.doesNotMatch(staging, /contents: write|pull-requests: write|issues: write|\$\{\{\s*secrets\.|railway (up|redeploy|rollback)|git push|update_ref/,
  'staging proof must not have deployment/write capabilities');
assert.match(staging, /--engine postgres --auth-email-proven/,
  'staging proof must validate PostgreSQL and mail configuration');
assert.match(staging, /git merge-base --is-ancestor/,
  'staging candidate must actually be on main');
assert.match(nomination, /--engine sqlite --persistent-storage-proven --auth-email-proven/,
  'production command must reflect persistent SQLite until an approved cutover');
console.log('RELEASE AUTOMATION BOUNDARY: PASS (14 assertions)');
