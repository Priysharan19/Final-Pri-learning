# Independent computation for value-chain-check.mjs. Reads a JSON list of
# {c, a, fn, m, args} on stdin and prints, for each, the maximum, minimum,
# amplitude, midline and period of h(t) = c + a*fn(pi*t/m) and h(x) for each
# x in args, all computed by SymPy from the PROMPT's parameters (never from the
# generator's own `stepcheck`). Exact rationals/radicals are printed as floats
# only at the end. SymPy is found on PRI_SYMPY_PATH or the normal path.
import json, os, sys
if os.environ.get('PRI_SYMPY_PATH'):
    sys.path.insert(0, os.environ['PRI_SYMPY_PATH'])
import sympy as sp
from sympy.calculus.util import function_range, periodicity

t = sp.symbols('t', real=True)
out = []
for q in json.load(sys.stdin):
    c, a, m = sp.Integer(q['c']), sp.Integer(q['a']), sp.Integer(q['m'])
    f = c + a * (sp.sin if q['fn'] == 'sin' else sp.cos)(sp.pi * t / m)
    rng = function_range(f, t, sp.S.Reals)
    hi, lo = rng.sup, rng.inf
    out.append({
        'max': float(hi), 'min': float(lo), 'amplitude': float((hi - lo) / 2), 'midline': float((hi + lo) / 2),
        'period': float(periodicity(f, t)),
        'at': {str(x): float(sp.nsimplify(f.subs(t, sp.Rational(x))).evalf(30)) for x in q.get('args', [])},
        'same': f"{sp.simplify(f - sp.sympify(q['expr'], locals={'t': t}))}" if q.get('expr') else None,
    })
json.dump(out, sys.stdout)
