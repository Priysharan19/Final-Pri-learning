// Railway deploy contract and the post-deploy verifier (ADR-0001 phase 4).
//
// 1. railway.json builds the root Dockerfile, gates a deploy on /v1/ready (a
//    route the server actually mounts), and gives the process longer to drain
//    than its own shutdown deadline, so Railway never SIGKILLs a clean exit.
// 2. tools/verify-deployment.mjs passes only an origin serving exactly the
//    nominated SHA on both server and web, at this checkout's schema versions,
//    with web checkout off as the notices say, and fails on each single drift.
// 3. tools/verify-deployment-proxy.mjs (#653) tells a server that counts its
//    anonymous rate limits per client apart from one that counts the proxy's
//    edge node, or that a forged X-Forwarded-For can escape.
import assert from 'node:assert/strict';
// The staging journey proof (2b below): staging only, one release, no secrets in its evidence.
import { PROFILES as journeyProfiles, parseArgs as journeyArgs, redact as journeyRedact, report as journeyReport, verdictOf as journeyVerdict, assertJourneyOrigin, runJourney } from './staging-journey-proof.mjs';
import { codeFromSubject, imapSession, loadInbox, mailboxOver, redactAddress, tagAddress } from './staging-inbox.mjs';
import { e2eAddress, parseLatest, testMailbox, testMailboxState, TEST_MAILBOX_LABEL } from './staging-test-mailbox.mjs';
import { decodeQuotedPrintable, imapBodySession, linkFromBody, linkKindOfSubject, linkReaderOver } from './staging-journey-mail.mjs';
import { inkPlan, isPaidReadRequest, isReaderRequest, otherWritable, rupeeAmountOf, writable } from './staging-journey-steps.mjs';
import { outboxLinks, outboxMailbox, parseLocalArgs } from './staging-journey-local.mjs';
import { otpEmailMessage } from '../server/platform/otpEmail.js';
import { buildAuthActionUrl } from '../server/platform/authDelivery.js';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import { parseArgs, verifyDeployment } from './verify-deployment.mjs';
import { classify } from './verify-deployment-proxy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };

// ── 1 · railway.json ────────────────────────────────────────────────────────
const railway = JSON.parse(readFileSync(join(ROOT, 'railway.json'), 'utf8'));
ok(railway.build?.builder === 'DOCKERFILE' && railway.build?.dockerfilePath === 'Dockerfile', 'Railway builds the root Dockerfile');
ok(!railway.build?.buildCommand && !railway.deploy?.startCommand, 'Railway does not override the image build or CMD');
ok(railway.deploy?.healthcheckPath === '/v1/ready', 'the deploy healthcheck is readiness, not liveness');
const router = readFileSync(join(ROOT, 'server', 'platform', 'router.js'), 'utf8');
ok(/router\.get\('\/ready'/.test(router), '/v1/ready is a mounted route');
const index = readFileSync(join(ROOT, 'server', 'index.js'), 'utf8');
const deadline = Number(index.match(/PRI_SHUTDOWN_DEADLINE_MS\)\s*\|\|\s*([\d_]+)/)?.[1]?.replace(/_/g, ''));
ok(Number.isFinite(deadline) && railway.deploy.drainingSeconds * 1000 > deadline,
  `drainingSeconds (${railway.deploy.drainingSeconds}s) exceeds the server's shutdown deadline (${deadline}ms)`);
ok(railway.deploy?.restartPolicyType === 'ON_FAILURE', 'a crashed process is restarted, a clean exit is not');
const containerWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'deployment-image.yml'), 'utf8');
ok(containerWorkflow.includes("'railway.json'"), 'the container workflow runs when railway.json changes');

// ── 1b · the SERVER_DOWN backstop watches both hosts and stays read-only ───
{
  const uptime = readFileSync(join(ROOT, '.github', 'workflows', 'staging-uptime.yml'), 'utf8');
  const { STAGING_ORIGIN, PRODUCTION_ORIGIN } = await import('../scripts/release-nominate.mjs');
  ok(uptime.includes(`base_url: ${STAGING_ORIGIN}`) && uptime.includes(`base_url: ${PRODUCTION_ORIGIN}`), 'the SERVER_DOWN backstop probes both the staging and the production origin the release tools use');
  ok(/fail-fast: false/.test(uptime), 'one host being down never cancels the probe of the other');
  ok(/^permissions:\n  contents: read\n\n/m.test(uptime) && !/secrets\./.test(uptime) && !/actions\/checkout/.test(uptime), 'the backstop is read-only: contents:read, no secrets, no checkout');
  ok(!/curl[^\n]*(-X|--request|--data|-d )/.test(uptime) && /\/v1\/health \/v1\/ready/.test(uptime), 'the backstop only GETs /v1/health and /v1/ready');
  ok(/BACKSTOP, not paging/.test(uptime) && /best-effort/.test(uptime), 'the workflow says it is a best-effort backstop, not the 1-minute SERVER_DOWN page');
  {
    // A hanging host must FAIL the job, not let it be cancelled at timeout-minutes (a cancelled
    // scheduled run emails nobody): the worst-case probe time must fit inside the job bound.
    const num = re => Number((uptime.match(re) || [])[1]);
    const maxTime = num(/--max-time (\d+)/), retries = num(/--retry (\d+)/), retryDelay = num(/--retry-delay (\d+)/), pause = num(/^\s*sleep (\d+)$/m);
    const paths = ((uptime.match(/for path in ([^;]+);/) || [])[1] || '').trim().split(/\s+/).length;
    const attempts = ((uptime.match(/for attempt in ([^;]+);/) || [])[1] || '').trim().split(/\s+/).length;
    const worst = paths * attempts * ((retries + 1) * maxTime + retries * retryDelay + pause);
    const bound = num(/timeout-minutes: (\d+)/) * 60;
    ok(Number.isFinite(worst) && worst > 0 && worst + 60 <= bound, `a hanging host fails the backstop before GitHub cancels it (worst case ${worst} s + 60 s setup within ${bound} s)`);
  }
  const alertsDoc = readFileSync(join(ROOT, 'docs', 'operations', 'alerts.md'), 'utf8');
  ok(/SERVER_DOWN` external \*\*backstop\*\*/.test(alertsDoc) && !/probes staging `\/v1\/health` and `\/v1\/ready` every 5 minutes/.test(alertsDoc), 'alerts.md does not claim a 5-minute check GitHub does not deliver');
}

// ── 2 · preflight agrees with the server about which database is required ──
const preflight = env => execFileSync(process.execPath, [join(ROOT, 'tools', 'production-preflight.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
ok(/^  PRI_PLATFORM_DB$/m.test(preflight({})), 'preflight asks for PRI_PLATFORM_DB on SQLite');
// The staging test mailbox (server/platform/testMailboxPolicy.js) must be off
// under any configuration the production preflight is run for: it refuses
// (exit 1) whenever the mailbox would be on, and says "off" otherwise.
const preflightStatus = env => {
  try { return { status: 0, out: preflight(env) }; } catch (error) { return { status: error.status, out: String(error.stdout || '') }; }
};
const PROD = { NODE_ENV: 'production', PRI_PUBLIC_ORIGIN: 'https://app.prilearning.com' };
for (const [label, env] of [
  ['a shell in test mode', { NODE_ENV: 'test' }],
  ['a Railway staging environment', { NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'staging', PRI_PUBLIC_ORIGIN: 'https://pri-learning-staging-staging.up.railway.app' }]
]) {
  const run = preflightStatus(env);
  ok(run.status === 1 && /test mailbox would be ON/.test(run.out), `preflight refuses ${label}: the test mailbox would be on`);
}
for (const [label, env] of [
  ['Railway production', { ...PROD, RAILWAY_ENVIRONMENT_NAME: 'production' }],
  ['a prilearning.com origin even in an environment named staging', { ...PROD, RAILWAY_ENVIRONMENT_NAME: 'staging' }],
  ['a production shell with no Railway variable', PROD]
]) {
  const run = preflightStatus(env);
  ok(run.status === 0 && /Staging test mailbox: off/.test(run.out), `preflight passes the mailbox check for ${label}`);
}
ok(!/^  PRI_PLATFORM_DB$/m.test(preflight({ PRI_DATABASE_URL: 'postgresql://role@db.example/postgres?sslmode=verify-full' })),
  'preflight does not ask for PRI_PLATFORM_DB once PRI_DATABASE_URL selects Postgres');
const envExample = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
// #218: production refuses to start with no mail transport, so preflight must
// list the three auth-email variables as required, not optional.
const bare = preflight({});
for (const name of ['PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM']) {
  ok(new RegExp(`^  ${name}$`, 'm').test(bare), `preflight asks for ${name} as a required variable`);
}
ok(!/'re_[A-Za-z0-9]/.test(bare), 'preflight never prints anything shaped like a Resend key');
const email = from => preflight({ PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: 'set', PRI_AUTH_EMAIL_FROM: from });
ok(!/^  PRI_AUTH_EMAIL_FROM$/m.test(email('Pri Learning <verify@mail.prilearning.com>')) && !/Auth email will not reach/.test(email('Pri Learning <verify@mail.prilearning.com>')),
  'a readable sender on a real domain is accepted without a warning');
ok(/Resend's test sender/.test(email('Pri <onboarding@resend.dev>')), 'preflight warns that the resend.dev test sender reaches nobody but the account owner');
ok(/example domain/.test(email('Pri Learning <noreply@example.com>')), 'preflight warns when the template\'s example sender was pasted unchanged');
ok(/not an address the server can read/.test(email('Pri Learning')), 'preflight warns about a sender with no address');
ok(/only provider the server supports/.test(preflight({ PRI_AUTH_EMAIL_PROVIDER: 'smtp' })), 'preflight warns about an unsupported provider');
ok(/PRI_DATABASE_URL=/.test(envExample) && /PRI_DATABASE_SSL_ROOT_CERT=/.test(envExample), '.env.production.example documents the Postgres variables');
// D3: launch signs in with an email code and a password. SMS, Apple and Google
// stay off, so the template leaves them unset and preflight flags a leftover.
ok(!/^PRI_SMS_PROVIDER=\S/m.test(envExample) && !/^PRI_(GOOGLE|APPLE)_(WEB_CLIENT_ID|CLIENT_IDS)=\S/m.test(envExample),
  '.env.production.example leaves SMS, Google and Apple sign-in off (D3)');
ok(!/launch keeps off/.test(bare), 'preflight raises no sign-in warning when SMS, Google and Apple are unset');
ok(/PRI_SMS_PROVIDER is set/.test(preflight({ PRI_SMS_PROVIDER: 'msg91' })), 'preflight warns that a set PRI_SMS_PROVIDER offers phone codes at launch (D3)');
ok(/PRI_GOOGLE_CLIENT_IDS is set/.test(preflight({ PRI_GOOGLE_CLIENT_IDS: 'id.apps.googleusercontent.com' }))
  && /PRI_APPLE_CLIENT_IDS, PRI_APPLE_WEB_CLIENT_ID are set/.test(preflight({ PRI_APPLE_CLIENT_IDS: 'com.example', PRI_APPLE_WEB_CLIENT_ID: 'com.example.web' })),
  'preflight warns that Google or Apple sign-in would show at launch (D3)');

// ── 2b · staging-journey-proof: staging only, one release, no secrets ──────
{
  const SHA40 = 'b'.repeat(40);
  const STAGING = 'https://pri-learning-staging-staging.up.railway.app';
  ok(journeyArgs(['--sha', SHA40]).origin === STAGING, 'the journey proof defaults to the staging origin');
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'https://prilearning.com']), /refused/); count += 1;
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'https://final-pri-learning-production.up.railway.app']), /refused/); count += 1;
  assert.throws(() => journeyArgs([]), /--sha/); count += 1;
  ok(journeyArgs(['--sha', SHA40, '--accounts']).accounts === true && journeyArgs(['--sha', SHA40]).accounts === false, 'accounts are made only with an explicit --accounts');

  const steps = list => ({ steps: list.map((status, i) => ({ id: String(i), status })) });
  ok(journeyVerdict(steps(['PASS', 'SYNTHETIC-PASS'])).exit === 0 && journeyVerdict(steps(['PASS', 'BLOCKED'])).verdict === 'INCOMPLETE'
    && journeyVerdict(steps(['PASS', 'BLOCKED'])).exit === 3 && journeyVerdict(steps(['BLOCKED', 'FAIL'])).exit === 1 && journeyVerdict(steps([])).exit === 1,
    'the journey is PROVEN (0) only when every step passed, INCOMPLETE (3) when one is blocked, FAIL (1) otherwise');
  ok(Object.values(journeyProfiles).every(b => b.register <= 4 && b.otpRequest <= 16 && b.login <= 9) && journeyProfiles.train.otpRequest * 2 <= 20 && journeyArgs(['--sha', SHA40]).profile === 'train',
    'every profile stays inside staging\'s limits (register 8/h, OTP 20/h, login 12/15 min); two train runs fit in an hour');
  assert.throws(() => journeyArgs(['--sha', SHA40, '--profile', 'everything']), /profile/); count += 1;
  const red = journeyRedact({ email: 'delivered+x@resend.dev', password: 'Pri-secret-staging', challengeId: 'abc', token: 't', nested: { sessionToken: 's', blockerCode: null, error: { code: 'EMAIL_UNVERIFIED' } }, blockerCode: 'GUARDIAN_CONSENT_PENDING', eligible: false });
  const flat = JSON.stringify(red);
  ok(!/Pri-secret|"abc"|"t"|"s"/.test(flat) && red.password === '[redacted]' && red.challengeId === '[redacted]', 'evidence redacts passwords, challenge ids and tokens');
  ok(red.nested.error.code === 'EMAIL_UNVERIFIED' && red.blockerCode === 'GUARDIAN_CONSENT_PENDING' && red.nested.blockerCode === null && red.eligible === false,
    'evidence keeps machine error codes, nulls and booleans');
  const md = journeyReport({ sha: SHA40, origin: STAGING, startedAt: 'a', finishedAt: 'b', accounts: true, deployed: {}, created: [{ role: 'adult', email: 'x@resend.dev' }], deleted: [], notDeleted: [{ role: 'adult', email: 'x@resend.dev', why: 'test' }],
    steps: [{ id: '2', name: 'n', status: 'FAIL', checks: [{ label: 'l', ok: false, detail: '' }], notes: [], evidence: [], shots: [], defects: [{ what: 'w', where: 'x', repro: 'r', lane: 'L2' }], blocked: [] }] });
  ok(/\| 2 · n \| \*\*FAIL\*\*/.test(md) && /\*\*Defect\*\* \(L2\)/.test(md) && /\*\*Not deleted: adult x@resend\.dev — test\.\*\*/.test(md),
    'the report lists each step\'s status, its defects with the owning lane, and every account it could not delete');

  // A loopback origin is reachable only through the local entry, never the CLI.
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'http://127.0.0.1:4173']), /refused/); count += 1;
  assert.throws(() => journeyArgs(['--sha', SHA40, '--origin', 'http://localhost:4173', '--accounts']), /refused/); count += 1;
  const fakePlatform = { origin: 'http://127.0.0.1:4173', close() {} };
  ok(assertJourneyOrigin({ origin: STAGING }) === 'staging' && assertJourneyOrigin({ origin: fakePlatform.origin, localPlatform: fakePlatform }) === 'local',
    'the journey runs on staging, or on loopback only with the in-process platform object in hand');
  for (const bad of [{ origin: 'http://127.0.0.1:4173' }, { origin: 'http://127.0.0.1:4173', localPlatform: { origin: 'http://127.0.0.1:9999', close() {} } },
    { origin: 'http://127.0.0.1:4173', localPlatform: 'http://127.0.0.1:4173' }, { origin: 'https://prilearning.com', localPlatform: { origin: 'https://prilearning.com', close() {} } }]) {
    assert.throws(() => assertJourneyOrigin(bad), /refused/); count += 1;
  }
  await assert.rejects(() => runJourney({ origin: 'http://127.0.0.1:4173', sha: SHA40, accounts: true, profile: 'train' }), /refused/); count += 1;
  assert.throws(() => parseLocalArgs(['--origin', STAGING]), /takes no origin/); count += 1;
  assert.throws(() => parseLocalArgs(['--out', join(ROOT, 'docs', 'release', 'evidence', 'x')]), /outside the repository/); count += 1;
  ok(!parseLocalArgs([]).out.startsWith(ROOT) && parseLocalArgs(['--profile', 'full']).profile === 'full', 'local evidence defaults to a directory outside the repository');
  ok(Object.values(journeyProfiles).every(b => Number.isInteger(b.paidReads) && b.paidReads > 0 && b.paidReads <= 20), 'every profile caps the paid reads a run may buy at 20 or fewer');
  const localMd = journeyReport({ sha: SHA40, origin: fakePlatform.origin, local: 'LOCAL in-process platform', startedAt: 'a', accounts: true, deployed: {}, created: [], deleted: [], notDeleted: [], steps: [] });
  ok(/^# LOCAL journey proof \(not staging\)/.test(localMd) && /not staging evidence and not real-reader evidence/.test(localMd), 'a local run\'s report says, first, that it is not staging or real-reader evidence');

  // The practice steps' pure parts.
  ok(isPaidReadRequest('POST', '/v1/handwriting/transcribe') && isPaidReadRequest('POST', '/v1/practice/3f1c0a52-1111-4222-8333-944455556666/recognize') && isPaidReadRequest('POST', '/v1/question-photo/identify')
    && !isPaidReadRequest('GET', '/v1/handwriting/status') && !isPaidReadRequest('POST', '/v1/practice/abc/submit'), 'a paid read is a POST to the reader, the recognize route or question-photo identify');
  ok(isReaderRequest('/v1/handwriting/status') && isReaderRequest('/v1/handwriting') && isReaderRequest('/v1/practice/x/recognize') && !isReaderRequest('/v1/practice/x/submit') && !isReaderRequest('/v1/handwritingx'),
    'D17 watches every request to the reader\'s routes, a status probe included');
  ok(writable('-6') && writable('42') && !writable('3/4') && !writable('₹ 98.1 crore') && otherWritable('11') === '12' && otherWritable('-6') === '11', 'SYNTHETIC ink writes whole numbers, and draws a different one from the target');
  ok(JSON.stringify(rupeeAmountOf('A film shot in Pune earned ₹981 million at the box office. Write this amount in crores of rupees.')) === '{"amount":"98.1","unit":"crore"}'
    && rupeeAmountOf('The cost of building a flyover in Agra is ₹12 crore 34 lakh. An English business newspaper reports the cost in millions of rupees. Write the cost in millions of rupees.')?.amount === '123.4'
    && rupeeAmountOf('A school in Pune collected ₹120 lakh for flood relief. A report for an international charity gives the amount in millions of rupees. Write the amount in millions of rupees.')?.amount === '12'
    && rupeeAmountOf('Find the 10th term of the AP 2, 5, 8, …') === null, 'the #723 probe reads the amount a ₹-priced scale-word question asks for from its prompt alone');
  {
    const box = { x: 10, y: 400, width: 350, height: 220 };
    const plan = inkPlan(['-987654'], box);
    const pts = plan.flat();
    ok(plan.length >= 7 && pts.every(p => p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height),
      'SYNTHETIC ink strokes are scaled inside the canvas they are drawn on');
  }

  // Email links (a guardian's consent and withdrawal): subject, transfer encodings, origin.
  const LINK = `${STAGING}/guardian/consent#action=guardian-consent&token=AbCdEfGhIjKlMnOpQrStUvWx_0123456789-yz`;
  ok(linkKindOfSubject('=?UTF-8?Q?Confirm_your_child=E2=80=99s_Pri_Learning_account?=') === 'guardian-consent'
    && linkKindOfSubject('Your child’s Pri Learning account is confirmed — keep this email') === 'guardian-withdraw' && linkKindOfSubject('482913 is your Pri Learning code') === null,
    'link mail is recognised by the subjects Pri sends');
  ok(decodeQuotedPrintable('caf=C3=A9 =\r\nau lait') === 'café au lait', 'quoted-printable soft breaks and UTF-8 bytes are decoded');
  const qpBody = `--b\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${(`Confirm here: ${LINK}`).replace(/=/g, '=3D').replace(/(.{70})/g, '$1=\r\n')}\r\n--b--`;
  const b64Body = `--b\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(`<p><a href="${LINK.replace('&', '&amp;')}">Confirm</a></p>`).toString('base64').replace(/(.{76})/g, '$1\r\n')}\r\n--b--`;
  ok(linkFromBody(`Confirm here:\n\n${LINK}\n`, 'guardian-consent', STAGING) === LINK && linkFromBody(qpBody, 'guardian-consent', STAGING) === LINK && linkFromBody(b64Body, 'guardian-consent', STAGING) === LINK,
    'the consent link is found in plain, quoted-printable and base64 (HTML) bodies');
  ok(linkFromBody(`Confirm here: ${LINK.replace(STAGING, 'https://evil.example')}`, 'guardian-consent', STAGING) === null && linkFromBody(`Confirm here: ${LINK}`, 'guardian-withdraw', STAGING) === null
    && linkFromBody(`${STAGING}/guardian/consent#action=guardian-consent&token=short`, 'guardian-consent', STAGING) === null,
    'only a well-formed link of the asked kind to the journey\'s own origin is taken');
  {
    const net = await import('node:net');
    const to = 'qa+pri-ab12cd-3@inbox.example';
    const body = `Confirm here:\r\n\r\n${LINK}\r\nL9 OK not a status line inside a literal\r\n`;
    const server = net.createServer(sock => {
      sock.setEncoding('utf8'); sock.write('* OK fake IMAP ready\r\n');
      let buf = '';
      sock.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          const [tag, cmd] = line.split(' ');
          if (cmd === 'LOGIN' || cmd === 'SELECT') sock.write(`${tag} OK done\r\n`);
          else if (cmd === 'UID' && / SEARCH /.test(line)) sock.write((line.includes(to) ? '* SEARCH 4 5\r\n' : '* SEARCH\r\n') + `${tag} OK search done\r\n`);
          else if (cmd === 'UID' && /HEADER\.FIELDS/.test(line)) {
            const subject = line.includes('FETCH 4 ') ? '482913 is your Pri Learning code' : '=?UTF-8?Q?Confirm_your_child=E2=80=99s_Pri_Learning_account?=';
            const hdr = `Subject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\n\r\n`;
            sock.write(`* 1 FETCH (UID 4 BODY[HEADER.FIELDS (SUBJECT DATE)] {${Buffer.byteLength(hdr)}}\r\n${hdr})\r\n${tag} OK fetch done\r\n`);
          } else if (cmd === 'UID' && /BODY\.PEEK\[TEXT\]/.test(line)) sock.write(`* 2 FETCH (UID 5 BODY[TEXT] {${Buffer.byteLength(body)}}\r\n${body})\r\n${tag} OK fetch done\r\n`);
          else if (cmd === 'LOGOUT') { sock.write(`* BYE\r\n${tag} OK bye\r\n`); sock.end(); }
          else sock.write(`${tag} BAD unknown\r\n`);
        }
      });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const open = () => new Promise(r => { const c = net.connect(server.address().port, '127.0.0.1', () => r(c)); });
    const reader = linkReaderOver(() => imapBodySession(open), { PRI_STAGING_INBOX_USER: 'u', PRI_STAGING_INBOX_PASSWORD: 'p' }, STAGING, { pollMs: 20 });
    const got = await reader.waitForLink(to, 'guardian-consent', Date.now() - 1000, 2000);
    const none = await reader.waitForLink(to, 'guardian-withdraw', Date.now() - 1000, 100);
    ok(got.link === LINK && none.link === null, 'the IMAP body reader returns the consent link (a status-like line inside a literal does not end the fetch), and no link for a kind not sent');
    server.close();
  }

  // The local entry's inbox: the server's test outbox, classified by the subjects the server would send.
  {
    const box = 'journey.local+pri-ab12cd-1@example.test';
    const outbox = [{ channel: 'email', to: box, code: '111111', purpose: 'sign-in', at: Date.now() }, { channel: 'email', to: box, code: '222222', purpose: 'guardian-consent', at: Date.now() },
      { channel: 'email', to: box, code: '333333', purpose: 'reauth', intent: 'account-delete', at: Date.now() }];
    const platform = { origin: 'http://127.0.0.1:4173', sms: { readTestOutbox: ({ to }) => outbox.filter(m => m.to === to) } };
    const mail = outboxMailbox(platform, otpEmailMessage, { pollMs: 5 });
    const codes = await Promise.all(['sign-in', 'guardian', 'delete'].map(p => mail.waitForCode(box, p, Date.now() - 5000, 50)));
    ok(codes.map(c => c.code).join() === '111111,222222,333333' && (await mail.waitForCode('other@example.test', 'sign-in', Date.now(), 20)).code === null,
      'the local inbox reads the server\'s test outbox through the same subject parser as the real inbox');
    const row = { account_id: 'acct_1', kind: 'guardian-consent', token_id: 'tok_1', token_ciphertext: 'sealed' };
    const db = { prepare: () => ({ get: (to, kind) => (to === 'parent@example.test' && kind === 'guardian-consent' ? row : undefined) }) };
    const links = outboxLinks({ origin: platform.origin, h: { db } }, { decryptDeliveryToken: (c, ctx) => (c === 'sealed' && ctx === 'acct_1:guardian-consent:tok_1' ? 'AbCdEfGhIjKlMnOpQrStUv0123' : null), buildAuthActionUrl }, { pollMs: 5 });
    const link = (await links.waitForLink('Parent@example.test', 'guardian-consent', Date.now(), 20)).link;
    ok(link === 'http://127.0.0.1:4173/guardian/consent#action=guardian-consent&token=AbCdEfGhIjKlMnOpQrStUv0123' && (await links.waitForLink('parent@example.test', 'guardian-withdraw', Date.now(), 20)).link === null,
      'the local link reader builds the link the delivery worker would send, from the undelivered outbox row');
  }
}


// ── 2c · staging-inbox: the test inbox file, plus-tags, codes, IMAP ────────
{
  const { mkdtempSync, writeFileSync: write, chmodSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const net = await import('node:net');
  const dir = mkdtempSync(join(tmpdir(), 'pri-inbox-'));
  const file = join(dir, 'staging-inbox.env');
  const SECRET = 'not-a-real-password-7731';
  write(file, `# test\nPRI_STAGING_INBOX_ADDRESS=qa@inbox.example\nPRI_STAGING_INBOX_IMAP_HOST=127.0.0.1\nPRI_STAGING_INBOX_IMAP_PORT=993\nPRI_STAGING_INBOX_USER=qa@inbox.example\nPRI_STAGING_INBOX_PASSWORD="${SECRET}"\n`);
  chmodSync(file, 0o644);
  const loose = loadInbox(file);
  ok(!loose.ok && /mode 644/.test(loose.reason) && !loose.config, 'an inbox file readable by others is refused, and nothing in it is returned');
  chmodSync(file, 0o600);
  const good = loadInbox(file);
  ok(good.ok && good.config.PRI_STAGING_INBOX_PASSWORD === SECRET, 'a mode-600 inbox file is read (quotes stripped)');
  ok(!loadInbox(join(dir, 'missing.env')).ok, 'no inbox file: no inbox (the account steps are then BLOCKED, mailbox)');
  write(file, 'PRI_STAGING_INBOX_ADDRESS=qa@inbox.example\nPRI_STAGING_INBOX_IMAP_PORT=143\nPRI_STAGING_INBOX_IMAP_HOST=h\nPRI_STAGING_INBOX_USER=u\nPRI_STAGING_INBOX_PASSWORD=' + SECRET + '\n');
  chmodSync(file, 0o600);
  const plain = loadInbox(file);
  ok(!plain.ok && /TLS/.test(plain.reason) && !plain.reason.includes(SECRET), 'a plain-text IMAP port is refused, and the reason never carries a value from the file');
  const tagged = tagAddress('qa@inbox.example', 'ab12cd', 3);
  ok(tagged === 'qa+pri-ab12cd-3@inbox.example', 'each account gets a plus-address tag');
  ok(redactAddress(`to ${tagged} and qa@inbox.example`, 'qa@inbox.example') === 'to <inbox>+pri-ab12cd-3 and <inbox>', 'evidence shows only the plus-tag, never the inbox address');
  ok(codeFromSubject('482913 is your Pri Learning code')?.purpose === 'sign-in'
    && codeFromSubject('=?UTF-8?Q?104857_is_the_code_to_approve_your_child=E2=80=99s_Pri_Learning_account?=')?.code === '104857'
    && codeFromSubject('=?UTF-8?B?' + Buffer.from('771020 is the code to delete your Pri Learning account').toString('base64') + '?=')?.purpose === 'delete'
    && codeFromSubject('Your weekly report') === null, 'codes are read from Pri subjects, encoded or not, with their purpose');
  // A fake IMAP server: one message for the tagged address, older mail for another.
  let sawLogin = '';
  const server = net.createServer(sock => {
    sock.setEncoding('utf8'); sock.write('* OK fake IMAP ready\r\n');
    let buf = '';
    sock.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const [tag, cmd] = line.split(' ');
        if (cmd === 'LOGIN') { sawLogin = line; sock.write(`${tag} OK logged in\r\n`); }
        else if (cmd === 'SELECT') sock.write('* 2 EXISTS\r\n' + `${tag} OK [READ-WRITE] selected\r\n`);
        else if (cmd === 'UID' && / SEARCH /.test(line)) sock.write((line.includes(tagged) ? '* SEARCH 7\r\n' : '* SEARCH\r\n') + `${tag} OK search done\r\n`);
        else if (cmd === 'UID' && / FETCH /.test(line)) {
          const hdr = `Subject: 482913 is your Pri Learning code\r\nTo: ${tagged}\r\nDate: ${new Date().toUTCString()}\r\n\r\n`;
          sock.write(`* 1 FETCH (UID 7 BODY[HEADER.FIELDS (SUBJECT TO DATE)] {${Buffer.byteLength(hdr)}}\r\n${hdr})\r\n${tag} OK fetch done\r\n`);
        } else if (cmd === 'LOGOUT') { sock.write(`* BYE\r\n${tag} OK bye\r\n`); sock.end(); }
        else sock.write(`${tag} BAD unknown\r\n`);
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const open = () => new Promise(r => { const c = net.connect(server.address().port, '127.0.0.1', () => r(c)); });
  const box = mailboxOver(() => imapSession(open), { PRI_STAGING_INBOX_USER: 'qa@inbox.example', PRI_STAGING_INBOX_PASSWORD: 'p"w\\x' }, { pollMs: 20 });
  const got = await box.waitForCode(tagged, 'sign-in', Date.now() - 1000, 2000);
  ok(got.code === '482913', 'the IMAP reader finds the code sent to that exact plus-tag');
  ok(sawLogin.includes('"p\\"w\\\\x"'), 'credentials are quoted and escaped in LOGIN');
  const other = await box.waitForCode(tagAddress('qa@inbox.example', 'zz', 9), 'sign-in', Date.now(), 100);
  const wrongKind = await box.waitForCode(tagged, 'delete', Date.now() - 1000, 100);
  ok(other.code === null && wrongKind.code === null, 'no code for another tag or another purpose: the wait times out with null, never a guess');
  server.close();
}

// ── 2d · staging test mailbox (L2): the default code source on staging ─────
{
  ok(e2eAddress('ab12cd', 2) === 'pri-ab12cd-2@e2e.prilearning.test', 'test-mailbox addresses are pri-<run>-<n>@e2e.prilearning.test');
  ok(testMailboxState({ testMailbox: 'on' }) === 'on' && testMailboxState({ checks: { testMailbox: { state: 'off' } } }) === 'off' && testMailboxState({}) === 'unknown',
    '/v1/ready says whether the test mailbox is on (either placement); silence is unknown, never on');
  const now = Date.now();
  ok(parseLatest({ to: 'x', subject: '482913 is your Pri Learning code', receivedAt: now })?.purpose === 'sign-in'
    && parseLatest({ message: { subject: '771020 is the code to delete your Pri Learning account', receivedAt: new Date(now).toISOString() } })?.code === '771020'
    && parseLatest({ code: '123456', purpose: 'guardian' })?.purpose === 'guardian' && parseLatest({ subject: 'Your weekly report' }) === null,
    'a captured message gives its code and purpose from the subject Pri sends; anything else gives nothing');
  const replies = [{ status: 404, body: {} }, { status: 200, body: { subject: '111111 is your Pri Learning code', receivedAt: now - 10 * 60000 } }, { status: 200, body: { subject: '482913 is your Pri Learning code', receivedAt: now } }];
  let calls = 0; let askedFor = '';
  const fake = async url => { askedFor = url; const r = replies[Math.min(calls++, replies.length - 1)]; return { status: r.status, json: async () => r.body }; };
  const box = testMailbox('https://staging.example', { fetchImpl: fake, pollMs: 1 });
  const got = await box.waitForCode('pri-ab-1@e2e.prilearning.test', 'sign-in', now - 1000, 2000);
  ok(got.code === '482913' && askedFor.endsWith('/v1/test-mailbox/latest?to=pri-ab-1%40e2e.prilearning.test'),
    'the reader polls /v1/test-mailbox/latest for that exact address, waits through 404, and skips a code older than the request');
  const wrong = await testMailbox('https://s.example', { fetchImpl: async () => ({ status: 200, json: async () => ({ subject: '482913 is your Pri Learning code', receivedAt: now }) }), pollMs: 1 }).waitForCode('a@e2e.prilearning.test', 'delete', now - 1000, 30);
  ok(wrong.code === null, 'a code for another purpose is never returned: the wait times out with null');
  ok(parseLatest({ to: 'x', subject: '104857 is the code to approve your child\u2019s Pri Learning account', text: '104857', receivedAt: now, code: '104857', purpose: 'guardian' })?.purpose === 'guardian'
    && parseLatest({ subject: 'unparsed', code: '204857', purpose: 'guardian-consent' })?.purpose === 'guardian'
    && parseLatest({ subject: 'unparsed', code: '304857', purpose: 'account-delete' })?.purpose === 'delete',
    "L2's guardian subject (typographic apostrophe) reads as 'guardian'; the reply's own code and purpose are used when the subject does not parse");
  ok(/real inbox not exercised/.test(TEST_MAILBOX_LABEL), 'steps that used the test mailbox say delivery to a real inbox was not exercised');
}

// ── 3 · verify-deployment ───────────────────────────────────────────────────
const SHA = 'a'.repeat(40);
const identity = { releaseSha: SHA, buildTimestamp: '2026-10-02T00:00:00.000Z', version: '4.0.0' };
function healthy() {
  return {
    // Current /v1/health is deliberately redacted: operator-only storage and
    // provider configuration are absent without PRI_METRICS_TOKEN.
    health: {
      ok: true, service: 'pri-learning-platform', releaseIdentity: { ...identity },
      schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION),
      database: { engine: 'postgres', reachable: true }
    },
    ready: {
      ready: true, state: 'ready', releaseSha: SHA, failing: [], degraded: [],
      checks: {
        database: {
          state: 'ok', code: null, engine: 'postgres',
          schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION),
          expectedSchemaVersion: String(SCHEMA_VERSION), expectedBillingSchemaVersion: String(BILLING_SCHEMA_VERSION)
        },
        authEmail: { state: 'ok', code: null, required: true }
      }
    },
    readyStatus: 200,
    web: { ...identity },
    billing: { webCheckout: { provider: 'razorpay', configured: false } },
    billingStatus: 200
  };
}
let state = healthy();
const server = createServer((req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url === '/v1/health') return send(200, state.health);
  if (req.url === '/v1/ready') return send(state.readyStatus, state.ready);
  if (req.url === '/release.json') return send(200, state.web);
  if (req.url === '/v1/billing/config') {
    // The route tells a native client false whatever the server holds, so a
    // verifier that declared itself native would prove nothing.
    if (req.headers['x-pri-client']) return send(200, { webCheckout: { provider: 'razorpay', configured: false, refusedForNativeClient: true } });
    return send(state.billingStatus, state.billing);
  }
  send(404, {});
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const run = (extra = {}) => verifyDeployment({ origin, sha: SHA, allowHttp: true, ...extra });

try {
  ok((await run({ engine: 'postgres' })).ok, 'a deployment at the nominated SHA on Postgres passes');

  const drifts = [
    ['a different running SHA', s => { s.health.releaseIdentity.releaseSha = 'b'.repeat(40); s.web.releaseSha = 'b'.repeat(40); }],
    ['a web bundle from another build', s => { s.web.releaseSha = 'c'.repeat(40); }],
    ['SQLite without persistent-volume proof', s => {
      s.health.database.engine = 'sqlite';
      s.ready.checks.database.engine = 'sqlite';
    }],
    ['an unreachable database', s => {
      s.health.database.reachable = false;
      s.ready.checks.database.state = 'unavailable';
    }],
    ['a database one schema version behind', s => {
      s.health.schemaVersion = String(SCHEMA_VERSION - 1);
      s.ready.checks.database.schemaVersion = String(SCHEMA_VERSION - 1);
    }],
    ['a billing schema mismatch', s => {
      s.health.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1);
      s.ready.checks.database.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1);
    }],
    ['no verification email provider', s => { s.ready.checks.authEmail.state = 'not_configured'; }],
    ['a not_ready replica', s => {
      s.readyStatus = 503;
      s.ready.ready = false;
      s.ready.state = 'not_ready';
      s.ready.failing = ['AUTH_EMAIL_NOT_CONFIGURED'];
    }],
    ['web checkout configured while the notices say there is no purchase on the website', s => { s.billing.webCheckout.configured = true; }],
    ['a billing config that does not say whether web checkout is off', s => { s.billing = {}; }],
    ['no billing config route', s => { s.billingStatus = 404; s.billing = {}; }]
  ];
  for (const [name, mutate] of drifts) {
    state = healthy();
    mutate(state);
    ok(!(await run()).ok, `fails on ${name}`);
  }

  state = healthy();
  state.health.database.engine = 'sqlite';
  state.health.storage = { persistentDatabase: true }; // legacy/operator proof for transitional SQLite
  state.ready.checks.database.engine = 'sqlite';
  ok(!(await run({ engine: 'postgres' })).ok, 'fails when --engine postgres meets a SQLite deployment');
  ok((await run()).ok, 'passes a SQLite deployment when legacy health proves persistent storage');

  state = healthy();
  state.health.database.engine = 'sqlite';
  state.ready.checks.database.engine = 'sqlite';
  ok((await run({ persistentStorageProven: true })).ok, 'passes SQLite when the caller supplies an out-of-band persistence proof');

  state = healthy();
  state.ready.state = 'degraded';
  state.ready.degraded = ['HANDWRITING_PROBE_PENDING'];
  ok((await run()).ok, 'a degraded but serving replica passes');

  ok(!(await verifyDeployment({ origin, sha: 'abc123', allowHttp: true })).ok, 'a short SHA is refused');
  await assert.rejects(() => verifyDeployment({ origin, sha: SHA }), /https/); count += 1;
  await assert.rejects(() => verifyDeployment({ origin: `${origin}/app`, sha: SHA, allowHttp: true }), /bare origin/); count += 1;
  const down = await verifyDeployment({ origin: 'http://127.0.0.1:1', sha: SHA, allowHttp: true });
  ok(!down.ok && down.results.some(item => item.label === 'origin reachable'), 'an unreachable origin fails, it does not throw');

  const parsed = parseArgs(['--origin', 'https://x.example', '--sha', SHA, '--engine', 'sqlite', '--persistent-storage-proven']);
  ok(parsed.engine === 'sqlite' && parsed.persistentStorageProven === true, 'CLI arguments parse, including the out-of-band persistence proof');
  assert.throws(() => parseArgs(['--origin', 'https://x.example'])); count += 1;
} finally {
  server.close();
}

// ── 4 · verify-deployment-proxy: whose address the rate limiters count ─────
{
  const t0 = 1_800_000_000; // a run that started at this second
  const open = t0 + 60;     // a window opened during the run
  const sample = (node, reset, forged = false) => ({ node, reset, forged });
  const nodes = ['sin1.a', 'sin1.b', 'sin1.c'];
  // One client at a fixed address: one bucket whichever edge node carries it.
  const fixed = [...Array(12)].map((_, i) => sample(nodes[i % 3], open));
  const clean = classify([...fixed, ...[...Array(4)].map((_, i) => sample(nodes[i % 3], open, true))], t0);
  ok(clean.verdict === 'SINGLE-BUCKET', 'one bucket across edge nodes, forged headers inside it: SINGLE-BUCKET (consistent with per-client, not proof)');
  const spoofed = classify([...fixed, sample('sin1.a', open, true), sample('sin1.b', open + 3, true)], t0);
  ok(spoofed.verdict === 'SPOOFABLE', 'a forged X-Forwarded-For that gets a bucket of its own is SPOOFABLE');
  // The staging measurement of 8 Nov 2026: one bucket per edge node.
  const perNode = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], open + (i % 3))), t0);
  ok(perNode.verdict === 'PER-EDGE-NODE', 'one bucket per edge node over several nodes is PER-EDGE-NODE');
  // A client whose own address changes per connection: buckets vary within a node.
  const rotating = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], open + i)), t0);
  ok(rotating.verdict === 'INCONCLUSIVE', 'a client whose address changes per connection is INCONCLUSIVE, not a pass');
  const single = classify([...Array(12)].map(() => sample('sin1.a', open)), t0);
  ok(single.verdict === 'INCONCLUSIVE', 'a single edge node cannot tell node from client: INCONCLUSIVE');
  // A bucket that existed before the run can roll over during it; it is not counted.
  const stale = classify([...Array(12)].map((_, i) => sample(nodes[i % 3], t0 + 10 + (i % 3))), t0);
  ok(stale.verdict === 'INCONCLUSIVE' && stale.facts.counted === 0, 'buckets opened before the run are not counted');
  const once = classify([sample('sin1.a', open), sample('sin1.b', open + 1), ...[...Array(8)].map(() => sample('sin1.c', open + 2))], t0);
  ok(once.verdict !== 'PER-EDGE-NODE', 'a node seen once is not enough to call the identity per node');
  // Review of #738: two per-node buckets opened in the same second share a Reset; Remaining shows it.
  const rem = (node, reset, remaining, forged = false) => ({ node, reset, remaining, forged });
  const collide = classify([rem('sin1.a', open, 59), rem('sin1.b', open, 59), rem('sin1.a', open, 58), rem('sin1.b', open, 58), rem('sin1.a', open, 57), rem('sin1.b', open, 57), rem('sin1.a', open, 56), rem('sin1.b', open, 56), rem('sin1.a', open, 55, true)], t0);
  ok(collide.verdict !== 'SINGLE-BUCKET' && collide.facts.collided, 'buckets sharing a Reset second (Remaining repeats) are never read as one bucket');
  const plainRun = [...Array(9)].map((_, i) => rem(nodes[i % 3], open, 59 - i));
  const staleForged = classify([...plainRun, rem('sin1.a', t0 + 5, 40, true)], t0);
  ok(staleForged.verdict === 'SPOOFABLE', 'a forged request landing in an older bucket of its own is an escape, even though its window is not fresh');
  const realIpOnly = classify([...plainRun, { node: 'sin1.a', reset: open, remaining: 49, realIpOnly: true }], t0);
  ok(realIpOnly.verdict === 'INCONCLUSIVE' && /no forged/.test(realIpOnly.reason), 'X-Real-IP samples never satisfy the forged-request guard');
  ok(classify(plainRun.slice(0, 5).concat(rem('sin1.a', open, 50, true)), t0).verdict === 'INCONCLUSIVE', 'too few plain samples is INCONCLUSIVE, never a pass');
  ok(/'SINGLE-BUCKET' \? 0 : out\.verdict === 'INCONCLUSIVE' \? 2 : 1/.test(readFileSync(join(ROOT, 'tools', 'verify-deployment-proxy.mjs'), 'utf8')), 'only SINGLE-BUCKET exits 0');
  const staging = readFileSync(join(ROOT, '.github', 'workflows', 'release-staging-proof.yml'), 'utf8');
  ok(/set \+e\n\s+node tools\/verify-deployment-proxy\.mjs/.test(staging), 'the advisory step turns off bash -e before the probe, so a red verdict cannot fail the proof');
  const proxySource = readFileSync(join(ROOT, 'tools', 'verify-deployment-proxy.mjs'), 'utf8');
  ok(/agent: false/.test(proxySource) && !/method: '(POST|PUT|PATCH|DELETE)'/.test(proxySource) && /'\/v1\/content\/published-index'/.test(proxySource),
    'the proxy probe only sends anonymous GETs to the published content index, each on a new connection');
}

console.log(`DEPLOYMENT CONTRACT — PASS — ${count}/${count} checks`);
