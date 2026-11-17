"""Ground truth for the marking benchmark, decided by SymPy alone.

For each item (one worked solution), every line after the first is judged
against the line before it:

  valid      the step preserves meaning (equivalent equation/inequality
             solution set over the reals, or an equal expression)
  implied    an equation step that keeps every solution but may add some
             (e.g. squaring both sides): valid as a step, not as an answer
  invalid    the step changes the meaning (the first such line is the
             first break)
  follows    after the first break, a line that is a valid step from the
             (already wrong) line before it: error carried forward
  unknown    SymPy could neither prove nor disprove; the item is excluded
             from every score until a human adjudicates it

The item is a correct solution when no line is invalid and the final line
matches the key. Nothing here is a human judgement and no number is an
accuracy claim about students; it is synthetic differential evidence.

Usage:  .venv/bin/python truth.py corpus.jsonl > truth.jsonl
"""
import json
import random
import re
import sys

import sympy as sp
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
NAMES = {
    'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan, 'sec': sp.sec, 'csc': sp.csc, 'cosec': sp.csc,
    'cot': sp.cot, 'ln': sp.log, 'log': lambda x: sp.log(x, 10), 'sqrt': sp.sqrt, 'e': sp.E,
    'pi': sp.pi, 'abs': sp.Abs, 'exp': sp.exp, 'theta': sp.Symbol('theta'), 't': sp.Symbol('t'),
}
REL = re.compile(r'(<=|>=|≤|≥|<|>|=)')
RNG = random.Random(20261118)


def norm(text):
    s = str(text).strip()
    for a, b in (('−', '-'), ('×', '*'), ('÷', '/'), ('≤', '<='), ('≥', '>='), ('θ', 'theta'), ('π', 'pi'), ('√', 'sqrt')):
        s = s.replace(a, b)
    return s


def expr(s, local):
    return parse_expr(s, local_dict=local, transformations=TRANSFORMS, evaluate=True)


def parse_line(text, local):
    """Return (rel, lhs, rhs) with rel in {'=', '<', '<=', '>', '>=', None}."""
    s = norm(text)
    parts = REL.split(s)
    if len(parts) == 1:
        return None, expr(s, local), None
    if len(parts) == 3:
        return parts[1], expr(parts[0], local), expr(parts[2], local)
    raise ValueError(f'chained relation not supported: {text}')


def sol_set(rel, lhs, rhs, var):
    if rel == '=':
        S = sp.solveset(sp.Eq(lhs, rhs), var, domain=sp.S.Reals)
        # SymPy solves ln(x) + ln(x-3) = ln(10) as {-2, 5}: keep only the
        # solutions where every log and even root in THIS line is defined.
        if isinstance(S, sp.FiniteSet):
            S = sp.FiniteSet(*[s for s in S if _defined(lhs, {var: s}) and _defined(rhs, {var: s})])
        return S
    ops = {'<': sp.Lt, '<=': sp.Le, '>': sp.Gt, '>=': sp.Ge}
    return sp.solveset(ops[rel](lhs, rhs), var, domain=sp.S.Reals)


def _real(v):
    return abs(v.imag) <= 1e-25 * max(1.0, abs(v.real))


def _defined(e, pts):
    """Every even root has a non-negative real argument and every log a positive
    one at this point: the expression is defined over the reals here (so
    sqrt(x)*sqrt(x+1) at x = -2 is undefined, not 'real by accident')."""
    for node in sp.preorder_traversal(e):
        arg = None
        if isinstance(node, sp.Pow) and node.exp.is_Rational and not node.exp.is_Integer and node.exp.q % 2 == 0:
            arg, strict = node.base, False
        elif isinstance(node, sp.log):
            arg, strict = node.args[0], True
        if arg is None:
            continue
        try:
            v = complex(arg.subs(pts).evalf(30))
        except Exception:
            return False
        if not _real(v) or (v.real <= 0 if strict else v.real < 0):
            return False
    return True


def _undefined_at(lhs, rhs, var, v):
    pts = {var: v}
    for side in (lhs, rhs):
        if side is None:
            continue
        if not _defined(side, pts):
            return True
        try:
            val = side.subs(pts)
            if val.has(sp.zoo, sp.nan, sp.oo, -sp.oo) or val is sp.nan:
                return True
        except Exception:
            return True
    return False


def expr_equal(a, b, syms):
    """True / False / None (unknown), on the REAL domain where both sides are defined.

    Disproof is numeric: 40 random rational points, 40-digit arithmetic; a
    point where either side is undefined or non-real is skipped. Proof is
    symbolic: simplify, trigsimp, log expansion, and finally the same with the
    variables declared positive (the usual school convention for surds and
    logs) when the numeric test found no counterexample on the common domain.
    """
    tested = 0
    for _ in range(40):
        pts = {s: sp.Rational(RNG.randint(-900, 900), RNG.randint(1, 97)) for s in syms}
        if not (_defined(a, pts) and _defined(b, pts)):
            continue
        try:
            va = complex(a.subs(pts).evalf(40))
            vb = complex(b.subs(pts).evalf(40))
        except Exception:
            continue
        if va != va or vb != vb or not _real(va) or not _real(vb):
            continue
        if abs(va) == float('inf') or abs(vb) == float('inf'):
            continue
        tested += 1
        if abs(va.real - vb.real) > 1e-9 * max(1.0, abs(va.real), abs(vb.real)):
            return False
    d = a - b
    try:
        if sp.simplify(d) == 0 or sp.simplify(sp.trigsimp(d)) == 0 or sp.simplify(sp.expand_log(d, force=True)) == 0:
            return True
        if tested >= 8:
            pos = {s: sp.Symbol(s.name, positive=True) for s in syms}
            if sp.simplify(d.xreplace(pos)) == 0 or sp.simplify(sp.powsimp(sp.expand_power_base(d.xreplace(pos), force=True), force=True)) == 0:
                return True
    except Exception:
        return None
    return None


def same_set(A, B):
    """Solution sets compared by VALUE, not by SymPy's printed form."""
    if A == B:
        return True
    if isinstance(A, sp.FiniteSet) and isinstance(B, sp.FiniteSet):
        if len(A) != len(B):
            return False
        left = list(B)
        for x in A:
            hit = next((y for y in left if sp.simplify(x - y) == 0 or abs(complex(sp.N(x - y, 40))) < 1e-30), None)
            if hit is None:
                return False
            left.remove(hit)
        return True
    try:
        return sp.simplify(sp.Complement(A, B)) == sp.S.EmptySet and sp.simplify(sp.Complement(B, A)) == sp.S.EmptySet
    except Exception:
        return False


def subset_by_value(B, A):
    if isinstance(A, sp.FiniteSet) and isinstance(B, sp.FiniteSet):
        return all(any(sp.simplify(x - y) == 0 or abs(complex(sp.N(x - y, 40))) < 1e-30 for y in A) for x in B)
    try:
        return B.is_subset(A)
    except Exception:
        return False


def step(prev, cur, var, syms, kind, item):
    """Judge one step prev -> cur. Returns 'valid' | 'implied' | 'invalid' | 'unknown'."""
    pr, pl, prr = prev
    cr, cl, crr = cur
    if kind == 'derivative':
        target = sp.diff(item['_source'], var)
        ok = expr_equal(cl if cr is None else crr, target, syms)
        return {True: 'valid', False: 'invalid', None: 'unknown'}[ok]
    if pr is None and cr is None:
        ok = expr_equal(pl, cl, syms)
        return {True: 'valid', False: 'invalid', None: 'unknown'}[ok]
    if pr is None or cr is None:
        # An expression chain written as "= ..." lines: compare the right-hand sides.
        a = pl if pr is None else prr
        b = cl if cr is None else crr
        ok = expr_equal(a, b, syms)
        return {True: 'valid', False: 'invalid', None: 'unknown'}[ok]
    if kind == 'identity':
        # Each line restates the identity being worked: compare the working side (rhs of "=" chains).
        ok = expr_equal(prr if pr == '=' else pl, crr if cr == '=' else cl, syms)
        return {True: 'valid', False: 'invalid', None: 'unknown'}[ok]
    try:
        A = sol_set(pr, pl, prr, var)
        B = sol_set(cr, cl, crr, var)
    except Exception:
        return 'unknown'
    if isinstance(A, sp.ConditionSet) or isinstance(B, sp.ConditionSet):
        return 'unknown'
    if same_set(A, B):
        return 'valid'
    # From an equation with no real solution, writing one that has solutions is
    # the error an examiner marks (|3x+2| = -4 -> 3x+2 = -4), even though an
    # empty set is vacuously contained in anything.
    if A == sp.S.EmptySet and B != sp.S.EmptySet:
        # ...unless every new value makes the line before UNDEFINED (a zero
        # denominator, a log or root outside its domain): then it is the usual
        # extraneous root from clearing denominators, an implied step whose
        # error is keeping the root, which the final answer catches.
        if isinstance(B, sp.FiniteSet) and all(_undefined_at(pl, prr, var, v) for v in B):
            return 'implied'
        return 'invalid'
    if pr == '=' and cr == '=' and subset_by_value(A, B):
        return 'implied'
    # Rejecting extraneous roots after checking them: the new set is exactly the
    # true answer and is contained in the previous one.
    want = item.get('_keyset')
    if want is not None and same_set(B, want) and subset_by_value(B, A):
        return 'valid'
    return 'invalid'


def judge(item):
    var = sp.Symbol(item.get('variable', 'x'))
    local = dict(NAMES)
    local[str(var)] = var
    syms = {var}
    for name in item.get('symbols', []):
        local[name] = sp.Symbol(name)
        syms.add(local[name])
    kind = item.get('kind', 'equation')
    try:
        parsed = [parse_line(l, local) for l in item['lines']]
        key0 = item.get('key') or {}
        if 'solutions' in key0:
            item['_keyset'] = sp.FiniteSet(*[expr(norm(str(v)), local) for v in key0['solutions']])
        elif 'set' in key0:
            item['_keyset'] = sol_set(*parse_line(key0['set'], local), var)
        if kind == 'derivative':
            item['_source'] = expr(norm(item['source']), local)
    except Exception as exc:
        return {'id': item['id'], 'status': 'unparseable', 'error': str(exc)[:200]}
    labels = ['given']
    first_break = None
    start = 1
    if kind == 'derivative':
        # Every line claims to be the derivative, including the first.
        v0 = step((None, None, None), parsed[0], var, syms, kind, item)
        labels = [v0]
        if v0 == 'invalid':
            first_break = 0
    for i in range(start, len(parsed)):
        try:
            v = step(parsed[i - 1], parsed[i], var, syms, kind, item)
        except Exception:
            v = 'unknown'
        if kind == 'derivative' and first_break is not None:
            # Each derivative line claims to BE the derivative. After a break:
            # a line equal to the true derivative is a recovery; a line equal to
            # the (wrong) line before it carries the error forward; else invalid.
            if v == 'valid':
                v = 'recovered'
            else:
                same = expr_equal(parsed[i][1] if parsed[i][0] is None else parsed[i][2],
                                  parsed[i - 1][1] if parsed[i - 1][0] is None else parsed[i - 1][2], syms)
                v = 'follows' if same else v
        elif first_break is not None and v in ('valid', 'implied'):
            v = 'follows'
        if v == 'invalid' and first_break is None:
            first_break = i
        labels.append(v)
    if 'unknown' in labels:
        return {'id': item['id'], 'status': 'needs-adjudication', 'labels': labels}
    # Final answer against the key.
    final_ok = None
    key = item.get('key')
    if key is not None:
        rel, l, r = parsed[-1]
        try:
            if 'solutions' in key:
                got = sol_set(rel, l, r, var) if rel else None
                want = sp.FiniteSet(*[expr(norm(str(s)), local) for s in key['solutions']])
                final_ok = same_set(got, want) if got is not None else False
            elif 'set' in key:
                got = sol_set(rel, l, r, var)
                want = sol_set(*parse_line(key['set'], local), var)
                final_ok = same_set(got, want)
            elif 'expr' in key:
                last = l if rel is None else r
                final_ok = expr_equal(last, expr(norm(key['expr']), local), syms)
        except Exception:
            final_ok = None
    if final_ok is None and key is not None:
        return {'id': item['id'], 'status': 'needs-adjudication', 'labels': labels, 'why': 'final answer undecided'}
    correct = first_break is None and (final_ok is not False) and 'implied' not in labels[-1:]
    return {'id': item['id'], 'status': 'judged', 'labels': labels, 'firstBreak': first_break,
            'finalCorrect': final_ok, 'solutionCorrect': bool(correct)}


def main():
    for raw in open(sys.argv[1]):
        raw = raw.strip()
        if raw:
            print(json.dumps(judge(json.loads(raw))))


if __name__ == '__main__':
    main()
