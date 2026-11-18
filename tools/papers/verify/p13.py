#!/usr/bin/env python3
"""Independent computational verification of the answer keys of Practice Paper 13
(Prithagoras HSC Mathematics Extension 1, 2027).

Every item is computed FROM THE QUESTION STATEMENT (enumeration, exact fractions,
SymPy/mpmath, numeric optimisation, ODE integration), never by evaluating the
guideline's own final formula, and is then compared with the author's key.
Where the question has a free parameter (cards, posts, ...) the statement is
enumerated exactly for small cases, the guideline's general formula is compared
with those enumerations, and the formula is evaluated at the paper's value.

Run:  python tools/papers/verify/p13.py        (needs sympy + mpmath, no numpy)
Exit status 1 if any item FAILs.
"""
import itertools, math, random, sys
from fractions import Fraction as Fr
from math import comb, sqrt, pi, sin, cos, tan, atan, atan2, tanh
import sympy as sp
import mpmath as mp

RESULTS = []
def report(item, status, method):
    RESULTS.append((item, status, method))
    print(f"{item} {status} ({method})", flush=True)

def check(item, ok, method):
    report(item, "PASS" if ok else "FAIL", method)

# ----------------------------------------------------------------- Section I
def q1():
    n = 10
    finals = set()
    for k in range(1, n):                       # upper pile = cards 1..k
        for S in itertools.combinations(range(n), k):   # places taken by the upper pile
            deck = [0] * n
            up, lo = iter(range(1, k + 1)), iter(range(k + 1, n + 1))
            Sset = set(S)
            for pos in range(n):
                deck[pos] = next(up) if pos in Sset else next(lo)
            finals.add(tuple(deck))
    count = sum(1 for d in finals if any(d[i] == i + 1 for i in range(n)))
    check("Q1", count == 758 and "ABCD"[[502, 757, 758, 768].index(count)] == "C" if count in (502, 757, 758, 768) else False,
          f"enumerate all cut+riffle results ({len(finals)} distinct orders); {count} have a fixed card")

def q2():
    # P(x) - (2x+k) = a(x-A)(x-B)(x-C)(x-D); P'(r)-2 = Q'(r).  Unknown D-slope determined?
    x = sp.symbols('x')
    A, B, C, D, a = sp.symbols('A B C D a')
    ok_all, vals = True, set()
    sols_seen = 0
    for b in (1, 2, 3, 5, 7, sp.Rational(1, 2)):
        eqs = []
        roots = [0, b, C, D]
        Q = a * (x - roots[0]) * (x - roots[1]) * (x - roots[2]) * (x - roots[3])
        Qp = sp.diff(Q, x)
        targets = [-36, 8, -9]      # P' - 2 at A, B, C
        eqs = [Qp.subs(x, roots[0]) - targets[0], Qp.subs(x, roots[1]) - targets[1], Qp.subs(x, roots[2]) - targets[2]]
        # 4 unknowns (a, C, D) after fixing A=0, B=b: only 3 unknowns + 3 eqs
        sol = sp.solve(eqs, [a, C, D], dict=True)
        for s in sol:
            vs = [complex(sp.N(s[v])) for v in (a, C, D)]
            if any(abs(z.imag) > 1e-9 for z in vs):
                continue
            av, Cv, Dv = [z.real for z in vs]
            rts = [0, float(b), Cv, Dv]
            if len({round(r, 9) for r in rts}) < 4:
                continue
            sols_seen += 1
            gD = float(Qp.subs({x: Dv, a: av, C: Cv, D: Dv})) + 2
            vals.add(round(gD, 6))
    check("Q2", sols_seen > 0 and vals == {74.0},
          f"solve P' conditions for P-line=a*prod(x-r) over {sols_seen} real root-configurations: P'(D) in {sorted(vals)}")

def q3():
    # model satisfying every datum: g(y)=sqrt(y-1) so G(y)=2sqrt(y-1); check data then derive
    g = lambda y: math.sqrt(y - 1)
    G = lambda y: 2 * math.sqrt(y - 1)
    steps = [G(2) - G(1), G(5) - G(2), G(10) - G(5)]
    equal = max(steps) - min(steps) < 1e-12
    f1 = Fr(2)                     # g(2)f(1)=2, g(2)=1  => f(1)=2
    f3 = Fr(1, 2) / Fr(1)          # g(2) f(3)=1/2     => f(3)=1/2
    data_ok = (g(5) * 2 == 4) and (g(10) * 2 == 6)
    # C1: G(y(3)) = G(1) + [F(3)-F(0)] ; F(1)-F(0)=Delta (C1,C2,C3 columns), F(3)-F(1)=Delta (C4 from (1,1) to (3,2))
    Delta = steps[0]
    y3 = (G(1) + 2 * Delta) ** 2 / 4 + 1
    grad = float(f3) * g(y3)
    check("Q3", equal and data_ok and abs(y3 - 5) < 1e-9 and abs(grad - 1) < 1e-9,
          f"separable-variable model g=sqrt(y-1) reproduces all four data sets; C1 reaches y(3)={y3:.6f}, gradient {grad:.6f}")

def q4():
    def val(t, ph):
        return (5 * cos(t) + 3 * cos(ph) - 4) ** 2 + (5 * sin(t) + 3 * sin(ph) - 4) ** 2
    M = 600
    best = (1e9, 0, 0)
    for i in range(M + 1):
        t = pi / 2 * i / M
        for j in range(M + 1):
            ph = pi / 2 * j / M
            v = val(t, ph)
            if v < best[0]: best = (v, t, ph)
    v, t, ph = best
    h = pi / 2 / M
    for _ in range(60):             # coordinate shrink search, clamped to the box
        improved = False
        for dt, dp in ((h, 0), (-h, 0), (0, h), (0, -h), (h, h), (-h, -h), (h, -h), (-h, h)):
            t2, p2 = min(pi / 2, max(0, t + dt)), min(pi / 2, max(0, ph + dp))
            if val(t2, p2) < v - 1e-16:
                v, t, ph, improved = val(t2, p2), t2, p2, True
        if not improved: h /= 2
    opts = {'A': 0, 'B': 66 - 16 * sqrt(17), 'C': 42 - 10 * sqrt(17), 'D': 2}
    pick = [k for k, o in opts.items() if abs(o - v) < 1e-7]
    check("Q4", pick == ['C'], f"2-D grid + boundary-clamped refinement over [0,pi/2]^2: min={v:.9f} at theta={t:.4f}, phi={ph:.4f}; 42-10sqrt17={opts['C']:.9f}")

def q5():
    mp.mp.dps = 40
    R = lambda p: mp.fsum(mp.binomial(100, k) * p**k * (1 - p)**(100 - k) for k in range(40, 101))
    Rp = lambda p: mp.diff(R, p)
    opts = {'A': mp.mpf(13) / 33, 'B': mp.mpf(79) / 200, 'C': mp.mpf(40) / 101, 'D': mp.mpf(2) / 5}
    # locate the maximum of R' by golden-section (R' is unimodal) on exact binomial sums
    lo, hi = mp.mpf('0.2'), mp.mpf('0.6')
    gr = (mp.sqrt(5) - 1) / 2
    for _ in range(120):
        c, d = hi - gr * (hi - lo), lo + gr * (hi - lo)
        if Rp(c) > Rp(d): hi = d
        else: lo = c
    pm = (lo + hi) / 2
    best = min(opts, key=lambda k: abs(opts[k] - pm))
    check("Q5", best == 'A' and abs(pm - mp.mpf(13) / 33) < mp.mpf(10) ** -15,
          f"maximise R'(p) of the exact binomial tail (40 dp): argmax p={mp.nstr(pm, 20)}; 13/33={mp.nstr(opts['A'], 20)}. Options within 1% in R' - separated only by the exact argmax")

def q6():
    s = sum((-1) ** k * comb(20, k) * comb(50 - k, 22) for k in range(21))
    check("Q6", s == 435, f"exact big-integer sum = {s}")

def q7():
    # integrate y'=(x-1)cos y, y(0)=0 (RK4, step 1e-3) and test each pictured graph's defining formula against the ODE
    f = lambda x, y: (x - 1) * cos(y)
    def integrate(x0, x1, h=1e-3):
        n = int(round(abs(x1 - x0) / h)); sgn = 1 if x1 > x0 else -1; hh = sgn * abs(x1 - x0) / n
        x, y, out = x0, 0.0, {}
        for _ in range(n):
            k1 = f(x, y); k2 = f(x + hh / 2, y + hh * k1 / 2); k3 = f(x + hh / 2, y + hh * k2 / 2); k4 = f(x + hh, y + hh * k3)
            y += hh * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += hh
            out[round(x, 6)] = y
        return out
    right, left = integrate(0, 4.55), integrate(0, -2.55)
    true = {**right, **left}
    TT = lambda x: 2 * atan(tanh(((x - 1) ** 2 - 1) / 4))
    cands = {
        'A': TT,
        'B': lambda x: TT(x) if x <= 1 else TT(1 + (x - 1) / 1.7),
        'C': lambda x: ((x - 1) ** 2 - 1) / 2,
        'D': lambda x: 1.5708 - 2.6536 / ((1 + 2 * (x - 1) ** 2) ** 0.47746),
    }
    err = {}
    for k, c in cands.items():
        err[k] = max(abs(c(x) - y) for x, y in list(true.items())[::50] if -2.55 <= x <= 4.55)
    good = [k for k, e in err.items() if e < 1e-3]
    check("Q7", good == ['A'], "RK4 solution of the ODE (y(0)=0) compared with each pictured graph's formula: max|graph-solution| = "
          + ", ".join(f"{k}:{e:.3g}" for k, e in err.items()))

def q8():
    verts = [(sx * .5, sy, sz * 1.5) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    verts = [(x, y * 1.0, z) for x, y, z in verts]   # 1 x 2 x 3 box: half-sides .5, 1, 1.5
    def hull_area(pts):
        pts = sorted(set(pts))
        def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
        lower, upper = [], []
        for p in pts:
            while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
            lower.append(p)
        for p in reversed(pts):
            while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
            upper.append(p)
        h = lower[:-1] + upper[:-1]
        return abs(sum(h[i][0] * h[(i + 1) % len(h)][1] - h[(i + 1) % len(h)][0] * h[i][1] for i in range(len(h)))) / 2
    def shadow(theta, phi):          # area of projection of the box along the vertical, box rotated so that "down" is (theta,phi)
        n = (sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta))
        # orthonormal basis perpendicular to n
        ref = (1, 0, 0) if abs(n[0]) < .9 else (0, 1, 0)
        u = (n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0])
        ul = sqrt(sum(c * c for c in u)); u = tuple(c / ul for c in u)
        w = (n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0])
        return hull_area([(sum(v[i] * u[i] for i in range(3)), sum(v[i] * w[i] for i in range(3))) for v in verts])
    best, arg = 0, None
    for i in range(0, 91):
        for j in range(0, 91):
            a = shadow(pi / 2 * i / 90, pi / 2 * j / 90)
            if a > best: best, arg = a, (pi / 2 * i / 90, pi / 2 * j / 90)
    h = pi / 2 / 90
    t, p = arg
    for _ in range(50):
        imp = False
        for dt, dp in ((h, 0), (-h, 0), (0, h), (0, -h)):
            a = shadow(t + dt, p + dp)
            if a > best + 1e-13: best, t, p, imp = a, t + dt, p + dp, True
        if not imp: h /= 2
    check("Q8", abs(best - 7) < 1e-6, f"convex-hull area of the box's vertical projection maximised over orientations: {best:.8f} m^2 (options 3sqrt5=6.708, 7, 9, 11)")

def q9():
    g = 10.0
    def V2(s, T, pts):
        # launch from distance s before the first point, slope T, minimal V^2 to pass through all pts (x,y)
        worst = 0
        for (x, y) in pts:
            D = s + x
            den = D * T - y
            if den <= 1e-12: return 1e18
            worst = max(worst, g / 2 * 2 * (1 + T * T) * D * D / (2 * den) * 1.0)
        return worst
    # y = D T - g (1+T^2) D^2 / (2 V^2)  =>  V^2 = g (1+T^2) D^2 / (2 (D T - y))
    def V2b(s, T, pts):
        w = 0
        for (x, y) in pts:
            D = s + x; den = D * T - y
            if den <= 1e-12: return 1e18
            w = max(w, g * (1 + T * T) * D * D / (2 * den))
        return w
    best = 1e18
    for pts in ([(0, 12), (8, 18)], [(0, 18), (8, 12)]):      # launch from the 12 m side / the 18 m side
        # (second set is the mirror image: the wall met first is the 18 m wall)
        bs = (1e18, 0, 0)
        for si in range(0, 241):
            s = si * 0.25
            for ti in range(1, 401):
                T = ti * 0.02
                v = V2b(s, T, pts)
                if v < bs[0]: bs = (v, s, T)
        v, s, T = bs
        def inner(sv):                     # best T for a launch distance s (ternary search, V^2 is unimodal in T)
            lo, hi = max(0.0, T - 0.5), T + 0.5
            for _ in range(200):
                m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
                if V2b(sv, m1, pts) < V2b(sv, m2, pts): hi = m2
                else: lo = m1
            return V2b(sv, (lo + hi) / 2, pts)
        lo, hi = max(0.0, s - 1.0), s + 1.0
        for _ in range(200):               # outer ternary search over s
            m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
            if inner(m1) < inner(m2): hi = m2
            else: lo = m1
        v = inner((lo + hi) / 2)
        best = min(best, v)
    speed = sqrt(best)
    opts = {'A': 6 * sqrt(10), 'B': 2 * sqrt(95), 'C': 20.0, 'D': 2 * sqrt(110)}
    pick = [k for k, o in opts.items() if abs(o - speed) < 1e-4]
    check("Q9", pick == ['C'], f"min over launch point and angle of the speed needed to clear both wall tops (parabola above chord = above roof), both launch sides: V={speed:.6f}")

def q10():
    # exact distribution of S_n; least n with P(S_n>=24)>=0.975
    probs = {1: Fr(3, 5), 0: Fr(1, 5), -1: Fr(1, 5)}
    dist = {0: Fr(1)}
    first = None; at = {}
    for n in range(1, 140):
        nd = {}
        for s, p in dist.items():
            for d, q in probs.items():
                nd[s + d] = nd.get(s + d, 0) + p * q
        dist = nd
        P = sum(p for s, p in dist.items() if s >= 24)
        at[n] = float(P)
        if first is None and P >= Fr(975, 1000): first = n
    near = min((36, 60, 100, 128), key=lambda o: abs(o - first))
    check("Q10", first is not None and near == 100,
          f"exact DP: least n with P(S>=24)>=0.975 is {first} (P(60)={at[60]:.4f}, P(99)={at[99]:.4f}, P(100)={at[100]:.4f}); closest option 100 -> C")

# ----------------------------------------------------------------- Section II
def q11a():
    mp.mp.dps = 30
    found = []
    random.seed(1)
    def F(*v):
        return [1 / v[i] + sum(2 / (v[i] - v[j]) for j in range(4) if j != i) - 1 for i in range(4)]
    for trial in range(400):
        x0 = sorted(random.uniform(0.2, 20) for _ in range(4))
        try:
            sol = mp.findroot(F, x0, tol=1e-25, maxsteps=60)
        except Exception:
            continue
        s = sorted(float(z) for z in sol)
        if all(z > 0 for z in s) and all(s[i + 1] - s[i] > 1e-6 for i in range(3)):
            if not any(max(abs(a - b) for a, b in zip(s, f)) < 1e-6 for f in found): found.append(s)
    prods = [math.prod(f) for f in found]
    check("Q11a", len(found) >= 1 and all(abs(pr - 24) < 1e-8 for pr in prods),
          f"Newton from 400 random starts on the 4 equations: {len(found)} distinct positive solution set(s) {[[round(z, 6) for z in f] for f in found]}, product(s) {[round(pr, 9) for pr in prods]}")

def q11b():
    xs = [pi / 12, pi / 3, 3 * pi / 4]
    # unknown a,b: (s_i-a)(c_i-b) equal for the three given x ; c = that common value
    a, b = sp.symbols('a b')
    S = [sp.N(sp.sin(v), 40) for v in xs]; C = [sp.N(sp.cos(v), 40) for v in xs]
    e1 = (S[0] - a) * (C[0] - b) - (S[1] - a) * (C[1] - b)
    e2 = (S[1] - a) * (C[1] - b) - (S[2] - a) * (C[2] - b)
    sols = sp.solve([e1, e2], [a, b], dict=True)
    out = []
    for s in sols:
        av, bv = complex(s[a]), complex(s[b])
        if abs(av.imag) > 1e-12 or abs(bv.imag) > 1e-12: continue
        av, bv = av.real, bv.real
        cv = (sin(xs[0]) - av) * (cos(xs[0]) - bv)
        fz = lambda x: (sin(x) - av) * (cos(x) - bv) - cv
        # all zeros in [0,2pi): sign changes on a fine grid + tangential zeros
        N = 200000; roots = []
        prev = fz(0)
        for i in range(1, N + 1):
            x = 2 * pi * i / N; cur = fz(x)
            if prev == 0 or prev * cur < 0:
                lo, hi = 2 * pi * (i - 1) / N, x
                for _ in range(80):
                    mid = (lo + hi) / 2
                    if fz(lo) * fz(mid) <= 0: hi = mid
                    else: lo = mid
                roots.append((lo + hi) / 2)
            prev = cur
        roots = sorted(r for r in roots if r < 2 * pi - 1e-9)
        out.append((av, bv, cv, roots))
    ok = False; desc = []
    for av, bv, cv, roots in out:
        desc.append(f"a={av:.4f},b={bv:.4f},c={cv:.5f}: roots/pi={[round(r / pi, 5) for r in roots]}")
        if len(roots) == 4 and any(abs(r - 11 * pi / 6) < 1e-6 for r in roots): ok = True
    four = [r for (_, _, _, rr) in out if len(rr) == 4 for r in rr]
    fourth = {round(r / pi, 5) for (_, _, _, rr) in out if len(rr) == 4 for r in rr if min(abs(r - x) for x in xs) > 1e-6}
    check("Q11b", ok and fourth == {round(11 / 6, 5)}, "solve for (a,b,c) from the 3 given solutions, then locate every root in [0,2pi): " + " | ".join(desc) + f" ; fourth solution/pi = {sorted(fourth)}")

def q11c():
    allok = True
    for n in range(1, 13):
        S = sum(Fr((-1) ** k, 2 * k + 1) * comb(n, k) for k in range(n + 1))
        allok &= (S == Fr(4 ** n * math.factorial(n) ** 2, math.factorial(2 * n + 1)))
    check("Q11c", allok, "exact Fractions, n=1..12: sum_{k}(-1)^k C(n,k)/(2k+1) == 4^n (n!)^2/(2n+1)!  (the induction proof itself is NOT machine-checked here)")

def q11d():
    x, c = sp.symbols('x c')
    def npts(cv):
        # intersections of y=c-x^3/3 and its inverse: points (x,y) with y=f(x), x=f(y); eliminate y
        y = cv - x ** 3 / 3
        poly = sp.Poly(sp.expand(x - (cv - y ** 3 / 3)), x)
        return poly.count_roots() if False else len(sp.real_roots(poly)) if False else len(set(sp.Poly(poly, x).intervals()) ) if False else sp.Poly(sp.sqf_part(poly.as_expr()), x).count_roots()
    # exact count of distinct real roots (each x gives one point) for rational c on a fine grid
    cs = [sp.Rational(i, 60) for i in range(-120, 121)]
    five = [cv for cv in cs if npts(cv) == 5]
    lo, hi = min(five), max(five)
    # boundary behaviour
    eps = sp.Rational(1, 10 ** 9)
    b1, b2 = sp.Rational(4, 3), 4 * sp.sqrt(2) / 3
    inside_pos = npts(sp.Rational(4, 3) + eps) == 5
    just_out_lo = npts(sp.Rational(4, 3) - eps) == 3
    at43 = npts(sp.Rational(4, 3))
    just_in_hi = npts(sp.Rational(56568, 30000) / 1) if False else None
    c_near = sp.Rational(int(float(b2) * 10 ** 9), 10 ** 9)
    in_hi = npts(c_near - eps) == 5
    out_hi = npts(c_near + 2 * eps + sp.Rational(1, 10 ** 8)) == 1
    five_neg = [cv for cv in five if cv < 0]
    ok = (all(sp.Rational(4, 3) < cv < b2 or -b2 < cv < -sp.Rational(4, 3) for cv in five) and inside_pos and just_out_lo
          and at43 == 3 and in_hi and out_hi and len(five_neg) == len([cv for cv in five if cv > 0]))
    check("Q11d", ok, f"exact distinct-real-root count of the degree-9 polynomial for 241 rational c in [-2,2]: 5 points exactly for {len([v for v in five if v>0])} values per sign, all inside 4/3<|c|<4sqrt2/3 (={float(b2):.6f}); count(4/3)={at43}, count(4/3-1e-9)=3, count just inside upper end =5, just outside =1. Set of c is the interval pair 4/3<|c|<4sqrt2/3 (an interval pair: engine-uncheckable)")

def q12a():
    mp.mp.dps = 30
    allok = True; info = []
    for m in range(1, 9):
        n = 2 * m
        W = lambda p: max(mp.binomial(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n + 1))
        Ng = 40000
        vals = [(W(mp.mpf(i) / Ng), i) for i in range(1, Ng)]
        vmin = min(v for v, _ in vals)
        argmins = [mp.mpf(i) / Ng for v, i in vals if v <= vmin + mp.mpf(10) ** -25]
        # refine the local minima to high precision: they occur where two binomial pmf are equal -> the candidates
        cands = [mp.mpf(m) / (2 * m + 1), mp.mpf(m + 1) / (2 * m + 1)]
        wc = [W(pc) for pc in cands]
        # a candidate is a true global min iff W(cand) <= all grid values (+tiny) and the two are equal
        okm = abs(wc[0] - wc[1]) < mp.mpf(10) ** -25 and all(v >= wc[0] - mp.mpf(10) ** -20 for v, _ in vals)
        # any p whose W is within 1e-12 of min must be near a candidate
        near = [p for p in argmins]
        allok &= okm
        info.append(f"m={m}:{mp.nstr(wc[0], 8)}")
    # also check no OTHER minimiser: sample all p with W within 1e-9 of min and make sure each is within 1/Ng of a candidate (m=1..8)
    other = 0
    for m in range(1, 9):
        n = 2 * m
        W = lambda p: max(mp.binomial(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n + 1))
        cands = [mp.mpf(m) / (2 * m + 1), mp.mpf(m + 1) / (2 * m + 1)]
        wmin = W(cands[0])
        for i in range(1, 4000):
            p = mp.mpf(i) / 4000
            if W(p) < wmin - mp.mpf(10) ** -25: other += 1
    allok &= other == 0
    check("Q12a", allok, "m=1..8: exact max-of-binomial-pmf W(p) on 40000-point grid + the two candidate points; W(m/(2m+1))=W((m+1)/(2m+1)) and no grid value is lower: " + ", ".join(info))

def q12b():
    s3 = sp.sqrt(3)
    p = sp.symbols('p')
    # jet k at angle 30k degrees; large (sqrt3) for even k, small (1) for odd k; force points to the centre
    vec = []
    for k in range(12):
        ang = sp.Rational(k, 6) * sp.pi
        mag = s3 if k % 2 == 0 else 1
        vec.append((sp.nsimplify(sp.simplify(-mag * sp.cos(ang))), sp.nsimplify(sp.simplify(-mag * sp.sin(ang)))))
    # exact: components in Q(sqrt3)
    def comp(v):
        return (sp.expand(v[0]), sp.expand(v[1]))
    vec = [comp(v) for v in vec]
    # represent as pairs (r, q) meaning r + q*sqrt3
    def split(e):
        e = sp.expand(e); return (e.coeff(s3, 0), e.coeff(s3, 1))
    cv = [(split(v[0]), split(v[1])) for v in vec]
    counts = [0] * 13
    for mask in range(1 << 12):
        sx = [Fr(0), Fr(0)]; sy = [Fr(0), Fr(0)]; n = 0
        for k in range(12):
            if mask >> k & 1:
                n += 1
                (xr, xq), (yr, yq) = cv[k]
                sx[0] += Fr(int(xr.p), int(xr.q)); sx[1] += Fr(int(xq.p), int(xq.q))
                sy[0] += Fr(int(yr.p), int(yr.q)); sy[1] += Fr(int(yq.p), int(yq.q))
        if sx == [0, 0] and sy == [0, 0]: counts[n] += 1
    prob = sum(counts[n] * p ** n * (1 - p) ** (12 - n) for n in range(13))
    r = p * (1 - p)
    guide = ((1 - 2 * r) ** 3 + 2 * r ** 3) ** 2 + 6 * r ** 3 * (1 - r) * (1 - 2 * r) ** 2
    same = sp.expand(prob - guide) == 0
    poly = sp.expand(prob)
    rr = sp.symbols('r')
    expanded = 1 - 12 * rr + 60 * rr ** 2 - 150 * rr ** 3 + 186 * rr ** 4 - 96 * rr ** 5 + 12 * rr ** 6
    same2 = sp.expand(expanded.subs(rr, r) - prob) == 0
    check("Q12b", same and same2,
          f"exact enumeration of all 4096 on/off states with exact Q(sqrt3) vector sums; zero-sum counts by number on = {counts} (total {sum(counts)}); polynomial identical to ((1-2r)^3+2r^3)^2+6r^3(1-r)(1-2r)^2, r=p(1-p), and to the expanded form; at p=1/2: {prob.subs(p, sp.Rational(1,2))} (=43/1024)")

def riffle_perm(n, letters):
    k = sum(letters)                                    # letters: 1 = from top packet (T)
    top, bot = iter(range(0, k)), iter(range(k, n))
    return tuple(next(top) if l else next(bot) for l in letters)   # deck[pos] = original index of the card now there

def q12ci():
    results = {}
    for n in range(1, 17):
        tot = 0
        for letters in itertools.product((0, 1), repeat=n):
            d = riffle_perm(n, letters)
            tot += sum(1 for i in range(n) if d[i] == i)
        results[n] = Fr(tot, 2 ** n)
    formula = lambda n: 2 - Fr(1, 2 ** (n - 1))
    ok_small = all(results[n] == formula(n) for n in results)
    # n=52 by the position-by-position count validated below against brute force for n<=16
    def exact_by_positions(n):
        total = 0
        for i in range(1, n + 1):
            # card in position i is original card i  <=> (letter_i = T and the first i letters are all T) or (letter_i = B and no T after i)
            total += 2 ** (n - i) + 2 ** (i - 1)
        return Fr(total, 2 ** n)
    pos_ok = all(exact_by_positions(n) == results[n] for n in results)
    e52 = exact_by_positions(52)
    check("Q12c-i", ok_small and pos_ok and e52 == 2 - Fr(1, 2 ** 51),
          f"brute force over all 2^n shuffle strings (n<=16): E=2-2^(1-n) exactly for every n; position-count method matches brute force and gives E(52)={e52} = 2-1/2^51")

def q12cii():
    ok = True; vals = []
    for n in range(1, 9):
        shuf = [riffle_perm(n, l) for l in itertools.product((0, 1), repeat=n)]
        ident = tuple(range(n)); cnt = 0
        for s1 in shuf:
            for s2 in shuf:
                # after first shuffle deck1[i]=s1[i]; second acts on positions: deck2[i]=deck1[s2[i]]
                if all(s1[s2[i]] == i for i in range(n)): cnt += 1
        P = Fr(cnt, 4 ** n)
        vals.append((n, P))
        ok &= (P == Fr(comb(n + 3, 3), 4 ** n))
    P52 = Fr(comb(55, 3), 4 ** 52)
    check("Q12c-ii", ok and P52 == Fr(26235, 2 ** 104),
          f"brute force over all 4^n pairs of shuffles, n=1..8: P(identity)=C(n+3,3)/4^n each time; at n=52: C(55,3)/4^52 = 26235/2^104")


def override_exact_keys():
    """The shipped exact keys are the values computed above, as exact fractions (no float)."""
    import json, os
    path = os.path.join(os.path.dirname(__file__), '..', 'overrides', 'ext1-2027-p13.json')
    keys = json.load(open(path))['keys']
    e52 = Fr(2 ** 52 - 1, 2 ** 51); p52 = Fr(comb(55, 3), 4 ** 52)
    got1 = Fr(int(keys['q12c-i']['key']['n']), int(keys['q12c-i']['key']['d']))
    got2 = Fr(int(keys['q12c-ii']['key']['n']), int(keys['q12c-ii']['key']['d']))
    check("Q12c-i/ii exact keys", got1 == e52 and got2 == p52 == Fr(26235, 2 ** 104),
          "the override's exact keys equal the exactly-computed expectation and the probability (Fractions)")

# ---- Q13(a): float
def q13ai():
    # lowest point at height 0; V(d) = volume below height d.
    def V(d):
        d = min(max(d, 0.0), 10.0)
        return 4 * pi * d * d if d <= 5 else 200 * pi - 4 * pi * (10 - d) ** 2
    V0 = V(4.0)
    def Eof(W):      # pond level above the lowest point when the water inside has volume W
        lo, hi = 0.0, 10.0
        for _ in range(200):
            mid = (lo + hi) / 2
            if V(mid) < W + V0: lo = mid
            else: hi = mid
        return (lo + hi) / 2
    def h(W):        # inflow rate with W of water inside (pump aside)
        # water level w:  V(w)=W
        lo, hi = 0.0, 10.0
        for _ in range(200):
            mid = (lo + hi) / 2
            if V(mid) < W: lo = mid
            else: hi = mid
        w = (lo + hi) / 2
        return pi * sqrt(max(Eof(W) - w, 0))
    Wmax = V(10.0) - V0                                   # float sinks when E reaches 10
    grid = [Wmax * i / 20000 for i in range(20001)]
    hv = [h(W) for W in grid]
    hmin = min(hv)
    # ODE: dW/dt = h(W) - p  while W>0 ; start W=0.  Sinks iff W reaches Wmax.
    import bisect
    def hinterp(W):                    # linear interpolation in the 20001-point table of the exact h(W)
        W = min(max(W, 0.0), Wmax); f = W / Wmax * 20000; i = min(int(f), 19999)
        return hv[i] + (hv[i + 1] - hv[i]) * (f - i)
    def sinks(p, T=40000.0, dt=0.5):
        W = 0.0
        for _ in range(int(T / dt)):
            k = lambda w: hinterp(w) - p
            r1 = k(W); r2 = k(W + dt * r1 / 2); r3 = k(W + dt * r2 / 2); r4 = k(W + dt * r3)
            W += dt * (r1 + 2 * r2 + 2 * r3 + r4) / 6
            if W >= Wmax - 1e-6: return True
            if W < 0: W = 0.0
        return False
    target = pi * sqrt(10 - 2 * sqrt(17))
    below = sinks(target * 0.98); above = sinks(target * 1.02)
    check("Q13a-i", abs(hmin - target) < 1e-3 and below and not above,
          f"model from the 4 facts: inflow rate h(W) over the whole filling range has minimum {hmin:.6f} (key pi*sqrt(10-2sqrt17)={target:.6f}); ODE with pump p=0.98*key sinks={below}, p=1.02*key never sinks={not above}")

def q13aii():
    mp.mp.dps = 30
    # water level w above widest part; area there = 8*pi*(10-w); pond level E: (10-E)^2=(10-w)^2-16 (from V(E)=V(w)+64pi)
    E = lambda w: 10 - mp.sqrt((10 - w) ** 2 - 16)
    # start: w=5 (E=7); sink: E=10 -> (10-w)^2=16 -> w=6
    # check the volume relation numerically in the model
    Vf = lambda d: 4 * mp.pi * d * d if d <= 5 else 200 * mp.pi - 4 * mp.pi * (10 - d) ** 2
    rel = max(abs(Vf(E(w)) - Vf(w) - Vf(4)) for w in (mp.mpf('5.0'), mp.mpf('5.5'), mp.mpf('5.9')))
    integrand = lambda w: 8 * (10 - w) / mp.sqrt(E(w) - w)         # dt = A(w) dw / (pi sqrt(E-w)) , A=8 pi (10-w)
    T = mp.quad(integrand, [5, 6])
    key = 8 * (53 * mp.sqrt(2) - 32) / 15
    check("Q13a-ii", rel < 1e-20 and abs(T - key) < mp.mpf(10) ** -15,
          f"numeric quadrature of dt = 8(10-w)dw/sqrt(E-w) from w=5 (E=7) to w=6 (E=10), E from V(E)=V(w)+V(4): T={mp.nstr(T, 18)} s; key 8(53sqrt2-32)/15={mp.nstr(key, 18)}")

def drone(u, v, until_cross=False, Tmax=400.0, dt=2e-4):
    # truck at (u t, 0); drone starts at (120, 0); truck on drone's left, velocity perpendicular to the sight line
    def rhs(t, s):
        X, Y = s                         # drone position
        wx, wy = u * t - X, 0.0 - Y      # drone -> truck
        r = math.hypot(wx, wy)
        return (v * wy / r, -v * wx / r)  # heading = rotate sight line 90 deg clockwise (truck on the left)
    t, s = 0.0, (120.0, 0.0)
    rmax, rmin = 0.0, 1e18
    prevY = s[1]; tr = []
    first_cross = None
    while t < Tmax:
        k1 = rhs(t, s); k2 = rhs(t + dt / 2, (s[0] + dt * k1[0] / 2, s[1] + dt * k1[1] / 2))
        k3 = rhs(t + dt / 2, (s[0] + dt * k2[0] / 2, s[1] + dt * k2[1] / 2)); k4 = rhs(t + dt, (s[0] + dt * k3[0], s[1] + dt * k3[1]))
        n = (s[0] + dt * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, s[1] + dt * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6)
        t += dt
        r = math.hypot(u * t - n[0], n[1])
        rmax = max(rmax, r); rmin = min(rmin, r)
        if until_cross and t > 0.05 and prevY > 0 and n[1] <= 0:
            f = prevY / (prevY - n[1])
            return t - dt + f * dt, (s[0] + f * (n[0] - s[0]))
        prevY = n[1]; s = n
    return rmax, rmin

def q13bi():
    rmax, rmin = drone(15.0, 25.0, Tmax=300.0, dt=2e-3)
    check("Q13b-i", abs(rmax - 300) < 0.5 and abs(rmin - 75) < 0.5 and rmax <= 300.0 + 1e-6,
          f"RK4 simulation of the pursuit-style motion (dt=2ms, 300 s): greatest drone-truck distance {rmax:.4f} m, least {rmin:.4f} m (key 300 m greatest; guideline also states least 75 m)")

def q13bii():
    t, x = drone(25.0, 25.0, until_cross=True, Tmax=60.0, dt=2e-5)
    check("Q13b-ii", abs(t - 6.4) < 5e-3 and abs((x - 120) + 80) < 0.02,
          f"RK4 simulation, event detection at the next y=0 crossing: t={t:.5f} s, drone x={x:.4f}, i.e. {x-120:.4f} m from S (80 m back towards the truck's start); key 80 m")

# ---- Q14
def sphere_setup():
    a_b, a_c, b_c = 7 / 25, 9 / 25, 3 / 5
    G = [[1, a_b, a_c], [a_b, 1, b_c], [a_c, b_c, 1]]
    # Cholesky -> unit vectors in R^3
    L = [[0.0] * 3 for _ in range(3)]
    for i in range(3):
        for j in range(i + 1):
            s = G[i][j] - sum(L[i][k] * L[j][k] for k in range(j))
            L[i][j] = sqrt(s) if i == j else s / L[j][j]
    return L

def dot(u, v): return sum(x * y for x, y in zip(u, v))
def sub(u, v): return tuple(x - y for x, y in zip(u, v))
def nrm(u): return sqrt(dot(u, u))

def q14ai():
    A, B, C = sphere_setup()
    target = sqrt(10) / 4
    def cosADB(d):
        u, v = sub(A, d), sub(B, d)
        return dot(u, v) / (nrm(u) * nrm(v))
    def dirv(th, ph): return (sin(th) * cos(ph), sin(th) * sin(ph), cos(th))
    best = 2.0
    pts = []
    # scan latitude lines (phi fixed): bisect theta on every sign change of cosADB-target
    NP, NT = 3600, 3600
    for i in range(NP):
        ph = 2 * pi * i / NP
        prev = None
        for j in range(NT + 1):
            th = pi * j / NT
            d = dirv(th, ph)
            if nrm(sub(A, d)) < 1e-9 or nrm(sub(B, d)) < 1e-9: prev = None; continue
            val = cosADB(d) - target
            if prev is not None and prev[1] * val < 0:
                lo, hi = prev[0], th
                for _ in range(60):
                    mid = (lo + hi) / 2
                    if (cosADB(dirv(lo, ph)) - target) * (cosADB(dirv(mid, ph)) - target) <= 0: hi = mid
                    else: lo = mid
                dd = dirv((lo + hi) / 2, ph)
                pts.append(dd)
                best = min(best, dot(C, dd))
            prev = (th, val)
    # polish: local refinement of the min around the best sample along the constraint curve using the bisection in theta
    # (ph-refinement by golden section)
    imin = min(range(len(pts)), key=lambda i: dot(C, pts[i]))
    p0 = pts[imin]
    ph0 = atan2(p0[1], p0[0]) % (2 * pi)
    def fcurve(ph):
        # all curve points on this meridian-line, min c.d
        res = 2.0
        prev = None
        for j in range(NT + 1):
            th = pi * j / NT
            d = dirv(th, ph)
            if nrm(sub(A, d)) < 1e-9 or nrm(sub(B, d)) < 1e-9: prev = None; continue
            val = cosADB(d) - target
            if prev is not None and prev[1] * val < 0:
                lo, hi = prev[0], th
                for _ in range(60):
                    mid = (lo + hi) / 2
                    if (cosADB(dirv(lo, ph)) - target) * (cosADB(dirv(mid, ph)) - target) <= 0: hi = mid
                    else: lo = mid
                res = min(res, dot(C, dirv((lo + hi) / 2, ph)))
            prev = (th, val)
        return res
    lo, hi = ph0 - 2 * pi / NP * 3, ph0 + 2 * pi / NP * 3
    gr = (sqrt(5) - 1) / 2
    for _ in range(50):
        c, d = hi - gr * (hi - lo), lo + gr * (hi - lo)
        if fcurve(c) < fcurve(d): hi = d
        else: lo = c
    best = min(best, fcurve((lo + hi) / 2))
    key_cos = -(3 + 8 * sqrt(6)) / 25
    ang = math.acos(best)
    check("Q14a-i", abs(best - key_cos) < 1e-6 and abs(ang - 2.699) < 1e-3,
          f"3-D vectors from the Gram matrix; sampled the whole constraint curve cos(ADB)=sqrt10/4 on the sphere ({len(pts)} pts) and minimised c.d: min cos(COD)={best:.8f} (key -(3+8sqrt6)/25={key_cos:.8f}); greatest distance = {ang:.6f} R, key ~2.699R")

def q14aii():
    A, B, C = sphere_setup()
    X = [A, B, C]
    # satellite at P (|P|=R+h, R=1) sees city X iff P.X >= 1 (segment misses the interior). minimise |P|.
    def radius(th, ph):
        n = (sin(th) * cos(ph), sin(th) * sin(ph), cos(th))
        m = min(dot(n, x) for x in X)
        return 1 / m if m > 1e-12 else 1e18
    best = (1e18, 0, 0)
    NG = 720
    for i in range(NG + 1):
        th = pi * i / NG
        for j in range(2 * NG):
            ph = pi * j / NG
            r = radius(th, ph)
            if r < best[0]: best = (r, th, ph)
    r, th, ph = best; h = pi / NG
    for _ in range(80):
        imp = False
        for dt, dp in ((h, 0), (-h, 0), (0, h), (0, -h), (h, h), (-h, -h), (h, -h), (-h, h)):
            v = radius(th + dt, ph + dp)
            if v < r - 1e-15: r, th, ph, imp = v, th + dt, ph + dp, True
        if not imp: h /= 2
    key = sqrt(5 / 3)
    # also check the midpoint-of-AB position the guideline warns about fails for C
    nAB = tuple((x + y) for x, y in zip(A, B)); nl = nrm(nAB); nAB = tuple(c / nl for c in nAB)
    fails = dot(nAB, C) < min(dot(nAB, A), dot(nAB, B))
    check("Q14a-ii", abs(r - key) < 1e-7 and fails,
          f"minimise |P| subject to P.X>=R^2 for the three cities (sphere search + refinement): |P|/R={r:.9f}, h={r-1:.9f}R; key sqrt(5/3)-1={key-1:.9f}R (=(sqrt15-3)/3 R); AB-midpoint position fails for C: {fails}")

def q14bi():
    mp.mp.dps = 30
    worst = mp.mpf(0); rows = []
    for N in range(3, 15):
        pts = [(mp.cos(2 * mp.pi * k / N), mp.sin(2 * mp.pi * k / N)) for k in range(N)]
        tot = mp.mpf(0); cnt = 0
        for i, j, k in itertools.combinations(range(N), 3):
            (x1, y1), (x2, y2), (x3, y3) = pts[i], pts[j], pts[k]
            tot += abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2; cnt += 1
        E = tot / cnt
        formula = mp.mpf(3 * N) / (2 * (N - 1) * (N - 2)) * mp.cot(mp.pi / N)
        worst = max(worst, abs(E - formula))
        rows.append((N, E))
    ok = worst < mp.mpf(10) ** -25
    check("Q14b-i", ok, f"mean area over all C(N,3) triangles of the regular N-gon (unit circumradius), N=3..14, 30-digit mpmath: max |enumeration - 3N cot(pi/N)/(2(N-1)(N-2))| = {mp.nstr(worst, 3)}; N=3 -> {mp.nstr(rows[0][1], 12)}, N=4 -> {mp.nstr(rows[1][1], 12)}")

def q14bii():
    def contains_centre(idx, N):
        P = [(cos(2 * pi * k / N), sin(2 * pi * k / N)) for k in idx]
        def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
        for a, b, c in itertools.combinations(P, 3):          # Caratheodory: centre in hull iff in some triangle
            s1, s2, s3 = cr(a, b, (0, 0)), cr(b, c, (0, 0)), cr(c, a, (0, 0))
            if (s1 > 1e-12 and s2 > 1e-12 and s3 > 1e-12) or (s1 < -1e-12 and s2 < -1e-12 and s3 < -1e-12): return True
        return False
    ok = True; rows = []
    for N in (3, 5, 7, 9, 11, 13):
        # E[T] = sum_{k>=0} P(T>k); T>k iff the first k chosen posts do not contain the centre (k>=3) (always true for k<=2)
        E = Fr(0)
        for k in range(0, N + 1):
            if k < 3: Pk = Fr(1)
            else:
                tot = comb(N, k)
                if k > (N + 1) // 2 + 1 and True: pass
                good = 0
                for idx in itertools.combinations(range(N), k):
                    if not contains_centre(idx, N): good += 1
                Pk = Fr(good, tot)
            E += Pk
        rows.append((N, E)); ok &= (E == Fr(5 * N + 3, N + 3))
    # direct random-order enumeration for N=5,7 (all N! orders) as an independent method
    for N in (5, 7):
        tot = 0; cnt = 0
        for perm in itertools.permutations(range(N)):
            for k in range(3, N + 1):
                if contains_centre(perm[:k], N):
                    tot += k; break
            cnt += 1
        ok &= (Fr(tot, cnt) == Fr(5 * N + 3, N + 3))
    check("Q14b-ii", ok, "exact geometry (centre-in-hull via triangle test) over all k-subsets, N=3,5,...,13, and all N! orders for N=5,7: E[T] = " + ", ".join(f"N={n}:{e}" for n, e in rows) + " ; all equal (5N+3)/(N+3)")

ITEMS = [override_exact_keys, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q11c, q11d, q12a, q12b, q12ci, q12cii,
         q13ai, q13aii, q13bi, q13bii, q14ai, q14aii, q14bi, q14bii]

if __name__ == '__main__':
    only = set(sys.argv[1:])
    for fn in ITEMS:
        if only and fn.__name__ not in only: continue
        try:
            fn()
        except Exception as e:                                  # an error is a failure, never a pass
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), "FAIL", f"script error: {type(e).__name__}: {e}")
    print()
    print("NOT MACHINE-VERIFIED: Q11c proof by induction (only the closed form is checked for n=1..12); the justification/proof parts of 11a,11b,12a,12b,13a,13b,14a,14b are consistent-with-guideline-only (only final answers are computed).")
    bad = [r for r in RESULTS if r[1] != "PASS"]
    print(f"{len(RESULTS) - len(bad)} PASS, {len(bad)} not-PASS")
    sys.exit(1 if bad else 0)
