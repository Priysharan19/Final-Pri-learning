// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Apple shipping target (CP-04 × V1 scope, amended by #504)
// V1 ships on iPhone and iPad from an exact `main` SHA (PRI_V1_RELEASE_SCOPE
// §22), so `main` must declare both families, iPhone portrait-only, iPad all
// four orientations, and keep the bundle id that owns on-device student data.
// The gate must still refuse every way of getting that wrong — including the
// old iPad-only declaration, which is no longer the shipping target.
// Run on its own:  node client/test/apple-shipping-target-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { BUNDLE_ID, bundleIdOf, familiesOf, orientationsOf, shippingProblems } from '../../scripts/apple-shipping-target.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const canon = readFileSync(new URL('../../ios/PriLearning.swiftpm/Package.swift', import.meta.url), 'utf8');
const copy = readFileSync(new URL('../../ios/PriLearning 2.swiftpm/Package.swift', import.meta.url), 'utf8');

// ── main is the shipping target ──────────────────────────────────────────────
ok(JSON.stringify(familiesOf(canon)) === '["pad","phone"]', 'main declares iPad + iPhone: it is the V1 Apple shipping target (#504)');
ok(JSON.stringify(familiesOf(copy)) === '["pad","phone"]', 'and so does the compatibility package');
ok(shippingProblems(canon).length === 0, `the canonical package passes the shipping gate — ${shippingProblems(canon).join('; ')}`);
ok(shippingProblems(copy).length === 0, `the compatibility package passes the shipping gate — ${shippingProblems(copy).join('; ')}`);
const o = orientationsOf(canon);
ok(o.portrait === 'all', 'portrait is supported on iPhone and iPad');
ok(['landscapeLeft', 'landscapeRight', 'portraitUpsideDown'].every(k => JSON.stringify(o[k]) === '["pad"]'),
  'iPhone is portrait-only (upside-down off); landscape and upside-down are iPad-only');
ok(bundleIdOf(canon) === BUNDLE_ID && BUNDLE_ID === 'com.prilearning.app', 'the bundle id is unchanged, so iPad installs keep their data');

// ── the gate refuses every wrong declaration ─────────────────────────────────
const setFamilies = (s, list) => s.replace(/supportedDeviceFamilies:\s*\[[^\]]*\]/, `supportedDeviceFamilies: [${list}]`);
ok(shippingProblems(setFamilies(canon, '.pad')).length > 0, 'the old iPad-only declaration is no longer the shipping target');
ok(shippingProblems(setFamilies(canon, '.phone')).length > 0, 'an iPhone-only declaration is refused');
ok(shippingProblems(setFamilies(canon, '.pad, .phone, .mac')).length > 0, 'an extra device family is refused');
ok(shippingProblems(setFamilies(canon, '\n                // .phone\n                .pad\n            ')).length > 0,
  'a commented-out .phone does not count');
ok(shippingProblems(canon.replace('.landscapeRight(.when(deviceFamilies: [.pad]))', '.landscapeRight')).length > 0,
  'unconditional landscape (iPhone landscape) is refused');
ok(shippingProblems(canon.replace('.portraitUpsideDown(.when(deviceFamilies: [.pad]))', '.portraitUpsideDown')).length > 0,
  'iPhone portrait upside-down is refused');
ok(shippingProblems(canon.replace(/,\s*\.landscapeLeft\(\.when\(deviceFamilies: \[\.pad\]\)\)/, '')).length > 0,
  'dropping an iPad orientation is refused');
ok(shippingProblems(canon.replace('.portrait,', '.portrait(.when(deviceFamilies: [.pad])),')).length > 0,
  'an iPhone with no portrait orientation is refused');
ok(shippingProblems(canon.replace(`"${BUNDLE_ID}"`, '"com.prilearning.phone"')).length > 0, 'a different bundle id is refused');
ok(shippingProblems(canon.replace('.landscapeLeft(.when(deviceFamilies: [.pad]))', '.landscapeLeft,\n                .landscapeLeft(.when(deviceFamilies: [.pad]))')).length > 0,
  'an unconditional orientation hidden before its iPad-only duplicate is refused (repeated keys)');
ok(shippingProblems(canon.replace('.portrait,', '.portrait,\n                .portrait,')).length > 0,
  'any orientation declared twice is refused');

let threw = false;
try { familiesOf('let x = 1'); } catch { threw = true; }
ok(threw, 'a package without device families is refused');

console.log(failures.length
  ? `APPLE SHIPPING TARGET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `APPLE SHIPPING TARGET: PASS — ${pass}/${pass} checks — main is the iPhone (portrait) + iPad V1 target as com.prilearning.app.`);
process.exit(failures.length ? 1 : 0);
