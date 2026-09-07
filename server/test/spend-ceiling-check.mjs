// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the bill has a ceiling, and it is not per student
//
// Two routes call a metered third party. Both are rate limited per account —
// 240 and 120 an hour — and that is the wrong unit for the thing that hurts.
// Per-account limits bound one student; a thousand students at those limits is
// 360,000 paid calls an hour, and the first sign of trouble would be an invoice.
//
// So: one budget across the whole deployment, shared by both routes because
// they share one API key and one bill, required whenever a key is configured,
// and fail-closed everywhere it is uncertain.
//
// The refusal has to be safe rather than merely correct. The client publishes
// its on-device reading first and always and treats a refusal as "carry on with
// the local reading", so a spent budget costs a student a slightly worse reader
// and not a broken app. That is what makes a hard ceiling acceptable at all.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { createHandwritingRouter } from '../platform/handwriting.js';
import { createWorkingRouter } from '../platform/working.js';
import { PAID_BUDGET, spendCeiling, spendCeilingMissing } from '../platform/spendCeiling.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · Required exactly when there is money to spend ────────────────────────
eq(spendCeilingMissing({}), [], 'a deployment with no provider key needs no ceiling — there is nothing to spend');
eq(spendCeiling({}).required, false, 'and does not claim to have one');
eq(spendCeilingMissing({ PRI_HANDWRITING_API_KEY: 'k' }), ['PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'],
  'a key with no ceiling is refused at boot — a licence to spend needs a limit');
eq(spendCeilingMissing({ PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: '100' }), ['PRI_PAID_CALLS_PER_DAY'],
  'an hourly ceiling alone still leaves a day unbounded');
eq(spendCeilingMissing({ PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: '100', PRI_PAID_CALLS_PER_DAY: '1000' }), [],
  'both together are enough');

// Nothing that is not a positive whole number counts as a ceiling.
for (const bad of ['0', '-5', '1.5', 'lots', '', 'Infinity']) {
  eq(spendCeiling({ PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: bad, PRI_PAID_CALLS_PER_DAY: '10' }).perHour, null,
    `${JSON.stringify(bad)} is not a ceiling`);
}

// ── 2 · One budget, spent by both routes ─────────────────────────────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-a', 'a@example.test', 'A', 'student', now, now, now);
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-b', 'b@example.test', 'B', 'student', now, now, now);
for (const id of ['acct-a', 'acct-b']) {
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000);
}

const env = { PRI_HANDWRITING_API_KEY: 'k-test', PRI_PAID_CALLS_PER_HOUR: '5', PRI_PAID_CALLS_PER_DAY: '6' };
let providerCalls = 0;
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  env,
  transcribe: async () => { providerCalls += 1; return { engine: 'cloud-test', lines: [{ text: 'x = 4', confidence: 0.95 }], text: 'x = 4', confidence: 0.95, needsConfirmation: false, escalated: false }; }
}));
app.use('/working', createWorkingRouter(db, {
  env,
  check: async (prompt, lines) => { providerCalls += 1; return { engine: 'cloud-working-test', lines: lines.map((_, i) => ({ index: i, status: 'ok', carried: false, why: '' })), firstBreak: -1, hint: '', confidence: 0.9, needsConfirmation: false }; }
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const PNG = 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64');
const call = async (who, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-${who}` },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

try {
  // Five calls fit the hourly ceiling. Spread across two accounts and both
  // routes, because the budget is the deployment's and not a student's.
  const spread = [
    ['acct-a', '/handwriting/transcribe', { image: PNG }],
    ['acct-b', '/handwriting/transcribe', { image: PNG }],
    ['acct-a', '/working/check', { prompt: 'q', lines: ['2x = 8', 'x = 4'] }],
    ['acct-b', '/working/check', { prompt: 'q', lines: ['2x = 8', 'x = 4'] }],
    ['acct-a', '/handwriting/transcribe', { image: PNG }]
  ];
  const results = [];
  for (const [who, path, body] of spread) results.push((await call(who, path, body)).status);
  eq(results, [200, 200, 200, 200, 200], 'five calls fit a ceiling of five, whoever makes them and whichever route');
  eq(providerCalls, 5, 'and every one of them reached the provider');

  const sixth = await call('acct-b', '/handwriting/transcribe', { image: PNG });
  eq([sixth.status, sixth.json?.error?.code], [503, 'PAID_CAPACITY_REACHED'],
    'the sixth is refused, though this account has used only two of its own 240');
  eq(providerCalls, 5, 'and never reaches the provider — nothing is spent that was not counted');

  const alsoWorking = await call('acct-a', '/working/check', { prompt: 'q', lines: ['2x = 8', 'x = 4'] });
  eq(alsoWorking.status, 503, 'the other route is refused too — one key, one bill, one budget');
  ok(/still being read on your device/i.test(alsoWorking.json?.error?.message || ''),
    'and the student is told their work is still being read, because it is');
  ok(alsoWorking.json?.error?.retryable === true, 'a spent budget is temporary, and says so');

  // ── 3 · A malformed request cannot burn the budget ─────────────────────────
  const before = db.prepare('SELECT count FROM rate_limits WHERE bucket = ?').get(`${PAID_BUDGET}:hour`)?.count;
  const junk = await call('acct-a', '/handwriting/transcribe', { image: 'https://example.test/page.png' });
  eq(junk.status, 400, 'a request that is not an image is refused');
  const after = db.prepare('SELECT count FROM rate_limits WHERE bucket = ?').get(`${PAID_BUDGET}:hour`)?.count;
  eq(after, before, 'and did not spend a call from the shared budget');

  // ── 4 · Unconfigured is not unlimited ──────────────────────────────────────
  const loose = express();
  loose.use(express.json());
  loose.use(cookieParser());
  loose.use('/handwriting', createHandwritingRouter(db, {
    env: { PRI_HANDWRITING_API_KEY: 'k-test' },   // a key, and no ceiling
    transcribe: async () => { providerCalls += 1; return { engine: 'x', lines: [{ text: 'x', confidence: 1 }], text: 'x', confidence: 1, needsConfirmation: false }; }
  }));
  const loosely = await new Promise(resolve => { const s = loose.listen(0, '127.0.0.1', () => resolve(s)); });
  const spentBefore = providerCalls;
  const res = await fetch(`http://127.0.0.1:${loosely.address().port}/handwriting/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-acct-a` },
    body: JSON.stringify({ image: PNG })
  });
  const body = await res.json().catch(() => null);
  eq([res.status, body?.error?.code], [503, 'PAID_CAPACITY_NOT_CONFIGURED'],
    'a key with no ceiling refuses rather than spending — unconfigured is never unlimited');
  eq(providerCalls, spentBefore, 'and nothing was spent proving it');
  loosely.close();
} finally {
  server.close();
}

console.log(failures.length
  ? `SPEND CEILING: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `SPEND CEILING: PASS — ${pass}/${pass} checks — one budget across the deployment, shared by both paid routes, required with a key, and fail-closed without one.`);
process.exit(failures.length ? 1 : 0);
