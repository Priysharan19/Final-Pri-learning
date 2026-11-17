#!/usr/bin/env node
// Pri Learning · notes coverage against Experience 3 of the Learning Experience Standard.
//
// Experience 3 (docs/product/PRI_LEARNING_STANDARD.md): objective, prerequisites, intuition,
// formal statement, worked examples, misconceptions, an independent checkpoint, and the next
// step into Practice with context; the diagram and the reasoning stay together.
//
// For every chapter or topic of every curriculum both editions teach, this loads the notes the
// app would load (the same loaders the pages use) and records which sections exist, how many
// teaching diagrams it draws, whether one is interactive, and whether its mathematics is all
// KaTeX. Nothing here is typed by hand: the report is computed from the content.
//
//   node tools/notes-coverage.mjs            print the summary
//   node tools/notes-coverage.mjs --write    rewrite docs/content/notes-coverage-<DATE>.md
//   node tools/notes-coverage.mjs --json     print every row as JSON
//
// client/test/notes-coverage-check.mjs fails when the committed report is stale or when a
// chapter falls below the standard without being on that test's REMAINING list.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = rel => import(pathToFileURL(join(ROOT, rel)).href);
export const REPORT_DATE = '2026-11-18';
export const REPORT_PATH = join(ROOT, `docs/content/notes-coverage-${REPORT_DATE}.md`);

// The eight Experience 3 sections, in the standard's order.
export const SECTIONS = Object.freeze(['objective', 'prerequisites', 'intuition', 'formal', 'examples', 'misconceptions', 'checkpoint', 'practice']);
export const MIN_DIAGRAMS = 2;
const MIN_EXAMPLES = 2;
const MIN_CHECKPOINT = 2;
const MIN_REASON = 40; // a "no interactive helps here" reason has to say why

// Maths outside KaTeX: Unicode super/subscripts, root and operator glyphs typed as text, and the
// generator tells ("1x", "+(-3)") that read as machine output. Only text OUTSIDE $…$ is scanned.
const UNICODE_MATH = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋√∛∑∏∫≤≥≠×÷−]/u;
const MACHINE_TELL = /(^|[^\w.])1[a-z](?![a-z])|[+\-−]\s*\(\s*-|\(\s*-?\d+\s*\)\s*[a-z]\b/;
const outsideMath = s => String(s ?? '').replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' ');

function proseOf(n) {
  const out = [n.summary, n.objective, n.intuition];
  for (const c of n.concepts || []) out.push(c.title, c.body);
  for (const d of n.definitions || []) out.push(d.term, d.meaning);
  for (const f of n.formulas || []) out.push(f.label, f.note);
  for (const p of n.points || []) out.push(p.front, p.back);
  for (const m of n.mistakes || []) out.push(m.wrong, m.right);
  for (const e of n.examples || []) out.push(e.question, e.answer, ...(e.steps || []));
  for (const d of n.diagrams || []) out.push(d.title, d.note);
  for (const c of n.check || n.checkpoint || []) out.push(c.q ?? c.question, c.a ?? c.answer);
  return out.filter(x => typeof x === 'string');
}

/** One chapter's row. `page` carries the page-level facts (practice link, reading face). */
export function assess(n, page, interactiveKinds, staticKinds) {
  if (!n) return { notes: false, sections: Object.fromEntries(SECTIONS.map(s => [s, false])), diagrams: 0, interactive: false, interactiveNone: null, figures: 0, katexIssues: 0, katexSample: null, atStandard: false };
  const diagrams = (n.diagrams || []).filter(d => d?.spec && (interactiveKinds.has(d.spec.kind) || staticKinds.has(d.spec.kind)));
  const interactive = diagrams.some(d => interactiveKinds.has(d.spec.kind));
  const reason = typeof n.interactiveNone === 'string' && n.interactiveNone.trim().length >= MIN_REASON ? n.interactiveNone.trim() : null;
  const check = n.check || n.checkpoint || [];
  const sections = {
    objective: typeof n.objective === 'string' && n.objective.trim().length > 0,
    prerequisites: Array.isArray(n.prereqs),
    intuition: typeof n.intuition === 'string' && n.intuition.trim().length >= 80,
    formal: (n.definitions?.length || 0) + (n.formulas?.length || 0) > 0,
    examples: (n.examples || []).filter(e => e.question && e.steps?.length && e.answer).length >= MIN_EXAMPLES,
    misconceptions: (n.mistakes?.length || 0) > 0,
    checkpoint: check.filter(c => (c.q ?? c.question) && (c.a ?? c.answer)).length >= MIN_CHECKPOINT,
    practice: page.practice
  };
  const bad = proseOf(n).map(outsideMath).filter(s => UNICODE_MATH.test(s) || MACHINE_TELL.test(s));
  const atStandard = SECTIONS.every(s => sections[s]) && diagrams.length >= MIN_DIAGRAMS && (interactive || !!reason) && bad.length === 0 && page.katex;
  return {
    notes: true, sections, diagrams: diagrams.length, interactive, interactiveNone: interactive ? null : reason,
    figures: (n.examples || []).filter(e => e.figure).length, katexIssues: bad.length, katexSample: bad[0]?.trim().slice(0, 90) || null, atStandard
  };
}

// Page-level facts, read from the page sources: does the chapter page offer the next step into
// Practice, and is the reading face Computer Modern with all maths through KaTeX?
function pageFacts() {
  const read = rel => { try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return ''; } };
  const india = read('client/src/pages/Notes.jsx');
  const nsw = read('client/src/pages/NswNotes.jsx') + read('client/src/notes/nsw/NswParts.jsx');
  const cmuIndia = /notesFonts\.css|nswFonts\.css/.test(india + read('client/src/notes/NotesParts.jsx'));
  return {
    priyabhata: { practice: /data-testid="notes-practise"/.test(india), katex: /MathText/.test(india), font: cmuIndia ? 'CMU Serif + KaTeX' : 'Instrument Sans + KaTeX' },
    prithagoras: { practice: /data-testid="notes-practise"/.test(nsw), katex: /MathText/.test(nsw) && /DisplayMath/.test(nsw), font: /nswFonts\.css|notesFonts\.css/.test(nsw) ? 'CMU Serif + KaTeX' : 'Instrument Sans + KaTeX' }
  };
}

export async function collect() {
  const { INTERACTIVE_KIND_NAMES, STATIC_KIND_NAMES } = await imp('client/src/diagrams/kinds.js');
  const ik = new Set(INTERACTIVE_KIND_NAMES), sk = new Set(STATIC_KIND_NAMES);
  const page = pageFacts();
  const rows = [];

  // Priyabhata: CBSE/NCERT Classes 7–12 (JEE Main and Advanced study the Class 11–12 chapters at
  // depth, so they share those chapters' notes) and the Olympiad topics.
  const { IN_CURRICULUM, OLYMPIAD_TOPICS } = await imp('client/src/engine/curriculum-in.js');
  const { loadNotesForGrade, loadOlympiadNotes } = await imp('client/src/notes/notesIndex.js');
  for (const g of IN_CURRICULUM) {
    const notes = await loadNotesForGrade(g.grade);
    for (const c of g.chapters) rows.push({ edition: 'Priyabhata', band: `CBSE Class ${g.grade}`, id: c.id, name: c.name, font: page.priyabhata.font, ...assess(notes[c.id], page.priyabhata, ik, sk) });
  }
  const oly = loadOlympiadNotes ? await loadOlympiadNotes() : {};
  for (const c of OLYMPIAD_TOPICS) rows.push({ edition: 'Priyabhata', band: 'Olympiad', id: c.id, name: c.name, font: page.priyabhata.font, ...assess(oly[c.id], page.priyabhata, ik, sk) });

  // Prithagoras: NSW K–10 (2022) Stages 4–5 and the four 2024 Stage 6 courses.
  const nsw = await imp('client/src/notes/nsw/nswNotesIndex.js');
  const cache = new Map();
  const COURSE = { standard: 'Standard', advanced: 'Advanced', ext1: 'Extension 1', ext2: 'Extension 2' };
  for (const t of nsw.NSW_NOTES_TOPICS) {
    const key = t.course ? `6:${t.course}` : String(t.stage);
    if (!cache.has(key)) cache.set(key, (await nsw.loadNswNotesForStage(t.stage, t.course)) || {});
    const band = t.course ? `NSW ${COURSE[t.course]} Year ${t.years[0]}` : `NSW Stage ${t.stage} (Years ${t.years.join('–')})`;
    rows.push({ edition: 'Prithagoras', band, id: t.id, name: t.name, font: page.prithagoras.font, ...assess(cache.get(key)[t.id], page.prithagoras, ik, sk) });
  }
  return rows;
}

const tick = b => (b ? 'yes' : '**no**');
const esc = s => String(s).replace(/\|/g, '\\|');

export function render(rows) {
  const bands = [...new Set(rows.map(r => r.band))];
  const at = rows.filter(r => r.atStandard).length;
  const L = [];
  L.push(`# Notes coverage — ${REPORT_DATE}`, '');
  L.push('Generated by `node tools/notes-coverage.mjs --write`; `client/test/notes-coverage-check.mjs` fails when it is stale. Do not edit by hand.', '');
  L.push('**Standard (Experience 3, `docs/product/PRI_LEARNING_STANDARD.md`).** A chapter is at standard when it has all eight sections — objective, prerequisites, intuition (a paragraph of at least 80 characters), formal statement (a definition or formula), at least 2 worked examples with steps, at least 1 misconception, an independent checkpoint of at least 2 questions with answers, and the page\'s next step into Practice — plus at least 2 teaching diagrams from the tested diagram kit, at least 1 interactive diagram (or a stated reason, of at least 40 characters, why none genuinely helps), no mathematics outside KaTeX, and a chapter page that typesets with KaTeX.', '');
  L.push('Diagrams counted here are kit diagrams (`client/src/diagrams/`, accuracy-tested). "Figures" counts the separate figure-led worked examples (`StudyDiagram`) that some Priyabhata chapters also carry. JEE Main and JEE Advanced study the Class 11–12 chapters, so they share those rows.', '');
  L.push(`## Summary`, '', `**${at} of ${rows.length} chapters at standard.**`, '');
  L.push('| Band | Chapters | With notes | At standard | Missing sections (count of chapters) | ≥2 diagrams | Interactive | KaTeX issues |', '|---|---|---|---|---|---|---|---|');
  for (const b of bands) {
    const rs = rows.filter(r => r.band === b);
    const miss = SECTIONS.map(s => [s, rs.filter(r => !r.sections[s]).length]).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ') || '—';
    L.push(`| ${b} | ${rs.length} | ${rs.filter(r => r.notes).length} | ${rs.filter(r => r.atStandard).length} | ${miss} | ${rs.filter(r => r.diagrams >= MIN_DIAGRAMS).length} | ${rs.filter(r => r.interactive).length} | ${rs.filter(r => r.katexIssues).length} |`);
  }
  L.push('');
  const fonts = [...new Set(rows.map(r => `${r.edition}: ${r.font}`))];
  L.push('**Typesetting.** ' + fonts.join('; ') + '.', '');
  const reasons = rows.filter(r => r.interactiveNone);
  if (reasons.length) {
    L.push('## Chapters with no interactive diagram, and why', '');
    for (const r of reasons) L.push(`- \`${r.id}\` ${esc(r.name)} — ${esc(r.interactiveNone)}`);
    L.push('');
  }
  L.push('## Every chapter', '');
  for (const b of bands) {
    L.push(`### ${b}`, '', '| Chapter | Notes | Obj | Prereq | Intuition | Formal | Examples | Misconc. | Checkpoint | Practice | Diagrams | Interactive | Figures | KaTeX | Standard |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows.filter(x => x.band === b)) {
      const s = r.sections;
      L.push(`| \`${r.id}\` ${esc(r.name)} | ${tick(r.notes)} | ${tick(s.objective)} | ${tick(s.prerequisites)} | ${tick(s.intuition)} | ${tick(s.formal)} | ${tick(s.examples)} | ${tick(s.misconceptions)} | ${tick(s.checkpoint)} | ${tick(s.practice)} | ${r.diagrams} | ${r.interactive ? 'yes' : r.interactiveNone ? 'reason' : '**no**'} | ${r.figures} | ${r.katexIssues ? `**${r.katexIssues}**` : 'ok'} | ${r.atStandard ? 'yes' : '**no**'} |`);
    }
    L.push('');
  }
  const issues = rows.filter(r => r.katexIssues);
  if (issues.length) {
    L.push('## Maths outside KaTeX (first offending string per chapter)', '');
    for (const r of issues) L.push(`- \`${r.id}\` (${r.katexIssues}): \`${esc(r.katexSample).replace(/`/g, "'")}\``);
    L.push('');
  }
  return L.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = await collect();
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(rows, null, 1) + '\n');
  else {
    if (process.argv.includes('--write')) writeFileSync(REPORT_PATH, render(rows) + '\n');
    const at = rows.filter(r => r.atStandard).length;
    console.log(`notes coverage: ${at}/${rows.length} chapters at standard${process.argv.includes('--write') ? ` → ${REPORT_PATH.slice(ROOT.length + 1)}` : ''}`);
  }
}
