// Pri Learning · the plot of a student's own equations is display-only and
// only ever draws what it can draw exactly.
// Usage: node client/test/student-plot-check.mjs
import { plotLineOf, plotSpecFromReading } from '../src/instrument/studentPlot.js';
import { compileFunction } from '../src/engine/plot.js';

let pass = 0; const fails = [];
const ok = (name, cond, detail = '') => { if (cond) pass += 1; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const at = (spec, i, x) => compileFunction(spec.expr)(x);

// y = f(x)
for (const [line, x, want] of [['y = 2x + 3', 4, 11], ['y = x^2 - 5x + 6', 2, 0], ['y = 3', null, null]]) {
  const fn = plotLineOf(line);
  if (want === null) ok(`${line}: a constant with no x is not drawn`, fn === null);
  else ok(`${line}: drawn as itself`, !!fn && Math.abs(at(fn, 0, x) - want) < 1e-9, JSON.stringify(fn));
}
// Linear in x and y → solved for y, exactly.
for (const [line, x, want] of [['x + y = 35', 24, 11], ['x - y = 13', 24, 11], ['2x + 3y = 12', 3, 2], ['3y - 6 = x', 0, 2], ['y + 2(x - 1) = 0', 1, 0]]) {
  const fn = plotLineOf(line);
  ok(`${line}: solved for y`, !!fn && Math.abs(at(fn, 0, x) - want) < 1e-9, JSON.stringify(fn));
}
// Refused: anything it cannot draw exactly.
// Adversarial: zero at whole and half numbers, so a grid-sampled test would
// call them straight lines. They are curves, steps or higher powers.
for (const line of ['2x+y+sin(2*pi*x)=0', 'x+y=floor(2x)/2', 'y*(1+sin(2*pi*x))=x', 'y+x+y*(y-1)*(y-3)*(y-4)=0', 'x+y+x*(x-1)*(x+4)*(2x+3)*(x-3)*(x-9)=0', 'x+y=abs(x)', 'y=x+round(x)-x+y-y']) {
  const fn = plotLineOf(line);
  ok(`"${line}": not drawn as a straight line it is not`, fn === null, JSON.stringify(fn));
}
// Costly operators are never drawn, and nothing takes long.
const heavy = 'y=' + Array.from({ length: 5 }, () => 'sum(k*k*x,k,1,10000)').join('+');
for (const line of ['x+y=' + Array.from({ length: 5 }, () => 'sum(k*k*x,k,1,10000)').join('+'), heavy.slice(0, 120), 'y = 5!', 'y = ncr(30, x)']) {
  ok(`"${line.slice(0, 30)}…": a costly line is not drawn`, plotLineOf(line) === null);
}
{
  const t0 = performance.now();
  plotSpecFromReading([heavy, heavy, heavy, 'x + y = 35', 'x - y = 13']);
  const ms = performance.now() - t0;
  ok('reading five lines, heavy ones included, stays fast', ms < 100, `${ms.toFixed(1)} ms`);
}
for (const line of ['x = 50', '2x = 48', 'x^2 + y^2 = 25', 'xy = 6', 'x + z = 3', 'y^2 = x', 'x + y', '= 5', 'y = ', 'x + y = 3 = 4', 'sin(y) + x = 1', '']) {
  ok(`"${line}": not drawn`, plotLineOf(line) === null, JSON.stringify(plotLineOf(line)));
}
// The pair from the design: two lines that cross at (24, 11).
const pair = plotSpecFromReading([{ text: 'x + y = 35' }, { text: 'x - y = 13' }, { text: '2x = 48' }, { text: 'x = 50' }]);
ok('a simultaneous pair is two lines', pair?.fns.length === 2, JSON.stringify(pair));
ok('they cross where the algebra says', !!pair && Math.abs(at(pair.fns[0], 0, 24) - at(pair.fns[1], 0, 24)) < 1e-9);
ok('lines that are not equations of a curve are left out', pair?.fns.every(f => /y|x/.test(f.label)));
ok('at most three are drawn', plotSpecFromReading(['y = x', 'y = 2x', 'y = 3x', 'y = 4x']).fns.length === 3);
ok('nothing drawable, no plot', plotSpecFromReading(['2x = 48', 'x = 24']) === null);
ok('duplicates are drawn once', plotSpecFromReading(['x + y = 35', 'y = 35 - x']).fns.length === 1);

if (fails.length) { console.log(`STUDENT PLOT: FAIL — ${fails.length} of ${pass + fails.length} checks failed`); for (const f of fails) console.log('  · ' + f); process.exit(1); }
console.log(`STUDENT PLOT: PASS — ${pass}/${pass} checks — only exact y = f(x) and two-variable linear equations are drawn; nothing else is guessed.`);
