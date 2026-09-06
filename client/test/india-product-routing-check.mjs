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
assert.match(indiaProgress, /No percentile, no rank/,
  'India progress must explicitly refuse the predictions a practice history cannot support');
assert.match(indiaProgress, /does not convert a practice history into a CBSE percentage, a JEE percentile or a rank/,
  'and must say in words which three things it will not claim');
// A mark estimate over practised content is a different claim from a board
// percentage, and it is only honest while it travels with its coverage.
assert.match(indiaProgress, /marks practised/,
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
