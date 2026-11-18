#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 12 (ext1-2027-p12, scope-revised).
Run: /tmp/symenv/bin/python tools/papers/verify/p12.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p12.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p12.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p12.json")))

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

# Figure data sampled from the TikZ source of the author's figs.tex:
#   base/wra/wrb/wrc/opt = Q3 polylines (every 12th vertex); slope = Q7 slope-field segments (centre x, centre y, slope) in plot cm.
FIG = json.loads('''{"base":[[-1.36,2.25],[-1.317,1.919],[-1.27,1.579],[-1.223,1.259],[-1.176,0.959],[-1.129,0.678],[-1.082,0.416],[-1.035,0.172],[-0.988,-0.054],[-0.942,-0.262],[-0.895,-0.454],[-0.848,-0.63],[-0.801,-0.789],[-0.754,-0.934],[-0.707,-1.063],[-0.66,-1.178],[-0.613,-1.279],[-0.566,-1.366],[-0.519,-1.441],[-0.473,-1.503],[-0.426,-1.553],[-0.379,-1.591],[-0.332,-1.619],[-0.285,-1.635],[-0.238,-1.642],[-0.191,-1.639],[-0.144,-1.627],[-0.097,-1.606],[-0.05,-1.578],[-0.004,-1.541],[0.043,-1.497],[0.09,-1.447],[0.137,-1.39],[0.184,-1.327],[0.231,-1.259],[0.278,-1.187],[0.325,-1.11],[0.372,-1.029],[0.419,-0.945],[0.466,-0.858],[0.512,-0.768],[0.559,-0.677],[0.606,-0.584],[0.653,-0.49],[0.7,-0.396],[0.747,-0.302],[0.794,-0.208],[0.841,-0.115],[0.888,-0.024],[0.935,0.066],[0.981,0.153],[1.028,0.237],[1.075,0.318],[1.122,0.395],[1.169,0.467],[1.216,0.535],[1.263,0.598],[1.31,0.655],[1.357,0.705],[1.404,0.749],[1.451,0.785],[1.497,0.814],[1.544,0.835],[1.591,0.847],[1.638,0.85],[1.685,0.843],[1.732,0.826],[1.779,0.799],[1.826,0.76],[1.873,0.71],[1.92,0.648],[1.966,0.574],[2.013,0.486],[2.06,0.385],[2.107,0.27],[2.154,0.141],[2.201,-0.003],[2.248,-0.163],[2.295,-0.338],[2.342,-0.53],[2.389,-0.739],[2.436,-0.965],[2.482,-1.209],[2.529,-1.471],[2.576,-1.752],[2.623,-2.052],[2.67,-2.372],[2.688,-2.5]],"wra":[[-1.36,2.25],[-1.317,1.919],[-1.27,1.579],[-1.223,1.259],[-1.176,0.959],[-1.129,0.678],[-1.082,0.416],[-1.035,0.172],[-0.988,0.054],[-0.942,0.262],[-0.895,0.454],[-0.848,0.63],[-0.801,0.789],[-0.754,0.934],[-0.707,1.063],[-0.66,1.178],[-0.613,1.279],[-0.566,1.366],[-0.519,1.441],[-0.473,1.503],[-0.426,1.553],[-0.379,1.591],[-0.332,1.619],[-0.285,1.635],[-0.238,1.642],[-0.191,1.639],[-0.144,1.627],[-0.097,1.606],[-0.05,1.578],[-0.004,1.541],[0.043,1.497],[0.09,1.447],[0.137,1.39],[0.184,1.327],[0.231,1.259],[0.278,1.187],[0.325,1.11],[0.372,1.029],[0.419,0.945],[0.466,0.858],[0.512,0.768],[0.559,0.677],[0.606,0.584],[0.653,0.49],[0.7,0.396],[0.747,0.302],[0.794,0.208],[0.841,0.115],[0.888,0.024],[0.935,0.066],[0.981,0.153],[1.028,0.237],[1.075,0.318],[1.122,0.395],[1.169,0.467],[1.216,0.535],[1.263,0.598],[1.31,0.655],[1.357,0.705],[1.404,0.749],[1.451,0.785],[1.497,0.814],[1.544,0.835],[1.591,0.847],[1.638,0.85],[1.685,0.843],[1.732,0.826],[1.779,0.799],[1.826,0.76],[1.873,0.71],[1.92,0.648],[1.966,0.574],[2.013,0.486],[2.06,0.385],[2.107,0.27],[2.154,0.141],[2.201,0.003],[2.248,0.163],[2.295,0.338],[2.342,0.53],[2.389,0.739],[2.436,0.965],[2.482,1.209],[2.529,1.471],[2.576,1.752],[2.623,2.052],[2.653,2.25]],"wrb":[[-1.36,2.25],[-1.317,1.919],[-1.27,1.579],[-1.223,1.259],[-1.176,0.959],[-1.129,0.678],[-1.082,0.416],[-1.035,0.172],[-0.988,-0.054],[-0.942,-0.262],[-0.895,-0.454],[-0.848,-0.63],[-0.801,-0.789],[-0.754,-0.934],[-0.707,-1.063],[-0.66,-1.178],[-0.613,-1.279],[-0.566,-1.366],[-0.519,-1.441],[-0.473,-1.503],[-0.426,-1.553],[-0.379,-1.591],[-0.332,-1.619],[-0.285,-1.635],[-0.238,-1.642],[-0.191,-1.639],[-0.144,-1.627],[-0.097,-1.606],[-0.05,-1.578],[-0.004,-1.541],[0.043,-1.573],[0.09,-1.603],[0.137,-1.625],[0.184,-1.638],[0.231,-1.642],[0.278,-1.637],[0.325,-1.622],[0.372,-1.596],[0.419,-1.559],[0.466,-1.511],[0.512,-1.451],[0.559,-1.378],[0.606,-1.293],[0.653,-1.194],[0.7,-1.081],[0.747,-0.954],[0.794,-0.812],[0.841,-0.655],[0.888,-0.482],[0.935,-0.292],[0.981,-0.086],[1.028,0.137],[1.075,0.378],[1.122,0.638],[1.169,0.916],[1.216,1.213],[1.263,1.53],[1.31,1.866],[1.357,2.224],[1.36,2.25]],"wrc":[[-2.653,2.25],[-2.607,1.944],[-2.56,1.651],[-2.513,1.377],[-2.466,1.121],[-2.419,0.884],[-2.372,0.664],[-2.325,0.461],[-2.278,0.275],[-2.231,0.105],[-2.185,-0.049],[-2.138,-0.188],[-2.091,-0.312],[-2.044,-0.422],[-1.997,-0.519],[-1.95,-0.601],[-1.903,-0.672],[-1.856,-0.729],[-1.809,-0.775],[-1.762,-0.81],[-1.716,-0.833],[-1.669,-0.847],[-1.622,-0.85],[-1.575,-0.844],[-1.528,-0.829],[-1.481,-0.805],[-1.434,-0.773],[-1.387,-0.734],[-1.34,-0.688],[-1.293,-0.635],[-1.246,-0.576],[-1.2,-0.512],[-1.153,-0.442],[-1.106,-0.368],[-1.059,-0.29],[-1.012,-0.208],[-0.965,-0.123],[-0.918,-0.035],[-0.871,0.056],[-0.824,0.148],[-0.777,0.241],[-0.731,0.335],[-0.684,0.429],[-0.637,0.523],[-0.59,0.617],[-0.543,0.709],[-0.496,0.8],[-0.449,0.889],[-0.402,0.975],[-0.355,1.058],[-0.308,1.137],[-0.261,1.213],[-0.215,1.284],[-0.168,1.35],[-0.121,1.41],[-0.074,1.465],[-0.027,1.513],[0.02,1.52],[0.067,1.473],[0.114,1.419],[0.161,1.359],[0.208,1.294],[0.254,1.224],[0.301,1.149],[0.348,1.07],[0.395,0.987],[0.442,0.902],[0.489,0.813],[0.536,0.723],[0.583,0.631],[0.63,0.537],[0.677,0.443],[0.724,0.349],[0.77,0.255],[0.817,0.161],[0.864,0.069],[0.911,-0.021],[0.958,-0.11],[1.005,-0.195],[1.052,-0.278],[1.099,-0.357],[1.146,-0.432],[1.193,-0.502],[1.239,-0.567],[1.286,-0.627],[1.333,-0.681],[1.38,-0.728],[1.427,-0.768],[1.474,-0.801],[1.521,-0.826],[1.568,-0.842],[1.615,-0.85],[1.662,-0.848],[1.709,-0.836],[1.755,-0.814],[1.802,-0.781],[1.849,-0.737],[1.896,-0.681],[1.943,-0.613],[1.99,-0.532],[2.037,-0.438],[2.084,-0.33],[2.131,-0.208],[2.178,-0.071],[2.224,0.081],[2.271,0.249],[2.318,0.432],[2.365,0.633],[2.412,0.85],[2.459,1.085],[2.506,1.338],[2.553,1.609],[2.6,1.899],[2.647,2.209],[2.653,2.25]],"opt":[[-2.688,-2.5],[-2.642,-2.177],[-2.595,-1.869],[-2.548,-1.581],[-2.501,-1.311],[-2.454,-1.06],[-2.407,-0.827],[-2.36,-0.612],[-2.314,-0.413],[-2.267,-0.231],[-2.22,-0.065],[-2.173,0.085],[-2.126,0.22],[-2.079,0.341],[-2.032,0.448],[-1.985,0.54],[-1.938,0.62],[-1.891,0.687],[-1.844,0.742],[-1.798,0.785],[-1.751,0.817],[-1.704,0.838],[-1.657,0.848],[-1.61,0.849],[-1.563,0.841],[-1.516,0.823],[-1.469,0.798],[-1.422,0.764],[-1.375,0.723],[-1.329,0.675],[-1.282,0.621],[-1.235,0.561],[-1.188,0.495],[-1.141,0.424],[-1.094,0.349],[-1.047,0.27],[-1.0,0.187],[-0.953,0.101],[-0.906,0.012],[-0.86,-0.078],[-0.813,-0.171],[-0.766,-0.264],[-0.719,-0.358],[-0.672,-0.453],[-0.625,-0.547],[-0.578,-0.64],[-0.531,-0.732],[-0.484,-0.822],[-0.437,-0.91],[-0.39,-0.996],[-0.344,-1.078],[-0.297,-1.157],[-0.25,-1.231],[-0.203,-1.301],[-0.156,-1.366],[-0.109,-1.425],[-0.062,-1.478],[-0.015,-1.524],[0.032,-1.509],[0.079,-1.46],[0.125,-1.405],[0.172,-1.343],[0.219,-1.277],[0.266,-1.205],[0.313,-1.129],[0.36,-1.05],[0.407,-0.966],[0.454,-0.88],[0.501,-0.791],[0.548,-0.7],[0.595,-0.607],[0.641,-0.514],[0.688,-0.42],[0.735,-0.325],[0.782,-0.231],[0.829,-0.138],[0.876,-0.046],[0.923,0.044],[0.97,0.131],[1.017,0.216],[1.064,0.298],[1.11,0.376],[1.157,0.45],[1.204,0.519],[1.251,0.583],[1.298,0.641],[1.345,0.693],[1.392,0.738],[1.439,0.777],[1.486,0.808],[1.533,0.831],[1.58,0.845],[1.626,0.85],[1.673,0.846],[1.72,0.831],[1.767,0.807],[1.814,0.771],[1.861,0.724],[1.908,0.665],[1.955,0.594],[2.002,0.509],[2.049,0.412],[2.095,0.3],[2.142,0.175],[2.189,0.034],[2.236,-0.122],[2.283,-0.293],[2.33,-0.481],[2.377,-0.685],[2.424,-0.907],[2.471,-1.146],[2.518,-1.404],[2.565,-1.68],[2.611,-1.975],[2.658,-2.29],[2.688,-2.5]],"slope":[[-2.5,-2.5,-4.024],[-2.5,-1.875,-2.981],[-2.5,-1.25,-2.0],[-2.5,-0.625,-1.0],[-2.5,0.0,0.0],[-2.5,0.625,1.0],[-2.5,1.25,2.0],[-2.5,1.875,2.981],[-2.5,2.5,4.024],[-1.875,-2.5,-2.981],[-1.875,-1.875,-2.246],[-1.875,-1.25,-1.5],[-1.875,-0.625,-0.75],[-1.875,0.0,0.0],[-1.875,0.625,0.75],[-1.875,1.25,1.5],[-1.875,1.875,2.246],[-1.875,2.5,2.981],[-1.25,-2.5,-2.0],[-1.25,-1.875,-1.5],[-1.25,-1.25,-1.0],[-1.25,-0.625,-0.5],[-1.25,0.0,0.0],[-1.25,0.625,0.5],[-1.25,1.25,1.0],[-1.25,1.875,1.5],[-1.25,2.5,2.0],[-0.625,-2.5,-1.0],[-0.625,-1.875,-0.75],[-0.625,-1.25,-0.5],[-0.625,-0.625,-0.248],[-0.625,0.0,0.0],[-0.625,0.625,0.248],[-0.625,1.25,0.5],[-0.625,1.875,0.75],[-0.625,2.5,1.0],[0.0,-2.5,0.0],[0.0,-1.875,0.0],[0.0,-1.25,0.0],[0.0,-0.625,0.0],[0.0,0.0,0.0],[0.0,0.625,0.0],[0.0,1.25,0.0],[0.0,1.875,0.0],[0.0,2.5,0.0],[0.625,-2.5,1.0],[0.625,-1.875,0.75],[0.625,-1.25,0.5],[0.625,-0.625,0.248],[0.625,0.0,0.0],[0.625,0.625,-0.248],[0.625,1.25,-0.5],[0.625,1.875,-0.75],[0.625,2.5,-1.0],[1.25,-2.5,2.0],[1.25,-1.875,1.5],[1.25,-1.25,1.0],[1.25,-0.625,0.5],[1.25,0.0,0.0],[1.25,0.625,-0.5],[1.25,1.25,-1.0],[1.25,1.875,-1.5],[1.25,2.5,-2.0],[1.875,-2.5,2.981],[1.875,-1.875,2.246],[1.875,-1.25,1.5],[1.875,-0.625,0.75],[1.875,0.0,0.0],[1.875,0.625,-0.75],[1.875,1.25,-1.5],[1.875,1.875,-2.246],[1.875,2.5,-2.981],[2.5,-2.5,4.024],[2.5,-1.875,2.981],[2.5,-1.25,2.0],[2.5,-0.625,1.0],[2.5,0.0,0.0],[2.5,0.625,-1.0],[2.5,1.25,-2.0],[2.5,1.875,-2.981],[2.5,2.5,-4.024]]}''')

def seg_dist(px, py, P):
    best = 1e9
    for (x1, y1), (x2, y2) in zip(P, P[1:]):
        dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
        s = 0.0 if L == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L))
        best = min(best, math.hypot(px - x1 - s * dx, py - y1 - s * dy))
    return best

def q1():
    t = sp.symbols('t')
    c = (1 - t**2) / (1 + t**2); s = 2 * t / (1 + t**2)
    num = sp.expand(sp.numer(sp.together(4 * c + 3 * s - 3)))
    opts = {"A": 7 * t**2 - 6 * t - 1, "B": t**2 - 6 * t + 7, "C": 7 * t**2 + 6 * t - 1, "D": 7 * t**2 - 3 * t - 1}
    def same(o):
        r = sp.simplify(num / o)
        return r.is_number and r != 0
    mcq("q1", {l for l, o in opts.items() if same(o)}, f"substituting cos,sin in t=tan(theta/2): numerator {num} (option accepted if a nonzero constant multiple)")

def q2():
    V = 25.0; g = 9.8
    a1, a2 = math.radians(50), math.radians(75)
    pos = lambda a, t: (V * math.cos(a) * t, V * math.sin(a) * t - .5 * g * t * t)
    angs = []
    for t in (0.2, 0.5, 0.9, 1.3):
        p, q = pos(a1, t), pos(a2, t)
        angs.append(math.degrees(math.atan2(abs(p[1] - q[1]), abs(p[0] - q[0]))))
    const = max(angs) - min(angs) < 1e-9
    mcq("q2", {l for l, v in zip("ABCD", [62.5, 12.5, 27.5, 77.5]) if const and abs(v - angs[0]) < 1e-6}, f"angle of the joining line at 4 times: {[round(a, 6) for a in angs]}")

def q3():
    base = FIG["base"]
    right = sorted((x, y) for x, y in base if x >= 0); left = sorted((-x, y) for x, y in base if x >= 0)
    res = {}
    for l in ("wra", "opt", "wrb", "wrc"):
        P = FIG[l]; d1 = 0.0
        for x, y in P:
            d1 = max(d1, seg_dist(x, y, right if x >= 0 else left))
        d2 = 0.0
        for (x, y) in right[::3] + left[::3]:
            d2 = max(d2, min(seg_dist(x, y, P), 9))
        res[l] = max(d1, d2)
    ls = {"wra": "A", "opt": "B", "wrb": "C", "wrc": "D"}
    mcq("q3", {ls[l] for l, e in res.items() if e < 0.08}, "max point-to-polyline distance both ways between each option and f(|x|) built from the TikZ base curve: " + ", ".join(f"{ls[l]}={e:.3f}" for l, e in res.items()))

def q4():
    xs = [-0.2 + 0.4 * i / 20000 for i in range(20001)]
    ys = [4 * math.acos(5 * x) - 5 for x in xs]
    lo, hi = min(ys), max(ys); R = math.pi
    opts = {"A": (-5, 4 * R - 5), "B": (-2 * R - 5, 2 * R - 5), "C": (-5, 2 * R - 5), "D": (-4 * R - 5, 4 * R - 5)}
    mcq("q4", {l for l, (a, b) in opts.items() if abs(a - lo) < 1e-9 and abs(b - hi) < 1e-9}, f"range over the domain [-1/5,1/5]: [{lo:.6f},{hi:.6f}]")

def q5():
    x = sp.symbols('x'); v = sp.diff(sp.atan(3 * x / 4), x).subs(x, sp.Rational(8, 3)); R = sp.Rational
    mcq("q5", {l for l, o in zip("ABCD", [R(3, 20), -R(3, 20), R(1, 5), R(1, 60)]) if o == sp.nsimplify(v)}, f"derivative at 8/3 = {v}")

def q6():
    a, b, x = sp.symbols('a b x')
    sol = sp.solve([-3 * a + b - 0, 2 * a + b + 1], [a, b]); r = sol[a] * x + sol[b]; R = sp.Rational
    opts = {"A": R(1, 5) * x - R(3, 5), "B": -R(1, 5) * x - R(3, 5), "C": -R(1, 5) * x - R(8, 5), "D": -R(1, 2) + 0 * x}
    mcq("q6", {l for l, o in opts.items() if sp.expand(o - r) == 0}, f"r(x)=ax+b with r(-3)=0, r(2)=-1: {r}")

def q7():
    rows = FIG["slope"]
    odes = {"A": lambda x, y: x + y, "B": lambda x, y: 1 + y * y, "C": lambda x, y: x / (y + 3), "D": lambda x, y: -x * y}
    best = {}
    for l, f in odes.items():
        e_best = 1e9
        for ci in range(300, 2000):
            c = ci / 1000
            try:
                e = math.sqrt(sum((f(c * x, c * y) - s) ** 2 for x, y, s in rows) / len(rows))
            except ZeroDivisionError:
                continue
            e_best = min(e_best, e)
        best[l] = e_best
    mcq("q7", {l for l, e in best.items() if e < 0.1}, "RMS slope error of each ODE vs the slope-field segments (plot-to-axis scale fitted per ODE): " + ", ".join(f"{l}={e:.3f}" for l, e in best.items()))

def q8():
    N = 400; true = {2}
    for n in range(1, N + 1):
        if n - 3 in true: true.add(n)
    opts = {"A": set(range(1, N + 1)), "B": {n for n in range(1, N + 1) if n % 3 == 2}, "C": set(range(2, N + 1)), "D": {2}}
    mcq("q8", {l for l, s in opts.items() if s == true}, "smallest set containing 2 closed under +3 (within 1..400) compared with each option")

def q9():
    x = sp.symbols('x'); y = 7 * x**8
    tang = y.subs(x, 2) + sp.diff(y, x).subs(x, 2) * (x - 2); P = sp.solve(tang, x)[0]; R = sp.Rational
    mcq("q9", {l for l, v in zip("ABCD", [R(1, 4), R(9, 4), R(7, 4), R(2, 7)]) if v == P}, f"tangent at x=2 meets y=0 at x={P}")

def q10():
    ok = {l: all(sum(k * comb(n, k) * 3**k for k in range(n + 1)) == f(n) for n in range(1, 16)) for l, f in
          {"A": lambda n: n * 4**(n - 1), "B": lambda n: 3 * n * 4**n, "C": lambda n: n * 3**n, "D": lambda n: 3 * n * 4**(n - 1)}.items()}
    mcq("q10", {l for l, v in ok.items() if v}, "exact integer sums for n=1..15 compared with each option")

# ----------------------------------------------------------------- Section II
def q11a():
    x = sp.symbols('x')
    def nroots(k): return sp.Poly(sp.sqf_part(x**3 + 6 * x**2 + k), x).count_roots()
    grid = [sp.Rational(i, 2) for i in range(-120, 61)]
    ok = all((nroots(k) == 3) == (-32 < k < 0) for k in grid)
    eps = sp.Rational(1, 10**6)
    ok &= nroots(-32) == 2 and nroots(0) == 2 and nroots(-32 + eps) == 3 and nroots(-eps) == 3 and nroots(-32 - eps) == 1 and nroots(eps) == 1
    # a root count of a cubic with a repeated root sees only distinct roots through sqf_part, so k=-32 and 0 give 2
    k = kc("q11a")
    ok &= k["type"] == "interval" and k["variable"] == "k" and k["region"].replace(" ", "") == "k>-32andk<0"
    report("q11a", "PASS" if ok else "FAIL", f"distinct real roots of x^3+6x^2+k counted exactly on {len(grid)} rational k in [-60,30] and at -32, 0, +-1e-6: three iff -32<k<0")

def q11d():
    V = 30.0
    def gap(th):
        t = 30 / (V * math.cos(th)); return V * math.sin(th) * t - 5 * t * t - 35
    N = 200000; roots = []; ths = [(pi / 2) * i / N for i in range(1, N)]
    for a, b in zip(ths, ths[1:]):
        if gap(a) * gap(b) < 0:
            lo, hi = a, b
            for _ in range(100):
                m = (lo + hi) / 2
                if gap(lo) * gap(m) <= 0: hi = m
                else: lo = m
            roots.append(math.tan((lo + hi) / 2))
    check_set("q11d", roots, f"sign changes of (height at 30 m)-35 over theta in (0,pi/2), bisected: tan(theta) = {[round(r, 8) for r in roots]}")

def q11e():
    f = lambda x: 2 * math.sin(x)**2 + 12 * math.sin(x) * math.cos(x) - 2 * math.cos(x)**2
    N = 200000
    i0 = max(range(N + 1), key=lambda i: f(2 * pi * i / N))
    lo, hi = 2 * pi * max(0, i0 - 1) / N, 2 * pi * min(N, i0 + 1) / N
    for _ in range(200):
        m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
        if f(m1) > f(m2): hi = m2
        else: lo = m1
    best = f((lo + hi) / 2)
    k = kc("q11e"); ok = close(best, float(sp.N(ex(k["expr"]), 30)), 1e-12)
    report("q11e", "PASS" if ok else "FAIL", f"grid + golden-section maximum over [0,2pi] = {best:.12f}; key {k['expr']}")

def q12a():
    k = kc("q12a"); E = sp.E
    key = lambda xt: float(sp.sympify(k["expr"].replace("^", "**").replace("ln(", "log("), locals={"e": E, "x": sp.Symbol('x')}).subs(sp.Symbol('x'), xt))
    ok = True
    for xt in (-3.0, -1.7, -0.4, 0.6, 1.2, 1.9, 2.5, 3.0):
        n = 4000; h = xt / n; x = 0.0; y = 1.0; f = lambda x, y: math.exp(x - y)
        for _ in range(n):
            k1 = f(x, y); k2 = f(x + h / 2, y + h * k1 / 2); k3 = f(x + h / 2, y + h * k2 / 2); k4 = f(x + h, y + h * k3)
            y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h
        ok &= abs(y - key(xt)) < 1e-9
    report("q12a", "PASS" if ok else "FAIL", f"RK4 of dy/dx=e^(x-y), y(0)=1 vs key {k['expr']} at 8 points in [-3,3]")

def q12c():
    rnd = random.Random(21); ok = True
    k = kc("q12c-i"); A_, C_ = sp.symbols('a c', positive=True); kk = ex(k["expr"])
    lam, mu = float(kk.coeff(A_)), float(kk.coeff(C_))
    for _ in range(6):
        a = (rnd.uniform(-5, 5), rnd.uniform(-5, 5)); c = (rnd.uniform(-5, 5), rnd.uniform(-5, 5))
        A = a; B = (a[0] + c[0], a[1] + c[1])           # OABC parallelogram: B = a + c
        P = ((5 * A[0] + 2 * B[0]) / 7, (5 * A[1] + 2 * B[1]) / 7)       # AP:PB = 2:5 by the section formula
        ok &= abs(P[0] - (lam * a[0] + mu * c[0])) < 1e-12 and abs(P[1] - (lam * a[1] + mu * c[1])) < 1e-12
    report("q12c-i", "PASS" if ok else "FAIL", f"P=(5A+2B)/7 for 6 random parallelograms equals {lam:.6f} a + {mu:.6f} c; key {k['expr']}")

def q13():
    # regions of n circles in general position, from real intersection geometry + Euler's formula F = E - V + 1 + C
    def regions(n, rnd):
        while True:
            cs = [(rnd.uniform(0, 1), rnd.uniform(0, 1)) for _ in range(n)]; r = 0.7
            pts = []; ok = True
            for i in range(n):
                for j in range(i + 1, n):
                    (x1, y1), (x2, y2) = cs[i], cs[j]; d = math.hypot(x2 - x1, y2 - y1)
                    if d >= 2 * r or d < 1e-6: ok = False; break
                    h = math.sqrt(r * r - d * d / 4); mx, my = (x1 + x2) / 2, (y1 + y2) / 2
                    ux, uy = -(y2 - y1) / d, (x2 - x1) / d
                    pts += [(mx + h * ux, my + h * uy, i, j), (mx - h * ux, my - h * uy, i, j)]
                if not ok: break
            if not ok: continue
            # no three circles through a common point
            for p in pts:
                if sum(1 for q in pts if abs(q[0] - p[0]) < 1e-9 and abs(q[1] - p[1]) < 1e-9) > 1: ok = False
            if not ok: continue
            V = len(pts)
            E = 0
            for i in range(n):
                E += sum(1 for p in pts if i in (p[2], p[3]))          # each circle is cut into as many arcs as it has vertices on it
            if n == 1: return 2
            return E - V + 1 + 1                                          # Euler for a connected planar graph: V-E+F=2 counting the outer face
    rnd = random.Random(4)
    vals = {n: regions(n, rnd) for n in range(1, 9)}
    ok = all(vals[n] == n * n - n + 2 for n in vals)
    n_least = next(n for n in range(1, 200) if n * n - n + 2 > 1000)
    check_num("q13a-iii", n_least if ok else -1, f"Euler count from real circle intersections n=1..8: {list(vals.values())} equals n^2-n+2: {ok}; least n with more than 1000 regions: {n_least}")
    mp.mp.dps = 30
    T = lambda k: mp.atan(mp.mpf(3) / (9 + k * (k - 1)))
    S = lambda n: mp.fsum(T(k) for k in range(1, n + 1))
    k2 = kc("q13b-ii"); n_ = sp.Symbol('n', positive=True)
    ok2 = all(abs(mp.mpf(sp.N(ex(k2["expr"]).subs(n_, nn), 30)) - S(nn)) < mp.mpf(10)**-25 for nn in range(1, 41))
    report("q13b-ii", "PASS" if ok2 else "FAIL", f"direct sums of T_k, n=1..40, vs key {k2['expr']}")
    lim = mp.nsum(lambda k: mp.atan(mp.mpf(3) / (9 + k * (k - 1))), [1, mp.inf])
    k3 = kc("q13b-iii"); ok3 = abs(lim - mp.mpf(sp.N(ex(k3["expr"]), 30))) < mp.mpf(10)**-12
    report("q13b-iii", "PASS" if ok3 else "FAIL", f"mp.nsum limit {mp.nstr(lim, 20)}; key {k3['expr']}")
    mp.mp.dps = 40
    s = mp.mpf(0); n = 0; thr = mp.pi / 2 - mp.mpf(1) / 20
    while True:
        n += 1; s += T(n)
        if s > thr: break
    check_num("q13b-iv", n, f"partial sums: first n with S_n > pi/2-1/20 is {n}")

def q14():
    x = sp.symbols('x')
    check_num("q14a", sp.expand((3 * x**3 + 1 / x)**12).coeff(x, 0), "expanded (3x^3+1/x)^12, coefficient of x^0")
    sols = []
    for n in range(4, 301):
        p = Fr(18, 5 * n)
        if p > 1: continue
        if comb(n, 3) * p**3 * (1 - p)**(n - 3) == comb(n, 4) * p**4 * (1 - p)**(n - 4): sols.append(n)
    check_num("q14b", sols[0] if len(sols) == 1 else -1, f"exact Fractions: P(X=3)=P(X=4) with mean 18/5 only for n in {sols}")
    f = 8 / (x**2 + 9)
    f2 = sp.simplify(sp.diff(f, x, 2))
    rts = sp.Poly(sp.numer(sp.together(f2)), x).real_roots()
    chg = all(f2.subs(x, r - sp.Rational(1, 100)) * f2.subs(x, r + sp.Rational(1, 100)) < 0 for r in rts)
    check_set("q14c-ii", [float(r) for r in rts], f"real zeros of f'' = {f2} (all sign changes: {chg})")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11d, q11e, q12a, q12c, q13, q14):
    f()
finish("12")
