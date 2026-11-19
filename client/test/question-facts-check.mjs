// Pri Learning · what the question's prompt gives (engine/questionFacts.js)
//
// 20 November 2026. The line check reads the facts a student could copy from the screen. This holds the module to that:
//   1  ANSWER SAFETY   the question object is a proxy that throws on every property but `prompt`; the module reads nothing else
//   2  EXTRACTION      definitions, given numbers, equations, integrals, asked expressions and the area form
//   3  NOTHING GUESSED prompts it cannot read give null; the output is plain data and stable
import { questionFacts } from '../src/engine/questionFacts.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

// 1 · only `prompt` is read
{
  const reads = [];
  const secret = new Proxy({ prompt: 'The curve $y = 2x(4 - x)$. Find the area bounded by the curve and the x-axis.' }, {
    get(target, key) { reads.push(String(key)); if (key === 'prompt') return target.prompt; throw new Error(`the question's ${String(key)} was read`); },
    has(_, key) { reads.push(`has:${String(key)}`); throw new Error(`the question's ${String(key)} was probed`); },
    ownKeys() { reads.push('ownKeys'); throw new Error('the question\'s keys were listed'); },
    getOwnPropertyDescriptor(_, key) { reads.push(`descriptor:${String(key)}`); throw new Error(`the question's ${String(key)} was probed`); }
  });
  let facts = null, threw = null;
  try { facts = questionFacts(secret); } catch (e) { threw = e.message; }
  ok(threw === null, `reading the facts touches nothing but the prompt (${threw})`);
  ok(reads.length > 0 && reads.every(k => k === 'prompt'), `the only property read is prompt (${reads.join(',')})`);
  ok(facts && facts.defs.length === 1, 'and the facts are still found');
  // a real question: the answer, steps, traps and hints change nothing
  const base = { prompt: 'Differentiate $x^2 \\sin x$.' };
  const loaded = { ...base, answer: { expr: '2x sin x + x^2 cos x' }, steps: [{ h: 'Product rule', d: '$y\' = 2x\\sin x$' }], traps: ['a'], hints: ['use $u = x^2$'], stepcheck: { kind: 'expression' }, seed: 7 };
  ok(JSON.stringify(questionFacts(base)) === JSON.stringify(questionFacts(loaded)), 'answer, steps, traps, hints and step-check plan change nothing');
  ok(JSON.stringify(questionFacts(loaded)).includes('cos') === false, 'nothing from the solution appears in the facts');
}

// 2 · extraction
{
  const f = prompt => questionFacts({ prompt });
  let r = f('The curve $y = 2x(4 - x)$ crosses the x-axis at two points. Find the area bounded by the curve and the x-axis.');
  ok(r.defs.length === 1 && r.defs[0].name === 'y' && r.defs[0].expr === '2x(4-x)' && r.defs[0].variable === null, 'a definition y = expr');
  ok(r.area && r.area.name === 'y' && r.area.limits.length === 0, 'the area bounded by the one curve and the x-axis');
  r = f('Given $f(x) = x^2 - 4$ and $g(x) = 2x + 1$.');
  ok(r.defs.map(d => `${d.name}:${d.variable}:${d.expr}`).join() === 'f:x:x^2-4,g:x:2x+1' && r.area === null, 'two functions with their variable');
  r = f('Let $a = 3, b = 4$ and $r = 0.05$.');
  ok(r.defs.map(d => `${d.name}=${d.expr}`).join() === 'a=3,b=4,r=0.05', 'given numbers, listed with commas, with a decimal');
  r = f('Solve $x^2 - 5x + 6 = 0$.');
  ok(r.equations.length === 1 && r.equations[0].left === 'x^2-5x+6' && r.defs.length === 0, 'an equation that is not a definition');
  r = f('Evaluate $\\int_0^2 x^2\\,dx$.');
  ok(r.integrals.length === 1 && r.integrals[0].lower === '0' && r.integrals[0].upper === '2' && r.integrals[0].body === 'x^2' && r.integrals[0].variable === 'x' && r.asks.length === 1, 'a definite integral: limits, integrand, variable; asked');
  r = f('The area is $\\int_0^2 x^2\\,dx$ square units.');
  ok(r.integrals.length === 1 && r.asks.length === 0, 'an integral that is not asked about is a fact but not an ask');
  for (const verb of ['Differentiate', 'Integrate', 'Expand', 'Simplify', 'Evaluate']) ok(f(`${verb} $x^2 + 1$.`)?.asks.length === 1, `${verb}: the expression is asked about`);
  ok(f('Show that $x^2 + 1$ is positive.') === null, 'no asking verb: a bare expression is not a fact');
  ok(f('A principal of \\$500 earns interest at $r = 0.05$ per year.').defs[0].name === 'r', 'a dollar sign for money is not a delimiter');
  ok(f('The line $y = 2x$ and the curve $y = x^2$.').defs.length === 2 && f('The line $y = 2x$ and the curve $y = x^2$.').area === null, 'two definitions of y: both listed, no area form');
  ok(f('Find the area bounded by $y = 2x(4 - x)$ and the line $y = x$.')?.area === null, 'a second boundary: no area form');
  ok(f('$$y = 2x(4 - x)$$ Find the area enclosed by the curve and the x-axis.').area?.name === 'y', 'display dollars');
  ok(f('Find the area bounded by $y = 2x(4 - x)$ and the x-axis between $x = 1$ and $x = 3$.').area.limits.length === 2, 'limits named in the prompt are listed, to be checked against the roots');
  ok(f('Find $y$ when $x < 3$ and $y = 2x$.').defs.length === 1, 'an inequality is not a definition');
  ok(f('If $y = 2x$, find $y\'$.').defs.length === 1, 'a prime in another span is ignored');
}

// 3 · nothing guessed
{
  const f = prompt => questionFacts({ prompt });
  ok(f('Explain why the sky is blue.') === null, 'no maths: null');
  ok(f('') === null && f(undefined) === null && f(null) === null && f(5) === null && f({}) === null && questionFacts(null) === null && questionFacts(undefined) === null && questionFacts('y = 2x') === null, 'no prompt: null');
  ok(f('Show that $\\sqrt{\\text{foo}}$ is irrational.') === null, 'TeX the converter cannot read: null');
  ok(f('Describe $\\mathcal{F}$.') === null, 'an unknown command: null');
  ok(f('$y = $') === null, 'a half line: null');
  ok(f('x'.repeat(5000) + ' $y = x$') === null, 'a prompt past the length limit: null');
  const many = f(Array.from({ length: 30 }, (_, k) => `$a${k} = ${k}$`).join(' '));
  ok(many === null || many.defs.length <= 12, 'at most a dozen spans are read');
  const r = f('The curve $y = 2x(4 - x)$.');
  ok(JSON.stringify(r) === JSON.stringify(f('The curve $y = 2x(4 - x)$.')) && JSON.parse(JSON.stringify(r)).defs[0].expr === r.defs[0].expr, 'the same prompt gives the same plain data');
}

console.log(`QUESTION FACTS: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — read from the prompt alone, nothing from the answer or the solution`);
if (fail) process.exit(1);
