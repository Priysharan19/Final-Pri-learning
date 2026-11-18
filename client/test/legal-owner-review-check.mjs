// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the legal pages of 18 November 2026 say only what the code does
//
// The owner reads and approves these pages; no lawyer has. So each promise a page
// makes about stored handwriting, teachers, the invite trial, the plans, AI help,
// distress messages and product measurement is held here to the file that keeps
// it, and every number a page states is READ FROM THE CODE (packaging.js, the
// referral and original-work constants), so a later change to the code fails this
// suite until the page is rewritten. It also holds the edition wall: nothing
// Indian in the Australian pages and nothing Australian in the Indian ones, and the
// "not reviewed by a lawyer" switches untouched.
//
// STATIC: reads files. It is not legal advice and not a lawyer's review.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');
let pass = 0;
const failures = [];
const ok = (cond, text) => { if (cond) pass++; else failures.push(text); };

const IN = { privacy: flat(read('docs/legal/privacy.md')), terms: flat(read('docs/legal/terms.md')), privacyHi: flat(read('docs/legal/privacy.hi.md')), termsHi: flat(read('docs/legal/terms.hi.md')) };
const AU = { privacy: flat(read('docs/legal/au/privacy.md')), terms: flat(read('docs/legal/au/terms.md')), refund: flat(read('docs/legal/au/refund-policy.md')) };
const both = (re, what) => { ok(re.test(IN.privacy), `India privacy: ${what}`); ok(re.test(AU.privacy), `Australia privacy: ${what}`); };

const { PACKAGING, ACTIVE_PACKAGING_ID, PLAN_PROMISES } = await import(pathToFileURL(join(ROOT, 'client/src/engine/packaging.js')).href);
const { PRACTICE_DAY_TIME_ZONES } = await import(pathToFileURL(join(ROOT, 'client/src/engine/practiceAllowance.js')).href);

// ── 1 · Stored handwriting (attempt_originals) ──────────────────────────────
const original = read('server/platform/originalWork.js');
const housekeeping = read('server/platform/housekeeping.js');
const accounts = read('server/platform/accounts.js');
const migration = read('supabase/migrations/20261118010000_attempt_originals.sql');
ok(/ORIGINAL_RETENTION_MS = Object\.freeze\(\{ priyabhata: 730 \* DAY, prithagoras: 730 \* DAY \}\)/.test(original), 'retention is 730 days in both editions (originalWork.js)');
both(/2 years \(730 days\)/, 'states the 730-day retention');
ok(/DELETE FROM attempt_originals WHERE expires_at < \?/.test(housekeeping), 'expired originals are deleted by housekeeping (housekeeping.js)');
ok(/expires_at bigint not null/.test(migration) && /now \+ retention/.test(original), 'every original is stamped with its expiry when kept (originalWork.js, migration 19)');
ok(/account_id text not null references pri\.accounts\(id\) on delete cascade/.test(migration), 'an original is deleted with its account (migration 19 cascade)');
both(/deleted with your account\*\*, and \*\*included when you export your (?:data|information)/, 'says deleted with the account and in the export');
ok(/SELECT \* FROM attempt_originals WHERE account_id=\? ORDER BY created_at, id/.test(accounts), 'the account export carries the originals (accounts.js)');
ok(/strokesBytes: 40 \* 1024 \* 1024, imageBytes: 24 \* 1024 \* 1024/.test(original), 'the per-account limits are 40 MB of handwriting and 24 MB of photos (originalWork.js)');
both(/up to 40 MB of handwriting and 24 MB of photos/, 'states those limits');
ok(/reason: 'quota'/.test(original) && /Over quota: nothing is written/.test(original), 'past the limit the answer is still marked and the original is not kept on the server (originalWork.js)');
ok(/const MarkedOriginal = null;/.test(read('client/src/classroom/ReviewQueue.jsx')) && !/OriginalWork/.test(read('client/src/components/QuestionCard.jsx').replace(/import[^\n]*OriginalWork[^\n]*\n/g, '')), 'no screen shows an original yet, so the pages say so; when one ships, update the pages (ReviewQueue.jsx MarkedOriginal, QuestionCard.jsx)');
both(/The app has\s+no screen that shows it yet/, 'says there is no screen showing an original yet');
both(/the\s+teacher's screen does not show it yet/, 'and that the teacher\'s screen does not show it yet');
ok(!/You can always see it|and the app tells you so/.test(IN.privacy + AU.privacy), 'the pages no longer promise a screen or a notice that does not exist');
ok(/requireRole\('student'\)/.test(original) && /requireRole\('teacher'\)/.test(original) && !/guardian/i.test(original.replace(/consentBlockerCode|consentState|guardian has not given|guardianConsent/gi, '')), 'only the student and, below, a teacher have a route to an original; no guardian route (originalWork.js)');
ok(/const handedIn = items\.some/.test(original) && /member\.joined_at/.test(original) && /'handed-in-handwriting'/.test(read('server/platform/classroom.js')), 'a teacher is served an original only when it belongs to handed-in work of a class they teach (originalWork.js, classroom.js)');
ok(!/attempt_originals/.test(read('server/platform/admin.js')) && !/attempt_originals/.test(read('server/platform/parentReport.js')), 'no administrator screen and no parent report reads originals');
ok(/keepOriginal\(db, \{ accountId, edition, questionId: qid/.test(read('server/platform/practice.js')) && !/keepOriginal/.test(read('server/platform/questionPhoto.js')) && !/keepOriginal/.test(read('server/platform/exams.js')), 'originals are kept for marked practice answers, not for "Practise this" photos or exams (practice.js)');
ok(/Reading stays ANSWER-BLIND/.test(original), 'reading is answer-blind (originalWork.js)');
both(/Reading is answer-blind and you confirm it/, 'says reading is answer-blind and the student confirms it');
both(/Settings\s*→\s*Reading my handwriting/, 'names the Settings section that turns automatic reading off');
both(/about 1\.6 seconds/, 'states the pause before an automatic read');
ok(/AUTO_READ_IDLE_MS\s*=\s*1600/.test(read('client/src/ink/InkAnswer.jsx') + read('client/src/lib/autoRead.js') + read('client/src/components/QuestionCard.jsx')), 'the pause is 1600 ms in the client');
ok(/getItem\(KEY\) !== 'off'/.test(read('client/src/lib/autoRead.js')) && /'autoRead\.title': "Reading my handwriting"/.test(read('client/src/i18n/strings.en.js')) && /<AutoRead \/>/.test(read('client/src/pages/Settings.jsx')), 'automatic reading is on by default and Settings has the section that turns it off');

// ── 2 · The in-app prompt and Settings say the same as the pages ─────────────
const en = read('client/src/i18n/strings.en.js'), hi = read('client/src/i18n/strings.hi.js');
for (const key of ['readerPermission.keep', 'settings.cloudHandwritingCopy', 'settings.handwritingNative', 'settings.handwritingBrowser']) {
  const line = en.match(new RegExp(`'${key.replace('.', '\\.')}': '([^\\n]*)'`))?.[1] || '';
  ok(/2 years/.test(line) && !/keeps no copy|does not keep the picture\. OpenAI|ink itself stays on this device/.test(line), `the app's own ${key} no longer says nothing is kept, and names the 2 years`);
  const hiLine = hi.match(new RegExp(`'${key.replace('.', '\\.')}': '([^\\n]*)'`))?.[1] || '';
  ok(/2 वर्ष/.test(hiLine), `and so does its Hindi (${key})`);
}
ok(/READER_PERMISSION_VERSION = 2;/.test(read('client/src/ink/readerPermission.js')), 'the reader prompt\'s wording changed, so its version moved and every student is asked again (readerPermission.js)');

// ── 3 · The teacher workspace ───────────────────────────────────────────────
const classroom = read('server/platform/classroom.js');
const visibility = classroom.match(/TEACHER_VISIBILITY = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1] || '';
for (const item of ['name', 'membership', 'evidence-states', 'common-mistakes', 'handed-in-papers', 'handed-in-handwriting', 'teacher-marks']) ok(new RegExp(`'${item}'`).test(visibility.split('never:')[0]), `a teacher can see: ${item}`);
for (const item of ['email', 'guardian', 'plan', 'notes', 'tutor-and-ai-chats', 'practice-working', 'photos-and-practice-handwriting', 'papers-not-handed-in', 'other-classes']) ok(new RegExp(`'${item}'`).test(visibility.split('never:')[1] || ''), `a teacher cannot see: ${item}`);
both(/A teacher can see:\*\* your name \(never your email address\)/, 'lists what a teacher can see, starting with name and never the email');
both(/A teacher cannot see:\*\* your email address, your guardian's details, your plan, your notes, your conversations with the AI tutor, your practice working, your photos or your practice handwriting, papers you have not handed in, or anything from other classes/, 'lists what a teacher cannot see, item for item');
ok(/GET \/v1\/classroom\/visibility/.test(classroom) && /router\.get\('\/visibility'/.test(classroom) && /visibility: TEACHER_VISIBILITY/.test(classroom), 'students are served the same list (classroom.js /visibility and /mine)');
both(/The app shows students what their teacher can see/, 'says students can see the list');
const marks = read('supabase/migrations/20261118000000_teacher_workspace.sql');
ok(/teacher_account_id/.test(marks) && /created_at/.test(marks) && /engine_awarded/.test(marks) && /supersedes/.test(marks), 'a teacher mark records who, when, the criterion, marks and the engine\'s mark (migration 18)');
ok(/pri_server holds INSERT and SELECT only|grant select, insert on pri\.teacher_marks to pri_server/i.test(marks), 'teacher marks are append-only (migration 18)');
ok(/AI never suggests a teacher mark|nothing here calls a model/.test(classroom), 'no model suggests a teacher mark (classroom.js)');
both(/recorded with which teacher made it and when/, 'says a teacher mark is recorded with who and when');
ok(/consentBlockerCode\(await consentState/.test(classroom) && /removed_at IS NULL/.test(read('server/platform/originalWork.js')), 'a student who leaves, is removed or loses guardian consent disappears from the teacher at once (classroom.js, originalWork.js)');

// ── 4 · The invite-a-friend trial ───────────────────────────────────────────
const referral = read('server/platform/referral.js');
ok(/trialDays: 7/.test(referral) && /newAccountDays: 7/.test(referral) && /inviterCreditsPer30Days: 5/.test(referral), 'the trial is 7 days, for accounts under 7 days old, 5 friends in 30 days (referral.js)');
for (const [label, text] of [['India terms', IN.terms], ['Australia terms', AU.terms]]) {
  ok(/7 days of Premium free/.test(text) && /created in the last 7 days, or approved by a parent or guardian in the last 7 days/.test(text) && /at most 5 friends in any 30 days/.test(text), `${label}: the trial numbers match referral.js`);
  ok(/one invitation trial, ever/.test(text) && /goes back to the free plan by itself/.test(text) && /No cash value/.test(text) && /needs no card and no payment details/.test(text), `${label}: one per person, no card, no charge, ends by itself, no cash value`);
  ok(/offered on the website only/.test(text) && /We never ask you for a friend's email address or phone number/.test(text) && /only thing we keep is a record of who invited whom/.test(text), `${label}: web only; only who invited whom is kept`);
}
ok(/declaredNativeClient\(req\)\) return refuse\(res, 409, 'REFERRAL_WEB_ONLY'/.test(referral), 'a store app is refused the claim (referral.js)');
ok(/ON CONFLICT\(account_id\) DO NOTHING/.test(referral) && /product_id|productId: REFERRAL\.productId/.test(referral) && /currentPeriodEnd: now \+ REFERRAL\.trialDays \* DAY/.test(referral), 'one trial per account, a dated grant that ends by itself, nothing billed (referral.js)');
ok(!/friend.{0,20}email|invitee.{0,20}email/i.test(referral.replace(/mailbox|inviter\.email|invitee\.email|friend's email or phone|NO CONTACT COLLECTION[^\n]*\n[^\n]*\n/g, '')) && /'referral\.joined'/.test(referral), 'only the inviter and friend accounts are recorded; no friend contact detail is stored (referral.js)');
ok(/router\.use\('\/referral', requireGuardianConsent\(db\)/.test(read('server/platform/router.js')), 'a child awaiting guardian consent can neither share nor claim (router.js)');
ok(/\(it does for a student under 15\)/.test(AU.terms) && /If you are under 18 and your account needs a parent's or guardian's approval/.test(IN.terms), 'each edition names its own age for the guardian rule in the trial terms');

// ── 5 · The plans, with every number read from packaging.js ─────────────────
const p = PACKAGING;
ok(ACTIVE_PACKAGING_ID === 'value-2026-11', `the pages describe the ACTIVE packaging (${ACTIVE_PACKAGING_ID}); when the packaging changes this check fails and the pages must be rewritten (packaging.js)`);
const practiceSentence = n => n === null ? 'practice questions with no daily limit' : `up to ${n} practice questions a day`;
for (const [label, terms] of [['India', IN.terms], ['Australia', AU.terms]]) {
  ok(terms.includes(practiceSentence(p.free.practicePerDay)), `${label} terms: free practice is ${p.free.practicePerDay === null ? 'uncapped' : p.free.practicePerDay + ' a day'}`);
  ok(terms.includes(`up to ${p.free.readsPerDay} handwriting reads and ${p.free.readsPerDay} "Practise this" photos a day`), `${label} terms: free reads and photos are ${p.free.readsPerDay} a day each`);
  ok(terms.includes(`one exam simulation every ${p.free.examWindowDays} days`) && p.free.examsPerWindow === 1, `${label} terms: one exam simulation every ${p.free.examWindowDays} days`);
  ok(terms.includes(`raises the daily reads to ${p.premium.readsPerDay} and ${p.premium.readsPerDay}`), `${label} terms: Premium reads are ${p.premium.readsPerDay} and ${p.premium.readsPerDay}`);
  ok(p.free.practicePerDay !== null || (/removes the exam limit/.test(terms) && !/practice (?:and exam )?limits/.test(terms)), `${label} terms: with practice uncapped, Premium removes only the exam limit`);
  ok(/every difficulty level with step-by-step checking/.test(terms) && PLAN_PROMISES.difficulties === 'all' && PLAN_PROMISES.stepChecked === 'every-plan', `${label} terms: every difficulty and step checking are free (packaging.js PLAN_PROMISES)`);
}
ok(PRACTICE_DAY_TIME_ZONES.priyabhata === 'Asia/Kolkata' && PRACTICE_DAY_TIME_ZONES.prithagoras === 'Australia/Sydney' && (p.free.practicePerDay === null ? !/calendar day/.test(IN.terms + AU.terms) : /Indian calendar day/.test(IN.terms) && /Sydney calendar day/.test(AU.terms)), 'practice is counted by each edition\'s own calendar day (practiceAllowance.js)');
ok(/AI_WINDOW_MS = 24 \* 60 \* 60 \* 1000/.test(read('server/platform/aiAllowance.js')) && /[Rr]eads are counted over any 24 hours/.test(IN.terms) && /[Rr]eads are counted over any 24 hours/.test(AU.terms), 'reads are counted over a rolling 24 hours (aiAllowance.js)');
const edition = read('client/edition.config.mjs');
ok(/listPrice: Object\.freeze\(\{ monthly: 9\.99, annual: 99 \}\)/.test(edition) && /A\$9\.99 a month or A\$99 a year/.test(AU.terms) && /A\$9\.99 a month\*\* or \*\*A\$99 a year/.test(AU.refund), 'the Australian prices are those of edition.config.mjs');
ok(/providers: Object\.freeze\(\['razorpay', 'apple', 'google'\]\)/.test(edition) && /listPrice: null/.test(edition) && /price, the billing period and what is included are shown by the store before you pay/.test(IN.terms), 'India shows the store\'s own INR price; no price is coded or stated');
const stripe = read('server/platform/stripe.js');
ok(/cancel_at_period_end: true/.test(stripe) && /FULL refund of the CURRENT period/.test(stripe) && /immediately for account erasure/.test(stripe), 'Stripe: cancel at period end, a full refund of the current period ends Premium at once, account deletion cancels at once (stripe.js)');

// ── 6 · AI help, labelling, distress, measurement ───────────────────────────
ok(/Written by AI · not checked by the maths engine/.test(en) && existsSync(join(ROOT, 'client/src/tutor/AiLabel.jsx')), 'AI explanations carry the AI label (strings.en.js, AiLabel.jsx)');
both(/labelled as written by AI and not checked by the maths engine/, 'says AI text is labelled');
const provider = read('server/platform/tutorProvider.js');
ok(/openai/i.test(provider) && /\/v1\/responses/.test(provider) && /TUTOR_CACHE_TTL_MS = 24 \* 60 \* 60 \* 1000/.test(read('server/platform/tutor.js')), 'the tutor calls OpenAI and caches a reply for 24 hours (tutorProvider.js, tutor.js)');
both(/up to 24 hours/, 'states the 24-hour cache');
const safety = read('server/platform/tutorSafety.js');
ok(/name: 'Tele-MANAS', number: '14416'/.test(safety) && /name: 'Kids Helpline', number: '1800 55 1800'/.test(safety), 'the support lines are Tele-MANAS 14416 and Kids Helpline 1800 55 1800 (tutorSafety.js)');
ok(/Tele-MANAS\s+on 14416/.test(read('docs/legal/privacy.md')) && /Kids\s+Helpline on 1800 55 1800/.test(read('docs/legal/au/privacy.md')), 'each notice names only its own region\'s line');
ok(/earlyDistress/.test(read('server/platform/tutor.js')) && /the model is not called/.test(safety), 'distress is met before any model call (tutor.js, tutorSafety.js)');
both(/No one is told that it happened, and the message is not stored/, 'says nobody is told and the message is not stored');
const funnel = read('server/platform/valueFunnel.js');
ok(/FUNNEL_K = 10/.test(funnel) && /router\.use\(requireMfa\(\)\)/.test(read('server/platform/admin.js')) && /no third\s*(?:\/\/\s*)?party/.test(funnel), 'the measurement counts hide cells under 10 and are admin plus second factor only (valueFunnel.js, admin.js)');
both(/hidden when fewer than 10 accounts are behind a number/, 'states the small-number rule');
const csp = read('server/platform/headers.js');
const clientDeps = Object.keys(JSON.parse(read('client/package.json')).dependencies || {}).join(' ');
ok(/"script-src 'self'"/.test(csp) && !/google-analytics|gtag|segment|mixpanel|amplitude|sentry|posthog|firebase|facebook|fbq|hotjar/i.test(clientDeps), 'no third-party script may load and no analytics package is a dependency (headers.js, client/package.json)');
both(/no third-party analytics, advertising or tracking code/, 'says there is no third-party tracking');
const defs = ['aa-assignment-v1', 'tutor-first-help-v1'].map(n => JSON.parse(read(`server/platform/experiments/${n}.json`)));
ok(defs.every(d => d.status === 'off') && /404 unless the deployment sets PRI_FEATURE_TUTOR_POLICY=1|DARK BY DEFAULT/.test(read('server/platform/helpPlan.js')), 'both experiments are off and the tutor policy is dark by default (experiments/*.json, helpPlan.js)');
both(/built, but not\s+switched on|built, but not switched on/, 'says the experiment is built but not switched on');

// ── 7 · Children: each edition keeps its own age and its own words ───────────
ok(/AU_GUARDIAN_AGE = 15/.test(read('server/platform/guardianConsent.js')) && /under 15 needs a parent or guardian to confirm the account/.test(AU.privacy) && !/under 18/.test(AU.privacy), 'Australia: guardian consent under 15 only');
ok(/Under the DPDP Act, a child is anyone under 18/.test(IN.privacy) && /Unless you say you are 18 or older, the account is treated as a child's/.test(IN.privacy), 'India: a child is under 18');
ok(/const AGES = \[11, 12, 13, 14, 15, 16, 17\]/.test(read('client/src/components/SignUpFlow.jsx')), 'sign-up asks an age from 11 to 17 or "18 or older" (SignUpFlow.jsx)');

// ── 8 · The wall, the NESA line, the switches ───────────────────────────────
ok(!/DPDP|Data Protection Board|Grievance|Tele-MANAS|Razorpay|Hindi/i.test(Object.values(AU).join(' ')), 'nothing Indian in the Australian pages');
ok(!/Kids Helpline|NESA|Privacy Act|OAIC|Stripe|Australian Consumer Law/.test(IN.privacy + IN.terms), 'nothing Australian in the Indian pages');
ok(/Prithagoras is not affiliated with or endorsed by NESA/.test(AU.terms) && /plain-language description beside each code is our own/.test(AU.terms) && /never NESA's wording/.test(read('client/src/progress/SyllabusBoard.jsx')), 'the NESA line is on the Australian terms and the board writes its own descriptions (SyllabusBoard.jsx)');
ok(/Resend/.test(AU.privacy) && /\*\*OpenAI\*\* is a company based in the United States/.test(AU.privacy) && /\*\*Stripe\*\* is our payment processor/.test(AU.privacy) && /APP 8/.test(AU.privacy), 'Australia: OpenAI, Stripe and Resend are named as overseas recipients (APP 8)');
for (const f of ['docs/legal/review-status.json', 'docs/legal/au/review-status.json']) {
  const s = JSON.parse(read(f));
  ok(s.reviewed === false && s.reviewer === null && s.reviewedOn === null, `${f} still says no lawyer has reviewed the pages`);
}
const legalPage = read('client/src/pages/Legal.jsx');
ok(/data-legal-unreviewed="true"/.test(legalPage) && /export const LEGAL_REVIEWED = review\.reviewed === true;/.test(legalPage), 'the "not reviewed by a lawyer" banner and its switch are as they were (Legal.jsx)');
for (const text of [IN.privacy, IN.terms, AU.privacy, AU.terms, AU.refund]) ok(!/complian(?:t|ce) with|fully compliant|lawyer[- ]approved|legally reviewed|certified/i.test(text.replace(/not claim to comply|do not claim to comply|nor does it claim|been reviewed by a lawyer|reviewed by a lawyer/gi, '')), 'no page claims compliance or legal review');

// ── 9 · The Hindi pages carry every new promise ─────────────────────────────
for (const [what, re] of [['2 years and 730 days', /2 वर्ष \(730 दिन\)/], ['40 and 24 MB', /40 एमबी[\s\S]*24 एमबी/], ['1.6 seconds', /1\.6 सेकंड/], ['Tele-MANAS 14416', /14416/], ['fewer than 10', /10 से कम/], ['teachers and classes section', /## शिक्षक और कक्षाएँ/], ['AI label', /एआई ने लिखा, गणित इंजन ने नहीं जाँचा/], ['24 hours', /24 घंटे/], ['four things kept', /चार चीज़ें/]]) ok(re.test(read('docs/legal/privacy.hi.md')), `Hindi privacy: ${what}`);
for (const [what, re] of [['practice uncapped', /अभ्यास-प्रश्न बिना\s+दैनिक सीमा के/], ['5 and 5', /5 पठन तक[\s\S]*5\s+फ़ोटो/], ['every 30 days', /हर 30\s+दिन में एक परीक्षा-अभ्यास/], ['50 and 50', /50 और 50/]]) ok(re.test(IN.termsHi), `Hindi terms: ${what}`);

console.log(failures.length
  ? `LEGAL OWNER REVIEW: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 60).join('\n  · ')}`
  : `LEGAL OWNER REVIEW: PASS — ${pass} checks — the stored-handwriting, teacher, invite-trial, plan, AI-help, distress and measurement promises in the India (English, Hindi) and Australia pages are each kept by the code; numbers read from the code; the review banner and switches untouched; no legal review or compliance claimed.`);
process.exit(failures.length ? 1 : 0);
