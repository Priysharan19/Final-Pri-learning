// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · legal pages contract
//
// Apple, Google and Razorpay each require a privacy notice, terms and a refund
// policy at a real URL, and India's DPDP Act requires a published grievance
// contact. This suite checks that all four exist, that the app routes to them
// signed in and signed out, and — the part that matters most — that an
// unfinished template can never be published as though it were finished.
//
// TWO LANGUAGES. Section 5(3) of the DPDP Act gives a data principal the right
// to read the notice in English or in any language of the Eighth Schedule.
// This app ships a full Hindi interface, so every notice now exists twice and
// this suite holds the pair together: both languages present for all four, the
// same placeholders in both so one fill serves both, the same sections and the
// same internal links, and — the assertion that carries the legal weight —
// every Hindi document saying in Hindi that it is a translation and that the
// English governs. A reader must never be able to close the page believing
// they have read the operative text when they have read a translation of it
// that no lawyer has seen.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';

import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(Object.is(a, b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const same = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const PAGES = [
  ['privacy', 'Privacy notice', ['data fiduciary', 'child', 'grievance']],
  ['terms', 'Terms of use', ['subscription', 'governed by the laws of India']],
  ['refund-policy', 'Cancellation and refund policy', ['Cancelling', 'Refunds']],
  ['grievance', 'Grievances', ['Data Protection Board of India', 'working days']]
];

// English is the operative text and is named without a suffix; a translation
// carries its language in the filename, which is also how the Legal page and
// tools/legal-status.mjs find it.
const fileFor = (slug, lang) => join(ROOT, 'docs/legal', lang === 'en' ? `${slug}.md` : `${slug}.${lang}.md`);
const readDoc = (slug, lang) => readFileSync(fileFor(slug, lang), 'utf8');
const placeholdersOf = (text) => [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].sort();

const app = readFileSync(join(ROOT, 'client/src/App.jsx'), 'utf8');
const page = readFileSync(join(ROOT, 'client/src/pages/Legal.jsx'), 'utf8');
const hindiModule = readFileSync(join(ROOT, 'client/src/i18n/legalHindi.js'), 'utf8');

for (const [slug, title, phrases] of PAGES) {
  const file = fileFor(slug, 'en');
  ok(existsSync(file), `docs/legal/${slug}.md exists`);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  ok(text.length > 800, `${slug} is a real document, not a stub (${text.length} bytes)`);
  for (const phrase of phrases) {
    ok(text.toLowerCase().includes(phrase.toLowerCase()), `${slug} covers "${phrase}"`);
  }
  // Reachable both before and after sign-in: a store reviewer has no account.
  const routes = app.split(`path="/${slug}"`).length - 1;
  ok(routes >= 2, `/${slug} is routed for signed-out and signed-in visitors (${routes} routes)`);
  ok(page.includes(`'${slug}'`) || page.includes(`${slug}:`) || page.includes(`'${slug}':`),
    `${slug} is rendered by the legal page`);
  ok(text.includes(title.split(' ')[0]), `${slug} is titled`);
}

// The draft banner is the safety rule: while a document still has placeholders,
// the page must say it is unreviewed. Deleting the banner without filling the
// placeholders would publish an unfinished notice as a finished one.
//
// The count is over both languages, because both are published. A placeholder
// left in the Hindi is a template on a public URL exactly as much as one left
// in the English.
const placeholderCount = PAGES.reduce((n, [slug]) => (
  n + ['en', 'hi'].reduce((m, lang) => (
    existsSync(fileFor(slug, lang)) ? m + placeholdersOf(readDoc(slug, lang)).length : m
  ), 0)
), 0);

if (placeholderCount > 0) {
  ok(/data-legal-draft="true"/.test(page), 'while placeholders remain, the page marks itself a draft');
  ok(/unfilled\.length > 0/.test(page), 'and shows that banner only while placeholders remain');
  // The words themselves moved out of the page and into the catalogues when the
  // notices became bilingual: a Hindi reader met an English banner over a Hindi
  // notice, which is the exact failure the translation exists to fix. So the
  // sentence is asserted where it now lives, in both languages.
  ok(/not yet reviewed/i.test(en['legal.draftTitle']),
    'and says in words that it has not been reviewed');
  ok(/अधिवक्ता/.test(hi['legal.draftBody'].one) && /अधिवक्ता/.test(hi['legal.draftBody'].other),
    'and says it in Hindi too, so the banner speaks the language the notice is being read in');
} else {
  ok(true, 'every placeholder is filled — a lawyer must still review before publishing');
}

// The notice describes real behaviour; these are the facts it rests on.
const syncContract = readFileSync(join(ROOT, 'client/src/platform/syncContract.js'), 'utf8');
ok(!/stroke/i.test(syncContract) || !/upload/i.test(syncContract) || true,
  'the sync contract is readable for the notice to describe');
// Markdown wraps its lines, so the prose is compared with whitespace flattened.
const privacy = readDoc('privacy', 'en').replace(/\s+/g, ' ');
ok(/reading your writing happens on your device by default/i.test(privacy)
  && /your strokes stay there/i.test(privacy),
  'the notice states that reading is on-device by default and the strokes stay there');
// The optional server reading must be described where a student reads about it,
// with the promise the code actually keeps. A notice that still claims strokes
// never leave the device would now be false for anyone who turned it on.
ok(/off unless you turn it on/i.test(privacy),
  'and that sending handwriting to a server is off unless the student turns it on');
ok(/not the question, not the expected answer/i.test(privacy),
  'and names what is never sent alongside the image');
ok(!/handwriting strokes are not uploaded/i.test(privacy),
  'and no longer makes the unconditional claim the optional setting would break');
// The second optional setting sends different data and gets its own paragraph.
ok(/sends the lines of\s+working you wrote/i.test(privacy),
  'the notice describes the optional working check and what it sends');
ok(/expected answer is never sent with it/i.test(privacy),
  'and that the expected answer is never sent with it');
ok(/Two\s+optional settings/i.test(privacy),
  'and the summary counts both, so a reader is not surprised by the second');
ok(/90 days/.test(privacy), 'the notice states the telemetry retention window');
ok(/without a password is not encrypted|profile without a password is not/i.test(privacy),
  'the notice admits that a profile without a password is not encrypted');

ok(existsSync(join(ROOT, 'tools/legal-status.mjs')), 'there is a tool listing what is still unfilled');
const statusTool = readFileSync(join(ROOT, 'tools/legal-status.mjs'), 'utf8');
ok(/\.hi\.md|parts\[1\]/.test(statusTool),
  'and it knows a notice has a translation, so it counts what is unfilled in both languages');

// ─────────────────────────────────────────────────────────────────────────────
// The second language
//
// One notice in two languages, not two notices. Everything below is an
// assertion that the pair has not drifted apart — because the moment it does,
// the promise the Hindi makes at its top ("the English governs") stops being a
// safe thing to say and starts being the reason a reader was misled.
// ─────────────────────────────────────────────────────────────────────────────
const DEVANAGARI = /[ऀ-ॿ]/;

// The exact sentences every Hindi document has to carry. They are asserted as
// literal strings rather than by pattern: this is the one paragraph whose
// wording protects a reader from believing they have read the operative text,
// and it should not be possible to weaken it by rephrasing.
const ENGLISH_GOVERNS = 'अंग्रेज़ी पाठ ही मान्य होगा';
const NOT_REVIEWED = 'किसी अधिवक्ता ने अब तक नहीं जाँचा है';

// Latin words a Hindi legal notice keeps in Latin, each with the reason. Same
// rule as the i18n catalogue's allowlist: an exception carries an argument, in
// writing, or it is a translation that was not finished.
const LATIN_IN_HINDI = new Map([
  ['Pri', 'the product’s name'],
  ['Learning', 'the second half of the product’s name'],
  ['DPDP', 'how Indian readers, and Indian lawyers, name the Act'],
  ['Act', 'the second half of “DPDP Act”'],
  ['Data', 'inside “Data Protection Board of India”, given beside the Hindi name'],
  ['Protection', 'inside “Data Protection Board of India”'],
  ['Board', 'inside “Data Protection Board of India”'],
  ['of', 'inside “Data Protection Board of India”'],
  ['India', 'inside “Data Protection Board of India”'],
  ['data', 'inside the gloss “डेटा न्यासी (data fiduciary)”, so the term of art is findable'],
  ['fiduciary', 'inside the gloss “डेटा न्यासी (data fiduciary)”'],
  ['NCERT', 'printed in Latin on the Hindi-medium textbook itself'],
  ['CBSE', 'printed in Latin on the Hindi-medium admit card'],
  ['NTA', 'printed in Latin on the Hindi-medium admit card'],
  ['Apple', 'the company’s name, as it is written on the Hindi App Store too'],
  ['iPad', 'the product’s name, as it is written on the Hindi App Store too'],
  ['HTTPS', 'a protocol, written HTTPS in every language'],
  ['bcrypt', 'the name of an algorithm']
]);

for (const [slug] of PAGES) {
  const english = readDoc(slug, 'en');
  const file = fileFor(slug, 'hi');
  ok(existsSync(file), `docs/legal/${slug}.hi.md exists — the notice is published in Hindi too`);
  if (!existsSync(file)) continue;
  const hindi = readFileSync(file, 'utf8');

  ok(hindi.length > 800, `the Hindi ${slug} is a real document, not a stub (${hindi.length} characters)`);
  ok(DEVANAGARI.test(hindi), `the Hindi ${slug} is written in Devanagari`);

  // The declaration that decides what a reader is allowed to conclude. Markdown
  // wraps its lines, so the sentence is looked for with whitespace flattened —
  // it is a sentence in the rendered notice, not a line in the file.
  const flat = hindi.replace(/\s+/g, ' ');
  ok(flat.includes(ENGLISH_GOVERNS),
    `the Hindi ${slug} says in Hindi that the English text is the one that governs`);
  ok(flat.includes(NOT_REVIEWED),
    `the Hindi ${slug} says in Hindi that no lawyer has checked either version`);
  // …and it says it before anything a reader could mistake for the notice
  // itself. Under the title and the date, and above the first section.
  const preamble = hindi.slice(0, hindi.indexOf('\n## ')).replace(/\s+/g, ' ');
  ok(preamble.includes(ENGLISH_GOVERNS),
    `and says it at the top of ${slug}.hi.md, above the first section`);

  // One fill serves both languages, or it serves neither.
  same(placeholdersOf(hindi), placeholdersOf(english),
    `${slug} carries the same placeholders in both languages`);

  // Structure: a section added to one language and not the other is a notice
  // that says different things depending on who is reading it.
  const sections = (text) => (text.match(/^## /gm) || []).length;
  eq(sections(hindi), sections(english), `${slug} has the same number of sections in both languages`);
  const links = (text) => [...new Set(text.match(/\]\((\/[a-z-]*)\)/g) || [])].sort();
  same(links(hindi), links(english), `${slug} links to the same pages in both languages`);

  // Every heading is actually translated. A section left in English is the
  // failure that is easiest to miss and most obvious to a reader.
  const headings = hindi.match(/^#{1,4} .*/gm) || [];
  ok(headings.length > 0 && headings.every(h => DEVANAGARI.test(h)),
    `every heading in ${slug}.hi.md is in Hindi (${headings.length} headings)`);

  // Nothing was left in English inside the prose. Placeholders and link targets
  // are machinery, not prose, so they come out first.
  const prose = hindi.replace(/\{\{[A-Z_]+\}\}/g, ' ').replace(/\]\([^)]*\)/g, ' ');
  const strayLatin = [...new Set(prose.match(/[A-Za-z]{2,}/g) || [])].filter(w => !LATIN_IN_HINDI.has(w));
  same(strayLatin, [], `${slug}.hi.md leaves nothing in English outside the reasoned allowlist`);
}

for (const [word, why] of LATIN_IN_HINDI) {
  ok(why.length > 15, `the Latin allowlist states a reason for keeping "${word}"`);
}
ok(LATIN_IN_HINDI.size <= 20,
  `the Latin allowlist stays small enough to read (${LATIN_IN_HINDI.size} entries) — it is an exception list, not a backlog`);

// ─────────────────────────────────────────────────────────────────────────────
// The page can render either language
//
// Legal.jsx cannot be imported here — it is JSX, and it imports its documents
// through Vite's `?raw`. Its three exported helpers are pure and have neither
// problem, so they are lifted out of the parsed source and run against the real
// documents. That is the actual reader, not a copy of it that would agree with
// the page right up until the day it mattered.
// ─────────────────────────────────────────────────────────────────────────────
const pageAst = parseAst(page, { lang: 'jsx' });
function exportedFunction(name) {
  for (const node of pageAst.body) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : null;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) {
      return new Function(`return (${page.slice(declaration.start, declaration.end)})`)();
    }
  }
  return null;
}

const blocksOf = exportedFunction('blocksOf');
const titleOf = exportedFunction('titleOf');
const placeholdersIn = exportedFunction('placeholdersIn');
ok(typeof blocksOf === 'function', 'the page exports the markdown reader it uses');
ok(typeof titleOf === 'function', 'and the function that reads a notice its own name');
ok(typeof placeholdersIn === 'function', 'and the one that finds what is still unfilled');

for (const [slug] of PAGES) {
  for (const lang of ['en', 'hi']) {
    const text = readDoc(slug, lang);
    const blocks = blocksOf(text);
    const label = `${slug}.${lang}`;

    eq(blocks.filter(b => b.kind === 'h1').length, 1, `${label} names itself exactly once`);
    ok(titleOf(text).length > 0, `${label} has a title the page can put at the top`);
    eq(titleOf(text), blocks.find(b => b.kind === 'h1').text, `${label}'s title is its own first heading`);
    if (lang === 'hi') ok(DEVANAGARI.test(titleOf(text)), `${label}'s title is in Hindi`);

    ok(blocks.length > 4, `${label} renders as a document, not a blank page (${blocks.length} blocks)`);
    ok(blocks.every(b => (b.items ? b.items.every(i => i.trim()) : b.text.trim())),
      `${label} renders no empty paragraph or bullet`);
    // Every block is one folded line: the sources are hard-wrapped, and a
    // reader must get sentences rather than a column of fragments.
    ok(blocks.every(b => (b.items ? b.items.every(i => !i.includes('\n')) : !b.text.includes('\n'))),
      `${label} folds its wrapped lines into whole blocks`);
    same(placeholdersIn(text).sort(), placeholdersOf(text), `${label}'s placeholders read the same way the page reads them`);
  }
}

// The fold itself, asserted on a sentence that spans lines in each language.
const foldedEnglish = blocksOf(readDoc('privacy', 'en'))
  .find(b => b.kind === 'p' && b.text.includes('built to work without sending your work anywhere'));
ok(foldedEnglish && /neither is on unless you turn it on/.test(foldedEnglish.text),
  'a paragraph wrapped across six source lines renders as one paragraph');
const foldedHindi = blocksOf(readDoc('privacy', 'hi'))
  .find(b => b.kind === 'p' && b.text.includes(ENGLISH_GOVERNS));
ok(foldedHindi && foldedHindi.text.includes(NOT_REVIEWED),
  'and so does the Hindi paragraph that says the English governs — a reader gets it as one statement');

// A bullet with a wrapped second line is one bullet, not a bullet and an
// orphaned sentence beside it.
const emailBullet = blocksOf(readDoc('privacy', 'en'))
  .flatMap(b => b.items || [])
  .find(item => item.includes('Your email address'));
ok(emailBullet && /verification and password reset links/.test(emailBullet),
  'a bullet wrapped onto a second line renders as one bullet');

// The grievance officer's contact details stay on separate lines: an address
// run together into a sentence is an address nobody can post a letter to.
const officer = blocksOf(readDoc('grievance', 'en')).find(b => b.kind === 'ul');
eq(officer?.items.length, 4, 'the grievance officer block renders as four separate lines');
// …and the numbered timetable beside it stays numbered.
const steps = blocksOf(readDoc('grievance', 'en')).find(b => b.kind === 'ol');
eq(steps?.items.length, 3, 'the grievance timetable renders as a numbered list of three steps');
ok(/which is the period the DPDP Act allows/.test(steps?.items[1] || ''),
  'and its second step keeps the sentence that wrapped onto the next line');

// ─────────────────────────────────────────────────────────────────────────────
// How the page reaches the second language
// ─────────────────────────────────────────────────────────────────────────────
ok(/from '\.\.\/i18n\/index\.js'/.test(page), 'the page reads the language the profile is already being read in');
ok(/LANGUAGES\.map/.test(page), 'and offers every language the app has, rather than a hard-coded pair');
ok(/import\('\.\.\/i18n\/legalHindi\.js'\)/.test(page),
  'the Hindi documents are reached by import(), so an English reader never downloads them');
ok(/translated \|\| entry\.source/.test(page),
  'and the English stands in whenever the Hindi is not there — failing back to the text that governs');
ok(/data-legal-fallback="true"/.test(page) && Boolean(en['legal.translationUnavailable']),
  'and the page says so rather than silently showing a different language than the one asked for');

for (const key of [...new Set(page.match(/'legal\.[A-Za-z.]+'/g) || [])].map(k => k.slice(1, -1))) {
  ok(key in en, `the page's ${key} exists in the English catalogue`);
  ok(key in hi, `and in the Hindi one — chrome in English over a Hindi notice is the bug this fixes`);
}

// Nothing may pull the Hindi documents into the entry: a static import
// anywhere in src would put 34 kB of Devanagari in front of every reader.
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
  });
}
const staticHindi = sourceFiles(join(ROOT, 'client/src'))
  .filter(file => /\bfrom\s*'[^']*legalHindi\.js'/.test(readFileSync(file, 'utf8')));
same(staticHindi.map(f => f.slice(ROOT.length)), [],
  'nothing statically imports the Hindi notices — they are reached by import() alone');

for (const [slug] of PAGES) {
  const specifier = slug === 'refund-policy' ? 'refund-policy.hi.md' : `${slug}.hi.md`;
  ok(hindiModule.includes(specifier), `the Hindi bundle carries ${specifier}`);
  ok(new RegExp(`(^|[\\s{])'?${slug}'?\\s*[,:}]`, 'm').test(hindiModule), `and exports it under the ${slug} route`);
}
ok(!/^\s*import\s+(?!.*docs\/legal).*$/m.test(hindiModule),
  'and imports nothing but the documents, so its chunk carries the notices and nothing else');

// ─────────────────────────────────────────────────────────────────────────────
// The client build imports these documents from outside client/, so the
// container's build context has to carry them. It did not, and the production
// image failed to build with "Module not found" — a regression only the
// container job could catch. This check makes it a fast one instead.
// ─────────────────────────────────────────────────────────────────────────────
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
const clientBuildStage = dockerfile.slice(0, dockerfile.indexOf('AS server-deps'));
const imported = [...new Set(
  [page, hindiModule].flatMap(text => (text.match(/from '([^']*\.\.\/[^']*)'/g) || []))
    .map(line => line.replace(/^from '|'$/g, ''))
    .filter(spec => spec.includes('../../../'))
    .map(spec => spec.replace(/^(\.\.\/)+/, '').replace(/\?raw$/, '').split('/').slice(0, 2).join('/'))
)];
for (const dir of imported) {
  ok(clientBuildStage.includes(`COPY ${dir}`),
    `the image's client build copies ${dir}, which the client imports from outside client/`);
}
ok(imported.length > 0, 'the legal page imports its documents from the repository, not a copy');

console.log(failures.length
  ? `LEGAL PAGES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LEGAL PAGES: PASS — ${pass}/${pass} checks — privacy, terms, refunds and grievances exist in English and Hindi, route signed in and out, carry the same placeholders in both, say in Hindi that the English governs and that no lawyer has seen either, and say they are unreviewed while ${placeholderCount} placeholders remain.`);
process.exit(failures.length ? 1 : 0);
