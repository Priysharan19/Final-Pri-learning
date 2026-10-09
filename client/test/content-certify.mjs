// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · V1 content runtime certification (doc §06)
//
// "Every advertised launch syllabus path reliably serves valid, versioned
// questions without empty crashes, broken assets or accidental duplicates."
//
// This tool enumerates every V1 launch path — every CBSE/NCERT chapter of
// Classes 7–12, every dot-point (subtopic) filter inside it, every difficulty
// of the track's window; the same for JEE Main and JEE Advanced in Classes 11
// and 12 together with the past-papers-only filter wherever an archive serves
// the chapter; and every India exam paper a V1 profile can compose — and for
// each one:
//
//   · resolves the target exactly as the app does (resolveIndiaTarget) and
//     generates seeded, deterministic questions with the real registry;
//   · validates the payload with the engine self-check's `inspect` — prompt,
//     answerType, answer key present AND round-tripped through the real
//     checkAnswer marker, hints, solution steps, MCQ integrity, text hygiene;
//   · renders every $…$ segment with KaTeX in throwing mode (the app renders
//     with throwOnError:false, so a parse error would reach the student as a
//     red error span rather than a crash — which is exactly why it is gated
//     here) and refuses unbalanced delimiters;
//   · checks every figure survives the figure sanitiser intact and that no
//     prompt points at a figure that is not attached;
//   · checks multipart structure (stem + ≥2 marked parts, each part inspected);
//   · checks a stable contentId + contentVersion + contentHash is present and
//     that the same seed reproduces the same item;
//   · simulates a sitting through the production repeat window (drawDistinct)
//     and counts repeats the pool could have avoided;
//   · checks the difficulty served is the one resolved, and records how often
//     a request was snapped to the nearest authored rung.
//
// Modes:
//   node client/test/content-certify.mjs            fast: fixed small sample per
//                                                   path (the CI gate)
//   node client/test/content-certify.mjs --full     full sample per path, plus
//                                                   writes docs/content/
//                                                   certification-report.{json,md}
//   --n=K           draws per (path, difficulty)
//   --write         write the report in any mode
//   --write-digest  refresh docs/content/content-digest.json (only legal when
//                   no existing generator digest changed, or CONTENT_VERSION
//                   was bumped)
//
// The olympiad ladder and every Australian (NSW) path are outside the V1
// release scope (docs/release/PRI_V1_RELEASE_SCOPE.md §6) and are not
// enumerated. Nothing here is a claim about syllabus completeness or source
// review — it certifies what the runtime serves, not what a human has audited.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import katex from 'katex';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const { inspect } = await import('../../server/test/selfcheck.mjs');
const { IN_CURRICULUM } = await import('../src/engine/curriculum-in.js');
const {
  indiaScope, indiaDifficultyWindow, resolveIndiaTarget, indiaChapterGrade, indiaRequestableDifficulties
} = await import('../src/engine/indiaProduct.js');
const { pyqCellsFor } = await import('../src/engine/pyq/pyqCoverage.js');
const { generateQuestion, loadAllBanks, loadBanksFor, bankOf, GENERATORS } = await import('../src/engine/generators/index.js');
const { makeRng } = await import('../src/engine/qhelpers.js');
const { sanitizeFigure } = await import('../src/lib/sanitize.js');
const {
  CONTENT_VERSION, contentDigest, contentHashOf, contentIdOf, drawDistinct
} = await import('../src/engine/contentIdentity.js');
const { indiaExamPaperSpec } = await import('../src/engine/indiaExams.js');

// The repeat window the backend keeps per sitting. Imported by value from the
// backend would need a browser environment; the number is pinned by the
// regression suite against the backend source instead.
export const REPEAT_WINDOW = 20;
export const DEDUP_TRIES = 32;

const V1_TRACKS = ['cbse', 'jee-main', 'jee-advanced'];

// ── Validation of one question ──────────────────────────────────────────────

const MATH_SPLIT = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;

/** Problems with the $…$ maths in one rendered string. */
export function latexProblems(text, where = 'text') {
  if (text == null || text === '') return [];
  const s = String(text);
  const out = [];
  const bare = s.replace(/\\\$/g, '');
  const count = (bare.match(/\$/g) || []).length;
  if (count % 2 === 1) out.push(`unbalanced $ delimiter in ${where}: ${s.slice(0, 100)}`);
  const parts = s.split(MATH_SPLIT);
  // A LaTeX command outside $…$ is shown to the student as raw source
  // ("\frac{1}{2}" instead of ½). Only the text segments are checked; an
  // escaped dollar (\$) is a literal rupee/dollar sign, not a command.
  // MathText (client/src/lib/latex.jsx) splits on single $…$ only, so a
  // display block $$…$$ renders with a stray "$" on each side.
  if (/(?<!\\)\$\$/.test(s)) out.push(`display $$…$$ is not rendered by MathText in ${where}: ${s.slice(0, 100)}`);
  if (count % 2 === 0) {
    // Display math ($$…$$) first, then inline $…$; whatever is left is text.
    const text = s.replace(/\\\$/g, '').replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$]*\$/g, ' ');
    for (const piece of [text]) {
      const cmd = piece.match(/\\[A-Za-z]+/);
      if (cmd) { out.push(`LaTeX command ${cmd[0]} outside $…$ in ${where}: ${s.slice(0, 100)}`); break; }
    }
  }
  // KaTeX warns on the console about glyphs it has no metrics for (₹ in text
  // mode). The browser renders those from the fallback font, so they are not
  // render failures; only a thrown ParseError is.
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (let i = 1; i < parts.length; i += 2) {
      try {
        katex.renderToString(parts[i], { throwOnError: true, strict: false });
      } catch (err) {
        out.push(`KaTeX cannot render ${where}: $${parts[i].slice(0, 80)}$ — ${String(err.message || err).split('\n')[0].slice(0, 120)}`);
      }
    }
  } finally { console.warn = warn; }
  return out;
}

/** Every string a student can be shown for a payload, with where it lives. */
function renderedStrings(q) {
  const out = [];
  const add = (where, v) => { if (typeof v === 'string' && v) out.push([where, v]); };
  add('prompt', q.prompt);
  add('stem', q.stem);
  add('solutionText', q.solutionText);
  (q.steps || []).forEach((s, i) => { add(`step ${i + 1}`, s?.h); add(`step ${i + 1}`, s?.d); });
  (q.hints || []).forEach((h, i) => add(`hint ${i + 1}`, h));
  (q.mcqOptions || []).forEach((o, i) => add(`option ${i}`, o));
  (q.parts || []).forEach((p, i) => {
    add(`part ${i + 1} prompt`, p?.prompt);
    (p?.steps || []).forEach((s, j) => { add(`part ${i + 1} step ${j + 1}`, s?.h); add(`part ${i + 1} step ${j + 1}`, s?.d); });
    (p?.hints || []).forEach((h, j) => add(`part ${i + 1} hint ${j + 1}`, h));
    (p?.mcqOptions || []).forEach((o, j) => add(`part ${i + 1} option ${j}`, o));
  });
  return out;
}

const FIGURE_REFERENCE = /\b(?:(?:figure|diagram|graph|picture|drawing)\s+(?:below|above|shown|given)|(?:shown|drawn|given)\s+in\s+the\s+(?:figure|diagram)|in the (?:figure|diagram)\b)/i;
const TAGS = s => (String(s).match(/<\s*[A-Za-z][\w:-]*/g) || []).length;

/** Problems with the figure(s) a payload carries or refers to. */
export function figureProblems(q) {
  const out = [];
  const check = (fig, where) => {
    if (fig == null || fig === '') return;
    if (typeof fig !== 'string') { out.push(`${where} figure is not markup (${typeof fig})`); return; }
    const clean = sanitizeFigure(fig);
    if (!clean) { out.push(`${where} figure is removed entirely by the figure sanitiser`); return; }
    const lost = TAGS(fig) - TAGS(clean);
    if (lost > 0) out.push(`${where} figure loses ${lost} element(s) to the figure sanitiser`);
  };
  check(q.figure, 'question');
  (q.parts || []).forEach((p, i) => check(p?.figure, `part ${i + 1}`));
  const hasFigure = !!(q.figure || (q.parts || []).some(p => p?.figure) || q.plot || q.table);
  const texts = [q.prompt, q.stem, ...(q.parts || []).map(p => p?.prompt)].filter(Boolean).join(' ');
  if (!hasFigure && FIGURE_REFERENCE.test(texts)) out.push(`prompt refers to a figure but none is attached: ${texts.slice(0, 100)}`);
  return out;
}

/** Problems with the identity stamp of a served item. */
export function identityProblems(q, generatorId) {
  const out = [];
  if (!q.contentId) out.push('no contentId');
  else if (q.contentId !== contentIdOf(q, generatorId)) out.push(`contentId ${q.contentId} does not match its generator/seed`);
  if (!q.contentVersion) out.push('no contentVersion');
  else if (q.contentVersion !== CONTENT_VERSION) out.push(`contentVersion ${q.contentVersion} is not the current ${CONTENT_VERSION}`);
  if (!q.contentHash) out.push('no contentHash');
  else if (q.contentHash !== contentHashOf(q)) out.push('contentHash does not match the served content');
  return out;
}

/** Everything wrong with one served payload. Empty means certified. */
export function certifyQuestion(q, { generatorId = q?.subtopic, identity = true } = {}) {
  if (!q || typeof q !== 'object') return ['generator returned no question'];
  const problems = [];
  if (q.multipart || Array.isArray(q.parts)) {
    if (!q.stem) problems.push('multipart without stem');
    if (!Array.isArray(q.parts) || q.parts.length < 2) problems.push('multipart needs 2+ parts');
    for (const part of q.parts || []) {
      const p = inspect({
        prompt: part.prompt, answerType: part.answerType, answer: part.answer,
        mcqOptions: part.mcqOptions, steps: part.steps, hints: part.hints ?? [],
        answerSuffix: part.answerSuffix, answerPrefix: part.answerPrefix, traps: part.traps
      });
      if (!part.marks || part.marks < 1) p.push('no marks');
      problems.push(...p.map(x => `part ${part.key ?? '?'}: ${x}`));
    }
  } else if (q.answerType === 'multi-mcq') {
    // Exam-only multiple-correct item, marked by markMultiCorrect rather than
    // checkAnswer: its key is a set of option indices.
    const opts = Array.isArray(q.mcqOptions) ? q.mcqOptions.map(o => String(o).trim()) : [];
    const keyed = Array.isArray(q.answer?.correctIndices) ? q.answer.correctIndices : [];
    if (!q.prompt) problems.push('no prompt');
    if (opts.length < 4 || new Set(opts).size !== opts.length) problems.push('multiple-correct item needs 4+ distinct options');
    if (!keyed.length || keyed.some(i => !Number.isInteger(i) || i < 0 || i >= opts.length)) problems.push('multiple-correct key names no valid option');
    if (!Array.isArray(q.steps) || !q.steps.length) problems.push('no steps');
  } else {
    problems.push(...inspect(q));
  }
  for (const [where, text] of renderedStrings(q)) problems.push(...latexProblems(text, where));
  problems.push(...figureProblems(q));
  if (identity) problems.push(...identityProblems(q, generatorId));
  return problems;
}

// ── Path enumeration ────────────────────────────────────────────────────────

function windowList(track, grade) {
  const { floor, ceiling } = indiaDifficultyWindow(track, grade);
  const out = [];
  for (let d = floor; d <= ceiling; d++) out.push(d);
  return out;
}

/**
 * Every V1 launch path: { id, track, grade, chapterId, dotpoint, pyqOnly,
 * difficulties, advertised }. A dot point is advertised when the curriculum
 * response marks it generated (an authored form at any difficulty) — the same
 * rule Home uses to enable it.
 */
export function enumeratePaths() {
  const paths = [];
  const push = (p) => paths.push(p);
  for (const group of IN_CURRICULUM) {
    const grade = group.grade;
    for (const chapter of group.chapters) {
      const base = { track: 'cbse', grade, chapterId: chapter.id, chapterName: chapter.name };
      push({ ...base, id: `cbse/${grade}/${chapter.id}`, dotpoint: null, pyqOnly: false, difficulties: windowList('cbse', grade), advertised: true });
      chapter.dotpoints.forEach((_, i) => {
        const generated = (chapter.covers || []).some(c => c.dp.includes(i) && (c.diff || []).length > 0);
        push({ ...base, id: `cbse/${grade}/${chapter.id}#${i + 1}`, dotpoint: i, pyqOnly: false, difficulties: windowList('cbse', grade), advertised: generated });
      });
      if (pyqCellsFor('cbse', chapter.id).length) {
        push({ ...base, id: `cbse/${grade}/${chapter.id}?pyq`, dotpoint: null, pyqOnly: true, difficulties: windowList('cbse', grade), advertised: true });
      }
    }
  }
  for (const track of ['jee-main', 'jee-advanced']) {
    for (const grade of [11, 12]) {
      for (const chapter of indiaScope(track, grade)) {
        const base = { track, grade, chapterId: chapter.id, chapterName: chapter.name };
        push({ ...base, id: `${track}/${grade}/${chapter.id}`, dotpoint: null, pyqOnly: false, difficulties: windowList(track, grade), advertised: true });
        chapter.dotpoints.forEach((_, i) => {
          const generated = (chapter.covers || []).some(c => c.dp.includes(i) && (c.diff || []).length > 0);
          push({ ...base, id: `${track}/${grade}/${chapter.id}#${i + 1}`, dotpoint: i, pyqOnly: false, difficulties: windowList(track, grade), advertised: generated });
        });
        if (pyqCellsFor(track, chapter.id).length) {
          push({ ...base, id: `${track}/${grade}/${chapter.id}?pyq`, dotpoint: null, pyqOnly: true, difficulties: windowList(track, grade), advertised: true });
        }
      }
    }
  }
  return paths;
}

const seedFor = (key, i) => (parseInt(contentDigest(`${key}#${i}`).slice(0, 8), 16) & 0x7fffffff) || 1;

/** Load every bank a set of paths can reach, including the reviewed JEE PYQ chunks. */
export async function loadBanksForPaths(paths) {
  await loadAllBanks();
  const gens = new Set();
  for (const p of paths) {
    const chapter = IN_CURRICULUM.flatMap(g => g.chapters).find(c => c.id === p.chapterId);
    for (const c of chapter?.covers || []) gens.add(c.gen);
    if (p.track !== 'cbse') gens.add(`${p.track}-${p.chapterId}`);
    gens.add(`pyq-${p.track}-${p.chapterId}`);
  }
  await loadBanksFor([...gens].filter(id => bankOf(id)));
}

const chapterById = id => IN_CURRICULUM.flatMap(g => g.chapters).find(c => c.id === id);

/**
 * Certify one path at N draws per difficulty. Returns a result row; `failures`
 * holds grouped problem sentences with counts and one example seed each.
 */
export function certifyPath(p, n, { draw = generateQuestion } = {}) {
  const chapter = chapterById(p.chapterId);
  const row = {
    id: p.id, track: p.track, grade: p.grade, chapterId: p.chapterId, dotpoint: p.dotpoint, pyqOnly: p.pyqOnly,
    advertised: p.advertised, served: 0, failed: 0, empty: 0, difficultySnapped: 0, difficultyBelowWindow: 0,
    difficultyMismatch: 0, repeatsAvoidable: 0, repeatsExhausted: 0, distinct: 0, generators: [], failures: {}
  };
  const gens = new Set();
  const hashes = new Set();
  const note = (problem, seed) => {
    const key = problem.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 200);
    const f = row.failures[key] || (row.failures[key] = { count: 0, example: problem.slice(0, 300), seed });
    f.count++;
  };
  for (const d of p.difficulties) {
    // A sitting on this path: the production repeat window over N draws.
    const recent = [];
    const pool = new Set();
    for (let i = 0; i < n; i++) {
      const seed = seedFor(`${p.id}@${d}`, i);
      const rng = makeRng(seed);
      const target = resolveIndiaTarget(chapter, {
        dotpoint: p.dotpoint, difficulty: d, track: p.track, grade: p.grade, pyqOnly: p.pyqOnly, random: rng
      });
      if (!target) { row.empty++; continue; }
      // The backend retries a colliding draw by re-resolving the target, so a
      // chapter-level request can leave a small cell for a fresh one.
      const targetOf = new Map();
      let picked;
      try {
        picked = drawDistinct(k => {
          const t = k === 0 ? target : (resolveIndiaTarget(chapter, {
            dotpoint: p.dotpoint, difficulty: d, track: p.track, grade: p.grade, pyqOnly: p.pyqOnly,
            random: makeRng(seedFor(`${p.id}@${d}#target${i}`, k))
          }) || target);
          const cand = draw(t.generator, t.difficulty, seedFor(`${p.id}@${d}#draw${i}`, k));
          if (cand?.contentHash) pool.add(cand.contentHash);
          targetOf.set(cand, t);
          return cand;
        }, recent, { tries: DEDUP_TRIES });
      } catch (err) {
        row.failed++; row.served++;
        note(`generation threw: ${err.message}`, seed);
        continue;
      }
      const q = picked.q;
      const used = targetOf.get(q) || target;
      row.served++;
      gens.add(used.generator);
      if (used.difficulty !== d) row.difficultySnapped++;
      if (used.windowed === false) row.difficultyBelowWindow++;
      if (Number(q.difficulty) !== Number(used.difficulty)) row.difficultyMismatch++;
      const problems = certifyQuestion(q, { generatorId: used.generator });
      // Determinism: the same seed must reproduce the same item.
      try {
        const again = draw(used.generator, used.difficulty, q.seed);
        if (again.contentHash !== q.contentHash || again.contentId !== q.contentId) problems.push('the same seed does not reproduce the same question');
      } catch (err) { problems.push(`regeneration threw: ${err.message}`); }
      if (problems.length) { row.failed++; for (const pr of problems) note(pr, q.seed); }
      if (picked.repeat) {
        // A repeat is a defect only when the pool is demonstrably large: at
        // least twice the window has been met on this path, so at most half
        // of it is blocked and DEDUP_TRIES draws all colliding has odds below
        // 2^-32. A smaller pool (three past-paper questions, a two-form dot
        // point) is exhausted, not broken — the student is told it repeats.
        if (pool.size >= 2 * REPEAT_WINDOW) row.repeatsAvoidable++;
        else row.repeatsExhausted++;
      }
      hashes.add(q.contentHash);
      recent.unshift(q.contentHash);
      if (recent.length > REPEAT_WINDOW) recent.length = REPEAT_WINDOW;
    }
  }
  row.distinct = hashes.size;
  row.generators = [...gens].sort();
  row.pass = row.failed === 0 && row.empty === 0 && row.difficultyMismatch === 0 && row.repeatsAvoidable === 0;
  if (!row.pass && !p.advertised && row.failed === 0 && row.difficultyMismatch === 0) row.pass = true; // unadvertised: empty is the declared state
  return row;
}

// ── Generator cells ─────────────────────────────────────────────────────────

/**
 * Every (generator, difficulty) cell a V1 path can reach, at all four rungs —
 * including rungs outside today's track windows, because a window change or a
 * retargeted dot point would put them in front of a student without anyone
 * touching the generator. Returns one row per cell.
 */
export function certifyGeneratorCells(generatorIds, n) {
  const rows = [];
  for (const id of [...generatorIds].sort()) {
    if (!GENERATORS[id]) continue;
    for (let d = 1; d <= 4; d++) {
      const row = { id: `${id}@D${d}`, served: 0, failed: 0, failures: {} };
      for (let i = 0; i < n; i++) {
        const seed = seedFor(`cell:${id}:${d}`, i);
        let problems;
        try { problems = certifyQuestion(generateQuestion(id, d, seed), { generatorId: id }); }
        catch (err) { problems = [`generation threw: ${err.message}`]; }
        row.served++;
        if (problems.length) {
          row.failed++;
          for (const pr of problems) {
            const key = pr.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 200);
            const f = row.failures[key] || (row.failures[key] = { count: 0, example: pr.slice(0, 300), seed });
            f.count++;
          }
        }
      }
      row.pass = row.failed === 0;
      rows.push(row);
    }
  }
  return rows;
}

// ── Exam composition ────────────────────────────────────────────────────────

export const V1_EXAMS = [
  { track: 'cbse', grade: 10, variant: 'standard' },
  { track: 'cbse', grade: 10, variant: 'basic' },
  { track: 'cbse', grade: 11, variant: 'standard' },
  { track: 'cbse', grade: 12, variant: 'standard' },
  { track: 'jee-main', grade: 11, variant: 'standard' },
  { track: 'jee-main', grade: 12, variant: 'standard' },
  { track: 'jee-advanced', grade: 11, variant: 'standard' },
  { track: 'jee-advanced', grade: 12, variant: 'standard' }
];

/**
 * Every problem with the items of one composed paper: each item certified, each
 * carrying an exam content identity whose hash matches what is shown, and no
 * item appearing twice. Returns only the items that have problems.
 */
export function paperProblems(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const problems = certifyQuestion(item, { identity: false });
    if (!item?.contentId || !item?.contentVersion || !item?.contentHash) problems.push('exam item carries no content identity');
    else if (item.contentHash !== contentHashOf(item)) problems.push('exam item contentHash does not match the served content');
    const h = contentHashOf(item);
    if (seen.has(h)) problems.push('the same question appears twice in one paper');
    seen.add(h);
    if (problems.length) out.push({ item, problems });
  }
  return out;
}

/**
 * Compose real papers through the local exam backend and certify every item.
 * `seeds` papers per selection. Needs the browser shim from backend-check.
 */
export async function certifyExams(seeds) {
  const { installBrowserEnv } = await import('./backend-check.mjs');
  installBrowserEnv();
  const { dispatch } = await import('../src/local/backend.js');
  const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
  const idb = await import('../src/local/idb.js');
  const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
  const rows = [];
  for (const sel of V1_EXAMS) {
    const spec = indiaExamPaperSpec(sel);
    const row = { id: `exam/${sel.track}/${sel.grade}/${sel.variant}`, ...sel, papers: 0, questions: 0, failed: 0, duplicatesInPaper: 0, unidentified: 0, failures: {}, released: !!spec };
    if (!spec) { row.pass = true; row.note = 'no released blueprint for this selection — the exam page states INDIA_EXAM_NOT_RELEASED'; rows.push(row); continue; }
    const created = await dispatch('POST', '/profiles', { name: `Cert ${sel.track} ${sel.grade}`, course: 'in', indiaTrack: sel.track, year: sel.grade });
    const user = created.user;
    const now = Date.now();
    await idb.put('device', {
      id: cloudLinkRowId(user.id), accountId: `acct-${user.id}`, role: 'student', emailVerified: true,
      linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
      entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * 86400000, offlineUntil: now + 7 * 86400000, issuedAt: now, sourceVersion: 1 }
    });
    for (let s = 0; s < seeds; s++) {
      const seed = seedFor(row.id, s);
      let exam;
      try {
        exam = (await dispatchIndiaExam(user, 'POST', '/exams', { variant: sel.variant, seed })).exam;
      } catch (err) {
        row.failed++;
        const key = `composition threw: ${err.code || ''} ${err.message}`.slice(0, 200);
        row.failures[key] = { count: (row.failures[key]?.count || 0) + 1, example: key, seed };
        continue;
      }
      row.papers++;
      const stored = await idb.get('exams', exam.id);
      const items = [];
      for (const qid of stored.questionIds) items.push((await idb.get('questions', qid)).payload);
      row.questions += items.length;
      for (const { item, problems } of paperProblems(items)) {
        if (problems.some(pr => pr.startsWith('exam item carries no content identity'))) row.unidentified++;
        if (problems.includes('the same question appears twice in one paper')) row.duplicatesInPaper++;
        row.failed++;
        for (const pr of problems) {
          const key = pr.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 200);
          const f = row.failures[key] || (row.failures[key] = { count: 0, example: `${item.subtopic}: ${pr}`.slice(0, 300), seed });
          f.count++;
        }
      }
      if (stored.questionIds.length === 0) { row.failed++; row.failures['empty paper'] = { count: 1, example: 'paper composed with no questions', seed }; }
    }
    row.pass = row.failed === 0 && row.papers === seeds;
    rows.push(row);
  }
  return rows;
}

// ── End to end through the local backend ────────────────────────────────────

// Questions are chosen, issued and marked by the server (owner decisions
// 2026-10-10), so "end to end" runs against the real /v1 app: every profile is
// a real verified account. A suite that imports this module and already runs
// an authority shares it; run on its own, this module boots one and closes it.
let ownAuthority = null;
async function suiteAuthority() {
  const support = await import('./support/online-authority.mjs');
  const running = support.currentOnlineAuthority();
  if (running) return running;
  ownAuthority = await support.startOnlineAuthority({ label: 'content-certify' });
  return ownAuthority;
}
async function closeOwnAuthority() {
  if (ownAuthority) { const mine = ownAuthority; ownAuthority = null; await mine.close(); }
}

async function premiumProfile(spec) {
  const online = await suiteAuthority();
  const { dispatch } = await import('../src/local/backend.js');
  const created = await dispatch('POST', '/profiles', spec);
  await online.link(created.user.id, { entitlement: 'premium' });
  return created.user;
}

/**
 * Whether a request that names D`asked` must be served (true) or refused
 * (false): it is served exactly when an authored form sits at that level
 * inside the track's window for the chapter or dot point — the engine's own
 * indiaRequestableDifficulties, which is also what the picker offers.
 */
function exactLevel(p, asked) {
  return indiaRequestableDifficulties(chapterById(p.chapterId), { dotpoint: p.dotpoint, track: p.track, grade: p.grade ?? 10 }).includes(asked);
}

/**
 * Every advertised path requested the way a button requests it — the link is
 * built by the same builder the surface uses (lib/practiceLinks.js), read back
 * by the same reader Practice uses, and sent as POST /practice/next on a
 * profile of that track and class — once without a difficulty and once per
 * difficulty of the window. The resolver, entitlement gate, repeat window, row
 * write and the sanitised reply are all in the loop. A refusal, a reply the
 * card cannot render, a stored row without content identity, a question from
 * another chapter, or one served at any level other than the one asked for
 * fails the request; a level with no authored form must be refused.
 *
 * Then every other surface that builds a practice link: the Class X NCERT
 * library's D1–D4 buttons and India Progress's per-chapter button, plus smart
 * practice per track and class with and without the past-papers filter.
 */
export async function certifyBackend(paths, { surfaces = true } = {}) {
  const { installBrowserEnv } = await import('./backend-check.mjs');
  installBrowserEnv();
  const { dispatch } = await import('../src/local/backend.js');
  const idb = await import('../src/local/idb.js');
  const { practiceHref, practiceRequestFromQuery, class10LibraryPracticeHref, indiaProgressPracticeHref, practiceDifficulties } = await import('../src/lib/practiceLinks.js');
  const profiles = new Map();
  let current = null;
  const use = async (track, grade) => {
    const key = `${track}/${grade}`;
    if (!profiles.has(key)) profiles.set(key, await premiumProfile({ name: `Cert ${key}`, course: 'in', indiaTrack: track, year: grade }));
    else if (current !== key) await dispatch('POST', '/profiles/select', { id: profiles.get(key).id });
    current = key;
  };
  const rows = [];
  const send = async (id, href, expect = {}) => {
    const row = { id, href, ok: false, problem: null };
    try {
      const body = practiceRequestFromQuery(new URL(href, 'https://pri.invalid').searchParams);
      const r = await dispatch('POST', '/practice/next', body);
      const q = r?.question;
      const stored = q?.id ? await idb.get('questions', q.id) : null;
      const payload = stored?.payload;
      // The device holds the server's public question: identity fields but no
      // answer. The identity is checked against the server's own sealed copy
      // of the question it issued — the hash must be the hash of THAT content.
      const sealed = stored?.serverQuestionId ? await (await suiteAuthority()).answerKey(stored) : null;
      if (!q?.id || !(q.prompt || q.stem)) row.problem = 'reply carries no renderable question';
      else if (!stored.serverQuestionId) row.problem = 'the question was not issued by the server';
      else if ('answer' in payload || 'seed' in payload || 'steps' in payload) row.problem = 'the device was handed the answer, the solution or the seed';
      else if (!payload?.contentId || !payload?.contentVersion || payload.contentId !== sealed.contentId || payload.contentVersion !== sealed.contentVersion
        || payload.contentHash !== contentHashOf(sealed)) row.problem = 'stored question has no valid content identity';
      else if (expect.chapterId && stored.india?.chapterId !== expect.chapterId) row.problem = `served under ${stored.india?.chapterId}, not ${expect.chapterId}`;
      else if (expect.pyq && !payload.pyq) row.problem = 'past-papers-only served an authored question';
      // A named difficulty is served at exactly that level or refused (issue
      // #408): never at the nearest authored one.
      else if (expect.difficulty != null && expect.exact === false) row.problem = `D${expect.difficulty} has no authored form here, yet D${stored.difficulty} was served instead of a refusal`;
      else if (expect.difficulty != null && Number(stored.difficulty) !== expect.difficulty) row.problem = `asked for D${expect.difficulty}, served D${stored.difficulty}`;
      else if (expect.difficulty != null && Number(q.difficulty) !== Number(stored.difficulty)) row.problem = 'the card shows a different difficulty from the stored question';
      else row.ok = true;
      if (q?.id) await dispatch('POST', `/practice/${q.id}/discard`, {}).catch(() => {});
    } catch (err) {
      if (expect.refusal && err.code === expect.refusal) row.ok = true;
      // The declared answer to a level with no authored form: a refusal that
      // names the level and lists the levels that exist — never the level
      // itself, and none when the picker would have offered it.
      else if (expect.difficulty != null && expect.exact !== true && err.code === 'DIFFICULTY_UNAVAILABLE'
        && err.detail?.difficultyRequested === expect.difficulty && Array.isArray(err.detail.available)
        && !err.detail.available.some(a => a.difficulty === expect.difficulty)) row.ok = true;
      else row.problem = `refused: ${err.code || err.status || ''} ${err.message}`.slice(0, 200);
    }
    rows.push(row);
    return row;
  };

  for (const p of paths.filter(x => x.advertised)) {
    await use(p.track, p.grade);
    const base = { subtopic: p.chapterId, dotpoint: p.dotpoint, track: p.track, pyq: p.pyqOnly };
    await send(p.id, practiceHref(base), { chapterId: p.chapterId, pyq: p.pyqOnly });
    for (const d of p.difficulties) {
      await send(`${p.id}@D${d}`, practiceHref({ ...base, difficulty: d }), { chapterId: p.chapterId, pyq: p.pyqOnly, difficulty: d, exact: p.pyqOnly ? null : exactLevel(p, d) });
    }
  }
  if (!surfaces) return rows;

  // The Class X NCERT library (Classes page): one button per difficulty it
  // offers a CBSE student — D1–D3, since CBSE practice is held to D1–D3.
  const { NCERT_CLASS10_CONTENT } = await import('../src/engine/ncert/class10-content.js');
  await use('cbse', 10);
  const libraryRungs = practiceDifficulties({ track: 'cbse' });
  const cbseWindow = indiaDifficultyWindow('cbse', 10);
  rows.push({ id: 'surface/class10-library/offered-difficulties', ok: libraryRungs.every(d => d >= cbseWindow.floor && d <= cbseWindow.ceiling), problem: `offers D${libraryRungs.join('/D')} outside the CBSE window` });
  for (const chapter of NCERT_CLASS10_CONTENT) {
    for (const d of libraryRungs) {
      const p = { chapterId: chapter.id, dotpoint: null, track: 'cbse', grade: 10 };
      await send(`surface/class10-library/${chapter.id}@D${d}`, class10LibraryPracticeHref(chapter, d), { chapterId: chapter.id, difficulty: d, exact: exactLevel(p, d) });
    }
  }
  // India Progress: one Practise button per chapter of the student's scope.
  const scopes = [...new Set(paths.map(p => `${p.track}/${p.grade}`))];
  for (const key of scopes) {
    const [track, gradeText] = key.split('/');
    const grade = Number(gradeText);
    await use(track, grade);
    for (const chapter of indiaScope(track, grade)) {
      await send(`surface/india-progress/${key}/${chapter.id}`, indiaProgressPracticeHref(chapter, track), { chapterId: chapter.id });
    }
    // Smart practice with and without the past-papers filter. Under the
    // filter, a class whose archive is empty must say so with
    // INDIA_PYQ_UNAVAILABLE (rendered with its "turn the filter off" action).
    const archived = paths.some(p => p.track === track && p.grade === grade && p.pyqOnly);
    for (const pyq of [false, true]) {
      for (let i = 0; i < 3; i++) {
        await send(`${key}/smart${pyq ? '?pyq' : ''}#${i + 1}`, practiceHref({ track, pyq }), { pyq, refusal: pyq && !archived ? 'INDIA_PYQ_UNAVAILABLE' : null });
      }
    }
  }
  return rows;
}

// ── Repeat-window probe ─────────────────────────────────────────────────────

/**
 * Cells whose pool is small enough that 20 draws WITHOUT a repeat window almost
 * surely repeat (the probe is sensitive) but at least 1.5× the window, so the
 * window can always find a fresh item. One generator at one rung behind one
 * CBSE dot point, so the backend cannot dilute the probe by switching forms.
 */
export function repeatProbes(paths, { limit = 3 } = {}) {
  const out = [];
  for (const p of paths) {
    if (p.track !== 'cbse' || p.dotpoint == null || !p.advertised) continue;
    const chapter = chapterById(p.chapterId);
    for (const d of p.difficulties) {
      const cells = (chapter.covers || []).filter(c => c.dp.includes(p.dotpoint) && (c.diff || []).includes(d));
      if (cells.length !== 1) continue;
      const others = (chapter.covers || []).filter(c => c.dp.includes(p.dotpoint)).flatMap(c => c.diff || []);
      if (others.some(x => x !== d && Math.abs(x - d) === 0)) continue;
      const gen = cells[0].gen;
      const seen = new Set();
      for (let i = 0; i < 1500; i++) seen.add(generateQuestion(gen, d, seedFor(`probe:${gen}:${d}`, i)).contentHash);
      const pool = seen.size;
      if (pool < 1.5 * REPEAT_WINDOW || pool > 3 * REPEAT_WINDOW) continue;
      // Sensitivity: the same 20 seeded draws without the window must repeat.
      const raw = new Set();
      for (let i = 0; i < REPEAT_WINDOW; i++) raw.add(generateQuestion(gen, d, seedFor(`probe-raw:${gen}:${d}`, i)).contentHash);
      if (raw.size === REPEAT_WINDOW) continue;
      out.push({ path: p, difficulty: d, generator: gen, pool });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Serve REPEAT_WINDOW questions in a row on each probe and require them all
 * distinct and none flagged as a repeat. `serve(probe)` returns the next
 * question; by default it is the real backend through POST /practice/next.
 */
export async function certifyRepeatWindow(probes, { serve = null } = {}) {
  let next = serve;
  if (!next) {
    const { installBrowserEnv } = await import('./backend-check.mjs');
    installBrowserEnv();
    const { dispatch } = await import('../src/local/backend.js');
    const idb = await import('../src/local/idb.js');
    const { practiceHref, practiceRequestFromQuery } = await import('../src/lib/practiceLinks.js');
    const made = new Map();
    next = async probe => {
      const key = `${probe.path.id}@${probe.difficulty}`;
      if (!made.has(key)) { made.set(key, true); await premiumProfile({ name: `Probe ${made.size}`, course: 'in', indiaTrack: 'cbse', year: probe.path.grade }); }
      const href = practiceHref({ subtopic: probe.path.chapterId, dotpoint: probe.path.dotpoint, difficulty: probe.difficulty, track: 'cbse' });
      const r = await dispatch('POST', '/practice/next', practiceRequestFromQuery(new URL(href, 'https://pri.invalid').searchParams));
      const stored = await idb.get('questions', r.question.id);
      await dispatch('POST', `/practice/${r.question.id}/discard`, {}).catch(() => {});
      return { hash: stored.payload.contentHash, repeat: !!r.repeat };
    };
  }
  const rows = [];
  for (const probe of probes) {
    const hashes = [];
    let flagged = 0;
    for (let i = 0; i < REPEAT_WINDOW; i++) {
      const got = await next(probe, i);
      hashes.push(got.hash);
      if (got.repeat) flagged++;
    }
    const distinct = new Set(hashes).size;
    rows.push({ id: `${probe.path.id}@D${probe.difficulty}`, pool: probe.pool, distinct, flagged, ok: distinct === REPEAT_WINDOW && flagged === 0 });
  }
  return rows;
}

// ── Content digest (versioning gate) ────────────────────────────────────────

const DIGEST_FILE = path.join(ROOT, 'docs/content/content-digest.json');
const DIGEST_DRAWS = 6;

/**
 * One digest per V1 generator: the content hashes of fixed seeds at every
 * difficulty. A changed digest means the same (generator, difficulty, seed)
 * now produces a different item — old contentIds no longer reproduce, so
 * CONTENT_VERSION must move.
 */
export function generatorDigests(generatorIds) {
  const out = {};
  for (const id of [...generatorIds].sort()) {
    if (!GENERATORS[id]) continue;
    const parts = [];
    for (let d = 1; d <= 4; d++) {
      for (let i = 0; i < DIGEST_DRAWS; i++) {
        try { parts.push(generateQuestion(id, d, seedFor(`digest:${id}:${d}`, i)).contentHash); }
        catch (err) { parts.push(`error:${err.message}`); }
      }
    }
    out[id] = contentDigest(parts.join('|'));
  }
  return out;
}

export function compareDigests(committed, current, version) {
  const changed = [], removed = [], added = [];
  const old = committed?.generators || {};
  for (const [id, h] of Object.entries(old)) {
    if (!(id in current)) removed.push(id);
    else if (current[id] !== h) changed.push(id);
  }
  for (const id of Object.keys(current)) if (!(id in old)) added.push(id);
  const versionMoved = committed?.contentVersion !== version;
  return { changed, removed, added, versionMoved, ok: versionMoved || (!changed.length && !removed.length) };
}

// ── Report ──────────────────────────────────────────────────────────────────

function summarise(paths, exams, { mode, n, examSeeds }) {
  const by = (pred) => paths.filter(pred).length;
  const scope = {};
  for (const r of paths) {
    const k = `${r.track} · Class ${r.grade}`;
    const s = scope[k] || (scope[k] = { paths: 0, passed: 0, served: 0, chapters: new Set() });
    s.paths++; if (r.pass) s.passed++; s.served += r.served; s.chapters.add(r.chapterId);
  }
  for (const s of Object.values(scope)) s.chapters = s.chapters.size;
  return {
    contentVersion: CONTENT_VERSION,
    mode, drawsPerDifficulty: n, examSeeds,
    paths: paths.length,
    advertisedPaths: by(r => r.advertised),
    passed: by(r => r.pass),
    failed: by(r => !r.pass),
    questionsServed: paths.reduce((s, r) => s + r.served, 0),
    questionsFailed: paths.reduce((s, r) => s + r.failed, 0),
    emptyAdvertisedPaths: by(r => r.advertised && r.empty > 0),
    unadvertisedEmptyPaths: by(r => !r.advertised && r.empty > 0),
    difficultySnapped: paths.reduce((s, r) => s + r.difficultySnapped, 0),
    difficultyBelowWindow: paths.reduce((s, r) => s + r.difficultyBelowWindow, 0),
    difficultyMismatch: paths.reduce((s, r) => s + r.difficultyMismatch, 0),
    repeatsAvoidable: paths.reduce((s, r) => s + r.repeatsAvoidable, 0),
    repeatsExhausted: paths.reduce((s, r) => s + r.repeatsExhausted, 0),
    lowVarietyPaths: by(r => r.served >= 4 && r.distinct <= 2),
    exams: {
      selections: exams.length,
      released: exams.filter(e => e.released).length,
      papers: exams.reduce((s, e) => s + e.papers, 0),
      questions: exams.reduce((s, e) => s + e.questions, 0),
      failed: exams.reduce((s, e) => s + e.failed, 0),
      duplicatesInPaper: exams.reduce((s, e) => s + e.duplicatesInPaper, 0),
      passed: exams.filter(e => e.pass).length
    },
    byScope: scope
  };
}

function markdown(report) {
  const s = report.summary;
  const lines = [];
  lines.push('# V1 content runtime certification');
  lines.push('');
  lines.push('Generated by `npm run content:certify` (`client/test/content-certify.mjs --full`). Do not edit by hand.');
  lines.push('');
  lines.push('This report certifies what the **runtime serves** on every V1 launch path (CBSE/NCERT Classes 7–12, JEE Main, JEE Advanced) — schema, marker round-trip, LaTeX rendering, figures, identity/versioning, repeat prevention and difficulty. It is **not** a claim of syllabus completeness or of human source review: the human question-bank audit is separate and remains outstanding.');
  lines.push('');
  lines.push(`- Content version: \`${s.contentVersion}\``);
  lines.push(`- Mode: ${s.mode}, ${s.drawsPerDifficulty} seeded draws per (path, difficulty); ${s.examSeeds} paper(s) per exam selection`);
  lines.push(`- Paths: **${s.passed}/${s.paths} pass** (${s.advertisedPaths} advertised)`);
  lines.push(`- Questions served and validated: ${s.questionsServed} (${s.questionsFailed} failed)`);
  lines.push(`- Advertised paths that served nothing: ${s.emptyAdvertisedPaths}; unadvertised (shown "coming soon") paths with no form: ${s.unadvertisedEmptyPaths}`);
  lines.push(`- Difficulty: ${s.difficultyMismatch} questions served at a rung other than the one the resolver chose. Every difficulty of the track window is requested on every path, so a dot point authored at fewer rungs is served at its nearest authored rung: ${s.difficultySnapped} such snapped requests, ${s.difficultyBelowWindow} of them outside the track window and disclosed to the student as such`);
  lines.push(`- Repeats in a ${REPEAT_WINDOW}-question window: ${s.repeatsAvoidable} avoidable (pool of ${2 * REPEAT_WINDOW}+ distinct items met and still repeated); ${s.repeatsExhausted} from smaller pools, each flagged to the student as a repeat`);
  lines.push(`- Low-variety paths (≤2 distinct items across the sample): ${s.lowVarietyPaths}`);
  lines.push(`- End to end through the local backend (POST /practice/next as the Practice page sends it): ${s.backend.passed}/${s.backend.paths} requests were answered as declared: a renderable, versioned question from the requested chapter at exactly the difficulty asked for, or — where that level has no authored form — a DIFFICULTY_UNAVAILABLE refusal listing the levels that exist — every advertised path with and without each window difficulty, the Class X NCERT library's D1–D4 buttons, India Progress's chapter buttons, and smart practice with and without the past-papers filter (where a class has no archive, the declared refusal)`);
  lines.push(`- Repeat window (live backend): ${s.repeatWindow.passed}/${s.repeatWindow.probes} probes served ${REPEAT_WINDOW} distinct questions in a row from pools small enough that the same draws without the window repeat`);
  lines.push(`- Generator cells (every V1 generator at all four rungs, ${s.generatorCells.drawsPerCell} draws each): ${s.generatorCells.passed}/${s.generatorCells.cells} pass, ${s.generatorCells.questions} questions`);
  lines.push(`- Exam papers: ${s.exams.passed}/${s.exams.selections} selections pass; ${s.exams.papers} papers, ${s.exams.questions} items, ${s.exams.failed} failed, ${s.exams.duplicatesInPaper} in-paper duplicates`);
  lines.push('');
  lines.push('## By track and class');
  lines.push('');
  lines.push('| Scope | Chapters | Paths | Pass | Questions |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const [k, v] of Object.entries(s.byScope)) lines.push(`| ${k} | ${v.chapters} | ${v.paths} | ${v.passed} | ${v.served} |`);
  lines.push('');
  lines.push('## Exam composition');
  lines.push('');
  lines.push('| Selection | Released | Papers | Items | Failed | Pass |');
  lines.push('|---|---|---:|---:|---:|---|');
  for (const e of report.exams) lines.push(`| ${e.id} | ${e.released ? 'yes' : 'no'} | ${e.papers} | ${e.questions} | ${e.failed} | ${e.pass ? 'PASS' : 'FAIL'} |`);
  const failing = report.paths.filter(r => !r.pass);
  lines.push('');
  lines.push('## Failing paths');
  lines.push('');
  if (!failing.length) lines.push('None.');
  for (const r of failing.slice(0, 80)) {
    lines.push(`- \`${r.id}\` — served ${r.served}, failed ${r.failed}, empty ${r.empty}, difficulty mismatch ${r.difficultyMismatch}, avoidable repeats ${r.repeatsAvoidable}`);
    for (const f of Object.values(r.failures).slice(0, 3)) lines.push(`  - ${f.count}× ${f.example.replace(/\|/g, '\\|')}`);
  }
  const low = report.paths.filter(r => r.served >= 4 && r.distinct <= 2);
  lines.push('');
  lines.push('## Low-variety paths (informational)');
  lines.push('');
  lines.push('A path whose whole sample came from one or two items. These serve correctly but will repeat inside a sitting; the student is told when a question is a repeat.');
  lines.push('');
  if (!low.length) lines.push('None.');
  for (const r of low.slice(0, 60)) lines.push(`- \`${r.id}\` — ${r.distinct} distinct across ${r.served} draws (${r.generators.join(', ')})`);
  if (low.length > 60) lines.push(`- …and ${low.length - 60} more (see certification-report.json)`);
  lines.push('');
  return lines.join('\n');
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function run(argv = process.argv.slice(2)) {
  const flags = new Set(argv.filter(a => a.startsWith('--')));
  const full = flags.has('--full');
  const nFlag = argv.map(a => a.match(/^--n=(\d+)$/)).find(Boolean)?.[1];
  const n = Number(nFlag || (full ? 40 : 4));
  const examSeeds = full ? 6 : 2;
  const started = Date.now();

  const paths = enumeratePaths();
  await loadBanksForPaths(paths);
  const rows = paths.map(p => certifyPath(p, n));
  const exams = await certifyExams(examSeeds);
  const e2e = await certifyBackend(paths);
  const probes = repeatProbes(paths);
  const repeatRows = await certifyRepeatWindow(probes);
  const cells = certifyGeneratorCells(new Set(rows.flatMap(r => r.generators)), full ? 60 : 8);

  // Versioning gate: generator output under a fixed seed may not change while
  // CONTENT_VERSION stays put.
  const v1Generators = new Set(rows.flatMap(r => r.generators));
  const digests = generatorDigests(v1Generators);
  const committed = fs.existsSync(DIGEST_FILE) ? JSON.parse(fs.readFileSync(DIGEST_FILE, 'utf8')) : null;
  const cmp = compareDigests(committed, digests, CONTENT_VERSION);

  const summary = summarise(rows, exams, { mode: full ? 'full' : 'fast', n, examSeeds });
  summary.backend = { paths: e2e.length, passed: e2e.filter(r => r.ok).length };
  summary.repeatWindow = { probes: repeatRows.length, passed: repeatRows.filter(r => r.ok).length, window: REPEAT_WINDOW };
  summary.generatorCells = { cells: cells.length, passed: cells.filter(c => c.pass).length, questions: cells.reduce((a, c) => a + c.served, 0), drawsPerCell: full ? 60 : 8 };
  const report = { summary, exams, generatorCells: cells.filter(c => !c.pass), backend: e2e.filter(r => !r.ok), paths: rows };

  if (full || flags.has('--write')) {
    const dir = path.join(ROOT, 'docs/content');
    fs.mkdirSync(dir, { recursive: true });
    // One compact row per path keeps the committed report reviewable; the
    // failure detail of any failing path is kept in full.
    const columns = ['id', 'track', 'grade', 'served', 'failed', 'empty', 'distinct', 'difficultySnapped', 'difficultyBelowWindow', 'difficultyMismatch', 'repeatsAvoidable', 'repeatsSmallPool', 'pass'];
    const file = {
      summary, exams, generatorCellFailures: report.generatorCells, backendFailures: report.backend,
      pathColumns: columns,
      paths: rows.map(r => columns.map(c => (c === 'repeatsSmallPool' ? r.repeatsExhausted : r[c]))),
      pathFailures: Object.fromEntries(rows.filter(r => !r.pass).map(r => [r.id, r.failures]))
    };
    const text = JSON.stringify(file, null, 1).replace(/\[\n\s+("[^"\n]*"|[\d.]+|true|false|null)(,\n\s+("[^"\n]*"|[\d.]+|true|false|null))*\n\s+\]/g, m => `[${m.slice(1, -1).split(',').map(x => x.trim()).join(', ')}]`);
    fs.writeFileSync(path.join(dir, 'certification-report.json'), text + '\n');
    fs.writeFileSync(path.join(dir, 'certification-report.md'), markdown(report));
  }
  if (flags.has('--write-digest')) {
    if (!cmp.ok) {
      console.error(`Refusing to refresh the content digest: ${cmp.changed.length + cmp.removed.length} existing generator(s) changed output under unchanged CONTENT_VERSION ${CONTENT_VERSION}. Bump CONTENT_VERSION in client/src/engine/contentIdentity.js first.`);
      return 1;
    }
    fs.mkdirSync(path.dirname(DIGEST_FILE), { recursive: true });
    fs.writeFileSync(DIGEST_FILE, JSON.stringify({ contentVersion: CONTENT_VERSION, draws: DIGEST_DRAWS, generators: digests }, null, 1) + '\n');
  }

  const failingPaths = rows.filter(r => !r.pass);
  for (const r of failingPaths.slice(0, 40)) {
    console.log(`FAIL ${r.id} — served ${r.served}, failed ${r.failed}, empty ${r.empty}, difficulty mismatch ${r.difficultyMismatch}, avoidable repeats ${r.repeatsAvoidable}`);
    for (const f of Object.values(r.failures).slice(0, 3)) console.log(`   ${f.count}× ${f.example} (seed ${f.seed})`);
  }
  for (const r of e2e.filter(x => !x.ok).slice(0, 20)) console.log(`FAIL backend ${r.id} — ${r.problem}`);
  for (const r of repeatRows.filter(x => !x.ok)) console.log(`FAIL repeat window ${r.id} — ${r.distinct}/${REPEAT_WINDOW} distinct, ${r.flagged} flagged as repeats (pool ${r.pool})`);
  if (!repeatRows.length) console.log('FAIL repeat window — no sensitive probe cell found; the repeat window is unmeasured');
  for (const c of cells.filter(x => !x.pass).slice(0, 20)) {
    console.log(`FAIL generator cell ${c.id} — ${c.failed}/${c.served} failed`);
    for (const f of Object.values(c.failures).slice(0, 3)) console.log(`   ${f.count}× ${f.example} (seed ${f.seed})`);
  }
  for (const e of exams.filter(x => !x.pass)) {
    console.log(`FAIL ${e.id} — papers ${e.papers}, items ${e.questions}, failed ${e.failed}`);
    for (const f of Object.values(e.failures).slice(0, 3)) console.log(`   ${f.count}× ${f.example} (seed ${f.seed})`);
  }
  if (!committed) console.log('CONTENT DIGEST: no committed digest — run with --write-digest');
  else if (!cmp.ok) console.log(`CONTENT DIGEST: FAIL — ${[...cmp.changed, ...cmp.removed].slice(0, 12).join(', ')} changed output under unchanged CONTENT_VERSION ${CONTENT_VERSION}. Bump CONTENT_VERSION (client/src/engine/contentIdentity.js), then npm run content:digest.`);
  else if (cmp.added.length) console.log(`CONTENT DIGEST: note — ${cmp.added.length} generator(s) not yet in the digest; run npm run content:digest`);

  const s = summary;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = !failingPaths.length && exams.every(e => e.pass) && cells.every(c => c.pass) && e2e.every(r => r.ok) && repeatRows.length > 0 && repeatRows.every(r => r.ok) && !!committed && cmp.ok;
  const g = summary.generatorCells;
  console.log(`CONTENT CERTIFICATION (${s.mode}, ${n}/path/difficulty): ${ok ? 'PASS' : 'FAIL'} — ${s.passed}/${s.paths} launch paths, ${s.questionsServed} questions validated, ${s.backend.passed}/${s.backend.paths} served end to end, ${s.repeatWindow.passed}/${s.repeatWindow.probes} repeat-window probes, ${g.passed}/${g.cells} generator cells, ${s.exams.passed}/${s.exams.selections} exam selections (${s.exams.questions} paper items), contentVersion ${CONTENT_VERSION} — ${secs}s`);
  await closeOwnAuthority();
  return ok ? 0 : 1;
}

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === launched) process.exit(await run());
