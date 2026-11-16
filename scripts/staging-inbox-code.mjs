#!/usr/bin/env node
// One quick look for a Pri code in the owner's staging test inbox, for the
// native staging journey (scripts/journey-staging.mjs), whose wait loop is
// synchronous and so asks through a child process.
//
//   node scripts/staging-inbox-code.mjs <tagged address> <sign-in|delete|guardian> <since ms> [timeout ms]
//
// Prints one JSON line: {"code":"123456"} or {"code":null,"reason":"…"}. It
// never prints, logs or returns a value from the inbox settings file.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [to, purpose, since, timeout] = process.argv.slice(2);
const say = value => { process.stdout.write(`${JSON.stringify(value)}\n`); };
const module = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'staging-inbox.mjs');
if (!to || !['sign-in', 'delete', 'guardian'].includes(purpose) || !Number.isFinite(Number(since))) { say({ code: null, reason: 'usage' }); process.exit(2); }
if (!existsSync(module)) { say({ code: null, reason: 'tools/staging-inbox.mjs is not on this checkout' }); process.exit(2); }
const inbox = await import(pathToFileURL(module).href);
const loaded = inbox.loadInbox();
if (!loaded.ok) { say({ code: null, reason: loaded.reason }); process.exit(2); }
try {
  const { code } = await inbox.imapMailbox(loaded.config).waitForCode(to, purpose, Number(since), Math.max(1000, Number(timeout) || 4000));
  say(code ? { code } : { code: null, reason: 'not arrived yet' });
} catch (error) {
  say({ code: null, reason: `the inbox could not be read (${error?.code || error?.name || 'error'})` });
}
