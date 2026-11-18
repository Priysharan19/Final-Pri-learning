#!/usr/bin/env node
// Pri Learning · empty practice cells (chapter × difficulty), both editions
//
// The walk-through (F03/F04) reached chapters and difficulty levels that serve no
// question. This tool lists, from the same functions the product reads, every
// (section, chapter, difficulty) cell that has no question a student can be given:
//
//   Prithagoras (NSW)  the levels the server issues for the chapter's generator
//                      (engine/nswOffer.js nswIssuedLevels, generated from the server ledger
//                      server/platform/nswBanks.js) against D1-D4, for Years 7-10, the Year 11-12
//                      Advanced chapters and the Standard / Extension 1 / Extension 2 streams.
//   Priyabhata (India) indiaRequestableDifficulties (the function the picker and the practice
//                      route use) for each track and class. A level outside the track's advertised
//                      window is marked "outside the window": the picker never offers it.
//
// It counts what the ledger and the forms serve. It does not invent content: an empty cell is
// reported, never filled. Evidence status: derived from the code in this checkout; no student data.
//
//   node tools/empty-practice-cells.mjs            # write docs/content/empty-practice-cells.md
//   node tools/empty-practice-cells.mjs --print    # print the report
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../client/src/', import.meta.url).href;
const OUT = fileURLToPath(new URL('../docs/content/empty-practice-cells.md', import.meta.url));
const { CURRICULUM, STREAM_CURRICULUM } = await import(`${SRC}engine/curriculum.js`);
const { nswIssuedLevels } = await import(`${SRC}engine/nswOffer.js`);
const { NSW_BANK_LEDGER } = await import(new URL('../server/platform/nswBanks.js', import.meta.url).href);
const WHY = new Map(NSW_BANK_LEDGER.map(e => [e.generator, e]));
const { IN_TRACKS } = await import(`${SRC}engine/curriculum-in.js`);
const { indiaScope, indiaDifficultyWindow, indiaRequestableDifficulties } = await import(`${SRC}engine/indiaProduct.js`);

const LEVELS = [1, 2, 3, 4];
const rows = [];   // { edition, section, chapters, empty: [{ id, name, missing }] }

// ── Prithagoras ──────────────────────────────────────────────────────────────
for (const y of CURRICULUM) {
  const section = y.year >= 11 ? `Year ${y.year} (Advanced chapters)` : `Year ${y.year}`;
  rows.push({ edition: 'Prithagoras', section, subtopics: y.subtopics.map(s => ({ id: s.id, name: s.name, levels: [...nswIssuedLevels(s.id)] })) });
}
for (const [key, grp] of Object.entries(STREAM_CURRICULUM)) {
  rows.push({ edition: 'Prithagoras', section: `${grp.title}${key.startsWith('ext2') ? ' (after Extension 1)' : ''}`, subtopics: grp.subtopics.map(s => ({ id: s.id, name: s.name, levels: [...nswIssuedLevels(s.id)] })) });
}

// ── Priyabhata ───────────────────────────────────────────────────────────────
const VIEWS = [
  ...[7, 8, 9, 10, 11, 12].map(grade => ({ track: 'cbse', grade })),
  ...[11, 12].map(grade => ({ track: 'jee-main', grade })),
  ...[11, 12].map(grade => ({ track: 'jee-advanced', grade })),
  ...[7, 8, 9, 10, 11, 12].map(grade => ({ track: 'olympiad', grade }))
];
for (const { track, grade } of VIEWS) {
  const { floor, ceiling } = indiaDifficultyWindow(track, grade);
  const chapters = indiaScope(track, grade);
  rows.push({
    edition: 'Priyabhata', section: `${IN_TRACKS[track].name} · Class ${grade}`, window: [floor, ceiling],
    subtopics: chapters.map(c => ({ id: c.id, name: c.name, levels: indiaRequestableDifficulties(c, { track, grade }) }))
  });
}

const cell = (levels, window) => LEVELS.map(d => (levels.includes(d) ? 'D' + d : window && (d < window[0] || d > window[1]) ? 'out' : '-'));
const L = [];
let totalChapters = 0, totalEmptyCells = 0, noQuestionAtAll = 0;
const summary = [];
const detail = [];
for (const r of rows) {
  const win = r.window || null;
  const inWindow = LEVELS.filter(d => !win || (d >= win[0] && d <= win[1]));
  const empties = [];
  for (const s of r.subtopics) {
    const missing = inWindow.filter(d => !s.levels.includes(d));
    if (missing.length) empties.push({ ...s, missing });
  }
  const none = empties.filter(e => !e.levels.length);
  totalChapters += r.subtopics.length;
  totalEmptyCells += empties.reduce((n, e) => n + e.missing.length, 0);
  noQuestionAtAll += none.length;
  const perLevel = inWindow.map(d => `D${d}: ${r.subtopics.filter(s => !s.levels.includes(d)).length}`).join(', ');
  summary.push(`| ${r.edition} | ${r.section} | ${win ? `D${win[0]}-D${win[1]}` : 'D1-D4'} | ${r.subtopics.length} | ${empties.length} | ${none.length} | ${perLevel} |`);
  if (empties.length) {
    const nsw = r.edition === 'Prithagoras';
    detail.push('', `### ${r.edition} · ${r.section}`, '', `| Chapter | id | D1 | D2 | D3 | D4 |${nsw ? ' Why the cell is not served |' : ''}`, `|---|---|:-:|:-:|:-:|:-:|${nsw ? '---|' : ''}`);
    for (const e of empties) {
      const why = nsw ? ' ' + (() => {
        const entry = WHY.get(e.id);
        if (!entry) return 'no bank in the server ledger';
        if (!entry.cells?.length) return entry.reason || 'not issued';
        return e.missing.map(d => { const c = entry.cells.find(x => x.difficulty === d); return `D${d}: ${String(c?.reason || entry.reason || 'not issued').replace(/\|/g, '/').slice(0, 120)}`; }).join('; ');
      })() + ' |' : '';
      detail.push(`| ${e.name.replace(/\|/g, '/')} | \`${e.id}\` | ${cell(e.levels, win).join(' | ')} |${why}`);
    }
  }
}

L.push('# Empty practice cells: chapter × difficulty, both editions', '');
L.push('Generated by `node tools/empty-practice-cells.mjs`. Do not edit by hand.', '');
L.push('**What this is.** For every year, class, track and Senior stream, the chapters that serve no question at a difficulty, read from the functions the product uses: the NSW issued-cell ledger (`engine/nswOffer.js`, generated from `server/platform/nswBanks.js`) and `indiaRequestableDifficulties` (what the India picker and practice route use). `D#` = served; `-` = nothing is served at that level; `out` = outside the track\'s advertised difficulty window (the picker does not offer it, and a request for it is answered with the nearest served level).', '');
L.push('**What this is not.** It does not invent content: an empty cell is reported, not filled. It counts authored, answer-checked forms, not curriculum coverage or question quality, and no student evidence is implied.', '');
L.push('| Edition | Section | Window | Chapters | Chapters with an empty in-window cell | Chapters with no question at any level | Empty chapters per in-window level |', '|---|---|---|---:|---:|---:|---|', ...summary, '');
L.push(`Totals: ${totalChapters} chapter-sections, ${totalEmptyCells} empty in-window cells, ${noQuestionAtAll} chapter-sections with no question at any level.`, '');
L.push('## Empty cells by section', ...detail, '');
const text = L.join('\n');
if (process.argv.includes('--print')) console.log(text);
else { writeFileSync(OUT, text); console.log(`wrote ${OUT} (${totalChapters} chapter-sections, ${totalEmptyCells} empty in-window cells, ${noQuestionAtAll} with no question at all)`); }
