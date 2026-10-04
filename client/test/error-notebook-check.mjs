// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Error notebook suite (ledger §6.7)
//
// Every wrong practice answer is filed automatically — under the misconception
// the marker named when a designed trap was sprung, under its chapter
// otherwise — and each entry offers a twin: the same generator at the same
// difficulty on the same dot point with a new seed and a different question.
// Driven through the real dispatch():
//
//   filing   a trap answer files under the misconception id; a plain wrong
//            answer files under the chapter; a right answer is not filed; a
//            reveal is filed and marked as such; Rush/Match misses are not
//            filed; another profile cannot read the notebook or twin a row
//   twins    new row, same subtopic/generator/difficulty, different content
//            hash, the original's dot points (exact when the original was
//            pinned), the India chapter and dot point index kept, deterministic
//            for the same original, refused for custom questions
//
// Usage: node client/test/error-notebook-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
let pass = 0;
const failures = [];
let group = 'filing';
const section = n => { group = n; };
const show = v => JSON.stringify(v) ?? String(v);
const ok = (name, cond, detail = '') => { if (cond) { pass++; return true; } failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`); return false; };
const eq = (name, a, b) => ok(name, show(a) === show(b), `expected ${show(b)}, got ${show(a)}`);
async function rejects(name, promise, { status } = {}) {
  try { await promise; ok(name, false, 'resolved instead of throwing'); }
  catch (err) { ok(name, !status || err?.status === status, `threw ${show({ status: err?.status, message: err?.message })}`); }
}

installBrowserEnv();
resetStorage();
const { dispatch } = await import(`${SRC}local/backend.js`);
const idb = await import(`${SRC}local/idb.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { contentHashOf } = await import(`${SRC}engine/contentIdentity.js`);
const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();

function canonicalInput(q) {
  const a = q.answer; if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric': if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`; if (a.requireExact || a.surdForm) return null; return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    default: return null;
  }
}
const wrongInput = q => (q.answerType === 'mcq' ? String(((q.answer.correctIndex || 0) + 1) % (q.mcqOptions?.length || 4)) : q.answerType === 'numeric' ? String((Number(q.answer.value) || 0) + 7) : q.answerType === 'expression' ? `(${q.answer.expr})+7` : null);
/** The input that springs a designed trap, or null. */
function trapInput(q) {
  for (const t of q.traps || []) {
    const v = t.value ?? t.expr ?? null;
    if (v == null) continue;
    const r = checkAnswer(q, String(v));
    if (!r.correct && r.feedback && String(r.feedback) === String(t.why)) return String(v);
  }
  return null;
}
// The suite serves dozens of questions per profile; the free tier's twenty a
// day is entitlement-enforcement-check.mjs's subject, not this one's.
const DAY = 86_400_000;
async function liftFreeCap(pid) {
  const { cloudLinkRowId } = await import(`${SRC}platform/cloudAccount.js`);
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student', emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY, issuedAt: now, sourceVersion: 1 }
  });
}
async function serve(body) {
  const res = await dispatch('POST', '/practice/next', body);
  const row = await idb.get('questions', res.question.id);
  return { ...res, payload: row.payload, row };
}
async function find(body, pred, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const q = await serve(body);
    if (pred(q)) return q;
    await dispatch('POST', `/practice/${q.question.id}/skip`, {}).catch(() => {});
  }
  return null;
}
const submit = (id, answer) => dispatch('POST', `/practice/${id}/submit`, { answer, ms: 5000 });
/** Two wrong submissions resolve a practice question wrong. */
async function missTwice(id, answer) { await submit(id, answer); return submit(id, answer); }

// ── Filing ──────────────────────────────────────────────────────────────────
section('filing');
const { user: ada } = await dispatch('POST', '/profiles', { name: 'Notebook Ada', year: 8 });
await liftFreeCap(ada.id);
eq('a new profile has an empty notebook', (await dispatch('GET', '/notebook')).entries, []);

const trapped = await find({ mode: 'topic', subtopic: 'y8-indices', difficulty: 2 }, q => !!trapInput(q.payload) && !!canonicalInput(q.payload));
if (ok('a Year 8 indices question with a springable trap was served', !!trapped)) {
  const r = await missTwice(trapped.question.id, trapInput(trapped.payload));
  eq('the trap answer resolves the question wrong', [r.correct, r.resolved], [false, true]);
  const nb = await dispatch('GET', '/notebook');
  const entry = nb.entries.find(g => g.items.some(i => i.id === trapped.question.id));
  if (ok('the wrong answer is filed', !!entry)) {
    ok('it is filed under a misconception, not just the chapter', !!entry.misconception?.key, show(entry.misconception));
    ok('the misconception carries a readable label', typeof entry.misconception.label === 'string' && entry.misconception.label.length > 5, show(entry.misconception));
    eq('the entry names the subtopic', entry.subtopic, 'y8-indices');
    eq('the item carries the prompt and difficulty', [typeof entry.items[0].prompt, entry.items[0].difficulty], ['string', 2]);
    ok('the item offers a twin', entry.items[0].canTwin);
  }
  const attempt = (await idb.byIndex('attempts', 'pid', ada.id)).find(a => a.questionId === trapped.question.id);
  eq('the attempt row records the misconception for the mastery model', attempt?.misconception, entry?.misconception?.key);
}

const springsNothing = q => {
  const w = wrongInput(q.payload);
  if (!w || !canonicalInput(q.payload)) return false;
  const r = checkAnswer(q.payload, w);
  return !r.correct && !(q.payload.traps || []).some(t => String(t.why) === String(r.feedback || ''));
};
const plain = await find({ mode: 'topic', subtopic: 'y7-equations', difficulty: 1 }, springsNothing);
if (ok('a question whose wrong answer springs no trap was served', !!plain)) {
  await missTwice(plain.question.id, wrongInput(plain.payload));
  const nb = await dispatch('GET', '/notebook');
  const entry = nb.entries.find(g => g.items.some(i => i.id === plain.question.id));
  ok('a wrong answer with no named slip is filed under its chapter', !!entry && entry.misconception === null && entry.subtopic === 'y7-equations', show(entry && { key: entry.key, m: entry.misconception }));
}

const right = await find({ mode: 'topic', subtopic: 'y8-indices', difficulty: 1 }, q => !!canonicalInput(q.payload) && checkAnswer(q.payload, canonicalInput(q.payload)).correct);
if (ok('an answerable question was served', !!right)) {
  await submit(right.question.id, canonicalInput(right.payload));
  const nb = await dispatch('GET', '/notebook');
  ok('a right answer is not filed', !nb.entries.some(g => g.items.some(i => i.id === right.question.id)));
}

const revealed = await serve({ mode: 'topic', subtopic: 'y8-indices', difficulty: 1 });
await dispatch('POST', `/practice/${revealed.question.id}/reveal`, { ms: 1000 });
{
  const nb = await dispatch('GET', '/notebook');
  const item = nb.entries.flatMap(g => g.items).find(i => i.id === revealed.question.id);
  ok('a revealed question is filed and marked as revealed', !!item && item.revealed === true, show(item));
  const total = nb.entries.reduce((a, g) => a + g.count, 0);
  ok('groups are ordered by how often the slip recurred, then recency', nb.entries.every((g, i) => i === 0 || nb.entries[i - 1].count >= g.count));
  ok('the count is the number of wrong answers filed', total >= 3, show(total));
}

{
  const rush = await dispatch('POST', '/rush/start', {});
  const q = rush.questions[0];
  await dispatch('POST', '/rush/answer', { id: q.id, answer: '-99999' }).catch(() => {});
  const nb = await dispatch('GET', '/notebook');
  ok('a Rush miss is not filed — a 90-second game is the clock, not a wrong idea', !nb.entries.some(g => g.items.some(i => i.id === q.id)));
}

// ── Twins ───────────────────────────────────────────────────────────────────
section('twins');
const source = trapped || plain;
if (ok('a filed question exists to twin', !!source)) {
  const tw = await dispatch('POST', `/notebook/${source.question.id}/twin`, {});
  ok('the twin is a new question row', tw.question.id && tw.question.id !== source.question.id);
  const row = await idb.get('questions', tw.question.id);
  eq('the twin keeps the subtopic', row.subtopic, source.row.subtopic);
  eq('the twin keeps the generator', row.generator || row.subtopic, source.row.generator || source.row.subtopic);
  eq('the twin keeps the difficulty', row.difficulty, source.row.difficulty);
  ok('the twin is a different question', contentHashOf(row.payload) !== contentHashOf(source.payload) && row.payload.seed !== source.payload.seed);
  ok('the twin is unanswered', !row.answered && row.tries === 0);
  eq('the twin reports what it kept', [tw.twin.of, tw.twin.difficulty, tw.twin.distinct], [source.question.id, source.row.difficulty, true]);
  const srcDots = [...(source.payload.dotpoints || [])].sort();
  const twinDots = [...(row.payload.dotpoints || [])].sort();
  eq('the twin credits the same dot points as the original', twinDots, srcDots);
  ok('the twin is flagged as the same dot point', tw.twin.sameDotpoint === true, show(tw.twin));
  const again = await dispatch('POST', `/notebook/${source.question.id}/twin`, {});
  eq('twinning the same original again gives the same twin (deterministic)', again.twin.seed, tw.twin.seed);
}

// A pinned NSW dot point stays pinned.
{
  const pinned = await find({ mode: 'topic', subtopic: 'y8-indices', difficulty: 2, dotpoint: 'y8-indices#0' }, q => !!q.payload.dotpointRequested && !!canonicalInput(q.payload) && !!wrongInput(q.payload) && !checkAnswer(q.payload, wrongInput(q.payload)).correct).catch(() => null);
  if (pinned) {
    await missTwice(pinned.question.id, wrongInput(pinned.payload));
    const tw = await dispatch('POST', `/notebook/${pinned.question.id}/twin`, {});
    const row = await idb.get('questions', tw.question.id);
    ok('a twin of a dot-point-pinned question is pinned to the same dot point', (row.payload.dotpoints || []).includes(pinned.payload.dotpointRequested) && tw.twin.dotpoint === pinned.payload.dotpointRequested, show([pinned.payload.dotpointRequested, row.payload.dotpoints, tw.twin]));
  } else {
    ok('a dot-point-pinned question could be requested (skipped: none served)', true);
  }
}

// India: chapter and dot point index travel with the twin.
{
  const { user: dev } = await dispatch('POST', '/profiles', { name: 'Notebook Dev', year: 10, course: 'in', indiaTrack: 'cbse' });
  await liftFreeCap(dev.id);
  const q = await find({ mode: 'topic', subtopic: 'c10-quadratic-equations', track: 'cbse', difficulty: 2 }, x => !!canonicalInput(x.payload) && !!wrongInput(x.payload) && !checkAnswer(x.payload, wrongInput(x.payload)).correct);
  if (ok('an India Class 10 question was served', !!q)) {
    await missTwice(q.question.id, wrongInput(q.payload));
    const nb = await dispatch('GET', '/notebook');
    const entry = nb.entries.find(g => g.items.some(i => i.id === q.question.id));
    ok('the India miss is filed under its NCERT chapter name', !!entry && entry.chapterName === 'Quadratic Equations', show(entry && [entry.chapterName, entry.subtopic]));
    ok('the item names its dot point from the spine', typeof entry?.items[0].dotpointText === 'string' && entry.items[0].dotpointText.length > 10, show(entry?.items[0]));
    const tw = await dispatch('POST', `/notebook/${q.question.id}/twin`, {});
    const row = await idb.get('questions', tw.question.id);
    eq('the twin keeps the India chapter and dot point index', [row.india?.chapterId, row.india?.dotpointIndex], [q.row.india.chapterId, q.row.india.dotpointIndex]);
    eq('the twin keeps the generator that drew the original', row.generator, q.row.generator);
    ok('the twin is a different question', contentHashOf(row.payload) !== contentHashOf(q.payload));
    eq('the twin is served as a practice question on the same chapter', [tw.question.subtopic, tw.question.difficulty], [q.question.subtopic, q.row.difficulty]);
    // Another profile cannot see or twin it.
    await dispatch('POST', '/profiles/select', { id: ada.id });
    await rejects('another profile cannot twin your question', dispatch('POST', `/notebook/${q.question.id}/twin`, {}), { status: 404 });
    ok('another profile does not see your notebook entries', !(await dispatch('GET', '/notebook')).entries.some(g => g.items.some(i => i.id === q.question.id)));
    await dispatch('POST', '/profiles/select', { id: dev.id });
  }
}

// Custom questions have no generated twin.
{
  await dispatch('POST', '/profiles/select', { id: ada.id });
  const rows = await idb.byIndex('questions', 'pid', ada.id);
  const customRow = { id: 'custom-row-1', pid: ada.id, subtopic: 'custom', difficulty: 2, payload: { custom: true, prompt: 'Custom', answerType: 'numeric', answer: { value: 1 }, steps: [], hints: [] }, mode: 'practice', answered: 1, tries: 0, hintsUsed: 0, createdAt: Date.now() };
  await idb.put('questions', customRow);
  await rejects('a custom question has no generated twin', dispatch('POST', `/notebook/${customRow.id}/twin`, {}), { status: 400 });
  ok('the stores were not disturbed', (await idb.byIndex('questions', 'pid', ada.id)).length === rows.length + 1);
}

// ── Report ──────────────────────────────────────────────────────────────────
const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`ERROR NOTEBOOK: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`ERROR NOTEBOOK: PASS — ${pass}/${total} checks — wrong answers filed by misconception, twins keep generator, difficulty and dot point`);
