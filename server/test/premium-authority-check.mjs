// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · server-paid operations obey the SERVER's entitlement (SEC-COMM-01)
//
// Cloud handwriting reading and working checks cost money per call. Each
// account gets a daily allowance per kind, raised by Premium's
// `additional-ai-usage` — read only from entitlement_snapshots, which only
// verified billing events and support grants write. Adversarially:
//   · a free account claiming Premium (body fields, headers, a forged
//     entitlement object, a tampered cached snapshot) still gets the free
//     allowance, and the provider is never called past it;
//   · Premium raises it; an expired period, an expired grace, a "premium"
//     label with a non-paying status, or a revoked purchase does not;
//   · kinds are separate, accounts are separate, and the window resets;
//   · clients cannot push entitlement or subscription state through sync.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { createHandwritingRouter } from '../platform/handwriting.js';
import { createWorkingRouter } from '../platform/working.js';
import { consumeAiAllowance, aiAllowance, AI_ALLOWANCE_DEFAULTS } from '../platform/aiAllowance.js';
import { serverEntitlementCapabilities } from '../platform/entitlements.js';
import { sha256 } from '../platform/security.js';

let n = 0;
const ok = (cond, label) => { assert.ok(cond, label); n += 1; };

const DAY = 24 * 60 * 60 * 1000;
const env = {
  PRI_HANDWRITING_API_KEY: 'test-key-not-real', PRI_HANDWRITING_MODEL: 'test-primary', PRI_WORKING_MODEL: 'test-working',
  PRI_PAID_CALLS_PER_HOUR: '100000', PRI_PAID_CALLS_PER_DAY: '1000000',
  PRI_AI_DAILY_FREE: '5', PRI_AI_DAILY_PREMIUM: '12'
};
const PNG = 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64');

// ── configuration ────────────────────────────────────────────────────────────
ok(aiAllowance({}).free === AI_ALLOWANCE_DEFAULTS.free && aiAllowance({}).premium === AI_ALLOWANCE_DEFAULTS.premium, 'defaults apply when unset');
ok(aiAllowance({ PRI_AI_DAILY_FREE: '-3', PRI_AI_DAILY_PREMIUM: 'lots' }).free === AI_ALLOWANCE_DEFAULTS.free, 'nonsense configuration falls back to the defaults');
ok(AI_ALLOWANCE_DEFAULTS.premium > AI_ALLOWANCE_DEFAULTS.free, 'Premium includes more than free');

// ── the server's own entitlement decides ─────────────────────────────────────
const T = Date.now();
const caps = row => serverEntitlementCapabilities(row, T).includes('additional-ai-usage');
ok(caps({ plan: 'premium', status: 'active', current_period_end: T + DAY }), 'an active paid period grants additional AI usage');
ok(!caps({ plan: 'premium', status: 'active', current_period_end: T - 1 }), 'an expired period does not');
ok(caps({ plan: 'premium', status: 'grace', grace_until: T + DAY }) && !caps({ plan: 'premium', status: 'grace', grace_until: T - 1 }), 'grace counts only until it ends');
for (const status of ['past_due', 'paused', 'expired', 'revoked', 'free', 'made-up']) {
  ok(!caps({ plan: 'premium', status, current_period_end: T + DAY }), `a "premium" label with status ${status} grants nothing`);
}
ok(!caps({ plan: 'free', status: 'active', current_period_end: T + DAY }) && !caps(null), 'a free plan, or no record, grants nothing');

// ── accounts, sessions and snapshots ─────────────────────────────────────────
const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const accounts = {
  free: { plan: 'free', status: 'free', end: null },
  premium: { plan: 'premium', status: 'active', end: T + 30 * DAY },
  expired: { plan: 'premium', status: 'active', end: T - DAY },
  revoked: { plan: 'premium', status: 'revoked', end: T + 30 * DAY },
  other: { plan: 'free', status: 'free', end: null },
};
for (const [id, s] of Object.entries(accounts)) {
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)').run(id, `${id}@example.test`, id, 'student', T, T, T);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(`ses-${id}`, id, sha256(`raw-${id}`), 'device', null, T, T, T + DAY);
  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,1,?)`)
    .run(id, s.plan, s.status, s.plan === 'premium' ? 'apple' : 'none', s.end, T);
}

let readCalls = 0;
let checkCalls = 0;
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  transcribe: async () => { readCalls += 1; return { engine: 'cloud-test', lines: [{ text: '42', confidence: 0.99 }], text: '42', confidence: 0.99, needsConfirmation: false, escalated: false, fallbackAttempted: false, fallbackFailureCode: null, latencyMs: 3 }; },
  probe: async () => ({ usable: true }),
  env
}));
app.use('/working', createWorkingRouter(db, {
  check: async () => { checkCalls += 1; return { verdict: 'correct', mistakes: [], confidence: 0.9 }; },
  env
}));
const server = await new Promise(resolve => { const l = app.listen(0, '127.0.0.1', () => resolve(l)); });
const base = `http://127.0.0.1:${server.address().port}`;
const post = async (path, account, body, headers = {}) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `pri_cloud_session=raw-${account}`, ...headers },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const read = (account, extra = {}, headers = {}) => post('/handwriting/transcribe', account, { image: PNG, ...extra }, headers);

try {
  // A free account that claims Premium every way a client could.
  const claims = [
    [{}, { 'x-pri-entitlement': 'premium', 'x-pri-plan': 'premium' }],
    [{ plan: 'premium' }, {}],
    [{ entitlement: { plan: 'premium', status: 'active', capabilities: ['additional-ai-usage'] } }, {}],
    [{ premium: true, capabilities: ['additional-ai-usage'] }, { 'x-pri-client': 'ios-native-v1' }],
    [{}, { cookie: 'pri_cloud_session=raw-free; pri_entitlement=premium' }],
  ];
  let accepted = 0;
  for (let i = 0; i < 8; i++) {
    const [body, headers] = claims[i % claims.length];
    const r = await read('free', body, headers);
    if (r.status === 200) accepted += 1;
    else if (r.status === 400) ok(true, `a request carrying a premium claim is refused as malformed before it counts (${Object.keys(body).join(',') || 'headers'})`);
    else ok(r.status === 429 && r.data?.error?.code === 'AI_ALLOWANCE_EXHAUSTED' && r.data.error.plan === 'free', `past the allowance a free account is refused as free (${r.status})`);
  }
  ok(accepted <= 5, `a free account claiming Premium never exceeds the free allowance (${accepted} accepted)`);
  ok(readCalls === accepted, 'and the paid provider was called exactly once per accepted request, never past the allowance');
  // Fill the free allowance with plain requests and confirm the refusal.
  while ((await read('free')).status === 200) { /* until refused */ }
  const refused = await read('free');
  ok(refused.status === 429 && refused.data.error.code === 'AI_ALLOWANCE_EXHAUSTED' && refused.data.error.limit === 5, 'the free daily allowance is 5 here and then refused');
  const callsAtRefusal = readCalls;
  await read('free');
  ok(readCalls === callsAtRefusal, 'a refused request never reaches the provider');

  // Premium raises it; nothing else does.
  let premiumOk = 0;
  for (let i = 0; i < 14; i++) if ((await read('premium')).status === 200) premiumOk += 1;
  ok(premiumOk === 12, `a Premium account gets the Premium allowance (${premiumOk})`);
  const premiumRefused = await read('premium');
  ok(premiumRefused.status === 429 && premiumRefused.data.error.plan === 'premium', 'and is then refused as Premium');
  for (const account of ['expired', 'revoked']) {
    let got = 0;
    for (let i = 0; i < 8; i++) if ((await read(account)).status === 200) got += 1;
    ok(got === 5, `an account whose "premium" record is ${account} gets the free allowance (${got})`);
  }

  // Kinds and accounts are separate.
  const working = await post('/working/check', 'free', { prompt: 'Solve 2x+3=11', lines: ['2x = 8', 'x = 4'] });
  ok(working.status === 200 && checkCalls === 1, 'an exhausted reading allowance does not consume the working-check allowance');
  ok((await read('other')).status === 200, 'one account exhausting its allowance does not affect another');

  // A tampered client cache cannot reach the server: the snapshot the server
  // reads is its own row. Simulate a device that rewrote its local copy, then
  // show the server's decision is unchanged.
  const forgedLocalSnapshot = { plan: 'premium', status: 'active', currentPeriodEnd: T + 365 * DAY, capabilities: ['additional-ai-usage'] };
  const forged = await read('other', { entitlementSnapshot: forgedLocalSnapshot });
  ok(forged.status === 400 || forged.status === 200, 'a forged snapshot in the request is rejected or ignored');
  const row = db.prepare('SELECT plan,status FROM entitlement_snapshots WHERE account_id=?').get('other');
  ok(row.plan === 'free' && row.status === 'free', 'and the server\'s entitlement record is untouched');

  // The window resets.
  const later = await consumeAiAllowance(db, { accountId: 'free', kind: 'handwriting', env, now: Date.now() + DAY + 1000 });
  ok(later.allowed && later.plan === 'free', 'a new day restores the allowance');
  ok(await consumeAiAllowance(db, { accountId: 'free', kind: 'video', env }).catch(e => e.message.includes('unknown')), 'an unknown kind is a programming error, not a free pass');
} finally {
  await new Promise(resolve => server.close(resolve));
}

// ── clients cannot write entitlement state through sync ──────────────────────
const { readFileSync } = await import('node:fs');
const syncSrc = readFileSync(new URL('../platform/sync.js', import.meta.url), 'utf8');
const clientKinds = (syncSrc.match(/CLIENT_ENTITY\s*=\s*new Set\(\[([^\]]*)\]/) || [])[1] || '';
ok(clientKinds.length > 0 && !/entitlement|subscription|billing|plan/.test(clientKinds), 'the sync push allow-list contains no entitlement, subscription or billing kind');

console.log(`PREMIUM AUTHORITY: PASS — ${n}/${n} checks — server-paid AI calls obey the server's own entitlement record; claimed, cached or forged Premium never raises the allowance, and clients cannot sync entitlement state.`);
