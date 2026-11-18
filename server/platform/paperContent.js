// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · structured exam papers (format pri-paper-v1)
//
// The owner's HSC-format papers as DATA: paper → sections → questions → parts,
// each part with its marks, prompt blocks, answer type, the key where a final
// answer exists, the marking guideline (criteria) as the owner wrote it and
// the sample answer. Produced from his LaTeX by tools/papers/convert.mjs and
// kept in server/content/papers/<course>/structured/, where it is SERVER-SIDE
// content: nothing in a paper is ever sent whole. What a student is shown
// before submitting is publicPaper(): no key, no criteria, no sample answer.
//
// THE MARKING GUIDELINE IS A DRAFT until the owner approves it. Criterion marks
// (the "2 marks for …" numbers) are shown to a student, and relied on, only for
// a scheme that has an approval record in approvals.json whose digest equals
// the scheme's own digest. None exists today. Without one the criteria are
// still shown, as "How this is marked", with no marks beside them.
//
// Pure functions over plain data; the only I/O is reading the content files.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const PAPER_FORMAT = 'pri-paper-v1';
const KEY_TYPES = new Set(['mcq', 'numeric', 'expression', 'exact', 'interval', 'point', 'set', 'equation']);
const ANSWER_TYPES = new Set(['mcq', 'value', 'expression', 'show-that', 'proof-explain', 'sketch', 'open']);

/** Every answerable part of a paper (a part with no children), in paper order. */
export function leafParts(doc) {
  const out = [];
  const walk = (parts, question, section) => {
    for (const part of parts) {
      if (part.parts) walk(part.parts, question, section);
      else out.push({ part, question, section });
    }
  };
  for (const section of doc.sections) for (const question of section.questions) walk(question.parts, question, section);
  return out;
}

/** The leaves a sitting covers: the whole paper, or one question of it. */
export function scopedLeaves(doc, scope) {
  const all = leafParts(doc);
  return scope?.question ? all.filter(l => l.question.number === scope.question && l.section.id === (scope.section || l.section.id)) : all;
}

function fail(doc, message) { throw new Error(`structured paper ${doc?.id}: ${message}`); }

/** Fail closed at startup: a paper the server cannot read exactly is not offered. */
export function validateStructured(doc) {
  if (doc?.format !== PAPER_FORMAT) fail(doc, 'unknown format');
  if (!/^[a-z0-9-]{3,60}$/.test(doc.id)) fail(doc, 'bad id');
  let marks = 0;
  const seen = new Set();
  for (const { part } of leafParts(doc)) {
    if (!/^q\d{1,2}[a-z]?(-[ivx]+)?$/.test(part.id) || seen.has(part.id)) fail(doc, `bad or repeated part id ${part.id}`);
    seen.add(part.id);
    if (!Number.isInteger(part.marks) || part.marks < 1) fail(doc, `${part.id}: marks`);
    if (!ANSWER_TYPES.has(part.answerType)) fail(doc, `${part.id}: answer type ${part.answerType}`);
    if (part.key) {
      if (!KEY_TYPES.has(part.key.type)) fail(doc, `${part.id}: key type`);
      if (part.key.type === 'mcq' && !/^[ABCD]$/.test(part.key.answer)) fail(doc, `${part.id}: mcq key`);
      if (part.key.type === 'numeric' && !Number.isFinite(part.key.value)) fail(doc, `${part.id}: numeric key`);
      if (part.key.type === 'expression' && (typeof part.key.expr !== 'string' || !part.key.expr)) fail(doc, `${part.id}: expression key`);
      if (part.key.type === 'exact' && !(/^-?\d{1,400}$/.test(part.key.n || '') && /^\d{1,400}$/.test(part.key.d || '') && /[1-9]/.test(part.key.d))) fail(doc, `${part.id}: exact key`);
      if (part.key.type === 'interval' && (typeof part.key.region !== 'string' || !part.key.region)) fail(doc, `${part.id}: interval key`);
      if (part.key.type === 'point' && !(Number.isFinite(part.key.x) && Number.isFinite(part.key.y))) fail(doc, `${part.id}: point key`);
      if (part.key.type === 'set' && !(Array.isArray(part.key.values) && part.key.values.length && part.key.values.every(Number.isFinite))) fail(doc, `${part.id}: set key`);
      if (part.key.type === 'equation' && !(typeof part.key.lhs === 'string' && typeof part.key.rhs === 'string')) fail(doc, `${part.id}: equation key`);
      if (part.key.names !== undefined && !(part.key.type === 'expression' && Object.entries(part.key.names).every(([k, v]) => /^[A-Za-z]_?\{?[A-Za-z0-9]{1,3}\}?$/.test(k) && /^[A-Za-z]$/.test(v)))) fail(doc, `${part.id}: names`);
    }
    if (part.answerType === 'mcq' && (!part.options || part.options.length !== 4)) fail(doc, `${part.id}: options`);
    if (!Number.isInteger(part.autoMarks) || part.autoMarks < 0 || part.autoMarks > part.marks) fail(doc, `${part.id}: autoMarks`);
    if (part.autoMarks > 0 && !part.key) fail(doc, `${part.id}: auto marks without a key`);
    if (part.key && part.autoMarks === 0) fail(doc, `${part.id}: a key that earns nothing`);
    marks += part.marks;
  }
  if (marks !== doc.totalMarks) fail(doc, `marks add to ${marks}, not ${doc.totalMarks}`);
  return doc;
}

/** Load every structured paper in <dir>/structured/. */
export function loadStructuredPapers(dir) {
  const folder = join(dir, 'structured');
  const out = new Map();
  if (!existsSync(folder)) return out;
  for (const file of readdirSync(folder).filter(f => f.endsWith('.json')).sort()) {
    const doc = validateStructured(JSON.parse(readFileSync(join(folder, file), 'utf8')));
    out.set(doc.id, doc);
  }
  return out;
}

/** Owner approvals of marking schemes: [{ paperId, schemeDigest, approvedBy, approvedAt }]. None today. */
export function loadApprovals(dir) {
  const file = join(dir, 'approvals.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(data?.approvals) ? data.approvals.filter(a => a && typeof a.paperId === 'string' && /^[0-9a-f]{64}$/.test(a.schemeDigest || '')) : [];
}

/** Is THIS text of this paper's scheme the one the owner approved? (A digest, so edited text is unapproved.) */
export function schemeApproved(doc, approvals) {
  return approvals.some(a => a.paperId === doc.id && a.schemeDigest === doc.markingScheme?.digest);
}

// ── What a student may see before submitting ─────────────────────────────────

const PUBLIC_PART = ['id', 'label', 'marks', 'prompt', 'figures', 'answerType', 'options', 'figureOptions', 'answerSuffix', 'autoMarks'];

function publicPart(part) {
  if (part.parts) return { id: part.id, label: part.label, marks: part.marks, prompt: part.prompt, figures: part.figures || [], parts: part.parts.map(publicPart) };
  const out = {};
  for (const k of PUBLIC_PART) if (part[k] !== undefined) out[k] = part[k];
  // Who will check it, told before the student writes: Pri's engine (a final answer) or the student (against the guideline).
  out.checks = part.key ? 'pri' : 'self';
  return out;
}

/** The paper as issued: stems, parts, options and figures. No key, criterion, sample answer or note. */
export function publicPaper(doc, scope = null) {
  const keep = scope?.question ? new Set(scopedLeaves(doc, scope).map(l => l.question.number)) : null;
  return {
    id: doc.id, title: doc.title, totalMarks: scope?.question ? scopedLeaves(doc, scope).reduce((a, l) => a + l.part.marks, 0) : doc.totalMarks,
    readingTime: doc.readingTime, workingTime: doc.workingTime,
    sections: doc.sections.map(s => ({
      id: s.id, title: s.title, marks: s.marks, minutes: s.minutes, instructions: s.instructions,
      questions: s.questions.filter(q => !keep || (keep.has(q.number) && (!scope.section || scope.section === s.id)))
        .map(q => ({ id: q.id, number: q.number, marks: q.marks, stem: q.stem, figures: q.figures || [], parts: q.parts.map(publicPart) }))
    })).filter(s => s.questions.length)
  };
}

// ── The deterministic engine's view of a keyed part ──────────────────────────

const text = blocks => (blocks || []).map(b => (b.k === 'list' ? b.items.join(' ') : b.k === 'p' || b.k === 'math' ? b.t : '')).join(' ').replace(/\s+/g, ' ').trim();

/** The question text the engine's unit and label checks read: the stem and every prompt above the part. */
export function promptFor(doc, leaf) {
  const chain = [leaf.question.stem];
  const find = (parts, trail) => {
    for (const p of parts) {
      if (p === leaf.part) return [...trail, p.prompt];
      if (p.parts) { const hit = find(p.parts, [...trail, p.prompt]); if (hit) return hit; }
    }
    return null;
  };
  return text(chain.concat(find(leaf.question.parts, []) || []).flat());
}

/** The engine question for a keyed part (the key never leaves the server). null when the part has no key. */
export function engineQuestion(doc, leaf) {
  const { part } = leaf;
  const key = part.key;
  if (!key) return null;
  const prompt = promptFor(doc, leaf);
  if (key.type === 'mcq') return { answerType: 'mcq', prompt, answer: { correctIndex: 'ABCD'.indexOf(key.answer) } };
  if (key.type === 'numeric') {
    return { answerType: 'numeric', prompt, answer: { value: key.value, ...(key.angle ? { angle: key.angle } : {}), ...(key.tol != null ? { tol: key.tol } : {}) }, ...(part.answerSuffix ? { answerSuffix: part.answerSuffix } : {}) };
  }
  // The paper's own answer forms (checker-core.js): an exact rational, an interval, a coordinate pair, a set of values, an equation.
  if (key.type === 'exact') return { answerType: 'exact-rational', prompt, answer: { n: key.n, d: key.d } };
  if (key.type === 'interval') return { answerType: 'interval', prompt, answer: { region: key.region, variable: key.variable || 'x' } };
  if (key.type === 'point') return { answerType: 'point', prompt, answer: { x: key.x, y: key.y } };
  if (key.type === 'set') return { answerType: 'set', prompt, answer: { values: key.values, ...(key.tol != null ? { tol: key.tol } : {}) } };
  if (key.type === 'equation') return { answerType: 'equation', prompt, answer: { lhs: key.lhs, rhs: key.rhs } };
  return { answerType: 'expression', prompt, answer: { expr: key.expr, ...(key.anyOf?.length ? { anyOf: key.anyOf } : {}), ...(key.names ? { names: key.names } : {}) } };
}

/** Milliseconds from a paper's stated "10 minutes" / "2 hours" / "1 hour and 45 minutes". */
export function statedTime(label) {
  const s = String(label || '');
  const h = Number(s.match(/(\d+)\s*hour/)?.[1] || 0);
  const m = Number(s.match(/(\d+)\s*minute/)?.[1] || 0);
  return (h * 60 + m) * 60000;
}

/** What "How this is marked" shows: the criteria text, and their marks only for an approved scheme. */
export function howMarked(part, approved) {
  return (part.criteria || []).map(c => ({ text: c.text, ...(approved ? { marks: c.marks } : {}) }));
}
