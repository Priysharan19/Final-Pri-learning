// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · two regions share nothing (plan H2, ADR-0002 §9)
//
// Two servers in one process, configured as the two editions — A Priyabhata,
// B Prithagoras — each over its OWN database and with its OWN delivery key,
// exactly as the two regional deployments will run. Proves, with no
// Australian infrastructure:
//
//   1. The database binding (server/platform/edition.js bindDatabaseEdition):
//      empty → bound to the server's edition; bound to self → starts; bound to
//      the other → refuses before a route is mounted; a database with accounts
//      and no binding (production India before H2) → Priyabhata binds it,
//      Prithagoras refuses; an unknown stored value refuses. Through
//      createServerApp too: B on A's database does not start.
//   2. Identity does not cross: A's account cannot sign in, restore a session,
//      reset a password, export, or read a resource or desk attempt on B; A's
//      session cookie, CSRF token, verification and reset tokens and
//      idempotency keys mean nothing to B.
//   3. Edition-scoped rows do not cross: a resource offered only to A's
//      edition is not in B's library and vice versa; B's desk attempt carries
//      B's edition and is unknown to A.
//   4. A client-supplied edition only ever refuses: every route in
//      docs/security/route-inventory.json, called on A with X-Pri-Edition
//      naming B, answers 409 EDITION_MISMATCH (health and readiness excepted,
//      which answer exactly as without it); an `edition` query parameter,
//      cookie or body field naming B changes neither the status nor brings
//      B's brand, currency or edition into the reply.
//   5. A payment webhook meant for A is refused by B without writing a row.
//   6. Static: no file under server/ reads an edition from req.headers,
//      req.query, req.body or req.cookies, except the one E2 middleware.
//
//   node server/test/region-isolation-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_EDITION;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { checks, registerAccount, startApp, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine, openTestStore } = await import('./support/engine.mjs');
const { asStore } = await import('../platform/store.js');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { bindDatabaseEdition, EDITION_META_KEY } = await import('../platform/edition.js');
const { createServerApp } = await import('../app.js');
const { RESOURCE_SEED, resourceRowValues } = await import('../platform/resourceCatalog.js');
const { EDITIONS } = await import('../../client/edition.config.mjs');

const c = checks();
const engine = requestedEngine();

// Each region's own configuration. Requests to one instance run with its
// variables in process.env (handlers that read the environment per request
// see their own region's), and the delivery keys differ so a token sealed by
// one cannot be opened by the other.
const REGION = {
  A: { PRI_EDITION: 'priyabhata', PRI_AUTH_DELIVERY_KEY: 'a1'.repeat(32) },
  B: { PRI_EDITION: 'prithagoras', PRI_AUTH_DELIVERY_KEY: 'b2'.repeat(32) }
};
function useRegion(name) {
  for (const [k, v] of Object.entries(REGION[name])) process.env[k] = v;
}
async function inRegion(name, fn) {
  const saved = Object.fromEntries(Object.keys(REGION[name]).map(k => [k, process.env[k]]));
  useRegion(name);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}
const errorCode = r => r.data?.error?.code ?? null;

// ── 1 · The binding, directly ─────────────────────────────────────────────────
const outcome = async promise => { try { const r = await promise; return r.bound; } catch (e) { return e.code; } };
{
  const fresh = async () => (await openTestStore(engine, { label: 'bind' }));
  const stored = async s => (await s.store.get('SELECT value FROM platform_meta WHERE key = ?', [EDITION_META_KEY]))?.value ?? null;
  for (const edition of ['priyabhata', 'prithagoras']) {
    const other = edition === 'priyabhata' ? 'prithagoras' : 'priyabhata';
    const s = await fresh();
    try {
      c.eq(await outcome(bindDatabaseEdition(s.store, edition)), 'new', `${edition}: an empty database is bound on first start`);
      c.eq(await stored(s), edition, `${edition}: platform_meta.edition records it`);
      c.eq(await outcome(bindDatabaseEdition(s.store, edition)), 'existing', `${edition}: a database bound to this edition starts`);
      c.eq(await outcome(bindDatabaseEdition(s.store, other)), 'EDITION_DATABASE_MISMATCH', `${other} refuses a database bound to ${edition}`);
      c.eq(await stored(s), edition, `${edition}: the refused start changed nothing`);
      let message = '';
      try { await bindDatabaseEdition(s.store, other); } catch (e) { message = e.message; }
      c.ok(!message.includes('\n') && message.includes(edition) && message.includes(other), 'the refusal is one line naming both editions');
    } finally { await s.close(); }
  }
  // A database from before the binding: accounts, no key.
  const legacy = async () => {
    const s = await fresh();
    await s.store.run('DELETE FROM platform_meta WHERE key = ?', [EDITION_META_KEY]);
    const now = Date.now();
    await s.store.run(`INSERT INTO accounts(id, email, name, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?)`, ['00000000-0000-4000-8000-0000000000aa', 'legacy@example.test', 'Legacy', 'x', now, now]);
    return s;
  };
  {
    const s = await legacy();
    try {
      c.eq(await outcome(bindDatabaseEdition(s.store, 'prithagoras')), 'EDITION_DATABASE_UNBOUND', 'Prithagoras refuses an unbound database that already holds accounts');
      c.eq(await stored(s), null, 'and binds nothing');
      c.eq(await outcome(bindDatabaseEdition(s.store, 'priyabhata')), 'legacy', 'Priyabhata binds an unbound database with accounts (production India before H2)');
      c.eq(await stored(s), 'priyabhata', 'as priyabhata');
      c.eq(await outcome(bindDatabaseEdition(s.store, 'prithagoras')), 'EDITION_DATABASE_MISMATCH', 'after which Prithagoras is refused as a mismatch');
    } finally { await s.close(); }
  }
  {
    const s = await fresh();
    try {
      await s.store.run('INSERT INTO platform_meta(key, value) VALUES (?, ?)', [EDITION_META_KEY, 'atlantis']);
      c.eq(await outcome(bindDatabaseEdition(s.store, 'priyabhata')), 'EDITION_DATABASE_MISMATCH', 'a database bound to an unknown edition refuses every server');
      c.eq(await outcome(bindDatabaseEdition(s.store, 'atlantis')), 'EDITION_UNKNOWN', 'a server cannot bind an edition it does not know');
      // Concurrent first starts of the same edition both succeed and agree.
      await s.store.run('DELETE FROM platform_meta WHERE key = ?', [EDITION_META_KEY]);
      const both = await Promise.all([outcome(bindDatabaseEdition(s.store, 'prithagoras')), outcome(bindDatabaseEdition(s.store, 'prithagoras'))]);
      c.ok(both.every(b => b === 'new' || b === 'existing') && (await stored(s)) === 'prithagoras', `two replicas starting at once bind once (${both.join(', ')})`);
    } finally { await s.close(); }
  }
}

// ── 2 · Two regions ───────────────────────────────────────────────────────────
useRegion('A');
const A = await startApp({ engine, log: () => {} });
useRegion('B');
const B = await startApp({ engine, log: () => {} });
delete process.env.PRI_EDITION;

const on = (name, h) => (path, opts) => inRegion(name, () => h.request(path, opts));
const a = on('A', A);
const b = on('B', B);
const storeA = asStore(A.db);
const storeB = asStore(B.db);

try {
  c.eq((await storeA.get('SELECT value FROM platform_meta WHERE key = ?', [EDITION_META_KEY]))?.value, 'priyabhata', 'A\'s database is bound to Priyabhata at start');
  c.eq((await storeB.get('SELECT value FROM platform_meta WHERE key = ?', [EDITION_META_KEY]))?.value, 'prithagoras', 'B\'s database is bound to Prithagoras at start');
  const [healthA, healthB] = [await a('/v1/health'), await b('/v1/health')];
  c.deq([healthA.data?.edition, healthB.data?.edition], ['priyabhata', 'prithagoras'], 'each server reports its own edition');

  // B on A's database, and A on its own, through the real app factory.
  const factory = async (name, db) => inRegion(name, async () => {
    try { await createServerApp(db, { dist: null, requestLog: false }); return 'started'; } catch (e) { return e.code; }
  });
  c.eq(await factory('B', A.db), 'EDITION_DATABASE_MISMATCH', 'a Prithagoras server pointed at the Priyabhata database refuses to start');
  c.eq(await factory('A', B.db), 'EDITION_DATABASE_MISMATCH', 'a Priyabhata server pointed at the Prithagoras database refuses to start');
  c.eq(await factory('A', A.db), 'started', 'a second Priyabhata replica on its own database starts');

  // ── Accounts and sessions ──────────────────────────────────────────────────
  const email = 'region-student@example.test';
  const password = 'correct-horse-battery';
  const studentA = await inRegion('A', () => registerAccount(A, { email, password }));
  c.eq(studentA.status, 201, 'a student registers in A');
  c.eq((await inRegion('A', () => verifyEmail(A, studentA.account.id))).status, 200, 'and verifies in A');
  c.eq((await a('/v1/account/me', { jar: studentA.jar })).status, 200, 'A\'s session restores on A');

  c.eq(await storeB.get('SELECT id FROM accounts WHERE id = ? OR email = ?', [studentA.account.id, email]) ?? null, null, 'B\'s database holds no trace of A\'s account');
  const loginB = await b('/v1/account/login', { method: 'POST', body: { email, password, deviceId: 'ipad-test' } });
  c.eq(loginB.status, 401, 'A\'s email and password do not sign in on B');
  const restoreB = await b('/v1/account/me', { jar: { ...studentA.jar } });
  c.eq(restoreB.status, 401, 'A\'s session cookie restores nothing on B');
  const exportB = await b('/v1/account/export', { jar: { ...studentA.jar } });
  c.eq(exportB.status, 401, 'A\'s session cannot export anything from B');
  const logoutAllB = await b('/v1/account/logout-all', { method: 'POST', jar: { ...studentA.jar } });
  c.ok([401, 403].includes(logoutAllB.status), `A's session cookie and CSRF token act on nothing on B (${logoutAllB.status})`);
  c.eq((await a('/v1/account/me', { jar: studentA.jar })).status, 200, 'and A\'s session is untouched by the attempt');
  // A verification token sealed in A: unknown to B, and unopenable with B's key.
  const outA = await storeA.get(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox WHERE account_id = ? ORDER BY created_at DESC`, [studentA.account.id]);
  let openedWithB = 'opened';
  await inRegion('B', async () => { try { decryptDeliveryToken(outA.token_ciphertext, `${studentA.account.id}:verify-email:${outA.token_id}`); } catch { openedWithB = 'refused'; } });
  c.eq(openedWithB, 'refused', 'B\'s delivery key cannot open a token A sealed');

  // Password reset: requested on A, the link used on B.
  c.eq((await a('/v1/account/password/reset-request', { method: 'POST', body: { email } })).status, 200, 'A queues a reset for its student');
  const resetRow = await storeA.get(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox WHERE account_id = ? AND kind = 'reset-password' AND delivered_at IS NULL ORDER BY created_at DESC`, [studentA.account.id]);
  const resetToken = await inRegion('A', () => decryptDeliveryToken(resetRow.token_ciphertext, `${studentA.account.id}:reset-password:${resetRow.token_id}`));
  const resetOnB = await b('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: 'another-horse-battery' } });
  c.ok(resetOnB.status >= 400 && resetOnB.status < 500, `A's reset link resets nothing on B (${resetOnB.status} ${errorCode(resetOnB)})`);
  const resetReqB = await b('/v1/account/password/reset-request', { method: 'POST', body: { email } });
  c.eq(resetReqB.status, 200, 'B answers a reset request for A\'s email exactly as for any unknown address');
  c.eq(Number((await storeB.get('SELECT count(*) AS n FROM auth_delivery_outbox')).n), 0, 'and queues no mail for it');
  c.eq((await a('/v1/account/login', { method: 'POST', body: { email, password, deviceId: 'ipad-test' } })).status, 200, 'A\'s password still works on A');

  // The same email registers independently in B: a different account.
  const studentB = await inRegion('B', () => registerAccount(B, { email, password: 'b-region-battery-staple' }));
  c.eq(studentB.status, 201, 'the same address registers separately in B');
  c.ok(studentB.account.id !== studentA.account.id, 'as a different account');
  c.eq((await inRegion('B', () => verifyEmail(B, studentB.account.id))).status, 200, 'and verifies in B');
  c.eq((await a('/v1/account/me', { jar: { ...studentB.jar } })).status, 401, 'B\'s session cookie restores nothing on A');
  const meA = await a('/v1/account/me', { jar: studentA.jar });
  c.eq(meA.data?.account?.id, studentA.account.id, 'A still answers A\'s own account');

  // ── Edition-scoped rows ─────────────────────────────────────────────────────
  const insertResource = async (store, id, editions) => {
    const r = { ...RESOURCE_SEED[0], id, editions, title: `Region ${id}`, description: `Test row ${id}.`, subtitle: null, tags: ['Test'] };
    await store.run(`INSERT INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,syllabus_version,certification_state,availability,url,source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
      VALUES (${Array(27).fill('?').join(',')})`, resourceRowValues(r));
    for (const e of editions) await store.run('INSERT INTO resource_editions(resource_id,edition) VALUES (?,?)', [id, e]);
  };
  await insertResource(storeA, 'india-region-paper', ['priyabhata']);
  await insertResource(storeB, 'au-region-paper', ['prithagoras']);
  const ids = r => (r.data?.resources || r.data?.items || []).map(x => x.id);
  const listA = await a('/v1/resources', { jar: studentA.jar });
  const listB = await b('/v1/resources', { jar: studentB.jar });
  c.eq(listA.status, 200, 'A lists its library');
  c.eq(listB.status, 200, 'B lists its library');
  c.ok(ids(listA).includes('india-region-paper') && !ids(listA).includes('au-region-paper'), 'A\'s library has A\'s paper and not B\'s');
  c.ok(ids(listB).includes('au-region-paper') && !ids(listB).includes('india-region-paper'), 'B\'s library has B\'s paper and not A\'s');
  c.eq((await b('/v1/resources/india-region-paper', { jar: studentB.jar })).status, 404, 'B cannot read A\'s resource');
  c.eq((await a('/v1/resources/au-region-paper', { jar: studentA.jar })).status, 404, 'A cannot read B\'s resource');
  c.eq((await b('/v1/resources/au-region-paper', { jar: { ...studentA.jar } })).status, 401, 'A\'s session cannot read B\'s resource');

  // Desk attempts and idempotency keys.
  const KEY = 'region-isolation-0001';
  const deskB = await b('/v1/desk/attempts', { method: 'POST', jar: studentB.jar, body: { resourceId: 'au-region-paper' }, headers: { 'Idempotency-Key': KEY } });
  c.eq(deskB.status, 201, 'a student starts a desk attempt in B');
  c.eq(deskB.data?.attempt?.edition, 'prithagoras', 'the attempt carries B\'s edition');
  const attemptId = deskB.data?.attempt?.id;
  c.eq((await a(`/v1/desk/attempts/${attemptId}`, { jar: studentA.jar })).status, 404, 'A knows nothing of B\'s attempt');
  c.eq((await a(`/v1/desk/attempts/${attemptId}`, { jar: { ...studentB.jar } })).status, 401, 'B\'s session cannot read B\'s attempt through A');
  c.eq(await storeA.get('SELECT id FROM desk_attempts WHERE id = ?', [attemptId]) ?? null, null, 'A\'s database holds no desk attempt of B\'s');
  const deskA = await a('/v1/desk/attempts', { method: 'POST', jar: studentA.jar, body: { resourceId: 'au-region-paper' }, headers: { 'Idempotency-Key': KEY } });
  c.ok(deskA.data?.replayed !== true && deskA.data?.attempt?.id !== attemptId, `B's idempotency key replays nothing on A (${deskA.status} ${errorCode(deskA)})`);
  c.eq(deskA.status, 404, 'and A will not start B\'s paper at all');

  // ── Payment webhook: A's provider event at B ────────────────────────────────
  const countRows = async (store, table) => { try { return Number((await store.get(`SELECT count(*) AS n FROM ${table}`)).n); } catch { return null; } };
  const before = await countRows(storeB, 'billing_events');
  const hook = await b('/v1/billing/webhook/web', { method: 'POST', body: { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_region_a', notes: { accountId: studentA.account.id } } } } }, headers: { 'X-Razorpay-Signature': '00'.repeat(32) } });
  c.ok(hook.status >= 400 && hook.status < 500, `B refuses a Razorpay webhook meant for A (${hook.status} ${errorCode(hook)})`);
  c.eq(await countRows(storeB, 'billing_events'), before, 'and writes no billing event');
  c.eq(Number((await storeB.get('SELECT count(*) AS n FROM entitlement_snapshots WHERE account_id = ?', [studentA.account.id])).n), 0, 'and grants A\'s account nothing in B');

  // ── 4 · A client-supplied edition only ever refuses ─────────────────────────
  const inventory = JSON.parse(readFileSync(join(ROOT, 'docs/security/route-inventory.json'), 'utf8')).routes;
  const OTHER = 'prithagoras';
  const otherBrand = EDITIONS[OTHER].brand;
  const FOREIGN = new RegExp(`${OTHER}|${otherBrand}|\\bAUD\\b|A\\$`, 'i');
  const HEALTH = new Set(['/v1/health', '/v1/ready']);
  const concrete = path => path.replace(/:[A-Za-z]+/g, '00000000-0000-4000-8000-000000000000').replace(/\/$/, '') || path;
  let headerRefused = 0;
  let unchanged = 0;
  for (const route of inventory) {
    const path = concrete(route.path);
    const method = route.method;
    const opts = method === 'GET' ? { jar: { ...studentA.jar } } : { method, body: {} };
    const headerCall = await a(path, { ...opts, jar: opts.jar ? { ...opts.jar } : undefined, headers: { 'X-Pri-Edition': OTHER } });
    if (HEALTH.has(path)) {
      c.ok(headerCall.status === 200 && headerCall.data?.edition !== OTHER, `${method} ${path}: X-Pri-Edition naming B leaves health answering A (${headerCall.status})`);
    } else {
      c.deq([headerCall.status, errorCode(headerCall)], [409, 'EDITION_MISMATCH'], `${method} ${path}: X-Pri-Edition naming B is refused`);
      headerRefused++;
    }
    if (method === 'GET') {
      const sep = path.includes('?') ? '&' : '?';
      const base = await a(path, { jar: { ...studentA.jar } });
      for (const [label, call] of [
        ['?edition=', () => a(`${path}${sep}edition=${OTHER}`, { jar: { ...studentA.jar } })],
        ['edition cookie', () => a(path, { jar: { ...studentA.jar, pri_edition: OTHER, edition: OTHER } })]
      ]) {
        const r = await call();
        const leaked = !FOREIGN.test(base.text || '') && FOREIGN.test(r.text || '');
        // Refuse-only: the same answer, or a refusal; never the other region's data.
        const refused = [400, 409].includes(r.status);
        c.ok((r.status === base.status || refused) && !leaked, `${method} ${path}: an ${label} naming B changes nothing (${base.status} → ${r.status}${leaked ? ', B leaked' : ''})`);
        unchanged++;
      }
    } else {
      const base = await a(path, { method, body: {} });
      const r = await a(path, { method, body: { edition: OTHER } });
      c.ok((r.status === base.status || [400, 409].includes(r.status)) && !(FOREIGN.test(r.text || '') && !FOREIGN.test(base.text || '')), `${method} ${path}: a body edition naming B changes nothing (${base.status} → ${r.status})`);
      unchanged++;
    }
  }
  c.ok(headerRefused >= inventory.length - 2 && inventory.length > 100, `every inventoried route was probed (${inventory.length} routes, ${headerRefused} refused, ${unchanged} variants unchanged)`);

  // ── 6 · Static: the edition is never read from a request ────────────────────
  const READS = [
    /req\.(headers|query|body|cookies|params)\s*(\?\.\s*\[|\[|\?\.|\.)\s*['"`]?[A-Za-z_-]*edition/i,
    /\{[^}]*\bedition\b[^}]*\}\s*=\s*req\.(headers|query|body|cookies|params)\b/i,
    /req\.(get|header)\(\s*(['"`][^'"`]*edition[^'"`]*['"`]|EDITION_HEADER)/i,
    /\bEDITION_HEADER\b/
  ];
  const scan = text => READS.some(re => re.test(text));
  // The scanner is not vacuous.
  for (const sample of ["const e = req.query.edition;", "const { edition } = req.body;", "req.get('x-pri-edition')", "req.headers['x-pri-edition']", "req.cookies?.edition"]) {
    c.ok(scan(sample), `the static scan catches ${sample}`);
  }
  c.ok(!scan('const edition = serverEdition();'), 'the static scan passes the server\'s own edition');
  const ALLOWED = new Set(['server/platform/edition.js']);
  const files = readdirSync(join(ROOT, 'server'), { recursive: true }).map(String)
    .filter(f => /\.(m?js|cjs)$/.test(f) && !/(^|\/)(node_modules|test)\//.test(f)).map(f => join('server', f));
  const offenders = files.filter(f => !ALLOWED.has(f) && scan(readFileSync(join(ROOT, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')));
  c.deq(offenders, [], `no server file reads an edition from a request except ${[...ALLOWED].join(', ')} (${files.length} files scanned)`);
  c.ok(scan(readFileSync(join(ROOT, 'server/platform/edition.js'), 'utf8')), 'the one allowed reader is the E2 refuse-only middleware');

  console.log(`engine: ${A.engine}`);
  console.log(`REGION ISOLATION (H2): PASS — ${c.count()} checks (${A.engine}) — the database binds to one edition and refuses the other; two regions share no account, session, token, idempotency key, resource, desk attempt or payment event; a client-supplied edition only ever refuses (${inventory.length} routes); no server file reads an edition from a request but the E2 middleware.`);
} finally {
  await A.close();
  await B.close();
}
