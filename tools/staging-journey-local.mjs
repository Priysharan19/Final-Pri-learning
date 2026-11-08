#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging journey, proved LOCALLY. Not staging evidence.
//
// tools/staging-journey-proof.mjs drives the deployed product on staging and
// nothing else. Its account steps cannot be tried there until the owner's
// test inbox exists, so this entry runs the SAME journey code against the
// in-process platform the browser suites use (client/test/support/
// online-session.mjs): the real server routes, database, sessions, marking
// engine and the built client — with three stand-ins, each labelled in the
// report:
//   · the handwriting READER is the SYNTHETIC stand-in: it returns the text the
//     harness drew and never looks at the picture (not real-reader evidence);
//   · email CODES come from the server's test email adapter's outbox, read
//     through the inbox's own subject parser (codeFromSubject);
//   · email LINKS (a guardian's consent and withdrawal) come from the server's
//     undelivered auth-delivery outbox, decrypted at this desk exactly as the
//     delivery worker would before sending.
// The free practice cap runs at its shipped default (20) and the paid-call
// ceiling at production's 120 an hour / 300 a day, as on staging.
//
//   ~/Developer/.pri-fleet/heavy-slot.sh L8 node tools/staging-journey-local.mjs [--profile full] [--out <dir>] [--dist <client dist>]
//
// Needs a built client (client/dist). Evidence is written OUTSIDE the
// repository (default: <tmp>/pri-staging-journey-local/<stamp>). There is no
// --origin: the only origin this entry reaches is the loopback server it
// booted itself, and runJourney accepts that origin only with the platform
// object in hand (assertJourneyOrigin).
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { codeFromSubject } from './staging-inbox.mjs';
import { PROFILES, runJourney, verdictOf } from './staging-journey-proof.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_INBOX = 'journey.local@example.test';

export function parseLocalArgs(argv) {
  const args = { profile: 'train', out: null, dist: join(ROOT, 'client', 'dist'), headed: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--profile') args.profile = String(argv[++i] || '');
    else if (flag === '--out') args.out = resolve(String(argv[++i] || ''));
    else if (flag === '--dist') args.dist = resolve(String(argv[++i] || ''));
    else if (flag === '--headed') args.headed = true;
    else throw new Error(`Unknown argument: ${flag} (the local entry takes no origin: it reaches only the server it boots)`);
  }
  if (!PROFILES[args.profile]) throw new Error(`--profile must be ${Object.keys(PROFILES).join(' or ')}`);
  args.out = args.out || join(tmpdir(), 'pri-staging-journey-local', new Date().toISOString().replace(/[:.]/g, '-'));
  if ((args.out + sep).startsWith(ROOT + sep)) throw new Error('refused: local evidence is written outside the repository (it is not staging evidence)');
  return args;
}

/**
 * The inbox's interface over the server's TEST email outbox: the code the
 * server sent to `to`, classified by the subject the server would have given
 * the mail (otpEmailMessage) and the inbox's own parser.
 */
export function outboxMailbox(platform, otpEmailMessage, { pollMs = 200 } = {}) {
  return {
    async waitForCode(to, purpose, since, timeoutMs = 120000) {
      const started = Date.now();
      for (;;) {
        const hit = platform.sms.readTestOutbox({ to: String(to).toLowerCase(), channel: 'email' })
          .filter(m => !m.at || m.at >= since - 1000)
          .map(m => codeFromSubject(otpEmailMessage(m.code, m.purpose, platform.origin, { intent: m.intent ?? null }).subject))
          .filter(c => c && c.purpose === purpose).at(-1);
        if (hit) return { code: hit.code, waitedMs: Date.now() - started };
        if (Date.now() - started > timeoutMs) return { code: null, waitedMs: Date.now() - started };
        await new Promise(r => setTimeout(r, pollMs));
      }
    }
  };
}

/** The link reader's interface over the server's undelivered auth-delivery outbox. */
export function outboxLinks(platform, { decryptDeliveryToken, buildAuthActionUrl }, { pollMs = 200 } = {}) {
  return {
    async waitForLink(to, kind, since, timeoutMs = 3000) {
      const started = Date.now();
      for (;;) {
        const row = platform.h.db.prepare(`SELECT account_id, kind, token_id, token_ciphertext FROM auth_delivery_outbox
          WHERE destination = ? AND kind = ? AND created_at >= ? AND delivered_at IS NULL ORDER BY created_at DESC LIMIT 1`)
          .get(String(to).toLowerCase(), kind, since - 1000);
        if (row) {
          const token = decryptDeliveryToken(row.token_ciphertext, `${row.account_id}:${row.kind}:${row.token_id}`);
          return { link: buildAuthActionUrl(platform.origin, kind, token), waitedMs: Date.now() - started };
        }
        if (Date.now() - started > timeoutMs) return { link: null, waitedMs: Date.now() - started };
        await new Promise(r => setTimeout(r, pollMs));
      }
    }
  };
}

export async function runLocalJourney(args) {
  if (!existsSync(join(args.dist, 'index.html'))) throw new Error(`no built client at ${args.dist}: node --input-type=module -e "const { ensureBuild } = await import('./client/test/e2e.mjs'); ensureBuild(true);"`);
  const { startOnlinePlatform } = await import('../client/test/support/online-session.mjs');
  const { otpEmailMessage } = await import('../server/platform/otpEmail.js');
  const { decryptDeliveryToken } = await import('../server/platform/deliveryCrypto.js');
  const { buildAuthActionUrl } = await import('../server/platform/authDelivery.js');
  const platform = await startOnlinePlatform({ dist: args.dist, env: { PRI_FREE_PRACTICE_PER_DAY: null, PRI_PAID_CALLS_PER_HOUR: '120', PRI_PAID_CALLS_PER_DAY: '300' } });
  try {
    const release = JSON.parse(readFileSync(join(args.dist, 'release.json'), 'utf8'));
    return await runJourney({
      origin: platform.origin, sha: release.releaseSha, accounts: true, out: args.out, headed: args.headed, profile: args.profile,
      localPlatform: platform,
      localLabel: `LOCAL in-process platform (client ${args.dist === join(ROOT, 'client', 'dist') ? 'client/dist' : args.dist} built at ${release.releaseSha.slice(0, 9)}), SYNTHETIC reader stand-in, test email adapters — not staging evidence`,
      inbox: { ok: true, config: { PRI_STAGING_INBOX_ADDRESS: LOCAL_INBOX } },
      mailboxLabel: 'LOCAL: the server\'s test email outbox (no mail sent)',
      mailbox: outboxMailbox(platform, otpEmailMessage),
      links: outboxLinks(platform, { decryptDeliveryToken, buildAuthActionUrl })
    });
  } finally {
    await platform.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = parseLocalArgs(process.argv.slice(2));
  const run = await runLocalJourney(args);
  for (const s of [...run.steps].sort((a, b) => Number(a.id) - Number(b.id))) console.log(`  ${s.id.padStart(2)} ${s.status.padEnd(14)} ${s.name}`);
  console.log(`  accounts made ${run.created.length}, deleted ${run.deleted.length}, NOT deleted ${run.notDeleted.length}; paid reads ${run.usage?.paidReads ?? 0}/${run.budget?.paidReads}`);
  const { verdict } = verdictOf(run);
  console.log(`LOCAL JOURNEY (not staging evidence): ${verdict} — ${run.steps.filter(s => s.status === 'PASS' || s.status === 'SYNTHETIC-PASS').length} passed, ${run.steps.filter(s => s.status === 'FAIL').length} failed, ${run.steps.filter(s => s.status === 'BLOCKED').length} blocked · ${run.sha} · report ${join(args.out, 'report.md')}`);
  process.exit(verdictOf(run).exit);
}
