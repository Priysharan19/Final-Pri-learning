// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · notes coverage against Experience 3, machine-checked.
//   1. docs/content/notes-coverage-<date>.md is exactly what tools/notes-coverage.mjs
//      computes from the content (regenerate with `node tools/notes-coverage.mjs --write`);
//   2. the number of chapters at standard never falls below FLOOR (raise it, never lower it);
//   3. every chapter not at standard is on REMAINING, and nothing on REMAINING is at
//      standard any more (so the list stays the exact list of what is left).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { collect, render, REPORT_PATH } from '../../tools/notes-coverage.mjs';

// Raised as bands land. REMAINING === null means "not yet frozen": only the floor is enforced.
const FLOOR = 57;
const REMAINING = null;

let pass = 0;
const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const rows = await collect();
let committed = '';
try { committed = readFileSync(REPORT_PATH, 'utf8'); } catch { /* missing */ }
ok(committed === render(rows) + '\n', 'the coverage report is stale: run node tools/notes-coverage.mjs --write');
const at = rows.filter(r => r.atStandard);
ok(at.length >= FLOOR, `chapters at standard fell to ${at.length} (floor ${FLOOR})`);
ok(new Set(rows.map(r => r.id)).size === rows.length, 'a chapter id appears twice');
if (REMAINING) {
  const below = rows.filter(r => !r.atStandard).map(r => r.id);
  for (const id of below) ok(REMAINING.includes(id), `${id} is below standard and not on REMAINING`);
  for (const id of REMAINING) ok(!at.some(r => r.id === id), `${id} is at standard: take it off REMAINING`);
}
console.log(`notes-coverage-check: ${pass} passed, ${failures.length} failed (${at.length}/${rows.length} at standard)`);
for (const f of failures) console.log('  FAIL', f);
process.exit(failures.length ? 1 : 0);
