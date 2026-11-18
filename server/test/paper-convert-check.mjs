// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the LaTeX converter (tools/papers/convert.mjs), round trip
//
// A small paper in the author's own LaTeX macros (a fixture below, not a real
// paper) goes through parsePaper, parseGuidelines and assemble, and the result is
// held to what the server will accept (validateStructured) and to what a student
// may see (publicPaper). Then the part that matters for trust:
//   · a key exists only where an override gives it: no key is ever guessed from prose;
//   · the marks are the author's (paper total, question totals, top criterion);
//   · an escaped dollar before a maths dollar does not open display maths;
//   · outcomes as the mapping grid writes them ("11-03", "ME1-12-04; MA-C3")
//     become clean ME1 codes;
//   · the output is deterministic: converting twice gives the same bytes;
//   · every shipped structured paper carries exactly the keys its override file names.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { checks } from './support/app-harness.mjs';
import { assemble, normalizeOutcomes, parseGuidelines, parsePaper } from '../../tools/papers/convert.mjs';
import { leafParts, publicPaper, validateStructured } from '../platform/paperContent.js';

const c = checks();
const B = '\\';
const mcq = n => `${B}begin{mcq}{${n}}\nWhat is $${n}+1$?\n${B}begin{opts}\n${B}item $${n}$\n${B}item $${n + 1}$\n${B}item $${n + 2}$\n${B}item $${n + 3}$\n${B}end{opts}\n${B}end{mcq}\n`;
const paperTex = [
  `${B}documentclass{article}`, `${B}begin{document}`,
  ...Array.from({ length: 10 }, (_, i) => mcq(i + 1)),
  `${B}textbf{Section II}`,
  `${B}textbf{Question 11} (15 marks)`,
  `${B}begin{parts}`,
  `${B}item Solve $x^2 = 4$. ${B}pmk{3}`,
  `${B}item The airline charges ${B}$250 and pays ${B}$$C$ to each passenger. Prove that $C > 0$. ${B}pmk{12}`,
  `${B}end{parts}`, `${B}end{document}`
].join('\n');
const guideRows = Array.from({ length: 10 }, (_, i) => `${i + 1} & ${'BCDA'[i % 4]} & Because $${i + 2}$.${B}${B}${B}hline`).join('\n');
const guideTex = [
  `${B}begin{document}`, guideRows,
  `${B}gq{11 (a)}`,
  `${B}begin{crit}${B}cri{Provides the correct values with justification}{3}${B}cri{Factorises}{1}${B}end{crit}`,
  `${B}sa`, `Factorise: $(x-2)(x+2)=0$, so $x=${B}pm 2$.`,
  `${B}gq{11 (b)}`,
  `${B}begin{crit}${B}cri{Provides a correct proof}{12}${B}cri{Makes progress}{6}${B}end{crit}`,
  `${B}sa`, 'Obvious.',
  `${B}clearpage{${B}bfseries Mapping grid}`,
  `1 & 1 & Content & 11-03 & E4${B}${B}${B}hline`,
  `11 (a) & 3 & Algebra & ME1-12-04; MA-C3 & E4${B}${B}${B}hline`,
  `${B}end{document}`
].join('\n');

const paper = parsePaper(paperTex);
const guide = parseGuidelines(guideTex);
c.eq(paper.sectionI.length, 10, 'ten multiple-choice questions are read');
c.deq(paper.sectionII.map(q => [q.number, q.marks, q.parts.map(p => [p.id, p.marks])]), [[11, 15, [['q11a', 3], ['q11b', 12]]]], 'Question 11, its parts and their marks are read as the author wrote them');
c.ok(!paper.notes.some(n => /unterminated/.test(n)), 'an escaped dollar before a maths dollar does not open display maths');
c.deq(normalizeOutcomes('11-03'), ['ME1-11-03'], 'outcome "11-03" becomes ME1-11-03');
c.deq(normalizeOutcomes('ME1-12-04; MA-C3'), ['ME1-12-04'], 'a semicolon and a non-ME1 code are handled');
c.deq(normalizeOutcomes('ME1-11-01, 11-02'), ['ME1-11-01', 'ME1-11-02'], 'a comma list with shorthand');
c.deq(guide.keys['1'] + guide.keys['2'], 'BC', 'the guideline key table gives the Section I letters');
c.deq(guide.mapping.q11a?.outcomes, ['ME1-12-04'], 'the mapping grid outcome is normalised on the way in');

const overrides = { keys: { q11a: { answerType: 'value', key: { type: 'set', values: [2, -2], display: '\\pm2' }, autoMarks: 1, keyChecks: 'fixture' } } };
const first = assemble({ id: 'ext1-test-fixture', number: 99, paper, guide, overrides });
const second = assemble({ id: 'ext1-test-fixture', number: 99, paper: parsePaper(paperTex), guide: parseGuidelines(guideTex), overrides });
c.eq(JSON.stringify(second.paperDoc), JSON.stringify(first.paperDoc), 'converting twice gives the same bytes');
const doc = first.paperDoc;
const leaves = leafParts(doc);
c.deq(leaves.filter(l => l.part.key && l.part.key.type !== 'mcq').map(l => l.part.id), ['q11a'], 'a key exists only where an override gives it');
c.eq(leaves.find(l => l.part.id === 'q11b').part.answerType, 'show-that', 'a "prove" part is a show-that with no key');
c.ok(leaves.filter(l => l.part.key?.type === 'mcq').length === 10 && leaves.every(l => l.part.criteria.length > 0), 'every multiple-choice question has its guideline key and every part its criteria');
c.eq(first.report.counts.totalMarks, 25, 'marks add up (10 + 15)');
c.ok(first.report.gaps.some(g => /marks add to 25, the paper says 70/.test(g)), 'a paper that is not 70 marks is reported as a gap, not hidden');
c.ok(/^[0-9a-f]{64}$/.test(doc.markingScheme.digest) && doc.markingScheme.status === 'draft', 'the scheme is stored as a draft with a digest');
validateStructured({ ...doc, totalMarks: 25 });
c.ok(true, "the result passes the server's own validation");
const pub = JSON.stringify(publicPaper({ ...doc, totalMarks: 25 }));
c.ok(!/"key"|"criteria"|"sampleAnswer"|Factorise: |Because/.test(pub), 'and the public paper has no key, criterion or sample answer');

// ── The shipped papers equal their overrides ─────────────────────────────────
const structured = new URL('../content/papers/nsw-ext1/structured/', import.meta.url);
const overridesDir = new URL('../../tools/papers/overrides/', import.meta.url);
let shipped = 0;
for (const f of readdirSync(structured).filter(x => x.endsWith('.json'))) {
  const shippedDoc = JSON.parse(readFileSync(new URL(f, structured), 'utf8'));
  const over = JSON.parse(readFileSync(new URL(f, overridesDir), 'utf8')).keys;
  const keyed = Object.fromEntries(leafParts(shippedDoc).filter(l => l.part.key && l.part.key.type !== 'mcq').map(l => [l.part.id, l.part.key]));
  const strip = k => { const { answerSuffix, ...rest } = k; void answerSuffix; return JSON.stringify(rest); };
  const same = Object.keys(over).sort().join() === Object.keys(keyed).sort().join() && Object.entries(over).every(([id, o]) => strip(o.key) === strip(keyed[id]));
  c.ok(same, `${shippedDoc.id}: the structured paper's keys equal its override file`);
  shipped += 1;
}
c.eq(shipped, 13, 'all thirteen shipped papers carry exactly the keys their override files name (nothing unverified slipped in)');
console.log(`PAPER CONVERTER: PASS — ${c.count()}/${c.count()} checks`);
