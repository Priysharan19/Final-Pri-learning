// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a build carries its own edition's brand and no other (plan E4)
//
// Reads a production build (client/dist by default) and proves that:
//   1. its index.html, manifest.webmanifest, favicon, mask icon, splash and
//      app icons are exactly its edition's (features.json names the edition);
//   2. no file in it carries the other edition's name, accent, wordmark path
//      data or icon bytes;
// and with --both, builds the other edition into a temporary folder and
// proves the two builds differ ONLY where branding should: the brand files of
// (1), features.json, the service worker's version line, the edition-record
// chunk (the only one holding the wordmark), and the three chunks E5's
// commercial configuration folds per edition, which must carry no brand —
// every other file is byte-identical once content hashes are set aside.
//
// Usage: node client/test/brand-build-check.mjs [--dist <dir>] [--both]
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, EDITION_IDS } from '../edition.config.mjs';
import { WEB_FILES, brandFile, webManifest } from '../brand/edition-brand.mjs';
import { PRIYABHATA_WORDMARK, PRITHAGORAS_WORDMARK } from '../src/brand/paths.js';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const DIST = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : join(CLIENT, 'dist');
const BOTH = args.includes('--both');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const walk = (d, base = '') => readdirSync(d).flatMap(n => {
  const p = join(d, n), r = base ? `${base}/${n}` : n;
  return statSync(p).isDirectory() ? walk(p, r) : [r];
});
const WORDMARK_OF = { priyabhata: PRIYABHATA_WORDMARK, prithagoras: PRITHAGORAS_WORDMARK };
// The tail of a wordmark's path: present only where that wordmark is.
const wordmarkTail = id => WORDMARK_OF[id].d.slice(-48);

function checkBuild(dist) {
  const edition = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8')).edition;
  ok(EDITION_IDS.includes(edition), `${dist}: features.json names an edition (${edition})`);
  const e = EDITIONS[edition];
  const other = EDITION_IDS.find(id => id !== edition);
  const o = EDITIONS[other];

  for (const rel of WEB_FILES) {
    ok(readFileSync(join(dist, rel)).equals(readFileSync(brandFile(edition, rel))), `${edition}: dist/${rel} is the edition's own file`);
  }
  ok(JSON.stringify(JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'))) === JSON.stringify(webManifest(edition)), `${edition}: dist/manifest.webmanifest is the edition's manifest`);
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  ok(html.includes(`<title>${e.brand}</title>`) && html.includes(`data-edition="${edition}"`) && !/%PRI_[A-Z_]+%/.test(html), `${edition}: index.html is titled ${e.brand}, marked, and fully filled`);
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  ok(['/manifest.webmanifest', '/favicon.svg', '/splash.svg', '/icons/icon-192.png'].every(f => sw.includes(`"${f}"`)), `${edition}: the service worker installs the brand files`);

  const otherIcons = WEB_FILES.filter(f => f.endsWith('.png')).map(f => readFileSync(brandFile(other, f)));
  const leaks = [];
  let ownWordmark = 0;
  for (const rel of walk(dist)) {
    const bytes = readFileSync(join(dist, rel));
    if (otherIcons.some(b => b.equals(bytes))) leaks.push(`${rel} (the other edition's icon)`);
    if (!/\.(js|css|html|json|webmanifest|svg|txt)$/.test(rel)) continue;
    const text = bytes.toString('utf8');
    if (text.includes(wordmarkTail(other))) leaks.push(`${rel} (${o.brand}'s wordmark)`);
    if (text.includes(wordmarkTail(edition))) ownWordmark++;
    // The edition table never reaches a bundle: the build replaces its one reader with this edition's record.
    if (text.includes('defaultCourse') && text.includes('capabilities')) leaks.push(`${rel} (the edition table)`);
    if (text.includes(o.brand) || text.toLowerCase().includes(o.identity.accent.light) || text.toLowerCase().includes(o.identity.accent.dark)) leaks.push(`${rel} (${o.brand}'s name or accent)`);
  }
  ok(leaks.length === 0, `${edition}: no file carries anything of ${o.brand}: ${leaks.join(', ')}`);
  ok(ownWordmark === 1, `${edition}: exactly one file carries its own wordmark (${ownWordmark})`);
  return edition;
}

// The notes are edition content (ADR-0002: curriculum differs): India's class notes and the Olympiad notes in one build,
// the NSW notes and their Experience 3 chunks in the other. The chunks that LOAD them name them (a route table imports
// `Notes` here and `NswNotes` there; studyJourney is the India notes' study-link helper, which the NSW notes do not use), so a name that is a notes chunk is read as one name when two builds are compared.
// What the notes chunks themselves hold is compared below under its own reason; nothing else may differ.
export const NOTES_CHUNK = /^(?:notes-.+|Notes|NswNotes|notesIndex|e3|studyJourney)$/;
// Owner decision, 19 Nov 2026: Prithagoras hides Rapid Fire and Match, so its build (vite.config.js __PRI_GAMES__) emits neither page.
export const GAMES_CHUNK = /^(?:Rush|Match)$/;
const NOTES_REF = /\b(?:notes-[A-Za-z0-9_-]+?|NswNotes|Notes|notesIndex|e3|studyJourney)-#\.(js|css)\b/g;
const norm = s => s.replace(/-[A-Za-z0-9_-]{8}\.(js|css|woff2?|ttf|png|svg|json)\b/g, '-#.$1').replace(/pri-[0-9a-f]{12}/g, 'pri-#').replace(NOTES_REF, 'NOTES-#.$1');
function contents(dist) {
  const byName = new Map();
  for (const rel of walk(dist)) {
    const bytes = readFileSync(join(dist, rel));
    const text = /\.(js|css|html|json|webmanifest|svg|txt)$/.test(rel);
    byName.set(rel, text ? norm(bytes.toString('utf8')) : bytes.toString('base64'));
  }
  return byName;
}

const first = checkBuild(DIST);
if (BOTH) {
  const other = EDITION_IDS.find(id => id !== first);
  const out = mkdtempSync(join(tmpdir(), `pri-${other}-`));
  try {
    execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: CLIENT, env: { ...process.env, PRI_EDITION: other }, stdio: ['ignore', 'ignore', 'inherit'] });
    checkBuild(out);
    const A = contents(DIST), B = contents(out);
    // The builds hold the same files, except the notes chunks of the curriculum each edition teaches.
    const rootOf = rel => rel.replace(/^assets\//, '').replace(/-[A-Za-z0-9_-]{8}\.\w+$/, '').replace(/^_pri-legal-hindi-none$/, 'legalHindi');
    const roots = m => new Set([...m.keys()].filter(rel => /-[A-Za-z0-9_-]{8}\.\w+$/.test(rel)).map(rootOf));
    const aOnly = [...roots(A)].filter(r => !roots(B).has(r)), bOnly = [...roots(B)].filter(r => !roots(A).has(r));
    ok(A.size === B.size || [...aOnly, ...bOnly].every(r => NOTES_CHUNK.test(r) || GAMES_CHUNK.test(r)), `the two builds have the same files, but for each edition's notes (${A.size}, ${B.size}; only in ${first}: ${aOnly.join(', ') || 'none'}; only in ${other}: ${bOnly.join(', ') || 'none'})`);
    // Files that keep their name (no content hash) are compared by name; hashed
    // chunks are compared as a set of normalised contents.
    const plain = rel => !/-[A-Za-z0-9_-]{8}\.\w+$/.test(rel);
    const BRAND = new Set([...WEB_FILES, 'index.html', 'manifest.webmanifest', 'features.json', 'sw.js']);
    const plainDiffer = [...A.keys()].filter(plain).filter(rel => A.get(rel) !== B.get(rel));
    ok(plainDiffer.every(rel => BRAND.has(rel)), `unhashed files differ only where the brand is: ${plainDiffer.filter(r => !BRAND.has(r)).join(', ')}`);
    ok(WEB_FILES.every(rel => plainDiffer.includes(rel)) && ['index.html', 'manifest.webmanifest'].every(rel => plainDiffer.includes(rel)), 'and every brand file does differ');
    const swLines = (m, f) => m.get('sw.js').split('\n').filter(l => !/^const (VERSION|PRECACHE|WARM|OPTIONAL) = /.test(l)).join('\n');
    ok(swLines(A) === swLines(B), 'sw.js differs only in its generated version and file lists');
    // Hashed chunks: compared by normalised content. Exactly these may differ,
    // each for a stated reason; any other difference fails.
    //   edition        the edition record, which holds this edition's name, cut and wordmark (E2, E4)
    //   Paywall, CloudAccountPanel, useGooglePlayPurchase, useSaleAvailable
    //                  commercial configuration: __PRI_PREMIUM_ON_SALE__ folds the
    //                  purchase paths of an edition that sells nothing (plan E5)
    //   i18n-hi, legalHindi, languages
    //                  the Prithagoras trim: an edition that offers fewer languages
    //                  ships a stub for the one it does not carry and a languages.js
    //                  clamped to the offered ones (clampLanguagesSource in
    //                  vite.config.js). Every export keeps its place, so no importer
    //                  differs in content; but a chunk is named by its content hash, so the
    //                  chunks that import `languages` by name (backend, indiaProduct,
    //                  streams-standard, year8-10) carry the other hash in their import
    //                  line. Priyabhata's own bundle is byte-identical to before.
    const MAY_DIFFER = {
      // The syllabus board is on in a Prithagoras build and off in a Priyabhata one (owner decision 18 Nov 2026, featureStates):
      // the feature chunk holds the build's own flag values.
      features: 'build flags',
      edition: 'brand', Paywall: 'commerce', CloudAccountPanel: 'commerce', useGooglePlayPurchase: 'commerce', useSaleAvailable: 'commerce', Legal: 'legal', i18n: 'language',
      'i18n-hi': 'language', legalHindi: 'language', languages: 'language', core: 'language',
      backend: 'language', indiaProduct: 'language', 'streams-standard': 'language', year8: 'language', year9: 'language', year10: 'language',
      // The chunks that import `backend` (and the route table that names each edition's notes) by minified export name:
      // the minifier numbers a chunk's exports by what the chunk holds, so when `backend` differs (above), every importer's
      // `import{It as v,…}` carries other letters, and the shell's preload lists hold one notes chunk more or fewer.
      // They differ in those letters and lists only; the brand and commerce checks below still apply to every chunk.
      App: 'cascade', IndexPage: 'cascade', InstrumentBar: 'cascade', MapPage: 'cascade', PageLink: 'cascade', QuestionCard: 'cascade',
      SyllabusBoard: 'cascade', api: 'cascade', classroomWords: 'cascade', copy: 'cascade', latex: 'cascade',
      // Owner decisions of 19 Nov 2026 (the edition table: offering, games, hints, themeDefault, walkthroughFixes): a chunk that reads one
      // of those values through the edition helpers is built with that edition's value, and its importers carry the other
      // letters. The brand and commerce checks below still apply to every one of them.
      AccountActivationGate: 'edition values', ExamRoom: 'edition values', Exams: 'edition values', History: 'edition values', InkAnswer: 'edition values',
      PaperGenerator: 'edition values', PracticeBase: 'edition values', PractisePhoto: 'edition values', ReportHead: 'edition values',
      Settings: 'edition values', Tasks: 'edition values', TrialNotice: 'edition values', index: 'edition values',
      AccountDeleteRequest: 'edition values', GuardianConsent: 'edition values', OfferedCourse: 'edition values', SignUpFlow: 'edition values', Teach: 'edition values',
      difficultyText: 'edition values', glossary: 'edition values', guest: 'edition values', offering: 'edition values'
    };
    //   core           i18n/core.js (split from i18n/index.js in train 23 so the server
    //                  can translate without React) picks the edition's en-AU overrides
    //   Legal          the legal page imports each edition's own notices (#954:
    //                  docs/legal/au for Prithagoras, the Indian set for Priyabhata)
    //   i18n           the language core carries each edition's en-AU overrides
    //   _pri-legal-hindi-none
    //                  Prithagoras's empty stand-in for legalHindi (vite.config.js
    //                  editionLegalPlugin), so the pair is compared under one name
    const ALIAS = { '_pri-legal-hindi-none': 'legalHindi' };
    const base = rel => { const b = rel.replace(/^assets\//, '').replace(/-[A-Za-z0-9_-]{8}\.\w+$/, ''); return ALIAS[b] || b; };
    const hashed = m => [...m.entries()].filter(([rel]) => !plain(rel));
    const contentsOf = m => new Set(hashed(m).map(([, c]) => c));
    const inB = contentsOf(B), inA = contentsOf(A);
    const onlyA = hashed(A).filter(([, c]) => !inB.has(c)), onlyB = hashed(B).filter(([, c]) => !inA.has(c));
    const names = list => [...new Set(list.map(([rel]) => base(rel)))].sort();
    // The notes chunks are each edition's own (named differently, so compared as a set per side); every other chunk that
    // differs must differ in BOTH builds, and each must be one of the allowed names above.
    const outsideNotes = list => names(list).filter(n => !NOTES_CHUNK.test(n) && !GAMES_CHUNK.test(n));
    ok(JSON.stringify(outsideNotes(onlyA)) === JSON.stringify(outsideNotes(onlyB)) && [...names(onlyA), ...names(onlyB)].every(n => (Object.hasOwn(MAY_DIFFER, n) || NOTES_CHUNK.test(n) || GAMES_CHUNK.test(n))),
      `hashed chunks differ only where an edition should (${names(onlyA).join(', ')} | ${names(onlyB).join(', ')})`);
    const brandChunks = (list, id) => list.filter(([, c]) => c.includes(wordmarkTail(id)));
    ok(brandChunks(onlyA, first).length === 1 && base(brandChunks(onlyA, first)[0][0]) === 'edition' && brandChunks(onlyB, other).length === 1 && base(brandChunks(onlyB, other)[0][0]) === 'edition',
      'the brand differs in exactly one chunk, the edition record, which holds the wordmark');
    const commerce = [...onlyA, ...onlyB].filter(([rel]) => MAY_DIFFER[base(rel)] === 'commerce');
    const brandTokens = EDITION_IDS.flatMap(id => [EDITIONS[id].brand, EDITIONS[id].identity.accent.light, EDITIONS[id].identity.accent.dark, wordmarkTail(id)]).concat(['प्रियभट']);
    ok(commerce.every(([, c]) => !brandTokens.some(t => c.includes(t))), 'the commercial chunks carry no brand: no edition name, accent or wordmark');
    console.log(`  ${first} vs ${other}: ${plainDiffer.length} named files differ (${plainDiffer.sort().join(', ')}), ${names(onlyA).length} hashed chunks differ (${names(onlyA).join(', ')}), ${A.size - plainDiffer.length - onlyA.length} files identical`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(`\nbrand-build-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`BRAND BUILD: PASS — ${pass}/${pass} checks${BOTH ? ' — both editions built; they differ only in brand files, the edition record, the E5 commercial chunks, the languages an edition does not offer, the notes of each edition, and the importers of those by minified name' : ''}`);
