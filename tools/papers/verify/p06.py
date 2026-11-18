#!/usr/bin/env python3
"""Independent computational verification of the answer keys and MCQ keys of Practice Paper 06
(Prithagoras HSC Mathematics Extension 1, 2027). Every item is computed from the question statement;
nothing is checked by evaluating the guideline's own final formula. Run: /tmp/symenv/bin/python tools/papers/verify/p06.py
Exit 1 on any FAIL, unchecked keyed id, or DISAGREE not listed in KNOWN_DISAGREEMENTS."""
NN = "06"
# ---- shared harness (copied into each verify script) ----
import json, os, re, sys, math, itertools, random
from fractions import Fraction as Fr
import sympy as sp
import mpmath as mp
mp.mp.dps = 30
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OVR = json.load(open(os.path.join(ROOT, 'tools/papers/overrides/ext1-2027-p%s.json' % NN)))['keys']
STR = json.load(open(os.path.join(ROOT, 'server/content/papers/nsw-ext1/structured/ext1-2027-p%s.json' % NN)))
FIGS_TEX = "/Users/priysharantripathi/Desktop/Tuitions/Papers/EXT 1/Prithagoras - rebuilt 2026-11-18/LaTeX sources/work/Paper %s/LaTeX/E1-%s_figs.tex" % (NN, NN)
GUIDE_MCQ = {}
for _s in STR['sections']:
    for _q in _s['questions']:
        for _p in _q['parts']:
            if (_p.get('key') or {}).get('type') == 'mcq':
                GUIDE_MCQ[_p['id']] = _p['key']['answer']
RES = []          # (id, status)
CHECKED = set()
def report(item, status, method):
    RES.append((item, status)); print(f"{item} {status} ({method})", flush=True)
def close(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))
def mcq(item, letter, method):
    g = GUIDE_MCQ[item]
    if letter == g:
        report(item, 'PASS', f"computed {letter} = guideline {g}; {method}")
    else:
        report(item, 'DISAGREE', f"computed {letter} but guideline {g}; {method}")
def part(item, ok, method, keyed=True):
    if keyed: CHECKED.add(item)
    report(item, 'PASS' if ok else 'FAIL', method)
def unverified(item, why): report(item, 'UNVERIFIED', why)
def kexpr(item, syms):
    """sympy expression of the key's expr (engine syntax) for the override file"""
    s = OVR[item]['key']['expr'].replace('^', '**')
    loc = {k: sp.Symbol(k) for k in syms}
    loc.update({'ln': sp.log, 'pi': sp.pi, 'e': sp.E, 'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan,
                'sqrt': sp.sqrt, 'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan, 'nCr': sp.binomial})
    return sp.sympify(s, locals=loc)
def figpoly(name):
    """points of the 1.3pt curve of a TikZ figure macro in the paper's _figs.tex"""
    t = open(FIGS_TEX).read()
    i = t.index('\\newcommand{\\%s}' % name)
    j = t.find('\\newcommand', i + 10)
    blk = t[i: j if j > 0 else len(t)]
    m = re.search(r'line width=1\.3pt\]((?: ?\([-\d.]+,[-\d.]+\) ?(?:--)?)+)', blk)
    return [(float(a), float(b)) for a, b in re.findall(r'\(([-\d.]+),([-\d.]+)\)', m.group(1))]
def finish(known):
    CHECKED_ALL = set(OVR.keys())
    missing = sorted(CHECKED_ALL - CHECKED)
    nk = sum(1 for i, s in RES if s == 'PASS' and i in OVR)
    nm = sum(1 for i, s in RES if s == 'PASS' and i in GUIDE_MCQ)
    nd = sum(1 for i, s in RES if s == 'DISAGREE' and i in GUIDE_MCQ)
    nu = sum(1 for i, s in RES if s == 'UNVERIFIED')
    bad = [i for i, s in RES if s == 'FAIL']
    unk = [i for i, s in RES if s == 'DISAGREE' and i not in known]
    # a DISAGREE on a keyed part means the key must not be shipped
    shipped_dis = [i for i, s in RES if s == 'DISAGREE' and i in OVR]
    kd = [i for i, s_ in RES if s_ == 'DISAGREE' and i in known]
    if kd: print('KNOWN DISAGREEMENTS (author guideline differs from computation; no key shipped):', kd)
    if missing: print('KEYED IDS WITHOUT A CHECK:', missing)
    if unk: print('DISAGREE NOT IN KNOWN_DISAGREEMENTS:', unk)
    if shipped_dis: print('DISAGREE ON A SHIPPED KEY:', shipped_dis)
    print(f"PAPER {NN}: {nk} keyed parts PASS, {nm} MCQ PASS, {nd} MCQ DISAGREE, {nu} UNVERIFIED")
    sys.exit(1 if (bad or missing or unk or shipped_dis) else 0)
KNOWN_DISAGREEMENTS = set()

def q1():
    counts = set()
    for k in (0.05, 0.3, 0.5, 0.8, 0.95, 0.999):
        f = lambda x: mp.atan(x) - k*x
        X = mp.pi/(2*k) + 1; N = 40000
        xs = [-X + 2*X*i/N for i in range(N+1)]
        roots = set()
        for u, v in zip(xs, xs[1:]):
            if f(u) == 0: roots.add(round(float(u), 9))
            elif f(u)*f(v) < 0: roots.add(round(float(mp.findroot(f, (u+v)/2)), 9))
        roots = {r for r in roots}
        # x=0 is hit by sign change or exact zero; deduplicate near-zero roots
        z = {r for r in roots if abs(r) < 1e-6}; roots = (roots - z) | ({0.0} if z else set())
        counts.add(len(roots))
    mcq('q1', {1:'A',2:'B',3:'C',5:'D'}.get(counts.pop() if len(counts) == 1 else -1, '?'), f"sign-change scan of atan x - kx for k in {{0.05..0.999}}: root count identical for all k")

def q2():
    from functools import lru_cache
    W = 6
    @lru_cache(None)
    def go(mask_top, mask_bot, col):   # fill column by column; masks = cells of this column already covered
        if col == W: return 1 if (mask_top == 0 and mask_bot == 0) else 0
        t, b = mask_top, mask_bot; n = 0
        # options for the two cells of this column
        if t and b: return go(0, 0, col+1)
        if not t and not b:
            n += go(0, 0, col+1) if True else 0                      # vertical domino
            n += go(1, 1, col+1)                                       # two horizontals
            return n
        return 0
    # the above transfer count: vertical domino covers both cells (no spill), two horizontals spill into next column
    @lru_cache(None)
    def ways(col, spill):
        if col == W: return 1 if not spill else 0
        if spill: return ways(col+1, False)
        return ways(col+1, False) + (ways(col+1, True) if col+1 < W else 0)
    # independent brute force: backtracking tiling of the 2x6 board
    cells = [(r, c) for c in range(W) for r in range(2)]
    def tile(free):
        if not free: return 1
        r, c = min(free, key=lambda x: (x[1], x[0]))
        n = 0
        for dr, dc in ((1, 0), (0, 1)):
            q = (r+dr, c+dc)
            if q in free: n += tile(free - {(r, c), q})
        return n
    n = tile(frozenset(cells))
    mcq('q2', {8:'A',13:'B',21:'C',32:'D'}.get(n, '?'), f"backtracking tiling count of the 2x6 board: {n}")

def q3():
    x = sp.Symbol('x')
    P = sp.interpolate([(0, 29), (1, 5), (2, 5), (3, 5), (4, 5)], x)
    v = P.subs(x, 5)
    mcq('q3', {5:'A',24:'B',53:'C',29:'D'}.get(int(v), '?'), f"unique degree-4 interpolant through the five given values: P(5) = {v}, degree {sp.degree(P, x)}")

def q4():
    cosang = lambda u, v: (u[0]*v[0] + u[1]*v[1])/(math.hypot(*u)*math.hypot(*v))
    opts = {'A': (2, 1), 'B': (1, 2), 'C': (4, 4), 'D': (1, -2)}
    L = [c for c, v in opts.items() if abs(cosang(v, (1, 0)) - cosang(v, (3, 4))) < 1e-12]
    mcq('q4', L[0] if len(L) == 1 else '?', "cosines of the angles with i and with 3i+4j compared for each option")

def q5():
    t, c, r0 = sp.symbols('t c r0', positive=True); r = sp.Function('r')
    V = lambda rr: sp.Rational(4, 3)*sp.pi*rr**3; S = lambda rr: 4*sp.pi*rr**2
    rt = sp.Function('r')(t)
    sol = sp.dsolve(sp.Eq(sp.diff(V(rt), t), -c*S(rt)), rt, ics={rt.subs(t, 0): r0}).rhs
    csol = sp.solve(sp.Eq(V(sol.subs(t, 1)), V(r0)/8), c)
    tm = [sp.solve(sp.Eq(sol.subs(c, cs), 0), t) for cs in csol]
    rem = [x[0] - 1 for x in tm]
    mcq('q5', {sp.Rational(1, 7): 'A', 1: 'B', 2: 'C'}.get(sp.simplify(rem[0]), '?') if len(rem) == 1 else '?', f"dsolve r(t)={sol}; V(1)=V0/8 fixes c={csol}; melts completely at t={tm}, i.e. {rem} hour longer")

def q6():
    n = sum(1 for m in range(1000, 10000) if all(a < b for a, b in zip(str(m), str(m)[1:])))
    mcq('q6', {3024:'A',210:'B',84:'C',126:'D'}.get(n, '?'), f"direct count over 1000..9999: {n}")

def q7():
    f = lambda x: mp.sin(x) + mp.sin(x + 2*mp.pi/3)
    vals = [f(2*mp.pi*i/100000) for i in range(100001)]
    lo, hi = min(vals), max(vals)
    opts = {'A': (-1, 1), 'B': (-math.sqrt(3), math.sqrt(3)), 'C': (-2, 2), 'D': (-1.5, 1.5)}
    L = [c for c, (a, b) in opts.items() if abs(lo - a) < 1e-8 and abs(hi - b) < 1e-8]
    mcq('q7', L[0] if len(L) == 1 else '?', f"dense sampling of f over one period: min {mp.nstr(lo, 10)}, max {mp.nstr(hi, 10)}")

def q8():
    n, p = 100, Fr(1, 3)
    pm = [Fr(math.comb(n, k))*p**k*(1-p)**(n-k) for k in range(n+1)]
    m = max(pm); modes = [k for k in range(n+1) if pm[k] == m]
    mcq('q8', {(32,): 'A', (34,): 'B', (33,): 'C', (33, 34): 'D'}.get(tuple(modes), '?'), f"exact binomial pmf n=100, p=1/3: maximum at k={modes}")

def q9():
    sq = [(0, 0), (1, 1), (2, 0), (1, -1)]
    def clip_area(t):                                   # area of the square to the left of x=t (Sutherland-Hodgman, exact floats)
        out = []
        for i in range(4):
            a, b = sq[i], sq[(i+1) % 4]
            ina, inb = a[0] <= t, b[0] <= t
            if ina: out.append(a)
            if ina != inb:
                s = (t - a[0])/(b[0] - a[0]); out.append((t, a[1] + s*(b[1]-a[1])))
        return abs(sum(out[i][0]*out[(i+1) % len(out)][1] - out[(i+1) % len(out)][0]*out[i][1] for i in range(len(out))))/2 if len(out) > 2 else 0.0
    errs = {}
    for L in 'ABCD':
        P = figpoly('figsw' + L)
        errs[L] = max(abs(y/1.25 - clip_area(x/1.9)) for x, y in P)
    good = [k for k, e in errs.items() if e < 0.03]
    mcq('q9', good[0] if len(good) == 1 else '?', "area of the square (vertices (0,0),(1,1),(2,0),(1,-1)) left of x=t by polygon clipping vs each plotted curve (t: 1.9 per unit, A: 1.25 per unit): max errors " + ', '.join(f"{k}:{v:.3f}" for k, v in errs.items()))

def q10():
    x = sp.Symbol('x'); y = sp.Function('y')
    sol = sp.dsolve(sp.Eq(y(x).diff(x), y(x)**2 - y(x)), y(x), ics={y(0): sp.Rational(1, 2)}).rhs
    lim = sp.limit(sol, x, sp.oo)
    mcq('q10', {sp.Rational(1, 2): 'A', 0: 'B', 1: 'C', sp.oo: 'D'}.get(lim, '?'), f"dsolve y={sol}; limit as x->oo = {lim}")

# ------------------------------------------------------------- keyed parts
def q11a():
    x = sp.Symbol('x'); r = sp.Poly(x**3 - x - 1, x).nroots(n=30)
    s = sum((1 + z)/(1 - z) for z in r)
    ok = abs(sp.im(s)) < 1e-25 and abs(sp.re(s) - OVR['q11a']['key']['value']) < 1e-20
    part('q11a', ok, f"numerical zeros of x^3-x-1 (30 digits), sum of (1+z)/(1-z) = {sp.N(s, 20)}")

def q11c():
    v = mp.quad(lambda x: mp.sqrt(x/(1-x)), [0, mp.mpf(1)/2])
    part('q11c', abs(v - OVR['q11c']['key']['value']) < 1e-15, f"mpmath quad = {mp.nstr(v, 20)} = pi/4 - 1/2")

def q11d():
    # exact: simulate the stated process over every coin outcome for three rounds (32^3 sequences, stop at first odd one out)
    odd = lambda o: sum(o) in (1, 4)                       # exactly one head or exactly one tail among five coins
    outs = list(itertools.product((0, 1), repeat=5))
    found = Fr(0)
    # round-by-round: probability mass still 'searching' after each round
    mass = Fr(1)
    for _ in range(3):
        k = sum(1 for o in outs if odd(o)); found += mass*Fr(k, 32); mass *= Fr(32 - k, 32)
    key = OVR['q11d']['key']; ok = found == Fr(int(key['n']), int(key['d']))
    part('q11d', ok, f"enumerate the 32 outcomes of a round (odd one out: {sum(1 for o in outs if odd(o))}), exact probability over the first 3 rounds = {found}")

def q11e():
    f = lambda x: mp.atan(x) + mp.atan((1 - x)/(1 + x))
    xs = [-50 + i*0.37 + 0.011 for i in range(280)]
    xs = [x for x in xs if abs(x + 1) > 1e-3] + [mp.mpf(s) for s in ('-1.0001', '-0.9999', '1e6', '-1e6', '0')]
    vals = sorted({round(float(f(mp.mpf(x))), 9) for x in xs})
    key = sorted(OVR['q11e']['key']['values'])
    ok = len(vals) == 2 and len(key) == 2 and all(abs(a - b) < 1e-8 for a, b in zip(vals, key))
    part('q11e', ok, f"evaluate f over 285 values of x (both sides of -1, large |x|): distinct values {vals}")

def q12a():
    # place A, B, C with AB=7, AC=9, BC=8 by coordinates and measure the median
    A = sp.Matrix([0, 0]); B = sp.Matrix([7, 0]); cx = sp.Rational(7**2 + 9**2 - 8**2, 2*7); C = sp.Matrix([cx, sp.sqrt(81 - cx**2)])
    assert sp.simplify((C - B).dot(C - B)) == 64
    M = (B + C)/2; am = sp.sqrt((M - A).dot(M - A))
    part('q12a', sp.simplify(am - OVR['q12a']['key']['value']) == 0, f"coordinates A=(0,0), B=(7,0), C from AC=9, BC=8; |AM| = {am}")

def q12b():
    # candidate curve must be orthogonal to every parabola y=cx^2 it meets, and pass through (2,1); integrate the orthogonal-trajectory ODE numerically
    ode = lambda x, y: -x/(2*y)                          # curve gradient = -1/(parabola gradient 2y/x)
    fw = mp.odefun(ode, 2, 1)                                    # forward in x from (2,1)
    bw = mp.odefun(lambda t, z: (2 - t)/(2*z), 0, 1)             # z(t)=y(2-t): backward in x
    f = lambda x: fw(x) if x >= 2 else bw(2 - x)
    lhs = OVR['q12b']['key']['lhs']; rhs = OVR['q12b']['key']['rhs']
    L = sp.sympify(lhs.replace('^', '**')); R = sp.sympify(rhs.replace('^', '**'))
    X, Y = sp.symbols('x y'); ok = True
    for xv in (2.0, 2.2, 2.4, 1.5, 1.0, 0.5):
        yv = f(mp.mpf(xv))
        ok &= abs(float(L.subs({X: xv, Y: yv}) - R)) < 1e-12
    # orthogonality of the key curve itself at sample points: slope(curve)*slope(parabola) = -1
    for xv in (0.7, 1.3, 2.0):
        yv = math.sqrt((6 - xv*xv)/2); mc = -xv/(2*yv); mpar = 2*yv/xv
        ok &= abs(mc*mpar + 1) < 1e-12
    ok &= lhs.replace(' ', '') in ('x^2+2*y^2', '2*y^2+x^2') and rhs.strip() == '6'
    part('q12b', ok, "Taylor ODE solve of dy/dx = -x/(2y) from (2,1) (the gradient perpendicular to y=cx^2 at each point) satisfies x^2+2y^2=6 at 6 x-values to 1e-12; slope product -1 checked on the curve")

def q12c_ii():
    n, p = sp.symbols('n p'); ke = kexpr('q12c-ii', ['n', 'p']); ok = True
    for N in range(1, 8):
        for pv in (Fr(3, 5), Fr(7, 10)):
            pr = Fr(0)
            for seq in itertools.product((0, 1), repeat=N):            # 1 = win
                money = Fr(1)
                for w in seq: money = money*2 if w else Fr(0)           # f = 1: win doubles the holding, a loss forfeits all of it
                if money > 0:
                    w = sum(seq); pr += pv**w*(1-pv)**(N-w)
            ok &= sp.Rational(pr.numerator, pr.denominator) == ke.subs({'n': N, 'p': sp.Rational(pv.numerator, pv.denominator)})
    part('q12c-ii', ok, "exact enumeration of all win/loss sequences with stake f=1, n=1..7, p=3/5, 7/10: P(money > 0) equals the key")

def q12c_iii():
    ke = kexpr('q12c-iii', ['p']); ok = True
    for pv in (0.55, 0.6, 0.75, 0.9):
        n = 100; pn = pv*n
        g = lambda f: pn*mp.log(1 + f) + (n - pn)*mp.log(1 - f)       # log of the amount held after pn wins and n-pn losses
        lo, hi = mp.mpf('1e-9'), 1 - mp.mpf('1e-9'); gr = (mp.sqrt(5)-1)/2
        c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        for _ in range(150):
            if g(c) > g(d): hi = d
            else: lo = c
            c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        ok &= abs((lo+hi)/2 - mp.mpf(sp.N(ke.subs('p', sp.Float(str(pv), 30)), 30))) < 1e-9
    part('q12c-iii', ok, "golden-section maximisation of (1+f)^(pn)(1-f)^((1-p)n) over 0<f<1, n=100, p in {0.55,0.6,0.75,0.9}; maximiser equals the key to 1e-9")

def _dose(Dv, k, T, n, D1=None):
    A = 0.0; hist = []
    for i in range(n):
        A += (D1 if (i == 0 and D1 is not None) else Dv)
        hist.append(('after', A)); A *= math.exp(-k*T); hist.append(('before', A))
    return hist

def q13a_ii():
    ke = kexpr('q13a-ii', ['D', 'r']); ok = True
    for Dv, k, T in [(1, 0.3, 2), (5, 0.1, 1), (2, 0.8, 0.5)]:
        # step the stated model: decay A' = -kA over each interval (RK4 on the ODE itself), then a dose
        A = 0.0
        for _ in range(400):
            A += Dv
            for _s in range(200):
                h = T/200; f = lambda a: -k*a
                k1 = f(A); k2 = f(A + h*k1/2); k3 = f(A + h*k2/2); k4 = f(A + h*k3); A += h*(k1 + 2*k2 + 2*k3 + k4)/6
        r = math.exp(-k*T)
        ok &= abs(A - float(ke.subs({'D': Dv, 'r': r}))) < 1e-8*max(1, A)
    part('q13a-ii', ok, "RK4 integration of dA/dt=-kA between doses over 400 doses, 3 (D,k,T): amount just before the next dose settles at the key value (1e-8)")

def q13a_iii():
    ke = kexpr('q13a-iii', ['D', 'r']); ok = True
    for Dv, k, T in [(1, 0.3, 2), (5, 0.1, 1), (2, 0.8, 0.5)]:
        r = math.exp(-k*T); D1 = float(ke.subs({'D': Dv, 'r': r}))
        A = 0.0; afters = []
        for i in range(30):
            A += (D1 if i == 0 else Dv)
            afters.append(A)
            for _s in range(200):
                h = T/200; f = lambda a: -k*a
                k1 = f(A); k2 = f(A + h*k1/2); k3 = f(A + h*k2/2); k4 = f(A + h*k3); A += h*(k1 + 2*k2 + 2*k3 + k4)/6
        ok &= max(abs(a - afters[0]) for a in afters) < 1e-8*afters[0]
    part('q13a-iii', ok, "RK4 simulation with first dose D/(1-r) and later doses D, 30 doses, 3 parameter sets: the amount just after every dose is constant to 1e-8")

def _shadow(d, H, g):
    def s(t):                         # intersection with the ground of the line from the lamp (0,H) through the ball (d, H - g t^2/2)
        yb = H - g*t*t/2
        lam = H/(H - yb)              # parameter where height reaches 0 along lamp->ball
        return d*lam
    return s

def q13b_ii():
    ke = kexpr('q13b-ii', ['d', 'g', 'H']); ok = True
    for d, H, g in [(1, 3, 9.8), (2, 5, 10), (0.5, 1.2, 9.8)]:
        s = _shadow(mp.mpf(d), mp.mpf(H), mp.mpf(g)); t = mp.sqrt(2*mp.mpf(H)/g)
        sp_ = abs(mp.diff(s, t))
        ok &= abs(sp_ - mp.mpf(sp.N(ke.subs({'d': d, 'g': g, 'H': H}), 30))) < 1e-8
    part('q13b-ii', ok, "shadow position from the lamp-ball line meeting the ground; |ds/dt| at the landing time t=sqrt(2H/g), 3 parameter sets, equals the key to 1e-8")

def q13b_iii():
    ke = kexpr('q13b-iii', ['d', 'H']); ok = True
    for d, H, g in [(1, 3, 9.8), (2, 5, 10), (0.5, 1.2, 9.8)]:
        d, H, g = mp.mpf(d), mp.mpf(H), mp.mpf(g)
        s = _shadow(d, H, g); tl = mp.sqrt(2*H/g)
        h = lambda t: abs(mp.diff(s, t)) - g*t                       # shadow speed minus ball speed g t
        ts = [tl*i/2000 for i in range(1, 2001)]
        cross = [(u, v) for u, v in zip(ts, ts[1:]) if h(u)*h(v) < 0]
        assert len(cross) == 1
        t0 = mp.findroot(h, sum(cross[0])/2)
        ok &= abs(s(t0) - mp.mpf(sp.N(ke.subs({'d': sp.Float(str(d), 30), 'H': sp.Float(str(H), 30)}), 30))) < 1e-8
    part('q13b-iii', ok, "speeds |ds/dt| and g t of shadow and ball set equal (root found once before landing), shadow distance equals the key to 1e-8, 3 parameter sets")

def q14a_iv():
    # parabola y=(x^2-c^2)/(2c); rim at x=1.2 is 0.4 above the lowest point -> find c; check the focus-at-origin reflection property too
    c = sp.Symbol('c', positive=True); y = lambda x, cc: (x**2 - cc**2)/(2*cc)
    cs = sp.solve(sp.Eq(y(sp.Rational(6, 5), c) - y(0, c), sp.Rational(2, 5)), c)[0]
    h = 0 - y(0, cs)                                  # O is the origin; lowest point at y=-c/2
    # reflection check: ray along -j at (x,y(x)), tangent angle psi, reflected direction r = 2(d.t)t - d must point at the origin
    ok = True
    for xv in (0.3, 0.7, 1.2):
        cc = float(cs); yv = y(xv, cc); m = xv/cc
        t = (1/math.sqrt(1+m*m), m/math.sqrt(1+m*m)); dvec = (0, -1)
        dt = dvec[0]*t[0] + dvec[1]*t[1]; r = (2*dt*t[0] - dvec[0], 2*dt*t[1] - dvec[1])
        ok &= abs(r[0]*(-yv) - r[1]*(-xv)) < 1e-12 and (r[0]*(-xv) + r[1]*(-yv)) > 0     # r parallel to PO and pointing towards O
    ok &= abs(float(h) - OVR['q14a-iv']['key']['value']) < 1e-12
    part('q14a-iv', ok, f"c solved from rim x=1.2 being 0.4 above the vertex: c={cs}; O is c/2 = {h} m above the lowest point; reflected ray directions checked to pass through O at 3 points")

def q14b_iii():
    n = sp.Symbol('n'); ke = kexpr('q14b-iii', ['n']); ok = True
    for N in range(3, 12):
        # count proper 3-colourings of the cycle of N sectors by dynamic programming over colour sequences (brute force for N<=9)
        if N <= 9:
            cnt = sum(1 for col in itertools.product(range(3), repeat=N) if all(col[i] != col[(i+1) % N] for i in range(N)))
        else:
            cnt = 0
            for first in range(3):
                dp = {first: 1}
                for _ in range(N-1):
                    nd = {}
                    for cu, w in dp.items():
                        for cn in range(3):
                            if cn != cu: nd[cn] = nd.get(cn, 0) + w
                    dp = nd
                cnt += sum(w for cu, w in dp.items() if cu != first)
        ok &= cnt == ke.subs(n, N)
    part('q14b-iii', ok, "brute-force count of proper 3-colourings of an N-sector wheel (neighbours incl. sector N-sector 1 differ), N=3..11, equals the key")

ITEMS = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11c, q11d, q11e, q12a, q12b, q12c_ii, q12c_iii, q13a_ii, q13a_iii, q13b_ii, q13b_iii, q14a_iv, q14b_iii]
if __name__ == '__main__':
    for fn in ITEMS:
        try: fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), 'FAIL', f'script error {type(e).__name__}: {e}')
    finish(KNOWN_DISAGREEMENTS)
