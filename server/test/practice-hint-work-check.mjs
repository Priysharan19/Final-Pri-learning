// Pri Learning · the nudge from the student's own work (audit #13, K2), over
// real HTTP. A nudge request may carry the student's working lines; with the
// line check switched on the server Step Checks them (the same guarded op as
// "Check this line so far") and says how many lines hold and the first line
// that breaks — a line number, never a value or a mark. It shares the line
// check's per-question cap, never judges a final-answer attempt, changes no
// charge, and is silent while the switch is off.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-hint-work-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FEATURE_LINE_CHECK = '1';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { hintWorkNote } = await import('../platform/practice.js');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const post = (path, body, jar) => h.request(path, { method: 'POST', jar, body });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: 'c10-arithmetic-progressions', difficulty: 3, seed, curriculum: 'in' }, jar);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const nudge = (jar, id, lines, extra = {}) => post(`/v1/practice/${id}/hint`, { rung: 'nudge', ...(lines ? { lines } : {}), ...extra }, jar);

try {
  const a = await registerAccount(h, { email: 'hintwork.a@example.test', deviceId: 'ipad-hintwork-a' });
  eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified account');
  const q = await issue(a.jar, 5401);
  eq(q.status, 201, 'a question is issued');
  const id = q.data.question.id;
  const key = await sealed(id);
  // AP with a = 16, d = −6: which term is −122? (seed 5401; the answer is n = 24)
  eq((await nudge(a.jar, id, ['x'], { rung: 'method' })).data.error?.code, 'HINT_WORK_INVALID', 'lines ride only on the nudge');
  eq((await nudge(a.jar, id, Array(41).fill('n = 1'))).status, 400, 'at most 40 lines');
  eq((await nudge(a.jar, id, ['a = 16'], { locale: 'fr' })).status, 400, 'locale is en or hi');
  eq((await post(`/v1/practice/${id}/hint`, { rung: 'nudge', level: 0 }, a.jar)).status, 400, 'nothing else may ride on a hint request');

  const plain = await nudge(a.jar, id);
  eq([plain.status, plain.data.hint, 'work' in plain.data], [200, key.hints[0], false], 'a nudge without lines is exactly as before');

  // Every equation in n on this question is a final-answer attempt (form-based,
  // finalAttempt.js): right and wrong get the same generic reply, uncharged.
  const right = await nudge(a.jar, id, ['-122 = 16 - 6(n-1)', 'n = 24']);
  const wrong = await nudge(a.jar, id, ['-122 = 16 - 6(n-1)', 'n = 25']);
  eq([right.status, right.data.level, right.data.markWeight, right.data.hint], [200, 1, 0.9, key.hints[0]], 'the authored nudge and its charge are unchanged');
  eq([right.data.work, right.data.workNote], [wrong.data.work, wrong.data.workNote], 'a right and a wrong final value get identical work replies');
  eq(right.data.work, { status: 'final' }, 'the generic final reply');
  ok(!/\b24\b|\b25\b|correct|wrong/i.test(JSON.stringify(right.data.work) + right.data.workNote), 'with no value and no verdict');
  eq(Number((await h.db.get("SELECT count(*) AS n FROM rate_limits WHERE bucket LIKE 'line-check:%'")).n), 0, 'and no line check is charged');
  const hi = await nudge(a.jar, id, ['n = 24'], { locale: 'hi' });
  ok(/जमा करें/.test(hi.data.workNote), 'the note follows the locale');

  // The cap is the line check's own per-question bucket.
  const { sha256 } = await import('../platform/security.js');
  await h.db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?,?,?)', [`line-check:${sha256(`${a.account.id}:${id}`).slice(0, 32)}`, Date.now(), 2]);
  const capped = await nudge(a.jar, id, ['a = 16']);
  eq([capped.status, capped.data.work, capped.data.hint], [200, { status: 'limit' }, key.hints[0]], 'two line checks used: the hint says so and still serves the nudge');

  // Switched off, lines are accepted and ignored: no check runs.
  process.env.PRI_FEATURE_LINE_CHECK = '0';
  const q3 = await issue(a.jar, 5401);
  const dark = await nudge(a.jar, q3.data.question.id, ['n = 24']);
  eq([dark.status, 'work' in dark.data], [200, false], 'with the line check off, a nudge says nothing about the work');
  process.env.PRI_FEATURE_LINE_CHECK = '1';

  eq(hintWorkNote({ status: 'break', verifiedLines: 1, line: 2 }), 'Your first line holds. Look again at line 2.', 'a break after one held line');
  eq(hintWorkNote({ status: 'break', verifiedLines: 0, line: 1 }), 'Look again at line 1: that is where your working first stops following.', 'a break on the first line');
  eq(hintWorkNote({ status: 'held', verifiedLines: 2 }, 'hi'), 'अब तक की आपकी 2 पंक्तियाँ सही हैं। वहीं से आगे बढ़ें।', 'held, in Hindi');
  eq(hintWorkNote(null), null, 'no work, no note');
  // PENDING (L1): an HTTP break/held case on a plan question. Blocked on the
  // finalAttempt.js guard, which today verifies a right final value on
  // c10-surface-volume-combo (see the PR). Not asserted until that is fixed.

  console.log(`PRACTICE HINT WORK: PASS — ${count}/${count} checks`);
} finally {
  await h.close?.();
  rmSync(scratch, { recursive: true, force: true });
}
