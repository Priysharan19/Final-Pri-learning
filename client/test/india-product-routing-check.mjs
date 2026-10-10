import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

const api = read('src/api.js');
const progress = read('src/pages/Progress.jsx');
const australia = read('src/pages/ProgressAustralia.jsx');
const indiaProgress = read('src/pages/IndiaProgress.jsx');
const exams = read('src/pages/Exams.jsx');
const indiaExamBackend = read('src/local/indiaExamBackend.js');
const legacyBackend = read('src/local/backend.js');

assert.match(api, /activeUser\?\.course === 'in' && indiaExamRoute\(method, path\)/,
  'India profiles must intercept exam routes before the legacy backend');
// The reviewed-provenance rule for JEE previous-year cells is one definition,
// read by the device when it composes a paper and by the server when it checks
// the paper spec (engine/indiaExamCells.js).
assert.match(read('src/engine/indiaExamCells.js'), /target\?\.pyqArchive !== 'jee-question-department'/,
  'JEE Main exam mode must require reviewed PYQ provenance');
assert.match(indiaExamBackend, /indiaPyqCells\(track, chapters\)/,
  'and the India exam backend must compose from those reviewed cells');
assert.match(read('../server/platform/exams.js'), /indiaIssuableCells\(b\.track, b\.grade\)/,
  'and the server must issue a paper from the same cells only');
// Owner decision 2026-10-10: an examination paper is marked by the server and
// nowhere else. The two exam backends and the module they share must not be
// able to mark an answer: none of them may reach the engine's checker.
for (const [name, source] of [['indiaExamBackend.js', indiaExamBackend], ['serverExam.js', read('src/local/serverExam.js')]]) {
  assert.doesNotMatch(source, /engine\/checker\.js/, `${name} must not import the answer checker`);
  assert.doesNotMatch(source, /\b(checkAnswer|stepCheck|methodMarks|markObjective|markMultiCorrect)\s*\(/, `${name} must not mark an answer`);
}
{
  const from = legacyBackend.indexOf('  // ---- exams ----');
  const to = legacyBackend.indexOf('  // ---- rush ----');
  assert.ok(from > 0 && to > from, 'the practice-paper routes are where this check expects them');
  const examRoutes = legacyBackend.slice(from, to);
  assert.doesNotMatch(examRoutes, /\b(checkAnswer|stepCheck|methodMarks)\s*\(/, 'the practice-paper routes must not mark an answer on the device');
  assert.match(examRoutes, /issueServerExam\(/, 'a practice paper must be issued by the server');
  assert.match(examRoutes, /finishOnServer\(/, 'and finished on the server');
  assert.match(examRoutes, /EXAM_NOT_SERVER_ISSUED/, 'and a paper the server never issued must be refused, not marked');
}
assert.match(indiaExamBackend, /issueServerExam\(/, 'an India paper must be issued by the server');
assert.match(indiaExamBackend, /finishOnServer\(/, 'and finished on the server');
assert.match(indiaExamBackend, /requireExamAccount\(profile\.id\)/, 'and may not start without a signed-in account');
assert.match(indiaExamBackend, /JEE_REVIEWED_BANK_INSUFFICIENT/,
  'exam generation must fail closed when reviewed coverage cannot fill the authentic structure');
assert.match(legacyBackend, /HSC-style/,
  'the legacy backend still contains Australian HSC exam logic, making the interception contract release-critical');

assert.match(progress, /user\?\.course === 'in' \? <IndiaProgress \/> : <ProgressAustralia \/>/,
  'India users must route to the India-native progress presentation');
assert.match(australia, /ProgressLegacy/,
  'Australian progress must remain available as the preserved legacy implementation');
// The copy lives in the string catalogues now, so the page's job is to reach
// for the right keys and the catalogue's job is to say the right thing. Both
// are checked, because a page that drops the key and a catalogue that softens
// the sentence are different failures with the same symptom.
assert.match(indiaProgress, /progress\.noPercentile/,
  'India progress must reach for the key that refuses percentile and rank');
assert.match(indiaProgress, /progress\.honesty/,
  'and for the key that says which predictions it will not make');

for (const catalogue of ['src/i18n/strings.en.js', 'src/i18n/strings.hi.js']) {
  const src = read(catalogue);
  for (const key of ['progress.noPercentile', 'progress.honesty']) {
    const line = src.split(`'${key}':`)[1]?.split('\n')[0] || '';
    assert.ok(line.length > 0, `${catalogue} defines ${key}`);
  }
  const coverage = src.split("'progress.marksPractised':")[1]?.split('\n')[0] || '';
  assert.ok(/\{covered\}/.test(coverage) && /\{total\}/.test(coverage),
    `${catalogue} states the coverage as a share of the paper, not a bare number`);
  const honesty = src.split("'progress.honesty':")[1].split('\n')[0];
  assert.match(honesty, /CBSE/, `${catalogue} names the CBSE percentage it will not claim`);
  assert.match(honesty, /JEE/, `${catalogue} names the JEE percentile it will not claim`);
}
// A mark estimate over practised content is a different claim from a board
// percentage, and it is only honest while it travels with its coverage.
assert.match(indiaProgress, /progress\.marksPractised/,
  'any mark estimate on this page must state how much of the paper it covers');
// Targeted at the Australian UI itself, not at the words: this page has to be
// able to SAY "percentile" and "rank" in order to refuse them, and an earlier
// version of this assertion banned the vocabulary the refusal is written in.
assert.doesNotMatch(indiaProgress, /Demonstrated Mark History|Band \(predicted\)|ProgressAustralia|scaledBand/,
  'the Australian scaled-band prediction UI must not leak into India progress');
assert.doesNotMatch(indiaProgress, /your (?:predicted )?(?:percentile|rank) (?:is|would be)/i,
  'and the page must never state a percentile or a rank as a result');
assert.doesNotMatch(exams, /same difficulty profile as the real thing/i,
  'generic exam copy must not make an authenticity claim');
// The copy lives in the string catalogue; the page must render the JEE Main
// intro through the key that names the Mathematics section, and the English
// catalogue must still say exactly that.
assert.match(exams, /tx\('exams\.jeeMainIntro',\s*\{\s*section:[^}]*t\('exams\.jeeMainSection'\)/,
  'JEE Main product must identify itself as a mathematics-section simulation');
const enCatalogue = (await import('../src/i18n/strings.en.js')).default;
assert.equal(enCatalogue['exams.jeeMainSection'], 'Mathematics section',
  'the English catalogue must name the JEE Main product the Mathematics section');
assert.match(enCatalogue['exams.jeeMainIntro'] || '', /simulation of the \{section\} of JEE Main 2026 Paper 1/,
  'and the intro must call it a simulation of that section, not of the whole paper');
assert.doesNotMatch(Object.entries(enCatalogue).filter(([k]) => k.startsWith('exams.')).map(([, v]) => JSON.stringify(v)).join('\n'),
  /same difficulty profile as the real thing/i,
  'generic exam copy in the catalogue must not make an authenticity claim either');

console.log('INDIA PRODUCT ROUTING — PASS — India exams cannot reach HSC generation and India progress cannot render Australian prediction semantics.');
