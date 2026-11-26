// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · a line that only says a thing equals itself earns no step mark (R4, evidence layer)
//
// Root cause of the independent review's finding (bank part X12-V1-032): its first worked step is `3-2=1`, whose value is 1, so the generic rule's
// "a ticked line that states the step's value reaches the step" credited the report's own tick of the line `1=1` (both sides come to 1). The
// ticked line was the weakness, not the rule: markerOps.stepEvidence now shows a line whose sides are the same text, or bare numbers of one value,
// as a true but neutral line (restates) on a step-mark question. genericSteps.js and bankGenericSteps.js (the hashed sources) are untouched.
// (An identity line the page's topic check crosses stays crossed, as before: that is the marker's own verdict, not changed here.)
//   1. the line test      2. every eligible bank part x trivial lines: 0      3. generated questions x trivial lines: 0
//   4. genuine key-step lines still earn      5. an identity line inserted among honest lines changes nothing
//   node server/test/identity-lines-check.mjs
// SYNTHETIC: the author's own bank and generated questions with scripted working. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras';
const { checks } = await import('./support/app-harness.mjs');
const qb = await import('../platform/qbankPack.js');
const { isIdentityLine, holdIdentityLines } = await import('../platform/markerOps.js');
const { bankAuthoredLines } = await import('../platform/bankSteps.js');
const { authoredLines } = await import('../platform/genericSteps.js');
const bankSweep = await import('../../tools/bank-steps-sweep.mjs');
const genSweep = await import('../../tools/generic-steps-sweep.mjs');
const c = checks();
await qb.ensureQbank(process.env, { strict: true });

for (const l of ['1=1', '0=0', '2 = 2', 'x=x', '3.0=3', '$5=5$', '(4)=4', 'a+b=a+b', '1=1=1']) c.ok(isIdentityLine(l), `${l} is an identity line`);
for (const l of ['3·4 − 11 = 1', '3-2=1', 'x=1', '2+2=4', '1=2', 'f(x)=x', 'x', '=1', '3*4-11=1']) c.ok(!isIdentityLine(l), `${l} is not`);
{ const r = { lines: [{ text: '1=1', status: 'ok', note: 'n' }, { text: '3-2=1', status: 'ok' }] }; const h = holdIdentityLines(r);
  c.deq(h.lines.map(l => !!l.restates), [true, false], 'the report keeps the identity line true but neutral (restates), and a genuine tick as it was'); }

const TRIVIAL = Array.from({ length: 10 }, (_, n) => `${n}=${n}`);
const parts = bankSweep.eligibleParts({ rule: 'generic' });
c.eq(parts.length, 405, '405 eligible bank parts (367 before the larger pack of #1129)');
{ let pages = 0, earned = 0, insertedChanged = 0, genuine = 0, genuineEarn = 0;
  for (const p of parts) {
    const t = bankAuthoredLines(p.q).map(l => l.text);
    for (const l of TRIVIAL) { pages++; if (bankSweep.markPage(p.q, [l], '99991').marks > 0) earned++; if (bankSweep.markPage(p.q, [l, l, l], '99991').marks > 0) earned++; }
    const base = bankSweep.markPage(p.q, t, '99991').marks;
    for (const l of ['1=1', '2=2', 'x=x']) if (bankSweep.markPage(p.q, [l, ...t], '99991').marks > base || bankSweep.markPage(p.q, [...t.slice(0, -1), l, t[t.length - 1]], '99991').marks > base) insertedChanged++;
    genuine++; if (bankSweep.markPage(p.q, t, '99991').marks >= 1) genuineEarn++;
  }
  c.eq(earned, 0, `${parts.length} bank parts x ${TRIVIAL.length} trivial lines (alone and repeated), ${pages * 2} pages: no mark`);
  c.eq(insertedChanged, 0, 'an identity line before or inside the honest lines never adds a mark');
  c.ok(genuineEarn >= 300, `the honest working still earns step marks on ${genuineEarn} of ${genuine} parts`);
}
{ const p = parts.find(x => x.id === 'X12-V1-032');
  c.ok(p && bankSweep.markPage(p.q, ['1=1'], '99991').marks === 0 && bankSweep.markPage(p.q, ['3-2=1'], '99991').marks === 1, 'X12-V1-032: 1=1 earns 0 and its own step 3-2=1 earns 1'); }
{ const its = await genSweep.payableQuestions({ seeds: 6 }); let pages = 0, earned = 0, honestEarn = 0;
  for (const it of its.slice(0, 600)) { for (const l of TRIVIAL) { pages++; if (genSweep.markPage(it.q, [l], '99991').marks > 0) earned++; }
    const t = authoredLines(it.q).map(l => l.text); const base = genSweep.markPage(it.q, t, '99991').marks; if (base >= 1) honestEarn++;
    if (genSweep.markPage(it.q, ['1=1', ...t], '99991').marks > base) earned++; }
  c.ok(its.length >= 200, `${its.length} generated questions`);
  c.eq(earned, 0, `generated questions x trivial lines (${pages} pages): no mark, and none gained by an identity line among honest ones`);
  c.ok(honestEarn > 100, `the honest working earns on ${honestEarn} of them`); }
console.log(`IDENTITY LINES: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
