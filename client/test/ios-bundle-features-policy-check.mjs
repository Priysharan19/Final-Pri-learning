// Pri Learning · which flags a shipped iPad bundle may carry (no build needed).
//
// Drives ios-bundle-features-check.mjs's checkBundles over temporary bundles:
// a flag-off release passes; a tutor-on release build passes only when its
// environment asked for PRI_FEATURE_TUTOR=1; a tutor-on test build synced into
// a flag-off release fails; and a non-shippable flag (placement, australia)
// fails even when its environment asks for it. Regression for L9's GO finding:
// a tutor-on iOS release build failed the check whatever the release asked.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBundles, expectedFlags } from './ios-bundle-features-check.mjs';
import { FEATURE_FLAGS, INSTRUMENT_BUILD, SHIPPABLE_FEATURE_FLAGS } from '../vite.config.js';
import { INTERFACE_SKIN } from '../interface.config.mjs';

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => (cond ? pass++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`));
const root = mkdtempSync(join(tmpdir(), 'pri-ios-flags-'));
const bundle = (name, flags) => {
  const web = join(root, name);
  mkdirSync(join(web, 'assets'), { recursive: true });
  writeFileSync(join(web, 'features.json'), JSON.stringify(flags));
  writeFileSync(join(web, 'assets', 'index-abc.js'), 'globalThis.__PRI_BUILD_FEATURES__={}');
  return [[`${name} A`, web], [`${name} B`, web]];
};
const off = { ...Object.fromEntries(FEATURE_FLAGS.map(f => [f.toLowerCase(), false])), instrument: INSTRUMENT_BUILD, skin: INTERFACE_SKIN };
const PER = 2 * (6 + 2 * FEATURE_FLAGS.length);

try {
  ok('only TUTOR is shippable', SHIPPABLE_FEATURE_FLAGS.length === 1 && SHIPPABLE_FEATURE_FLAGS[0] === 'TUTOR', SHIPPABLE_FEATURE_FLAGS.join(','));
  ok('with no flag asked for, every flag must be off', Object.values(expectedFlags({})).every(v => v === false));
  ok('PRI_FEATURE_PLACEMENT=1 never makes placement shippable', expectedFlags({ PRI_FEATURE_PLACEMENT: '1' }).placement === false);

  let r = checkBundles(bundle('flag-off', off), {});
  ok('a flag-off release passes, the same count CI pins', r.failures.length === 0 && r.pass === PER, `${r.pass} ${r.failures}`);

  r = checkBundles(bundle('tutor-release', { ...off, tutor: true }), { PRI_FEATURE_TUTOR: '1' });
  ok('a tutor-on release build passes when the release asked for the tutor', r.failures.length === 0 && r.pass === PER && r.on.join() === 'tutor', `${r.pass} ${r.failures}`);

  r = checkBundles(bundle('tutor-stray', { ...off, tutor: true }), {});
  ok('a tutor-on build synced into a flag-off release fails', r.failures.length === 2 && r.failures.every(f => /tutor is off/.test(f)), r.failures.join(' | '));

  r = checkBundles(bundle('tutor-missing', off), { PRI_FEATURE_TUTOR: '1' });
  ok('a release that asked for the tutor fails on a tutor-off bundle', r.failures.length === 2 && r.failures.every(f => /tutor is on/.test(f)), r.failures.join(' | '));

  r = checkBundles(bundle('placement', { ...off, placement: true }), { PRI_FEATURE_PLACEMENT: '1' });
  ok('a non-shippable flag fails even when its environment asks for it', r.failures.length === 2, r.failures.join(' | '));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failures.length) {
  for (const f of failures) console.log('  ✖ ' + f);
  console.log(`IOS BUNDLE FLAG POLICY: FAIL — ${pass}/${pass + failures.length} checks`);
  process.exit(1);
}
console.log(`IOS BUNDLE FLAG POLICY: PASS — ${pass}/${pass} checks — only TUTOR may ship on, and only when the release build asked for it.`);
