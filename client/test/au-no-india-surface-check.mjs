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
  'local/entitlementGate.js', 'pages/Ext1Papers.jsx', 'components/CloudAccountPanel.jsx', 'components/SignUpFlow.jsx', 'components/AccountActivationGate.jsx'
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

check('the Extension 1 papers section on the Exams page is NSW-only and says nothing of Class, India or CBSE', () => {
  assert.match(code('pages/Ext1Papers.jsx'), /user\.course === 'nsw' && user\.pathway === 'ext1'/);
  assert.match(code('pages/Exams.jsx'), /ext1PapersFor\(user\) && <Ext1Papers \/>/);
  const en = read('i18n/strings.en.js');
  const keys = [...en.matchAll(/^\s*'(papers\.ext1\.[^']+)':\s*(['"])(.*?)\2,?\s*$/gm)];
  assert.ok(keys.length >= 15, 'the papers.ext1.* strings are found');
  for (const [, key, , text] of keys) assert.ok(!/\bClass\b|India|CBSE|NCERT|JEE|₹|Rs\./i.test(text), `${key} carries India or Class wording: ${text}`);
  const manifest = readFileSync(fileURLToPath(new URL('../../server/content/papers/nsw-ext1/manifest.json', here)), 'utf8');
  assert.ok(!/\bClass\b|India|CBSE|NCERT/.test(manifest), 'the paper manifest titles carry no India or Class wording');
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
check('the name pool is chosen by edition: NSW_NAMES has no Indian name, INDIA_SHARED_NAMES is the list Priyabhata always had, and they differ only where those four names sit', () => {
  const src = read('engine/qhelpers.js');
  const list = name => [...src.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const nsw = list('NSW_NAMES'), india = list('INDIA_SHARED_NAMES');
  for (const name of ['Priya', 'Dev', 'Uma', 'Vik', 'Ravi', 'Rahul', 'Amit', 'Anita', 'Arjun']) assert.ok(!nsw.includes(name), `${name} is in the NSW name pool`);
  assert.equal(india.join(), 'Aria,Blake,Chen,Dev,Elif,Finn,Grace,Hana,Ivy,Jonah,Kiri,Leo,Mia,Noah,Ollie,Priya,Quinn,Ruby,Sam,Tara,Uma,Vik,Willa,Xavier,Yusuf,Zoe', 'the Indian edition\'s shared pool is unchanged');
  assert.deepEqual(nsw.map((n, i) => (n === india[i] ? null : i)).filter(i => i !== null), [3, 15, 20, 21], 'only the four Indian names are replaced, in place');
  assert.match(src, /export const NAMES = \[\.\.\.\(String\(globalThis\.process\?\.env\?\.PRI_EDITION[^)]*\)\.trim\(\) === 'prithagoras' \? NSW_NAMES : INDIA_SHARED_NAMES\)\];/);
  assert.match(read('main.jsx'), /selectNamePool\(EDITION\)/, 'a Prithagoras build selects the NSW pool at start-up');
});
// The issued-question scan below is for the Prithagoras build: in Node the name pool follows PRI_EDITION, read when the generators load.
process.env.PRI_EDITION = 'prithagoras';
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

// ── QA sweep, 22 Nov 2026: the day-before-launch walk of the Prithagoras screens ──────────────────────────────────────────
{
  const { AU_STRINGS } = await import('../src/i18n/strings.au.js');
  const EN = (await import('../src/i18n/strings.en.js')).default;
  const HI = (await import('../src/i18n/strings.hi.js')).default;
  const au = { ...EN, ...AU_STRINGS };
  check('no student-facing string says "every line is checked" (a question without a working checker marks the answer only)', () => {
    for (const [k, v] of Object.entries(au)) if (typeof v === 'string' && !k.startsWith('mp.') && k !== 'landing.proofEngine') assert.ok(!/every line is checked/i.test(v), `${k}: ${v}`);  // (the marked page's own sentences are shown only when the engine did check every line; landing.proofEngine qualifies itself in the same sentence and is reported to the owner)
    assert.ok(!/हर पंक्ति जाँची जाती है/.test(HI['verdict.showWorkingToggle']));
  });
  check('the Prithagoras welcome copy promises line-by-line checking only where the question allows it', () => {
    for (const k of ['login.welcomeSub', 'login.heroSub']) assert.match(au[k], /where the question allows it|checks the lines of your working it can/, k);
    assert.ok(!/Your working is checked line by line\./.test(au['login.welcomeSub']));
  });
  check('Australian spelling: Favourite, never Favorite, on every Prithagoras favourite string', () => {
    for (const [k, v] of Object.entries(au)) if (/favorite/i.test(k) || /favou?rite/i.test(String(v))) assert.ok(!/[Ff]avorite/.test(String(v)), `${k}: ${v}`);
  });
  check('Settings account screens carry no developer wording on Prithagoras (production identity UI, provider subject, authenticated sync)', () => {
    for (const k of ['cloud.intro', 'cloudSecurity.socialNote', 'cloudSecurity.providersUnavailable']) assert.ok(!/production identity UI|provider subject|authenticated cross-device|Provider status unavailable/.test(au[k]), k);
  });
  check('the Settings help text says the final answer is marked, not each working line, on Prithagoras', () => {
    assert.ok(!/line by line/.test(au['settings.helpBody']));
  });
  const exams = code('pages/Exams.jsx');
  check('Exams does not offer the generic "Sit a practice paper" card to an NSW student (the server refuses that kind of paper)', () => {
    assert.match(exams, /user\.course !== 'nsw' && <div className="card">/);
  });
  const { settleChoice } = await import('../src/guest/guestMenu.js');
  check('the Home question picker opens on the student\'s own course (Extension 1 stays Extension 1)', () => {
    assert.equal(settleChoice('prithagoras', {}, { defaultYear: 12, defaultCourse: 'ext1' }).course, 'ext1');
    assert.equal(settleChoice('prithagoras', {}, { defaultYear: 12 }).course, 'advanced');
    assert.equal(settleChoice('prithagoras', { course: 'advanced' }, { defaultYear: 12, defaultCourse: 'ext1' }).course, 'advanced');
  });
  const css = f => readFileSync(fileURLToPath(new URL(`../src/${f}`, here)), 'utf8');
  check('the history row\'s level column is wide enough for "Intermediate" (it overlapped the question text)', () => {
    assert.match(css('instrument/ledger.css'), /html\[data-edition=prithagoras\] \.in-led-main \{ grid-template-columns: 10px (9\d|1\d\d)px /);
  });
  check('the legal pages have a gutter before the shell exists, and a settings label keeps its words whole on a phone', () => {
    const theme = css('theme.css');
    assert.match(theme, /html\[data-edition=prithagoras\] #root > \.qpage \{ padding: calc\(24px/);
    assert.match(theme, /\.set-row \.set-k \{ flex: 0 0 auto; max-width: 46%; overflow-wrap: normal/);
    assert.match(theme, /html\[data-edition=prithagoras\] \.legal-body \{ overflow-wrap: anywhere; \}/);
  });
}

// ── QA sweep, round 2 (22 Nov 2026) ──────────────────────────────────────────────────────────────────────────────────────
{
  const { AU_STRINGS } = await import('../src/i18n/strings.au.js');
  const EN = (await import('../src/i18n/strings.en.js')).default;
  const HI = (await import('../src/i18n/strings.hi.js')).default;
  const au = { ...EN, ...AU_STRINGS };
  check('Prithagoras says the mark is for the final answer wherever a shared string said every line is marked', () => {
    for (const k of ['verdict.workingAria', 'verdict.workingPlaceholder', 'examRoom.workingNote', 'login.point2', 'ai.checked.body']) assert.ok(!/every line is marked|Each line is marked|awarded line by line|marked line by line|your answer line by line/.test(au[k]), `${k}: ${au[k]}`);
    assert.ok(!/first-party/.test(au['cloudSecurity.deleteHelp']));
  });
  check('a placeholder dash is the words "None yet" on Home and Report, in English and Hindi', () => {
    assert.equal(EN['inst.noneYet'], 'None yet');
    assert.ok(HI['inst.noneYet'] && HI['inst.noneYet'] !== '—');
    for (const f of ['instrument/ReportHead.jsx', 'instrument/IndexPage.jsx']) {
      const c = code(f);
      assert.ok(/inst\.noneYet/.test(c), f);
      assert.ok(!/\? '—' :|: '—'\}/.test(c.replace(/const fmtPct[^\n]*\n/, '')), `${f} still has a lone dash placeholder`);
    }
  });
  check('every accessible name of a paper or set "Sit" button starts with its visible text', () => {
    for (const [vis, label] of [['papers.sets.sit', 'papers.sets.sitLabel'], ['papers.ext1.sit', 'papers.ext1.sitPaperLabel']]) {
      for (const cat of [au, HI]) assert.ok(cat[label].replace(/[:：]?\s*\{title\}.*/, '').startsWith(cat[vis]) || cat[label].startsWith(cat[vis]), `${label}: ${cat[label]}`);
    }
  });
  check('no student-facing date or time is written in the browser\'s own locale (lib/locale.js formatDate / formatDateTime instead)', () => {
    const FILES = ['desk/DeskPage.jsx', 'desk/DeskImport.jsx', 'desk/DeskEntry.jsx', 'progress/SyllabusBoard.jsx', 'classroom/ReviewQueue.jsx', 'classroom/StudentClassroom.jsx', 'classroom/TeacherWorkspace.jsx',
      'components/CloudAccountPanel.jsx', 'components/CloudAccountSecurity.jsx', 'components/StaffOperationsPanel.jsx', 'components/AssignmentInboxPanel.jsx', 'components/ClassroomPanel.jsx', 'components/TrialNotice.jsx',
      'pages/ExamRoom.jsx', 'pages/Classes.jsx', 'pages/Home.jsx', 'pages/Placement.jsx'];
    for (const f of FILES) {
      const c = code(f);
      assert.ok(!/toLocale(Date|Time)?String\(\s*(\)|undefined|\[\])/.test(c), `${f}: a date written with the browser's default locale`);
      assert.ok(!/Intl\.DateTimeFormat\(\s*[^,)]*\? 'hi-IN' : undefined/.test(c), `${f}: an Intl date with the browser's default locale`);
    }
  });
  const { formatDate, formatDateTime } = await import('../src/lib/locale.js');
  check('formatDate and formatDateTime write en-AU for Prithagoras (22 Nov 2026, never 11/22/2026)', () => {
    const ms = Date.UTC(2026, 10, 22, 5, 8, 14);
    assert.equal(formatDate(ms, 'nsw'), '22 Nov');
    assert.equal(formatDateTime(ms, 'nsw'), '22 Nov 2026, 4:08 pm AEDT');
    assert.equal(formatDateTime(ms, 'in'), '22 Nov 2026, 10:38 am IST');   // India still reads India time, now with its zone
    assert.match(formatDateTime(ms, { course: 'nsw', timezone: 'America/New_York' }), /12:08 am GMT-5$/);   // a student abroad sees their own zone named
    assert.match(code('pages/ExamRoom.jsx'), /timeZoneName: 'short'/);
    assert.ok(!/11\/22\/2026/.test(formatDateTime(ms, 'nsw')));
  });
  check('the first-run tour keeps its wide-screen note left of the dot-point picker and falls back under the question', () => {
    const c = code('components/PracticeTour.jsx');
    assert.match(c, /data-dotpoint-picker/);
    assert.match(c, /room >= 180/);
    assert.match(c, /const avoid = step\.avoid && !inGutter/);
  });
  check('the free-cap actions are two bordered buttons, not indented text', () => {
    const c = code('components/FreeCapNotice.jsx');
    assert.ok(!/btn btn-quiet/.test(c));
  });
  check('on a wide screen only the last hint rung is offered in the footer, not also "Show solution" (they do the same thing)', () => {
    assert.match(code('components/QuestionCard.jsx'), /!\(INSTRUMENT && ladderOffered && nextRung === 'solution' && !narrow\)/);
  });
  check('after marking, the bar does not repeat "Your answer" when the score card prints it, and still shows it when the card does not (working, a reveal)', () => {
    const c = code('components/QuestionCard.jsx');
    assert.match(c, /const cardShowsAnswer = !!judged\?\.viaInk && !isWorking && !res\?\.revealed && String\(judged\?\.answer \?\? ''\)\.trim\(\) !== '';/);
    assert.match(c, /!\(resolved && cardShowsAnswer\) && saveState/);
    // the card's own line is under exactly the same three conditions
    assert.match(c, /judged\?\.viaInk && !isWorking && !res\.revealed && String\(judged\.answer\)\.trim\(\) !== ''/);
  });
}

if (failures.length) { console.error(failures.join('\n')); console.error(`AU NO INDIA SURFACE: FAIL ${failures.length}`); process.exit(1); }
console.log(`AU NO INDIA SURFACE: PASS — ${pass} checks`);
