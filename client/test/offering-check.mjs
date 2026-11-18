// Pri Learning · what Prithagoras offers (owner decisions, 19 Nov 2026), and that India is untouched
//
//   1  Years 11 and 12, Mathematics Advanced and Extension 1 only; the rest hidden, not deleted
//   2  a new device opens DARK in Prithagoras (and follows the device in India), with no flash
//   3  hints are free in Prithagoras practice (the ladder stays; the full solution still ends the attempt)
//   4  Rapid Fire and Match hidden in Prithagoras
//   5  the paid tier is "HSC Pass" in Prithagoras copy; internal ids unchanged
//
// Every decision is one field of the edition table, so each is one switch to reverse.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editionOf, editionProblems, EDITIONS } from '../edition.config.mjs';
import { subtopicOfferedIn, courseOfferedIn, pathwayOfSubtopic } from '../src/engine/offeringRules.js';
import { SUBTOPICS, DIFF_WORDS, DIFF_LABELS, STREAM_CURRICULUM } from '../src/engine/curriculum.js';
import { markWeightAfter, ladderEvidence, HINT_RUNGS } from '../src/engine/hintLadder.js';
import { editionRecord } from '../src/platform/edition-record.js';
import { brandIndexHtml } from '../brand/edition-brand.mjs';
import { AU_STRINGS } from '../src/i18n/strings.au.js';
import { renameTier } from '../src/i18n/tierName.js';
import en from '../src/i18n/strings.en.js';
import { hintsAreFree, editionOffering } from '../../server/platform/edition.js';

const here = new URL('.', import.meta.url);
const read = f => readFileSync(new URL(f, here), 'utf8');
let pass = 0;
const ok = (c, name) => { assert.ok(c, name); pass++; };
const eq = (a, b, name) => { assert.deepEqual(a, b, name); pass++; };

const AU = editionOf('prithagoras'), IN = editionOf('priyabhata');

// 1 · the offering
eq(AU.offering.years, [11, 12], 'Prithagoras offers Years 11 and 12');
eq(AU.offering.pathways, ['advanced', 'ext1'], 'Advanced and Extension 1');
eq([AU.offering.defaultYear, AU.offering.defaultPathway], [12, 'advanced'], 'a new student starts on Year 12, Advanced');
eq(IN.offering, null, 'India offers everything: no offering');
eq(editionProblems(), [], 'the edition table is consistent');
eq(editionRecord('priyabhata').offering, null, 'and the India record carries none');
eq(editionRecord('prithagoras').offering.years, [11, 12], 'the Prithagoras record carries it');
eq(editionOffering({ PRI_EDITION: 'prithagoras' }).years, [11, 12], 'the server reads the same offering');
eq(editionOffering({}), null, 'and the default (India) server offers all');

// A stream subtopic's id names its course (offeringRules.js pathwayOfSubtopic): proved against the whole catalogue.
for (const [key, stream] of Object.entries(STREAM_CURRICULUM)) {
  const want = key.startsWith('standard') ? 'standard' : key.startsWith('ext2') ? 'ext2' : 'ext1';
  ok(stream.subtopics.every(s => pathwayOfSubtopic(s.id) === want), `every ${key} subtopic id says ${want}`);
}
ok(SUBTOPICS.filter(s => !s.stream).every(s => pathwayOfSubtopic(s.id) === null), 'and no year subtopic id names a course');
const hidden = SUBTOPICS.filter(s => !subtopicOfferedIn(AU.offering, s.id));
const shown = SUBTOPICS.filter(s => subtopicOfferedIn(AU.offering, s.id));
ok(hidden.length > 0 && shown.length > 0, 'the catalogue splits into hidden and offered subtopics');
ok(SUBTOPICS.filter(s => s.year <= 10).every(s => !subtopicOfferedIn(AU.offering, s.id)), 'every Year 7 to 10 subtopic is hidden');
ok(SUBTOPICS.filter(s => pathwayOfSubtopic(s.id) === 'standard' || pathwayOfSubtopic(s.id) === 'ext2').every(s => !subtopicOfferedIn(AU.offering, s.id)), 'every Standard and Extension 2 subtopic is hidden');
ok(SUBTOPICS.filter(s => s.year >= 11 && !pathwayOfSubtopic(s.id)).every(s => subtopicOfferedIn(AU.offering, s.id)), 'every Year 11 and 12 Advanced subtopic is offered');
ok(SUBTOPICS.filter(s => pathwayOfSubtopic(s.id) === 'ext1').every(s => subtopicOfferedIn(AU.offering, s.id)), 'every Extension 1 subtopic is offered');
ok(SUBTOPICS.every(s => subtopicOfferedIn(null, s.id)), 'with no offering (India, or the switch turned off) everything is offered again: hidden, not deleted');
ok(courseOfferedIn(AU.offering, 12, 'ext1') && courseOfferedIn(AU.offering, 11, 'advanced') && courseOfferedIn(AU.offering, 12, undefined), 'Year 11 or 12 Advanced or Extension 1 are offered');
ok(!courseOfferedIn(AU.offering, 10) && !courseOfferedIn(AU.offering, 12, 'standard') && !courseOfferedIn(AU.offering, 12, 'ext2') && !courseOfferedIn(AU.offering, 9, 'advanced'), 'Year 10, Standard, Extension 2 and Year 9 are not');

// 2 · dark by default, no flash
eq([AU.themeDefault, IN.themeDefault], ['dark', 'system'], 'Prithagoras opens dark, India follows the device');
ok(/data-theme-default="dark"/.test(brandIndexHtml(read('../index.html'), 'prithagoras')), 'the Prithagoras page declares dark before any script runs');
ok(/data-theme-default="system"/.test(brandIndexHtml(read('../index.html'), 'priyabhata')), 'the India page declares system');
const boot = read('../public/theme-boot.js');
ok(boot.indexOf("getAttribute('data-theme-default')") > 0 && boot.indexOf("getAttribute('data-theme-default')") < boot.indexOf("localStorage.getItem('pri.theme')"), 'theme-boot.js reads the default first, then a stored choice overrides it');

// 3 · free hints
eq([0, 1, 2, 3, 4].map(n => markWeightAfter(n, true)), [1, 1, 1, 1, 0], 'free hints: nothing is taken for nudge, method or worked step; the full solution ends the attempt');
eq([0, 1, 2, 3, 4].map(n => markWeightAfter(n)), [1, 0.9, 0.7, 0.4, 0], 'paid hints (India) are exactly as they were');
eq(ladderEvidence(3, true).markWeight, 1, 'the evidence a free ladder records carries full weight');
eq(ladderEvidence(3).markWeight, 0.4, 'India\'s evidence is unchanged');
eq(HINT_RUNGS, ['nudge', 'method', 'worked', 'solution'], 'the ladder keeps its four rungs');
ok(hintsAreFree({ PRI_EDITION: 'prithagoras' }) && !hintsAreFree({}), 'the server frees hints in Prithagoras only');
ok(AU.hints.free === true && IN.hints.free === false, 'the table says so');

// 4 · games
eq([AU.games, IN.games], [false, true], 'Rapid Fire and Match are hidden in Prithagoras only');

// 5 · HSC Pass
// The paid tier's name is renamed at lookup in a Prithagoras build (i18n/tierName.js, applied in i18n/core.js), so the shared
// catalogue and India's copy keep "Premium" and no second 70-sentence catalogue has to be kept in step.
const premiumKeys = Object.entries(en).filter(([, v]) => /\bPremium\b/.test(typeof v === 'string' ? v : JSON.stringify(v))).map(([k]) => k);
ok(premiumKeys.length > 50, 'the shared catalogue names the paid tier "Premium" in many strings');
eq(premiumKeys.filter(k => /\bPremium\b/.test(JSON.stringify(renameTier(en[k])))), [], 'and a Prithagoras lookup renames every one of them');
eq(renameTier('Premium removes the daily limit.'), 'HSC Pass removes the daily limit.', 'a sentence');
eq(renameTier('part of {brand} Premium.'), 'part of {brand} HSC Pass.', 'a sentence with a slot');
eq(renameTier({ one: 'Restored {n} item and refreshed Premium.', other: 'Restored {n} items and refreshed Premium.' }), { one: 'Restored {n} item and refreshed HSC Pass.', other: 'Restored {n} items and refreshed HSC Pass.' }, 'counted strings value by value');
eq(renameTier('Nothing to rename.'), 'Nothing to rename.', 'a string that names no tier is the same string');
eq(renameTier('Premiumize'), 'Premiumize', 'only the word');
eq(Object.entries(AU_STRINGS).filter(([, v]) => /\bPremium\b/.test(typeof v === 'string' ? v : JSON.stringify(v))).map(([k]) => k), [], 'and no en-AU override says Premium');
const core = read('../src/i18n/core.js');
ok(/const au = EDITION_ID === 'prithagoras' && language === 'en';/.test(core) && /if \(au && !overridden && entry !== undefined\) entry = renameTier\(entry\);/.test(core), 'only a Prithagoras English lookup renames; India and Hindi never do');
ok(/HSC Pass/.test(AU_STRINGS['settings.premiumAdds']) && /HSC Pass/.test(AU_STRINGS['upgrade.jeeAdvanced']), 'the overrides written by hand already say HSC Pass');
ok(!/−\{percent\}|−10|−20|−30|% of marks/.test(AU_STRINGS['verdict.rungLabelFree']), 'the free rung label states no deduction');

// 7 · words, not codes
eq(DIFF_WORDS, { 1: 'Foundation', 2: 'Intermediate', 3: 'Advanced', 4: 'Extension' }, 'difficulty has words');
ok(Object.values(DIFF_LABELS).every(l => /^D\d/.test(l)), 'and the coded labels remain for India');
ok(!/\bD[1-4]\b|session/.test(AU_STRINGS['home.difficultyChip'] + AU_STRINGS['settings.allDifficulties'] + AU_STRINGS['practice.sessionScore']), 'Prithagoras copy carries no D1 to D4 and no "session"');

console.log(`offering-check: ${pass} checks passed`);
