// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · generated multi-part practice sets as papers (tools/build-multipart-papers.mjs)
//
//   FORMAT     every generated document passes the loader's validateStructured; ids and labels are unique;
//              part marks add to the question marks and the question marks to the paper's.
//   BUILD      `--check` passes: the committed JSON is exactly what the tool generates.
//   MARKER     every keyed part's key, typed as a student writes it, is marked correct by the SAME path the server
//              uses for a paper part (engineQuestion -> givenFor -> markerOps examAnswerStage); a perturbed answer is wrong
//              and a blank is unanswered; a correct part earns exactly the part's marks.
//   OUTCOMES   every outcome code is a code of the NSW curriculum crosswalk, and every practice chapter's codes are carried by
//              that chapter's crosswalk row; the client chapter list is the server's.
//   TEXT       no "undefined", "NaN", em dash or HSC / NESA claim in a title; every document is generated practice, never approved.
//   REACHABLE  the loader reads the collection, and the papers router offers it (separately from the authored papers).
// SYNTHETIC: deterministic generator output; not student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { engineQuestion, givenFor, leafParts, loadStructuredPapers, schemeApproved, validateStructured } from '../../server/platform/paperContent.js';
import { examAnswerStage } from '../../server/platform/markerOps.js';
import { PRACTICE_DIR, PAPERS_DIR } from '../../server/platform/papers.js';
import { NSW_CROSSWALK } from '../src/engine/curriculum-nsw/crosswalk.js';
import { PRACTICE_SET_CHAPTERS, PRACTICE_SET_SUBTOPICS, practiceSetsFor } from '../src/engine/multipart/practiceSets.js';
import { SET_OUTCOMES, SEEDS, buildDocument, generated, PRACTICE_PREFIX } from '../../tools/build-multipart-papers.mjs';
import { multipartIds } from '../src/engine/multipart/sets-nsw.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const here = dirname(fileURLToPath(import.meta.url));

// ── the collection, through the loader ───────────────────────────────────────
const docs = loadStructuredPapers(PRACTICE_DIR);
ok(docs.size === SEEDS.length, `the loader reads ${SEEDS.length} generated documents (${docs.size})`);
ok([...docs.keys()].join() === SEEDS.map((_, i) => `${PRACTICE_PREFIX}${i + 1}`).join(), 'stable ids mp-practice-set-1..3');
const authored = loadStructuredPapers(PAPERS_DIR);
ok(authored.size === 13 && [...docs.keys()].every(id => !authored.has(id)), 'the authored papers are a separate collection of 13 and share no id');

// ── the build tool ───────────────────────────────────────────────────────────
const built = spawnSync(process.execPath, [join(here, '../../tools/build-multipart-papers.mjs'), '--check'], { encoding: 'utf8' });
ok(built.status === 0 && /MULTIPART PAPERS BUILD: PASS/.test(built.stdout), `build tool --check passes (${built.stderr.trim()})`);
const files = generated();
ok(files.length === 3 && files.every(f => JSON.stringify(JSON.parse(f.text)) === JSON.stringify(docs.get(f.file.replace(/\.json$/, '')))), 'the committed documents equal a fresh build');
ok(JSON.stringify(buildDocument(1)) === JSON.stringify(buildDocument(1)) && JSON.stringify(buildDocument(1)) !== JSON.stringify(buildDocument(2)), 'a build is deterministic and the three seeds differ');

// ── the NSW crosswalk codes ──────────────────────────────────────────────────
const crosswalkCodes = new Set(NSW_CROSSWALK.flatMap(r => r.dotpoints.flat()));
const rowOf = id => NSW_CROSSWALK.find(r => r.subtopicId === id);
ok(multipartIds().every(id => Array.isArray(SET_OUTCOMES[id]) && SET_OUTCOMES[id].length > 0), 'every set has outcomes');
for (const [id, codes] of Object.entries(SET_OUTCOMES)) for (const code of codes) ok(crosswalkCodes.has(code), `${id}: ${code} is a code of the NSW crosswalk`);
for (const [chapter, codes] of Object.entries(PRACTICE_SET_SUBTOPICS)) {
  const row = rowOf(chapter);
  ok(!!row && codes.every(c => row.dotpoints.flat().includes(c)), `${chapter}: its crosswalk row carries ${codes.join()}`);
  ok(Object.values(SET_OUTCOMES).some(set => set.some(c => codes.includes(c))), `${chapter}: some set carries one of ${codes.join()}`);
}
for (const [id, codes] of Object.entries(SET_OUTCOMES)) ok(Object.values(PRACTICE_SET_SUBTOPICS).some(cs => cs.some(c => codes.includes(c))), `${id}: some practice chapter offers it`);
ok(PRACTICE_SET_CHAPTERS.join() === Object.keys(PRACTICE_SET_SUBTOPICS).join(), 'the client chapter list is the server map');

// ── every document ───────────────────────────────────────────────────────────
const perturb = key => {
  switch (key.type) {
    case 'numeric': return String(key.value + (Math.abs(key.value) < 1 ? 0.5 : Math.abs(key.value) * 0.1 + 1));
    case 'set': return [...key.values.slice(0, -1), key.values[key.values.length - 1] + 1].join(', ');
    case 'expression': return `(${key.expr})+1`;
    default: return null;
  }
};
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));
const spell = key => key.type === 'numeric' ? fmt(key.value) : key.type === 'set' ? key.values.map(fmt).join(', ') : key.expr.replace(/\*/g, '');
const scan = (v, path, hits) => {
  if (typeof v === 'string') { if (/undefined|NaN|—/.test(v)) hits.push(`${path}: ${v.slice(0, 60)}`); }
  else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`, hits));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`, hits);
};
let keyed = 0;
for (const doc of docs.values()) {
  let valid = true;
  try { validateStructured(doc); } catch (e) { valid = false; console.error(e.message); }
  ok(valid, `${doc.id} passes validateStructured`);
  ok(/^Exam-style practice set [123]$/.test(doc.title) && !/HSC|NESA/i.test(doc.title), `${doc.id}: title "${doc.title}" is generated practice and claims no HSC or NESA paper`);
  ok(doc.generated === true && doc.course === 'nsw-practice' && !schemeApproved(doc, [{ paperId: doc.id, schemeDigest: '0'.repeat(64) }]) && doc.markingScheme.status === 'generated', `${doc.id}: marked generated, scheme not approved`);
  const bad = []; scan(doc, doc.id, bad);
  ok(bad.length === 0, `${doc.id}: no undefined, NaN or em dash (${bad.slice(0, 3).join(' | ')})`);
  ok(doc.sections.length === 1 && doc.sections[0].questions.length === multipartIds().length, `${doc.id}: eight questions`);
  const ids = new Set(), labels = new Set(), numbers = new Set();
  let total = 0;
  for (const q of doc.sections[0].questions) {
    ok(!numbers.has(q.number) && q.number >= 1 && q.number <= 14 && q.number <= 10, `${doc.id} q${q.number}: unique number in section I's range`);
    numbers.add(q.number);
    const sum = q.parts.reduce((a, p) => a + p.marks, 0);
    ok(sum === q.marks, `${doc.id} q${q.number}: part marks ${sum} add to question marks ${q.marks}`);
    total += q.marks;
    for (const part of q.parts) {
      ok(!ids.has(part.id), `${doc.id}: unique part id ${part.id}`); ids.add(part.id);
      const label = `${q.number}${part.label}`;
      ok(!labels.has(label), `${doc.id}: unique label ${label}`); labels.add(label);
      ok(part.autoMarks === part.marks && part.criteria.length === 1 && part.criteria[0].marks === part.marks, `${doc.id} ${part.id}: one criterion worth the part's marks, all auto-marked`);
      ok(part.sampleAnswer.length >= 2 && part.classification.outcomes.every(o => crosswalkCodes.has(o)), `${doc.id} ${part.id}: sample answer from the steps and real outcome codes`);
    }
  }
  ok(total === doc.totalMarks && doc.sections[0].marks === total, `${doc.id}: question marks add to the paper's ${doc.totalMarks}`);
  ok(leafParts(doc).length === doc.sections[0].questions.reduce((a, q) => a + q.parts.length, 0), `${doc.id}: every part is a leaf`);

  for (const leaf of leafParts(doc)) {
    const { part } = leaf;
    keyed += 1;
    const q = engineQuestion(doc, leaf);
    const grid = { correct: part.autoMarks, incorrect: 0, unanswered: 0 };
    const run = text => examAnswerStage(q, givenFor(part, text), '', grid).response;
    const right = run(spell(part.key));
    ok(right.correct === true && right.awarded === part.marks, `${doc.id} ${part.id}: the key "${spell(part.key)}" is marked correct for ${part.marks} (${right.outcome})`);
    const wrong = run(perturb(part.key));
    ok(wrong.correct === false && wrong.awarded === 0, `${doc.id} ${part.id}: a perturbed answer is wrong (${perturb(part.key)})`);
    ok(run('').unanswered === true, `${doc.id} ${part.id}: a blank is unanswered`);
  }
}
ok(keyed >= 60, `${keyed} keyed parts checked`);

// ── who is offered them ─────────────────────────────────────────────────────
ok(practiceSetsFor({ course: 'nsw', year: 12, pathway: 'advanced' }) && practiceSetsFor({ course: 'nsw', year: 11, pathway: 'ext1' }), 'Year 11-12 Advanced and Extension 1 students are offered the sets');
ok(!practiceSetsFor({ course: 'nsw', year: 12, pathway: 'standard' }) && !practiceSetsFor({ course: 'nsw', year: 10 }) && !practiceSetsFor({ course: 'in', year: 12 }) && !practiceSetsFor(null), 'Standard, Year 10, India and signed-out are not');

if (fail) { console.error(`MULTIPART PAPERS: FAIL — ${fail} of ${pass + fail} checks failed`); process.exit(1); }
console.log(`MULTIPART PAPERS: PASS — ${pass}/${pass + fail} checks across ${docs.size} documents, ${keyed} keyed parts`);
