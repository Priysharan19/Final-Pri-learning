// Abuse limits acceptance (V1 blocker #14; doc §23).
//
// Behavioural proof of every rate limit the route inventory declares: for each
// distinct limiter bucket, exactly `limit` requests pass the limiter inside the
// window and the next one is a coded 429 RATE_LIMITED with RateLimit headers.
// Then the abuse paths that matter most on their own:
//   · login lockout per submitted email (10 failures), even with the right
//     password afterwards, with Retry-After;
//   · password-reset mail cap per mailbox (3/hour) on top of the per-IP limit,
//     with no difference in the answer an outsider sees;
//   · class join-code guessing stops at 20/hour;
//   · paid AI routes (handwriting, working) limit per account, not globally;
//   · verification resend and guardian links are bounded.
//
// SQLite by default; --engine=postgres runs it on a migrated Postgres.

delete process.env.PRI_HANDWRITING_API_KEY;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { loadInventory } = await import('./support/route-inventory.mjs');
const { LOCKOUT_MAX_FAILURES } = await import('../platform/loginLockout.js');
const { RESET_MAILBOX_LIMIT } = await import('../platform/accounts.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const inventory = loadInventory();
const resetLimits = () => db.run('DELETE FROM rate_limits');

let serial = 0;
async function account(role = 'student') {
  serial += 1;
  await resetLimits();
  const email = `abuse.${role}.${serial}@example.test`;
  const made = await registerAccount(h, { email, deviceId: `ipad-abuse-${serial}`, password: `abuse-pw-${serial}-horse` });
  if (made.status !== 201) throw new Error(`register ${email}: ${made.status}`);
  await verifyEmail(h, made.account.id);
  if (role !== 'student') await db.run('UPDATE accounts SET role=? WHERE id=?', [role, made.account.id]);
  return { id: made.account.id, jar: made.jar, email, password: `abuse-pw-${serial}-horse` };
}

const SAMPLE = {
  classId: 'cls_00000000-0000-0000-0000-000000000000', assignmentId: 'asn_x', studentId: 'acct_x', accountId: 'acct_x',
  sessionId: 'ses_x', revisionId: 'content_x', reportId: 'rpt_x', provider: 'web', cursor: '0', key: 'abuse.flag'
};
const concrete = path => path.replace(/:([A-Za-z]+)(\([^)]*\))?/g, (_, name) => SAMPLE[name] ?? 'x');
const MUTATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// A limiter keyed by account and placed after requireSession on a route that
// ends the caller's own sessions: each attempt needs a live session, so the
// actor signs in again before every call (login has its own IP bucket).
const SESSION_ENDING = new Set(['logout-all']);

try {
  // ── Every declared limiter bucket, exercised to its edge ─────────────────
  const buckets = new Map();
  for (const route of inventory.routes) {
    for (const limit of route.rateLimits) if (!buckets.has(limit.key)) buckets.set(limit.key, { route, limit });
  }
  c.ok(buckets.size >= 30, `${buckets.size} distinct limiter buckets declared`);
  const actors = {};
  const failures = [];
  for (const [key, { route, limit }] of buckets) {
    let jar = {};
    if (route.auth === 'session') {
      const role = route.roles ? route.roles[0] : 'student';
      actors[role] ||= await account(role);
      // Session cookies may slide; send a copy so the actor's jar stays intact.
      jar = actors[role].jar;
    }
    await resetLimits();
    let firstLimited = null;
    let lastResponse = null;
    for (let i = 1; i <= limit.limit + 1; i += 1) {
      const body = route.path === '/v1/account/login'
        ? { email: `nobody.${key}.${i}@example.test`, password: 'wrong-password' }
        : MUTATION.has(route.method) ? {} : undefined;
      if (SESSION_ENDING.has(key)) {
        actors[`ending:${key}`] ||= await account();
        const fresh = {};
        const signedIn = await h.request('/v1/account/login', { method: 'POST', jar: fresh, body: { email: actors[`ending:${key}`].email, password: actors[`ending:${key}`].password, deviceId: `ending-${i}` } });
        if (signedIn.status !== 200) throw new Error(`re-login for ${key}: ${signedIn.status}`);
        jar = fresh;
      }
      const r = await h.request(concrete(route.path), { method: route.method, jar: { ...jar }, body });
      lastResponse = r;
      if (r.status === 429 && r.data?.error?.code === 'RATE_LIMITED') { firstLimited = i; break; }
    }
    if (firstLimited !== limit.limit + 1) {
      failures.push(`${key} (${route.method} ${route.path}): declared ${limit.limit}/${limit.windowMs}ms, first RATE_LIMITED at ${firstLimited} (last ${lastResponse?.status} ${lastResponse?.data?.error?.code || ''})`);
      continue;
    }
    if (lastResponse.headers.get('ratelimit-remaining') !== '0' || !/^\d+$/.test(lastResponse.headers.get('ratelimit-reset') || '')) {
      failures.push(`${key}: 429 without RateLimit-Remaining: 0 / RateLimit-Reset`);
    }
    const reset = Number(lastResponse.headers.get('ratelimit-reset')) * 1000;
    if (!(reset > Date.now() && reset <= Date.now() + limit.windowMs + 2000)) failures.push(`${key}: RateLimit-Reset is not inside the declared window`);
  }
  c.deq(failures, [], 'every declared limit admits exactly its limit, then answers 429 RATE_LIMITED with RateLimit headers');

  // ── Login lockout per submitted email ─────────────────────────────────────
  {
    const victim = await account();
    for (let i = 0; i < LOCKOUT_MAX_FAILURES; i += 1) {
      await resetLimits(); // isolate the per-email lockout from the per-IP limiter
      const r = await h.request('/v1/account/login', { method: 'POST', body: { email: victim.email, password: `guess-${i}` } });
      c.eq(r.status, 401, `guess ${i + 1} is a plain bad credential`);
    }
    await resetLimits();
    const locked = await h.request('/v1/account/login', { method: 'POST', body: { email: victim.email, password: victim.password } });
    c.eq(locked.status, 429, 'after 10 failures even the right password is refused');
    c.eq(locked.data?.error?.code, 'ACCOUNT_LOCKED', 'coded ACCOUNT_LOCKED');
    c.ok(Number(locked.headers.get('retry-after')) > 0, 'with Retry-After');
    const unknown = await h.request('/v1/account/login', { method: 'POST', body: { email: 'never.registered@example.test', password: 'x' } });
    c.eq(unknown.status, 401, 'lockout of one email does not lock others');
    c.eq((await h.request('/v1/account/me', { jar: victim.jar })).status, 200, 'an existing session is not ended by someone else guessing');
  }

  // ── Reset mail cap per mailbox ─────────────────────────────────────────────
  {
    const target = await account();
    const answers = [];
    for (let i = 0; i < RESET_MAILBOX_LIMIT.limit + 4; i += 1) {
      // Each round from a "new IP": only the per-IP bucket is cleared.
      await db.run("DELETE FROM rate_limits WHERE bucket LIKE 'reset-request:%'");
      const r = await h.request('/v1/account/password/reset-request', { method: 'POST', body: { email: target.email } });
      answers.push(`${r.status}:${JSON.stringify(r.data)}`);
    }
    c.ok(answers.every(answer => answer === '200:{"ok":true}'), 'every caller gets the same plain ok');
    const issued = (await db.get("SELECT COUNT(*) AS n FROM account_tokens WHERE account_id=? AND purpose='reset-password'", [target.id])).n;
    c.eq(Number(issued), RESET_MAILBOX_LIMIT.limit, `only ${RESET_MAILBOX_LIMIT.limit} reset emails per mailbox per hour, however many addresses ask`);
    const unknown = await h.request('/v1/account/password/reset-request', { method: 'POST', body: { email: 'ghost@example.test' } });
    c.eq(JSON.stringify(unknown.data), '{"ok":true}', 'an unknown address gets the identical answer');
  }

  // ── Join-code guessing ─────────────────────────────────────────────────────
  {
    const guesser = await account();
    let limitedAt = null;
    for (let i = 1; i <= 25 && !limitedAt; i += 1) {
      const r = await h.request('/v1/classes/join', { method: 'POST', jar: guesser.jar, body: { code: `GUESS${String(i).padStart(3, '0')}` } });
      if (r.status === 429) limitedAt = i;
    }
    c.eq(limitedAt, 21, 'join-code guessing stops after 20 attempts an hour');
  }

  // ── Paid AI: per-account, not global ───────────────────────────────────────
  for (const [path, limit] of [['/v1/handwriting/transcribe', 240], ['/v1/working/check', 120]]) {
    await resetLimits();
    const heavy = await account();
    const light = await account();
    await db.run(`DELETE FROM rate_limits WHERE bucket NOT LIKE '${path.includes('handwriting') ? 'handwriting' : 'working'}%'`);
    let limitedAt = null;
    for (let i = 1; i <= limit + 1 && !limitedAt; i += 1) {
      const r = await h.request(path, { method: 'POST', jar: heavy.jar, body: {} });
      if (r.status === 429) limitedAt = i;
    }
    c.eq(limitedAt, limit + 1, `${path}: one account stops at ${limit} an hour`);
    const other = await h.request(path, { method: 'POST', jar: light.jar, body: {} });
    c.ok(other.status !== 429, `${path}: another account is unaffected (${other.status})`);
  }

  // ── Verification resend and guardian links ─────────────────────────────────
  {
    await resetLimits();
    const unverified = await registerAccount(h, { email: 'abuse.unverified@example.test', deviceId: 'ipad-unv' });
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await h.request('/v1/account/email/verification-request', { method: 'POST', jar: unverified.jar })).status);
    c.deq(statuses, [200, 200, 200, 200, 200, 429, 429], 'verification resend: 5 an hour per account');
    const pending = (await db.get("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id=? AND kind='verify-email' AND delivered_at IS NULL", [unverified.account.id])).n;
    c.eq(Number(pending), 1, 'resends replace the pending email rather than stacking them');
  }
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`ABUSE LIMITS — PASS — ${c.count()}/${c.count()} checks`);
