#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// What each architecture would cost in PRODUCTION, per student per month
//
// The benchmark's cost-per-evaluation answers "what does the study cost". This
// answers the question that actually decides the architecture: what does it
// cost to leave switched on for a student paying an Indian subscription.
//
// Pri's own .env.production.example puts the market at ₹199–₹399 a month. A
// per-student provider bill is only interesting as a fraction of that, so that
// is what this prints. Assumptions are arguments, not constants — re-run it
// with your own before quoting a number.
//
//   node tools/handwriting-bench/economics.mjs --equations 200 --escalation 0.15
// ─────────────────────────────────────────────────────────────────────────────
import process from 'node:process';
import { MATHPIX, TOKENS, tokenCost, aud, USD_TO_AUD, CHECKED } from './cost.mjs';

const argv = process.argv.slice(2);
const num = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};

// Assumptions, all overridable.
const EQUATIONS = num('--equations', 200);      // live equations written per student per month
const SUBMISSIONS = num('--submissions', 40);   // pages submitted for marking per student per month
const ESCALATION = num('--escalation', 0.15);   // share of readings the local engine cannot settle
const USD_TO_INR = num('--inr', 94.66);         // checked 2026-09-06
const TIERS = [199, 399];

const READ_USAGE = { inputTokens: 1700, outputTokens: 250 };
const MARK_USAGE = { inputTokens: 2300, outputTokens: 600 };

const rows = [
  ['D · Mathpix strokes, always on', EQUATIONS * 0.01, 'every equation is a billed drawing session'],
  ['D · Mathpix strokes, escalation only', EQUATIONS * ESCALATION * 0.01, `only the ${(ESCALATION * 100).toFixed(0)}% the local engine cannot settle`],
  ['B · Mathpix image on submit', SUBMISSIONS * MATHPIX.imagePerRequest, 'one v3/text call per submitted page'],
  ['A · direct marking, Gemini Pro', SUBMISSIONS * tokenCost('gemini-2.5-pro', MARK_USAGE), 'page + mark scheme per submission'],
  ['A · direct marking, GPT-5.6 Terra', SUBMISSIONS * tokenCost('gpt-5.6-terra', MARK_USAGE), 'page + mark scheme per submission'],
  ['A · direct marking, Claude Opus 5', SUBMISSIONS * tokenCost('claude-opus-5', MARK_USAGE), 'page + mark scheme per submission'],
  ['C · hybrid on submit (Mathpix + Gemini)', SUBMISSIONS * (MATHPIX.imagePerRequest + tokenCost('gemini-2.5-pro', READ_USAGE)), 'both legs run on every submission']
];

console.log('Production cost per student per month');
console.log(`assumptions: ${EQUATIONS} live equations, ${SUBMISSIONS} submissions, ${(ESCALATION * 100).toFixed(0)}% escalation`);
console.log(`prices read ${CHECKED} · USD→AUD ${USD_TO_AUD.rate} · USD→INR ${USD_TO_INR}\n`);
console.log('  architecture                              US$/mo   A$/mo    ₹199 tier   ₹399 tier');
for (const [name, usd, note] of rows) {
  const share = tier => `${((usd / (tier / USD_TO_INR)) * 100).toFixed(0)}%`.padStart(9);
  console.log(`  ${name.padEnd(40)} ${('$' + usd.toFixed(2)).padStart(6)}  ${('A$' + aud(usd).toFixed(2)).padStart(7)} ${share(TIERS[0])}   ${share(TIERS[1])}`);
  console.log(`  ${''.padEnd(40)} ${note}`);
}
console.log('\nRevenue for reference: ₹199 = US$' + (199 / USD_TO_INR).toFixed(2) + ', ₹399 = US$' + (399 / USD_TO_INR).toFixed(2));
console.log('Percentages are share of GROSS subscription revenue, before store fees, tax or any other cost.');
console.log('\nMathpix stroke sessions are free to 1,000/month ACROSS THE DEPLOYMENT — five students at 200');
console.log('equations each exhaust it, so the free tier is a pilot allowance, not a subsidy.');
