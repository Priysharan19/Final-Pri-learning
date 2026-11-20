// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · generated multi-part practice sets as `pri-paper-v1` documents
//
//   node tools/build-multipart-papers.mjs            write the documents
//   node tools/build-multipart-papers.mjs --check    fail if the committed files differ from what this tool generates
//
// Each document ("Exam-style practice set N") holds the eight multi-part sets of
// client/src/engine/multipart/sets-nsw.js, drawn with seed N, as eight questions.
// A part becomes a leaf part the paper surface already knows how to show and mark:
//   numeric  -> answerType "value", key { type: "numeric", value, tol? }
//   set      -> answerType "value", key { type: "set", values, tol? }
//   expression -> answerType "expression", key { type: "expression", expr }
// The part's answer is marked on its FINAL ANSWER by the same deterministic engine
// as every paper part; `autoMarks` is the part's marks. The criterion is one line,
// "Provides the correct answer", worth the part's marks; no per-mark criteria are
// invented, and the scheme is never approved, so criterion marks are never shown.
//
// These are generated practice, not the owner's authored papers, and not HSC or NESA
// papers. SYNTHETIC: no student, teacher or examiner evidence. Written to
// server/content/papers/nsw-practice/structured/.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAPER_FORMAT } from '../server/platform/paperContent.js';
import { multipartIds, multipartSet } from '../client/src/engine/multipart/sets-nsw.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_DIR = join(ROOT, 'server/content/papers/nsw-practice/structured');
export const SEEDS = Object.freeze([1, 2, 3]);
export const PRACTICE_PREFIX = 'mp-practice-set-';

/**
 * The syllabus outcomes of each set, in the codes the NSW curriculum model uses (client/src/engine/curriculum-nsw):
 * Advanced MAV-11-xx / MAV-12-xx, Extension 1 ME1-12-xx. Every code here is read from the crosswalk by the test.
 */
export const SET_OUTCOMES = Object.freeze({
  'mp-adv12-stationary': ['MAV-11-06', 'MAV-12-06'],
  'mp-adv12-motion-exp': ['MAV-12-04', 'MAV-12-06'],
  'mp-adv12-exp-model': ['MAV-11-07', 'MAV-12-06'],
  'mp-adv11-trig-identity-equation': ['MAV-11-04', 'MAV-11-05'],
  'mp-adv12-log-laws': ['MAV-11-07', 'MAV-11-08'],
  'mp-adv12-area-integral': ['MAV-12-05'],
  'mp-ext1-vectors': ['ME1-12-02'],
  'mp-ext1-projectile': ['ME1-12-02']
});

const p = t => ({ k: 'p', t });
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

function keyOf(part) {
  const a = part.answer;
  if (part.answerType === 'numeric') return { type: 'numeric', value: a.value, ...(a.tol != null ? { tol: a.tol } : {}) };
  if (part.answerType === 'set') return { type: 'set', values: a.values, ...(a.tol != null ? { tol: a.tol } : {}) };
  if (part.answerType === 'expression') return { type: 'expression', expr: a.expr };
  throw new Error(`multipart paper: unsupported answer type ${part.answerType}`);
}

function leafOf(qn, part, outcomes, content) {
  const letter = /^\(([a-z])\)$/.exec(part.label)?.[1];
  if (!letter) throw new Error(`multipart paper: bad label ${part.label}`);
  const leaf = {
    id: `q${qn}${letter}`, label: part.label, marks: part.marks, prompt: [p(part.prompt)],
    criteria: [{ text: [p('Provides the correct answer')], marks: part.marks }],
    sampleAnswer: part.steps.map(s => p(`${s.h}: ${s.d}`)),
    classification: { content, outcomes: [...outcomes] },
    figures: [], answerType: part.answerType === 'expression' ? 'expression' : 'value', key: keyOf(part), autoMarks: part.marks
  };
  if (part.answerSuffix) leaf.answerSuffix = part.answerSuffix;
  return leaf;
}

export function buildDocument(n) {
  const seed = SEEDS[n - 1];
  const questions = multipartIds().map((id, i) => {
    const qn = i + 1;
    const set = multipartSet(id, seed);
    const outcomes = SET_OUTCOMES[id];
    if (!outcomes) throw new Error(`multipart paper: no outcomes for ${id}`);
    return { id: `q${qn}`, number: qn, marks: set.totalMarks, stem: [p(set.stem)], figures: [], parts: set.parts.map(part => leafOf(qn, part, outcomes, set.title)) };
  });
  const total = questions.reduce((a, q) => a + q.marks, 0);
  const minutes = Math.max(5, Math.round((total * 120) / 70));
  const scheme = questions.map(q => q.parts.map(x => x.criteria));
  return {
    format: PAPER_FORMAT, id: `${PRACTICE_PREFIX}${n}`, paperNumber: 100 + n, title: `Exam-style practice set ${n}`,
    course: 'nsw-practice', edition: 'prithagoras', generated: true,
    provenance: { generator: 'tools/build-multipart-papers.mjs', seed, sets: multipartIds(), note: 'Generated practice questions. Not an HSC or NESA paper. No examiner has reviewed them.' },
    totalMarks: total, readingTime: '0 minutes', workingTime: `${minutes} minutes`,
    markingScheme: { status: 'generated', note: 'One criterion per part, the correct final answer. Not approved for criterion marks.', digest: sha(scheme) },
    sections: [{
      id: 'I', title: 'Multi-part practice questions', marks: total, minutes,
      instructions: 'Answer each part in its own box. A part is marked on its final answer. Show relevant mathematical reasoning.',
      questions
    }],
    figures: []
  };
}

export const render = doc => `${JSON.stringify(doc, null, 2)}\n`;
export const generated = () => SEEDS.map((_, i) => buildDocument(i + 1)).map(doc => ({ file: `${doc.id}.json`, text: render(doc) }));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const want = generated();
  if (process.argv.includes('--check')) {
    const have = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).sort() : [];
    const bad = [];
    if (JSON.stringify(have) !== JSON.stringify(want.map(w => w.file).sort())) bad.push(`files on disk ${have.join(',')} differ from ${want.map(w => w.file).join(',')}`);
    for (const w of want) if (!existsSync(join(OUT_DIR, w.file)) || readFileSync(join(OUT_DIR, w.file), 'utf8') !== w.text) bad.push(`${w.file} differs from what the tool generates`);
    if (bad.length) { console.error(`MULTIPART PAPERS BUILD: FAIL\n  ${bad.join('\n  ')}`); process.exit(1); }
    console.log(`MULTIPART PAPERS BUILD: PASS — ${want.length} documents match the committed files`);
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const w of want) writeFileSync(join(OUT_DIR, w.file), w.text);
    console.log(`wrote ${want.length} documents to ${OUT_DIR}`);
  }
}
