// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one deployment, one edition (ADR-0002, plan E2)
//
// What this suite holds (deterministic; nothing leaves the machine):
//
//   1 · the built client's edition is read from its features.json: a missing
//       dist, a dist with no edition, an unreadable file and an unknown id
//       are each told apart;
//   2 · the start-up agreement: same edition starts; a different one refuses
//       in every environment and names both; a dist that names no edition
//       refuses in production and only warns elsewhere; no dist is no check;
//       an unknown PRI_EDITION still throws;
//   3 · the real app (server/app.js) refuses to be built over a dist of the
//       other edition, and the real process (server/index.js) stops with one
//       line before it opens the database;
//   4 · over real HTTP: a client that declares the other edition in
//       X-Pri-Edition gets 409 EDITION_MISMATCH on every /v1 route family,
//       and 200 on /v1/health (and its usual answer on /v1/ready); a matching
//       or absent header changes nothing; a malformed one is refused without
//       being echoed;
//   5 · the edition is never chosen by a request: a body field or a query
//       parameter named `edition` changes no reply.
//
//   node server/test/edition-agreement-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, EDITION_IDS } from '../../client/edition.config.mjs';
import { EDITION_HEADER, assertEditionAgreement, builtClientEdition, refuseOtherEdition, serverEdition } from '../platform/edition.js';
import { createPlatformDb } from '../platform/db.js';
import { createServerApp } from '../app.js';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';

const c = checks();
const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const scratch = mkdtempSync(join(tmpdir(), 'pri-edition-'));
const savedEdition = process.env.PRI_EDITION;
delete process.env.PRI_EDITION;

let distCount = 0;
/** A built client: index.html plus whatever features.json is given (undefined = none). */
function distWith(features) {
  const dir = join(scratch, `dist-${++distCount}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Pri</title></head><body><div id="root"></div></body></html>\n');
  if (features !== undefined) writeFileSync(join(dir, 'features.json'), typeof features === 'string' ? features : JSON.stringify(features));
  return dir;
}
const INDIA = distWith({ library: false, edition: 'priyabhata' });
const AUSTRALIA = distWith({ library: false, edition: 'prithagoras' });
const OLD_BUILD = distWith({ library: false });
const NO_MANIFEST = distWith(undefined);
const DAMAGED = distWith('{"edition": "priyabh');
const UNKNOWN = distWith({ edition: 'atlantis' });
const MISSING = join(scratch, 'never-built');
const thrown = fn => { try { fn(); return null; } catch (error) { return error; } };
const jsonOf = async response => { try { return JSON.parse(await response.text()); } catch { return null; } };
let india = null;
let australia = null;

try {
  // ── 1 · What a built client says it is ──────────────────────────────────────
  c.deq(EDITION_IDS, ['priyabhata', 'prithagoras'], 'the two editions this suite is written against');
  c.eq(builtClientEdition(INDIA), 'priyabhata', 'a Priyabhata build says priyabhata');
  c.eq(builtClientEdition(AUSTRALIA), 'prithagoras', 'a Prithagoras build says prithagoras');
  c.eq(builtClientEdition(OLD_BUILD), null, 'a build from before editions says nothing');
  c.eq(builtClientEdition(NO_MANIFEST), null, 'a dist with no features.json says nothing');
  c.eq(builtClientEdition(DAMAGED), null, 'a damaged features.json says nothing');
  c.eq(builtClientEdition(MISSING), null, 'a dist that does not exist says nothing');
  c.eq(builtClientEdition(null), null, 'no dist at all says nothing');
  c.eq(builtClientEdition(UNKNOWN), 'atlantis', 'an unknown id is reported as written, for the agreement check to refuse');
  for (const [value, label] of [[5, 'a number'], [{ id: 'priyabhata' }, 'an object'], [['priyabhata'], 'an array'], ['   ', 'blank text'], [null, 'null'], [true, 'true']]) {
    c.eq(builtClientEdition(distWith({ edition: value })), null, `an edition that is ${label} is not an edition`);
  }
  c.eq(builtClientEdition(distWith({ edition: ' prithagoras\n' })), 'prithagoras', 'surrounding white space is not part of the id');

  // ── 2 · The start-up agreement ───────────────────────────────────────────────
  const warnings = [];
  const warn = line => warnings.push(line);
  const agree = (dist, edition, production) => assertEditionAgreement({ dist, env: edition ? { PRI_EDITION: edition } : {}, production, warn });

  c.deq(agree(INDIA, null, true), { edition: 'priyabhata', client: 'priyabhata', checked: true }, 'production: a Priyabhata server over a Priyabhata build starts (PRI_EDITION unset is Priyabhata)');
  c.deq(agree(INDIA, 'priyabhata', true), { edition: 'priyabhata', client: 'priyabhata', checked: true }, 'production: and with PRI_EDITION=priyabhata');
  c.deq(agree(AUSTRALIA, 'prithagoras', true), { edition: 'prithagoras', client: 'prithagoras', checked: true }, 'production: a Prithagoras server over a Prithagoras build starts');
  c.deq(agree(AUSTRALIA, 'prithagoras', false), { edition: 'prithagoras', client: 'prithagoras', checked: true }, 'development: the same');

  for (const production of [true, false]) {
    const where = production ? 'production' : 'development';
    for (const [dist, server, client] of [[AUSTRALIA, 'priyabhata', 'prithagoras'], [INDIA, 'prithagoras', 'priyabhata']]) {
      const error = thrown(() => agree(dist, server, production));
      c.ok(error?.code === 'EDITION_MISMATCH' && error.serverEdition === server && error.clientEdition === client, `${where}: a ${server} server refuses a ${client} build`);
      c.ok(error.message.includes(server) && error.message.includes(client) && !error.message.includes('\n'), `${where}: and says so in one line naming both (${server}, ${client})`);
    }
    const unset = thrown(() => agree(AUSTRALIA, null, production));
    c.ok(unset?.code === 'EDITION_MISMATCH' && unset.serverEdition === 'priyabhata', `${where}: a server with PRI_EDITION unset is Priyabhata, and refuses a Prithagoras build`);
    const unknown = thrown(() => agree(UNKNOWN, 'priyabhata', production));
    c.ok(unknown?.code === 'EDITION_MISMATCH' && unknown.message.includes('"atlantis"'), `${where}: a build for an unknown edition is refused, not treated as undeclared`);
    c.deq(agree(MISSING, 'prithagoras', production), { edition: 'prithagoras', client: null, checked: false }, `${where}: with no dist there is nothing to cross-check, and the server starts`);
    c.deq(agree(null, 'prithagoras', production), { edition: 'prithagoras', client: null, checked: false }, `${where}: the same when no dist is configured`);
    const typo = thrown(() => agree(INDIA, 'typo', production));
    c.ok(typo && /PRI_EDITION="typo" is not an edition/.test(typo.message), `${where}: an unknown PRI_EDITION still throws`);
    c.ok(thrown(() => agree(MISSING, 'typo', production)), `${where}: and does so even with no dist`);
  }
  c.eq(warnings.length, 0, 'none of the above warned');

  for (const [dist, label] of [[OLD_BUILD, 'a build that names no edition'], [NO_MANIFEST, 'a build with no features.json'], [DAMAGED, 'a build with a damaged features.json']]) {
    const refused = thrown(() => agree(dist, 'priyabhata', true));
    c.ok(refused?.code === 'EDITION_UNDECLARED' && refused.serverEdition === 'priyabhata' && refused.message.includes('priyabhata') && !refused.message.includes('\n'), `production: ${label} is refused, in one line`);
    c.eq(warnings.length, 0, `production: ${label} is refused without a warning`);
    c.deq(agree(dist, 'priyabhata', false), { edition: 'priyabhata', client: null, checked: false }, `development: ${label} starts`);
    c.ok(warnings.length === 1 && /^edition_undeclared: /.test(warnings[0]) && warnings[0].includes('priyabhata'), `development: ${label} is warned about, once`);
    warnings.length = 0;
  }
  const fromEnv = thrown(() => assertEditionAgreement({ dist: OLD_BUILD, env: { NODE_ENV: 'production' }, warn }));
  c.ok(fromEnv?.code === 'EDITION_UNDECLARED' && warnings.length === 0, 'production is read from NODE_ENV when the caller does not say');
  c.deq(assertEditionAgreement({ dist: OLD_BUILD, env: { NODE_ENV: 'test' }, warn }), { edition: 'priyabhata', client: null, checked: false }, 'and any other NODE_ENV is not production');
  warnings.length = 0;

  // ── 3 · The real app and the real process ────────────────────────────────────
  await c.rejects(() => createServerApp(createPlatformDb(':memory:'), { production: false, dist: AUSTRALIA, requestLog: false }),
    error => error.code === 'EDITION_MISMATCH' && /priyabhata/.test(error.message) && /prithagoras/.test(error.message),
    'server/app.js will not build a Priyabhata app over a Prithagoras client');
  {
    const appSource = readFileSync(join(serverRoot, 'app.js'), 'utf8');
    c.ok(appSource.indexOf('assertEditionAgreement({ dist, production })') > 0 && appSource.indexOf('assertEditionAgreement({ dist, production })') < appSource.indexOf('const app = express();'), 'the app checks the dist it was given, with its own production flag, before it builds anything');
    const entry = readFileSync(join(serverRoot, 'index.js'), 'utf8');
    const at = text => entry.indexOf(text);
    c.ok(at('assertEditionAgreement({ dist: DEFAULT_DIST })') > 0, 'the process entry checks the dist it will serve');
    c.ok(at('assertEditionAgreement({ dist: DEFAULT_DIST })') < at('openPlatformStore()') && at('openPlatformStore()') < at('app.listen('), 'and does so before the database is opened and before it listens');
  }
  {
    // The real entry point, as a real process. An unknown edition is the one
    // refusal that needs no dist of its own, so it runs the same in CI and here.
    const run = spawnSync(process.execPath, [join(serverRoot, 'index.js')], {
      cwd: serverRoot, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, NODE_ENV: 'development', PORT: '0', PRI_EDITION: 'atlantis', PRI_PLATFORM_DB: join(scratch, 'never-opened.db') }
    });
    c.eq(run.status, 1, 'node server/index.js exits 1 when its edition cannot be agreed');
    const lines = run.stderr.trim().split('\n');
    c.ok(lines.length === 1 && /PRI_EDITION="atlantis" is not an edition/.test(lines[0]), `and prints exactly one line saying why (${JSON.stringify(run.stderr.slice(0, 200))})`);
    c.ok(!/platform_db_open|running on port/.test(run.stdout), 'having neither opened the database nor listened');
  }

  // ── 4 · X-Pri-Edition over real HTTP ─────────────────────────────────────────
  india = await startApp({ dist: INDIA });
  const other = { [EDITION_HEADER]: 'prithagoras' };
  const same = { [EDITION_HEADER]: 'priyabhata' };
  const login = headers => india.request('/v1/account/login', { method: 'POST', headers, body: { email: 'nobody@example.test', password: 'not-a-real-password', deviceId: 'edition-check' } });

  const refusedLogin = await login(other);
  c.eq(refusedLogin.status, 409, 'a Prithagoras app is refused on /v1/account/login by a Priyabhata server');
  c.deq(refusedLogin.data.error, {
    code: 'EDITION_MISMATCH',
    message: "This app is Prithagoras. It cannot sign in to Priyabhata's service.",
    serverEdition: 'priyabhata',
    clientEdition: 'prithagoras'
  }, 'with a coded body that names both editions');
  c.ok(refusedLogin.headers.get('cache-control') === 'no-store' && typeof refusedLogin.data.requestId === 'string', 'the refusal is never cached and carries its request id');

  const health = await india.request('/v1/health', { headers: other });
  c.ok(health.status === 200 && health.data.edition === 'priyabhata', '/v1/health still answers 200 to the mismatched app, and tells it which service it reached');
  const plainHealth = await india.request('/v1/health');
  c.deq(Object.keys(health.data).sort(), Object.keys(plainHealth.data).sort(), 'the health reply has the same keys with or without the header');
  const ready = await india.request('/v1/ready', { headers: other });
  const plainReady = await india.request('/v1/ready');
  c.ok(ready.status !== 409 && ready.status === plainReady.status, '/v1/ready answers the mismatched app as it answers anyone');
  const head = await india.request('/v1/health', { method: 'HEAD', headers: other });
  c.eq(head.status, 200, 'HEAD /v1/health too');

  const absent = await login({});
  const matching = await login(same);
  c.ok(absent.status === 401 && matching.status === 401, 'without the header, or with the matching one, sign-in is decided as it always was (wrong password: 401)');
  c.deq(matching.data.error, absent.data.error, 'and the two replies are the same');

  const FAMILIES = [
    ['GET', '/v1/account/me'], ['POST', '/v1/account/register'], ['POST', '/v1/account/otp/request'], ['POST', '/v1/account/identity/nonce'],
    ['GET', '/v1/sync/pull/0'], ['GET', '/v1/entitlements'], ['GET', '/v1/billing/config'], ['POST', '/v1/billing/webhook/web'],
    ['GET', '/v1/classes'], ['GET', '/v1/content/index'], ['POST', '/v1/practice/prepare'], ['POST', '/v1/practice/issue'],
    ['GET', '/v1/exams'], ['GET', '/v1/resources'], ['POST', '/v1/handwriting/transcribe'], ['POST', '/v1/working/check'],
    ['POST', '/v1/question-photo/read'], ['POST', '/v1/tutor/help'], ['POST', '/v1/telemetry/event'], ['GET', '/v1/admin/health'],
    ['GET', '/v1/metrics'], ['GET', '/v1/no-such-route'], ['GET', '/v1/health/extra']
  ];
  for (const [method, path] of FAMILIES) {
    const body = method === 'GET' ? undefined : {};
    const refused = await india.request(path, { method, headers: other, body });
    c.ok(refused.status === 409 && refused.data?.error?.code === 'EDITION_MISMATCH', `${method} ${path} refuses the other edition`);
    const usual = await india.request(path, { method, body });
    const declared = await india.request(path, { method, headers: same, body });
    c.ok(usual.status !== 409 && declared.status === usual.status && (declared.data?.error?.code ?? null) === (usual.data?.error?.code ?? null),
      `${method} ${path} answers the same with no header and with the matching one (${usual.status})`);
  }

  const noise = 'Z'.repeat(300);
  for (const [value, label] of [['PRIYABHATA', 'the right id in the wrong case'], ['priyabhata,prithagoras', 'two ids'], ['atlantis', 'an unknown id'], [noise, 'a long unknown value'], ['<script>', 'markup']]) {
    const refused = await login({ [EDITION_HEADER]: value });
    c.ok(refused.status === 409 && refused.data.error.code === 'EDITION_MISMATCH' && refused.data.error.clientEdition === null && refused.data.error.serverEdition === 'priyabhata',
      `${label} is refused, with no client edition named`);
    c.ok(!JSON.stringify(refused.data).includes(value) && refused.data.error.message === "This app was not made for Priyabhata's service.", `and ${label} is not echoed back`);
  }
  c.eq((await login({ [EDITION_HEADER]: ' priyabhata ' })).status, 401, 'optional white space around the value is HTTP, not a different edition');

  // The guard itself, unmounted: it only ever refuses or passes.
  {
    const guard = refuseOtherEdition('prithagoras');
    let passed = 0;
    const res = { locals: {}, set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    guard({ get: () => undefined }, res, () => { passed += 1; });
    guard({ get: () => 'prithagoras' }, res, () => { passed += 1; });
    c.ok(passed === 2 && res.code === undefined, 'no header and the matching header call next() and write nothing');
    guard({ get: () => 'priyabhata', requestId: 'r1' }, res, () => { passed += 1; });
    c.ok(passed === 2 && res.code === 409 && res.locals.errorCode === 'EDITION_MISMATCH' && res.body.error.message === "This app is Priyabhata. It cannot sign in to Prithagoras's service.", 'the other edition is answered 409 and next() is not called');
    guard({ get: () => '' }, res, () => { passed += 1; });
    c.ok(passed === 2 && res.body.error.clientEdition === null, 'an empty declaration is a declaration of nothing this server serves');
  }

  // ── 5 · A request never chooses the edition ──────────────────────────────────
  const strip = data => JSON.parse(JSON.stringify(data, (key, value) => (['checkedAt', 'requestId'].includes(key) ? undefined : value)));
  c.deq(strip((await india.request('/v1/health?edition=prithagoras')).data), strip(plainHealth.data), 'GET /v1/health?edition=prithagoras is the same reply: the edition is still priyabhata');
  const student = await registerAccount(india, { email: 'edition-student@example.test' });
  c.eq(student.status, 201, 'a student registers on the Priyabhata server');
  const me = await india.request('/v1/account/me', { jar: student.jar });
  const meQuery = await india.request('/v1/account/me?edition=prithagoras', { jar: student.jar });
  c.ok(me.status === 200 && meQuery.status === 200, 'the account reads itself, with and without ?edition=');
  c.deq(strip(meQuery.data), strip(me.data), 'and ?edition=prithagoras changes nothing in the reply');
  c.ok(!JSON.stringify(me.data).includes('prithagoras'), 'which names no other edition');
  const withField = await india.request('/v1/account/login', { method: 'POST', body: { email: 'nobody@example.test', password: 'not-a-real-password', deviceId: 'edition-check', edition: 'prithagoras' } });
  c.ok(withField.status === absent.status, 'a body field named edition does not change how sign-in is answered');
  c.deq(withField.data.error, absent.data.error, 'nor what it says');
  const billing = await india.request('/v1/billing/config');
  const billingQuery = await india.request('/v1/billing/config?edition=prithagoras', { headers: same });
  c.ok(billing.status === 200 && billingQuery.status === 200, 'the public billing configuration answers');
  c.deq(billingQuery.data, billing.data, 'and is the same whatever edition the query names (currency and prices are the server\'s)');
  const after = await india.request('/v1/health', { headers: other });
  c.eq(after.data.edition, 'priyabhata', 'after all of that the server is still Priyabhata');
  await india.close();
  india = null;

  // The other way round: a Prithagoras deployment.
  process.env.PRI_EDITION = 'prithagoras';
  c.eq(serverEdition(), 'prithagoras', 'PRI_EDITION=prithagoras');
  await c.rejects(() => createServerApp(createPlatformDb(':memory:'), { production: false, dist: INDIA, requestLog: false }),
    error => error.code === 'EDITION_MISMATCH' && error.serverEdition === 'prithagoras' && error.clientEdition === 'priyabhata',
    'server/app.js will not build a Prithagoras app over a Priyabhata client');
  await c.rejects(() => createServerApp(createPlatformDb(':memory:'), { production: true, dist: OLD_BUILD, requestLog: false }),
    error => error.code === 'EDITION_UNDECLARED',
    'in production it will not build over a client that names no edition');
  australia = await startApp({ dist: AUSTRALIA });
  const auHealth = await australia.request('/v1/health', { headers: { [EDITION_HEADER]: 'priyabhata' } });
  c.ok(auHealth.status === 200 && auHealth.data.edition === 'prithagoras', 'a Prithagoras server tells a Priyabhata app what it is');
  const auLogin = await australia.request('/v1/account/login', { method: 'POST', headers: { [EDITION_HEADER]: 'priyabhata' }, body: { email: 'nobody@example.test', password: 'not-a-real-password', deviceId: 'edition-check' } });
  c.ok(auLogin.status === 409 && auLogin.data.error.message === "This app is Priyabhata. It cannot sign in to Prithagoras's service." && auLogin.data.error.serverEdition === 'prithagoras' && auLogin.data.error.clientEdition === 'priyabhata',
    'and refuses its sign-in, naming both');
  const auOwn = await australia.request('/v1/account/login', { method: 'POST', headers: { [EDITION_HEADER]: 'prithagoras' }, body: { email: 'nobody@example.test', password: 'not-a-real-password', deviceId: 'edition-check' } });
  c.eq(auOwn.status, 401, 'while its own app is answered as usual');
  // The page it serves is the one it was checked against.
  const page = await fetch(`${australia.origin}/features.json`);
  c.eq((await jsonOf(page))?.edition, 'prithagoras', 'the features.json it serves names the edition /v1/health does');
  c.ok(Object.values(EDITIONS).every(e => e.brand === e.id[0].toUpperCase() + e.id.slice(1)), 'each brand is its id with a capital letter (what the client shows for an edition it does not carry)');
} finally {
  if (india) await india.close();
  if (australia) await australia.close();
  if (savedEdition === undefined) delete process.env.PRI_EDITION; else process.env.PRI_EDITION = savedEdition;
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`EDITION AGREEMENT (E2): PASS — ${c.count()}/${c.count()} checks — the server starts only over a client of its own edition, X-Pri-Edition only ever refuses (409 everywhere but health and readiness), and no request chooses the edition.`);
