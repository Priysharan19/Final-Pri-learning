// Pri Learning · NSW HSC examiner certification dossier (mission CERT, plan G6)
//
// The Prithagoras counterpart of the Order 14 dossier (#499). Built from the
// code: every (generator, difficulty) cell the NSW banks issue (G3,
// server/platform/nswBanks.js) — which is also the pool the HSC-style practice
// papers draw on (G4, nswExamPool.js) — sampled on fixed seeds, the outcome
// codes each cell is located at in the current syllabus, the engine's verdict
// on worked cases, the method rubrics that would need certification before
// partial marks could ever be paid, and a SHA-256 digest bound to the marking
// source and to every sampled question.
//
// Prithagoras marks the final answer only (editionMarking.js). This dossier
// asks an examiner to review that final-answer marking and, separately, the
// method rubrics. It stores no NESA wording and reproduces no NESA marking
// guideline (research doc §5.7): outcome codes only.
//
// It is a review request. Nothing in it is academically approved.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const NSW_DOSSIER = 'docs/marking/hsc-examiner-certification-dossier.md';
const RESEARCH = 'docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md';

const sha = s => createHash('sha256').update(s).digest('hex');
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));
const cell = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function importTree(entries) {
  const seen = new Set(), todo = [...entries];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file)) continue;
    const abs = path.join(ROOT, file);
    if (!existsSync(abs)) throw new Error(`marking source ${file} is missing`);
    seen.add(file);
    for (const m of readFileSync(abs, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const dep = path.relative(ROOT, path.resolve(path.dirname(abs), m[1]));
      if (/\.(m?js|jsx)$/.test(dep)) todo.push(dep);
    }
  }
  return seen;
}

/** The fixed seeds a cell is sampled on; the first issuable ones are used. */
export const NSW_SEEDS = Array.from({ length: 24 }, (_, i) => 1009 + i * 7919);
const SAMPLES_PER_CELL = 3;

/**
 * The marking conventions the examiner confirms. Pri's own words, summarising
 * the research doc (§5); none is NESA text, and none is confirmed.
 */
export const NSW_CONVENTIONS = Object.freeze([
  { id: 'nsw-convention:final-answer-only', text: 'Prithagoras pays a question\'s marks for a right final answer and nothing otherwise. Working is read and shown back as feedback, never marked. HSC marking rewards relevant reasoning (research §5.2), so the app must say plainly it does not give HSC-style working marks.', cite: '§5.2, §8.3' },
  { id: 'nsw-convention:equivalent-forms', text: 'A final answer is accepted in any form the engine proves equal to the key (fractions, decimals at the precision asked, equivalent expressions). The examiner confirms the forms accepted for each answer type are those an HSC marker would accept, and lists any that should be refused.', cite: '§5.1 ("or equivalent merit")' },
  { id: 'nsw-convention:rounding-tolerance', text: 'Cells whose tolerance is wider than the precision the question names (for example a cent or a dollar of drift) are NOT issued until the examiner rules on what rounding drift, if any, an answer may carry. They are listed in section 6.', cite: '§5.2' },
  { id: 'nsw-convention:multiple-choice', text: 'A multiple-choice item is marked on the option chosen, one mark, as in Section I of an HSC paper.', cite: '§5.2' },
  { id: 'nsw-convention:no-method-marks-from-india', text: 'No CBSE (#499) certification carries to NSW (ADR-0002 §6). Method marks for Prithagoras need this jurisdiction\'s own certification, per syllabus version, by at least two independent certifiers (research §8.3).', cite: '§8.3' }
]);

export async function buildNswDossier() {
  const { generateQuestion, loadAllBanks } = await import(path.join(ROOT, 'client/src/engine/generators/index.js'));
  const { NSW_BANK_LEDGER, NSW_QUALITY_EXCLUSIONS, nswIssuable, nswQuestionIdentity } = await import(path.join(ROOT, 'server/platform/nswBanks.js'));
  const { NSW_CURRENT_SYLLABUSES } = await import(path.join(ROOT, 'client/src/engine/curriculum-nsw/index.js'));
  const { UNCERTIFIED_EDITIONS } = await import(path.join(ROOT, 'server/platform/editionMarking.js'));
  const { workedCases } = await import('./examiner-cases.mjs');
  await loadAllBanks();

  const NSW_DIR = 'client/src/engine/curriculum-nsw';
  const entries = [
    'server/platform/markerOps.js', 'server/platform/nswBanks.js', 'server/platform/nswExamPool.js',
    'server/platform/nswFormTypes.js', 'server/platform/editionMarking.js',
    ...readdirSync(path.join(ROOT, NSW_DIR)).filter(f => /\.m?js$/.test(f)).map(f => `${NSW_DIR}/${f}`)
  ];
  const ledgerGenerators = NSW_BANK_LEDGER.filter(e => e.issued).map(e => e.generator);
  const GEN_DIR = 'client/src/engine/generators';
  const generatorFiles = readdirSync(path.join(ROOT, GEN_DIR)).filter(f => /\.m?js$/.test(f)).map(f => `${GEN_DIR}/${f}`)
    .filter(f => ledgerGenerators.some(g => readFileSync(path.join(ROOT, f), 'utf8').includes(`'${g}'`)));
  const DOCS = ['docs/content/marking-tolerance.md', RESEARCH];
  for (const d of DOCS) if (!existsSync(path.join(ROOT, d))) throw new Error(`policy document ${d} is missing`);
  const sources = [...new Set([...importTree([...entries, ...generatorFiles]), ...DOCS])].sort();
  const sourceRows = sources.map(f => ({ file: f, sha256: sha(readFileSync(path.join(ROOT, f))) }));

  const cells = [];
  for (const entry of NSW_BANK_LEDGER) {
    for (const c of entry.cells) {
      if (!c.issued) continue;
      const samples = [];
      for (const seed of NSW_SEEDS) {
        if (samples.length >= SAMPLES_PER_CELL) break;
        let q;
        try { q = generateQuestion(entry.generator, c.difficulty, seed); } catch { continue; }
        if (!q || !nswIssuable(q, entry.generator)) continue;
        samples.push({ seed, q });
      }
      if (!samples.length) throw new Error(`${entry.generator}/D${c.difficulty} is issued but no sampled seed yields an issuable question; widen NSW_SEEDS`);
      const first = samples[0].q;
      const identity = nswQuestionIdentity(first, entry.generator);
      const outcomes = [...new Set(samples.flatMap(s => (nswQuestionIdentity(s.q, entry.generator)?.outcomes || []).map(o => o.code)))].sort();
      const stepcheck = samples.find(s => s.q.stepcheck)?.q.stepcheck || null;
      cells.push({
        id: `${entry.generator}/D${c.difficulty}`,
        generator: entry.generator,
        difficulty: c.difficulty,
        syllabus: identity.syllabus,
        syllabusVersion: identity.syllabusVersion,
        outcomes,
        answerType: first.answerType || 'numeric',
        stepcheck: stepcheck ? (stepcheck.kind === 'plan' ? (stepcheck.chain ? 'chain plan' : 'plan') : stepcheck.kind) : null,
        seeds: samples.map(s => s.seed),
        prompt: first.prompt,
        cases: workedCases(first),
        hash: sha(canon(samples.map(s => ({ seed: s.seed, prompt: s.q.prompt, answer: s.q.answer, stepcheck: s.q.stepcheck || null, options: s.q.options || null }))))
      });
    }
  }
  const methodCells = cells.filter(c => c.stepcheck);
  const notIssued = NSW_BANK_LEDGER.flatMap(e => e.cells.filter(c => !c.issued).map(c => ({ id: `${e.generator}/D${c.difficulty}`, reason: c.reason })));
  const toleranceRulings = Object.entries(NSW_QUALITY_EXCLUSIONS).filter(([, r]) => /tolerance|rounding|cent|dollar/i.test(r)).map(([k]) => k).sort();

  const sourceDigest = sha(sourceRows.map(r => `${r.file} ${r.sha256}`).join('\n'));
  const cellDigest = sha(cells.map(c => `${c.id} ${c.hash}`).join('\n'));
  const conventionDigest = sha(canon(NSW_CONVENTIONS));
  const digest = sha(`pri-nsw-hsc-rubric-digest-v1\n${sourceDigest}\n${cellDigest}\n${conventionDigest}`);

  const items = [
    ...NSW_CONVENTIONS.map(c => c.id),
    ...cells.map(c => `nsw-final:${c.id}`),
    ...methodCells.map(c => `nsw-method:${c.id}`)
  ];
  const syllabusVersions = [...new Set(cells.map(c => `${c.syllabus}@${c.syllabusVersion}`))].sort();

  const L = [];
  const p = s => L.push(s);
  p('# NSW HSC — independent examiner certification dossier (plan G6)');
  p('');
  p('> **Nothing in this dossier is academically approved. Not yet reviewed by a human examiner.** It is a review request. No HSC marker, teacher, NESA officer or board has reviewed or signed any marking, rubric or convention below. Automated tests and agent reviews are software evidence, not academic approval. Prithagoras marks the final answer only, and method marks cannot be switched on for it (`server/platform/editionMarking.js`, `UNCERTIFIED_EDITIONS = ' + JSON.stringify(UNCERTIFIED_EDITIONS) + '`) until a signed result for this jurisdiction exists.');
  p('');
  p('Generated by `node tools/examiner-dossier.mjs --jurisdiction nsw` from the code it describes. Do not edit by hand; `npm run test:marking:dossier` fails when this file no longer matches the code. It contains no NESA text: outcome codes only (research `' + RESEARCH + '` §5.7). A CBSE certification (#499) never implies this one (ADR-0002 §6).');
  p('');
  p('## 1. What the examiner signs: the rubric digest');
  p('');
  p(`**Rubric digest (sha256): \`${digest}\`**`);
  p('');
  p(`It hashes (a) the marking source below — the import tree of \`server/platform/markerOps.js\`, the NSW bank, exam-pool and edition-marking modules, the NSW curriculum model, every generator file that builds an issued NSW bank, the tolerance policy and the NSW research document; (b) the prompt, keyed answer, options and step check of every sampled question in every issued cell (up to ${SAMPLES_PER_CELL} issuable questions per cell, from fixed seeds starting ${NSW_SEEDS[0]}); (c) the conventions in section 4. Any change produces a different digest, and a signature over the old digest does not carry over.`);
  p('');
  p(`- Source digest: \`${sourceDigest}\``);
  p(`- Cell digest: \`${cellDigest}\``);
  p(`- Convention digest: \`${conventionDigest}\``);
  p(`- Syllabus versions in scope: ${syllabusVersions.map(s => `\`${s}\``).join(', ')}`);
  p('');
  p('| Marking source | sha256 |');
  p('|---|---|');
  for (const r of sourceRows) p(`| \`${r.file}\` | \`${r.sha256}\` |`);
  p('');
  p('## 2. Current syllabuses');
  p('');
  p('| Syllabus | Version | Years |');
  p('|---|---|---|');
  for (const s of NSW_CURRENT_SYLLABUSES) p(`| ${cell(s.title)} (\`${s.id}\`) | ${s.version} | ${(s.years || []).join(', ')} |`);
  p('');
  p('Stage 6 content is assessed against the 2024 syllabuses; Years 7–10 against Mathematics K–10 (2022). "Located at" an outcome is the G2 crosswalk\'s claim of where the content sits, not a claim that a question covers the outcome.');
  p('');
  p(`## 3. Every issued cell — final-answer marking (${cells.length} cells)`);
  p('');
  p('Each row is a generator and difficulty Prithagoras issues, in practice and in the HSC-style practice papers (G4 draws only from these cells). The mark is for the final answer only. Worked cases for every cell are in the packet (`docs/marking/packets/hsc/worked-cases.md`).');
  p('');
  p('| Cell | Syllabus | Outcomes located at | Answer type | Step check | Seeds | Sample hash |');
  p('|---|---|---|---|---|---|---|');
  for (const c of cells) p(`| \`${c.id}\` | ${c.syllabus}@${c.syllabusVersion} | ${c.outcomes.join(', ')} | ${c.answerType} | ${c.stepcheck || '—'} | ${c.seeds.join(', ')} | \`${c.hash.slice(0, 16)}\` |`);
  p('');
  p('## 4. Marking conventions — each to be confirmed by the examiner');
  p('');
  p(`Summarised in Pri's own words from \`${RESEARCH}\`. **None is confirmed.**`);
  p('');
  for (const c of NSW_CONVENTIONS) p(`- **\`${c.id}\`** (research ${c.cite}) — ${c.text} *To be confirmed by the examiner.*`);
  p('');
  p(`## 5. Method rubrics that would need certification before partial marks (${methodCells.length} cells)`);
  p('');
  p(methodCells.length
    ? 'These issued cells carry a step check the shared engine could use to pay method marks. Prithagoras pays none of them today. Each would need this jurisdiction\'s certification, and a code change to `UNCERTIFIED_EDITIONS`, before a partial mark could be paid.'
    : 'No issued NSW cell carries a step check, so there is no NSW method rubric to certify yet. This section is empty on purpose.');
  p('');
  if (methodCells.length) {
    p('| Cell | Step check kind | Marks |');
    p('|---|---|---:|');
    for (const c of methodCells) p(`| \`${c.id}\` | ${c.stepcheck} | ${c.cases[0].marks} |`);
    p('');
  }
  p(`## 6. Not issued (${notIssued.length} cells) and rulings the examiner is asked for`);
  p('');
  p(`Cells refused by the G3 gate are not marked by Prithagoras and are outside this certification, except that the examiner is asked to rule on rounding tolerance for these ${toleranceRulings.length} quality exclusions: ${toleranceRulings.map(t => `\`${t}\``).join(', ')}.`);
  p('');
  p('<details><summary>Every cell not issued, with the reason</summary>');
  p('');
  for (const n of notIssued) p(`- \`${n.id}\` — ${cell(n.reason)}`);
  p('');
  p('</details>');
  p('');
  p('## 7. Review protocol');
  p('');
  p('1. Check out the commit, run `node tools/examiner-dossier.mjs --jurisdiction nsw --check`, and confirm the digest above.');
  p('2. At least two independent certifiers per course (research §8.3). Blind-solve a sample of each cell\'s issued questions without the key, then compare with the engine\'s verdicts in the packet.');
  p('3. Rule on each convention in section 4 and each tolerance in section 6.');
  p('4. For each method rubric in section 5 (if any), state whether partial marks may ever be paid and on what ladder.');
  p('5. Return the decision form in the packet. The platform verifies it with `node tools/verify-examiner-certification.mjs`.');
  p('');
  p(`**Decision items: ${items.length}.** **Certification status: PENDING. Approved by: nobody.**`);
  p('');
  return { text: L.join('\n'), digest, cells, methodCells, items, syllabusVersions, notIssued };
}
