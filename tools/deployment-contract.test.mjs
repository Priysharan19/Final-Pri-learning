// Railway deploy contract and the post-deploy verifier (ADR-0001 phase 4).
//
// 1. railway.json builds the root Dockerfile, gates a deploy on /v1/ready (a
//    route the server actually mounts), and gives the process longer to drain
//    than its own shutdown deadline, so Railway never SIGKILLs a clean exit.
// 2. tools/verify-deployment.mjs passes only an origin serving exactly the
//    nominated SHA on both server and web, at this checkout's schema versions,
//    and fails on each single drift.
import assert from 'node:assert/strict';
// The staging journey proof (2b below): staging only, one release, no secrets in its evidence.
import { PROFILES as journeyProfiles, parseArgs as journeyArgs, redact as journeyRedact, report as journeyReport, verdictOf as journeyVerdict } from './staging-journey-proof.mjs';
import { codeFromSubject, imapSession, loadInbox, mailboxOver, redactAddress, tagAddress } from './staging-inbox.mjs';
import { e2eAddress, parseLatest, testMailbox, testMailboxState, TEST_MAILBOX_LABEL } from './staging-test-mailbox.mjs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import { parseArgs, verifyDeployment } from './verify-deployment.mjs';

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
ok(!/^  PRI_PLATFORM_DB$/m.test(preflight({ PRI_DATABASE_URL: 'postgresql://role@db.example/postgres?sslmode=verify-full' })),
  'preflight does not ask for PRI_PLATFORM_DB once PRI_DATABASE_URL selects Postgres');
const envExample = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
ok(/PRI_DATABASE_URL=/.test(envExample) && /PRI_DATABASE_SSL_ROOT_CERT=/.test(envExample), '.env.production.example documents the Postgres variables');

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
    web: { ...identity }
  };
}
let state = healthy();
const server = createServer((req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url === '/v1/health') return send(200, state.health);
  if (req.url === '/v1/ready') return send(state.readyStatus, state.ready);
  if (req.url === '/release.json') return send(200, state.web);
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
    }]
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

console.log(`DEPLOYMENT CONTRACT — PASS — ${count}/${count} checks`);
