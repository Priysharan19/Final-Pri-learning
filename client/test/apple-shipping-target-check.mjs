// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping target (CP-04 × V1 scope freeze)
// V1 ships iPad-only from an exact `main` SHA, so `main` must declare iPad
// only. iPhone engineering builds a scratch copy with the iPhone family added;
// that transform must touch nothing else.
// Run on its own:  node client/test/apple-shipping-target-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { engineeringPackage, familiesOf, ipadOnly, withPhone } from '../../scripts/apple-shipping-target.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const canon = readFileSync(new URL('../../ios/PriLearning.swiftpm/Package.swift', import.meta.url), 'utf8');
const copy = readFileSync(new URL('../../ios/PriLearning 2.swiftpm/Package.swift', import.meta.url), 'utf8');
ok(JSON.stringify(familiesOf(canon)) === '["pad"]', 'main declares iPad only: it is always the V1 shipping target');
ok(JSON.stringify(familiesOf(copy)) === '["pad"]', 'and so does the compatibility package');

const eng = withPhone(canon);
ok(JSON.stringify(familiesOf(eng)) === '["pad","phone"]', 'the engineering variant adds exactly the iPhone family');
const noFamilies = s => s.replace(/supportedDeviceFamilies:\s*\[[^\]]*\]/, '');
ok(noFamilies(eng) === noFamilies(canon), 'nothing outside supportedDeviceFamilies changes');
ok(withPhone(eng) === eng && ipadOnly(canon) === canon, 'both transforms are idempotent');
ok(ipadOnly(eng) === canon, 'removing the iPhone family restores main exactly');
ok(/\.landscapeRight\(\.when\(deviceFamilies: \[\.pad\]\)\)/.test(canon) && /\.landscapeLeft\(\.when\(deviceFamilies: \[\.pad\]\)\)/.test(canon),
  'an iPhone engineering build is portrait-only; landscape is iPad-only');

const dir = mkdtempSync(join(tmpdir(), 'pri-eng-'));
try {
  const out = engineeringPackage(dir);
  const built = readFileSync(join(out, 'Package.swift'), 'utf8');
  ok(JSON.stringify(familiesOf(built)) === '["pad","phone"]', 'the engineering package copy carries iPad + iPhone');
  ok(readFileSync(join(out, 'WebShell.swift'), 'utf8') === readFileSync(new URL('../../ios/PriLearning.swiftpm/WebShell.swift', import.meta.url), 'utf8'),
    'and is otherwise the canonical package');
  ok(JSON.stringify(familiesOf(readFileSync(new URL('../../ios/PriLearning.swiftpm/Package.swift', import.meta.url), 'utf8'))) === '["pad"]',
    'building it never modifies main');
} finally { rmSync(dir, { recursive: true, force: true }); }

let threw = false;
try { withPhone('let x = 1'); } catch { threw = true; }
ok(threw, 'a package without device families is refused');

console.log(failures.length
  ? `APPLE SHIPPING TARGET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `APPLE SHIPPING TARGET: PASS — ${pass}/${pass} checks — main is the iPad-only V1 target; iPhone engineering builds a scratch copy.`);
process.exit(failures.length ? 1 : 0);
