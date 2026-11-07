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
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROMISES = Object.freeze([
  {
    id: 'D18 erasure of an unconfirmed or withdrawn child account',
    notice: 'docs/legal/privacy.md',
    says: /deleted\s+30\s+days\s+after\s+that/,
    needs: [
      {
        what: 'a housekeeping job that erases those accounts',
        files: ['server/platform/housekeeping.js'],
        // housekeeping.js has no account purge at a5778a319, and its existing
        // purges (sessions, tokens, nonces, exams) name none of these words.
        code: /\b(?:erase|purge|delete|sweep)\w*(?:child|guardian|unconfirmed|minor|consent)\w*\s*\(|\b(?:child|guardian|unconfirmed|minor|consent)\w*(?:erase|erasure|purge|delet|sweep)\w*\s*\(/i
      },
      {
        what: 'a route that lets a guardian ask for erasure without the child\'s login',
        files: ['server/platform/otp.js', 'server/platform/guardianConsent.js'],
        // A guardian route named for deletion. /delete-request is the account
        // holder's own and /guardian/withdraw only stops processing; neither counts.
        code: /router\.\w+\(\s*'[^']*guardian[^']*(?:eras|delet)/i
      }
    ]
  }
]);

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
  const gaps = await legalPromiseGaps(async path => readFileSync(join(root, path), 'utf8'));
  for (const gap of gaps) console.error(`  ✗ ${gap}`);
  console.log(gaps.length
    ? `LEGAL PROMISES: GAP — ${gaps.length} promise(s) in the notices are not in this code; this commit cannot be nominated for production`
    : 'LEGAL PROMISES: PASS — every promise the notices make is in this code');
  process.exit(gaps.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
