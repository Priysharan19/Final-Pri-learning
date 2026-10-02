// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tracked iPad web bundles are production builds.
//
// ios/*/Resources/Web is what the native shell ships. Features outside the
// frozen V1 scope (docs/release/PRI_V1_RELEASE_SCOPE.md) are build flags that
// test builds switch on, so a bundle synced from a test build would ship them.
// Each build writes the flags it was made with to features.json; this check
// fails unless both bundles carry that manifest with every flag off, and unless
// the entry chunk is the one that publishes the resolved flags.
//
// Usage: node client/test/ios-bundle-features-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_FLAGS } from '../vite.config.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BUNDLES = ['PriLearning.swiftpm', 'PriLearning 2.swiftpm'].map(b => [b, join(ROOT, 'ios', b, 'Resources', 'Web')]);
let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => (cond ? pass++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`));

for (const [label, web] of BUNDLES) {
  const file = join(web, 'features.json');
  ok(`${label}: carries features.json`, existsSync(file));
  if (!existsSync(file)) continue;
  let flags = null;
  try { flags = JSON.parse(readFileSync(file, 'utf8')); } catch { flags = null; }
  ok(`${label}: features.json is readable`, !!flags && typeof flags === 'object');
  if (!flags) continue;
  for (const name of FEATURE_FLAGS.map(f => f.toLowerCase())) {
    ok(`${label}: records the ${name} flag`, typeof flags[name] === 'boolean', JSON.stringify(flags));
    ok(`${label}: ${name} is off in the shipped bundle`, flags[name] === false, JSON.stringify(flags));
  }
  const entry = readdirSync(join(web, 'assets')).filter(f => /^index-[^/]*\.js$/.test(f));
  ok(`${label}: has one entry chunk`, entry.length === 1, entry.join(','));
  if (entry.length === 1) {
    const src = readFileSync(join(web, 'assets', entry[0]), 'utf8');
    ok(`${label}: the entry chunk publishes the resolved flags`, src.includes('__PRI_BUILD_FEATURES__'));
  }
}

if (failures.length) {
  for (const f of failures) console.log('  ✖ ' + f);
  console.log(`IOS BUNDLE FEATURES: FAIL — ${pass}/${pass + failures.length} checks. Rebuild without PRI_FEATURE_* set, then npm run sync:ios.`);
  process.exit(1);
}
console.log(`IOS BUNDLE FEATURES: PASS — ${pass}/${pass} checks — both tracked iPad bundles are flag-off production builds.`);
