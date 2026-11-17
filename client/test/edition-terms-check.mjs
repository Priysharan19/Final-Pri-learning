// Prithagoras (Australia) must not say an Indian thing.
//   node client/test/edition-terms-check.mjs
//
// The shared English catalogue is resolved the way a Prithagoras build resolves
// it (client/src/i18n/strings.au.js replaces a key's wording). Every resulting
// string is scanned for India-only terms: "Class 12", NCERT, CBSE, JEE,
// Olympiad, ₹ / INR / rupee, lakh, "board exam/paper/marks". A key that still
// carries one must be matched by a reasoned allowlist entry (an India-only
// surface), so a NEW shared string with such a term fails here until it is
// given an override or a reason. Priyabhata keeps its words: the catalogue
// itself is unchanged and the override applies only in a Prithagoras build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import en from '../src/i18n/strings.en.js';
import { AU_STRINGS } from '../src/i18n/strings.au.js';

const here = new URL('.', import.meta.url);
const BAN = /\bclass(es)?\s*[0-9]|\bclass\s*\{|ncert|cbse|\bjee\b|olympiad|₹|\binr\b|lakh|\bboard (exam|paper|marks)|rupee/i;

// India-only surfaces: each is gated to an Indian course or track and is not
// drawn for a Prithagoras profile. The reason is the gate.
const ALLOW = [
  [/^ncert\./, 'the NCERT chapter library and release notes (Indian courses only)'],
  [/^mock\./, 'CBSE board-format mock papers (engine/boardMock.js, Indian courses only)'],
  [/^board\./, 'CBSE board-style step marking sentences (Indian tracks only)'],
  [/^teach\.(.*India|noPredictionClassReport|noPredictionStudentReport|newClassPlaceholder|rosterHelp)/, 'teacher panel copy for Indian classes'],
  [/^exams\.(bp\.|jee|cbse|buildingJee|startJee|classPractice)/, 'Indian exam blueprints and tracks (CBSE, JEE, IOQM)'],
  [/^placement\./, 'the placement diagnostic walks the NCERT prerequisite spine (engine/placement.js); Indian courses only'],
  [/^gloss\./, 'NCERT Hindi term glossary; Prithagoras offers no Hindi'],
  [/^progress\.honesty$/, 'drawn by IndiaProgress.jsx only'],
  [/^practice\.pyqOnlyTitle$/, 'past-paper (JEE, CBSE) filter; Indian courses only, behind PRI_FEATURE_PAST_PAPERS'],
  [/^settings\.(helpBodyIndia|courseIndia|trackCbseDesc|trackJeeMainDesc|trackJeeAdvancedDesc|trackOlympiad)$/, 'Indian course and track pickers'],
  [/^paywall\.(premium|from)\.jeeAdvanced$/, 'the JEE Advanced premium track'],
  [/^home\.next\.firstIndia$/, 'first-step copy for Indian courses'],
  [/^login\.olympiadTrack$/, 'Indian track chooser at sign-up'],
  [/^signup\.trackJeeHint$/, 'Indian track chooser at sign-up']
];

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

const resolved = { ...en, ...AU_STRINGS };
const stringOf = v => (typeof v === 'string' ? v : JSON.stringify(v));

check('no shared string carries an India-only term into Prithagoras without an override or a reason', () => {
  const leaks = Object.keys(resolved).filter(k => BAN.test(stringOf(resolved[k])) && !ALLOW.some(([re]) => re.test(k)));
  assert.deepEqual(leaks, [], `add an en-AU override in strings.au.js, or a reasoned allowlist entry: ${leaks.join(', ')}`);
});
check('every override replaces a key that exists, and removes the India-only term', () => {
  for (const [k, v] of Object.entries(AU_STRINGS)) {
    assert.ok(Object.hasOwn(en, k), `${k} is not in the English catalogue`);
    assert.ok(!BAN.test(v), `${k} override still carries an India-only term`);
    const need = new Set([...en[k].matchAll(/\{(\w+)\}/g)].map(m => m[1]));
    const have = new Set([...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]));
    for (const p of have) assert.ok(need.has(p), `${k} override uses {${p}} which the original does not take`);
  }
});
check('the Australian wording the owner asked for', () => {
  assert.equal(AU_STRINGS['common.classNumber'], 'Year {n}');
  assert.match(AU_STRINGS['inst.mapProvenance'], /not a NESA publication\.$/);
  assert.ok(!/ncert|cbse/i.test(AU_STRINGS['inst.mapProvenance']));
});
check('Priyabhata keeps Class and NCERT: the shared catalogue is unchanged', () => {
  assert.equal(en['common.classNumber'], 'Class {n}');
  assert.match(en['inst.mapProvenance'], /NCERT or CBSE publication/);
});
check('the override applies only to a Prithagoras build in English', () => {
  const idx = readFileSync(fileURLToPath(new URL('../src/i18n/index.js', here)), 'utf8');
  assert.match(idx, /EDITION_ID === 'prithagoras' && language === 'en' && Object\.hasOwn\(AU_STRINGS, key\)/);
});
check('every allowlist entry still matches a key (a dead entry is removed)', () => {
  for (const [re] of ALLOW) assert.ok(Object.keys(en).some(k => re.test(k)), `${re} matches no key`);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`EDITION TERMS: FAIL ${failures.length}`); process.exit(1); }
console.log(`EDITION TERMS: PASS — ${pass} checks, ${Object.keys(AU_STRINGS).length} en-AU overrides, ${ALLOW.length} reasoned India-only allowances`);
