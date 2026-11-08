// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the V1 interface decisions D7–D11, held in source
//
// D7  one student interface, from one setting, on every build (sections 1–5);
// D8  the plain Instrument tokens are what ships until the Aurora skin passes
//     its gates (the setting's INTERFACE_SKIN);
// D10 anything the V1 evidence does not cover is hidden from students,
//     starting with Classes (section 6);
// D11 the Hindi switch stays and the app says questions stay in English
//     (section 7).
//
// V1 decision D7: "One student UI: the Instrument structure ... Every build
// (web, iOS, Android) ships it from one setting." The setting is
// client/interface.config.mjs. This suite reads source and runs the build
// config's own functions to prove that:
//
//   1. the setting names a known interface and skin, and the Vite config takes
//      the interface from it in every mode (build, development server);
//   2. no build variable can fork it: PRI_FEATURE_INSTRUMENT set to anything
//      changes nothing, and the Dockerfile no longer forwards it;
//   3. the three build paths all run that same Vite build: the Dockerfile
//      (web, Railway), scripts/sync-ios.mjs (both iOS packages copy
//      client/dist) and the Android release script (npm run build, then the
//      Gradle task that refuses a stale client/dist);
//   4. the client reads the same constant: App.jsx, features.js (whose Node
//      default now matches what production ships) and the theme default;
//   5. the generated-bundle check holds each iOS bundle to the setting.
//
// The generated bundles themselves are checked where they are generated (the
// CI build job runs ios-bundle-features-check.mjs after npm run sync:ios);
// install-budget-check.mjs checks the web dist's features.json.
//
// Usage: node client/test/interface-decisions-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const setting = await import('../interface.config.mjs');
ok(setting.STUDENT_INTERFACES.includes(setting.STUDENT_INTERFACE), `the setting names a known interface (${setting.STUDENT_INTERFACE})`);
ok(setting.INTERFACE_SKINS.includes(setting.INTERFACE_SKIN), `and a known skin (${setting.INTERFACE_SKIN})`);
ok(setting.STUDENT_INTERFACE === 'instrument', 'D7: the one student interface is the Instrument');
ok(setting.INTERFACE_SKIN === 'instrument', 'D8: until the Aurora skin passes its gates, the Instrument wears its plain tokens');

// ── 1 + 2 · the build takes the interface from the setting, whatever the env ──
const saved = process.env.PRI_FEATURE_INSTRUMENT;
const warn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args.join(' '));
process.env.PRI_FEATURE_INSTRUMENT = '0';
const vite = await import('../vite.config.js');
console.warn = warn;
if (saved === undefined) delete process.env.PRI_FEATURE_INSTRUMENT; else process.env.PRI_FEATURE_INSTRUMENT = saved;
ok(vite.INSTRUMENT_BUILD === (setting.STUDENT_INTERFACE === 'instrument'), 'vite.config.js takes the interface from the setting');
ok(warnings.some(w => /PRI_FEATURE_INSTRUMENT=0 is ignored/.test(w)), 'a disagreeing PRI_FEATURE_INSTRUMENT is ignored, and the build says so');
for (const [command, env] of [['build', {}], ['build', { PRI_FEATURE_INSTRUMENT: '0' }], ['build', { PRI_FEATURE_INSTRUMENT: '1' }], ['serve', {}], ['serve', { PRI_FEATURE_INSTRUMENT: '0' }]]) {
  const states = vite.featureStates(command, env);
  ok(states.instrument === true && states.skin === setting.INTERFACE_SKIN,
    `${command} with ${JSON.stringify(env)}: features.json records the one interface and its skin (${JSON.stringify({ instrument: states.instrument, skin: states.skin })})`);
  ok(vite.featureDefines(command, env).__PRI_FEATURE_INSTRUMENT__ === 'true', `${command} with ${JSON.stringify(env)}: the client constant is true`);
}
ok(!vite.PENDING_FEATURE_FLAGS.includes('INSTRUMENT') && !vite.FEATURE_FLAGS.includes('INSTRUMENT'), 'INSTRUMENT is no longer a build flag');

// ── 3 · every build path runs that same build ─────────────────────────────────
const docker = read('Dockerfile');
ok(!/ARG PRI_FEATURE_INSTRUMENT|PRI_FEATURE_INSTRUMENT=\$\{/.test(docker), 'the Dockerfile no longer forwards a per-environment interface variable');
ok(/COPY client \.\/client/.test(docker), 'and its image build copies client/, which holds the setting');
ok(/'index\.html', 'release\.json', 'features\.json'/.test(read('scripts/sync-ios.mjs')), 'both iOS packages copy client/dist, features.json included');
ok(/npm run build/.test(read('android/scripts/build-release-aab.sh')) && /client\/dist/.test(read('android/app/build.gradle.kts')),
  'the Android release builds the same client/dist and packages it');

// ── 4 · the client reads the same constant ───────────────────────────────────
const app = read('client/src/App.jsx');
ok(/const INSTRUMENT_BUILD = typeof __PRI_FEATURE_INSTRUMENT__ === 'boolean' && __PRI_FEATURE_INSTRUMENT__ && import\.meta\.env\?\.PROD === true;/.test(app),
  'App.jsx reads the build constant directly, so the bundler drops the v1.0 shell');
ok(/instrument: typeof __PRI_FEATURE_INSTRUMENT__ === 'boolean' \? __PRI_FEATURE_INSTRUMENT__ : true/.test(read('client/src/platform/features.js')),
  'features.js defaults to the shipped interface where there is no build constant (the Node suites)');

// ── 5 · the bundles are held to it ───────────────────────────────────────────
const bundleCheck = read('client/test/ios-bundle-features-check.mjs');
ok(/flags\.instrument === INSTRUMENT_BUILD/.test(bundleCheck) && /flags\.skin === INTERFACE_SKIN/.test(bundleCheck),
  'ios-bundle-features-check holds each generated bundle to the setting');
ok(/eq\(flags\?\.instrument, INSTRUMENT,/.test(read('client/test/install-budget-check.mjs')), 'install-budget-check holds the web dist to it');

// ── 6 · D10: what V1 evidence does not cover is hidden, starting with Classes ─
ok(/const CLASSES_ON = featureEnabled\('extendedTracks'\);/.test(app), 'D10: the student Classes tab follows the classroom flag');
ok(/\.\.\.\(CLASSES_ON \? \[\{ to: '\/classes'/.test(app), 'D10: the nav lists Classes only where that flag is on');
ok(/<Route path="\/classes" element=\{CLASSES_ON && Classes \?[^}]*: <Navigate /.test(app), 'D10: and the route redirects where it is off');
{
  const states = vite.featureStates('build', {});
  ok(states.extendedTracks === false, 'D10: a production build is made with the classroom flag off');
}

// ── 7 · D11: the Hindi switch stays, and says questions stay in English ──────
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
ok(/Questions and worked solutions stay in English/.test(en['lang.help']), 'D11: the English note says questions and worked solutions stay in English');
ok(/अंग्रेज़ी/.test(hi['lang.help']), 'D11: and its Hindi says the same');
const login = read('client/src/pages/Login.jsx');
ok(/function LanguagePicker\(\)[\s\S]{0,1600}\{chosen !== 'en' && <p className="muted lang-note" data-lang-note role="note">\{t\('lang\.help'\)\}<\/p>\}/.test(login),
  'D11: the welcome screen\'s language switch says it the moment another language is chosen');
ok(/\{t\('lang\.help'\)\}/.test(read('client/src/pages/SettingsLegacy.jsx')), 'D11: and Settings says it under its own switch');
ok(/LANGUAGES\.map/.test(login), 'D11: the switch itself stays on the welcome screen');

if (failures.length) {
  console.log(`INTERFACE DECISIONS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`INTERFACE DECISIONS: PASS — ${pass}/${pass} checks — D7: web, iOS and Android build the ${setting.STUDENT_INTERFACE} interface (${setting.INTERFACE_SKIN} skin, D8) from client/interface.config.mjs and no build variable can fork it; D10: Classes hidden where the classroom flag is off; D11: the language switch says questions stay in English.`);
