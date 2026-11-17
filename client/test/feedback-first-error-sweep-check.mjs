// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · feedback that is actually intelligent: the first-error sweep
//
// A student's working is only as useful as the line it flags and what that line
// is told. The owner wrote "∫16x⁷dx" then "= 8x⁸" for ∫16x⁷ dx: the mark was
// right, but line 1 — the question restated — was flagged "no longer equivalent
// to the expression you started with", and the real slip, the coefficient of
// "= 8x⁸", was not named. This suite sweeps every topic bank Prithagoras issues
// (client/src/engine/nswIssuedCells.js) and holds the Step Check to three
// things, deterministically:
//
//   A · THE POWER-RULE / CHAIN-RULE CATALOGUE (strict). For every issued
//       calculus question, each common slip — forgot to divide, divided by the
//       old power, the wrong divisor, power not raised, sign, a constant left
//       unintegrated, differentiated instead of integrated, and for
//       derivatives forgot to multiply, power not lowered, a constant kept,
//       integrated instead, the chain-rule inner factor — is written as working
//       under the question restated. The restatement must NOT be flagged, the
//       flagged line must be the slip, and its diagnosis must be the specific
//       one. A correct line under the same restatement must be left alone.
//
//   B · FIRST-ERROR LOCATION (strict) over every other issued topic that has a
//       Step Check: the question's designed wrong answers are written under
//       its restatement; the first flagged line must be the wrong one (never
//       the restatement, never an earlier correct line), and correct working
//       must flag nothing. These have no assertion about WHAT the message says.
//
//   C · COVERAGE, reported honestly: how many issued cells have a Step Check at
//       all, how many flagged lines got a specific named message and how many
//       are still generic, and which topics those are.
//
// SYNTHETIC: generated questions, scripted working. Not evidence about real
// students. Marks are not touched here: marks.test suites assert that.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { stepCheck, checkAnswer } = await import(`${SRC}engine/checker.js`);
const { NSW_ISSUED_CELLS } = await import(`${SRC}engine/nswIssuedCells.js`);
const { polyOf, calculusContext, fmtNum, innerCoefficient } = await import(`${SRC}engine/calculusSteps.js`);
const { stepMetaFor } = await import('../../server/platform/markerOps.js');
const { parse, normalize, evaluate, exprEquivalent } = await import(`${SRC}engine/expr.js`);
await loadAllBanks();

const SEEDS = Number(process.argv[2]) || 8;
const failures = [];
const fail = text => { if (failures.length < 60) failures.push(text); };
let checks = 0;
const ok = (cond, text) => { checks++; if (!cond) fail(text); };

const seedOf = (i, d, g) => ((i + 1) * 2654435761 + d * 40503 + g.length * 97) >>> 0 & 0x7fffffff;
const tidyText = t => String(t).replace(/\\left|\\right|\\displaystyle|\\,|\\;/g, '').replace(/\\(sin|cos|tan|ln|log|exp)\b/g, '$1').replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\\cdot|\\times/g, '*').replace(/[{}]/g, '');
const spansOf = prompt => [...String(prompt || '').matchAll(/\$([^$]+)\$/g)].map(m => m[1]);

/** A polynomial {power: coefficient} written the way a student writes it. */
function polyText(map) {
  const parts = [...map].filter(([, c]) => Math.abs(c) > 1e-12).sort((a, b) => b[0] - a[0]);
  if (!parts.length) return '0';
  return parts.map(([p, c], i) => {
    const mag = Math.abs(c), sign = c < 0 ? '-' : '+';
    const body = p === 0 ? fmtNum(mag) : `${mag === 1 ? '' : fmtNum(mag)}${mag === 1 ? '' : '*'}x${p === 1 ? '' : `^${p}`}`.replace(/^\*/, '');
    return `${i === 0 ? (c < 0 ? '-' : '') : ` ${sign} `}${body || '1'}`;
  }).join('');
}
const with_ = (map, power, coef) => { const out = new Map(map); if (coef === 0 || coef === undefined) out.delete(power); else out.set(power, coef); return out; };
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const report = (meta, prompt, lines) => stepCheck(meta, lines.join('\n'), { prompt });
const flaggedAt = r => r.firstBreak;

// ── A · the calculus catalogue ──────────────────────────────────────────────
const catalogue = { cases: 0, questions: 0, byCode: {}, cells: new Set() };
for (const [generator, levels] of Object.entries(NSW_ISSUED_CELLS)) {
  for (const d of levels) for (let i = 0; i < SEEDS; i++) {
    let q;
    try { q = generateQuestion(generator, d, seedOf(i, d, generator)); } catch { continue; }
    const meta = stepMetaFor(q);
    const ctx = meta ? calculusContext(meta.kind === 'expression' ? meta : { kind: 'expression', canonical: meta.canonical }, q.prompt) : null;
    if (!ctx || q.answerType !== 'expression') continue;
    const given = polyOf(ctx.given, ctx.variable);
    const canonical = polyOf(ctx.canonical, ctx.variable);
    if (!given || !canonical) {
      // Not a polynomial: a function of a linear inner, f(ax + b).
      const a = innerCoefficient(ctx.given, ctx.variable);
      if (a === null || Math.abs(Math.abs(a) - 1) < 1e-9 || ctx.relation !== 'antiderivative') continue;
      const span = spansOf(q.prompt).find(t => /\\int/.test(t));
      const integrand = span && tidyText(span.replace(/\\displaystyle|\\int/g, '').replace(/\\,\s*dx\s*$/, '')).trim();
      if (!integrand) continue;
      const tag2 = `${generator} D${d} seed ${seedOf(i, d, generator)}`;
      catalogue.questions++; catalogue.cells.add(`${generator}|${d}`);
      for (const [name, code, factor] of [['not-divided', 'int-linear-inner-not-divided', a], ['multiplied', 'int-linear-inner-multiplied', a * a]]) {
        catalogue.cases++; catalogue.byCode[code] = (catalogue.byCode[code] || 0) + 1;
        const lines = [`∫(${integrand})dx`, `= (${meta.canonical})*(${fmtNum(factor)})`];
        const r = report(meta, q.prompt, lines);
        ok(r.lines[0].status !== 'break' && flaggedAt(r) === 1 && r.lines[1].diagnosis?.code === code, `${tag2} [${name}]: ${JSON.stringify(lines)} → flagged ${flaggedAt(r) + 1}, ${r.lines[1]?.diagnosis?.code} (expected ${code})`);
      }
      const good = report(meta, q.prompt, [`∫(${integrand})dx`, `= ${meta.canonical}`]);
      ok(good.firstBreak === -1 && good.lines[1].status === 'ok', `${tag2}: the correct linear-inner integral was flagged`);
      continue;
    }
    catalogue.questions++;
    catalogue.cells.add(`${generator}|${d}`);
    const tag = `${generator} D${d} seed ${seedOf(i, d, generator)}`;
    const startLine = ctx.relation === 'antiderivative' ? `∫(${polyText(given)})dx` : `y = ${polyText(given)}`;
    const runCase = (name, code, studentMap, extraLines = []) => {
      if (!studentMap) return;
      catalogue.cases++;
      catalogue.byCode[code] = (catalogue.byCode[code] || 0) + 1;
      const lines = [startLine, ...extraLines, `= ${polyText(studentMap)}`];
      const r = report(meta, q.prompt, lines);
      const slip = lines.length - 1;
      ok(r.lines[0].status !== 'break' && !r.lines[0].diagnosis, `${tag} [${name}]: the restated question was flagged: ${JSON.stringify(r.lines[0])}`);
      ok(flaggedAt(r) === slip, `${tag} [${name}]: first flagged line is ${flaggedAt(r) + 1}, the slip is line ${slip + 1} (${lines[slip]})`);
      ok(r.lines[slip]?.diagnosis?.code === code, `${tag} [${name}]: ${lines[slip]} is named ${r.lines[slip]?.diagnosis?.code}, expected ${code}`);
      ok(/\S/.test(r.lines[slip]?.note || '') && !/no longer equivalent/.test(r.lines[slip]?.note || ''), `${tag} [${name}]: the line's note is empty or the old generic one`);
    };
    // A correct answer under the same restatement is left alone.
    {
      const r = report(meta, q.prompt, [startLine, `= ${polyText(canonical)}`]);
      ok(flaggedAt(r) === -1 && r.lines[1].status === 'ok', `${tag}: the correct working was flagged or not accepted: ${JSON.stringify(r.lines.map(l => l.status))}`);
    }
    // Slips are written on the answer's highest term of a single power, with the rest correct.
    const top = [...given.keys()].filter(n => n >= 1 && n <= 12).sort((a, b) => b - a)[0];
    if (top === undefined) continue;
    const c = given.get(top);
    if (ctx.relation === 'antiderivative') {
      const q1 = top + 1, r = canonical.get(q1);
      if (r === undefined || !near(r, c / q1)) continue;
      if (q1 !== 1 && !near(c, r)) runCase('no-divide', 'int-no-divide', with_(canonical, q1, c));
      if (top >= 2 && !near(c / top, r) && !near(c / top, c)) runCase('divide-old-power', 'int-divide-old-power', with_(canonical, q1, c / top));
      for (const k of [2, 3, 4, 5]) if (k !== q1 && k !== top && !near(c / k, r) && !near(c / k, c) && !near(c / k, c / top)) { runCase('wrong-divisor', 'int-wrong-divisor', with_(canonical, q1, c / k)); break; }
      if (!near(r, -r)) runCase('sign', 'int-sign', with_(canonical, q1, -r));
      if (top >= 1 && !canonical.has(top)) runCase('power-not-raised', 'int-power-not-raised', with_(with_(canonical, q1, 0), top, c));
      if (top >= 2 && !canonical.has(top - 1) && !given.has(top - 1) && !near(c * top, 0)) runCase('differentiated', 'int-differentiated', with_(with_(canonical, q1, 0), top - 1, c * top));
      if (given.has(0) && !near(given.get(0), 0) && !canonical.has(0)) runCase('constant-not-integrated', 'int-constant-not-integrated', with_(with_(canonical, 1, 0), 0, given.get(0)));
    } else {
      const q0 = top - 1, r = canonical.get(q0);
      if (r === undefined || !near(r, c * top)) continue;
      if (top >= 2 && !near(c, r) && !given.has(q0)) runCase('no-multiply', 'diff-no-multiply', with_(canonical, q0, c));
      if (!given.has(q0) && !canonical.has(top)) runCase('power-not-lowered', 'diff-power-not-lowered', with_(with_(canonical, q0, 0), top, r));
      if (!near(r, -r)) runCase('sign', 'diff-sign', with_(canonical, q0, -r));
      if (given.has(0) && !near(given.get(0), 0) && !canonical.has(0)) runCase('constant-kept', 'diff-constant-kept', with_(canonical, 0, given.get(0)));
      if (!given.has(top + 1) && !canonical.has(top + 1)) runCase('integrated', 'diff-integrated', with_(with_(canonical, q0, 0), top + 1, c / (top + 1)));
    }
  }
}
ok(catalogue.questions > 0 && catalogue.cases > 100, `the calculus sweep ran over ${catalogue.questions} questions and ${catalogue.cases} slips`);
const codesSeen = Object.keys(catalogue.byCode);
for (const code of ['int-no-divide', 'int-divide-old-power', 'int-wrong-divisor', 'int-sign', 'int-power-not-raised', 'diff-no-multiply', 'diff-power-not-lowered', 'diff-sign']) {
  ok(codesSeen.includes(code), `no case of ${code} was exercised`);
}

// The owner's own case, exactly as written (the handwriting reader gives this text).
{
  const meta = { kind: 'expression', canonical: '2*x^8' };
  const prompt = 'Find $\\displaystyle\\int 16x^{7}\\,dx$. (You may omit the $+C$.)';
  const r = stepCheck(meta, '∫16x⁷dx\n= 8x⁸', { prompt });
  ok(r.firstBreak === 1 && r.lines[0].status === 'note' && !r.lines[0].diagnosis, `the owner's case: the restated integral is flagged (${JSON.stringify(r.lines[0])})`);
  ok(r.lines[1].diagnosis?.code === 'int-wrong-divisor' && /Your power is right \(x⁸\)\. Check the coefficient: 16 ÷ 8 = 2\./.test(r.lines[1].note), `the owner's case: the slip is not named as expected: ${JSON.stringify(r.lines[1])}`);
  for (const [text, code] of [['∫16x⁷dx\n= 16x⁸', 'int-no-divide'], ['∫16x⁷dx\n= 16/7x⁸', 'int-divide-old-power'], ['∫16x⁷dx\n= 2x⁷', 'int-power-not-raised'], ['∫16x⁷dx\n= -2x⁸', 'int-sign']]) {
    const s = stepCheck(meta, text, { prompt });
    ok(s.firstBreak === 1 && s.lines[1].diagnosis?.code === code, `${JSON.stringify(text)} → ${s.lines[1]?.diagnosis?.code}, expected ${code}`);
  }
  const good = stepCheck(meta, '∫16x⁷dx\n= 16x⁸/8\n= 2x⁸', { prompt });
  ok(good.firstBreak === -1, 'correct working with a true middle line is not flagged');
  const withC = stepCheck(meta, '∫16x⁷dx = 2x⁸ + C', { prompt });
  ok(withC.firstBreak === -1 && withC.lines[0].status === 'note', 'the answer with + C is a true line, not flagged — and not "ok": ok is the old rule, which decides method marks');
  const split = stepCheck({ kind: 'expression', canonical: '2*x^8 + -8*x' }, '∫16x⁷dx - ∫8dx\n= 2x⁸ - 8x', { prompt: 'Find $\\displaystyle\\int \\left(16x^{7} - 8\\right)\\,dx$.' });
  ok(split.firstBreak === -1, 'a term-by-term integral, ∫16x⁷dx − ∫8dx, is a true step');
  const wrongStart = stepCheck(meta, '∫15x⁷dx\n= 2x⁸', { prompt });
  ok(wrongStart.firstBreak === 0, 'a mis-copied integrand (15 for 16) is still caught on line 1');
}

// ── MARKS: a line is `ok` only where the old rule said ok ───────────────────
// stepCheck without the prompt reads no calculus, so it IS the old rule. Whatever the new
// reading calls ok must be ok there too, or a method mark could be earned that was not.
{
  const prompt = 'Find $\\displaystyle\\int 16x^{7}\\,dx$. (You may omit the $+C$.)';
  const meta = { kind: 'expression', canonical: '2*x^8' };
  const dprompt = 'Differentiate $y = (4x - 6)^{5}$.';
  const dmeta = { kind: 'expression', canonical: '20(4x + -6)^4' };
  const lines = ['∫16x⁷dx', '2x⁸', '2x⁸ + C', '2x⁸ + C + C', '2x⁸ - C', '16x⁸/8', '16x⁸/8 + C', '∫16x⁷dx = 2x⁸ + C', '= 2x⁸ + 5', '= 2x⁸', 'y = 2x⁸', 'dy/dx = 2x⁸', '20(4x-6)^4', '20(4x-6)^4 + C', 'dy/dx = 20(4x-6)^4 + C', '= 20(4x-6)^4 + C + C', 'y=(4x-6)^5', 'dy/dx = (4x-6)^5', 'y = 6x^5'];
  let compared = 0, newOk = 0;
  for (const [m, pr] of [[meta, prompt], [dmeta, dprompt]]) for (const text of lines) {
    const withPrompt = stepCheck(m, text, { prompt: pr }).lines[0]?.status;
    const old = stepCheck(m, text).lines[0]?.status;
    compared++;
    if (withPrompt === 'ok') { newOk++; ok(old === 'ok', `MARKS: ${JSON.stringify(text)} is ok under the calculus reading but ${old} under the old rule`); }
  }
  ok(compared === lines.length * 2 && newOk >= 4, `the ok-implies-old-ok check ran over ${compared} lines (${newOk} ok)`);
  // The two ways a restatement could hide a slip.
  const hid = stepCheck({ kind: 'expression', canonical: '20(4x + -6)^4' }, 'y=(4x-6)^5\ndy/dx=(4x-6)^5', { prompt: dprompt });
  ok(hid.firstBreak === 1, 'dy/dx = the function itself is a claim, and flagged — not taken for the restated question');
  const hid2 = stepCheck(meta, '∫6x^5dx\ny = 6x^5', { prompt: 'Find $\\displaystyle\\int 6x^{5}\\,dx$.' });
  ok(hid2.firstBreak === 1, '∫6x⁵dx then y = 6x⁵ is a claim (the integral is not its integrand), and flagged');
  const claimC = stepCheck({ kind: 'expression', canonical: '20(4x + -6)^4' }, 'y=(4x-6)^5\ndy/dx=20(4x-6)^4 + C', { prompt: dprompt });
  ok(claimC.lines[1].status === 'break', 'a constant added to a derivative is a slip, and not ok');
}

// ── B · first-error location over every other Step Check topic ──────────────
const coverage = { cells: 0, withCheck: new Set(), noCheck: new Set(), items: 0, located: 0, named: 0, generic: {}, controls: 0, controlsClean: 0, laterItems: 0 };
const GENERIC = new Set([undefined, null, 'counterexample', 'antiderivative-check', 'derivative-check', 'derivative-error', 'one-side-only', 'sides-mismatched']);
for (const [generator, levels] of Object.entries(NSW_ISSUED_CELLS)) {
  for (const d of levels) {
    coverage.cells++;
    let checked = 0;
    for (let i = 0; i < SEEDS; i++) {
      let q;
      try { q = generateQuestion(generator, d, seedOf(i, d, generator)); } catch { continue; }
      const meta = stepMetaFor(q);
      if (!meta || (meta.kind !== 'equation' && meta.kind !== 'expression' && meta.kind !== 'derivative')) continue;
      if (calculusContext(meta.kind === 'expression' ? meta : { kind: 'expression', canonical: meta.canonical || '' }, q.prompt)) continue;   // section A
      const spans = spansOf(q.prompt).map(tidyText);
      // The restatement is the span of the question that IS the thing to work on: an equation the
      // answer satisfies, or an expression equivalent to the answer (simplify, expand, factorise).
      // Anything else (a name, a rate, a unit) is not a restatement and the item is skipped.
      let start = null;
      for (const span of spans) {
        const text = meta.kind === 'derivative' ? span.replace(/^[a-z](\([a-z]\))?\s*=\s*/i, '') : span;
        if (text.length > 80 || (meta.kind !== 'derivative' && text.length < 3)) continue;
        try {
          if (meta.kind === 'equation') {
            const ast = parse(normalize(text));
            if (ast.t !== 'equation') continue;
            const L = x => evaluate(ast.l, { [meta.variable]: x }), R = x => evaluate(ast.r, { [meta.variable]: x });
            if (meta.solutions.every(x => Math.abs(L(x) - R(x)) <= 1e-6 * Math.max(1, Math.abs(R(x))))) { start = text; break; }
          } else if (meta.kind === 'expression') {
            if (!/=/.test(text) && exprEquivalent(text, meta.canonical)) { start = text; break; }
          } else if (!/[<>]/.test(text) && parse(normalize(text))) { start = text; break; }
        } catch { /* not a restatement */ }
      }
      if (!start) continue;
      const wrongs = [];
      if (meta.kind === 'equation') {
        const v = meta.variable;
        for (const t of q.traps || []) if (Number.isFinite(t?.value) && q.answerType !== 'set') wrongs.push(`${v} = ${fmtNum(t.value)}`);
      } else {
        for (const t of q.traps || []) if (typeof t?.expr === 'string') wrongs.push(`= ${t.expr}`);
      }
      const rightLine = meta.kind === 'equation' ? (q.answerType === 'set' ? null : `${meta.variable} = ${fmtNum(meta.solutions[0])}`) : `= ${meta.canonical}`;
      for (const wrong of wrongs.slice(0, 3)) {
        // Only designed wrong answers the final-answer marker also calls wrong.
        const answerText = wrong.replace(/^.*?=\s*/, '');
        let finalWrong = false;
        try { finalWrong = checkAnswer(q, answerText).correct === false; } catch { finalWrong = false; }
        if (!finalWrong) continue;
        const tag = `${generator} D${d} seed ${seedOf(i, d, generator)} ${JSON.stringify(wrong)}`;
        const r = report(meta, q.prompt, [start, wrong]);
        coverage.items++;
        checked++;
        const located = r.firstBreak === 1 && r.lines[0].status !== 'break';
        if (located) coverage.located++; else fail(`${tag}: flagged line ${r.firstBreak + 1} of [${start}] [${wrong}] — ${JSON.stringify(r.lines.map(l => l.status))}`);
        const code = r.lines[1]?.diagnosis?.code;
        if (!GENERIC.has(code)) coverage.named++; else coverage.generic[generator] = (coverage.generic[generator] || 0) + 1;
        if (rightLine) {
          const later = report(meta, q.prompt, [start, rightLine, wrong]);
          coverage.laterItems++;
          if (later.lines[1].status === 'break' || later.lines[0].status === 'break') fail(`${tag}: a correct line before the slip was flagged: ${JSON.stringify(later.lines.map(l => l.status))}`);
        }
      }
      if (rightLine) {
        coverage.controls++;
        const r = report(meta, q.prompt, [start, rightLine]);
        if (r.firstBreak === -1) coverage.controlsClean++; else fail(`${generator} D${d} seed ${seedOf(i, d, generator)}: correct working [${start}] [${rightLine}] was flagged at line ${r.firstBreak + 1}`);
      }
    }
    (checked ? coverage.withCheck : coverage.noCheck).add(`${generator}|${d}`);
  }
}
ok(coverage.items > 100, `the location sweep ran over ${coverage.items} designed wrong answers`);
ok(coverage.located === coverage.items, `the first flagged line was the wrong one in ${coverage.located} of ${coverage.items} cases`);
ok(coverage.controlsClean === coverage.controls, `correct working was left alone in ${coverage.controlsClean} of ${coverage.controls} cases`);

// ── C · honest coverage ─────────────────────────────────────────────────────
const noCheckTopics = new Set([...coverage.noCheck].map(c => c.split('|')[0]));
const genericTopics = Object.entries(coverage.generic).sort((a, b) => b[1] - a[1]);
const specificCells = catalogue.cells.size;
console.log(`catalogue: ${catalogue.cases} slips over ${catalogue.questions} calculus questions in ${specificCells} cells; every one flagged on the slip line, restatement untouched, and named (${Object.entries(catalogue.byCode).map(([k, v]) => `${k} ${v}`).join(', ')})`);
console.log(`location: ${coverage.located}/${coverage.items} designed wrong answers flagged on the wrong line; ${coverage.controlsClean}/${coverage.controls} correct pages left alone; ${coverage.laterItems} later-slip pages`);
console.log(`specific messages outside calculus: ${coverage.named}/${coverage.items} flagged lines carry a named, specific diagnosis; ${coverage.items - coverage.named} still get a generic or counterexample message`);
console.log(`coverage: of ${coverage.cells} issued cells, ${specificCells} have the calculus catalogue, ${coverage.withCheck.size} more have a Step Check by designed wrong answers, and ${coverage.cells - specificCells - coverage.withCheck.size} have no line-by-line check at all (their working is read but not judged line by line)`);
console.log(`topics with a Step Check still on generic feedback (${genericTopics.length}): ${genericTopics.map(([g, n]) => `${g} ${n}`).join(', ') || 'none'}`);
console.log(`topics with no line-by-line check (${noCheckTopics.size}): ${[...noCheckTopics].sort().join(', ')}`);
console.log(failures.length
  ? `FEEDBACK FIRST-ERROR SWEEP: FAIL — ${failures.length} of ${checks + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `FEEDBACK FIRST-ERROR SWEEP: PASS — ${checks} checks — the restated question is never a slip, the flagged line is the true first wrong line, and every catalogued calculus slip is named. [SYNTHETIC]`);
process.exit(failures.length ? 1 : 0);
