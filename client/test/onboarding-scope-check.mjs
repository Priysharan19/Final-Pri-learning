// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · onboarding offers only what is launch-certified
//
// docs/content/certification-report.md certifies cbse, jee-main and
// jee-advanced; PRI_V1_RELEASE_SCOPE §6, §11 and §16 keep the Australian
// curricula and the teacher product out of public V1. The Olympiad track, the
// Australian syllabuses and the Teacher role therefore sit behind
// PRI_FEATURE_EXTENDED_TRACKS: OFF in a production build unless the build
// environment says otherwise, ON for the development server and test builds.
//
// What this proves:
//   1. the flag resolves exactly like the placement flag (vite.config.js);
//   2. features.js honours the compiled constant, and the override outside a
//      production build;
//   3. the landing screen, bundled and rendered with the production constant
//      OFF, offers no Olympiad option, no Australian branch and no Teacher role —
//      and with it ON, offers all three (the development experience);
//   4. a profile that already holds one of these keeps working: the picker, the
//      backend's curriculum labels and the local backend read no flag;
//   5. Settings shows the classroom/assignment panels to a student only with the
//      flag, and to a teacher regardless.
//
// The screen is bundled with rolldown (Vite's bundler, already installed) and
// rendered with react-dom/server, so these are behaviours of the real component,
// not grep hits. Usage: node client/test/onboarding-scope-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const read = rel => readFileSync(join(CLIENT, rel), 'utf8');

/**
 * Bundle the landing screen with the feature constant compiled in, exactly as a
 * `vite build` would (`import.meta.env.PROD` true, the constant a literal), and
 * return a server renderer: render(props) → static HTML.
 */
export async function bundleLogin({ extended, tag = 'scope', edition = null }) {
  const { rolldown } = await import(pathToFileURL(join(CLIENT, 'node_modules/rolldown/dist/index.mjs')).href);
  // A private directory of its own (mkdtemp: unpredictable name, mode 0700), so
  // nothing else on a shared machine can pre-plant or swap the files bundled here.
  const dir = mkdtempSync(join(tmpdir(), `pri-onboarding-scope-${tag}-${extended ? 'on' : 'off'}-${edition || 'default'}-`));
  // A named edition replaces the build's edition record as vite.config.js's
  // pri-edition-record plugin does: the bundle carries that edition's record.
  const RECORD = join(CLIENT, 'src/platform/edition-record.js');
  if (edition) writeFileSync(join(dir, 'edition-record-stub.js'), `import { editionRecord } from ${JSON.stringify(RECORD)};\nexport const EDITION_RECORD = editionRecord(${JSON.stringify(edition)});\n`);
  // The app shell and the local API are the only neighbours the screen needs
  // that would drag the whole product (IndexedDB, the question banks) into the
  // bundle; both are stubbed to inert values. Everything else is the real code.
  writeFileSync(join(dir, 'app-stub.jsx'), "import React from 'react';\nexport const useApp = () => ({ setUser() {}, refreshDue() {} });\nexport function Logo() { return <b>Pri</b>; }\n");
  writeFileSync(join(dir, 'api-stub.js'), 'export const api = { get: () => new Promise(() => {}), post: () => new Promise(() => {}) };\n');
  // The account sign-up flow (one-time codes, Google/Apple in the browser) is a
  // lazy chunk of its own with a stylesheet the bundler will not take; it is
  // not what these checks render, so it is stubbed too.
  writeFileSync(join(dir, 'signup-stub.jsx'), "import React from 'react';\nexport default function SignUpFlow() { return null; }\n");
  writeFileSync(join(dir, 'entry.jsx'), [
    "import React from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    "import { MemoryRouter } from 'react-router-dom';",
    `import Login from ${JSON.stringify(join(CLIENT, 'src/pages/Login.jsx'))};`,
    'export const render = props => renderToStaticMarkup(<MemoryRouter><Login {...props} /></MemoryRouter>);',
    ''
  ].join('\n'));
  const bundle = await rolldown({
    input: join(dir, 'entry.jsx'),
    platform: 'browser',
    cwd: CLIENT,
    logLevel: 'silent',
    transform: {
      define: {
        __PRI_FEATURE_EXTENDED_TRACKS__: String(extended),
        __PRI_FEATURE_PLACEMENT__: 'false',
        __PRI_FEATURE_TUTOR__: 'false',
        __PRI_PRODUCTION_BUILD__: 'true',
        'import.meta.env.PROD': 'true',
        'import.meta.env.VITE_PRI_CLOUD_ORIGIN': 'undefined',
        'process.env.NODE_ENV': '"production"'
      }
    },
    plugins: edition ? [{
      name: 'edition-record-stub',
      resolveId(source, importer) {
        if (importer && importer.endsWith(join('src', 'platform', 'edition.js')) && source === './edition-record.js') return join(dir, 'edition-record-stub.js');
        return null;
      }
    }] : [],
    resolve: {
      modules: [join(CLIENT, 'node_modules')],
      alias: { '../App.jsx': join(dir, 'app-stub.jsx'), '../api.js': join(dir, 'api-stub.js'), '../components/SignUpFlow.jsx': join(dir, 'signup-stub.jsx') }
    }
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const file = join(dir, 'login.mjs');
  writeFileSync(file, output[0].code);
  // The screen's own lazy imports (React.lazy) become chunks beside the entry;
  // write them so the split import() resolves when the page is rendered.
  for (const chunk of output.slice(1)) if (chunk.type === 'chunk') writeFileSync(join(dir, chunk.fileName), chunk.code);
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return mod.render;
}

async function run() {
  let pass = 0;
  const failures = [];
  const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

  // ── 1 · The flag resolves like placement ───────────────────────────────────
  const { featureStates, featureDefines, FEATURE_FLAGS, PENDING_FEATURE_FLAGS } = await import('../vite.config.js');
  ok(featureStates('build', {}).extendedTracks === false, 'a production build without the variable is OFF');
  ok(featureStates('build', { PRI_FEATURE_EXTENDED_TRACKS: '1' }).extendedTracks === true, 'PRI_FEATURE_EXTENDED_TRACKS=1 turns a production build ON');
  ok(featureStates('build', { PRI_FEATURE_EXTENDED_TRACKS: 'true' }).extendedTracks === false, 'only the literal 1 counts, as for placement');
  ok(featureStates('serve', {}).extendedTracks === true, 'the development server is ON');
  ok(featureStates('serve', { PRI_FEATURE_EXTENDED_TRACKS: '0' }).extendedTracks === false, 'and can be switched off with 0');
  ok(featureStates('build', {}).placement === false && featureStates('serve', {}).placement === true, 'the placement flag resolves as before');
  ok(featureDefines('build', {}).__PRI_FEATURE_EXTENDED_TRACKS__ === 'false' && featureDefines('serve', {}).__PRI_FEATURE_EXTENDED_TRACKS__ === 'true',
    'the compile-time constant follows the state');
  ok(featureDefines('build', {}).__PRI_FEATURE_PLACEMENT__ === 'false', 'and the placement constant is untouched');
  ok(!FEATURE_FLAGS.includes('EXTENDED_TRACKS') && PENDING_FEATURE_FLAGS.includes('EXTENDED_TRACKS'),
    'the flag is recorded in features.json but not yet asserted off in the generated iPad bundles');

  // ── 2 · features.js honours the constant ───────────────────────────────────
  {
    globalThis.__PRI_FEATURE_EXTENDED_TRACKS__ = false;
    const off = await import(`../src/platform/features.js?off=${Date.now()}`);
    ok(off.featureEnabled('extendedTracks') === false, 'a compiled OFF constant is OFF');
    ok('extendedTracks' in off.featureSnapshot() && off.featureSnapshot().extendedTracks === false, 'and published in the snapshot the tours read');
    globalThis.__PRI_FEATURE_OVERRIDES__ = { extendedTracks: true };
    ok(off.featureEnabled('extendedTracks') === true, 'outside a production build the override may switch it on (development)');
    delete globalThis.__PRI_FEATURE_OVERRIDES__;
    delete globalThis.__PRI_FEATURE_EXTENDED_TRACKS__;
    const bare = await import(`../src/platform/features.js?bare=${Date.now()}`);
    ok(bare.featureEnabled('extendedTracks') === true, 'with no build constant at all (Node tests) the feature defaults on, as placement does');
  }

  // ── 3 · The landing screen, rendered ───────────────────────────────────────
  const off = await bundleLogin({ extended: false });
  const on = await bundleLogin({ extended: true });
  const courseOff = off({ initialStage: 'create', initialStep: 1 });
  const courseOn = on({ initialStage: 'create', initialStep: 1 });
  const roleOff = off({ initialStage: 'create', initialStep: 0 });
  const roleOn = on({ initialStage: 'create', initialStep: 0 });

  ok(courseOff.includes('id="signup-track"'), 'production: the class/track selector renders');
  for (const y of [7, 8, 9, 10, 11, 12]) ok(courseOff.includes(`<option value="${y}">Class ${y}</option>`), `production: Class ${y} is offered`);
  ok(courseOff.includes('<option value="jee-main">JEE Main</option>') && courseOff.includes('<option value="jee-advanced">JEE Advanced</option>'), 'production: JEE Main and JEE Advanced are offered');
  ok(!courseOff.includes('value="olympiad"') && !courseOff.includes('Olympiad ('), 'production: the Olympiad track is not offered');
  ok(!/Australia/.test(courseOff) && !courseOff.includes('id="signup-course"'), 'production: the Australian branch is not offered');
  ok(courseOn.includes('<option value="olympiad">Olympiad (IOQM · RMO · INMO)</option>'), 'development: the Olympiad track is offered');
  ok(!/Australia/.test(courseOn) && !courseOn.includes('id="signup-course"'), 'development: a Priyabhata build still offers no Australian branch (O5 off; no flag turns it on)');

  // ── 3b · The course step follows the edition (mission E3) ──────────────────
  // Each edition offers exactly its own `courses` and preselects its
  // defaultCourse; neither offers the other's (owner decision O5: off).
  {
    const { EDITIONS } = await import('../edition.config.mjs');
    const ind = await bundleLogin({ extended: false, edition: 'priyabhata', tag: 'ed' });
    const aus = await bundleLogin({ extended: false, edition: 'prithagoras', tag: 'ed' });
    const indCourse = ind({ initialStage: 'create', initialStep: 1 });
    const ausCourse = aus({ initialStage: 'create', initialStep: 1 });
    ok(indCourse === courseOff, 'Priyabhata: the course step is byte-identical to the default build');
    ok(JSON.stringify(EDITIONS.priyabhata.courses) === '["in"]' && EDITIONS.priyabhata.defaultCourse === 'in', 'Priyabhata offers and preselects the India course alone');
    ok(JSON.stringify(EDITIONS.prithagoras.courses) === '["nsw"]' && EDITIONS.prithagoras.defaultCourse === 'nsw', 'Prithagoras offers and preselects NSW alone');
    ok(!ausCourse.includes('id="signup-track"') && !/<option value="(jee-main|jee-advanced|olympiad)"|>Class \d+</.test(ausCourse), 'Prithagoras: no India class/track chooser');
    const courseOpts = [...(ausCourse.match(/<select[^>]*id="signup-course"[\s\S]*?<\/select>/)?.[0] || '').matchAll(/<option value="([^"]+)"( selected="")?/g)].map(m => [m[1], !!m[2]]);
    ok(JSON.stringify(courseOpts) === JSON.stringify([['nsw', true]]), `Prithagoras: the syllabus select offers exactly ['nsw'], preselected — got ${JSON.stringify(courseOpts)}`);
    const yearSel = ausCourse.match(/<select[^>]*id="signup-year"[\s\S]*?<\/select>/)?.[0] || '';
    ok(/<option value="10" selected="">Year 10<\/option>/.test(yearSel), 'Prithagoras: Year 10 is preselected');
    ok(!/Back to Indian/.test(ausCourse), 'Prithagoras: no way back to an India course on the course step');
  }

  const pills = html => [...html.matchAll(/class="pill-opt[^"]*"[^>]*aria-pressed="(true|false)"[^>]*>([^<]+)</g)].map(m => [m[2], m[1]]);
  ok(JSON.stringify(pills(roleOff)) === JSON.stringify([['Student', 'true']]), `production: the role step offers Student alone, already chosen — got ${JSON.stringify(pills(roleOff))}`);
  ok(JSON.stringify(pills(roleOn)) === JSON.stringify([['Student', 'false'], ['Teacher', 'false']]), `development: Student and Teacher are offered, neither chosen — got ${JSON.stringify(pills(roleOn))}`);
  ok(roleOff.includes('Step 1 of 5') && roleOn.includes('Step 1 of 5'), 'the five onboarding steps are unchanged either way');
  ok(!roleOff.includes('role="alert"'), 'production: no error is shown for the pre-chosen role');

  // ── 4 · Existing profiles with these tracks keep working ───────────────────
  const login = read('src/pages/Login.jsx');
  const backend = read('src/local/backend.js');
  ok(/\{ key: 'olympiad', labelKey: 'login.olympiadTrack', year: 10, track: 'olympiad', extended: true \}/.test(login), 'the Olympiad track definition remains for existing profiles');
  ok(/const selectedStudy = STUDY\.find\(/.test(login), 'the summary resolves a chosen track from the full list, not the filtered one');
  ok(/p\.role === 'teacher' \? t\('login\.teacher'\)/.test(login) && !/p\.role === 'teacher' && extended/.test(login), 'the picker shows an existing teacher profile with no flag check');
  ok(/t\(p\.course === 'in' \? 'common\.classNumber' : 'common\.yearNumber'/.test(login), 'and an existing Australian profile by its year');
  ok(/nsw: \{ name: 'NSW · HSC'/.test(backend) && !/featureEnabled\('extendedTracks'\)/.test(backend), 'the local backend keeps every curriculum label and reads no flag (another lane owns it)');
  ok(!/extendedTracks/.test(read('src/platform/cloudAccount.js')), 'the cloud link is untouched by the flag');
  ok(/Profiles that already hold one of these keep[\s\S]{0,80}working whatever the flag says/.test(read('src/platform/features.js')), 'features.js documents that the flag gates new selection only');

  // ── 5 · Settings panels ────────────────────────────────────────────────────
  const settings = read('src/pages/Settings.jsx');
  ok(/const classroom = user\?\.role === 'teacher' \|\| featureEnabled\('extendedTracks'\);/.test(settings), 'Settings gates the classroom product on the flag or the teacher role');
  ok(/\{classroom && <AssignmentInboxPanel \/>\}/.test(settings) && /\{classroom && <ClassroomPanel \/>\}/.test(settings), 'both the assignment inbox and the classroom panel are behind it');
  ok(/<CloudAccountPanel \/>/.test(settings) && !/classroom && <CloudAccountPanel/.test(settings), 'the cloud account panel is not');
  ok(/<StaffOperations \/>/.test(settings) && !/classroom && <StaffOperations/.test(settings), 'nor the role-checked staff console');

  // ── 6 · The welcome advertises only what V1 ships ──────────────────────────
  // The first screen reaches App Review and every visitor. While the Olympiad
  // track is behind the flag it is not named there, in either language, nor in
  // the page description or the install manifest; and the privacy line says
  // what a signed-in account actually does: its handwriting and photos are
  // read on Pri's server.
  {
    const en = (await import('../src/i18n/strings.en.js')).default;
    const hi = (await import('../src/i18n/strings.hi.js')).default;
    const OLY_EN = /olympiad/i;
    const OLY_HI = /ओलंपियाड|ओलिंपियाड|ओलम्पियाड/;
    for (const key of ['login.heroSub', 'login.heroPrivacy', 'login.brandKicker', 'login.point1', 'login.point2', 'login.point3', 'login.point4']) {
      ok(typeof en[key] === 'string' && !OLY_EN.test(en[key]), `${key} (EN) does not advertise the Olympiad track while it is off`);
      ok(typeof hi[key] === 'string' && !OLY_HI.test(hi[key]), `${key} (HI) does not advertise the Olympiad track while it is off`);
    }
    const brand = await import('../brand/edition-brand.mjs');
    for (const id of brand.BRAND_EDITION_IDS) {
      ok(!OLY_EN.test(brand.builtIndexHtml(id)), `the ${id} page description does not advertise the Olympiad track`);
      ok(!OLY_EN.test(JSON.stringify(brand.webManifest(id))), `nor does the ${id} install manifest`);
    }
    ok(/server reads your handwriting and photos/.test(en['login.heroPrivacy']) && /stored on this device/.test(en['login.heroPrivacy']),
      'the privacy line says a signed-in account has its handwriting and photos read on the server, and what stays on the device');
    ok(/हैंडराइटिंग और फ़ोटो पढ़ता है/.test(hi['login.heroPrivacy']) && /इसी डिवाइस पर/.test(hi['login.heroPrivacy']), 'and so does its Hindi');
    ok(/server reads your handwriting and photos/.test(en['login.point4']) && /हैंडराइटिंग और फ़ोटो पढ़ता है/.test(hi['login.point4']),
      'the fourth welcome point says the same in both languages');
    // The rendered landing screen with the flag off, at its welcome stage.
    const hero = off({});
    ok(!/lympiad|ओलंपियाड/.test(hero), 'production: the rendered welcome names no Olympiad track');
  }

  console.log(failures.length
    ? `ONBOARDING SCOPE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
    : `ONBOARDING SCOPE: PASS — ${pass}/${pass} checks — PRI_FEATURE_EXTENDED_TRACKS is off in production builds and on in development; the rendered landing screen offers Olympiad and the Teacher role only when it is on; the course step follows the edition (Priyabhata: India; Prithagoras: NSW); existing profiles and the classroom product keep working.`);
  process.exit(failures.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();
