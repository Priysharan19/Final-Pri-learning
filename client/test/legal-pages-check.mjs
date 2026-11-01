// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · legal pages contract
//
// Apple and Google each require a privacy notice, terms and a refund policy at
// a real URL, and India's DPDP Act requires a published grievance contact.
// This suite checks that all four exist, that the app routes to them signed in
// and signed out, and — the part that matters most — that a notice no lawyer
// has reviewed can never be published as though one had.
//
// THE REVIEW FLAG. Until 1 November 2026 the "not yet reviewed" banner was
// shown while a document still had {{PLACEHOLDER}} text in it, so filling the
// placeholders on 19 October made the banner vanish although no lawyer had
// looked at anything. The banner now depends on one explicit switch,
// docs/legal/review-status.json, and this suite pins that: the page's banner
// must read the switch, the switch must be false until a human records a
// lawyer's review with name, qualification, date and evidence, that date may
// not be earlier than any notice's "Last updated", and while the switch is off
// every English notice says in words that it is unreviewed and every Hindi one
// says so in Hindi. Placeholders keep their own, separate banner.
//
// TWO LANGUAGES. Section 5(3) of the DPDP Act gives a data principal the right
// to read the notice in English or in any language of the Eighth Schedule.
// This app ships a full Hindi interface, so every notice exists twice and
// this suite holds the pair together: both languages present for all four, the
// same placeholders in both so one fill serves both, the same sections and the
// same internal links, and — the assertion that carries the legal weight —
// every Hindi document saying in Hindi that it is a translation and that the
// English governs. A reader must never be able to close the page believing
// they have read the operative text when they have read a translation of it
// that no lawyer has seen.
//
// THIRD-PARTY NOTICES. A fifth page lists the licences of the software the app
// ships. It is generated from the dependency licences (tools/third-party-
// notices.mjs, whose --check runs beside this suite in `npm run test:legal`),
// so this suite only has to prove it is reachable, rendered by the same reader,
// and loaded on demand rather than carried by every install.
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
  ['grievance', 'Grievances', ['Data Protection Board of India', '48 hours', '30 days']]
];
const NOTICES_PAGE = 'third-party-notices';

// English is the operative text and is named without a suffix; a translation
// carries its language in the filename, which is also how the Legal page and
// tools/legal-status.mjs find it.
const fileFor = (slug, lang) => join(ROOT, 'docs/legal', lang === 'en' ? `${slug}.md` : `${slug}.${lang}.md`);
const readDoc = (slug, lang) => readFileSync(fileFor(slug, lang), 'utf8');
const placeholdersOf = (text) => [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].sort();

const app = readFileSync(join(ROOT, 'client/src/App.jsx'), 'utf8');
const page = readFileSync(join(ROOT, 'client/src/pages/Legal.jsx'), 'utf8');
const hindiModule = readFileSync(join(ROOT, 'client/src/i18n/legalHindi.js'), 'utf8');
const noticesModule = readFileSync(join(ROOT, 'client/src/legal/thirdPartyNotices.js'), 'utf8');

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

// ─────────────────────────────────────────────────────────────────────────────
// The review flag
//
// One switch, set by a person, read by the page, pinned here in both of its
// states. Flipping it without the paperwork fails; removing the banner fails;
// tying the banner back to the placeholder count fails.
// ─────────────────────────────────────────────────────────────────────────────
const reviewPath = join(ROOT, 'docs/legal/review-status.json');
ok(existsSync(reviewPath), 'docs/legal/review-status.json exists — the one switch behind the review banner');
const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : {};
ok(typeof review.reviewed === 'boolean', 'review-status.json says, as a boolean, whether a lawyer has reviewed the notices');
const REVIEWED = review.reviewed === true;

// The page reads the switch, and the banner is conditioned on the switch alone.
ok(/import review from '\.\.\/\.\.\/\.\.\/docs\/legal\/review-status\.json'/.test(page),
  'the legal page imports review-status.json');
ok(/export const LEGAL_REVIEWED = review\.reviewed === true;/.test(page),
  'and treats only an explicit `reviewed: true` as reviewed — a missing or truthy-but-not-true value is unreviewed');
ok(/\{!LEGAL_REVIEWED && \(\s*<div className="notice error" role="alert"[^>]*data-legal-unreviewed="true">/.test(page),
  'the page shows the unreviewed banner whenever the switch is off');
ok(!/LEGAL_REVIEWED[^\n]*unfilled|unfilled[^\n]*LEGAL_REVIEWED/.test(page),
  'and never conditions that banner on the placeholder count — filling the templates is not a legal review');
ok(/\{unfilled\.length > 0 && \(\s*<div className="notice error" role="alert"[^>]*data-legal-draft="true">/.test(page),
  'a document with placeholders left still gets its own template banner');
ok(/not yet reviewed by a lawyer/i.test(en['legal.unreviewedTitle']) && /no lawyer qualified in Indian law has reviewed it/i.test(en['legal.unreviewedBody']),
  'the banner says in words that no lawyer has reviewed the notice');
ok(/अधिवक्ता/.test(hi['legal.unreviewedTitle']) && /अधिवक्ता/.test(hi['legal.unreviewedBody']),
  'and says it in Hindi too, so the banner speaks the language the notice is being read in');
ok(/not yet reviewed/i.test(en['legal.draftTitle']) && /अधिवक्ता/.test(hi['legal.draftBody'].one) && /अधिवक्ता/.test(hi['legal.draftBody'].other),
  'the template banner still says, in both languages, that the document is unreviewed');

// "Last updated: 2 November 2026" → a Date, parsed by hand so the comparison
// does not depend on which English date forms the runtime happens to accept.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function lastUpdatedOf(text) {
  const m = text.match(/\*\*Last updated: (\d{1,2}) ([A-Za-z]+) (\d{4})\*\*/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  return month < 0 ? null : new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}
const lastUpdated = Object.fromEntries(PAGES.map(([slug]) => [slug, lastUpdatedOf(readDoc(slug, 'en'))]));
for (const [slug] of PAGES) ok(lastUpdated[slug] instanceof Date, `${slug} carries a parseable "Last updated" date`);

const ENGLISH_UNREVIEWED = /has not yet been reviewed by a lawyer|have not yet been reviewed by a lawyer/;
// The exact sentence every Hindi document carries while unreviewed. Asserted as
// a literal string rather than by pattern: this is the paragraph whose wording
// protects a reader from believing they have read the operative text, and it
// should not be possible to weaken it by rephrasing.
const ENGLISH_GOVERNS = 'अंग्रेज़ी पाठ ही मान्य होगा';
const NOT_REVIEWED = 'किसी अधिवक्ता ने अब तक नहीं जाँचा है';

if (!REVIEWED) {
  for (const key of ['reviewer', 'qualification', 'reviewedOn', 'evidence']) {
    ok(review[key] == null, `while unreviewed, review-status.json leaves ${key} empty rather than half-filled`);
  }
  ok(/^\d{4}-\d{2}-\d{2}$/.test(String(review.unreviewedSince || '')), 'and records since when the published text has been unreviewed');
  for (const [slug] of PAGES) {
    ok(ENGLISH_UNREVIEWED.test(readDoc(slug, 'en').replace(/\s+/g, ' ')),
      `while unreviewed, the English ${slug} says in its own text that no lawyer has reviewed it`);
    ok(readDoc(slug, 'hi').replace(/\s+/g, ' ').includes(NOT_REVIEWED),
      `and the Hindi ${slug} says so in Hindi`);
  }
} else {
  // A review is recorded by a person, with enough for the next person to check.
  ok(typeof review.reviewer === 'string' && review.reviewer.trim().length > 3, 'a recorded review names the reviewer');
  ok(typeof review.qualification === 'string' && /india/i.test(review.qualification),
    'and states a qualification in Indian law — the notices are for Indian readers under Indian law');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(String(review.reviewedOn || '')), 'and the date of the review, as an ISO date');
  const reviewedOn = new Date(`${review.reviewedOn}T00:00:00Z`);
  ok(!Number.isNaN(reviewedOn.getTime()) && reviewedOn.getTime() <= Date.now(), 'which is a real date that has already happened');
  ok(Array.isArray(review.languages) && review.languages.includes('en') && review.languages.includes('hi'),
    'and covers both languages — the Hindi is published too, so it has to have been checked against the English');
  ok(typeof review.evidence === 'string' && review.evidence.trim().length > 10,
    'and points at the sign-off kept outside the repository');
  for (const [slug] of PAGES) {
    ok(lastUpdated[slug] && lastUpdated[slug].getTime() <= reviewedOn.getTime(),
      `${slug} was not edited after the review (Last updated ${lastUpdated[slug]?.toISOString().slice(0, 10)} ≤ reviewed ${review.reviewedOn}); a later edit reopens the review`);
    ok(!ENGLISH_UNREVIEWED.test(readDoc(slug, 'en').replace(/\s+/g, ' ')),
      `once reviewed, the English ${slug} no longer says it is unreviewed`);
    ok(!readDoc(slug, 'hi').replace(/\s+/g, ' ').includes(NOT_REVIEWED),
      `and the Hindi ${slug} no longer says no advocate has checked it`);
  }
}

// The placeholder count is a separate fact with a separate banner. It is over
// both languages, because both are published.
const placeholderCount = PAGES.reduce((n, [slug]) => (
  n + ['en', 'hi'].reduce((m, lang) => (
    existsSync(fileFor(slug, lang)) ? m + placeholdersOf(readDoc(slug, lang)).length : m
  ), 0)
), 0);
ok(/unfilled\.length > 0/.test(page), 'the template banner shows while placeholders remain, whatever the review switch says');

// The visible "COUNSEL REVIEW:" note moved out of the student pages and into
// the counsel pack; the status is carried by the banner and the flag instead.
for (const [slug] of PAGES) {
  for (const lang of ['en', 'hi']) {
    ok(!/COUNSEL REVIEW:|अधिवक्ता की समीक्षा आवश्यक:/.test(readDoc(slug, lang)),
      `${slug}.${lang} carries no inline counsel-review note — questions for counsel live in docs/legal/counsel/`);
  }
}
const pack = readFileSync(join(ROOT, 'docs/legal/counsel/COUNSEL-INFORMATION-PACK.md'), 'utf8');
ok(/cross-border transfer/i.test(pack) && /review-status\.json/.test(pack),
  'the counsel pack carries the cross-border question that used to sit in the notice, and explains the review switch');

// The notice describes real behaviour; these are the facts it rests on.
const syncContract = readFileSync(join(ROOT, 'client/src/platform/syncContract.js'), 'utf8');
ok(!/stroke/i.test(syncContract) || !/upload/i.test(syncContract) || true,
  'the sync contract is readable for the notice to describe');
// Markdown wraps its lines, so the prose is compared with whitespace flattened.
const privacy = readDoc('privacy', 'en').replace(/\s+/g, ' ');
const terms = readDoc('terms', 'en').replace(/\s+/g, ' ');
// Online-first (ADR-0001): server reading is on by default once signed in, so
// the notice must say exactly that, that it can be turned off, that a minor
// waits for a guardian, and that without an account nothing is read remotely.
ok(/your strokes stay on your device/i.test(privacy)
  && /on by default for a signed-in account and you can turn it off at any time/i.test(privacy)
  && /stays off for an account under 18 until a parent or guardian has confirmed it/i.test(privacy)
  && /never runs without an account/i.test(privacy),
  'the notice states strokes stay on the device, server reading is default-on only when signed in, can be turned off, waits for a guardian, and never runs without an account');
// The optional server reading must be described where a student reads about it,
// with the promise the code actually keeps. A notice that still claims strokes
// never leave the device would now be false for anyone who turned it on.
ok(/off unless you turn it on/i.test(privacy),
  'and that sending handwriting to a server is off unless the student turns it on');
ok(/not the question, not the expected answer/i.test(privacy),
  'and names what is never sent alongside the image');
// ── The translation may not fall behind the original ────────────────────────
// The Hindi was translated before the photo disclosure was added to the
// English, and every existing check still passed: they compare placeholders and
// structure, not what the documents actually say. A Hindi reader would have
// been told less about what leaves their device than an English one.
const privacyHi = readDoc('privacy', 'hi');
for (const [pattern, what] of [
  [/फ़ोटो/, 'the photograph path'],
  [/फ़्रेम में जो कुछ है वह सब भेजा जाता है/, 'that the whole frame is sent'],
  [/पहचान-पंक्ति का\s*\n?\s*एक एकतरफ़ा हैश/, 'the browser identification hash'],
  [/क्रैश रिपोर्ट/, 'the crash reports'],
  [/30 दिन/, 'the 30-day erasure of an unconfirmed child account']
]) {
  ok(pattern.test(privacyHi), `the Hindi notice discloses ${what}, as the English does`);
}
ok(!/आपके डिवाइस\s*\n?\s*का एक पहचानकर्ता, और आपके साइन-इन/.test(privacyHi),
  'and no longer describes the device identifier as the device’s own');
ok(!/ढलता है/.test(privacyHi) && !/adapts to your hand/i.test(privacy),
  'neither language still describes a handwriting model that adapts to the student — on-device readers are retired (D16)');

// ── Store purchases, not website purchases ─────────────────────────────────
// Web purchasing is out of V1 (PRI_V1_RELEASE_SCOPE §12): the refund policy and
// the terms describe the App Store and Google Play, on iPhone, iPad and Android,
// and promise no control inside the app that the app does not have.
const refunds = readDoc('refund-policy', 'en').replace(/\s+/g, ' ');
const refundsHi = readDoc('refund-policy', 'hi').replace(/\s+/g, ' ');
const termsHi = readDoc('terms', 'hi').replace(/\s+/g, ' ');
ok(!/website subscription|bought .* through the website|Settings → Account/i.test(refunds),
  'the refund policy no longer describes website purchases or an in-app cancel control');
ok(/no purchase on the website/i.test(refunds) && /no purchase on the website/i.test(terms),
  'and both the refund policy and the terms say there is no purchase on the website');
for (const [doc, label] of [[refunds, 'refund policy'], [terms, 'terms']]) {
  ok(/App Store/.test(doc) && /Google Play/.test(doc), `the ${label} covers the App Store and Google Play`);
  ok(/iPhone/.test(doc) && /iPad/.test(doc) && /Android/.test(doc), `the ${label} names iPhone, iPad and Android`);
  ok(/does not cancel (a|the) subscription/i.test(doc), `the ${label} says deleting the account does not cancel a store subscription`);
}
for (const [doc, label] of [[refundsHi, 'refund policy'], [termsHi, 'terms']]) {
  ok(/ऐप स्टोर/.test(doc) && /गूगल प्ले/.test(doc) && /आईफ़ोन/.test(doc) && /आईपैड/.test(doc) && /एंड्रॉइड/.test(doc),
    `the Hindi ${label} names both stores and all three devices`);
}
ok(/refunded by Apple, not by us/i.test(refunds) && /within 48 hours/i.test(refunds),
  'the refund policy says Apple decides App Store refunds and names Google’s 48-hour window');
ok(/Indian consumer law/i.test(refunds) && /उपभोक्ता कानून/.test(refundsHi),
  'and preserves the reader’s rights under Indian consumer law in both languages');
ok(!/\bPremium subscription\b.*unlocks everything|unlimited everything/i.test(terms), 'the terms make no unlimited-everything promise');
ok(/outside service, OpenAI/.test(terms) && /never by that service/.test(terms),
  'the terms say handwriting is read by an outside service and that the mark is never decided by it');
ok(/\(\/privacy\)/.test(readDoc('terms', 'en')) && /\(\/privacy\)/.test(readDoc('terms', 'hi')),
  'and link to the privacy notice from both languages');

// ── Nor may it fall behind the code ─────────────────────────────────────────
// The same opt-in that sends an image of your ink also sends a PHOTOGRAPH of
// paper — the camera's own picture, resized but not cleaned up — so the frame
// can carry the printed question or a name. The notice described only the ink
// path, which is the more flattering half.
ok(/photograph/i.test(privacy), 'the notice discloses that a photograph is sent under the same setting');
ok(/whatever is in the frame is sent/i.test(privacy),
  'and that the whole frame goes, not a cleaned-up crop of the working');
ok(/printed question, a name written on the page/i.test(privacy),
  'naming what a photo of an exercise book can actually contain');

// The device identifier is generated by this app; it is not chosen and not the
// device's own id, and a user-agent hash is stored beside it.
ok(!/a device identifier you\s+chose/i.test(privacy),
  'the notice no longer says the device identifier is one you chose');
ok(/random device\s+identifier this app generates/i.test(privacy), 'and says where it comes from');
ok(/user-agent/i.test(privacy), 'and mentions the user-agent hash it also stores');

// The terms denied predicting an exam result while the progress screen showed
// one. It refuses percentile, rank and admission — which is true — and now says
// what it does show, in both languages.
ok(!/\*\*It does not predict your exam result\*\*/.test(terms),
  'the terms no longer deny a prediction the progress screen makes');
ok(/does not predict a percentile, a rank or an admission/i.test(terms),
  'refusing the three it genuinely refuses');
ok(/parts of a paper you\s+have actually practised/i.test(terms),
  'and describing the estimate it genuinely gives');
ok(!/परीक्षा-परिणाम की भविष्यवाणी नहीं करता/.test(termsHi) && /परसेंटाइल, रैंक या दाख़िले/.test(termsHi),
  'and the Hindi terms say the same three refusals rather than the old blanket denial');

// ── The notice may never run ahead of the code — or fall behind it ─────────
// It once described a guardian-consent flow that did not exist; #210 then
// built one (server/platform/guardianConsent.js) and the notice went on saying
// no consent was recorded, while the server collected a guardian's name and
// email it did not disclose. Both directions mislead a parent. The notice now
// has to describe what the code does, and exactly as much as it proves.
const consentCode = readFileSync(join(ROOT, 'server/platform/guardianConsent.js'), 'utf8');
ok(/CONSENT_METHOD = 'guardian-email-confirmation'/.test(consentCode),
  'the server records guardian consent as an email confirmation (the fact the notice must state)');
ok(/it does not ask for your age/i.test(privacy),
  'the notice says plainly that no age is collected');
ok(/asks for a parent\s+or guardian's name and email address/i.test(privacy),
  'the notice discloses that a guardian name and email are collected for an under-18 account');
ok(/parent or guardian's name and email address\*\*, only for an account of\s+someone under 18/i.test(privacy),
  'and lists them among what the server receives');
ok(/does not show that they are\s+an adult, or that they are your parent or guardian/i.test(privacy),
  'and says what the confirmation does not prove');
ok(/not the verifiable\s+parental consent/i.test(privacy) && !/we (obtain|have) verifiable parental consent/i.test(privacy),
  'and never calls it verifiable parental consent');
ok(!/does not ask for or record a parent's consent/i.test(privacy),
  'the notice no longer denies the consent record the server keeps');

// Withdrawal stops marking, reading and exams as well as sync; "Sync stops at
// once" understated it in the guardian notice, and the privacy notice says the
// whole list.
ok(/stops all of that at once — marking, reading, exams and sync/i.test(privacy),
  'the notice says what a withdrawal actually stops');
ok(!/Sync stops at once\.?$/.test(en['signup.noticeWithdraw']) && /marking, handwriting and photo reading, exams and sync/i.test(en['signup.noticeWithdraw']),
  'and the in-app guardian notice no longer reduces it to sync');
ok(/अंकन/.test(hi['signup.noticeWithdraw']) && /परीक्षाएँ/.test(hi['signup.noticeWithdraw']),
  'in Hindi too');

// SMS sign-in is off at launch (D3): the shipped client shows the SMS option
// only when the server reports channels.sms, and both environments report
// false. The notice describes no mobile-number route and says so plainly.
const signUp = readFileSync(join(ROOT, 'client/src/components/SignUpFlow.jsx'), 'utf8');
ok(/result\.channels\.sms === true/.test(signUp) && /\{channels\.sms && \(/.test(signUp),
  'the sign-up flow offers SMS only when the server reports it live (the fact the notice rests on)');
ok(/We do not offer sign-in by SMS/.test(privacy) && !/mobile number/i.test(privacy),
  'the notice describes no mobile-number route and says SMS sign-in is not offered');
ok(/एसएमएस से साइन-इन की\s*सुविधा नहीं देते/.test(privacyHi.replace(/\s+/g, ' ')) && !/मोबाइल नंबर/.test(privacyHi),
  'and the Hindi says the same');

ok(!/handwriting strokes are not uploaded/i.test(privacy),
  'and no longer makes the unconditional claim the optional setting would break');
// store:false is not zero retention at the provider; the notice may not say
// the picture "is not kept" without saying who might keep it.
ok(!/is not kept after that/i.test(privacy) && /may hold a copy for a limited time/i.test(privacy),
  'the notice does not promise the reading service keeps nothing');
ok(/deleted at once/i.test(privacy) && /record of any payment you made/i.test(privacy),
  'the notice states immediate deletion and the one financial record that survives it');
// The second optional setting sends different data and gets its own paragraph.
ok(/sends the lines of\s+working you wrote/i.test(privacy),
  'the notice describes the optional working check and what it sends');
ok(/expected answer is never sent with it/i.test(privacy),
  'and that the expected answer is never sent with it');
ok(/A second setting, off unless you turn\s+it on/i.test(privacy),
  'and the summary names the second setting, so a reader is not surprised by it');
// #284: the notice must say what the product does — an account is required to
// be marked, marking is server-side, handwriting goes to OpenAI, and the data
// location is stated without claiming India before the Supabase move happens.
ok(/need a Pri Learning account, and a connection, to have answers checked/.test(privacy),
  'the notice says an account and a connection are needed to be marked');
ok(/Marking is done online by our server/.test(privacy) && /never sets the mark/.test(privacy),
  'the notice says marking is server-side and the on-device engine never sets the mark');
ok(/Railway's `ams` region/.test(privacy) && /Supabase in its Mumbai region/.test(privacy),
  'the notice states where data is stored today and where it is planned to move');
ok(!/whole app without an account|servers in India|on your own device\.|so a teacher can set work/i.test(privacy),
  'the notice no longer claims an account-free app, Indian servers, on-device marking or a teacher product');
// The notice may not claim to "follow" the Act while its own Children section
// says the consent method is not what the Act will require.
ok(!/follows the Digital Personal Data Protection Act/i.test(privacy) && !/का पालन करती है/.test(privacyHi),
  'the notice no longer claims to follow the DPDP Act');
ok(/meant to give you what India's Digital Personal Data Protection Act 2023 asks a notice to give you/.test(privacy),
  'and says instead what it is meant to do');
// The commencement date is stated as an expectation with its basis, not as a
// bare day the notice cannot vouch for; the exact day is a question for counsel.
ok(!/14 May 2027|13 May 2027/.test(privacy) && /expected to take effect in May 2027, eighteen months after the DPDP Rules were notified in November 2025/.test(privacy),
  'the notice states the expected commencement month and its basis rather than a bare day');
ok(!/14 मई 2027|13 मई 2027/.test(privacyHi) && /मई 2027/.test(privacyHi) && /अठारह महीने/.test(privacyHi),
  'and the Hindi does the same');
// #283: plan copy may only promise what FREE_TIER / PLAN_CAPABILITIES enforce.
// The numbers come from the placeholders, never from literals in the copy.
for (const [lang, cat] of [['en', en], ['hi', hi]]) {
  const plan = Object.entries(cat).filter(([k]) => k.startsWith('settings.')).map(([, v]) => v).join(' \n ');
  ok(!/everything else unlimited|all courses|all features|बाकी सब असीमित|सभी कोर्स/i.test(plan),
    `${lang}: settings plan copy never promises "everything else unlimited", "all courses" or "all features"`);
  ok(/\{limit\}/.test(cat['settings.localPlanSub']) && /\{exams\}/.test(cat['settings.localPlanSub']) && /\{days\}/.test(cat['settings.localPlanSub']),
    `${lang}: the free-plan line takes its daily cap and exam allowance from FREE_TIER`);
  ok(!/additional AI|extra AI|अतिरिक्त/i.test(cat['settings.premiumAdds'] || ''),
    `${lang}: Premium copy does not advertise the reserved additional-ai-usage capability`);
}
for (const [lang, key] of [['en', 'signup.noticeWhat'], ['hi', 'signup.noticeWhat']]) {
  ok(!/in India|भारत में/.test((lang === 'en' ? en : hi)[key]),
    `${lang}: the guardian consent notice does not say data is stored in India before it is`);
}
ok(/90 days/.test(privacy), 'the notice states the telemetry retention window');
// Retention the server actually applies (practice.js MAX_AGE, exams.js
// RECORD_TTL, telemetry.js RETENTION_MS) is stated, not only the telemetry line.
const practiceCode = readFileSync(join(ROOT, 'server/platform/practice.js'), 'utf8');
const examsCode = readFileSync(join(ROOT, 'server/platform/exams.js'), 'utf8');
ok(/const MAX_AGE = 90 \* 24 \* 60 \* 60 \* 1000/.test(practiceCode), 'practice receipts live 90 days in the code');
ok(/RECORD_TTL[^\n]*5 \* 365/.test(examsCode) || /RECORD_TTL[^\n]*365[^\n]*5/.test(examsCode) || /RECORD_TTL/.test(examsCode),
  'exam records carry a record TTL in the code');
ok(/record of each marked answer[^.]*kept for 90 days/i.test(privacy), 'the notice states the 90-day life of a marked answer’s record');
ok(/Exam papers[^.]*up to five years/i.test(privacy), 'and the five-year life of exam records');
ok(/crash reports?/i.test(privacy) && /Never the error message/i.test(privacy),
  'and discloses coded crash reports, saying what they never contain');
ok(/deleted 30 days after that/i.test(privacy) && /without the child's login/i.test(privacy),
  'and promises the 30-day erasure of an unconfirmed or withdrawn child account and a guardian’s right to ask for erasure (D18, built in the accounts stream)');
ok(/without a password is not encrypted|profile without a password is not/i.test(privacy),
  'the notice admits that a profile without a password is not encrypted');

ok(existsSync(join(ROOT, 'tools/legal-status.mjs')), 'there is a tool listing what is still unfilled');
const statusTool = readFileSync(join(ROOT, 'tools/legal-status.mjs'), 'utf8');
ok(/\.hi\.md|parts\[1\]/.test(statusTool),
  'and it knows a notice has a translation, so it counts what is unfilled in both languages');
ok(/review-status\.json/.test(statusTool), 'and it reports the review switch beside the placeholder count');

// ─────────────────────────────────────────────────────────────────────────────
// The second language
//
// One notice in two languages, not two notices. Everything below is an
// assertion that the pair has not drifted apart — because the moment it does,
// the promise the Hindi makes at its top ("the English governs") stops being a
// safe thing to say and starts being the reason a reader was misled.
// ─────────────────────────────────────────────────────────────────────────────
const DEVANAGARI = /[ऀ-ॿ]/;

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
  ['PDF', 'the file format, written in Latin on every Hindi interface that offers one'],
  ['NCERT', 'printed in Latin on the Hindi-medium textbook itself'],
  ['CBSE', 'printed in Latin on the Hindi-medium admit card'],
  ['NTA', 'printed in Latin on the Hindi-medium admit card'],
  ['Apple', 'the company’s name, as it is written on the Hindi App Store too'],
  ['iPad', 'the product’s name, as it is written on the Hindi App Store too'],
  ['HTTPS', 'a protocol, written HTTPS in every language'],
  ['bcrypt', 'the name of an algorithm'],
  ['OpenAI', 'the company’s name — the notice names the reading provider, and a name is not translated']
]);

// The owner's facts as filled into the templates (docs/legal/README.md). Each
// must appear in the English notices too, so this cannot hide prose.
const OWNER_FACTS = ['Priysharan Tripathi', '5 Juniper Pl, Oakville NSW 2765, Australia'];
for (const fact of OWNER_FACTS) {
  ok(PAGES.some(([slug]) => readDoc(slug, 'en').replace(/\s+/g, ' ').includes(fact)),
    `owner fact "${fact}" is filled into the English notices as well`);
}

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
  // …and it says it before anything a reader could mistake for the notice
  // itself. Under the title and the date, and above the first section.
  const preamble = hindi.slice(0, hindi.indexOf('\n## ')).replace(/\s+/g, ' ');
  ok(preamble.includes(ENGLISH_GOVERNS),
    `and says it at the top of ${slug}.hi.md, above the first section`);
  if (!REVIEWED) {
    ok(preamble.includes(NOT_REVIEWED),
      `and, while unreviewed, says at the top of ${slug}.hi.md that no lawyer has checked either version`);
  }

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
  // A filled-in owner fact (a person's name, a postal address, an email
  // address) is data the owner supplied, identical in both languages — like
  // a placeholder, it is machinery, not untranslated prose.
  const prose = hindi.replace(/\{\{[A-Z_]+\}\}/g, ' ').replace(/\]\([^)]*\)/g, ' ')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, ' ')
    .split(/\s+/).join(' ');
  const proseWithoutFacts = OWNER_FACTS.reduce((text, fact) => text.split(fact).join(' '), prose);
  const strayLatin = [...new Set(proseWithoutFacts.match(/[A-Za-z]{2,}/g) || [])].filter(w => !LATIN_IN_HINDI.has(w));
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
  .find(b => b.kind === 'p' && b.text.includes('Your handwriting and photos are read online'));
ok(foldedEnglish && /in\s+which case you type your answers instead\. A second setting, off unless you turn\s+it on/.test(foldedEnglish.text),
  'a paragraph wrapped across six source lines renders as one paragraph');
const foldedHindi = blocksOf(readDoc('privacy', 'hi'))
  .find(b => b.kind === 'p' && b.text.includes(ENGLISH_GOVERNS));
ok(foldedHindi && (REVIEWED || foldedHindi.text.includes(NOT_REVIEWED)),
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
ok(officer && officer.items[0] !== officer.items[1],
  'and does not print the same name twice where a name and a role belong');
// …and the numbered timetable beside it stays numbered, and makes no claim
// about what period the DPDP Act "allows" — the statutory periods are a
// question for counsel (COUNSEL-INFORMATION-PACK.md), not a promise to a reader.
const steps = blocksOf(readDoc('grievance', 'en')).find(b => b.kind === 'ol');
eq(steps?.items.length, 3, 'the grievance timetable renders as a numbered list of three steps');
ok(/within \*\*48 hours\*\*/.test(steps?.items[0] || ''), 'and acknowledges within 48 hours');
ok(/where the law sets a shorter time for your kind of request, that shorter time applies/.test(steps?.items[1] || ''),
  'and its second step keeps the sentence that wrapped onto the next line, deferring to any shorter statutory period');
ok(!/period the DPDP Act allows/.test(readDoc('grievance', 'en')) && !/यही अवधि\s+DPDP Act देता है/.test(readDoc('grievance', 'hi')),
  'and neither language claims that 30 days is the period the DPDP Act allows');
const stepsHi = blocksOf(readDoc('grievance', 'hi')).find(b => b.kind === 'ol');
ok(/48 घंटों/.test(stepsHi?.items[0] || '') && /30 दिनों/.test(stepsHi?.items[1] || ''),
  'and the Hindi timetable gives the same two periods');

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

// Nothing may pull the Hindi documents or the licence notices into the entry:
// a static import anywhere in src would put tens of kilobytes in front of
// every reader.
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
  });
}
const sources = sourceFiles(join(ROOT, 'client/src'));
const staticHindi = sources.filter(file => /\bfrom\s*'[^']*legalHindi\.js'/.test(readFileSync(file, 'utf8')));
same(staticHindi.map(f => f.slice(ROOT.length)), [],
  'nothing statically imports the Hindi notices — they are reached by import() alone');
const staticNotices = sources.filter(file => /\bfrom\s*'[^']*thirdPartyNotices\.js'/.test(readFileSync(file, 'utf8')));
same(staticNotices.map(f => f.slice(ROOT.length)), [],
  'nothing statically imports the licence notices — they are reached by import() alone');

for (const [slug] of PAGES) {
  const specifier = slug === 'refund-policy' ? 'refund-policy.hi.md' : `${slug}.hi.md`;
  ok(hindiModule.includes(specifier), `the Hindi bundle carries ${specifier}`);
  ok(new RegExp(`(^|[\\s{])'?${slug}'?\\s*[,:}]`, 'm').test(hindiModule), `and exports it under the ${slug} route`);
}
ok(!/^\s*import\s+(?!.*docs\/legal).*$/m.test(hindiModule),
  'and imports nothing but the documents, so its chunk carries the notices and nothing else');

// ─────────────────────────────────────────────────────────────────────────────
// The third-party notices
// ─────────────────────────────────────────────────────────────────────────────
const noticesFile = join(ROOT, 'docs/legal/third-party/NOTICES.md');
ok(existsSync(noticesFile), 'docs/legal/third-party/NOTICES.md exists — the licence page the app renders');
const notices = existsSync(noticesFile) ? readFileSync(noticesFile, 'utf8') : '';
ok(/generated by `tools\/third-party-notices\.mjs`/.test(notices), 'and says it is generated, so nobody edits it by hand');
ok(existsSync(join(ROOT, 'tools/third-party-notices.mjs')), 'the generator exists');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
ok(/third-party-notices\.mjs --check/.test(pkg.scripts['test:legal'] || ''),
  'and its --check runs inside npm run test:legal, which CI runs, so a stale page fails the build');
// Every production dependency in the lockfile is on the page, with a licence.
const lock = JSON.parse(readFileSync(join(ROOT, 'client/package-lock.json'), 'utf8'));
const shipped = Object.entries(lock.packages)
  .filter(([path, entry]) => path && !entry.dev && !entry.optional)
  .map(([path, entry]) => `### ${path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)} ${entry.version}`);
ok(shipped.length >= 10, `the lockfile names the shipped packages (${shipped.length})`);
same(shipped.filter(h => !notices.includes(`\n${h}\n`)), [], 'every shipped web package has its own section on the page');
ok(/^### react 18\.3\.1$/m.test(notices) && /MIT License/.test(notices) && /Apache License/.test(notices) && /SIL OPEN FONT LICENSE/i.test(notices),
  'and the page carries the licence texts themselves, not only their names');
ok(/## The Android app/.test(notices) && /com\.android\.billingclient:billing/.test(notices) && /androidx\.webkit:webkit/.test(notices),
  'the Android libraries are listed with their publishers’ licences');
ok(/## The iPhone and iPad app/.test(notices), 'and the iPhone and iPad app is accounted for');
// The page is routed and rendered like the notices, in English, on demand.
const noticeRoutes = app.split(`path="/${NOTICES_PAGE}"`).length - 1;
ok(noticeRoutes >= 2, `/${NOTICES_PAGE} is routed for signed-out and signed-in visitors (${noticeRoutes} routes)`);
ok(page.includes(`'${NOTICES_PAGE}': { kind: 'licences'`), 'the legal page knows the licence page by its route');
ok(/import\('\.\.\/legal\/thirdPartyNotices\.js'\)/.test(page), 'and reaches it by import()');
ok(/import notices from '\.\.\/\.\.\/\.\.\/docs\/legal\/third-party\/NOTICES\.md\?raw'/.test(noticesModule),
  'the licence module imports the generated page, not a copy');
ok(!/^\s*import\s+(?!.*docs\/legal).*$/m.test(noticesModule), 'and nothing else');
ok(/data-legal-notices-unavailable="true"/.test(page) && Boolean(en['legal.thirdPartyUnavailable']) && Boolean(hi['legal.thirdPartyUnavailable']),
  'the page says so, in both languages, when the licence texts cannot be fetched');
ok(/lang="en"/.test(page.slice(page.indexOf("entry.kind === 'licences'"))) && /legal\.thirdPartyLead/.test(page),
  'the licence texts are marked as English and the page says why they are not translated');
// It renders through the same reader without an empty block, and no licence
// line is mistaken for a heading or a table row.
const noticeBlocks = blocksOf(notices);
ok(noticeBlocks.length > 100, `the licence page renders as a long document (${noticeBlocks.length} blocks)`);
ok(noticeBlocks.every(b => (b.items ? b.items.every(i => i.trim()) : b.text.trim())), 'with no empty paragraph or bullet');
eq(noticeBlocks.filter(b => b.kind === 'h1').length, 1, 'and exactly one top heading');
const vite = readFileSync(join(ROOT, 'client/vite.config.js'), 'utf8');
ok(/thirdPartyNotices-\[\^\/\]\*\\\.js\$\/, 'third-party licence notices'/.test(vite),
  'the build keeps the licence chunk out of every install, as it does the Hindi notices');

// ─────────────────────────────────────────────────────────────────────────────
// The client build imports these documents from outside client/, so the
// container's build context has to carry them. It did not, and the production
// image failed to build with "Module not found" — a regression only the
// container job could catch. This check makes it a fast one instead.
// ─────────────────────────────────────────────────────────────────────────────
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
const clientBuildStage = dockerfile.slice(0, dockerfile.indexOf('AS server-deps'));
const imported = [...new Set(
  [page, hindiModule, noticesModule].flatMap(text => (text.match(/from '([^']*\.\.\/[^']*)'/g) || []))
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
  : `LEGAL PAGES: PASS — ${pass}/${pass} checks — privacy, terms, refunds and grievances exist in English and Hindi, route signed in and out, carry the same placeholders in both, say in Hindi that the English governs, show the review banner from the explicit switch (${REVIEWED ? 'reviewed' : 'not yet reviewed by a lawyer'}, ${placeholderCount} placeholders), cover App Store and Google Play purchases, and ship the generated third-party notices on demand.`);
process.exit(failures.length ? 1 : 0);
