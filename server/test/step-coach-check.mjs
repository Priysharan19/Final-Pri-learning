// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the live step coach (F1, /v1/tutor/step-coach)
//
// What must be true while the student is still writing:
//
//   · each finished line gets 'ok' (with the plan step it reached), 'break'
//     (the FIRST line that does not follow — a location only), 'unsure'
//     (nothing is said) or 'final' (a final-answer attempt, by form: only
//     "Press Check");
//   · no value, heading, message or mark leaves the server — a right and a
//     wrong final line get byte-identical replies (no guess oracle);
//   · premium only, decided by the server's own entitlement snapshot; off
//     unless PRI_FEATURE_STEP_COACH=1; never anonymous, never in an exam;
//   · capped per question and spending the per-account daily allowance.
//
//   node server/test/step-coach-check.mjs                    → SQLite
//   node server/test/step-coach-check.mjs --engine=postgres  → Postgres
//
// Synthetic lines only. No model, no network, no spend.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';
import { STEP_COACH_READS_PER_QUESTION, createTutorRouter, stepCoachReply } from '../platform/tutor.js';
import { stepCoachEvidence } from '../platform/markerOps.js';
import { openTestStore, requestedEngine } from './support/engine.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const SOLVE = { prompt: 'Solve $t - 4 = 7$.', steps: [{ h: 'Add four to both sides', d: '$t = 11$' }], answerType: 'numeric', answerPrefix: 't =', answer: { value: 11 }, hints: [] };
const LINE = {
  prompt: 'Find the equation of the line through $(0, 1)$ and $(2, 5)$.',
  steps: [{ h: 'Find the gradient', d: '$m = 2$' }, { h: 'Find the intercept', d: '$c = 1$' }, { h: 'Write the equation', d: '$y = 2x + 1$' }],
  answerType: 'expression', answerPrefix: 'y =', answer: { expr: '2x + 1' }, hints: []
};

// A plan whose first stage is an intermediate quantity (the gradient) that is
// not the answer: the only kind of line a live tick can be given without
// becoming a guess oracle.
const PLANNED = {
  ...LINE,
  stepcheck: { kind: 'plan', stages: [{ kind: 'evaluation', source: '(5 - 1)/(2 - 0)', substitutions: {}, expected: 2, labels: ['m', 'gradient'] }, { kind: 'expression', canonical: '2x + 1' }] }
};

// ── 1 · The evidence, directly (pure) ────────────────────────────────────────
{
  const tick = stepCoachEvidence(PLANNED, ['m = (5 - 1)/(2 - 0)', 'y = 2x + 1'], 'y = 2x + 1');
  eq(tick, [{ status: 'ok', step: 1 }, { status: 'final' }], 'an intermediate quantity is ticked with its plan step; the final line is only "final"');
  eq(tick, stepCoachEvidence(PLANNED, ['m = (5 - 1)/(2 - 0)', 'y = 3x + 1'], 'y = 2x + 1'), 'a RIGHT and a WRONG final line after it give identical rows');
  eq(stepCoachEvidence(PLANNED, ['m = (5 + 1)/(2 - 0)'], 'y = 2x + 1'), [{ status: 'unsure' }], 'a wrong FIRST line is never flagged: there is no line above it');
  // Every line in the asked unknown restates the answer's claim: never judged live.
  eq(stepCoachEvidence(SOLVE, ['t - 4 = 7', 't = 11'], 't = 11').map(r => r.status), ['final', 'final'], 'on a one-unknown equation every line is a final-answer attempt (no guess oracle)');
  // A constant answer: any constant-sided line could carry it.
  const COUNT = { prompt: 'Count.', answerType: 'numeric', answer: { value: 6 }, stepcheck: { kind: 'plan', stages: [{ kind: 'evaluation', source: '4 - (-1) + 1', substitutions: {}, expected: 6, labels: ['n'] }] }, steps: [] };
  eq(['n = 4 - (-1) + 1', 'n = 6', 'n = 7', '4 - (-1) + 1'].map(l => stepCoachEvidence(COUNT, [l], '6')[0].status), ['final', 'final', 'final', 'final'],
    'a constant answer: every constant-sided line is "final", right or wrong');
  const rows = stepCoachEvidence(SOLVE, ['t - 4 = 7', 't = 11'], 't = 11');
  const wrong = stepCoachEvidence(SOLVE, ['t - 4 = 7', 't = 12'], 't = 11');
  eq(rows, wrong, 'a RIGHT and a WRONG final line give identical rows');
  const pinned = stepCoachEvidence(SOLVE, ['11 = t'], 't = 11');
  eq(pinned, stepCoachEvidence(SOLVE, ['12 = t'], 't = 11'), 'a pinned unknown, right or wrong, gives identical rows');
  eq(pinned.map(r => r.status), ['final'], '— and it is a final-answer attempt');
  eq(stepCoachEvidence(SOLVE, ['@@ junk'], 't = 11').map(r => r.status), ['final'], 'an unreadable line fails closed into "final"');
  eq(stepCoachEvidence(SOLVE, ['t - 4 = 7'], '@@').map(r => r.status), ['final'], 'an unreadable answer form makes every line "final"');
  eq(stepCoachEvidence(SOLVE, [], 't = 11'), [], 'no lines, no rows');
  // A break: a later line that does not follow from the one above.
  const broke = stepCoachEvidence(SOLVE, ['t - 4 = 7', 't - u = 3 + 4 - u', 't - u = 7 + 4 - u'], 't = 11');
  ok(broke.length === 3 && broke.filter(r => r.status === 'break').length <= 1, 'at most one break is reported');
  const at = broke.findIndex(r => r.status === 'break');
  ok(at < 0 || broke.slice(at + 1).every(r => r.status === 'unsure' || r.status === 'final'), 'lines after the first break are never ticked');
  for (const r of [...rows, ...broke]) ok(Object.keys(r).every(k => k === 'status' || k === 'step'), `a row carries status and step only (${JSON.stringify(r)})`);
  // The public reply strips anything else and never invents a step.
  eq(stepCoachReply([{ status: 'ok', step: 2, value: 11, note: 'x' }, { status: 'break', step: 3 }, { status: 'weird' }, { status: 'ok', step: 0 }]),
    [{ status: 'ok', step: 2 }, { status: 'break' }, { status: 'unsure' }, { status: 'ok' }], 'the reply keeps status, and a step only on a verified line');
}

// ── 2 · The route ────────────────────────────────────────────────────────────
const engine = requestedEngine();
const test = await openTestStore(engine, { label: 'step-coach' });
const db = test.store;
const now = Date.now();
for (const id of ['acct-free', 'acct-prem', 'acct-day']) {
  await db.run('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)',
    [id, `${id}@example.test`, id, 'student', now, now, now]);
  await db.run(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`, [`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000]);
}
for (const id of ['acct-prem', 'acct-day']) {
  await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,grace_until,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)`,
    [id, 'premium', 'active', 'admin', now + 30 * 86400000, null, now]);
}
const QIDS = {
  solve: '11111111-1111-4111-8111-111111111111', line: '33333333-3333-4333-8333-333333333333',
  cap: '44444444-4444-4444-8444-444444444444', free: '55555555-5555-4555-8555-555555555555', day: '66666666-6666-4666-8666-666666666666'
};
const seed = async (account, qid, sealed) => db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
  [account, qid, JSON.stringify(sealed), 'seed', now, now + 86400000]);
await seed('acct-prem', QIDS.solve, SOLVE);
await seed('acct-prem', QIDS.line, LINE);
await seed('acct-prem', QIDS.cap, SOLVE);
await seed('acct-free', QIDS.free, SOLVE);
await seed('acct-day', QIDS.day, SOLVE);

const servers = [];
const baseEnv = { PRI_FEATURE_TUTOR: '1', PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM: '1000' };
async function mount(env) {
  const app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/tutor', createTutorRouter(db, { ask: async () => { throw new Error('no model here'); }, env }));
  const s = await new Promise(r => { const x = app.listen(0, '127.0.0.1', () => r(x)); }); servers.push(s);
  const base = `http://127.0.0.1:${s.address().port}/tutor`;
  return {
    coach: async (who, payload) => {
      const r = await fetch(`${base}/step-coach`, { method: 'POST', headers: { 'content-type': 'application/json', ...(who ? { cookie: `${SESSION_COOKIE}=raw-${who}` } : {}) }, body: JSON.stringify(payload) });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, text, json, code: json?.error?.code };
    },
    status: async who => {
      const r = await fetch(`${base}/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-${who}` } });
      return r.json();
    }
  };
}

try {
  // Off by default: the ordinary 404, before any session lookup.
  {
    const off = await mount(baseEnv);
    for (const who of [null, 'acct-prem']) {
      const r = await off.coach(who, { context: 'practice', serverQuestionId: QIDS.solve, lines: ['t - 4 = 7'] });
      eq([r.status, r.code], [404, 'NOT_FOUND'], `PRI_FEATURE_STEP_COACH unset → 404 (${who ? 'premium' : 'anonymous'})`);
    }
    eq((await off.status('acct-prem')).stepCoach, false, '/status says the coach is off when its switch is off');
  }

  const on = await mount({ ...baseEnv, PRI_FEATURE_STEP_COACH: '1' });
  const coach = (lines, qid = QIDS.solve, who = 'acct-prem') => on.coach(who, { context: 'practice', serverQuestionId: qid, lines });

  eq([(await on.status('acct-prem')).stepCoach, (await on.status('acct-free')).stepCoach], [true, false], '/status: on for premium, off for free');
  eq((await on.coach(null, { context: 'practice', serverQuestionId: QIDS.solve, lines: ['x'] })).status, 401, 'never anonymous');
  eq((await coach(['t - 4 = 7'], QIDS.free, 'acct-free')).code, 'STEP_COACH_PREMIUM', 'a free account is refused, by the server\'s own entitlement');
  eq((await on.coach('acct-free', { context: 'practice', serverQuestionId: QIDS.free, lines: ['t - 4 = 7'], plan: 'premium' })).code, 'TUTOR_BODY_INVALID', 'a body claiming premium is refused outright');
  eq((await on.coach('acct-prem', { context: 'exam', serverQuestionId: QIDS.solve, lines: ['x'] })).code, 'TUTOR_EXAM_LOCKED', 'exam-locked');
  eq((await on.coach('acct-prem', { context: 'practice', serverQuestionId: QIDS.solve, lines: ['x'], question: SOLVE })).code, 'TUTOR_BODY_INVALID', 'no question or solution may be sent');
  eq((await coach(['t - 4 = 7', ''])).code, 'TUTOR_NOTHING_TO_DIAGNOSE', 'blank lines are refused');
  eq((await coach(['t - 4 = 7'], QIDS.free)).code, 'TUTOR_QUESTION_NOT_FOUND', 'only this account\'s issued questions');

  // No guess oracle: right and wrong final lines are byte-identical, with no value.
  const PROBES = [
    [QIDS.line, ['m = 2', 'c = 1', 'y = 2x + 1'], ['m = 2', 'c = 1', 'y = 3x - 4']],
    [QIDS.line, ['2x + 1'], ['3x - 4']],
    [QIDS.solve, ['t - 4 = 7', 't = 11'], ['t - 4 = 7', 't = 12']],
    [QIDS.solve, ['11 = t'], ['12 = t']],
    [QIDS.solve, ['t = 1.1e1'], ['t = 1.2e1']]
  ];
  for (const [qid, r, w] of PROBES) {
    const a = await coach(r, qid);
    const z = await coach(w, qid);
    const strip = x => JSON.stringify({ ...x.json, stepCoach: { ...x.json?.stepCoach, checksLeft: undefined } });
    eq([a.status, strip(a)], [200, strip(z)], `probe ${JSON.stringify(r)} vs ${JSON.stringify(w)}: identical rows`);
    eq(a.json?.stepCoach?.lines?.at(-1), { status: 'final' }, '— the final line is only "final"');
    ok(!/11|12|2x|3x|message|heading|mark|correct/i.test(JSON.stringify(a.json?.stepCoach?.lines)), `— no value, message or mark in ${a.text}`);
  }
  const mid = await coach(['m = 2'], QIDS.line);
  ok(mid.status === 200 && ['ok', 'unsure', 'break'].includes(mid.json?.stepCoach?.lines?.[0]?.status), `an intermediate line is still judged — ${mid.text}`);

  // Cap per question.
  const results = [];
  for (let i = 0; i < STEP_COACH_READS_PER_QUESTION + 1; i++) results.push(await coach(['t - 4 = 7'], QIDS.cap));
  eq(results.slice(0, -1).every(r => r.status === 200), true, `${STEP_COACH_READS_PER_QUESTION} live checks per question are served`);
  eq([results.at(-1).status, results.at(-1).code], [409, 'STEP_COACH_LIMIT'], 'the next is refused by the server');

  // The daily allowance is spent.
  {
    const tight = await mount({ ...baseEnv, PRI_FEATURE_STEP_COACH: '1', PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM: '2' });
    const day = lines => tight.coach('acct-day', { context: 'practice', serverQuestionId: QIDS.day, lines });
    const a = await day(['t - 4 = 7']); const b = await day(['t - 4 = 7']); const c = await day(['t - 4 = 7']);
    eq([a.status, b.status, c.status, c.code], [200, 200, 429, 'TUTOR_DAILY_LIMIT'], 'each live check spends the per-account daily allowance');
  }
} finally {
  for (const s of servers) await new Promise(resolve => s.close(resolve));
  await test.close();
}

console.log(`engine: ${engine}`);
console.log(failures.length
  ? `STEP COACH: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `STEP COACH: PASS — ${pass}/${pass} checks — per-line ok/break/unsure/final, no value or mark, no guess oracle, premium-only, off by default, capped.`);
process.exit(failures.length ? 1 : 0);
