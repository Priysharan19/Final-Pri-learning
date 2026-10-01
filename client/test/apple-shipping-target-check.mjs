// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping-target gate (CP-04 × V1 scope freeze)
// V1 is iPad-only (docs/release/PRI_V1_RELEASE_SCOPE.md). The gate must turn
// either package into an iPad-only target without touching anything else, and
// must refuse to call the current main (iPad + iPhone engineering) V1-ready.
// Run on its own:  node client/test/apple-shipping-target-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { familiesOf, ipadOnly } from '../../scripts/apple-shipping-target.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const canon = readFileSync(new URL('../../ios/PriLearning.swiftpm/Package.swift', import.meta.url), 'utf8');
const copy = readFileSync(new URL('../../ios/PriLearning 2.swiftpm/Package.swift', import.meta.url), 'utf8');
const families = familiesOf(canon);
ok(families.includes('pad'), 'main keeps the iPad family (the V1 product)');
ok(families.includes('phone'), 'main keeps the iPhone family for post-V1 iPhone engineering and its simulator CI');

const v1 = ipadOnly(canon);
ok(JSON.stringify(familiesOf(v1)) === JSON.stringify(['pad']), 'applying the V1 target leaves exactly iPad');
ok(ipadOnly(v1) === v1, 'applying it twice changes nothing (idempotent)');
const withoutFamilies = s => s.replace(/supportedDeviceFamilies:\s*\[[^\]]*\]/, '');
ok(withoutFamilies(v1) === withoutFamilies(canon), 'nothing outside supportedDeviceFamilies changes (orientations, capabilities, identity)');
ok(/\.portraitUpsideDown\(\.when\(deviceFamilies: \[\.pad\]\)\)/.test(v1), 'iPad orientation conditions survive');
ok(ipadOnly(copy) === v1, 'both packages produce the identical V1 target');
ok(/\.landscapeRight\(\.when\(deviceFamilies: \[\.pad\]\)\)/.test(canon) && /\.landscapeLeft\(\.when\(deviceFamilies: \[\.pad\]\)\)/.test(canon),
  'iPhone is portrait-only; landscape is iPad-only');
let threw = false;
try { ipadOnly('let x = 1'); } catch { threw = true; }
ok(threw, 'a package without device families is refused, not silently passed');

console.log(failures.length
  ? `APPLE SHIPPING TARGET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `APPLE SHIPPING TARGET: PASS — ${pass}/${pass} checks — main keeps iPhone engineering; the V1 target applies as iPad-only, deterministically.`);
process.exit(failures.length ? 1 : 0);
