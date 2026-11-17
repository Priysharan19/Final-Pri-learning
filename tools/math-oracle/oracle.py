#!/usr/bin/env python3
"""Pri Learning · Mathematical intelligence lab · SymPy differential oracle.

Python side. It never imports the engine and the engine never imports it:

  candidates  questions.jsonl          -> candidates.jsonl
              For every drawn question, writes answers a student could submit:
              the key and its equivalent forms, the known slips (sign,
              distribution, index laws, a dropped constant of integration,
              a lost ± root, …) and adversarial near-misses.

  judge       questions.jsonl candidates.jsonl verdicts.jsonl --json=… --md=…
              SymPy decides, independently of the engine, whether each
              candidate equals the key, and every disagreement with the
              engine's verdict is classified:

                FALSE_CREDIT      engine accepts, SymPy proves it is not equal
                                  (beyond any declared tolerance): release-blocking
                FALSE_REJECTION   engine refuses, SymPy proves it equal and no
                                  declared form rule explains the refusal
                SYMPY_UNABLE      SymPy could not decide (parse, timeout,
                                  undecided simplification)

              plus the policy buckets that are not defects but are reported so
              they stay visible (form rules, approximation bands, domain rules,
              the constant of integration).

Offline tooling only. Python is never added to the Railway runtime or the
client, and nothing here sets a mark: the engine is the authority, this oracle
measures it. Numerical substitution is used only to *disprove* equality
(research: MATH_TRUTH_FIRST_BREAK §24); equality is always symbolic or exact.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import signal
import sys
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, getcontext
from fractions import Fraction

import sympy as sp
from sympy.parsing.sympy_parser import (convert_xor, implicit_multiplication_application,
                                        parse_expr, rationalize, standard_transformations)

getcontext().prec = 60
# rationalize: a decimal the student writes is the exact rational it names (0.1 is 1/10, not a binary float).
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor, rationalize)
_X = sp.Symbol('_x')
# The engine's function names, mapped to their mathematical meaning (expr.js
# FUNCTIONS). Note `log` is base 10 there, not natural, and `e` is Euler's number.
LOCALS = {
    'e': sp.E, 'pi': sp.pi, 'ln': sp.log, 'log': sp.Lambda(_X, sp.log(_X, 10)), 'log10': sp.Lambda(_X, sp.log(_X, 10)),
    'log2': sp.Lambda(_X, sp.log(_X, 2)), 'sqrt': sp.sqrt, 'cbrt': sp.Lambda(_X, sp.real_root(_X, 3)), 'abs': sp.Abs,
    'exp': sp.exp, 'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan, 'sec': sp.sec, 'cosec': sp.csc, 'csc': sp.csc,
    'cot': sp.cot, 'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan, 'arcsin': sp.asin, 'arccos': sp.acos,
    'arctan': sp.atan,
}
SAMPLE_SET_0 = [0.7, 1.3, -0.6, 2.1, -1.7, 0.35, 3.4, -2.3]   # documented in expr.js; used only by one labelled adversary


class Timeout(Exception):
    pass


def _alarm(_s, _f):
    raise Timeout()


# ── Parsing (engine syntax -> SymPy) ─────────────────────────────────────────
def normalise(s: str) -> str:
    s = str(s).strip()
    for a, b in (('−', '-'), ('–', '-'), ('×', '*'), ('·', '*'), ('÷', '/'), ('π', 'pi'), ('²', '^2'), ('³', '^3')):
        s = s.replace(a, b)
    s = re.sub(r'√\s*\(', 'sqrt(', s)
    s = re.sub(r'√\s*(\d+(?:\.\d+)?|[a-z])', r'sqrt(\1)', s)
    s = s.rstrip('.').strip()
    # 2x, 0x, 3(x+1): the engine's implicit product. Written explicitly so the
    # Python tokeniser never reads "0x…" as a hexadecimal literal.
    s = re.sub(r'(?<![\w.])(\d+(?:\.\d+)?)(?=[A-Za-z(])', r'\1*', s)
    if re.fullmatch(r'[+-]?\d{1,3}(,\d{3})+(\.\d+)?', s):        # 1,234 is one number
        s = s.replace(',', '')
    return s


def parse(s: str, positive=False):
    """Parse one engine-syntax expression; letters become real (or positive) symbols."""
    t = normalise(s)
    t = re.sub(r'^\+', '', t)
    m = re.fullmatch(r'([+-]?)\s*(\d+)\s+(\d+)\s*/\s*(\d+)', t)    # a mixed number, 1 1/2
    if m:
        v = int(m.group(2)) + sp.Rational(int(m.group(3)), int(m.group(4)))
        return -v if m.group(1) == '-' else v
    e = parse_expr(t, local_dict=dict(LOCALS), transformations=TRANSFORMS, evaluate=True)
    subs = {sym: sp.Symbol(sym.name, positive=True) if positive else sp.Symbol(sym.name, real=True) for sym in e.free_symbols}
    return e.xreplace(subs)


def to_engine(e) -> str:
    """Print a SymPy expression in the engine's input syntax."""
    s = sp.sstr(e)
    s = s.replace('**', '^').replace('exp(', 'e^(').replace('log(', 'ln(').replace('Abs(', 'abs(')
    s = re.sub(r'\bE\b', 'e', s)
    return s


# ── Exact keys ───────────────────────────────────────────────────────────────
CONSTANTS = [sp.pi, sp.E, sp.sqrt(2), sp.sqrt(3), sp.sqrt(5), sp.sqrt(6), sp.sqrt(7), sp.sqrt(10), sp.sqrt(11), sp.sqrt(13)]


def sig_digits(r: str) -> int:
    d = re.sub(r'[eE].*$', '', r).replace('-', '').replace('.', '').lstrip('0')
    return len(d)


def exact_key(key: dict):
    """The exact value of a numeric key and how it is known: authored | decimal | recovered | float."""
    if key.get('simplestFraction'):
        f = key['simplestFraction']
        return sp.Rational(int(f['n']), int(f['d'])), 'authored'
    if key.get('surdForm'):
        f = key['surdForm']
        return sp.Integer(f['k']) * sp.sqrt(f['r']), 'authored'
    v = key.get('value')
    if key.get('canonicalInput'):
        try:
            c = parse(key['canonicalInput'])
            if v is None or abs(float(c) - float(v)) <= 1e-9 * max(1, abs(float(v))):
                return sp.nsimplify(c), 'authored'
        except Exception:
            pass
    if v is None or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None, 'none'
    r = repr(float(v)) if not isinstance(v, int) else str(v)
    if isinstance(v, int) or float(v).is_integer():
        return sp.Integer(int(v)), 'decimal'
    if sig_digits(r) <= 10:
        return sp.Rational(r), 'decimal'
    try:
        g = sp.nsimplify(v, CONSTANTS, tolerance=1e-13, rational=False)
        if sp.count_ops(g) <= 14 and abs(float(g) - v) <= 1e-12 * max(1, abs(v)):
            return g, 'recovered'
    except Exception:
        pass
    return sp.Float(r, 30), 'float'


def decimal_of(e, places: int, mode=ROUND_HALF_UP) -> str:
    d = Decimal(str(sp.N(e, 50)))
    q = d.quantize(Decimal(1).scaleb(-places), rounding=mode)
    return format(q, 'f')


def terminating(e) -> str | None:
    if isinstance(e, sp.Rational):
        den = int(e.q)
        while den % 2 == 0:
            den //= 2
        while den % 5 == 0:
            den //= 5
        if den == 1:
            return format(Decimal(int(e.p)) / Decimal(int(e.q)), 'f').rstrip('0').rstrip('.') if not e.is_integer else str(int(e))
    return None


# ── Candidate generation ─────────────────────────────────────────────────────
def numeric_candidates(K, known):
    out = []
    add = lambda fam, label, s: out.append((fam, label, s))
    exact = known in ('authored', 'decimal', 'recovered')
    canon = to_engine(K) if exact else repr(float(K))
    add('correct', 'canonical', canon)
    t = terminating(K) if exact else None
    if t and t != canon:
        add('correct', 'terminating-decimal', t)
    if exact and isinstance(K, sp.Rational) and not K.is_integer:
        p, q = int(K.p), int(K.q)
        add('correct', 'unsimplified-fraction', f'{2 * p}/{2 * q}')
        if p < 0:
            add('correct', 'negative-numerator-bracketed', f'({p})/{q}')
        if abs(p) > q:
            w, r = divmod(abs(p), q)
            add('correct', 'mixed-number', f"{'-' if p < 0 else ''}{w} {r}/{q}")
    if exact and isinstance(K, sp.Mul) and any(isinstance(a, sp.Pow) and a.exp == sp.S.Half for a in K.args):
        k, rest = K.as_coeff_Mul()
        if isinstance(rest, sp.Pow) and rest.exp == sp.S.Half and k.is_Integer and abs(k) > 1:
            add('correct', 'surd-unsimplified', f"{'-' if k < 0 else ''}sqrt({int(k * k * rest.base)})")
            add('correct', 'surd-explicit-times', f'{int(k)}*sqrt({int(rest.base)})')
    if exact and K != 0:
        add('correct', 'leading-plus', '+' + canon if not canon.startswith('-') else canon)
    if not t:
        for p in (2, 3, 4, 6, 8, 9, 10, 12):
            add('approximation', f'rounded-{p}dp', decimal_of(K, p))
        add('slip', 'truncated-not-rounded-2dp', decimal_of(K, 2, ROUND_DOWN)) if decimal_of(K, 2, ROUND_DOWN) != decimal_of(K, 2) else None
        add('slip', 'wrong-last-digit-2dp', format(Decimal(decimal_of(K, 2)) + Decimal('0.01'), 'f'))
    # known slips
    if K != 0:
        add('slip', 'sign', to_engine(-K) if exact else repr(-float(K)))
    for label, f in (('plus-one', lambda k: k + 1), ('minus-one', lambda k: k - 1), ('times-ten', lambda k: 10 * k),
                     ('over-ten', lambda k: k / 10), ('double', lambda k: 2 * k), ('half', lambda k: k / 2)):
        v = f(K)
        add('slip', label, to_engine(sp.nsimplify(v)) if exact else repr(float(v)))
    if K not in (0, 1, -1):
        add('slip', 'reciprocal', to_engine(1 / K) if exact else repr(1 / float(K)))
        add('slip', 'square', to_engine(K ** 2) if exact else repr(float(K) ** 2))
    if exact and isinstance(K, sp.Rational) and not K.is_integer:
        add('slip', 'numerator-plus-denominator', f'{int(K.p) + int(K.q)}/{int(K.q)}')
    # adversarial near-misses
    base = Decimal(str(sp.N(K, 40)))
    for label, delta in (('near-miss-abs-1e-6', Decimal('1e-6')), ('near-miss-abs-1e-10', Decimal('1e-10')),
                         ('near-miss-abs-1e-13', Decimal('1e-13'))):
        add('adversarial', label, format((base + delta).quantize(Decimal('1e-15')), 'f').rstrip('0').rstrip('.'))
    add('adversarial', 'near-miss-rel-1e-5', format((base * (1 + Decimal('1e-5'))).quantize(Decimal('1e-15')), 'f').rstrip('0').rstrip('.'))
    add('adversarial', 'near-miss-rel-5e-5', format((base * (1 + Decimal('5e-5'))).quantize(Decimal('1e-15')), 'f').rstrip('0').rstrip('.'))
    add('adversarial', 'unevaluated-plus-zero', f'{canon} + 0')
    if exact and K.is_integer and abs(int(K)) >= 1000:
        add('correct', 'thousands-separator', f'{int(K):,}')
    return out


def set_candidates(vals):
    out = []
    add = lambda fam, label, s: out.append((fam, label, s))
    E = [exact_key({'value': v})[0] for v in vals]
    S = lambda xs: ', '.join(to_engine(x) for x in xs)
    add('correct', 'canonical', S(E))
    if len(E) > 1:
        add('correct', 'reversed-order', S(E[::-1]))
        add('correct', 'braces', '{' + S(E) + '}')
        add('correct', 'x-equals-or', ' or '.join(f'x = {to_engine(x)}' for x in E))
        add('slip', 'dropped-one-root', S(E[:1]))
        add('slip', 'duplicated-root', S([E[0]] * len(E)))
        if any(x != 0 for x in E):
            nz = [x for x in E if x > 0]
            if nz and any(sp.simplify(a + b) == 0 for a in E for b in E if a is not b):
                add('slip', 'lost-plus-minus-root', S(nz))
    add('slip', 'sign-of-one-root', S([-E[0]] + E[1:]) if E[0] != 0 else S([E[0] + 1] + E[1:]))
    add('slip', 'extra-root', S(E + [E[0] + 1]))
    add('slip', 'each-plus-one', S([x + 1 for x in E]))
    nm = Decimal(str(sp.N(E[0], 40))) + Decimal('1e-6')
    add('adversarial', 'near-miss-one-root-1e-6', ', '.join([format(nm.quantize(Decimal('1e-15')), 'f').rstrip('0').rstrip('.')] + [to_engine(x) for x in E[1:]]))
    return out


def point_candidates(x, y):
    X, Y = exact_key({'value': x})[0], exact_key({'value': y})[0]
    P = lambda a, b: f'({to_engine(a)}, {to_engine(b)})'
    out = [('correct', 'canonical', P(X, Y)), ('correct', 'no-space', f'({to_engine(X)},{to_engine(Y)})')]
    if X != Y:
        out.append(('slip', 'swapped-coordinates', P(Y, X)))
    if X != 0:
        out.append(('slip', 'sign-of-x', P(-X, Y)))
    if Y != 0:
        out.append(('slip', 'sign-of-y', P(X, -Y)))
    nm = Decimal(str(sp.N(X, 40))) + Decimal('1e-6')
    out.append(('adversarial', 'near-miss-x-1e-6', f"({format(nm.quantize(Decimal('1e-15')), 'f').rstrip('0').rstrip('.')}, {to_engine(Y)})"))
    return out


def _terms(e):
    return list(sp.Add.make_args(sp.expand(e)))


def expression_candidates(key):
    pos = bool(key.get('positiveOnly'))
    K = parse(key['expr'], positive=pos)
    out = []
    add = lambda fam, label, s: out.append((fam, label, s))
    add('correct', 'key-as-authored', key['expr'])
    syms = sorted(K.free_symbols, key=lambda s: s.name)
    ex, fa = sp.expand(K), sp.factor(K)
    add('correct', 'expanded', to_engine(ex))
    if fa != ex:
        add('correct', 'factorised', to_engine(fa))
    tg = sp.together(K)
    if tg not in (ex, fa):
        add('correct', 'single-fraction', to_engine(tg))
    if any(isinstance(a, sp.Pow) and a.exp.is_negative for a in sp.preorder_traversal(K)):
        add('correct', 'negative-index-as-fraction', to_engine(sp.simplify(K)))
    if pos and K.has(sp.log):
        add('domain', 'log-power-rule', to_engine(sp.expand_log(K, force=True)))
    # Slips
    terms = _terms(K)
    if len(terms) > 1:
        for i in range(min(2, len(terms))):
            add('slip', f'sign-of-term-{i + 1}', to_engine(sp.Add(*[(-t if j == i else t) for j, t in enumerate(terms)])))
        add('slip', 'dropped-term', to_engine(sp.Add(*terms[:-1])))
    # distribute-partial: c·(a + b) written c·a + b
    for node in sp.preorder_traversal(fa if fa != ex else K):
        if isinstance(node, sp.Mul):
            c, rest = node.as_coeff_Mul()
            add_parts = [a for a in sp.Mul.make_args(rest) if isinstance(a, sp.Add)]
            if add_parts and c not in (1, -1):
                inner = add_parts[0]
                first, *others = sp.Add.make_args(inner)
                partial = c * first + sp.Add(*others)
                other_factors = sp.Mul(*[a for a in sp.Mul.make_args(rest) if a is not inner])
                whole = K.xreplace({node: other_factors * partial}) if node in sp.preorder_traversal(K) else other_factors * partial
                add('slip', 'distribute-partial', to_engine(whole))
                break
    # index-law slips: x^m·x^n -> x^(mn); a power's index off by one
    for node in sp.preorder_traversal(K):
        if isinstance(node, sp.Pow) and node.exp.is_Integer and abs(node.exp) >= 2:
            m = int(node.exp)
            add('slip', 'index-off-by-one', to_engine(K.xreplace({node: node.base ** (m + 1)})))
            if m % 2 == 0 and m > 2:
                add('slip', 'index-multiplied-not-added', to_engine(K.xreplace({node: node.base ** ((m // 2) * (m // 2))})))
            break
    if syms:
        add('slip', 'coefficient-doubled', to_engine(2 * K))
    if key.get('stripC'):
        add('integration', 'with-constant-C', key['expr'] + ' + C')
        add('integration', 'with-constant-c', key['expr'] + ' + c')
        add('integration', 'dropped-constant-of-integration', key['expr'])
        add('integration', 'specific-constant-5', key['expr'] + ' + 5')
        add('integration', 'constant-named-k', key['expr'] + ' + k')
        if syms:
            x = syms[0]
            add('slip', 'differentiated-not-integrated', to_engine(sp.diff(K, x)))
    # Adversarial near-misses
    if syms:
        x = syms[0]
        add('adversarial', 'plus-1e-7-x', to_engine(K) + f' + 0.0000001*{x.name}')
        add('adversarial', 'plus-1e-5-x', to_engine(K) + f' + 0.00001*{x.name}')
        add('adversarial', 'plus-1e-3', to_engine(K) + ' + 0.001')
        add('adversarial', 'removable-hole', f'({to_engine(K)})*{x.name}/{x.name}')
        prod = '*'.join(f'({x.name} - ({s}))' for s in SAMPLE_SET_0)
        add('adversarial', 'sampling-aware-degree-8', f'{to_engine(K)} + {prod}')
        if not pos:
            add('domain', 'sqrt-of-square', f'({to_engine(K)}) + sqrt({x.name}^2) - {x.name}')
    return out


def cmd_candidates(a):
    n = 0
    with open(a.questions) as f, open(a.out, 'w') as w:
        for line in f:
            q = json.loads(line)
            k = q['key']
            try:
                if q.get('corpus'):
                    cands = [tuple(c) for c in q['corpus']['candidates']]
                elif q['type'] == 'numeric':
                    K, known = exact_key(k)
                    if K is None:
                        continue
                    cands = numeric_candidates(K, known)
                elif q['type'] == 'set':
                    cands = set_candidates(k['values'])
                elif q['type'] == 'point':
                    cands = point_candidates(k['x'], k['y'])
                elif q['type'] == 'expression':
                    cands = expression_candidates(k)
                else:
                    continue
            except Exception as err:  # a key SymPy cannot read is itself a finding
                cands = [('unable', f'key-unparsed:{type(err).__name__}', str(k.get('expr') or k.get('value')))]
            seen = set()
            for fam, label, s in cands:
                if s in seen:
                    continue
                seen.add(s)
                n += 1
                w.write(json.dumps({'cid': f"{q['qid']}#{len(seen)}", 'qid': q['qid'], 'family': fam, 'label': label, 'input': s}) + '\n')
    print(f'candidates: {n} → {a.out}', file=sys.stderr)


# ── Judging ──────────────────────────────────────────────────────────────────
def nonzero_proved(d) -> bool | None:
    """True if a numeric expression is provably non-zero, False if provably zero, None if undecided."""
    if d.is_Rational:
        return d != 0
    z = sp.simplify(d)
    if z == 0:
        return False
    v = sp.N(z, 60)
    if v.is_Number and abs(v) > sp.Float('1e-45'):
        return True
    return None


def decimal_places(s: str) -> int | None:
    m = re.fullmatch(r'[+-]?\d*\.(\d+)', normalise(s).lstrip('+'))
    return len(m.group(1)) if m else None


def judge_number(S, K, known, key, student_text):
    """EQUAL | APPROX | NOT_EQUAL | UNABLE for one numeric value."""
    if known == 'float':
        diff = abs(float(S) - float(K))
        if diff <= 1e-12 * max(1, abs(float(K))):
            return 'EQUAL', 'float-key'
        nz = True
    else:
        nz = nonzero_proved(S - K)
        if nz is False:
            return 'EQUAL', known
        if nz is None:
            return 'UNABLE', 'undecided-difference'
        diff = abs(sp.N(S - K, 40))
    tol = key.get('tol')
    if tol is not None and diff <= tol * (1 + 1e-12):
        return 'APPROX', 'declared-tol'
    # Two allowances the engine declares and its tolerance suite pins
    # (client/test/marker-tolerance-policy-check.mjs, checker-core.js
    # CALCULATOR_DISPLAY): a difference under 1e-12 is below what any input a
    # learner types can mean, and a whole-number key accepts a calculator's
    # display within 1e-9 (11.9999999999 for 12). They are reported in their own
    # bucket, never as agreement. Where an exact value is demanded only the
    # 1e-12 floor applies.
    if diff <= max(1e-12, 2e-15 * abs(float(K))):        # binary64 cannot hold the difference
        return 'APPROX', 'noise-floor-1e-12'
    exact_demanded = bool(key.get('requireExact') or key.get('requireFraction'))
    if not exact_demanded and K.is_integer and diff <= 1e-9:
        return 'APPROX', 'calculator-display-1e-9'
    if exact_demanded:
        return 'NOT_EQUAL', 'exact-required'
    # The oracle's own approximation rule: a terminating decimal written to p
    # places is K rounded to p places, for a non-integer key, within 1e-4 of |K|.
    p = decimal_places(student_text)
    Kf = float(K)
    if p and not float(Kf).is_integer() and diff <= 0.5 * 10 ** -p * (1 + 1e-9) and diff <= 1e-4 * abs(Kf):
        return 'APPROX', f'rounded-{p}dp'
    return 'NOT_EQUAL', 'proved' if known != 'float' else 'float-key'


def strip_set(s):
    t = str(s).strip()
    t = re.sub(r'^[{\[(]|[}\])]$', '', t)
    parts = re.split(r'\s*(?:,|;|\bor\b|\band\b)\s*', t)
    return [re.sub(r'^[a-z]\s*=\s*', '', p).strip() for p in parts if p.strip()]


def is_const_in(d, syms):
    return all(sp.simplify(sp.diff(d, s)) == 0 for s in syms)


def denominator_factors(e):
    """The irreducible factors of every denominator in an unevaluated parse."""
    out = set()
    for node in sp.preorder_traversal(e):
        if isinstance(node, sp.Pow) and node.exp.is_negative and node.base.free_symbols:
            try:
                for f, _ in sp.factor_list(sp.expand(node.base))[1]:
                    if f.free_symbols:
                        out.add(sp.expand(f))
            except Exception:
                out.add(sp.expand(node.base))
    return out


def hole_difference(student_raw, key_raw, positive):
    """Names the real points where one side has a denominator zero and the other does not, or None."""
    a, b = denominator_factors(student_raw), denominator_factors(key_raw)
    diff = {sp.srepr(f): f for f in a.symmetric_difference(b)}
    holes = []
    for f in diff.values():
        syms = list(f.free_symbols)
        if len(syms) == 1:
            x = syms[0]
            roots = [r for r in sp.real_roots(sp.Poly(f, x))] if f.is_polynomial(x) else []
            roots = [r for r in roots if not positive or r > 0]
            holes.extend(roots)
        elif not positive:
            holes.append(f)
    return sorted(map(str, holes)) or None


def unevaluated(s, positive=False):
    t = normalise(s).lstrip('+')
    # No xreplace here: rebuilding the tree would evaluate it and cancel x/x.
    return parse_expr(t, local_dict=dict(LOCALS), transformations=TRANSFORMS, evaluate=False)


def counterexample(S, K, syms, positive):
    """A rational point where S and K are both real and provably differ, or None."""
    import random
    rnd = random.Random(1729)
    for _ in range(24):
        env = {s: sp.Rational(rnd.randint(1 if positive else -40, 40), rnd.randint(7, 13)) for s in syms}
        try:
            a, b = sp.N(S.subs(env), 40), sp.N(K.subs(env), 40)
        except Exception:
            continue
        if a.is_real and b.is_real and a.is_finite and b.is_finite and abs(a - b) > 1e-25 * max(1, abs(a), abs(b)):
            return {str(k): str(v) for k, v in env.items()}
    return None


def judge_expression(key, text):
    pos = bool(key.get('positiveOnly'))
    keys = [key['expr']] + list(key.get('anyOf') or [])
    t = text
    has_c = False
    if key.get('stripC'):
        m = re.search(r'\s*\+\s*([Cc])\s*$', t)
        if m:
            has_c, t = True, t[:m.start()]
    S = parse(t, positive=pos)
    syms = set(S.free_symbols)
    statuses = []
    for k in keys:
        K = parse(k, positive=pos)
        allsyms = syms | K.free_symbols
        d = sp.simplify(S - K)
        if d == 0:
            # equal as expressions; are they equal as functions (isolated holes)?
            try:
                holes = hole_difference(unevaluated(t), unevaluated(k), pos)
            except Exception:
                holes = None
            if holes:
                statuses.append(('NOT_EQUAL', f'isolated-domain-differs:{holes}'))
                continue
            if key.get('stripC') and not has_c:
                statuses.append(('MISSING_C', 'equal-but-no-constant'))
                continue
            return 'EQUAL', 'symbolic'
        if key.get('stripC') and is_const_in(d, [s for s in allsyms if s.name not in ('C', 'c', 'k')]):
            statuses.append(('ANTIDERIVATIVE_OTHER_CONSTANT', f'differs-by-{to_engine(d)}'))
            continue
        # equal on the positive reals only (ln x^2 vs 2 ln x, sqrt(x^2) vs x)?
        if not pos and allsyms:
            Sp = S.xreplace({s: sp.Symbol(s.name, positive=True) for s in S.free_symbols})
            Kp = K.xreplace({s: sp.Symbol(s.name, positive=True) for s in K.free_symbols})
            if sp.simplify(Sp - Kp) == 0:
                statuses.append(('DOMAIN_ONLY', 'equal-on-positive-reals-only'))
                continue
        ce = counterexample(S, K, allsyms, pos) if allsyms else ({} if nonzero_proved(S - K) else None)
        if ce is not None:
            statuses.append(('NOT_EQUAL', f'counterexample:{ce}'))
        else:
            statuses.append(('UNABLE', 'simplify-undecided-no-counterexample'))
    order = ['MISSING_C', 'ANTIDERIVATIVE_OTHER_CONSTANT', 'DOMAIN_ONLY', 'UNABLE', 'NOT_EQUAL']
    statuses.sort(key=lambda s: order.index(s[0]))
    return statuses[0]


FORM_FEEDBACK = re.compile(r'simplif|exact value|fraction|surd|operation still|still to do|worked out|form|percentage|unit', re.I)


def oracle_status(q, c):
    k, text, typ = q['key'], c['input'], q['type']
    if c['family'] == 'unable':
        return 'UNABLE', c['label']
    if typ == 'numeric':
        K, known = exact_key(k)
        S = parse(text)
        if S.free_symbols or not S.is_number:
            return 'UNABLE', 'student-not-a-number'
        return judge_number(S, K, known, k, text)
    if typ == 'set':
        parts = strip_set(text)
        keys = [exact_key({'value': v}) for v in k['values']]
        if len(parts) != len(keys):
            return 'NOT_EQUAL', 'count-differs'
        remaining = list(keys)
        worst = 'EQUAL'
        for p in parts:
            S = parse(p)
            hit = None
            for i, (K, known) in enumerate(remaining):
                st, _ = judge_number(S, K, known, k, p)
                if st in ('EQUAL', 'APPROX'):
                    hit = i
                    worst = 'APPROX' if st == 'APPROX' else worst
                    break
            if hit is None:
                return 'NOT_EQUAL', f'no-match-for:{p}'
            remaining.pop(hit)
        return worst, 'multiset'
    if typ == 'point':
        inner = normalise(text).strip('()')
        a, b = [x.strip() for x in inner.split(',')]
        sa = judge_number(parse(a), *exact_key({'value': k['x']}), k, a)[0]
        sb = judge_number(parse(b), *exact_key({'value': k['y']}), k, b)[0]
        if 'NOT_EQUAL' in (sa, sb):
            return 'NOT_EQUAL', 'coordinate-differs'
        if 'UNABLE' in (sa, sb):
            return 'UNABLE', 'coordinate-undecided'
        return ('APPROX' if 'APPROX' in (sa, sb) else 'EQUAL'), 'pair'
    if typ == 'expression':
        return judge_expression(k, text)
    return 'UNABLE', 'type-out-of-scope'


def classify(q, c, v, status):
    acc = v['correct']
    st = status[0]
    if st == 'UNABLE':
        return 'SYMPY_UNABLE'
    if acc:
        if st == 'EQUAL':
            return 'AGREE_ACCEPT'
        if st == 'APPROX':
            return 'POLICY_NOISE_OR_DISPLAY' if status[1].startswith(('noise-floor', 'calculator-display')) else 'AGREE_ACCEPT_APPROX'
        if st == 'DOMAIN_ONLY':
            return 'POLICY_DOMAIN_CREDIT'
        if st == 'MISSING_C':
            return 'POLICY_CONSTANT_NOT_REQUIRED'
        if st == 'ANTIDERIVATIVE_OTHER_CONSTANT':
            return 'POLICY_SPECIFIC_ANTIDERIVATIVE_CREDIT'
        return 'FALSE_CREDIT'
    if st == 'NOT_EQUAL':
        return 'AGREE_REJECT'
    if st in ('DOMAIN_ONLY', 'MISSING_C', 'ANTIDERIVATIVE_OTHER_CONSTANT'):
        return 'AGREE_REJECT_POLICY'
    if st == 'APPROX':
        return 'POLICY_STRICTER_APPROX'
    # SymPy: equal. Is the refusal a declared form rule?
    k = q['key']
    form_flag = any(k.get(f) for f in ('simplestFraction', 'surdForm', 'requireExact', 'requireFraction', 'forbid'))
    if (v.get('feedback') and FORM_FEEDBACK.search(v['feedback'])) or (form_flag and c['label'] in (
            'unsimplified-fraction', 'surd-unsimplified', 'mixed-number', 'terminating-decimal', 'unevaluated-plus-zero')):
        return 'POLICY_FORM_RULE'
    return 'FALSE_REJECTION'


def _judge_one(job):
    q, c, v = job
    signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(8)
    try:
        status = oracle_status(q, c)
    except Timeout:
        status = ('UNABLE', 'timeout-8s')
    except Exception as err:
        status = ('UNABLE', f'{type(err).__name__}: {str(err)[:80]}')
    finally:
        signal.alarm(0)
    return {**c, 'edition': q['edition'], 'bank': q['bank'], 'type': q['type'], 'key': q['key'],
            'engine': {'correct': v['correct'], 'invalid': v['invalid'], 'feedback': v['feedback']},
            'oracle': {'status': status[0], 'why': status[1]}, 'class': classify(q, c, v, status)}


def cmd_judge(a):
    qs = {json.loads(l)['qid']: json.loads(l) for l in open(a.questions) if l.strip()}
    cs = [json.loads(l) for l in open(a.candidates) if l.strip()]
    vs = {json.loads(l)['cid']: json.loads(l) for l in open(a.verdicts) if l.strip()}
    jobs = [(qs[c['qid']], c, vs[c['cid']]) for c in cs]
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        rows = list(ex.map(_judge_one, jobs, chunksize=64))
    meta = json.load(open(a.meta)) if a.meta else {}
    report = summarise(rows, meta)
    report['corpus_keys'] = [verify_corpus_key(q) for q in qs.values() if q.get('corpus')]
    report['corpus_rows'] = [r for r in rows if r['qid'].startswith('corpus:')]
    json.dump(report, open(a.json, 'w'), indent=None, separators=(',', ':'), default=str)
    open(a.md, 'w').write(markdown(report))
    fc = report['totals'].get('FALSE_CREDIT', 0)
    print(f"judge: {len(rows)} pairs; FALSE_CREDIT={fc}; FALSE_REJECTION={report['totals'].get('FALSE_REJECTION', 0)}; "
          f"SYMPY_UNABLE={report['totals'].get('SYMPY_UNABLE', 0)} → {a.json}, {a.md}", file=sys.stderr)
    if a.strict and fc:
        sys.exit(1)


def verify_corpus_key(q):
    """Prove an authored corpus key true before trusting it as the reference."""
    v = q['corpus'].get('verify') or {}
    out = {'qid': q['qid'], 'prompt': q['corpus'].get('prompt'), 'how': v.get('how'), 'status': 'UNVERIFIED'}
    try:
        if v.get('how') == 'simplify':
            d = sp.simplify(parse(v['claim']) - parse(v['equals']))
            out['status'] = 'PROVED' if d == 0 else f'NOT PROVED (residue {d})'
        elif v.get('how') == 'antiderivative':
            # Fundamental theorem of calculus: F' equals the integrand, and F is
            # continuous on the interval (the corpus note says why), so the
            # integral is F(b) - F(a). Proved symbolically, never numerically.
            x = sp.Symbol(v['var'], real=True)
            ren = lambda e: e.xreplace({s: x for s in e.free_symbols if s.name == v['var']})
            f, F = ren(parse(v['integrand'])), ren(parse(v['antiderivative']))
            dF = sp.simplify(sp.diff(F, x) - f)
            val = sp.simplify(F.subs(x, parse(v['to'])) - F.subs(x, parse(v['from'])))
            ok = dF == 0 and sp.simplify(val - parse(v['equals'])) == 0
            out['status'] = 'PROVED' if ok else f"NOT PROVED (F' - f = {dF}; F(b) - F(a) = {val})"
            out['integral'] = str(val)
        elif v.get('how') == 'integrate':
            x = sp.Symbol(v['var'], real=True)
            f = parse(v['integrand']).xreplace({s: x for s in parse(v['integrand']).free_symbols if s.name == v['var']})
            val = sp.integrate(f, (x, parse(v['from']), parse(v['to'])))
            d = sp.simplify(val - parse(v['equals']))
            out['status'] = 'PROVED' if d == 0 else f'NOT PROVED (integral {val})'
            out['integral'] = str(sp.simplify(val))
    except Exception as err:
        out['status'] = f'UNABLE ({type(err).__name__})'
    return out


DISAGREE = ('FALSE_CREDIT', 'FALSE_REJECTION', 'SYMPY_UNABLE')
POLICY = ('POLICY_NOISE_OR_DISPLAY', 'POLICY_FORM_RULE', 'POLICY_STRICTER_APPROX', 'POLICY_DOMAIN_CREDIT', 'POLICY_CONSTANT_NOT_REQUIRED',
          'POLICY_SPECIFIC_ANTIDERIVATIVE_CREDIT', 'AGREE_REJECT_POLICY')


def summarise(rows, meta):
    totals = Counter(r['class'] for r in rows)
    by_ed = defaultdict(Counter)
    by_fam = defaultdict(Counter)
    by_type = defaultdict(Counter)
    for r in rows:
        by_ed[r['edition']][r['class']] += 1
        by_fam[r['family']][r['class']] += 1
        by_type[r['type']][r['class']] += 1
    # Every disagreement in full; policy buckets keep their counts and a sample.
    detail = {k: [r for r in rows if r['class'] == k] for k in DISAGREE}
    detail.update({k: [r for r in rows if r['class'] == k][:25] for k in POLICY})
    policy_labels = {k: dict(Counter(r['label'] for r in rows if r['class'] == k)) for k in POLICY}
    return {'meta': meta, 'pairs': len(rows), 'questions': len({r['qid'] for r in rows}),
            'generators': len({r['qid'].split('|')[0] for r in rows}), 'totals': dict(totals),
            'by_edition': {k: dict(v) for k, v in by_ed.items()}, 'by_family': {k: dict(v) for k, v in by_fam.items()},
            'by_type': {k: dict(v) for k, v in by_type.items()}, 'detail': detail,
            'policy_labels': policy_labels}


def _row(r):
    fb = (r['engine']['feedback'] or '').replace('|', '\\|').replace('\n', ' ')[:90]
    key = r['key'].get('expr') or r['key'].get('values') or r['key'].get('simplestFraction') or r['key'].get('value')
    if r['type'] == 'point':
        key = (r['key']['x'], r['key']['y'])
    gid, d, seed = r['qid'].split('|')
    return (f"| `{gid}` d{d} s{seed} | {r['edition']} | {r['type']} | `{key}` | {r['family']}/{r['label']} | `{r['input']}` | "
            f"{'accept' if r['engine']['correct'] else 'refuse'} | {r['oracle']['status']} ({r['oracle']['why'][:60]}) | {fb} |")


def markdown(rep):
    m = rep['meta']
    T = rep['totals']
    cls = ['AGREE_ACCEPT', 'AGREE_ACCEPT_APPROX', 'AGREE_REJECT', 'AGREE_REJECT_POLICY', 'FALSE_CREDIT', 'FALSE_REJECTION',
           'SYMPY_UNABLE', 'POLICY_NOISE_OR_DISPLAY', 'POLICY_FORM_RULE', 'POLICY_STRICTER_APPROX', 'POLICY_DOMAIN_CREDIT', 'POLICY_CONSTANT_NOT_REQUIRED',
           'POLICY_SPECIFIC_ANTIDERIVATIVE_CREDIT']
    L = []
    L.append(f"# SymPy differential oracle — {m.get('date', '')}\n")
    L.append('> **Synthetic differential evidence. Not an accuracy claim.** Candidate answers are generated by rule from the '
             "engine's own question generators (both editions); no student, handwriting, teacher or human adjudication is "
             'involved. SymPy is an independent second opinion on mathematical equality, not ground truth for marking policy: '
             'form rules (simplest form, surd form, exact value), approximation bands and domain rules are product decisions '
             'and are reported separately from disagreements. Nothing here sets a mark.\n')
    L.append(f"- Commit: `{m.get('commit', '?')}` · SymPy {m.get('sympy', '?')} · Python {m.get('python', '?')} · "
             f"draws per (generator, difficulty): {m.get('draws', '?')}")
    L.append(f"- Generators: {rep['generators']} · questions: {rep['questions']} · judged pairs: {rep['pairs']} · "
             f"out of scope by answer type: {m.get('skipped', {})}")
    L.append('- Reproduce: `tools/math-oracle/run.sh` (see `tools/math-oracle/README.md`). Seeds are fixed (7000·difficulty + draw).\n')
    L.append('## Headline\n')
    L.append(f"| Class | Pairs |\n|---|---:|")
    for c in cls:
        L.append(f"| {c} | {T.get(c, 0)} |")
    verdict = 'FAIL — release-blocking false credit present' if T.get('FALSE_CREDIT') else 'PASS — no false credit in this draw'
    L.append(f"\n`SYMPY ORACLE: {verdict}`\n")
    eds = sorted(rep['by_edition'])
    L.append('## By edition\n')
    L.append('| Class | ' + ' | '.join(eds) + ' |\n|---|' + '---:|' * len(eds))
    for c in cls:
        L.append(f'| {c} | ' + ' | '.join(str(rep['by_edition'][e].get(c, 0)) for e in eds) + ' |')
    fams = sorted(rep['by_family'])
    L.append('\n## By candidate family\n')
    L.append('| Class | ' + ' | '.join(fams) + ' |\n|---|' + '---:|' * len(fams))
    for c in cls:
        L.append(f'| {c} | ' + ' | '.join(str(rep['by_family'][f].get(c, 0)) for f in fams) + ' |')
    hdr = '| Question | Edition | Type | Key | Candidate | Input | Engine | SymPy | Engine feedback |\n|---|---|---|---|---|---|---|---|---|'
    for c, title in (('FALSE_CREDIT', 'False credit (engine accepts, SymPy proves not equal) — release-blocking'),
                     ('FALSE_REJECTION', 'False rejection (engine refuses, SymPy proves equal, no declared form rule)'),
                     ('SYMPY_UNABLE', 'SymPy unable')):
        rows = rep['detail'][c]
        L.append(f'\n## {title}: {len(rows)}\n')
        if rows:
            L.append(hdr)
            L.extend(_row(r) for r in rows[:80])
            if len(rows) > 80:
                L.append(f'\n…{len(rows) - 80} more in the JSON report.')
    if rep.get('corpus_keys'):
        L.append('\n## Authored corpus: keys proved before use\n')
        L.append('| Question | Prompt | How | Key |\n|---|---|---|---|')
        for k in rep['corpus_keys']:
            L.append(f"| `{k['qid'].split('|')[0]}` | {k['prompt']} | {k['how']} | {k['status']} |")
        rows = [r for r in rep.get('corpus_rows', [])]
        if rows:
            L.append('\n| Question | Candidate | Input | Engine | SymPy | Class |\n|---|---|---|---|---|---|')
            for r in rows:
                L.append(f"| `{r['qid'].split('|')[0]}` | {r['family']}/{r['label']} | `{r['input']}` | {'accept' if r['engine']['correct'] else 'refuse'} | {r['oracle']['status']} | {r['class']} |")
    L.append('\n## Policy buckets (not defects; listed so they stay visible)\n')
    for c in POLICY:
        labs = rep['policy_labels'][c]
        L.append(f"- **{c}** ({T.get(c, 0)}): " + (', '.join(f'{k} ×{v}' for k, v in sorted(labs.items(), key=lambda kv: -kv[1])) or '—'))
    L.append('\n## How to read this\n')
    L.append('- **FALSE_CREDIT** is the class that matters: a wrong answer the engine marks right. Each confirmed one gets a '
             'deterministic regression test in the JS suites and an engine fix on its own R4 branch with an independent review.')
    L.append('- **FALSE_REJECTION** is a right answer refused with no declared form rule to explain it. It is a learner-facing '
             'defect but not a credit leak.')
    L.append('- **SYMPY_UNABLE** means the oracle could not decide (unparseable input, a timeout, or a simplification it '
             'could neither prove nor disprove). Numerical substitution is used only to disprove equality, never to prove it.')
    L.append("- The oracle's approximation rule is its own, written from the research standard (exact source, rounding rule, "
             'tolerance): a decimal written to p places is accepted for a non-integer key when it is within half a unit of '
             'the p-th place and within 10⁻⁴ of the key; an authored `tol` replaces it; `requireExact`/`requireFraction` '
             'forbid it. Where the engine is stricter (a precision named in the prompt, an exact-value demand) the pair is '
             '**POLICY_STRICTER_APPROX**, not a rejection defect.')
    L.append("- `log` is base 10 and `e` is Euler's number in the engine's syntax; the oracle parses them the same way.")
    return '\n'.join(L) + '\n'


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('candidates')
    c.add_argument('questions')
    c.add_argument('--out', required=True)
    j = sub.add_parser('judge')
    j.add_argument('questions')
    j.add_argument('candidates')
    j.add_argument('verdicts')
    j.add_argument('--json', required=True)
    j.add_argument('--md', required=True)
    j.add_argument('--meta')
    j.add_argument('--workers', type=int, default=8)
    j.add_argument('--strict', action='store_true')
    a = p.parse_args()
    {'candidates': cmd_candidates, 'judge': cmd_judge}[a.cmd](a)


if __name__ == '__main__':
    main()
