// Pri Learning · the Premium screen says only what is true (client/src/paywall/).
//   · D19 / D20: the comparison states the figures the server enforces, from
//     the same definitions (20 questions a day, one timed paper in 30 days,
//     5 / 25 reads and photos a day, JEE Advanced, unlimited on Premium);
//   · no price is written into the source or the copy: the billed amount is
//     the store's displayPrice (StoreKit or Google Play);
//   · the yearly per-month figure comes from the store's numeric price,
//     rounded up, labelled "about", and is omitted without one; a saving is
//     shown only when both real prices give it, rounded down;
//   · Restore, the auto-renewal disclosure for each store (App Store 3.1.2,
//     Google Play subscriptions policy), Terms, Privacy and Refunds links and
//     a close button are present; no countdown, urgency, trial or outcome
//     claim; web offers no checkout (out of V1).
// Usage: node client/test/paywall-honesty-check.mjs
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const { translateEnglish } = await import('../src/i18n/index.js');
const { planOffers, perMonthEquivalent, aboutPerMonth, yearlySavingPercent, formatAmount, numericPrice } = await import('../src/paywall/pricing.js');
const { FREE_ROWS, PREMIUM_ROWS, ARRIVAL_KEYS } = await import('../src/paywall/plans.js');
const { FREE_PRACTICE_ALLOWANCE, READ_ALLOWANCE } = await import('../src/engine/practiceAllowance.js');
const { FREE_EXAM_ALLOWANCE } = await import('../src/engine/examAllowance.js');
const { AI_ALLOWANCE_DEFAULTS } = await import('../../server/platform/aiAllowance.js');
const { PAYWALL_ROUTE } = await import('../src/paywall/route.js');

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const paywall = read('paywall/Paywall.jsx');
const pricing = read('paywall/pricing.js');
const plans = read('paywall/plans.js');
const keys = Object.keys(en).filter(k => k.startsWith('paywall.'));
const text = cat => keys.map(k => (typeof cat[k] === 'string' ? cat[k] : Object.values(cat[k]).join(' '))).join(' \n ');
const row = r => translateEnglish(r.key, r.vars);

// 1 · D19 / D20, from the definitions the server enforces
eq('D19: free practice is 20 questions a day', FREE_PRACTICE_ALLOWANCE.perDay, 20);
eq('D19: free papers are one every 30 days', [FREE_EXAM_ALLOWANCE.examsPerWindow, FREE_EXAM_ALLOWANCE.examWindowDays], [1, 30]);
eq('D20: reads are 5 free and 25 Premium a day', READ_ALLOWANCE, { free: 5, premium: 25 });
eq('D20: the server\'s read allowance defaults to the same definition, per kind', [AI_ALLOWANCE_DEFAULTS.handwriting, AI_ALLOWANCE_DEFAULTS['question-photo']].map(x => [x.free, x.premium]), [[5, 25], [5, 25]]);
eq('the free column says exactly the free plan', FREE_ROWS.map(row), [
  '20 practice questions a day', 'One timed paper every 30 days', '5 reads of your writing and 5 question photos a day', 'The error notebook and its reviews'
]);
eq('the Premium column says exactly what Premium adds', PREMIUM_ROWS.map(row), [
  'Unlimited practice questions', 'Unlimited timed papers', 'After each timed paper, where your time went, section by section',
  'The JEE Advanced track', '25 reads of your writing and 25 question photos a day',
  'An estimate of your mark from your own practice, with its range and how much of the paper it covers',
  'The slips you make most often, across chapters'
]);
ok('the plan rows hold no figure of their own: every number comes from a definition', !/\b(5|20|25|30)\b/.test(plans.replace(/\/\/.*$/gm, '')));
eq('the Premium screen has one address', PAYWALL_ROUTE, '/premium');

// 1b · the screen sells only what the SERVER enforces (paywall review, L6)
const { PREMIUM_CAPABILITIES } = await import('../../server/platform/entitlements.js');
const { CAPABILITY_ENFORCEMENT } = await import('../src/local/entitlementGate.js');
const srv = rel => readFileSync(new URL(`../../server/platform/${rel}`, import.meta.url), 'utf8');
for (const r of PREMIUM_ROWS) {
  ok(`${r.key} names a Premium capability the server grants`, PREMIUM_CAPABILITIES.includes(r.capability), r.capability);
  ok(`${r.key} is sold on a server enforcement point, not the device's word`, /^server · /.test(CAPABILITY_ENFORCEMENT[r.capability] || ''), CAPABILITY_ENFORCEMENT[r.capability]);
}
ok('a capability enforced nowhere is not sold on the screen', !PREMIUM_ROWS.some(r => /^none · /.test(CAPABILITY_ENFORCEMENT[r.capability] || '')));
ok('adaptive Pri Explain is not sold: it is gated nowhere and plays in full on every plan',
  !PREMIUM_ROWS.some(r => r.capability === 'advanced-pri-explain') && /^none · /.test(CAPABILITY_ENFORCEMENT['advanced-pri-explain']));
ok('the enforcement map no longer claims device gates that do not exist (priorities, knowledge map)',
  !/^client · Progress priorities/.test(CAPABILITY_ENFORCEMENT['advanced-analytics']) && /forecast\.js/.test(CAPABILITY_ENFORCEMENT['advanced-analytics']) && /mistakeDna\.js/.test(CAPABILITY_ENFORCEMENT['advanced-analytics']));
ok('the forecast answers a free account with coverage only, from the server\'s own record',
  /if \(!serverEntitlementCapabilities\(snapshot, now\)\.includes\(FORECAST_CAPABILITY\)\) \{[\s\S]{0,200}premium: false[^}]*coverage: now_\.coverage, coveredMarks: now_\.coveredMarks, unseenMarks: now_\.unseenMarks \}\);/.test(srv('forecast.js')));
ok('mistake patterns answer a free account with a count only, from the server\'s own record',
  /if \(!serverEntitlementCapabilities\(snapshot, now\)\.includes\(DNA_CAPABILITY\)\) \{\s*return res\.status\(200\)\.json\(\{ premium: false, capability: DNA_CAPABILITY, habitCount: dna\.habits\.length, answered: dna\.answered \}\);/.test(srv('mistakeDna.js')));
ok('the root-gap reading answers a free account with a count only, from the server\'s own record',
  /if \(!serverEntitlementCapabilities\(snapshot, now\)\.includes\(ROOT_GAP_CAPABILITY\)\) \{\s*return res\.status\(200\)\.json\(\{ premium: false, capability: ROOT_GAP_CAPABILITY, gapCount: gap\.gaps\.length, answered: gap\.answered \}\);/.test(srv('rootGap.js')));
{
  const exams = srv('exams.js');
  ok('the time report is added only for premium-exams, on every result read',
    /if \(!serverEntitlementCapabilities\(snapshot, now\)\.includes\('premium-exams'\)\) return \{ \.\.\.view, timeReportOffered: true \};/.test(exams) &&
    (exams.match(/await withTimeReport\(db, accountId, /g) || []).length === 3);
}
const sectionTime = read('components/SectionTime.jsx');
const insights = read('insights/Insights.jsx');
ok('the time-report offer says why the student arrived', /PageLink to=\{PAYWALL_ROUTE\} state=\{\{ from: 'time-report' \}\}/.test(sectionTime) && ARRIVAL_KEYS['time-report']);
ok('all three Insights offers (forecast, Mistake DNA, root gap) say why the student arrived', (insights.match(/<PageLink to="\/premium" state=\{\{ from: 'insights' \}\}>/g) || []).length === 3 && !/<PageLink to="\/premium">/.test(insights) && ARRIVAL_KEYS.insights);
ok('an arrival from a Premium reading says what stays free', /stay on the free plan/.test(en['paywall.from.timeReport']) && /stay on the free plan/.test(en['paywall.from.insights']));

// 2 · no price in the source or the copy
const PRICE = /₹\s*\d|\bRs\.?\s*\d|\bINR\s*\d|\b(199|1,?499|125)\b/;
ok('Paywall.jsx holds no price literal', !PRICE.test(paywall), (paywall.match(PRICE) || [])[0]);
ok('pricing.js holds no price literal', !PRICE.test(pricing.replace(/\/\/.*$/gm, '')));
ok('the paywall copy holds no price literal (en)', !PRICE.test(text(en)));
ok('the paywall copy holds no price literal (hi)', !PRICE.test(text(hi)));
ok('the billed amounts are the store\'s displayPrice', /'paywall\.perYear' : 'paywall\.perMonth', \{ price: offer\.displayPrice \}/.test(paywall));
ok('a purchase button names the plan, never a price', /t\(cadence === 'annual' \? 'paywall\.chooseYearly' : 'paywall\.chooseMonthly'\)/.test(paywall));

// 3 · the arithmetic is honest
const apple = [
  { id: 'com.prilearning.app.premium.monthly', displayPrice: '₹199.00', price: '199', currencyCode: 'INR' },
  { id: 'com.prilearning.app.premium.annual', displayPrice: '₹1,499.00', price: '1499', currencyCode: 'INR' }
];
const appleOffers = planOffers(apple, { monthly: 'com.prilearning.app.premium.monthly', annual: 'com.prilearning.app.premium.annual' });
eq('Apple: the plans are matched to the server\'s product ids', [appleOffers.annual?.displayPrice, appleOffers.monthly?.displayPrice], ['₹1,499.00', '₹199.00']);
eq('the yearly per-month figure rounds UP (1499 / 12 = 124.9…)', perMonthEquivalent(appleOffers.annual), 125);
ok('and is formatted in the store\'s currency', /125/.test(aboutPerMonth(appleOffers.annual) || '') && /₹/.test(aboutPerMonth(appleOffers.annual) || ''), aboutPerMonth(appleOffers.annual));
eq('the saving is the true one, rounded DOWN (1 − 1499 / 2388 = 37.2…%)', yearlySavingPercent(appleOffers.annual, appleOffers.monthly), 37);
const google = [
  { id: 'com.prilearning.app.premium.monthly', basePlanId: 'monthly', displayPrice: '₹199.00', priceMicros: 199000000, currency: 'INR' },
  { id: 'com.prilearning.app.premium.annual', basePlanId: 'annual', displayPrice: '₹1,499.00', priceMicros: 1499000000, currency: 'INR' },
  { id: 'com.prilearning.app.premium.annual', basePlanId: 'annual-old', displayPrice: '₹999.00', priceMicros: 999000000, currency: 'INR' }
];
const googleOffers = planOffers(google, { monthly: { productId: 'com.prilearning.app.premium.monthly', basePlanId: 'monthly' }, annual: { productId: 'com.prilearning.app.premium.annual', basePlanId: 'annual' } });
eq('Google: the plans are matched by product AND base plan', [googleOffers.annual?.displayPrice, googleOffers.annual?.basePlanId, googleOffers.monthly?.displayPrice], ['₹1,499.00', 'annual', '₹199.00']);
eq('Google: micros give the same figures', [perMonthEquivalent(googleOffers.annual), yearlySavingPercent(googleOffers.annual, googleOffers.monthly)], [125, 37]);
const bare = planOffers([{ id: 'a', displayPrice: '₹1,499.00' }, { id: 'm', displayPrice: '₹199.00' }], { annual: 'a', monthly: 'm' });
eq('without a numeric price there is no per-month line and no saving', [aboutPerMonth(bare.annual), yearlySavingPercent(bare.annual, bare.monthly)], [null, null]);
eq('different currencies give no saving', yearlySavingPercent({ price: 1499, currency: 'INR' }, { price: 2, currency: 'USD' }), null);
eq('a yearly plan that is not cheaper claims no saving', yearlySavingPercent({ price: 2400, currency: 'INR' }, { price: 199, currency: 'INR' }), null);
eq('a product the store did not return, or returned without a display price, is not offered', [planOffers(apple, { annual: 'missing' }).annual, planOffers([{ id: 'x', price: '1' }], { annual: 'x' }).annual], [null, null]);
eq('nonsense prices are not numbers', [numericPrice({ price: 'free' }), numericPrice({ price: '-5' }), numericPrice({ priceMicros: 1.5 }), numericPrice({})], [null, null, null, null]);
eq('an amount without a currency is not said', formatAmount(125, null), null);

// 4 · the screen carries what the stores require, and nothing that pressures
ok('a close button that works from the first frame', /data-paywall-close onClick=\{close\}/.test(paywall));
ok('Restore purchases is on the screen in both stores', /data-paywall-restore/.test(paywall) && /\(apple \|\| google\) && \(\s*<div[^>]*>\s*<button[^>]*data-paywall-restore/.test(paywall));
ok('the disclosure for the device\'s own store is shown with the plans', /t\(apple \? 'paywall\.disclosureApple' : 'paywall\.disclosureGoogle'\)/.test(paywall));
ok('Terms, Privacy and Refunds are linked', /to="\/terms"/.test(paywall) && /to="\/privacy"/.test(paywall) && /to="\/refund-policy"/.test(paywall));
ok('a subscriber can reach the store\'s own management page', paywall.includes('data-paywall-manage') && paywall.includes("const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';") && paywall.includes('play.manageUrl'));
for (const [lang, cat] of [['en', en], ['hi', hi]]) {
  ok(`Apple disclosure (${lang}) names the 24-hour auto-renew rule and where to cancel`, /24/.test(cat['paywall.disclosureApple']) && /auto-renew/.test(cat['paywall.disclosureApple']) && /App Store/.test(cat['paywall.disclosureApple']));
  ok(`Google disclosure (${lang}) names Google Play, Subscriptions and what cancelling does`, /Google Play/.test(cat['paywall.disclosureGoogle']) && /Subscriptions/.test(cat['paywall.disclosureGoogle']));
  ok(`every paywall string exists in ${lang}`, keys.every(k => cat[k] !== undefined), keys.filter(k => cat[k] === undefined).join(', '));
}
ok('no countdown or timer on the screen', !/setTimeout|setInterval|countdown|expires in/i.test(paywall));
ok('no urgency, guilt, trial or outcome claim in the copy', !/\b(hurry|only today|limited time|last chance|don.t miss|free trial|guarantee|top rank|percentile|complete|certified|accurate|best)\b/i.test(text(en)), (text(en).match(/\b(hurry|only today|limited time|last chance|free trial|guarantee|complete|certified|accurate|best)\b/i) || [])[0]);
ok('the web offers no checkout: Premium is bought in the app', /paywall\.inAppOnly/.test(paywall) && !/checkout|razorpay/i.test(paywall));
ok('Premium is never set here: the server verifies every purchase', !/set(?:Premium|Entitlement)\s*\(/.test(paywall));
ok('every arrival reason has copy in both languages', Object.values(ARRIVAL_KEYS).every(k => en[k] && hi[k]));

// 5 · every way into it
const capNotice = read('components/FreeCapNotice.jsx');
ok('the daily-cap notice leads to the Premium screen and says why', /PAYWALL_ROUTE/.test(capNotice) && /from: isExam \? 'exams' : 'practice'/.test(capNotice));
const notebook = read('components/ErrorNotebook.jsx');
ok('a twin refused at the cap or for JEE Advanced leads to the Premium screen', /isEntitlementGate\(e\)/.test(notebook) && /nav\(PAYWALL_ROUTE/.test(notebook));
const app = read('App.jsx');
ok('the route is mounted for students', /<Route path="\/premium" element=\{studentOnly\(<Paywall \/>\)\} \/>/.test(app));

console.log(`Paywall honesty — ${pass}/${pass + failures.length} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nPAYWALL HONESTY: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
process.exit(failures.length ? 1 : 0);
