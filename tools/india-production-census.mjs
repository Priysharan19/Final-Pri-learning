import { indiaProductionCensus, indiaProductionSummary } from '../client/src/engine/indiaProductionMeta.js';

const rows = indiaProductionCensus();
const summary = indiaProductionSummary();
const qLabel = Object.freeze({
  A: 'source-authored',
  B: 'reviewed mapping',
  C: 'mapped but source review missing',
  D: 'missing/partial generator coverage'
});

console.log('Pri Learning · India production coverage census');
console.log('A/B are review evidence. C is usable generator coverage but must not be marketed as source-reviewed. D is a product gap.\n');

for (const grade of [7, 8, 9, 10, 11, 12]) {
  const group = rows.filter(row => row.grade === grade);
  const reviewed = group.filter(row => row.quality === 'A' || row.quality === 'B').length;
  console.log(`Class ${grade} — ${reviewed}/${group.length} source-reviewed`);
  for (const row of group) {
    const missing = row.missingDotpoints.length ? `; missing dot points ${row.missingDotpoints.map(x => x + 1).join(', ')}` : '';
    console.log(`  ${row.quality}  ${row.chapterId.padEnd(34)} ${row.chapter} — ${qLabel[row.quality]} [${row.releaseState}]${missing}`);
  }
  console.log('');
}

console.log(`TOTAL ${summary.total}: A=${summary.byQuality.A}, B=${summary.byQuality.B}, C=${summary.byQuality.C}, D=${summary.byQuality.D}`);
console.log('Priority rule: review C before creating duplicates; author D before marketing that chapter as available.');
