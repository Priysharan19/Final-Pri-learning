#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 11 (ext1-2027-p11, scope-revised).
Run: /tmp/symenv/bin/python tools/papers/verify/p11.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p11.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p11.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p11.json")))

RESULTS = []
CHECKED = set()
def report(item, status, method):
    RESULTS.append((item, status, method))
    print(f"{item} {status} ({method})", flush=True)

def mcq_key(qid):
    for s in PAPER["sections"]:
        for q in s["questions"]:
            for p in q["parts"]:
                if p["id"] == qid and p.get("key"):
                    return p["key"]["answer"]
    raise KeyError(qid)

def mcq(qid, computed_letters, method):
    """computed_letters: the set of option letters equal to the independently computed answer."""
    g = mcq_key(qid)
    if len(computed_letters) != 1:
        report(qid, "FAIL", f"computed answer matched {sorted(computed_letters)} options; {method}")
    elif computed_letters == {g}:
        report(qid, "PASS", f"guideline {g}; {method}")
    elif qid in KNOWN_DISAGREEMENTS:
        report(qid, "DISAGREE", f"guideline {g}, computed {sorted(computed_letters)}; {method}")
    else:
        report(qid, "DISAGREE", f"UNEXPECTED guideline {g}, computed {sorted(computed_letters)}; {method}")

SYMS = {}
def ex(s, **extra):
    s = s.replace("^", "**").replace("nCr(", "binomial(").replace("ln(", "log(")
    loc = {"pi": sp.pi, "sqrt": sp.sqrt, "binomial": sp.binomial, "log": sp.log}
    for ch in "abcdghjklmnoprstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ":
        loc[ch] = sp.Symbol(ch, positive=True)
    loc.update(extra)
    return sp.sympify(s, locals=loc)

def kc(item):
    CHECKED.add(item)
    return OVERRIDE[item]["key"]

def close(a, b, rel=1e-9):
    return abs(a - b) <= rel * max(1.0, abs(a), abs(b))

def check_num(item, computed, method):
    k = kc(item)
    ok = k["type"] == "numeric" and close(float(k["value"]), float(computed))
    report(item, "PASS" if ok else "FAIL", f"{method}; key {k.get('value')} vs computed {float(computed):.12g}")

def check_exact(item, computed_fr, method):
    k = kc(item)
    ok = k["type"] == "exact" and Fr(int(k["n"]), int(k["d"])) == Fr(computed_fr)
    report(item, "PASS" if ok else "FAIL", f"{method}; key {k.get('n')}/{k.get('d')} vs computed {computed_fr}")

def check_set(item, computed, method):
    k = kc(item)
    a = sorted(float(v) for v in k["values"]); b = sorted(float(v) for v in computed)
    ok = k["type"] == "set" and len(a) == len(b) and all(close(x, y) for x, y in zip(a, b))
    report(item, "PASS" if ok else "FAIL", f"{method}; key {a} vs computed {b}")

def check_expr(item, computed, method, free=None):
    """computed: sympy expression (using the same positive symbols as ex())."""
    k = kc(item)
    forms = [k["expr"]] + list(k.get("anyOf", []))
    ok = k["type"] == "expression"
    for f in [k["expr"]]:
        d = sp.simplify(sp.expand(ex(f) - computed))
        ok = ok and d == 0
    # decimal anyOf spellings are only checked when they parse as pure expressions equal to key
    for f in k.get("anyOf", []):
        try:
            d = sp.simplify(ex(f) - computed)
            if d != 0 and abs(complex(d)) > 1e-3:
                ok = False
        except Exception:
            pass
    report(item, "PASS" if ok else "FAIL", f"{method}; key {k['expr']}")

def finish(paper_no):
    missing = [i for i in OVERRIDE if i not in CHECKED]
    for i in missing:
        report(i, "FAIL", "keyed in override file but no check in script")
    keyed = sum(1 for r in RESULTS if r[0] in OVERRIDE and r[1] == "PASS")
    mpass = sum(1 for r in RESULTS if r[0].startswith("q") and r[0] not in OVERRIDE and r[1] == "PASS" and "-" not in r[0] and r[0][1:].isdigit() and int(r[0][1:]) <= 10)
    mdis = sum(1 for r in RESULTS if r[1] == "DISAGREE" and r[0] in KNOWN_DISAGREEMENTS and r[0][1:].isdigit())
    unv = sum(1 for r in RESULTS if r[1] == "UNVERIFIED")
    bad = [r for r in RESULTS if r[1] == "FAIL" or (r[1] == "DISAGREE" and r[0] not in KNOWN_DISAGREEMENTS)]
    print(f"PAPER {paper_no}: {keyed} keyed parts PASS, {mpass} MCQ PASS, {mdis} MCQ DISAGREE, {unv} UNVERIFIED" + (f"  [{len(bad)} FAIL/UNEXPECTED]" if bad else ""))
    sys.exit(1 if bad else 0)

KNOWN_DISAGREEMENTS = set()

# Q10 option curves: TikZ polylines (every 4th of 601 points) from the author's figs.tex for options A..D
FIGP = json.loads('''{"A":[[1.0,0.0],[0.992,0.084],[0.969,0.167],[0.93,0.249],[0.876,0.329],[0.809,0.407],[0.729,0.482],[0.637,0.553],[0.536,0.621],[0.426,0.685],[0.309,0.743],[0.187,0.797],[0.063,0.844],[-0.063,0.886],[-0.187,0.922],[-0.309,0.951],[-0.426,0.974],[-0.536,0.989],[-0.637,0.998],[-0.729,1.0],[-0.809,0.995],[-0.876,0.982],[-0.93,0.963],[-0.969,0.937],[-0.992,0.905],[-1.0,0.866],[-0.992,0.821],[-0.969,0.771],[-0.93,0.714],[-0.876,0.653],[-0.809,0.588],[-0.729,0.518],[-0.637,0.445],[-0.536,0.368],[-0.426,0.289],[-0.309,0.208],[-0.187,0.125],[-0.063,0.042],[0.063,-0.042],[0.187,-0.125],[0.309,-0.208],[0.426,-0.289],[0.536,-0.368],[0.637,-0.445],[0.729,-0.518],[0.809,-0.588],[0.876,-0.653],[0.93,-0.714],[0.969,-0.771],[0.992,-0.821],[1.0,-0.866],[0.992,-0.905],[0.969,-0.937],[0.93,-0.963],[0.876,-0.982],[0.809,-0.995],[0.729,-1.0],[0.637,-0.998],[0.536,-0.989],[0.426,-0.974],[0.309,-0.951],[0.187,-0.922],[0.063,-0.886],[-0.063,-0.844],[-0.187,-0.797],[-0.309,-0.743],[-0.426,-0.685],[-0.536,-0.621],[-0.637,-0.553],[-0.729,-0.482],[-0.809,-0.407],[-0.876,-0.329],[-0.93,-0.249],[-0.969,-0.167],[-0.992,-0.084],[-1.0,-0.0],[-0.992,0.084],[-0.969,0.167],[-0.93,0.249],[-0.876,0.329],[-0.809,0.407],[-0.729,0.482],[-0.637,0.553],[-0.536,0.621],[-0.426,0.685],[-0.309,0.743],[-0.187,0.797],[-0.063,0.844],[0.063,0.886],[0.187,0.922],[0.309,0.951],[0.426,0.974],[0.536,0.989],[0.637,0.998],[0.729,1.0],[0.809,0.995],[0.876,0.982],[0.93,0.963],[0.969,0.937],[0.992,0.905],[1.0,0.866],[0.992,0.821],[0.969,0.771],[0.93,0.714],[0.876,0.653],[0.809,0.588],[0.729,0.518],[0.637,0.445],[0.536,0.368],[0.426,0.289],[0.309,0.208],[0.187,0.125],[0.063,0.042],[-0.063,-0.042],[-0.187,-0.125],[-0.309,-0.208],[-0.426,-0.289],[-0.536,-0.368],[-0.637,-0.445],[-0.729,-0.518],[-0.809,-0.588],[-0.876,-0.653],[-0.93,-0.714],[-0.969,-0.771],[-0.992,-0.821],[-1.0,-0.866],[-0.992,-0.905],[-0.969,-0.937],[-0.93,-0.963],[-0.876,-0.982],[-0.809,-0.995],[-0.729,-1.0],[-0.637,-0.998],[-0.536,-0.989],[-0.426,-0.974],[-0.309,-0.951],[-0.187,-0.922],[-0.063,-0.886],[0.063,-0.844],[0.187,-0.797],[0.309,-0.743],[0.426,-0.685],[0.536,-0.621],[0.637,-0.553],[0.729,-0.482],[0.809,-0.407],[0.876,-0.329],[0.93,-0.249],[0.969,-0.167],[0.992,-0.084],[1.0,-0.0]],"B":[[1.0,0.0],[0.999,0.167],[0.996,0.329],[0.992,0.482],[0.986,0.621],[0.978,0.743],[0.969,0.844],[0.957,0.922],[0.944,0.974],[0.93,0.998],[0.914,0.995],[0.896,0.963],[0.876,0.905],[0.855,0.821],[0.833,0.714],[0.809,0.588],[0.784,0.445],[0.757,0.289],[0.729,0.125],[0.7,-0.042],[0.669,-0.208],[0.637,-0.368],[0.605,-0.518],[0.571,-0.653],[0.536,-0.771],[0.5,-0.866],[0.463,-0.937],[0.426,-0.982],[0.388,-1.0],[0.349,-0.989],[0.309,-0.951],[0.269,-0.886],[0.228,-0.797],[0.187,-0.685],[0.146,-0.553],[0.105,-0.407],[0.063,-0.249],[0.021,-0.084],[-0.021,0.084],[-0.063,0.249],[-0.105,0.407],[-0.146,0.553],[-0.187,0.685],[-0.228,0.797],[-0.269,0.886],[-0.309,0.951],[-0.349,0.989],[-0.388,1.0],[-0.426,0.982],[-0.463,0.937],[-0.5,0.866],[-0.536,0.771],[-0.571,0.653],[-0.605,0.518],[-0.637,0.368],[-0.669,0.208],[-0.7,0.042],[-0.729,-0.125],[-0.757,-0.289],[-0.784,-0.445],[-0.809,-0.588],[-0.833,-0.714],[-0.855,-0.821],[-0.876,-0.905],[-0.896,-0.963],[-0.914,-0.995],[-0.93,-0.998],[-0.944,-0.974],[-0.957,-0.922],[-0.969,-0.844],[-0.978,-0.743],[-0.986,-0.621],[-0.992,-0.482],[-0.996,-0.329],[-0.999,-0.167],[-1.0,-0.0],[-0.999,0.167],[-0.996,0.329],[-0.992,0.482],[-0.986,0.621],[-0.978,0.743],[-0.969,0.844],[-0.957,0.922],[-0.944,0.974],[-0.93,0.998],[-0.914,0.995],[-0.896,0.963],[-0.876,0.905],[-0.855,0.821],[-0.833,0.714],[-0.809,0.588],[-0.784,0.445],[-0.757,0.289],[-0.729,0.125],[-0.7,-0.042],[-0.669,-0.208],[-0.637,-0.368],[-0.605,-0.518],[-0.571,-0.653],[-0.536,-0.771],[-0.5,-0.866],[-0.463,-0.937],[-0.426,-0.982],[-0.388,-1.0],[-0.349,-0.989],[-0.309,-0.951],[-0.269,-0.886],[-0.228,-0.797],[-0.187,-0.685],[-0.146,-0.553],[-0.105,-0.407],[-0.063,-0.249],[-0.021,-0.084],[0.021,0.084],[0.063,0.249],[0.105,0.407],[0.146,0.553],[0.187,0.685],[0.228,0.797],[0.269,0.886],[0.309,0.951],[0.349,0.989],[0.388,1.0],[0.426,0.982],[0.463,0.937],[0.5,0.866],[0.536,0.771],[0.571,0.653],[0.605,0.518],[0.637,0.368],[0.669,0.208],[0.7,0.042],[0.729,-0.125],[0.757,-0.289],[0.784,-0.445],[0.809,-0.588],[0.833,-0.714],[0.855,-0.821],[0.876,-0.905],[0.896,-0.963],[0.914,-0.995],[0.93,-0.998],[0.944,-0.974],[0.957,-0.922],[0.969,-0.844],[0.978,-0.743],[0.986,-0.621],[0.992,-0.482],[0.996,-0.329],[0.999,-0.167],[1.0,-0.0]],"C":[[1.0,0.0],[0.999,0.084],[0.996,0.167],[0.992,0.249],[0.986,0.329],[0.978,0.407],[0.969,0.482],[0.957,0.553],[0.944,0.621],[0.93,0.685],[0.914,0.743],[0.896,0.797],[0.876,0.844],[0.855,0.886],[0.833,0.922],[0.809,0.951],[0.784,0.974],[0.757,0.989],[0.729,0.998],[0.7,1.0],[0.669,0.995],[0.637,0.982],[0.605,0.963],[0.571,0.937],[0.536,0.905],[0.5,0.866],[0.463,0.821],[0.426,0.771],[0.388,0.714],[0.349,0.653],[0.309,0.588],[0.269,0.518],[0.228,0.445],[0.187,0.368],[0.146,0.289],[0.105,0.208],[0.063,0.125],[0.021,0.042],[-0.021,-0.042],[-0.063,-0.125],[-0.105,-0.208],[-0.146,-0.289],[-0.187,-0.368],[-0.228,-0.445],[-0.269,-0.518],[-0.309,-0.588],[-0.349,-0.653],[-0.388,-0.714],[-0.426,-0.771],[-0.463,-0.821],[-0.5,-0.866],[-0.536,-0.905],[-0.571,-0.937],[-0.605,-0.963],[-0.637,-0.982],[-0.669,-0.995],[-0.7,-1.0],[-0.729,-0.998],[-0.757,-0.989],[-0.784,-0.974],[-0.809,-0.951],[-0.833,-0.922],[-0.855,-0.886],[-0.876,-0.844],[-0.896,-0.797],[-0.914,-0.743],[-0.93,-0.685],[-0.944,-0.621],[-0.957,-0.553],[-0.969,-0.482],[-0.978,-0.407],[-0.986,-0.329],[-0.992,-0.249],[-0.996,-0.167],[-0.999,-0.084],[-1.0,-0.0],[-0.999,0.084],[-0.996,0.167],[-0.992,0.249],[-0.986,0.329],[-0.978,0.407],[-0.969,0.482],[-0.957,0.553],[-0.944,0.621],[-0.93,0.685],[-0.914,0.743],[-0.896,0.797],[-0.876,0.844],[-0.855,0.886],[-0.833,0.922],[-0.809,0.951],[-0.784,0.974],[-0.757,0.989],[-0.729,0.998],[-0.7,1.0],[-0.669,0.995],[-0.637,0.982],[-0.605,0.963],[-0.571,0.937],[-0.536,0.905],[-0.5,0.866],[-0.463,0.821],[-0.426,0.771],[-0.388,0.714],[-0.349,0.653],[-0.309,0.588],[-0.269,0.518],[-0.228,0.445],[-0.187,0.368],[-0.146,0.289],[-0.105,0.208],[-0.063,0.125],[-0.021,0.042],[0.021,-0.042],[0.063,-0.125],[0.105,-0.208],[0.146,-0.289],[0.187,-0.368],[0.228,-0.445],[0.269,-0.518],[0.309,-0.588],[0.349,-0.653],[0.388,-0.714],[0.426,-0.771],[0.463,-0.821],[0.5,-0.866],[0.536,-0.905],[0.571,-0.937],[0.605,-0.963],[0.637,-0.982],[0.669,-0.995],[0.7,-1.0],[0.729,-0.998],[0.757,-0.989],[0.784,-0.974],[0.809,-0.951],[0.833,-0.922],[0.855,-0.886],[0.876,-0.844],[0.896,-0.797],[0.914,-0.743],[0.93,-0.685],[0.944,-0.621],[0.957,-0.553],[0.969,-0.482],[0.978,-0.407],[0.986,-0.329],[0.992,-0.249],[0.996,-0.167],[0.999,-0.084],[1.0,-0.0]],"D":[[1.0,0.0],[0.986,0.042],[0.944,0.084],[0.876,0.125],[0.784,0.167],[0.669,0.208],[0.536,0.249],[0.388,0.289],[0.228,0.329],[0.063,0.368],[-0.105,0.407],[-0.269,0.445],[-0.426,0.482],[-0.571,0.518],[-0.7,0.553],[-0.809,0.588],[-0.896,0.621],[-0.957,0.653],[-0.992,0.685],[-0.999,0.714],[-0.978,0.743],[-0.93,0.771],[-0.855,0.797],[-0.757,0.821],[-0.637,0.844],[-0.5,0.866],[-0.349,0.886],[-0.187,0.905],[-0.021,0.922],[0.146,0.937],[0.309,0.951],[0.463,0.963],[0.605,0.974],[0.729,0.982],[0.833,0.989],[0.914,0.995],[0.969,0.998],[0.996,1.0],[0.996,1.0],[0.969,0.998],[0.914,0.995],[0.833,0.989],[0.729,0.982],[0.605,0.974],[0.463,0.963],[0.309,0.951],[0.146,0.937],[-0.021,0.922],[-0.187,0.905],[-0.349,0.886],[-0.5,0.866],[-0.637,0.844],[-0.757,0.821],[-0.855,0.797],[-0.93,0.771],[-0.978,0.743],[-0.999,0.714],[-0.992,0.685],[-0.957,0.653],[-0.896,0.621],[-0.809,0.588],[-0.7,0.553],[-0.571,0.518],[-0.426,0.482],[-0.269,0.445],[-0.105,0.407],[0.063,0.368],[0.228,0.329],[0.388,0.289],[0.536,0.249],[0.669,0.208],[0.784,0.167],[0.876,0.125],[0.944,0.084],[0.986,0.042],[1.0,0.0],[0.986,-0.042],[0.944,-0.084],[0.876,-0.125],[0.784,-0.167],[0.669,-0.208],[0.536,-0.249],[0.388,-0.289],[0.228,-0.329],[0.063,-0.368],[-0.105,-0.407],[-0.269,-0.445],[-0.426,-0.482],[-0.571,-0.518],[-0.7,-0.553],[-0.809,-0.588],[-0.896,-0.621],[-0.957,-0.653],[-0.992,-0.685],[-0.999,-0.714],[-0.978,-0.743],[-0.93,-0.771],[-0.855,-0.797],[-0.757,-0.821],[-0.637,-0.844],[-0.5,-0.866],[-0.349,-0.886],[-0.187,-0.905],[-0.021,-0.922],[0.146,-0.937],[0.309,-0.951],[0.463,-0.963],[0.605,-0.974],[0.729,-0.982],[0.833,-0.989],[0.914,-0.995],[0.969,-0.998],[0.996,-1.0],[0.996,-1.0],[0.969,-0.998],[0.914,-0.995],[0.833,-0.989],[0.729,-0.982],[0.605,-0.974],[0.463,-0.963],[0.309,-0.951],[0.146,-0.937],[-0.021,-0.922],[-0.187,-0.905],[-0.349,-0.886],[-0.5,-0.866],[-0.637,-0.844],[-0.757,-0.821],[-0.855,-0.797],[-0.93,-0.771],[-0.978,-0.743],[-0.999,-0.714],[-0.992,-0.685],[-0.957,-0.653],[-0.896,-0.621],[-0.809,-0.588],[-0.7,-0.553],[-0.571,-0.518],[-0.426,-0.482],[-0.269,-0.445],[-0.105,-0.407],[0.063,-0.368],[0.228,-0.329],[0.388,-0.289],[0.536,-0.249],[0.669,-0.208],[0.784,-0.167],[0.876,-0.125],[0.944,-0.084],[0.986,-0.042],[1.0,-0.0]]}''')

def seg_dist(px, py, P):
    best = 1e9
    for (x1, y1), (x2, y2) in zip(P, P[1:]):
        dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
        s = 0.0 if L == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L))
        best = min(best, math.hypot(px - x1 - s * dx, py - y1 - s * dy))
    return best

def q1():
    ok = {l: all(sum((-1)**k * comb(n, k) * 5**k for k in range(n + 1)) == f(n) for n in range(1, 16)) for l, f in
          {"A": lambda n: (-4)**n, "B": lambda n: 4**n, "C": lambda n: 6**n, "D": lambda n: -(4**n)}.items()}
    mcq("q1", {l for l, v in ok.items() if v}, "exact integer sums for n=1..15 compared with each option")

def q2():
    sd = math.sqrt(0.8 * 0.2 / 100)
    mcq("q2", {l for l, v in zip("ABCD", [1 / 625, 1 / 25, 2 / 5, 4]) if abs(v - sd) < 1e-12}, f"sd of the proportion sqrt(p(1-p)/n) = {sd}")

def q3():
    n, p = sp.symbols('n p', positive=True)
    s = sp.solve([n * p - 36, n * p * (1 - p) - sp.Rational(72, 5)], [n, p], dict=True)
    s = [(v[n], v[p]) for v in s]; R = sp.Rational
    mcq("q3", {l for l, o in zip("ABCD", [(90, R(2, 5)), (120, R(3, 10)), (60, R(3, 5)), (61, R(3, 5))]) if o in s}, f"np=36, np(1-p)=72/5 give {s}")

def q4():
    f = lambda P: P / 2 * (1 - P / 1000)
    best = max(f(i / 100) for i in range(0, 200001))
    mcq("q4", {l for l, v in zip("ABCD", [250, 500, 125, 62.5]) if abs(v - best) < 1e-6}, f"max over P of P(1-P/1000)/2 = {best:.6f} (largest h with an equilibrium)")

def q5():
    h = lambda x: math.sin(6 * x) - math.sin(5 * x)
    N = 2000000; roots = []; prev = h(0.0)
    if abs(prev) < 1e-12: roots.append(0.0)
    for i in range(1, N + 1):
        x = 2 * pi * i / N; cur = h(x)
        if abs(cur) < 1e-12 and (not roots or abs(roots[-1] - x) > 1e-5): roots.append(x)
        elif prev * cur < 0 and not (roots and abs(roots[-1] - x) < 1e-5): roots.append(x)
        prev = cur
    mcq("q5", {l for l, v in zip("ABCD", [12, 14, 22, 13]) if v == len(roots)}, f"zeros of sin6x-sinx5 on [0,2pi] on a 2e6-point grid (sign changes + exact zeros): {len(roots)}")

def q6():
    N = 400
    true = {2}
    for n in range(1, N + 1):          # closure of {2} under k -> k+4 within 1..N
        if n - 4 in true: true.add(n)
    opts = {"A": set(range(1, N + 1)), "B": set(range(2, N + 1)), "C": {2}, "D": {n for n in range(1, N + 1) if n % 4 == 2}}
    mcq("q6", {l for l, s in opts.items() if s == true}, "smallest set containing 2 and closed under +4 (within 1..400) compared with each option")

def q7():
    a = sp.Matrix([-5, 3]); b = sp.Matrix([-4, 2]); t = sp.symbols('t')
    sol = sp.solve((a + t * b).dot(a - b), t); R = sp.Rational
    mcq("q7", {l for l, o in zip("ABCD", [-R(4, 3), R(4, 3), -R(2, 5), R(17, 10)]) if o in sol}, f"(a+tb).(a-b)=0 gives t={sol}")

def q8():
    x = sp.symbols('x'); e = sp.expand((x + 3 / x)**7)
    c = e.coeff(x, 5)
    mcq("q8", {l for l, v in zip("ABCD", [7, 21, 5103, 189]) if v == c}, f"expanded (x+3/x)^7, coefficient of x^5 = {c}")

def q9():
    x, k = sp.symbols('x k')
    f = lambda z: (k * z + 9) / (z - 7)
    ff = sp.simplify(f(f(x)) - x)
    sol = sp.solve(sp.numer(sp.together(ff)), k) if ff != 0 else []
    # f(f(x)) = x for all x requires every coefficient of the numerator polynomial in x to vanish
    num = sp.Poly(sp.numer(sp.together(ff)), x)
    sols = sp.solve(num.coeffs(), k, dict=True)
    ks = {s[k] for s in sols if k in s}
    mcq("q9", {l for l, v in zip("ABCD", [7, -7, 9, 1]) if v in ks}, f"f(f(x))=x identically requires k in {ks}")

def q10():
    true = [(math.cos(t), math.sin(4 * t)) for t in (2 * pi * i / 20000 for i in range(20001))]
    tpoly = true[::25]; res = {}
    for l, P in FIGP.items():
        d1 = max(seg_dist(x, y, tpoly) for x, y in P)
        d2 = max(seg_dist(x, y, P) for x, y in true[::100])
        res[l] = max(d1, d2)
    mcq("q10", {l for l, e in res.items() if e < 0.02}, "max point-to-polyline distance both ways between each option's TikZ polyline and (cos t, sin 4t): " + ", ".join(f"{l}={e:.4f}" for l, e in res.items()))

# ----------------------------------------------------------------- Section II
def rk4_check(item, f, y0, key_fn, label, pts=(-3.0, -1.7, -0.4, 0.6, 1.2, 1.9, 2.5, 3.0)):
    ok = True
    for xt in pts:
        n = 4000; h = xt / n; x = 0.0; y = y0
        for _ in range(n):
            k1 = f(x, y); k2 = f(x + h / 2, y + h * k1 / 2); k3 = f(x + h / 2, y + h * k2 / 2); k4 = f(x + h, y + h * k3)
            y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h
        ok &= abs(y - key_fn(xt)) < 1e-8 * max(1, abs(y))
    return ok

def sym_num(expr_str, **vals):
    k = {"e": sp.E, "pi": sp.pi}
    k.update({n: sp.Symbol(n) for n in vals})
    return float(sp.sympify(expr_str.replace("^", "**").replace("ln(", "log("), locals=k).subs({sp.Symbol(n): v for n, v in vals.items()}))

def q11a():
    k = kc("q11a")
    ok = rk4_check("q11a", lambda x, y: (1 + y * y) * math.cos(x), 1.0, lambda xt: sym_num(k["expr"], x=xt), "", pts=(-3.0, -1.7, -0.4, 0.2, 0.5, 0.8))
    report("q11a", "PASS" if ok else "FAIL", f"RK4 of dy/dx=(1+y^2)cos x, y(0)=1 vs key {k['expr']} at 6 points in [-3,0.8] (the solution blows up at x=asin(pi/4)=0.903, so only points inside its interval of existence are tested; rel err < 1e-8)")

def quad_item(item, fn, lo, hi, what):
    mp.mp.dps = 30
    v = mp.quad(fn, lo)
    k = kc(item); key = float(sp.N(sp.sympify(k["expr"].replace("^", "**").replace("ln(", "log("), locals={"pi": sp.pi}), 30))
    report(item, "PASS" if k["type"] == "expression" and close(float(v), key, 1e-12) else "FAIL", f"{what} = {mp.nstr(v, 15)}; key {k['expr']}")

def q11b():
    quad_item("q11b", lambda x: 12 / (x * x + 4), [0, 2 * mp.sqrt(3) / 3], None, "area by quadrature")
def q11c():
    quad_item("q11c", lambda x: mp.sin(3 * x)**4, [0, mp.pi / 4], None, "quadrature")
def q12a():
    quad_item("q12a", lambda x: x**3 / mp.sqrt(x * x + 9), [0, 6], None, "quadrature")

def q11d():
    cnt = 0
    for D, E, F in itertools.permutations(range(10), 3):
        if abs(D - E) == 1 and abs(D - F) != 1: cnt += math.factorial(7)
    check_num("q11d", cnt, f"placements of D,E,F (adjacent D-E, D not adjacent F) x 7! = {cnt}")

def binom_n(item, mean, a, b):
    sols = []
    for n in range(4, 301):
        p = mean / n
        if p > 1: continue
        if comb(n, a) * p**a * (1 - p)**(n - a) == comb(n, b) * p**b * (1 - p)**(n - b): sols.append(n)
    return sols

def q11e():
    s = binom_n("q11e", Fr(15, 4), 3, 4)
    check_num("q11e", s[0] if len(s) == 1 else -1, f"exact Fractions: P(X=3)=P(X=4) with mean 15/4 only for n in {s}")

def q13a():
    mp.mp.dps = 120
    a = mp.cos(mp.pi / 64); n = 1
    while abs(a - 1) > mp.mpf(10)**-100 and n < 100:
        a = 2 * a * a - 1; n += 1
    check_num("q13a-ii", n, f"recurrence at 120 digits: a_n=1 first at n={n}")

def q13b():
    p = Fr(3, 10); pmf = [comb(12, k) * p**k * (1 - p)**(12 - k) for k in range(13)]
    am = max(range(13), key=lambda k: pmf[k])
    check_num("q13b-ii", am, f"exact pmf for n=12, p=3/10, mode slot {am} (unique: {pmf.count(max(pmf)) == 1})")

def q14a():
    x = sp.symbols('x')
    P = x**10 + 196830 * x + 531441
    # independent of the guideline's b,c: recompute b,c from the factor condition, then divide
    b, c = sp.symbols('b c')
    sol = sp.solve([(x**10 + b * x + c).subs(x, -3), sp.diff(x**10 + b * x + c, x).subs(x, -3)], [b, c], dict=True)[0]
    Pn = x**10 + sol[b] * x + sol[c]
    Q, r = sp.div(sp.Poly(Pn, x), sp.Poly((x + 3)**2, x))
    check_num("q14a-ii", Q.as_expr().subs(x, -3), f"(b,c)=({sol[b]},{sol[c]}) from P(-3)=P'(-3)=0, remainder {r.as_expr()}, Q(-3)")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q11c, q11d, q11e, q12a, q13a, q13b, q14a):
    f()
finish("11")
