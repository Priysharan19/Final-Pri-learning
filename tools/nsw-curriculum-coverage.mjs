#!/usr/bin/env node
// Prints Prithagoras's content-gap number: per current NSW syllabus, how many
// outcomes a Pri generator reaches through the reviewed crosswalk (mapped),
// reaches only through a partial row (partial), or does not reach (missing).
//
//   npm run nsw:coverage            human-readable table
//   npm run nsw:coverage -- --json  the full per-outcome report
//   npm run nsw:coverage -- --gaps  also list each missing outcome
//
// Read-only: imports the legacy NSW generator modules for their ids only.

import { NSW_CURRENT_SYLLABUSES, NSW_CROSSWALK } from '../client/src/engine/curriculum-nsw/index.js';
import { nswCoverage, formatNswCoverage } from '../client/src/engine/curriculum-nsw/coverage.js';
import { legacyNswGeneratorIds } from '../client/src/engine/curriculum-nsw/legacyGenerators.js';

const args = new Set(process.argv.slice(2));
const report = nswCoverage({
  syllabuses: NSW_CURRENT_SYLLABUSES,
  crosswalk: NSW_CROSSWALK,
  generatorIds: await legacyNswGeneratorIds()
});

if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('NSW generator coverage (Prithagoras) — a floor, not a syllabus-completeness claim\n');
  console.log(formatNswCoverage(report));
  if (args.has('--gaps')) {
    for (const s of report) {
      const missing = s.outcomes.filter(o => o.state === 'missing');
      if (!missing.length) continue;
      console.log(`\n${s.title} — missing:`);
      for (const o of missing) console.log(`  ${o.code}  ${o.focusArea}`);
    }
  }
}
