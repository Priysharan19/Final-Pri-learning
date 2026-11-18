// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · convert the owner's LaTeX papers to the structured paper format
//
//   node tools/papers/convert.mjs --src "<…/LaTeX sources/work>" \
//        --out server/content/papers/nsw-ext1 [--papers 01,13] [--figures]
//
// Reads each paper's paper.tex and guidelines.tex (read-only), and writes
//   <out>/structured/<paper id>.json   the structured paper (format pri-paper-v1)
//   <out>/figures/<paper id>/<name>.svg  every diagram the paper uses (--figures; needs TeX + PyMuPDF)
//   <out>/conversion-report.json       per paper: what was read, what is a gap
//
// The paper → sections → questions → parts shape, the answer types, the draft
// marking scheme and the sample answers come from the owner's LaTeX. What a
// final-answer KEY is, is NOT guessed from prose: keys are hand-written and
// verified in tools/papers/overrides/<paper id>.json (Section I keys come from
// the guidelines' own answer table and are cross-checked there). A part with
// no override is `answerType: "open"` (self-check) and is listed as a gap.
//
// Pure parsing lives in parsePaper() below so the tests run it on fixtures.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { envBlocks, matchBrace, readArg, splitItems, stripComments, toBlocks, figNames } from './latex.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/** The papers that ship, with the id the manifest uses: all thirteen (08, 09, 11 and 12 are the scope-revised versions). */
export const CLEARED = Object.freeze(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13']);
export const paperIdOf = n => `ext1-2027-p${String(n).padStart(2, '0')}`;

const roman = n => ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][n] || String(n + 1);
const letter = n => String.fromCharCode(97 + n);

// ── Paper body ───────────────────────────────────────────────────────────────

function bodyOf(tex) {
  const s = stripComments(tex);
  const at = s.indexOf('\\begin{document}');
  return at < 0 ? s : s.slice(at + '\\begin{document}'.length);
}

function parseMarks(text) {
  let marks = null;
  const cleaned = text.replace(/\\p?mk\{(\d+)\}/g, (_, n) => { marks = Number(n); return ''; });
  return { marks, text: cleaned };
}

function optionsOf(inner, notes) {
  // Dialect H: \begin{opts}\item ..\end{opts} or \optgrid{figA}{figB}{figC}{figD}; dialect P: \opts{a}{b}{c}{d}.
  const env = envBlocks(inner, 'opts')[0];
  if (env) {
    const items = splitItems(env.inner.replace(/^\s*\[[^\]]*\]/, ''));
    return { start: inner.indexOf('\\begin{opts}'), options: items.map((t, i) => ({ label: 'ABCD'[i], blocks: toBlocks(t, notes) })) };
  }
  const m = inner.match(/\\(opts|optsf|optgrid)(?![A-Za-z])/);
  if (!m) return null;
  const args = [];
  let at = m.index + m[0].length;
  for (let i = 0; i < 4; i += 1) {
    const a = readArg(inner, at);
    if (!a) break;
    args.push(a.text);
    at = a.end;
  }
  if (args.length !== 4) { notes.add('multiple-choice options could not be read'); return null; }
  return { start: m.index, options: args.map((t, i) => ({ label: 'ABCD'[i], blocks: toBlocks(t, notes) })) };
}

function parseMcqs(region, notes) {
  const out = [];
  for (const block of envBlocks(region, 'mcq')) {
    let inner = block.inner;
    let number = null;
    const numbered = readArg(inner, 0);
    // dialect H: \begin{mcq}{N}; dialect P numbers them by counter.
    if (numbered && /^\d+$/.test(numbered.text.trim()) && inner.slice(0, numbered.start).trim() === '') {
      number = Number(numbered.text.trim());
      inner = inner.slice(numbered.end);
    }
    const found = optionsOf(inner, notes);
    const stem = found ? inner.slice(0, found.start) : inner;
    // dialect P puts \item[\textbf{\themcq}\hfill] first
    const stemBlocks = toBlocks(stem.replace(/^\s*\\begin\{list\}[\s\S]*?\\item\[[^\]]*\]/, ''), notes);
    // "Which graph …" with the four graphs drawn, lettered, inside one figure: the options are only the letters.
    const lettersOnly = !found && stemBlocks.some(b => b.k === 'fig');
    if (lettersOnly) notes.add(`Q${number ?? out.length + 1}: options are the lettered graphs inside the figure`);
    out.push({ number, stem: stemBlocks, options: found?.options ?? (lettersOnly ? ['A', 'B', 'C', 'D'].map(label => ({ label, blocks: [] })) : null), lettersOnly });
  }
  out.forEach((q, i) => { q.number = q.number ?? i + 1; });
  return out;
}

function leafFrom(text, notes) {
  const { marks, text: t } = parseMarks(text);
  const blocks = toBlocks(t, notes);
  return { marks, prompt: blocks };
}

function parseParts(region, qno, notes) {
  const out = [];
  let counter = 0;
  let first = true;
  for (const env of envBlocks(region, 'parts')) {
    let inner = env.inner;
    const opt = inner.match(/^\s*\[([^\]]*)\]/);
    if (opt) {
      inner = inner.slice(opt[0].length);
      const start = opt[1].match(/start=(\d+)/);
      if (start) counter = Number(start[1]) - 1;
      else if (!/resume/.test(opt[1]) && first) counter = 0;
    } else if (first) counter = 0;
    first = false;
    for (const item of splitItems(inner)) {
      const label = `(${letter(counter)})`;
      const id = `q${qno}${letter(counter)}`;
      counter += 1;
      const subEnvs = [...envBlocks(item, 'subparts'), ...envBlocks(item, 'subpartsfrom')].sort((x, y) => x.start - y.start);
      if (!subEnvs.length) {
        const leaf = leafFrom(item, notes);
        out.push({ id, label, ...leaf });
        continue;
      }
      const head = item.slice(0, subEnvs[0].start);
      let sub = 0;
      const parts = [];
      let carry = '';
      subEnvs.forEach((env, k) => {
        let inside = env.inner;
        const from = env.whole.startsWith('\\begin{subpartsfrom}') ? readArg(inside, 0) : null;
        if (from) { sub = Number(from.text) - 1; inside = inside.slice(from.end); }
        splitItems(inside).forEach((t, j) => {
          const leaf = leafFrom(t, notes);
          // text standing between two subparts lists belongs to the part that follows it
          if (j === 0 && carry.trim()) leaf.prompt = [...toBlocks(carry, notes), ...leaf.prompt];
          parts.push({ id: `${id}-${roman(sub)}`, label: `(${roman(sub)})`, ...leaf });
          sub += 1;
        });
        carry = item.slice(env.end, subEnvs[k + 1]?.start ?? item.length);
        if (!subEnvs[k + 1] && carry.trim() && toBlocks(carry, notes).length) notes.add(`text after the subparts of ${id} was not kept`);
      });
      const stem = parseMarks(head);
      out.push({ id, label, marks: parts.reduce((a, p) => a + (p.marks || 0), 0), prompt: toBlocks(stem.text, notes), parts });
    }
  }
  return out;
}

const QUESTION_HEADS = [
  /\\textbf\{Question (\d+)\}\s*\((\d+) marks\)/g,
  /\\qhead\{(\d+)\}\{(\d+)\}/g
];

/** Parse paper.tex. Returns { dialect, sectionI, sectionII, figures, notes }. */
export function parsePaper(tex) {
  const notes = new Set();
  const body = bodyOf(tex);
  const dialect = /\\begin\{mcq\}\s*\{/.test(body) ? 'hscx7' : 'prithagoras-13';
  const sec2 = body.search(/Section II\}/);
  const region1 = sec2 < 0 ? body : body.slice(0, sec2);
  const region2 = sec2 < 0 ? '' : body.slice(sec2);
  const mcqs = parseMcqs(region1, notes);

  // Question headers, in order of appearance.
  const heads = [];
  for (const re of QUESTION_HEADS) for (const m of region2.matchAll(re)) heads.push({ at: m.index, end: m.index + m[0].length, number: Number(m[1]), marks: Number(m[2]) });
  for (const m of region2.matchAll(/\\qx\{(\d+)\}/g)) heads.push({ at: m.index, end: m.index + m[0].length, number: Number(m[1]), marks: 15 });
  heads.sort((a, b) => a.at - b.at);
  const questions = heads.map((h, i) => {
    let slice = region2.slice(h.end, heads[i + 1]?.at ?? region2.length);
    slice = slice.replace(/\\qcontinues\{[^}]*\}\{[^}]*\}|\\qcontfoot\{[^}]*\}\{[^}]*\}|\\qcont\{[^}]*\}|\\qend\{[^}]*\}|\\clearpage|\\turnover|\\paperend|\\label\{[^}]*\}/g, '');
    const firstParts = slice.indexOf('\\begin{parts}');
    const stemText = firstParts < 0 ? slice : slice.slice(0, firstParts);
    const stem = toBlocks(stemText.replace(/Use the Question \d+ Writing Booklet/, ''), notes).filter(b => !(b.k === 'p' && /Writing Booklet|End of paper|BLANK PAGE|Please turn over|continues on page/i.test(b.t)));
    return { number: h.number, marks: h.marks, stem, parts: parseParts(slice, h.number, notes) };
  });

  const figures = [...new Set([...mcqs.flatMap(q => [...q.stem, ...(q.options || []).flatMap(o => o.blocks)]), ...questions.flatMap(q => [q.stem, ...walk(q.parts)].flat())]
    .filter(b => b?.k === 'fig').map(b => b.name))];
  return { dialect, sectionI: mcqs, sectionII: questions, figures, notes: [...notes] };
}

function* leaves(parts) {
  for (const p of parts) { if (p.parts) yield* leaves(p.parts); else yield p; }
}
const walk = parts => parts.flatMap(p => [p.prompt, ...(p.parts ? walk(p.parts) : [])]).flat();
export { leaves };

// ── Guidelines ───────────────────────────────────────────────────────────────

const idOfHeading = h => {
  const m = String(h).replace(/Question\s*/i, '').trim().match(/^(\d+)\s*((?:\([a-z]\))?)\s*((?:\([ivx]+\))?)/i);
  if (!m) return null;
  return `q${m[1]}${m[2] ? m[2].replace(/[()]/g, '') : ''}${m[3] ? '-' + m[3].replace(/[()]/g, '') : ''}`;
};

function parseCriteria(src, notes) {
  const out = [];
  const re = /\\(?:cri|crow)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(src, open);
    const marks = readArg(src, close + 1);
    if (close < 0 || !marks) { notes.add('a marking criterion could not be read'); continue; }
    out.push({ text: toBlocks(src.slice(open + 1, close), notes), marks: Number(marks.text.trim()) });
    re.lastIndex = marks.end;
  }
  return out;
}

function sectionsAfterSa(text, notes) {
  const marks = {};
  const cut = (label, key) => {
    const at = text.indexOf(label);
    if (at < 0) return;
    marks[key] = at;
  };
  cut("\\textbf{Marker's note.}", 'markerNote');
  cut('\\textbf{Common errors.}', 'commonErrors');
  cut('\\textit{Common errors:}', 'commonErrors2');
  const order = Object.entries(marks).sort((a, b) => a[1] - b[1]);
  const first = order.length ? order[0][1] : text.length;
  const result = { sample: toBlocks(text.slice(0, first), notes), markerNote: null, commonErrors: null };
  order.forEach(([key, at], i) => {
    const end = order[i + 1]?.[1] ?? text.length;
    const body = text.slice(at, end).replace(/^\\textbf\{[^}]*\}|^\\textit\{[^}]*\}/, '');
    const blocks = toBlocks(body, notes);
    if (key === 'markerNote') result.markerNote = blocks;
    else result.commonErrors = [...(result.commonErrors || []), ...blocks];
  });
  return result;
}

/** Parse guidelines.tex: Section I keys + reasoning, Section II criteria + sample answers, mapping grid. */
export function parseGuidelines(tex) {
  const notes = new Set();
  const s = bodyOf(tex);
  const keys = {};
  const reasoning = {};
  // Dialect H: "Q & Key & Reasoning" rows. Dialect P: a Question/Answer table + "\textbf{N (X)}" paragraphs.
  for (const row of s.matchAll(/(?:^|\\hline)\s*(\d{1,2})\s*&\s*([ABCD])\s*&\s*([\s\S]*?)\\\\/g)) {
    keys[row[1]] = row[2];
    reasoning[row[1]] = toBlocks(row[3], notes);
  }
  const answerRow = s.match(/\\textbf\{Answer\}\s*((?:&\s*[ABCD]\s*)+)\\\\/);
  if (answerRow) [...answerRow[1].matchAll(/&\s*([ABCD])/g)].forEach((m, i) => { keys[String(i + 1)] = m[1]; });
  const paraRe = /\\textbf\{(\d{1,2}) \(([ABCD])\)\}\\ \\ /g;
  const marks = [...s.matchAll(paraRe)];
  marks.forEach((m, i) => {
    const end = marks[i + 1]?.index ?? s.search(/\\clearpage\s*\\textbf\{\\large Section II/);
    const chunk = s.slice(m.index + m[0].length, end < 0 ? undefined : end);
    keys[m[1]] = keys[m[1]] ?? m[2];
    reasoning[m[1]] = toBlocks(chunk, notes);
  });

  // Section II: \gq{..} (H) or \qh{Question ..}{n marks} (P)
  const heads = [];
  for (const m of s.matchAll(/\\gq\{([^}]*)\}/g)) heads.push({ at: m.index, end: m.index + m[0].length, id: idOfHeading(m[1]) });
  for (const m of s.matchAll(/\\qh\{(Question [^}]*)\}\{[^}]*\}/g)) heads.push({ at: m.index, end: m.index + m[0].length, id: idOfHeading(m[1]) });
  heads.sort((a, b) => a.at - b.at);
  const mappingAt = s.search(/Mapping grid/i);
  const entries = {};
  heads.forEach((h, i) => {
    let end = heads[i + 1]?.at ?? s.length;
    if (mappingAt > h.at && mappingAt < end) end = mappingAt;
    const chunk = s.slice(h.end, end);
    const crit = envBlocks(chunk, 'crit')[0];
    const critSrc = crit ? crit.inner : '';
    const afterCrit = crit ? chunk.slice(crit.end) : chunk;
    const saAt = afterCrit.indexOf('\\sa');
    let rest = saAt < 0 ? '' : afterCrit.slice(saAt + 3);
    const footer = rest.search(/\\clearpage|\\vfill|\\fbox|\\begin\{tikzpicture\}|\\prifoot|\\end\{document\}/);
    if (footer >= 0) rest = rest.slice(0, footer);
    const parts = sectionsAfterSa(rest.replace(/\\clearpage\s*$/, '').replace(/\\end\{document\}[\s\S]*$/, ''), notes);
    if (!h.id) { notes.add('a guideline heading could not be read'); return; }
    entries[h.id] = { criteria: parseCriteria(critSrc, notes), sampleAnswer: parts.sample, markerNote: parts.markerNote, commonErrors: parts.commonErrors };
  });

  // Mapping grid: "11 (a) & 8 & content & outcomes & band"
  const mapping = {};
  if (mappingAt >= 0) {
    for (const row of s.slice(mappingAt).matchAll(/(?:^|\\hline)\s*(\d{1,2}(?:\s*\([a-z]\))?(?:\s*\([ivx]+\))?)\s*&\s*(\d+)\s*&([^&]*)&([^&]*)&([^&\\]*)\\\\/g)) {
      mapping[idOfHeading(row[1])] = { marks: Number(row[2]), content: inlineStrip(row[3]), outcomes: normalizeOutcomes(inlineStrip(row[4])), band: inlineStrip(row[5]) };
    }
  }
  return { keys, reasoning, entries, mapping, notes: [...notes] };
}
/** Syllabus outcomes as the mapping grid writes them: "ME1-11-01, 11-03" and "ME1-12-04; MA-C3" become ["ME1-11-01","ME1-11-03"] and ["ME1-12-04"]. */
export function normalizeOutcomes(text) {
  const out = [];
  for (const raw of String(text).split(/[;,]\s*/)) {
    const t = raw.trim().replace(/\s+/g, '');
    const code = /^\d{2}-\d{2}$/.test(t) ? `ME1-${t}` : t;
    if (/^ME1-\d{2}-\d{2}$/.test(code) && !out.includes(code)) out.push(code);
  }
  return out;
}
const inlineStrip = t => toBlocks(t).map(b => b.t || '').join(' ').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────

const DRAFT_SCHEME = Object.freeze({ status: 'draft', note: 'The marking guideline as written by the author. Not approved for criterion marks.' });

/** Classify a part by what it asks for (heuristic; keys come from the overrides, never from this). */
export function classify(promptBlocks) {
  const text = promptBlocks.filter(b => b.k === 'p').map(b => b.t).join(' ').replace(/\$[^$]*\$/g, ' x ').trim();
  if (/\b(sketch|draw)\b/i.test(text)) return 'sketch';
  if (/\bprove\b|by mathematical induction|\bshow that\b|\bdeduce that\b|\bverify that\b|\bdemonstrate\b/i.test(text)) return 'show-that';
  if (/\b(explain|justify|describe|comment)\b/i.test(text)) return 'proof-explain';
  return 'open';
}

const figsOf = blocks => (blocks || []).filter(b => b.k === 'fig').map(b => b.name);
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Merge a parsed paper and its guidelines (and hand-written overrides) into pri-paper-v1. */
export function assemble({ id, number, paper, guide, overrides = {}, meta = {} }) {
  const report = { id, notes: [...paper.notes.map(n => `paper: ${n}`), ...guide.notes.map(n => `guidelines: ${n}`)], gaps: [], manual: [] };
  const keys = overrides.keys || {};
  // Section I
  const q1 = paper.sectionI.map(q => {
    const key = guide.keys[String(q.number)] || null;
    if (!key) report.gaps.push(`Q${q.number}: no key in the guidelines`);
    if (!q.options) report.gaps.push(`Q${q.number}: options not read`);
    return {
      id: `q${q.number}`, number: q.number, marks: 1, stem: q.stem, figures: figsOf(q.stem),
      parts: [{
        id: `q${q.number}`, label: '', marks: 1, prompt: [], answerType: 'mcq', options: q.options,
        figureOptions: q.lettersOnly === true || !!q.options?.some(o => o.blocks.some(b => b.k === 'fig')),
        key: key ? { type: 'mcq', answer: key } : null,
        autoMarks: key ? 1 : 0,
        criteria: [{ text: [{ k: 'p', t: 'Correct option.' }], marks: 1 }],
        sampleAnswer: guide.reasoning[String(q.number)] || [],
        classification: { content: guide.mapping[`q${q.number}`]?.content || null, outcomes: guide.mapping[`q${q.number}`]?.outcomes || [] }
      }]
    };
  });
  // Section II
  const q2 = paper.sectionII.map(q => {
    const decorate = part => {
      if (part.parts) {
        part.parts.forEach(decorate);
        part.answerType = 'group'; part.criteria = []; part.sampleAnswer = []; part.figures = figsOf(part.prompt);
        return;
      }
      const e = guide.entries[part.id];
      const o = keys[part.id] || null;
      if (part.marks == null) report.gaps.push(`${part.id}: marks not found in the paper`);
      if (!e) report.gaps.push(`${part.id}: no marking guideline entry`);
      else {
        const top = Math.max(0, ...e.criteria.map(c => c.marks));
        if (top !== part.marks) report.gaps.push(`${part.id}: guideline top criterion ${top} marks vs ${part.marks} in the paper`);
      }
      part.criteria = e?.criteria || [];
      part.sampleAnswer = e?.sampleAnswer || [];
      if (e?.markerNote) part.markerNote = e.markerNote;
      if (e?.commonErrors) part.commonErrors = e.commonErrors;
      part.classification = { content: guide.mapping[part.id]?.content || guide.mapping[part.id.replace(/-.*/, '')]?.content || null, outcomes: guide.mapping[part.id]?.outcomes || guide.mapping[part.id.replace(/-.*/, '')]?.outcomes || [] };
      part.figures = figsOf(part.prompt);
      if (o) {
        part.answerType = o.answerType;
        part.key = o.key;
        part.autoMarks = Number(o.autoMarks ?? 0);
        const suffix = o.answerSuffix ?? o.key?.answerSuffix;
        if (suffix) part.answerSuffix = suffix;
        if (o.key?.answerSuffix) { part.key = { ...o.key }; delete part.key.answerSuffix; }
        if (o.keyChecks) part.keyChecks = o.keyChecks;
      } else {
        part.answerType = classify(part.prompt);
        part.key = null;
        part.autoMarks = 0;
        if (part.answerType === 'open') report.gaps.push(`${part.id}: a find/calculate part with no key yet (self-check until one is written and verified)`);
      }
    };
    q.parts.forEach(decorate);
    const stemFigs = figsOf(q.stem);
    return { id: `q${q.number}`, number: q.number, marks: q.marks, stem: q.stem, figures: stemFigs, parts: q.parts };
  });

  const leafIds = new Set(q2.flatMap(q => [...leaves(q.parts)]).map(p => p.id));
  for (const id2 of Object.keys(keys)) if (!leafIds.has(id2)) report.gaps.push(`override key ${id2} matches no part of the paper`);
  // Totals check
  const all = [...q1.flatMap(q => q.parts), ...q2.flatMap(q => [...leaves(q.parts)])];
  const total = all.reduce((a, p) => a + (p.marks || 0), 0);
  if (total !== (meta.totalMarks ?? 70)) report.gaps.push(`marks add to ${total}, the paper says ${meta.totalMarks ?? 70}`);
  for (const q of q2) {
    const sum = [...leaves(q.parts)].reduce((a, p) => a + (p.marks || 0), 0);
    if (sum !== q.marks) report.gaps.push(`Question ${q.number}: parts add to ${sum}, the question says ${q.marks}`);
  }
  const auto = all.reduce((a, p) => a + (p.autoMarks || 0), 0);
  report.counts = { totalMarks: total, mcq: q1.length, section2Leaves: q2.flatMap(q => [...leaves(q.parts)]).length,
    autoMarks: auto, selfCheckMarks: total - auto, keyedSection2Parts: q2.flatMap(q => [...leaves(q.parts)]).filter(p => p.key).length };

  const paperDoc = {
    format: 'pri-paper-v1', id, paperNumber: number, title: `Practice Paper ${number}`,
    course: 'nsw-ext1', edition: 'prithagoras', year: 2027, totalMarks: total,
    readingTime: meta.readingTime || '10 minutes', workingTime: meta.workingTime || '2 hours',
    markingScheme: { ...DRAFT_SCHEME, digest: null },
    sections: [
      { id: 'I', title: 'Section I', marks: q1.length, minutes: 15, instructions: 'Attempt Questions 1 to 10. Allow about 15 minutes for this section.', questions: q1 },
      { id: 'II', title: 'Section II', marks: q2.reduce((a, q) => a + q.marks, 0), minutes: 105, instructions: 'Attempt Questions 11 to 14. Allow about 1 hour and 45 minutes for this section. Show relevant mathematical reasoning and/or calculations.', questions: q2 }
    ],
    figures: paper.figures
  };
  // The digest an approval record names: the criteria text and marks only, so an
  // approval can never be read as covering text that changed after it.
  paperDoc.markingScheme.digest = sha(all.map(p => ({ id: p.id, criteria: p.criteria })));
  return { paperDoc, report };
}

// ── Katex check ──────────────────────────────────────────────────────────────

export function katexIssues(doc) {
  const require = createRequire(join(ROOT, 'client', 'package.json'));
  const katex = require('katex');
  const bad = [];
  const check = (where, tex) => { try { katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }); } catch (e) { bad.push(`${where}: ${String(e.message).slice(0, 90)}`); } };
  const visitBlocks = (where, blocks) => (blocks || []).forEach(b => {
    if (b.k === 'math') check(where, b.t);
    else if (b.k === 'p') for (const m of b.t.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) check(where, m[1]);
    else if (b.k === 'list') b.items.forEach(it => { for (const m of it.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) check(where, m[1]); });
  });
  const visitPart = p => {
    visitBlocks(p.id, p.prompt); visitBlocks(`${p.id} sample`, p.sampleAnswer);
    (p.criteria || []).forEach(c => visitBlocks(`${p.id} criterion`, c.text));
    (p.options || []).forEach(o => visitBlocks(`${p.id} option`, o.blocks));
    (p.parts || []).forEach(visitPart);
  };
  for (const s of doc.sections) for (const q of s.questions) { visitBlocks(q.id, q.stem); q.parts.forEach(visitPart); }
  return bad;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

// Every HSC Mathematics Extension 1 paper is 70 marks (10 + 60).
function readMeta() { return { totalMarks: 70 }; }

async function main() {
  const args = process.argv.slice(2);
  const get = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const src = get('--src');
  const out = resolve(get('--out') || join(ROOT, 'server/content/papers/nsw-ext1'));
  const only = (get('--papers') || CLEARED.join(',')).split(',');
  const withFigures = args.includes('--figures');
  if (!src) { console.error('usage: convert.mjs --src <work dir> [--out dir] [--papers 01,13] [--figures]'); process.exit(2); }
  mkdirSync(join(out, 'structured'), { recursive: true });
  const reports = {};
  for (const n of only) {
    if (!CLEARED.includes(n)) { console.error(`Paper ${n} is not cleared to ship; skipped.`); continue; }
    const dir = join(src, `Paper ${n}`, 'LaTeX');
    const paperTex = readFileSync(join(dir, 'paper.tex'), 'utf8');
    const guideTex = readFileSync(join(dir, 'guidelines.tex'), 'utf8');
    const id = paperIdOf(n);
    const overridePath = join(HERE, 'overrides', `${id}.json`);
    const overrides = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, 'utf8')) : {};
    const { paperDoc, report } = assemble({ id, number: Number(n), paper: parsePaper(paperTex), guide: parseGuidelines(guideTex), overrides, meta: readMeta() });
    const bad = katexIssues(paperDoc);
    report.katex = bad;
    writeFileSync(join(out, 'structured', `${id}.json`), JSON.stringify(paperDoc, null, 1) + '\n');
    if (withFigures) {
      const figDir = join(out, 'figures', id);
      mkdirSync(figDir, { recursive: true });
      const figsFile = readdirSync(dir).find(f => /figs\.tex$/.test(f));
      execFileSync('python3', [join(HERE, 'render_figures.py'), dir, figDir, figsFile, ...paperDoc.figures], { stdio: 'inherit' });
    }
    reports[id] = report;
    console.log(`${id}: ${report.counts.totalMarks} marks, ${report.counts.keyedSection2Parts} keyed Section II parts, ${report.gaps.length} gaps, ${bad.length} maths problems`);
  }
  // A run over some papers keeps the report entries of the others.
  const reportFile = join(out, 'conversion-report.json');
  const before = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
  const merged = Object.fromEntries(Object.entries({ ...before, ...reports }).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(reportFile, JSON.stringify(merged, null, 1) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
