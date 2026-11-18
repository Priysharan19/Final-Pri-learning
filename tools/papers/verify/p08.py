#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 8 (ext1-2027-p08, scope-revised).
Run: /tmp/symenv/bin/python tools/papers/verify/p08.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p08.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p08.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p08.json")))

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

FIGTK = json.loads('''{"A":[[0.0,0.0],[0.117,0.182],[0.234,0.291],[0.351,0.384],[0.468,0.469],[0.585,0.549],[0.702,0.624],[0.819,0.696],[0.936,0.766],[1.053,0.835],[1.17,0.902],[1.287,0.968],[1.404,1.033],[1.521,1.097],[1.638,1.162],[1.755,1.225],[1.872,1.289],[1.989,1.353],[2.106,1.417],[2.223,1.482],[2.34,1.547],[2.457,1.614],[2.574,1.681],[2.691,1.75],[2.808,1.82],[2.925,1.893],[3.042,1.969],[3.159,2.05],[3.276,2.136],[3.393,2.232],[3.51,2.348]],"B":[[0.0,0.0],[0.117,0.025],[0.234,0.069],[0.351,0.125],[0.468,0.191],[0.585,0.264],[0.702,0.343],[0.819,0.428],[0.936,0.516],[1.053,0.609],[1.17,0.705],[1.287,0.803],[1.404,0.903],[1.521,1.004],[1.638,1.107],[1.755,1.21],[1.872,1.314],[1.989,1.417],[2.106,1.519],[2.223,1.621],[2.34,1.72],[2.457,1.818],[2.574,1.913],[2.691,2.004],[2.808,2.092],[2.925,2.176],[3.042,2.253],[3.159,2.325],[3.276,2.389],[3.393,2.443],[3.51,2.483]],"C":[[0.0,0.0],[0.117,0.081],[0.234,0.163],[0.351,0.244],[0.468,0.325],[0.585,0.406],[0.702,0.488],[0.819,0.569],[0.936,0.65],[1.053,0.731],[1.17,0.812],[1.287,0.894],[1.404,0.975],[1.521,1.056],[1.638,1.137],[1.755,1.219],[1.872,1.3],[1.989,1.381],[2.106,1.462],[2.223,1.544],[2.34,1.625],[2.457,1.706],[2.574,1.787],[2.691,1.869],[2.808,1.95],[2.925,2.031],[3.042,2.112],[3.159,2.194],[3.276,2.275],[3.393,2.356],[3.51,2.438]],"D":[[0.0,0.0],[0.117,0.632],[0.234,0.887],[0.351,1.077],[0.468,1.233],[0.585,1.366],[0.702,1.483],[0.819,1.588],[0.936,1.682],[1.053,1.767],[1.17,1.845],[1.287,1.916],[1.404,1.981],[1.521,2.041],[1.638,2.096],[1.755,2.147],[1.872,2.193],[1.989,2.236],[2.106,2.275],[2.223,2.31],[2.34,2.342],[2.457,2.371],[2.574,2.396],[2.691,2.419],[2.808,2.439],[2.925,2.456],[3.042,2.47],[3.159,2.481],[3.276,2.49],[3.393,2.496],[3.51,2.499]]}''')

# ----------------------------------------------------------------- Section I
def q1():
    m, dl = sp.symbols('m delta')
    x = sp.symbols('x')
    P = sp.expand((x - (m - dl)) * (x - m) * (x - (m + dl)))
    b, c, d = [P.coeff(x, 2), P.coeff(x, 1), P.coeff(x, 0)]
    forms = {"A": b**3 - 27 * d, "B": b**2 - 3 * c, "C": 2 * b**3 - 9 * b * c + 27 * d, "D": b * c - 9 * d}
    mcq("q1", {l for l, e in forms.items() if sp.expand(e) == 0}, "roots m-delta,m,m+delta: the option whose residual is identically 0")

def q2():
    f = lambda x: 3 * math.sin(x) + 4 * math.cos(x)
    xs = [pi / 2 * i / 100000 for i in range(100001)]
    lo, hi = min(map(f, xs)), max(map(f, xs))
    opts = {"A": (3, 5), "B": (4, 5), "C": (-5, 5), "D": (3, 4)}
    mcq("q2", {l for l, (a, b) in opts.items() if abs(a - lo) < 1e-6 and abs(b - hi) < 1e-6}, f"range of f over a 100001-point grid on [0,pi/2]: [{lo:.6f},{hi:.6f}]")

def q3():
    rnd = random.Random(3); vals = set()
    for _ in range(6):
        t = rnd.uniform(0, 2 * pi); u = rnd.uniform(0, 2 * pi)
        # a=(1,0) in a random frame; b unit; c = -(a+b) must be a unit vector: |a+b|=1 forces angle 120 degrees
        a = (math.cos(t), math.sin(t)); b = (math.cos(t + 2 * pi / 3), math.sin(t + 2 * pi / 3)); c = (-(a[0] + b[0]), -(a[1] + b[1]))
        assert abs(math.hypot(*c) - 1) < 1e-12
        dot = lambda p, q: p[0] * q[0] + p[1] * q[1]
        vals.add(round(dot(a, b) + dot(b, c) + dot(c, a), 9))
    v = vals.pop() if len(vals) == 1 else None
    mcq("q3", {l for l, o in zip("ABCD", [0, -1, 1.5, -1.5]) if v is not None and abs(o - v) < 1e-9}, f"unit vectors summing to 0 are 120 degrees apart; computed sum of dots = {v} in 6 rotated frames")

def q4():
    g = 9.8; V = 20.0
    ok = True; ls = set(); vals = []
    for th in (0.1, 0.4, 0.7):
        t1 = 2 * V * math.sin(th) / g; t2 = 2 * V * math.sin(pi / 2 - th) / g
        vals.append(t1 / t2)
    opts = {"A": lambda th: math.sin(th), "B": lambda th: math.tan(th), "C": lambda th: 1.0, "D": lambda th: math.tan(th) ** 2}
    mcq("q4", {l for l, f in opts.items() if all(abs(f(th) - v) < 1e-12 for th, v in zip((0.1, 0.4, 0.7), vals))}, "time of flight from y(t)=0 at theta and 90-theta, ratio compared with each option at 3 angles")

def q5():
    ok = {}
    opts = {"A": lambda n: n * 2**(n - 1), "B": lambda n: n * n * 2**(n - 1), "C": lambda n: n * (n - 1) * 2**(n - 2), "D": lambda n: n * (n + 1) * 2**(n - 2)}
    for l, f in opts.items():
        ok[l] = all(sum(k * k * comb(n, k) for k in range(n + 1)) == f(n) for n in range(2, 15))
    mcq("q5", {l for l, v in ok.items() if v}, "exact integer sums for n=2..14 compared with each option")

def q6():
    N = 10
    cnt = 0
    chords = list(itertools.combinations(range(N), 2))
    for (a, b), (c, d) in itertools.combinations(chords, 2):
        if len({a, b, c, d}) < 4: continue
        if (a < c < b) != (a < d < b): cnt += 1           # endpoints interleaved => interior crossing
    mcq("q6", {l for l, v in zip("ABCD", [210, 45, 120, 252]) if v == cnt}, f"{cnt} chord pairs with interleaved endpoints on 10 points")

def q7():
    # sd of p-hat = sqrt(p(1-p)/n) <= 0.02 for every p in [0,1]
    worst = max(p / 10000 * (1 - p / 10000) for p in range(0, 10001))
    n = next(n for n in range(1, 10000) if math.sqrt(worst / n) <= 0.02 + 1e-15)
    mcq("q7", {l for l, v in zip("ABCD", [50, 1250, 625, 2500]) if v == n}, f"max p(1-p)={worst} on a 10001-point grid; least n with sd<=0.02 is {n}")

def q8():
    mp.mp.dps = 25
    f = lambda x: x + mp.e**x
    g = lambda y: mp.findroot(lambda x: f(x) - y, y - 1 if y < 2 else y - 2)
    v = mp.quad(g, [1, 1 + mp.e])
    mcq("q8", {l for l, o in zip("ABCD", [mp.mpf(1) / 2, mp.mpf(3) / 2, mp.e - mp.mpf(1) / 2, mp.e + mp.mpf(1) / 2]) if abs(o - v) < 1e-12}, f"quadrature of the numerically inverted g: {mp.nstr(v, 15)}")

def q9():
    h = lambda x: math.sin(x) + math.sin(2 * x) + math.sin(3 * x)
    N = 2000000
    roots = []
    prev = h(0.0)
    if abs(prev) < 1e-12: roots.append(0.0)
    for i in range(1, N + 1):
        x = 2 * pi * i / N; cur = h(x)
        if abs(cur) < 1e-12 and (not roots or abs(roots[-1] - x) > 1e-5): roots.append(x)
        elif prev * cur < 0 and not (roots and abs(roots[-1] - x) < 1e-5): roots.append(x)
        prev = cur
    cnt = len(roots)
    mcq("q9", {l for l, v in zip("ABCD", [5, 6, 9, 7]) if v == cnt}, f"zeros of the original equation on [0,2pi] on a 2e6-point grid (sign changes + exact zeros at the end points): {cnt}")

def q10():
    def frac(hf):
        h = 2 * hf; th = math.acos(1 - h)
        return (th - math.sin(th) * math.cos(th)) / pi      # water volume as a fraction of full (cross-section area of circle segment)
    errs = {l: max(abs(x / 3.6 - frac(y / 2.5)) for x, y in P) for l, P in FIGTK.items()}
    mcq("q10", {l for l, e in errs.items() if e < 0.01}, "constant inflow => t proportional to the circular-segment area at depth h; TikZ polyline of each option vs that law (max err t/T: " + ", ".join(f"{l}={e:.4f}" for l, e in errs.items()) + ")")

# ----------------------------------------------------------------- Section II
def q11a():
    x = sp.symbols('x')
    def nroots(k):
        return sp.Poly(sp.sqf_part(x**4 - 4 * x + k), x).count_roots()
    grid = [sp.Rational(i, 4) for i in range(-200, 41)]
    two = [k for k in grid if nroots(k) == 2]
    ok = all((nroots(k) == 2) == (k < 3) for k in grid)
    eps = sp.Rational(1, 10**6)
    ok &= nroots(3) == 1 and nroots(3 - eps) == 2 and nroots(3 + eps) == 0
    kk = kc("q11a")
    ok &= kk["type"] == "interval" and kk["region"].replace(" ", "") == "k<3"
    report("q11a", "PASS" if ok else "FAIL", f"distinct real roots of x^4-4x+k counted exactly on {len(grid)} rational k in [-50,10] and at 3, 3+-1e-6: two exactly for k<3")

def q11b():
    mp.mp.dps = 40
    c = mp.cos(mp.pi / 5)
    ok = abs(mp.cos(3 * mp.pi / 5) + mp.cos(2 * mp.pi / 5)) < 1e-35
    check_expr("q11b", sp.sqrt(5) / 4 + sp.Rational(1, 4), f"mp.cos(pi/5)={mp.nstr(c, 20)}, identity cos3t=-cos2t holds: {ok}") if abs(c - (1 + mp.sqrt(5)) / 4) < 1e-35 else report("q11b", "FAIL", "numeric mismatch")

def q11c():
    k = ex(OVERRIDE["q11c"]["key"]["expr"]); n_ = sp.Symbol('n', positive=True)
    ok = all(sum(comb(n, j) * comb(n, j + 1) for j in range(n + 1)) == int(k.subs(n_, n)) for n in range(1, 17))
    CHECKED.add("q11c")
    report("q11c", "PASS" if ok else "FAIL", "exact integer sums for n=1..16 equal the key")

def q11d():
    cnt = 0
    for perm in itertools.permutations(range(1, 9)):
        seen = {perm[0]}; good = True
        for v in perm[1:]:
            if (v - 1 not in seen) and (v + 1 not in seen): good = False; break
            seen.add(v)
        cnt += good
    check_num("q11d", cnt, f"brute force over 40320 permutations: {cnt}")

def q11e():
    mp.mp.dps = 30
    v = mp.quad(lambda x: 1 / ((x + 1) * mp.sqrt(x)), [mp.mpf(1) / 3, 1, 3])
    k = kc("q11e")
    ok = close(float(v), float(sp.N(ex(k["expr"]), 30)))
    report("q11e", "PASS" if ok else "FAIL", f"mpmath quadrature of the original integral = {mp.nstr(v, 15)}; key {k['expr']}")

def q12a():
    kk = ex(OVERRIDE["q12a"]["key"]["expr"]); CHECKED.add("q12a")
    A_, B_ = sp.symbols('a b', positive=True)
    lam, mu = float(kk.coeff(A_)), float(kk.coeff(B_))
    rnd = random.Random(5); ok = True
    for _ in range(6):
        t = rnd.uniform(0, 2 * pi); w = rnd.uniform(0.3, 2.8)
        a = (3 * math.cos(t), 3 * math.sin(t)); b = (6 * math.cos(t + w), 6 * math.sin(t + w))
        def ang(u, v): return math.acos((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v)))
        lo, hi = 0.0, 1.0
        for _ in range(200):
            s = (lo + hi) / 2; P = (a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1]))
            if ang(a, P) < ang(P, b): lo = s
            else: hi = s
        s = (lo + hi) / 2; P = (a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1]))
        ok &= abs(P[0] - (lam * a[0] + mu * b[0])) < 1e-9 and abs(P[1] - (lam * a[1] + mu * b[1])) < 1e-9
    report("q12a", "PASS" if ok else "FAIL", f"bisection for the point P on AB with angle AOP = angle POB at 6 random shapes; OP = {lam:.6f} a + {mu:.6f} b")

def q12b():
    mp.mp.dps = 30
    v = mp.pi * mp.quad(lambda x: (2 + mp.sqrt(1 - x * x))**2 - (2 - mp.sqrt(1 - x * x))**2, [-1, 0, 1])
    k = kc("q12b"); ok = close(float(v), float(sp.N(ex(k["expr"]), 30)))
    report("q12b", "PASS" if ok else "FAIL", f"washer integral = {mp.nstr(v, 15)}; key {k['expr']}")

def q12c():
    n, k = 7, 3
    tot = sum(1 for t in itertools.product(range(n), repeat=k) if len(set(t)) < k)
    check_exact("q12c-ii", Fr(tot, n**k), f"enumerated 343 triples: {tot}/343 share a day")
    prob = lambda n_: (1 - Fr(1, n_)) * (1 - Fr(2, n_))
    first = next(m for m in range(3, 400) if prob(m) > Fr(9, 10))
    stays = all(prob(m) > Fr(9, 10) for m in range(first, 401))
    check_num("q12c-iii", first if stays else -1, f"exact Fractions: first n with P>9/10 is {first}, stays above up to 400: {stays}")
    ans = None
    for kk in range(2, 6):
        shared = sum(1 for t in itertools.product(range(7), repeat=kk) if len(set(t)) < kk)
        if Fr(shared, 7**kk) > Fr(1, 2): ans = kk; break
    check_num("q12c-iv", ans, f"enumerated all 7^k assignments, k<=5: least k with P(shared)>1/2 is {ans}")

def q13a():
    rnd = random.Random(2); ok = True
    for _ in range(10):
        A = rnd.uniform(.5, 2); F = rnd.uniform(.5, 2); r = rnd.uniform(1, 6)
        w = r * A / F * rnd.uniform(1.1, 3)                # Fw > Ar
        rho, d = 1.0, 100.0
        def W(v):
            rel = (w - v, -r)                              # rain relative to the person
            rate = rho * (A * abs(rel[1]) + 2 * 0 + F * abs(rel[0]))   # top: perpendicular component |rel_y|; front OR back is struck, not both
            return d / v * rate
        grid = [w * i / 4000 for i in range(1, 12000)]
        vbest = min(grid, key=W)
        ok &= abs(vbest - w) < w / 3000
    check_expr("q13a-iii", sp.Symbol('w', positive=True), f"min over a 12000-point grid of W(v) (rain striking top + whichever of front/back faces the relative flow) is at v=w for 10 random (A,r,F,w), Fw>Ar: {ok}") if ok else report("q13a-iii", "FAIL", "grid minimiser not at v=w")

def q14a():
    al_ = sp.Symbol('alpha', positive=True)
    kk = ex(OVERRIDE["q14a-iii"]["key"]["expr"], alpha=al_); CHECKED.add("q14a-iii")
    V_, g_ = sp.symbols('V g', positive=True)
    rnd = random.Random(9); ok = True
    for _ in range(10):
        g = rnd.uniform(5, 12); V = rnd.uniform(5, 40); al = rnd.uniform(0.1, 1.2)
        def OQ(th):
            t = 2 * V * math.sin(th - al) / (g * math.cos(al))           # root of r(t).n = 0 for t>0
            # verify against the dot product directly
            dotn = V * t * math.cos(th) * (-math.sin(al)) + (V * t * math.sin(th) - .5 * g * t * t) * math.cos(al)
            assert abs(dotn) < 1e-8 * max(1, V * t)
            return V * t * math.cos(th) / math.cos(al)
        lo, hi = al + 1e-9, pi / 2
        for _ in range(300):
            m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
            if OQ(m1) > OQ(m2): hi = m2
            else: lo = m1
        best = OQ((lo + hi) / 2)
        ok &= close(best, float(kk.subs({V_: V, g_: g, al_: al})), 1e-9)
    report("q14a-iii", "PASS" if ok else "FAIL", "landing time from r(t).n=0 (verified numerically), OQ=Vt cos(theta)/cos(alpha); golden-section maximum over theta in (alpha,pi/2) for 10 random (V,g,alpha)")

def q14b():
    lo, hi = 1e-9, 1 - 1e-9
    f = lambda x: x * math.log(1 / x)
    for _ in range(300):
        m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
        if f(m1) > f(m2): hi = m2
        else: lo = m1
    best = f((lo + hi) / 2)
    k = kc("q14b-iv"); ok = close(best, float(sp.N(ex(k["expr"].replace("e", "E")), 30)), 1e-12) if False else close(best, math.exp(-1), 1e-12) and k["expr"] == "1/e"
    report("q14b-iv", "PASS" if ok else "FAIL", f"golden-section maximum of x ln(1/x) on (0,1) = {best:.12f}, 1/e = {math.exp(-1):.12f}; key {k['expr']}")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q11c, q11d, q11e, q12a, q12b, q12c, q13a, q14a, q14b):
    f()
finish("08")
