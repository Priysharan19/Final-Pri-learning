// Release-prep tooling (Phase 6): the nomination gate, the scripted staging
// acceptance, the physical-device matrix recorder, the Node PNG rasteriser and
// the documents they point at.
//
// Everything here is hermetic: git and gh are stubs, the "deployed host" is an
// in-process HTTP server, the "human" who reads codes is a function, and the
// "pictures" are byte strings. No network, no provider, no mailbox.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import {
  CONTAINER_CONTEXT, PRODUCTION_ORIGIN, REQUIRED_CONTEXTS, STAGING_ORIGIN, evaluateRuns, ghAll, latestCheckRuns, nominate,
  parseArgs as parseNominateArgs, parseSchemaVersions, promotionCommands
} from '../scripts/release-nominate.mjs';
import {
  CASES, DEFAULT_LEDGER, FAMILIES, JOURNEY, casesMarkdown, problemsWith, readLedger, recordResult, reportMarkdown, summarise, validateLedger
} from '../scripts/device-matrix-record.mjs';
import {
  EVIDENCE, EXPORT_FRESH_MS, STATUS, TARGETS, deriveAddresses, exitCodeFor, expectedFromPrompt, exportedForeignRows, makeHttp, maskEmail, parseArgs as parseAcceptanceArgs, plusAddress, runAcceptance
} from './acceptance/staging-acceptance.mjs';
import { PNG_SIGNATURE, crc32, encodeGreyPng, pngDimensions, simulatedInkPng, simulatedPhotoPng, toDataUrl } from './acceptance/synthetic-png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); count += 1; };
const read = path => readFileSync(join(ROOT, path), 'utf8');
const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const PROD_POINTER = 'c'.repeat(40);
const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ═════════════════════════════════════════════════════════════════════════════
// 1 · release-nominate: the gate, with git, gh and the hosts stubbed
// ═════════════════════════════════════════════════════════════════════════════
{
  const schemaSource = `export const SCHEMA_VERSION = ${SCHEMA_VERSION};\nexport const BILLING_SCHEMA_VERSION = ${BILLING_SCHEMA_VERSION};\n`;
  eq(parseSchemaVersions(schemaSource).schemaVersion, SCHEMA_VERSION, 'parseSchemaVersions reads SCHEMA_VERSION');
  eq(parseSchemaVersions(schemaSource).billingSchemaVersion, BILLING_SCHEMA_VERSION, 'parseSchemaVersions reads BILLING_SCHEMA_VERSION');
  assert.throws(() => parseSchemaVersions('export const SCHEMA_VERSION = 12;'), /both versions/, 'a commit without both constants is refused'); count += 1;

  assert.throws(() => parseNominateArgs([]), /40-hex/, 'a SHA is required'); count += 1;
  assert.throws(() => parseNominateArgs([SHA, '--bogus']), /Unknown argument/, 'unknown flags are refused'); count += 1;
  const parsed = parseNominateArgs([SHA, '--no-fetch', '--staging', 'https://s.example', '--json']);
  ok(parsed.sha === SHA && parsed.fetch === false && parsed.staging === 'https://s.example' && parsed.json === true, 'parseArgs reads the SHA and flags');

  const runs = evaluateRuns([
    { name: 'CI', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' },
    { name: 'Derived apply', path: '.github/workflows/x.yml', status: 'completed', conclusion: 'skipped' },
    { name: 'dependabot', path: 'dynamic/dependabot/dependabot-updates', status: 'completed', conclusion: 'failure' }
  ]);
  ok(runs.ok && runs.ignored.length === 1 && runs.relevant.length === 2, 'Dependabot version-update runs are listed, not counted; skipped is green');
  ok(!evaluateRuns([{ name: 'CI', path: 'a.yml', status: 'in_progress', conclusion: null }]).ok, 'an in-progress run blocks');
  ok(!evaluateRuns([{ name: 'CI', path: 'a.yml', status: 'completed', conclusion: 'cancelled' }]).ok, 'a cancelled run blocks');
  ok(!evaluateRuns([]).ok, 'no run at all blocks');
  const latest = latestCheckRuns([
    { name: 'J', status: 'completed', conclusion: 'failure', completed_at: '2026-10-18T10:00:00Z' },
    { name: 'J', status: 'completed', conclusion: 'success', completed_at: '2026-10-18T11:00:00Z' }
  ]);
  eq(latest.get('J').conclusion, 'success', 'a rerun replaces the earlier attempt of the same check');

  // The promotion commands are the ones release-policy.md prints.
  const policy = read('docs/release/release-policy.md');
  const commands = promotionCommands(SHA);
  for (const generic of ['git merge-base --is-ancestor <approved-sha> origin/main', 'git merge-base --is-ancestor origin/deploy/production <approved-sha>', 'git push origin <approved-sha>:refs/heads/deploy/production']) {
    ok(policy.includes(generic), `release-policy.md still documents: ${generic}`);
    ok(commands.some(line => line.startsWith(generic.replace(/<approved-sha>/g, SHA))), `promotion prints: ${generic.replace(/<approved-sha>/g, '<sha>')}`);
  }
  ok(commands.some(line => line.includes(`${PRODUCTION_ORIGIN}/v1/health`)), 'promotion ends with the production health check');

  // ── the stubbed world ─────────────────────────────────────────────────────
  function world() {
    const w = {
      mainAncestors: new Set([SHA, OTHER]), tip: OTHER, knownCommits: new Set([SHA, OTHER, PROD_POINTER]), prodPointer: PROD_POINTER, ffFromProd: true,
      schemaSource,
      runs: [{ name: 'CI', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }],
      checks: [...REQUIRED_CONTEXTS, CONTAINER_CONTEXT].map(name => ({ name, status: 'completed', conclusion: 'success', completed_at: '2026-10-18T12:00:00Z' })),
      staging: {
        health: { ok: true, service: 'pri-learning-platform', releaseIdentity: { releaseSha: SHA, buildTimestamp: '2026-10-18T00:00:00.000Z' }, schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION), database: { engine: 'postgres', reachable: true } },
        ready: { ready: true, state: 'ready', failing: [], degraded: [], checks: { database: { state: 'ok', engine: 'postgres', schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) } } },
        readyStatus: 200,
        web: { releaseSha: SHA }
      },
      production: { health: { ok: true, releaseIdentity: { releaseSha: PROD_POINTER } } },
      gitCalls: [], ghCalls: []
    };
    w.git = async args => {
      w.gitCalls.push(args.join(' '));
      const [cmd] = args;
      if (cmd === 'fetch') return '';
      if (cmd === 'rev-parse' && args[1] === '--verify') {
        const ref = args[3];
        if (ref === 'origin/deploy/production') { if (w.prodPointer) return w.prodPointer + '\n'; throw new Error('unknown'); }
        const sha = ref.replace(/\^\{commit\}$/, '');
        if (w.knownCommits.has(sha)) return sha + '\n';
        throw new Error('unknown revision');
      }
      if (cmd === 'rev-parse' && args[1] === 'origin/main') return w.tip + '\n';
      if (cmd === 'merge-base') {
        const [, , a, b] = args;
        if (b === 'origin/main') { if (w.mainAncestors.has(a)) return ''; throw new Error('not an ancestor'); }
        if (a === w.prodPointer) { if (w.ffFromProd) return ''; throw new Error('not an ancestor'); }
        throw new Error('not an ancestor');
      }
      if (cmd === 'rev-list') return '1\n';
      if (cmd === 'show') return w.schemaSource;
      throw new Error(`unexpected git ${args.join(' ')}`);
    };
    w.gh = async path => {
      w.ghCalls.push(path);
      if (path.includes('/actions/runs')) return { workflow_runs: w.runs };
      if (path.includes('/check-runs')) return { check_runs: w.checks };
      throw new Error(`unexpected gh ${path}`);
    };
    w.fetchImpl = async url => {
      const u = new URL(url);
      const origin = u.origin, path = u.pathname;
      const json = (status, body) => ({ status, json: async () => body });
      if (origin === STAGING_ORIGIN) {
        if (path === '/v1/health') return json(200, w.staging.health);
        if (path === '/v1/ready') return json(w.staging.readyStatus, w.staging.ready);
        if (path === '/release.json') return json(200, w.staging.web);
      }
      if (origin === PRODUCTION_ORIGIN && path === '/v1/health') return json(200, w.production.health);
      return json(404, null);
    };
    return w;
  }
  const run = (w, extra = {}) => nominate({ sha: SHA, git: w.git, gh: w.gh, fetchImpl: w.fetchImpl, fetchOrigin: true, ...extra });
  const failed = report => report.results.filter(r => r.ok === false).map(r => r.label);

  const good = world();
  const pass = await run(good);
  ok(pass.ok, `a green, deployed, fast-forwardable SHA is nominated (failed: ${failed(pass).join('; ')})`);
  ok(pass.promotion.length === promotionCommands(SHA).length, 'a nomination prints the promotion commands');
  ok(good.gitCalls.every(call => !/\bpush\b/.test(call)), 'nominate never runs git push');
  ok(good.gitCalls.some(call => call.startsWith('fetch')), 'nominate fetches origin first');
  ok(good.ghCalls.some(p => p.includes(`head_sha=${SHA}`)), 'nominate asks GitHub for the runs on exactly this SHA');
  {
    // Pagination: a required context on page 2 of 101 check runs is found; a list
    // that never ends is refused, not truncated.
    const pages = [];
    const paged = async path => { const page = Number(new URL(`https://x/${path}`).searchParams.get('page')); pages.push(page); return { check_runs: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ name: `filler-${i}` })) : [{ name: 'the one' }] }; };
    const all = await ghAll(paged, 'repos/r/commits/s/check-runs?per_page=100', 'check_runs');
    ok(all.length === 101 && all.at(-1).name === 'the one' && pages.join(',') === '1,2', 'ghAll follows pages until a short one and keeps every item');
    eq((await ghAll(async () => ({ workflow_runs: [{ name: 'a' }] }), 'p?per_page=100', 'workflow_runs')).length, 1, 'a single short page is one call');
    await assert.rejects(ghAll(async () => ({ check_runs: Array.from({ length: 100 }, () => ({})) }), 'p?per_page=100', 'check_runs'), /truncated/, 'an endless list is refused'); count += 1;
  }
  ok(pass.results.some(r => r.label.startsWith('position on origin/main') && /behind/.test(r.detail)), 'a certified SHA need not be the tip; the position is informational');

  const drifts = [
    ['a SHA that is not on origin/main', w => { w.mainAncestors.delete(SHA); }, /SHA is on origin\/main/],
    ['a workflow still running', w => { w.runs.push({ name: 'Native Ink', path: 'n.yml', status: 'in_progress', conclusion: null }); }, /has completed/],
    ['a red workflow', w => { w.runs.push({ name: 'CodeQL', path: 'c.yml', status: 'completed', conclusion: 'failure' }); }, /failed or was cancelled/],
    ['a required context missing', w => { w.checks = w.checks.filter(c => c.name !== REQUIRED_CONTEXTS[0]); }, new RegExp(`required context green: ${escapeRe(REQUIRED_CONTEXTS[0])}`)],
    ['a required context red', w => { w.checks.find(c => c.name === REQUIRED_CONTEXTS[2]).conclusion = 'failure'; }, new RegExp(`required context green: ${escapeRe(REQUIRED_CONTEXTS[2])}`)],
    ['an unrelated scheduled workflow red on the SHA', w => { w.runs.push({ name: 'Pri App Health Agent', path: '.github/workflows/app-health-agent.yml', status: 'completed', conclusion: 'failure' }); }, /no workflow run on this SHA failed or was cancelled/],
    ['Production Container absent (path-filtered)', w => { w.checks = w.checks.filter(c => c.name !== CONTAINER_CONTEXT); }, /Production Container green/],
    ['staging running another SHA', w => { w.staging.health.releaseIdentity.releaseSha = OTHER; }, /staging runs the nominated SHA/],
    ['staging web bundle from another build', w => { w.staging.web.releaseSha = OTHER; }, /release\.json/],
    ['staging on SQLite', w => { w.staging.health.database.engine = 'sqlite'; }, /engine is postgres/],
    ['staging one schema behind the commit', w => { w.staging.ready.checks.database.schemaVersion = String(SCHEMA_VERSION - 1); }, new RegExp(`schema_version is ${SCHEMA_VERSION}`)],
    ['staging billing schema mismatch', w => { w.staging.ready.checks.database.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1); }, new RegExp(`billing_schema_version is ${BILLING_SCHEMA_VERSION}`)],
    ['staging not ready', w => { w.staging.readyStatus = 503; w.staging.ready.ready = false; w.staging.ready.state = 'not_ready'; }, /replica can serve/],
    ['deploy/production not an ancestor (a backwards move)', w => { w.ffFromProd = false; }, /fast-forward/],
    ['a commit this clone does not have', w => { w.knownCommits.delete(SHA); w.mainAncestors.delete(SHA); }, /commit exists/]
  ];
  for (const [name, mutate, label] of drifts) {
    const w = world();
    mutate(w);
    const report = await run(w);
    ok(!report.ok && report.promotion.length === 0 && failed(report).some(l => label.test(l)), `refuses ${name} (failed: ${failed(report).join('; ') || 'none'})`);
    ok(w.gitCalls.every(call => !/\bpush\b/.test(call)), `no git push while refusing ${name}`);
  }
  const unreachable = world();
  unreachable.fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  ok(!(await run(unreachable)).ok, 'an unreachable staging refuses the nomination');
  const noFetch = world();
  await run(noFetch, { fetchOrigin: false });
  ok(noFetch.gitCalls.every(call => !call.startsWith('fetch')), '--no-fetch skips the fetch');
  const badSha = await nominate({ sha: 'main', git: good.git, gh: good.gh, fetchImpl: good.fetchImpl });
  ok(!badSha.ok && badSha.results.length === 1, 'a non-40-hex SHA is refused before anything runs');
  const source = read('scripts/release-nominate.mjs');
  ok(!/\[\s*'push'/.test(source) && !/execFile\w*\([^)]*push/.test(source), 'the source never passes "push" to git; the push is only printed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · synthetic-png: a valid PNG from pen strokes, without a browser
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(crc32(Buffer.from('123456789')), 0xCBF43926, 'crc32 matches the PNG/zlib check value');
  const png = encodeGreyPng({ width: 3, height: 2, pixels: Buffer.from([0, 128, 255, 255, 128, 0]) });
  ok(png.subarray(0, 8).equals(PNG_SIGNATURE), 'the encoder writes the PNG signature');
  assert.deepEqual(pngDimensions(png), { width: 3, height: 2, bitDepth: 8, colourType: 0 }, 'IHDR reads back'); count += 1;
  assert.throws(() => encodeGreyPng({ width: 2, height: 2, pixels: Buffer.alloc(3) }), /does not match/, 'a short pixel buffer is refused'); count += 1;
  const ink = simulatedInkPng(['24']);
  ok(ink.label === 'SIMULATED-ink' && ink.strokes > 0 && pngDimensions(ink.png)?.width === ink.width, 'simulated ink is labelled SIMULATED and is a readable PNG');
  const photo = simulatedPhotoPng(['16 + (n-1)(-6) = -122', 'n = 24']);
  ok(photo.label === 'SIMULATED-photo' && photo.width >= 640 && photo.height >= 480, 'the simulated photo is labelled SIMULATED and photo-sized');
  ok(toDataUrl(ink.png).startsWith('data:image/png;base64,'), 'pictures are sent as PNG data URLs');
  const again = simulatedInkPng(['24']);
  ok(again.png.equals(ink.png), 'the same lines and seed draw the same picture (deterministic)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · staging-acceptance: argument policy, then the whole flow against a fake host
// ═════════════════════════════════════════════════════════════════════════════
{
  const a = parseAcceptanceArgs(['--email', 'owner@example.test', '--tester', 'Priya Example']);
  ok(a.target === 'staging' && a.origin === STAGING_ORIGIN && a.cleanup === false && a.maxReads === 4, 'defaults: staging, no cleanup, 4 reads');
  eq(TARGETS.production, PRODUCTION_ORIGIN, 'production target is the Railway production origin');
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--email', 'o@example.test']), /needs --sha/, 'production needs --sha'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--sha', SHA, '--no-cleanup']), /refused/, 'production refuses --no-cleanup'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--sha', SHA, '--origin', 'https://elsewhere.example']), /cannot change it/, 'production cannot be pointed elsewhere'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'prod']), /staging or production/, 'unknown targets are refused'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--skip', 'Z']), /unknown step/, 'unknown skip ids are refused'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--origin', 'http://staging.example']), /https/, 'plain http is only for loopback'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--email', 'not-an-address']), /email/, 'a malformed mailbox is refused'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--max-reads', '1']), /2 to 10/, '--max-reads 1 is refused: C and D each reserve 2 reads, so 1 would silently skip both'); count += 1;
  eq(parseAcceptanceArgs(['--max-reads', '2']).maxReads, 2, '--max-reads 2 is the minimum');
  const prod = parseAcceptanceArgs(['--target', 'production', '--sha', SHA.toUpperCase(), '--email', 'o@example.test']);
  ok(prod.cleanup === true && prod.sha === SHA && prod.origin === PRODUCTION_ORIGIN, 'production forces cleanup and normalises the SHA');
  eq(plusAddress('owner@example.test', 'pri-child-ab12'), 'owner+pri-child-ab12@example.test', 'plus-addressing');
  eq(plusAddress('owner+x@example.test', 't'), 'owner+t@example.test', 'an existing tag is replaced');
  eq(maskEmail('owner@example.test'), 'ow…@example.test', 'addresses are masked in reports');
  const addr = deriveAddresses({ email: 'owner@example.test', guardianEmail: 'parent@example.test' }, 'ab12');
  ok(addr.child === 'owner+pri-child-ab12@example.test' && addr.guardian === 'parent@example.test' && addr.isolation === 'owner+pri-iso-ab12@example.test', 'derived addresses honour explicit ones');
  assert.deepEqual(expectedFromPrompt('An AP has first term $16$ and common difference $-6$, which term is equal to $-122$? Give the term number.'), { a: 16, d: -6, term: -122, n: 24 }, 'the expected term number is worked out from the printed question'); count += 1;
  eq(expectedFromPrompt('first term $5$ and common difference $2$, which term is equal to $12$? Give the term number.'), null, 'a non-integer term number is not forced');
  eq(expectedFromPrompt('Solve x^2 = 4'), null, 'another form is not parsed');
  const acceptanceSource = read('tools/acceptance/staging-acceptance.mjs');
  ok(!/x-pri-client/i.test(acceptanceSource), 'the runner never claims to be a native shell');
  ok(/send\.origin = origin/.test(acceptanceSource), 'mutations carry the deployed origin as a browser on it would');

  // ── the fake deployed host ─────────────────────────────────────────────────
  /**
   * A well-behaved deployment, with two defects it can be told to have so the
   * tool's isolation probes are shown to catch them: `skipOwnership` answers
   * practice calls for any verified account's question (no per-account check);
   * `leakExport` puts another account's learning rows into every export.
   */
  function fakeHost({ sha = SHA, schemaVersion = SCHEMA_VERSION, skipOwnership = false, leakExport = false } = {}) {
    const state = {
      accounts: new Map(), sessions: new Map(), challenges: new Map(), mailbox: [], questions: new Map(), receipts: new Map(),
      grades: new Map(), reads: new Set(), log: [], transcribeBodies: [], originMisses: 0, csrfMisses: 0, codeSeq: 0,
      // One clock for the host and the runner (passed as its `now`), so a test
      // can age student A's session past the export's fresh-proof window.
      clockOffsetMs: 0
    };
    state.now = () => Date.now() + state.clockOffsetMs;
    const NOTICE = 'v3';
    const PROMPT = 'An AP has first term $16$ and common difference $-6$, which term is equal to $-122$? Give the term number.';
    const EXPECTED_N = 24;
    const newCode = () => String(100000 + (++state.codeSeq));
    const parseCookies = header => Object.fromEntries(String(header || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
    const decodeLines = dataUrl => { const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, ''); const text = Buffer.from(b64, 'base64').toString('utf8'); return text.startsWith('PNG:') ? text.slice(4) : null; };
    const server = createServer(async (req, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      const url = new URL(req.url, 'http://x');
      const path = url.pathname;
      const method = req.method;
      const entry = { method, path, status: null, accountId: null };
      state.log.push(entry);
      const headers = {};
      const send = (status, payload) => { entry.status = status; res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(payload)); };
      const fail = (status, code) => send(status, { error: { code, message: code } });
      const mutation = !['GET', 'HEAD'].includes(method);
      const myOrigin = `http://127.0.0.1:${server.address().port}`;
      if (mutation && req.headers.origin !== myOrigin) { state.originMisses += 1; return fail(403, 'ORIGIN_REJECTED'); }
      const cookies = parseCookies(req.headers.cookie);
      const session = cookies.pri_cloud_session ? state.sessions.get(cookies.pri_cloud_session) : null;
      if (mutation && cookies.pri_cloud_session) {
        if (req.headers['x-pri-csrf'] !== `csrf-${cookies.pri_cloud_session}` || cookies.pri_csrf !== `csrf-${cookies.pri_cloud_session}`) { state.csrfMisses += 1; return fail(403, 'CSRF_REJECTED'); }
      }
      const account = session ? state.accounts.get(session.accountId) : null;
      entry.accountId = account?.id || null;
      const issueSession = (acct, deviceId) => {
        const token = randomUUID().replace(/-/g, '');
        state.sessions.set(token, { id: `sess-${token.slice(0, 8)}`, accountId: acct.id, deviceId, createdAt: state.now() });
        headers['set-cookie'] = [`pri_cloud_session=${token}; Path=/; HttpOnly`, `pri_csrf=csrf-${token}; Path=/`];
        return token;
      };
      const publicAccount = acct => ({ id: acct.id, email: acct.email, emailVerified: acct.verified, name: acct.name, role: 'student' });
      const consentOf = acct => acct.ageBasis === 'child' ? { required: true, state: acct.consent } : { required: false, state: 'not-required' };
      const requireSession = () => { if (!session || !account) { fail(401, 'AUTH_REQUIRED'); return false; } return true; };
      const requireVerified = () => { if (!account.verified) { fail(403, 'EMAIL_UNVERIFIED'); return false; } return true; };
      const requireConsent = () => { if (account.ageBasis === 'child' && account.consent !== 'given') { fail(403, 'GUARDIAN_CONSENT_PENDING'); return false; } return true; };

      if (method === 'GET' && path === '/v1/health') return send(200, { ok: true, service: 'pri-learning-platform', releaseIdentity: { releaseSha: sha }, schemaVersion: String(schemaVersion), billingSchemaVersion: String(BILLING_SCHEMA_VERSION), database: { engine: 'postgres', reachable: true } });
      if (method === 'GET' && path === '/v1/ready') return send(200, { ready: true, state: 'ready', releaseSha: sha, failing: [], degraded: [], checks: { database: { state: 'ok', engine: 'postgres', schemaVersion: String(schemaVersion), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) }, authEmail: { state: 'ok' }, handwriting: { state: 'ok' } } });
      if (method === 'GET' && path === '/release.json') return send(200, { releaseSha: sha });

      if (method === 'POST' && path === '/v1/account/otp/request') {
        const id = `otp-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.destination, purpose: 'sign-in', consumed: false });
        state.mailbox.push({ to: body.destination, code, purpose: 'sign-in' });
        return send(202, { ok: true, channel: 'email', challengeId: id });
      }
      if (method === 'POST' && path === '/v1/account/otp/verify') {
        const existing = [...state.accounts.values()].find(a => a.email === body.destination);
        const ch = state.challenges.get(body.challengeId);
        if (body.signupTicket) {
          const t = state.challenges.get(body.signupTicket);
          if (!t || t.consumed || t.destination !== body.destination) return fail(400, 'OTP_INVALID');
          t.consumed = true;
        } else {
          if (!ch || ch.consumed || ch.destination !== body.destination || ch.code !== body.code) return fail(400, 'OTP_INVALID');
          if (!existing && !body.profile) {
            ch.consumed = true;
            const ticket = `ticket-${randomUUID().slice(0, 8)}`;
            state.challenges.set(ticket, { code: null, destination: body.destination, purpose: 'sign-in', consumed: false });
            return send(200, { status: 'profile-required', signupTicket: ticket });
          }
          ch.consumed = true;
        }
        if (existing) { issueSession(existing, body.deviceId); return send(200, { status: 'signed-in', created: false, account: publicAccount(existing), guardianConsent: consentOf(existing) }); }
        const child = body.profile.isAdult !== true;
        const acct = { id: `acct-${randomUUID().slice(0, 8)}`, email: body.destination, name: body.profile.name, verified: !(state.unverifiedSignups && /pri-iso/.test(body.destination)), ageBasis: child ? 'child' : 'adult', consent: child ? 'pending' : 'not-required', password: null, events: [] };
        state.accounts.set(acct.id, acct);
        issueSession(acct, body.deviceId);
        return send(201, { status: 'signed-in', created: true, account: publicAccount(acct), guardianConsent: consentOf(acct) });
      }
      if (method === 'POST' && path === '/v1/account/register') {
        if ([...state.accounts.values()].some(a => a.email === body.email)) return fail(409, 'EMAIL_EXISTS');
        const acct = { id: `acct-${randomUUID().slice(0, 8)}`, email: body.email, name: body.name, verified: false, ageBasis: body.isAdult === true ? 'adult' : 'child', consent: 'not-required', password: body.password, events: [] };
        state.accounts.set(acct.id, acct);
        issueSession(acct, body.deviceId);
        return send(201, { account: publicAccount(acct), verificationRequired: true });
      }
      if (method === 'POST' && path === '/v1/account/otp/delete-request') {
        const id = `del-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.email, purpose: 'reauth', consumed: false });
        state.mailbox.push({ to: body.email, code, purpose: 'reauth' });
        return send(202, { ok: true, channel: 'email', challengeId: id });
      }
      if (method === 'POST' && path === '/v1/account/otp/delete-confirm') {
        const ch = state.challenges.get(body.challengeId);
        if (!ch || ch.consumed || ch.destination !== body.email || ch.code !== body.code) return fail(400, 'OTP_INVALID');
        ch.consumed = true;
        const acct = [...state.accounts.values()].find(a => a.email === body.email);
        if (!acct) return send(200, { deleted: false, accountFound: false });
        state.accounts.delete(acct.id);
        return send(200, { deleted: true, accountFound: true });
      }
      if (method === 'POST' && path === '/v1/account/otp/guardian/approve') {
        if (body.approve !== true || body.noticeVersion !== NOTICE) return fail(400, 'GUARDIAN_NOTICE_REQUIRED');
        const live = [...state.challenges.entries()].reverse().find(([, c]) => c.purpose === 'guardian-consent' && c.destination === body.destination && !c.consumed);
        if (!live || live[1].code !== body.code) return fail(400, 'OTP_INVALID');
        live[1].consumed = true;
        const acct = state.accounts.get(live[1].accountId);
        acct.consent = 'given';
        return send(200, { ok: true, confirmed: true, childName: acct.name });
      }

      if (!requireSession()) return;
      if (method === 'GET' && path === '/v1/account/me') return send(200, { account: publicAccount(account) });
      if (method === 'GET' && path === '/v1/account/devices') return send(200, { devices: [...state.sessions.values()].filter(s => s.accountId === account.id).map(s => ({ id: s.id, deviceId: s.deviceId, current: s.id === session.id })) });
      if (method === 'DELETE' && path.startsWith('/v1/account/devices/')) {
        const id = path.split('/').pop();
        const entry = [...state.sessions.entries()].find(([, s]) => s.id === id && s.accountId === account.id);
        if (entry) state.sessions.delete(entry[0]);
        return send(200, { revoked: !!entry, current: id === session.id });
      }
      if (method === 'GET' && path === '/v1/account/export') {
        // The real gate (accounts.js requireRecentAuth): the credential proven
        // inside EXPORT_FRESH_MS, else 401 REAUTH_REQUIRED naming the proofs a
        // code-only account can offer. Nothing of the export leaks on refusal.
        if (state.now() - session.createdAt > EXPORT_FRESH_MS) { headers['cache-control'] = 'no-store'; return send(401, { error: { code: 'REAUTH_REQUIRED', message: 'Confirm it is you before continuing.', proofs: ['otp'], freshMs: EXPORT_FRESH_MS } }); }
        // The real shape (server/platform/accounts.js): rows keyed by SQL column names.
        const own = account.events.map(ev => ({ id: ev.id, device_id: 'd', device_seq: ev.serverCursor, kind: ev.kind, entity_id: ev.entityId, occurred_at: 't', payload_json: '{}', created_at: 't' }));
        const leaked = leakExport ? [...state.accounts.values()].filter(a => a.id !== account.id).flatMap(a => a.events.map(ev => ({ id: ev.id, device_id: 'd', device_seq: ev.serverCursor, kind: ev.kind, entity_id: ev.entityId, occurred_at: 't', payload_json: '{}', created_at: 't' }))) : [];
        return send(200, { format: 'pri-account-export-v1', exportedAt: 't', account: { id: account.id, email: account.email, name: account.name, role: 'student' }, identities: [], learningEvents: [...own, ...leaked], entities: [], classes: [], assignmentSubmissions: [], issueReports: [], guardianConsent: null, entitlements: [] });
      }
      if (method === 'DELETE' && path === '/v1/account') {
        if (!account.password || body?.password !== account.password) return fail(401, 'REAUTH_REQUIRED');
        state.accounts.delete(account.id);
        return send(200, { deleted: true });
      }
      if (method === 'GET' && path === '/v1/account/guardian/state') return send(200, { state: account.ageBasis === 'child' ? account.consent : 'not-required' });
      if (method === 'POST' && path === '/v1/account/otp/guardian/request') {
        if (account.ageBasis !== 'child') return fail(409, 'GUARDIAN_CONSENT_NOT_REQUIRED');
        if (body.destination === account.email) return fail(400, 'GUARDIAN_SAME_AS_STUDENT');
        const id = `g-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.destination, purpose: 'guardian-consent', consumed: false, accountId: account.id });
        state.mailbox.push({ to: body.destination, code, purpose: 'guardian-consent' });
        return send(202, { ok: true, channel: 'email', noticeVersion: NOTICE, challengeId: id });
      }
      if (method === 'GET' && path === '/v1/sync/pull/0') { if (!requireConsent()) return; return send(200, { cursor: 0, hasMore: false, events: account.events, entities: [] }); }
      if (method === 'POST' && path === '/v1/practice/issue') {
        if (!requireVerified() || !requireConsent()) return;
        const id = randomUUID();
        state.questions.set(id, { accountId: account.id, expectedN: EXPECTED_N });
        return send(201, { question: { id, prompt: PROMPT, subtopic: 'c10-arithmetic-progressions', difficulty: 3, criteriaCount: 3, supportsSteps: true }, accountId: account.id });
      }
      if (method === 'POST' && path === '/v1/handwriting/transcribe') {
        if (!requireVerified() || !requireConsent()) return;
        state.transcribeBodies.push(body);
        if (Object.keys(body).join(',') !== 'image') return fail(400, 'HANDWRITING_REQUEST_INVALID');
        const text = decodeLines(body.image);
        if (text === null) return fail(400, 'HANDWRITING_IMAGE_INVALID');
        const key = `${account.id}:${body.image}`;
        const reused = state.reads.has(key);
        state.reads.add(key);
        return send(200, { reused, transcription: { engine: 'fake-reader', text, lines: text.split('\n'), confidence: 0.98, needsConfirmation: false, latencyMs: 12 } });
      }
      const practice = path.match(/^\/v1\/practice\/([^/]+)\/(recognize|submit|reveal|repeat|recognition\/([^/]+)\/confirm)$/);
      if (method === 'POST' && practice) {
        if (!requireVerified() || !requireConsent()) return;
        const [, qid, action, sourceReceipt] = practice;
        const q = state.questions.get(qid);
        if (!q || (!skipOwnership && q.accountId !== account.id)) return fail(404, 'QUESTION_NOT_FOUND');
        if (action === 'reveal') return send(200, { questionId: qid, revealed: true });
        if (action === 'repeat') return send(201, { questionId: qid, repeat: true });
        if (action === 'recognize') {
          const text = decodeLines(body.image);
          if (text === null) return fail(400, 'RECOGNITION_IMAGE_INVALID');
          const key = `${account.id}:${body.image}`;
          const reused = state.reads.has(key);
          state.reads.add(key);
          const receipt = randomUUID();
          state.receipts.set(receipt, { qid, mode: body.mode, text, accountId: account.id });
          return send(201, { receipt, questionId: qid, mode: body.mode, reused, transcription: { text, lines: text.split('\n'), confidence: 0.98, needsConfirmation: false } });
        }
        if (action.startsWith('recognition/')) {
          const prior = state.receipts.get(sourceReceipt);
          if (!prior || prior.qid !== qid) return fail(404, 'RECOGNITION_RECEIPT_INVALID');
          const receipt = randomUUID();
          state.receipts.set(receipt, { qid, mode: prior.mode, text: body.text, accountId: account.id, corrected: true });
          return send(201, { receipt, questionId: qid, mode: prior.mode, corrected: true });
        }
        // submit
        const key = `${qid}:${body.submissionId}`;
        if (state.grades.has(key)) return send(200, state.grades.get(key));
        if (body.mode !== 'typed') {
          const proof = state.receipts.get(body.transcriptionReceipt);
          if (!proof) return fail(422, 'RECOGNITION_RECEIPT_INVALID');
          if (proof.mode !== body.mode || proof.text !== body.answer || proof.qid !== qid) return fail(422, 'RECOGNITION_RECEIPT_MISMATCH');
        }
        const final = String(body.answer).replace(/\s+/g, '').replace(/^n=/, '');
        const correct = final === String(q.expectedN);
        const response = { authoritative: true, questionId: qid, submissionId: body.submissionId, attemptId: randomUUID(), correct, invalid: false, resolved: true, marksEarned: correct ? 3 : 0, marksPossible: 3, triesLeft: correct ? 0 : 1 };
        state.grades.set(key, response);
        account.events.push({ kind: 'graded-attempt', entityId: qid, id: response.attemptId, serverCursor: account.events.length + 1 });
        return send(200, response);
      }
      return fail(404, 'NOT_FOUND');
    });
    return new Promise(resolveStart => server.listen(0, '127.0.0.1', () => resolveStart({ server, state, origin: `http://127.0.0.1:${server.address().port}` })));
  }
  const fakePictures = {
    ink: lines => ({ png: Buffer.from('PNG:' + lines.join('\n')), label: 'SIMULATED-ink', width: 320, height: 240, strokes: lines.length }),
    photo: lines => ({ png: Buffer.from('PNG:' + lines.join('\n')), label: 'SIMULATED-photo', width: 640, height: 480, strokes: lines.length })
  };
  /** A scripted human who reads the newest unread code out of the one shared mailbox. */
  const humanFor = state => async () => { const item = state.mailbox.find(m => !m.read); if (!item) return ''; item.read = true; return item.code; };
  const baseArgs = (origin, extra = {}) => ({ target: 'staging', origin, sha: SHA, email: 'owner@example.test', childEmail: null, guardianEmail: null, tester: 'Priya Example', nonInteractive: false, skip: new Set(), cleanup: false, out: null, maxReads: 4, json: false, ...extra });

  // ── 3a · the full interactive staging run ─────────────────────────────────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const lines = [];
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: line => lines.push(line), pictures: fakePictures, outDir, now: state.now });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      const failures = report.steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `${s.id}: ${c.label} (${c.detail || ''})`));
      ok(status['0'] === STATUS.PASS && status.A === STATUS.PASS && status.B === STATUS.PASS && status.C === STATUS.PASS && status.D === STATUS.PASS && status.E === STATUS.PASS,
        `steps 0, A–E pass against a well-behaved host (failures: ${failures.join(' | ') || 'none'}; statuses ${JSON.stringify(status)})`);
      eq(status.F, STATUS.SKIPPED, 'cleanup is off on staging unless asked');
      eq(exitCodeFor(report), 0, 'exit 0 when every attempted step passed');
      ok(report.humanSteps.filter(h => h.step === 'A').length === 1 && report.humanSteps.filter(h => h.step === 'B').length === 2 && report.humanSteps.filter(h => h.step === 'E').length === 1, 'A names one human step (the code), B names two (the child\'s code and the parent\'s), E names one (the isolation account\'s code)');
      ok(lines.some(l => l.startsWith('HUMAN STEP [A]:')) && lines.some(l => l.startsWith('HUMAN STEP [B]:')), 'HUMAN STEP lines are printed');
      const codes = state.mailbox.map(m => m.code);
      ok(codes.length >= 4 && lines.every(line => !codes.some(code => line.includes(code))), 'no code the human typed appears in the output');
      ok(codes.every(code => !JSON.stringify(report).includes(code)), 'no code appears in the report');
      ok(!JSON.stringify(report).includes('owner@example.test'), 'the report masks the mailbox address');
      ok(state.transcribeBodies.length === 2 && state.transcribeBodies.every(b => Object.keys(b).join(',') === 'image'), 'every transcribe body was exactly { image }');
      eq(report.providerReads, 2, 'C and D each spent one provider read; recognize reused it');
      eq(state.originMisses, 0, 'every mutation carried the deployed origin');
      eq(state.csrfMisses, 0, 'every authenticated mutation carried the CSRF pair');
      ok(report.steps.find(s => s.id === 'C').evidence === EVIDENCE.SYNTHETIC_PICTURE && report.steps.find(s => s.id === 'A').evidence === EVIDENCE.REAL_MAILBOX && report.steps.find(s => s.id === 'E').evidence === EVIDENCE.TEST_ACCOUNTS, 'evidence classes are labelled per step');
      ok(/SYNTHETIC/.test(EVIDENCE.SYNTHETIC_PICTURE) && /REAL mailbox/.test(EVIDENCE.REAL_MAILBOX) && /not a student/i.test(EVIDENCE.REAL_MAILBOX), 'the labels say synthetic vs real and that the accounts are not students');
      const files = readdirSync(outDir);
      ok(files.includes('SIMULATED-ink-C.png') && files.includes('SIMULATED-photo-D.png') && files.includes('report.json'), 'pictures are saved under SIMULATED-* names next to the report');
      const c = report.steps.find(s => s.id === 'C');
      ok(c.checks.some(ch => /right term number is marked right/.test(ch.label) && ch.ok), 'C: the term number worked out from the printed question is marked right');
      ok(c.checks.some(ch => /no double credit/.test(ch.label) && ch.ok), 'C: the replay returns the same attempt');
      const d = report.steps.find(s => s.id === 'D');
      ok(d.checks.some(ch => /explicit transcript correction/.test(ch.label) && ch.ok), 'D: a multi-line photo reading goes through the explicit confirmation of the final line');
      ok(d.checks.some(ch => /right term number is marked right/.test(ch.label) && ch.ok), 'D: the confirmed final line is marked right');
      const accounts = [...state.accounts.values()];
      ok(accounts.length === 3 && accounts.filter(a => a.ageBasis === 'child').length === 1 && accounts.every(a => a.verified === true), 'the run made exactly three test accounts: A (adult), the child, the isolation account — all verified by code (none through /register)');
      ok(report.accounts.every(a => a.email && !a.email.includes('owner@')), 'account rows in the report are masked');
      const e = report.steps.find(s => s.id === 'E');
      ok(e.checks.length >= 12 && e.checks.every(ch => ch.ok), `E: ${e.checks.length} isolation probes all held`);
      const ownership = e.checks.filter(ch => /refused by ownership \(404 QUESTION_NOT_FOUND\)/.test(ch.label));
      ok(ownership.length === 4 && ownership.every(ch => ch.ok && /status 404 QUESTION_NOT_FOUND/.test(ch.detail)), 'E: all four cross-account question probes (submit, recognize, reveal, repeat) reached the ownership check (404 QUESTION_NOT_FOUND), not EMAIL_UNVERIFIED');
      ok(e.checks.some(ch => /pri-account-export-v1 shape/.test(ch.label) && ch.ok) && e.checks.some(ch => /export holds none of student A/.test(ch.label) && ch.ok && /^1 event\(s\)/.test(ch.detail) === false), 'E: the export probe read learningEvents[] of the real shape');
      ok(e.checks.some(ch => /inside the fresh-proof window, is student A's/.test(ch.label) && ch.ok && /status 200/.test(ch.detail)), 'E: a quick run (A signed in moments ago) reads A\'s own export');
      ok(!e.pending, 'E: no probe was left NOT VERIFIED on a verified isolation account');
      const isoId = report.accounts.find(a => a.role === 'B2 (isolation)').accountId;
      const practiceByIso = state.log.filter(r => /^\/v1\/practice\//.test(r.path) && r.accountId === isoId);
      ok(practiceByIso.length === 4 && practiceByIso.every(r => r.status === 404), 'the fake host saw exactly four practice calls from the isolation account (submit, recognize, reveal, repeat) and refused each with 404');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3b · non-interactive: HUMAN STEP printed, nothing created, exit 3 ────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const lines = [];
    try {
      const report = await runAcceptance(baseArgs(origin, { nonInteractive: true, tester: null }), { prompt: null, log: line => lines.push(line), pictures: fakePictures, outDir });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      eq(status['0'], STATUS.PASS, 'non-interactive: preflight still runs');
      eq(status.A, STATUS.NOT_VERIFIED, 'non-interactive: A is NOT VERIFIED, not failed');
      ok(status.C === STATUS.SKIPPED && status.D === STATUS.SKIPPED && status.E === STATUS.SKIPPED, 'non-interactive: C, D, E are skipped for want of a session');
      eq(exitCodeFor(report), 3, 'exit 3 when a human step is open');
      ok(lines.some(l => l.startsWith('HUMAN STEP [A]:')), 'non-interactive: the human step is printed');
      eq(state.accounts.size, 0, 'non-interactive: no account was created (no code was ever typed)');
      ok(state.log.filter(r => r.path === '/v1/account/otp/request').length === 2, 'the two codes (A, child) were requested so the human can find them');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3c · a wrong SHA or a drifted schema fails preflight and stops ────────
  {
    const { server, state, origin } = await fakeHost({ sha: OTHER });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      eq(report.steps[0].status, STATUS.FAIL, 'a host running another SHA fails preflight');
      ok(report.steps.slice(1).every(s => s.status === STATUS.SKIPPED), 'nothing else is attempted after a failed preflight');
      eq(exitCodeFor(report), 1, 'exit 1 on a failed check');
      eq(state.accounts.size, 0, 'no account is created on a host that failed preflight');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
    const drifted = await fakeHost({ schemaVersion: SCHEMA_VERSION - 1 });
    const outDir2 = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(drifted.origin), { prompt: humanFor(drifted.state), log: () => {}, pictures: fakePictures, outDir: outDir2 });
      ok(report.steps[0].status === STATUS.FAIL && report.steps[0].checks.some(c => !c.ok && c.label.includes('schema_version')), 'a host one schema behind this checkout fails preflight');
    } finally { drifted.server.close(); rmSync(outDir2, { recursive: true, force: true }); }
  }

  // ── 3d · production is refused unless nominated; when nominated, it cleans up ──
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      let nominateCalls = 0;
      const refusing = async () => { nominateCalls += 1; return { ok: false, results: [{ ok: false, label: 'staging runs the nominated SHA' }] }; };
      await assert.rejects(
        runAcceptance(baseArgs(origin, { target: 'production', cleanup: true }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir, nominate: refusing }),
        error => error.code === 'NOT_NOMINATED' && error.exitCode === 2 && /Nothing was sent to production/.test(error.message)
      ); count += 1;
      eq(nominateCalls, 1, 'production consults the nomination first');
      eq(state.log.length, 0, 'a refused production run sends nothing to the host');

      const passing = async () => ({ ok: true, results: [] });
      const lines = [];
      const report = await runAcceptance(baseArgs(origin, { target: 'production', cleanup: true }), { prompt: humanFor(state), log: line => lines.push(line), pictures: fakePictures, outDir, nominate: passing });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      const failures = report.steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `${s.id}: ${c.label} (${c.detail || ''})`));
      ok(['0', 'A', 'B', 'C', 'D', 'E', 'F'].every(id => status[id] === STATUS.PASS), `a nominated production run passes every step including cleanup (failures: ${failures.join(' | ') || 'none'})`);
      eq(state.accounts.size, 0, 'cleanup deleted every account the run created');
      ok(report.humanSteps.filter(h => h.step === 'F').length === 3, 'cleanup names the three deletion codes a human reads (A, the child and the isolation account: all are code accounts)');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d′ · a host without the per-account ownership check FAILS step E ─────
  {
    const { server, state, origin } = await fakeHost({ skipOwnership: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'E');
      eq(e.status, STATUS.FAIL, 'E FAILS when a verified second account can act on A\'s question');
      const failed = e.checks.filter(ch => !ch.ok);
      const ownershipFailed = failed.filter(ch => /refused by ownership/.test(ch.label));
      ok(ownershipFailed.length === 4 && ownershipFailed.filter(ch => /status 20[01]/.test(ch.detail)).length === 3 && ownershipFailed.every(ch => !/QUESTION_NOT_FOUND/.test(ch.detail)), `all four ownership probes (submit, recognize, reveal, repeat) failed: submit, reveal and repeat were accepted, none was refused by ownership (${failed.map(ch => ch.detail).join('; ')})`);
      const exportFailed = failed.filter(ch => /export holds none of student A/.test(ch.label));
      ok(failed.length === 5 && exportFailed.length === 1 && /1 of A's/.test(exportFailed[0].detail), 'and the accepted foreign submit then shows up as A\'s row in B2\'s export — the export probe counts real rows');
      ok(['0', 'A', 'B', 'C', 'D'].every(id => report.steps.find(s => s.id === id).status === STATUS.PASS), 'the other steps still pass: the defect is pinned on E');
      eq(exitCodeFor(report), 1, 'exit 1: a missing ownership check is a failed release gate');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d″ · an export that leaks one of A's rows FAILS step E ───────────────
  {
    const { server, state, origin } = await fakeHost({ leakExport: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'E');
      eq(e.status, STATUS.FAIL, 'E FAILS when student B2\'s export carries one of A\'s learningEvents rows');
      const failed = e.checks.filter(ch => !ch.ok);
      ok(failed.length === 1 && /export holds none of student A/.test(failed[0].label) && /2 of A's/.test(failed[0].detail), `exactly the export-row probe failed and it counted A's rows (${failed[0]?.detail})`);
      eq(exitCodeFor(report), 1, 'exit 1 on a leaking export');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d″′ · a slow run: A's session is older than the export's fresh-proof window ──
  // Three human mailbox reads sit between A's sign-in and E's export, so on
  // staging A's session is usually past EXPORT_FRESH_MS by then. The contract
  // the branch of #521 made (requireRecentAuth) is that the cookie alone is
  // then refused 401 REAUTH_REQUIRED naming otp — E PASSES on that refusal and
  // does not report a false FAIL for the old "A exports 200" expectation.
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const readCodes = humanFor(state);
    // The scripted human takes eleven minutes to find B2's code (the third read).
    const slowHuman = async () => { const item = state.mailbox.find(m => !m.read); if (item && /pri-iso/.test(item.to)) state.clockOffsetMs += EXPORT_FRESH_MS + 60_000; return readCodes(); };
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: slowHuman, log: () => {}, pictures: fakePictures, outDir, now: state.now });
      const e = report.steps.find(s => s.id === 'E');
      const failures = e.checks.filter(ch => !ch.ok).map(ch => `${ch.label} (${ch.detail})`);
      eq(e.status, STATUS.PASS, `E PASSES when A's session has aged past the window (failures: ${failures.join(' | ') || 'none'})`);
      ok(state.clockOffsetMs > EXPORT_FRESH_MS, 'the clock really was advanced past the window before E\'s export');
      const refused = e.checks.find(ch => /older session is refused the export/.test(ch.label));
      ok(refused?.ok && /status 401 REAUTH_REQUIRED/.test(refused.detail) && /"otp"/.test(refused.detail), `E: A's stale cookie was refused 401 REAUTH_REQUIRED naming otp (${refused?.detail})`);
      ok(!e.checks.some(ch => /inside the fresh-proof window/.test(ch.label)), 'E: the quick-run expectation (A exports 200) was not applied to a stale session');
      ok(e.checks.some(ch => /pri-account-export-v1 shape/.test(ch.label) && ch.ok), 'E: the shape probe still ran on B2, whose sign-in is fresh');
      const exportsByA = state.log.filter(r => r.path === '/v1/account/export' && r.accountId === report.accounts.find(a => a.role === 'A')?.accountId);
      ok(exportsByA.length === 1 && exportsByA[0].status === 401, `the fake host saw exactly one export call from A and refused it (${JSON.stringify(exportsByA)})`);
      eq(exitCodeFor(report), 0, 'exit 0: a refusal the contract requires is not a failure');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d‴ · an unverified second account must not count as an isolation PASS ──
  {
    // A host that signs an OTP account in without marking it verified: the
    // ownership probes are not run and E stays NOT VERIFIED (exit 3), never PASS.
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      state.unverifiedSignups = true;
      const report = await runAcceptance(baseArgs(origin, { skip: new Set(['B']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'E');
      ok(e.checks.some(ch => /mailbox counts as verified/.test(ch.label) && !ch.ok), 'E records that the isolation account is not verified');
      ok(!e.checks.some(ch => /refused by ownership/.test(ch.label)), 'E does not run the ownership probes on an unverified account (EMAIL_UNVERIFIED proves nothing)');
      ok(e.pending && report.humanSteps.some(h => h.step === 'E' && /NOT run/.test(h.text)), 'the skipped probes are named as NOT run, for a human');
      ok(e.status !== STATUS.PASS, `E is ${e.status}, never PASS, on an unverified isolation account`);
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d⁗′ · --skip C,D leaves A without a question: E must not read PASS ───
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin, { skip: new Set(['C', 'D']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'E');
      ok(!e.checks.some(ch => /refused by ownership/.test(ch.label)), 'E runs no ownership probe when A issued no question');
      ok(e.pending && report.humanSteps.some(h => h.step === 'E' && /NOT run/.test(h.text)), 'the unrun probes are named as NOT run, for a human');
      eq(e.status, STATUS.NOT_VERIFIED, 'E is NOT VERIFIED, never PASS, without the ownership probes');
      eq(exitCodeFor(report), 3, 'exit 3: nothing failed but E is open');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d⁗ · exportedForeignRows reads the real column names ────────────────
  {
    const A = { questionIds: new Set(['q1']), attemptIds: new Set(['a1']) };
    eq(exportedForeignRows({ learningEvents: [{ id: 'x', entity_id: 'q9' }], entities: [{ entity_id: 'e2' }] }, A).length, 0, 'own rows are not foreign');
    eq(exportedForeignRows({ learningEvents: [{ id: 'a1', entity_id: 'q9' }, { id: 'x', entity_id: 'q1' }], entities: [{ entity_id: 'q1' }] }, A).length, 3, 'rows keyed by A\'s attempt id or question id (entity_id, in learningEvents or entities) are foreign');
    eq(exportedForeignRows({ learningEvents: [{ entityId: 'q1' }] }, A).length, 1, 'a camelCased entityId is read too');
    eq(exportedForeignRows({}, A).length, 0, 'no arrays, no rows (the shape check, not this helper, fails that case)');
  }

  // ── 3e · a pre-existing account is signed in, never deleted ───────────────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      state.accounts.set('acct-owner', { id: 'acct-owner', email: 'owner@example.test', name: 'Owner', verified: true, ageBasis: 'adult', consent: 'not-required', password: null, events: [] });
      const report = await runAcceptance(baseArgs(origin, { cleanup: true, skip: new Set(['B', 'E']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir, nominate: async () => ({ ok: true, results: [] }) });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      ok(status.A === STATUS.PASS && status.B === STATUS.SKIPPED && status.E === STATUS.SKIPPED, 'an existing address signs in (no profile needed); --skip is honoured');
      ok(state.accounts.has('acct-owner'), 'cleanup never deletes an account that existed before the run');
      ok(report.accounts.find(a => a.role === 'A').created === false, 'the report says the account was not created by this run');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3f · no tester, or a non-human tester, is refused on an interactive run ──
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      for (const tester of [null, 'Claude agent', 'CI']) {
        await assert.rejects(runAcceptance(baseArgs(origin, { tester }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir }), error => error.code === 'TESTER_REQUIRED'); count += 1;
      }
      eq(state.accounts.size, 0, 'nothing was created without a named human');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3g · makeHttp: cookies absorbed, CSRF header on mutations only ────────
  {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url, init });
      return { status: 200, headers: { getSetCookie: () => ['pri_cloud_session=tok; Path=/', 'pri_csrf=csrf-tok; Path=/'] }, text: async () => '{"ok":true}' };
    };
    const http = makeHttp('https://h.example', { fetchImpl });
    const jar = {};
    await http('/v1/account/otp/verify', { method: 'POST', jar, body: { a: 1 } });
    ok(jar.pri_cloud_session === 'tok' && jar.pri_csrf === 'csrf-tok', 'set-cookie is absorbed into the jar');
    await http('/v1/practice/issue', { method: 'POST', jar, body: {} });
    const mutation = seen[1].init.headers;
    ok(mutation.origin === 'https://h.example' && mutation['x-pri-csrf'] === 'csrf-tok' && /pri_cloud_session=tok/.test(mutation.cookie), 'a mutation carries Origin, the CSRF header and the cookies');
    await http('/v1/account/me', { jar });
    ok(!('origin' in seen[2].init.headers) && !('x-pri-csrf' in seen[2].init.headers), 'a GET carries neither Origin nor the CSRF header');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · device-matrix-record: stable ids, refusals, the ledger and the doc
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(FAMILIES.length, 4, 'four device families: iPhone, iPad + Pencil, Android phone, Android tablet');
  eq(JOURNEY.length, 9, 'nine journey steps from install to History');
  eq(CASES.length, 36, '36 stable case ids');
  ok(CASES.every(c => /^DM-(IPH|IPD|AND|ANT)-0[1-9]-[A-Z]+$/.test(c.id)), 'case ids are DM-<family>-<seq>-<step>');
  eq(new Set(CASES.map(c => c.id)).size, CASES.length, 'case ids are unique');
  ok(['INSTALL', 'OTP', 'GUARDIAN', 'ISSUE', 'WRITE', 'PHOTO', 'TRANSCRIPT', 'MARK', 'HISTORY'].every((step, i) => JOURNEY[i].id === step), 'the journey is §22.2 in order');
  ok(CASES.filter(c => c.pencil).length === 1 && CASES.find(c => c.pencil).id === 'DM-IPD-05-WRITE', 'exactly one case is the Apple Pencil case');

  const doc = read('docs/release/device-matrix.md');
  const block = doc.split('<!-- device-matrix-cases:start -->')[1]?.split('<!-- device-matrix-cases:end -->')[0]?.trim();
  eq(block, casesMarkdown(), 'docs/release/device-matrix.md carries exactly the generated case table');
  ok(CASES.every(c => doc.includes(`\`${c.id}\``)), 'every case id is in the doc');
  ok(/PHYSICAL-HUMAN/.test(doc) && /never written into this matrix/.test(doc), 'the doc states the evidence class and the simulator rule');
  ok(/PRI_V1_RELEASE_SCOPE\.md.*§22\.2/.test(doc), 'the doc cites the §22.2 journey');
  ok(/results\.jsonl/.test(doc) && /device-matrix-record\.mjs/.test(doc), 'the doc names the ledger and the recorder');
  ok(/## What this matrix does not cover \(issue #10 stays open\)/.test(doc) && /Backup restore/.test(doc) && /Exam flows/.test(doc) && /Stage Manager/.test(doc) && /severity/.test(doc) && /Soak-test duration/.test(doc) && /must not close #10/.test(doc), 'the doc states which #10 gates this matrix does not cover and that #10 stays open');
  ok(/NOT_A_HUMAN/.test(doc) && /no\s+override/i.test(doc), 'the doc documents the fail-closed tester word list');
  ok(existsSync(join(ROOT, 'docs/release/evidence/device-matrix/README.md')) && /results\.jsonl/.test(read('docs/release/evidence/device-matrix/README.md')), 'the ledger directory is committed with a README naming the ledger');

  const dir = mkdtempSync(join(tmpdir(), 'pri-dm-'));
  const ledger = join(dir, 'results.jsonl');
  const base = { case: 'DM-IPH-02-OTP', result: 'pass', device: 'iPhone 16 Pro Max', os: 'iOS 26.0.1', sha: SHA, tester: 'Priya Example' };
  try {
    const written = recordResult(base, { ledger, now: Date.parse('2026-10-19T01:00:00Z') });
    ok(written.evidenceClass === 'PHYSICAL-HUMAN' && written.recorder === 'scripts/device-matrix-record.mjs', 'a pass by a named human on real hardware is recorded as PHYSICAL-HUMAN');
    eq(readLedger(ledger).length, 1, 'one line appended');
    const refusals = [
      ['a pass without a tester', { ...base, tester: undefined }, /named human/],
      ['a pass by an agent', { ...base, tester: 'Claude agent' }, /does not name a human/],
      ['a pass by "CI"', { ...base, tester: 'CI' }, /does not name a human/],
      ['a placeholder tester', { ...base, tester: 'tester' }, /does not name a human/],
      ['a real surname that is a refused word (fail-closed, the word is named)', { ...base, tester: 'Anita Tester' }, /the word "Tester" marks/],
      ['a simulator device', { ...base, device: 'iPhone 16 Pro Simulator' }, /simulator\/emulator/],
      ['an emulator device', { ...base, case: 'DM-AND-02-OTP', device: 'Pixel 6 emulator (API 36)' }, /simulator\/emulator/],
      ['a missing OS', { ...base, os: '' }, /needs --os/],
      ['a short SHA', { ...base, sha: 'e3f9cabe1' }, /40-hex/],
      ['an unknown case', { ...base, case: 'DM-IPH-99-NOPE' }, /unknown case id/],
      ['an unknown result', { ...base, result: 'maybe' }, /result must be one of/],
      ['the Pencil case without a Pencil', { ...base, case: 'DM-IPD-05-WRITE', device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.0.1' }, /needs --pencil/],
      ['a blocked row without a reason', { case: 'DM-AND-01-INSTALL', result: 'blocked', sha: SHA }, /needs --notes/],
      ['a fail without a tester', { ...base, result: 'fail', tester: null }, /named human/]
    ];
    for (const [name, input, pattern] of refusals) {
      assert.throws(() => recordResult(input, { ledger }), error => error.exitCode === 2 && error.problems.some(p => pattern.test(p)), `refuses ${name}`); count += 1;
    }
    eq(readLedger(ledger).length, 1, 'a refusal writes nothing');
    const pencil = recordResult({ ...base, case: 'DM-IPD-05-WRITE', device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.0.1', pencil: 'Apple Pencil Pro' }, { ledger, now: Date.parse('2026-10-19T01:01:00Z') });
    ok(pencil.pencil === 'Apple Pencil Pro', 'the Pencil case records the Pencil model');
    const blocked = recordResult({ case: 'DM-AND-01-INSTALL', result: 'blocked', sha: SHA, notes: 'no Android device available' }, { ledger, now: Date.parse('2026-10-19T01:02:00Z') });
    ok(blocked.evidenceClass === 'BLOCKED-EXTERNAL' && blocked.tester === null, 'a blocked row needs no tester and is BLOCKED-EXTERNAL, never physical evidence');
    recordResult({ ...base, result: 'fail', notes: 'code arrived but the field did not autofill' }, { ledger, now: Date.parse('2026-10-19T02:00:00Z') });
    const summary = summarise(readLedger(ledger), { sha: SHA });
    eq(summary.rows.find(r => r.id === 'DM-IPH-02-OTP').latest.result, 'fail', 'the latest record per case wins');
    ok(summary.counts.pass === 1 && summary.counts.fail === 1 && summary.counts.blocked === 1 && summary.counts['not run'] === 33, 'the summary counts pass, fail, blocked and not run');
    eq(summarise(readLedger(ledger), { sha: OTHER }).counts['not run'], 36, 'another build has no evidence of its own');
    const md = reportMarkdown(summary);
    ok(md.includes('`DM-IPH-02-OTP` | FAIL') && md.includes('Priya Example') && md.includes('not run') && /PHYSICAL-HUMAN/.test(md), 'the markdown report names the tester, the result and the evidence class');
    eq(validateLedger(ledger).length, 0, 'the ledger the recorder wrote validates');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-10-19T03:00:00Z', case: 'DM-IPD-08-MARK', result: 'pass', device: 'iPad Pro', os: 'iPadOS 26', sha: SHA, tester: null, evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /named human/.test(e)), 'a hand-written pass without a tester is caught by validate');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + 'not json\n');
    ok(validateLedger(ledger).some(e => /not JSON/.test(e)), 'a corrupt line is caught by validate');
    eq(recordResult({ ...base, evidenceClass: 'SIMULATOR' }, { ledger }).evidenceClass, 'PHYSICAL-HUMAN', 'the recorder derives the evidence class from the result; a caller cannot set it');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-10-19T04:00:00Z', case: 'DM-IPH-01-INSTALL', result: 'pass', device: 'iPhone 16', os: 'iOS 26', sha: SHA, tester: 'Priya Example', evidenceClass: 'SIMULATOR', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /evidenceClass/.test(e)), 'a stored line with a smuggled evidence class is caught by validate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  if (existsSync(DEFAULT_LEDGER)) eq(validateLedger(DEFAULT_LEDGER).length, 0, 'the committed ledger validates');
  else ok(true, 'no committed ledger yet (no physical run has been recorded)');
  eq(problemsWith({ case: 'DM-IPH-01-INSTALL', result: 'pass', device: 'iPhone 16', os: 'iOS 26', sha: SHA, tester: 'Priya Example' }).length, 0, 'a complete pass has no problems');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · the documents these tools implement
// ═════════════════════════════════════════════════════════════════════════════
{
  const cutover = read('docs/operations/postgres-cutover.md');
  ok(cutover.includes(`\`schema_version\` = **${SCHEMA_VERSION}** and \`billing_schema_version\` = **${BILLING_SCHEMA_VERSION}**`), 'the cutover runbook states the schema versions of schemaVersions.js');
  ok(/### Schema versions and the migrations that set them/.test(cutover) && /20261016000000_rls_fail_closed\.sql/.test(cutover) && /RLS deny-by-default/.test(cutover), 'the runbook has the schema table ending at schema 12 (RLS deny-by-default)');
  ok(!/`schema_version` 11 \/ `billing_schema_version` 6/.test(cutover), 'the target-check bullet no longer says schema 11');
  ok(cutover.includes(`(today ${SCHEMA_VERSION} / ${BILLING_SCHEMA_VERSION}`), 'the rollback rule names the current versions');
  ok(/### 4\.6 Staging → production promotion order/.test(cutover) && /24 h soak/.test(cutover) && /release-nominate\.mjs/.test(cutover) && /deploy\/production/.test(cutover), 'the runbook has the promotion order with the 24 h soak gate');
  ok(/staging-acceptance\.mjs/.test(cutover) && /device-matrix/.test(cutover), 'the promotion order names the acceptance runner and the device matrix');
  const sections = ['Nominate', 'Verify staging', 'Staging acceptance', 'Device matrix', '24 h soak', 'Production database', 'Promote', 'Verify production', 'Rollback stance'];
  const order = sections.map(s => cutover.indexOf(`**${s}`));
  ok(order.every(i => i > 0) && order.every((i, k) => k === 0 || i > order[k - 1]), 'the promotion steps appear in order: nominate → verify → acceptance → devices → soak → database → promote → verify → rollback stance');
  ok(cutover.indexOf('**24 h soak') < cutover.indexOf('**Promote'), 'the soak gate comes before the promotion');

  const authority = read('docs/architecture/repository-authority.md');
  ok(authority.includes(STAGING_ORIGIN) && authority.includes(PRODUCTION_ORIGIN), 'repository-authority.md names the canonical staging and production origins');
  ok(/pri-learning-staging\.vercel\.app/.test(authority) && /retired/i.test(authority) && /Pri-Learning-India/.test(authority) && /#427/.test(authority), 'repository-authority.md records the retired Pri-Learning-India host (#427)');
  ok(/non-authoritative/.test(authority.split('### Retired host')[1] || ''), 'the retired host is classified non-authoritative');

  const checklist = read('docs/release/production-cutover-checklist.md');
  ok(/release-nominate\.mjs/.test(checklist) && /staging-acceptance\.mjs/.test(checklist) && /device-matrix\.md/.test(checklist), 'the cutover checklist points at the three tools');
  // The fake host of §3 mirrors these two server contracts; this pins them to the
  // source so a renamed field or a reordered guard shows up here, not on staging.
  const accountsSrc = read('server/platform/accounts.js');
  ok(/format:\s*'pri-account-export-v1'/.test(accountsSrc) && /learningEvents:\s*events/.test(accountsSrc) && /\bentities\b/.test(accountsSrc) && !/^\s*events,\s*$/m.test(accountsSrc.split("router.get('/export'")[1] || ''), 'GET /v1/account/export answers { format: pri-account-export-v1, learningEvents, entities } — the keys step E reads');
  ok(/SELECT id,device_id,device_seq,kind,entity_id,/.test(accountsSrc), 'export learningEvents rows carry entity_id (the column step E filters on)');
  ok(/requireSession\(db\), requireRecentAuth\(db\)/.test(accountsSrc.split("router.get('/export'")[1] || ''), 'GET /v1/account/export is behind requireRecentAuth — the fresh-proof contract step E holds A\'s export to');
  const securitySrc = read('server/platform/security.js');
  const serverWindow = securitySrc.match(/export const REAUTH_FRESH_MS = ([^;]+);/)?.[1];
  eq(serverWindow && Function(`return (${serverWindow})`)(), EXPORT_FRESH_MS, `the runner's EXPORT_FRESH_MS equals the server's REAUTH_FRESH_MS (${serverWindow})`);
  const practiceSrc = read('server/platform/practice.js');
  ok(/router\.use\(requireSession\(db\), requireVerifiedEmail, requireRole\('student'\)\)/.test(practiceSrc), 'the practice router refuses unverified accounts before any ownership lookup (why step E signs B2 up by code)');
  ok(/404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account\.'/.test(practiceSrc), 'the ownership refusal is 404 QUESTION_NOT_FOUND — what step E asserts');
  for (const route of ['/:id/recognize', '/:id/repeat', '/:id/reveal', '/:id/submit']) ok(practiceSrc.includes(`router.post('${route}'`), `${route} is a practice route (the four ownership probes of step E)`);
  const syncSrc = read('server/platform/sync.js');
  ok(/return \{ schemaVersion: SCHEMA, cursor: cutoff, hasMore: [^}]*, events, entities \};/.test(syncSrc), 'GET /v1/sync/pull answers { …, events, entities } — the key step E reads from B2\'s pull');
  const readme = read('tools/acceptance/README.md');
  ok(/# Staging acceptance A–D/.test(readme) && /HUMAN STEP/.test(readme) && /SYNTHETIC/.test(readme), 'tools/acceptance/README.md documents the staging acceptance and its evidence classes');
  ok(/QUESTION_NOT_FOUND/.test(readme) && /EMAIL_UNVERIFIED/.test(readme) && !/needs no action/.test(readme), 'the README says E uses a verified code account and asserts the ownership refusal, not merely non-success');
  ok(/takeover|pre-registration/i.test(readme), 'the README warns about the unverified-password-account takeover on step A');
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.scripts['test:release:prep']?.includes('tools/release-prep.test.mjs') && pkg.scripts['test:release:prep'].includes('device-matrix-record.mjs validate'), 'test:release:prep runs this file and the ledger validation');
  ok(pkg.scripts.test.includes('npm run test:release:prep'), 'npm test (the CI deterministic suite) runs test:release:prep');
}

console.log(`RELEASE PREP: PASS — ${count}/${count} checks`);
