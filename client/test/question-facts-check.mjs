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
  let r = f('The curve $y = 2x(4 - x)$. Find the area bounded by the curve and the x-axis.');
  ok(r.defs.length === 1 && r.defs[0].name === 'y' && r.defs[0].expr === '2x(4-x)' && r.defs[0].variable === null, 'a definition y = expr');
  ok(r.area && r.area.name === 'y', 'the area bounded by the one curve and the x-axis, as the whole prompt');
  r = f('Given $f(x) = x^2 - 4$ and $g(x) = 2x + 1$. Find $f(2) + g(2)$.');
  ok(r.defs.map(d => `${d.name}:${d.variable}:${d.expr}`).join() === 'f:x:x^2-4,g:x:2x+1' && r.area === null, 'two functions with their variable');
  r = f('Let $a = 3, b = 4$. Find $a^2 + b^2$.');
  ok(r.defs.map(d => `${d.name}=${d.expr}`).join() === 'a=3,b=4', 'given numbers introduced by let, listed with commas');
  ok(f('A principal of \\$500 earns interest with $r = 0.05$ per year.').defs[0].name === 'r', 'a dollar sign for money is not a delimiter');
  ok(f('A principal of \\$500 earns interest at $r = 0.05$ per year.') === null, 'a number not introduced by let / where / given / with is not a fact');
  ok(f('$a = 3$') !== null, 'a number that is the whole prompt is a fact');
  // never facts: statements the prompt may make false
  for (const prompt of ['Solve $x^2 - 5x + 6 = 0$.', 'Prove or disprove: $(a + b)^2 = a^2 + b^2$', 'A student writes $\\sqrt{x^2 + 9} = x + 3$. Explain the error.', 'Show that $\\sin 2x = 2\\sin x$ is not an identity.',
    'Verify that $x = 2$ is a root of $x^2 - 4x + 3 = 0$', 'Show that $x = 1.5$ is a solution of $2x + 3 = 11$', 'Test whether $x = 5$ satisfies $2x + 3 = 11$', 'Evaluate $\\frac{1}{0}$ if possible',
    'Differentiate $x^2 \\sin x$.', 'Evaluate $\\int_0^2 x^2\\,dx$.', 'Show that $y = 2x$ is a line.'])
    ok(f(prompt) === null, `no fact: ${prompt.slice(0, 60)}`);
  ok(f('Let $x = 2$. Solve $x^2 - 4x + 3 = 0$.') === null, 'a number that an equation of the prompt is about is not given');
  ok(f('The line $y = 2x$ and the curve $y = x^2$.').defs.length === 2 && f('The line $y = 2x$ and the curve $y = x^2$.').area === null, 'two definitions of y: both listed, no area form');
  ok(f('Find the area bounded by $y = 2x(4 - x)$ and the line $y = x$.')?.area === null, 'a second boundary: no area form');
  ok(f('Find the area bounded by $y = 4 - x^2$ and the x-axis for $x \\ge 0$.')?.area === null, 'a restriction written as maths: no area form');
  ok(f('Find the area bounded by $y = 4 - x^2$ and the x-axis in the first quadrant.')?.area === null, 'a restriction in words: no area form');
  ok(f('Find half the area bounded by $y = 4 - x^2$ and the x-axis.')?.area === null, 'half the area: no area form');
  ok(f('Find the area bounded by $y = 4 - x^2$ and the x-axis.')?.area?.name === 'y' && f('$$y = 4 - x^2$$ Find the area bounded by the curve and the x-axis.')?.area === null, 'the whitelist is the whole prompt: a sentence order it does not list gives none');
  ok(f('The curve $y = 4 - x^2$ crosses the x-axis at two points. Find the area bounded by the curve and the x-axis.')?.area === null, 'another sentence: no area form');
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
