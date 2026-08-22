// Release gate around the untouched third synthetic writer holdout.
//
// Keep inkcheck-holdout3.mjs itself free of tuning logic: it owns the locked
// generator/seed and only reports evidence. This wrapper owns the regression
// floor, so lowering a floor is an explicit reviewable release-policy change.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const writers = process.argv[2] || '40';
const child = spawnSync(process.execPath, [join(HERE, 'inkcheck-holdout3.mjs'), writers], {
  encoding: 'utf8'
});

if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
if (child.status !== 0) process.exit(child.status || 1);

const summary = String(child.stdout || '')
  .split('\n')
  .find(line => line.includes('HELD-OUT-3 SCORE'));

if (!summary) {
  console.error('\nFAIL — held-out #3 printed no parseable score');
  process.exit(1);
}

const match = /SCORE — ([\d.]+)% lines, ([\d.]+)% chars, worst writer ([\d.]+)%/.exec(summary);
if (!match) {
  console.error(`\nFAIL — held-out #3 score format changed: ${summary}`);
  process.exit(1);
}

const measured = {
  lines: Number(match[1]),
  chars: Number(match[2]),
  worst: Number(match[3])
};

// Baseline locked on the first untouched V11 run (40 writers × 14 expressions):
// 97.1% exact lines, 99.3% characters, 79% worst writer. Floors sit on the
// measured one-decimal outputs so any regression is visible rather than rounded
// away. Raising these floors is encouraged after a genuinely independent gain.
const floor = { lines: 97.1, chars: 99.3, worst: 79 };
const failures = [];
for (const key of Object.keys(floor)) {
  if (!Number.isFinite(measured[key])) failures.push(`${key} was not measured`);
  else if (measured[key] < floor[key]) failures.push(`${key} ${measured[key]} < ${floor[key]}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL — held-out #3 ${failure}`);
  process.exit(1);
}

console.log(`\nPASS — held-out #3 regression floor: lines ${measured.lines}%, chars ${measured.chars}%, worst writer ${measured.worst}%`);
