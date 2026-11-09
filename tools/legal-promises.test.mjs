// A notice may not be promoted ahead of the code it promises.
//
// Fixtures only, on purpose: the real tree has a gap today and loses it when the
// accounts stream lands, and a test of this gate must pass on both sides of that.
// `npm run test:legal` runs this file, so CI does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legalPromiseGaps, legalPromiseSettings } from './legal-promises.mjs';
import { nominate } from '../scripts/release-nominate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = 'a'.repeat(40);
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };

const PROMISE = 'closed: it stops working and every sign-in on it ends. Everything it holds is\nerased 7 days later.';
const OLD_PROMISE = 'or if they withdraw, the account and everything it holds are deleted\n30 days after that.';
const reader = files => async path => {
  if (path in files) return files[path];
  throw new Error(`${path} is not at this commit`);
};
const notice = { 'docs/legal/privacy.md': PROMISE };
const housekeeping = { 'server/platform/housekeeping.js': 'const n = await purgeUnconfirmedChildAccounts(db, now);' };
const route = { 'server/platform/otp.js': "router.post('/guardian/erasure-request', rateLimit(db, 'x', {}), handler);" };

// ── the gate ────────────────────────────────────────────────────────────────
ok((await legalPromiseGaps(reader({ ...notice, ...housekeeping, ...route }))).length === 0,
  'a commit with the promise, the job and the route has no gap');
ok((await legalPromiseGaps(reader({ ...notice }))).length === 2,
  'the promise with neither the job nor the route is two gaps');
const noRoute = await legalPromiseGaps(reader({ ...notice, ...housekeeping }));
ok(noRoute.length === 1 && /a route that lets a guardian ask/.test(noRoute[0]), 'a job without the guardian route is a gap');
const noJob = await legalPromiseGaps(reader({ ...notice, ...route }));
ok(noJob.length === 1 && /housekeeping job/.test(noJob[0]), 'a route without the job is a gap');
ok((await legalPromiseGaps(reader({ 'docs/legal/privacy.md': 'No such promise.' }))).length === 0,
  'a notice that does not make the promise is not held to it');
ok((await legalPromiseGaps(reader({ 'docs/legal/privacy.md': OLD_PROMISE }))).length === 2,
  'the earlier wording ("deleted 30 days after that") is held to the same code');

// The accounts stream's own names (#736): runChildErasure( in housekeeping and
// POST /guardian/erase in accounts.js, beside /guardian/withdraw.
const accountsStream = {
  ...notice,
  'server/platform/housekeeping.js': "import { runChildErasure } from './childErasure.js';\n    childErasure = await runChildErasure(db, {",
  'server/platform/accounts.js': "router.post('/guardian/withdraw', handler);\n  router.post('/guardian/erase', rateLimit(db, 'guardian-erase', { limit: 20 }), async (req, res) => {"
};
ok((await legalPromiseGaps(reader(accountsStream))).length === 0, 'the accounts stream\'s runChildErasure( and POST /guardian/erase close both gaps');
ok((await legalPromiseGaps(reader({ ...accountsStream, 'server/platform/accounts.js': "router.post('/guardian/withdraw', handler);" }))).length === 1,
  'accounts.js with only /guardian/withdraw is still the route gap');

// A promise that holds only where production sets a variable says so.
const settings = await legalPromiseSettings(reader(accountsStream));
ok(settings.length === 1 && /^PRI_CHILD_ERASURE=enforce on production/.test(settings[0]), 'the D18 promise names PRI_CHILD_ERASURE=enforce as a production setting');
ok((await legalPromiseSettings(reader({ 'docs/legal/privacy.md': 'No such promise.' }))).length === 0, 'a notice without the promise needs no setting');
const unreadable = await legalPromiseGaps(reader({}));
ok(unreadable.length === 1 && /could not be read/.test(unreadable[0]), 'a notice that cannot be read at the commit fails closed');

// Today's code must not satisfy the gate by accident: the purges and routes that
// exist at a5778a319 are not the erasure path, whatever they are called.
const existing = {
  ...notice,
  'server/platform/housekeeping.js': [
    "import { purgeStaleLoginAttempts } from './loginLockout.js';",
    'await sweepExpiredExams(db, { now });',
    'oidcNonces: await purgeOidcNonces(db, now),',
    "WHERE (expires_at < ? AND purpose != 'guardian-withdraw') OR (consumed_at IS NOT NULL)"
  ].join('\n'),
  'server/platform/otp.js': [
    "router.post('/delete-request', handler);",
    "router.post('/delete-confirm', handler);",
    "router.post('/guardian/withdraw-request', handler);",
    "router.post('/guardian/withdraw', handler);"
  ].join('\n')
};
ok((await legalPromiseGaps(reader(existing))).length === 2, 'the account holder\'s delete routes and the existing purges do not count as the erasure path');

// D17 (#737): a notice that says nothing is sent until the student agrees
// needs the prompt's record and its text naming OpenAI at the same commit.
const d17Notice = { 'docs/legal/privacy.md': '**Nothing is sent until you agree.** The first time a picture would be sent' };
const d17Code = {
  'client/src/ink/readerPermission.js': 'export const READER_PERMISSION_VERSION = 1;',
  'client/src/i18n/strings.en.js': "  'readerPermission.leadInk': 'To read your handwriting, Pri’s server sends a picture of it to OpenAI, an AI company.',"
};
ok((await legalPromiseGaps(reader({ ...d17Notice, ...d17Code }))).length === 0, 'the D17 notice with the prompt and its OpenAI text has no gap');
ok((await legalPromiseGaps(reader(d17Notice))).length === 2, 'the D17 notice without the prompt is two gaps');
ok((await legalPromiseGaps(reader({ ...d17Notice, ...d17Code, 'client/src/i18n/strings.en.js': "  'readerPermission.leadInk': 'Pri’s server sends a picture to an outside service.'," }))).length === 1,
  'prompt text that does not name OpenAI is a gap');

// ── the nomination reads the commit, and refuses on a gap ───────────────────
const report = async files => nominate({
  sha: SHA,
  fetchOrigin: false,
  git: async args => {
    if (args[0] === 'rev-parse' && args[1] === '--verify') return `${SHA}\n`;
    if (args[0] === 'show') return reader(files)(args[1].slice(SHA.length + 1));
    throw new Error('not needed here');
  },
  gh: async () => { throw new Error('not needed here'); },
  fetchImpl: async () => ({ status: 404, json: async () => null })
});
const ROW = 'the notices promise nothing this commit does not do';
const gapRow = (await report({ ...notice })).results.find(row => row.label === ROW);
ok(gapRow?.ok === false && /housekeeping job/.test(gapRow.detail), 'nomination fails at a commit whose notice runs ahead of its code, and says why');
const cleanReport = await report({ ...notice, ...housekeeping, ...route });
const cleanRow = cleanReport.results.find(row => row.label === ROW);
ok(cleanRow?.ok === true, 'nomination passes that row once the code is at the commit');
const settingRow = cleanReport.results.find(row => /production settings the notices depend on/.test(row.label));
ok(settingRow?.ok === null && /PRI_CHILD_ERASURE=enforce/.test(settingRow.detail || ''), 'and prints PRI_CHILD_ERASURE=enforce for the operator to confirm, without claiming it is set');
const source = readFileSync(join(ROOT, 'scripts/release-nominate.mjs'), 'utf8');
ok(/legalPromiseGaps\(path => git\(\['show', `\$\{expected\}:\$\{path\}`\]\)\)/.test(source),
  'the nomination asks about the nominated commit, not the working tree');

console.log(`LEGAL PROMISES GATE: PASS — ${count}/${count} checks — a notice cannot be nominated for production ahead of the code it promises.`);
