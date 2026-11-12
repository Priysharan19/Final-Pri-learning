// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the edition's name reaches every string through {brand} (plan E4)
//
// Students meet Priyabhata or Prithagoras; Pri Learning is the company
// (ADR-0002, docs/brand/editions-decision.md). This suite renders every key of
// the English and Hindi catalogues with each edition's brand variables and
// proves that:
//
//   1. no rendered string says "Pri Learning" unless its key is on the company
//      list below (legal text, a company product, a store product whose
//      per-edition name is billing mission E5) — and every key on that list
//      still says it, so the list cannot rot;
//   2. no {brand} or {company} is left unfilled;
//   3. Hindi running text says प्रियभट in the Priyabhata build, and the real
//      lookup (client/src/i18n/index.js) fills {brand} without the caller
//      passing it, a caller's own value still winning;
//   4. no catalogue string spells an edition's name out: the name comes only
//      from client/edition.config.mjs.
//
// Usage: node client/test/brand-strings-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { EDITIONS, EDITION_IDS, COMPANY } from '../edition.config.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

/** Keys whose "Pri Learning" names the company, and why. */
const COMPANY_KEYS = {
  'about.edition': 'About: "{brand} is an edition of {company}" (the company line)',
  'exams.bp.cbseXStandardNote': 'an India exam blueprint\'s release note, held word for word to client/src/engine/indiaExams.js',
  'exams.bp.jeeMainNote': 'an India exam blueprint\'s release note, held word for word to the engine',
  'exams.bp.jeeAdvancedNote': 'an India exam blueprint\'s release note, held word for word to the engine',
  'classes.emptySub': 'Pri Learning Teacher Studio is a company product, not yet named per edition',
  'legal.thirdPartyLead': 'legal: the company publishes the third-party notices',
  'signup.agreeNote': 'legal: the terms and privacy policy are the company’s',
  'paywall.title': 'the store product "Pri Learning Premium"; per-edition billing is mission E5',
  'cloud.cancelConfirm': 'names the store subscription (E5)',
  'cloud.appleNoneFound': 'names the store subscription (E5)',
  'cloud.googleNotInCountry': 'names the store subscription (E5)',
  'cloud.googleNoneFound': 'names the store subscription (E5)'
};

const forms = entry => (typeof entry === 'string' ? [entry] : Object.values(entry));
const vars = (edition, language) => ({
  brand: language === 'hi' && edition.identity.brandHi ? edition.identity.brandHi : edition.brand,
  company: COMPANY
});
const render = (text, v) => text.replace(/\{(brand|company)\}/g, (_, name) => v[name]);

const catalogues = { en, hi };
for (const id of EDITION_IDS) {
  const edition = EDITIONS[id];
  for (const [language, table] of Object.entries(catalogues)) {
    for (const [key, entry] of Object.entries(table)) {
      for (const text of forms(entry)) {
        const shown = render(text, vars(edition, language));
        const company = Object.hasOwn(COMPANY_KEYS, key);
        if (/Pri Learning/.test(shown) && !company) failures.push(`${id}/${language} ${key} says "Pri Learning" to a student: ${JSON.stringify(shown.slice(0, 120))}`);
        else pass++;
        if (/\{(brand|company)\}/.test(shown)) failures.push(`${id}/${language} ${key} leaves a brand placeholder unfilled`);
        else pass++;
      }
    }
  }
}
for (const key of Object.keys(COMPANY_KEYS)) {
  for (const [language, table] of Object.entries(catalogues)) {
    ok(table[key] !== undefined && forms(table[key]).some(t => t.includes('{company}')), `${language} ${key} is on the company list and names {company}`);
  }
}

// No catalogue spells an edition out; the name comes from the edition table.
for (const [language, table] of Object.entries(catalogues)) {
  const spelled = Object.entries(table).filter(([, e]) => forms(e).some(t => /Priyabhata|Prithagoras|प्रियभट/.test(t))).map(([k]) => k);
  ok(spelled.length === 0, `the ${language} catalogue never spells an edition's name (it uses {brand}): ${spelled.join(', ')}`);
}

// {brand} is used, in both languages, where the app names itself.
for (const key of ['app.logoHome', 'verdict.reloadApp', 'login.welcomeTitle', 'boot.slowTitle', 'about.edition']) {
  ok(en[key]?.includes('{brand}') && hi[key]?.includes('{brand}'), `${key} names the app as {brand} in English and Hindi`);
}

// The real lookup fills {brand} and {company} with no vars passed.
{
  const i18n = await import('../src/i18n/index.js');
  ok(i18n.translateEnglish('login.welcomeTitle') === 'Welcome to Priyabhata', `the lookup fills {brand} by itself (${i18n.translateEnglish('login.welcomeTitle')})`);
  ok(i18n.translateEnglish('about.edition') === 'Priyabhata is an edition of Pri Learning.', 'and {company}');
  ok(i18n.translateEnglish('legal.thirdPartyTitle', { brand: 'X' }) === en['legal.thirdPartyTitle'], 'a string without placeholders is unchanged');
  ok(i18n.translateEnglish('app.logoHome', { brand: 'Override' }).startsWith('Override'), 'a caller’s own {brand} wins');
  ok(render(hi['login.welcomeTitle'], vars(EDITIONS.priyabhata, 'hi')).startsWith('प्रियभट'), 'Hindi running text says प्रियभट in the Priyabhata build');
}

if (failures.length) {
  console.error(`\nbrand-strings-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures.slice(0, 60)) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`brand-strings-check: ${pass} passed (company list: ${Object.keys(COMPANY_KEYS).length} keys)`);
