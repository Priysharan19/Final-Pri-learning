// Prithagoras (Australia) must not show anything Indian that a screen hardcodes.
//   node client/test/au-no-india-surface-check.mjs
//
// The edition decides region, language, timezone and phone channel. The screens
// that once carried 'Asia/Kolkata', 'en-IN', '+91' or the Hindi button label as
// literals now ask client/src/platform/edition.js and client/src/lib/locale.js.
// This reads those files (comments stripped) and fails when such a literal comes
// back, or when a gate this sweep added is removed. India's own values live in
// edition.config.mjs, lib/locale.js and the i18n catalogues, which are exempt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const read = f => readFileSync(fileURLToPath(new URL(`../src/${f}`, here)), 'utf8');
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

let pass = 0;
const failures = [];
function check(name, fn) { try { fn(); pass++; } catch (e) { failures.push(`FAIL ${name}\n  ${e.message}`); } }

const BANNED = [/Asia\/Kolkata/, /en-IN/, /\+91/, /हिन्दी/];
const FILES = [
  'pages/SettingsLegacy.jsx', 'pages/GuardianConsent.jsx', 'pages/AccountDeleteRequest.jsx', 'pages/Legal.jsx',
  'pages/Classes.jsx', 'insights/Insights.jsx', 'parent/ParentReport.jsx', 'plan/usePlan.js',
  'local/entitlementGate.js', 'components/CloudAccountPanel.jsx', 'components/SignUpFlow.jsx', 'components/AccountActivationGate.jsx'
];

for (const f of FILES) {
  check(`${f} carries no ungated India literal (Asia/Kolkata, en-IN, +91, the Hindi label)`, () => {
    const src = code(f);
    for (const re of BANNED) assert.ok(!re.test(src), `${f} contains ${re}; use platform/edition.js or lib/locale.js`);
  });
}

check('Settings offers only the edition\'s syllabuses, and no Language section for one language', () => {
  const src = read('pages/SettingsLegacy.jsx');
  assert.match(src, /COURSES\.filter\(\(\[k\]\) => offersCourse\(k\)/);
  assert.match(src, /offeredLanguages\(LANGUAGES\)\.length > 1 \? SECTIONS_ALL/);
});
check('every language picker draws only the edition\'s languages', () => {
  for (const f of ['pages/SettingsLegacy.jsx', 'pages/GuardianConsent.jsx', 'pages/AccountDeleteRequest.jsx', 'pages/Legal.jsx']) {
    assert.match(read(f), /offeredLanguages\(LANGUAGES\)/, f);
    assert.ok(!/\{LANGUAGES\.map/.test(code(f)), `${f} maps the whole language table`);
  }
});
check('the India syllabus button and the NCERT library are India-edition only', () => {
  assert.match(read('pages/Teach.jsx'), /\{offersCourse\('in'\) && <button[^\n]*teach\.syllabusIndia/);
  assert.match(read('pages/Classes.jsx'), /Number\(user\.year\) === 10 && offersCourse\('in'\) && <Class10NCERTLibrary/);
});
check('the phone channel and its calling code come from the edition; the guardian page defaults to email without SMS', () => {
  assert.match(read('pages/GuardianConsent.jsx'), /useState\(smsOffered\(\) \? 'sms' : 'email'\)/);
  assert.match(read('pages/GuardianConsent.jsx'), /\{smsOffered\(\) && <div className="signup-segment signup-channel"/);
  for (const f of ['components/SignUpFlow.jsx', 'components/AccountActivationGate.jsx']) assert.match(read(f), /result\.channels\.sms === true && smsOffered\(\)/, f);
  assert.match(read('platform/edition.js'), /smsOffered = \(\) => EDITION_RECORD\.region === 'IN'/);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`AU NO INDIA SURFACE: FAIL ${failures.length}`); process.exit(1); }
console.log(`AU NO INDIA SURFACE: PASS — ${pass} checks`);
