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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import en from '../src/i18n/strings.en.js';
import { AU_STRINGS } from '../src/i18n/strings.au.js';

const here = new URL('.', import.meta.url);
const BAN = /\bclass(es)?\s*[0-9]|\bclass\s*\{|ncert|cbse|\bjee\b|olympiad|₹|\binr\b|lakh|\bboard (exam|paper|marks|mode|score)|\bindia(n)?\b|rupee/i;

// India-only surfaces: each is gated to an Indian course or track and is not
// drawn for a Prithagoras profile. The reason is the gate.
const ALLOW = [
  [/^msg\.classCbse$/, 'the CBSE / NCERT assignment track label (platform/assignmentTarget.js builds it only for the cbse track, an Indian course)'],
  [/^msg\.ent\.jeeAdvanced$/, 'the JEE Advanced Premium gate (entitlementGate.js), reachable only on the Indian JEE track'],
  [/^ncert\./, 'the NCERT chapter library and release notes (Indian courses only)'],
  [/^mock\./, 'CBSE board-format mock papers (engine/boardMock.js, Indian courses only)'],
  [/^teach\.(.*India|noPredictionClassReport|noPredictionStudentReport)/, 'teacher-panel copy gated on the India flag (Teach.jsx)'],
  [/^exams\.(bp\.|jee|cbse|buildingJee|startJee|classPractice)/, 'Indian exam blueprints and tracks (CBSE, JEE, IOQM)'],
  [/^scn\.papers\./, 'the board-format papers scene, listed only for Priyabhata (SignInScenes.jsx scenesFor)'],
  [/^placement\./, 'the placement diagnostic walks the NCERT prerequisite spine (engine/placement.js); Indian courses only'],
  [/^gloss\./, 'NCERT Hindi term glossary; Prithagoras offers no Hindi'],
  [/^practice\.pyqOnlyTitle$/, 'past-paper (JEE, CBSE) filter; Indian courses only, behind PRI_FEATURE_PAST_PAPERS'],
  [/^settings\.(helpBodyIndia|courseIndia|trackCbseDesc|trackJeeMainDesc|trackJeeAdvancedDesc|trackOlympiad)$/, 'Indian course and track pickers'],
  [/^settings\.indiaTrack$/, 'the India track row of Settings (SettingsLegacy.jsx), drawn for an India course only'],
  [/^paywall\.premium\.jeeAdvanced$/, 'the row is filtered out of the Prithagoras paywall (paywall/Paywall.jsx)'],
  [/^paywall\.from\.jeeAdvanced$/, 'reached only from the jee-advanced arrival path, an Indian track'],
  [/^home\.pickTrack$/, 'drawn only for an India course (TopicGenerator.jsx, india flag)'],
  [/^login\.placementOffer$/, 'a sentence about India-curriculum students at sign-up, drawn only when the placement flag is on (off by default; placement is India-only); revisit if placement ever ships to Prithagoras'],
  [/^library\.course\.in$/, 'the course option for an India resource in the staff-only resource-publishing panel, and the label of such a resource; a data value, not copy a Prithagoras student reads'],
  [/^home\.next\.firstIndia$/, 'first-step copy for Indian courses'],
  [/^login\.olympiadTrack$/, 'Indian track chooser at sign-up'],
  [/^signup\.trackJeeHint$/, 'Indian track chooser at sign-up'],
  [/^board\.ready\.whyIn$/, 'the Priyabhata honesty box under exam readiness (progress/SyllabusBoard.jsx draws whyNsw for Prithagoras, whyIn only for edition "in")'],
  [/^board\.prio\.sourceIndia$/, 'the CBSE unit-weightage note under syllabus-board priorities (progress/SyllabusBoard.jsx draws it only when india is true, i.e. an Indian course)']
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
    assert.ok(!BAN.test(stringOf(v)), `${k} override still carries an India-only term`);
    const need = new Set([...stringOf(en[k]).matchAll(/\{(\w+)\}/g)].map(m => m[1]));
    const have = new Set([...stringOf(v).matchAll(/\{(\w+)\}/g)].map(m => m[1]));
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
  const idx = readFileSync(fileURLToPath(new URL('../src/i18n/core.js', here)), 'utf8');
  assert.match(idx, /EDITION_ID === 'prithagoras' && language === 'en' && Object\.hasOwn\(AU_STRINGS, key\)/);
});
check('every year selector and tab goes through common.classNumber (Year N in Prithagoras), never a literal "Class N" in a screen', () => {
  const walk = d => readdirSync(d).flatMap(n => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? walk(p) : [p]; });
  const root = fileURLToPath(new URL('../src', here));
  const screens = walk(root).filter(p => /\.jsx$/.test(p));
  assert.ok(screens.length > 100);
  for (const f of screens) {
    const code = readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!/(['"`>])Class [0-9{$]/.test(code), `${f} spells a literal "Class N"`);
  }
  for (const f of ['pages/Notes.jsx', 'pages/Login.jsx', 'instrument/IndexPage.jsx', 'pages/PracticeBase.jsx', 'pages/SettingsLegacy.jsx']) {
    assert.match(readFileSync(`${root}/${f}`, 'utf8'), /common\.(classNumber|yearNumber)/, `${f} does not use the year label key`);
  }
});
check('the welcome page\'s hard-coded track kicker is not drawn in Prithagoras', () => {
  const login = readFileSync(fileURLToPath(new URL('../src/pages/Login.jsx', here)), 'utf8');
  assert.match(login, /EDITION_ID === 'prithagoras' \? t\('login\.brandKicker'\) : featureEnabled\('extendedTracks'\)/);
});
check('the Prithagoras sign-in screen: its own eyebrow and value line, no language switch, no India footer links, one short note', () => {
  assert.equal(AU_STRINGS['login.brandKicker'], 'NSW Years 7–10 · Stage 6 Standard, Advanced, Extension 1 & 2');
  assert.match(AU_STRINGS['login.welcomeSub'], /HSC/);
  assert.ok(!BAN.test(AU_STRINGS['login.welcomeSub']));
  const login = readFileSync(fileURLToPath(new URL('../src/pages/Login.jsx', here)), 'utf8');
  assert.match(login, /function LanguagePicker\(\) \{[\s\S]{0,260}if \(EDITION_ID === 'prithagoras'\) return null;/);
  // The footer's contact link is edition-aware (#954): Prithagoras links its
  // Australian contact page, Priyabhata keeps the DPDP grievance page. Refunds
  // is shown in both: Prithagoras has its own ACL refund policy.
  assert.match(login, /<LegalContactLink \/>/);
  const contact = readFileSync(fileURLToPath(new URL('../src/components/LegalContactLink.jsx', here)), 'utf8');
  assert.match(contact, /EDITION === 'prithagoras'\s*\?\s*<PageLink to="\/contact">[\s\S]{0,80}:\s*<PageLink to="\/grievance">/);
  assert.ok(!/to="\/grievance"/.test(login), 'Login.jsx links no grievance page directly; only LegalContactLink chooses it, by edition');
  assert.match(login, /t\('login\.heroNote'\)/);
  assert.ok(!/t\('login\.heroSub'\)/.test(login) && /<details className="login-more">/.test(login), 'the marketing paragraph is gone and the data statement is folded, not a wall of text');
  assert.ok(en['login.heroNote'].length < 120, 'the note stays one short line');
});
check('the sign-in scenes: Prithagoras lists only scenes that are live there (no board papers, no India notes; the desk only when it is switched on)', async () => {
  const { scenesFor } = await import('../src/instrument/SignInScenes.jsx').catch(() => ({ scenesFor: null }));
  const src = readFileSync(fileURLToPath(new URL('../src/instrument/SignInScenes.jsx', here)), 'utf8');
  assert.match(src, /prithagoras'\) return \['hand', \.\.\.\(flags\.desk \? \['desk'\] : \[\]\), 'daily'\]/);
  assert.match(src, /return \['hand', 'papers', 'notes', 'daily'\]/);
});
check('every allowlist entry still matches a key (a dead entry is removed)', () => {
  for (const [re] of ALLOW) assert.ok(Object.keys(en).some(k => re.test(k)), `${re} matches no key`);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`EDITION TERMS: FAIL ${failures.length}`); process.exit(1); }
console.log(`EDITION TERMS: PASS — ${pass} checks, ${Object.keys(AU_STRINGS).length} en-AU overrides, ${ALLOW.length} reasoned India-only allowances`);
