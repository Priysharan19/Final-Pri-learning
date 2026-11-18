#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 10 (ext1-2027-p10).
Run: /tmp/symenv/bin/python tools/papers/verify/p10.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p10.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p10.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p10.json")))

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

# Q4 / Q6 figure data sampled from the TikZ source of the author's figs.tex:
#   base/wra/wrb/wrc/opt = Q4 polylines (every 12th vertex); slope = Q6 slope-field segments (centre x, centre y, slope) in plot cm.
FIG = json.loads('''{"slope":[[-2.5,-2.5,6.0],[-2.5,-1.875,4.231],[-2.5,-1.25,2.981],[-2.5,-0.625,2.246],[-2.5,0.0,2.0],[-2.5,0.625,2.246],[-2.5,1.25,2.981],[-2.5,1.875,4.231],[-2.5,2.5,6.0],[-1.875,-2.5,5.567],[-1.875,-1.875,3.727],[-1.875,-1.25,2.508],[-1.875,-0.625,1.762],[-1.875,0.0,1.5],[-1.875,0.625,1.762],[-1.875,1.25,2.508],[-1.875,1.875,3.727],[-1.875,2.5,5.567],[-1.25,-2.5,5.061],[-1.25,-1.875,3.24],[-1.25,-1.25,2.0],[-1.25,-0.625,1.255],[-1.25,0.0,1.0],[-1.25,0.625,1.255],[-1.25,1.25,2.0],[-1.25,1.875,3.24],[-1.25,2.5,5.061],[-0.625,-2.5,4.486],[-0.625,-1.875,2.759],[-0.625,-1.25,1.5],[-0.625,-0.625,0.75],[-0.625,0.0,0.5],[-0.625,0.625,0.75],[-0.625,1.25,1.5],[-0.625,1.875,2.759],[-0.625,2.5,4.486],[0.0,-2.5,4.024],[0.0,-1.875,2.246],[0.0,-1.25,1.0],[0.0,-0.625,0.248],[0.0,0.0,0.0],[0.0,0.625,0.248],[0.0,1.25,1.0],[0.0,1.875,2.246],[0.0,2.5,4.024],[0.625,-2.5,3.468],[0.625,-1.875,1.762],[0.625,-1.25,0.5],[0.625,-0.625,-0.248],[0.625,0.0,-0.5],[0.625,0.625,-0.248],[0.625,1.25,0.5],[0.625,1.875,1.762],[0.625,2.5,3.468],[1.25,-2.5,2.981],[1.25,-1.875,1.255],[1.25,-1.25,0.0],[1.25,-0.625,-0.75],[1.25,0.0,-1.0],[1.25,0.625,-0.75],[1.25,1.25,0.0],[1.25,1.875,1.255],[1.25,2.5,2.981],[1.875,-2.5,2.508],[1.875,-1.875,0.75],[1.875,-1.25,-0.5],[1.875,-0.625,-1.255],[1.875,0.0,-1.5],[1.875,0.625,-1.255],[1.875,1.25,-0.5],[1.875,1.875,0.75],[1.875,2.5,2.508],[2.5,-2.5,2.0],[2.5,-1.875,0.248],[2.5,-1.25,-1.0],[2.5,-0.625,-1.762],[2.5,0.0,-2.0],[2.5,0.625,-1.762],[2.5,1.25,-1.0],[2.5,1.875,0.248],[2.5,2.5,2.0]],"base":[[-3.026,2.25],[-2.982,1.997],[-2.935,1.741],[-2.888,1.499],[-2.841,1.27],[-2.794,1.056],[-2.747,0.854],[-2.701,0.666],[-2.654,0.49],[-2.607,0.327],[-2.56,0.176],[-2.513,0.036],[-2.466,-0.092],[-2.419,-0.209],[-2.372,-0.315],[-2.325,-0.41],[-2.278,-0.495],[-2.231,-0.57],[-2.185,-0.636],[-2.138,-0.692],[-2.091,-0.739],[-2.044,-0.777],[-1.997,-0.807],[-1.95,-0.829],[-1.903,-0.843],[-1.856,-0.849],[-1.809,-0.849],[-1.762,-0.841],[-1.716,-0.826],[-1.669,-0.806],[-1.622,-0.779],[-1.575,-0.746],[-1.528,-0.709],[-1.481,-0.666],[-1.434,-0.618],[-1.387,-0.565],[-1.34,-0.509],[-1.293,-0.448],[-1.246,-0.384],[-1.2,-0.317],[-1.153,-0.246],[-1.106,-0.173],[-1.059,-0.098],[-1.012,-0.02],[-0.965,0.059],[-0.918,0.14],[-0.871,0.222],[-0.824,0.305],[-0.777,0.389],[-0.731,0.473],[-0.684,0.557],[-0.637,0.64],[-0.59,0.723],[-0.543,0.805],[-0.496,0.886],[-0.449,0.965],[-0.402,1.042],[-0.355,1.118],[-0.308,1.19],[-0.261,1.26],[-0.215,1.327],[-0.168,1.391],[-0.121,1.451],[-0.074,1.507],[-0.027,1.559],[0.02,1.606],[0.067,1.649],[0.114,1.686],[0.161,1.718],[0.208,1.744],[0.254,1.764],[0.301,1.778],[0.348,1.785],[0.395,1.785],[0.442,1.777],[0.489,1.762],[0.536,1.74],[0.583,1.709],[0.63,1.669],[0.677,1.621],[0.724,1.564],[0.77,1.497],[0.817,1.421],[0.864,1.334],[0.911,1.238],[0.958,1.131],[1.005,1.012],[1.052,0.883],[1.099,0.742],[1.146,0.59],[1.193,0.425],[1.239,0.248],[1.286,0.058],[1.333,-0.145],[1.38,-0.362],[1.427,-0.591],[1.474,-0.835],[1.521,-1.093],[1.568,-1.366],[1.615,-1.653],[1.662,-1.956],[1.709,-2.274],[1.741,-2.5]],"wra":[[-3.026,2.25],[-2.982,1.997],[-2.935,1.741],[-2.888,1.499],[-2.841,1.27],[-2.794,1.056],[-2.747,0.854],[-2.701,0.666],[-2.654,0.49],[-2.607,0.327],[-2.56,0.176],[-2.513,0.036],[-2.466,0.092],[-2.419,0.209],[-2.372,0.315],[-2.325,0.41],[-2.278,0.495],[-2.231,0.57],[-2.185,0.636],[-2.138,0.692],[-2.091,0.739],[-2.044,0.777],[-1.997,0.807],[-1.95,0.829],[-1.903,0.843],[-1.856,0.849],[-1.809,0.849],[-1.762,0.841],[-1.716,0.826],[-1.669,0.806],[-1.622,0.779],[-1.575,0.746],[-1.528,0.709],[-1.481,0.666],[-1.434,0.618],[-1.387,0.565],[-1.34,0.509],[-1.293,0.448],[-1.246,0.384],[-1.2,0.317],[-1.153,0.246],[-1.106,0.173],[-1.059,0.098],[-1.012,0.02],[-0.965,0.059],[-0.918,0.14],[-0.871,0.222],[-0.824,0.305],[-0.777,0.389],[-0.731,0.473],[-0.684,0.557],[-0.637,0.64],[-0.59,0.723],[-0.543,0.805],[-0.496,0.886],[-0.449,0.965],[-0.402,1.042],[-0.355,1.118],[-0.308,1.19],[-0.261,1.26],[-0.215,1.327],[-0.168,1.391],[-0.121,1.451],[-0.074,1.507],[-0.027,1.559],[0.02,1.606],[0.067,1.649],[0.114,1.686],[0.161,1.718],[0.208,1.744],[0.254,1.764],[0.301,1.778],[0.348,1.785],[0.395,1.785],[0.442,1.777],[0.489,1.762],[0.536,1.74],[0.583,1.709],[0.63,1.669],[0.677,1.621],[0.724,1.564],[0.77,1.497],[0.817,1.421],[0.864,1.334],[0.911,1.238],[0.958,1.131],[1.005,1.012],[1.052,0.883],[1.099,0.742],[1.146,0.59],[1.193,0.425],[1.239,0.248],[1.286,0.058],[1.333,0.145],[1.38,0.362],[1.427,0.591],[1.474,0.835],[1.521,1.093],[1.568,1.366],[1.615,1.653],[1.662,1.956],[1.705,2.25],[1.705,2.25]],"wrb":[[-3.026,2.25],[-2.982,1.997],[-2.935,1.741],[-2.888,1.499],[-2.841,1.27],[-2.794,1.056],[-2.747,0.854],[-2.701,0.666],[-2.654,0.49],[-2.607,0.327],[-2.56,0.176],[-2.513,0.036],[-2.466,-0.092],[-2.419,-0.209],[-2.372,-0.315],[-2.325,-0.41],[-2.278,-0.495],[-2.231,-0.57],[-2.185,-0.636],[-2.138,-0.692],[-2.091,-0.739],[-2.044,-0.777],[-1.997,-0.807],[-1.95,-0.829],[-1.903,-0.843],[-1.856,-0.849],[-1.809,-0.849],[-1.762,-0.841],[-1.716,-0.826],[-1.669,-0.806],[-1.622,-0.779],[-1.575,-0.746],[-1.528,-0.709],[-1.481,-0.666],[-1.434,-0.618],[-1.387,-0.565],[-1.34,-0.509],[-1.293,-0.448],[-1.246,-0.384],[-1.2,-0.317],[-1.153,-0.246],[-1.106,-0.173],[-1.059,-0.098],[-1.012,-0.02],[-0.965,0.059],[-0.918,0.14],[-0.871,0.222],[-0.824,0.305],[-0.777,0.389],[-0.731,0.473],[-0.684,0.557],[-0.637,0.64],[-0.59,0.723],[-0.543,0.805],[-0.496,0.886],[-0.449,0.965],[-0.402,1.042],[-0.355,1.118],[-0.308,1.19],[-0.261,1.26],[-0.215,1.327],[-0.168,1.391],[-0.121,1.451],[-0.074,1.507],[-0.027,1.559],[0.02,1.566],[0.067,1.515],[0.114,1.46],[0.161,1.4],[0.208,1.337],[0.254,1.271],[0.301,1.201],[0.348,1.129],[0.395,1.054],[0.442,0.977],[0.489,0.898],[0.536,0.817],[0.583,0.735],[0.63,0.653],[0.677,0.569],[0.724,0.485],[0.77,0.401],[0.817,0.318],[0.864,0.235],[0.911,0.152],[0.958,0.071],[1.005,-0.008],[1.052,-0.086],[1.099,-0.162],[1.146,-0.236],[1.193,-0.306],[1.239,-0.374],[1.286,-0.439],[1.333,-0.5],[1.38,-0.557],[1.427,-0.61],[1.474,-0.659],[1.521,-0.702],[1.568,-0.741],[1.615,-0.774],[1.662,-0.802],[1.709,-0.824],[1.755,-0.839],[1.802,-0.848],[1.849,-0.85],[1.896,-0.845],[1.943,-0.832],[1.99,-0.811],[2.037,-0.782],[2.084,-0.745],[2.131,-0.7],[2.178,-0.645],[2.224,-0.581],[2.271,-0.507],[2.318,-0.423],[2.365,-0.329],[2.412,-0.225],[2.459,-0.11],[2.506,0.016],[2.553,0.154],[2.6,0.304],[2.647,0.465],[2.693,0.639],[2.74,0.825],[2.787,1.025],[2.834,1.237],[2.881,1.464],[2.928,1.704],[2.975,1.958],[3.022,2.226],[3.026,2.25]],"wrc":[[-1.705,2.25],[-1.661,1.95],[-1.614,1.648],[-1.567,1.361],[-1.52,1.089],[-1.473,0.831],[-1.426,0.587],[-1.379,0.358],[-1.332,0.142],[-1.286,-0.061],[-1.239,-0.251],[-1.192,-0.428],[-1.145,-0.592],[-1.098,-0.745],[-1.051,-0.885],[-1.004,-1.015],[-0.957,-1.133],[-0.91,-1.24],[-0.863,-1.336],[-0.817,-1.422],[-0.77,-1.498],[-0.723,-1.565],[-0.676,-1.622],[-0.629,-1.67],[-0.582,-1.709],[-0.535,-1.74],[-0.488,-1.763],[-0.441,-1.777],[-0.394,-1.785],[-0.347,-1.785],[-0.301,-1.777],[-0.254,-1.764],[-0.207,-1.744],[-0.16,-1.717],[-0.113,-1.686],[-0.066,-1.648],[-0.019,-1.606],[0.028,-1.614],[0.075,-1.655],[0.122,-1.692],[0.168,-1.723],[0.215,-1.748],[0.262,-1.767],[0.309,-1.779],[0.356,-1.785],[0.403,-1.784],[0.45,-1.775],[0.497,-1.759],[0.544,-1.735],[0.591,-1.703],[0.638,-1.662],[0.684,-1.612],[0.731,-1.553],[0.778,-1.485],[0.825,-1.407],[0.872,-1.319],[0.919,-1.221],[0.966,-1.112],[1.013,-0.992],[1.06,-0.86],[1.107,-0.718],[1.153,-0.563],[1.2,-0.396],[1.247,-0.217],[1.294,-0.025],[1.341,0.18],[1.388,0.399],[1.435,0.631],[1.482,0.877],[1.529,1.138],[1.576,1.413],[1.623,1.703],[1.669,2.008],[1.705,2.25]],"opt":[[-1.741,-2.5],[-1.696,-2.187],[-1.649,-1.873],[-1.602,-1.575],[-1.555,-1.291],[-1.508,-1.023],[-1.461,-0.769],[-1.415,-0.529],[-1.368,-0.302],[-1.321,-0.09],[-1.274,0.11],[-1.227,0.296],[-1.18,0.47],[-1.133,0.632],[-1.086,0.781],[-1.039,0.919],[-0.992,1.045],[-0.945,1.16],[-0.899,1.265],[-0.852,1.359],[-0.805,1.442],[-0.758,1.516],[-0.711,1.58],[-0.664,1.635],[-0.617,1.681],[-0.57,1.718],[-0.523,1.747],[-0.476,1.767],[-0.43,1.78],[-0.383,1.785],[-0.336,1.783],[-0.289,1.775],[-0.242,1.759],[-0.195,1.738],[-0.148,1.71],[-0.101,1.677],[-0.054,1.638],[-0.007,1.594],[0.039,1.625],[0.086,1.665],[0.133,1.7],[0.18,1.73],[0.227,1.753],[0.274,1.77],[0.321,1.781],[0.368,1.785],[0.415,1.782],[0.462,1.772],[0.509,1.754],[0.555,1.728],[0.602,1.693],[0.649,1.65],[0.696,1.598],[0.743,1.537],[0.79,1.467],[0.837,1.386],[0.884,1.295],[0.931,1.194],[0.978,1.083],[1.024,0.96],[1.071,0.826],[1.118,0.68],[1.165,0.522],[1.212,0.352],[1.259,0.17],[1.306,-0.025],[1.353,-0.234],[1.4,-0.456],[1.447,-0.691],[1.494,-0.941],[1.54,-1.205],[1.587,-1.484],[1.634,-1.777],[1.681,-2.086],[1.728,-2.411],[1.741,-2.5]]}''')

def seg_dist(px, py, P):
    best = 1e9
    for (x1, y1), (x2, y2) in zip(P, P[1:]):
        dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
        s = 0.0 if L == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L))
        best = min(best, math.hypot(px - x1 - s * dx, py - y1 - s * dy))
    return best

# ----------------------------------------------------------------- Section I
def q1():
    mp.mp.dps = 30
    v = mp.quad(lambda x: mp.cos(3 * x)**2, [0, mp.pi / 4])
    opts = [mp.mpf(1) / 12 + mp.pi / 8, mp.mpf(1) / 6 + mp.pi / 4, -mp.mpf(1) / 12 + mp.pi / 8, -mp.mpf(1) / 6 + mp.pi / 8]
    mcq("q1", {l for l, o in zip("ABCD", opts) if abs(o - v) < 1e-20}, f"mpmath quadrature = {mp.nstr(v, 15)}")

def q2():
    n = sum(1 for S in itertools.combinations(range(1, 15), 5) if all(b - a > 1 for a, b in zip(S, S[1:])))
    mcq("q2", {l for l, v in zip("ABCD", [252, 126, 462, 210]) if v == n}, f"enumerated {n} qualifying 5-subsets of {{1..14}}")

def q3():
    a = sp.Matrix([-1, -4]); b = sp.Matrix([4, 3])
    pr = (a.dot(b) / b.dot(b)) * b
    R = sp.Rational
    opts = {"A": sp.Matrix([R(-64, 17), R(-48, 17)]), "B": sp.Matrix([R(-64, 25), R(-48, 25)]), "C": sp.Matrix([R(-64, 5), R(-48, 5)]), "D": sp.Matrix([R(16, 25), R(64, 25)])}
    mcq("q3", {l for l, o in opts.items() if o == pr}, f"vector projection of a on b = {tuple(pr)}")

def q4():
    base = FIG["base"]
    exp_poly = [(abs(x), y) for x, y in base if x >= 0]
    mirror = [(-x, y) for x, y in base if x >= 0]
    res = {}
    for l in ("wra", "wrb", "wrc", "opt"):
        P = FIG[l]
        # f(|x|): every drawn vertex must lie on the right half of the base graph or its mirror image ...
        right = [(x, y) for x, y in base if x >= 0]; left = [(-x, y) for x, y in base if x >= 0]
        right.sort(); left.sort()
        d1 = 0.0
        for x, y in P:
            R_ = right if x >= 0 else left
            d1 = max(d1, seg_dist(x, y, R_))
        # ... and the drawn curve must cover all of that image within the plotted window
        d2 = 0.0
        for (x, y) in right[::3] + left[::3]:
            d2 = max(d2, min(seg_dist(x, y, P), 9))
        res[l] = max(d1, d2)
    ls = {"opt": "D", "wra": "A", "wrb": "B", "wrc": "C"}
    mcq("q4", {ls[l] for l, e in res.items() if e < 0.08}, "max point-to-polyline distance both ways between each option and the graph of f(|x|) built from the TikZ base curve: " + ", ".join(f"{ls[l]}={e:.3f}" for l, e in res.items()))

def q5():
    a, b, x = sp.symbols('a b x')
    sol = sp.solve([a + b + 6, 3 * a + b + 7], [a, b])
    r = sol[a] * x + sol[b]
    R = sp.Rational
    opts = {"A": R(1, 2) * x - R(11, 2), "B": -R(1, 2) * x - R(13, 2), "C": -R(1, 2) * x - R(11, 2), "D": -R(13, 2) + 0 * x}
    mcq("q5", {l for l, o in opts.items() if sp.expand(o - r) == 0}, f"r(x)=ax+b with r(1)=-6, r(3)=-7: {r}")

def q6():
    rows = FIG["slope"]
    odes = {"A": lambda x, y: -x * y, "B": lambda x, y: x / (y + 3), "C": lambda x, y: x * y, "D": lambda x, y: y * y - x}
    best = {}
    for l, f in odes.items():
        e_best = 1e9
        for ci in range(300, 2000):
            c = ci / 1000                                     # plot cm -> axis units scale (unknown): fitted
            try:
                e = math.sqrt(sum((f(c * x, c * y) - s) ** 2 for x, y, s in rows) / len(rows))
            except ZeroDivisionError:
                continue
            e_best = min(e_best, e)
        best[l] = e_best
    mcq("q6", {l for l, e in best.items() if e < 0.1}, "RMS slope error of each ODE against the 81 slope-field segments (plot-to-axis scale fitted per ODE): " + ", ".join(f"{l}={e:.3f}" for l, e in best.items()))

def q7():
    best = max(sum(c) for c in itertools.product(range(3), repeat=9))     # at most 2 numbers in each of the 9 residue classes
    need = best + 1
    mcq("q7", {l for l, v in zip("ABCD", [18, 27, 28, 19]) if v == need}, f"largest selection with no residue class used 3 times has {best} numbers, so {need} guarantee three alike")

def q8():
    x = sp.symbols('x'); y = 3 * x**4
    tang = y.subs(x, 2) + sp.diff(y, x).subs(x, 2) * (x - 2)
    P = sp.solve(tang, x)[0]
    R = sp.Rational
    mcq("q8", {l for l, v in zip("ABCD", [R(1, 2), R(3, 2), R(5, 2), R(2, 3)]) if v == P}, f"tangent at x=2 meets y=0 at x={P}")

def q9():
    x = sp.symbols('x')
    rts = sp.Poly(2 * x**3 + 2 * x**2 + 6 * x - 9, x).nroots(n=30)
    v = sum(1 / r for r in rts)
    R = sp.Rational
    mcq("q9", {l for l, o in zip("ABCD", [R(2, 3), -R(2, 3), R(3, 2), -R(2, 9)]) if abs(complex(v - sp.N(o, 30))) < 1e-20}, f"numeric roots (complex included) give sum 1/root = {sp.N(v, 15)}")

def q10():
    x, c = sp.symbols('x c')
    sol = sp.solve([x**3 - 27 * x + c, 3 * x**2 - 27], [x, c], dict=True)
    cs = {s[c] for s in sol if s[c] > 0}
    mcq("q10", {l for l, v in zip("ABCD", [27, 54, 81, 108]) if v in cs}, f"common zero of P, P' gives c in {sorted(s[c] for s in sol)}; c>0: {cs}")

# ----------------------------------------------------------------- Section II
def q11a():
    x = sp.symbols('x')
    e = sp.expand((3 * x + 2 / x)**6)
    check_num("q11a", e.coeff(x, 0), f"expanded (3x+2/x)^6, coefficient of x^0 = {e.coeff(x, 0)}")

def q11c():
    t = sp.symbols('t', real=True)
    A = sp.Matrix([4, 2]); B = sp.Matrix([2, 4]); C = sp.Matrix([1, 7])
    P = A + t * (B - A)
    ts = sp.solve(sp.diff((P - C).dot(P - C), t), t)[0]; Pp = P.subs(t, ts)
    k = kc("q11c"); ok = k["type"] == "point" and close(k["x"], float(Pp[0])) and close(k["y"], float(Pp[1]))
    report("q11c", "PASS" if ok else "FAIL", f"minimiser of |P-C|^2 along AB: P={tuple(Pp)}; key ({k['x']},{k['y']})")

def q11d():
    V = 30.0
    def gap(th):
        t = 60 / (V * math.cos(th))
        return V * math.sin(th) * t - 5 * t * t - 5
    N = 200000; roots = []
    ths = [(pi / 2) * i / N for i in range(1, N)]
    for a, b in zip(ths, ths[1:]):
        if gap(a) * gap(b) < 0:
            lo, hi = a, b
            for _ in range(100):
                m = (lo + hi) / 2
                if gap(lo) * gap(m) <= 0: hi = m
                else: lo = m
            roots.append(math.tan((lo + hi) / 2))
    check_set("q11d", roots, f"sign changes of (height at 60 m)-5 over theta in (0,pi/2), bisected: tan(theta) = {[round(r, 9) for r in roots]}")

def q12a():
    f = lambda x: math.sin(x)**2 + 8 * math.sin(x) * math.cos(x) - 4 * math.cos(x)**2
    N = 200000
    i0 = min(range(N + 1), key=lambda i: f(2 * pi * i / N))
    lo, hi = 2 * pi * max(0, i0 - 1) / N, 2 * pi * min(N, i0 + 1) / N
    for _ in range(200):
        m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
        if f(m1) < f(m2): hi = m2
        else: lo = m1
    best = f((lo + hi) / 2)
    k = kc("q12a")
    ok = close(best, float(sp.N(ex(k["expr"]), 30)), 1e-12) and all(close(best, float(sp.N(ex(f_), 30)), 1e-12) for f_ in k.get("anyOf", []))
    report("q12a", "PASS" if ok else "FAIL", f"grid + golden-section minimum over [0,2pi] = {best:.12f}; key {k['expr']}")

def q12b():
    sols = []
    for n in range(4, 301):
        p = Fr(15, 4 * n)
        if p > 1: continue
        if comb(n, 3) * p**3 * (1 - p)**(n - 3) == comb(n, 4) * p**4 * (1 - p)**(n - 4): sols.append(n)
    check_num("q12b", sols[0] if sols == [15] else -1, f"exact Fractions, p=15/(4n); P(X=3)=P(X=4) for n in {sols}")

def q12c():
    def crossing_prob(m, n):
        segs = [(i, j) for i in range(m) for j in range(n)]
        tot = cr = 0
        for (i1, j1), (i2, j2) in itertools.combinations(segs, 2):
            tot += 1
            if (i1 - i2) * (j1 - j2) < 0: cr += 1               # endpoints in opposite order => cross between the lines
        return Fr(cr, tot)
    check_exact("q12c-ii", crossing_prob(6, 7), f"6x7 case: probability {crossing_prob(6, 7)}")
    first = None; probs = {}
    for n in range(2, 17):
        probs[n] = crossing_prob(n, n)
    first = next(n for n in range(2, 17) if probs[n] > Fr(2, 5))
    stays = all(probs[n] > Fr(2, 5) for n in range(first, 17))
    check_num("q12c-iv", first if stays else -1, f"enumerated crossing probability for n=2..16: first above 2/5 at n={first} (P={probs[first]}), stays above: {stays}")

def q13a():
    t = sp.symbols('t', positive=True)
    s = sp.symbols('s', positive=True)
    pt = sp.Matrix([4, 1 + 2 * t]); line = s * sp.Matrix([4, 3])
    sol = sp.solve(list(pt - line), [t, s], dict=True)
    P = tuple(pt.subs(t, sol[0][t]))
    k = kc("q13a-ii"); ok = k["type"] == "point" and close(k["x"], float(P[0])) and close(k["y"], float(P[1]))
    report("q13a-ii", "PASS" if ok else "FAIL", f"path meets the cushion line at t={sol[0][t]}: P={P}; key ({k['x']},{k['y']})")

def q13b():
    k = kc("q13b-i"); tt = sp.Symbol('t', positive=True)
    key = ex(k["expr"].replace("e^", "E**"), E=sp.E) if False else sp.sympify(k["expr"].replace("^", "**"), locals={"e": sp.E, "t": tt})
    ok = True
    for T in (0.5, 1.0, 2.0, 3.7, 5.0, 8.0, 12.0, 20.0):
        n = 4000; h = T / n; G = 350.0
        for _ in range(n):
            k1 = -G / 5; k2 = -(G + h * k1 / 2) / 5; k3 = -(G + h * k2 / 2) / 5; k4 = -(G + h * k3) / 5
            G += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        ok &= abs(G - float(key.subs(tt, T))) < 1e-9
    report("q13b-i", "PASS" if ok else "FAIL", "RK4 of dG/dt=-G/5 from G(0)=350 vs the key at 8 times")

def q14c():
    mp.mp.dps = 30
    cases = {
        "q14c-i": mp.quad(lambda x: 2 * mp.atan(x / 4), [0, 4]),
        "q14c-ii": mp.pi * mp.quad(lambda y: (4 * mp.tan(y / 2))**2, [0, mp.pi / 2]),
        "q14c-iii": 2 * mp.pi * mp.quad(lambda x: x * 2 * mp.atan(x / 4), [0, 4]),
    }
    how = {"q14c-i": "area under the curve by quadrature", "q14c-ii": "disc method for T about the y-axis", "q14c-iii": "shell method for S about the y-axis"}
    for item, v in cases.items():
        k = kc(item); key = sp.N(ex(k["expr"].replace("ln(", "log(")), 30)
        report(item, "PASS" if close(float(v), float(key), 1e-12) else "FAIL", f"{how[item]} = {mp.nstr(v, 15)}; key {k['expr']}")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11c, q11d, q12a, q12b, q12c, q13a, q13b, q14c):
    f()
finish("10")
