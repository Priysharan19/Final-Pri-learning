#!/usr/bin/env node
// Pri Learning · SymPy differential for exponential/logarithmic solution sets
// (offline lab tooling; not part of npm test, not shipped).
//
// Generates random exponential and logarithmic equation lines from a fixed
// seed, asks the engine (client/src/engine/reason-explog.js) for each line's
// complete real solution set, and compares every set the engine decides with
// SymPy's solveset over the reals, filtered by the real domain (every log
// argument > 0). The engine is allowed to abstain; it is never allowed to
// disagree.
//
//   node tools/explog-sympy-differential.mjs <python-with-sympy> [--n=600] [--seed=12345]
//
// The python must have sympy installed (e.g. the tools/math-oracle venv). It is
// run with -I and reads the generated lines from stdin. Exit code 1 on any
// disagreement.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parse, normalize } = await import(join(ROOT, 'client/src/engine/expr.js'));
const { expLogSolutionSet } = await import(join(ROOT, 'client/src/engine/reason-explog.js'));

const python = process.argv[2];
if (!python || python.startsWith('--')) { console.error('usage: node tools/explog-sympy-differential.mjs <python-with-sympy> [--n=600] [--seed=12345]'); process.exit(2); }
const arg = (name, dflt) => Number((process.argv.find(a => a.startsWith(`--${name}=`)) || `=${dflt}`).split('=')[1]);
const N = arg('n', 600);
let seed = arg('seed', 12345);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[ri(0, a.length - 1)];
const lin = () => { const p = pick([1, 2, 3, -1, -2]); const q = ri(-4, 4); return q === 0 ? `${p}*x` : `${p}*x${q > 0 ? '+' : ''}${q}`; };
const FAMILIES = [
  () => `${pick([2, 3, 5, 10])}^(${lin()})=${ri(-3, 200)}`,
  () => { const b = pick([2, 3]); return `${b}^(2*x)${pick(['+', '-'])}${ri(1, 9)}*${b}^x${pick(['+', '-'])}${ri(1, 20)}=0`; },
  () => `${pick([4, 9, 8])}^x=${pick([2, 3])}^(${lin()})`,
  () => `e^(${lin()})=${ri(1, 30)}`,
  () => `${ri(1, 5)}*${pick([2, 3, 5])}^(x+${ri(0, 3)})=${ri(1, 300)}`,
  () => `ln(${lin()})=${ri(-2, 4)}`,
  () => `log(${lin()})+log(${lin()})=${ri(0, 3)}`,
  () => `ln(${lin()})-ln(${lin()})=ln(${ri(1, 9)})`,
  () => `${ri(1, 3)}*ln(x)=ln(${ri(1, 50)})`,
  () => `ln(x^2${pick(['+', '-'])}${ri(1, 9)})=ln(${ri(1, 40)})`,
  () => `ln(x)+ln(x${pick(['+', '-'])}${ri(1, 6)})=ln(${ri(1, 40)})`,
  () => `ln((${lin()})/(${lin()}))=${ri(-1, 2)}`,
  () => `log(x^2)=${ri(0, 3)}`,
  () => `x*ln(${ri(2, 9)})=ln(${ri(2, 90)})`,
  // Families the engine must abstain on:
  () => `2^x+3^x=${ri(2, 40)}`,
  () => `x*2^x=${ri(1, 40)}`,
  () => `ln(x)=x-${ri(1, 4)}`,
];
const lines = [];
for (let i = 0; i < N; i++) {
  const text = pick(FAMILIES)();
  let set = null;
  try { set = expLogSolutionSet(parse(normalize(text)), 'x', []); } catch { set = null; }
  lines.push({ text, engine: set ? set.roots : null });
}

const PY = String.raw`
import json, sys
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
x = sp.symbols('x', real=True)
T = standard_transformations + (implicit_multiplication_application, convert_xor)
loc = {'x': x, 'e': sp.E, 'ln': sp.log, 'log': lambda a: sp.log(a, 10), 'exp': sp.exp}
agree = disagree = undecided = abstained = 0
bad = []
for line in sys.stdin:
    o = json.loads(line)
    if o['engine'] is None:
        abstained += 1
        continue
    l, r = o['text'].split('=')
    try:
        eq = parse_expr(l, local_dict=loc, transformations=T) - parse_expr(r, local_dict=loc, transformations=T)
        s = sp.solveset(eq, x, sp.S.Reals)
        if s == sp.S.EmptySet:
            s = []
        elif not isinstance(s, sp.FiniteSet):
            undecided += 1
            continue
        vals = sorted(float(sp.N(v, 30)) for v in s)
        vals = [v for v in vals if all(sp.N(a.args[0].subs(x, v)) > 0 for a in eq.atoms(sp.log))]
    except Exception:
        undecided += 1
        continue
    e = sorted(o['engine'])
    if len(e) == len(vals) and all(abs(a - b) <= 1e-7 * max(1, abs(b)) for a, b in zip(e, vals)):
        agree += 1
    else:
        disagree += 1
        bad.append({'text': o['text'], 'engine': e, 'sympy': vals})
print(json.dumps({'lines': agree + disagree + undecided + abstained, 'engineDecided': agree + disagree + undecided,
                  'agree': agree, 'disagree': disagree, 'sympyUndecided': undecided, 'engineAbstained': abstained, 'disagreements': bad[:20]}))
`;
const run = spawnSync(python, ['-I', '-c', PY], { input: lines.map(l => JSON.stringify(l)).join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 26 });
if (run.status !== 0) { console.error(run.stderr || run.error); process.exit(2); }
const result = JSON.parse(run.stdout.trim().split('\n').pop());
console.log(JSON.stringify(result, null, 1));
process.exit(result.disagree ? 1 : 0);
