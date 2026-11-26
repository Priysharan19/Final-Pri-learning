# Annotation coverage

Owner rule, 26 November 2026 (Prithagoras edition): every question in the database must support full step-by-step annotated marking, with each line of working ticked or crossed and a reason given, as the teacher-marked page shows. No new question may be added unless it has that.

This file says what is measured, how to run it, and how the gate holds the line. It states only what the tool prints. It makes no claim that any question is marked correctly, only that its own worked solution is, or is not, annotated line by line the way the rule asks.

## What "covered" means

A question is covered when its own worked solution (a generator: the worked steps it emits; a bank part: the authored worked steps) is fed line by line through the same server path a typed or handwritten page uses (`MARKER_OPS.practice` in `server/platform/markerOps.js`, the report the page shows), and the page model the client draws (`annotatedWorkingModel.js`, `markedPageModel.js`, `markedPageTeacher.js`) reads it as follows.

True half:

- every maths line is ticked, and the class the engine gave the tick has a phrase (`PHRASES` in `markedPageTeacher.js`); a tick that carries no class, or a class with no phrase, fails;
- headings and the restated question are neutral;
- no maths line is left unchecked, and none is crossed;
- for a question with a key: the key typed as the answer is marked correct, and the final line is the report's `answerLine`. A worked-solution part has no key and no mark, so this part does not apply to it (the tool counts those units separately).

Wrong half, for the same question: a one-line mutation of a middle step (one of the first two provably false mutants of the middle-most line that has any, judged by the independent evaluator of `tools/marking-mutation-harness.mjs`, never the product engine) is crossed at exactly that line, not later, not earlier, not ticked, not missed. A question with no provable mutation of any step fails this half.

Statuses: fully covered needs both halves; true half only has the first and not the second; everything else is uncovered. The two halves are reported separately.

## Scope

- Generated: every issued difficulty of every NSW generator of Years 11-12 (`y11`, `y12`, `me11`, `me12`), seeds 1 to 200 grouped into forms (the answer type and the headings of the worked steps), the first two seeds of each form marked. A form is covered only when every seed marked is. Its id is `gen:<generator>:d<difficulty>:<hash of the form>`. A form that no seed from 1 to 200 reaches is not seen.
- Bank: every part of the committed pack `server/content/qbank`, the auto-marked parts and the worked-solution parts, by the part id.

A multiple-choice question has no working page and counts as uncovered. A worked-solution line that cannot be written as a typed line (TeX the reader does not know, such as `\alpha`, `\binom`, `\pm`) is counted as uncovered with that command named, never dropped.

## Run it

```
node tools/annotation-coverage.mjs                       print the numbers and the top causes (about 25 s)
node tools/annotation-coverage.mjs --detail <path>       also write the private detail (every id, its lines and their statuses); the path must be outside the repository
node tools/annotation-coverage.mjs --only generated      or --only bank
node tools/annotation-coverage.mjs --write               rewrite the committed summary and baseline (below)
node server/test/annotation-coverage-gate-check.mjs      the gate (also: npm run test:annotation:coverage)
```

Committed, in `server/test/fixtures/annotation-coverage/`:

- `summary.json`: counts by kind, topic and dot point (fully covered, true half only, uncovered), the causes ranked with one example line each, and the wrong-half failures by reason. Under 500 kB.
- `baseline.json`: every unit that is not fully covered, as `id: status+cause index` (`t` true half only, `u` uncovered). Fully covered units are not listed. Under 500 kB; the full detail is not committed.

The cause of an uncovered unit is the shape of the first line left unchecked (inequality, trig step, log law, integration step, probability or counting, vectors, words-only reasoning, and so on), or the reason no line could be judged (multiple-choice, no maths lines, TeX not readable, no report from the marker, a tick without a phrase, answer line not recognised, a true line crossed). That ranking is the work list for engine coverage.

## The gate

`server/test/annotation-coverage-gate-check.mjs` runs in `npm test` and in CI (the sharded suites job, pinned in `ci/check-counts.json`).

1. Any generator form or bank part that is not on the baseline must be fully covered; if not, the gate fails with its id and the first line at issue.
2. The baseline may only shrink, and it is exact. A baseline id that has become fully covered must be removed (the gate fails until it is). A baseline id whose status moved, or that no longer exists, must be refreshed with `--write`. In CI the suites policy job also compares with the branch being merged into (`--ratchet-only --base-sha`): no id may join the list.
3. The importer `tools/qbank-import.mjs` (`compileWithLineHold`, used by `--pack`) holds any part that is not on the baseline and not fully covered, with the reason `not line-markable`, instead of packing it. Parts already in the pack are grandfathered by the baseline. `--line-baseline <file>` names another baseline (the importer test uses it for its invented fixture).

The gate proves itself: a planted uncovered new question, a planted baseline addition, a covered id left on the list and the importer hold each fail as they should.

## How the baseline ratchets

When the engine covers more, run `node tools/annotation-coverage.mjs --write` and commit the smaller baseline with the summary. When a question is added, make it fully covered; its id is then not on the baseline and never needs to be. Never add an id to the baseline to make the gate pass: the ratchet check against the base refuses it.

The numbers and the ranked causes are in `summary.json`. They are measurements of the engine as it stands, not a target.
