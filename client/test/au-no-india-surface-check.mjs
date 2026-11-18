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
    const src = code(f);
    assert.ok(/offeredLanguages\(LANGUAGES\)/.test(src) || /LANGUAGES\.map\(\(\{ id, label \}\) => offersLanguage\(id\) &&/.test(src), `${f} must draw only the edition's languages`);
    assert.ok(!/\{LANGUAGES\.map\((?!\(\{ id, label \}\) => offersLanguage)/.test(src), `${f} maps the whole language table`);
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

// ── Sweep of 18 Nov 2026 (owner decision: nothing India-specific is visible in Prithagoras) ──
// What the first sweep missed, held so it cannot come back. The strings check
// (edition-terms-check.mjs) reads the shared catalogue for class, NCERT, CBSE, JEE,
// ₹, lakh and India; these cover what its pattern never named.
const { default: en } = await import('../src/i18n/strings.en.js');
const { AU_STRINGS } = await import('../src/i18n/strings.au.js');
const au = { ...en, ...AU_STRINGS };
const text = v => (typeof v === 'string' ? v : JSON.stringify(v));

check('the Home topic search box offers no Hindi or Hinglish in Prithagoras', () => {
  assert.ok(!/hindi|hinglish|हिन्दी/i.test(au['gloss.filterTopics']), au['gloss.filterTopics']);
  assert.match(read('home/TopicGenerator.jsx'), /t\('gloss\.filterTopics'\)/);
});
check('the NCERT Hindi term bridge is off wherever the edition offers no Hindi', () => {
  const src = code('i18n/glossary.js');
  assert.match(src, /const on = enabled && offersLanguage\('hi'\)/);
  assert.match(src, /return on \? loaded : null/);
});
check('the year-meaning strings Prithagoras draws read year, not class', () => {
  for (const k of ['common.class', 'login.chooseClassTrack', 'login.stepCourseSub', 'login.courseRequired', 'notes.classLabel', 'notes.noBookmarks', 'inst.noChapters', 'cloudError.consentDeclarationRequired']) {
    assert.ok(Object.hasOwn(AU_STRINGS, k), `${k} has an en-AU override`);
    assert.ok(!/\bclass(es)?\b/i.test(AU_STRINGS[k]), `${k}: ${AU_STRINGS[k]}`);
  }
});
// Hindi, Hinglish, Devanagari, NEET, DPDP, crore, paise, +91, Indian cities and the Indian olympiad
// ladder, anywhere in the resolved Australian catalogue, unless the key is an India-only surface.
const BAN2 = /hindi|hinglish|devanagari|\bneet\b|dpdp|\bcrore|\bpaise|\+91|kolkata|\bdelhi|mumbai|grievance officer|\bIOQM|\bRMO\b|\bINMO|[\u0900-\u097F]/i;
const ALLOW2 = [
  [/^gloss\.(label|help|example|on|off)$/, 'the NCERT Hindi bridge toggle sits in the Language section, which Prithagoras does not draw, and useGlossary is off there'],
  [/^settings\.(helpBodyIndia|trackOlympiadDesc)$/, 'Indian course and track pickers (SettingsLegacy.jsx offersCourse)'],
  [/^(login\.olympiadTrack|notes\.olympiad.*)$/, 'the Olympiad track, an India-only extended track'],
  [/^legal\.translationUnavailable$/, 'shown only when a Hindi notice fails to load; Prithagoras offers no Hindi'],
  [/^exams\.(jee|bp\.|build|start)/, 'Indian exam blueprints and tracks (CBSE, JEE, IOQM)'],
  [/^(ncert|mock|scn\.papers|tw\.paper|placement|landing\.(proofSyllabusIn|syllabus\.in))\./, 'India-only surfaces already reasoned in edition-terms-check.mjs'],
  [/^teach\.noPrediction/, 'teacher-panel copy gated on the India flag (Teach.jsx)'],
  [/^login\.grievances$/, 'the label of the grievance route; the legal footer draws login.contact for Prithagoras (LegalContactLink.jsx)']
];
check('no resolved Australian string carries Hindi, Hinglish, Devanagari, NEET, DPDP or an Indian place unless it is an India-only surface', () => {
  const leaks = Object.keys(au).filter(k => BAN2.test(text(au[k])) && !ALLOW2.some(([re]) => re.test(k)));
  assert.deepEqual(leaks, [], `override these in strings.au.js, or give them a reasoned allowance: ${leaks.join(', ')}`);
});
check('NSW question text names no Indian person (the shared name pool)', () => {
  const pool = read('engine/qhelpers.js').match(/export const NAMES = \[([^\]]*)\]/)[1];
  for (const name of ['Priya', 'Dev', 'Uma', 'Vik', 'Ravi', 'Rahul', 'Amit', 'Anita', 'Arjun']) assert.ok(!new RegExp(`'${name}'`).test(pool), `${name} is in the NSW name pool`);
});
{
  const { installBrowserEnv } = await import('./backend-check.mjs');
  installBrowserEnv();
  const { loadAllBanks, generateQuestion } = await import('../src/engine/generators/index.js');
  const { NSW_ISSUED_CELLS } = await import('../src/engine/nswIssuedCells.js');
  await loadAllBanks();
  const INDIA = /₹|\bRs\.?\s?\d|rupee|\blakh|\bcrore|\bpaise|\bIndia|Indian|Delhi|Mumbai|Kolkata|Chennai|Bengal|Bangalore|Jaipur|Hyderabad|Kerala|Punjab|Gujarat|Diwali|\bCBSE|NCERT|\bJEE|\bNEET|Olympiad|board exam|[\u0900-\u097F]|\b(Priya|Dev|Uma|Vik|Ravi|Rahul|Amit|Anita|Sunita|Raj|Arjun|Neha|Kavita|Rohan|Sachin|Gopal|Meena|Sita|Vikram|Deepak|Suresh|Ramesh|Anil|Sanjay|Pooja|Divya|Lakshmi|Geeta|Ananya|Aarav|Aditya|Ishaan|Sharma|Gupta|Singh|Kumar|Patel|Reddy|Iyer|Nair)\b/;
  const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out)); return out; };
  const found = new Map();
  let made = 0;
  for (const [generator, levels] of Object.entries(NSW_ISSUED_CELLS)) for (const d of levels) for (let seed = 1; seed <= 40; seed++) {
    let q; try { q = generateQuestion(generator, d, seed * 7919); } catch { continue; }
    made++;
    for (const str of strings({ p: q.prompt, o: q.options, h: q.hints, s: q.solution, e: q.explanation, x: q.steps, c: q.context })) {
      const m = INDIA.exec(str); if (m && !found.has(`${generator}|${m[0]}`)) found.set(`${generator}|${m[0]}`, str.slice(Math.max(0, m.index - 30), m.index + 40));
    }
  }
  check(`${made} issued NSW questions across every cell carry no Indian name, currency, place or exam`, () => assert.deepEqual([...found], []));
}

if (failures.length) { console.error(failures.join('\n')); console.error(`AU NO INDIA SURFACE: FAIL ${failures.length}`); process.exit(1); }
console.log(`AU NO INDIA SURFACE: PASS — ${pass} checks`);
