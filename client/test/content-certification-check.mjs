// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · content certification regressions (doc §06)
//
// The certification gate (content-certify.mjs) is only worth running if it
// fails on the defects it exists for. This suite injects each one and proves
// the gate catches it, pins the real defects the first certification run found
// (each with the evidence that it is fixed), and pins the runtime contracts the
// mission added: a deliberate empty state instead of a crash or retry loop, a
// bounded repeat window, and content identity on every served question and
// attempt with migration-safe legacy defaults.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
// Online-only grading (owner decision 2026-10-10): the backend sections below
// run against the real server. Every profile is a real verified account, so
// its India questions are issued by the server and answered questions are
// marked by it.
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const online = await startOnlineAuthority({ label: 'content-certification' });

const cert = await import('./content-certify.mjs');
const {
  certifyQuestion, latexProblems, figureProblems, identityProblems, paperProblems,
  certifyPath, enumeratePaths, loadBanksForPaths, compareDigests, REPEAT_WINDOW
} = cert;
const {
  CONTENT_VERSION, LEGACY_CONTENT_VERSION, contentHashOf, contentIdOf, contentRefOf,
  stampContent, stampExamItem, drawDistinct
} = await import('../src/engine/contentIdentity.js');
const { generateQuestion, loadAllBanks } = await import('../src/engine/generators/index.js');
const { IN_CURRICULUM, IN_CHAPTER_BY_ID } = await import('../src/engine/curriculum-in.js');
const { resolveIndiaTarget } = await import('../src/engine/indiaProduct.js');
const { CONTENT_EMPTY_CODES, isContentEmpty, servable, contentEmptySignal } = await import('../src/lib/contentServe.js');
const { telemetryEvent } = await import('../src/platform/telemetry.js');
const { dispatch } = await import('../src/local/backend.js');
const idb = await import('../src/local/idb.js');

await loadAllBanks();
// Every bank a V1 path reaches, including the demand-loaded archives — the app
// loads them in api.js before a request reaches the backend.
await loadBanksForPaths(enumeratePaths());

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(a === b, `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const src = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');

// A known-good question to break, one way at a time.
const good = generateQuestion('c10-quadratic-roots', 2, 12345);
eq(certifyQuestion(good, { generatorId: 'c10-quadratic-roots' }).length, 0, 'a real generated question certifies clean');

// ── 1. Injected defects make the gate fail ──────────────────────────────────

{
  const bad = stampContent({ ...good, prompt: `${good.prompt} Evaluate $\\frac{1}{2$.` }, 'c10-quadratic-roots');
  ok(certifyQuestion(bad, { generatorId: 'c10-quadratic-roots' }).some(p => /KaTeX cannot render|unbalanced/.test(p)), 'malformed LaTeX in a prompt fails the gate');
}
ok(latexProblems('Find $\\sinA$.').some(p => p.includes('KaTeX cannot render')), 'an undefined control sequence (\\sinA) fails the gate');
ok(latexProblems('$(x+7)(x+8)').some(p => p.includes('unbalanced')), 'an unclosed $ (the Class 8 MCQ defect) fails the gate');
eq(latexProblems('Costs \\$40 and $x^2$ is fine').length, 0, 'an escaped currency \\$ is not a delimiter');
// Raw LaTeX outside $…$ is shown to the student as source text (MathText
// renders only $…$). The #310 review found published options like "\frac{3}{5}".
ok(latexProblems('\\frac{3}{5}', 'option 0').some(p => p.includes('outside $…$')), 'a bare \\frac option fails the gate');
ok(latexProblems('Roots are -1\\pm\\sqrt{10} here').some(p => p.includes('\\pm outside')), 'a bare command inside prose fails the gate');
ok(latexProblems('₹500\\times20/100=₹100', 'step 1').some(p => p.includes('\\times outside')), 'a bare \\times in a step fails the gate');
eq(latexProblems('$\\frac{3}{5}$').length, 0, 'the same formula inside $…$ passes');
ok(latexProblems('Let $$\\int_0^1 f$$ be given').some(p => p.includes('display $$')), 'display $$…$$ fails: MathText would show stray dollar signs');
eq(latexProblems('Let $f(x)=\\sin x$ and $\\int_0^1 f$ be given').some(p => p.includes('outside')), false, 'inline math beside prose is not a bare command');
eq(latexProblems('Costs \\$40, then $2\\pi$').length, 0, 'an escaped \\$ next to real math is not a bare command');
{
  const bad = { ...good, mcqOptions: ['$2x', '$3x$'], answerType: 'mcq', answer: { correctIndex: 0 } };
  ok(certifyQuestion(bad, { identity: false }).some(p => p.includes('unbalanced $ delimiter in option 0')), 'an unclosed $ in an MCQ option fails the gate');
}
ok(figureProblems({ prompt: 'Use the figure below.', figure: '<svg><script>alert(1)</script><circle r="2"/><image href="https://x/y.png"/></svg>' })
  .some(p => p.includes('loses') && p.includes('figure sanitiser')), 'a figure whose elements the sanitiser strips (broken asset) fails the gate');
ok(figureProblems({ prompt: 'Use the figure below.', figure: '<script>alert(1)</script>' })
  .some(p => p.includes('removed entirely')), 'a figure the sanitiser removes entirely fails the gate');
ok(figureProblems({ prompt: 'In the figure shown, find x.' }).some(p => p.includes('none is attached')), 'a prompt that points at a missing figure fails the gate');
eq(figureProblems({ prompt: 'Find x.', figure: '<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="5" y2="5"/></svg>' }).length, 0, 'an intact app-drawn SVG figure passes');
{
  // A key the marker rejects: the keyed simplest fraction does not equal the
  // keyed value, so a declared answer form is marked wrong by checkAnswer.
  const base = { prompt: 'Compute $\\frac{1}{2}$ as a fraction.', answerType: 'numeric', hints: ['Halve it.'], steps: [{ h: 'Halve', d: '$\\frac{1}{2}$' }] };
  eq(certifyQuestion({ ...base, answer: { value: 0.5, simplestFraction: { n: 1, d: 2 } } }, { identity: false }).length, 0, 'a consistent numeric key passes');
  ok(certifyQuestion({ ...base, answer: { value: 0.5, canonicalInput: '0.75' } }, { identity: false }).some(p => p.includes('round-trip')), 'an inconsistent answer key fails the gate through the real marker');
  ok(certifyQuestion({ ...base, answer: { value: NaN } }, { identity: false }).some(p => /keyed value is NaN|round-trip|no canonical/.test(p)), 'a NaN key fails the gate');
}
ok(certifyQuestion({ ...good, steps: [] }, { identity: false }).includes('no steps'), 'a question without solution steps fails the gate');
ok(certifyQuestion({ multipart: true, stem: 'S', parts: [{ key: 'a', prompt: 'p', answerType: 'numeric', answer: { value: 1 }, steps: [{ h: 'x', d: 'y' }], marks: 1 }] }, { identity: false })
  .includes('multipart needs 2+ parts'), 'a one-part multipart item fails the gate');
ok(identityProblems({ ...good, contentId: undefined }, 'c10-quadratic-roots').includes('no contentId'), 'a served question without a contentId fails the gate');
ok(identityProblems({ ...good, contentVersion: undefined }, 'c10-quadratic-roots').includes('no contentVersion'), 'a served question without a contentVersion fails the gate');
ok(identityProblems({ ...good, prompt: `${good.prompt} (edited)` }, 'c10-quadratic-roots').some(p => p.includes('contentHash does not match')), 'content edited after stamping fails the gate');
{
  const a = stampExamItem(good, { blueprintId: 'bp', paperSeed: 1, order: 1 });
  const b = stampExamItem(good, { blueprintId: 'bp', paperSeed: 1, order: 2 });
  ok(paperProblems([a, b]).some(r => r.problems.includes('the same question appears twice in one paper')), 'a duplicate item in one paper fails the gate');
  eq(paperProblems([a]).length, 0, 'a single stamped item passes the paper check');
  ok(paperProblems([{ ...good, contentId: undefined }]).some(r => r.problems.includes('exam item carries no content identity')), 'an unstamped paper item fails the gate');
}
{
  // A generator whose pool is one item: every draw after the first is a
  // repeat. The gate classifies it as exhausted (surfaced to the student), not
  // avoidable, and drawDistinct stops after its bounded tries.
  let calls = 0;
  const one = (gen, d, seed) => { calls++; return stampContent({ ...good, seed, difficulty: d }, gen); };
  const path = { id: 'test/one', track: 'cbse', grade: 10, chapterId: 'c10-quadratic-equations', dotpoint: null, pyqOnly: false, difficulties: [2], advertised: true };
  const row = certifyPath(path, 6, { draw: (g, d, s) => ({ ...one(g, d, s), contentHash: contentHashOf(good) }) });
  ok(row.repeatsExhausted >= 5 && row.repeatsAvoidable === 0, `a one-item pool repeats as exhausted, not avoidable (${row.repeatsExhausted}/${row.repeatsAvoidable})`);
  ok(calls < 6 * 40, `the repeat window is bounded — ${calls} draws for 6 requests`);
}
{
  // A generator that ignores its seed yet claims a large pool would be caught
  // as non-deterministic: same seed, different item.
  let flip = 0;
  const unstable = (gen, d, seed) => stampContent({ ...good, seed, difficulty: d, prompt: `${good.prompt} #${flip++}` }, gen);
  const path = { id: 'test/unstable', track: 'cbse', grade: 10, chapterId: 'c10-quadratic-equations', dotpoint: null, pyqOnly: false, difficulties: [2], advertised: true };
  const row = certifyPath(path, 2, { draw: unstable });
  ok(!row.pass && Object.keys(row.failures).some(k => k.includes('same seed does not reproduce')), 'a non-deterministic generator fails the gate');
}
{
  // An advertised path that serves nothing fails.
  const path = { id: 'test/empty', track: 'cbse', grade: 10, chapterId: 'no-such-chapter', dotpoint: null, pyqOnly: false, difficulties: [1, 2], advertised: true };
  const row = certifyPath(path, 2);
  ok(!row.pass && row.empty === 4, 'an advertised path that serves zero questions fails the gate');
}

// ── 2. The real defects the first certification run found ───────────────────

// (a) Class 8 Ch 3–13 MCQs keyed their correct option without its closing $.
// The keyed option rendered as literal "$(x+7)(x+8)" while every distractor
// rendered as maths — the answer was the visibly different option.
for (const gen of ['c8-algebraic-identities-ncert-mastery', 'c8-exponents-ncert-mastery', 'c8-factorisation-ncert-mastery']) {
  let latexBad = 0;
  for (let d = 1; d <= 4; d++) for (let i = 0; i < 40; i++) {
    const q = generateQuestion(gen, d, 7000 + d * 100 + i);
    for (const o of q.mcqOptions || []) latexBad += latexProblems(o).length;
    latexBad += latexProblems(q.prompt).length;
  }
  eq(latexBad, 0, `${gen}: every option and prompt renders as balanced maths (was: keyed option unclosed)`);
}
{
  const q = generateQuestion('c8-factorisation-ncert-mastery', 2, 626706219);
  ok(q.mcqOptions.every(o => (o.match(/\$/g) || []).length % 2 === 0), 'c8 factorisation seed 626706219: no option leaks the key by an unclosed $');
}
// (b) Class 10 trigonometry identity form wrote $\sinA$ — an undefined KaTeX
// control sequence, shown to the student as a red error span.
{
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const q = generateQuestion('c10-trigonometry-current', 4, 1776816983 + i);
    for (const t of [q.prompt, ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d])]) bad += latexProblems(t).length;
  }
  eq(bad, 0, 'c10 trigonometry: no undefined \\sinA / \\cosA control sequence in any rendered string');
}
// (c) A CBSE dot point whose only authored form is D4 was advertised (the
// curriculum response marks it generated) but resolveIndiaTarget refused it,
// so selecting it was an INDIA_TARGET_UNCOVERED dead end behind "Try again".
{
  const deadEnds = [];
  for (const group of IN_CURRICULUM) for (const chapter of group.chapters) {
    chapter.dotpoints.forEach((_, i) => {
      const generated = (chapter.covers || []).some(c => c.dp.includes(i) && (c.diff || []).length > 0);
      if (!generated) return;
      for (const d of [1, 2, 3]) if (!resolveIndiaTarget(chapter, { dotpoint: i, difficulty: d, track: 'cbse', grade: group.grade, random: () => 0 })) deadEnds.push(`${chapter.id}#${i + 1}@D${d}`);
    });
  }
  eq(deadEnds.length, 0, `every advertised CBSE dot point resolves to a servable target (dead ends: ${deadEnds.slice(0, 5).join(', ')})`);
  const c7 = IN_CHAPTER_BY_ID['c7-connecting-dots-current'];
  const t = resolveIndiaTarget(c7, { dotpoint: 3, difficulty: 2, track: 'cbse', grade: 7, random: () => 0 });
  ok(t && t.windowed === false && t.difficulty === 4, 'a D4-only CBSE dot point is served at D4 and disclosed as outside the window');
}

// (d) "Past papers only" on a chapter whose archive holds questions was always
// refused: the backend narrowed every chapter request to a dot point first, and
// the archives answer only chapter-level requests. Smart practice under the
// filter likewise picked chapters with no archive. Both are driven through the
// real backend below (section 4).

// ── 3. Empty / exhausted pool handling ──────────────────────────────────────

for (const code of ['INDIA_TARGET_UNCOVERED', 'INDIA_TRACK_UNCOVERED', 'INDIA_TOPIC_NOT_FOUND', 'CONTENT_EMPTY']) ok(isContentEmpty(code), `${code} is a content-empty state`);
ok(!isContentEmpty('INDIA_PYQ_UNAVAILABLE'), 'the past-papers filter refusal keeps its own "turn the filter off" action');
ok(!isContentEmpty('FREE_CAP_REACHED'), 'the free cap is not an empty path');
ok(!servable({}) && !servable({ question: null }) && !servable({ question: { id: 'x' } }), 'a reply with no question (or an empty one) is not servable');
ok(servable({ question: { id: 'x', prompt: 'p' } }) && servable({ question: { id: 'x', stem: 's', parts: [{}] } }), 'a reply with a real question is servable');
{
  const signal = contentEmptySignal({ code: 'INDIA_TARGET_UNCOVERED', track: 'cbse', grade: 7 });
  const event = telemetryEvent(signal.type, signal.options);
  eq(event.metadata.code, 'INDIA_TARGET_UNCOVERED', 'the empty-path signal is accepted by the telemetry allowlist with its code');
  eq(event.metadata.scope, 'content-empty', 'the empty-path signal is scoped');
  ok(!('chapter' in event.metadata) && !('prompt' in event.metadata), 'the empty-path signal carries no chapter or prompt text');
}
{
  const page = src('../src/pages/PracticeBase.jsx');
  ok(page.includes("isContentEmpty(errorCode) && (") && page.includes("t('practice.emptyTitle')") && page.includes("t('practice.emptyBody')"), 'Practice renders a deliberate empty state for content-empty codes');
  ok(page.includes('!isContentEmpty(errorCode) && ('), 'the generic error box (with Try again) is not shown for an empty path — no retry loop');
  ok((page.match(/if \(!servable\(r\)\) throw/g) || []).length === 2, 'both practice requests refuse a reply without a question instead of crashing on serve.question');
  ok(page.includes("t('practice.repeatNote')") && page.includes('serve.repeat'), 'a repeat from an exhausted pool is said out loud');
  ok(page.includes('noteEmpty(e.code)') && page.includes('queueTelemetry(signal.type, signal.options)'), 'an empty path emits a logged signal');
  const en = src('../src/i18n/strings.en.js'), hi = src('../src/i18n/strings.hi.js');
  for (const key of ['practice.emptyTitle', 'practice.emptyBody', 'practice.emptyChooseTopic', 'practice.emptySmart', 'practice.repeatNote']) {
    ok(en.includes(`'${key}':`) && hi.includes(`'${key}':`), `${key} exists in English and Hindi`);
  }
  for (const line of en.split('\n').filter(l => /'practice\.(empty|repeat)/.test(l))) {
    ok(!/syllabus[- ]complete|every question|all questions|complete coverage/i.test(line.replace("every question this choice can offer", '')), `empty-state copy makes no coverage claim: ${line.trim().slice(0, 60)}`);
  }
  const backend = src('../src/local/backend.js');
  for (const code of new Set([...backend.matchAll(/code: '(INDIA_(?:TARGET|TRACK)_UNCOVERED|INDIA_TOPIC_NOT_FOUND)'/g)].map(m => m[1]))) {
    ok(CONTENT_EMPTY_CODES.includes(code), `backend empty code ${code} is handled by the empty state`);
  }
}

// ── 4. Repeat window and versioning through the real backend ────────────────

resetStorage();
async function premiumProfile(spec) {
  const created = await dispatch('POST', '/profiles', spec);
  await online.link(created.user.id, { entitlement: 'premium' });
  return created.user;
}
const student = await premiumProfile({ name: 'Cert Student', course: 'in', indiaTrack: 'cbse', year: 10 });
{
  const hashes = [];
  let repeats = 0;
  for (let i = 0; i < REPEAT_WINDOW; i++) {
    const r = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: 'c10-quadratic-equations', track: 'cbse', difficulty: 2 });
    const row = await idb.get('questions', r.question.id);
    hashes.push(row.payload.contentHash);
    if (r.repeat) repeats++;
    await dispatch('POST', `/practice/${r.question.id}/discard`, {});
  }
  eq(new Set(hashes).size, hashes.length, `${REPEAT_WINDOW} consecutive questions on a large-pool chapter are all distinct`);
  eq(repeats, 0, 'none of them is flagged as a repeat');
}
{
  const r = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: 'c10-real-numbers', track: 'cbse' });
  const row = await idb.get('questions', r.question.id);
  // The row is server-issued: what is on the device (q) has no answer and no
  // seed. `key` is the same question regenerated from the parameters the
  // device asked the server to issue — the suite's oracle, never the product's.
  const q = row.payload;
  const key = await online.answerKey(row);
  ok(!!row.serverQuestionId && !('answer' in q) && !('seed' in q), 'the served India question was issued by the server and carries no answer or seed on the device');
  ok(typeof q.contentId === 'string' && q.contentId.length > 0, `a served India question carries a contentId (${q.contentId})`);
  eq(q.contentVersion, CONTENT_VERSION, 'a served India question carries the current content version');
  eq(q.contentHash, contentHashOf(key), 'its contentHash matches what was served');
  if (!key.pyq) eq(q.contentId, contentIdOf(key, row.generator), 'its contentId names the generator, difficulty and seed that reproduce it');
  const same = generateQuestion(row.generator, q.difficulty, key.seed);
  eq(same.contentHash, q.contentHash, 'the contentId reproduces the same question under the same content version');

  const answer = key.answerType === 'mcq' ? String(key.answer.correctIndex) : String(key.answer?.value ?? key.answer?.expr ?? '0');
  const marked = await dispatch('POST', `/practice/${r.question.id}/submit`, { answer, submissionId: nextSubmissionId() });
  ok(online.traffic.grade === 1 && typeof marked?.correct === 'boolean', `the answer was marked by the server (${online.traffic.grade} grade request, correct=${marked?.correct})`);
  const attempts = (await idb.byIndex('attempts', 'pid', student.id)).filter(a => a.questionId === r.question.id);
  eq(attempts.length, 1, 'the answered question produced one attempt');
  eq(attempts[0]?.contentId, q.contentId, 'the attempt records the contentId it was made on');
  eq(attempts[0]?.contentVersion, CONTENT_VERSION, 'the attempt records the content version');
  eq(attempts[0]?.contentHash, q.contentHash, 'the attempt records the content hash');
  eq(attempts[0]?.seed, key.seed, 'the attempt records the seed');
}
{
  // Legacy rows: no identity reads as the legacy version, never as current.
  const ref = contentRefOf({ subtopic: 'x', difficulty: 2 });
  eq(ref.contentVersion, LEGACY_CONTENT_VERSION, 'an attempt from before versioning reads as the legacy version');
  eq(ref.contentId, null, 'and carries no contentId');
  eq(contentRefOf({ contentId: 'bad id with spaces', contentVersion: '2026.10.0' }).contentVersion, LEGACY_CONTENT_VERSION, 'a malformed contentId does not pass as versioned');
  eq(contentRefOf({ contentId: 'gen:x:d1:s2', contentVersion: '2026.1.0' }).contentVersion, '2026.1.0', 'an older explicit version is preserved, not rewritten to current');
}
{
  // A backup written before versioning restores with legacy defaults, and a
  // versioned one keeps its identity through the import allowlist.
  const exported = await dispatch('GET', '/data/export');
  const file = JSON.parse(JSON.stringify(exported.data || exported));
  const rows = file.attempts || file.stores?.attempts || null;
  if (Array.isArray(rows) && rows.length) {
    const legacy = { ...rows[0] };
    delete legacy.contentId; delete legacy.contentVersion; delete legacy.contentHash; delete legacy.seed;
    rows.push({ ...legacy, questionId: rows[0].questionId, createdAt: rows[0].createdAt + 1 });
  }
  ok(Array.isArray(rows), 'the export carries attempts');
  const backend = src('../src/local/backend.js');
  ok(/attempts: \(r, pid, ids\) => \(\{[\s\S]*?\.\.\.attemptContentRef\(r\)/.test(backend), 'the attempt restore allowlist rebuilds content identity through contentRefOf');
  ok(backend.includes('const ref = contentRefOf(src);') && backend.includes('out.contentId = ref.contentId'), 'the question restore keeps a well-formed content identity');
  const sync = src('../src/platform/syncWorker.js');
  ok(sync.includes("...(typeof attempt?.contentId === 'string' && attempt.contentId ? {"), 'a synced attempt carries its content identity only when it has one (legacy payloads unchanged)');
}
{
  // "Retry the same question" on a question stamped with an older version is
  // re-served from its stored payload rather than regenerated differently.
  const r = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: 'c10-quadratic-equations', track: 'cbse', difficulty: 2 });
  const row = await idb.get('questions', r.question.id);
  const key = await online.answerKey(row);
  const old = { ...row, payload: { ...row.payload, contentVersion: '2025.1.0', prompt: `${row.payload.prompt} [as first served]` } };
  await idb.put('questions', old);
  const answer = key.answerType === 'mcq' ? String(key.answer.correctIndex) : String(key.answer?.value ?? key.answer?.expr ?? '0');
  await dispatch('POST', `/practice/${r.question.id}/submit`, { answer, submissionId: nextSubmissionId() });
  const again = await dispatch('POST', `/history/${r.question.id}/retry`, { variant: 'same' }).catch(e => ({ error: e }));
  ok(again?.question?.prompt?.endsWith('[as first served]'), 'retrying a question from an older content version shows the question as it was first served');
}

{
  // Regression (d), end to end.
  const senior = await premiumProfile({ name: 'Cert Senior', course: 'in', indiaTrack: 'cbse', year: 12 });
  ok(!!senior, 'a Class 12 CBSE profile exists');
  const chapterReply = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: 'c12-matrices', track: 'cbse', pyqOnly: true }).catch(e => ({ error: e }));
  ok(chapterReply?.question && chapterReply.pyq === true, `past papers only on an archived chapter serves a past paper (${chapterReply?.error ? `${chapterReply.error.code} ${chapterReply.error.message}` : `pyq=${chapterReply?.pyq}`})`);
  if (chapterReply?.question?.id) await dispatch('POST', `/practice/${chapterReply.question.id}/discard`, {});
  for (let i = 0; i < 3; i++) {
    const smart = await dispatch('POST', '/practice/next', { mode: 'smart', track: 'cbse', pyqOnly: true }).catch(e => ({ error: e }));
    ok(smart?.question && smart.pyq === true, `smart practice under past papers only serves a past paper (${smart?.error ? `${smart.error.code} ${smart.error.message}` : `pyq=${smart?.pyq}`})`);
    if (smart?.question?.id) await dispatch('POST', `/practice/${smart.question.id}/discard`, {});
  }
  const junior = await premiumProfile({ name: 'Cert Junior', course: 'in', indiaTrack: 'cbse', year: 7 });
  ok(!!junior, 'a Class 7 CBSE profile exists');
  const none = await dispatch('POST', '/practice/next', { mode: 'smart', track: 'cbse', pyqOnly: true }).catch(e => ({ error: e }));
  eq(none?.error?.code, 'INDIA_PYQ_UNAVAILABLE', 'a class with no archive says so under the filter instead of serving authored practice');
}

{
  // Regression (e): the Class X NCERT library's D1–D4 buttons sent a generator
  // id as the subtopic; 8 of 14 chapters answered INDIA_TOPIC_NOT_FOUND. They
  // now name the chapter, every press serves that chapter at the nearest
  // authored rung to the one pressed, and a stale generator-id link resolves to
  // its chapter instead of refusing.
  const { NCERT_CLASS10_CONTENT } = await import('../src/engine/ncert/class10-content.js');
  const { class10LibraryPracticeHref, practiceRequestFromQuery, practiceHref, practiceDifficulties } = await import('../src/lib/practiceLinks.js');
  await premiumProfile({ name: 'Cert Library', course: 'in', indiaTrack: 'cbse', year: 10 });
  const refused = [], offChapter = [], offRung = [];
  for (const chapter of NCERT_CLASS10_CONTENT) {
    const rungs = new Set((IN_CHAPTER_BY_ID[chapter.id]?.covers || []).flatMap(c => c.diff || []));
    for (const d of practiceDifficulties({ track: 'cbse' })) {
      const href = class10LibraryPracticeHref(chapter, d);
      const r = await dispatch('POST', '/practice/next', practiceRequestFromQuery(new URL(href, 'https://x.invalid').searchParams)).catch(e => ({ error: e }));
      if (r.error) { refused.push(`${chapter.id}@D${d} ${r.error.code}`); continue; }
      const row = await idb.get('questions', r.question.id);
      if (row.india?.chapterId !== chapter.id) offChapter.push(`${chapter.id}@D${d}`);
      const held = Math.min(3, d); // CBSE practice is held to D1–D3 (adaptive-08)
      const gap = Math.min(...[...rungs].map(x => Math.abs(x - held)));
      if (Math.abs(row.difficulty - held) !== gap) offRung.push(`${chapter.id}@D${d}→D${row.difficulty}`);
      await dispatch('POST', `/practice/${r.question.id}/discard`, {});
    }
  }
  eq(refused.length, 0, `every Class X library button serves a question (refused: ${refused.slice(0, 4).join(', ')})`);
  eq(offChapter.length, 0, `every Class X library button serves its own chapter (${offChapter.slice(0, 4).join(', ')})`);
  eq(offRung.length, 0, `every Class X library button serves the nearest authored rung to the one pressed, held to the CBSE window (${offRung.slice(0, 4).join(', ')})`);
  for (const [gen, chapterId] of [['c10-polynomial-zeroes', 'c10-polynomials'], ['c10-linear-graphs', 'c10-pair-linear-equations'], ['c10-triangles-current', 'c10-triangles'], ['c10-surface-area-combo', 'c10-surface-volume']]) {
    const r = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: gen, track: 'cbse', difficulty: 2 }).catch(e => ({ error: e }));
    const row = r.question ? await idb.get('questions', r.question.id) : null;
    eq(row?.india?.chapterId, chapterId, `a stale generator-id link (${gen}) resolves to its chapter instead of INDIA_TOPIC_NOT_FOUND`);
    if (r.question) await dispatch('POST', `/practice/${r.question.id}/discard`, {});
  }
  {
    // Defence for links built before the D4 button was hidden (bookmarks,
    // shared links): the backend still holds them to D3 and says so.
    const r = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: 'c10-polynomials', track: 'cbse', difficulty: 4 });
    const row = await idb.get('questions', r.question.id);
    eq(row.difficulty, 3, 'a named D4 on a CBSE chapter is held to the CBSE window (adaptive-08)');
    ok(/You asked for D4; CBSE \/ NCERT practice is held to D1–D3/.test(r.why), `and the reply says so instead of moving it silently (${r.why})`);
    await dispatch('POST', `/practice/${r.question.id}/discard`, {});
  }
  // The link reader sends exactly what Practice always sent.
  const body = practiceRequestFromQuery(new URL(practiceHref({ subtopic: 'c10-polynomials', dotpoint: 1, difficulty: 3, track: 'cbse', pyq: true }), 'https://x.invalid').searchParams);
  eq(JSON.stringify(body), JSON.stringify({ mode: 'topic', subtopic: 'c10-polynomials', track: 'cbse', dotpoint: 1, difficulty: 3, pyqOnly: true }), 'a topic link reads back to the same request body');
  eq(JSON.stringify(practiceRequestFromQuery(new URLSearchParams(''))), JSON.stringify({ mode: 'smart' }), 'a bare /practice link is smart practice');
  const page = src('../src/pages/PracticeBase.jsx');
  ok(page.includes('practiceRequestFromQuery(params)'), 'Practice reads its topic/smart request through the shared reader');
  for (const [file, call] of [['../src/pages/Home.jsx', 'practiceHref('], ['../src/pages/IndiaProgress.jsx', 'indiaProgressPracticeHref('], ['../src/components/Class10NCERTLibrary.jsx', 'class10LibraryPracticeHref(']]) {
    ok(src(file).includes(call), `${file.split('/').pop()} builds its practice link through lib/practiceLinks.js`);
  }
}
{
  // Low #3: the repeat-window probe is sensitive. A server with the window
  // switched off fails it; the real backend passes it.
  const probes = cert.repeatProbes(enumeratePaths());
  ok(probes.length >= 1, `sensitive repeat-window probes exist (${probes.length})`);
  const off = await cert.certifyRepeatWindow(probes, {
    serve: async (probe, i) => ({ hash: generateQuestion(probe.generator, probe.difficulty, 9000 + i * 7919).contentHash, repeat: false })
  });
  ok(off.some(r => !r.ok), 'a server with no repeat window fails the probe');
  const live = await cert.certifyRepeatWindow(probes);
  ok(live.every(r => r.ok), `the live backend's repeat window passes the probe (${live.map(r => `${r.distinct}/${REPEAT_WINDOW}`).join(', ')})`);
}

{
  // drawDistinct precedence: fresh-and-accepted, then accepted (a repeat that
  // can spring the misconception being repaired), then fresh, then anything.
  const mk = (id, trap) => ({ prompt: `q${id}`, answerType: 'numeric', answer: { value: id }, trap });
  const seenHash = contentHashOf(mk(1, true));
  const r1 = drawDistinct(i => [mk(1, true), mk(2, false)][i % 2], [seenHash], { tries: 4, accept: q => q.trap });
  ok(r1.q.prompt === 'q1' && r1.accepted && r1.repeat, 'a misconception hunt keeps the only question that springs it, flagged as a repeat');
  const r2 = drawDistinct(i => mk(1 + i, i === 2), [], { tries: 4, accept: q => q.trap });
  ok(r2.q.prompt === 'q3' && !r2.repeat, 'a fresh question that springs it wins outright');
  const r3 = drawDistinct(() => mk(1, false), [seenHash], { tries: 3 });
  ok(r3.repeat && r3.q.prompt === 'q1', 'an exhausted pool returns a flagged repeat instead of spinning');
}

{
  // Coordinator decision: no CBSE surface offers D4; JEE tracks keep it.
  const { practiceDifficulties, practiceHref, class10LibraryPracticeHref } = await import('../src/lib/practiceLinks.js');
  const cbseContexts = [
    { track: 'cbse' }, { course: 'in', track: 'cbse', grade: 12 }, { course: 'in', grade: 7 },
    { course: 'in', track: 'jee-main', grade: 10 }, { course: 'in', track: 'cbse', grade: 10, ceiling: 3 }
  ];
  for (const ctx of cbseContexts) ok(!practiceDifficulties(ctx).includes(4), `no D4 offered to a CBSE context ${JSON.stringify(ctx)}`);
  for (const track of ['jee-main', 'jee-advanced']) ok(practiceDifficulties({ course: 'in', track, grade: 12 }).includes(4), `${track} keeps D4`);
  ok(practiceDifficulties({ course: 'au', track: null, grade: 10 }).includes(4), 'the NSW course keeps D4');
  ok(!/difficulty=4/.test(practiceHref({ subtopic: 'c10-polynomials', track: 'cbse', difficulty: 4 })), 'the shared builder never emits a CBSE D4 link');
  ok(/difficulty=4/.test(practiceHref({ subtopic: 'c12-integrals-methods', track: 'jee-advanced', difficulty: 4 })), 'a JEE D4 link is still built');
  const { NCERT_CLASS10_CONTENT } = await import('../src/engine/ncert/class10-content.js');
  const libLinks = NCERT_CLASS10_CONTENT.flatMap(c => practiceDifficulties({ track: 'cbse' }).map(d => class10LibraryPracticeHref(c, d)));
  ok(libLinks.length === NCERT_CLASS10_CONTENT.length * 3 && libLinks.every(h => !/difficulty=4/.test(h)), 'the Class X library renders D1–D3 links only');
  const library = src('../src/components/Class10NCERTLibrary.jsx');
  ok(library.includes("practiceDifficulties({track:'cbse'}).map(") && !library.includes('[1,2,3,4].map'), 'the Class X library buttons come from the shared CBSE difficulty list');
  const home = src('../src/pages/Home.jsx');
  ok(home.includes('offeredDifficulties.map(') && !/\[1, 2, 3, 4\]\.filter/.test(home), 'Home\'s difficulty picker offers only practiceDifficulties for the context');
  ok(home.includes('difficulty: chosenDifficulty'), 'a remembered D4 filter is not sent from a CBSE Home');
  ok(src('../src/pages/Tasks.jsx').includes('section?.difficultyCeiling || 3'), 'the Tasks difficulty picker stays within the section ceiling (D1–D3 for CBSE)');
  ok(!/difficulty/.test(src('../src/pages/IndiaProgress.jsx').match(/indiaProgressPracticeHref\([^)]*\)/)?.[0] || ''), 'India Progress links carry no difficulty');
}

// ── 5. Versioning gate ──────────────────────────────────────────────────────

{
  const committed = { contentVersion: '2026.10.0', generators: { a: '1', b: '2' } };
  ok(!compareDigests(committed, { a: '1', b: 'X' }, '2026.10.0').ok, 'a changed generator digest under an unchanged CONTENT_VERSION fails');
  ok(!compareDigests(committed, { a: '1' }, '2026.10.0').ok, 'a removed generator under an unchanged CONTENT_VERSION fails');
  ok(compareDigests(committed, { a: '1', b: 'X' }, '2026.11.0').ok, 'the same change passes once CONTENT_VERSION is bumped');
  ok(compareDigests(committed, { a: '1', b: '2', c: '3' }, '2026.10.0').ok, 'adding a generator does not require a version bump');
}

// ── 6. Enumeration covers the V1 launch scope ───────────────────────────────

{
  const paths = enumeratePaths();
  const grades = new Set(paths.filter(p => p.track === 'cbse').map(p => p.grade));
  eq([...grades].sort((a, b) => a - b).join(','), '7,8,9,10,11,12', 'CBSE paths cover Classes 7–12');
  ok(paths.some(p => p.track === 'jee-main' && p.grade === 11) && paths.some(p => p.track === 'jee-advanced' && p.grade === 12), 'JEE Main and JEE Advanced paths are enumerated');
  ok(!paths.some(p => p.track === 'olympiad'), 'the out-of-scope olympiad ladder is not enumerated as V1');
  const chapters = IN_CURRICULUM.flatMap(g => g.chapters);
  const dotpoints = chapters.reduce((n, c) => n + c.dotpoints.length, 0);
  eq(paths.filter(p => p.track === 'cbse' && p.dotpoint != null).length, dotpoints, 'every CBSE dot point is its own path');
  eq(paths.filter(p => p.track === 'cbse' && p.dotpoint == null && !p.pyqOnly).length, chapters.length, 'every CBSE chapter is its own path');
}

await online.close();
const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`CONTENT CERTIFICATION REGRESSIONS: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`CONTENT CERTIFICATION REGRESSIONS: PASS — ${pass}/${total} checks`);
