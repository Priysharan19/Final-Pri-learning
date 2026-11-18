#!/usr/bin/env python3
"""Independent computational verification of HSC Ext 1 practice Paper 01 keys.

Every item is computed from the QUESTION STATEMENT (brute force, exact
enumeration, SymPy, numeric integration/ODE), then compared to the author's key
(guidelines.tex).  Run:  python p01.py
"""
import math, random, itertools
from fractions import Fraction
from math import comb, factorial, pi, sqrt, sin, cos, tan, asin, acos, atan
import sympy as sp
import mpmath as mp

random.seed(2027)
RESULTS = []

def report(item, status, method, detail=""):
    RESULTS.append((item, status))
    print(f"{item} {status} ({method})" + (f" -- {detail}" if detail else ""))

def close(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))

# ------------------------------------------------------------------ Section I
def q1():
    x = sp.symbols('x')
    r = sp.rem(x**100, (x - 1)**2, x)
    key = {'A': sp.Integer(1), 'B': 100*x - 99, 'C': 99*x - 98, 'D': 100*x + 1}
    ok = [k for k, v in key.items() if sp.expand(r - v) == 0]
    report('Q1', 'PASS' if ok == ['B'] else 'FAIL', f'sympy polynomial remainder = {r}')

def q2():
    pts = [(cos(2*pi*i/12), sin(2*pi*i/12)) for i in range(12)]
    def acute(a, b, c):
        for p, q, r in ((a, b, c), (b, c, a), (c, a, b)):
            d = (q[0]-p[0])*(r[0]-p[0]) + (q[1]-p[1])*(r[1]-p[1])
            if d <= 1e-9: return False   # right or obtuse at p
        return True
    n = sum(acute(pts[i], pts[j], pts[k]) for i, j, k in itertools.combinations(range(12), 3))
    report('Q2', 'PASS' if n == 40 else 'FAIL', f'enumerate all C(12,3)=220 triangles, dot products; acute={n}; key A=40')

def q3():
    f = lambda x: asin(sin(x)) if False else (math.asin(math.cos(x)) + math.acos(math.sin(x)))
    # Figure options (read from E1-01_figs.tex, polylines in units of pi): breakpoints (x/pi, y/pi)
    opts = {
        'A': [(0,0),(.5,1),(1,1),(1.5,0),(2,0)],
        'B': [(0,1),(.5,0),(1,0),(1.5,1),(2,1)],
        'C': [(0,1),(.5,0),(1,1),(1.5,0),(2,1)],
        'D': [(0,.5),(.5,0),(1,0),(1.5,.5),(2,.5)],
    }
    def interp(pl, t):
        for (x0,y0),(x1,y1) in zip(pl, pl[1:]):
            if x0 <= t <= x1: return y0 + (y1-y0)*(t-x0)/(x1-x0)
    good = []
    for k, pl in opts.items():
        err = max(abs(f(pi*t)/pi - interp(pl, t)) for t in [i/400 for i in range(0, 801)])
        if err < 1e-9: good.append(k)
    report('Q3', 'PASS' if good == ['B'] else 'FAIL', f'sample y on 801 points vs the four polylines in the figure source; matches={good}')

def q4():
    R = sqrt(3)
    # equilateral triangle side 3 inscribed in a circle: R = 3/sqrt3
    A = (R*cos(pi/2), R*sin(pi/2)); B = (R*cos(pi/2+2*pi/3), R*sin(pi/2+2*pi/3)); C = (R*cos(pi/2+4*pi/3), R*sin(pi/2+4*pi/3))
    side = math.dist(A, B); assert close(side, 3)
    vals = []
    for _ in range(200):
        t = random.uniform(0, 2*pi); P = (R*cos(t), R*sin(t))
        vals.append(math.dist(P, A)**2 + math.dist(P, B)**2 + math.dist(P, C)**2)
    ok = all(close(v, 18) for v in vals)
    report('Q4', 'PASS' if ok else 'FAIL', f'200 random P on circumcircle; range [{min(vals):.9f},{max(vals):.9f}]; key D=18')

def q5():
    p = sp.symbols('p')
    sol = sp.solve(sp.Eq(comb(20,7)*p**7*(1-p)**13, comb(20,8)*p**8*(1-p)**12), p)
    sol = [s for s in sol if s not in (0, 1) and s.is_real]
    ok = sol == [sp.Rational(8, 21)]
    report('Q5', 'PASS' if ok else 'FAIL', f'sympy solve P(X=7)=P(X=8) -> {sol}; key A=8/21')

def q6():
    # RK4 on y' = x - y from (0,-2), both directions
    def run(sign):
        x, y, h = 0.0, -2.0, 0.001*sign
        mn_slope, mx_ypp, ok = 1e9, -1e9, True
        f = lambda x, y: x - y
        for _ in range(30000):
            k1 = f(x, y); k2 = f(x+h/2, y+h*k1/2); k3 = f(x+h/2, y+h*k2/2); k4 = f(x+h, y+h*k3)
            y += h*(k1+2*k2+2*k3+k4)/6; x += h
            s = f(x, y); mn_slope = min(mn_slope, s); mx_ypp = max(mx_ypp, 1 - s)
        return mn_slope, mx_ypp
    # slope on x in [-30,30]; y'' = 1 - y'
    a = run(1); b = run(-1)
    min_slope = min(a[0], b[0]); max_ypp = max(a[1], b[1])
    f0 = 0 - (-2)
    # stationary pts would need slope 0; min slope >=1? and y'' < 0 everywhere
    nostat = min_slope > 0.0; down = max_ypp < 0.0
    # check A,B (turning point) false, C false (concave up), D true
    report('Q6', 'PASS' if (nostat and down) else 'FAIL', f'RK4 on x in [-30,30]: min y\'={min_slope:.4f}>0 (no stationary pt), max y\'\'={max_ypp:.4f}<0 (concave down) => D')

def q7():
    # exact piecewise-linear solve of asin(sin x)=x/5 plus dense numeric sign-change/near-tangent scan
    g = lambda x: math.asin(math.sin(x)) - x/5
    roots = set()
    for k in range(-20, 21):
        # on [k*pi - pi/2, k*pi + pi/2]: asin(sin x) = (-1)^k (x - k pi)  (derived by evaluating, not assumed)
        lo, hi = k*pi - pi/2, k*pi + pi/2
        s = (-1)**k
        # solve s*(x - k*pi) = x/5  -> x (s - 1/5) = s*k*pi
        x = s*k*pi/(s - 0.2)
        if lo - 1e-12 <= x <= hi + 1e-12:
            assert abs(g(x)) < 1e-9, (k, x, g(x))
            roots.add(round(x, 9))
    # independent scan: sign changes + local |g|min near zero
    n = 0; prev = g(-60); xs = [-60 + i*1e-3 for i in range(0, 120001)]
    vals = [g(x) for x in xs]
    sc = sum(1 for a, b in zip(vals, vals[1:]) if a*b < 0)
    touch = sum(1 for i in range(1, len(vals)-1) if abs(vals[i]) < 2e-4 and abs(vals[i]) <= abs(vals[i-1]) and abs(vals[i]) <= abs(vals[i+1]) and vals[i-1]*vals[i+1] > 0)
    report('Q7', 'PASS' if len(roots) == 5 else 'FAIL', f'exact segment solve gives {len(roots)} roots {sorted(round(r,4) for r in roots)}; grid scan sign-changes={sc}, tangent touches={touch}; key B=5')

def q8():
    mp.mp.dps = 30
    v = mp.quad(lambda x: x**2*mp.acos(x), [-1, 0, 1])
    report('Q8', 'PASS' if abs(v - mp.pi/3) < 1e-20 else 'FAIL', f'mpmath quad = {mp.nstr(v, 15)}; key C=pi/3={mp.nstr(mp.pi/3, 15)}')

def q9():
    mp.mp.dps = 30
    # loop for t in [0,pi]: x=sin t >=0 ; area by Green: 1/2 | int x dy - y dx |
    v = mp.quad(lambda t: (mp.sin(t)*2*mp.cos(2*t) - mp.sin(2*t)*mp.cos(t)), [0, mp.pi/2, mp.pi])/2
    # also numeric shoelace on sampled loop
    pts = [(math.sin(t), math.sin(2*t)) for t in [pi*i/20000 for i in range(20001)]]
    sh = abs(sum(x0*y1 - x1*y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:]+pts[:1])))/2
    ok = abs(abs(v) - mp.mpf(4)/3) < 1e-20 and abs(sh - 4/3) < 1e-6
    report('Q9', 'PASS' if ok else 'FAIL', f'Green integral={mp.nstr(abs(v),12)}, shoelace={sh:.9f}; key A=4/3 (right-hand loop x>=0, as shaded)')

def q10():
    best = 0
    for m in range(1 << 20):
        # bit i = integer i+1 chosen; diff 4 pair <=> bit i and bit i+4
        if m & (m >> 4): continue
        c = bin(m).count('1')
        if c > best: best = c
    ans = best + 1
    report('Q10', 'PASS' if ans == 13 else 'FAIL', f'exhaustive over 2^20 subsets: max diff-4-free subset={best}, so must choose {ans}; key C=13')

# ------------------------------------------------------------------ Q11
def cubic_roots(k):
    return sorted(mp.polyroots([1, -18, 104, -k], maxsteps=200, extraprec=100))

def q11a():
    mp.mp.dps = 40
    k, x = sp.symbols('k x', real=True)
    P = x**3 - 18*x**2 + 104*x - k
    disc = sp.discriminant(P, x)
    ends = sp.solve(disc, k)
    lo, hi = sorted(ends, key=lambda e: float(e))
    key_lo, key_hi = 192 - 16*sp.sqrt(3)/9, 192 + 16*sp.sqrt(3)/9
    ok_i = sp.simplify(lo - key_lo) == 0 and sp.simplify(hi - key_hi) == 0
    # sign of disc inside / outside, plus root count via numeric polyroots at probe values
    def nreal(kv): return sum(1 for r in mp.polyroots([1,-18,104,-kv], maxsteps=300, extraprec=200) if abs(mp.im(r)) < 1e-15)
    inside = all(nreal(kv) == 3 for kv in [float(key_lo)+1e-3, 192, float(key_hi)-1e-3])
    outside = all(nreal(kv) == 1 for kv in [float(key_lo)-1e-3, float(key_hi)+1e-3, 0, 400])
    report('Q11(a)(i)', 'PASS' if (ok_i and inside and outside) else 'FAIL',
           f'SymPy discriminant zeros = {lo},{hi}; numeric root count 3 inside/1 outside; key |k-192|<16sqrt3/9')
    # (ii) Heron vs 3 sqrt(207-k)
    errs = []
    for _ in range(30):
        kv = random.uniform(float(key_lo)+1e-3, float(key_hi)-1e-3)
        a, b, c = [float(r) for r in cubic_roots(kv)]
        s = (a+b+c)/2
        # triangle check
        assert a + b > c
        heron = math.sqrt(s*(s-a)*(s-b)*(s-c))
        errs.append(abs(heron - 3*math.sqrt(207-kv)))
    report('Q11(a)(ii)', 'PASS' if max(errs) < 1e-8 else 'FAIL', f'Heron on numeric roots for 30 random k vs 3*sqrt(207-k); max err {max(errs):.2e}')
    # (iii) right-angled: defect = a^2+b^2-c^2 (c largest); find k by root finding, scan whole range for all sign changes
    def defect(kv):
        a, b, c = [mp.mpf(r) for r in cubic_roots(kv)]
        return a*a + b*b - c*c
    L, H = float(key_lo)+1e-6, float(key_hi)-1e-6
    N = 400; ks = [L + (H-L)*i/N for i in range(N+1)]; ds = [defect(kv) for kv in ks]
    brackets = [(ks[i], ks[i+1]) for i in range(N) if ds[i]*ds[i+1] < 0]
    sols = [mp.findroot(defect, br, solver='bisect', tol=1e-25, maxsteps=200) for br in brackets] if brackets else []
    exact = 162*mp.sqrt(58) - 1044
    ok = len(sols) == 1 and abs(sols[0] - exact) < 1e-9
    report('Q11(a)(iii)', 'PASS' if ok else 'FAIL', f'scan of whole admissible range for a^2+b^2=c^2: {len(sols)} solution(s) {[mp.nstr(s,12) for s in sols]}; key 162sqrt58-1044={mp.nstr(exact,12)}')

def q11b():
    # (i) identity
    ok = all(math.prod(range(n+1, 2*n+1)) == 2**n*math.prod(range(1, 2*n, 2)) for n in range(1, 60))
    report('Q11(b)(i)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'identity n=1..59 (induction proof itself not machine-checked)')
    # (ii),(iii) enumerate pairings
    def pairings(items):
        if not items: yield []; return
        a = items[0]
        for i in range(1, len(items)):
            rest = items[1:i] + items[i+1:]
            for p in pairings(rest): yield [(a, items[i])] + p
    okc = True; okp = True; pn = {}
    for n in range(1, 6):
        allp = list(pairings(list(range(2*n))))   # rank 0 is best
        okc &= len(allp) == math.prod(range(1, 2*n, 2))
        good = sum(1 for p in allp if sorted(min(a, b) for a, b in p) == list(range(n)))
        pn[n] = Fraction(good, len(allp))
        okp &= pn[n] == Fraction(2**n*factorial(n)**2, factorial(2*n))
    report('Q11(b)(ii)', 'PASS' if okc else 'FAIL', 'brute-force enumeration of all pairings n=1..5 matches 1*3*...*(2n-1)')
    ineq = all(Fraction(2**n*factorial(n)**2, factorial(2*n)) <= Fraction(2, 3)**(n-1) for n in range(1, 80))
    report('Q11(b)(iii)', 'PASS' if (okp and ineq) else 'FAIL', f'enumerate pairings, winners = top n: p_n={ {n: str(v) for n, v in pn.items()} } = 2^n (n!)^2/(2n)! = n!/(2n-1)!!; inequality p_n<=(2/3)^(n-1) checked n=1..79')

# ------------------------------------------------------------------ Q12
def q12a():
    p = Fraction(3, 10); q = 1 - p
    ok = True
    for n in range(1, 8):
        # enumerate number of OTHER solvers j ~ Bin(n,p); Alice wins 1/(j+1) if she solves
        E = p*sum(comb(n, j)*p**j*q**(n-j)*Fraction(1, j+1) for j in range(n+1))
        # independent: enumerate all 2^(n+1) outcomes
        E2 = Fraction(0)
        for mask in range(1 << (n+1)):
            bits = [(mask >> i) & 1 for i in range(n+1)]   # bit0 = Alice
            if not bits[0]: continue
            pr = Fraction(1)
            for b in bits: pr *= p if b else q
            E2 += pr*Fraction(1, sum(bits))
        ok &= (E == E2 == (1 - q**(n+1))/(n+1))
    report('Q12(a)(i)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'exact Fraction enumeration of all 2^(n+1) outcomes, n=1..7, p=3/10')
    report('Q12(a)(ii)', 'CONSISTENT-WITH-GUIDELINE-ONLY', 'verbal explanation (symmetry/linearity); not a computed answer')
    ok = True
    for _ in range(400):
        n = random.randint(1, 30); pp = random.uniform(0.001, 0.999); qq = 1 - pp
        S = sum(comb(n, j)*pp**j*qq**(n-j)/(j+1) for j in range(n+1))
        ok &= S > 1/(1 + n*pp) and abs(S - (1 - qq**(n+1))/((n+1)*pp)) < 1e-9
    report('Q12(a)(iii)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'S computed as sum over binomial; S > 1/(1+np) for 400 random (n,p)')

def hull_perimeter(circles, N=40000):
    pts = [(cx + r*cos(2*pi*i/N), r*sin(2*pi*i/N)) for cx, r in circles for i in range(N)]
    pts = sorted(set(pts))
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    h = lower[:-1] + upper[:-1]
    return sum(math.dist(h[i], h[(i+1) % len(h)]) for i in range(len(h)))

def open_formula(R, r, d):
    return 2*sqrt(d*d - (R-r)**2) + pi*(R+r) + 2*(R-r)*asin((R-r)/d)

def tangent_belt(R, r, d, crossed):
    """Belt length from explicit tangent-line geometry (line n.x = s)."""
    nx = (R + r)/d if crossed else (R - r)/d
    th = acos(nx)
    ny = sin(th)
    n = (nx, ny)
    T1 = (R*nx, R*ny)
    s = R
    T2 = (d + (s - d*nx)*nx, (s - d*nx)*ny)
    straight = math.dist(T1, T2)
    if crossed: arc1, arc2 = 2*(pi - th)*R, 2*(pi - th)*r
    else: arc1, arc2 = 2*(pi - th)*R, 2*th*r
    return 2*straight + arc1 + arc2

def q12b():
    ok = True; worst = 0
    for _ in range(6):
        r = random.uniform(0.3, 2); R = r + random.uniform(0, 3); d = R + r + random.uniform(0.5, 4)
        h = hull_perimeter([(0, R), (d, r)])
        ex = open_formula(R, r, d)
        tg = tangent_belt(R, r, d, False)
        worst = max(worst, abs(h - ex), abs(tg - ex)); ok &= abs(h - ex) < 1e-6 and abs(tg - ex) < 1e-9
    report('Q12(b)(i)', 'PASS' if ok else 'FAIL', f'convex-hull perimeter of the two discs (40000-gon each) and explicit tangent geometry vs 2sqrt(d^2-(R-r)^2)+pi(R+r)+2(R-r)asin((R-r)/d); 6 random (R,r,d); max err {worst:.2e}')
    ok = True
    for _ in range(8):
        S = random.uniform(1, 5); d = S + random.uniform(0.5, 4)
        L1 = tangent_belt(S*0.7, S*0.3, d, True); L2 = tangent_belt(S*0.5, S*0.5, d, True)
        ex = 2*sqrt(d*d - S*S) + S*(pi + 2*asin(S/d))
        ok &= abs(L1 - L2) < 1e-9 and abs(L1 - ex) < 1e-9
    report('Q12(b)(ii)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'crossed belt via explicit inner-tangent geometry: same length for different (R,r) with equal R+r')
    # (iii)
    c, d = 1.5, 4.0
    L = lambda u: open_formula(c+u, c-u, d)
    mono = all(L(u1) < L(u2) for u1, u2 in zip([i/100 for i in range(0, 149)], [i/100 for i in range(1, 150)]))
    deriv_ok = all(abs((L(u+1e-6) - L(u-1e-6))/2e-6 - 4*asin(2*u/d)) < 1e-6 for u in [0.2, 0.5, 0.9, 1.2])
    hull_diff = hull_perimeter([(0, c+1), (d, c-1)]) - hull_perimeter([(0, c), (d, c)])
    exact = 4*sqrt(3) + 2*pi/3 - 8
    ok = mono and deriv_ok and abs(hull_diff - exact) < 1e-6 and abs(L(1) - L(0) - exact) < 1e-12
    report('Q12(b)(iii)', 'PASS' if ok else 'FAIL', f'L increasing on [0,1.5), dL/du=4asin(2u/d) numerically, convex-hull difference (u=1 minus u=0, d=4, c=1.5)={hull_diff:.9f}; key 4sqrt3+2pi/3-8={exact:.9f}')

# ------------------------------------------------------------------ Q13
def rk_hit_zero(x0, h, tmax=200.0, dt=1e-4):
    f = lambda x: x*(1 - x) - h
    x, t = x0, 0.0
    while t < tmax:
        k1 = f(x); k2 = f(x + dt*k1/2); k3 = f(x + dt*k2/2); k4 = f(x + dt*k3)
        xn = x + dt*(k1 + 2*k2 + 2*k3 + k4)/6
        if xn <= 0:
            # linear interpolation for crossing
            return t + dt*x/(x - xn)
        x, t = xn, t + dt
    return None

def q13a():
    T = rk_hit_zero(0.25, 0.25, tmax=10)
    big = [rk_hit_zero(x0, 0.25, tmax=60, dt=1e-3) for x0 in (0.51, 0.6, 1.0, 5.0)]
    ok = T is not None and abs(T - 2) < 1e-4 and all(b is None for b in big)
    report('Q13(a)(i)', 'PASS' if ok else 'FAIL', f'RK4 of dx/dt=x(1-x)-1/4 from x=1/4: hits 0 at t={T:.6f}; x0 in {{0.51,0.6,1,5}} never wiped out to t=60; key t=2')
    # (ii)
    ok = True; worst = 0
    for _ in range(10):
        h = 0.25 + random.uniform(0.01, 2); a = sqrt(h - 0.25); x0 = random.uniform(0.05, 6)
        Tn = rk_hit_zero(x0, h, tmax=100, dt=2e-4)
        Tf = (atan((2*x0 - 1)/(2*a)) + atan(1/(2*a)))/a
        worst = max(worst, abs(Tn - Tf)); ok &= abs(Tn - Tf) < 2e-4 and Tf < pi/a
    big_ok = all(((atan((2*x0 - 1)/(2*0.37)) + atan(1/(2*0.37)))/0.37) < pi/0.37 for x0 in (1e3, 1e6, 1e9))
    report('Q13(a)(ii)', 'PASS' if (ok and big_ok) else 'FAIL', f'RK4 wipe-out time vs T=(1/a)[atan((2x0-1)/2a)+atan(1/2a)] for 10 random (h,x0); max err {worst:.1e}; T<pi/a also for huge x0')
    # (iii)
    ok = True
    for a in (1e-2, 1e-3, 1e-5):
        Tf = (atan(-1/(4*a)*-1*(-1)) if False else (atan((2*0.25 - 1)/(2*a)) + atan(1/(2*a))))/a
        ok &= abs(Tf - 2) < 40*a
    Tcalc = [((atan((2*0.25-1)/(2*a)) + atan(1/(2*a)))/a) for a in (1e-2, 1e-3, 1e-5)]
    report('Q13(a)(iii)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', f'T(x0=1/4) for a=1e-2,1e-3,1e-5: {[round(v,8) for v in Tcalc]} -> 2')

def q13b():
    mp.mp.dps = 25
    k, c = mp.mpf('1.7'), mp.mpf('0.3')
    # (ii) vessel y = (pi c/k)^2 x^4 -> x(y)^2 = k sqrt(y)/(pi c)
    xsq = lambda y: k*mp.sqrt(y)/(mp.pi*c)
    V = lambda h: mp.pi*mp.quad(xsq, [0, h])
    ok = True
    for h in (0.2, 1.0, 3.7):
        dVdh = mp.diff(V, h)
        ok &= abs(dVdh - mp.pi*xsq(h)) < 1e-12             # (i): dV/dh = pi x^2
        dhdt = -k*mp.sqrt(h)/dVdh                           # volume decreases at k sqrt(h)
        ok &= abs(dhdt + c) < 1e-12                         # constant rate c
    report('Q13(b)(i)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'dV/dh = pi x^2 by numeric differentiation of a quadrature volume (vessel y=pi^2c^2x^4/k^2)')
    report('Q13(b)(ii)', 'PASS' if ok else 'FAIL', 'build vessel x(y)^2=k sqrt(y)/(pi c) (i.e. y=pi^2 c^2 x^4/k^2), numerically get dh/dt=-k sqrt(h)/V\'(h) = -c at h=0.2,1,3.7')
    # (iii) dh/dt=-h ln2 -> x^4 y const; volume bound
    lam = mp.log(2)
    C = k**2/(mp.pi**2*lam**2)
    xsq3 = lambda y: k/(mp.pi*lam*mp.sqrt(y))
    # check halving: dh/dt = -k sqrt(h)/(pi x^2) = -lam h ; solve ODE numerically and check h(1)=h0/2
    h0 = mp.mpf(2)
    sol = mp.odefun(lambda t, h: -k*mp.sqrt(h)/(mp.pi*xsq3(h)), 0, h0)
    halves = abs(sol(1) - h0/2) < 1e-10 and abs(sol(3) - h0/8) < 1e-9
    const = all(abs((xsq3(y))**2*y - C) < 1e-12 for y in (0.01, 0.5, 4))
    Hh = 2
    bounded = all(mp.pi*mp.quad(xsq3, [e, Hh]) < 2*k*mp.sqrt(Hh)/lam for e in (mp.mpf('1e-2'), mp.mpf('1e-8'), mp.mpf('1e-15')))
    report('Q13(b)(iii)', 'CHECKED-NUMERICALLY' if (halves and const and bounded) else 'FAIL', 'curve x^4 y = k^2/(pi ln2)^2 gives h halving each minute (ODE solve); volume integral < 2k sqrt(H)/ln2 for eps=1e-2,1e-8,1e-15')

# ------------------------------------------------------------------ Q14
def q14a():
    ok = True; ok3 = True; okiv = True; worst = 0
    for _ in range(40):
        g = random.uniform(5, 12); V = random.uniform(5, 40); th = random.uniform(0.2, 1.4)
        Tf = 2*V*sin(th)/g; OA = V*cos(th)*Tf
        t = random.uniform(0.01, 0.99)*Tf
        P = (V*t*cos(th), V*t*sin(th) - 0.5*g*t*t)
        tphi = P[1]/P[0]; tpsi = P[1]/(OA - P[0])
        ok &= abs(tphi - (tan(th) - g*t/(2*V*cos(th)))) < 1e-9
        ok &= abs(tphi + tpsi - tan(th)) < 1e-9
        # (iii) rate of turning: numeric derivative of phi(t) and psi(t)
        ph = lambda tt: atan((V*tt*sin(th) - 0.5*g*tt*tt)/(V*tt*cos(th)))
        ps = lambda tt: atan((V*tt*sin(th) - 0.5*g*tt*tt)/(OA - V*tt*cos(th)))
        e = 1e-6
        dph = (ph(t+e) - ph(t-e))/(2*e); dps = (ps(t+e) - ps(t-e))/(2*e)
        phi = ph(t)
        ok3 &= abs(-dph - g*cos(phi)**2/(2*V*cos(th))) < 1e-5
    # equal rates only at t=T/2: scan
    th = 1.2; g, V = 9.8, 20.0; Tf = 2*V*sin(th)/g; OA = V*cos(th)*Tf
    ph = lambda tt: atan((V*tt*sin(th) - 0.5*g*tt*tt)/(V*tt*cos(th)))
    ps = lambda tt: atan((V*tt*sin(th) - 0.5*g*tt*tt)/(OA - V*tt*cos(th)))
    diffs = []
    ts = [Tf*i/2000 for i in range(1, 2000)]
    for tt in ts:
        e = 1e-7; diffs.append((-(ph(tt+e) - ph(tt-e)) - (ps(tt+e) - ps(tt-e)))/(2*e))
    zc = [ts[i] for i in range(len(ts)-1) if diffs[i]*diffs[i+1] <= 0]
    ok3 &= len(zc) == 1 and abs(zc[0] - Tf/2) < Tf/1000
    report('Q14(a)(i)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'tan(phi)=y/x vs formula at 40 random (g,V,theta,t)')
    report('Q14(a)(ii)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'tan(phi)+tan(psi)=tan(theta) at 40 random parameter sets')
    report('Q14(a)(iii)', 'PASS' if ok3 else 'FAIL', 'numeric d(phi)/dt = -g cos^2(phi)/(2V cos theta) at 40 random points; rates equal only at t=T/2 (one zero crossing of rate difference over (0,T))')
    # (iv) brute force: duration for which angle OPA acute
    worst = 0
    for _ in range(25):
        g = random.uniform(5, 12); V = random.uniform(5, 40)
        th = random.uniform(atan(2) + 0.02, 1.5)
        Tf = 2*V*sin(th)/g; OA = V*cos(th)*Tf
        def acute_margin(t):
            P = (V*t*cos(th), V*t*sin(th) - 0.5*g*t*t)
            a = (-P[0], -P[1]); b = (OA - P[0], -P[1])
            return a[0]*b[0] + a[1]*b[1]       # >0 <=> angle OPA acute
        N = 400000
        ts = [Tf*i/N for i in range(1, N)]
        # bisection-refine each sign change
        sgn = [acute_margin(t) > 0 for t in ts]
        edges = []
        for i in range(len(ts)-1):
            if sgn[i] != sgn[i+1]:
                lo, hi = ts[i], ts[i+1]
                for _ in range(60):
                    mid = (lo+hi)/2
                    if (acute_margin(mid) > 0) == sgn[i]: lo = mid
                    else: hi = mid
                edges.append(lo)
        dur = (edges[1] - edges[0]) if len(edges) == 2 else float('nan')
        key = 2*V/g*sqrt(1 - 5*cos(th)**2)
        worst = max(worst, abs(dur - key))
        okiv &= len(edges) == 2 and abs(dur - key) < 1e-8
    report('Q14(a)(iv)', 'PASS' if okiv else 'FAIL', f'dot-product sign scan + bisection of angle OPA acute interval for 25 random (g,V,theta) with tan(theta)>2; vs (2V/g)sqrt(1-5cos^2 theta); max err {worst:.1e}')

def q14b():
    mp.mp.dps = 30
    ok = True
    for m in (2, 3, 4, 7):
        n = 2*m - 1
        M = lambda p: sum(comb(n, j)*p**j*(1-p)**(n-j) for j in range(m, n+1))
        for p in (mp.mpf('0.13'), mp.mpf('0.5'), mp.mpf('0.77')):
            ok &= abs(mp.diff(M, p) - (2*m-1)*comb(2*m-2, m-1)*p**(m-1)*(1-p)**(m-1)) < 1e-18
    report('Q14(b)(i)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'M\'(p) by numeric differentiation of the majority-vote sum, m=2,3,4,7')
    ok = True
    for m in range(2, 12):
        v = mp.quad(lambda x: x**(m-1)*(1-x)**(m-1), [0, 1])
        ok &= abs(v - mp.mpf(1)/((2*m-1)*comb(2*m-2, m-1))) < 1e-25
    report('Q14(b)(ii)', 'PASS' if ok else 'FAIL', 'mpmath quad of x^(m-1)(1-x)^(m-1) on [0,1] vs 1/((2m-1)C(2m-2,m-1)), m=2..11')
    ok = True
    for m in range(2, 15):
        n = 2*m - 1
        for i in range(1, 400):
            p = i/400
            if p > 0.5: ok &= sum(comb(n, j)*p**j*(1-p)**(n-j) for j in range(m, n+1)) > p
    report('Q14(b)(iii)', 'CHECKED-NUMERICALLY' if ok else 'FAIL', 'M(p)>p for p in (1/2,1) grid, m=2..14 (proof not machine-checked)')

def main():
    for f in (q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q12a, q12b, q13a, q13b, q14a, q14b):
        try: f()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(f.__name__, 'FAIL', f'exception {e!r}')
    bad = [i for i, s in RESULTS if s == 'FAIL']
    print('\nSUMMARY:', 'ALL OK' if not bad else f'FAILURES: {bad}')

if __name__ == '__main__':
    main()
