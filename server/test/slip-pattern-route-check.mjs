// GET /v1/practice/slip-pattern: the repeated slip across THIS account's last marked answers.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-slip-pattern-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5f'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const { stepNudge, hintWorkNote } = await import('../platform/practice.js');
{
  const brk = { status: 'break', verifiedLines: 1, line: 2 };
  const en = stepNudge(brk, 'int-sign', 'en');
  c.ok(en.note.startsWith(hintWorkNote(brk, 'en')) && en.stepHint && en.note.endsWith(en.stepHint) && /\?/.test(en.stepHint), 'a named move adds one question to the break note');
  c.ok(/[ऀ-ॿ]/.test(stepNudge(brk, 'int-sign', 'hi').stepHint), 'in Hindi too');
  c.deq(stepNudge(brk, null, 'en'), { note: hintWorkNote(brk, 'en'), stepHint: null }, 'no move keeps the existing note');
  c.deq(stepNudge(brk, 'counterexample', 'en').stepHint, null, 'a move with no nudge keeps the existing note');
  c.deq(stepNudge({ status: 'held', verifiedLines: 2 }, 'int-sign', 'en').stepHint, null, 'a held line gets no nudge');
  c.deq(stepNudge(null, 'int-sign', 'en'), { note: null, stepHint: null }, 'no line check, no nudge');
  c.ok(!/[0-9०-९=]/.test(en.stepHint), 'the nudge holds no value');
}
let cursor = 5_000_000;
const T = Date.now() - 10 * 60 * 1000;
const put = async (account, i, over = {}) => {
  const id = `${account.id.slice(0, 8)}-att-${i}`;
  await h.db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
    [++cursor, id, account.id, i, id, T + i * 1000, JSON.stringify({ attemptId: id, questionId: id, correct: false, subtopic: 'c12-integration', mode: 'practice', difficulty: 2, misconception: 'int-sign', ...over }), T + i * 1000]);
  return id;
};
try {
  const a = await registerAccount(h, { email: 'slip.a@example.test', deviceId: 'ipad-slip-a' });
  const o = await registerAccount(h, { email: 'slip.other@example.test', deviceId: 'ipad-slip-o' });
  for (const who of [a, o]) c.eq((await verifyEmail(h, who.account.id)).status, 200, 'a verified account');
  const get = jar => h.request('/v1/practice/slip-pattern', { method: 'GET', jar });

  c.deq((await get(a.jar)).data, { pattern: null }, 'no attempts, no pattern');
  await put(a.account, 1); await put(a.account, 2, { correct: true, misconception: undefined }); await put(a.account, 3);
  c.deq((await get(a.jar)).data, { pattern: null }, 'two of three is not a pattern');
  await put(a.account, 4); await put(a.account, 5, { correct: true, misconception: undefined });
  const r = await get(a.jar);
  const p = r.data.pattern;
  c.deq([r.status, p?.misconceptionId, p?.subtopic, p?.count, p?.of], [200, 'int-sign', 'c12-integration', 3, 5], 'three of the last five is a pattern');
  c.ok(typeof p.nameKey === 'string' && p.nameKey.startsWith('misconception.'), 'the move is named by its catalogue key');
  c.ok(Array.isArray(p.drill) && p.drill.length === 3 && p.drill.every(d => typeof d.id === 'string' && d.canTwin === false), 'a drill of three of its own mistakes; none twin-able without an escrowed question');
  c.eq(r.headers?.get?.('cache-control') ?? 'no-store', 'no-store', 'never cached');

  // Per account: another account's attempts are invisible to this one and vice versa.
  c.deq((await get(o.jar)).data, { pattern: null }, 'another account sees nothing');
  for (const i of [1, 2, 3]) await put(o.account, i, { subtopic: 'c12-differentiation', misconception: 'diff-sign' });
  c.eq((await get(o.jar)).data.pattern?.misconceptionId, 'diff-sign', 'the other account has its own pattern');
  c.eq((await get(a.jar)).data.pattern?.misconceptionId, 'int-sign', 'and this account is unchanged');
  c.eq((await h.request('/v1/practice/slip-pattern', { method: 'GET' })).status, 401, 'a signed-out request is refused');

  console.log(`engine: ${h.engine}`);
  console.log(`SLIP PATTERN ROUTE: PASS — ${c.count()}/${c.count()} checks — per account, graded attempts only, 3 of the last 5, drill from its own mistakes`);
} catch (error) {
  console.error(error);
  console.log('SLIP PATTERN ROUTE: FAIL');
  process.exitCode = 1;
} finally {
  await h.close();
}
