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
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { createHandwritingRouter } from '../platform/handwriting.js';
import { createWorkingRouter } from '../platform/working.js';
import { createQuestionPhotoRouter } from '../platform/questionPhoto.js';
import { consumeAiAllowance, aiAllowance, aiAllowanceConfigProblems, AI_ALLOWANCE_DEFAULTS } from '../platform/aiAllowance.js';
import { serverEntitlementCapabilities } from '../platform/entitlements.js';
import { sha256 } from '../platform/security.js';
import { pngDataUrl } from './support/test-image.mjs';

let n = 0;
const ok = (cond, label) => { assert.ok(cond, label); n += 1; };

const DAY = 24 * 60 * 60 * 1000;
const env = {
  PRI_HANDWRITING_API_KEY: 'test-key-not-real', PRI_HANDWRITING_MODEL: 'test-primary', PRI_WORKING_MODEL: 'test-working',
  PRI_PAID_CALLS_PER_HOUR: '100000', PRI_PAID_CALLS_PER_DAY: '1000000',
  PRI_AI_DAILY_FREE: '5', PRI_AI_DAILY_PREMIUM: '12'
};
const EXPECTED_CHECKS = 52; // every check is unconditional
const PNG = pngDataUrl('a'.repeat(600));

// ── configuration (owner default D20: 5 free / 25 Premium a day, per kind) ──
const D20 = { free: 5, premium: 25 };
ok(JSON.stringify(aiAllowance({}, 'handwriting')) === JSON.stringify(D20) && JSON.stringify(AI_ALLOWANCE_DEFAULTS.handwriting) === JSON.stringify(D20),
  'D20: reads of the student\'s writing default to 5 a day free and 25 a day Premium');
ok(JSON.stringify(aiAllowance({}, 'question-photo')) === JSON.stringify(D20), 'D20: question photos default to 5 a day free and 25 a day Premium, as their own kind');
ok(aiAllowance({}, 'working').free === 120 && aiAllowance({}, 'working').premium === 1200, 'the working check is not a read (not named by D20) and keeps its allowance');
ok(Object.keys(AI_ALLOWANCE_DEFAULTS).every(kind => AI_ALLOWANCE_DEFAULTS[kind].premium > AI_ALLOWANCE_DEFAULTS[kind].free), 'Premium includes more than free for every kind');
ok(aiAllowanceConfigProblems({ PRI_AI_DAILY_FREE: '-3' }).length === 1 && aiAllowanceConfigProblems({ PRI_AI_DAILY_PREMIUM: '0' }).length === 1 &&
  aiAllowanceConfigProblems({ PRI_AI_DAILY_FREE_HANDWRITING: 'five' }).length === 1 && aiAllowanceConfigProblems({ PRI_AI_DAILY_PREMIUM_PHOTO: '1.5' }).length === 1,
  'a non-positive or nonsense value, global or per kind, is a configuration problem (production refuses to boot)');
ok(aiAllowanceConfigProblems({ PRI_AI_DAILY_FREE: '50', PRI_AI_DAILY_PREMIUM: '10' }).length === 3 &&
  ['handwriting', 'question-photo', 'working'].every(kind => aiAllowance({ PRI_AI_DAILY_FREE: '50', PRI_AI_DAILY_PREMIUM: '10' }, kind).premium === 50) &&
  aiAllowanceConfigProblems({ PRI_AI_DAILY_FREE_PHOTO: '30' }).length === 1,
  'Premium below free is flagged for each kind it affects, and never applied below free');
ok(aiAllowance({ PRI_AI_DAILY_FREE: '9', PRI_AI_DAILY_FREE_PHOTO: '3' }, 'question-photo').free === 3 &&
  aiAllowance({ PRI_AI_DAILY_FREE: '9', PRI_AI_DAILY_FREE_PHOTO: '3' }, 'handwriting').free === 9,
  'a per-kind setting wins over the older global one, which still applies to the kinds it does not name');
ok(aiAllowanceConfigProblems({}).length === 0, 'the defaults are a valid configuration');
let unknownKind = false;
try { aiAllowance({}, 'video'); } catch { unknownKind = true; }
ok(unknownKind, 'an unknown kind has no allowance (a programming error, not a free pass)');

// ── the server's own entitlement decides ─────────────────────────────────────
const T = Date.now();
const caps = row => serverEntitlementCapabilities(row, T).includes('additional-ai-usage');
ok(caps({ plan: 'premium', status: 'active', current_period_end: T + DAY }), 'an active paid period grants additional AI usage');
ok(caps({ plan: 'premium', status: 'trialing', current_period_end: T + DAY }), 'a trial grants it');
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
  free: ['free', 'free', null, null], premium: ['premium', 'active', T + 30 * DAY, null], d20free: ['free', 'free', null, null], d20premium: ['premium', 'active', T + 30 * DAY, null], trial: ['premium', 'trialing', T + 7 * DAY, null],
  grace: ['premium', 'grace', T - DAY, T + DAY], graceOver: ['premium', 'grace', T - 2 * DAY, T - DAY], expired: ['premium', 'active', T - DAY, null],
  revoked: ['premium', 'revoked', T + 30 * DAY, null], grant: ['premium', 'active', T + 30 * DAY, null], other: ['free', 'free', null, null],
  upgrader: ['free', 'free', null, null], capped: ['free', 'free', null, null],
};
for (const [id, [plan, status, end, grace]] of Object.entries(accounts)) {
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)').run(id, `${id}@example.test`, id, 'student', T, T, T);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(`ses-${id}`, id, sha256(`raw-${id}`), 'device', null, T, T, T + DAY);
  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,grace_until,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)`)
    .run(id, plan, status, id === 'grant' ? 'admin' : plan === 'premium' ? 'apple' : 'none', end, grace, T);
}

let readCalls = 0;
let checkCalls = 0;
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
const okRead = async () => { readCalls += 1; return { engine: 'cloud-test', lines: [{ text: '42', confidence: 0.99 }], text: '42', confidence: 0.99, needsConfirmation: false, escalated: false, fallbackAttempted: false, fallbackFailureCode: null, latencyMs: 3 }; };
app.use('/handwriting', createHandwritingRouter(db, { transcribe: okRead, probe: async () => ({ usable: true }), env }));
app.use('/working', createWorkingRouter(db, { check: async () => { checkCalls += 1; return { verdict: 'correct', mistakes: [], confidence: 0.9 }; }, env }));
// A deployment whose spend ceiling is already full: nothing may be charged to the student.
const fullEnv = { ...env, PRI_PAID_CALLS_PER_HOUR: '1', PRI_PAID_CALLS_PER_DAY: '1' };
const fullDb = db;
app.use('/handwriting-full', createHandwritingRouter(fullDb, { transcribe: okRead, probe: async () => ({ usable: true }), env: fullEnv }));
// The same routes at the D20 defaults: no allowance variable set at all.
const d20Env = Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('PRI_AI_DAILY_')));
let photoCalls = 0;
app.use('/d20/handwriting', createHandwritingRouter(db, { transcribe: okRead, probe: async () => ({ usable: true }), env: d20Env }));
app.use('/d20/question-photo', createQuestionPhotoRouter(db, { identify: async () => { photoCalls += 1; return { isMathsQuestion: true, readable: true, questionText: 'Solve 2x+3=11', candidates: [] }; }, env: d20Env }));
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
// A different picture each time: this account's SAME picture is read once and
// then served from memory (recognitionOps.js), which is not what is counted here.
let pictures = 0;
const freshPicture = () => pngDataUrl('a'.repeat(600) + `-${pictures += 1}`);
const read = (account, extra = {}, headers = {}, path = '/handwriting/transcribe') => post(path, account, { image: freshPicture(), ...extra }, headers);
const used = (account, kind = 'handwriting') => db.prepare('SELECT count FROM rate_limits WHERE bucket=?').get(`ai-daily:${kind}:${sha256(account).slice(0, 24)}`)?.count ?? 0;
const until429 = async account => { let n = 0; for (let i = 0; i < 40; i++) { const r = await read(account); if (r.status !== 200) return { n, r }; n += 1; } return { n, r: null }; };

try {
  // 1 · Body claims are malformed for the answer-blind route and cost nothing.
  for (const body of [{ plan: 'premium' }, { entitlement: { plan: 'premium', capabilities: ['additional-ai-usage'] } }, { premium: true }, { entitlementSnapshot: { plan: 'premium', status: 'active' } }]) {
    const r = await read('free', body);
    ok(r.status === 400 && used('free') === 0, `a premium claim in the body is refused before it is counted (${Object.keys(body)[0]})`);
  }
  // 2 · The free allowance is exactly 5, and the provider is called exactly 5 times.
  const before = readCalls;
  const free = await until429('free');
  ok(free.n === 5 && readCalls - before === 5, `a free account gets exactly the free allowance (${free.n} accepted, ${readCalls - before} provider calls)`);
  ok(free.r.status === 429 && free.r.data.error.code === 'AI_ALLOWANCE_EXHAUSTED' && free.r.data.error.plan === 'free' && free.r.data.error.limit === 5,
    'then it is refused as free, limit 5');
  // 3 · With the free allowance used up, every header/cookie claim is still refused as free.
  for (const headers of [{ 'x-pri-entitlement': 'premium' }, { 'x-pri-plan': 'premium' }, { 'x-pri-capabilities': 'additional-ai-usage' },
    { cookie: 'pri_cloud_session=raw-free; pri_entitlement=premium' }, { 'x-pri-client': 'ios-native-v1' }]) {
    const r = await read('free', {}, headers);
    ok(r.status === 429 && r.data.error.plan === 'free' && r.data.error.limit === 5, `a claimed Premium header does not raise the allowance (${Object.keys(headers)[0]})`);
  }
  ok(readCalls - before === 5, 'no claim reached the provider past the allowance');
  // 4 · Real Premium, trials, grace and support grants raise it; lapsed records do not.
  for (const [account, expected] of [['premium', 12], ['trial', 12], ['grace', 12], ['grant', 12], ['graceOver', 5], ['expired', 5], ['revoked', 5]]) {
    const r = await until429(account);
    ok(r.n === expected && r.r.data.error.limit === expected, `${account}: ${expected} (got ${r.n})`);
  }
  // 5 · Kinds and accounts are separate; working checks are exhausted on their own.
  let w = 0;
  for (let i = 0; i < 8; i++) if ((await post('/working/check', 'free', { prompt: 'Solve 2x+3=11', lines: ['2x = 8', 'x = 4'] })).status === 200) w += 1;
  ok(w === 5 && checkCalls === 5, `the working-check allowance is separate and also 5 (${w})`);
  ok((await read('other')).status === 200, 'one account exhausting its allowance does not affect another');
  // 6 · An upgrade mid-window takes effect at once (counted against the higher limit).
  await until429('upgrader');
  db.prepare("UPDATE entitlement_snapshots SET plan='premium',status='active',current_period_end=?,provider='admin' WHERE account_id='upgrader'").run(T + DAY);
  const up = await until429('upgrader');
  ok(up.n === 7, `an upgrade mid-window grants the rest of the Premium allowance (${up.n} more)`);
  // 7 · When the deployment ceiling refuses, the student is not charged.
  // (The ceiling here is one call an hour across the deployment, already used.)
  const calls = readCalls;
  const r1 = await read('capped', {}, {}, '/handwriting-full/transcribe');
  const r2 = await read('capped', {}, {}, '/handwriting-full/transcribe');
  ok(r1.status === 503 && r2.status === 503 && readCalls === calls, `the full deployment ceiling refuses both, and nothing reaches the provider (${r1.status}, ${r2.status})`);
  ok(used('capped') === 0, `each ceiling refusal refunds the allowance unit (used ${used('capped')})`);
  // 8 · The window resets; an unknown kind is an error, not a free pass.
  const later = await consumeAiAllowance(db, { accountId: 'free', kind: 'handwriting', env, now: Date.now() + DAY + 1000 });
  ok(later.allowed && later.plan === 'free', 'a new window restores the allowance');
  ok(await consumeAiAllowance(db, { accountId: 'free', kind: 'video', env }).then(() => false, e => /unknown/.test(e.message)), 'an unknown kind is a programming error');
  ok(db.prepare("SELECT plan,status FROM entitlement_snapshots WHERE account_id='free'").get().plan === 'free', 'no request changed the server\'s entitlement record');
  // 9 · D20 at its defaults, over HTTP: 5 / 25 a day for each kind, separately.
  const d20 = async (account, path, body) => { let n = 0; let last = null; for (let i = 0; i < 40; i++) { last = await post(path, account, body()); if (last.status !== 200) break; n += 1; } return { n, r: last }; };
  const ink = () => ({ image: freshPicture() });
  const photo = () => ({ image: freshPicture() });
  const before20 = readCalls;
  const freeInk = await d20('d20free', '/d20/handwriting/transcribe', ink);
  ok(freeInk.n === 5 && readCalls - before20 === 5 && freeInk.r.status === 429 && freeInk.r.data.error.limit === 5 && freeInk.r.data.error.kind === 'handwriting',
    `D20: a free account gets exactly 5 reads of its writing a day (${freeInk.n}, ${readCalls - before20} provider calls)`);
  ok(/5 readings of your writing/.test(freeInk.r.data.error.message) && /type your answer/.test(freeInk.r.data.error.message) && /Premium includes 25 a day/.test(freeInk.r.data.error.message) && !/on-device/i.test(freeInk.r.data.error.message),
    'the refusal names the count, the typed alternative and Premium\'s figure, and promises no on-device reader (D16)');
  const freePhoto = await d20('d20free', '/d20/question-photo/identify', photo);
  ok(freePhoto.n === 5 && photoCalls === 5 && freePhoto.r.status === 429 && freePhoto.r.data.error.kind === 'question-photo',
    `D20: photos are their own kind — 5 more for the same free account after its reads ran out (${freePhoto.n})`);
  const premiumInk = await d20('d20premium', '/d20/handwriting/transcribe', ink);
  const premiumPhoto = await d20('d20premium', '/d20/question-photo/identify', photo);
  ok(premiumInk.n === 25 && premiumPhoto.n === 25 && premiumInk.r.data.error.plan === 'premium' && !/Premium includes/.test(premiumInk.r.data.error.message),
    `D20: Premium gets exactly 25 of each kind (${premiumInk.n} reads, ${premiumPhoto.n} photos)`);
} finally {
  await new Promise(resolve => server.close(resolve));
}

// ── clients cannot write entitlement state through sync ──────────────────────
const { readFileSync } = await import('node:fs');
const syncSrc = readFileSync(new URL('../platform/sync.js', import.meta.url), 'utf8');
const clientKinds = (syncSrc.match(/CLIENT_ENTITY\s*=\s*new Set\(\[([^\]]*)\]/) || [])[1] || '';
ok(clientKinds.length > 0 && !/entitlement|subscription|billing|plan/.test(clientKinds), 'the sync push allow-list contains no entitlement, subscription or billing kind');

assert.equal(n, EXPECTED_CHECKS, `the suite ran ${n} checks, expected ${EXPECTED_CHECKS}`);
console.log(`PREMIUM AUTHORITY: PASS — ${n}/${n} checks — server-paid AI calls obey the server's own entitlement record; claimed, cached or forged Premium never raises the allowance, and clients cannot sync entitlement state.`);
