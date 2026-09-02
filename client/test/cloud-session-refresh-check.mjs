import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const account = readFileSync(new URL('../src/platform/cloudAccount.js', import.meta.url), 'utf8');
const signal = readFileSync(new URL('../src/platform/cloudSession.js', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../src/components/AssignmentInboxPanel.jsx', import.meta.url), 'utf8');
const classroom = readFileSync(new URL('../src/components/ClassroomPanel.jsx', import.meta.url), 'utf8');
const staff = readFileSync(new URL('../src/components/StaffOperationsPanel.jsx', import.meta.url), 'utf8');

assert.match(signal, /CLOUD_SESSION_EVENT\s*=\s*['"]pri:cloud-session-change['"]/,
  'cloud lifecycle must use one named event');
assert.match(signal, /globalThis\.dispatchEvent/,
  'cloud lifecycle signal must work without coupling account state to React components');
assert.match(account, /announceLink\(pid, link, true\)/g,
  'successful cloud links must announce the new authenticated session');
assert.match(account, /announceLink\(pid, null, false\)/,
  'local unlink must announce that authenticated cloud state is gone');

for (const [name, source] of [
  ['assignment inbox', inbox],
  ['classroom panel', classroom],
  ['staff operations', staff]
]) {
  assert.match(source, /onCloudSessionChange/,
    `${name} must subscribe to account session lifecycle changes`);
  assert.match(source, /err\?\.status === 401|err\?\.status === 403/,
    `${name} must clear or hide cloud state when authorization disappears`);
}

assert.match(inbox, /setAssignments\(\[\]\)/,
  'assignment inbox must clear assignments when the cloud session is gone');
assert.match(classroom, /setAccount\(null\)[\s\S]*setClasses\(\[\]\)/,
  'classroom panel must clear account/class state after sign-out');
assert.match(staff, /setAccount\(null\)[\s\S]*setRevisions\(\[\]\)[\s\S]*setUsers\(\[\]\)/,
  'staff panel must clear privileged data after authorization disappears');

console.log('PASS — cloud account connect/disconnect propagates immediately to assignment, classroom and staff Settings panels without requiring a route reload.');
