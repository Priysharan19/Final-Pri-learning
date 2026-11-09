// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Why this step?" (F11) — /v1/tutor/help, level "why"
//
//   · only on a RESOLVED question, about one step of its verified solution;
//   · Premium server-side (`additional-ai-usage`), with a free taster of
//     PRI_TUTOR_WHY_FREE_PER_DAY calls a day (default 3), then 402;
//   · under the per-account daily allowance and the deployment paid-call
//     ceiling, which raises PAID_CEILING_HIGH at 80%;
//   · grounded: maths copied from the solution, question or student lines, or
//     the step itself is shown; no mark, no companion talk;
//   · the engine's misconception id reaches the model (D1);
//   · a dialogue: follow-up message and history, cached per account;
//   · dark without PRI_FEATURE_TUTOR=1; exam context locked.
//
//   node server/test/tutor-why-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';
import { WHY_FREE_PER_DAY_DEFAULT, createTutorRouter, validateTutorRequest, whyFallback, tutorCacheKey } from '../platform/tutor.js';
import { systemInstructions, userMessage, providerBody, providerConfig } from '../platform/tutorProvider.js';
import { metrics, ALERT_RULES } from '../platform/metrics.js';
import { reservePaidCall } from '../platform/spendCeiling.js';
import { openTestStore, requestedEngine } from './support/engine.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const QUESTION = Object.freeze({
  prompt: 'If $\\sin A = \\frac{5}{13}$ and $\\sin B = \\frac{3}{5}$, where $A$ and $B$ are acute, find $\\sin(A+B)$.',
  steps: [
    { h: 'Find cos A and cos B', d: 'Both angles are acute, so the cosines are positive: $\\cos A = \\frac{12}{13}$ and $\\cos B = \\frac{4}{5}$.' },
    { h: 'Use the addition identity', d: '$\\sin(A+B) = \\sin A \\cos B + \\cos A \\sin B$' },
    { h: 'Substitute and simplify', d: '$\\sin(A+B) = \\frac{56}{65}$' }
  ],
  answer: '56/65',
  hints: []
});
const body = (over = {}) => ({
  context: 'practice', level: 'why', locale: 'en', questionId: 'q-why-1', questionVersion: '1', question: QUESTION,
  studentWork: { lines: ['sin(A+B) = sinA cosB + cosA sinB', '= 16'], misconception: 'trig.missing-pythagorean' },
  resolved: true, stepIndex: 0, ...over
});

// ── 1 · Contract ──────────────────────────────────────────────────────────────
ok(validateTutorRequest(body()).ok, 'a why request on a resolved device question is valid');
eq(validateTutorRequest(body({ resolved: undefined })).code, 'TUTOR_LEVEL_ORDER', 'a why request on an open question is refused');
eq(validateTutorRequest(body({ stepIndex: -1 })).code, 'TUTOR_BODY_INVALID', 'stepIndex must name a step');
eq(validateTutorRequest(body({ stepIndex: undefined })).code, 'TUTOR_BODY_INVALID', 'and is required');
eq(validateTutorRequest(body({ context: 'exam' })).code, 'TUTOR_EXAM_LOCKED', 'exam context is locked');
eq(validateTutorRequest({ ...body(), level: 'nudge', stepIndex: 0 }).code, 'TUTOR_BODY_INVALID', 'stepIndex is refused on other levels');
eq(validateTutorRequest(body({ history: [{ role: 'student', text: 'x' }] })).code, 'TUTOR_BODY_INVALID', 'history needs a follow-up message');
ok(validateTutorRequest(body({ message: 'why positive?', history: [{ role: 'tutor', text: 'Look at the quadrant.' }] })).ok, 'a follow-up turn is valid');
eq(validateTutorRequest(body({ message: 'x'.repeat(601) })).code, 'TUTOR_REQUEST_TOO_LARGE', 'a follow-up is bounded');
const sys = systemInstructions('why', 'en');
ok(/FOCUS STEP/.test(sys) && /never mention marks/.test(sys) && /not a friend/.test(sys) && /copied EXACTLY/.test(sys), 'the why prompt: focus step, no marks, no companion talk, copy-only maths');
const req = validateTutorRequest(body()).request;
const um = userMessage(req);
ok(/FOCUS STEP \(index 0\): Find cos A and cos B/.test(um), 'the user turn names the focus step');
ok(/Diagnosed misconception id: trig\.missing-pythagorean/.test(um), "the engine's misconception id reaches the model (D1)");
eq(providerBody(req, providerConfig({ PRI_HANDWRITING_API_KEY: 'k' })).text.format.name, 'pri_tutor_help', 'the reply is schema-constrained');
ok(tutorCacheKey(req, 's1') !== tutorCacheKey(validateTutorRequest(body({ stepIndex: 1 })).request, 's1'), 'each step has its own cache entry');
ok(tutorCacheKey(req, 's1') !== tutorCacheKey(req, 's2'), 'and each account its own');
ok(/Find cos A and cos B/.test(whyFallback(req).message), 'the fallback is the verified step itself');
eq(WHY_FREE_PER_DAY_DEFAULT, 3, 'the free taster is three a day by default');

// ── 2 · 80% ceiling alert ────────────────────────────────────────────────────
ok(ALERT_RULES.some(r => r.id === 'PAID_CEILING_HIGH'), 'PAID_CEILING_HIGH is an alert rule');

// ── 3 · The route ─────────────────────────────────────────────────────────────
const engine = requestedEngine();
const test = await openTestStore(engine, { label: 'tutor-why' });
const db = test.store;
const now = Date.now();
for (const id of ['acct-free', 'acct-premium', 'acct-zero', 'acct-ceiling']) {
  await db.run('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)', [id, `${id}@example.test`, id, 'student', now, now, now]);
  await db.run(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)`,
    [`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000]);
}
await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,offline_until,source_version,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
  ['acct-premium', 'premium', 'active', 'admin', now + 86400000, now + 86400000, 1, now]);

const calls = [];
let script = [];
const stubAsk = async r => { calls.push(r); const n = script.length ? script.shift() : { message: 'Because both angles are acute, $\\cos A$ is positive.', referencesStepIndex: 0, revealsAnswer: false }; if (n instanceof Error) throw n; return { model: 'stub', ...n }; };
const env = { PRI_FEATURE_TUTOR: '1', PRI_HANDWRITING_API_KEY: 'k-test', PRI_PAID_CALLS_PER_HOUR: '100000', PRI_PAID_CALLS_PER_DAY: '1000000', PRI_TUTOR_CALLS_PER_ACCOUNT_DAY: '1000' };
const servers = [];
async function mount(e) {
  const app = express(); app.use(express.json({ limit: '1mb' })); app.use(cookieParser());
  app.use('/tutor', createTutorRouter(db, { ask: stubAsk, env: e }));
  const s = await new Promise(r => { const x = app.listen(0, '127.0.0.1', () => r(x)); }); servers.push(s);
  return async (who, payload) => {
    const r = await fetch(`http://127.0.0.1:${s.address().port}/tutor/help`, { method: 'POST', headers: { 'content-type': 'application/json', ...(who ? { cookie: `${SESSION_COOKIE}=raw-${who}` } : {}) }, body: JSON.stringify(payload) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
}
const paid = async () => Number((await db.get("SELECT count FROM rate_limits WHERE bucket = 'paid-provider:hour'"))?.count || 0);

try {
  const dark = await mount({ ...env, PRI_FEATURE_TUTOR: undefined });
  eq((await dark('acct-free', body())).status, 404, 'dark without PRI_FEATURE_TUTOR=1');
  const call = await mount(env);
  eq((await call(null, body())).status, 401, 'never anonymous');
  eq((await call('acct-free', body({ context: 'exam' }))).json?.error?.code, 'TUTOR_EXAM_LOCKED', 'exam locked');
  eq((await call('acct-free', body({ stepIndex: 9 }))).json?.error?.code, 'TUTOR_BODY_INVALID', 'a step past the solution is refused');
  eq(calls.length, 0, 'no refusal reached the model');

  // Free taster: three model replies, then 402 — before any paid unit.
  const before = await paid();
  for (let i = 0; i < 3; i += 1) {
    const r = await call('acct-free', body({ stepIndex: i % 3, message: `why ${i}?` }));
    eq([r.status, r.json?.tutor?.source, r.json?.tutor?.plan], [200, 'model', 'free'], `free taster call ${i + 1} is answered`);
  }
  const fourth = await call('acct-free', body({ message: 'why 4?' }));
  eq([fourth.status, fourth.json?.error?.code], [402, 'TUTOR_PREMIUM_REQUIRED'], 'the fourth free call a day is Premium-only (402)');
  eq([calls.length, await paid()], [3, before + 3], 'the refused call reached no model and spent no paid unit');
  const cachedFree = await call('acct-free', body({ stepIndex: 0, message: 'why 0?' }));
  eq([cachedFree.status, cachedFree.json?.tutor?.cached], [200, true], 'a reply already given is served from cache, even past the taster');

  // Premium: no taster limit.
  for (let i = 0; i < 5; i += 1) eq((await call('acct-premium', body({ message: `p ${i}` }))).json?.tutor?.plan, 'premium', `premium call ${i + 1} is answered`);
  const zero = await mount({ ...env, PRI_TUTOR_WHY_FREE_PER_DAY: '0' });
  eq((await zero('acct-zero', body())).status, 402, 'with the taster set to 0 a free account gets 402 at once');

  // Grounding: invented maths is replaced by the step itself.
  script = [{ message: 'So $\\cos A = \\frac{5}{12}$.', referencesStepIndex: 0, revealsAnswer: false }];
  const invented = await call('acct-premium', body({ message: 'invent?' }));
  eq([invented.json?.tutor?.source, invented.json?.tutor?.reason], ['fallback', 'TUTOR_GROUNDING_GUARD'], 'a reply with invented maths is replaced');
  ok(/Find cos A and cos B/.test(invented.json?.tutor?.message || ''), 'by the verified step');
  ok(!['mark', 'score', 'correct'].some(k => k in (invented.json?.tutor || {})), 'no mark field');

  // Ceiling: refused with PAID_CAPACITY_REACHED, and the 80% alert fires before that.
  const tight = await mount({ ...env, PRI_PAID_CALLS_PER_HOUR: String((await paid()) + 1) });
  eq((await tight('acct-premium', body({ message: 'last unit' }))).status, 200, 'the last unit under the ceiling is spent');
  const over = await tight('acct-premium', body({ message: 'over' }));
  eq([over.status, over.json?.error?.code], [503, 'PAID_CAPACITY_REACHED'], 'over the paid-call ceiling the dialogue is refused');
  ok(metrics.snapshot().firing.includes('PAID_CEILING_HIGH'), 'PAID_CEILING_HIGH is firing at 80% of the ceiling');

  // Model unconfigured: the step itself, never an error, no spend.
  const p0 = await paid();
  const bare = await mount({ ...env, PRI_HANDWRITING_API_KEY: '' });
  const plain = await bare('acct-free', body({ stepIndex: 1 }));
  eq([plain.status, plain.json?.tutor?.source, plain.json?.tutor?.reason, await paid()], [200, 'fallback', 'TUTOR_NOT_CONFIGURED', p0], 'unconfigured: the step itself, no spend');
} finally {
  for (const s of servers) await new Promise(r => s.close(r));
  await test.close();
}

// ── 4 · The 80% rule on its own ──────────────────────────────────────────────
{
  const t = await openTestStore(engine, { label: 'tutor-why-ceiling' });
  const before = metrics.snapshot().counters['paid_ceiling_high_total{window=hour}']?.total || 0;
  const e = { PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: '10', PRI_PAID_CALLS_PER_DAY: '1000' };
  for (let i = 0; i < 7; i += 1) await reservePaidCall(t.store, { env: e });
  const at7 = metrics.snapshot().counters['paid_ceiling_high_total{window=hour}']?.total || 0;
  await reservePaidCall(t.store, { env: e });
  const at8 = metrics.snapshot().counters['paid_ceiling_high_total{window=hour}']?.total || 0;
  eq([at7 - before, at8 - before], [0, 1], 'the 80% mark is counted at the eighth of ten calls, not before');
  await t.close();
}

console.log(`engine: ${engine}`);
console.log(failures.length
  ? `TUTOR WHY: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `TUTOR WHY: PASS — ${pass}/${pass} checks — resolved-only, premium-gated with a free taster, allowance + ceiling + 80% alert, grounded, misconception passed.`);
process.exit(failures.length ? 1 : 0);
