#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 9 (ext1-2027-p09, scope-revised).
Run: /tmp/symenv/bin/python tools/papers/verify/p09.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p09.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p09.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p09.json")))

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

# Q2 option curves, sampled from the TikZ polylines (every 4th of 601 points) in the author's figs.tex
FIGP = json.loads('''{"A":[[1.0,0.0],[0.999,0.125],[0.996,0.249],[0.992,0.368],[0.986,0.482],[0.978,0.588],[0.969,0.685],[0.957,0.771],[0.944,0.844],[0.93,0.905],[0.914,0.951],[0.896,0.982],[0.876,0.998],[0.855,0.998],[0.833,0.982],[0.809,0.951],[0.784,0.905],[0.757,0.844],[0.729,0.771],[0.7,0.685],[0.669,0.588],[0.637,0.482],[0.605,0.368],[0.571,0.249],[0.536,0.125],[0.5,-0.0],[0.463,-0.125],[0.426,-0.249],[0.388,-0.368],[0.349,-0.482],[0.309,-0.588],[0.269,-0.685],[0.228,-0.771],[0.187,-0.844],[0.146,-0.905],[0.105,-0.951],[0.063,-0.982],[0.021,-0.998],[-0.021,-0.998],[-0.063,-0.982],[-0.105,-0.951],[-0.146,-0.905],[-0.187,-0.844],[-0.228,-0.771],[-0.269,-0.685],[-0.309,-0.588],[-0.349,-0.482],[-0.388,-0.368],[-0.426,-0.249],[-0.463,-0.125],[-0.5,0.0],[-0.536,0.125],[-0.571,0.249],[-0.605,0.368],[-0.637,0.482],[-0.669,0.588],[-0.7,0.685],[-0.729,0.771],[-0.757,0.844],[-0.784,0.905],[-0.809,0.951],[-0.833,0.982],[-0.855,0.998],[-0.876,0.998],[-0.896,0.982],[-0.914,0.951],[-0.93,0.905],[-0.944,0.844],[-0.957,0.771],[-0.969,0.685],[-0.978,0.588],[-0.986,0.482],[-0.992,0.368],[-0.996,0.249],[-0.999,0.125],[-1.0,0.0],[-0.999,-0.125],[-0.996,-0.249],[-0.992,-0.368],[-0.986,-0.482],[-0.978,-0.588],[-0.969,-0.685],[-0.957,-0.771],[-0.944,-0.844],[-0.93,-0.905],[-0.914,-0.951],[-0.896,-0.982],[-0.876,-0.998],[-0.855,-0.998],[-0.833,-0.982],[-0.809,-0.951],[-0.784,-0.905],[-0.757,-0.844],[-0.729,-0.771],[-0.7,-0.685],[-0.669,-0.588],[-0.637,-0.482],[-0.605,-0.368],[-0.571,-0.249],[-0.536,-0.125],[-0.5,0.0],[-0.463,0.125],[-0.426,0.249],[-0.388,0.368],[-0.349,0.482],[-0.309,0.588],[-0.269,0.685],[-0.228,0.771],[-0.187,0.844],[-0.146,0.905],[-0.105,0.951],[-0.063,0.982],[-0.021,0.998],[0.021,0.998],[0.063,0.982],[0.105,0.951],[0.146,0.905],[0.187,0.844],[0.228,0.771],[0.269,0.685],[0.309,0.588],[0.349,0.482],[0.388,0.368],[0.426,0.249],[0.463,0.125],[0.5,0.0],[0.536,-0.125],[0.571,-0.249],[0.605,-0.368],[0.637,-0.482],[0.669,-0.588],[0.7,-0.685],[0.729,-0.771],[0.757,-0.844],[0.784,-0.905],[0.809,-0.951],[0.833,-0.982],[0.855,-0.998],[0.876,-0.998],[0.896,-0.982],[0.914,-0.951],[0.93,-0.905],[0.944,-0.844],[0.957,-0.771],[0.969,-0.685],[0.978,-0.588],[0.986,-0.482],[0.992,-0.368],[0.996,-0.249],[0.999,-0.125],[1.0,-0.0]],"B":[[1.0,0.0],[0.992,0.167],[0.969,0.329],[0.93,0.482],[0.876,0.621],[0.809,0.743],[0.729,0.844],[0.637,0.922],[0.536,0.974],[0.426,0.998],[0.309,0.995],[0.187,0.963],[0.063,0.905],[-0.063,0.821],[-0.187,0.714],[-0.309,0.588],[-0.426,0.445],[-0.536,0.289],[-0.637,0.125],[-0.729,-0.042],[-0.809,-0.208],[-0.876,-0.368],[-0.93,-0.518],[-0.969,-0.653],[-0.992,-0.771],[-1.0,-0.866],[-0.992,-0.937],[-0.969,-0.982],[-0.93,-1.0],[-0.876,-0.989],[-0.809,-0.951],[-0.729,-0.886],[-0.637,-0.797],[-0.536,-0.685],[-0.426,-0.553],[-0.309,-0.407],[-0.187,-0.249],[-0.063,-0.084],[0.063,0.084],[0.187,0.249],[0.309,0.407],[0.426,0.553],[0.536,0.685],[0.637,0.797],[0.729,0.886],[0.809,0.951],[0.876,0.989],[0.93,1.0],[0.969,0.982],[0.992,0.937],[1.0,0.866],[0.992,0.771],[0.969,0.653],[0.93,0.518],[0.876,0.368],[0.809,0.208],[0.729,0.042],[0.637,-0.125],[0.536,-0.289],[0.426,-0.445],[0.309,-0.588],[0.187,-0.714],[0.063,-0.821],[-0.063,-0.905],[-0.187,-0.963],[-0.309,-0.995],[-0.426,-0.998],[-0.536,-0.974],[-0.637,-0.922],[-0.729,-0.844],[-0.809,-0.743],[-0.876,-0.621],[-0.93,-0.482],[-0.969,-0.329],[-0.992,-0.167],[-1.0,-0.0],[-0.992,0.167],[-0.969,0.329],[-0.93,0.482],[-0.876,0.621],[-0.809,0.743],[-0.729,0.844],[-0.637,0.922],[-0.536,0.974],[-0.426,0.998],[-0.309,0.995],[-0.187,0.963],[-0.063,0.905],[0.063,0.821],[0.187,0.714],[0.309,0.588],[0.426,0.445],[0.536,0.289],[0.637,0.125],[0.729,-0.042],[0.809,-0.208],[0.876,-0.368],[0.93,-0.518],[0.969,-0.653],[0.992,-0.771],[1.0,-0.866],[0.992,-0.937],[0.969,-0.982],[0.93,-1.0],[0.876,-0.989],[0.809,-0.951],[0.729,-0.886],[0.637,-0.797],[0.536,-0.685],[0.426,-0.553],[0.309,-0.407],[0.187,-0.249],[0.063,-0.084],[-0.063,0.084],[-0.187,0.249],[-0.309,0.407],[-0.426,0.553],[-0.536,0.685],[-0.637,0.797],[-0.729,0.886],[-0.809,0.951],[-0.876,0.989],[-0.93,1.0],[-0.969,0.982],[-0.992,0.937],[-1.0,0.866],[-0.992,0.771],[-0.969,0.653],[-0.93,0.518],[-0.876,0.368],[-0.809,0.208],[-0.729,0.042],[-0.637,-0.125],[-0.536,-0.289],[-0.426,-0.445],[-0.309,-0.588],[-0.187,-0.714],[-0.063,-0.821],[0.063,-0.905],[0.187,-0.963],[0.309,-0.995],[0.426,-0.998],[0.536,-0.974],[0.637,-0.922],[0.729,-0.844],[0.809,-0.743],[0.876,-0.621],[0.93,-0.482],[0.969,-0.329],[0.992,-0.167],[1.0,-0.0]],"C":[[1.0,0.0],[0.986,0.042],[0.944,0.084],[0.876,0.125],[0.784,0.167],[0.669,0.208],[0.536,0.249],[0.388,0.289],[0.228,0.329],[0.063,0.368],[-0.105,0.407],[-0.269,0.445],[-0.426,0.482],[-0.571,0.518],[-0.7,0.553],[-0.809,0.588],[-0.896,0.621],[-0.957,0.653],[-0.992,0.685],[-0.999,0.714],[-0.978,0.743],[-0.93,0.771],[-0.855,0.797],[-0.757,0.821],[-0.637,0.844],[-0.5,0.866],[-0.349,0.886],[-0.187,0.905],[-0.021,0.922],[0.146,0.937],[0.309,0.951],[0.463,0.963],[0.605,0.974],[0.729,0.982],[0.833,0.989],[0.914,0.995],[0.969,0.998],[0.996,1.0],[0.996,1.0],[0.969,0.998],[0.914,0.995],[0.833,0.989],[0.729,0.982],[0.605,0.974],[0.463,0.963],[0.309,0.951],[0.146,0.937],[-0.021,0.922],[-0.187,0.905],[-0.349,0.886],[-0.5,0.866],[-0.637,0.844],[-0.757,0.821],[-0.855,0.797],[-0.93,0.771],[-0.978,0.743],[-0.999,0.714],[-0.992,0.685],[-0.957,0.653],[-0.896,0.621],[-0.809,0.588],[-0.7,0.553],[-0.571,0.518],[-0.426,0.482],[-0.269,0.445],[-0.105,0.407],[0.063,0.368],[0.228,0.329],[0.388,0.289],[0.536,0.249],[0.669,0.208],[0.784,0.167],[0.876,0.125],[0.944,0.084],[0.986,0.042],[1.0,0.0],[0.986,-0.042],[0.944,-0.084],[0.876,-0.125],[0.784,-0.167],[0.669,-0.208],[0.536,-0.249],[0.388,-0.289],[0.228,-0.329],[0.063,-0.368],[-0.105,-0.407],[-0.269,-0.445],[-0.426,-0.482],[-0.571,-0.518],[-0.7,-0.553],[-0.809,-0.588],[-0.896,-0.621],[-0.957,-0.653],[-0.992,-0.685],[-0.999,-0.714],[-0.978,-0.743],[-0.93,-0.771],[-0.855,-0.797],[-0.757,-0.821],[-0.637,-0.844],[-0.5,-0.866],[-0.349,-0.886],[-0.187,-0.905],[-0.021,-0.922],[0.146,-0.937],[0.309,-0.951],[0.463,-0.963],[0.605,-0.974],[0.729,-0.982],[0.833,-0.989],[0.914,-0.995],[0.969,-0.998],[0.996,-1.0],[0.996,-1.0],[0.969,-0.998],[0.914,-0.995],[0.833,-0.989],[0.729,-0.982],[0.605,-0.974],[0.463,-0.963],[0.309,-0.951],[0.146,-0.937],[-0.021,-0.922],[-0.187,-0.905],[-0.349,-0.886],[-0.5,-0.866],[-0.637,-0.844],[-0.757,-0.821],[-0.855,-0.797],[-0.93,-0.771],[-0.978,-0.743],[-0.999,-0.714],[-0.992,-0.685],[-0.957,-0.653],[-0.896,-0.621],[-0.809,-0.588],[-0.7,-0.553],[-0.571,-0.518],[-0.426,-0.482],[-0.269,-0.445],[-0.105,-0.407],[0.063,-0.368],[0.228,-0.329],[0.388,-0.289],[0.536,-0.249],[0.669,-0.208],[0.784,-0.167],[0.876,-0.125],[0.944,-0.084],[0.986,-0.042],[1.0,-0.0]],"D":[[1.0,0.0],[0.996,0.042],[0.986,0.084],[0.969,0.125],[0.944,0.167],[0.914,0.208],[0.876,0.249],[0.833,0.289],[0.784,0.329],[0.729,0.368],[0.669,0.407],[0.605,0.445],[0.536,0.482],[0.463,0.518],[0.388,0.553],[0.309,0.588],[0.228,0.621],[0.146,0.653],[0.063,0.685],[-0.021,0.714],[-0.105,0.743],[-0.187,0.771],[-0.269,0.797],[-0.349,0.821],[-0.426,0.844],[-0.5,0.866],[-0.571,0.886],[-0.637,0.905],[-0.7,0.922],[-0.757,0.937],[-0.809,0.951],[-0.855,0.963],[-0.896,0.974],[-0.93,0.982],[-0.957,0.989],[-0.978,0.995],[-0.992,0.998],[-0.999,1.0],[-0.999,1.0],[-0.992,0.998],[-0.978,0.995],[-0.957,0.989],[-0.93,0.982],[-0.896,0.974],[-0.855,0.963],[-0.809,0.951],[-0.757,0.937],[-0.7,0.922],[-0.637,0.905],[-0.571,0.886],[-0.5,0.866],[-0.426,0.844],[-0.349,0.821],[-0.269,0.797],[-0.187,0.771],[-0.105,0.743],[-0.021,0.714],[0.063,0.685],[0.146,0.653],[0.228,0.621],[0.309,0.588],[0.388,0.553],[0.463,0.518],[0.536,0.482],[0.605,0.445],[0.669,0.407],[0.729,0.368],[0.784,0.329],[0.833,0.289],[0.876,0.249],[0.914,0.208],[0.944,0.167],[0.969,0.125],[0.986,0.084],[0.996,0.042],[1.0,0.0],[0.996,-0.042],[0.986,-0.084],[0.969,-0.125],[0.944,-0.167],[0.914,-0.208],[0.876,-0.249],[0.833,-0.289],[0.784,-0.329],[0.729,-0.368],[0.669,-0.407],[0.605,-0.445],[0.536,-0.482],[0.463,-0.518],[0.388,-0.553],[0.309,-0.588],[0.228,-0.621],[0.146,-0.653],[0.063,-0.685],[-0.021,-0.714],[-0.105,-0.743],[-0.187,-0.771],[-0.269,-0.797],[-0.349,-0.821],[-0.426,-0.844],[-0.5,-0.866],[-0.571,-0.886],[-0.637,-0.905],[-0.7,-0.922],[-0.757,-0.937],[-0.809,-0.951],[-0.855,-0.963],[-0.896,-0.974],[-0.93,-0.982],[-0.957,-0.989],[-0.978,-0.995],[-0.992,-0.998],[-0.999,-1.0],[-0.999,-1.0],[-0.992,-0.998],[-0.978,-0.995],[-0.957,-0.989],[-0.93,-0.982],[-0.896,-0.974],[-0.855,-0.963],[-0.809,-0.951],[-0.757,-0.937],[-0.7,-0.922],[-0.637,-0.905],[-0.571,-0.886],[-0.5,-0.866],[-0.426,-0.844],[-0.349,-0.821],[-0.269,-0.797],[-0.187,-0.771],[-0.105,-0.743],[-0.021,-0.714],[0.063,-0.685],[0.146,-0.653],[0.228,-0.621],[0.309,-0.588],[0.388,-0.553],[0.463,-0.518],[0.536,-0.482],[0.605,-0.445],[0.669,-0.407],[0.729,-0.368],[0.784,-0.329],[0.833,-0.289],[0.876,-0.249],[0.914,-0.208],[0.944,-0.167],[0.969,-0.125],[0.986,-0.084],[0.996,-0.042],[1.0,-0.0]]}''')

# ----------------------------------------------------------------- Section I
def q1():
    xs = [-4 + 8 * i / 20000 for i in range(20001)]
    ys = [3 * math.asin(x / 4) + 9 for x in xs]
    lo, hi = min(ys), max(ys)
    opts = {"A": (9, 3 * pi + 9), "B": (-3 * pi / 2 + 9, 3 * pi / 2 + 9), "C": (-3 * pi + 9, 3 * pi + 9), "D": (-pi / 2 + 9, pi / 2 + 9)}
    mcq("q1", {l for l, (a, b) in opts.items() if abs(a - lo) < 1e-9 and abs(b - hi) < 1e-9}, f"range over the domain [-4,4] sampled at 20001 points: [{lo:.6f},{hi:.6f}]")

def q2():
    def dseg(px, py, P):
        best = 1e9
        for (x1, y1), (x2, y2) in zip(P, P[1:]):
            dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
            s = 0.0 if L == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L))
            best = min(best, math.hypot(px - x1 - s * dx, py - y1 - s * dy))
        return best
    true = [(math.cos(3 * t), math.sin(4 * t)) for t in (2 * pi * i / 20000 for i in range(20001))]
    tpoly = true[::25]
    res = {}
    for l, P in FIGP.items():
        d1 = max(dseg(x, y, tpoly) for x, y in P)               # drawn vertices lie on the true curve
        d2 = max(dseg(x, y, P) for x, y in true[::100])         # true curve is covered by the drawn one
        res[l] = max(d1, d2)
    mcq("q2", {l for l, e in res.items() if e < 0.02}, "max point-to-polyline distance, both ways, between each option's TikZ polyline and (cos3t, sin4t): " + ", ".join(f"{l}={e:.4f}" for l, e in res.items()))

def q3():
    n = sum(1 for S in itertools.combinations(range(1, 12), 4) if all(b - a > 1 for a, b in zip(S, S[1:])))
    mcq("q3", {l for l, v in zip("ABCD", [35, 126, 70, 56]) if v == n}, f"enumerated {n} qualifying 4-subsets of {{1..11}}")

def q4():
    x, c = sp.symbols('x c')
    sol = sp.solve([x**4 - 864 * x + c, sp.diff(x**4 - 864 * x + c, x)], [x, c], dict=True)
    real = [s for s in sol if s[x].is_real and s[c].is_real]
    cs = {s[c] for s in real}
    mcq("q4", {l for l, v in zip("ABCD", [3888, 1296, 5184, 2592]) if v in cs}, f"common root of P and P': (x,c) = {[(s[x], s[c]) for s in real]}")

def q5():
    h = lambda x: math.sin(4 * x) - math.sin(x)
    N = 2000000; roots = []
    prev = h(0.0)
    if abs(prev) < 1e-12: roots.append(0.0)
    for i in range(1, N + 1):
        x = 2 * pi * i / N; cur = h(x)
        if abs(cur) < 1e-12 and (not roots or abs(roots[-1] - x) > 1e-5): roots.append(x)
        elif prev * cur < 0 and not (roots and abs(roots[-1] - x) < 1e-5): roots.append(x)
        prev = cur
    mcq("q5", {l for l, v in zip("ABCD", [8, 10, 9, 6]) if v == len(roots)}, f"zeros of sin4x-sinx on [0,2pi] on a 2e6-point grid (sign changes + exact zeros): {len(roots)}")

def q6():
    sols = []
    n, p = sp.symbols('n p', positive=True)
    s = sp.solve([n * p - 4, n * p * (1 - p) - sp.Rational(16, 5)], [n, p], dict=True)
    s = [(v[n], v[p]) for v in s]
    mcq("q6", {l for l, o in zip("ABCD", [(5, sp.Rational(4, 5)), (40, sp.Rational(1, 10)), (20, sp.Rational(1, 5)), (21, sp.Rational(1, 5))]) if o in s}, f"solution of np=4, np(1-p)=16/5: {s}")

def q7():
    a = sp.Matrix([2, -5]); b = sp.Matrix([-1, -5]); t = sp.symbols('t')
    sol = sp.solve((a + t * b).dot(a - b), t)
    mcq("q7", {l for l, o in zip("ABCD", [-2, sp.Rational(-3, 13), sp.Rational(29, 26), 2]) if o in sol}, f"(a+tb).(a-b)=0 gives t={sol}")

def q8():
    f = lambda P: P / 5 * (1 - P / 800)
    best = max(f(i / 100) for i in range(0, 100001))
    mcq("q8", {l for l, v in zip("ABCD", [40, 80, 160, 200]) if abs(v - best) < 1e-6}, f"equilibrium needs h=P(1-P/800)/5; its maximum over P in [0,1000] is {best:.6f}")

def q9():
    V = 25.0; g = 9.8
    a1, a2 = math.radians(30), math.radians(65)
    pos = lambda a, t: (V * math.cos(a) * t, V * math.sin(a) * t - .5 * g * t * t)
    angs = []
    for t in (0.2, 0.5, 0.9, 1.3):
        p, q = pos(a1, t), pos(a2, t)
        d = (p[0] - q[0], p[1] - q[1])
        ang = math.degrees(math.atan2(abs(d[1]), abs(d[0])))
        angs.append(ang)
    const = max(angs) - min(angs) < 1e-9
    mcq("q9", {l for l, v in zip("ABCD", [47.5, 17.5, 72.5, 42.5]) if const and abs(v - angs[0]) < 1e-6}, f"angle of the joining line to the horizontal at 4 times: {[round(a, 6) for a in angs]}")

def q10():
    x = sp.symbols('x'); X0 = 3
    y = sp.exp(6 * x)
    tang = y.subs(x, X0) + sp.diff(y, x).subs(x, X0) * (x - X0)
    P = sp.solve(tang, x)[0]
    mcq("q10", {l for l, v in zip("ABCD", [sp.Rational(19, 6), -3, sp.Rational(1, 2), sp.Rational(17, 6)]) if sp.simplify(v - P) == 0}, f"tangent at x=3 meets y=0 at x={P}")

# ----------------------------------------------------------------- Section II
def q11a():
    f = lambda x, y: (1 + y * y) * math.cos(x)
    ok = True
    for xt in (-3.0, -1.7, -0.4, 0.6, 1.2, 1.9, 2.5, 3.0):
        n = 4000; h = xt / n; x = 0.0; y = 0.0
        for _ in range(n):
            k1 = f(x, y); k2 = f(x + h / 2, y + h * k1 / 2); k3 = f(x + h / 2, y + h * k2 / 2); k4 = f(x + h, y + h * k3)
            y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h
        ok &= abs(y - math.tan(math.sin(xt))) < 1e-9
    k = kc("q11a")
    ok &= k["expr"] == "tan(sin(x))"
    report("q11a", "PASS" if ok else "FAIL", "RK4 (4000 steps) from y(0)=0 vs tan(sin x) at 8 points in [-3,3]; key " + k["expr"])

def q11d():
    f = lambda x: 3 * math.sin(x)**2 - 4 * math.sin(x) * math.cos(x) - math.cos(x)**2
    N = 200000
    xs = [2 * pi * i / N for i in range(N + 1)]
    i0 = min(range(N + 1), key=lambda i: f(xs[i]))
    lo, hi = xs[max(0, i0 - 1)], xs[min(N, i0 + 1)]
    for _ in range(200):
        m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
        if f(m1) < f(m2): hi = m2
        else: lo = m1
    best = f((lo + hi) / 2)
    k = kc("q11d"); ok = close(best, float(sp.N(ex(k["expr"]), 30)), 1e-12)
    report("q11d", "PASS" if ok else "FAIL", f"grid + golden-section minimum over [0,2pi] = {best:.12f}; key {k['expr']}")

def q11e():
    mp.mp.dps = 30
    v = mp.quad(lambda x: x**3 / mp.sqrt(x * x + 4), [0, 3])
    k = kc("q11e"); ok = close(float(v), float(sp.N(ex(k["expr"]), 30)), 1e-12)
    report("q11e", "PASS" if ok else "FAIL", f"mpmath quadrature = {mp.nstr(v, 15)}; key {k['expr']}")

def q12a():
    t = sp.symbols('t', real=True)
    A = sp.Matrix([-4, 0]); B = sp.Matrix([-3, -2]); C = sp.Matrix([4, 5])
    P = A + t * (B - A)
    ts = sp.solve(sp.diff((P - C).dot(P - C), t), t)[0]
    Pp = P.subs(t, ts)
    k = kc("q12a")
    ok = k["type"] == "point" and close(k["x"], float(Pp[0])) and close(k["y"], float(Pp[1]))
    report("q12a", "PASS" if ok else "FAIL", f"SymPy minimiser of |P-C|^2 along AB: P={tuple(Pp)}; key ({k['x']},{k['y']})")

def q12b():
    sols = []
    for n in range(3, 201):
        p = Fr(11, 4 * n)
        if p > 1: continue
        P2 = comb(n, 2) * p**2 * (1 - p)**(n - 2); P3 = comb(n, 3) * p**3 * (1 - p)**(n - 3)
        if P2 == P3: sols.append(n)
    check_num("q12b", sols[0] if sols == [11] else -1, f"exact Fractions, mean 11/4 so p=11/(4n); P(X=2)=P(X=3) holds for n in {sols}")

def q12c():
    g = 10.0; V = 20.0
    def R(th):
        # y(t) = -5 : 5t^2 - V sin(th) t - 5 = 0, positive root
        s = V * math.sin(th); t = (s + math.sqrt(s * s + 100)) / 10
        return V * math.cos(th) * t
    N = 100000; best = max(range(N + 1), key=lambda i: R(pi / 2 * i / N))
    lo, hi = pi / 2 * max(0, best - 1) / N, pi / 2 * min(N, best + 1) / N
    for _ in range(200):
        m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
        if R(m1) > R(m2): hi = m2
        else: lo = m1
    th = (lo + hi) / 2
    check_num("q12c-ii", R(th), f"landing range maximised over theta: theta={th:.6f}")
    check_num("q12c-iii", math.tan(th), "tan of that maximising theta")

def q13():
    mp.mp.dps = 30
    T = lambda k: mp.atan(mp.mpf(2) / (4 + k * (k - 1)))
    S = lambda n: mp.fsum(T(k) for k in range(1, n + 1))
    ok = all(abs(S(n) - mp.atan(mp.mpf(n) / 2)) < mp.mpf(10)**-25 for n in range(1, 41))
    k = kc("q13a-ii"); n_ = sp.Symbol('n', positive=True)
    ok &= all(abs(mp.mpf(sp.N(ex(k["expr"]).subs(n_, nn), 30)) - S(nn)) < mp.mpf(10)**-25 for nn in range(1, 41))
    report("q13a-ii", "PASS" if ok else "FAIL", f"direct sums of T_k, n=1..40, vs key {k['expr']} at 30 digits")
    mp.mp.dps = 30
    lim = mp.nsum(lambda k: mp.atan(mp.mpf(2) / (4 + k * (k - 1))), [1, mp.inf])
    k3 = kc("q13a-iii"); ok3 = abs(lim - mp.mpf(sp.N(ex(k3["expr"]), 30))) < mp.mpf(10)**-12
    report("q13a-iii", "PASS" if ok3 else "FAIL", f"mp.nsum limit {mp.nstr(lim, 20)}; key {k3['expr']}")
    mp.mp.dps = 40
    s = mp.mpf(0); n = 0; thr = mp.pi / 2 - mp.mpf(1) / 100
    while True:
        n += 1; s += T(n)
        if s > thr: break
    check_num("q13a-iv", n, f"partial sums: first n with S_n > pi/2-1/100 is {n}")

def q13b():
    mp.mp.dps = 120
    a = mp.cos(mp.pi / 64); n = 1
    while abs(a - 1) > mp.mpf(10)**-100 and n < 100:
        a = 2 * a * a - 1; n += 1
    check_num("q13b-ii", n, f"iterated the recurrence at 120 digits: a_n=1 first at n={n}")
    x = sp.symbols('x')
    a3 = sp.expand(2 * (2 * x**2 - 1)**2 - 1)
    roots = sp.Poly(a3 - x, x).real_roots()
    vals = [float(r) for r in roots]
    check_set("q13b-iii", vals, f"real roots of a_3(a)-a (degree 4): {roots}")

def q14a():
    mp.mp.dps = 30
    p = Fr(47, 50)
    pmf = lambda n, k: comb(n, k) * p**k * (1 - p)**(n - k)
    k13 = sum(pmf(13, k) for k in range(13, 14))
    kk = kc("q14a-i")
    key_val = sp.N(ex(kk["expr"]), 25)
    ok = kk["type"] == "expression" and abs(float(k13) - float(key_val)) < 1e-15 and k13 == p**13
    report("q14a-i", "PASS" if ok else "FAIL", f"exact binomial P(all 13 turn up)={float(k13):.10f}; key {kk['expr']}")
    def income(tix, C):
        exp_comp = sum(pmf(tix, k) * (k - 12) for k in range(13, tix + 1))
        return 250 * tix - C * exp_comp
    best = max(C for C in range(0, 5000) if income(14, C) > income(13, C))
    ok2 = all((income(14, C) > income(13, C)) == (C <= best) for C in range(0, 5000))
    check_num("q14a-iv", best if ok2 else -1, f"exact Fractions: income(14)>income(13) iff C<={best} over C=0..4999")

def q14b():
    mp.mp.dps = 30
    V = lambda h: mp.pi * mp.quad(lambda y: (2 * y)**2, [0, h])
    dV = lambda h: mp.diff(V, h)
    check_num("q14b-ii", float(6 / dV(2)), "V(h)=pi*int_0^h x^2 dy by quadrature, dh/dt=6/V'(h) at h=2")
    k = kc("q14b-iii"); t = V(2) / 6
    report("q14b-iii", "PASS" if close(float(t), float(sp.N(ex(k["expr"]), 30)), 1e-12) else "FAIL", f"V(2)/6={mp.nstr(t, 15)}; key {k['expr']}")
    h = mp.findroot(lambda hh: 6 / dV(hh) - 1 / mp.pi, 1.0)
    check_num("q14b-iv", float(h), f"root of 6/V'(h)=1/pi: h={mp.nstr(h, 15)}")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11d, q11e, q12a, q12b, q12c, q13, q13b, q14a, q14b):
    f()
finish("09")
