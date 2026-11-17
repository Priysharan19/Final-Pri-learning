// ─────────────────────────────────────────────────────────────────────────────
// "See why it's wrong" — engine/mistakeView.js and components/MistakeGraph.jsx.
//
// 1. Named slips (distribution, sign, index law, fraction, equations) give a
//    verified counterexample: both lines defined and continuous there, and the
//    values differ.
// 2. Every value the graph draws equals evalNumeric of the student's own line at
//    that x — the picture is the expression, not an approximation of it.
// 3. Honesty: an equivalent step, a multi-variable line, an integer variable,
//    trigonometry of unknown angle unit, a removable hole or a jump at the only
//    differing point, and unparseable lines all give null. Nothing is invented.
// 4. i18n entries in English (both editions read it) and Hindi.
// 5. Render: closed by default, a slider with an aria-live readout, the two
//    curves told apart by dash and by name, no edition accent, no animation,
//    feedback only (no network, no grade), and a lazy chunk in QuestionCard.
//
// Run: node client/test/mistake-view-check.mjs   [SYNTHETIC: direct engine + SSR]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mistakeView, liveValues, isContinuousAt, formatValue } from '../src/engine/mistakeView.js';
import { evalNumeric, normalize } from '../src/engine/expr.js';
import { stepCheck } from '../src/engine/checker.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The value a line has at x, by evalNumeric — for an equation, left − right. */
function truth(text, variable, x) {
  const s = normalize(text);
  const env = { [variable]: x };
  if (s.includes('=')) {
    const [l, r] = s.split('=');
    return evalNumeric(`(${l})-(${r})`, env);
  }
  return evalNumeric(s, env);
}

// ── 1 · Named slips ──────────────────────────────────────────────────────────
const SLIPS = [
  // [label, before, yours, kind, x, before value, yours value, message key]
  ['distribution: 3(x−2) → 3x−2', '3(x−2)', '3x−2', 'expression', 0, -6, -2, 'mistake.graph.expression'],
  ['sign slip: 5 − (x+3) → 5 − x + 3', '5 - (x+3)', '5 - x + 3', 'expression', 0, 2, 8, 'mistake.graph.expression'],
  ['sign slip in a product: −2(x−4) → −2x−8', '-2(x-4)', '-2x-8', 'expression', 0, 8, -8, 'mistake.graph.expression'],
  ['index law: (x^2)^3 → x^5', '(x^2)^3', 'x^5', 'expression', 2, 64, 32, 'mistake.graph.expression'],
  ['fraction slip: x/2 + x/3 → 2x/5', 'x/2 + x/3', '2x/5', 'expression', 1, 5 / 6, 0.4, 'mistake.graph.expression'],
  ['square of a sum: (x+1)^2 → x^2+1', '(x+1)^2', 'x^2+1', 'expression', 1, 4, 2, 'mistake.graph.expression'],
  ['equation, sign on transfer: 2x − 5 = 9 → 2x = 9 − 5', '2x - 5 = 9', '2x = 9 - 5', 'equation', 7, 0, 10, 'mistake.graph.equationLost'],
  ['equation, arithmetic: 2x + 4 = 10 → 2x = 14', '2x + 4 = 10', '2x = 14', 'equation', 3, 0, -8, 'mistake.graph.equationLost'],
  ['equation, lost root: x^2 = 4 → x = 2', 'x^2 = 4', 'x = 2', 'equation', -2, 0, -4, 'mistake.graph.equationLost'],
  ['equation, gained root: x = 2 → x^2 = 4 is not a slip it loses; it gains −2', 'x = 2', 'x^2 = 4', 'equation', -2, -4, 0, 'mistake.graph.equationGained'],
  ['equation with ∴: ∴ 3x = 12 → x = 3', '3x = 12', '∴ x = 3', 'equation', 4, 0, 1, 'mistake.graph.equationLost']
];
for (const [label, before, yours, kind, x, bv, yv, key] of SLIPS) {
  const v = mistakeView({ prevText: before, brokenText: yours });
  ok(v !== null, `${label}: a view is returned`);
  if (!v) continue;
  ok(v.kind === kind, `${label}: kind ${kind} (got ${v.kind})`);
  ok(close(v.point.x, x), `${label}: counterexample at x = ${x} (got ${v.point.x})`);
  ok(close(v.point.before, bv) && close(v.point.yours, yv), `${label}: values ${bv} / ${yv} (got ${v.point.before} / ${v.point.yours})`);
  ok(v.message.key === key, `${label}: message ${key} (got ${v.message.key})`);
  ok(v.message.vars.x === formatValue(x) && v.message.vars.before === formatValue(bv) && v.message.vars.yours === formatValue(yv),
    `${label}: the sentence carries the same rounded values`);
  ok(isContinuousAt(v.before.at, v.point.x) && isContinuousAt(v.yours.at, v.point.x), `${label}: both lines are continuous at the marked x`);
  const w = v.window;
  ok(w.xMin <= Math.min(0, x) && w.xMax >= Math.max(0, x), `${label}: the window holds the origin and the marked x`);
  ok(w.yMin <= Math.min(0, bv, yv) && w.yMax >= Math.max(0, bv, yv), `${label}: the window holds both values and 0`);
  ok(w.xMax > w.xMin && w.yMax > w.yMin, `${label}: the window is not empty`);

  // ── 2 · Plotted values equal evalNumeric at the marked x, and everywhere ──
  ok(close(truth(before, v.variable, v.point.x), v.point.before), `${label}: the marked value of the line before is evalNumeric at x`);
  ok(close(truth(yours.replace(/^∴\s*/, ''), v.variable, v.point.x), v.point.yours), `${label}: the marked value of your line is evalNumeric at x`);
  let drawn = 0, agree = 0;
  for (let i = 0; i <= 40; i++) {
    const xi = w.xMin + ((w.xMax - w.xMin) * i) / 40;
    for (const [text, fn] of [[before, v.before.at], [yours.replace(/^∴\s*/, ''), v.yours.at]]) {
      let expect = NaN;
      try { expect = truth(text, v.variable, xi); } catch { /* undefined there */ }
      const got = fn(xi);
      if (!Number.isFinite(expect)) { if (!Number.isFinite(got)) agree++; drawn++; continue; }
      drawn++;
      if (close(got, expect)) agree++;
    }
  }
  ok(drawn > 0 && agree === drawn, `${label}: every drawn sample equals evalNumeric (${agree}/${drawn})`);

  const live = liveValues(v, v.point.x);
  ok(live.vars.before === formatValue(bv) && live.vars.yours === formatValue(yv), `${label}: the live readout at the marked x says the same values`);
  ok(JSON.stringify(mistakeView({ prevText: before, brokenText: yours })) === JSON.stringify(v), `${label}: deterministic`);
}

// ── 3 · Honest nulls ─────────────────────────────────────────────────────────
const NULLS = [
  ['an equivalent expression step', '3(x−2)', '3x−6'],
  ['an equivalent expansion', '(x+1)^2', 'x^2+2x+1'],
  ['an equivalent equation step (scaled)', '2x = 6', 'x = 3'],
  ['an equivalent equation step (moved terms)', '2x + 4 = 10', '2x = 6'],
  ['an equivalent equation rearranged', 'x^2 = 4', 'x^2 - 4 = 0'],
  ['multi-variable', 'x + y', 'xy'],
  ['multi-variable equation', '2x + y = 5', '2x = 5 + y'],
  ['no variable at all', '12 - 4', '12 + 4'],
  ['discontinuity: the lines differ only at a removable hole', '(x^2 - x)/x', 'x - 1'],
  ['discontinuity: differ only where the line before is undefined', '(x^2-4)/(x-2)', 'x + 2'],
  ['trigonometry, angle unit unknown', 'sin(x)^2 + cos(x)^2', '2'],
  ['trigonometry identity slip', 'tan(x)', 'sin(x)'],
  ['factorial (integer variable)', 'n!/(n-1)!', 'n - 1'],
  ['equation against expression', 'x + 1', 'x = 1'],
  ['equations with no real solutions', 'x^2 = -1', 'x^2 = -4'],
  ['unparseable', '3(x−2', '3x−2'],
  ['missing line before', null, '3x−2'],
  ['missing broken line', '3x−2', null],
  ['empty', '', ''],
  // Independent review, head 6e8aba3: each of these was drawn, and each said something false.
  ['the line before has the number put in (2(3)+1 = 7): no x to compare', '2(3)+1=7', 'x=4'],
  ['the line before is a bare identity (7 = 7)', '7=7', 'x=4'],
  ['the line before is an identity in x (1/x = 1/x)', '1/x=1/x', 'x=1'],
  ['the student\'s line is a number (x^2+1 → 2^2+2): a substitution, not a rewrite', 'x^2+1', '2^2+2'],
  ['the student\'s line is an identity (2x = 6 → x + 1 = x + 1)', '2x=6', 'x+1=x+1'],
  ['a rounded root is never called a solution (x^2 = 2 → x = 1.414)', 'x^2=2', 'x=1.414'],
  ['a counterexample too small to write plainly', 'x', 'x+0.00001'],
  ['a square root only at its domain edge', 'sqrt(x-3)=0', 'x=3'],
  ['a pole is not a solution', 'x/(x-1)=1/(x-1)', 'x=1']
];
for (const [label, before, yours] of NULLS) {
  ok(mistakeView({ prevText: before, brokenText: yours }) === null, `null: ${label}`);
}
ok(mistakeView() === null, 'null: no arguments');

// A chain of equals in a simplification is read by its right-hand side, as
// Step Check reads it (checker.js takes the text after the last =), and is
// never presented as an equation with "solutions".
{
  const v = mistakeView({ prevText: '(x+1)^2 = x^2+x+x+1', brokenText: '(x+1)^2 = x^2+1' });
  ok(v && v.kind === 'expression' && v.rhs === true && v.message.key === 'mistake.graph.expression', 'a chain of equals is compared as expressions, by the right-hand side');
  ok(v && v.point.x === 1 && v.point.before === 4 && v.point.yours === 2, 'and at a clean integer, with the right-hand sides\' values');
  const solve = mistakeView({ prevText: '2x + 4 = 10', brokenText: '2x = 14' });
  ok(solve && solve.rhs === false && solve.kind === 'equation', 'an equation that is not an identity is still an equation');
}
// The whole path, with the real Step Check: its report, the client's rule for
// the line above the break (QuestionCard StepReport), then the picture.
function throughStepCheck(meta, working) {
  const lines = stepCheck(meta, working).lines;
  const first = lines.findIndex(l => l.status === 'break');
  const above = first > 0 ? lines[first - 1] : null;
  const prevText = above && above.status === 'ok' && above.check !== true && above.branch !== true ? above.text : null;
  return { first, view: prevText ? mistakeView({ prevText, brokenText: lines[first].text }) : null };
}
{
  const sub = throughStepCheck({ kind: 'equation', variable: 'x', solutions: [3], source: '2x+1=7' }, '2x+1=7\n2(3)+1=7\nx=4');
  ok(sub.first === 2 && sub.view === null, 'real Step Check: a substitution check above the break is never "the line before"');
  const quad = { kind: 'equation', variable: 'x', solutions: [3, 5], source: 'x^2-8x+15=0' };
  const branch = throughStepCheck(quad, 'x^2-8x+15=0\n(x-3)(x-5)=0\nx-3=0\nx=3\nx-5=0\nx=6');
  ok(branch.first === 5 && branch.view === null, 'real Step Check: one branch of a factorisation is never compared as if it were the whole equation');
  const dropped = throughStepCheck(quad, 'x^2-8x+15=0\n(x-3)(x-5)=0\nx=3\nx=6');
  ok(dropped.first === 2 && dropped.view?.message.key === 'mistake.graph.equationLost' && dropped.view.point.x === 5,
    'real Step Check: writing only x = 3 under (x−3)(x−5) = 0 shows the solution it lost, x = 5');
  const chain = throughStepCheck({ kind: 'expression', canonical: 'x^2+2x+1' }, '(x+1)^2 = x^2+x+x+1\n(x+1)^2 = x^2+1');
  ok(chain.first === 1 && chain.view?.kind === 'expression' && chain.view.rhs === true, 'real Step Check: a chain of equals is drawn by its right-hand sides, not as an equation');
  const slip = throughStepCheck({ kind: 'equation', variable: 'x', solutions: [-7], source: '5(x+2)-2=2x-13' }, '5(x+2)-2=2x-13\n5x+2-2=2x-13\n3x=-13');
  ok(slip.first === 1 && slip.view?.message.key === 'mistake.graph.equationLost' && slip.view.point.x === -7, 'real Step Check: a distribution slip shows the lost solution x = −7');
}
// Equation solutions are named only where the shown value is itself a solution.
for (const [a, b] of [['x^2 = 4', 'x = 2'], ['x = 2', 'x^2 = 4'], ['x^3 = x', 'x^2 = 1'], ['sqrt(x) = 2', 'x = -4'], ['(x-0.5)^2 = 0', 'x = 1']]) {
  const v = mistakeView({ prevText: a, brokenText: b });
  const g = v?.message.key === 'mistake.graph.equationLost' ? v.before.at : v?.yours.at;
  ok(v && Number(v.message.vars.x.replace('−', '-')) === v.point.x && Math.abs(g(v.point.x)) < 1e-9,
    `${a} → ${b}: the x named as a solution is exactly the x shown, and solves its line`);
}
ok(mistakeView({ prevText: 'tan(x)', brokenText: 'sin(x)', meta: { angles: 'radians' } }) !== null,
  'trigonometry is drawn only when the caller says angles are radians');

// Continuity at the counterexample, directly.
ok(!isContinuousAt(x => Math.abs(x) / x, 0), 'a jump (|x|/x at 0) is not continuous');
ok(!isContinuousAt(x => 1 / (x - 2), 2), 'a pole (1/(x−2) at 2) is not continuous');
ok(!isContinuousAt(x => (x === 0 ? NaN : (x * x - x) / x), 0), 'a removable hole is not continuous');
ok(!isContinuousAt(x => (x < 1 ? 0 : 1), 1), 'a step function at its step is not continuous');
ok(isContinuousAt(x => x ** 6, 2) && isContinuousAt(x => 3 * x - 2, 0), 'smooth functions are continuous');
// A step whose first differing candidate is a jump moves on to a smooth point.
{
  const v = mistakeView({ prevText: 'abs(x)/x', brokenText: 'abs(x)/x + x' });
  ok(v && v.point.x === 1 && isContinuousAt(v.before.at, v.point.x), 'a jump at x = 0 is skipped for a point where both lines are continuous');
}

// Number formatting.
ok(formatValue(-6) === '−6' && formatValue(0) === '0' && formatValue(5 / 6) === '0.833' && formatValue(0.4) === '0.4', 'values are rounded and signed the way a student writes them');
ok(formatValue(2.9999999999) === '3' && formatValue(NaN) === null, 'float noise is not shown, an undefined value is not a number');
ok(liveValues(mistakeView({ prevText: '1/x + x', brokenText: '1/x' }), 0).vars.before === '—', 'the readout says — where a line is undefined');

// ── 4 · Strings ──────────────────────────────────────────────────────────────
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const KEYS = ['open', 'close', 'expression', 'equationLost', 'equationGained', 'equationNote', 'rhsNote', 'reset', 'yours', 'before', 'at', 'live', 'liveEquation', 'marker', 'howTo', 'figure', 'feedbackOnly'].map(k => `mistake.graph.${k}`);
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
for (const k of KEYS) {
  ok(typeof en[k] === 'string' && en[k].length > 0, `en (Priyabhata and Prithagoras) has ${k}`);
  ok(typeof hi[k] === 'string' && hi[k] !== en[k], `hi has its own ${k}`);
  ok(holes(en[k]) === holes(hi[k]), `${k}: the same placeholders in en and hi`);
}
ok(/At \{variable\} = \{x\} your line gives \{yours\}, but the line before gives \{before\}\./.test(en['mistake.graph.expression']), 'the English sentence names both values');
ok(!/\b(color|colour)\b/i.test(KEYS.map(k => en[k]).join(' ')), 'no string tells the curves apart by colour');

// ── 5 · Render ───────────────────────────────────────────────────────────────
const root = fileURLToPath(new URL('..', import.meta.url));
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const mod = await server.ssrLoadModule('/src/components/MistakeGraph.jsx');
  const engine = await server.ssrLoadModule('/src/engine/mistakeView.js');
  const h = React.createElement;
  await i18n.setLanguage('en');

  const closed = renderToStaticMarkup(h(mod.default, { prevText: '3(x−2)', brokenText: '3x−2' }));
  ok(/data-mistake-graph="expression"/.test(closed) && /aria-expanded="false"/.test(closed), 'closed by default, with a disclosure button');
  ok(closed.includes('See why it’s wrong') && !/<svg viewBox="0 0 600/.test(closed), 'closed, it shows the button and draws no graph');
  ok(renderToStaticMarkup(h(mod.default, { prevText: '3(x−2)', brokenText: '3x−6' })) === '', 'an equivalent step renders nothing');
  ok(renderToStaticMarkup(h(mod.default, { prevText: 'x + y', brokenText: 'xy' })) === '', 'a multi-variable step renders nothing');

  const view = engine.mistakeView({ prevText: '3(x−2)', brokenText: '3x−2' });
  const open = renderToStaticMarkup(h(mod.MistakeGraphView, { view }));
  ok(open.includes('At x = 0 your line gives −2, but the line before gives −6.'), 'open, it says the counterexample in words');
  ok(/role="slider"/.test(open) && /tabindex="0"/.test(open) && /aria-valuetext="At x = 0"/.test(open), 'the marker is a focusable slider whose value is spoken briefly');
  ok(/aria-live="polite"[^>]*>At x = 0: your line gives −2, the line before gives −6\./.test(open), 'the live region says both values, once');
  ok(/aria-live="polite"/.test(open), 'an aria-live region carries the live values');
  ok((open.match(/data-curve="before"/g) || []).length >= 1 && (open.match(/data-curve="yours"/g) || []).length >= 1, 'both curves are drawn');
  ok(/data-curve="yours"[^>]*stroke-dasharray="9 6"|stroke-dasharray="9 6"[^>]*data-curve="yours"/.test(open), 'your line is dashed');
  ok(!/data-curve="before"[^>]*stroke-dasharray|stroke-dasharray[^>]*data-curve="before"/.test(open), 'the line before is solid');
  ok(open.includes('Your line') && open.includes('Line before') && open.includes('3x−2') && open.includes('3(x−2)'), 'each curve is named and shows its line');
  ok(/data-mistake-marker="0"/.test(open), 'the marker starts at the counterexample');
  ok(open.includes('It does not change your mark.'), 'it says it is feedback only');

  const eqView = engine.mistakeView({ prevText: '2x - 5 = 9', brokenText: '2x = 9 - 5' });
  const eqOpen = renderToStaticMarkup(h(mod.MistakeGraphView, { view: eqView }));
  ok(eqOpen.includes('left side minus its right side'), 'an equation explains that each line is drawn as left − right');

  await i18n.setLanguage('hi');
  const hiOpen = renderToStaticMarkup(h(mod.MistakeGraphView, { view }));
  ok(hiOpen.includes('x = 0 पर आपकी पंक्ति −2 देती है'), 'Hindi renders the same values in Hindi');
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

// ── Static guarantees ────────────────────────────────────────────────────────
const card = read('src/components/QuestionCard.jsx');
const comp = read('src/components/MistakeGraph.jsx');
const css = read('src/components/MistakeGraph.css');
const eng = read('src/engine/mistakeView.js');
ok(/const MistakeGraph = React\.lazy\(\(\) => import\('\.\/MistakeGraph\.jsx'\)\.catch\(/.test(card), 'QuestionCard loads the graph as its own lazy chunk, and a failed load shows nothing');
ok(!/^import .*MistakeGraph/m.test(card), 'QuestionCard never imports the graph statically');
ok(/<MistakeGraph prevText=\{beforeFirst\} brokenText=\{l\.text\} \/>/.test(card) && /i === first && typeof beforeFirst === 'string'/.test(card), 'it is drawn only at the first break, against the last accepted line');
const code = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
ok(!/api|fetch\(|grade|verdict|receipt|credit|setState\(.*res/i.test(code), 'the component touches no network, grade, verdict, receipt or credit');
ok(!/from '\.\.\/(api|platform|tutor)/.test(comp), 'the component imports nothing from the network or tutor layers');
ok([...eng.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]).sort().join() === './expr.js,./plot.js', 'the engine reads only expr.js and plot.js');
ok(!/edition-accent|au-light|brand-prime/.test(css + comp.replace(/^\/\/.*$/gm, '')), 'no edition accent on the plot (editions decision: never charts or plots)');
ok(!/(^|[^-])(transition|animation)\s*:/m.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}\s*\}/, '')), 'no transition or animation outside the reduced-motion guard');
ok(/prefers-reduced-motion: reduce/.test(css), 'and the reduced-motion guard is there');
ok(/:focus-visible \{ outline: 2px solid var\(--ink\)/.test(css), 'the focus ring is ink (Lit Instrument D2)');
ok(/class GraphBoundary extends React\.Component/.test(comp) && /getDerivedStateFromError\(\) \{ return \{ failed: true \}; \}/.test(comp)
  && /return <GraphBoundary><Disclosure \{\.\.\.props\} \/><\/GraphBoundary>;/.test(comp), 'a failure inside the graph renders nothing and leaves the card standing');
ok(/const above = first > 0 \? report\.lines\[first - 1\] : null;/.test(card)
  && /above\.status === 'ok' && above\.check !== true && above\.branch !== true/.test(card),
  'the graph compares only with the line directly above the break, an accepted step that is not a check or a branch');
ok(/else if \(e\.key === 'Home'\) next = win\.xMin;/.test(comp) && /data-mistake-reset/.test(comp), 'Home and End are the slider\'s ends; going back to the counterexample is its own button');

if (failures.length) {
  console.error(`MISTAKE VIEW: FAIL — ${failures.length} failed, ${pass} passed`);
  for (const f of failures) console.error('  ✗', f);
  process.exit(1);
}
console.log(`MISTAKE VIEW: PASS — ${pass}/${pass} checks`);
