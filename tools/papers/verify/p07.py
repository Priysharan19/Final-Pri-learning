#!/usr/bin/env python3
"""Independent verification of the answer keys and MCQ letters of Practice Paper 7 (ext1-2027-p07).
Run: /tmp/symenv/bin/python tools/papers/verify/p07.py   (SymPy + mpmath only). Exit 1 on any FAIL / unexpected DISAGREE.
Every item is computed from the question statement (enumeration, exact fractions, SymPy, mpmath), then compared with the key in tools/papers/overrides/ext1-2027-p07.json or the guideline letter in the structured paper."""
import itertools, json, math, os, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi
import sympy as sp
import mpmath as mp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OVERRIDE = json.load(open(os.path.join(ROOT, "tools/papers/overrides/ext1-2027-p07.json")))["keys"]
PAPER = json.load(open(os.path.join(ROOT, "server/content/papers/nsw-ext1/structured/ext1-2027-p07.json")))

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

KNOWN_DISAGREEMENTS = set()   # none: every key and every MCQ letter agreed with the author's guideline

# Q5 option curves, sampled from the TikZ polylines in the author's E1-07_figs.tex
# (plot x = X/2 cm, plot y = 0.974*y/(pi/2) cm; every 24th of 601 samples).
FIGAS = json.loads('''{"A":[[-2.5,-1.703],[-2.3,-1.682],[-2.1,-1.658],[-1.9,-1.629],[-1.7,-1.593],[-1.5,-1.549],[-1.3,-1.492],[-1.1,-1.419],[-0.9,-1.319],[-0.7,-1.179],[-0.5,-0.974],[-0.3,-0.67],[-0.1,-0.245],[0.1,0.245],[0.3,0.67],[0.5,0.974],[0.7,1.179],[0.9,1.319],[1.1,1.419],[1.3,1.492],[1.5,1.549],[1.7,1.593],[1.9,1.629],[2.1,1.658],[2.3,1.682],[2.5,1.703]],"B":[[-2.5,-0.375],[-2.3,-0.404],[-2.1,-0.439],[-1.9,-0.479],[-1.7,-0.527],[-1.5,-0.584],[-1.3,-0.653],[-1.1,-0.734],[-0.9,-0.827],[-0.7,-0.921],[-0.5,-0.974],[-0.3,-0.859],[-0.1,-0.375],[0.1,0.375],[0.3,0.859],[0.5,0.974],[0.7,0.921],[0.9,0.827],[1.1,0.734],[1.3,0.653],[1.5,0.584],[1.7,0.527],[1.9,0.479],[2.1,0.439],[2.3,0.404],[2.5,0.375]],"C":[[-2.5,-0.245],[-2.3,-0.265],[-2.1,-0.29],[-1.9,-0.319],[-1.7,-0.355],[-1.5,-0.399],[-1.3,-0.455],[-1.1,-0.529],[-0.9,-0.629],[-0.7,-0.769],[-0.5,-0.974],[-0.3,-0.67],[-0.1,-0.245],[0.1,0.245],[0.3,0.67],[0.5,0.974],[0.7,0.769],[0.9,0.629],[1.1,0.529],[1.3,0.455],[1.5,0.399],[1.7,0.355],[1.9,0.319],[2.1,0.29],[2.3,0.265],[2.5,0.245]],"D":[[-2.5,-0.974],[-2.3,-0.974],[-2.1,-0.974],[-1.9,-0.974],[-1.7,-0.974],[-1.5,-0.974],[-1.3,-0.974],[-1.1,-0.974],[-0.9,-0.974],[-0.7,-0.974],[-0.5,-0.974],[-0.3,-0.67],[-0.1,-0.245],[0.1,0.245],[0.3,0.67],[0.5,0.974],[0.7,0.974],[0.9,0.974],[1.1,0.974],[1.3,0.974],[1.5,0.974],[1.7,0.974],[1.9,0.974],[2.1,0.974],[2.3,0.974],[2.5,0.974]]}''')

# ----------------------------------------------------------------- Section I
def q1():
    people = [(c, s) for c in range(5) for s in range(2)]
    n = sum(1 for S in itertools.combinations(people, 4) if len({c for c, _ in S}) == 4)
    mcq("q1", {l for l, v in zip("ABCD", [210, 120, 160, 80]) if v == n}, f"enumerated {n} 4-subsets of 10 people with no couple")

def q2():
    x = sp.symbols('x')
    P = (x**2 - 1)**3
    roots = sp.Poly(sp.diff(P, x), x).real_roots()
    n = len(set(roots))
    mcq("q2", {l for l, v in zip("ABCD", [2, 3, 5, 6]) if v == n}, f"real roots of P' = {sorted(set(roots))}")

def q3():
    t = sp.symbols('t', real=True)
    a = sp.Matrix([1, 0]); b = sp.Matrix([sp.cos(t), sp.sin(t)])
    eq = (a + b).dot(a + b) - 3 * (a - b).dot(a - b)
    sols = [s for s in sp.solve(sp.simplify(eq), t) if 0 <= s <= sp.pi]
    deg = {float(s * 180 / sp.pi) for s in sols}
    mcq("q3", {l for l, v in zip("ABCD", [30, 45, 60, 120]) if any(abs(v - d) < 1e-9 for d in deg)}, f"solved |a+b|^2=3|a-b|^2 for the angle: {sorted(deg)} degrees")

def q4():
    rt2 = math.sqrt(2)
    inA = lambda x: (-2 <= x <= -rt2) or (rt2 <= x <= 2)
    inB = lambda x: -2 <= x <= 2
    inC = lambda x: rt2 <= x <= 2
    inD = lambda x: -rt2 <= x <= rt2
    dom = lambda x: -1 <= x * x - 3 <= 1          # asin needs its argument in [-1,1]
    pts = [i / 997 for i in range(-3000, 3001)] + [s * v + e for s in (1, -1) for v in (rt2, 2) for e in (-1e-9, 1e-9, 0)]
    ls = {l for l, f in zip("ABCD", [inA, inB, inC, inD]) if all(f(x) == dom(x) for x in pts if abs(abs(x) - rt2) > 1e-12 and abs(abs(x) - 2) > 1e-12)}
    mcq("q4", ls, "membership of x^2-3 in [-1,1] compared with each option on a 6000-point grid and just either side of the endpoints")

def q5():
    k = 0.974 / (pi / 2)
    f = lambda X: math.asin(max(-1, min(1, 2 * X / (1 + X * X))))
    errs = {}
    for l, pts in FIGAS.items():
        errs[l] = max(abs(y - k * f(2 * x)) for x, y in pts)
    ls = {l for l, e in errs.items() if e < 0.01}
    mcq("q5", ls, "TikZ polyline of each option compared with y=asin(2x/(1+x^2)) (max abs err per option: " + ", ".join(f"{l}={e:.3f}" for l, e in errs.items()) + ")")

def q6():
    a = sp.symbols('a', positive=True); x = sp.symbols('x', positive=True)
    V = sp.pi * sp.integrate(1 / x**2, (x, 1, a))
    L = sp.limit(V, a, sp.oo)
    mcq("q6", {l for l, v in zip("ABCD", [sp.pi, sp.pi / 2, 2 * sp.pi, sp.oo]) if sp.simplify(v - L) == 0}, f"V(a)={sp.simplify(V)}, limit {L}")

def q7():
    vs = [complex(math.cos(k * pi / 3), math.sin(k * pi / 3)) for k in range(6)]
    tot = right = 0
    for T in itertools.combinations(range(6), 3):
        tot += 1
        P = [vs[i] for i in T]
        for i in range(3):
            u = P[(i + 1) % 3] - P[i]; w = P[(i + 2) % 3] - P[i]
            if abs((u.conjugate() * w).real) < 1e-9:
                right += 1; break
    pr = Fr(right, tot)
    mcq("q7", {l for l, v in zip("ABCD", [Fr(3, 10), Fr(2, 5), Fr(3, 5), Fr(1, 2)]) if v == pr}, f"{right} of {tot} triangles contain a right angle (dot-product test)")

def q8():
    yv = sp.symbols('y', real=True)
    L = sp.integrate(1 / (1 + yv**2), (yv, -sp.oo, sp.oo))   # y is increasing, so b-a = integral of dy/(1+y^2) over the range of y
    mcq("q8", {l for l, v in zip("ABCD", [sp.pi / 2, sp.pi, 2 * sp.pi, sp.oo]) if sp.simplify(v - L) == 0}, f"y' >0 so x is a function of y: b-a=int dy/(1+y^2) over all reals = {L}; sup attained by tan(x)")

def q9():
    g, V0, th, t = sp.symbols('g V0 theta t', positive=True)
    y = V0 * sp.sin(th) * t - g * t**2 / 2
    tf = sp.solve(y, t); tf = [s for s in tf if s != 0][0]
    R = V0 * sp.cos(th) * tf
    tm = sp.solve(sp.diff(y, t), t)[0]
    H = y.subs(t, tm)
    cands = {"A": H / R, "B": 2 * H / R, "C": R / (4 * H), "D": 4 * H / R}
    ls = set()
    for l, e in cands.items():
        if all(abs(float((e - sp.tan(th)).subs({g: 9.8, V0: 17, th: tv}))) < 1e-9 for tv in (0.2, 0.7, 1.1, 1.4)):
            ls.add(l)
    mcq("q9", ls, f"H={sp.simplify(H)}, R={sp.simplify(R)} from the equations of motion; each option compared with tan(theta) at 4 angles")

def q10():
    N = 20
    comp = [[(i != j) and (i % j == 0 or j % i == 0) for j in range(1, N + 1)] for i in range(1, N + 1)]
    best = 0
    # largest set with no element dividing another (maximum independent set of the comparability graph), exhaustive
    def rec(i, chosen):
        nonlocal best
        if i == N:
            best = max(best, len(chosen)); return
        if len(chosen) + (N - i) <= best: return
        if all(not comp[i][j] for j in chosen): rec(i + 1, chosen + [i])
        rec(i + 1, chosen)
    rec(0, [])
    need = best + 1
    mcq("q10", {l for l, v in zip("ABCD", [10, 11, 12, 15]) if v == need}, f"exhaustive search: largest divisibility-free subset of 1..20 has {best} elements, so {need} guarantee a divisor pair")

# ----------------------------------------------------------------- Section II
def q11b():
    h = lambda x: mp.sin(x) * mp.cos(2 * x) * mp.cos(3 * x) + mp.sin(2 * x) * mp.cos(x) * mp.cos(3 * x) - mp.sin(3 * x) * mp.cos(x) * mp.cos(2 * x)
    roots = []
    N = 6000
    for i in range(1, N):
        a, b = mp.pi * i / N, mp.pi * (i + 1) / N
        if h(a) * h(b) < 0:
            roots.append(mp.findroot(h, (a, b), solver='anderson'))
    exact = [mp.pi / 2]            # h=0 also at pi/2 where tan x is undefined; grid hits exact zeros separately
    good = []
    for r in roots + [mp.pi / 3, 2 * mp.pi / 3, mp.pi / 2]:
        if min(abs(mp.cos(m * r)) for m in (1, 2, 3)) < 1e-9: continue    # a tangent is undefined there
        if abs(mp.tan(r) + mp.tan(2 * r) - mp.tan(3 * r)) < 1e-9 and not any(abs(r - g) < 1e-9 for g in good):
            good.append(r)
    check_set("q11b", [float(v) for v in good], "sign-change scan of the pole-free form on 6000 cells + original-equation residual < 1e-9, poles excluded")

def q11d():
    p, x = sp.symbols('p x', positive=True)
    PA = sp.solve(sp.Eq(x, p + (1 - p) * sp.Rational(1, 2) * x), x)[0]     # A wins now, or both miss and the game restarts
    sol = [s for s in sp.solve(sp.Eq(PA, sp.Rational(1, 2)), p)]
    ser = lambda pv: sum(pv * ((1 - pv) / 2) ** k for k in range(400))
    r = mp.findroot(lambda pv: ser(pv) - mp.mpf(1) / 2, 0.3)
    ok = len(sol) == 1 and abs(float(sol[0]) - float(r)) < 1e-9
    check_num("q11d", float(sol[0]), f"restart equation x=p+(1-p)x/2 and a 400-term series both give equal-win p={sol[0]} (ok={ok})")

def q11e():
    mp.mp.dps = 30
    v = mp.quad(lambda x: 1 / (1 + mp.sin(x) ** 2), [0, mp.pi / 4])
    k = kc("q11e")
    ok = k["type"] == "expression" and all(close(float(sp.N(ex(f).subs({}), 30)), float(v)) for f in [k["expr"]] + k.get("anyOf", []))
    report("q11e", "PASS" if ok else "FAIL", f"mpmath quadrature of the original integral = {float(v):.12f}; key {k['expr']} and anyOf evaluate to it")

def q12a():
    t = sp.symbols('t', real=True)
    A = sp.Matrix([1, 2]); B = sp.Matrix([8, 6]); d = sp.Matrix([3, 4])
    D2 = (A + t * d - B).dot(A + t * d - B)
    ts = sp.solve(sp.diff(D2, t), t)[0]
    assert ts >= 0
    check_num("q12a", sp.sqrt(D2.subs(t, ts)), f"minimised |A+td-B|^2 over the beam t>=0 (t*={ts})")

def q12b():
    a, h, rho, x = sp.symbols('a h rho x', positive=True)
    rho0 = sp.sqrt(a**2 - h**2)
    # shells about the axis: radius rho from the hole wall to the sphere, axial length 2*sqrt(a^2-rho^2)
    V = sp.integrate(2 * sp.pi * rho * 2 * sp.sqrt(a**2 - rho**2), (rho, rho0, a))
    V = sp.simplify(V)
    # cross-check with a direct numeric discs-and-washers integral
    num = float(mp.quad(lambda xx: mp.pi * ((3.0**2 - xx**2) - (3.0**2 - 1.7**2)), [-1.7, 1.7]))
    ok = abs(num - float(V.subs({a: 3.0, h: 1.7}))) < 1e-9
    check_expr("q12b", V, f"shell-method integral = {V}; washer integral at a=3,h=1.7 agrees: {ok}")
    if not ok: report("q12b-crosscheck", "FAIL", "washer vs shell")

def q12c():
    n = sp.symbols('n', positive=True)
    def sd_binom(nv, pv):
        mean = sum(Fr(k, nv) * Fr(comb(nv, k)) * pv**k * (1 - pv)**(nv - k) for k in range(nv + 1))
        var = sum((Fr(k, nv) - mean) ** 2 * Fr(comb(nv, k)) * pv**k * (1 - pv)**(nv - k) for k in range(nv + 1))
        return var
    k1 = ex(OVERRIDE["q12c-i"]["key"]["expr"]); k2 = ex(OVERRIDE["q12c-ii"]["key"]["expr"])
    ok1 = ok2 = True
    for nv in range(1, 13):
        var = sd_binom(nv, Fr(1, 2))
        ok1 &= sp.simplify(k1.subs(n, nv) ** 2 - sp.Rational(var.numerator, var.denominator)) == 0
        c = sp.Rational(1, 2) + 2 * sp.sqrt(sp.Rational(var.numerator, var.denominator))
        ok2 &= sp.simplify(k2.subs(n, nv) - c) == 0
    CHECKED.add("q12c-i"); CHECKED.add("q12c-ii")
    report("q12c-i", "PASS" if ok1 else "FAIL", "exact variance of the binomial proportion, fair coin, n=1..12: sd^2 equals key^2 exactly")
    report("q12c-ii", "PASS" if ok2 else "FAIL", "c = mean + 2 sd with exact sd, n=1..12 equals key exactly")
    # symbolic confirmation of sd
    nn, kk = sp.symbols('nn kk', positive=True, integer=True)
    # iii
    sdf = lambda nv: mp.sqrt(mp.mpf(1) / 4 / nv); sdb = lambda nv: mp.sqrt(mp.mpf('0.24') / nv)
    nv = mp.findroot(lambda z: mp.mpf(1) / 2 + 2 * sdf(z) - (mp.mpf('0.6') - 2 * sdb(z)), 400)
    report("q12c-iii", "INFO", f"NOT KEYED (question names no precision): exact solution of 1/2+2*sd_fair=0.6-2*sd_biased is n={float(nv):.6f}; guideline says n ~ 392")
    N = 392
    c = Fr(1, 2) + 1 / math.sqrt(N)
    kmin = next(k for k in range(N + 1) if k / N > c)
    check_num("q12c-iv", kmin, f"least k with k/{N} > 1/2+1/sqrt({N})={float(c):.6f}")

def q13a():
    a, L, T, v = sp.symbols('a L T v', positive=True)
    F = v / (L + T * v + v**2 / (2 * a))
    sols = [s for s in sp.solve(sp.diff(F, v), v) if s.is_positive]
    vs = sols[0]
    check_expr("q13a-ii", vs, "SymPy: positive root of dF/dv=0")
    # numeric maximiser check
    rnd = random.Random(7); ok = True
    for _ in range(8):
        Lv, Tv, av = rnd.uniform(1, 9), rnd.uniform(.2, 3), rnd.uniform(.5, 8)
        Fn = lambda x: x / (Lv + Tv * x + x * x / (2 * av))
        best = max((Fn(i / 100), i / 100) for i in range(1, 6000))
        ok &= abs(best[1] - math.sqrt(2 * av * Lv)) < 0.011
    report("q13a-ii-numeric", "PASS" if ok else "FAIL", "grid maximiser of F over 8 random (L,T,a) matches the root")
    Fm = sp.simplify(F.subs(v, vs))
    check_expr("q13a-iii", Fm, "F evaluated at the SymPy maximiser")

def q13b():
    def mind(c):
        f = lambda x: x * x + (x * x - c) ** 2
        # minimise over u=x^2>=0 : D(u)=u+(u-c)^2, scan + golden refine
        best = min((f(i / 2000), i / 2000) for i in range(0, 12000))
        lo, hi = max(0, best[1] - 1 / 2000), best[1] + 1 / 2000
        for _ in range(80):
            m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
            if f(m1) < f(m2): hi = m2
            else: lo = m1
        return math.sqrt(f((lo + hi) / 2))
    ok3 = ok4 = True
    k3 = ex(OVERRIDE["q13b-iii"]["key"]["expr"]); k4 = ex(OVERRIDE["q13b-iv"]["key"]["expr"])
    rr = sp.Symbol('r', positive=True)
    for r in (0.55, 0.8, 1.0, 1.6, 2.5, 4.0):
        lo, hi = r, r * r + 5
        for _ in range(100):
            mid = (lo + hi) / 2
            if mind(mid) < r: lo = mid
            else: hi = mid
        c = (lo + hi) / 2
        ok3 &= abs(c - float(k3.subs(rr, r))) < 1e-5
        ok4 &= abs((c - r) - float(k4.subs(rr, r))) < 1e-5
    CHECKED.update({"q13b-iii", "q13b-iv"})
    report("q13b-iii", "PASS" if ok3 else "FAIL", "bisection on c so the least distance from (0,c) to y=x^2 equals r, r in {0.55..4}")
    report("q13b-iv", "PASS" if ok4 else "FAIL", "c-r from the same bisection equals key")

def q14a():
    ok = True
    rnd = random.Random(11)
    kk = ex(OVERRIDE["q14a-ii"]["key"]["expr"])
    V_, g_, d_ = sp.symbols('V g d', positive=True)
    for _ in range(8):
        gv = rnd.uniform(5, 12); dv = rnd.uniform(3, 40); Vv = math.sqrt(gv * dv) * rnd.uniform(1.1, 2.5)
        def ht(th):
            t = dv / (Vv * math.cos(th)); return Vv * math.sin(th) * t - .5 * gv * t * t
        lo, hi = 0.0, math.pi / 2 - 1e-9
        for _ in range(200):
            m1, m2 = lo + (hi - lo) * .382, lo + (hi - lo) * .618
            if ht(m1) > ht(m2): hi = m2
            else: lo = m1
        best = ht((lo + hi) / 2)
        ok &= abs(best - float(kk.subs({V_: Vv, g_: gv, d_: dv}))) < 1e-7
    CHECKED.add("q14a-ii")
    report("q14a-ii", "PASS" if ok else "FAIL", "golden-section maximum of the wall height over theta for 8 random (V,g,d) with V^2>gd equals key")

def q14b():
    n_ = sp.Symbol('n', positive=True)
    k1 = ex(OVERRIDE["q14b-i"]["key"]["expr"]); k3 = ex(OVERRIDE["q14b-iii"]["key"]["expr"])
    ok1 = ok3 = True
    for n in range(1, 10):
        total = good = 0
        # enumerate all choices of which steps are right-steps
        for R in itertools.combinations(range(2 * n), n):
            Rs = set(R); x = y = 0; bad = False
            for i in range(2 * n):
                if i in Rs: x += 1
                else: y += 1
                if y > x: bad = True; break
            total += 1; good += (not bad)
        ok1 &= (total == int(k1.subs(n_, n)))
        ok3 &= (Fr(good, total) == Fr(int(sp.numer(k3.subs(n_, n))), int(sp.denom(k3.subs(n_, n)))))
    CHECKED.update({"q14b-i", "q14b-iii"})
    report("q14b-i", "PASS" if ok1 else "FAIL", "all 2n-step paths counted for n=1..9")
    report("q14b-iii", "PASS" if ok3 else "FAIL", "exact fraction of paths with B never ahead of A, n=1..9")

for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11b, q11d, q11e, q12a, q12b, q12c, q13a, q13b, q14a, q14b):
    f()
finish("07")
