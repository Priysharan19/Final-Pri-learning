// Pri Learning · a hint rung the answer guard emptied is never charged (launch QA 26 Nov 2026, review of #1122).
//
// On Prithagoras a rung before the solution that would state the answer is not served: it comes back `thin` with no text. Nothing was
// shown, so nothing is charged: the level the account has reached, the help recorded against the question and the mark weight stay
// as they were; the student may go on to the next rung without it; the question is still marked at full weight.
// On Priyabhata the guard is off: the same question serves its rungs, in order, exactly as before.
// SYNTHETIC: one generated question with a known leaking worked step (y11-functions, level 1, seed 79191) and a scripted client.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const AU = process.env.PRI_EDITION === 'prithagoras';
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(mkdtempSync(join(tmpdir(), 'pri-hint-thin-')), 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'd3'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { buildHintLadder } = await import('../../client/src/engine/hintLadder.js');
const { NSW_ISSUED_CELLS } = await import('../../client/src/engine/nswIssuedCells.js');
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
// The scan is done before the server starts: it holds the thread for a while.
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();
const candidates = [];
if (AU) for (const generator of Object.keys(NSW_ISSUED_CELLS).filter(g => /^(y11|y12|me11|me12)-/.test(g))) for (const difficulty of NSW_ISSUED_CELLS[generator]) for (let i = 1; i <= 60; i++) {
  const seed = i * 7919 + difficulty;
  let q; try { q = generateQuestion(generator, difficulty, seed); } catch { continue; }
  const plain = q && buildHintLadder(q), guarded = q && buildHintLadder(q, { withholdAnswer: true });
  if (q && guarded.slice(0, 3).some((x, k) => x.thin && !plain[k].thin) && !guarded[0].thin && !guarded[1].thin) candidates.push({ generator, difficulty, seed });
}
const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: `hint.thin.${AU ? 'au' : 'in'}@example.test`, deviceId: 'ipad-hint-thin' });
  eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const post = (path, body, headers = {}) => h.request(path, { method: 'POST', jar: a.jar, body, headers });
  const sealedOf = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
  // Find, through the real issue route, a question whose worked rung the guard empties (one the unguarded ladder serves).
  let found = null;
  for (const c of candidates.slice(0, 12)) {
    const r = await post('/v1/practice/issue', { ...c, curriculum: AU ? 'nsw' : 'in' });
    if (r.status !== 201) continue;
    const sealed = await sealedOf(r.data.question.id);
    const plain = buildHintLadder(sealed), guarded = buildHintLadder(sealed, { withholdAnswer: true });
    if (guarded.slice(0, 3).some((x, i) => x.thin && !plain[i].thin) && !guarded[0].thin && !guarded[1].thin) { found = { id: r.data.question.id, sealed, plain, guarded }; break; }
  }
  if (!AU) { eq(found, null, 'Priyabhata has no guard: no rung is emptied'); }
  else {
    assert.ok(found, 'the real issue route produced a question whose worked rung the guard empties'); count++;
    const { id, plain, guarded } = found;
    eq([plain.slice(0, 3).map(r => r.thin), guarded.slice(0, 3).map(r => r.thin)], [[false, false, false], [false, false, true]], 'the worked rung of this question states the answer and is emptied by the guard');
    const level = async () => (await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-hints' AND key=?", [a.account.id, id]))?.response_json;
    const helps = async () => (await h.db.all("SELECT * FROM idempotency_keys WHERE account_id=? AND key LIKE ?", [a.account.id, `%${id}%`])).length;
    for (const rung of ['nudge', 'method']) eq((await post(`/v1/practice/${id}/hint`, { rung })).status, 200, `the ${rung} rung is served`);
    const before = [JSON.parse(await level()).level, await helps()];
    const thin = await post(`/v1/practice/${id}/hint`, { rung: 'worked' });
    eq([thin.status, thin.data.thin, thin.data.hint, thin.data.charged, thin.data.level, thin.data.markWeight], [200, true, null, false, 2, 1], 'the emptied rung says so, shows nothing and charges nothing');
    eq([JSON.parse(await level()).level, await helps()], before, 'the level reached and the help recorded did not move');
    // It may be asked for again, any number of times, with the same answer: no counter runs.
    for (let i = 0; i < 3; i++) eq((await post(`/v1/practice/${id}/hint`, { rung: 'worked' })).data.charged, false, 'asking again charges nothing');
    eq([JSON.parse(await level()).level, await helps()], before, 'still unmoved after repeated asks');
    // Past it: the solution is reachable without the emptied rung, as before.
    const unknown = await post(`/v1/practice/${id}/hint`, { rung: 'solution' });
    eq([unknown.status, unknown.data.revealed], [200, true], 'the solution is still reachable past an emptied rung');
    // A skipped rung that is NOT empty still cannot be skipped.
    const second = await post('/v1/practice/issue', { generator: 'y11-trigfunc', difficulty: 2, seed: 4242, curriculum: 'nsw' });
    if (second.status === 201) eq((await post(`/v1/practice/${second.data.question.id}/hint`, { rung: 'method' })).data.error?.code, 'HINT_RUNG_ORDER', 'a rung with text still cannot be skipped');
  }
} finally { await h.close(); }
console.log(`engine: ${h.engine}`);
console.log(`HINT THIN UNCHARGED (${AU ? 'Prithagoras' : 'Priyabhata'}): PASS — ${count}/${count} checks`);
