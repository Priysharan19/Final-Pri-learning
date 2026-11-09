#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a notice may not reach production ahead of the code it promises
//
// A notice is true or false at the release that serves it, and the privacy
// notice is the page the store listings point at. One promise was published
// before the code that keeps it: owner default D18, that an under-18 account
// nobody confirmed, or whose guardian withdrew, is deleted 30 days after that,
// and that a guardian can ask for erasure without the child's login. Merging the
// notice first is fine; promoting it to production first is not.
//
// scripts/release-nominate.mjs calls legalPromiseGaps() on the nominated commit
// and refuses the nomination while a promise there has no code there. It reads
// the commit, not the working tree, because the nominated SHA is what ships.
//
//   node tools/legal-promises.mjs     report on this checkout; exit 1 on a gap
//
// The evidence is a name, so it is deliberately narrow: an implementation under
// a name these patterns miss fails the nomination loudly, and the fix is to read
// that code and add its name here, never to drop the requirement. A notice that
// stops making the promise stops being held to it.
//
// Some promises are true only where a deployment setting is on. D18's automatic
// rule runs only with PRI_CHILD_ERASURE=enforce (the accounts stream's default
// counts the accounts and erases nothing, because D18 is provisional). Code can
// show the setting exists, not that production has it, so legalPromiseSettings()
// names it and the nomination prints it for the operator to confirm.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROMISES = Object.freeze([
  {
    id: 'D18 erasure of an unconfirmed or withdrawn child account',
    notice: 'docs/legal/privacy.md',
    // The wording since 9 Nov 2026 ("closed … erased 7 days later"), and the
    // earlier one, so neither can slip past the gate.
    says: /erased\s+7\s+days\s+later|deleted\s+30\s+days\s+after\s+that/,
    needs: [
      {
        what: 'a housekeeping job that erases those accounts',
        files: ['server/platform/housekeeping.js'],
        // housekeeping.js has no account purge at a5778a319, and its existing
        // purges (sessions, tokens, nonces, exams) name none of these words.
        // runChildErasure( is the accounts stream's name (#736, childErasure.js).
        code: /\b(?:erase|purge|delete|sweep)\w*(?:child|guardian|unconfirmed|minor|consent)\w*\s*\(|\b(?:child|guardian|unconfirmed|minor|consent)\w*(?:erase|erasure|purge|delet|sweep)\w*\s*\(|\brunChildErasure\s*\(/i
      },
      {
        what: 'a route that lets a guardian ask for erasure without the child\'s login',
        files: ['server/platform/otp.js', 'server/platform/guardianConsent.js', 'server/platform/accounts.js'],
        // A guardian route named for deletion. /delete-request is the account
        // holder's own and /guardian/withdraw only stops processing; neither counts.
        // The accounts stream's is POST /v1/account/guardian/erase in accounts.js (#736).
        code: /router\.\w+\(\s*'[^']*guardian[^']*(?:eras|delet)/i
      }
    ],
    settings: [
      {
        name: 'PRI_CHILD_ERASURE=enforce',
        why: 'without it production only counts these accounts and the 30-day rule erases nothing (server/platform/childErasure.js); a guardian\'s own request is honoured either way'
      }
    ]
  }
]);

/**
 * The deployment settings a commit's notices depend on: one line per setting of
 * every promise whose wording the notice carries. Code cannot see production's
 * environment, so these are for the operator to confirm, not a pass.
 */
export async function legalPromiseSettings(readAt, promises = PROMISES) {
  const lines = [];
  for (const promise of promises) {
    let notice;
    try { notice = await readAt(promise.notice); } catch { continue; }
    if (!promise.says.test(notice)) continue;
    for (const setting of promise.settings || []) lines.push(`${setting.name} on production (${promise.id}): ${setting.why}`);
  }
  return lines;
}

/**
 * The promises a commit's notices make and its code does not keep.
 * `readAt(path)` returns a file's text at the commit and rejects if it is absent.
 * A notice that cannot be read is a gap: the caller cannot show it is safe.
 */
export async function legalPromiseGaps(readAt, promises = PROMISES) {
  const gaps = [];
  for (const promise of promises) {
    let notice;
    try { notice = await readAt(promise.notice); }
    catch (error) {
      gaps.push(`${promise.notice} could not be read at this commit (${error?.message || error})`);
      continue;
    }
    if (!promise.says.test(notice)) continue;
    for (const need of promise.needs) {
      const sources = await Promise.all(need.files.map(file => Promise.resolve(readAt(file)).catch(() => '')));
      if (!sources.some(source => need.code.test(source))) {
        gaps.push(`${promise.id}: ${promise.notice} promises it, but ${need.files.join(' and ')} do not contain ${need.what}`);
      }
    }
  }
  return gaps;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const readAt = async path => readFileSync(join(root, path), 'utf8');
  const gaps = await legalPromiseGaps(readAt);
  for (const gap of gaps) console.error(`  ✗ ${gap}`);
  for (const setting of await legalPromiseSettings(readAt)) console.log(`  · requires ${setting}`);
  console.log(gaps.length
    ? `LEGAL PROMISES: GAP — ${gaps.length} promise(s) in the notices are not in this code; this commit cannot be nominated for production`
    : 'LEGAL PROMISES: PASS — every promise the notices make is in this code');
  process.exit(gaps.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
