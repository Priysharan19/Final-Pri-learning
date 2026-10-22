// Pri Learning · the Premium screen says only what is true (client/src/paywall/).
//   · no price is written into the source of a purchase button or into the copy;
//     the billed amount is StoreKit's displayPrice
//   · the yearly per-month figure is derived from StoreKit's numeric price,
//     rounded, labelled "about", and omitted without a numeric price
//   · a saving is shown only when computed from both real prices, rounded down
//   · Restore purchases, the auto-renewal disclosure (Apple 3.1.2), Terms and
//     Privacy links and a close button are present
//   · no countdown, urgency or guilt words; no trial claim
//   · the comparison names the new free/Premium split
// Usage: node client/test/paywall-honesty-check.mjs
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const { planOffers, perMonthEquivalent, aboutPerMonth, yearlySavingPercent, formatAmount } = await import('../src/paywall/pricing.js');
const { FREE_MARKING_ALLOWANCE, FREE_NOTEBOOK_PREVIEW } = await import('../src/engine/practiceAllowance.js');

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const paywall = read('paywall/Paywall.jsx');
const pricing = read('paywall/pricing.js');
const hook = read('paywall/useStoreKitPurchase.js');
const keys = Object.keys(en).filter(k => k.startsWith('paywall.'));
const text = cat => keys.map(k => (typeof cat[k] === 'string' ? cat[k] : Object.values(cat[k]).join(' '))).join(' \n ');

// 1 · no hardcoded prices
const PRICE = /₹\s*\d|\bRs\.?\s*\d|\bINR\s*\d|\b(199|1,?499|125)\b/;
ok('Paywall.jsx holds no price literal', !PRICE.test(paywall), (paywall.match(PRICE) || [])[0]);
ok('pricing.js holds no price literal', !PRICE.test(pricing.replace(/\/\/.*$/gm, '')));
ok('the paywall copy holds no price literal (en)', !PRICE.test(text(en)));
ok('the paywall copy holds no price literal (hi)', !PRICE.test(text(hi)));
const buttons = [...paywall.matchAll(/<button[^>]*data-paywall-buy[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1]);
eq('there are two purchase buttons (yearly, monthly)', buttons.length, 2);
ok('purchase buttons carry no price at all, only the plan choice', buttons.every(b => !/displayPrice|price|₹/.test(b) && /paywall\.choose(Yearly|Monthly)/.test(b)), buttons.join(' | '));
ok('the billed amounts are StoreKit displayPrice', /paywall\.perYear', \{ price: offers\.annual\.displayPrice \}/.test(paywall) && /paywall\.perMonth', \{ price: offers\.monthly\.displayPrice \}/.test(paywall));
ok('the yearly plan is the recommended one, shown first', paywall.indexOf('data-paywall-plan="annual"') > 0 && paywall.indexOf('data-paywall-plan="annual"') < paywall.indexOf('data-paywall-plan="monthly"') && /paywall\.recommended/.test(paywall));

// 2 · per-month equivalent
const annual = { id: 'a', displayPrice: '₹1,499.00', price: 1499, currencyCode: 'INR' };
const monthly = { id: 'm', displayPrice: '₹199.00', price: 199, currencyCode: 'INR' };
eq('per-month equivalent is price / 12, rounded', perMonthEquivalent(annual), 125);
ok('it is formatted in the product currency', /125/.test(aboutPerMonth(annual)) && /₹/.test(aboutPerMonth(annual)), aboutPerMonth(annual));
eq('no numeric price → no per-month figure', aboutPerMonth({ id: 'a', displayPrice: '₹1,499.00' }), null);
eq('no currency → no per-month figure', aboutPerMonth({ id: 'a', displayPrice: 'x', price: 1499 }), null);
ok('the per-month copy is labelled "about" (en) and "लगभग" (hi)', /^about \{price\}/.test(en['paywall.aboutPerMonth']) && /लगभग \{price\}/.test(hi['paywall.aboutPerMonth']));
ok('the per-month line renders only when derived', /\{about && <div[^>]*data-paywall-about>/.test(paywall));
eq('other currencies divide the same way', perMonthEquivalent({ price: 59.99, currencyCode: 'USD' }), 5);
eq('formatAmount refuses a missing currency', formatAmount(125, null), null);

// 3 · savings only when true
eq('the yearly saving is computed from both real prices and rounded down', yearlySavingPercent(annual, monthly), 37);
eq('no saving without a monthly numeric price', yearlySavingPercent(annual, { ...monthly, price: undefined }), null);
eq('no saving across currencies', yearlySavingPercent(annual, { ...monthly, currencyCode: 'USD' }), null);
eq('no saving when yearly is not cheaper', yearlySavingPercent({ ...annual, price: 3000 }, monthly), null);
ok('the saving line renders only when computed', /\{saving && <div[^>]*data-paywall-saving>/.test(paywall));
const offers = planOffers([annual, monthly, { id: 'x' }], { annual: 'a', monthly: 'm' });
eq('offers are matched by the server product ids', [offers.annual?.displayPrice, offers.monthly?.displayPrice], ['₹1,499.00', '₹199.00']);
eq('a product without displayPrice is not offered', planOffers([{ id: 'a', price: 1 }], { annual: 'a' }).annual, null);

// 4 · required parts
ok('Restore purchases button present', /data-paywall-restore[\s\S]{0,300}paywall\.restore/.test(paywall) && en['paywall.restore'] === 'Restore purchases');
const d = en['paywall.disclosureApple'];
ok('Apple disclosure: auto-renewing', /auto-renewing subscription/.test(d));
ok('Apple disclosure: renews unless cancelled at least 24 hours before the end of the period', /renews automatically/.test(d) && /at least 24 hours before the end of the current period/.test(d));
ok('Apple disclosure: charged to Apple ID', /charged to your Apple ID/.test(d));
ok('Apple disclosure: manage/cancel in Settings › Apple ID › Subscriptions', /Settings › Apple ID › Subscriptions/.test(d));
ok('the Hindi disclosure keeps the 24-hour and Apple ID terms', /24 घंटे/.test(hi['paywall.disclosureApple']) && /Apple ID/.test(hi['paywall.disclosureApple']) && /Settings › Apple ID › Subscriptions/.test(hi['paywall.disclosureApple']));
ok('the disclosure is rendered', /data-paywall-disclosure[\s\S]{0,200}paywall\.disclosureApple/.test(paywall));
ok('Terms and Privacy links go to the existing legal routes', /<PageLink to="\/terms">/.test(paywall) && /<PageLink to="\/privacy">/.test(paywall));
ok('a close button is rendered unconditionally at the top', /<button[^>]*data-paywall-close onClick=\{close\}>/.test(paywall) && paywall.indexOf('data-paywall-close') < paywall.indexOf('data-paywall-compare'));

// 5 · no dark patterns
const URGENT = /countdown|hurry|limited time|only today|today only|expires|last chance|don.t miss|act now|offer ends|free trial|trial|miss out|you.ll regret|disappoint|\bsale\b/i;
ok('no urgency, countdown, trial or guilt words in the English copy', !URGENT.test(text(en)), (text(en).match(URGENT) || [])[0]);
ok('no timer in the screen', !/setInterval|setTimeout|countdown/i.test(paywall));
ok('no pre-selected plan state', !/useState\(['"](annual|monthly)['"]\)/.test(paywall));

// 6 · the split
eq('free rows: unlimited practice, marked answers a day, last notebook mistakes', [en['paywall.free.practice'], en['paywall.free.marking'].other.replace('{n}', FREE_MARKING_ALLOWANCE.scriptsPerDay), en['paywall.free.notebook'].other.replace('{n}', FREE_NOTEBOOK_PREVIEW)],
  ['Unlimited practice', '5 marked answers a day', 'Your last 3 mistakes in the notebook']);
eq('premium rows', ['marking', 'mocks', 'notebook', 'parentReport', 'targetPlan'].map(k => en[`paywall.premium.${k}`]),
  ['Unlimited marking', 'Mock papers', 'The full mistake notebook', 'The parent report', 'The target plan']);
ok('every paywall key exists in Hindi', keys.every(k => k in hi), keys.filter(k => !(k in hi)).join(','));

// 7 · Premium comes from the server only
ok('the purchase hook submits to the server before finishing the transaction', hook.indexOf('await cloud.submitAppleTransaction(signedTransaction)') > 0 && hook.indexOf('await cloud.submitAppleTransaction(signedTransaction)') < hook.indexOf('await finishNativeTransaction(transactionId)'));
ok('the paywall decides Premium from the server-issued snapshot', /hasEntitlement\(link\?\.entitlement, ENTITLEMENTS\.UNLIMITED_MARKING\)/.test(paywall) && !/setPremium|premium\s*=\s*true/.test(paywall));
ok('the 402 notice, the check refusal, the notebook and the exam page link to the paywall',
  /to=\{PAYWALL_ROUTE\}/.test(read('components/FreeCapNotice.jsx')) && /to=\{PAYWALL_ROUTE\}/.test(read('components/CheckRefusal.jsx')) &&
  /to=\{PAYWALL_ROUTE\}/.test(read('notebook/MistakeNotebook.jsx')) && /to=\{PAYWALL_ROUTE\}/.test(read('pages/Exams.jsx')) && /to=\{PAYWALL_ROUTE\}/.test(read('plan/PlanPage.jsx')));
ok('the paywall and notebook routes are lazy-loaded', /React\.lazy\(\(\) => import\('\.\/paywall\/Paywall\.jsx'\)\)/.test(read('App.jsx')) && /React\.lazy\(\(\) => import\('\.\/notebook\/NotebookPage\.jsx'\)\)/.test(read('App.jsx')));
ok('the target plan is gated on target-plan', /capabilityDecision\(pid, ENTITLEMENTS\.TARGET_PLAN\)/.test(read('plan/PlanPage.jsx')));

// 8 · the old rule is gone from the copy
const all = [en, hi].map(c => Object.entries(c).filter(([k]) => /^(freeCap|check\.freeCap|settings\.localPlanSub|paywall)/.test(k)).map(([, v]) => JSON.stringify(v)).join(' ')).join(' ');
ok('no copy still says 20 practice questions a day', !/\b20\b/.test(all) && !/practice questions a day|free practice questions/.test(all));

console.log(`PAYWALL HONESTY: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
