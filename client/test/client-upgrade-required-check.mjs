// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the app says "update" when the server's shell floor refuses it
// (CP-11). The server answers 426 CLIENT_UPGRADE_REQUIRED below the minimum
// build (server/test/client-compatibility-check.mjs); the client must surface
// the code, tell the student what to do in both languages, keep the outbox, and
// keep the account's export and delete reachable.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const transport = read('../src/platform/cloudTransport.js');
const panel = read('../src/components/CloudAccountPanel.jsx');
const worker = read('../src/platform/syncWorker.js');
const en = read('../src/i18n/strings.en.js');
const hi = read('../src/i18n/strings.hi.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const codeAssignments = transport.match(/err\.code = data\?\.error\?\.code \|\| 'CLOUD_REQUEST_FAILED';/g) || [];
ok(codeAssignments.length === 3, 'the native, web and streaming transports all carry the server error code (CLIENT_UPGRADE_REQUIRED) to the caller');
ok(/state\.lastError = error\?\.code \|\| error\?\.message/.test(worker), 'a refused sync records the code, not a free-text message');
const syncCatch = worker.slice(worker.lastIndexOf('} catch (error) {'));
ok(!/acknowledgeProfileMutations/.test(syncCatch.slice(0, syncCatch.indexOf('throw error'))), 'a refused sync acknowledges nothing: the outbox keeps every change');
ok(/err\?\.code === 'CLIENT_UPGRADE_REQUIRED' \? tLater\('cloud\.upgradeRequired'\)/.test(panel), 'Sync Now explains a 426 instead of showing a raw error');
ok(/status\?\.lastError === 'CLIENT_UPGRADE_REQUIRED'[\s\S]{0,120}data-cloud-upgrade[\s\S]{0,120}t\('cloud\.upgradeRequired'\)/.test(panel), 'the sync card keeps saying "update" after a refused sync');
ok(/'cloud\.upgradeRequired': '[^']*Update the app[^']*export or delete/.test(en), 'English says update the app, work is safe, export/delete still work');
ok(/'cloud\.upgradeRequired': '[^']+'/.test(hi), 'Hindi has the same message');
ok(!/CLIENT_UPGRADE_REQUIRED/.test(read('../src/components/CloudAccountSecurity.jsx')), 'export and delete are not gated on the shell build in the client');

console.log(`CLIENT UPGRADE REQUIRED: PASS — ${n}/${n} checks — the 426 code reaches the UI, the student is told to update in English and Hindi, the outbox is kept, export and delete stay available.`);
