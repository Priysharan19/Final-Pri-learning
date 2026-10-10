// P0 contract. A test that only checks navigator.onLine is not sufficient:
// it can be true after a severed network and is not a grading receipt.
// Keep this RED until the platform routes and client acknowledgement are wired.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');
const segment = src.split("'POST /practice/:id/submit': async (body, params) => {")[1]
  ?.split("\n  },")[0];
assert.ok(segment, 'the canonical practice submission handler must exist');
assert.doesNotMatch(segment, /(?:^|\n)\s*const\s*\{\s*result[^\n]*\}\s*=\s*markSubmission\(/m,
  'the device must not calculate an authoritative result in its submit handler before a real server acknowledgement');
assert.match(segment, /await\s+(?:[\w.]+)?(?:submit|grade|acknowledge|authority|markOnServer)[\w.]*\s*\(/i,
  'local submission must await an actual authoritative server action');
assert.match(segment, /submissionId/, 'same persisted submission id must survive a retry');
console.log('ONLINE GRADING CLIENT BOUNDARY PASS — no local authoritative mark, server ack required.');
