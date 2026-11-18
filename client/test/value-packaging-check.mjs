// Pri Learning · value packaging on the device (docs/product/packaging-2026-11.md)
//
//   1 · paywall moments: an upgrade is offered only at a value moment, and
//       NEVER during sign-up consent, a guardian flow, an error, an account
//       restriction, a distress response or an exam in progress; never to
//       Premium; never where nothing is on sale;
//   2 · the surfaces of those forbidden moments never link to Premium;
//   3 · free never blocks core practice: the device gate's only refusals are
//       the packaged allowances, practice is uncapped under the approved packaging (owner decision
//       2026-11-18), and
//       no difficulty level is Premium-only;
//   4 · price strings come from the edition table and match the AU legal
//       documents, with an edition check (Priyabhata states no constant price);
//   5 · the pricing copy is truthful: differentiators only where the edition's
//       capability is live, no competitor, no statistic, no pressure;
//   6 · i18n: every new string in en and hi, en-AU overrides where facts differ;
//   7 · cancel is as easy as subscribe, and its reason is optional.
// Usage: node client/test/value-packaging-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const read = rel => readFileSync(join(root, rel), 'utf8');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const { AU_STRINGS } = await import('../src/i18n/strings.au.js');
const { upgradeOffer, forbiddenContexts, MOMENT_KEYS, MOMENT_ARRIVAL } = await import('../src/paywall/moments.js');
const { UPGRADE_MOMENTS, FORBIDDEN_UPGRADE_CONTEXTS, PACKAGINGS, PLAN_PROMISES } = await import('../src/engine/packaging.js');
const { PREMIUM_PRACTICE_CONTENT, CAPPED_PRACTICE_MODES } = await import('../src/engine/practiceAllowance.js');
const { ARRIVAL_KEYS, WHY_KEYS, SCHOOL_ROWS } = await import('../src/paywall/plans.js');
const { listPriceOf, formatListAmount } = await import('../src/paywall/pricing.js');
const { EDITIONS, EDITION_IDS, DIFFERENTIATORS, editionCommerce } = await import('../edition.config.mjs');
const { translateEnglish } = await import('../src/i18n/index.js');

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · moments ─────────────────────────────────────────────────────────────
const NEUTRAL = { route: '/practice', premium: false, onSale: true };
const FORBIDDING = {
  'sign-up-consent': [{ consentPending: true }, { signUp: true }, { route: '/signup' }, { route: '/consent/age' }, { route: '/onboarding' }],
  guardian: [{ guardianFlow: true }, { guardianConsentRequired: true }, { route: '/guardian' }, { route: '/parent-consent/abc' }],
  error: [{ error: true }, { error: new Error('x') }],
  'account-restricted': [{ restricted: true }, { accountRestricted: true }, { locked: true }],
  distress: [{ distress: true }, { wellbeing: true }],
  'exam-in-progress': [{ examInProgress: true }, { route: '/exams/abc123' }, { route: '/desk/attempt-1' }]
};
eq('every forbidden context is exercised', Object.keys(FORBIDDING).sort(), [...FORBIDDEN_UPGRADE_CONTEXTS].sort());
for (const moment of UPGRADE_MOMENTS) {
  eq(`${moment}: offered at a value moment in a neutral context`, upgradeOffer(moment, NEUTRAL), { show: true, reason: null });
  for (const [context, cases] of Object.entries(FORBIDDING)) {
    const refused = cases.every(extra => { const o = upgradeOffer(moment, { ...NEUTRAL, ...extra }); return o.show === false && o.reason === context; });
    ok(`${moment}: never offered during ${context}`, refused);
  }
  eq(`${moment}: never offered to Premium`, upgradeOffer(moment, { ...NEUTRAL, premium: true }).show, false);
  eq(`${moment}: never offered where nothing is on sale`, upgradeOffer(moment, { ...NEUTRAL, onSale: false }).show, false);
  ok(`${moment}: has its own line and arrival`, !!en[MOMENT_KEYS[moment]] && !!ARRIVAL_KEYS[MOMENT_ARRIVAL[moment]]);
}
eq('an unknown moment is never an offer (no upsell at random)', upgradeOffer('home-banner', NEUTRAL), { show: false, reason: 'not-a-value-moment' });
eq('the exam list is not a paper in progress', upgradeOffer('exams-cap', { ...NEUTRAL, route: '/exams' }).show, true);
eq('a finished paper\'s result is a value moment', upgradeOffer('paper-completed', { ...NEUTRAL, route: '/exams/abc123', examFinished: true }).show, true);
eq('the desk import screen is not an attempt', forbiddenContexts({ route: '/desk/import' }), []);
eq('several forbidden contexts are all named, in a stable order', forbiddenContexts({ error: true, distress: true, examInProgress: true }), ['error', 'distress', 'exam-in-progress']);

// ── 2 · forbidden surfaces never link to Premium ────────────────────────────
const PREMIUM_LINK = /PAYWALL_ROUTE|['"]\/premium['"]|UpgradeNote|useUpgradeOffer/;
const FORBIDDEN_SURFACES = [
  'src/components/SignUpFlow.jsx', 'src/components/AccountActivationGate.jsx', 'src/pages/GuardianConsent.jsx', 'src/pages/Login.jsx',
  'src/components/ErrorBoundary.jsx', 'src/pages/ExamRoom.jsx', 'src/desk/DeskPage.jsx', 'src/pages/Placement.jsx'
];
for (const f of FORBIDDEN_SURFACES) ok(`${f} never links to Premium`, !PREMIUM_LINK.test(read(f)));
{
  const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : []; });
  const linking = walk(join(root, 'src')).map(p => p.slice(root.length)).filter(p => PREMIUM_LINK.test(readFileSync(join(root, p), 'utf8')) && !p.startsWith('src/paywall/')).sort();
  eq('only value-moment surfaces link to Premium (add a new one here only with a moment)', linking, [
    'src/App.jsx', 'src/components/ErrorNotebook.jsx', 'src/components/FreeCapNotice.jsx', 'src/components/QuestionCard.jsx',
    'src/components/SectionTime.jsx', 'src/insights/Insights.jsx', 'src/pages/Ext1Papers.jsx', 'src/pages/Today.jsx'
  ]);
  // Ext1Papers.jsx: the moment is a student asking for a Premium-only practice paper (it states the paper is part of Premium, then links once).
}
{
  const qc = read('src/components/QuestionCard.jsx');
  ok('the marked-work offer appears only when the reading allowance is used, never in placement',
    /\{state\.res\.readerBlock\.kind === 'allowance' && <UpgradeNote moment="marked-work-allowance" context=\{\{ signUp: !!diagnostic \}\} \/>\}/.test(qc));
  ok('the finished-paper offer asks the moment rule first', /useUpgradeOffer\('paper-completed', \{ examFinished: true \}\)/.test(read('src/components/SectionTime.jsx')) && /if \(!offered \|\| !offer\?\.show\) return null;/.test(read('src/components/SectionTime.jsx')));
  ok('the cap notice asks the moment rule before showing See Premium', /useUpgradeOffer\(isExam \? 'exams-cap' : 'practice-cap'\)/.test(read('src/components/FreeCapNotice.jsx')) && /\{offerPremium && <PageLink/.test(read('src/components/FreeCapNotice.jsx')));
  const note = read('src/paywall/UpgradeNote.jsx');
  ok('the offer has no timer, countdown or modal', !/setTimeout|setInterval|countdown|role="dialog"|aria-modal/i.test(note));
  ok('the offer says what you get, the price where known, and cancel anytime', /MOMENT_KEYS\[moment\]/.test(note) && /upgrade\.price/.test(note) && /upgrade\.cancelAnytime/.test(note));
  ok('a store build never states the web list price in an offer', /const price = nativeBillingStore\(\) \? null : listPriceOf\(edition\(\)\.commerce\);/.test(note));
  ok('a profile the server has not let in (guardian pending or withdrawn, account held) is never offered Premium',
    /const admitted = !!user\?\.id && activated\?\.profileId === user\.id;/.test(note) && /guardianConsentRequired: !admitted, \.\.\.context/.test(note) && /activate, activated \}\),/.test(read('src/App.jsx')));
}

// ── 2b · the invite trial: web only, never at a forbidden moment, neutral words
{
  const REFERRAL_UI = /InviteFriend|claimPendingInvite|captureInvite/;
  for (const f of FORBIDDEN_SURFACES) ok(`${f} never shows or claims an invite`, !REFERRAL_UI.test(read(f)));
  const panel = read('src/components/CloudAccountPanel.jsx');
  ok('the invite section is in the account panel only, for an admitted account on the web', /\{canSync && !nativeShell && <InviteFriend \/>\}/.test(panel));
  const ref = read('src/platform/referral.js');
  ok('a store app neither captures nor claims an invite', /if \(!loc \|\| !web\(\)\) return null;/.test(ref) && /if \(!web\(\) \|\| !cloudAvailable\(\)\) return null;/.test(ref));
  ok('the invite is claimed only after this profile is admitted', /if \(!user\?\.id \|\| activated\?\.profileId !== user\.id\) return;\s*claimPendingInvite\(\)/.test(read('src/App.jsx')));
  ok('the app never asks for a friend\'s contact details', !/type="email"|type="tel"|friendEmail|friendPhone|navigator\.contacts/i.test(read('src/components/InviteFriend.jsx').replace(/^\s*\/\/.*$/gm, '')));
  const words = Object.entries(en).filter(([k]) => /^(invite|trial)\./.test(k)).map(([, v]) => String(v)).join('\n');
  ok('the invite words are neutral: no pressure, waiting friends, counts, streaks or leaderboards', !/waiting|hurry|don.t miss|last chance|streak|leaderboard|rank|friends? (have|are)|\d+ friends|limited/i.test(words));
  ok('the reminders say it ends by itself and nothing is charged', /Nothing is charged/.test(en['trial.endsSoon']) && /Nothing was charged/.test(en['trial.ended']) && /automatically/.test(en['trial.endsSoon']));
  ok('the store apps show no trial reminder either (web only)', /const key = priNative\.isNativeShell\(\) \? null : trialNoticeKey\(trial\);/.test(read('src/components/TrialNotice.jsx')));
  ok('the share text speaks only for the friend, never promising the sharer anything', !/we both|us both|both get/i.test(en['invite.shareText']));
  ok('the reminder links to no purchase', !/PAYWALL_ROUTE|PageLink|\/premium/.test(read('src/components/TrialNotice.jsx')));
  ok('every invite and trial string has Hindi', Object.keys(en).filter(k => /^(invite|trial)\./.test(k)).every(k => typeof hi[k] === 'string' && hi[k] !== en[k]));
}

// ── 3 · free never blocks core practice ─────────────────────────────────────
{
  const backend = read('src/local/backend.js') + read('src/local/indiaExamBackend.js');
  const calls = (backend.match(/await (assertPracticeAllowed|assertExamAllowed|requireCapability)\(/g) || []).length;
  eq('the device gate is consulted at exactly its four packaged points (practice issue, JEE Advanced, exam ×2… and India JEE Advanced)', calls, 5);
  ok('notes, the error log and reviews never consult the gate', !/assertPracticeAllowed|requireCapability/.test(read('src/pages/Notes.jsx') + read('src/pages/ErrorLog.jsx')));
  ok('no Premium content rule is about difficulty: every level is free', PREMIUM_PRACTICE_CONTENT.every(rule => !('difficulty' in rule)) && PLAN_PROMISES.difficulties === 'all');
  ok('the gate holds no difficulty check (it reads no question\'s difficulty)', !/\.difficulty\b|\bdifficulty\s*(?:[<>]=?|===?)/.test(read('src/local/entitlementGate.js')));
  eq('games and the placement check are never counted', CAPPED_PRACTICE_MODES, ['practice', 'review', 'task']);
  eq('under the value packaging (approved 2026-11-18) free practice is not capped at all', PACKAGINGS['value-2026-11'].free.practicePerDay, null);
}

// ── 4 · prices ──────────────────────────────────────────────────────────────
{
  const au = editionCommerce('prithagoras');
  const india = editionCommerce('priyabhata');
  eq('Prithagoras: A$9.99 a month and A$99 a year, in AUD', [au.listPrice, au.currency], [{ monthly: 9.99, annual: 99 }, 'AUD']);
  eq('Priyabhata states no constant price: the store or the server says it', india.listPrice, null);
  const shown = listPriceOf(au, 'en-AU');
  eq('the AU price formats with its cents', [shown.monthly, shown.annual], ['$9.99', '$99']);
  eq('the price line names the currency', translateEnglish('pricing.priceLine', shown), '$9.99 a month or $99 a year (AUD)');
  eq('an amount without a currency, or a nonsense amount, is never said', [formatListAmount(9.99, null), formatListAmount(-1, 'AUD'), listPriceOf(india)], [null, null, null]);
  const legal = ['docs/legal/au/refund-policy.md', 'docs/legal/au/terms.md'].map(p => readFileSync(join(root, '..', p), 'utf8')).join('\n');
  ok('the AU legal documents state the same two prices', legal.includes(`A$${au.listPrice.monthly} a month`) && legal.includes(`A$${au.listPrice.annual} a year`));
  ok('no price is written into the pricing screen or its copy', !/\$\s?\d|₹\s?\d|\b9\.99\b|\b99\b/.test(read('src/paywall/Paywall.jsx') + read('src/paywall/UpgradeNote.jsx'))
    && !Object.entries(en).some(([k, v]) => /^(pricing|upgrade)\./.test(k) && /\$\s?\d|₹\s?\d/.test(String(v))));
  for (const id of EDITION_IDS) {
    const e = EDITIONS[id];
    ok(`${e.brand}: a list price only where the edition sells`, !e.commerce.listPrice || e.billing.providers.length > 0);
  }
}

// ── 5 · truthful copy ───────────────────────────────────────────────────────
{
  for (const id of EDITION_IDS) {
    const live = editionCommerce(id).differentiators;
    ok(`${EDITIONS[id].brand}: every claimed differentiator rests on a live capability`,
      live.every(d => !DIFFERENTIATORS[d].requires || EDITIONS[id].capabilities[DIFFERENTIATORS[d].requires] === true));
    eq(`${EDITIONS[id].brand}: every differentiator has its copy`, WHY_KEYS(live).length, live.length);
  }
  eq('Prithagoras claims only what is live today (step feedback, NSW notes and exam papers are still pending there)', editionCommerce('prithagoras').differentiators, ['youConfirm']);
  ok('every differentiator rests on a named capability: none is shown unconditionally', Object.values(DIFFERENTIATORS).every(d => typeof d.requires === 'string' && d.requires.length > 0));
  const copy = [...Object.entries(en), ...Object.entries(AU_STRINGS)].filter(([k]) => /^(pricing|upgrade)\.|^paywall\.(free\.(questionsUncapped|allLevels)|from\.(priorities|papers))$/.test(k)).map(([, v]) => String(v)).join('\n');
  ok('no competitor is named', !/leibniz|cluey|atomi|khan|byju|unacademy|vedantu/i.test(copy));
  ok('no statistic or comparison is invented', !/%|\b\d+x\b|times (better|faster)|students (improve|scored)|better than|more than any/i.test(copy));
  ok('no pressure, scarcity or guilt', !/\b(hurry|only today|limited time|last chance|don.t miss|spots? left|ends soon|expires|guarantee|best|complete|certified|accurate)\b/i.test(copy), (copy.match(/\b(hurry|limited time|last chance|guarantee|best|complete|certified|accurate)\b/i) || [])[0]);
  ok('the School column says it is not available yet, rather than promising it', /not available yet/i.test(en['pricing.school.status']) && SCHOOL_ROWS.some(r => r.key === 'pricing.school.status'));
  ok('the price line is shown only where Premium is on sale on the web', /\{webPrice && !apple && !google && sellsPremium\(saleAvailable\) && \(/.test(read('src/paywall/Paywall.jsx')));
  ok('"cancel anytime" is on the pricing screen', /data-pricing-cancel>\{t\('pricing\.cancelAnytime'\)\}/.test(read('src/paywall/Paywall.jsx')));
}

// ── 6 · i18n ────────────────────────────────────────────────────────────────
{
  const added = Object.keys(en).filter(k => /^(pricing|upgrade)\.|^paywall\.(free\.(questionsUncapped|allLevels)|from\.(priorities|papers))$|^cloud\.cancelReason|^settings\.localPlanSubUncapped$/.test(k));
  ok('the new strings exist', added.length >= 35, String(added.length));
  ok('every new string has Hindi', added.every(k => typeof hi[k] === 'string' && hi[k].length > 0), added.filter(k => !hi[k]).join(', '));
  ok('Hindi keeps every placeholder', added.every(k => (String(en[k]).match(/\{\w+\}/g) || []).sort().join() === (String(hi[k]).match(/\{\w+\}/g) || []).sort().join()));
  ok('en-AU says the NSW syllabus, not NCERT', /NSW/.test(AU_STRINGS['pricing.why.syllabus']) && !/NCERT|JEE/.test(AU_STRINGS['pricing.why.syllabus']));
  ok('en-AU names no JEE in an offer', !/JEE/.test(AU_STRINGS['upgrade.jeeAdvanced']));
}

// ── 7 · cancel is as easy as subscribe ──────────────────────────────────────
{
  const panel = read('src/components/CloudAccountPanel.jsx');
  ok('the cancel button sits beside the subscribe buttons in the same account panel', panel.indexOf('startWebCheckout(\'monthly\')') > 0 && panel.indexOf('onClick={cancelWebSubscription}') > panel.indexOf('startWebCheckout(\'monthly\')') && panel.indexOf('onClick={cancelWebSubscription}') - panel.indexOf('startWebCheckout(\'monthly\')') < 1500);
  ok('the reason is asked only after the cancellation succeeded, and never awaited', /setMessage\(tLater\('cloud\.cancelled'\)\);\s*setCancelFeedback\('ask'\);/.test(panel) && /setCancelFeedback\('thanks'\); cloud\.cancelFeedback\(reason\)\.catch\(\(\) => \{\}\);/.test(panel));
  ok('the reasons are the server\'s closed set', /const CANCEL_REASONS = Object\.freeze\(\['price', 'notUsing', 'examDone', 'missing', 'other'\]\);/.test(panel));
}

console.log(`Value packaging — ${pass}/${pass + failures.length} checks`);
if (failures.length) { console.log('\nfailures:'); for (const f of failures) console.log(`  ${f}`); }
console.log(`\nVALUE PACKAGING: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
process.exit(failures.length ? 1 : 0);
