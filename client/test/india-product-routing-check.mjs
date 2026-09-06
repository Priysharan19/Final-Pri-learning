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
assert.match(indiaExamBackend, /target\?\.pyq/,
  'JEE Main exam mode must require reviewed PYQ provenance');
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
assert.match(exams, /Mathematics section/,
  'JEE Main product must identify itself as a mathematics-section simulation');

console.log('INDIA PRODUCT ROUTING — PASS — India exams cannot reach HSC generation and India progress cannot render Australian prediction semantics.');
