// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a sealed seed token is only good for the content it was minted under
//
// A prepared practice question (/v1/practice/prepare) and a guest ticket
// (/v1/guest/question) are re-generated from (generator, difficulty, seed) when
// they are bound or answered. If a deploy changes what a seed draws (a bump of
// CONTENT_VERSION, client/src/engine/contentIdentity.js), a token minted before
// it would hand back a different question from the one the student saw. So the
// token carries the content version (`c`), and one that differs is refused with
// the response the code already gives an expired token. A token minted before
// the field existed reads as UNVERSIONED_TOKEN_CONTENT_VERSION.
//
//   node server/test/content-version-token-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-content-version-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '9e'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { encryptDeliveryToken, decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { CONTENT_VERSION, UNVERSIONED_TOKEN_CONTENT_VERSION } = await import('../../client/src/engine/contentIdentity.js');
const { GUEST_CSRF_HEADER } = await import('../platform/guestTrial.js');

const c = checks();
const h = await startApp({ engine: requestedEngine(), guest: { limits: { minAnswerMs: 0, mintDayLimit: 100, ipDayLimit: 1000 } } });
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
/** The same token, re-sealed under another content version (null: with no version field at all). */
const reseal = (token, context, version) => {
  const v = JSON.parse(decryptDeliveryToken(token, context));
  if (version === null) delete v.c; else v.c = version;
  return encryptDeliveryToken(JSON.stringify(v), context);
};
const OTHER = '2026.11.43-other';

try {
  c.ok(CONTENT_VERSION !== UNVERSIONED_TOKEN_CONTENT_VERSION, 'the version in force is not the one an unversioned token reads as');
  const a = await registerAccount(h, { email: 'content.version@example.test', deviceId: 'ipad-content-version' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified account exists');

  // ── a prepared practice question ─────────────────────────────────────────
  const REQUEST = { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', mode: 'practice' };
  const bind = prepared => post('/v1/practice/issue', { prepared, account: String(a.account.id) }, a.jar);
  const p = await post('/v1/practice/prepare', REQUEST);
  c.eq(p.status, 200, 'a signed-out student is prepared a question');
  c.eq(JSON.parse(decryptDeliveryToken(p.data.prepared, 'practice-prepared-v1')).c, CONTENT_VERSION, 'the token carries the content version in force');
  const bound = await bind(p.data.prepared);
  c.deq([bound.status, bound.data.question?.prompt], [201, p.data.question.prompt], 'minted under this version, it binds, and to the question the student saw');
  for (const [label, version] of [['another version', OTHER], ['the previous version', UNVERSIONED_TOKEN_CONTENT_VERSION], ['no version field (minted before the field)', null]]) {
    const q = await post('/v1/practice/prepare', REQUEST);
    const stale = await bind(reseal(q.data.prepared, 'practice-prepared-v1', version));
    c.deq([stale.status, stale.data?.error?.code], [410, 'PRACTICE_PREPARED_EXPIRED'], `${label}: refused with the expired-token response`);
  }
  const forged = await bind(encryptDeliveryToken(JSON.stringify({ ...JSON.parse(decryptDeliveryToken((await post('/v1/practice/prepare', REQUEST)).data.prepared, 'practice-prepared-v1')), c: 7 }), 'practice-prepared-v1'));
  c.deq([forged.status, forged.data?.error?.code], [400, 'PRACTICE_PREPARED_INVALID'], 'a version that is not text is an invalid token, as before');
  c.eq((await bind('not-a-token')).data?.error?.code, 'PRACTICE_PREPARED_INVALID', 'an invalid token is refused as before');
  const expired = JSON.parse(decryptDeliveryToken((await post('/v1/practice/prepare', REQUEST)).data.prepared, 'practice-prepared-v1'));
  c.eq((await bind(encryptDeliveryToken(JSON.stringify({ ...expired, x: Date.now() - 1000 }), 'practice-prepared-v1'))).data?.error?.code, 'PRACTICE_PREPARED_EXPIRED', 'an expired token is refused as before');

  // ── a guest ticket ───────────────────────────────────────────────────────
  const s = { jar: {} };
  s.data = (await post('/v1/guest/session', {}, s.jar)).data;
  const headers = { [GUEST_CSRF_HEADER]: s.data.csrf };
  const ask = () => post('/v1/guest/question', { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', form: 'typed' }, s.jar, headers);
  const answer = (sealed, text = '1') => post('/v1/guest/answer', { sealed, answer: text }, s.jar, headers);
  const g1 = await ask();
  c.eq(g1.status, 201, 'a guest is given a question');
  c.eq(JSON.parse(decryptDeliveryToken(g1.data.sealed, 'guest-question-v1')).c, CONTENT_VERSION, 'the ticket carries the content version in force');
  const ok1 = await answer(g1.data.sealed);
  c.deq([ok1.status, typeof ok1.data.correct], [200, 'boolean'], 'minted under this version, it is marked');
  for (const [label, version] of [['another version', OTHER], ['the previous version', UNVERSIONED_TOKEN_CONTENT_VERSION], ['no version field', null]]) {
    const g = await ask();
    const stale = await answer(reseal(g.data.sealed, 'guest-question-v1', version));
    c.deq([stale.status, stale.data?.error?.code], [410, 'GUEST_QUESTION_EXPIRED'], `guest ticket, ${label}: refused with the expired-ticket response`);
    c.eq(typeof (await answer(g.data.sealed)).data?.correct, 'boolean', `guest ticket, ${label}: and the question is not spent (the real ticket is still markable)`);
  }
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`engine: ${h.engine}`);
console.log(`CONTENT VERSION TOKENS: PASS — ${c.count()}/${c.count()} checks — a prepared question and a guest ticket bind only under the content version they were minted under; anything else is refused as expired. [SYNTHETIC]`);
