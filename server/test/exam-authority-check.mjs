// Pri Learning · server-authoritative examination papers.
//
// Drives server/platform/exams.js over real HTTP through the whole production
// middleware chain, on SQLite and (with --engine=postgres) on Postgres as the
// pri_server role. Nothing is stubbed and no mark is produced here.
//
// The oracle: the server never sends an answer before a paper is finalised, so
// "the right answer" and "the mark this response earns" are computed in this
// file from the server's own sealed paper, read straight from its store, with
// the engine's checker. What the route returns must equal that.
//
// Covered: who may start a paper; strict spec validation; no private field at
// any depth before finalisation; idempotent create; durable answer snapshots;
// correct / wrong / blank / partial-working marks; exactly-once finalisation
// under a concurrent double finish; identical replay; the deadline rule (in
// grace, late, answers added after the bell); account isolation on every
// route; learning events written once; an app restart on the same database;
// the layout seed is the server's (a spec composed for any other is refused);
// a paper abandoned past its time is finalised by the server once, on its last
// snapshot, on the next read, the next start and in housekeeping; a finished
// paper's content is seen (a practice copy is a repeat) and an item already
// seen is flagged a repeat on the paper; and deleting the account removes
// every exam row.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-exam-authority-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'unused.db');
process.env.PRI_AUTH_DELIVERY_KEY = '7c'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, promoteRole } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { asStore, createPostgresStore } = await import('../platform/store.js');
const { FINISH_GRACE_MS } = await import('../platform/exams.js');
const { runHousekeeping } = await import('../platform/housekeeping.js');
const { checkAnswer, methodMarks } = await import('../../client/src/engine/checker.js');
const { stepMetaFor } = await import('../platform/practice.js');
const { loadAllBanks, loadBanksFor, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { composeIndiaPaper, paperSpecOf } = await import('../../client/src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../../client/src/engine/indiaExams.js');
const { indiaScope } = await import('../../client/src/engine/indiaProduct.js');
const { indiaPyqCells, narrowCells, chapterWindowCells, cellKeyOf } = await import('../../client/src/engine/indiaExamCells.js');
const { paperLayout, sectionRangeOf } = await import('../../client/src/engine/indiaExamComposer.js');
const { subtopicsForYear } = await import('../../client/src/engine/curriculum.js');
const { multipartForYear } = await import('../../client/src/engine/generators/multipart.js');
const { FREE_EXAM_ALLOWANCE } = await import('../../client/src/platform/entitlements.js');
const { contentHashOf } = await import('../../client/src/engine/contentIdentity.js');
const { MAX_OPEN_PAPERS } = await import('../platform/exams.js');

const engine = requestedEngine();

// ── One database that outlives the app, so the app can be restarted on it ────
let raw = null, pg = null, store = null;
const dbFile = join(scratch, 'exams.db');
async function openStore() {
  if (engine === 'sqlite') {
    raw = createPlatformDb(dbFile);
    ensureAuthDeliverySchema(raw);
    ensureBillingSchema(raw);
    store = asStore(raw);
  } else {
    if (!pg) {
      const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
      const scratchDb = await scratchDatabase('exams');
      pg = { scratchDb, url: await serverRoleUrl(scratchDb.name) };
    }
    store = await createPostgresStore(pg.url);
  }
  return store;
}
async function closeStore() {
  if (engine === 'sqlite') { if (raw?.open) raw.close(); } else await store.close();
}

let h = await startApp({ db: await openStore() });
async function restart() {
  await h.close();
  await closeStore();
  h = await startApp({ db: await openStore() });
}

// The server reads the clock with Date.now(); the suite moves it.
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

const PRIVATE = new Set(['answer', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed', 'hints', 'optionTraps',
  'correctIndex', 'correctIndices', 'criteria', 'canonicalWorking', 'expected', 'markScheme', 'builtFrom', 'repairOpportunities', 'altSeed', 'recipe']);
const leaks = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.has(k) ? [path + k] : []), ...leaks(v, path + k + '.')]);
};

let keySeq = 0;
const idem = () => `exam-suite-${String(++keySeq).padStart(4, '0')}-${realNow().toString(36)}`;
const create = (jar, body, key = idem()) => h.request('/v1/exams', { method: 'POST', jar, body, headers: key ? { 'Idempotency-Key': key } : {} });
const save = (jar, id, body) => h.request(`/v1/exams/${id}/answers`, { method: 'PUT', jar, body });
const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
const read = (jar, id) => h.request(`/v1/exams/${id}`, { jar });
const rows = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope]))?.n || 0);
const events = async (accountId, kind) => h.db.all('SELECT id,device_id,entity_id,payload_json FROM learning_events WHERE account_id=? AND kind=? ORDER BY device_seq', [accountId, kind]);
/** The server's sealed paper — the oracle's only source. */
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);

// ── Specs, composed the way a device composes them ───────────────────────────
await loadAllBanks();
const layoutOf = (jar, track, grade, variant = 'standard') => h.request('/v1/exams/layout', { method: 'POST', jar, body: { blueprint: { track, grade, variant } } });
/** A spec composed, as a device composes it, for the layout the server set for this account. */
async function india(jar, track, grade, variant = 'standard') {
  await h.db.run('DELETE FROM rate_limits');
  const set = await layoutOf(jar, track, grade, variant);
  assert.equal(set.status, 200, `asking for the ${track}/${grade}/${variant} layout: ${set.status} ${set.text}`);
  return indiaSpec(track, grade, set.data.layoutSeed, variant);
}
const hasKey = (value, key) => !!value && typeof value === 'object' && (Object.hasOwn(value, key) || Object.values(value).some(v => hasKey(v, key)));
async function indiaSpec(track, grade, seed, variant = 'standard') {
  const spec = indiaExamPaperSpec({ track, grade, variant });
  const chapters = indiaScope(track, grade);
  const pyq = indiaPyqCells(track, chapters);
  await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
  const paper = composeIndiaPaper(spec, { seed, draw: generateQuestion, chapters, pyqCellsFor: (chapter, range) => narrowCells(pyq.get(chapter.id) || [], range) });
  return paperSpecOf(paper, { track, grade, variant });
}
// A practice paper as the device composes one: Year 7 subtopics, the paper's
// difficulty ladder, never the same subtopic twice running, and the year's
// structured question closing it.
const Y7 = subtopicsForYear(7).map(sub => sub.id);
const Y7_OTHER = Y7.find(id => id !== 'y7-equations');
const STRUCTURED7 = multipartForYear(7, 'advanced');
const ladder = (i, n) => { const t = i / n; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };
const practiceSpec = (length = 10, minutes = 30) => ({
  kind: 'practice-paper', paper: { year: 7, minutes },
  slots: [...Array.from({ length }, (_, i) => ({ generator: i % 2 ? 'y7-equations' : Y7_OTHER, difficulty: ladder(i, length) })), { multipart: STRUCTURED7[0] }]
});
const singles = paper => paper.questions.filter(sq => !sq.payload.multipart);

// ── The oracle ───────────────────────────────────────────────────────────────
const isCorrect = (q, given) => { try { return checkAnswer(q, given).correct === true; } catch { return false; } };
/** A response the checker accepts for this sealed question, or null. */
function rightAnswer(q) {
  const a = q.answer || {};
  const candidates = [];
  if (q.answerType === 'mcq') candidates.push(String(a.correctIndex));
  else if (q.answerType === 'multi-mcq') return (a.correctIndices || []).join(',');
  else if (q.answerType === 'numeric') {
    if (a.canonicalInput) candidates.push(String(a.canonicalInput));
    if (a.simplestFraction) candidates.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
    if (a.value !== undefined) candidates.push(String(a.value));
  } else if (q.answerType === 'expression') candidates.push(String(a.expr));
  else if (q.answerType === 'set') candidates.push((a.values || []).join(', '));
  else if (q.answerType === 'point') candidates.push(`(${a.x}, ${a.y})`);
  else if (q.answerType === 'ratio') candidates.push(`${a.a}:${a.b}`);
  return candidates.find(text => isCorrect(q, text)) ?? null;
}
function wrongAnswer(q) {
  const a = q.answer || {};
  if (q.answerType === 'mcq') return String((Number(a.correctIndex) + 1) % (q.mcqOptions?.length || 4));
  if (q.answerType === 'multi-mcq') {
    const wrong = (q.mcqOptions || []).map((_, i) => i).find(i => !(a.correctIndices || []).includes(i));
    return wrong === undefined ? null : String(wrong);
  }
  const text = q.answerType === 'numeric' && Number.isFinite(Number(a.value)) ? String(Number(a.value) + 7) : '987654';
  return isCorrect(q, text) ? null : text;
}
/** What the marking grid awards this response, by the published rule. */
function expectedMark(q, given, grid, working) {
  if (given === undefined || String(given).trim() === '') return Number(grid.unanswered ?? 0);
  if (q.answerType === 'multi-mcq') {
    const chosen = new Set(String(given).split(',').map(Number));
    const key = new Set(q.answer.correctIndices);
    if ([...chosen].some(i => !key.has(i))) return Number(grid.incorrect ?? 0);
    return chosen.size === key.size ? Number(grid.correct) : Number(grid.partialPerOption ?? 0) * chosen.size;
  }
  if (isCorrect(q, given)) return Number(grid.correct);
  const objective = q.answerType === 'mcq' || Number(grid.incorrect || 0) < 0 || Number(grid.correct) <= 1;
  if (!objective && working && stepMetaFor(q)) {
    const method = methodMarks({ meta: stepMetaFor(q), working, marks: Number(grid.correct), prompt: q.prompt });
    if (method?.awarded > 0) return Math.min(Number(grid.correct) - 1, method.awarded);
  }
  return Number(grid.incorrect ?? 0);
}
/** Answer a sealed paper in a fixed rotation and say what it must score. */
function plan(paper, pattern = ['right', 'wrong', 'blank']) {
  const answers = {};
  const expected = {};
  let total = 0, score = 0, n = 0;
  const respond = (key, q, grid, slot) => {
    const want = pattern[n++ % pattern.length];
    const given = want === 'right' ? rightAnswer(q) : want === 'wrong' ? wrongAnswer(q) : null;
    if (given !== null) answers[key] = given;
    const mark = expectedMark(q, answers[key], grid);
    expected[slot] = (expected[slot] || 0) + mark;
    score += mark;
  };
  for (const sq of paper.questions) {
    const q = sq.payload;
    if (q.multipart) for (const part of q.parts) { respond(`${sq.id}::${part.key}`, part, { correct: part.marks, incorrect: 0, unanswered: 0 }, sq.id); total += part.marks; }
    else { respond(sq.id, q, sq.marking, sq.id); total += Number(sq.marking.correct); }
  }
  return { answers, expected, score, total };
}

// ── Nothing public is derived from the answer or the seed ────────────────────
// The engine's content id names the seed (or archive record) and its content
// hash is an unkeyed digest that includes the answer. Neither, nor anything
// computed from them, may appear anywhere in what a student is sent.
const strings = (value, out = []) => {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
};
function identityLeaks(publicExam, sealedPaper) {
  const found = [];
  publicExam.questions.forEach((pub, i) => {
    const q = sealedPaper.questions[i].payload;
    const seen = new Set(strings(pub));
    const inner = [q, q.alt, ...(q.parts || []), ...(q.parts || []).map(part => part.alt)].filter(Boolean);
    const say = what => found.push(`Q${i + 1}: ${what}`);
    if (!/^srv:[A-Za-z0-9_-]{20,}$/.test(pub.payload.contentId || '')) say(`contentId is not opaque (${pub.payload.contentId})`);
    if (!/^[0-9a-f]{16}$/.test(pub.payload.contentHash || '')) say('contentHash is missing');
    for (const item of inner) {
      // The sealed identity itself, and the engine digest of the sealed item.
      for (const secret of [item.contentId, item.sourceContentId, item.contentHash, contentHashOf(item)]) {
        if (secret && [...seen].some(text => text.includes(String(secret)))) say(`a public string carries ${secret}`);
      }
      if (Number.isFinite(Number(item.seed)) && [...seen].some(text => text.includes(`:s${Number(item.seed) >>> 0}`))) say('a public string names the seed');
      // The reviewer's brute force: the public payload plus a guessed answer,
      // through the engine digest, against every public string — first with the
      // sealed answer itself, then with every small number.
      const publicItem = item === q ? pub.payload : null;
      if (publicItem) {
        const guesses = [item.answer, ...Array.from({ length: 121 }, (_, k) => ({ value: k - 60 }))];
        for (const answer of guesses) if (seen.has(contentHashOf({ ...publicItem, answer }))) { say('the answer is recoverable from a public hash'); break; }
      }
    }
  });
  return found;
}

/**
 * Issue papers until one holds what a check needs, finishing the others. The
 * suite never passes a check because the item it is about was not drawn.
 */
async function issueUntil(jar, makeSpec, wanted, what, tries = 12) {
  for (let n = 0; n < tries; n++) {
    await h.db.run('DELETE FROM rate_limits');
    const made = await create(jar, await makeSpec(n));
    assert.equal(made.status, 201, `issuing a paper to find ${what}: ${made.status} ${made.text}`);
    const paper = await sealed(made.data.exam.id);
    const found = wanted(paper);
    if (found) return { exam: made.data.exam, response: made, paper, found };
    await finish(jar, made.data.exam.id, {});
  }
  assert.fail(`no paper in ${tries} held ${what}`);
}

try {
  // ── Accounts ───────────────────────────────────────────────────────────────
  const a = await registerAccount(h, { email: 'exam.a@example.test', deviceId: 'ipad-exam-a' });
  const b = await registerAccount(h, { email: 'exam.b@example.test', deviceId: 'ipad-exam-b' });
  const unverified = await registerAccount(h, { email: 'exam.unverified@example.test', deviceId: 'ipad-exam-u' });
  const teacher = await registerAccount(h, { email: 'exam.teacher@example.test', deviceId: 'ipad-exam-t' });
  eq([a.status, b.status, unverified.status, teacher.status], [201, 201, 201, 201], 'four real accounts exist');
  for (const account of [a, b, teacher]) eq((await verifyEmail(h, account.account.id)).status, 200, 'email verified');
  await promoteRole(h, teacher.jar, teacher.account.id, 'teacher');
  const childJar = {};
  const child = await h.request('/v1/account/register', { method: 'POST', jar: childJar, body: {
    name: 'Exam Child', email: 'exam.child@example.test', password: 'correct-horse-battery', deviceId: 'ipad-exam-c',
    isAdult: false, year: '9', guardianName: 'Exam Guardian', guardianEmail: 'exam.guardian@example.test' } });
  eq(child.status, 201, 'a child account with consent pending exists');
  eq((await verifyEmail(h, child.data.account.id)).status, 200, 'and its email is verified');

  // The account that sits most of the papers below holds Premium, granted
  // through the product's own audited support-grant route by a real admin.
  const admin = await registerAccount(h, { email: 'exam.admin@example.test', deviceId: 'ipad-exam-admin' });
  eq((await verifyEmail(h, admin.account.id)).status, 200, 'the admin is verified');
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  const grantPremium = async accountId => {
    await h.db.run('DELETE FROM rate_limits');
    return h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId, durationMs: 30 * 86400000 } });
  };
  eq((await grantPremium(a.account.id)).status, 200, 'the sitting account is granted Premium by an admin');

  let cbse = await india(a.jar, 'cbse', 10);
  const practice = practiceSpec();

  // ── Who may start a paper ──────────────────────────────────────────────────
  eq((await create({}, practice)).status, 401, 'a signed-out caller cannot start a paper');
  const unverifiedTry = await create(unverified.jar, practice);
  eq([unverifiedTry.status, unverifiedTry.data?.error?.code], [403, 'EMAIL_UNVERIFIED'], 'an unverified account cannot start a paper');
  eq((await create(teacher.jar, practice)).status, 403, 'a teacher account cannot start a student paper');
  const childTry = await create(childJar, practice);
  eq(childTry.status, 403, 'a child whose guardian has not consented cannot start a paper');
  ok(/GUARDIAN|CONSENT/.test(String(childTry.data?.error?.code)), `and is told it is the guardian gate (${childTry.data?.error?.code})`);
  for (const account of [unverified, teacher]) eq(await rows(account.account.id, 'exam-paper'), 0, 'a refused start seals nothing');
  eq(await rows(child.data.account.id, 'exam-paper'), 0, 'a consent-refused start seals nothing');

  // ── Strict spec validation ─────────────────────────────────────────────────
  const refused = async (body, name, key = idem()) => {
    const r = await create(a.jar, body, key);
    eq([r.status, r.data?.error?.code], [400, key ? 'EXAM_SPEC_INVALID' : 'IDEMPOTENCY_KEY_REQUIRED'], name);
  };
  await refused(practice, 'a start without an idempotency key is refused', null);
  await refused({ ...practice, kind: 'quiz' }, 'an unknown kind of paper is refused');
  await refused({ ...practice, answers: {} }, 'an unknown top-level field is refused');
  await refused({ ...practice, slots: [...practice.slots.slice(0, 9), practice.slots.at(-1)] }, 'a practice paper of nine questions is refused');
  await refused({ ...practice, slots: Array.from({ length: 200 }, () => practice.slots[0]) }, 'an oversized slot list is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, seed: 7 })) }, 'a caller-chosen seed is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, marks: 99 })) }, 'caller-chosen marks are refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, difficulty: 9 })) }, 'a difficulty outside 1–4 is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, generator: '../../etc/passwd' })) }, 'a generator that is not an authored id is refused');
  await refused({ ...practice, paper: { ...practice.paper, minutes: 600 } }, 'a ten-hour practice paper is refused');
  await refused({ ...practice, title: 'JEE Advanced 2026 — Official Mock' }, 'a device cannot title a paper: the title of a certified paper is the server\'s');
  await refused({ ...cbse, title: 'Board Paper 2026' }, 'on a blueprint paper either');
  await refused({ ...cbse, slots: cbse.slots.slice(1) }, 'a blueprint paper with a question missing is refused');
  await refused({ ...cbse, slots: [...cbse.slots.slice(1), cbse.slots[0]] }, 'slots out of the blueprint section order are refused');
  await refused({ ...cbse, blueprint: { ...cbse.blueprint, marks: 500 } }, 'a caller cannot attach marks to a blueprint');
  const foreignCell = JSON.parse(JSON.stringify(cbse));
  const single = foreignCell.slots.find(slot => slot.recipe.kind === 'single');
  single.recipe.cell.generator = 'c12-matrices-determinant';
  await refused(foreignCell, 'a cell from outside the track and class is refused');
  const seededCell = JSON.parse(JSON.stringify(cbse));
  seededCell.slots.find(slot => slot.recipe.kind === 'single').recipe.cell.seed = 12345;
  await refused(seededCell, 'a seed inside a recipe cell is refused');
  const wrongItem = JSON.parse(JSON.stringify(cbse));
  wrongItem.slots[0].recipe = wrongItem.slots.at(-1).recipe;
  await refused(wrongItem, 'an item the section does not set is refused');
  const notReleased = await create(a.jar, { kind: 'india', blueprint: { track: 'cbse', grade: 7, variant: 'standard' }, slots: [] });
  eq([notReleased.status, notReleased.data?.error?.code], [409, 'EXAM_BLUEPRINT_NOT_RELEASED'], 'a class with no released blueprint is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, generator: 'c8-no-such-generator-here' })) }, 'a generator the year does not own is refused, not dropped');

  // ── A practice paper is held to the year it claims ────────────────────────
  const swap = (at, patch) => ({ ...practice, slots: practice.slots.map((slot, i) => (i === at ? { ...slot, ...patch } : slot)) });
  await refused(swap(2, { generator: 'y10-nonlinear' }), 'a subtopic from another year is refused');
  await refused(swap(2, { generator: 'c8-linear-equations-both-sides' }), 'a generator from another curriculum is refused');
  await refused(swap(9, { difficulty: 1 }), 'an easier question than the paper sets at that position is refused');
  await refused({ ...practice, slots: practice.slots.map((slot, i) => (i < 10 ? { ...slot, difficulty: 1 } : slot)) }, 'a paper of nothing but the easiest questions is refused');
  await refused(swap(3, { generator: Y7_OTHER }), 'the same subtopic twice running is refused');
  await refused({ ...practice, slots: practice.slots.slice(0, 10) }, 'a paper without the year’s structured question is refused');
  await refused({ ...practice, slots: [...practice.slots.slice(0, 10), { multipart: 'not-a-structured-question' }] }, 'a structured question the year does not set is refused');
  await refused({ ...practice, paper: { ...practice.paper, pathway: 'ext2' } }, 'a pathway the year does not sit is refused');
  await refused({ ...practice, paper: { ...practice.paper, year: 12 } }, 'a senior paper without its pathway is refused');

  // ── A blueprint paper is held to the blueprint, slot by slot ──────────────
  {
    await refused({ ...cbse, layoutSeed: undefined }, 'a blueprint paper without its layout seed is refused');
    {
      const r = await create(a.jar, { ...cbse, layoutSeed: (cbse.layoutSeed % 0x7ffffffe) + 1 });
      eq([r.status, r.data?.error?.code], [400, 'EXAM_SPEC_INVALID'], 'a spec composed for one layout does not fit another layout seed and is refused as an invalid spec');
    }
    const jeeAdvSpec = await india(a.jar, 'jee-advanced', 12);

    // ── The layout is the server's ───────────────────────────────────────────
    // A blueprint has hundreds of legitimate chapter allocations. Which one a
    // paper gets is not the device's to pick: the seed comes from the server,
    // stays the same until a paper is sealed under it, and no other is taken.
    {
      eq((await layoutOf({}, 'cbse', 10)).status, 401, 'a signed-out caller is given no layout');
      eq((await layoutOf(teacher.jar, 'cbse', 10)).status, 403, 'nor a teacher');
      const badLayout = await h.request('/v1/exams/layout', { method: 'POST', jar: a.jar, body: { blueprint: { track: 'cbse', grade: 10, variant: 'standard' }, layoutSeed: 7 } });
      eq([badLayout.status, badLayout.data?.error?.code], [400, 'EXAM_SPEC_INVALID'], 'a layout request cannot carry a seed of its own');
      const unreleased = await layoutOf(a.jar, 'cbse', 7);
      eq([unreleased.status, unreleased.data?.error?.code], [409, 'EXAM_BLUEPRINT_NOT_RELEASED'], 'no layout is set for a blueprint that is not released');
      const seeds = new Set();
      for (let n = 0; n < 12; n++) { await h.db.run('DELETE FROM rate_limits'); seeds.add((await layoutOf(a.jar, 'cbse', 10)).data.layoutSeed); }
      eq([...seeds], [cbse.layoutSeed], 'asking twelve more times returns the one layout already set: there is nothing to shop among');
      eq(await rows(a.account.id, 'exam-layout'), 2, 'one pending layout per blueprint is held for the account');
      const own = await layoutOf(b.jar, 'cbse', 10);
      ok(own.status === 200 && Number.isInteger(own.data.layoutSeed) && own.data.accountId === String(b.account.id), 'another account is set a layout of its own');
      // A complete, valid paper composed for a seed the device chose itself.
      let chosen = 1001;
      while (chosen === cbse.layoutSeed) chosen++;
      const selfChosen = await create(a.jar, await indiaSpec('cbse', 10, chosen));
      eq([selfChosen.status, selfChosen.data?.error?.code], [409, 'EXAM_LAYOUT_NOT_ISSUED'], 'a valid paper composed for a layout seed the device chose is refused');
      // Two accounts drawing one 31-bit seed would make this check say nothing:
      // that is a rerun, never a pass.
      if (own.data.layoutSeed === cbse.layoutSeed) throw new Error('two accounts drew the same layout seed; rerun');
      const borrowed = await create(a.jar, await indiaSpec('cbse', 10, own.data.layoutSeed));
      eq([borrowed.status, borrowed.data?.error?.code], [409, 'EXAM_LAYOUT_NOT_ISSUED'], 'and so is one composed for the layout set for another account');
      eq(await rows(a.account.id, 'exam-paper'), 0, 'nothing was sealed under either');
      eq(await rows(b.account.id, 'exam-paper'), 0, 'and the other account still has no paper');
      await h.db.run("DELETE FROM idempotency_keys WHERE account_id=? AND scope='exam-layout'", [b.account.id]);
    }
    const scopeOf = async (track, grade, variant, seed) => {
      const blueprint = indiaExamPaperSpec({ track, grade, variant });
      const chapters = indiaScope(track, grade);
      const pyq = indiaPyqCells(track, chapters);
      return { blueprint, chapters, pyq, layout: paperLayout(blueprint, chapters, seed) };
    };
    const copy = spec => JSON.parse(JSON.stringify(spec));

    // A cell from another chapter, under this slot's chapter label.
    const c10 = await scopeOf('cbse', 10, 'standard', cbse.layoutSeed);
    const wrongChapter = copy(cbse);
    const at = wrongChapter.slots.findIndex(slot => slot.recipe?.kind === 'single');
    const range = sectionRangeOf(c10.blueprint, c10.layout.slots[at].section);
    const own = chapterWindowCells(c10.chapters.find(ch => ch.id === wrongChapter.slots[at].chapter), range, c10.pyq);
    const need = wrongChapter.slots[at].recipe.cell.need;
    const foreign = c10.chapters.flatMap(ch => (ch.covers || []).flatMap(cover => (cover.diff || []).map(d => ({ generator: cover.gen, difficulty: d, need }))))
      .find(cell => cell.difficulty >= range.min && cell.difficulty <= range.max && !own.any.has(cellKeyOf(cell)));
    ok(!!foreign, 'another chapter has a cell inside the same window');
    wrongChapter.slots[at].recipe.cell = foreign;
    await refused(wrongChapter, 'a cell from another chapter under this slot’s chapter is refused');

    // A cell of the right chapter, outside the section's difficulty window.
    const ja = await scopeOf('jee-advanced', 12, 'standard', jeeAdvSpec.layoutSeed);
    const tooEasy = copy(jeeAdvSpec);
    let eased = -1, easyCell = null;
    tooEasy.slots.forEach((slot, i) => {
      if (eased >= 0 || !slot.recipe) return;
      const chapter = ja.chapters.find(ch => ch.id === slot.chapter);
      const window = chapterWindowCells(chapter, sectionRangeOf(ja.blueprint, ja.layout.slots[i].section), ja.pyq);
      const first = slot.recipe.cell || slot.recipe.cells?.[0] || slot.recipe.parts?.[0]?.cell;
      const outside = (chapter.covers || []).flatMap(cover => (cover.diff || []).map(d => ({ generator: cover.gen, difficulty: d, need: first.need })))
        .sort((x, y) => x.difficulty - y.difficulty).find(cell => !window.authored.has(cellKeyOf(cell)));
      if (outside) { eased = i; easyCell = outside; }
    });
    ok(eased >= 0, `a JEE Advanced chapter has a cell below its section's window (D${easyCell?.difficulty})`);
    const target = tooEasy.slots[eased].recipe;
    if (target.cell) target.cell = easyCell; else if (target.cells) target.cells[0] = easyCell; else target.parts[0].cell = easyCell;
    await refused(tooEasy, 'a cell below the section’s difficulty window is refused');

    // A whole JEE Advanced paper built from the easiest cell in scope.
    const d1 = ja.chapters.flatMap(ch => (ch.covers || []).flatMap(cover => (cover.diff || []).map(d => ({ chapter: ch.id, generator: cover.gen, difficulty: d }))))
      .sort((x, y) => x.difficulty - y.difficulty)[0];
    const easiest = copy(jeeAdvSpec);
    for (const slot of easiest.slots) {
      if (!slot.recipe) slot.recipe = { kind: 'single', cell: { need: 'any' }, alt: null };
      const patch = cell => ({ generator: d1.generator, difficulty: d1.difficulty, need: cell.need });
      const r = slot.recipe;
      if (r.cell) { r.cell = patch(r.cell); if (r.alt) r.alt = patch(r.alt); }
      if (r.cells) r.cells = r.cells.map(patch);
      if (r.parts) r.parts = r.parts.map(part => ({ cell: patch(part.cell), alt: part.alt ? patch(part.alt) : null }));
    }
    await refused(easiest, `a JEE Advanced paper built from one D${d1.difficulty} cell under other chapters' names is refused`);
    for (const slot of easiest.slots) slot.chapter = d1.chapter;
    await refused(easiest, 'and is refused when it names that one chapter on every slot too');

    // Relabelling: every slot of a paper named as one chapter (the cells left
    // as composed, or dropped). The layout allots the chapters; the device
    // cannot move a question, or the evidence it earns, to a chapter it chose.
    for (const [name, spec] of [['CBSE Class 10', cbse], ['JEE Main', await india(a.jar, 'jee-main', 12)]]) {
      const one = spec.slots[0].chapter;
      ok(spec.slots.some(slot => slot.chapter !== one), `${name}: the layout spreads the paper over several chapters`);
      const relabel = copy(spec);
      for (const slot of relabel.slots) slot.chapter = one;
      const r = await create(a.jar, relabel);
      eq([r.status, r.data?.error?.code], [400, 'EXAM_SPEC_INVALID'], `${name}: every slot relabelled to one chapter is refused`);
      ok(/chapter this layout allots/.test(r.data.error.message), 'because a slot is not the chapter its layout allots');
      const dropped = copy(relabel);
      for (const slot of dropped.slots) slot.recipe = null;
      await refused(dropped, `${name}: and is refused with the recipes dropped too`);
      const swapped = copy(spec);
      const other = swapped.slots.findIndex(slot => slot.chapter !== one);
      [swapped.slots[0].chapter, swapped.slots[other].chapter] = [swapped.slots[other].chapter, swapped.slots[0].chapter];
      await refused(swapped, `${name}: two slots' chapters exchanged are refused`);
    }
  }
  eq(await rows(a.account.id, 'exam-paper'), 0, 'no adversarial spec sealed a paper');

  // A slot the device could not fill carries no recipe, and a spec may leave
  // every slot to the server: what comes back is the blueprint's own paper.
  {
    const bare = JSON.parse(JSON.stringify(cbse));
    for (const slot of bare.slots) slot.recipe = null;
    const r = await create(a.jar, bare);
    eq(r.status, 201, 'a spec that leaves every slot to the server is issued');
    const p = await sealed(r.data.exam.id);
    const scope = new Set(indiaScope('cbse', 10).map(ch => ch.id));
    eq([p.questions.length, p.total, p.questions.every(sq => scope.has(sq.chapterId))], [38, 80, true], 'as the published 38 questions and 80 marks from chapters in scope');
    ok(p.questions.filter((sq, i) => sq.chapterId === bare.slots[i].chapter).length >= 30, 'filed under the chapters the layout allots');
    eq(identityLeaks(r.data.exam, p), [], 'and its public paper carries nothing derived from an answer or a seed');
    await finish(a.jar, r.data.exam.id, {});
    // The paper sealed under the layout spent it: the same spec is not a
    // second paper, and the account is set a new layout for its next one.
    eq((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='exam-layout' AND key='cbse:10:standard'", [a.account.id])).n | 0, 0,
      'sealing a paper spends the layout it was composed for');
    const spent = await create(a.jar, bare);
    eq([spent.status, spent.data?.error?.code], [409, 'EXAM_LAYOUT_NOT_ISSUED'], 'a second paper cannot be started under the spent layout');
    eq((await sealed(r.data.exam.id)).layoutSeed, bare.layoutSeed, 'the sealed paper records the layout it was issued under');
    ok(!hasKey(r.data.exam, 'layoutSeed'), 'which the public paper does not carry');
    await h.db.run("DELETE FROM idempotency_keys WHERE account_id=? AND (scope LIKE 'exam-%' OR scope='practice-content')", [a.account.id]);
    await h.db.run('DELETE FROM learning_events WHERE account_id=?', [a.account.id]);
    cbse = await india(a.jar, 'cbse', 10);
  }

  // ── A CBSE Class 10 paper is issued by the server ──────────────────────────
  const firstKey = idem();
  const made = await create(a.jar, cbse, firstKey);
  eq(made.status, 201, 'an eligible student starts a paper');
  const exam = made.data.exam;
  eq(leaks(made.data), [], 'the issued paper discloses no answer, step, trap, seed or criterion at any depth');
  ok(/^[0-9a-f-]{36}$/.test(exam.id), 'the exam id is the server\'s');
  eq(made.data.accountId, String(a.account.id), 'the reply names the owning account');
  eq([exam.questions.length, exam.total, exam.durationMin], [38, 80, 180], 'the paper is the published 38 questions, 80 marks, 180 minutes');
  eq(exam.deadline - exam.startedAt, 180 * 60000, 'the deadline is the start plus the duration, on the server clock');
  eq(exam.graceMs, FINISH_GRACE_MS, 'the paper states its submission grace');
  eq(exam.title, indiaExamPaperSpec({ track: 'cbse', grade: 10, variant: 'standard' }).label, 'the title is the server\'s, from the blueprint');
  eq(identityLeaks(exam, await sealed(exam.id)), [], 'nothing in the public paper is derived from an answer or a seed');
  const bySection = {};
  for (const q of exam.questions) (bySection[q.section] ||= []).push(q.marks);
  eq(Object.fromEntries(Object.entries(bySection).map(([k, v]) => [k, [v.length, v[0]]])),
    { A: [20, 1], B: [5, 2], C: [6, 3], D: [4, 5], E: [3, 4] }, 'the marking grid is the blueprint\'s, not the caller\'s');
  ok(exam.questions.every(q => q.payload.prompt || (q.payload.stem && q.payload.parts?.length)), 'every question carries a prompt, or a stem with parts');
  ok(exam.questions.some(q => q.payload.multipart) && exam.questions.some(q => q.payload.alt), 'case studies and internal choice are issued');
  const paperA = await sealed(exam.id);
  eq(paperA.questions.map(q => q.id), exam.questions.map(q => q.id), 'the sealed paper is the one returned');
  ok(paperA.questions.every(q => q.payload.multipart || q.payload.answer), 'the sealed paper holds every answer key');
  ok(typeof paperA.paperVersion === 'string' && paperA.paperVersion === exam.paperVersion, 'the paper carries one immutable version');

  // Idempotent create.
  const again = await create(a.jar, cbse, firstKey);
  eq([again.status, again.data.exam.id], [201, exam.id], 'a retried start returns the same paper');
  eq(again.data.exam.questions, exam.questions, 'with the same questions');
  eq([again.data.exam.startedAt, again.data.exam.deadline], [exam.startedAt, exam.deadline], 'and the same clock');
  const reused = await create(a.jar, practice, firstKey);
  eq([reused.status, reused.data?.error?.code], [409, 'IDEMPOTENCY_KEY_REUSED'], 'the same key cannot start a different paper');
  eq(await rows(a.account.id, 'exam-paper'), 1, 'one paper was sealed for three requests');
  const other = await create(a.jar, await india(a.jar, 'cbse', 10));
  ok(other.status === 201 && other.data.exam.id !== exam.id, 'a new key starts a new paper');
  ok(JSON.stringify(other.data.exam.questions.map(q => q.payload.prompt || q.payload.stem)) !== JSON.stringify(exam.questions.map(q => q.payload.prompt || q.payload.stem)),
    'the server chooses the questions: the same spec is not the same paper twice');
  const prompts = exam.questions.filter(q => !q.payload.multipart).map(q => `${q.generator}|${q.payload.prompt}`);
  eq(new Set(prompts).size, prompts.length, 'no question repeats inside a paper');

  // ── Reading and checkpointing ──────────────────────────────────────────────
  const open = await read(a.jar, exam.id);
  eq([open.status, open.data.state, open.data.snapshot, open.data.expired], [200, 'open', null, false], 'the owner reads the open paper');
  eq(leaks(open.data), [], 'reading an open paper discloses nothing private');
  eq(identityLeaks(open.data.exam, paperA), [], 'nor anything derived from an answer or a seed');
  const first = exam.questions.find(q => !q.payload.multipart);
  const saved = await save(a.jar, exam.id, { answers: { [first.id]: '41' }, workings: {}, times: { [first.id]: 5000 }, modes: {}, cur: 0, rev: 2 });
  eq([saved.status, saved.data.saved, saved.data.rev], [200, true, 2], 'a snapshot is saved');
  ok(Number.isFinite(saved.data.savedAt) && saved.data.remainingMs > 0 && saved.data.deadline === exam.deadline, 'with the server\'s timestamp and clock');
  const viaPatch = await h.request(`/v1/exams/${exam.id}/answers`, { method: 'PATCH', jar: a.jar, body: { answers: { [first.id]: '41' }, rev: 2 } });
  eq([viaPatch.status, viaPatch.data.stale], [200, true], 'PATCH is the same checkpoint route (the native shells carry no PUT)');
  const stale = await save(a.jar, exam.id, { answers: { [first.id]: 'older' }, rev: 1 });
  eq([stale.status, stale.data.saved, stale.data.stale, stale.data.rev], [200, false, true, 2], 'a retried older snapshot never replaces a newer one');
  eq((await read(a.jar, exam.id)).data.snapshot.answers, { [first.id]: '41' }, 'the latest snapshot reads back');
  const badSave = async (body, name) => eq([(await save(a.jar, exam.id, body)).status], [400], name);
  await badSave({ answers: { 'not-a-question': '1' }, rev: 3 }, 'an answer for a question outside the paper is refused');
  await badSave({ answers: { [first.id]: 'x'.repeat(4001) }, rev: 3 }, 'an overlong answer is refused');
  await badSave({ answers: { [first.id]: '1' }, marks: { [first.id]: 5 }, rev: 3 }, 'a snapshot cannot carry marks');
  await badSave({ answers: { [first.id]: '1' } }, 'a snapshot without a revision is refused');
  eq((await read(a.jar, exam.id)).data.snapshot.rev, 2, 'refused snapshots change nothing');

  // ── Account isolation ──────────────────────────────────────────────────────
  const unknownId = '00000000-0000-4000-8000-000000000000';
  const foreignRead = await read(b.jar, exam.id);
  const unknownRead = await read(b.jar, unknownId);
  const malformedRead = await read(b.jar, 'not-an-id');
  eq([foreignRead.status, unknownRead.status, malformedRead.status], [404, 404, 404], 'another account\'s, an unknown and a malformed id all read 404');
  eq([foreignRead.data.error, unknownRead.data.error], [malformedRead.data.error, malformedRead.data.error], 'and are indistinguishable');
  const foreignSave = await save(b.jar, exam.id, { answers: { [first.id]: '9' }, rev: 9 });
  const foreignFinish = await finish(b.jar, exam.id, { answers: { [first.id]: '9' } });
  eq([foreignSave.status, foreignFinish.status], [404, 404], 'another account can neither checkpoint nor finish the paper');
  eq([foreignSave.data.error, foreignFinish.data.error], [malformedRead.data.error, malformedRead.data.error], 'with the same answer as an unknown id');
  eq([(await save(b.jar, 'not-an-id', { rev: 1 })).status, (await finish(b.jar, unknownId)).status], [404, 404], 'malformed and unknown ids are 404 on every route');
  eq([(await read({}, exam.id)).status, (await save({}, exam.id, { rev: 9 })).status, (await finish({}, exam.id)).status], [401, 401, 401], 'a signed-out caller reaches no paper');
  eq([await rows(b.account.id, 'exam-paper'), await rows(b.account.id, 'exam-answers'), await rows(b.account.id, 'exam-result')], [0, 0, 0], 'the other account wrote nothing');
  eq((await events(b.account.id, 'graded-attempt')).length + (await events(b.account.id, 'exam-result')).length, 0, 'and earned no learning events');
  eq([(await read(a.jar, exam.id)).data.state, (await read(a.jar, exam.id)).data.snapshot.answers[first.id]], ['open', '41'], 'the owner\'s paper is untouched and still open');
  eq(await rows(a.account.id, 'exam-result'), 0, 'and was not finalised by the stranger');

  // ── Finish: right, wrong and blank against the oracle ──────────────────────
  const sat = plan(paperA);
  ok(Object.values(sat.answers).length >= 20 && sat.score > 0 && sat.score < sat.total, `the plan mixes right, wrong and blank answers (${sat.score}/${sat.total})`);
  const done = await finish(a.jar, exam.id, { answers: sat.answers, ms: 45 * 60000, reason: 'student', submissionKey: 'sub-cbse-first-0001' });
  eq(done.status, 200, 'the paper is finalised');
  const result = done.data;
  eq([result.authoritative, result.late, result.finalisedBy, result.inputSource], [true, false, 'student', 'submission'], 'by the student, in time, on the answers the request carried');
  eq([result.score, result.total], [sat.score, 80], 'the total equals the oracle');
  eq(Object.fromEntries(result.detail.map(d => [d.id, d.awarded])), sat.expected, 'every question\'s mark equals the oracle');
  eq(result.pct, Math.round(1000 * sat.score / 80) / 10, 'the percentage is the score over the total');
  ok(result.detail.every(d => d.multipart ? d.parts.every(p => typeof p.answerText === 'string' && Array.isArray(p.steps)) : (d.solution && Array.isArray(d.solution.steps) && Array.isArray(d.solution.criteria))),
    'solutions are disclosed once the paper is finalised');
  eq(result.summary.sections.map(s => [s.id, s.questions, s.marks]), [['A', 20, 20], ['B', 5, 10], ['C', 6, 18], ['D', 4, 20], ['E', 3, 12]], 'the per-section analysis inputs are the blueprint\'s sections');
  eq(result.summary.sections.reduce((n, s) => n + s.awarded, 0), sat.score, 'and add up to the score');
  const blankOne = result.detail.find(d => !d.multipart && d.unanswered);
  ok(blankOne && blankOne.awarded === 0 && blankOne.attemptId === null, 'a blank question earns zero and records no attempt');

  // Replay and the finished paper.
  const replay = await finish(a.jar, exam.id, { answers: {}, reason: 'deadline' });
  eq([replay.status, replay.data], [200, result], 'a replayed finish returns the identical stored result');
  const afterFinish = await save(a.jar, exam.id, { answers: { [first.id]: '1' }, rev: 50 });
  eq([afterFinish.status, afterFinish.data?.error?.code], [409, 'EXAM_FINALISED'], 'a finished paper refuses further checkpoints');
  const readBack = await read(a.jar, exam.id);
  eq([readBack.data.state, readBack.data.result], ['finished', result], 'the stored result reads back unchanged');
  eq(leaks(readBack.data.exam), [], 'the paper beside it is still the public paper');

  // Learning events, once.
  const graded = await events(a.account.id, 'graded-attempt');
  const attempted = result.detail.flatMap(d => (d.multipart ? d.parts : [d])).filter(x => x.attemptId);
  eq(graded.length, attempted.length, 'one graded-attempt event per attempted question or part');
  eq(graded.map(e => e.id).sort(), attempted.map(x => x.attemptId).sort(), 'keyed by the attempt ids the result carries');
  ok(graded.every(e => { const p = JSON.parse(e.payload_json); return e.device_id === 'server-grader' && p.attemptId === e.id && p.questionId === e.entity_id && p.mode === 'exam' && p.examId === exam.id && p.support === 'supported' && /^srv:/.test(p.contentId || '') && typeof p.subtopic === 'string' && (p.correct === true || p.correct === false); }),
    'in the practice payload conventions, by the server grader, in exam mode, with opaque content ids and no claim of unaided work');
  const examEvents = await events(a.account.id, 'exam-result');
  eq(examEvents.length, 1, 'one exam-level event');
  const examPayload = JSON.parse(examEvents[0].payload_json);
  eq([examEvents[0].device_id, examEvents[0].entity_id, examPayload.state, examPayload.examId, examPayload.score, examPayload.total, examPayload.serverMarked],
    ['server-grader', exam.id, 'finished', exam.id, sat.score, 80, true], 'written by the server grader with the certified score');
  // No device can publish that event: the sync push route refuses the kind.
  const forged = await h.request('/v1/sync/push', { method: 'POST', jar: b.jar, headers: { 'Idempotency-Key': 'forged-exam-result-0001' }, body: {
    schemaVersion: 1, deviceId: 'ipad-exam-b', baseCursor: 0, events: [{ id: 'evt-forged-1', deviceId: 'ipad-exam-b', deviceSeq: 1, kind: 'exam-result', entityId: unknownId, occurredAt: 1,
      payload: { state: 'finished', examId: unknownId, serverMarked: true, score: 80, total: 80 } }], entities: [] } });
  ok(forged.status >= 400 && forged.status < 500, `a device cannot push an exam-result event (${forged.status} ${forged.data?.error?.code})`);
  eq((await events(b.account.id, 'exam-result')).length, 0, 'and none was stored for it');

  // ── Exactly once under a concurrent double finish ──────────────────────────
  const twin = other.data.exam;
  const twinPlan = plan(await sealed(twin.id), ['wrong', 'right', 'right', 'blank']);
  const gradedBefore = (await events(a.account.id, 'graded-attempt')).length;
  const [one, two] = await Promise.all([
    finish(a.jar, twin.id, { answers: twinPlan.answers, reason: 'student' }),
    finish(a.jar, twin.id, { answers: twinPlan.answers, reason: 'student' })
  ]);
  eq([one.status, two.status], [200, 200], 'two simultaneous finishes both answer');
  eq(one.data, two.data, 'with one and the same result');
  eq(one.data.score, twinPlan.score, 'equal to the oracle');
  eq(await rows(a.account.id, 'exam-result'), 2, 'one result row per paper');
  eq((await events(a.account.id, 'exam-result')).length, 2, 'the exam-level event was written once');
  eq((await events(a.account.id, 'graded-attempt')).length - gradedBefore,
    one.data.detail.flatMap(d => (d.multipart ? d.parts : [d])).filter(x => x.attemptId).length, 'and each attempt once');

  // ── Partial marks from working ─────────────────────────────────────────────
  const linear = await create(a.jar, practice);
  eq(linear.status, 201, 'a practice paper is issued');
  eq(leaks(linear.data), [], 'and discloses nothing private');
  eq(identityLeaks(linear.data.exam, await sealed(linear.data.exam.id)), [], 'nor anything derived from an answer or a seed');
  eq(linear.data.exam.title, 'Year 7 Practice Paper', 'its title is the server\'s');
  const lp = await sealed(linear.data.exam.id);
  eq([lp.questions.length, singles(lp).length, lp.kind, lp.durationMin], [11, 10, 'practice-paper', 30], 'ten questions and the structured question, for thirty minutes');
  eq(singles(lp).map(sq => sq.difficulty), Array.from({ length: 10 }, (_, i) => ladder(i, 10)), 'at the difficulty the paper sets for each position');
  const answers = {}, workings = {}, want = {};
  let partials = 0;
  lp.questions.forEach((sq, i) => {
    const q = sq.payload;
    if (q.multipart) { want[sq.id] = 0; return; }
    const marks = Number(sq.marking.correct);
    const meta = stepMetaFor(q);
    const root = meta?.kind === 'equation' && meta.solutions?.length === 1 ? Number(meta.solutions[0]) : NaN;
    if (marks >= 2 && Number.isFinite(root) && !isCorrect(q, String(root + 3))) {
      // Sound working (an equation equivalent to the question's) that stops
      // short, under a wrong final answer.
      workings[sq.id] = `2${meta.variable || 'x'} = ${2 * root}`;
      answers[sq.id] = String(root + 3);
      want[sq.id] = expectedMark(q, answers[sq.id], sq.marking, workings[sq.id]);
      if (want[sq.id] > 0 && want[sq.id] < marks) partials++;
      return;
    }
    if (i % 2 === 0 && rightAnswer(q) !== null) { answers[sq.id] = rightAnswer(q); want[sq.id] = marks; return; }
    want[sq.id] = 0;
  });
  ok(partials >= 1, `at least one multi-mark question earns method marks short of full (${partials})`);
  const linearDone = await finish(a.jar, linear.data.exam.id, { answers, workings });
  eq(linearDone.status, 200, 'the practice paper is finalised');
  eq(Object.fromEntries(linearDone.data.detail.map(d => [d.id, d.awarded])), want, 'full, zero and method marks all equal the oracle');
  ok(linearDone.data.detail.filter(d => d.partial).every(d => d.awarded === d.partial.awarded && d.awarded > 0 && d.awarded < d.marks && d.markingScheme === 'step-marked'),
    'a partial mark is method credit, capped below full marks');
  ok(linearDone.data.detail.every(d => d.awarded >= 0 && d.awarded <= d.marks), 'no mark is outside its question\'s range');
  {
    const restated = await issueUntil(a.jar, () => practice,
      paper => singles(paper).find(sq => Number(sq.marking.correct) >= 2 && stepMetaFor(sq.payload)), 'a multi-mark question whose working can be checked');
    const multi = restated.found;
    const copy = String(multi.payload.prompt).replace(/\$/g, '');
    const r = await finish(a.jar, restated.exam.id, { answers: { [multi.id]: '987654' }, workings: { [multi.id]: copy } });
    eq(r.data.detail.find(d => d.id === multi.id).awarded, 0, 'copying the question out as working earns nothing');
  }

  // ── JEE: negative marks, partial per option, previous-year items ───────────
  const jeeMain = await create(a.jar, await india(a.jar, 'jee-main', 12));
  eq(jeeMain.status, 201, 'a JEE Main mathematics section is issued');
  eq(leaks(jeeMain.data), [], 'and discloses nothing private');
  eq([jeeMain.data.exam.questions.length, jeeMain.data.exam.total], [25, 100], '25 questions, 100 marks');
  ok(jeeMain.data.exam.questions.every(q => q.marking.correct === 4 && q.marking.incorrect === -1), 'every question is +4/−1 by the server\'s grid');
  const jm = await sealed(jeeMain.data.exam.id);
  const pyqCount = jm.questions.filter(q => q.pyq).length;
  ok(jeeMain.data.exam.questions.filter(q => q.pyq).every(q => q.payload.pyq === true && q.payload.pyqSource), `previous-year items are issued with their source (${pyqCount} in this paper)`);
  const jmPlan = plan(jm, ['wrong', 'right', 'blank']);
  const jmDone = await finish(a.jar, jeeMain.data.exam.id, { answers: jmPlan.answers });
  eq([jmDone.data.score, jmDone.data.total], [jmPlan.score, 100], 'JEE Main marks equal the oracle');
  ok(jmDone.data.detail.some(d => d.awarded === -1) && jmDone.data.summary.negativeMarks > 0, 'a wrong answer costs a mark');
  eq(Object.fromEntries(jmDone.data.detail.map(d => [d.id, d.awarded])), jmPlan.expected, 'question by question');

  const jeeAdvIssued = await issueUntil(a.jar, () => india(a.jar, 'jee-advanced', 12),
    paper => paper.questions.find(sq => sq.payload.answerType === 'multi-mcq' && sq.payload.answer.correctIndices.length > 1), 'a multiple-correct question with more than one correct option');
  const jeeAdv = jeeAdvIssued.response;
  eq(leaks(jeeAdv.data), [], 'a JEE Advanced paper discloses nothing private');
  const ja = jeeAdvIssued.paper;
  eq(identityLeaks(jeeAdv.data.exam, ja), [], 'nor anything derived from an answer or a seed');
  const multis = ja.questions.filter(q => q.payload.answerType === 'multi-mcq');
  ok(multis.length > 0 && multis.every(q => q.marking.partialPerOption > 0), 'multiple-correct questions carry per-option partial marks');
  const jaAnswers = {}, jaWant = {};
  const partialOn = jeeAdvIssued.found;
  for (const sq of ja.questions) {
    const q = sq.payload;
    if (sq.id === partialOn.id) jaAnswers[sq.id] = String(q.answer.correctIndices[0]);
    else if (q.answerType === 'multi-mcq') jaAnswers[sq.id] = wrongAnswer(q) ?? rightAnswer(q);
    else jaAnswers[sq.id] = rightAnswer(q) ?? '';
    jaWant[sq.id] = expectedMark(q, jaAnswers[sq.id], sq.marking);
  }
  const jaDone = await finish(a.jar, jeeAdv.data.exam.id, { answers: jaAnswers });
  eq(Object.fromEntries(jaDone.data.detail.map(d => [d.id, d.awarded])), jaWant, 'JEE Advanced marks equal the oracle');
  const partialLine = jaDone.data.detail.find(d => d.id === partialOn.id);
  eq([partialLine.awarded, !!partialLine.partial, partialLine.markingScheme], [partialOn.marking.partialPerOption, true, 'objective-partial'], 'one correct option of several earns the per-option mark');

  // ── Seen content: a finished paper's, and content seen before a paper ──────
  // Finalising a paper discloses every solution on it, so its content is seen
  // by the account exactly as practice records it: a practice copy issued
  // afterwards is a repeat. And an item the account had already been shown the
  // solution of when the paper was finalised is marked and scored, and flagged
  // a repeat on its result line and its event, so no device credits it.
  {
    const rep = await registerAccount(h, { email: 'exam.repeat@example.test', deviceId: 'ipad-exam-repeat' });
    const firstTimer = await registerAccount(h, { email: 'exam.firsttime@example.test', deviceId: 'ipad-exam-firsttime' });
    eq([(await verifyEmail(h, rep.account.id)).status, (await verifyEmail(h, firstTimer.account.id)).status], [200, 200], 'two more accounts are verified');
    eq((await grantPremium(rep.account.id)).status, 200, 'one is granted Premium');
    await h.db.run('DELETE FROM rate_limits');
    const itemsOf = q => [q, q.alt, ...(q.parts || []), ...(q.parts || []).map(part => part.alt)].filter(Boolean);
    const hashesOf = item => [...new Set([contentHashOf(item), item.contentHash].filter(Boolean))];
    // The oracle's own record of what the account has been shown, by the
    // engine's content hash of each sealed item.
    const shownHashes = new Set();
    const noteShown = paper => { for (const sq of paper.questions) for (const item of itemsOf(sq.payload)) for (const hash of hashesOf(item)) shownHashes.add(hash); };
    const wasShown = sq => hashesOf(sq.payload).some(hash => shownHashes.has(hash));
    const predicted = paper => singles(paper).filter(wasShown).map(sq => sq.id).sort();
    const flagged = result => result.detail.filter(d => !d.multipart && d.repeat === true).map(d => d.id).sort();
    // A sealed question practice can issue again as the same content: the
    // generator, difficulty and seed reproduce exactly what the paper shows.
    const reproducible = sq => {
      const q = sq.payload;
      if (!Number.isFinite(Number(q.seed)) || rightAnswer(q) === null) return false;
      try { return contentHashOf(generateQuestion(sq.generator, Number(q.difficulty), Number(q.seed))) === contentHashOf(q); } catch { return false; }
    };
    const issuePractice = (jar, sq) => h.request('/v1/practice/issue', { method: 'POST', jar,
      body: { generator: sq.generator, difficulty: Number(sq.payload.difficulty), seed: Number(sq.payload.seed), curriculum: 'in' } });
    const gradeEvent = async (accountId, attemptId) => JSON.parse((await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt' AND id=?", [accountId, attemptId])).payload_json);

    // A finished paper's content is seen.
    const p1 = (await create(rep.jar, practice)).data.exam;
    const paper1 = await sealed(p1.id);
    const x = singles(paper1).find(reproducible);
    ok(!!x, 'the paper holds a question practice can issue again as the same content');
    const beforeFinish = await issuePractice(firstTimer.jar, x);
    eq([beforeFinish.status, beforeFinish.data.repeat ?? false, beforeFinish.data.question.prompt], [201, false, x.payload.prompt], 'that content, issued in practice to an account that never sat the paper, is not a repeat');
    eq(await rows(rep.account.id, 'practice-content'), 0, 'an open paper has disclosed nothing: none of its content is seen yet');
    const r1 = await finish(rep.jar, p1.id, { answers: { [x.id]: rightAnswer(x.payload) } });
    eq([r1.status, flagged(r1.data), predicted(paper1)], [200, [], []], 'nothing on an account\'s first paper is a repeat');
    const d1 = r1.data.detail.find(d => d.id === x.id);
    eq([d1.correct, d1.awarded, d1.repeat ?? false, (await gradeEvent(rep.account.id, d1.attemptId)).repeat ?? false], [true, Number(x.marking.correct), false, false], 'the question is marked and its attempt is new work');
    noteShown(paper1);
    ok(await rows(rep.account.id, 'practice-content') >= paper1.questions.length, `finishing the paper records its content as seen (${await rows(rep.account.id, 'practice-content')} keys for ${paper1.questions.length} questions)`);
    const copy = await issuePractice(rep.jar, x);
    eq([copy.status, copy.data.repeat, copy.data.question.prompt], [201, true, x.payload.prompt], 'the same content issued in practice afterwards is declared a repeat');
    const copyGrade = await h.request(`/v1/practice/${copy.data.question.id}/submit`, { method: 'POST', jar: rep.jar, headers: { 'Idempotency-Key': 'exam-seen-copy-0001' },
      body: { submissionId: 'exam-seen-copy-0001', answer: rightAnswer(x.payload), mode: 'typed' } });
    eq([copyGrade.status, copyGrade.data.authoritative, copyGrade.data.correct, copyGrade.data.repeat], [200, true, true, true], 'it is still marked, and its receipt says repeat');
    eq((await gradeEvent(rep.account.id, copyGrade.data.attemptId)).repeat, true, 'and so does its graded-attempt event: no fresh credit for a solution the paper released');
    const elsewhere = await issuePractice(firstTimer.jar, x);
    eq(elsewhere.data.repeat ?? false, false, 'another account\'s copy of that content is still its own first sitting');
    eq(await rows(firstTimer.account.id, 'practice-content'), 0, 'and nothing was recorded as seen for it');

    // Content seen before the paper is finalised is a repeat on the paper.
    let p2, paper2, y, z;
    for (let n = 0; n < 8 && !y; n++) {
      await h.db.run('DELETE FROM rate_limits');
      p2 = (await create(rep.jar, practice)).data.exam;
      paper2 = await sealed(p2.id);
      const candidates = singles(paper2).filter(sq => reproducible(sq) && !wasShown(sq));
      if (candidates.length >= 2) [y, z] = candidates;
      else { const r = await finish(rep.jar, p2.id, {}); eq(flagged(r.data), predicted(paper2), 'a paper finished on the way flags exactly the content already seen'); count--; noteShown(paper2); }
    }
    ok(!!y && !!z && y.id !== z.id, 'a second paper holds two questions the account has not been shown');
    const shown = await issuePractice(rep.jar, y);
    eq([shown.status, shown.data.repeat ?? false], [201, false], 'while the paper is open, one of them is issued in practice');
    eq((await h.request(`/v1/practice/${shown.data.question.id}/reveal`, { method: 'POST', jar: rep.jar, body: {} })).status, 200, 'and its solution is revealed there');
    for (const hash of hashesOf(y.payload)) shownHashes.add(hash);
    const r2 = await finish(rep.jar, p2.id, { answers: { [y.id]: rightAnswer(y.payload), [z.id]: rightAnswer(z.payload) } });
    eq([r2.status, flagged(r2.data)], [200, predicted(paper2)], 'the paper flags as repeats exactly the questions the account had already been shown');
    const dy = r2.data.detail.find(d => d.id === y.id);
    const dz = r2.data.detail.find(d => d.id === z.id);
    eq([dy.repeat, dy.correct, dy.awarded], [true, true, Number(y.marking.correct)], 'the question whose solution was already seen is still marked and awarded on the paper');
    eq([dz.repeat ?? false, dz.correct, dz.awarded], [false, true, Number(z.marking.correct)], 'beside one that is new work');
    eq(r2.data.score, Number(y.marking.correct) + Number(z.marking.correct), 'and the paper\'s score counts both: it states what was answered on this paper');
    const ey = await gradeEvent(rep.account.id, dy.attemptId);
    const ez = await gradeEvent(rep.account.id, dz.attemptId);
    eq([ey.repeat, ey.correct, ey.marksEarned, ey.mode], [true, true, Number(y.marking.correct), 'exam'], 'its graded-attempt event carries repeat: true, which earns no XP, rating or mastery on any device');
    eq([Object.hasOwn(ez, 'repeat'), ez.correct], [false, true], 'the new work\'s event carries no such flag');
    eq((await finish(rep.jar, p2.id, {})).data, r2.data, 'and a replay returns the same result, flags included');

    // ── Deleting the account removes every exam row ──────────────────────────
    // An account's exam data is: its pending layout (exam-layout), the create
    // keys (exam-create), the sealed papers (exam-paper), answer snapshots
    // (exam-answers), results (exam-result) and seen-content keys
    // (practice-content) in idempotency_keys, and its exam-result and
    // graded-attempt rows in learning_events. All are the account's own rows.
    await h.db.run('DELETE FROM rate_limits');
    eq((await layoutOf(rep.jar, 'cbse', 10)).status, 200, 'the account also holds a pending layout');
    const openOne = (await create(rep.jar, practice)).data.exam;
    eq((await save(rep.jar, openOne.id, { answers: {}, rev: 1 })).status, 200, 'and an open paper with a saved snapshot');
    const scopeCounts = async () => Object.fromEntries((await h.db.all('SELECT scope, COUNT(*) AS n FROM idempotency_keys WHERE account_id=? GROUP BY scope', [rep.account.id])).map(r => [r.scope, Number(r.n)]));
    const held = await scopeCounts();
    ok(['exam-layout', 'exam-create', 'exam-paper', 'exam-answers', 'exam-result', 'practice-content'].every(scope => held[scope] > 0), `before deletion every kind of exam row exists (${JSON.stringify(held)})`);
    const eventsHeld = Number((await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind IN ('exam-result','graded-attempt')", [rep.account.id])).n);
    ok(eventsHeld >= 4, `with the exam events (${eventsHeld})`);
    const removed = await h.request('/v1/account', { method: 'DELETE', jar: rep.jar, body: { password: 'correct-horse-battery' } });
    eq([removed.status, removed.data?.deleted], [200, true], 'the account is deleted with its password');
    eq([await scopeCounts(), Number((await h.db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [rep.account.id])).n)], [{}, 0],
      'no layout, create key, sealed paper, snapshot, result, seen-content key or learning event of the account remains');
    eq(Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE scope IN ('exam-paper','exam-result','exam-answers') AND key IN (?,?,?)", [p1.id, p2.id, openOne.id])).n), 0, 'and its papers are not held under any other account');
    eq((await read(rep.jar, p1.id)).status, 401, 'the deleted account\'s session reaches nothing');
    ok(await rows(a.account.id, 'exam-paper') > 0 && await rows(firstTimer.account.id, 'practice-question') > 0, 'while other accounts\' rows are untouched');
  }

  // What is public about a previous-year item: its labels and the authority's
  // citation (enough to find it in the published paper) — and not this
  // product's own handle on the archive record.
  {
    const archived = await issueUntil(a.jar, () => india(a.jar, 'cbse', 10),
      paper => paper.questions.find(sq => sq.payload.archive?.recordId && sq.payload.pyqId), 'a previous-year item from the source-cited archive');
    const sealedPyq = archived.found;
    const publicExam = archived.exam;
    const publicPyq = publicExam.questions.find(q => q.id === sealedPyq.id);
    ok(typeof sealedPyq.payload.archive.recordId === 'string' && typeof sealedPyq.payload.pyqId === 'string', 'the sealed item holds its archive record id');
    ok(!hasKey(publicExam, 'recordId') && !hasKey(publicExam, 'pyqId'), 'no archive record id is anywhere in the public paper');
    ok(!strings(publicExam).some(text => text.includes(sealedPyq.payload.archive.recordId)), 'nor inside any public string');
    const { recordId: _omitted, ...citation } = sealedPyq.payload.archive;
    eq(publicPyq.payload.archive, JSON.parse(JSON.stringify(citation)), 'the rest of the archive citation is public as sealed: exam, year, paper, question number, citations');
    ok(publicPyq.payload.archive.citations.length > 0 && publicPyq.payload.archive.questionNumber !== undefined, 'so a student can still check the question against the authority\'s paper');
    ok(!hasKey((await read(a.jar, publicExam.id)).data, 'recordId'), 'and reading the open paper back does not carry it either');
    eq((await finish(a.jar, publicExam.id, {})).status, 200, 'that paper is finished');
  }

  // Internal choice: the OR question is the one marked.
  {
    const issued = await issueUntil(a.jar, () => india(a.jar, 'cbse', 10),
      paper => paper.questions.find(sq => sq.payload.alt && rightAnswer(sq.payload.alt) !== null), 'an internal choice whose alternative the oracle can answer');
    const withChoice = issued.found;
    const r = await finish(a.jar, issued.exam.id, { answers: { [`${withChoice.id}::or`]: rightAnswer(withChoice.payload.alt) } });
    const d = r.data.detail.find(x => x.id === withChoice.id);
    eq([d.choiceTaken, d.awarded, d.prompt], ['or', Number(withChoice.marking.correct), withChoice.payload.alt.prompt], 'the alternative question is marked when it is the one answered');
  }

  // ── Every paper the device composes is still a paper the blueprint allows ──
  // A fixed sample of device-composed specs for each released selection: the
  // slot-by-slot rules above must refuse none of them.
  {
    const SELECTIONS = [['cbse', 10, 'standard'], ['cbse', 10, 'basic'], ['cbse', 11, 'standard'], ['cbse', 12, 'standard'],
      ['jee-main', 11, 'standard'], ['jee-main', 12, 'standard'], ['jee-advanced', 12, 'standard'], ['olympiad', 10, 'standard']];
    // Six papers per selection, each composed for the layout the server set.
    const SEEDS = [1, 2, 3, 4, 5, 6];
    const refusedSpecs = [];
    const leaked = [];
    let accepted = 0, questions = 0;
    for (const [track, grade, variant] of SELECTIONS) {
      for (const seed of SEEDS) {
        await h.db.run('DELETE FROM rate_limits');
        const r = await create(a.jar, await india(a.jar, track, grade, variant));
        if (r.status === 201) {
          accepted++; questions += r.data.exam.questions.length;
          leaked.push(...identityLeaks(r.data.exam, await sealed(r.data.exam.id)).map(line => `${track}/${grade} seed ${seed} ${line}`));
          await finish(a.jar, r.data.exam.id, {});
        }
        else refusedSpecs.push(`${track}/${grade}/${variant} seed ${seed}: ${r.status} ${r.data?.error?.code} ${r.data?.error?.message}`);
      }
    }
    eq(refusedSpecs, [], 'no device-composed spec is refused');
    eq(leaked, [], 'and no public paper among them carries anything derived from an answer or a seed');
    eq(accepted, SELECTIONS.length * SEEDS.length, `all ${SELECTIONS.length * SEEDS.length} sampled specs across ${SELECTIONS.length} selections are issued (${questions} questions)`);
  }

  // ── The plan is the server's to enforce ────────────────────────────────────
  // The free plan's exam simulations are counted from the server's own sealed
  // papers, and JEE Advanced needs the capability on the server's entitlement
  // record. No device state is consulted, so a direct API call cannot bypass
  // either.
  const free = await registerAccount(h, { email: 'exam.free@example.test', deviceId: 'ipad-exam-free' });
  const advFree = await registerAccount(h, { email: 'exam.advfree@example.test', deviceId: 'ipad-exam-advfree' });
  const racer = await registerAccount(h, { email: 'exam.racer@example.test', deviceId: 'ipad-exam-racer' });
  for (const account of [free, advFree, racer]) eq((await verifyEmail(h, account.account.id)).status, 200, 'a free account is verified');
  await h.db.run('DELETE FROM rate_limits');
  eq([FREE_EXAM_ALLOWANCE.examsPerWindow, FREE_EXAM_ALLOWANCE.examWindowDays], [1, 30], 'the free plan is one simulation every 30 days, from the shared definition');
  const freeKey = idem();
  const firstFree = await create(free.jar, practice, freeKey);
  eq(firstFree.status, 201, 'a free account starts its one free simulation');
  const capped = await create(free.jar, practice);
  eq([capped.status, capped.data?.error?.code, capped.data?.error?.capability], [402, 'FREE_CAP_REACHED', 'premium-exams'], 'a second paper inside the window is refused with the device\'s own code');
  eq([capped.data.error.used, capped.data.error.limit, capped.data.error.windowDays, capped.data.error.nextAt], [1, 1, 30, firstFree.data.exam.startedAt + 30 * 86400000],
    'and says when the next free simulation unlocks');
  const cappedIndia = await create(free.jar, await india(free.jar, 'cbse', 10));
  eq([cappedIndia.status, cappedIndia.data?.error?.code], [402, 'FREE_CAP_REACHED'], 'a blueprint paper is counted against the same allowance');
  eq(await rows(free.account.id, 'exam-paper'), 1, 'a refused start seals nothing and consumes nothing');
  const retried = await create(free.jar, practice, freeKey);
  eq([retried.status, retried.data.exam.id], [201, firstFree.data.exam.id], 'a retry of the free paper\'s own create is the same paper, not a second simulation');
  eq(await rows(free.account.id, 'exam-paper'), 1, 'and is not counted twice');
  ok((await finish(free.jar, firstFree.data.exam.id, {})).status === 200 && (await create(free.jar, practice)).status === 402, 'finishing the paper does not hand back the simulation');

  const jeeAdvSpecForPlan = await india(advFree.jar, 'jee-advanced', 12);
  const advRefused = await create(advFree.jar, jeeAdvSpecForPlan);
  eq([advRefused.status, advRefused.data?.error?.code, advRefused.data?.error?.capability], [402, 'PREMIUM_REQUIRED', 'jee-advanced-content'],
    'a free account cannot start a JEE Advanced paper, and is told the track is the reason');
  eq(await rows(advFree.account.id, 'exam-paper'), 0, 'the refusal spends no simulation');
  eq((await create(advFree.jar, await india(advFree.jar, 'jee-main', 12))).status, 201, 'the same account may spend its free simulation on JEE Main');
  eq((await create(advFree.jar, jeeAdvSpecForPlan)).data?.error?.code, 'PREMIUM_REQUIRED', 'JEE Advanced stays refused for the track, whatever the allowance');

  const [raceA, raceB] = await Promise.all([create(racer.jar, practice), create(racer.jar, practice)]);
  eq([raceA.status, raceB.status].sort(), [201, 402], 'two simultaneous starts cannot both take the one free simulation');
  eq(await rows(racer.account.id, 'exam-paper'), 1, 'exactly one paper was sealed');

  eq((await grantPremium(free.account.id)).status, 200, 'an admin grants the free account Premium');
  eq([(await create(free.jar, practice)).status, (await create(free.jar, practice)).status], [201, 201], 'Premium lifts the simulation cap');
  eq((await create(free.jar, await india(free.jar, 'jee-advanced', 12))).status, 201, 'and carries the JEE Advanced capability');
  // ── A few papers open at once, whatever the plan ──────────────────────────
  {
    eq(MAX_OPEN_PAPERS, 3, 'an account holds at most three papers open');
    const openIds = (await h.db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-paper' AND key NOT IN (SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-result')", [free.account.id, free.account.id])).map(r => r.key);
    eq(openIds.length, 3, 'the Premium account now holds three unfinished papers');
    const sealedBefore = await rows(free.account.id, 'exam-paper');
    const fourth = await create(free.jar, practice);
    eq([fourth.status, fourth.data?.error?.code, fourth.data?.error?.limit], [409, 'EXAM_OPEN_PAPER_LIMIT', 3], 'a fourth open paper is refused, Premium or not');
    ok(openIds.includes(fourth.data.error.openExamId) && fourth.data.error.openExamIds.length === 3, 'and the refusal names an open paper to carry on with');
    eq(await rows(free.account.id, 'exam-paper'), sealedBefore, 'nothing was sealed');
    eq((await finish(free.jar, fourth.data.error.openExamId, {})).status, 200, 'finishing one of them');
    const afterFinishing = await create(free.jar, practice);
    eq(afterFinishing.status, 201, 'makes room for a new paper');
    eq((await create(free.jar, practice)).data?.error?.code, 'EXAM_OPEN_PAPER_LIMIT', 'and only for one');
    // An abandoned paper is not dropped: it stays open until it has a result,
    // and the server gives it one once its time and grace have passed.
    const abandoned = (await h.db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-paper' AND key NOT IN (SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-result')", [free.account.id, free.account.id])).map(r => r.key);
    const resultsBefore = await rows(free.account.id, 'exam-result');
    const resultEventsBefore = (await events(free.account.id, 'exam-result')).length;
    eq(abandoned.length, 3, 'three papers are open and about to be abandoned');
    skew += 3 * 60 * 60000 + FINISH_GRACE_MS + 60000;
    await h.db.run('DELETE FROM rate_limits');
    eq((await create(free.jar, practice)).status, 201, 'once their time and grace have passed, the next start is allowed');
    eq(await rows(free.account.id, 'exam-result') - resultsBefore, 3, 'because the server finalised each abandoned paper before counting');
    eq((await events(free.account.id, 'exam-result')).length - resultEventsBefore, 3, 'with one exam-result event each');
    const closed = await read(free.jar, abandoned[0]);
    eq([closed.data.state, closed.data.result.unattended, closed.data.result.late, closed.data.result.score, closed.data.result.inputSource],
      ['finished', true, true, 0, 'server-snapshot-before-deadline'], 'an abandoned paper with nothing saved is a finished paper that scored nothing');
    ok(closed.data.result.detail.every(d => d.multipart ? d.parts.every(p => typeof p.answerText === 'string') : !!d.solution), 'and its solutions are released like any finished paper\'s');
  }

  // An abandoned paper is a sat paper: it has a result, it used the free
  // simulation, and opening a paper to read it and walk away buys nothing.
  {
    const walker = await registerAccount(h, { email: 'exam.walker@example.test', deviceId: 'ipad-exam-walker' });
    eq((await verifyEmail(h, walker.account.id)).status, 200, 'a free account that will walk away from its paper is verified');
    await h.db.run('DELETE FROM rate_limits');
    const walked = await create(walker.jar, practice);
    eq(walked.status, 201, 'it starts its one free simulation');
    eq((await read(walker.jar, walked.data.exam.id)).data.state, 'open', 'reads the paper');
    skew += 30 * 60000 + FINISH_GRACE_MS + 1000;
    await h.db.run('DELETE FROM rate_limits');
    const second = await create(walker.jar, practice);
    eq([second.status, second.data?.error?.code, second.data?.error?.used], [402, 'FREE_CAP_REACHED', 1], 'and after abandoning it has still used its free simulation');
    eq([await rows(walker.account.id, 'exam-paper'), await rows(walker.account.id, 'exam-result'), (await events(walker.account.id, 'exam-result')).length], [1, 1, 1],
      'the abandoned paper was finalised by that refused start: one paper, one result, one event');
    const walkedResult = await read(walker.jar, walked.data.exam.id);
    eq([walkedResult.data.state, walkedResult.data.result.unattended, walkedResult.data.result.score], ['finished', true, 0], 'and reads back as a finished paper');
  }

  const strangerGrant = await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: racer.jar, body: { accountId: racer.account.id, durationMs: 86400000 } });
  ok(strangerGrant.status === 403 && (await create(racer.jar, practice)).status === 402, 'a student cannot grant itself Premium and stays capped');

  // ── The deadline ───────────────────────────────────────────────────────────
  const late = (await create(a.jar, practice)).data.exam;
  const latePaper = await sealed(late.id);
  const right = sq => rightAnswer(sq.payload);
  const answerable = paper => singles(paper).filter(sq => right(sq) !== null);
  const allRight = paper => Object.fromEntries(answerable(paper).map(sq => [sq.id, right(sq)]));
  const [q1, q2, q3] = answerable(latePaper);
  ok(!!q3, 'the paper has three questions the oracle can answer');
  eq((await save(a.jar, late.id, { answers: { [q1.id]: right(q1) }, rev: 1 })).data.saved, true, 'before the bell a snapshot with one answer is saved');
  skew += 30 * 60000 + FINISH_GRACE_MS - 5000;
  eq((await save(a.jar, late.id, { answers: { [q1.id]: right(q1), [q2.id]: right(q2) }, rev: 2 })).data.saved, true, 'inside the grace a snapshot is still accepted');
  skew += 10000;
  const tooLate = await save(a.jar, late.id, { answers: { [q1.id]: right(q1), [q2.id]: right(q2), [q3.id]: right(q3) }, rev: 3 });
  eq([tooLate.status, tooLate.data?.error?.code], [409, 'EXAM_DEADLINE_PASSED'], 'after deadline + grace nothing more can be saved');
  // No device finished it. The next read finds a finished paper: the server
  // marked the last snapshot it held, once.
  const lateEventsBefore = (await events(a.account.id, 'exam-result')).filter(e => e.entity_id === late.id).length;
  const expired = await read(a.jar, late.id);
  eq([lateEventsBefore, expired.status, expired.data.state, expired.data.snapshot], [0, 200, 'finished', undefined], 'the next read of an unfinished paper past deadline + grace returns a finished paper');
  eq([expired.data.result.authoritative, expired.data.result.unattended, expired.data.result.late, expired.data.result.finalisedBy, expired.data.result.inputSource, expired.data.result.snapshotSavedAt <= late.deadline + FINISH_GRACE_MS],
    [true, true, true, 'deadline', 'server-snapshot-before-deadline', true], 'finalised by the server, late, on the snapshot saved before the bell');
  eq(expired.data.result.score, Number(q1.marking.correct) + Number(q2.marking.correct), 'marked on exactly that snapshot');
  eq(leaks(expired.data.exam), [], 'the paper beside the result is still the public paper');
  eq((await read(a.jar, late.id)).data.result, expired.data.result, 'a second read returns the same stored result');
  const lateDone = await finish(a.jar, late.id, { answers: allRight(latePaper), reason: 'student' });
  eq([lateDone.status, lateDone.data], [200, expired.data.result], 'a device that finishes afterwards is given that stored result, not a second marking');
  eq([lateDone.data.late, lateDone.data.finalisedBy, lateDone.data.inputSource], [true, 'deadline', 'server-snapshot-before-deadline'], 'which is flagged late');
  eq([await rows(a.account.id, 'exam-result') > 0, (await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [a.account.id, late.id])).n | 0,
    (await events(a.account.id, 'exam-result')).filter(e => e.entity_id === late.id).length], [true, 1, 1], 'one result row and one exam-result event exist for the paper');
  {
    const lateAttempts = lateDone.data.detail.filter(d => d.attemptId).map(d => d.attemptId).sort();
    const lateGraded = (await events(a.account.id, 'graded-attempt')).filter(e => JSON.parse(e.payload_json).examId === late.id).map(e => e.id).sort();
    eq(lateGraded, lateAttempts, 'and each attempt on it was written once');
  }
  const afterClosed = await save(a.jar, late.id, { answers: { [q1.id]: right(q1) }, rev: 9 });
  eq([afterClosed.status, afterClosed.data?.error?.code], [409, 'EXAM_FINALISED'], 'the closed paper takes no more answers');
  eq(lateDone.data.score, Number(q1.marking.correct) + Number(q2.marking.correct), 'and marks only the snapshot saved before it');
  eq(lateDone.data.detail.filter(d => !d.unanswered).map(d => d.id), [q1.id, q2.id], 'answers added after the bell are ignored');
  eq(lateDone.data.detail.find(d => d.id === q3.id).given, '', 'the late answer is not even recorded as given');
  ok(lateDone.data.snapshotSavedAt <= late.deadline + FINISH_GRACE_MS, 'the snapshot marked was saved before deadline + grace');

  const inGrace = (await create(a.jar, practice)).data.exam;
  const gracePaper = await sealed(inGrace.id);
  skew += 30 * 60000 + 60000;
  const g1 = answerable(gracePaper)[0];
  const graceDone = await finish(a.jar, inGrace.id, { answers: { [g1.id]: right(g1) }, reason: 'deadline' });
  eq([graceDone.data.late, graceDone.data.finalisedBy, graceDone.data.score], [false, 'deadline', Number(g1.marking.correct)], 'the automatic submit at the bell, a minute late, is marked on what it carries');

  const silent = (await create(a.jar, practice)).data.exam;
  skew += 30 * 60000 + FINISH_GRACE_MS + 1000;
  const silentPaper = await sealed(silent.id);
  const silentDone = await finish(a.jar, silent.id, { answers: allRight(silentPaper) });
  eq([silentDone.data.late, silentDone.data.score, silentDone.data.detail.every(d => d.unanswered)], [true, 0, true], 'a late finish with nothing checkpointed marks nothing');

  // ── Housekeeping closes a paper whose account never comes back ─────────────
  {
    const gone = await registerAccount(h, { email: 'exam.gone@example.test', deviceId: 'ipad-exam-gone' });
    eq((await verifyEmail(h, gone.account.id)).status, 200, 'an account that will never come back is verified');
    await h.db.run('DELETE FROM rate_limits');
    const left = (await create(gone.jar, practice)).data.exam;
    const leftPaper = await sealed(left.id);
    const l1 = answerable(leftPaper)[0];
    eq((await save(gone.jar, left.id, { answers: { [l1.id]: right(l1) }, rev: 1 })).data.saved, true, 'it saves one answer and leaves');
    // Papers the free accounts above walked away from, never touched again.
    const drained = await runHousekeeping(h.db);
    ok(drained.examsFinalised >= 2, `housekeeping closes the papers accounts above abandoned and never returned to (${drained.examsFinalised})`);
    for (const account of [racer, advFree]) {
      eq([await rows(account.account.id, 'exam-result'), (await events(account.account.id, 'exam-result')).length], [await rows(account.account.id, 'exam-paper'), await rows(account.account.id, 'exam-paper')],
        'every paper of such an account now has one result and one event');
    }
    const early = await runHousekeeping(h.db);
    eq([early.examsFinalised, await rows(gone.account.id, 'exam-result')], [0, 0], 'housekeeping leaves a paper that is still inside its time alone');
    skew += 30 * 60000 + FINISH_GRACE_MS + 1000;
    const [sweepOne, sweepTwo] = await Promise.all([runHousekeeping(h.db), finish(gone.jar, left.id, { answers: allRight(leftPaper) })]);
    eq(sweepTwo.status, 200, 'a late device finish racing housekeeping is answered');
    const stored = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [gone.account.id, left.id])).response_json);
    eq(sweepTwo.data, stored, 'with the one stored result');
    eq([stored.late, stored.score, stored.inputSource], [true, Number(l1.marking.correct), 'server-snapshot-before-deadline'], 'marked on the snapshot, whichever of the two wrote it');
    eq([await rows(gone.account.id, 'exam-result'), (await events(gone.account.id, 'exam-result')).length, (await events(gone.account.id, 'graded-attempt')).length],
      [1, 1, stored.detail.filter(d => d.attemptId).length], 'one result, one exam-result event and each attempt once');
    ok(sweepOne.examsFinalised === (stored.unattended ? 1 : 0), `housekeeping reports what it finalised (${sweepOne.examsFinalised})`);

    // And on its own, with no device at all.
    const lone = await registerAccount(h, { email: 'exam.lone@example.test', deviceId: 'ipad-exam-lone' });
    eq((await verifyEmail(h, lone.account.id)).status, 200, 'another account that will never come back is verified');
    await h.db.run('DELETE FROM rate_limits');
    const alone = (await create(lone.jar, practice)).data.exam;
    const alonePaper = await sealed(alone.id);
    const a1 = answerable(alonePaper)[0];
    await save(lone.jar, alone.id, { answers: { [a1.id]: right(a1) }, rev: 1 });
    skew += 30 * 60000 + FINISH_GRACE_MS + 1000;
    const swept = await runHousekeeping(h.db);
    eq(swept.examsFinalised, 1, 'housekeeping finalises the abandoned paper');
    const aloneStored = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [lone.account.id, alone.id])).response_json);
    eq([aloneStored.unattended, aloneStored.late, aloneStored.score, aloneStored.finalisedBy], [true, true, Number(a1.marking.correct), 'deadline'], 'on its last snapshot, flagged as closed by the server');
    eq((await runHousekeeping(h.db)).examsFinalised, 0, 'a second pass finds nothing to do');
    eq([(await events(lone.account.id, 'exam-result')).length, await rows(lone.account.id, 'exam-result')], [1, 1], 'and wrote nothing twice');
    eq((await finish(lone.jar, alone.id, { answers: allRight(alonePaper) })).data, aloneStored, 'a device finishing later gets the stored result');
  }

  // ── Restart on the same database ───────────────────────────────────────────
  const carried = (await create(a.jar, practice)).data.exam;
  const carriedPaper = await sealed(carried.id);
  const c1 = answerable(carriedPaper)[0];
  await save(a.jar, carried.id, { answers: { [c1.id]: right(c1) }, rev: 4 });
  await restart();
  const reopened = await read(a.jar, carried.id);
  eq([reopened.status, reopened.data.state, reopened.data.snapshot.rev], [200, 'open', 4], 'after a restart the open paper and its snapshot are still there');
  eq(reopened.data.exam.questions, carried.questions, 'the same questions');
  eq([reopened.data.exam.startedAt, reopened.data.exam.deadline], [carried.startedAt, carried.deadline], 'on the same clock');
  eq((await read(a.jar, exam.id)).data.result, result, 'and the finished result is unchanged');
  const carriedDone = await finish(a.jar, carried.id, {});
  eq([carriedDone.status, carriedDone.data.score, carriedDone.data.inputSource], [200, Number(c1.marking.correct), 'submission'],
    'a finish that carries no answers falls back to the snapshot saved before the restart');
  eq((await finish(a.jar, carried.id, {})).data, carriedDone.data, 'and replays identically');
  eq((await read(b.jar, carried.id)).status, 404, 'isolation holds after the restart');
  // The allowance is the server's own rows, so it survives the restart; and it
  // lifts when the window has passed since the paper it counted.
  const stillCapped = await create(racer.jar, practice);
  eq([stillCapped.status, stillCapped.data?.error?.code], [402, 'FREE_CAP_REACHED'], 'after the restart the free account is still at its limit');
  skew = Math.max(skew, stillCapped.data.error.nextAt - realNow() + 60000);
  const reLogin = await h.request('/v1/account/login', { method: 'POST', jar: racer.jar, body: { email: 'exam.racer@example.test', password: 'correct-horse-battery', deviceId: 'ipad-exam-racer' } });
  ok(reLogin.status === 200 || reLogin.status === 201, `thirty days later the student signs in again (${reLogin.status})`);
  await h.db.run('DELETE FROM rate_limits');
  const afterWindow = await create(racer.jar, practice);
  eq(afterWindow.status, 201, 'and the next free simulation has unlocked');
  eq((await create(racer.jar, practice)).status, 402, 'once');
} finally {
  Date.now = realNow;
  await h.close();
  await closeStore();
  if (pg) await pg.scratchDb.drop();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
}
console.log(`EXAM AUTHORITY: PASS — ${count}/${count} checks — a paper is issued, collected, marked once and read back by its owner only, on a real Pri ${engine} server.`);
console.log('engine: ' + engine);
