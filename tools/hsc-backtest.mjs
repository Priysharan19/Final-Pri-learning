#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities backtest
//
// For each course and each test year Y (2021 on), every estimator is fitted on
// the tagged papers before Y and scored against Y's paper, on the 2017 topics
// NESA's own mapping grids use. Reports top-k topic hit rate, Spearman rank
// correlation of marks share, and total variation distance (the share of the
// paper's marks put in the wrong topics), against two naive baselines: last
// year's paper, and every syllabus topic equal.
//
//   node tools/hsc-backtest.mjs            print the tables
//   node tools/hsc-backtest.mjs --write    write docs/evidence/hsc-forecast-backtest-2026-11-18.md
//   node tools/hsc-backtest.mjs --check    fail if that file is not what the engine produces now
//
// Deterministic: no randomness, no clock. The written file carries a sha256 of
// the backtest's numbers, so a change to the data or the method shows up.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { backtest, selectHistoryMethod, blendWeights, hscPriorities, HSC_ESTIMATORS, HSC_PREREGISTERED, HSC_TARGET_YEAR } from '../client/src/engine/hsc/hscPriorities.js';
import { HSC_PAST_PAPERS, HSC_SAMPLE } from '../client/src/engine/hsc/hscIndex.js';
import { HSC_UNTAGGED } from '../client/src/engine/hsc/hscSources.js';
import { HSC_COURSE_IDS } from '../client/src/engine/hsc/hscOutcomes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HSC_BACKTEST_DOC = join(ROOT, 'docs', 'evidence', 'hsc-forecast-backtest-2026-11-18.md');
const COURSE = { advanced: 'Mathematics Advanced', extension1: 'Mathematics Extension 1' };

const pct = x => `${(x * 100).toFixed(1)}%`;
const f2 = x => x.toFixed(2);

/** Every number the doc reports, in one deterministic object. */
export function backtestReport() {
  return HSC_COURSE_IDS.map(course => {
    const bt = backtest(course);
    const choice = selectHistoryMethod(bt);
    return { course, bt, choice, weights: blendWeights(bt, choice.method) };
  });
}

export function backtestDigest(report = backtestReport()) {
  const numbers = report.map(({ course, bt, choice, weights }) => ({ course, years: bt.years, rows: bt.rows, mean: bt.mean, choice, weights }));
  return createHash('sha256').update(JSON.stringify(numbers)).digest('hex');
}

function courseSection({ course, bt, choice, weights }) {
  const ids = Object.keys(HSC_ESTIMATORS);
  const out = [];
  const papers = HSC_PAST_PAPERS[course];
  out.push(`## ${COURSE[course]}`, '');
  out.push(`Tagged papers: ${papers.map(p => `${p.year} (${p.records.length} parts)`).join(', ')}. Test years: ${bt.years.join(', ')}. Top-k uses k = ${bt.k} of ${Object.keys(papers.length ? bt.absError.uniform : {}).length} topics.`, '');
  out.push('| Year | Method | Top-k hit | Spearman ρ | TVD (marks misplaced) |', '|---|---|---|---|---|');
  for (const r of bt.rows) out.push(`| ${r.year} | ${HSC_ESTIMATORS[r.estimator].label} | ${pct(r.topK)} | ${f2(r.spearman)} | ${pct(r.tvd)} |`);
  out.push('', `**Mean over ${bt.years.length} test years**`, '', '| Method | Top-k hit | Spearman ρ | TVD (lower is better) |', '|---|---|---|---|');
  for (const id of ids) {
    const m = bt.mean[id];
    out.push(`| ${HSC_ESTIMATORS[id].label} | ${pct(m.topK)} | ${f2(m.spearman)} | ${pct(m.tvd)} |`);
  }
  const m = bt.mean;
  const better = (a, b, f, lowerBetter) => (lowerBetter ? m[a][f] < m[b][f] : m[a][f] > m[b][f]);
  const lines = [];
  lines.push(choice.beatsBaselines
    ? `**Decision:** the recency-weighted mean beats both baselines on the pre-registered primary metric (mean TVD ${pct(m.decayed.tvd)} against ${pct(m.last.tvd)} for last year's paper and ${pct(m.uniform.tvd)} for equal topics), so it is the history component of the 2027 priorities.`
    : `**Decision:** the recency-weighted mean does NOT beat both baselines on the pre-registered primary metric (mean TVD ${pct(m.decayed.tvd)}; last year's paper ${pct(m.last.tvd)}; equal topics ${pct(m.uniform.tvd)}). The simpler baseline "${HSC_ESTIMATORS[choice.method].label}" is used as the history component instead.`);
  const mixed = [];
  if (!better('decayed', 'last', 'topK', false)) mixed.push(`its mean top-${bt.k} hit rate (${pct(m.decayed.topK)}) is not above last year's paper (${pct(m.last.topK)})`);
  if (!better('decayed', 'last', 'spearman', false)) mixed.push(`its mean Spearman ρ (${f2(m.decayed.spearman)}) is not above last year's paper (${f2(m.last.spearman)})`);
  if (mixed.length) lines.push(`On the secondary metrics the result is mixed: ${mixed.join('; ')}.`);
  lines.push(`The equal-topics baseline has ρ = 0 by construction (every topic tied), so its ρ says nothing, and its top-k is whichever topics come first in code order when all are tied; its TVD is the comparison that means something.`);
  lines.push(`In ${bt.years[0]} only one earlier paper exists, so the recency-weighted mean and last year's paper are the same prediction.`);
  lines.push(`Blend weights for 2027, w ∝ 1/mean TVD of the estimator in the same role: history ${pct(weights.history)}, NESA sample ${pct(weights.sample)} (role of "one paper": last year's), syllabus weight ${pct(weights.syllabus)} (role of "equal topics").`);
  out.push('', ...lines, '');
  return out.join('\n');
}

function prioritiesSection(course) {
  const r = hscPriorities(course);
  const out = [`### ${COURSE[course]} · HSC ${HSC_TARGET_YEAR} priorities as the engine ranks them`, '', '| # | Outcome | Focus area | Expected share | Band (marks of ' + r.paperMarks + ') | New content | Likely styles |', '|---|---|---|---|---|---|---|'];
  for (const p of r.priorities) {
    out.push(`| ${p.rank} | ${p.code} | ${p.focusArea} | ${pct(p.expected)} | ${p.marks[0]}–${p.marks[1]} | ${p.novelty > 0 ? pct(p.novelty) : '—'} | ${p.styles.map(s => `${s.type} ${Math.round(s.share * 100)}%`).join(', ')} |`);
  }
  return out.join('\n');
}

export function backtestDoc(report = backtestReport()) {
  const digest = backtestDigest(report);
  const untagged = HSC_UNTAGGED.map(u => `  - ${COURSE[u.course]} ${u.year}: ${u.reason}`).join('\n');
  return `# HSC 2027 priorities — forecast backtest (18 November 2026)

Generated by \`node tools/hsc-backtest.mjs --write\` from \`client/src/engine/hsc/\`. Do not hand-edit; \`--check\` (run by \`npm run test:hsc\`) fails if this file is not what the engine produces now.

Numbers digest: \`${digest}\`

## What was tested, and what was not

- **Data.** NESA's own "Mapping Grid" at the end of each marking guideline: every question part, its marks and the 2017 syllabus topic code(s) NESA mapped it to. Mathematics Advanced ${HSC_PAST_PAPERS.advanced.map(p => p.year).join(', ')}; Mathematics Extension 1 ${HSC_PAST_PAPERS.extension1.map(p => p.year).join(', ')}. Every paper's parts add to its total (100 / 70). Metadata only — no NESA text is stored.
- **Not tagged:**
${untagged}
- **Unit of evaluation.** Marks share per 2017 topic (${Object.keys(backtest('advanced').absError.uniform).length} Advanced topics, ${Object.keys(backtest('extension1').absError.uniform).length} Extension 1 topics). A part mapped to n topics gives each 1/n of its marks.
- **Protocol.** For each test year Y ≥ ${HSC_PREREGISTERED.firstTestYear}, fit on years < Y only, score against Y. Pre-registered before any number was seen: decay ${HSC_PREREGISTERED.decay}, top-k with k = ${HSC_PREREGISTERED.topK.advanced} (Advanced) and ${HSC_PREREGISTERED.topK.extension1} (Extension 1), primary metric mean total variation distance (TVD). Nothing was tuned after.
- **Metrics.** Top-k hit: how many of the year's k biggest topics the method also put in its top k. Spearman ρ: rank correlation of marks share across all topics. TVD: half the summed absolute difference in marks share — the share of the paper's marks the method put in the wrong topics.
- **Baselines.** (1) Last year's paper as it was. (2) Every syllabus topic equal (the 2017 indicative hours are not stored, so equal topics stands in for syllabus weight).
- **Small sample.** ${backtest('advanced').years.length} Advanced and ${backtest('extension1').years.length} Extension 1 test years. No significance test is claimed; the differences are descriptive.

## Transportability limit — read this before the numbers

Every test year was set on the **2017** syllabuses. The 2027 HSC is the **first** examined on the 2024 syllabuses (NESA: "2027 — First HSC examination for the new syllabus"). These numbers say how well each method would have ranked topics on the old syllabus, when the syllabus did not change between fit and test. They are **not** an accuracy for 2027, and no accuracy for 2027 is claimed. For 2027 the history is carried to the new outcomes through Pri's old → new map (\`hscOutcomes.js\`, part of it Pri's estimate), and new content no past paper could test is forecast from NESA's sample examination and syllabus weight alone, which cannot be backtested at all. A new syllabus's first paper may also differ in emphasis on purpose.

${HSC_COURSE_IDS.map(c => courseSection(report.find(r => r.course === c))).join('\n')}
## The 2027 ranking this produces

Not a prediction of the questions, a predicted mark or a band. The band is the backtest's error for the topics behind each outcome, widened to take in every component's own figure; on a new syllabus the real spread may be wider.

${HSC_COURSE_IDS.map(prioritiesSection).join('\n\n')}

Sample examination items read: Advanced ${HSC_SAMPLE.advanced.records.length}, Extension 1 ${HSC_SAMPLE.extension1.records.length}.
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const report = backtestReport();
  const doc = backtestDoc(report);
  if (process.argv.includes('--write')) {
    writeFileSync(HSC_BACKTEST_DOC, doc);
    console.log(`HSC BACKTEST · wrote ${HSC_BACKTEST_DOC.slice(ROOT.length + 1)} · digest ${backtestDigest(report)}`);
  } else if (process.argv.includes('--check')) {
    const held = existsSync(HSC_BACKTEST_DOC) ? readFileSync(HSC_BACKTEST_DOC, 'utf8') : '';
    if (held !== doc) {
      console.error('HSC BACKTEST · the evidence doc is stale: run node tools/hsc-backtest.mjs --write');
      process.exit(1);
    }
    console.log(`HSC BACKTEST · evidence doc matches the engine · digest ${backtestDigest(report)}`);
  } else {
    console.log(doc);
  }
}
