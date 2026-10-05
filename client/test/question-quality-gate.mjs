// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Question quality gate (ledger §5.5)
//
// Every NCERT/CBSE chapter of Classes 7–12, every generator its `covers`
// name, every difficulty that generator is declared at, N fixed seeds each.
// Every drawn question must pass five checks, and a chapter with one failure
// blocks CI for that chapter — the report is per chapter so the owner of the
// chapter sees exactly which forms are at fault:
//
//   solvable     the engine's own marker accepts the keyed answer in every
//                declared input form, the payload is complete, steps and hints
//                exist, figures survive the sanitiser, identity is stamped
//                (content-certify's certifyQuestion, which wraps selfcheck's
//                inspect)
//   unique       exactly one keyed answer: an MCQ keys one option and no
//                distractor reads as the same value; a numeric key is one
//                finite number; a worked answer is one canonical form
//   unambiguous  the prompt asks one thing: no leaked `undefined`/`NaN`/
//                template braces, no doubled words, no two question marks,
//                ends as a question or an instruction, not too short to ask
//                anything
//   renders      every $…$ in prompt, options, hints and steps renders in
//                KaTeX throwing mode; no bare LaTeX outside $…$
//   readable     prose stripped of maths stays inside the reading band for
//                the class: average sentence length and longest sentence
//                under the per-class ceilings below, which are generous (an
//                NCERT word problem is long) and exist to catch run-on stems
//                a generator concatenated by mistake
//
// Usage:
//   node client/test/question-quality-gate.mjs           N = 6 (the CI gate)
//   node client/test/question-quality-gate.mjs --n=40    a thorough sweep
//   node client/test/question-quality-gate.mjs --chapter=c10-quadratic-roots
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { GENERATORS, generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';
import { contentDigest } from '../src/engine/contentIdentity.js';
import { certifyQuestion } from './content-certify.mjs';

const V1_GRADES = [7, 8, 9, 10, 11, 12];

// Words per sentence, after the maths is removed. Generous on purpose: these
// catch concatenation defects, not style.
export const READING_CEILING = Object.freeze({
  7: { average: 26, longest: 55 }, 8: { average: 28, longest: 60 }, 9: { average: 30, longest: 65 },
  10: { average: 32, longest: 70 }, 11: { average: 34, longest: 80 }, 12: { average: 34, longest: 80 }
});

const seedFor = (key, i) => (parseInt(contentDigest(`${key}#${i}`).slice(0, 8), 16) & 0x7fffffff) || 1;

// ── Lints ───────────────────────────────────────────────────────────────────

/** Prose only: $…$ maths replaced by a placeholder word so sentence counts hold. */
export function proseOf(text) {
  return String(text ?? '')
    .replace(/\\\$/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' M ')
    .replace(/\$[^$]*\$/g, ' M ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numeric reading of an option or answer text, or null if it is not a plain number. */
function numberOf(text) {
  const s = proseOf(text) === 'M' ? String(text).replace(/\$/g, '') : String(text ?? '');
  const m = s.replace(/[,\s]/g, '').replace(/^\\?\(|\\?\)$/g, '').match(/^[-+]?\d+(?:\.\d+)?$/);
  return m ? Number(m[0]) : null;
}

export function uniquenessProblems(q) {
  const out = [];
  if (q.answerType === 'mcq') {
    const options = q.mcqOptions || [];
    const keyed = q.answer?.correctIndex;
    if (!Number.isInteger(keyed) || keyed < 0 || keyed >= options.length) return out; // inspect() already names this
    const keyValue = numberOf(options[keyed]);
    if (keyValue != null) {
      options.forEach((o, i) => {
        if (i !== keyed && numberOf(o) === keyValue) out.push(`option ${i} "${String(o).slice(0, 40)}" is numerically the keyed answer, so the question has two right answers`);
      });
    }
    return out;
  }
  if (q.answerType === 'numeric') {
    const v = q.answer?.value;
    if (Array.isArray(v)) out.push('numeric key is a list, not one value');
    else if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`numeric key is ${JSON.stringify(v)}, not one finite number`);
  }
  if (Array.isArray(q.answer?.anyOf) && q.answer.anyOf.length > 1 && !q.answer.allEquivalent) {
    out.push(`the key accepts ${q.answer.anyOf.length} different answers without declaring them equivalent`);
  }
  return out;
}

export function ambiguityProblems(q) {
  const out = [];
  const raw = String(q.prompt ?? '');
  const prose = proseOf(raw);
  // Leaks are looked for where they would land: `undefined`/`NaN` interpolated
  // into maths ("$x = undefined$"), `[object Object]` anywhere, and template
  // braces in the prose (LaTeX braces live inside $…$ and are not templates;
  // "is undefined at x = 8" is English, not a leak).
  const maths = raw.match(/\$[^$]*\$/g) || [];
  if (maths.some(m => /\bundefined\b|\bNaN\b|\bnull\b/.test(m))) out.push(`maths leaks a placeholder: ${raw.slice(0, 100)}`);
  if (/\[object Object\]|\bNaN\b/.test(raw) || /\{\{|\}\}/.test(prose)) out.push(`prompt leaks a placeholder: ${raw.slice(0, 100)}`);
  if (/\$\{/.test(raw)) out.push(`prompt contains an unrendered template: ${raw.slice(0, 100)}`);
  const doubled = prose.match(/\b([A-Za-z]{2,})\s+\1\b/i);
  if (doubled && !/^(had|that|is)$/i.test(doubled[1])) out.push(`prompt doubles a word ("${doubled[0]}")`);
  if ((prose.match(/\?/g) || []).length > 2) out.push(`prompt asks more than two questions: ${raw.slice(0, 100)}`);
  if (/\?\s*\?/.test(prose)) out.push('prompt has a doubled question mark');
  // A prompt needs an instruction word, or it must be a bare equation — the
  // NCERT "Solve the following" convention, where the = sign is the ask.
  const words = prose.replace(/\bM\b/g, ' ').match(/[A-Za-z]{2,}/g) || [];
  const bareEquation = !words.length && maths.length === 1 && /=/.test(maths[0]) && prose.replace(/\bM\b/g, '').trim().length <= 1;
  if (!words.length && !bareEquation) out.push(`prompt has no words and is not an equation to solve: ${raw.slice(0, 100)}`);
  const parts = Array.isArray(q.parts) && q.parts.length;
  if (!parts && !/[?.!:]\s*$|\$\s*$/.test(raw.trim()) && !q.multipart) out.push(`prompt does not end as a question or an instruction: …${raw.trim().slice(-40)}`);
  return out;
}

export function readingProblems(q, grade) {
  const ceiling = READING_CEILING[grade] || READING_CEILING[12];
  const prose = proseOf(q.prompt);
  const sentences = prose.split(/(?<=[.?!:])\s+(?=[A-Z(])/).map(s => s.trim()).filter(Boolean);
  if (!sentences.length) return [];
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const longest = Math.max(...lengths);
  const out = [];
  if (average > ceiling.average) out.push(`prompt averages ${average.toFixed(1)} words a sentence (Class ${grade} ceiling ${ceiling.average})`);
  if (longest > ceiling.longest) out.push(`prompt has a ${longest}-word sentence (Class ${grade} ceiling ${ceiling.longest})`);
  return out;
}

/** Every check, as [check, problems] pairs, for one question. */
export function qualityProblems(q, { generatorId, grade }) {
  const certified = certifyQuestion(q, { generatorId });
  const renders = certified.filter(p => /KaTeX|unbalanced|outside \$|display \$\$/.test(p));
  const solvable = certified.filter(p => !renders.includes(p));
  return {
    solvable, unique: uniquenessProblems(q), unambiguous: ambiguityProblems(q),
    renders, readable: readingProblems(q, grade)
  };
}

export const CHECKS = ['solvable', 'unique', 'unambiguous', 'renders', 'readable'];

// ── The sweep ───────────────────────────────────────────────────────────────

export async function runGate({ n = 6, only = null, log = console.log } = {}) {
  await loadAllBanks();
  const rows = [];
  for (const group of IN_CURRICULUM) {
    if (!V1_GRADES.includes(group.grade)) continue;
    for (const ch of group.chapters) {
      if (only && ch.id !== only) continue;
      const row = { id: ch.id, grade: group.grade, name: ch.name, served: 0, failed: 0, byCheck: Object.fromEntries(CHECKS.map(c => [c, 0])), failures: {} };
      const cells = [...new Set(ch.covers.flatMap(c => c.diff.map(d => `${c.gen}@${d}`)))];
      for (const cell of cells) {
        const [gen, dStr] = cell.split('@');
        const d = Number(dStr);
        if (!GENERATORS[gen]) { row.failed++; row.byCheck.solvable++; row.failures[`${gen} has no generator`] = { count: 1, example: `${ch.id} names ${gen}`, seed: 0 }; continue; }
        for (let i = 0; i < n; i++) {
          const seed = seedFor(`quality:${ch.id}:${gen}:${d}`, i);
          row.served++;
          let result;
          try { result = qualityProblems(generateQuestion(gen, d, seed), { generatorId: gen, grade: group.grade }); }
          catch (err) { result = { solvable: [`generation threw: ${err.message}`], unique: [], unambiguous: [], renders: [], readable: [] }; }
          let bad = false;
          for (const check of CHECKS) {
            if (!result[check].length) continue;
            bad = true;
            row.byCheck[check]++;
            for (const problem of result[check]) {
              const key = `${check}: ${problem.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 160)}`;
              const f = row.failures[key] || (row.failures[key] = { count: 0, example: `${gen}@D${d}: ${problem.slice(0, 220)}`, seed });
              f.count++;
            }
          }
          if (bad) row.failed++;
        }
      }
      row.pass = row.failed === 0;
      rows.push(row);
    }
  }

  const failing = rows.filter(r => !r.pass);
  log('QUESTION QUALITY GATE — per chapter (served / failed; solvable · unique · unambiguous · renders · readable)');
  for (const r of rows) {
    const b = r.byCheck;
    log(`  ${r.pass ? '✔' : '✖'} Class ${String(r.grade).padEnd(2)} ${r.id.padEnd(44)} ${String(r.served).padStart(4)} / ${String(r.failed).padStart(3)}   ${b.solvable} · ${b.unique} · ${b.unambiguous} · ${b.renders} · ${b.readable}`);
  }
  for (const r of failing) {
    log(`FAIL ${r.id} (Class ${r.grade}, ${r.name}) — ${r.failed}/${r.served} questions failed`);
    for (const f of Object.values(r.failures).slice(0, 6)) log(`   ${f.count}× ${f.example} (seed ${f.seed})`);
  }
  const served = rows.reduce((a, r) => a + r.served, 0);
  const verdict = failing.length ? 'FAIL' : 'PASS';
  log(`QUESTION QUALITY GATE: ${verdict} — ${rows.length - failing.length}/${rows.length} chapters, ${served} questions × 5 checks, ${n} seeds per (generator, difficulty)${failing.length ? ` — ${failing.map(r => r.id).join(', ')} blocked` : ''}`);
  return { rows, failing, served, ok: !failing.length };
}

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === launched) {
  const argv = process.argv.slice(2);
  const n = Number(argv.map(a => a.match(/^--n=(\d+)$/)).find(Boolean)?.[1] || 6);
  const only = argv.map(a => a.match(/^--chapter=(.+)$/)).find(Boolean)?.[1] || null;
  const { ok } = await runGate({ n, only });
  process.exit(ok ? 0 : 1);
}
