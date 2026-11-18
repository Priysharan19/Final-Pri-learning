// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Prithagoras (Australian) legal notices, and the wall
// between them and the Indian ones
//
// Prithagoras served the Indian notices: written for the DPDP Act, naming a
// Grievance Officer, governed by the courts of New Delhi, selling through Apple,
// Google and Razorpay. This suite holds the Australian replacements
// (docs/legal/au/) to five things, deterministically:
//
//   1 · THE WALL. client/vite.config.js editionLegalPlugin points the legal page
//       at docs/legal/au/ for a Prithagoras build and leaves Priyabhata alone;
//       a Prithagoras build is stopped if any file it would write carries the
//       Indian notices' words (DPDP, Data Protection Board, Grievance Officer).
//       --dist-au / --dist-in scan real builds as well (the CI build jobs pass them).
//   2 · NOTHING INDIAN in the Australian notices (law, courts, currency, curricula,
//       stores, the DPDP vocabulary), and the Indian notices still say what they
//       said (Priyabhata is unchanged).
//   3 · WHAT AN AUSTRALIAN NOTICE MUST SAY, and must not: APP headings, APP 8,
//       access and correction, the OAIC, the Children's Online Privacy Code as
//       pending and not claimed, the Australian Consumer Law, NSW law, AUD and GST
//       without a claim to be registered, no "no refunds".
//   4 · TRUE OF THE CODE. Every number and every present-tense fact the notices
//       state is read back from the code or the edition table: retention periods,
//       the guardian window, one-time code limits, "Premium is not on sale",
//       "final answer only", the email provider, the OpenAI reader.
//   5 · THE REVIEW SWITCH. docs/legal/au/review-status.json is its own record,
//       false until a person fills it, never inferred from placeholders, and
//       independent of the Indian one.
//
// The notices carry four declared placeholders — facts the code cannot supply (where
// the Australian deployment is hosted and its database held, who takes payment, and
// the contact address). A notice with one unfilled is a template and the page says so;
// this suite lists them and refuses any other.
//
// SYNTHETIC / STATIC: reads files and runs the plugin's own functions. It is not
// legal advice and not a lawyer's review.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (cond, text) => { if (cond) pass++; else failures.push(text); };

const AU = ['privacy', 'terms', 'refund-policy', 'contact'].map(name => ({ name, path: `docs/legal/au/${name}.md`, text: existsSync(join(ROOT, `docs/legal/au/${name}.md`)) ? read(`docs/legal/au/${name}.md`) : '' }));
const IN = ['privacy', 'terms', 'refund-policy', 'grievance'].map(name => ({ name, path: `docs/legal/${name}.md`, text: read(`docs/legal/${name}.md`) }));
// Matching is on the notice with its line breaks folded to single spaces: the files are wrapped.
const flat = text => text.replace(/\s+/g, ' ');
const au = name => flat(AU.find(d => d.name === name).text);
const all = AU.map(d => flat(d.text)).join('\n');
for (const d of AU) ok(d.text.length > 400, `${d.path} exists and is a real notice`);

// ── 1 · The wall ────────────────────────────────────────────────────────────
const vite = await import(pathToFileURL(join(ROOT, 'client/vite.config.js')).href);
const { legalRedirect, editionLegalPlugin, LEGAL_PAGE_MODULE, INDIA_LEGAL_WORDS, AU_LEGAL_FILES } = vite;
const SOURCES = {
  '../../../docs/legal/privacy.md?raw': 'docs/legal/au/privacy.md?raw',
  '../../../docs/legal/terms.md?raw': 'docs/legal/au/terms.md?raw',
  '../../../docs/legal/refund-policy.md?raw': 'docs/legal/au/refund-policy.md?raw',
  '../../../docs/legal/grievance.md?raw': 'docs/legal/au/contact.md?raw',
  '../../../docs/legal/review-status.json': 'docs/legal/au/review-status.json'
};
for (const [source, target] of Object.entries(SOURCES)) {
  const got = legalRedirect('prithagoras', source, LEGAL_PAGE_MODULE);
  ok(typeof got === 'string' && got.replace(/\\/g, '/').endsWith(target), `Prithagoras: ${source} resolves to ${target} (got ${got})`);
  ok(legalRedirect('priyabhata', source, LEGAL_PAGE_MODULE) === null, `Priyabhata: ${source} is left alone`);
  ok(legalRedirect('prithagoras', source, join(ROOT, 'client/src/pages/Other.jsx')) === null, `${source} is only redirected for the legal page`);
}
ok(typeof legalRedirect('prithagoras', '../i18n/legalHindi.js', LEGAL_PAGE_MODULE) === 'string', 'Prithagoras: the Hindi notices are replaced by an empty set');
ok(legalRedirect('priyabhata', '../i18n/legalHindi.js', LEGAL_PAGE_MODULE) === null, 'Priyabhata: the Hindi notices stay');
ok(legalRedirect('prithagoras', '../components/PageLink.jsx', LEGAL_PAGE_MODULE) === null, 'nothing else of the legal page is redirected');
ok(AU_LEGAL_FILES.every(f => existsSync(join(ROOT, 'docs/legal/au', f))), 'every file the Prithagoras build needs exists');
{
  const fakeBundle = { 'a.js': { type: 'chunk', code: 'var n = "Grievance Officer at the Data Protection Board under the DPDP Act"' }, 'b.css': { type: 'asset', source: 'body{}' } };
  const refuse = edition => { try { editionLegalPlugin(edition).generateBundle.call({ error: m => { throw new Error(m); } }, {}, fakeBundle); return false; } catch (e) { return /must not reach this edition/.test(e.message); } };
  ok(refuse('prithagoras'), 'a Prithagoras build carrying an Indian notice word is stopped');
  ok(!refuse('priyabhata'), 'a Priyabhata build is not stopped for them');
  const clean = { 'a.js': { type: 'chunk', code: 'var n = "Australian Privacy Principles"' } };
  let threw = false; try { editionLegalPlugin('prithagoras').generateBundle.call({ error: m => { throw new Error(m); } }, {}, clean); } catch { threw = true; }
  ok(!threw, 'a clean Prithagoras bundle is not stopped');
  for (const word of ['DPDP', 'Digital Personal Data Protection', 'Data Protection Board', 'Grievance Officer']) ok(INDIA_LEGAL_WORDS.test(word), `the guard recognises "${word}"`);
}
const legalPage = read('client/src/pages/Legal.jsx');
const app = read('client/src/App.jsx');
ok(/PUBLISHED = Object\.freeze\(EDITION === 'prithagoras'\s*\?\s*\['privacy', 'terms', 'refund-policy', 'contact', 'third-party-notices'\]\s*:\s*\['privacy', 'terms', 'refund-policy', 'grievance', 'third-party-notices'\]\)/.test(legalPage),
  'the legal page serves contact for Prithagoras and grievance for Priyabhata, never both');
ok(/const entry = PUBLISHED\.includes\(page\)/.test(legalPage), 'a page the edition does not serve is not found, not rendered');
ok(/LEGAL_ROUTES_EXTRA = EDITION === 'prithagoras'[\s\S]{0,400}path="\/contact"[\s\S]{0,200}path="\/grievance" element=\{<Navigate to="\/contact"[\s\S]{0,200}path="\/refunds" element=\{<Navigate to="\/refund-policy"/.test(app),
  'Prithagoras routes /contact, sends /grievance to it and /refunds to the refund policy');
ok(/: <Route path="\/grievance" element=\{<Legal \/>\} \/>;/.test(app), 'Priyabhata routes /grievance as before');
ok((app.match(/\{LEGAL_ROUTES_EXTRA\}/g) || []).length === 3, 'all three route tables (signed out, setup, signed in) carry the edition routes');
ok(/UNREVIEWED_BODY = EDITION === 'prithagoras' \? 'legal\.unreviewedBodyAu' : 'legal\.unreviewedBody'/.test(legalPage), 'the banner names Australian law for Prithagoras');
const en = read('client/src/i18n/strings.en.js'), hi = read('client/src/i18n/strings.hi.js');
ok(/'legal\.unreviewedBodyAu': '[^']*Australian law/.test(en) && /'legal\.unreviewedBodyAu'/.test(hi) && /'login\.contact'/.test(en) && /'login\.contact'/.test(hi), 'the Australian banner and the Contact link are translated');
ok(/<LegalContactLink \/>/.test(read('client/src/pages/Login.jsx')) && /EDITION === 'prithagoras'\s*\?\s*<PageLink to="\/contact">[\s\S]*<PageLink to="\/grievance">/.test(read('client/src/components/LegalContactLink.jsx')), 'the sign-in footer links Contact for Prithagoras and Grievances for Priyabhata');

// Real builds: handed over (--dist-au / --dist-in), or built here (--build: both editions
// into temporary folders, the way brand-build-check --both builds the other one).
if (process.argv.includes('--build')) {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const base = mkdtempSync(join(tmpdir(), 'pri-legal-build-'));
  for (const [edition, flag] of [['prithagoras', '--dist-au'], ['priyabhata', '--dist-in']]) {
    const out = join(base, edition);
    execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: join(ROOT, 'client'), env: { ...process.env, PRI_EDITION: edition }, stdio: ['ignore', 'ignore', 'inherit'] });
    process.argv.push(flag, out);
  }
  process.on('exit', () => rmSync(base, { recursive: true, force: true }));
}
// Real builds, when the CI build jobs hand them over.
const arg = flag => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; };
function textOf(dir) {
  let out = '';
  const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && /\.(js|css|html|json|md|webmanifest|txt)$/.test(e.name)) out += `\n${readFileSync(p, 'utf8')}`; } };
  walk(dir);
  return out;
}
let scanned = '';
if (arg('--dist-au')) {
  const text = textOf(arg('--dist-au'));
  scanned += ' Prithagoras dist scanned;';
  ok(text.length > 100000, 'the Prithagoras build is a real build');
  ok(!INDIA_LEGAL_WORDS.test(text), `the Prithagoras build carries no DPDP or Grievance Officer text (${(INDIA_LEGAL_WORDS.exec(text) || [''])[0]})`);
  ok(/Australian Privacy Principles/.test(text) && /Children.s Online Privacy Code/.test(text), 'and it carries the Australian privacy notice');
  ok(!/New Delhi/.test(text), 'and no New Delhi jurisdiction clause');
}
if (arg('--dist-in')) {
  const text = textOf(arg('--dist-in'));
  scanned += ' Priyabhata dist scanned;';
  ok(/Digital Personal Data Protection/.test(text) && /Data Protection Board of India/.test(text) && /Grievance officer/.test(text), 'the Priyabhata build still serves the DPDP notices and the grievance officer');
  ok(!/Australian Privacy Principles/.test(text), 'and none of the Australian ones');
}

// ── 2 · Nothing Indian in the Australian notices; the Indian ones unchanged ──
for (const d of AU) {
  for (const [word, re] of [
    ['DPDP / Digital Personal Data Protection', /DPDP|Digital Personal Data/i], ['Data Protection Board', /Data Protection Board/i], ['a Grievance Officer', /grievance officer/i],
    ['New Delhi', /New Delhi/], ['Indian law', /Indian law|laws of India/i], ['the rupee', /₹|\bINR\b|rupee|\bRs\.?\s?\d/i], ['Razorpay', /Razorpay/i],
    ['CBSE / NCERT / JEE', /\bCBSE\b|NCERT|\bJEE\b|\bNTA\b/], ['Hindi', /Hindi/], ['Apple / Google subscriptions', /App Store|Google Play/], ['Mumbai / Supabase', /Mumbai|Supabase/]
  ]) ok(!re.test(d.text), `${d.path} does not mention ${word}`);
}
ok(/DPDP/.test(IN[0].text) && /Data Protection Board/.test(IN[3].text) && /Grievance officer/.test(IN[3].text) && /New Delhi/.test(IN[1].text) && /Razorpay|App Store/.test(IN[1].text + IN[2].text),
  'the Indian notices are untouched: DPDP, the Grievance officer, the Data Protection Board, New Delhi, the stores');
ok(/import grievance from '\.\.\/\.\.\/\.\.\/docs\/legal\/grievance\.md\?raw'/.test(legalPage) && /import review from '\.\.\/\.\.\/\.\.\/docs\/legal\/review-status\.json'/.test(legalPage), 'the legal page still imports the Indian notices and their review switch by default');

// ── 3 · What an Australian notice must say, and must not ────────────────────
const privacy = au('privacy'), terms = au('terms'), refund = au('refund-policy'), contact = au('contact');
for (const [label, re] of [
  ['the Australian Privacy Principles / Privacy Act 1988', /Australian Privacy Principles[\s\S]{0,200}Privacy Act 1988|Privacy Act 1988[\s\S]{0,200}Australian Privacy Principles/],
  ['who is responsible, with an address', /Oakville NSW 2765, Australia/], ['what is collected', /What we collect/], ['why', /Why we use it/],
  ['overseas disclosure under APP 8, with the recipients', /Sending information overseas[\s\S]*OpenAI[\s\S]*Resend/], ['APP 12 and 13: access and correction', /APP 12 and APP 13/],
  ['a complaint to us then the OAIC', /write to us first[\s\S]{0,300}Office of the Australian\s+Information Commissioner \(OAIC\)/],
  ['children: under 15 needs a parent or guardian to confirm; 15 and over does not', /A student under 15 needs a\s+parent or guardian to confirm the account\. A student who is 15 or older does\s+not, and nor does an adult/],
  ['the Children\'s Online Privacy Code, pending and not claimed', /Children.s Online Privacy Code[\s\S]{0,500}not treated any such Code as being in force[\s\S]{0,80}do not claim\s+to comply/],
  ['how long it is kept', /How long we keep it/], ['security and the data-breach promise', /data breach[\s\S]{0,120}tell you/], ['a way to delete', /\/account\/delete-request/]
]) ok(re.test(privacy), `the privacy notice has ${label}`);
ok(!/we (?:comply|are compliant) with the (?:Children|Privacy)/i.test(privacy), 'the privacy notice does not claim compliance with the Children\'s Online Privacy Code or the Act');
ok(/aim to handle your information in line with the APPs/.test(privacy), 'it says we AIM to follow the APPs (whether the Act applies to us is open), not that we are bound or compliant');
for (const [label, re] of [
  ['Australian Consumer Law guarantees that cannot be excluded', /guarantees that cannot be excluded under the Australian\s+Consumer Law/], ['New South Wales law', /governed by the laws of New South Wales/],
  ['NSW courts', /courts of New South Wales/], ['final answer only', /Marking is of the final answer only/], ['not affiliated with or endorsed by NESA, not an official HSC resource', /Prithagoras is not affiliated with or endorsed by NESA[\s\S]{0,200}not an official HSC resource/],
  ['no prediction of an HSC mark, band or ATAR', /not a prediction of an HSC mark, band or ATAR/], ['the Premium price in AUD', /A\$9\.99 a month or A\$99 a year/], ['Stripe as the processor', /Stripe, our payment processor/], ['cancelling at the end of the paid period', /You can cancel in the app,\s+and Premium then stays on until the end of the period/], ['no whole-syllabus claim', /does not cover the whole of any syllabus/]
]) ok(re.test(terms), `the terms have ${label}`);
ok(!/exclusive jurisdiction/.test(terms.replace(/non-exclusive/g, '')), 'the terms do not impose an exclusive jurisdiction on a consumer');
for (const [label, re] of [
  ['the ACL guarantees and remedies', /Australian\s+Consumer Law[\s\S]*major failure[\s\S]*refund/], ['AUD', /Australian dollars \(AUD\)/], ['GST included where it applies', /Where GST applies to a\s+purchase, the price you see includes it/],
  ['an explicit non-statement about GST registration', /not a statement that we\s+are registered for GST/], ['Stripe named as the processor', /Payments are taken by Stripe, our payment processor/], ['the prices', /A\$9\.99 a month\*\* or \*\*A\$99 a year/], ['no card number received or stored', /never receive or store a\s+card number/], ['cancelling at the end of the paid period', /Premium then stays on\s+until the end of the period you have already paid for/], ['a full refund ending Premium at once', /refunded in full, Premium for that period ends at once/], ['NSW Fair Trading', /NSW Fair Trading/]
]) ok(re.test(refund), `the refund policy has ${label}`);
ok(!/no refund|non-refundable|all sales (?:are )?final|refunds? (?:are )?not (?:given|available|offered)/i.test(refund + terms), 'no "no refunds" wording anywhere');
ok(!/registered for GST(?! and)/.test(refund.replace(/not a statement that we\s+are registered for GST/, '')) && !/\bABN\b/.test(all), 'no claim to be registered for GST, no ABN');
ok(/Office of the Australian\s+Information Commissioner/.test(contact) && /NSW Fair Trading/.test(contact) && /48 hours/.test(contact) && /30 days/.test(contact), 'the contact page says who to write to, what happens, and where to escalate (OAIC, NSW Fair Trading)');
ok(!/grievance/i.test(all), 'no notice uses the word grievance: Prithagoras has a contact page, not a Grievance Officer');

// ── 4 · True of the code ────────────────────────────────────────────────────
const edition = await import(pathToFileURL(join(ROOT, 'client/edition.config.mjs')).href);
const prithagoras = edition.EDITIONS.prithagoras;
ok(JSON.stringify(prithagoras.billing.providers) === '["stripe"]' && prithagoras.billing.currency === 'AUD', 'Prithagoras sells through Stripe and only Stripe, in AUD (edition.config.mjs), so the notices name Stripe and "Australian dollars"');
const stripeCode = read('server/platform/stripe.js');
ok(/cancel_at_period_end: true/.test(stripeCode) && /at the cycle end by the student's choice/.test(stripeCode), 'cancelling asks Stripe to stop at the period end, so Premium stays until then (stripe.js)');
ok(/immediately for account erasure/.test(stripeCode), 'deleting the account cancels a subscription at once (stripe.js)');
ok(/FULL refund of the CURRENT period/.test(stripeCode), 'a full refund of the current period ends Premium at once (stripe.js)');
ok(/^const CHECKOUT_HOST = 'checkout\.stripe\.com';$/m.test(stripeCode) && /customer_email: account\.email/.test(stripeCode), 'payment is taken on Stripe\'s hosted page and the account email is the only identifier sent (stripe.js)');
ok(!/card_number|cardNumber|pan\b/i.test(stripeCode), 'no card number is handled in the Stripe code');
ok(/stays on\s+until the end of the period/.test(terms) && /A\$9\.99 a month or A\$99 a year/.test(terms) && /Stripe, our payment processor/.test(terms), 'the terms state the price, the processor and the cancellation rule');
ok(/never receive or store a card number/.test(privacy) && /\*\*Stripe\*\* is our payment processor/.test(privacy) && /Four things are kept after deletion/.test(privacy), 'the privacy notice names Stripe, says no card number is held, and lists the payment record kept after deletion');
ok(/ON DELETE SET NULL/.test(read('server/platform/billingSchema.js')), 'a payment record outlives the account without its link (billingSchema.js)');
ok(!/not on sale/.test(all), 'no notice still says Premium is not on sale');
const marking = read('server/platform/editionMarking.js');
ok(/UNCERTIFIED_EDITIONS = Object\.freeze\(\[[^\]]*'prithagoras'/.test(marking), 'Prithagoras marks the final answer only: its method marks cannot be switched on (editionMarking.js)');
ok(/FINAL_ANSWER_MARKING/.test(read('server/platform/editionBanks.js')) && /marking: FINAL_ANSWER_MARKING/.test(read('server/platform/editionBanks.js')), 'and its questions are sealed final-answer-only (editionBanks.js)');
const practice = read('server/platform/practice.js'), exams = read('server/platform/exams.js'), telemetry = read('server/platform/telemetry.js');
ok(/MAX_AGE = 90 \* 24 \* 60 \* 60 \* 1000/.test(practice) && /\b90 days\b/.test(privacy), 'answer records are kept 90 days (practice.js)');
ok(/RECORD_TTL = 5 \* 365 \* 24 \* 60 \* 60 \* 1000/.test(exams) && /up to\s+five years/.test(privacy), 'exam records are kept up to five years (exams.js)');
ok(/RETENTION_MS = 90 \* 24 \* 60 \* 60 \* 1000/.test(telemetry) && /Telemetry[\s\S]{0,120}90 days/.test(privacy), 'telemetry is kept 90 days (telemetry.js)');
const erasure = read('server/platform/childErasure.js');
ok(/UNCONSENTED_CHILD_RETENTION_MS = 30 \* DAY_MS/.test(erasure) && /ERASURE_GRACE_MS = 7 \* DAY_MS/.test(erasure) && /30 days after it was\s+created/.test(privacy) && /erased 7 days\s+later/.test(privacy), 'an unconfirmed child account closes at 30 days and is erased 7 days later (childErasure.js)');
const otp = read('server/platform/otpCore.js');
ok(/OTP_TTL_MS = 10 \* 60 \* 1000/.test(otp) && /OTP_MAX_ATTEMPTS = 5/.test(otp) && /ten minutes and five attempts/.test(privacy), 'one-time codes expire after ten minutes and five attempts (otpCore.js)');
ok(/bcrypt/i.test(read('server/platform/security.js') + read('server/platform/accounts.js')) && /bcrypt hashes/.test(privacy), 'passwords are bcrypt hashes');
ok(/PRI_AUTH_EMAIL_PROVIDER=resend/.test(read('.env.production.example')) && /Resend/.test(privacy), 'email goes through Resend (.env.production.example)');
ok(/OpenAI/.test(read('client/src/i18n/strings.en.js').match(/'readerPermission\.leadInk':[^\n]*/)?.[0] || '') && /naming OpenAI/.test(privacy), 'the one-time permission prompt names OpenAI, as the notice says');
ok(/export const READER_PERMISSION_VERSION\s*=/.test(read('client/src/ink/readerPermission.js')), 'and its versioned record exists (readerPermission.js)');
ok(/export const AU_GUARDIAN_AGE = 15;/.test(read('server/platform/guardianConsent.js')) && /return !\(Number\.isInteger\(years\) && years >= AU_GUARDIAN_AGE && years <= 120\)/.test(read('server/platform/guardianConsent.js')) && /under 15 needs a\s+parent or guardian/.test(privacy) && !/under 18/.test(privacy), 'in Australia an account is a child\'s (needs a guardian) only when the stated age is under 15 or missing, and the notice says 15, not 18 (guardianConsent.js AU_GUARDIAN_AGE)');
ok(/'\/account\/delete-request'/.test(read('client/src/main.jsx')) && existsSync(join(ROOT, 'client/src/pages/AccountDeleteRequest.jsx')), 'the delete-request page the notice links to exists (main.jsx, AccountDeleteRequest.jsx)');
ok(/48 hours/.test(contact) && /48 hours/.test(privacy), 'the 48-hour acknowledgement is stated the same way on both pages');

// ── 5 · Placeholders, and the review switch ─────────────────────────────────
// The three formerly-declared placeholders were filled 2026-11-18 (owner-supplied, verified from the live infrastructure).
const DECLARED = new Set();
const found = new Set((all.match(/\{\{[A-Z_]+\}\}/g) || []).map(p => p.slice(2, -2)));
for (const name of found) ok(DECLARED.has(name), `placeholder {{${name}}} is one of the declared four`);
ok(found.size === 0, 'no placeholder is left in the Australian notices');
ok(/Railway[^.]*Singapore/.test(privacy) && /Neon[^.]*Sydney/.test(privacy) && /prilearning19@gmail\.com/.test(privacy + contact), 'the Australian notice states its hosting (Railway, Singapore), its database (Neon, Sydney) and the contact email');
const statusPath = join(ROOT, 'docs/legal/au/review-status.json');
ok(existsSync(statusPath), 'docs/legal/au/review-status.json exists');
const status = JSON.parse(readFileSync(statusPath, 'utf8'));
const indiaStatus = JSON.parse(read('docs/legal/review-status.json'));
ok(typeof status.reviewed === 'boolean', 'the Australian switch is a boolean');
if (status.reviewed !== true) {
  for (const key of ['reviewer', 'qualification', 'reviewedOn', 'evidence']) ok(status[key] == null, `while unreviewed the Australian record leaves ${key} empty rather than half-filled`);
  ok(Array.isArray(status.languages) && status.languages.length === 0, 'and no language is recorded as reviewed');
} else {
  for (const key of ['reviewer', 'qualification', 'reviewedOn', 'evidence']) ok(typeof status[key] === 'string' && status[key].trim().length > 0, `a reviewed Australian record names its ${key}`);
  ok(Array.isArray(status.languages) && status.languages.includes('en'), 'a reviewed Australian record says English was reviewed');
  ok(/qualified in Australian law|solicitor|barrister|legal practitioner|lawyer/i.test(String(status.qualification || '')), 'and the qualification is a legal one');
  const dates = AU.map(d => /Last updated: (\d{1,2} \w+ \d{4})/.exec(d.text)?.[1]).map(x => Date.parse(`${x} UTC`));
  ok(dates.every(Number.isFinite) && Date.parse(`${status.reviewedOn}T00:00:00Z`) >= Math.max(...dates), 'and the review is on or after the last update of every Australian notice');
  ok(placeholdersLeft(all) === 0, 'and no placeholder is left in a notice a lawyer is said to have reviewed');
}
function placeholdersLeft(text) { return (text.match(/\{\{[A-Z_]+\}\}/g) || []).length; }
ok(/qualified in Australian law/.test(en.match(/'legal\.unreviewedBodyAu': '[^']*'/)?.[0] || ''), 'the banner while unreviewed says no lawyer qualified in Australian law has reviewed it');
ok(statusPath !== join(ROOT, 'docs/legal/review-status.json'), 'the two records are separate files');
ok(JSON.stringify(Object.keys(status).filter(k => k !== 'ownerSignoff').sort()) === JSON.stringify(Object.keys(indiaStatus).sort()), 'the Australian record has the fields of the Indian one, plus the owner sign-off only');
{
  const o = status.ownerSignoff;
  ok(o && typeof o === 'object', 'the record has an owner sign-off block');
  const filled = o && [o.reviewer, o.qualification, o.signedOn, o.evidence].some(v => v != null);
  if (filled) {
    ok(typeof o.reviewer === 'string' && o.reviewer.trim() && typeof o.signedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.signedOn), 'a filled owner sign-off names who and when');
    ok(o.qualification === 'business owner, not a lawyer', 'and says plainly that the owner is not a lawyer');
  }
  ok(/\breview\.reviewed\b/.test(read('client/src/pages/Legal.jsx')) && !/ownerSignoff/.test(read('client/src/pages/Legal.jsx')), 'the banner reads only `reviewed`: an owner sign-off can never clear it');
  ok(existsSync(join(ROOT, 'docs/legal/au/SUMMARY-FOR-OWNER.md')), 'the plain-English owner summary exists');
}
ok(/Nothing in the code or in any agent's work may set this to true/.test(status.$comment) && status.unreviewedSince === '2026-11-18', 'and says no agent may set it');
ok(Array.from(AU.map(d => d.text)).every(t => /been\s+reviewed by a\s+lawyer; the app says so above/.test(t) || /has not yet been reviewed by one\.\s+The app says so above/.test(t)), 'every Australian notice says, in its own words, that no lawyer has reviewed it');

// ── 6 · The counsel sheet quotes the build it describes ─────────────────────
{
  const SHEET = 'docs/legal/counsel/AU-QUESTIONS-FOR-COUNSEL.md';
  ok(existsSync(join(ROOT, SHEET)), `${SHEET} exists`);
  const sheet = existsSync(join(ROOT, SHEET)) ? read(SHEET) : '';
  const squash = text => text.replace(/\s+/g, ' ').trim();
  let quotes = 0, places = 0;
  for (const m of sheet.matchAll(/\*\*Current text\*\* · `([^`]+)`\n\n((?:>.*\n?)+)/g)) {
    quotes++;
    const quoted = squash(m[2].split('\n').map(l => l.replace(/^>\s?/, '')).join(' '));
    ok(existsSync(join(ROOT, m[1])) && squash(read(m[1])).includes(quoted), `the sheet's quote from ${m[1]} is still in it: "${quoted.slice(0, 60)}…"`);
  }
  for (const m of sheet.matchAll(/\*\*Lives in\*\* · `([^`]+)` · `([^`]+)`/g)) {
    places++;
    ok(existsSync(join(ROOT, m[1])) && squash(read(m[1])).includes(squash(m[2])), `${m[1]} still contains \`${m[2]}\``);
  }
  ok(quotes >= 10 && places >= 6, `the sheet quotes ${quotes} passages and names ${places} places`);
  for (const topic of ['operator', 'overseas', 'children', 'code', 'rights', 'terms', 'refunds']) ok(new RegExp(`\\[${topic}\\]`).test(sheet), `the sheet has a section for [${topic}]`);
  ok(/reviewed: false/.test(sheet) && status.reviewed === false, 'the sheet states the review switch as it is');
  for (const what of ['Railway, Singapore', 'Neon (AWS), Sydney', 'prilearning19@gmail.com']) ok(sheet.includes(what), `the sheet records the filled fact: ${what}`);
  ok(/Neon \(AWS\), Sydney/.test(sheet) && /Stripe/.test(sheet), 'the sheet records the providers: the owner-supplied, live-verified facts and what the repository shows');
}

console.log(`${scanned ? scanned.trim() + ' ' : ''}placeholders left in the Australian notices: ${[...found].sort().join(', ') || 'none'}`);
console.log(failures.length
  ? `LEGAL PAGES (AU): FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 50).join('\n  · ')}`
  : `LEGAL PAGES (AU): PASS — ${pass} checks — the Prithagoras build serves Australian notices (APPs, OAIC, ACL, NSW law, AUD, final-answer-only marking, Premium sold via Stripe in AUD) and never the DPDP / Grievance Officer text; Priyabhata still serves its own; every stated number is read from the code; not reviewed by a lawyer.`);
process.exit(failures.length ? 1 : 0);
